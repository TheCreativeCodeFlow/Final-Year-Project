import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Shield,
  ShieldAlert,
  AlertTriangle,
  Clock,
  Layers,
  Building,
  User,
  Radio,
  FileText,
  AlertCircle,
  ExternalLink,
  Shuffle,
  Activity,
  CheckCircle2,
  Lock,
  GitBranch,
  Terminal,
  Database,
  Search,
  EyeOff
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingState from '../../components/common/LoadingState';
import MetricCard from '../../components/common/MetricCard';
import {
  getAttackerProfileById,
  getInvestigationById,
  getSecurityEventById,
  DEMO_DATA_DISCLAIMER
} from '../../services/mockData';

export default function AttackerProfileDetailsPage() {
  const { profileId } = useParams();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [linkedInvestigations, setLinkedInvestigations] = useState([]);
  const [correlatedEvents, setCorrelatedEvents] = useState([]);

  useEffect(() => {
    setLoading(true);
    getAttackerProfileById(profileId).then(async (prof) => {
      setProfile(prof);
      if (prof) {
        // Fetch linked investigations
        if (prof.linkedInvestigationIds?.length > 0) {
          const invPromises = prof.linkedInvestigationIds.map(id => getInvestigationById(id));
          const invResults = await Promise.all(invPromises);
          setLinkedInvestigations(invResults.filter(Boolean));
        } else {
          setLinkedInvestigations([]);
        }

        // Fetch correlated events
        if (prof.associatedEventIds?.length > 0) {
          const evtPromises = prof.associatedEventIds.map(id => getSecurityEventById(id));
          const evtResults = await Promise.all(evtPromises);
          setCorrelatedEvents(evtResults.filter(Boolean));
        } else {
          setCorrelatedEvents([]);
        }
      }
      setLoading(false);
    });
  }, [profileId]);

  if (loading) {
    return (
      <div className="page-container">
        <LoadingState message={`Loading attacker profile ${profileId}...`} />
      </div>
    );
  }

  // Not Found State
  if (!profile) {
    return (
      <div className="page-container">
        <div style={{ marginBottom: '1.5rem' }}>
          <Link
            to="/admin/attacker-profiles"
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <ArrowLeft size={14} />
            <span>Back to Profile Directory</span>
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
            Attacker Profile Not Found
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto 1.5rem' }}>
            No behavioral profile exists with identifier <code style={{ color: 'var(--accent-primary-light)' }}>{profileId}</code>.
          </p>
          <Link to="/admin/attacker-profiles" className="btn btn-primary">
            Return to Profiles Directory
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
          to="/admin/attacker-profiles"
          className="btn btn-secondary btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <ArrowLeft size={14} />
          <span>Back to Profile Directory</span>
        </Link>
      </div>

      <PageHeader
        title={`Profile: ${profile.id}`}
        description={`Observed behavioral clustering for ${profile.tenantName} — Classification: ${profile.behavioralClassification}`}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: 'var(--radius-pill)',
                background:
                  profile.behavioralClassification === 'Decoy interaction observed'
                    ? 'rgba(139, 92, 246, 0.15)'
                    : profile.behavioralClassification === 'Repeated authentication failures'
                    ? 'rgba(239, 68, 68, 0.15)'
                    : profile.behavioralClassification === 'Multiple suspicious indicators'
                    ? 'rgba(249, 115, 22, 0.15)'
                    : 'rgba(100, 116, 139, 0.15)',
                color:
                  profile.behavioralClassification === 'Decoy interaction observed'
                    ? 'var(--accent-deception)'
                    : profile.behavioralClassification === 'Repeated authentication failures'
                    ? 'var(--severity-critical)'
                    : profile.behavioralClassification === 'Multiple suspicious indicators'
                    ? 'var(--severity-high)'
                    : 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)'
              }}
            >
              {profile.behavioralClassification}
            </span>
          </div>
        }
      />

      {/* Attribution Disclaimer Banner */}
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
          <strong style={{ color: 'var(--text-primary)' }}>BEHAVIORAL ATTRIBUTION DISCLAIMER:</strong> This profile represents heuristic session correlations. It does NOT constitute legal attribution, biometric identity, or ground truth.
        </div>
      </div>

      {/* Section A: Profile Summary Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}
      >
        <MetricCard
          title="Observed Requests"
          value={profile.observedRequestCount}
          subtext={`First seen ${profile.firstSeen}`}
          icon={Activity}
        />
        <MetricCard
          title="Auth Failures"
          value={profile.observedAuthFailures}
          subtext="Credential anomalies"
          icon={Lock}
        />
        <MetricCard
          title="Distinct Endpoints"
          value={profile.distinctEndpointCount}
          subtext="Target URL scope"
          icon={Layers}
        />
        <MetricCard
          title="Decoy Engagements"
          value={profile.decoyInteractionCount}
          subtext={profile.decoyInteractionCount > 0 ? "Interacted with honeynet" : "No honeynet activity"}
          icon={Shuffle}
        />
      </div>

      {/* Target Tenant & Sessions Context Card */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '1.25rem'
          }}
        >
          {/* Tenant */}
          <div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '4px' }}>Tenant Context</div>
            <Link
              to={`/admin/tenants/${profile.tenantId}`}
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
              <span>{profile.tenantName}</span>
              <ExternalLink size={12} />
            </Link>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
              {profile.tenantId}
            </div>
          </div>

          {/* Associated Sessions */}
          <div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '4px' }}>Associated Ingress Sessions</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {profile.sessionIdentifiers?.map((s, i) => (
                <span
                  key={i}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    color: 'var(--text-primary)',
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-default)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-xs)'
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>

          {/* Target Apps */}
          <div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '4px' }}>Target Applications</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {profile.applicationNames?.map((app, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-primary)',
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-xs)'
                  }}
                >
                  {app}
                </span>
              ))}
            </div>
          </div>

          {/* Timestamps */}
          <div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '4px' }}>Activity Window</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
              Last Seen: <strong>{profile.lastSeen}</strong>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              First Seen: {profile.firstSeen}
            </div>
          </div>
        </div>
      </div>

      {/* Section B: Activity Timeline (Phase Progression) */}
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
          <Clock size={18} color="var(--accent-primary-light)" />
          <span>Behavioral Progression & Phase Transitions</span>
        </h3>

        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
          Chronological record illustrating how observed activity shifted across attack lifecycle phases.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {profile.behaviorHistory?.map((phase, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.875rem 1rem'
              }}
            >
              <div
                style={{
                  background: 'rgba(37, 99, 235, 0.15)',
                  color: 'var(--accent-primary-light)',
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-xs)',
                  fontSize: '11px',
                  fontWeight: 600,
                  whiteSpace: 'nowrap'
                }}
              >
                Phase {idx + 1}: {phase.phase}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', marginBottom: '2px' }}>
                  {phase.observation}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {phase.timestamp}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section C: Behavioral Indicators */}
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
          <Activity size={18} color="var(--accent-primary-light)" />
          <span>Behavioral Indicators & Observations</span>
        </h3>

        <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-default)' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Indicator</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Supporting Observations</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Occurrences</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Time Range</th>
              </tr>
            </thead>
            <tbody>
              {profile.behavioralIndicators?.map((ind, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '10px 12px', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {ind.indicator}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                    {ind.supportingObservations}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--accent-primary-light)' }}>
                    {ind.observationCount}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {ind.timeRange}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section F: Deception Interaction History */}
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
          <Shuffle size={18} color="var(--accent-deception)" />
          <span>Deception Interaction History</span>
        </h3>

        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
          Interactions with synthetic decoys, canary credentials, and sandboxed honeypot containers.
        </p>

        {profile.decoyInteractionCount > 0 && profile.deceptionInteractions?.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {profile.deceptionInteractions.map((decoy, idx) => (
              <div
                key={idx}
                style={{
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '1rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--accent-deception)' }}>
                    {decoy.decoyType}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {decoy.timestamp}
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '0.75rem',
                    fontSize: '11px',
                    marginTop: '8px'
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Target Endpoint: </span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{decoy.targetEndpoint}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Canary Hit: </span>
                    <span style={{ color: decoy.canaryHit.includes('None') ? 'var(--text-secondary)' : 'var(--severity-critical)', fontWeight: 500 }}>
                      {decoy.canaryHit}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Dwell Time: </span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{decoy.dwellTime}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Synthetic Response: </span>
                    <span style={{ color: 'var(--text-secondary)' }}>{decoy.fakeResponseStatus}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              padding: '2rem 1.5rem',
              textAlign: 'center',
              background: 'var(--bg-surface-elevated)',
              border: '1px dashed var(--border-default)',
              borderRadius: 'var(--radius-sm)'
            }}
          >
            <EyeOff size={28} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem' }} />
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
              No Decoy Interactions Recorded
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', maxWidth: '440px', margin: '0 auto' }}>
              This profile has not triggered synthetic decoy routes or honeytokens. All observed activity was confined to public or rejected edge endpoints without honeynet diversion.
            </div>
          </div>
        )}
      </div>

      {/* Section D: Linked Investigations */}
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
          <Radio size={18} color="var(--accent-primary-light)" />
          <span>Linked Threat Investigations</span>
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
                  <span>Inspect</span>
                </Link>
              </div>
            ))
          ) : (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              No active investigations currently linked to this profile.
            </div>
          )}
        </div>
      </div>

      {/* Section E: Correlated Forensic Events */}
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
          <Activity size={18} color="var(--accent-primary-light)" />
          <span>Correlated Security Events</span>
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
          {correlatedEvents.length > 0 ? (
            correlatedEvents.map((evt) => (
              <div
                key={evt.id}
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
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-primary)', fontWeight: 600 }}>
                      {evt.id}
                    </span>
                    <StatusBadge status={evt.severity} label={evt.severity.toUpperCase()} size="sm" />
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {evt.sourceIp} ({evt.originCountry})
                    </span>
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                    {evt.vector} — {evt.details}
                  </div>
                </div>

                <Link to={`/owner/events/${evt.id}`} className="btn btn-secondary btn-sm">
                  <span>Event Details</span>
                </Link>
              </div>
            ))
          ) : (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              No direct forensic event hits correlated with this profile.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
