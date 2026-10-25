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
  Server
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import MetricCard from '../../components/common/MetricCard';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingState from '../../components/common/LoadingState';
import EmptyState from '../../components/common/EmptyState';
import {
  getApplicationById,
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

  const [app, setApp] = useState(null);
  const [trafficData, setTrafficData] = useState([]);
  const [appEvents, setAppEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    Promise.all([
      getApplicationById(applicationId),
      getApplicationTraffic(applicationId),
      getSecurityEvents({ applicationId })
    ]).then(([foundApp, traffic, events]) => {
      if (isMounted) {
        setApp(foundApp);
        setTrafficData(traffic);
        setAppEvents(events);
        setLoading(false);
      }
    });

    return () => { isMounted = false; };
  }, [applicationId]);

  if (loading) {
    return (
      <div className="page-container">
        <LoadingState message={`Loading telemetry for application ${applicationId}...`} />
      </div>
    );
  }

  // Not found state handling
  if (!app) {
    return (
      <div className="page-container">
        <EmptyState
          title="Application Not Found"
          description={`No registered application exists with identifier "${applicationId}". It may have been unlinked or the identifier is invalid.`}
          actionText="Return to Applications"
          onAction={() => navigate('/owner/applications')}
        />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={app.name}
        badge={app.id}
        description={app.description}
        actions={
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <Link to="/owner/applications" className="btn btn-secondary btn-sm">
              <ArrowLeft size={15} />
              <span>All Applications</span>
            </Link>
            <Link to={`/owner/applications/new?edit=${app.id}`} className="btn btn-primary btn-sm">
              <Edit2 size={14} />
              <span>Edit Configuration</span>
            </Link>
          </div>
        }
      />

      <div className="page-container">
        {/* Simulation Banner */}
        <div className="demo-banner">
          <Sparkles size={16} style={{ flexShrink: 0 }} />
          <div>
            <strong>Simulated Telemetry View:</strong> {DEMO_DATA_DISCLAIMER} Ingress and threat metrics are synthetic indicators.
          </div>
        </div>

        {/* Application Metrics Summary */}
        <div className="metrics-grid">
          <MetricCard
            title="Ingress Throughput"
            value={`${app.requestsPerSec} req/s`}
            icon={Activity}
            trend="+5.2%"
            trendDirection="up"
            subtext={app.requestVolume}
            accentColor="#38bdf8"
          />

          <MetricCard
            title="Threat Incidents"
            value={app.threatCount}
            icon={AlertTriangle}
            trend={app.threatIndex}
            trendDirection={app.threatIndex === 'Elevated' ? 'down' : 'neutral'}
            subtext="Classified in last 24h"
            accentColor="var(--severity-high)"
          />

          <MetricCard
            title="Active Decoys"
            value={`${app.activeDecoys} Decoys`}
            icon={Shuffle}
            subtext={app.protectionMode}
            accentColor="var(--accent-diverted)"
          />

          <MetricCard
            title="Gateway Status"
            value={app.status.toUpperCase()}
            icon={ShieldCheck}
            subtext={`Environment: ${app.environment}`}
            accentColor="var(--status-success)"
          />
        </div>

        {/* Identity & Technical Routing Specification */}
        <div className="grid-equal-2col">
          {/* Identity & Config Card */}
          <div className="cyber-card">
            <div className="cyber-card-header">
              <div className="cyber-card-title">
                <Layers size={18} style={{ color: 'var(--accent-primary-light)' }} />
                <span>Service Specification</span>
              </div>
              <StatusBadge status={app.status === 'shielded' ? 'operational' : 'low'} label={app.status} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Public Hostname / Domain</span>
                <span className="mono-tag" style={{ color: '#93c5fd' }}>{app.domain}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Ingress Path Route</span>
                <span className="mono-tag">{app.route}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Upstream Destination</span>
                <span className="mono-tag">{app.upstreamUrl}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Environment Tier</span>
                <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{app.environment}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Deception Mode</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{app.protectionMode}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Associated Tags</span>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {app.tags && app.tags.map(t => (
                    <span key={t} className="demo-tag" style={{ fontSize: '10px' }}>{t}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Simulated Gateway Mesh Health */}
          <div className="cyber-card">
            <div className="cyber-card-header">
              <div className="cyber-card-title">
                <Server size={18} style={{ color: 'var(--accent-diverted)' }} />
                <span>Simulated Ingress Integration</span>
              </div>
              <span className="demo-tag">MOCK CONNECTOR</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '13px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>DNS CNAME Delegation</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{app.cnameTarget}</div>
                </div>
                <StatusBadge status="operational" label="Verified" />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>Decoy Mesh Injection Filter</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{app.activeDecoys} containerized honeypots attached</div>
                </div>
                <StatusBadge status="operational" label="Active" />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>TLS Termination Certificate</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Wildcard RSA 4096 (Simulated Gateway Edge)</div>
                </div>
                <StatusBadge status="operational" label="Valid" />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>Canary Header Detection</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>X-Canary-Session cookie interceptor</div>
                </div>
                <StatusBadge status="operational" label="Armed" />
              </div>
            </div>
          </div>
        </div>

        {/* Traffic Ingress vs Diverted Chart */}
        <div className="cyber-card">
          <div className="cyber-card-header">
            <div>
              <div className="cyber-card-title">
                <Activity size={18} style={{ color: 'var(--accent-primary-light)' }} />
                <span>Traffic Profile & Deceptive Interception</span>
              </div>
              <div className="cyber-card-subtitle">
                Hourly throughput and attacker diversions for {app.name}
              </div>
            </div>
            <span className="demo-tag">LAST 24 HOURS</span>
          </div>

          <div style={{ width: '100%', height: 260, marginTop: '0.5rem' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trafficData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="appTotalTraffic" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="appDivertedTraffic" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
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
                  dataKey="requests"
                  name="Ingress Requests"
                  stroke="#3b82f6"
                  fillOpacity={1}
                  fill="url(#appTotalTraffic)"
                />
                <Area
                  type="monotone"
                  dataKey="diverted"
                  name="Diverted to Decoys"
                  stroke="#06b6d4"
                  fillOpacity={1}
                  fill="url(#appDivertedTraffic)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Security Events for this specific Application */}
        <div className="cyber-card">
          <div className="cyber-card-header">
            <div>
              <div className="cyber-card-title">
                <Shuffle size={18} style={{ color: 'var(--accent-diverted)' }} />
                <span>Associated Security & Deception Events</span>
              </div>
              <div className="cyber-card-subtitle">
                Targeted attack vectors detected and handled for this endpoint
              </div>
            </div>

            <Link
              to={`/owner/events?appId=${app.id}`}
              className="btn btn-secondary btn-sm"
            >
              <span>View In Security Events Explorer →</span>
            </Link>
          </div>

          {appEvents.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '1rem 0' }}>
              No threat events logged for this application in the current mock session.
            </p>
          ) : (
            <div className="cyber-table-container">
              <table className="cyber-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Attacker IP</th>
                    <th>Vector / Attack Category</th>
                    <th>Gateway Deception Action</th>
                    <th>Severity</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {appEvents.map((evt) => (
                    <tr key={evt.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '12px', color: 'var(--text-muted)' }}>
                        {evt.timestamp}
                      </td>
                      <td>
                        <span className="mono-tag">{evt.sourceIp}</span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{evt.vector}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{evt.category}</div>
                      </td>
                      <td>
                        <StatusBadge status="diverted" label={evt.gatewayAction} />
                      </td>
                      <td>
                        <StatusBadge status={evt.severity} />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Link to={`/owner/events/${evt.id}`} className="btn btn-ghost btn-sm">
                          <span>Inspect →</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
