import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Eye,
  Plus,
  RefreshCw,
  Search,
  Filter,
  Lock,
  Layers,
  Key,
  Server
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import EmptyState from '../../components/common/EmptyState';
import { useAuth } from '../../hooks/useAuth';
import { apiClient } from '../../services/apiClient';
import './runtime.css';

export default function ExecutionAuthorizationsPage() {
  const { activeTenant, user } = useAuth();
  const tenantIdentifier = activeTenant?.id || activeTenant?.identifier || 'tenant-apex-9941';
  const isOwner = user?.isPlatformAdmin || activeTenant?.role === 'APPLICATION_OWNER';

  const [authorizations, setAuthorizations] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals state
  const [selectedAuth, setSelectedAuth] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [actionType, setActionType] = useState(null); // 'approve' | 'deny' | 'revoke'
  const [actionAuth, setActionAuth] = useState(null);
  const [actionReason, setActionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState(null);

  // Stage 5B.2 Container Provisioning Modal state
  const [isProvisionModalOpen, setIsProvisionModalOpen] = useState(false);
  const [provisionAuth, setProvisionAuth] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState('tpl-synthetic-api-01');
  const [selectedImage, setSelectedImage] = useState('img-syn-alpine-node-01');
  const [provisionLoading, setProvisionLoading] = useState(false);
  const [provisionError, setProvisionError] = useState(null);
  const [provisionSuccess, setProvisionSuccess] = useState(null);

  const fetchAuthorizations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (statusFilter !== 'ALL') {
        params.status = statusFilter;
      }
      const res = await apiClient.getRuntimeAuthorizations(tenantIdentifier, params);
      if (res && res.success && res.data) {
        setAuthorizations(res.data.authorizations || []);
        setTotalCount(res.data.total || 0);
      } else {
        throw new Error(res?.error?.message || 'Failed to load authorizations.');
      }
    } catch (err) {
      setError(err.message || 'Error communicating with runtime authorization service.');
    } finally {
      setLoading(false);
    }
  }, [tenantIdentifier, statusFilter]);

  useEffect(() => {
    fetchAuthorizations();
  }, [fetchAuthorizations]);

  const handleOpenAction = (auth, type) => {
    setActionAuth(auth);
    setActionType(type);
    setActionReason('');
    setActionError(null);
  };

  const handleExecuteAction = async () => {
    if (!actionAuth || !actionType) return;
    setActionLoading(true);
    setActionError(null);

    try {
      if (actionType === 'approve') {
        await apiClient.approveRuntimeAuthorization(tenantIdentifier, actionAuth.id, {
          approvalReason: actionReason || 'Approved via Deception Operations console.'
        });
      } else if (actionType === 'deny') {
        await apiClient.denyRuntimeAuthorization(tenantIdentifier, actionAuth.id, {
          denialReason: actionReason || 'Denied via Deception Operations console.'
        });
      } else if (actionType === 'revoke') {
        await apiClient.revokeRuntimeAuthorization(tenantIdentifier, actionAuth.id, {
          revocationReason: actionReason || 'Revoked via Deception Operations console.'
        });
      }
      setActionAuth(null);
      setActionType(null);
      fetchAuthorizations();
    } catch (err) {
      setActionError(err.message || `Failed to ${actionType} authorization.`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenProvision = (auth) => {
    setProvisionAuth(auth);
    setSelectedTemplate('tpl-synthetic-api-01');
    setSelectedImage('img-syn-alpine-node-01');
    setProvisionError(null);
    setProvisionSuccess(null);
    setIsProvisionModalOpen(true);
  };

  const handleExecuteProvision = async () => {
    if (!provisionAuth) return;
    setProvisionLoading(true);
    setProvisionError(null);
    setProvisionSuccess(null);
    try {
      const res = await apiClient.submitProvisioningJob(tenantIdentifier, {
        authorizationId: provisionAuth.id,
        templateIdentifier: selectedTemplate,
        imageIdentifier: selectedImage,
        idempotencyKey: `prov-${provisionAuth.id}-${Date.now()}`
      });
      if (res && res.success && res.data) {
        setProvisionSuccess(res.data);
        fetchAuthorizations();
      } else {
        throw new Error(res?.error?.message || 'Provisioning failed.');
      }
    } catch (err) {
      setProvisionError(err.message || 'Failed to submit provisioning job.');
    } finally {
      setProvisionLoading(false);
    }
  };

  const renderStatusBadge = (status) => {
    const s = String(status || '').toUpperCase();
    let badgeClass = 'pending';
    if (s === 'APPROVED') badgeClass = 'approved';
    else if (s === 'DENIED') badgeClass = 'denied';
    else if (s === 'REVOKED') badgeClass = 'revoked';
    else if (s === 'EXPIRED') badgeClass = 'expired';

    return <span className={`status-pill ${badgeClass}`}>{s}</span>;
  };

  return (
    <div className="runtime-page">
      <PageHeader
        title="Execution Authorizations"
        subtitle="Dual-custody verification, optimistic version concurrency, and lifecycle authorization gating"
        actions={
          <div className="runtime-header-actions">
            <button
              className="btn btn-secondary"
              onClick={fetchAuthorizations}
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
        <Lock size={18} style={{ flexShrink: 0, color: '#38bdf8' }} />
        <div>
          <strong>Separation of Duties Enforced:</strong> Analysts may request authorizations, but only Application Owners or Platform Administrators are cryptographically authorized to approve execution requests. Operators cannot approve their own requests.
        </div>
      </div>

      {/* Filter Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Filter size={15} color="#94a3b8" />
          <span style={{ fontSize: '0.8125rem', color: '#94a3b8', fontWeight: 600 }}>Status:</span>
          {['ALL', 'PENDING', 'APPROVED', 'DENIED', 'REVOKED', 'EXPIRED'].map((s) => (
            <button
              key={s}
              className={`btn ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem' }}
              onClick={() => setStatusFilter(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>
          Showing <strong>{authorizations.length}</strong> of <strong>{totalCount}</strong> records
        </div>
      </div>

      {loading && <LoadingState message="Loading authorizations..." />}

      {error && (
        <div className="runtime-notice-banner warning">
          <AlertTriangle size={18} style={{ flexShrink: 0, color: '#f59e0b' }} />
          <div>
            <strong>Error:</strong> {error}
          </div>
        </div>
      )}

      {!loading && authorizations.length === 0 && (
        <EmptyState
          icon={ShieldCheck}
          title="No execution authorizations found"
          description={
            statusFilter === 'ALL'
              ? 'No execution authorizations have been requested yet for this tenant.'
              : `No authorizations match status "${statusFilter}".`
          }
        />
      )}

      {!loading && authorizations.length > 0 && (
        <div className="runtime-table-container">
          <table className="runtime-table">
            <thead>
              <tr>
                <th>Authorization ID</th>
                <th>Application</th>
                <th>DSG Graph</th>
                <th>Strategy</th>
                <th>Status</th>
                <th>Requester</th>
                <th>Expires</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {authorizations.map((auth) => (
                <tr key={auth.id}>
                  <td>
                    <div style={{ fontFamily: 'monospace', fontWeight: 600, color: '#38bdf8' }}>
                      {auth.id.slice(0, 13)}...
                    </div>
                    {auth.idempotencyKey && (
                      <div style={{ fontSize: '0.7rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.15rem' }}>
                        <Key size={10} /> {auth.idempotencyKey.slice(0, 12)}...
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{auth.application?.name || 'Tenant Default'}</div>
                    <div style={{ fontSize: '0.725rem', color: '#64748b' }}>{auth.application?.applicationIdentifier || auth.applicationId || '—'}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{auth.graph?.name || auth.dsgGraphId?.slice(0, 8)}</div>
                    <div style={{ fontSize: '0.725rem', color: '#94a3b8' }}>v{auth.dsgGraphVersion}</div>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                      {auth.selectedStrategyId ? auth.selectedStrategyId.slice(0, 14) : 'Default Shadow Facade'}
                    </span>
                  </td>
                  <td>{renderStatusBadge(auth.authorizationStatus)}</td>
                  <td>
                    <div style={{ fontSize: '0.775rem', color: '#f8fafc' }}>{auth.requestingOperatorEmail || 'Operator'}</div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{auth.requestingOperatorRole}</div>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                      {auth.expiresAt ? new Date(auth.expiresAt).toLocaleTimeString() : '—'}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                      {auth.expiresAt ? new Date(auth.expiresAt).toLocaleDateString() : ''}
                    </div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                        onClick={() => {
                          setSelectedAuth(auth);
                          setIsDetailModalOpen(true);
                        }}
                        title="View Full Authorization Record"
                      >
                        <Eye size={13} />
                      </button>

                      {isOwner && auth.authorizationStatus === 'PENDING' && (
                        <>
                          <button
                            className="btn btn-primary"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', background: '#059669', borderColor: '#10b981' }}
                            onClick={() => handleOpenAction(auth, 'approve')}
                            title="Approve Execution Request"
                          >
                            <CheckCircle2 size={13} />
                            <span>Approve</span>
                          </button>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: '#f87171' }}
                            onClick={() => handleOpenAction(auth, 'deny')}
                            title="Deny Execution Request"
                          >
                            <XCircle size={13} />
                            <span>Deny</span>
                          </button>
                        </>
                      )}

                      {isOwner && auth.authorizationStatus === 'APPROVED' && (
                        <>
                          <button
                            className="btn btn-primary"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', background: '#0284c7', borderColor: '#38bdf8' }}
                            onClick={() => handleOpenProvision(auth)}
                            title="Provision Isolated Synthetic Container"
                          >
                            <Server size={13} />
                            <span>Provision</span>
                          </button>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: '#f59e0b' }}
                            onClick={() => handleOpenAction(auth, 'revoke')}
                            title="Revoke Authorization"
                          >
                            <RotateCcw size={13} />
                            <span>Revoke</span>
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Inspection Modal */}
      {isDetailModalOpen && selectedAuth && (
        <div className="runtime-modal-backdrop" onClick={() => setIsDetailModalOpen(false)}>
          <div className="runtime-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="runtime-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={18} color="#38bdf8" />
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#f8fafc' }}>Authorization Specification</h3>
              </div>
              <button className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem' }} onClick={() => setIsDetailModalOpen(false)}>
                &times;
              </button>
            </div>
            <div className="runtime-modal-body">
              <div>
                <label style={{ fontSize: '0.725rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Authorization ID</label>
                <div style={{ fontFamily: 'monospace', color: '#38bdf8', fontSize: '0.85rem' }}>{selectedAuth.id}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.725rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Status</label>
                  <div>{renderStatusBadge(selectedAuth.authorizationStatus)}</div>
                </div>
                <div>
                  <label style={{ fontSize: '0.725rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Evaluator Version</label>
                  <div style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>Stage {selectedAuth.evaluatorVersion}</div>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.725rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Reason Codes</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.25rem' }}>
                  {(selectedAuth.authorizationReasonCodes || []).map((code, idx) => (
                    <span key={idx} className="status-pill provisioning" style={{ fontSize: '0.7rem' }}>
                      {code}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.725rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Decision Rationale</label>
                <div style={{ fontSize: '0.8125rem', color: '#cbd5e1', background: '#090f1d', padding: '0.75rem', borderRadius: '6px' }}>
                  {selectedAuth.decisionRationale || 'No rationale provided.'}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.725rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Requesting Operator</label>
                  <div style={{ fontSize: '0.8125rem', color: '#f8fafc' }}>{selectedAuth.requestingOperatorEmail}</div>
                  <div style={{ fontSize: '0.725rem', color: '#94a3b8' }}>{selectedAuth.requestingOperatorRole}</div>
                </div>
                <div>
                  <label style={{ fontSize: '0.725rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Approving Operator</label>
                  <div style={{ fontSize: '0.8125rem', color: '#f8fafc' }}>{selectedAuth.approvingOperatorEmail || 'Pending Owner Review'}</div>
                </div>
              </div>

              {selectedAuth.idempotencyKey && (
                <div>
                  <label style={{ fontSize: '0.725rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Idempotency Key &amp; Hash</label>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#cbd5e1' }}>Key: {selectedAuth.idempotencyKey}</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.725rem', color: '#64748b' }}>Hash: {selectedAuth.requestPayloadHash || 'N/A'}</div>
                </div>
              )}
            </div>
            <div className="runtime-modal-footer">
              <button className="btn btn-secondary" onClick={() => setIsDetailModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Confirmation Modal (Approve / Deny / Revoke) */}
      {actionAuth && actionType && (
        <div className="runtime-modal-backdrop" onClick={() => setActionAuth(null)}>
          <div className="runtime-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="runtime-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {actionType === 'approve' && <CheckCircle2 size={18} color="#10b981" />}
                {actionType === 'deny' && <XCircle size={18} color="#f87171" />}
                {actionType === 'revoke' && <RotateCcw size={18} color="#f59e0b" />}
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#f8fafc', textTransform: 'capitalize' }}>
                  {actionType} Execution Authorization
                </h3>
              </div>
              <button className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem' }} onClick={() => setActionAuth(null)}>
                &times;
              </button>
            </div>
            <div className="runtime-modal-body">
              <p style={{ fontSize: '0.8125rem', color: '#cbd5e1', margin: 0 }}>
                You are about to <strong>{actionType}</strong> execution authorization <code>{actionAuth.id.slice(0, 16)}...</code>.
              </p>

              {actionError && (
                <div className="runtime-notice-banner warning">
                  <AlertTriangle size={16} />
                  <div>{actionError}</div>
                </div>
              )}

              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                  Operator Rationale / Audit Comment:
                </label>
                <textarea
                  className="input"
                  style={{ width: '100%', minHeight: '80px', fontSize: '0.8125rem', background: '#090f1d' }}
                  placeholder={`Enter reason for ${actionType}...`}
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                />
              </div>
            </div>
            <div className="runtime-modal-footer">
              <button className="btn btn-secondary" onClick={() => setActionAuth(null)} disabled={actionLoading}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleExecuteAction}
                disabled={actionLoading}
                style={{
                  background: actionType === 'approve' ? '#059669' : actionType === 'deny' ? '#dc2626' : '#d97706',
                  borderColor: actionType === 'approve' ? '#10b981' : actionType === 'deny' ? '#ef4444' : '#f59e0b'
                }}
              >
                {actionLoading ? 'Processing...' : `Confirm ${actionType}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stage 5B.2 Container Provisioning Modal */}
      {isProvisionModalOpen && provisionAuth && (
        <div className="runtime-modal-backdrop" onClick={() => setIsProvisionModalOpen(false)}>
          <div className="runtime-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px' }}>
            <div className="runtime-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Server size={18} color="#38bdf8" />
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#f8fafc' }}>
                  Provision Isolated Synthetic Container
                </h3>
              </div>
              <button
                className="btn btn-secondary"
                style={{ padding: '0.2rem 0.5rem' }}
                onClick={() => setIsProvisionModalOpen(false)}
              >
                &times;
              </button>
            </div>

            <div className="runtime-modal-body">
              {provisionSuccess ? (
                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                  <CheckCircle2 size={40} color="#10b981" style={{ margin: '0 auto 0.75rem' }} />
                  <h4 style={{ color: '#f8fafc', margin: '0 0 0.5rem' }}>Synthetic Container Provisioned</h4>
                  <p style={{ fontSize: '0.8125rem', color: '#94a3b8', margin: '0 0 1rem' }}>
                    Container successfully created on isolated internal bridge network. Egress quarantined, health verified.
                  </p>
                  <div style={{ background: '#090f1d', padding: '0.75rem', borderRadius: '6px', textAlign: 'left', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                    <div><strong>Job ID:</strong> {provisionSuccess.id}</div>
                    {provisionSuccess.environmentId && (
                      <div><strong>Environment ID:</strong> {provisionSuccess.environmentId}</div>
                    )}
                    <div><strong>Status:</strong> {provisionSuccess.jobStatus}</div>
                  </div>
                </div>
              ) : (
                <>
                  <p style={{ fontSize: '0.8125rem', color: '#cbd5e1', margin: 0 }}>
                    Provisioning container under approved authorization <code>{provisionAuth.id.slice(0, 16)}...</code>.
                  </p>

                  {provisionError && (
                    <div className="runtime-notice-banner warning">
                      <AlertTriangle size={16} />
                      <div>{provisionError}</div>
                    </div>
                  )}

                  {/* Security Invariant Highlights */}
                  <div style={{ background: '#090f1d', border: '1px solid #1e293b', borderRadius: '6px', padding: '0.75rem' }}>
                    <div style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 600, marginBottom: '0.35rem' }}>
                      Security Hardening &amp; Isolation Invariants
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.725rem', color: '#94a3b8', lineHeight: 1.5 }}>
                      <li>Dedicated Docker bridge network with <code>Internal: true</code> (Zero Internet Egress).</li>
                      <li>Drop all Linux capabilities (<code>cap_drop: ALL</code>) and <code>no-new-privileges: true</code>.</li>
                      <li>Read-only root filesystem with memory-backed tmpfs for <code>/tmp</code>.</li>
                      <li>Non-root execution (UID 1000:1000).</li>
                      <li>Zero published host ports; negative connectivity test (8.8.8.8:53 blocked) enforced.</li>
                    </ul>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                      Synthetic Service Template:
                    </label>
                    <select
                      className="input"
                      style={{ width: '100%', fontSize: '0.8125rem', background: '#090f1d' }}
                      value={selectedTemplate}
                      onChange={(e) => setSelectedTemplate(e.target.value)}
                    >
                      <option value="tpl-synthetic-api-01">Synthetic API Service (tpl-synthetic-api-01) - 0.25 CPU, 128 MB</option>
                      <option value="tpl-synthetic-auth-01">Synthetic Auth Service (tpl-synthetic-auth-01) - 0.25 CPU, 128 MB</option>
                      <option value="tpl-synthetic-data-01">Synthetic Data Service (tpl-synthetic-data-01) - 0.50 CPU, 256 MB</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                      Approved Container Image:
                    </label>
                    <select
                      className="input"
                      style={{ width: '100%', fontSize: '0.8125rem', background: '#090f1d' }}
                      value={selectedImage}
                      onChange={(e) => setSelectedImage(e.target.value)}
                    >
                      <option value="img-syn-alpine-node-01">
                        deception-synthetic-service:1.0.0 (Node 20 Alpine - Approved)
                      </option>
                      <option value="img-syn-node-base-01">
                        node:20-alpine (Base Node.js Runtime - Approved)
                      </option>
                    </select>
                  </div>
                </>
              )}
            </div>

            <div className="runtime-modal-footer">
              {provisionSuccess ? (
                <button
                  className="btn btn-primary"
                  onClick={() => setIsProvisionModalOpen(false)}
                >
                  Close
                </button>
              ) : (
                <>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setIsProvisionModalOpen(false)}
                    disabled={provisionLoading}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleExecuteProvision}
                    disabled={provisionLoading}
                    style={{ background: '#0284c7', borderColor: '#38bdf8' }}
                  >
                    {provisionLoading ? 'Provisioning Container...' : 'Execute Provisioning'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
