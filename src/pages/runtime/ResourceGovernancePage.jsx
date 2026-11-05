import React, { useState, useEffect, useCallback } from 'react';
import {
  Sliders,
  Cpu,
  Layers,
  Database,
  Clock,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Edit2,
  ShieldAlert,
  Server,
  Activity
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import { useAuth } from '../../hooks/useAuth';
import { apiClient } from '../../services/apiClient';
import './runtime.css';

export default function ResourceGovernancePage() {
  const { activeTenant, user } = useAuth();
  const tenantIdentifier = activeTenant?.id || activeTenant?.identifier || 'tenant-apex-9941';
  const isOwner = user?.isPlatformAdmin || activeTenant?.role === 'APPLICATION_OWNER';

  const [quota, setQuota] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Edit Quota modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    maxActiveEnvironments: 3,
    maxCpuAllocation: 2.0,
    maxMemoryMb: 1024,
    maxExecutionRequestsPerHour: 20,
    maxEnvironmentLifetimeMinutes: 120
  });
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const fetchQuota = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.getRuntimeQuotas(tenantIdentifier);
      if (res && res.success && res.data) {
        setQuota(res.data.quota);
        if (res.data.quota) {
          setEditForm({
            maxActiveEnvironments: res.data.quota.maxActiveEnvironments,
            maxCpuAllocation: res.data.quota.maxCpuAllocation,
            maxMemoryMb: res.data.quota.maxMemoryMb,
            maxExecutionRequestsPerHour: res.data.quota.maxExecutionRequestsPerHour,
            maxEnvironmentLifetimeMinutes: res.data.quota.maxEnvironmentLifetimeMinutes
          });
        }
      } else {
        throw new Error(res?.error?.message || 'Failed to load resource quota.');
      }
    } catch (err) {
      setError(err.message || 'Error communicating with resource governance service.');
    } finally {
      setLoading(false);
    }
  }, [tenantIdentifier]);

  useEffect(() => {
    fetchQuota();
  }, [fetchQuota]);

  const handleSaveQuota = async (e) => {
    e.preventDefault();
    setSaveLoading(true);
    setSaveError(null);
    try {
      const res = await apiClient.updateRuntimeQuotas(tenantIdentifier, {
        maxActiveEnvironments: Number(editForm.maxActiveEnvironments),
        maxCpuAllocation: Number(editForm.maxCpuAllocation),
        maxMemoryMb: Number(editForm.maxMemoryMb),
        maxExecutionRequestsPerHour: Number(editForm.maxExecutionRequestsPerHour),
        maxEnvironmentLifetimeMinutes: Number(editForm.maxEnvironmentLifetimeMinutes)
      });
      if (res && res.success) {
        setIsEditModalOpen(false);
        fetchQuota();
      } else {
        throw new Error(res?.error?.message || 'Failed to update quota limits.');
      }
    } catch (err) {
      setSaveError(err.message || 'Error updating quota.');
    } finally {
      setSaveLoading(false);
    }
  };

  const getPercent = (current, max) => {
    if (!max || max <= 0) return 0;
    return Math.min(100, Math.round(((current || 0) / max) * 100));
  };

  return (
    <div className="runtime-page">
      <PageHeader
        title="Resource Governance"
        subtitle="Tenant and application quota enforcement, capacity status tracking, and admission limits"
        actions={
          <div className="runtime-header-actions">
            <button
              className="btn btn-secondary"
              onClick={fetchQuota}
              disabled={loading}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
            {isOwner && (
              <button
                className="btn btn-primary"
                onClick={() => setIsEditModalOpen(true)}
                disabled={loading || !quota}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <Edit2 size={15} />
                <span>Configure Quota</span>
              </button>
            )}
          </div>
        }
      />

      {/* Capacity Status Banner */}
      <div className="runtime-notice-banner warning">
        <Server size={20} style={{ flexShrink: 0, color: '#f59e0b' }} />
        <div>
          <strong>Host Infrastructure Capacity Status: UNKNOWN.</strong> Host telemetry monitoring is uncalibrated in Stage 5B.1. Admission governance strictly enforces static research/dev safety boundaries to prevent system starvation during concurrent deception evaluation.
        </div>
      </div>

      {loading && <LoadingState message="Loading resource governance metrics..." />}

      {error && (
        <div className="runtime-notice-banner warning">
          <AlertTriangle size={18} style={{ flexShrink: 0, color: '#f59e0b' }} />
          <div>
            <strong>Error:</strong> {error}
          </div>
        </div>
      )}

      {!loading && quota && (
        <>
          {/* Quota Utilization Cards */}
          <div className="runtime-metric-grid">
            {/* Active Environments */}
            <div className="runtime-card">
              <div className="runtime-card-title">
                <span>Active Environments</span>
                <Layers size={16} color="#38bdf8" />
              </div>
              <div className="runtime-card-value">
                {quota.currentActiveEnvironments || 0}
                <span style={{ fontSize: '1rem', color: '#64748b', fontWeight: 400 }}> / {quota.maxActiveEnvironments}</span>
              </div>
              <div className="quota-progress-track">
                <div
                  className={`quota-progress-fill ${
                    getPercent(quota.currentActiveEnvironments, quota.maxActiveEnvironments) > 80 ? 'danger' : 'safe'
                  }`}
                  style={{ width: `${getPercent(quota.currentActiveEnvironments, quota.maxActiveEnvironments)}%` }}
                />
              </div>
              <div className="runtime-card-subtitle">
                {getPercent(quota.currentActiveEnvironments, quota.maxActiveEnvironments)}% capacity utilized
              </div>
            </div>

            {/* CPU Allocation */}
            <div className="runtime-card">
              <div className="runtime-card-title">
                <span>CPU Allocation</span>
                <Cpu size={16} color="#34d399" />
              </div>
              <div className="runtime-card-value">
                {quota.currentAllocatedCpu || 0}
                <span style={{ fontSize: '1rem', color: '#64748b', fontWeight: 400 }}> / {quota.maxCpuAllocation} cores</span>
              </div>
              <div className="quota-progress-track">
                <div
                  className="quota-progress-fill safe"
                  style={{ width: `${getPercent(quota.currentAllocatedCpu, quota.maxCpuAllocation)}%` }}
                />
              </div>
              <div className="runtime-card-subtitle">Simulated host vCPU reservation</div>
            </div>

            {/* Memory Allocation */}
            <div className="runtime-card">
              <div className="runtime-card-title">
                <span>Memory Allocation</span>
                <Database size={16} color="#a855f7" />
              </div>
              <div className="runtime-card-value">
                {quota.currentAllocatedMemoryMb || 0}
                <span style={{ fontSize: '1rem', color: '#64748b', fontWeight: 400 }}> / {quota.maxMemoryMb} MB</span>
              </div>
              <div className="quota-progress-track">
                <div
                  className="quota-progress-fill safe"
                  style={{ width: `${getPercent(quota.currentAllocatedMemoryMb, quota.maxMemoryMb)}%` }}
                />
              </div>
              <div className="runtime-card-subtitle">Peak heap and container bounds</div>
            </div>

            {/* Rate Limit */}
            <div className="runtime-card">
              <div className="runtime-card-title">
                <span>Hourly Rate Limit</span>
                <Clock size={16} color="#fbbf24" />
              </div>
              <div className="runtime-card-value">
                {quota.maxExecutionRequestsPerHour}
                <span style={{ fontSize: '1rem', color: '#64748b', fontWeight: 400 }}> req/hr</span>
              </div>
              <div className="runtime-card-subtitle">Execution request throttling threshold</div>
            </div>
          </div>

          {/* Governance Specification Table */}
          <div className="runtime-table-container">
            <table className="runtime-table">
              <thead>
                <tr>
                  <th>Governance Dimension</th>
                  <th>Current Quota Limit</th>
                  <th>Default Baseline</th>
                  <th>Enforcement Policy</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <strong>Concurrent Deception Environments</strong>
                    <div style={{ fontSize: '0.725rem', color: '#64748b' }}>Simultaneously active simulated environments</div>
                  </td>
                  <td><span style={{ fontWeight: 600, color: '#38bdf8' }}>{quota.maxActiveEnvironments}</span></td>
                  <td>3 environments</td>
                  <td>Hard reject on admission validation</td>
                </tr>
                <tr>
                  <td>
                    <strong>Maximum Host CPU Reservation</strong>
                    <div style={{ fontSize: '0.725rem', color: '#64748b' }}>Virtual core allocation per environment</div>
                  </td>
                  <td><span style={{ fontWeight: 600, color: '#38bdf8' }}>{quota.maxCpuAllocation} vCPU</span></td>
                  <td>2.0 cores</td>
                  <td>Enforced via cgroups quota limits</td>
                </tr>
                <tr>
                  <td>
                    <strong>Maximum Memory Allocation</strong>
                    <div style={{ fontSize: '0.725rem', color: '#64748b' }}>Resident memory per deception pod</div>
                  </td>
                  <td><span style={{ fontWeight: 600, color: '#38bdf8' }}>{quota.maxMemoryMb} MB</span></td>
                  <td>1024 MB</td>
                  <td>Enforced via cgroups memory bounds</td>
                </tr>
                <tr>
                  <td>
                    <strong>Environment Maximum Lifetime</strong>
                    <div style={{ fontSize: '0.725rem', color: '#64748b' }}>Automatic TTL before expiry state transition</div>
                  </td>
                  <td><span style={{ fontWeight: 600, color: '#38bdf8' }}>{quota.maxEnvironmentLifetimeMinutes} min</span></td>
                  <td>120 minutes</td>
                  <td>Lifecycle state machine auto-termination</td>
                </tr>
                <tr>
                  <td>
                    <strong>Execution Requests Per Hour</strong>
                    <div style={{ fontSize: '0.725rem', color: '#64748b' }}>Anti-flooding sliding window rate limiter</div>
                  </td>
                  <td><span style={{ fontWeight: 600, color: '#38bdf8' }}>{quota.maxExecutionRequestsPerHour} req/hr</span></td>
                  <td>20 requests</td>
                  <td>Idempotency gate and 429 quota throttle</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Edit Quota Modal */}
      {isEditModalOpen && (
        <div className="runtime-modal-backdrop" onClick={() => setIsEditModalOpen(false)}>
          <div className="runtime-modal-content" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSaveQuota}>
              <div className="runtime-modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Sliders size={18} color="#38bdf8" />
                  <h3 style={{ margin: 0, fontSize: '1rem', color: '#f8fafc' }}>Configure Quota Limits</h3>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '0.2rem 0.5rem' }}
                  onClick={() => setIsEditModalOpen(false)}
                >
                  &times;
                </button>
              </div>
              <div className="runtime-modal-body">
                {saveError && (
                  <div className="runtime-notice-banner warning">
                    <AlertTriangle size={16} />
                    <div>{saveError}</div>
                  </div>
                )}

                <div>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                    Max Active Environments:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    className="input"
                    style={{ width: '100%', fontSize: '0.8125rem', background: '#090f1d' }}
                    value={editForm.maxActiveEnvironments}
                    onChange={(e) => setEditForm({ ...editForm, maxActiveEnvironments: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                      Max CPU (cores):
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.5"
                      max="8.0"
                      className="input"
                      style={{ width: '100%', fontSize: '0.8125rem', background: '#090f1d' }}
                      value={editForm.maxCpuAllocation}
                      onChange={(e) => setEditForm({ ...editForm, maxCpuAllocation: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                      Max Memory (MB):
                    </label>
                    <input
                      type="number"
                      min="256"
                      max="8192"
                      step="128"
                      className="input"
                      style={{ width: '100%', fontSize: '0.8125rem', background: '#090f1d' }}
                      value={editForm.maxMemoryMb}
                      onChange={(e) => setEditForm({ ...editForm, maxMemoryMb: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                      Max Hourly Requests:
                    </label>
                    <input
                      type="number"
                      min="5"
                      max="100"
                      className="input"
                      style={{ width: '100%', fontSize: '0.8125rem', background: '#090f1d' }}
                      value={editForm.maxExecutionRequestsPerHour}
                      onChange={(e) => setEditForm({ ...editForm, maxExecutionRequestsPerHour: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                      Max Lifetime (minutes):
                    </label>
                    <input
                      type="number"
                      min="15"
                      max="1440"
                      className="input"
                      style={{ width: '100%', fontSize: '0.8125rem', background: '#090f1d' }}
                      value={editForm.maxEnvironmentLifetimeMinutes}
                      onChange={(e) => setEditForm({ ...editForm, maxEnvironmentLifetimeMinutes: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>
              <div className="runtime-modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsEditModalOpen(false)} disabled={saveLoading}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saveLoading}>
                  {saveLoading ? 'Saving...' : 'Save Quota Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
