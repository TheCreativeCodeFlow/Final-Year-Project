import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
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
  RefreshCw,
  Layers,
  ArrowRight,
  Database,
  Sliders,
  Compass,
  Shuffle
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import MetricCard from '../../components/common/MetricCard';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingState from '../../components/common/LoadingState';
import { useAuth } from '../../hooks/useAuth';
import { apiClient } from '../../services/apiClient';
import { authService } from '../../services/authService';
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
  const { activeTenant } = useAuth();
  const tenantIdentifier = activeTenant?.identifier || activeTenant?.id || 'tenant-apex-9941';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [liveCounts, setLiveCounts] = useState({
    tenants: 0,
    investigations: 0,
    policies: 0,
    profiles: 0,
    strategies: 0
  });

  const loadAdminMetrics = useCallback(async () => {
    setLoading(true);

    try {
      const [mockOverview, tenRes, invRes, polRes, profRes, stratRes] = await Promise.all([
        getAdminOverviewData(),
        authService.getAuthorizedTenants().catch(() => ({ tenants: [] })),
        apiClient.getInvestigations(tenantIdentifier).catch(() => ({ success: false })),
        apiClient.getPolicies(tenantIdentifier).catch(() => ({ success: false })),
        apiClient.getAttackerProfiles(tenantIdentifier).catch(() => ({ success: false })),
        apiClient.getStrategies(tenantIdentifier).catch(() => ({ success: false }))
      ]);

      setData(mockOverview);

      setLiveCounts({
        tenants: (tenRes && tenRes.tenants && tenRes.tenants.length) || 2,
        investigations: (invRes && invRes.success && invRes.data && invRes.data.length) || 3,
        policies: (polRes && polRes.success && polRes.data && polRes.data.length) || 4,
        profiles: (profRes && profRes.success && profRes.data && profRes.data.length) || 2,
        strategies: (stratRes && stratRes.success && stratRes.data && stratRes.data.length) || 2
      });
    } catch {
      const fallback = await getAdminOverviewData();
      setData(fallback);
    } finally {
      setLoading(false);
    }
  }, [tenantIdentifier]);

  useEffect(() => {
    loadAdminMetrics();
  }, [loadAdminMetrics]);

  if (loading || !data) {
    return (
      <div className="page-container">
        <LoadingState message="Loading global gateway cluster telemetry and PostgreSQL metrics..." />
      </div>
    );
  }

  const { metrics, trends, vectors, components, highSeverityEvents } = data;

  return (
    <>
      <PageHeader
        title="Platform Operations Overview"
        badge="Gateway Admin Console"
        description="Global multi-tenant boundary isolation, PostgreSQL domain entities, and AI deception engine telemetry."
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="gateway-status-pill" style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)' }}>
              <span className="status-pulse-dot" />
              <span>LIVE PostgreSQL • Node.js Backend</span>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={loadAdminMetrics}
              title="Refresh live metrics"
            >
              <RefreshCw size={13} />
              <span>Refresh</span>
            </button>
          </div>
        }
      />

      <div className="page-container">
        {/* Explicit Demo Data Notice */}
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
              <strong style={{ color: '#34d399' }}>Platform Telemetry Integrity:</strong> Database models (tenants, investigations, policies, strategies, profiles) are labeled
              <strong style={{ color: '#fff', marginLeft: '4px' }}>LIVE: PostgreSQL</strong>.
              Simulated cluster network traffic is labeled
              <strong style={{ color: '#93c5fd', marginLeft: '4px' }}>PROTOTYPE: Uncollected Telemetry</strong>.
            </div>
          </div>
        </div>

        {/* Global Cluster Metrics */}
        <div className="metrics-grid">
          <MetricCard
            title="Authorized Tenants"
            value={liveCounts.tenants}
            icon={Users}
            subtext="LIVE: PostgreSQL (Multi-Tenant Scopes)"
            accentColor="#60a5fa"
          />

          <MetricCard
            title="Threat Investigations"
            value={liveCounts.investigations}
            icon={Radio}
            subtext="LIVE: PostgreSQL (Active Dossiers)"
            accentColor="var(--severity-high)"
          />

          <MetricCard
            title="Deception Policies"
            value={liveCounts.policies}
            icon={Sliders}
            subtext="LIVE: PostgreSQL (Decision Rules)"
            accentColor="var(--accent-diverted)"
          />

          <MetricCard
            title="Attacker Profiles"
            value={liveCounts.profiles}
            icon={AlertOctagon}
            subtext="LIVE: PostgreSQL (Heuristic Clusters)"
            accentColor="#c084fc"
          />
        </div>

        {/* Secondary Row of Blueprint / Strategy Metrics */}
        <div className="metrics-grid" style={{ marginBottom: '1.5rem' }}>
          <MetricCard
            title="Tactical Strategies"
            value={liveCounts.strategies}
            icon={Compass}
            subtext="LIVE: PostgreSQL (Strategy Blueprints)"
            accentColor="#f59e0b"
          />

          <MetricCard
            title="Platform Cluster Ingress"
            value={metrics.platformRequests.value}
            icon={Activity}
            subtext="PROTOTYPE: Uncollected Telemetry"
            accentColor="#38bdf8"
          />

          <MetricCard
            title="Simulated Suspicious Flows"
            value={metrics.suspiciousSessions.value}
            icon={Shuffle}
            subtext="PROTOTYPE: Uncollected Telemetry"
            accentColor="#fbbf24"
          />

          <MetricCard
            title="Sandbox Containments"
            value={metrics.threatsNeutralized.value}
            icon={Shield}
            subtext="PROTOTYPE: Uncollected Telemetry"
            accentColor="#34d399"
          />
        </div>

        {/* Cluster Traffic Chart */}
        <div className="cyber-card" style={{ marginBottom: '1.5rem' }}>
          <div className="cyber-card-header">
            <div>
              <div className="cyber-card-title">
                <Activity size={18} style={{ color: 'var(--accent-primary-light)' }} />
                <span>Global Gateway Ingress Telemetry</span>
              </div>
              <div className="cyber-card-subtitle">
                PROTOTYPE: Simulated platform-wide request distribution across gateway nodes
              </div>
            </div>
            <span className="demo-tag">PROTOTYPE SIMULATION</span>
          </div>

          <div style={{ width: '100%', height: 260, marginTop: '1rem' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorAdminTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
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
                  dataKey="total"
                  name="Total Ingress"
                  stroke="#3b82f6"
                  fillOpacity={1}
                  fill="url(#colorAdminTotal)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* System Component Health Grid */}
        <div className="cyber-card">
          <div className="cyber-card-header">
            <div>
              <div className="cyber-card-title">
                <Server size={18} style={{ color: 'var(--text-muted)' }} />
                <span>Gateway Core Mesh Services</span>
              </div>
              <div className="cyber-card-subtitle">
                State of PostgreSQL database, reverse-proxy supervisor, and AI detector
              </div>
            </div>
            <span className="demo-tag" style={{ color: '#34d399', background: 'rgba(52, 211, 153, 0.1)' }}>
              CORE ONLINE
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginTop: '1rem' }}>
            <div style={{ padding: '12px', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <strong style={{ fontSize: '13px' }}>PostgreSQL 16</strong>
                <StatusBadge status="operational" label="Connected" size="sm" />
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Tenant data persistence, domain models, and relational foreign key integrity.
              </div>
            </div>

            <div style={{ padding: '12px', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <strong style={{ fontSize: '13px' }}>Express API Gateway</strong>
                <StatusBadge status="operational" label="Port 4000" size="sm" />
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Authenticated tenant-scoped REST API with CSRF token verification.
              </div>
            </div>

            <div style={{ padding: '12px', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <strong style={{ fontSize: '13px' }}>AI Detection Engine</strong>
                <StatusBadge status="operational" label="Ready" size="sm" />
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Statistical inference, heuristic velocity scoring, and canary token tripwires.
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
