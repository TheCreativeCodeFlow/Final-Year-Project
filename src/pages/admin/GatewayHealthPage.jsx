import React, { useState, useEffect } from 'react';
import {
  Server,
  Activity,
  Cpu,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Shield,
  Layers,
  Info,
  Sliders
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingState from '../../components/common/LoadingState';
import { getGatewayHealthComponents, DEMO_DATA_DISCLAIMER } from '../../services/mockData';

export default function GatewayHealthPage() {
  const [components, setComponents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    getGatewayHealthComponents().then((res) => {
      if (isMounted) {
        setComponents(res);
        setLoading(false);
      }
    });

    return () => { isMounted = false; };
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="page-container">
        <LoadingState message="Checking gateway cluster component status..." />
      </div>
    );
  }

  const healthyCount = components.filter(c => c.status === 'healthy').length;

  return (
    <>
      <PageHeader
        title="Gateway Component Health"
        badge="Platform Cluster Runtime"
        description="Health metrics, latency distributions, and operational state across all core gateway subsystems."
        actions={
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <div className="gateway-status-pill" style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)' }}>
              <span className="status-pulse-dot" />
              <span>{healthyCount}/{components.length} Subsystems Healthy</span>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setRefreshKey(k => k + 1)}
              title="Refresh component health probes"
            >
              <RefreshCw size={13} />
              <span>Re-check Probes</span>
            </button>
          </div>
        }
      />

      <div className="page-container" style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
        {/* Simulation Scope & Fail-Safe Architecture Warning Banner */}
        <div className="demo-banner">
          <Sparkles size={16} style={{ flexShrink: 0 }} />
          <div>
            <strong>Simulated Operational Probes:</strong> {DEMO_DATA_DISCLAIMER} Probe responses and latencies reflect simulated benchmark scenarios.
          </div>
        </div>

        {/* Fail-Safe Architectural Guidance Notice */}
        <div className="demo-banner demo-banner-warning" style={{ alignItems: 'flex-start' }}>
          <Info size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '12px', lineHeight: 1.5 }}>
            <strong>Fail-Safe Gateway Architecture Principle:</strong> In production deployment, if the Behavioral Detection Service or Deception Orchestrator experiences degradation, the reverse proxy must enforce an explicit <em>fail-secure policy</em> (e.g. rate-limiting, mandatory re-authentication, or containment) rather than indiscriminately forwarding uninspected traffic to protected origins.
          </div>
        </div>

        {/* Overall Cluster Summary Card */}
        <div className="cyber-card">
          <div className="cyber-card-header">
            <div className="cyber-card-title">
              <Server size={18} style={{ color: 'var(--accent-primary-light)' }} />
              <span>Gateway Platform Health Matrix</span>
            </div>
            <span className="demo-tag" style={{ color: '#34d399', borderColor: 'rgba(16, 185, 129, 0.4)' }}>
              ALL CORE PROBES NOMINAL
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            background: 'var(--bg-surface)',
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            fontSize: '13px'
          }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>INGRESS EDGE LATENCY</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#38bdf8', marginTop: '2px' }}>0.8 ms</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>L7 Envoy Proxy P99</div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>AI INFERENCE LATENCY</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#60a5fa', marginTop: '2px' }}>3.2 ms</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Transformer sequence score</div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>DECOY POD ALLOCATION</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#c084fc', marginTop: '2px' }}>66 / 80</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Containers provisioned</div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>30-DAY PLATFORM UPTIME</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#34d399', marginTop: '2px' }}>99.98%</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>SLA target exceeded</div>
            </div>
          </div>
        </div>

        {/* Detailed Component Probes List */}
        <div className="cyber-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="cyber-table-container" style={{ border: 'none' }}>
            <table className="cyber-table">
              <thead>
                <tr>
                  <th>Component Subsystem</th>
                  <th>Subsystem Role</th>
                  <th>Operational Status</th>
                  <th>Last Probe</th>
                  <th>Processing Latency</th>
                  <th>24h Errors</th>
                  <th>30d SLA</th>
                </tr>
              </thead>
              <tbody>
                {components.map((comp) => (
                  <tr key={comp.id}>
                    {/* Name & Cluster */}
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{comp.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                        <span className="mono-tag" style={{ fontSize: '10px' }}>{comp.cluster}</span>
                        <span>• Ref: {comp.id}</span>
                      </div>
                    </td>

                    {/* Role / Subsystem */}
                    <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {comp.subsystem}
                    </td>

                    {/* Status */}
                    <td>
                      <StatusBadge status={comp.status === 'healthy' ? 'operational' : comp.status} label={comp.status} />
                    </td>

                    {/* Last Probe */}
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {comp.lastHealthCheck}
                    </td>

                    {/* Latency */}
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#60a5fa' }}>
                        {comp.latency}
                      </span>
                    </td>

                    {/* Errors */}
                    <td>
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '12px',
                        color: comp.errorCount24h === 0 ? 'var(--status-success)' : 'var(--severity-medium)'
                      }}>
                        {comp.errorCount24h} errors
                      </span>
                    </td>

                    {/* SLA */}
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

        {/* Component Descriptions & Failover Architecture Card */}
        <div className="cyber-card">
          <div className="cyber-card-header">
            <div className="cyber-card-title">
              <Sliders size={18} style={{ color: 'var(--text-muted)' }} />
              <span>Subsystem Operational Responsibility</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', fontSize: '12px' }}>
            {components.map((comp) => (
              <div key={comp.id} style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '0.85rem'
              }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  {comp.name}
                </div>
                <p style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {comp.summary}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
