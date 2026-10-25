import React, { useState, useEffect } from 'react';
import {
  Shield,
  Activity,
  Users,
  Radio,
  Server,
  FileText,
  AlertOctagon,
  Sparkles,
  Clock,
  CheckCircle2,
  Cpu,
  RefreshCw
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import MetricCard from '../../components/common/MetricCard';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingState from '../../components/common/LoadingState';
import { getAdminOverviewData, DEMO_DATA_DISCLAIMER } from '../../services/mockData';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

export default function AdminOverviewPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;
    getAdminOverviewData().then((res) => {
      if (isMounted) {
        setData(res);
        setLoading(false);
      }
    });
    return () => { isMounted = false; };
  }, [refreshKey]);

  if (loading || !data) {
    return (
      <div className="page-container">
        <LoadingState message="Loading global gateway cluster telemetry..." />
      </div>
    );
  }

  const { metrics, trends, vectors, components, highSeverityEvents, auditEvents } = data;

  return (
    <>
      <PageHeader
        title="Gateway Administrator Overview"
        badge="Platform Operations Console"
        description="Global reverse proxy mesh status, multi-tenant isolation, AI deception engine health, and active investigations."
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="gateway-status-pill" style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)' }}>
              <span className="status-pulse-dot" />
              <span>{metrics.platformHealth} • Latency {metrics.latency}</span>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setRefreshKey((k) => k + 1)}
              title="Refresh simulated metrics"
            >
              <RefreshCw size={13} />
              <span>Refresh</span>
            </button>
          </div>
        }
      />

      <div className="page-container">
        {/* Explicit Demo Data Notice */}
        <div className="demo-banner">
          <Sparkles size={16} style={{ flexShrink: 0 }} />
          <div>
            <strong>Gateway Operations Telemetry (Simulated):</strong> {DEMO_DATA_DISCLAIMER} No live traffic is inspected or redirected.
          </div>
        </div>

        {/* Global Cluster Metrics */}
        <div className="metrics-grid">
          <MetricCard
            title="Total Tenants"
            value={metrics.totalTenants.value}
            icon={Users}
            trend={metrics.totalTenants.trend}
            trendDirection="up"
            subtext={metrics.totalTenants.subtext}
            accentColor="#60a5fa"
          />

          <MetricCard
            title="Platform Ingress"
            value={metrics.platformRequests.value}
            icon={Activity}
            trend={metrics.platformRequests.trend}
            trendDirection="up"
            subtext={metrics.platformRequests.subtext}
            accentColor="#38bdf8"
          />

          <MetricCard
            title="Suspicious Sessions"
            value={metrics.suspiciousSessions.value}
            icon={AlertOctagon}
            trend={metrics.suspiciousSessions.trend}
            trendDirection="neutral"
            subtext={metrics.suspiciousSessions.subtext}
            accentColor="var(--severity-high)"
          />

          <MetricCard
            title="Threats Neutralized"
            value={metrics.threatsNeutralized.value}
            icon={Shield}
            trend={metrics.threatsNeutralized.trend}
            trendDirection="up"
            subtext={metrics.threatsNeutralized.subtext}
            accentColor="var(--status-success)"
          />
        </div>

        {/* Charts: Platform Traffic Trends & Deception Vectors */}
        <div className="grid-2col">
          {/* Multi-tenant Traffic & Honeynet Volume */}
          <div className="cyber-card">
            <div className="cyber-card-header">
              <div>
                <div className="cyber-card-title">
                  <Activity size={18} style={{ color: 'var(--accent-primary-light)' }} />
                  <span>Platform Ingress vs. Deceptive Decoy Diversions</span>
                </div>
                <div className="cyber-card-subtitle">
                  Aggregated requests across all 18 active tenant environments
                </div>
              </div>
              <span className="demo-tag">AGGREGATE TIME SERIES</span>
            </div>

            <div style={{ width: '100%', height: 280, marginTop: '1rem' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="adminColorIngress" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="adminColorDiverted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
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
                    dataKey="platformIngress"
                    name="Global Ingress"
                    stroke="#3b82f6"
                    fillOpacity={1}
                    fill="url(#adminColorIngress)"
                  />
                  <Area
                    type="monotone"
                    dataKey="decoyDiverted"
                    name="Diverted to Decoy"
                    stroke="#8b5cf6"
                    fillOpacity={1}
                    fill="url(#adminColorDiverted)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', marginTop: '0.75rem', fontSize: '12px', color: 'var(--text-muted)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: 10, height: 10, borderRadius: '2px', backgroundColor: '#3b82f6' }} />
                <span>Global Platform Ingress</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: 10, height: 10, borderRadius: '2px', backgroundColor: '#8b5cf6' }} />
                <span>Diverted into Deception Mesh</span>
              </div>
            </div>
          </div>

          {/* Active Deception Engagements by Vector */}
          <div className="cyber-card">
            <div className="cyber-card-header">
              <div>
                <div className="cyber-card-title">
                  <Radio size={18} style={{ color: 'var(--accent-deception)' }} />
                  <span>Deception Decoy Engagements</span>
                </div>
                <div className="cyber-card-subtitle">
                  Active interactions with deceptive surfaces
                </div>
              </div>
              <span className="demo-tag">ENGAGEMENT BY TYPE</span>
            </div>

            <div style={{ width: '100%', height: 280, marginTop: '1rem' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vectors} layout="vertical" margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
                  <XAxis type="number" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                  <YAxis type="category" dataKey="vector" stroke="var(--text-secondary)" fontSize={11} tickLine={false} width={110} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-surface-elevated)',
                      borderColor: 'var(--border-default)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '12px'
                    }}
                  />
                  <Bar dataKey="engagements" name="Engaged Sessions" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Gateway Component Health Indicators */}
        <div className="cyber-card">
          <div className="cyber-card-header">
            <div>
              <div className="cyber-card-title">
                <Cpu size={18} style={{ color: 'var(--accent-primary-light)' }} />
                <span>Gateway Core Component Health</span>
              </div>
              <div className="cyber-card-subtitle">
                Operational status of proxy nodes, detection models, and deception runners
              </div>
            </div>
            <span className="demo-tag" style={{ color: '#34d399', borderColor: 'rgba(16, 185, 129, 0.4)' }}>
              ALL 5 SUBSYSTEMS HEALTHY
            </span>
          </div>

          <div className="cyber-table-container">
            <table className="cyber-table">
              <thead>
                <tr>
                  <th>Component Subsystem</th>
                  <th>Operational Status</th>
                  <th>Cluster / Node Assignment</th>
                  <th>Processing Latency</th>
                  <th>30-Day SLA Uptime</th>
                </tr>
              </thead>
              <tbody>
                {components.map((comp) => (
                  <tr key={comp.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{comp.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Subsystem Ref: {comp.id}</div>
                    </td>
                    <td>
                      <StatusBadge status={comp.status} label="Operational" />
                    </td>
                    <td>
                      <span className="mono-tag">{comp.cluster}</span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#60a5fa' }}>
                        {comp.latency}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--status-success)' }}>
                        {comp.uptime}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent High-Severity Cross-Tenant Events */}
        <div className="cyber-card">
          <div className="cyber-card-header">
            <div>
              <div className="cyber-card-title">
                <AlertOctagon size={18} style={{ color: 'var(--severity-critical)' }} />
                <span>Platform High-Severity Threat Incidents</span>
              </div>
              <div className="cyber-card-subtitle">
                Priority security events detected across all enrolled tenants
              </div>
            </div>
            <span className="demo-tag" style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#fca5a5' }}>
              PRIORITY QUEUE
            </span>
          </div>

          <div className="cyber-table-container">
            <table className="cyber-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Tenant Organization</th>
                  <th>Target Resource</th>
                  <th>Attacker Origin</th>
                  <th>Identified Attack Vector</th>
                  <th>Deception Engine State</th>
                  <th>Severity</th>
                </tr>
              </thead>
              <tbody>
                {highSeverityEvents.map((evt) => (
                  <tr key={evt.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '12px', color: 'var(--text-muted)' }}>
                      {evt.timestamp}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{evt.tenant}</div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {evt.target}
                    </td>
                    <td>
                      <span className="mono-tag">{evt.sourceIp}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{evt.threatType}</div>
                    </td>
                    <td>
                      <StatusBadge status="diverted" label={evt.deceptionStatus} />
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

        {/* Administrative Audit Events */}
        <div className="cyber-card">
          <div className="cyber-card-header">
            <div>
              <div className="cyber-card-title">
                <FileText size={18} style={{ color: 'var(--text-muted)' }} />
                <span>Administrative Audit Trail</span>
              </div>
              <div className="cyber-card-subtitle">
                Immutable record of administrative operations and policy adjustments
              </div>
            </div>
            <span className="demo-tag">AUDIT LOG</span>
          </div>

          <div className="cyber-table-container">
            <table className="cyber-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Operator Identity</th>
                  <th>Operation Action</th>
                  <th>Target Scope</th>
                  <th>Source IP</th>
                  <th>Execution</th>
                </tr>
              </thead>
              <tbody>
                {auditEvents.map((aud) => (
                  <tr key={aud.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '12px', color: 'var(--text-muted)' }}>
                      {aud.timestamp}
                    </td>
                    <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                      {aud.adminUser}
                    </td>
                    <td>
                      <span className="mono-tag" style={{ color: '#93c5fd' }}>{aud.action}</span>
                    </td>
                    <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {aud.target}
                    </td>
                    <td>
                      <span className="mono-tag">{aud.ip}</span>
                    </td>
                    <td>
                      <StatusBadge status={aud.status} label="Executed" />
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
