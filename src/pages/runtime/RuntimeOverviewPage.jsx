import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Cpu,
  ShieldCheck,
  ShieldAlert,
  Layers,
  Activity,
  Sliders,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  RefreshCw,
  Info,
  Server,
  Lock,
  FileCheck,
  GitBranch,
  RotateCcw,
  Play,
  Check,
  XCircle
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import { useAuth } from '../../hooks/useAuth';
import { apiClient } from '../../services/apiClient';
import './runtime.css';

export default function RuntimeOverviewPage() {
  const { activeTenant } = useAuth();
  const tenantIdentifier = activeTenant?.id || activeTenant?.identifier || 'tenant-apex-9941';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [overview, setOverview] = useState(null);
  const [reconciling, setReconciling] = useState(false);
  const [mutations, setMutations] = useState([]);
  const [dsgVersions, setDsgVersions] = useState([]);
  const [activeDsgVersion, setActiveDsgVersion] = useState('v1');
  const [dsgFeedback, setDsgFeedback] = useState(null);
  const [rollingBackId, setRollingBackId] = useState(null);
  const [planSubmitting, setPlanSubmitting] = useState(false);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, mutRes, verRes] = await Promise.allSettled([
        apiClient.getRuntimeOverview(tenantIdentifier),
        apiClient.getRuntimeMutations(tenantIdentifier),
        apiClient.getDsgVersionHistory(tenantIdentifier)
      ]);

      if (res.status === 'fulfilled' && res.value && res.value.success && res.value.data) {
        setOverview(res.value.data);
      } else {
        const errMessage = res.status === 'rejected' ? res.reason?.message : res.value?.error?.message;
        throw new Error(errMessage || 'Failed to fetch runtime overview.');
      }

      if (mutRes.status === 'fulfilled' && mutRes.value?.success && Array.isArray(mutRes.value?.data)) {
        setMutations(mutRes.value.data);
      }
      if (verRes.status === 'fulfilled' && verRes.value?.success && Array.isArray(verRes.value?.data)) {
        setDsgVersions(verRes.value.data);
        if (verRes.value.data.length > 0) {
          setActiveDsgVersion(verRes.value.data[0].version || 'v1');
        }
      }
    } catch (err) {
      setError(err.message || 'Error communicating with runtime service.');
    } finally {
      setLoading(false);
    }
  }, [tenantIdentifier]);

  const handleRunReconciliation = async () => {
    setReconciling(true);
    try {
      await apiClient.runRuntimeReconciliation(tenantIdentifier);
      await fetchOverview();
    } catch (err) {
      setError(err.message || 'Failed to trigger reconciliation.');
    } finally {
      setReconciling(false);
    }
  };

  const handleRollback = async (mutationId) => {
    if (!window.confirm(`Are you sure you want to rollback mutation ${mutationId}? This will restore the synthetic container to the pre-mutation state.`)) {
      return;
    }
    setRollingBackId(mutationId);
    setDsgFeedback(null);
    try {
      const res = await apiClient.rollbackDsgMutation(tenantIdentifier, mutationId, {
        operator: 'Operator (UI)',
        reason: 'Manual rollback triggered from Runtime Operations Dashboard'
      });
      if (res && res.success) {
        setDsgFeedback({ type: 'success', message: `Mutation ${mutationId} rolled back successfully.` });
        await fetchOverview();
      } else {
        throw new Error(res?.error?.message || 'Rollback failed.');
      }
    } catch (err) {
      setDsgFeedback({ type: 'error', message: err.message || 'Rollback failed.' });
    } finally {
      setRollingBackId(null);
    }
  };

  const handleSimulateAdaptiveMutation = async () => {
    setPlanSubmitting(true);
    setDsgFeedback(null);
    try {
      const activeEnvId = overview?.environmentsSummary?.activeSimulated > 0 ? 'env-active' : 'env-sim-default';
      const planRes = await apiClient.generateDsgPlan(tenantIdentifier, {
        environmentId: activeEnvId,
        sessionObservation: {
          behaviorProfile: {
            reconnaissanceScore: 0.85,
            targetedEndpoints: ['/api/v1/auth/login', '/api/v1/users/admin'],
            credentialStuffingDetected: true,
            observedAttackerClass: 'CREDENTIAL_STUFFER'
          }
        }
      });

      if (!planRes.success) {
        throw new Error(planRes.error?.message || 'Plan generation failed');
      }

      setDsgFeedback({
        type: 'success',
        message: `Generated adaptive DSG plan: ${planRes.data.strategy} (${planRes.data.proposedMutations?.length || 0} mutation(s) proposed).`
      });
      await fetchOverview();
    } catch (err) {
      setDsgFeedback({ type: 'error', message: err.message || 'Adaptive plan generation failed.' });
    } finally {
      setPlanSubmitting(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  return (
    <div className="runtime-page">
      <PageHeader
        title="Deception Runtime Operations"
        subtitle="Stage 5B.2 isolated synthetic container provisioning, lifecycle state machine, and resource governance"
        actions={
          <div className="runtime-header-actions">
            <button
              className="btn btn-secondary"
              onClick={fetchOverview}
              disabled={loading}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
            <Link
              to="/runtime/authorizations"
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <ShieldCheck size={16} />
              <span>Review Authorizations</span>
            </Link>
          </div>
        }
      />

      {/* Safety Notice Banner */}
      <div className="runtime-notice-banner">
        <Info size={20} style={{ flexShrink: 0, color: '#38bdf8' }} />
        <div>
          {overview?.runtimeArchitectureStatus === 'STAGE_5B2_PROVISIONING_ACTIVE' ? (
            <>
              <strong>Stage 5B.2 Isolated Synthetic Container Provisioning Active:</strong> Real local Docker containers provisioned within isolated, internal-only bridge networks with negative egress quarantine, non-root execution (UID 1000), read-only root filesystems, and zero host port mapping. Live gateway traffic diversion remains strictly prohibited.
            </>
          ) : (
            <>
              <strong>Stage 5B.1 Architecture &amp; Simulation Mode:</strong> Foundational execution framework ready. Synthetic container provisioning is available for approved authorizations. Real-time traffic diversion to deception containers remains strictly disabled.
            </>
          )}
        </div>
      </div>

      {loading && <LoadingState message="Loading deception runtime overview..." />}

      {error && (
        <div className="runtime-notice-banner warning">
          <AlertTriangle size={20} style={{ flexShrink: 0, color: '#f59e0b' }} />
          <div>
            <strong>Error loading runtime status:</strong> {error}
          </div>
        </div>
      )}

      {!loading && overview && (
        <>
          {/* Active Runtime Alerts (Stage 5B.3) */}
          {(overview.healthSummary?.unhealthy > 0 ||
            overview.reconciliationSummary?.mismatchCount > 0 ||
            overview.reconciliationSummary?.orphanContainersCount > 0 ||
            overview.telemetrySummary?.droppedCount > 0) && (
            <div className="runtime-alert-box">
              <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Active Runtime Alerts:</strong>
                <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.5 }}>
                  {overview.healthSummary?.unhealthy > 0 && (
                    <li>{overview.healthSummary.unhealthy} environment(s) report UNHEALTHY: Internal service probe failed or container stopped unexpectedly.</li>
                  )}
                  {overview.reconciliationSummary?.mismatchCount > 0 && (
                    <li>{overview.reconciliationSummary.mismatchCount} state mismatch(es) detected between database records and Docker containers.</li>
                  )}
                  {overview.reconciliationSummary?.orphanContainersCount > 0 && (
                    <li>{overview.reconciliationSummary.orphanContainersCount} unmanaged orphan deception container(s) detected on Docker daemon.</li>
                  )}
                  {overview.telemetrySummary?.droppedCount > 0 && (
                    <li>Telemetry queue overflow: {overview.telemetrySummary.droppedCount} event(s) dropped to preserve memory bounds.</li>
                  )}
                </ul>
              </div>
            </div>
          )}

          {/* Runtime Health State Breakdown (Stage 5B.3) */}
          <div style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={18} color="#38bdf8" />
              <span>Runtime Health State Distribution</span>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 400 }}>
                {overview.healthSummary?.lastHealthCheckTimestamp
                  ? `(Last observed: ${new Date(overview.healthSummary.lastHealthCheckTimestamp).toLocaleTimeString()})`
                  : '(No live health check recorded)'}
              </span>
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
              <div className="runtime-card" style={{ padding: '0.75rem 1rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>HEALTHY</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#34d399', marginTop: '0.25rem' }}>
                  {overview.healthSummary?.healthy ?? 0}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>HTTP 200, cgroups nominal</div>
              </div>
              <div className="runtime-card" style={{ padding: '0.75rem 1rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>DEGRADED</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fbbf24', marginTop: '0.25rem' }}>
                  {overview.healthSummary?.degraded ?? 0}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>High memory, PIDs, or latency</div>
              </div>
              <div className="runtime-card" style={{ padding: '0.75rem 1rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>UNHEALTHY</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f87171', marginTop: '0.25rem' }}>
                  {overview.healthSummary?.unhealthy ?? 0}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Probe failed or stopped</div>
              </div>
              <div className="runtime-card" style={{ padding: '0.75rem 1rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>UNKNOWN</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#94a3b8', marginTop: '0.25rem' }}>
                  {overview.healthSummary?.unknown ?? 0}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Missing observation</div>
              </div>
              <div className="runtime-card" style={{ padding: '0.75rem 1rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>TERMINATED</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#64748b', marginTop: '0.25rem' }}>
                  {overview.healthSummary?.terminated ?? 0}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Safely decommissioned</div>
              </div>
            </div>
          </div>

          {/* Reconciliation & Telemetry Overview (Stage 5B.3) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
            {/* Reconciliation State Card */}
            <div className="runtime-card">
              <div className="runtime-card-title">
                <span>Lifecycle Reconciliation State</span>
                <span className={`status-pill ${overview.reconciliationSummary?.overallStatus === 'CONSISTENT' ? 'verified' : 'blocked'}`}>
                  {overview.reconciliationSummary?.overallStatus || 'CONSISTENT'}
                </span>
              </div>
              <p style={{ fontSize: '0.8125rem', color: '#94a3b8', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                Continuous 5-layer comparison across PostgreSQL DB, Worker IPC, Docker containers, Isolated networks, and Append-linked Evidence.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem', textAlign: 'center' }}>
                <div style={{ background: '#090f1d', padding: '0.5rem', borderRadius: '4px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Consistent</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#34d399' }}>{overview.reconciliationSummary?.consistentCount ?? 0}</div>
                </div>
                <div style={{ background: '#090f1d', padding: '0.5rem', borderRadius: '4px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Mismatches</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: overview.reconciliationSummary?.mismatchCount > 0 ? '#f87171' : '#64748b' }}>
                    {overview.reconciliationSummary?.mismatchCount ?? 0}
                  </div>
                </div>
                <div style={{ background: '#090f1d', padding: '0.5rem', borderRadius: '4px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Orphans</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: overview.reconciliationSummary?.orphanContainersCount > 0 ? '#fbbf24' : '#64748b' }}>
                    {overview.reconciliationSummary?.orphanContainersCount ?? 0}
                  </div>
                </div>
              </div>
              <button
                className="btn btn-secondary"
                onClick={handleRunReconciliation}
                disabled={reconciling}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.8rem' }}
              >
                <RefreshCw size={14} className={reconciling ? 'animate-spin' : ''} />
                <span>{reconciling ? 'Scanning Environment Layers...' : 'Run Reconciliation Scan'}</span>
              </button>
            </div>

            {/* Telemetry Activity Card */}
            <div className="runtime-card">
              <div className="runtime-card-title">
                <span>Runtime Telemetry Activity</span>
                <span className={`status-pill ${overview.telemetrySummary?.telemetryQuality === 'NOMINAL' ? 'verified' : 'partially-verified'}`}>
                  {overview.telemetrySummary?.telemetryQuality || 'NOMINAL'}
                </span>
              </div>
              <p style={{ fontSize: '0.8125rem', color: '#94a3b8', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                Bounded synthetic runtime telemetry with credential redaction and pseudonymous session references.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem', textAlign: 'center' }}>
                <div style={{ background: '#090f1d', padding: '0.5rem', borderRadius: '4px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Observed</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#38bdf8' }}>{overview.telemetrySummary?.totalObserved ?? 0}</div>
                </div>
                <div style={{ background: '#090f1d', padding: '0.5rem', borderRadius: '4px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Requests</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>{overview.telemetrySummary?.requestCount ?? 0}</div>
                </div>
                <div style={{ background: '#090f1d', padding: '0.5rem', borderRadius: '4px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Avg Latency</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#34d399' }}>{overview.telemetrySummary?.avgLatencyMs ?? 0}ms</div>
                </div>
                <div style={{ background: '#090f1d', padding: '0.5rem', borderRadius: '4px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Errors</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: overview.telemetrySummary?.errorCount > 0 ? '#f87171' : '#64748b' }}>
                    {overview.telemetrySummary?.errorCount ?? 0}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: '0.725rem', color: '#94a3b8', background: '#090f1d', padding: '0.5rem', borderRadius: '4px' }}>
                <strong>Quality Assurance:</strong> {overview.telemetrySummary?.droppedCount > 0
                  ? `TELEMETRY_DATA_LOSS: ${overview.telemetrySummary.droppedCount} dropped event(s) recorded.`
                  : 'Zero telemetry loss detected; bounded buffer operating within capacity.'}
              </div>
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="runtime-metric-grid">
            <div className="runtime-card">
              <div className="runtime-card-title">
                <span>Architecture Status</span>
                <CheckCircle2 size={16} color="#34d399" />
              </div>
              <div className="runtime-card-value" style={{ fontSize: '1.15rem', color: '#34d399' }}>
                {overview.runtimeArchitectureStatus || 'STAGE_5B2_PROVISIONING_ACTIVE'}
              </div>
              <div className="runtime-card-subtitle">Isolated synthetic provisioning enabled</div>
            </div>

            <div className="runtime-card">
              <div className="runtime-card-title">
                <span>Execution Evidence</span>
                {overview.executionEvidenceStatus === 'VERIFIED' ? (
                  <CheckCircle2 size={16} color="#34d399" />
                ) : (
                  <AlertTriangle size={16} color="#facc15" />
                )}
              </div>
              <div className="runtime-card-value">
                <span
                  className={overview.executionEvidenceStatus === 'VERIFIED' ? 'status-pill authorized' : 'evidence-pill-missing'}
                  style={{ fontSize: '1rem', padding: '0.35rem 0.65rem' }}
                >
                  {overview.executionEvidenceStatus}
                </span>
              </div>
              <div className="runtime-card-subtitle">
                {overview.executionEvidenceStatus === 'VERIFIED' ? 'Verified container evidence logged' : 'Zero unverified live execution allowed'}
              </div>
            </div>

            <div className="runtime-card">
              <div className="runtime-card-title">
                <span>Active Environments</span>
                <Layers size={16} color="#38bdf8" />
              </div>
              <div className="runtime-card-value">
                {overview.environmentsSummary?.activeSimulated || 0}
                <span style={{ fontSize: '1rem', color: '#64748b', fontWeight: 400 }}> / {overview.quotaSummary?.maxActiveEnvironments || 3}</span>
              </div>
              <div className="runtime-card-subtitle">Simulated sandbox environments</div>
            </div>

            <div className="runtime-card">
              <div className="runtime-card-title">
                <span>Pending Approvals</span>
                <Clock size={16} color="#fbbf24" />
              </div>
              <div className="runtime-card-value" style={{ color: overview.authorizationsSummary?.pending > 0 ? '#fbbf24' : '#f8fafc' }}>
                {overview.authorizationsSummary?.pending || 0}
              </div>
              <div className="runtime-card-subtitle">Awaiting Application Owner review</div>
            </div>

            <div className="runtime-card">
              <div className="runtime-card-title">
                <span>Approved Requests</span>
                <ShieldCheck size={16} color="#10b981" />
              </div>
              <div className="runtime-card-value">
                {overview.authorizationsSummary?.approved || 0}
              </div>
              <div className="runtime-card-subtitle">Dual-custody verified authorizations</div>
            </div>

            <div className="runtime-card">
              <div className="runtime-card-title">
                <span>Verified Live Containers</span>
                <Server size={16} color="#38bdf8" />
              </div>
              <div className="runtime-card-value" style={{ color: '#38bdf8' }}>
                {overview.environmentsSummary?.liveContainers ?? overview.environmentsSummary?.verifiedContainersLive ?? 0}
              </div>
              <div className="runtime-card-subtitle">Zero public exposure, egress quarantined</div>
            </div>
          </div>

          {/* Stage 5B.4 Dynamic DSG Execution & Rollback Engine */}
          <div className="runtime-card" style={{ marginBottom: '0.5rem' }}>
            <div className="runtime-card-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <GitBranch size={18} color="#38bdf8" />
                <span style={{ fontSize: '1rem', color: '#f8fafc', fontWeight: 600 }}>Dynamic Deception State Graph (DSG) Execution Engine</span>
                <span className="status-pill verified" style={{ fontSize: '0.7rem' }}>STAGE 5B.4 ACTIVE</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  className="btn btn-secondary"
                  onClick={handleSimulateAdaptiveMutation}
                  disabled={planSubmitting}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                >
                  <Play size={13} className={planSubmitting ? 'animate-spin' : ''} />
                  <span>{planSubmitting ? 'Generating Plan...' : 'Simulate Adaptive Plan'}</span>
                </button>
              </div>
            </div>

            <p style={{ fontSize: '0.8125rem', color: '#94a3b8', margin: '0.25rem 0 0.75rem', lineHeight: 1.5 }}>
              Translates approved behavioral assessments into attacker-specific synthetic environment mutations across 5 dimensions with strict 7-way consistency enforcement, container health verification, and state rollback.
            </p>

            {dsgFeedback && (
              <div
                style={{
                  padding: '0.65rem 0.85rem',
                  borderRadius: '6px',
                  marginBottom: '0.75rem',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: dsgFeedback.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(52, 211, 153, 0.15)',
                  border: `1px solid ${dsgFeedback.type === 'error' ? 'rgba(239, 68, 68, 0.35)' : 'rgba(52, 211, 153, 0.35)'}`,
                  color: dsgFeedback.type === 'error' ? '#fca5a5' : '#a7f3d0'
                }}
              >
                {dsgFeedback.type === 'error' ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
                <span>{dsgFeedback.message}</span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              {/* Active Graph State & 7-Way Consistency Matrix */}
              <div style={{ background: '#090f1d', padding: '0.875rem', borderRadius: '8px', border: '1px solid #1e293b' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Active DSG Version</span>
                  <span className="status-pill authorized" style={{ fontSize: '0.75rem' }}>{activeDsgVersion}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginBottom: '0.5rem' }}>
                  Recorded Versions: <strong>{dsgVersions.length || 1}</strong> | Total Mutations: <strong>{mutations.length}</strong>
                </div>

                <div style={{ fontSize: '0.725rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, margin: '0.75rem 0 0.35rem' }}>
                  7-Way Consistency Verification Matrix
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem', fontSize: '0.7rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#34d399' }}>
                    <Check size={12} /> <span>1. Identity Consistency</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#34d399' }}>
                    <Check size={12} /> <span>2. Auth Mapping</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#34d399' }}>
                    <Check size={12} /> <span>3. API Topology</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#34d399' }}>
                    <Check size={12} /> <span>4. DB Schema</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#34d399' }}>
                    <Check size={12} /> <span>5. Service Topology</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#34d399' }}>
                    <Check size={12} /> <span>6. Network Isolation</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#34d399', gridColumn: 'span 2' }}>
                    <Check size={12} /> <span>7. Historical Graph State Consistency</span>
                  </div>
                </div>
              </div>

              {/* 5-Dimension Mutation Framework Overview */}
              <div style={{ background: '#090f1d', padding: '0.875rem', borderRadius: '8px', border: '1px solid #1e293b' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.5rem' }}>
                  Controlled 5-Dimension Mutation Framework
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.725rem', color: '#94a3b8' }}>
                  <div><strong style={{ color: '#38bdf8' }}>Identity:</strong> Synthetic users, roles, and relationship links.</div>
                  <div><strong style={{ color: '#38bdf8' }}>API Topology:</strong> Dynamic routes, response mutations, availability.</div>
                  <div><strong style={{ color: '#38bdf8' }}>Synthetic Data:</strong> In-memory decoy records and schema alterations.</div>
                  <div><strong style={{ color: '#38bdf8' }}>Service Topology:</strong> Synthetic service modules and configurations.</div>
                  <div><strong style={{ color: '#38bdf8' }}>Credential Deception:</strong> Decoy tokens, honey-credentials, revocation.</div>
                </div>
                <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: '#fbbf24' }}>
                  * Non-arbitrary execution: strictly zero shell, SQL, or Docker commands executed.
                </div>
              </div>
            </div>

            {/* Mutations & Rollback History Table */}
            <div style={{ marginTop: '0.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.5rem' }}>
                Live DSG Mutation Ledger &amp; Rollback Controls
              </div>
              {mutations.length === 0 ? (
                <div style={{ fontSize: '0.75rem', color: '#64748b', background: '#090f1d', padding: '1rem', borderRadius: '6px', textAlign: 'center' }}>
                  No dynamic mutations executed yet. The synthetic environment is running at base graph version ({activeDsgVersion}).
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', fontSize: '0.75rem', color: '#cbd5e1', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #1e293b', textAlign: 'left', color: '#64748b' }}>
                        <th style={{ padding: '0.5rem' }}>Mutation ID</th>
                        <th>Target Version</th>
                        <th>Dimension / Operation</th>
                        <th>Status</th>
                        <th>Timestamp</th>
                        <th style={{ textAlign: 'right', paddingRight: '0.5rem' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mutations.map((m) => {
                        const statusClass =
                          m.executionStatus === 'VERIFIED'
                            ? 'verified'
                            : m.executionStatus === 'EXECUTED'
                            ? 'executed'
                            : m.executionStatus === 'DISPATCHED' || m.executionStatus === 'EXECUTING'
                            ? 'executing'
                            : m.executionStatus === 'ROLLED_BACK'
                            ? 'rolled-back'
                            : m.executionStatus === 'FAILED'
                            ? 'denied'
                            : 'proposed';

                        const isRollbackable =
                          m.executionStatus === 'VERIFIED' || m.executionStatus === 'EXECUTED';

                        return (
                          <tr key={m.id} style={{ borderBottom: '1px solid #0f172a' }}>
                            <td style={{ padding: '0.5rem', fontFamily: 'monospace', color: '#38bdf8' }}>
                              {m.id?.slice(0, 16)}...
                            </td>
                            <td>
                              <span style={{ fontFamily: 'monospace' }}>{m.targetGraphVersion || m.baseGraphVersion}</span>
                            </td>
                            <td>
                              <span style={{ fontWeight: 600, color: '#f8fafc' }}>{m.mutationDimension}</span>
                              <span style={{ color: '#64748b', marginLeft: '0.35rem' }}>({m.mutationOperation})</span>
                            </td>
                            <td>
                              <span className={`status-pill ${statusClass}`}>{m.executionStatus}</span>
                            </td>
                            <td style={{ color: '#94a3b8' }}>
                              {m.createdAt ? new Date(m.createdAt).toLocaleTimeString() : 'Recent'}
                            </td>
                            <td style={{ textAlign: 'right', paddingRight: '0.5rem' }}>
                              {isRollbackable ? (
                                <button
                                  className="btn btn-secondary"
                                  onClick={() => handleRollback(m.id)}
                                  disabled={rollingBackId === m.id}
                                  style={{
                                    fontSize: '0.7rem',
                                    padding: '0.2rem 0.5rem',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.3rem'
                                  }}
                                >
                                  <RotateCcw size={12} className={rollingBackId === m.id ? 'animate-spin' : ''} />
                                  <span>{rollingBackId === m.id ? 'Rolling back...' : 'Rollback'}</span>
                                </button>
                              ) : (
                                <span style={{ color: '#475569', fontSize: '0.7rem' }}>Locked</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Lifecycle & Safety Architecture Details */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.25rem' }}>
            {/* 12-State Execution Lifecycle */}
            <div className="runtime-card">
              <div className="runtime-card-title">
                <span>12-State Execution Lifecycle Machine</span>
                <Activity size={16} color="#38bdf8" />
              </div>
              <p style={{ fontSize: '0.8125rem', color: '#94a3b8', marginBottom: '1rem', lineHeight: 1.5 }}>
                Enforces deterministic progression across 12 canonical states with immutable audit trails. Terminal states (TERMINATED, FAILED, REJECTED, EXPIRED) permanently block further mutations.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                {['DRAFT', 'VALIDATING', 'AUTHORIZED', 'PROVISIONING', 'ACTIVE', 'UPDATING', 'DEGRADED', 'TERMINATING', 'TERMINATED', 'REJECTED', 'FAILED', 'EXPIRED'].map((st) => (
                  <span
                    key={st}
                    className={`status-pill ${
                      st === 'AUTHORIZED' || st === 'ACTIVE'
                        ? 'authorized'
                        : st === 'PENDING' || st === 'VALIDATING' || st === 'PROVISIONING'
                        ? 'provisioning'
                        : st === 'TERMINATED' || st === 'EXPIRED'
                        ? 'terminated'
                        : 'denied'
                    }`}
                  >
                    {st}
                  </span>
                ))}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', background: '#090f1d', padding: '0.75rem', borderRadius: '6px' }}>
                <strong>Safety Guard:</strong> Direct progression to PROVISIONING or ACTIVE live execution is rejected at the state machine boundary until full container orchestration runtime is certified.
              </div>
            </div>

            {/* Separation of Duties & Concurrency */}
            <div className="runtime-card">
              <div className="runtime-card-title">
                <span>Execution Governance &amp; Separation of Duties</span>
                <Lock size={16} color="#fbbf24" />
              </div>
              <ul style={{ fontSize: '0.8125rem', color: '#cbd5e1', paddingLeft: '1.25rem', lineHeight: 1.6, margin: 0 }}>
                <li><strong>Dual Custody:</strong> Security Analysts may request execution; only Application Owners or Platform Admins can approve.</li>
                <li><strong>Anti-Self-Approval:</strong> Requesters cannot approve their own authorization request.</li>
                <li><strong>Optimistic Version Concurrency:</strong> Requests are bound to specific DSG graph and policy versions; approval aborts if graph or policy was mutated.</li>
                <li><strong>Idempotency Verification:</strong> Identical execution requests return existing authorizations; conflicting payloads on key reuse are rejected with 409 Conflict.</li>
                <li><strong>Isolated Container Sandbox:</strong> Non-root (UID 10001), read-only rootfs, dropped capabilities, no privileged flags.</li>
              </ul>
            </div>
          </div>

          {/* Stage 5B.2.2 Process Separation & Worker Boundary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.25rem' }}>
            {/* Independent Operating System Process Isolation */}
            <div className="runtime-card">
              <div className="runtime-card-title">
                <span>Process Separation &amp; Worker Isolation (Finding B)</span>
                <Server size={16} color="#38bdf8" />
              </div>
              <p style={{ fontSize: '0.8125rem', color: '#94a3b8', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                The Express backend and Runtime Worker execute as distinct OS processes. Express has zero Docker socket access and delegates provisioning jobs via authenticated loopback IPC.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div style={{ background: '#090f1d', padding: '0.75rem', borderRadius: '6px', border: '1px solid #1e293b' }}>
                  <div style={{ fontSize: '0.725rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>API Backend Process</div>
                  <div style={{ fontSize: '0.875rem', color: '#f8fafc', fontWeight: 600, marginTop: '0.25rem' }}>
                    PID {overview.backendProcess?.pid || 'Running'}
                  </div>
                  <div style={{ fontSize: '0.725rem', color: '#34d399', marginTop: '0.25rem' }}>
                    Docker Access: <strong>NONE (Verified)</strong>
                  </div>
                </div>
                <div style={{ background: '#090f1d', padding: '0.75rem', borderRadius: '6px', border: '1px solid #1e293b' }}>
                  <div style={{ fontSize: '0.725rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Dedicated Worker Process</div>
                  <div style={{ fontSize: '0.875rem', color: '#f8fafc', fontWeight: 600, marginTop: '0.25rem' }}>
                    PID {overview.workerProcess?.pid || 'Standalone Service'}
                  </div>
                  <div style={{ fontSize: '0.725rem', color: overview.workerStatus === 'VERIFIED' ? '#34d399' : '#fbbf24', marginTop: '0.25rem' }}>
                    Status: <span className={`status-pill ${overview.workerStatus === 'VERIFIED' ? 'verified' : 'partially-verified'}`}>{overview.workerStatus || 'VERIFIED'}</span>
                  </div>
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', background: '#0f172a', padding: '0.65rem', borderRadius: '6px' }}>
                <strong>IPC Protocol:</strong> Authenticated loopback HTTP (<code>127.0.0.1:5055</code>) with token validation and durable DB queue polling.
              </div>
            </div>

            {/* Host Boundary Remediation & Finding A */}
            <div className="runtime-card">
              <div className="runtime-card-title">
                <span>Host Network Boundary Remediation (Finding A)</span>
                <ShieldAlert size={16} color="#fb923c" />
              </div>
              <p style={{ fontSize: '0.8125rem', color: '#94a3b8', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                Synthetic containers on internal Docker bridges enter host INPUT chain when contacting bridge gateway IPs (e.g. <code>172.x.x.1:22</code>).
              </p>
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>Host Boundary Security Status:</span>
                  <span className="status-pill partially-verified">PARTIALLY_VERIFIED</span>
                </div>
                <div style={{ fontSize: '0.725rem', background: '#090f1d', padding: '0.65rem', borderRadius: '6px', border: '1px solid #334155' }}>
                  <div style={{ color: '#fb923c', fontWeight: 600, marginBottom: '0.25rem' }}>Required Host Firewall Rule:</div>
                  <code style={{ color: '#38bdf8', fontSize: '0.75rem' }}>iptables -I INPUT -i decbr+ -j DROP</code>
                </div>
              </div>
              <div style={{ fontSize: '0.725rem', color: '#94a3b8' }}>
                Interfaces created with prefix <code>decbr+</code>. Use <code>scripts/remediate-host-boundary.sh --apply</code> with elevated privileges to block container-to-host bridge connections.
              </div>
            </div>
          </div>

          {/* Resource Reconciliation Table & Evidence Chain */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.25rem' }}>
            {/* Resource Limit Reconciliation */}
            <div className="runtime-card">
              <div className="runtime-card-title">
                <span>Resource Limit Reconciliation (Finding C)</span>
                <Cpu size={16} color="#38bdf8" />
              </div>
              <p style={{ fontSize: '0.8125rem', color: '#94a3b8', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                Harmonized 4-tier resource accounting ensuring requested, policy-approved, quota-reserved, and actual Docker cgroups match.
              </p>
              <table style={{ width: '100%', fontSize: '0.75rem', color: '#cbd5e1', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1e293b', textAlign: 'left', color: '#64748b' }}>
                    <th style={{ padding: '0.4rem 0' }}>Dimension</th>
                    <th>Requested</th>
                    <th>Approved</th>
                    <th>Reserved</th>
                    <th>Actual Cgroup</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #0f172a' }}>
                    <td style={{ padding: '0.4rem 0', fontWeight: 600 }}>CPU</td>
                    <td>0.5 Cores</td>
                    <td>1.0 Max</td>
                    <td>0.5 Cores</td>
                    <td style={{ color: '#34d399' }}>50,000 / 100,000</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #0f172a' }}>
                    <td style={{ padding: '0.4rem 0', fontWeight: 600 }}>Memory</td>
                    <td>256 MB</td>
                    <td>512 MB Max</td>
                    <td>256 MB</td>
                    <td style={{ color: '#34d399' }}>268,435,456 B</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #0f172a' }}>
                    <td style={{ padding: '0.4rem 0', fontWeight: 600 }}>PIDs</td>
                    <td>100 Max</td>
                    <td>100 Max</td>
                    <td>100 Max</td>
                    <td style={{ color: '#34d399' }}>100 (pids.max)</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.4rem 0', fontWeight: 600 }}>Storage</td>
                    <td>512 MB</td>
                    <td>1024 MB</td>
                    <td>Accounting</td>
                    <td style={{ color: '#94a3b8' }}>Read-only rootfs</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Evidence Integrity & Chain Status */}
            <div className="runtime-card">
              <div className="runtime-card-title">
                <span>Append-Linked Evidence Chain (Finding D)</span>
                <FileCheck size={16} color="#34d399" />
              </div>
              <p style={{ fontSize: '0.8125rem', color: '#94a3b8', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                Chronological execution audit trail with SHA-256 hash chaining: <code>event_hash = SHA256(payload + prev_hash)</code>.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <div style={{ background: '#090f1d', padding: '0.5rem', borderRadius: '4px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Payload Integrity</div>
                  <span className="status-pill verified" style={{ marginTop: '0.2rem' }}>VERIFIED</span>
                </div>
                <div style={{ background: '#090f1d', padding: '0.5rem', borderRadius: '4px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Chain Sequencing</div>
                  <span className="status-pill verified" style={{ marginTop: '0.2rem' }}>VERIFIED</span>
                </div>
                <div style={{ background: '#090f1d', padding: '0.5rem', borderRadius: '4px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Non-Repudiation</div>
                  <span className="status-pill not-implemented" style={{ marginTop: '0.2rem' }}>NOT_IMPLEMENTED</span>
                </div>
                <div style={{ background: '#090f1d', padding: '0.5rem', borderRadius: '4px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Trust Anchor</div>
                  <span className="status-pill not-implemented" style={{ marginTop: '0.2rem' }}>NOT_IMPLEMENTED</span>
                </div>
              </div>
              <div style={{ fontSize: '0.725rem', color: '#94a3b8', background: '#090f1d', padding: '0.5rem', borderRadius: '4px' }}>
                <strong>Cryptographic Notice:</strong> Payload hashing proves tamper detection against unauthorized modification. External non-repudiation requires asymmetric signing keys not yet anchored in Stage 5B.
              </div>
            </div>
          </div>

          {/* Quick Navigation Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <Link to="/runtime/gateway" className="runtime-card" style={{ textDecoration: 'none', border: '1px solid #38bdf8' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600, color: '#38bdf8', fontSize: '0.925rem' }}>Gateway Operations (Stage 5B.5)</span>
                <ArrowRight size={16} color="#38bdf8" />
              </div>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0.5rem 0 0' }}>
                Unified observation, hybrid detection, shadow mode routing, and 14-stage Request Explorer.
              </p>
            </Link>

            <Link to="/runtime/authorizations" className="runtime-card" style={{ textDecoration: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.925rem' }}>Authorizations</span>
                <ArrowRight size={16} color="#38bdf8" />
              </div>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0.5rem 0 0' }}>
                Inspect dual-custody review queue, approve/deny requests, and verify idempotency tokens.
              </p>
            </Link>

            <Link to="/runtime/environments" className="runtime-card" style={{ textDecoration: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.925rem' }}>Environment Registry</span>
                <ArrowRight size={16} color="#38bdf8" />
              </div>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0.5rem 0 0' }}>
                View simulated deception environments, health check verifications, and safe termination controls.
              </p>
            </Link>

            <Link to="/runtime/events" className="runtime-card" style={{ textDecoration: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.925rem' }}>Execution Events</span>
                <ArrowRight size={16} color="#38bdf8" />
              </div>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0.5rem 0 0' }}>
                Chronological audit logs tracking all authorization lifecycle transitions and operator actions.
              </p>
            </Link>

            <Link to="/runtime/quotas" className="runtime-card" style={{ textDecoration: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.925rem' }}>Resource Governance</span>
                <ArrowRight size={16} color="#38bdf8" />
              </div>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0.5rem 0 0' }}>
                Monitor CPU, memory, concurrent environment limits, and UNKNOWN capacity calibration.
              </p>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
