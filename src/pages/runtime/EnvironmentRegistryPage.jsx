import React, { useState, useEffect, useCallback } from 'react';
import {
  Layers,
  Activity,
  Heart,
  Server,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  RefreshCw,
  Power,
  Cpu,
  Database,
  Lock,
  Radio
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import EmptyState from '../../components/common/EmptyState';
import { useAuth } from '../../hooks/useAuth';
import { apiClient } from '../../services/apiClient';
import './runtime.css';

export default function EnvironmentRegistryPage() {
  const { activeTenant, user } = useAuth();
  const tenantIdentifier = activeTenant?.id || activeTenant?.identifier || 'tenant-apex-9941';
  const isOwner = user?.isPlatformAdmin || activeTenant?.role === 'APPLICATION_OWNER';

  const [environments, setEnvironments] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals state
  const [selectedEnv, setSelectedEnv] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [terminateTarget, setTerminateTarget] = useState(null);
  const [terminateReason, setTerminateReason] = useState('');
  const [terminateLoading, setTerminateLoading] = useState(false);
  const [terminateError, setTerminateError] = useState(null);

  // Health check modal state
  const [healthResult, setHealthResult] = useState(null);
  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);
  const [healthLoading, setHealthLoading] = useState(false);

  const fetchEnvironments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.getRuntimeEnvironments(tenantIdentifier);
      if (res && res.success && res.data) {
        setEnvironments(res.data.environments || []);
        setTotalCount(res.data.total || 0);
      } else {
        throw new Error(res?.error?.message || 'Failed to load runtime environments.');
      }
    } catch (err) {
      setError(err.message || 'Error communicating with environment registry.');
    } finally {
      setLoading(false);
    }
  }, [tenantIdentifier]);

  useEffect(() => {
    fetchEnvironments();
  }, [fetchEnvironments]);

  const handleCheckHealth = async (env) => {
    setHealthLoading(true);
    setIsHealthModalOpen(true);
    setHealthResult(null);
    try {
      const res = await apiClient.checkRuntimeEnvironmentHealth(tenantIdentifier, env.id);
      if (res && res.success && res.data) {
        setHealthResult(res.data);
      } else {
        throw new Error(res?.error?.message || 'Health check failed.');
      }
    } catch (err) {
      setHealthResult({ error: err.message });
    } finally {
      setHealthLoading(false);
    }
  };

  const handleTerminate = async () => {
    if (!terminateTarget) return;
    setTerminateLoading(true);
    setTerminateError(null);
    try {
      await apiClient.terminateRuntimeEnvironment(tenantIdentifier, terminateTarget.id, {
        reason: terminateReason || 'Operator terminated environment.'
      });
      setTerminateTarget(null);
      fetchEnvironments();
    } catch (err) {
      setTerminateError(err.message || 'Failed to terminate environment.');
    } finally {
      setTerminateLoading(false);
    }
  };

  const renderStateBadge = (state) => {
    const s = String(state || '').toUpperCase();
    let cls = 'provisioning';
    if (s === 'AUTHORIZED' || s === 'ACTIVE') cls = 'authorized';
    else if (s === 'TERMINATED' || s === 'EXPIRED') cls = 'terminated';
    else if (s === 'FAILED' || s === 'REJECTED') cls = 'denied';
    else if (s === 'DEGRADED') cls = 'degraded';

    return <span className={`status-pill ${cls}`}>{s}</span>;
  };

  return (
    <div className="runtime-page">
      <PageHeader
        title="Environment Registry"
        subtitle="Simulated runtime isolation, container sandboxing specification, and environment lifecycle control"
        actions={
          <div className="runtime-header-actions">
            <button
              className="btn btn-secondary"
              onClick={fetchEnvironments}
              disabled={loading}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        }
      />

      {/* Safety Notice */}
      <div className="runtime-notice-banner">
        <Server size={18} style={{ flexShrink: 0, color: '#38bdf8' }} />
        <div>
          <strong>Simulated Sandbox Isolation:</strong> Environments in Stage 5B.1 run with <code>isSimulated: true</code>. No host containers or network sockets are provisioned. Execution evidence is strictly <code>MISSING</code> to prevent false operational assumptions.
        </div>
      </div>

      {loading && <LoadingState message="Loading environment registry..." />}

      {error && (
        <div className="runtime-notice-banner warning">
          <AlertTriangle size={18} style={{ flexShrink: 0, color: '#f59e0b' }} />
          <div>
            <strong>Error:</strong> {error}
          </div>
        </div>
      )}

      {!loading && environments.length === 0 && (
        <EmptyState
          icon={Layers}
          title="No registered environments"
          description="Approved authorizations create simulated runtime environment records. None exist currently."
        />
      )}

      {!loading && environments.length > 0 && (
        <div className="runtime-table-container">
          <table className="runtime-table">
            <thead>
              <tr>
                <th>Identifier</th>
                <th>Application</th>
                <th>DSG Version</th>
                <th>Lifecycle State</th>
                <th>Resources</th>
                <th>Mode</th>
                <th>Evidence Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {environments.map((env) => (
                <tr key={env.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: '#f8fafc' }}>{env.name || env.environmentIdentifier}</div>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.725rem', color: '#38bdf8' }}>
                      {env.environmentIdentifier}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{env.application?.name || 'Tenant Default'}</div>
                    <div style={{ fontSize: '0.725rem', color: '#64748b' }}>{env.application?.applicationIdentifier || '—'}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>v{env.dsgGraphVersion}</div>
                    <div style={{ fontSize: '0.725rem', color: '#64748b' }}>{env.strategyIdentifier || 'Default Facade'}</div>
                  </td>
                  <td>{renderStateBadge(env.lifecycleState)}</td>
                  <td>
                    <div style={{ fontSize: '0.775rem', color: '#cbd5e1' }}>
                      {env.allocatedCpu} CPU / {env.allocatedMemoryMb} MB
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{env.allocatedStorageMb} MB Disk</div>
                  </td>
                  <td>
                    <span className={`status-pill ${env.isSimulated ? 'provisioning' : 'authorized'}`} style={{ fontSize: '0.7rem' }}>
                      {env.isSimulated ? 'SIMULATED' : 'LIVE DOCKER'}
                    </span>
                    {env.containerId && (
                      <div style={{ fontSize: '0.675rem', fontFamily: 'monospace', color: '#38bdf8', marginTop: '0.2rem' }}>
                        {env.containerId.substring(0, 12)}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={env.executionEvidenceStatus === 'VERIFIED' ? 'status-pill authorized' : 'evidence-pill-missing'} style={{ fontSize: '0.7rem' }}>
                      {env.executionEvidenceStatus}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                        onClick={() => {
                          setSelectedEnv(env);
                          setIsDetailModalOpen(true);
                        }}
                        title="View Environment Specification"
                      >
                        <Eye size={13} />
                      </button>

                      <button
                        className="btn btn-secondary"
                        style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', color: '#34d399' }}
                        onClick={() => handleCheckHealth(env)}
                        title="Run Runtime Health Check"
                      >
                        <Heart size={13} />
                      </button>

                      {isOwner && env.lifecycleState !== 'TERMINATED' && (
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', color: '#f87171' }}
                          onClick={() => {
                            setTerminateTarget(env);
                            setTerminateReason('');
                            setTerminateError(null);
                          }}
                          title="Terminate Environment"
                        >
                          <Power size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {isDetailModalOpen && selectedEnv && (
        <div className="runtime-modal-backdrop" onClick={() => setIsDetailModalOpen(false)}>
          <div className="runtime-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="runtime-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Layers size={18} color="#38bdf8" />
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#f8fafc' }}>Environment Specification</h3>
              </div>
              <button className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem' }} onClick={() => setIsDetailModalOpen(false)}>
                &times;
              </button>
            </div>
            <div className="runtime-modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.725rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Identifier</label>
                  <div style={{ fontFamily: 'monospace', color: '#38bdf8' }}>{selectedEnv.environmentIdentifier}</div>
                </div>
                <div>
                  <label style={{ fontSize: '0.725rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Lifecycle State</label>
                  <div>{renderStateBadge(selectedEnv.lifecycleState)}</div>
                </div>
              </div>

              {selectedEnv.containerId ? (
                <div>
                  <label style={{ fontSize: '0.725rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Live Container &amp; Network Quarantine</label>
                  <div style={{ fontSize: '0.8125rem', color: '#cbd5e1', background: '#090f1d', padding: '0.75rem', borderRadius: '6px', lineHeight: 1.6, fontFamily: 'monospace' }}>
                    <div><span style={{ color: '#38bdf8' }}>Container ID:</span> {selectedEnv.containerId}</div>
                    <div><span style={{ color: '#38bdf8' }}>Container Name:</span> {selectedEnv.containerName || 'N/A'}</div>
                    <div><span style={{ color: '#38bdf8' }}>Network:</span> {selectedEnv.networkName || selectedEnv.networkId} (Internal: true, Zero Egress)</div>
                    <div><span style={{ color: '#38bdf8' }}>Image Digest:</span> {selectedEnv.imageDigest || 'N/A'}</div>
                    <div><span style={{ color: '#38bdf8' }}>Template:</span> {selectedEnv.templateIdentifier}</div>
                    <div><span style={{ color: '#38bdf8' }}>Health Status:</span> {selectedEnv.healthStatus || 'HEALTHY'}</div>
                  </div>
                </div>
              ) : (
                <div>
                  <label style={{ fontSize: '0.725rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Security Hardening Boundaries</label>
                  <div style={{ fontSize: '0.8125rem', color: '#cbd5e1', background: '#090f1d', padding: '0.75rem', borderRadius: '6px', lineHeight: 1.5 }}>
                    <div>• UID: 1000 (Non-root deception daemon)</div>
                    <div>• Rootfs: Read-Only (tmpfs mounts for /tmp only)</div>
                    <div>• Capabilities: ALL dropped (cap_drop: ALL)</div>
                    <div>• Network Isolation: {selectedEnv.networkIsolationMode || 'SANDBOX_ISOLATED'}</div>
                  </div>
                </div>
              )}

              <div>
                <label style={{ fontSize: '0.725rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Synthetic State Snapshot</label>
                <pre style={{ margin: 0, padding: '0.75rem', background: '#090f1d', borderRadius: '6px', fontSize: '0.75rem', color: '#38bdf8', overflowX: 'auto', maxHeight: '180px' }}>
                  {JSON.stringify(selectedEnv.syntheticStateSnapshot || { simulatedRoutes: ['/api/v1/auth/login', '/api/v1/users'], tokens: 'synthetic-jwt' }, null, 2)}
                </pre>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.725rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Created At</label>
                  <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>{new Date(selectedEnv.createdAt).toLocaleString()}</div>
                </div>
                <div>
                  <label style={{ fontSize: '0.725rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Terminated At</label>
                  <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>{selectedEnv.terminatedAt ? new Date(selectedEnv.terminatedAt).toLocaleString() : 'Active'}</div>
                </div>
              </div>
            </div>
            <div className="runtime-modal-footer">
              <button className="btn btn-secondary" onClick={() => setIsDetailModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Health Check Modal */}
      {isHealthModalOpen && (
        <div className="runtime-modal-backdrop" onClick={() => setIsHealthModalOpen(false)}>
          <div className="runtime-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="runtime-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Heart size={18} color="#34d399" />
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#f8fafc' }}>Runtime Health Verification</h3>
              </div>
              <button className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem' }} onClick={() => setIsHealthModalOpen(false)}>
                &times;
              </button>
            </div>
            <div className="runtime-modal-body">
              {healthLoading && <LoadingState message="Probing simulated environment..." />}
              {!healthLoading && healthResult && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: '#090f1d', borderRadius: '6px' }}>
                    <CheckCircle2 size={24} color="#34d399" />
                    <div>
                      <div style={{ fontWeight: 600, color: '#f8fafc' }}>{healthResult.healthStatus || 'HEALTHY'}</div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        {healthResult.containerProvisioned ? (
                          <>Live Container: <strong>Verified Responsive ({healthResult.details?.latencyMs || 0} ms)</strong></>
                        ) : (
                          <>Container Provisioned: <strong>false</strong> (Simulation Baseline)</>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.725rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Execution Evidence Status</label>
                    <div>
                      <span className={healthResult.runtimeEvidence === 'VERIFIED' ? 'status-pill authorized' : 'evidence-pill-missing'}>
                        {healthResult.runtimeEvidence || 'MISSING'}
                      </span>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    Verified Timestamp: {new Date(healthResult.timestamp || Date.now()).toLocaleTimeString()}
                  </div>
                </>
              )}
            </div>
            <div className="runtime-modal-footer">
              <button className="btn btn-secondary" onClick={() => setIsHealthModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terminate Modal */}
      {terminateTarget && (
        <div className="runtime-modal-backdrop" onClick={() => setTerminateTarget(null)}>
          <div className="runtime-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="runtime-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Power size={18} color="#f87171" />
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#f8fafc' }}>Terminate Environment</h3>
              </div>
              <button className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem' }} onClick={() => setTerminateTarget(null)}>
                &times;
              </button>
            </div>
            <div className="runtime-modal-body">
              <p style={{ fontSize: '0.8125rem', color: '#cbd5e1', margin: 0 }}>
                Are you sure you want to terminate simulated environment <strong>{terminateTarget.environmentIdentifier}</strong>?
                This will release allocated quota capacity and permanently transition the environment to <code>TERMINATED</code> state.
              </p>

              {terminateError && (
                <div className="runtime-notice-banner warning">
                  <AlertTriangle size={16} />
                  <div>{terminateError}</div>
                </div>
              )}

              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                  Termination Reason:
                </label>
                <input
                  type="text"
                  className="input"
                  style={{ width: '100%', fontSize: '0.8125rem', background: '#090f1d' }}
                  placeholder="e.g. Session disengaged, maintenance cycle"
                  value={terminateReason}
                  onChange={(e) => setTerminateReason(e.target.value)}
                />
              </div>
            </div>
            <div className="runtime-modal-footer">
              <button className="btn btn-secondary" onClick={() => setTerminateTarget(null)} disabled={terminateLoading}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleTerminate}
                disabled={terminateLoading}
                style={{ background: '#dc2626', borderColor: '#ef4444' }}
              >
                {terminateLoading ? 'Terminating...' : 'Confirm Termination'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
