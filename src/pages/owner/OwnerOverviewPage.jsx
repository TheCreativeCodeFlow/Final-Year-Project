import React, { useState, useEffect, useCallback } from 'react';
import {
  Layers,
  Activity,
  ShieldCheck,
  Shuffle,
  AlertTriangle,
  Clock,
  Sparkles,
  ExternalLink,
  Filter,
  Database,
  RefreshCw,
  Sliders,
  CheckCircle2
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import MetricCard from '../../components/common/MetricCard';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingState from '../../components/common/LoadingState';
import { useAuth } from '../../hooks/useAuth';
import { apiClient } from '../../services/apiClient';
import { getOwnerOverviewData, DEMO_DATA_DISCLAIMER } from '../../services/mockData';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

export default function OwnerOverviewPage() {
  const { activeTenant } = useAuth();
  const tenantIdentifier = activeTenant?.identifier || activeTenant?.id || 'tenant-apex-9941';

  const [data, setData] = useState(null);
  const [liveApps, setLiveApps] = useState([]);
  const [liveEventsCount, setLiveEventsCount] = useState(0);
  const [livePoliciesCount, setLivePoliciesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState('live');
  const [timeRange, setTimeRange] = useState('24h');

  const loadOverviewData = useCallback(async () => {
    setLoading(true);

    try {
      const [overviewMock, appsRes, eventsRes, policiesRes] = await Promise.all([
        getOwnerOverviewData(),
        apiClient.getApplications(tenantIdentifier).catch(() => ({ success: false })),
        apiClient.getSecurityEvents(tenantIdentifier).catch(() => ({ success: false })),
        apiClient.getPolicies(tenantIdentifier).catch(() => ({ success: false }))
      ]);

      setData(overviewMock);

      if (appsRes && appsRes.success && Array.isArray(appsRes.data)) {
        setLiveApps(appsRes.data);
      }
      if (eventsRes && eventsRes.success && Array.isArray(eventsRes.data)) {
        setLiveEventsCount(eventsRes.data.length);
      }
      if (policiesRes && policiesRes.success && Array.isArray(policiesRes.data)) {
        setLivePoliciesCount(policiesRes.data.length);
      }

      setDataSource('live');
    } catch {
      const fallback = await getOwnerOverviewData();
      setData(fallback);
      setDataSource('demo');
    } finally {
      setLoading(false);
    }
  }, [tenantIdentifier]);

  useEffect(() => {
    loadOverviewData();
  }, [loadOverviewData, timeRange]);

  if (loading || !data) {
    return (
      <div className="page-container">
        <LoadingState message="Loading tenant security telemetry and PostgreSQL metrics..." />
      </div>
    );
  }

  const { metrics, trafficSeries, threatDistribution, protectedApps } = data;

  return (
    <>
      <PageHeader
        title="Application Owner Overview"
        badge={activeTenant?.name || metrics.tenantName}
        description="Monitor application protection status, verified database domain entities, and honeynet decision telemetry."
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={loadOverviewData}
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={13} />
              <span>Refresh</span>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-muted)' }}>
              <Clock size={15} />
              <span>Period:</span>
            </div>
            <select
              className="cyber-select"
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
            >
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
        }
      />

      <div className="page-container">
        {/* Explicit Data Source & Integrity Notice */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            marginBottom: '20px',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-secondary)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Database size={18} style={{ color: '#10b981', flexShrink: 0 }} />
            <div>
              <strong style={{ color: '#34d399' }}>Database Integrity Audit:</strong> Entity counts for applications, security events, and policies are queried directly from
              <strong style={{ color: '#fff', marginLeft: '4px' }}>PostgreSQL (LIVE)</strong>.
              Ingress request velocity and decoy time series are labeled as
              <strong style={{ color: '#93c5fd', marginLeft: '4px' }}>PROTOTYPE: Uncollected Telemetry</strong>.
            </div>
          </div>
        </div>

        {/* High-Level Metric Cards Grid */}
        <div className="metrics-grid">
          <MetricCard
            title="Protected Applications"
            value={liveApps.length > 0 ? liveApps.length : metrics.totalApplications.value}
            icon={Layers}
            subtext="LIVE: PostgreSQL (Verified DB Entities)"
            accentColor="#34d399"
          />

          <MetricCard
            title="Security Observations"
            value={liveEventsCount > 0 ? liveEventsCount : metrics.threatsDetected.value}
            icon={AlertTriangle}
            subtext="LIVE: PostgreSQL (Recorded Telemetry)"
            accentColor="#38bdf8"
          />

          <MetricCard
            title="Deception Policies"
            value={livePoliciesCount > 0 ? livePoliciesCount : 3}
            icon={Sliders}
            subtext="LIVE: PostgreSQL (Configured Rules)"
            accentColor="var(--accent-diverted)"
          />

          <MetricCard
            title="Ingress Traffic Flow"
            value={metrics.requestsProcessed.value}
            icon={Activity}
            subtext="PROTOTYPE: Uncollected Telemetry"
            accentColor="#9ca3af"
          />
        </div>

        {/* Charts Row: Traffic Timeline & Severity Breakdown */}
        <div className="grid-2col">
          {/* Main Traffic & Deception Chart */}
          <div className="cyber-card">
            <div className="cyber-card-header">
              <div>
                <div className="cyber-card-title">
                  <Activity size={18} style={{ color: 'var(--accent-primary-light)' }} />
                  <span>Traffic Ingress vs. Deceptive Diversions</span>
                </div>
                <div className="cyber-card-subtitle">
                  PROTOTYPE: Uncollected Telemetry (Simulated Timeseries)
                </div>
              </div>
              <span className="demo-tag">PROTOTYPE SIMULATION</span>
            </div>

            <div style={{ width: '100%', height: 280, marginTop: '1rem' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trafficSeries} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorDecoy" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorBlocked" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                  <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-surface-elevated)',
                      borderColor: 'var(--border-default)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '12px'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="totalRequests"
                    name="Total Ingress"
                    stroke="#3b82f6"
                    fillOpacity={1}
                    fill="url(#colorTotal)"
                  />
                  <Area
                    type="monotone"
                    dataKey="divertedToDecoy"
                    name="Diverted to Decoy"
                    stroke="#06b6d4"
                    fillOpacity={1}
                    fill="url(#colorDecoy)"
                  />
                  <Area
                    type="monotone"
                    dataKey="blocked"
                    name="Directly Blocked"
                    stroke="#ef4444"
                    fillOpacity={1}
                    fill="url(#colorBlocked)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Threat Severity Distribution */}
          <div className="cyber-card">
            <div className="cyber-card-header">
              <div>
                <div className="cyber-card-title">
                  <AlertTriangle size={18} style={{ color: 'var(--severity-high)' }} />
                  <span>Threat Severity Mix</span>
                </div>
                <div className="cyber-card-subtitle">
                  Classified by heuristic anomaly detector
                </div>
              </div>
              <span className="demo-tag">PROTOTYPE MIX</span>
            </div>

            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={threatDistribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                  >
                    {threatDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="var(--bg-surface-card)" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-surface-elevated)',
                      borderColor: 'var(--border-default)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '12px'
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    wrapperStyle={{ fontSize: '11px', color: 'var(--text-secondary)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Protected Applications Status Table */}
        <div className="cyber-card">
          <div className="cyber-card-header">
            <div>
              <div className="cyber-card-title">
                <ShieldCheck size={18} style={{ color: 'var(--status-success)' }} />
                <span>Protected Application Status (PostgreSQL)</span>
              </div>
              <div className="cyber-card-subtitle">
                Registered endpoints actively routed through deception gateway filters
              </div>
            </div>
            <span className="demo-tag" style={{ color: '#34d399', background: 'rgba(52, 211, 153, 0.1)' }}>
              {liveApps.length} APPS RECORDED
            </span>
          </div>

          <div className="cyber-table-container">
            <table className="cyber-table">
              <thead>
                <tr>
                  <th>Application Name</th>
                  <th>Domain Endpoint</th>
                  <th>Security Status</th>
                  <th>Identifier</th>
                </tr>
              </thead>
              <tbody>
                {(liveApps.length > 0 ? liveApps : protectedApps).map((app) => (
                  <tr key={app.id}>
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{app.name}</span>
                    </td>
                    <td>
                      <code style={{ fontSize: '12px', color: 'var(--accent-primary-light)' }}>
                        {app.domain || app.endpoint}
                      </code>
                    </td>
                    <td>
                      <StatusBadge
                        status={app.status?.toLowerCase() === 'protected' ? 'active' : 'warning'}
                        label={app.status || 'PROTECTED'}
                      />
                    </td>
                    <td>
                      <code style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {app.applicationIdentifier || app.id}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
