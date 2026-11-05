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
  FileCheck
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

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.getRuntimeOverview(tenantIdentifier);
      if (res && res.success && res.data) {
        setOverview(res.data);
      } else {
        throw new Error(res?.error?.message || 'Failed to fetch runtime overview.');
      }
    } catch (err) {
      setError(err.message || 'Error communicating with runtime service.');
    } finally {
      setLoading(false);
    }
  }, [tenantIdentifier]);

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

          {/* Quick Navigation Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
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
