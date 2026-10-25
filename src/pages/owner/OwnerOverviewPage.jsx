import React, { useState, useEffect } from 'react';
import {
  Layers,
  Activity,
  ShieldCheck,
  Shuffle,
  AlertTriangle,
  Clock,
  Sparkles,
  ExternalLink,
  Filter
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import MetricCard from '../../components/common/MetricCard';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingState from '../../components/common/LoadingState';
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
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('24h');

  useEffect(() => {
    let isMounted = true;
    getOwnerOverviewData().then((res) => {
      if (isMounted) {
        setData(res);
        setLoading(false);
      }
    });
    return () => { isMounted = false; };
  }, [timeRange]);

  if (loading || !data) {
    return (
      <div className="page-container">
        <LoadingState message="Loading tenant security telemetry..." />
      </div>
    );
  }

  const { metrics, trafficSeries, threatDistribution, protectedApps, securityEvents } = data;

  return (
    <>
      <PageHeader
        title="Application Owner Overview"
        badge={metrics.tenantName}
        description="Monitor application traffic, detected threat anomalies, and deceptive attacker diversions."
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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
        {/* Explicit Demo Data Notice */}
        <div className="demo-banner">
          <Sparkles size={16} style={{ flexShrink: 0 }} />
          <div>
            <strong>Simulated Telemetry View:</strong> {DEMO_DATA_DISCLAIMER}
          </div>
        </div>

        {/* High-Level Metric Cards Grid */}
        <div className="metrics-grid">
          <MetricCard
            title="Protected Applications"
            value={metrics.totalApplications.value}
            icon={Layers}
            trend={metrics.totalApplications.trend}
            trendDirection="up"
            subtext={metrics.totalApplications.subtext}
            accentColor="var(--accent-primary-light)"
          />

          <MetricCard
            title="Requests Processed"
            value={metrics.requestsProcessed.value}
            icon={Activity}
            trend={metrics.requestsProcessed.trend}
            trendDirection="up"
            subtext={metrics.requestsProcessed.subtext}
            accentColor="#38bdf8"
          />

          <MetricCard
            title="Threats Detected"
            value={metrics.threatsDetected.value}
            icon={AlertTriangle}
            trend={metrics.threatsDetected.trend}
            trendDirection="down"
            subtext={metrics.threatsDetected.subtext}
            accentColor="var(--severity-high)"
          />

          <MetricCard
            title="Diverted to Deception"
            value={metrics.deceptionActions.diverted}
            icon={Shuffle}
            trend={metrics.deceptionActions.trend}
            trendDirection="up"
            subtext={`${metrics.deceptionActions.blocked} outright blocked`}
            accentColor="var(--accent-diverted)"
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
                  Real-time hourly volume with honeynet diversion breakdown
                </div>
              </div>
              <span className="demo-tag">SIMULATED TIME SERIES</span>
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
            <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', marginTop: '0.75rem', fontSize: '12px', color: 'var(--text-muted)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: 10, height: 10, borderRadius: '2px', backgroundColor: '#3b82f6' }} />
                <span>Total Ingress</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: 10, height: 10, borderRadius: '2px', backgroundColor: '#06b6d4' }} />
                <span>Diverted into Deception</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: 10, height: 10, borderRadius: '2px', backgroundColor: '#ef4444' }} />
                <span>Blocked</span>
              </div>
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
              <span className="demo-tag">DISTRIBUTION</span>
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', textAlign: 'center', marginTop: '0.5rem' }}>
              {threatDistribution.map((item) => (
                <div key={item.name} style={{ background: 'var(--bg-surface)', padding: '6px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{item.name}</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: item.color }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Protected Applications Status Table */}
        <div className="cyber-card">
          <div className="cyber-card-header">
            <div>
              <div className="cyber-card-title">
                <ShieldCheck size={18} style={{ color: 'var(--status-success)' }} />
                <span>Protected Application Status</span>
              </div>
              <div className="cyber-card-subtitle">
                Registered endpoints actively routed through deception gateway filters
              </div>
            </div>
            <span className="demo-tag">{protectedApps.length} APPS SHIELDED</span>
          </div>

          <div className="cyber-table-container">
            <table className="cyber-table">
              <thead>
                <tr>
                  <th>Application Name</th>
                  <th>Gateway Ingress Route</th>
                  <th>Gateway Status</th>
                  <th>Deception Profile</th>
                  <th>Throughput</th>
                  <th>Active Decoys</th>
                  <th>Threat Level</th>
                </tr>
              </thead>
              <tbody>
                {protectedApps.map((app) => (
                  <tr key={app.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{app.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ID: {app.id}</div>
                    </td>
                    <td>
                      <span className="mono-tag">{app.route}</span>
                    </td>
                    <td>
                      <StatusBadge status={app.status} label="Shielded" />
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {app.deceptionMode}
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                        {app.requestsPerSec} req/s
                      </span>
                    </td>
                    <td>
                      <span className="demo-tag" style={{ backgroundColor: 'var(--accent-deception-subtle)', color: '#c084fc', borderColor: 'rgba(192, 132, 252, 0.3)' }}>
                        {app.activeDecoys} Decoys
                      </span>
                    </td>
                    <td>
                      <StatusBadge
                        status={app.threatIndex === 'Elevated' ? 'high' : app.threatIndex === 'Medium' ? 'medium' : 'low'}
                        label={app.threatIndex}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Security Events Table */}
        <div className="cyber-card">
          <div className="cyber-card-header">
            <div>
              <div className="cyber-card-title">
                <Shuffle size={18} style={{ color: 'var(--accent-diverted)' }} />
                <span>Recent Security & Deception Events</span>
              </div>
              <div className="cyber-card-subtitle">
                Suspicious requests detected and redirected away from authentic backend services
              </div>
            </div>
            <span className="demo-tag">LIVE HONEYNET LOG</span>
          </div>

          <div className="cyber-table-container">
            <table className="cyber-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Target Application</th>
                  <th>Attacker Source IP</th>
                  <th>Detected Attack Vector</th>
                  <th>Gateway Deception Action</th>
                  <th>Severity</th>
                </tr>
              </thead>
              <tbody>
                {securityEvents.map((evt) => (
                  <tr key={evt.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '12px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{evt.timestamp}</span>
                    </td>
                    <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                      {evt.application}
                    </td>
                    <td>
                      <span className="mono-tag">{evt.sourceIp}</span>
                    </td>
                    <td>
                      <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{evt.vector}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{evt.details}</div>
                    </td>
                    <td>
                      <StatusBadge status="diverted" label={evt.gatewayAction} />
                    </td>
                    <td>
                      <StatusBadge status={evt.severity} />
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
