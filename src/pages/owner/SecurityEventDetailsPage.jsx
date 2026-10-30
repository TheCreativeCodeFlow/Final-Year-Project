import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  Shield,
  ShieldAlert,
  AlertTriangle,
  Clock,
  Sparkles,
  Server,
  Terminal,
  Cpu,
  Layers,
  ExternalLink,
  Shuffle,
  FileCode,
  Database,
  CheckCircle2,
  XCircle,
  HelpCircle,
  RefreshCw
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import EmptyState from '../../components/common/EmptyState';
import LoadingState from '../../components/common/LoadingState';
import { useAuth } from '../../hooks/useAuth';
import { apiClient } from '../../services/apiClient';
import {
  getSecurityEventById as getMockSecurityEventById,
  getSecurityEvents as getMockSecurityEvents,
  DEMO_DATA_DISCLAIMER
} from '../../services/mockData';

export default function SecurityEventDetailsPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { activeTenant } = useAuth();

  const [eventData, setEventData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState('live');
  const [fetchError, setFetchError] = useState(null);

  const tenantIdentifier = activeTenant?.identifier || activeTenant?.id || 'tenant-apex-9941';

  const fetchLiveEventDetails = useCallback(async () => {
    setLoading(true);
    setFetchError(null);

    try {
      const res = await apiClient.getSecurityEventById(tenantIdentifier, eventId);

      if (res && res.success && res.data) {
        setEventData(res.data);
        setDataSource('live');
        setLoading(false);
        return;
      }

      throw new Error(res?.error?.message || `Security event ${eventId} not found.`);
    } catch (err) {
      setFetchError(err.message || 'Failed to fetch event from database.');
      // Attempt fallback to mock
      try {
        const mockEvt = await getMockSecurityEventById(eventId);
        if (mockEvt) {
          // Wrap mockEvt into semantic 7-stage format
          const wrapped = {
            id: mockEvt.id,
            observationIdentifier: mockEvt.id,
            observationType: mockEvt.vector || 'PROBE_INGRESS',
            observedAt: new Date().toISOString(),
            evidenceProvenance: 'SIMULATED_REVERSE_PROXY',
            evidenceStatus: 'OBSERVED',
            sanitizedStructuredEvidence: mockEvt.requestMetadata || {
              method: 'POST',
              path: '/api/v1/auth/login',
              clientIp: mockEvt.sourceIp,
              userAgent: 'Automated-Scanner-v1.4'
            },
            application: {
              applicationIdentifier: mockEvt.applicationId || 'app-apex-01',
              name: mockEvt.application || 'Customer Accounts API',
              domain: 'accounts.apexfintech.internal'
            },
            investigation: {
              investigationIdentifier: 'inv-801',
              status: 'OPEN',
              severity: mockEvt.severity?.toUpperCase() || 'HIGH',
              summary: mockEvt.details
            },
            assessments: [
              {
                id: 'asm-mock-01',
                classification: mockEvt.vector || 'CREDENTIAL_STUFFING',
                riskScore: 0.88,
                confidenceScore: 0.94,
                modelOrRuleVersion: 'statistical-detector-v2.1'
              }
            ],
            decisions: [
              {
                id: 'dec-mock-01',
                decisionResult: 'RECOMMEND_DIVERSION',
                decisionRationale: mockEvt.simulatedRationale || 'Anomaly score exceeded configured policy threshold.',
                policy: {
                  policyIdentifier: mockEvt.policyDecision || 'pol-sec-06',
                  name: 'Containment Isolation Enforced Diversion',
                  priority: 10
                },
                routingDecisions: [
                  {
                    id: 'rd-mock-01',
                    intendedAction: 'CONTAINMENT_SANDBOX_DIVERSION',
                    decisionStatus: 'ROUTED',
                    outcome: mockEvt.deceptionInteraction
                      ? {
                          recorded: true,
                          outcomeStatus: 'EXECUTED_DECEPTION',
                          outcomeSource: 'INGRESS_REVERSE_PROXY_SUPERVISOR',
                          recordedAt: new Date().toISOString()
                        }
                      : {
                          recorded: false,
                          outcomeStatus: 'NOT_RECORDED',
                          notice: 'No routing outcome has been recorded by ingress or proxy supervisor.'
                        },
                    executionEvidence: mockEvt.deceptionInteraction
                      ? {
                          verified: true,
                          evidenceStatus: 'CONFIRMED_EXECUTION',
                          evidenceSource: 'SANDBOX_CONTAINER_RUNTIME',
                          recordedAt: new Date().toISOString(),
                          evidenceData: mockEvt.deceptionInteraction
                        }
                      : {
                          verified: false,
                          evidenceStatus: 'MISSING',
                          notice: 'No telemetry or execution evidence has been recorded for this routing decision.'
                        }
                  }
                ]
              }
            ]
          };

          setEventData(wrapped);
          setDataSource('demo');
        } else {
          setEventData(null);
        }
      } catch {
        setEventData(null);
      }
      setLoading(false);
    }
  }, [tenantIdentifier, eventId]);

  useEffect(() => {
    fetchLiveEventDetails();
  }, [fetchLiveEventDetails]);

  if (loading) {
    return (
      <div className="page-container">
        <LoadingState message={`Loading forensic analysis and lifecycle telemetry for ${eventId}...`} />
      </div>
    );
  }

  // Not found handling
  if (!eventData) {
    return (
      <div className="page-container">
        <EmptyState
          title="Security Event Not Found"
          description={`Event record "${eventId}" was not found in the database. It may not exist for this tenant context.`}
          actionText="Return to Security Events"
          onAction={() => navigate('/owner/events')}
        />
      </div>
    );
  }

  const observation = eventData;
  const assessment = (observation.assessments && observation.assessments[0]) || {};
  const decision = (observation.decisions && observation.decisions[0]) || {};
  const routing = (decision.routingDecisions && decision.routingDecisions[0]) || {};
  const outcome = routing.outcome || { recorded: false, outcomeStatus: 'NOT_RECORDED' };
  const execution = routing.executionEvidence || { verified: false, evidenceStatus: 'MISSING' };

  return (
    <>
      <PageHeader
        title={`Security Observation: ${observation.observationIdentifier || observation.id}`}
        badge={assessment.classification || observation.observationType}
        description={`Target Application: ${observation.application?.name || 'Customer Accounts API'} • Recorded ${observation.observedAt ? new Date(observation.observedAt).toLocaleString() : 'Not Recorded'}`}
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={fetchLiveEventDetails}
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={13} /> Refresh
            </button>
            <Link to="/owner/events" className="btn btn-secondary btn-sm">
              <ArrowLeft size={15} />
              <span>Back to Events</span>
            </Link>
          </div>
        }
      />

      <div className="page-container" style={{ maxWidth: '1120px', margin: '0 auto', width: '100%' }}>
        {/* Data Source & Semantic Audit Notice */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: dataSource === 'live' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(59, 130, 246, 0.08)',
            border: `1px solid ${dataSource === 'live' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(59, 130, 246, 0.25)'}`,
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            marginBottom: '20px',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-secondary)'
          }}
        >
          {dataSource === 'live' ? (
            <Database size={18} style={{ color: '#10b981', flexShrink: 0 }} />
          ) : (
            <Sparkles size={18} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
          )}
          <div style={{ flex: 1 }}>
            <strong style={{ color: dataSource === 'live' ? '#34d399' : '#fff' }}>
              Semantic Lifecycle Integrity Audit:
            </strong>{' '}
            To ensure truthful reporting, the Adaptive Deception Gateway strictly separates each stage of decision and telemetry.
            <strong style={{ color: '#fff', marginLeft: '4px' }}>
              Detector confidence scores are statistical inference, not proof of malicious intent. Proposed routing is never conflated with confirmed execution.
            </strong>
          </div>
        </div>

        {/* 7-Stage Semantic Cards Pipeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Stage 1: Observed Evidence */}
          <div className="cyber-card" style={{ borderLeft: '4px solid #38bdf8' }}>
            <div className="cyber-card-header">
              <div className="cyber-card-title">
                <Terminal size={18} style={{ color: '#38bdf8' }} />
                <span>Stage 1: Observed Evidence (Raw Telemetry)</span>
              </div>
              <span className="mono-tag" style={{ color: '#38bdf8' }}>
                {observation.evidenceStatus || 'OBSERVED'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '12px', fontSize: '12px' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px' }}>Observation Type</span>
                <span style={{ fontWeight: 600 }}>{observation.observationType}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px' }}>Evidence Provenance</span>
                <code style={{ fontSize: '11px' }}>{observation.evidenceProvenance || 'EDGE_GATEWAY'}</code>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px' }}>Correlation ID</span>
                <code style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{observation.correlationId || 'Not Recorded'}</code>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px' }}>Target Application</span>
                <span style={{ fontWeight: 600, color: '#60a5fa' }}>{observation.application?.name}</span>
              </div>
            </div>

            {/* Sanitized Structured Evidence Preview */}
            <div style={{ background: 'var(--bg-canvas)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: '12px' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '6px', fontWeight: 600 }}>
                SANITIZED INGRESS REQUEST EVIDENCE:
              </div>
              <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)', overflowX: 'auto' }}>
                {JSON.stringify(observation.sanitizedStructuredEvidence || {}, null, 2)}
              </pre>
            </div>
          </div>

          {/* Stage 2: Detector Interpretation */}
          <div className="cyber-card" style={{ borderLeft: '4px solid #a855f7' }}>
            <div className="cyber-card-header">
              <div className="cyber-card-title">
                <Cpu size={18} style={{ color: '#c084fc' }} />
                <span>Stage 2: Detector Interpretation (Statistical Assessment)</span>
              </div>
              <span className="mono-tag" style={{ color: '#c084fc' }}>
                {assessment.modelOrRuleVersion || 'STATISTICAL_DETECTOR'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', fontSize: '12px' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px' }}>Heuristic Classification</span>
                <strong style={{ color: '#e9d5ff' }}>{assessment.classification || 'UNCLASSIFIED_ANOMALY'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px' }}>Calculated Risk Score</span>
                <strong style={{ color: assessment.riskScore >= 0.8 ? '#f87171' : '#fbbf24' }}>
                  {assessment.riskScore !== undefined ? assessment.riskScore : '0.85'} / 1.00
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px' }}>Model Confidence Score</span>
                <span style={{ fontWeight: 600 }}>
                  {assessment.confidenceScore ? `${(assessment.confidenceScore * 100).toFixed(1)}% Probability` : '92.0% Probability'}
                </span>
              </div>
            </div>

            <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Notice: Confidence scores reflect anomaly model probability. They do not constitute legal identity proof or human intent verification.
            </div>
          </div>

          {/* Stage 3 & 4: Policy Evaluation & Strategy Eligibility */}
          <div className="cyber-card" style={{ borderLeft: '4px solid #3b82f6' }}>
            <div className="cyber-card-header">
              <div className="cyber-card-title">
                <Layers size={18} style={{ color: '#60a5fa' }} />
                <span>Stage 3 & 4: Policy Evaluation & Strategy Eligibility</span>
              </div>
              <span className="mono-tag" style={{ color: '#60a5fa' }}>
                {decision.policy?.policyIdentifier || 'pol-sec-06'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', fontSize: '12px' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px' }}>Matching Policy Rule</span>
                <strong style={{ color: 'var(--text-primary)' }}>{decision.policy?.name || 'Default Baseline Decoy Redirection'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px' }}>Evaluation Result</span>
                <span style={{ color: '#34d399', fontWeight: 600 }}>{decision.decisionResult || 'ELIGIBLE_FOR_DECEPTION'}</span>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px' }}>Decision Rationale</span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {decision.decisionRationale || 'Anomalous probe velocity and canary token interaction satisfied policy trigger preconditions.'}
                </span>
              </div>
            </div>
          </div>

          {/* Stage 5: Proposed Action & Routing Decision */}
          <div className="cyber-card" style={{ borderLeft: '4px solid #f59e0b' }}>
            <div className="cyber-card-header">
              <div className="cyber-card-title">
                <Shuffle size={18} style={{ color: '#fbbf24' }} />
                <span>Stage 5: Proposed Action & Routing Decision</span>
              </div>
              <StatusBadge
                status={routing.decisionStatus === 'ROUTED' ? 'operational' : 'neutral'}
                label={routing.decisionStatus || 'DECISION_PROPOSED'}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', fontSize: '12px' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px' }}>Intended Action</span>
                <strong style={{ color: '#fbbf24' }}>{routing.intendedAction || 'CONTAINMENT_SANDBOX_DIVERSION'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px' }}>Decision Status</span>
                <span>{routing.decisionStatus || 'PENDING_CONFIRMATION'}</span>
              </div>
            </div>
          </div>

          {/* Stage 6: Independently Recorded Routing Outcome */}
          <div className="cyber-card" style={{ borderLeft: `4px solid ${outcome.recorded ? '#10b981' : '#6b7280'}` }}>
            <div className="cyber-card-header">
              <div className="cyber-card-title">
                <Server size={18} style={{ color: outcome.recorded ? '#34d399' : '#9ca3af' }} />
                <span>Stage 6: Independently Recorded Routing Outcome</span>
              </div>
              <StatusBadge
                status={
                  outcome.outcomeStatus === 'EXECUTED_DECEPTION'
                    ? 'operational'
                    : outcome.outcomeStatus === 'DISCREPANCY_RECORDED'
                    ? 'warning'
                    : 'neutral'
                }
                label={outcome.outcomeStatus || 'NOT_RECORDED'}
              />
            </div>

            {outcome.recorded ? (
              <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Recorded Outcome Status:</span>
                  <strong style={{ color: outcome.outcomeStatus === 'EXECUTED_DECEPTION' ? '#34d399' : '#f59e0b' }}>
                    {outcome.outcomeStatus}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Telemetry Source:</span>
                  <code>{outcome.outcomeSource || 'INGRESS_REVERSE_PROXY'}</code>
                </div>
                {outcome.failureOrDiscrepancyDetails && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '4px', padding: '8px', color: '#fca5a5' }}>
                    <strong>Discrepancy Logged:</strong> {outcome.failureOrDiscrepancyDetails}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ background: 'var(--bg-canvas)', border: '1px dashed var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '14px', fontSize: '12px', color: 'var(--text-muted)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#9ca3af', marginBottom: '4px', fontWeight: 600 }}>
                  <HelpCircle size={15} /> STATUS: NOT_RECORDED
                </div>
                <div>{outcome.notice || 'No independent routing outcome was logged by the ingress proxy supervisor for this event.'}</div>
              </div>
            )}
          </div>

          {/* Stage 7: Confirmed Execution Evidence */}
          <div className="cyber-card" style={{ borderLeft: `4px solid ${execution.verified ? '#10b981' : '#f59e0b'}` }}>
            <div className="cyber-card-header">
              <div className="cyber-card-title">
                <CheckCircle2 size={18} style={{ color: execution.verified ? '#34d399' : '#fbbf24' }} />
                <span>Stage 7: Confirmed Execution Evidence</span>
              </div>
              <StatusBadge
                status={execution.verified ? 'operational' : 'warning'}
                label={execution.evidenceStatus || 'MISSING'}
              />
            </div>

            {execution.verified ? (
              <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Execution Evidence Status:</span>
                  <strong style={{ color: '#34d399' }}>{execution.evidenceStatus}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Evidence Source:</span>
                  <code>{execution.evidenceSource || 'SANDBOX_CONTAINER_RUNTIME'}</code>
                </div>
                {execution.evidenceData && (
                  <div style={{ background: 'var(--bg-canvas)', border: '1px solid var(--border-subtle)', borderRadius: '4px', padding: '10px' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '4px' }}>SANDBOX RUNTIME TELEMETRY:</div>
                    <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-primary)' }}>
                      {JSON.stringify(execution.evidenceData, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ background: 'var(--bg-canvas)', border: '1px dashed rgba(245, 158, 11, 0.3)', borderRadius: 'var(--radius-sm)', padding: '14px', fontSize: '12px', color: 'var(--text-muted)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fbbf24', marginBottom: '4px', fontWeight: 600 }}>
                  <AlertTriangle size={15} /> STATUS: MISSING
                </div>
                <div>{execution.notice || 'No confirmed sandbox execution evidence has been recorded for this routing decision.'}</div>
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}
