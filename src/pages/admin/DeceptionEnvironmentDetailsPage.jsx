import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Network,
  Shield,
  Layers,
  GitBranch,
  ExternalLink,
  AlertTriangle,
  Server,
  Activity,
  AlertCircle,
  Clock,
  Radio,
  FileText,
  Database,
  Lock,
  User,
  Zap,
  Globe,
  Compass,
  CheckCircle2,
  Cpu
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingState from '../../components/common/LoadingState';
import MetricCard from '../../components/common/MetricCard';
import {
  getDeceptionEnvironmentById,
  getSyntheticAssets,
  getDeceptionRelationships,
  getInvestigationById,
  getSecurityEventById,
  DEMO_DATA_DISCLAIMER
} from '../../services/mockData';

export default function DeceptionEnvironmentDetailsPage() {
  const { environmentId } = useParams();

  const [environment, setEnvironment] = useState(null);
  const [assets, setAssets] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [linkedInvestigations, setLinkedInvestigations] = useState([]);
  const [correlatedEvents, setCorrelatedEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getDeceptionEnvironmentById(environmentId).then(async (env) => {
      setEnvironment(env);
      if (env) {
        const [astList, relList] = await Promise.all([
          getSyntheticAssets(env.id),
          getDeceptionRelationships(env.id)
        ]);
        setAssets(astList);
        setRelationships(relList);

        // Fetch linked investigations
        if (env.linkedInvestigationIds?.length > 0) {
          const invPromises = env.linkedInvestigationIds.map(id => getInvestigationById(id));
          const invResults = await Promise.all(invPromises);
          setLinkedInvestigations(invResults.filter(Boolean));
        } else {
          setLinkedInvestigations([]);
        }

        // Fetch correlated events
        if (env.associatedEventIds?.length > 0) {
          const evtPromises = env.associatedEventIds.map(id => getSecurityEventById(id));
          const evtResults = await Promise.all(evtPromises);
          setCorrelatedEvents(evtResults.filter(Boolean));
        } else {
          setCorrelatedEvents([]);
        }
      }
      setLoading(false);
    });
  }, [environmentId]);

  if (loading) {
    return (
      <div className="page-container">
        <LoadingState message={`Loading deception environment ${environmentId}...`} />
      </div>
    );
  }

  // Not Found State
  if (!environment) {
    return (
      <div className="page-container">
        <div style={{ marginBottom: '1.5rem' }}>
          <Link
            to="/admin/deception-environments"
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <ArrowLeft size={14} />
            <span>Back to Environments Directory</span>
          </Link>
        </div>

        <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
              color: 'var(--severity-critical)'
            }}
          >
            <AlertTriangle size={28} />
          </div>
          <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
            Deception Environment Not Found
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto 1.5rem' }}>
            No deception environment exists with identifier <code style={{ color: 'var(--accent-primary-light)' }}>{environmentId}</code>.
          </p>
          <Link to="/admin/deception-environments" className="btn btn-primary">
            Return to Environments Directory
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Back button and Header */}
      <div style={{ marginBottom: '1rem' }}>
        <Link
          to="/admin/deception-environments"
          className="btn btn-secondary btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <ArrowLeft size={14} />
          <span>Back to Deception Environments</span>
        </Link>
      </div>

      <PageHeader
        title={environment.name}
        description={`Synthetic Decoy Sandbox: ${environment.type} — Isolation: ${environment.isolationProfile}`}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <StatusBadge
              status={
                environment.status === 'Active'
                  ? 'operational'
                  : environment.status === 'Review Required'
                  ? 'warning'
                  : 'neutral'
              }
              label={`${environment.status} (Simulated)`}
              size="md"
            />
            <Link
              to={`/admin/deception-state-graph/${environment.id}`}
              className="btn btn-primary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <GitBranch size={14} />
              <span>Explore Deception State Graph</span>
            </Link>
          </div>
        }
      />

      {/* Simulated Demonstration Banner */}
      <div
        style={{
          background: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          borderRadius: 'var(--radius-md)',
          padding: '0.75rem 1rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}
      >
        <AlertCircle size={16} color="var(--accent-primary-light)" style={{ flexShrink: 0 }} />
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
          <strong style={{ color: 'var(--text-primary)' }}>SIMULATION NOTICE:</strong> All synthetic endpoints, credentials, and topology relationships are demonstration artifacts. Live honeynet execution and network packet routing are not active.
        </div>
      </div>

      {/* Section A: Environment Overview Card */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3
          style={{
            fontSize: 'var(--text-md)',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Compass size={18} color="var(--accent-primary-light)" />
          <span>Environment Topology & Configuration</span>
        </h3>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1.25rem'
          }}
        >
          {/* Tenant Context */}
          <div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '4px' }}>Tenant Organization</div>
            <Link
              to={`/admin/tenants/${environment.tenantId}`}
              style={{
                fontSize: 'var(--text-base)',
                fontWeight: 600,
                color: 'var(--accent-primary-light)',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <span>{environment.tenantName}</span>
              <ExternalLink size={12} />
            </Link>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
              {environment.tenantId}
            </div>
          </div>

          {/* Associated Application */}
          <div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '4px' }}>Protected Application</div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
              {environment.applicationName || 'Multi-application Cluster'}
            </div>
            {environment.applicationId && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {environment.applicationId}
              </div>
            )}
          </div>

          {/* Cluster Node & Namespace */}
          <div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '4px' }}>Sandbox Execution Pod</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              {environment.clusterNode}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              {environment.isolationProfile}
            </div>
          </div>

          {/* Simulated Strategy */}
          <div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '4px' }}>Simulated Deception Strategy</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--accent-deception)', fontWeight: 600 }}>
              {environment.simulatedStrategy}
            </div>
          </div>

          {/* Asset Count & Type */}
          <div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '4px' }}>Decoy Architecture</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
              <strong>{environment.activeAssetCount}</strong> Synthetic Assets • <strong>{relationships.length}</strong> Directed Edges
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Type: {environment.type}
            </div>
          </div>

          {/* Timestamps */}
          <div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '4px' }}>Configuration Updates</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
              Last: <strong>{environment.lastUpdateHuman}</strong>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Created: {environment.createdAt.slice(0, 10)}
            </div>
          </div>
        </div>

        {/* Narrative Description */}
        <div
          style={{
            marginTop: '1.25rem',
            padding: '0.875rem 1rem',
            background: 'var(--bg-surface-elevated)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)'
          }}
        >
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
            ENVIRONMENT PURPOSE & SPECIFICATION
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', lineHeight: 1.5 }}>
            {environment.description}
          </div>
        </div>
      </div>

      {/* Section C: Environment Relationship Summary & DSG Shortcut */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h3
              style={{
                fontSize: 'var(--text-md)',
                fontWeight: 600,
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <GitBranch size={18} color="var(--accent-primary-light)" />
              <span>Deception State Graph Relationships Summary</span>
            </h3>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Coherent synthetic topology linking decoy entry points, credentials, databases, and canary tripwires.
            </p>
          </div>

          <Link
            to={`/admin/deception-state-graph/${environment.id}`}
            className="btn btn-primary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <span>Open Interactive DSG Graph →</span>
          </Link>
        </div>

        {/* Relationships Table */}
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-default)' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Source Asset</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Relationship</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Target Asset</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>DSG Layer</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Architectural Semantics</th>
              </tr>
            </thead>
            <tbody>
              {relationships.map((rel) => {
                const srcAsset = assets.find(a => a.id === rel.source);
                const tgtAsset = assets.find(a => a.id === rel.target);
                return (
                  <tr key={rel.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '10px 12px', fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                      <strong>{srcAsset?.name || rel.source}</strong>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{rel.source}</div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-xs)',
                          background: rel.type === 'MONITORS' ? 'rgba(244, 63, 94, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                          color: rel.type === 'MONITORS' ? 'var(--severity-critical)' : 'var(--accent-primary-light)'
                        }}
                      >
                        {rel.type}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                      <strong>{tgtAsset?.name || rel.target}</strong>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{rel.target}</div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                        {rel.dsgLayer === 'immutable_policy'
                          ? 'L1: Policy'
                          : rel.dsgLayer === 'controlled_dynamic'
                          ? 'L2: Dynamic'
                          : 'L3: Attacker'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                      {rel.notes}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section B: Synthetic Assets Inventory */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3
          style={{
            fontSize: 'var(--text-md)',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Layers size={18} color="var(--accent-primary-light)" />
          <span>Synthetic Assets Inventory ({assets.length})</span>
        </h3>

        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
          Configured synthetic resources emulated within this environment. All values, tokens, and schemas are purely fictional.
        </p>

        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-default)' }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Asset Name / ID</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Asset Type</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Simulated State</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>DSG Layer</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Fictional Technical Details</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <tr key={asset.id} style={{ borderBottom: '1px solid var(--border-subtle)' }} className="table-row-hover">
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>
                      {asset.name}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent-primary-light)' }}>
                      {asset.id}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {asset.description}
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-xs)',
                        background: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-primary)'
                      }}
                    >
                      {asset.type.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <StatusBadge
                      status={
                        asset.simulatedState === 'Active'
                          ? 'operational'
                          : asset.simulatedState === 'Engaged'
                          ? 'diverted'
                          : asset.simulatedState === 'Triggered'
                          ? 'critical'
                          : 'warning'
                      }
                      label={asset.simulatedState}
                      size="sm"
                    />
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      {asset.dsgLayer === 'immutable_policy'
                        ? 'L1: Policy'
                        : asset.dsgLayer === 'controlled_dynamic'
                        ? 'L2: Dynamic'
                        : 'L3: Attacker'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {Object.entries(asset.fictionalDetails || {}).map(([k, v]) => (
                        <div key={k}>
                          <span style={{ color: 'var(--text-muted)' }}>{k}: </span>
                          <span style={{ color: 'var(--text-primary)' }}>{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section D: Linked Investigations & Forensics */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <h3
          style={{
            fontSize: 'var(--text-md)',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Radio size={18} color="var(--accent-primary-light)" />
          <span>Correlated Investigations & Incident Traps</span>
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
          {linkedInvestigations.length > 0 ? (
            linkedInvestigations.map((inv) => (
              <div
                key={inv.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.875rem 1rem'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                    <Link
                      to={`/admin/investigations/${inv.id}`}
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 600,
                        color: 'var(--accent-primary-light)',
                        textDecoration: 'none'
                      }}
                    >
                      {inv.id}
                    </Link>
                    <StatusBadge status={inv.severity} label={inv.severity.toUpperCase()} size="sm" />
                    <StatusBadge status={inv.status === 'Open' ? 'active' : 'neutral'} label={inv.status} size="sm" />
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                    {inv.attackCategory} — {inv.observedBehaviorSummary}
                  </div>
                </div>

                <Link to={`/admin/investigations/${inv.id}`} className="btn btn-secondary btn-sm">
                  <span>Inspect Incident</span>
                </Link>
              </div>
            ))
          ) : (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.5rem 0' }}>
              No active threat investigations currently linked to this deception environment.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
