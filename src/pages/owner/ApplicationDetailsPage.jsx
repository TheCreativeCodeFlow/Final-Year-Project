import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Layers,
  ArrowLeft,
  Edit2,
  Activity,
  Shield,
  ShieldCheck,
  AlertTriangle,
  Shuffle,
  Clock,
  Sparkles,
  ExternalLink,
  Tag,
  CheckCircle2,
  Server,
  Database
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import MetricCard from '../../components/common/MetricCard';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingState from '../../components/common/LoadingState';
import EmptyState from '../../components/common/EmptyState';
import { useAuth } from '../../hooks/useAuth';
import { apiClient } from '../../services/apiClient';
import {
  getApplicationById as getMockAppById,
  getApplicationTraffic,
  getSecurityEvents,
  DEMO_DATA_DISCLAIMER
} from '../../services/mockData';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

export default function ApplicationDetailsPage() {
  const { applicationId } = useParams();
  const navigate = useNavigate();
  const { activeTenant } = useAuth();
  const tenantIdentifier = activeTenant?.identifier || activeTenant?.id || 'tenant-apex-9941';

  const [app, setApp] = useState(null);
  const [isLiveRecord, setIsLiveRecord] = useState(false);
  const [trafficData, setTrafficData] = useState([]);
  const [appEvents, setAppEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    async function loadData() {
      // 1. Attempt to fetch from real backend database
      try {
        const liveRes = await apiClient.getApplicationById(tenantIdentifier, applicationId);
        if (isMounted && liveRes && liveRes.success && liveRes.data) {
          setApp(liveRes.data);
          setIsLiveRecord(true);

          // Simulated traffic/events for visualization
          const traffic = await getApplicationTraffic(applicationId);
          const events = await getSecurityEvents({ applicationId });
          if (isMounted) {
            setTrafficData(traffic || []);
            setAppEvents(events || []);
            setLoading(false);
          }
          return;
        }
      } catch {
        // Fallback to mock data if backend not found
      }

      // 2. Fallback to mock fixtures
      try {
        const foundMock = await getMockAppById(applicationId);
        const traffic = await getApplicationTraffic(applicationId);
        const events = await getSecurityEvents({ applicationId });
        if (isMounted) {
          setApp(foundMock);
          setIsLiveRecord(false);
          setTrafficData(traffic || []);
          setAppEvents(events || []);
          setLoading(false);
        }
      } catch {
        if (isMounted) {
          setApp(null);
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [applicationId, tenantIdentifier]);

  if (loading) {
    return (
      <div className="page-container">
        <LoadingState message={`Retrieving configuration for application "${applicationId}"...`} />
      </div>
    );
  }

  // Not found state handling
  if (!app) {
    return (
      <div className="page-container">
        <EmptyState
          title="Application Not Found"
          description={`No registered application exists with identifier "${applicationId}" in tenant "${tenantIdentifier}".`}
          actionText="Return to Applications"
          onAction={() => navigate('/owner/applications')}
        />
      </div>
    );
  }

  const appIdentifier = app.applicationIdentifier || app.id;
  const statusStr = (app.status || 'PROTECTED').toUpperCase();
  const statusType =
    statusStr === 'PROTECTED' || statusStr === 'SHIELDED'
      ? 'operational'
      : statusStr === 'DEGRADED'
      ? 'medium'
      : 'low';

  return (
    <>
      <PageHeader
        title={app.name}
        badge={appIdentifier}
        description={app.description || `Protected ingress route: ${app.domain}`}
        actions={
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <Link to="/owner/applications" className="btn btn-secondary btn-sm">
              <ArrowLeft size={15} />
              <span>All Applications</span>
            </Link>
            <Link to={`/owner/applications/new?edit=${appIdentifier}`} className="btn btn-primary btn-sm">
              <Edit2 size={14} />
              <span>Edit Configuration</span>
            </Link>
          </div>
        }
      />

      <div className="page-container">
        {/* Source Banner */}
        <div
          className="demo-banner"
          style={
            isLiveRecord
              ? { borderColor: 'rgba(16, 185, 129, 0.4)', background: 'rgba(16, 185, 129, 0.08)' }
              : {}
          }
        >
          {isLiveRecord ? (
            <>
              <Database size={16} style={{ flexShrink: 0, color: '#10b981' }} />
              <div>
                <strong style={{ color: '#10b981' }}>DATA SOURCE: LIVE POSTGRESQL RECORD</strong>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Persistent domain model loaded from <code>/api/v1/tenants/{tenantIdentifier}/applications/{applicationId}</code>.
                </div>
              </div>
            </>
          ) : (
            <>
              <Sparkles size={16} style={{ flexShrink: 0 }} />
              <div>
                <strong>Prototype Application:</strong> {DEMO_DATA_DISCLAIMER} Ingress and threat metrics are synthetic indicators.
              </div>
            </>
          )}
        </div>

        {/* Application Metrics Summary */}
        <div className="metrics-grid">
          <MetricCard
            title="Ingress Hostname"
            value={app.domain}
            icon={Layers}
            subtext="Gateway Ingress Route"
            accentColor="#38bdf8"
          />
          <MetricCard
            title="Protection Supervision"
            value={statusStr}
            icon={ShieldCheck}
            subtext="Deception Mesh & Decoys"
            accentColor="#10b981"
          />
          <MetricCard
            title="Tenant Boundary"
            value={activeTenant?.displayName || tenantIdentifier}
            icon={Server}
            subtext="Isolated PostgreSQL Scope"
            accentColor="#8b5cf6"
          />
          <MetricCard
            title="Audit Status"
            value="Synchronized"
            icon={CheckCircle2}
            subtext={app.updatedAt ? `Updated ${new Date(app.updatedAt).toLocaleDateString()}` : 'Active Record'}
            accentColor="#f59e0b"
          />
        </div>

        {/* Ingress Configuration Card */}
        <div className="cyber-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Upstream Service Identity</h3>
            <span className="mono-tag" style={{ fontSize: '12px' }}>
              UUID: {app.id}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>
                Service Name
              </span>
              <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{app.name}</strong>
            </div>

            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>
                Ingress Hostname
              </span>
              <span className="mono-tag" style={{ color: '#93c5fd' }}>{app.domain}</span>
            </div>

            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>
                Protection Status
              </span>
              <div style={{ marginTop: '2px' }}>
                <StatusBadge status={statusType} label={statusStr} />
              </div>
            </div>

            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>
                Application Identifier
              </span>
              <span className="mono-tag" style={{ color: 'var(--accent-primary-light)' }}>
                {appIdentifier}
              </span>
            </div>
          </div>
        </div>

        {/* Synthetic Traffic Visualization Section */}
        <div className="cyber-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>Simulated Ingress Telemetry</h3>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Prototype traffic telemetry preview (real-time stream available upon Stage 4 proxy integration).
              </p>
            </div>
            <span className="demo-tag" style={{ fontSize: '10px' }}>
              PROTOTYPE PREVIEW
            </span>
          </div>

          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trafficData}>
                <defs>
                  <linearGradient id="trafficGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={11} />
                <YAxis stroke="var(--text-muted)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-surface-card)',
                    borderColor: 'var(--border-subtle)',
                    borderRadius: '6px',
                    fontSize: '12px'
                  }}
                />
                <Area type="monotone" dataKey="requests" stroke="#38bdf8" fillOpacity={1} fill="url(#trafficGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </>
  );
}
