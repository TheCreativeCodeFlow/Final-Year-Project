import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Activity,
  Layers,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  Sliders,
  Radio,
  Clock,
  Search,
  ExternalLink,
  ChevronRight,
  Lock,
  Server,
  FileText
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import { useAuth } from '../../hooks/useAuth';
import { apiClient } from '../../services/apiClient';
import './runtime.css';

export default function GatewayOperationsPage() {
  const { activeTenant } = useAuth();
  const tenantIdentifier = activeTenant?.id || activeTenant?.identifier || 'tenant-apex-9941';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [overview, setOverview] = useState(null);
  const [requests, setRequests] = useState([]);
  const [selectedCorrelationId, setSelectedCorrelationId] = useState(null);
  const [explorerDetail, setExplorerDetail] = useState(null);
  const [explorerLoading, setExplorerLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('ALL');
  const [modeSubmitting, setModeSubmitting] = useState(false);
  const [modeFeedback, setModeFeedback] = useState(null);

  const fetchOverviewData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewRes, requestsRes] = await Promise.allSettled([
        apiClient.getGatewayOverview(tenantIdentifier),
        apiClient.getGatewayRequests(tenantIdentifier, { limit: 50 })
      ]);

      if (overviewRes.status === 'fulfilled' && overviewRes.value?.success) {
        setOverview(overviewRes.value.data);
      } else {
        const msg = overviewRes.status === 'rejected' ? overviewRes.reason?.message : overviewRes.value?.error?.message;
        throw new Error(msg || 'Failed to fetch gateway overview.');
      }

      if (requestsRes.status === 'fulfilled' && requestsRes.value?.success) {
        setRequests(requestsRes.value.data || []);
      }
    } catch (err) {
      setError(err.message || 'Error communicating with gateway operations API.');
    } finally {
      setLoading(false);
    }
  }, [tenantIdentifier]);

  useEffect(() => {
    fetchOverviewData();
  }, [fetchOverviewData]);

  const handleSelectRequest = async (correlationId) => {
    setSelectedCorrelationId(correlationId);
    setExplorerLoading(true);
    try {
      const res = await apiClient.getRequestExplorerDetail(tenantIdentifier, correlationId);
      if (res && res.success && res.data) {
        setExplorerDetail(res.data);
      }
    } catch (err) {
      console.error('Failed to load explorer detail:', err);
    } finally {
      setExplorerLoading(false);
    }
  };

  const handleUpdateRoutingMode = async (newMode) => {
    if (newMode === 'CONTROLLED_LAB') {
      const confirmMsg =
        'WARNING: You are attempting to activate CONTROLLED_LAB routing. ' +
        'This mode requires all mandatory safety conditions including host-boundary firewall verification. ' +
        'If any condition is unverified, activation will be strictly blocked. Proceed?';
      if (!window.confirm(confirmMsg)) return;
    }

    setModeSubmitting(true);
    setModeFeedback(null);
    try {
      const res = await apiClient.updateGatewayRoutingMode(tenantIdentifier, { routingMode: newMode });
      if (res && res.success) {
        setModeFeedback({ type: 'success', message: `Routing mode updated to ${newMode} successfully.` });
        await fetchOverviewData();
      } else {
        const errMsg = res?.error?.message || 'Failed to update routing mode.';
        const blockers = res?.error?.blockers ? ` Blockers: ${res.error.blockers.join(', ')}` : '';
        setModeFeedback({ type: 'error', message: `${errMsg}${blockers}` });
      }
    } catch (err) {
      const errMsg = err.response?.data?.error?.message || err.message || 'Failed to update routing mode.';
      const blockers = err.response?.data?.error?.blockers
        ? ` Blockers: ${err.response.data.error.blockers.join(', ')}`
        : '';
      setModeFeedback({ type: 'error', message: `${errMsg}${blockers}` });
    } finally {
      setModeSubmitting(false);
    }
  };

  const filteredRequests = requests.filter((req) => {
    if (outcomeFilter !== 'ALL' && req.outcomeStatus !== outcomeFilter) return false;
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      return (
        req.correlationId?.toLowerCase().includes(q) ||
        req.intendedAction?.toLowerCase().includes(q) ||
        req.outcomeStatus?.toLowerCase().includes(q) ||
        req.threatCategory?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getSafetyBadge = (indicator) => {
    switch (indicator) {
      case 'CONTROLLED_LAB_READY':
        return <span className="runtime-badge success"><CheckCircle2 size={12} /> CONTROLLED_LAB_READY</span>;
      case 'CONTROLLED_LAB_BLOCKED':
        return <span className="runtime-badge terminated"><XCircle size={12} /> CONTROLLED_LAB_BLOCKED</span>;
      case 'SHADOW_ACTIVE':
        return <span className="runtime-badge upgrading"><Eye size={12} /> SHADOW_ACTIVE</span>;
      case 'OBSERVE_ONLY':
        return <span className="runtime-badge info"><Radio size={12} /> OBSERVE_ONLY</span>;
      default:
        return <span className="runtime-badge degraded"><AlertTriangle size={12} /> ROUTING_DISABLED</span>;
    }
  };

  const getOutcomeBadge = (outcome) => {
    switch (outcome) {
      case 'SHADOW_DECEPTION':
        return <span className="runtime-badge upgrading">SHADOW_DECEPTION</span>;
      case 'NORMAL_FORWARD':
      case 'DEFER_TO_ORIGIN':
        return <span className="runtime-badge healthy">NORMAL_FORWARD</span>;
      case 'DECEPTION_ROUTE_EXECUTED':
        return <span className="runtime-badge success">DECEPTION_EXECUTED</span>;
      case 'BLOCK_REQUEST':
        return <span className="runtime-badge terminated">BLOCKED</span>;
      case 'RUNTIME_UNAVAILABLE':
        return <span className="runtime-badge degraded">RUNTIME_UNAVAILABLE</span>;
      case 'DEFER_WITH_UNCERTAINTY':
        return <span className="runtime-badge warning">UNCERTAINTY_DEFERRED</span>;
      default:
        return <span className="runtime-badge info">{outcome}</span>;
    }
  };

  return (
    <div className="runtime-page-container">
      <PageHeader
        title="Gateway Operations & Controlled Routing"
        description="Unified observation, hybrid detection, adaptive policy, and shadow-mode deception routing interface (Stage 5B.5)."
      >
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            className="runtime-btn runtime-btn-secondary"
            onClick={fetchOverviewData}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </PageHeader>

      {modeFeedback && (
        <div className={`runtime-feedback ${modeFeedback.type}`} style={{ marginBottom: '1rem' }}>
          {modeFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{modeFeedback.message}</span>
        </div>
      )}

      {error && (
        <div className="runtime-error-banner" style={{ marginBottom: '1rem' }}>
          <AlertTriangle size={20} style={{ flexShrink: 0, color: '#f59e0b' }} />
          <div>
            <strong>Error loading gateway operations status:</strong> {error}
          </div>
        </div>
      )}

      {loading && !overview && <LoadingState message="Connecting to Gateway Decision Controller..." />}

      {!loading && overview && (
        <>
          {/* Top Control Bar: Active Routing Mode & Safety Indicator */}
          <div className="runtime-card" style={{ marginBottom: '1.25rem', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Gateway Safety Status
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.35rem' }}>
                  <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc' }}>
                    Active Mode: {overview.activeRoutingMode}
                  </span>
                  {getSafetyBadge(overview.safetyIndicator)}
                </div>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                  {overview.activeRoutingMode === 'SHADOW' && 'Shadow evaluation active: Full detection & policy runs, hypothetical decisions recorded, all traffic safely forwards to origin.'}
                  {overview.activeRoutingMode === 'OBSERVE_ONLY' && 'Observation-only mode: Traffic normalized and observed without hypothetical diversion tracking.'}
                  {overview.activeRoutingMode === 'CONTROLLED_LAB' && 'Controlled lab routing active: Only verified attacker sessions diverted to isolated sandbox.'}
                </p>
              </div>

              {/* Routing Mode Selector Controls */}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8', marginRight: '0.25rem' }}>Switch Mode:</span>
                <button
                  className={`runtime-btn ${overview.activeRoutingMode === 'OBSERVE_ONLY' ? 'runtime-btn-primary' : 'runtime-btn-secondary'}`}
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                  onClick={() => handleUpdateRoutingMode('OBSERVE_ONLY')}
                  disabled={modeSubmitting || overview.activeRoutingMode === 'OBSERVE_ONLY'}
                >
                  Observe Only
                </button>
                <button
                  className={`runtime-btn ${overview.activeRoutingMode === 'SHADOW' ? 'runtime-btn-primary' : 'runtime-btn-secondary'}`}
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                  onClick={() => handleUpdateRoutingMode('SHADOW')}
                  disabled={modeSubmitting || overview.activeRoutingMode === 'SHADOW'}
                >
                  Shadow (Default)
                </button>
                <button
                  className={`runtime-btn ${overview.activeRoutingMode === 'CONTROLLED_LAB' ? 'runtime-btn-primary' : 'runtime-btn-secondary'}`}
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', borderColor: overview.controlledLabReadiness?.isReady ? '#10b981' : '#ef4444' }}
                  onClick={() => handleUpdateRoutingMode('CONTROLLED_LAB')}
                  disabled={modeSubmitting || overview.activeRoutingMode === 'CONTROLLED_LAB'}
                  title={!overview.controlledLabReadiness?.isReady ? 'Controlled Lab is currently blocked by safety checks' : 'Activate Controlled Lab'}
                >
                  Controlled Lab
                </button>
              </div>
            </div>

            {/* Controlled Lab Mandatory Safety Checklist Banner */}
            {overview.controlledLabReadiness?.blockers?.length > 0 && (
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#451a03', border: '1px solid #78350f', borderRadius: '6px', fontSize: '0.8rem', color: '#fef3c7' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  <AlertTriangle size={16} color="#f59e0b" />
                  <span>Controlled Lab Activation Blockers ({overview.controlledLabReadiness.blockers.length}):</span>
                </div>
                <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.5 }}>
                  {overview.controlledLabReadiness.blockers.map((b, idx) => (
                    <li key={idx} style={{ color: '#fed7aa' }}>{b}</li>
                  ))}
                </ul>
                <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginTop: '0.35rem' }}>
                  * Host INPUT firewall drop rule (Finding A from Stage 5B.2.2) is a mandatory hard blocker preventing live traffic diversion until host netfilter isolation is applied.
                </div>
              </div>
            )}
          </div>

          {/* Metric Tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div className="runtime-card" style={{ padding: '0.75rem 1rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Total Ingress Observed</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.25rem' }}>
                {overview.statistics?.totalRequestsObserved ?? 0}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Normalized requests</div>
            </div>

            <div className="runtime-card" style={{ padding: '0.75rem 1rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Shadow Decisions</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#a855f7', marginTop: '0.25rem' }}>
                {overview.statistics?.shadowDecisionsCount ?? 0}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#a855f7' }}>Hypothetical diversions</div>
            </div>

            <div className="runtime-card" style={{ padding: '0.75rem 1rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Normal Origin Forward</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#38bdf8', marginTop: '0.25rem' }}>
                {overview.statistics?.normalForwardCount ?? 0}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Real protected upstream</div>
            </div>

            <div className="runtime-card" style={{ padding: '0.75rem 1rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Blocked by Policy</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ef4444', marginTop: '0.25rem' }}>
                {overview.statistics?.blockedRequestsCount ?? 0}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#ef4444' }}>HTTP 403 at ingress</div>
            </div>

            <div className="runtime-card" style={{ padding: '0.75rem 1rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Runtime Unavailable</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f59e0b', marginTop: '0.25rem' }}>
                {overview.statistics?.runtimeUnavailableCount ?? 0}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Safe origin deferrals</div>
            </div>
          </div>

          {/* Request-Decision Explorer Section */}
          <div className="runtime-card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Search size={18} color="#38bdf8" />
                  <span>Request-Decision Explorer (14-Stage Pipeline)</span>
                </h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                  Inspect full end-to-end telemetry, hybrid assessment, policy evaluation, and routing outcomes. Click any request to trace the pipeline.
                </p>
              </div>

              {/* Filters */}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Filter correlation ID..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  style={{
                    padding: '0.35rem 0.6rem',
                    fontSize: '0.8rem',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '4px',
                    color: '#f8fafc',
                    width: '200px'
                  }}
                />
                <select
                  value={outcomeFilter}
                  onChange={(e) => setOutcomeFilter(e.target.value)}
                  style={{
                    padding: '0.35rem 0.6rem',
                    fontSize: '0.8rem',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '4px',
                    color: '#f8fafc'
                  }}
                >
                  <option value="ALL">All Outcomes</option>
                  <option value="SHADOW_DECEPTION">SHADOW_DECEPTION</option>
                  <option value="NORMAL_FORWARD">NORMAL_FORWARD</option>
                  <option value="BLOCK_REQUEST">BLOCK_REQUEST</option>
                  <option value="RUNTIME_UNAVAILABLE">RUNTIME_UNAVAILABLE</option>
                  <option value="DECEPTION_ROUTE_EXECUTED">DECEPTION_ROUTE_EXECUTED</option>
                </select>
              </div>
            </div>

            {/* Requests Table */}
            <div style={{ overflowX: 'auto' }}>
              <table className="runtime-table" style={{ width: '100%', fontSize: '0.8rem' }}>
                <thead>
                  <tr>
                    <th>Correlation ID</th>
                    <th>Timestamp</th>
                    <th>Classification</th>
                    <th>Threat Category</th>
                    <th>Routing Mode</th>
                    <th>Outcome</th>
                    <th>Destination</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', color: '#64748b', padding: '1.5rem' }}>
                        No gateway routing requests match current filters. Send ingress traffic to the gateway to observe decisions.
                      </td>
                    </tr>
                  ) : (
                    filteredRequests.map((req) => (
                      <tr
                        key={req.id}
                        style={{
                          cursor: 'pointer',
                          background: selectedCorrelationId === req.correlationId ? '#1e293b' : 'transparent'
                        }}
                        onClick={() => handleSelectRequest(req.correlationId)}
                      >
                        <td style={{ fontFamily: 'monospace', color: '#38bdf8' }}>
                          {req.correlationId?.slice(0, 16)}...
                        </td>
                        <td style={{ color: '#94a3b8' }}>
                          {new Date(req.decidedAt).toLocaleTimeString()}
                        </td>
                        <td>
                          <span className={`runtime-badge ${req.classification === 'ATTACK' ? 'terminated' : 'healthy'}`}>
                            {req.classification}
                          </span>
                        </td>
                        <td style={{ color: req.threatCategory ? '#f87171' : '#64748b' }}>
                          {req.threatCategory || 'NONE'}
                        </td>
                        <td>
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{req.routingMode}</span>
                        </td>
                        <td>{getOutcomeBadge(req.outcomeStatus)}</td>
                        <td style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#94a3b8' }}>
                          {req.outcomeStatus === 'SHADOW_DECEPTION' ? (
                            <span title={`Hypothetical: ${req.hypotheticalDestination}`}>
                              Origin (Shadow: {req.hypotheticalEnvironmentId?.slice(0, 8)}...)
                            </span>
                          ) : (
                            req.targetDestination || 'Default Origin'
                          )}
                        </td>
                        <td>
                          <button
                            className="runtime-btn runtime-btn-secondary"
                            style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectRequest(req.correlationId);
                            }}
                          >
                            Trace <ChevronRight size={12} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Selected Request Pipeline Trace Drawer / Modal Details */}
          {selectedCorrelationId && (
            <div className="runtime-card" style={{ marginBottom: '1.5rem', padding: '1.25rem', border: '1px solid #38bdf8' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                    Trace Pipeline for Request: <span style={{ fontFamily: 'monospace', color: '#38bdf8' }}>{selectedCorrelationId}</span>
                  </h4>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    14-Stage Unified Gateway Decision Pipeline Execution Trace
                  </div>
                </div>
                <button
                  className="runtime-btn runtime-btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                  onClick={() => setSelectedCorrelationId(null)}
                >
                  Close Trace
                </button>
              </div>

              {explorerLoading ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8' }}>Loading pipeline stages...</div>
              ) : explorerDetail ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem', fontSize: '0.8rem' }}>
                  {/* Stage 1: Observation */}
                  <div style={{ background: '#0f172a', padding: '0.75rem', borderRadius: '6px', border: '1px solid #1e293b' }}>
                    <div style={{ fontWeight: 600, color: '#38bdf8', marginBottom: '0.25rem' }}>1. Gateway Observation</div>
                    <div>Method: <strong>{explorerDetail.pipeline?.stage1_observation?.method}</strong></div>
                    <div>Path: <span style={{ fontFamily: 'monospace' }}>{explorerDetail.pipeline?.stage1_observation?.path}</span></div>
                    <div>Client IP: {explorerDetail.pipeline?.stage1_observation?.clientIp}</div>
                    <div>Host: {explorerDetail.pipeline?.stage1_observation?.domain}</div>
                  </div>

                  {/* Stage 2 & 3: Detection & Assessment */}
                  <div style={{ background: '#0f172a', padding: '0.75rem', borderRadius: '6px', border: '1px solid #1e293b' }}>
                    <div style={{ fontWeight: 600, color: '#38bdf8', marginBottom: '0.25rem' }}>2. Hybrid Detection</div>
                    <div>Classification: <strong>{explorerDetail.pipeline?.stage4_detection?.classification}</strong></div>
                    <div>Confidence: {(Number(explorerDetail.pipeline?.stage4_detection?.confidenceScore || 0) * 100).toFixed(0)}%</div>
                    <div>Threat Category: <strong>{explorerDetail.pipeline?.stage4_detection?.threatCategory || 'NONE'}</strong></div>
                    <div>Deception Eligible: {explorerDetail.pipeline?.stage4_detection?.deceptionEligible ? 'YES' : 'NO'}</div>
                  </div>

                  {/* Stage 4: Policy & Strategy */}
                  <div style={{ background: '#0f172a', padding: '0.75rem', borderRadius: '6px', border: '1px solid #1e293b' }}>
                    <div style={{ fontWeight: 600, color: '#38bdf8', marginBottom: '0.25rem' }}>3. Policy & Strategy</div>
                    <div>Disposition: <strong>{explorerDetail.pipeline?.stage5_policy?.deceptionDisposition}</strong></div>
                    <div>Origin Access: {explorerDetail.pipeline?.stage5_policy?.originAccessDecision}</div>
                    <div>Selected Strategy: {explorerDetail.pipeline?.stage6_strategy?.strategyName || explorerDetail.pipeline?.stage6_strategy?.selectedStrategyId || 'NONE'}</div>
                    <div>DSG Graph Version: v{explorerDetail.pipeline?.stage7_dsg?.baseGraphVersion || 1}</div>
                  </div>

                  {/* Stage 5: Runtime & Decision Outcome */}
                  <div style={{ background: '#0f172a', padding: '0.75rem', borderRadius: '6px', border: '1px solid #1e293b' }}>
                    <div style={{ fontWeight: 600, color: '#38bdf8', marginBottom: '0.25rem' }}>4. Routing Outcome</div>
                    <div>Mode: <strong>{explorerDetail.routingMode}</strong></div>
                    <div>Outcome: {getOutcomeBadge(explorerDetail.outcomeStatus)}</div>
                    <div>Target: <span style={{ fontFamily: 'monospace' }}>{explorerDetail.targetDestination}</span></div>
                    {explorerDetail.hypotheticalDestination && (
                      <div style={{ color: '#a855f7' }}>Hypothetical: <span style={{ fontFamily: 'monospace' }}>{explorerDetail.hypotheticalDestination}</span></div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Quick Nav Links */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
            <Link to="/runtime/overview" className="runtime-card" style={{ textDecoration: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f8fafc', fontWeight: 600, fontSize: '0.85rem' }}>
                <Activity size={16} color="#38bdf8" />
                <span>Runtime Overview</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                DSG execution engine and environment health
              </div>
            </Link>

            <Link to="/runtime/environments" className="runtime-card" style={{ textDecoration: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f8fafc', fontWeight: 600, fontSize: '0.85rem' }}>
                <Server size={16} color="#a855f7" />
                <span>Environment Registry</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                Synthetic container instances and Docker metrics
              </div>
            </Link>

            <Link to="/runtime/authorizations" className="runtime-card" style={{ textDecoration: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f8fafc', fontWeight: 600, fontSize: '0.85rem' }}>
                <ShieldCheck size={16} color="#10b981" />
                <span>Execution Authorizations</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                Dual-custody approvals and security tokens
              </div>
            </Link>

            <Link to="/runtime/events" className="runtime-card" style={{ textDecoration: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f8fafc', fontWeight: 600, fontSize: '0.85rem' }}>
                <Layers size={16} color="#f59e0b" />
                <span>Execution Evidence</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                Append-linked SHA-256 cryptographic audit logs
              </div>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
