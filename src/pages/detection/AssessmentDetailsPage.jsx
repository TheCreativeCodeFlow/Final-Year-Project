import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ShieldAlert,
  Activity,
  Cpu,
  Compass,
  ShieldCheck,
  RefreshCw,
  FileText,
  Info,
  ExternalLink
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import EmptyState from '../../components/common/EmptyState';
import { useAuth } from '../../hooks/useAuth';
import { apiClient } from '../../services/apiClient';
import './detection.css';

export default function AssessmentDetailsPage() {
  const { assessmentId } = useParams();
  const navigate = useNavigate();
  const { activeTenant } = useAuth();
  const tenantIdentifier = activeTenant?.id || activeTenant?.identifier || 'tenant-apex-9941';

  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  const fetchAssessment = useCallback(async () => {
    setLoading(true);
    setFetchError(null);

    try {
      const res = await apiClient.getDetectionAssessmentById(tenantIdentifier, assessmentId);
      if (res && res.success && res.data) {
        setAssessment(res.data);
      } else {
        throw new Error(res?.error?.message || `Assessment "${assessmentId}" was not found.`);
      }
    } catch (err) {
      setFetchError(err.message || 'Failed to fetch assessment details from database.');
    } finally {
      setLoading(false);
    }
  }, [tenantIdentifier, assessmentId]);

  useEffect(() => {
    fetchAssessment();
  }, [fetchAssessment]);

  if (loading) {
    return (
      <div className="detection-page">
        <LoadingState message="Retrieving behavioral assessment from database..." />
      </div>
    );
  }

  if (fetchError || !assessment) {
    return (
      <div className="detection-page">
        <PageHeader
          title="Assessment Details"
          subtitle="Inspection of behavioral detection evidence and decision safety"
        />
        <EmptyState
          icon={ShieldAlert}
          title="Assessment Not Found"
          message={fetchError || `Assessment "${assessmentId}" does not exist for this tenant.`}
          actionLabel="Return to Assessments"
          onAction={() => navigate('/detection/assessments')}
        />
      </div>
    );
  }

  const {
    id,
    sessionRef,
    windowLabel = '5m',
    assessmentLabel = 'NORMAL',
    classification = 'BENIGN_BASELINE',
    riskScore = null,
    confidenceScore = null,
    ruleFindings = [],
    mlAnomalyResult = {},
    explanation = {},
    dataQualityState = 'COMPLETE',
    telemetryLossDetected = false,
    assessedAt,
    application,
    observation
  } = assessment;

  const explObj = typeof explanation === 'object' && explanation !== null ? explanation : {};
  const deceptionEligible = assessment.deceptionEligible !== undefined
    ? Boolean(assessment.deceptionEligible)
    : (explObj.deceptionEligible !== undefined ? Boolean(explObj.deceptionEligible) : false);

  const rawEv = observation?.sanitizedStructuredEvidence || {};
  const httpMethod = rawEv.method || rawEv.httpMethod || 'N/A';
  const requestPath = rawEv.path || rawEv.targetPath || 'N/A';
  const clientIp = rawEv.clientIp || rawEv.sourceIp || 'N/A';
  const statusCode = rawEv.statusCode || rawEv.status || 'N/A';

  const labelClass = `badge-label badge-label-${assessmentLabel.toLowerCase()}`;
  const isEligible = deceptionEligible;

  return (
    <div className="detection-page">
      <PageHeader
        title={`Assessment #${String(id).slice(0, 13)}`}
        subtitle={`Evaluated on ${assessedAt ? new Date(assessedAt).toLocaleString() : 'N/A'} for application ${application?.name || 'Customer Accounts API'}`}
        breadcrumbs={[
          { label: 'Detection', to: '/detection/overview' },
          { label: 'Assessments', to: '/detection/assessments' },
          { label: String(id).slice(0, 8) }
        ]}
        actions={
          <div className="detection-header-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={fetchAssessment}>
              <RefreshCw size={14} />
              <span>Refresh</span>
            </button>
            <Link to="/detection/assessments" className="btn btn-ghost btn-sm">
              <ArrowLeft size={14} />
              <span>All Assessments</span>
            </Link>
          </div>
        }
      />

      {/* Top Status Strip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <span className={labelClass}>{assessmentLabel.replace(/_/g, ' ')}</span>
        <span className={`badge-eligibility ${isEligible ? 'badge-eligibility-eligible' : 'badge-eligibility-ineligible'}`}>
          {isEligible ? 'DECEPTION ELIGIBLE' : 'DECEPTION INELIGIBLE'}
        </span>
        <span className={`badge-quality badge-quality-${dataQualityState.toLowerCase()}`}>
          TELEMETRY: {dataQualityState}
        </span>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Session: <code style={{ color: 'var(--accent-primary-light)' }}>{sessionRef || 'anonymous'}</code>
        </span>
      </div>

      {/* Audit Banner */}
      <div className="detection-banner detection-banner-neutral">
        <Info size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <strong>Decision Safety Principle:</strong> Deception eligibility indicates whether policy evaluation criteria have been satisfied for future diversion engines. The gateway runtime foundation does NOT execute autonomous traffic diversion; <em>countermeasure execution evidence remains strictly MISSING</em>.
        </div>
      </div>

      {/* D. Reasoning Path */}
      <div className="detection-card">
        <div className="detection-card-title">
          <span>D. Assessment Reasoning Path</span>
          <Compass size={16} style={{ color: 'var(--accent-deception)' }} />
        </div>
        <div className="reasoning-path">
          <div className="reasoning-step">
            <span className="reasoning-step-number">Step 1</span>
            <span className="reasoning-step-title">Ingress Event</span>
            <span className="reasoning-step-desc">{httpMethod} {requestPath}</span>
            <span className="reasoning-step-badge" style={{ color: '#6ee7b7' }}>Observed</span>
          </div>
          <div className="reasoning-step">
            <span className="reasoning-step-number">Step 2</span>
            <span className="reasoning-step-title">Feature Extraction</span>
            <span className="reasoning-step-desc">{windowLabel} window</span>
            <span className="reasoning-step-badge" style={{ color: dataQualityState === 'COMPLETE' ? '#6ee7b7' : '#fdba74' }}>
              {dataQualityState}
            </span>
          </div>
          <div className="reasoning-step">
            <span className="reasoning-step-number">Step 3</span>
            <span className="reasoning-step-title">Rule Evaluation</span>
            <span className="reasoning-step-desc">
              {ruleFindings.filter((r) => r.triggered).length} Triggered
            </span>
            <span className="reasoning-step-badge" style={{ color: ruleFindings.some((r) => r.triggered) ? '#fca5a5' : '#6ee7b7' }}>
              {ruleFindings.some((r) => r.triggered) ? 'Violations' : 'Clean'}
            </span>
          </div>
          <div className="reasoning-step">
            <span className="reasoning-step-number">Step 4</span>
            <span className="reasoning-step-title">ML Anomaly</span>
            <span className="reasoning-step-desc">
              Score: {mlAnomalyResult?.anomalyScore !== null && mlAnomalyResult?.anomalyScore !== undefined ? mlAnomalyResult.anomalyScore.toFixed(3) : 'N/A'}
            </span>
            <span className="reasoning-step-badge" style={{ color: mlAnomalyResult?.isAnomaly ? '#fca5a5' : '#6ee7b7' }}>
              {mlAnomalyResult?.isAnomaly ? 'Anomaly' : 'Baseline'}
            </span>
          </div>
          <div className="reasoning-step">
            <span className="reasoning-step-number">Step 5</span>
            <span className="reasoning-step-title">Hybrid Fusion</span>
            <span className="reasoning-step-desc">{classification}</span>
            <span className="reasoning-step-badge" style={{ color: '#d8b4fe' }}>
              {riskScore !== null ? `Risk ${(riskScore * 100).toFixed(0)}%` : 'Insufficient'}
            </span>
          </div>
          <div className="reasoning-step" style={{ borderColor: isEligible ? 'rgba(139, 92, 246, 0.6)' : 'var(--border-default)' }}>
            <span className="reasoning-step-number">Step 6</span>
            <span className="reasoning-step-title">Deception Gate</span>
            <span className="reasoning-step-desc">{isEligible ? 'Criteria Met' : 'Suppressed'}</span>
            <span className="reasoning-step-badge" style={{ color: isEligible ? '#d8b4fe' : '#94a3b8' }}>
              {isEligible ? 'ELIGIBLE' : 'INELIGIBLE'}
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        {/* E. Decision Safety */}
        <div className="detection-card">
          <div className="detection-card-title">
            <span>E. Decision Safety & Guardrails</span>
            <ShieldCheck size={16} style={{ color: isEligible ? '#a78bfa' : '#94a3b8' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '1rem' }}>
            <div className="feature-box">
              <div className="feature-label">Telemetry Completeness</div>
              <div className="feature-val" style={{ color: dataQualityState === 'COMPLETE' ? '#6ee7b7' : '#f87171' }}>
                {dataQualityState}
              </div>
            </div>
            <div className="feature-box">
              <div className="feature-label">Telemetry Loss</div>
              <div className="feature-val" style={{ color: telemetryLossDetected ? '#f87171' : '#6ee7b7' }}>
                {telemetryLossDetected ? 'LOSS DETECTED' : 'NONE'}
              </div>
            </div>
            <div className="feature-box">
              <div className="feature-label">Confidence Score</div>
              <div className="feature-val">
                {confidenceScore !== null ? `${(confidenceScore * 100).toFixed(0)}%` : 'N/A'}
              </div>
            </div>
            <div className="feature-box">
              <div className="feature-label">Deception Policy Gate</div>
              <div className="feature-val" style={{ color: isEligible ? '#d8b4fe' : '#94a3b8' }}>
                {isEligible ? 'ELIGIBLE' : 'INELIGIBLE'}
              </div>
            </div>
          </div>

          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', background: 'var(--bg-surface-elevated)', padding: '0.75rem', borderRadius: '6px' }}>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
              Eligibility Rationale:
            </div>
            <div>
              {isEligible
                ? 'Eligible: Corroborated deterministic attack pattern with complete telemetry, high confidence (>= 0.70), and low session collision risk.'
                : (telemetryLossDetected || dataQualityState !== 'COMPLETE'
                    ? 'Ineligible: Degraded telemetry or data loss detected during session; diversion strictly prohibited to prevent misattribution.'
                    : (ruleFindings.filter((r) => r.triggered).length === 0
                        ? 'Ineligible: Unsupervised ML anomaly alone lacks deterministic rule corroboration; autonomous diversion is blocked.'
                        : 'Ineligible: Insufficient confidence or absence of HIGH/CRITICAL rule corroboration prevents countermeasure activation.'
                      )
                  )
              }
            </div>
            <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.75rem', color: '#f87171' }}>
              <strong>Execution Evidence Status:</strong> <code>MISSING</code> (No traffic diversion or honeypot execution has been performed by the gateway foundation).
            </div>
          </div>
        </div>

        {/* A. Behavioral Evidence */}
        <div className="detection-card">
          <div className="detection-card-title">
            <span>A. Behavioral Evidence (Window: {windowLabel})</span>
            <Activity size={16} style={{ color: 'var(--accent-primary-light)' }} />
          </div>

          <div className="feature-grid">
            <div className="feature-box">
              <div className="feature-label">Target Application</div>
              <div className="feature-val" style={{ fontSize: '0.875rem' }}>
                {application?.name || 'Customer Accounts API'}
              </div>
            </div>
            <div className="feature-box">
              <div className="feature-label">Client IP Reference</div>
              <div className="feature-val" style={{ fontSize: '0.875rem' }}>
                {clientIp}
              </div>
            </div>
            <div className="feature-box">
              <div className="feature-label">HTTP Verb & Route</div>
              <div className="feature-val" style={{ fontSize: '0.8125rem', wordBreak: 'break-all' }}>
                {httpMethod} {requestPath}
              </div>
            </div>
            <div className="feature-box">
              <div className="feature-label">Status Code</div>
              <div className="feature-val">
                HTTP {statusCode}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* B. Deterministic Rule Findings */}
      <div className="detection-card">
        <div className="detection-card-title">
          <span>B. Deterministic Rule Findings ({ruleFindings.length} Evaluated)</span>
          <FileText size={16} style={{ color: '#fdba74' }} />
        </div>

        {ruleFindings.length === 0 ? (
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            No deterministic rule violations recorded for this window.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
            {ruleFindings.map((finding, idx) => {
              const isTriggered = finding.triggered === true;
              const severity = finding.severity || 'LOW';
              return (
                <div key={idx} className={`rule-card ${isTriggered ? 'triggered' : ''}`}>
                  <div className="rule-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
                        {finding.ruleId || `RULE_${idx + 1}`}
                      </span>
                      <span className={`status-badge status-badge-${severity.toLowerCase()}`}>
                        {severity}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: isTriggered ? '#fca5a5' : '#6ee7b7' }}>
                      {isTriggered ? 'TRIGGERED' : 'CLEAN'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {finding.explanation || finding.description || (isTriggered ? 'Deterministic signature violation detected.' : 'Threshold passed.')}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* C. ML Detection */}
      <div className="detection-card">
        <div className="detection-card-title">
          <span>C. Unsupervised Machine Learning Anomaly Detection</span>
          <Cpu size={16} style={{ color: '#c4b5fd' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '1rem' }}>
          <div className="feature-box">
            <div className="feature-label">Algorithm</div>
            <div className="feature-val" style={{ fontSize: '0.8125rem' }}>
              {mlAnomalyResult?.algorithm || 'ISOLATION_FOREST'}
            </div>
          </div>
          <div className="feature-box">
            <div className="feature-label">Anomaly Score</div>
            <div className="feature-val" style={{ color: mlAnomalyResult?.isAnomaly ? '#fca5a5' : '#6ee7b7' }}>
              {mlAnomalyResult?.anomalyScore !== null && mlAnomalyResult?.anomalyScore !== undefined
                ? mlAnomalyResult.anomalyScore.toFixed(4)
                : 'N/A'}
            </div>
          </div>
          <div className="feature-box">
            <div className="feature-label">Decision Threshold</div>
            <div className="feature-val">
              {mlAnomalyResult?.decisionThreshold ?? '0.6000'}
            </div>
          </div>
          <div className="feature-box">
            <div className="feature-label">Model Status</div>
            <div className="feature-val" style={{ fontSize: '0.8125rem' }}>
              {mlAnomalyResult?.modelStatus || 'READY'}
            </div>
          </div>
        </div>

        <div className="detection-banner detection-banner-info">
          <Info size={16} style={{ flexShrink: 0 }} />
          <div>
            <strong>Scientific Note:</strong> Statistical deviation represents unusual behavioral dispersion from learned baseline features and constitutes anomaly evidence, <em>NOT proof of maliciousness or attacker identity</em>.
          </div>
        </div>
      </div>
    </div>
  );
}
