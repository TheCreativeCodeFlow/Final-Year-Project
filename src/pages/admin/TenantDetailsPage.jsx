import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Users,
  ArrowLeft,
  Building,
  Shield,
  Layers,
  AlertTriangle,
  Activity,
  Server,
  Sparkles,
  Shuffle,
  Clock,
  FileText,
  Mail,
  ExternalLink
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import MetricCard from '../../components/common/MetricCard';
import StatusBadge from '../../components/common/StatusBadge';
import EmptyState from '../../components/common/EmptyState';
import LoadingState from '../../components/common/LoadingState';
import {
  getTenantById,
  getTenantApplications,
  getTenantEvents,
  getTenantAuditEvents,
  DEMO_DATA_DISCLAIMER
} from '../../services/mockData';

export default function TenantDetailsPage() {
  const { tenantId } = useParams();
  const navigate = useNavigate();

  const [tenant, setTenant] = useState(null);
  const [apps, setApps] = useState([]);
  const [events, setEvents] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    Promise.all([
      getTenantById(tenantId),
      getTenantApplications(tenantId),
      getTenantEvents(tenantId),
      getTenantAuditEvents(tenantId)
    ]).then(([foundTenant, tenantApps, tenantEvts, tenantAudits]) => {
      if (isMounted) {
        setTenant(foundTenant);
        setApps(tenantApps || []);
        setEvents(tenantEvts || []);
        setAuditLogs(tenantAudits || []);
        setLoading(false);
      }
    });

    return () => { isMounted = false; };
  }, [tenantId]);

  if (loading) {
    return (
      <div className="page-container">
        <LoadingState message={`Loading tenant environment ${tenantId}...`} />
      </div>
    );
  }

  // Handle unknown tenant ID
  if (!tenant) {
    return (
      <div className="page-container">
        <EmptyState
          title="Tenant Organization Not Found"
          description={`No tenant matches identifier "${tenantId}". The tenant ID may be mistyped or the organization has not been provisioned in the gateway matrix.`}
          actionText="Back to Tenant Directory"
          onAction={() => navigate('/admin/tenants')}
        />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={tenant.name}
        badge={tenant.id}
        description={tenant.description || `Service Tier: ${tenant.tier} • Region: ${tenant.region}`}
        actions={
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <Link to="/admin/tenants" className="btn btn-secondary btn-sm">
              <ArrowLeft size={15} />
              <span>All Tenants</span>
            </Link>
          </div>
        }
      />

      <div className="page-container" style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
        {/* Simulation Banner */}
        <div className="demo-banner">
          <Sparkles size={16} style={{ flexShrink: 0 }} />
          <div>
            <strong>Tenant Isolation Scope:</strong> {DEMO_DATA_DISCLAIMER} Displaying data strictly filtered for tenant <strong>{tenant.id}</strong>.
          </div>
        </div>

        {/* Tenant Summary Metrics */}
        <div className="metrics-grid">
          <MetricCard
            title="Enrolled Applications"
            value={`${tenant.applicationCount} Services`}
            icon={Layers}
            subtext={`${tenant.shieldedAppCount} shielded / ${tenant.monitoringAppCount} monitoring`}
            accentColor="#60a5fa"
          />

          <MetricCard
            title="Estimated Daily Volume"
            value={tenant.requestVolume}
            icon={Activity}
            subtext="Aggregated across tenant ingress routes"
            accentColor="#38bdf8"
          />

          <MetricCard
            title="Threat Incidents"
            value={tenant.threatCount}
            icon={AlertTriangle}
            subtext="Detected in last 24h"
            accentColor="var(--severity-high)"
          />

          <MetricCard
            title="Decoy Capacity"
            value={`${tenant.activeDecoys} Decoys`}
            icon={Shuffle}
            subtext={tenant.isolationProfile}
            accentColor="var(--accent-diverted)"
          />
        </div>

        {/* Technical Isolation & Tenant Profile */}
        <div className="grid-equal-2col">
          <div className="cyber-card">
            <div className="cyber-card-header">
              <div className="cyber-card-title">
                <Building size={18} style={{ color: 'var(--accent-primary-light)' }} />
                <span>Organization Identity</span>
              </div>
              <StatusBadge status={tenant.status === 'active' ? 'operational' : 'medium'} label={tenant.status} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Tenant ID</span>
                <span className="mono-tag" style={{ color: '#93c5fd' }}>{tenant.id}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Service Tier</span>
                <span style={{ fontWeight: 600 }}>{tenant.tier}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Security Contact</span>
                <span className="mono-tag">{tenant.contactEmail}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Enrolled Date</span>
                <span>{new Date(tenant.createdAt).toLocaleDateString()}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Last Activity Recorded</span>
                <span style={{ color: 'var(--text-muted)' }}>{tenant.lastActivity}</span>
              </div>
            </div>
          </div>

          <div className="cyber-card">
            <div className="cyber-card-header">
              <div className="cyber-card-title">
                <Server size={18} style={{ color: 'var(--accent-diverted)' }} />
                <span>Edge Gateway & Isolation Topology</span>
              </div>
              <span className="demo-tag">CLUSTER SPEC</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Assigned Ingress Cluster</span>
                <span className="mono-tag">{tenant.assignedIngressCluster}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Isolation Architecture</span>
                <span style={{ fontWeight: 500 }}>{tenant.isolationProfile}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Geographic Scope</span>
                <span>{tenant.region}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Environment Tier</span>
                <span className="demo-tag" style={{ color: '#6ee7b7' }}>{tenant.environmentTier}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Decoy Container Pool</span>
                <span style={{ fontWeight: 600 }}>{tenant.activeDecoys} active honeynet pods</span>
              </div>
            </div>
          </div>
        </div>

        {/* Associated Applications for This Tenant */}
        <div className="cyber-card">
          <div className="cyber-card-header">
            <div>
              <div className="cyber-card-title">
                <Layers size={18} style={{ color: 'var(--accent-primary-light)' }} />
                <span>Associated Applications ({apps.length})</span>
              </div>
              <div className="cyber-card-subtitle">
                Services registered under {tenant.name}
              </div>
            </div>
            <span className="demo-tag">{apps.length} ENROLLED</span>
          </div>

          {apps.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '1rem 0' }}>
              No applications are currently associated with this tenant.
            </p>
          ) : (
            <div className="cyber-table-container">
              <table className="cyber-table">
                <thead>
                  <tr>
                    <th>Application Name</th>
                    <th>Ingress Route</th>
                    <th>Environment</th>
                    <th>Protection Mode</th>
                    <th>Status</th>
                    <th>Throughput</th>
                    <th>Active Decoys</th>
                  </tr>
                </thead>
                <tbody>
                  {apps.map((app) => (
                    <tr key={app.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{app.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{app.id}</div>
                      </td>
                      <td>
                        <span className="mono-tag" style={{ color: '#93c5fd' }}>{app.domain}</span>
                      </td>
                      <td>
                        <span className="demo-tag" style={{ textTransform: 'capitalize' }}>{app.environment}</span>
                      </td>
                      <td style={{ fontSize: '12px' }}>{app.protectionMode}</td>
                      <td>
                        <StatusBadge status={app.status === 'shielded' ? 'operational' : 'low'} label={app.status} />
                      </td>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{app.requestsPerSec} req/s</span>
                      </td>
                      <td>
                        <span className="demo-tag" style={{ color: '#c084fc' }}>{app.activeDecoys} Decoys</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Threat Events for This Tenant */}
        <div className="cyber-card">
          <div className="cyber-card-header">
            <div>
              <div className="cyber-card-title">
                <AlertTriangle size={18} style={{ color: 'var(--severity-critical)' }} />
                <span>Recent Threat Events ({events.length})</span>
              </div>
              <div className="cyber-card-subtitle">
                Suspicious interactions detected on endpoints belonging to {tenant.name}
              </div>
            </div>
          </div>

          {events.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '1rem 0' }}>
              No active security events logged for this tenant in the current mock session.
            </p>
          ) : (
            <div className="cyber-table-container">
              <table className="cyber-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Target Application</th>
                    <th>Attacker IP</th>
                    <th>Attack Vector</th>
                    <th>Gateway Deception Action</th>
                    <th>Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((evt) => (
                    <tr key={evt.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '12px', color: 'var(--text-muted)' }}>
                        {evt.timestamp}
                      </td>
                      <td style={{ fontWeight: 500 }}>{evt.application}</td>
                      <td><span className="mono-tag">{evt.sourceIp}</span></td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{evt.vector}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{evt.category}</div>
                      </td>
                      <td><StatusBadge status="diverted" label={evt.gatewayAction} /></td>
                      <td><StatusBadge status={evt.severity} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Tenant Audit History */}
        <div className="cyber-card">
          <div className="cyber-card-header">
            <div>
              <div className="cyber-card-title">
                <FileText size={18} style={{ color: 'var(--text-muted)' }} />
                <span>Tenant Administrative History ({auditLogs.length})</span>
              </div>
              <div className="cyber-card-subtitle">
                Administrative changes affecting this tenant's policies or resources
              </div>
            </div>
          </div>

          {auditLogs.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '1rem 0' }}>
              No administrative audit events recorded for this tenant.
            </p>
          ) : (
            <div className="cyber-table-container">
              <table className="cyber-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Operator</th>
                    <th>Action</th>
                    <th>Target Resource</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((aud) => (
                    <tr key={aud.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '12px', color: 'var(--text-muted)' }}>
                        {aud.timestamp}
                      </td>
                      <td>{aud.actor || aud.adminUser}</td>
                      <td><span className="mono-tag" style={{ color: '#93c5fd' }}>{aud.action}</span></td>
                      <td style={{ fontSize: '12px' }}>{aud.target}</td>
                      <td>
                        <StatusBadge status={aud.result === 'Success' ? 'operational' : 'critical'} label={aud.result || aud.status} />
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
