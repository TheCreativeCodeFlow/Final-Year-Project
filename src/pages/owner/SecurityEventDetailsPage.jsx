import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  Shield,
  ShieldAlert,
  AlertTriangle,
  Clock,
  Sparkles,
  Server,
  Terminal,
  Cpu,
  Layers,
  ExternalLink,
  Shuffle,
  FileCode
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import EmptyState from '../../components/common/EmptyState';
import LoadingState from '../../components/common/LoadingState';
import {
  getSecurityEventById,
  getSecurityEvents,
  DEMO_DATA_DISCLAIMER
} from '../../services/mockData';

export default function SecurityEventDetailsPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [relatedEvents, setRelatedEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    getSecurityEventById(eventId).then((evt) => {
      if (isMounted) {
        setEvent(evt);
        if (evt) {
          getSecurityEvents({ applicationId: evt.applicationId }).then((allAppEvents) => {
            if (isMounted) {
              setRelatedEvents(allAppEvents.filter(e => e.id !== evt.id).slice(0, 4));
            }
          });
        }
        setLoading(false);
      }
    });

    return () => { isMounted = false; };
  }, [eventId]);

  if (loading) {
    return (
      <div className="page-container">
        <LoadingState message={`Loading forensic analysis for event ${eventId}...`} />
      </div>
    );
  }

  // Not found handling
  if (!event) {
    return (
      <div className="page-container">
        <EmptyState
          title="Security Event Not Found"
          description={`Event record "${eventId}" was not found in the gateway telemetry store. It may have expired or the identifier is invalid.`}
          actionText="Return to Security Events"
          onAction={() => navigate('/owner/events')}
        />
      </div>
    );
  }

  const { requestMetadata, deceptionInteraction } = event;

  return (
    <>
      <PageHeader
        title={`Security Event: ${event.id}`}
        badge={event.severity.toUpperCase()}
        description={`Target Application: ${event.application} • Logged ${event.timestamp}`}
        actions={
          <Link to="/owner/events" className="btn btn-secondary btn-sm">
            <ArrowLeft size={15} />
            <span>Back to Events Explorer</span>
          </Link>
        }
      />

      <div className="page-container" style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
        {/* Disclaimers & Safety Notice */}
        <div className="demo-banner">
          <Sparkles size={16} style={{ flexShrink: 0 }} />
          <div>
            <strong>Forensic Simulation:</strong> {DEMO_DATA_DISCLAIMER} All payload signatures and IP origins are fabricated scenarios.
          </div>
        </div>

        {/* Primary Event Overview Card */}
        <div className="cyber-card">
          <div className="cyber-card-header">
            <div>
              <div className="cyber-card-title">
                <AlertTriangle size={18} style={{ color: event.severity === 'critical' ? 'var(--severity-critical)' : 'var(--severity-high)' }} />
                <span>{event.vector}</span>
              </div>
              <div className="cyber-card-subtitle">
                Category: <strong>{event.category}</strong> • Detection: <strong>{event.detectionOutcome}</strong>
              </div>
            </div>
            <StatusBadge status={event.severity} />
          </div>

          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.25rem' }}>
            {event.details}
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            background: 'var(--bg-surface)',
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)'
          }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Target Application</div>
              <Link to={`/owner/applications/${event.applicationId}`} style={{ fontWeight: 600, color: '#60a5fa', fontSize: '13px' }}>
                {event.application}
              </Link>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Attacker Source IP</div>
              <div className="mono-tag" style={{ display: 'inline-block', marginTop: '2px' }}>{event.sourceIp}</div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Geo / Autonomous System</div>
              <div style={{ fontSize: '12px', fontWeight: 500 }}>{event.originCountry} • {event.asn}</div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Gateway Policy Applied</div>
              <div style={{ fontSize: '12px', color: 'var(--accent-diverted)', fontWeight: 600 }}>{event.policyDecision}</div>
            </div>
          </div>
        </div>

        {/* Detection Rationale & Deception Interaction */}
        <div className="grid-equal-2col">
          {/* Anomaly Detection Rationale */}
          <div className="cyber-card">
            <div className="cyber-card-header">
              <div className="cyber-card-title">
                <Cpu size={18} style={{ color: 'var(--accent-primary-light)' }} />
                <span>Detection Engine Rationale</span>
              </div>
              <span className="demo-tag">AI INFERENCE</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '13px' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block', textTransform: 'uppercase' }}>
                  Analytical Trigger
                </span>
                <p style={{ marginTop: '2px', color: 'var(--text-primary)' }}>
                  {event.simulatedRationale}
                </p>
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block', textTransform: 'uppercase' }}>
                  Canary Token Engagement
                </span>
                <span className="mono-tag" style={{ color: '#c084fc', display: 'inline-block', marginTop: '4px' }}>
                  {requestMetadata?.canaryHit || 'No canary trap hit'}
                </span>
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block', textTransform: 'uppercase' }}>
                  Detection Confidence
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <div style={{ flex: 1, height: '6px', backgroundColor: 'var(--bg-canvas)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: '96%', height: '100%', backgroundColor: 'var(--severity-critical)' }} />
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600 }}>98.5% High Confidence</span>
                </div>
              </div>
            </div>
          </div>

          {/* Deception Honeynet Interaction */}
          <div className="cyber-card">
            <div className="cyber-card-header">
              <div className="cyber-card-title">
                <Shuffle size={18} style={{ color: 'var(--accent-diverted)' }} />
                <span>Deceptive Sandbox Engagement</span>
              </div>
              <StatusBadge status="diverted" label="Active Deception" />
            </div>

            {deceptionInteraction ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Decoy Container</span>
                  <span className="mono-tag">{deceptionInteraction.containerId}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Decoy Surface Model</span>
                  <span style={{ fontWeight: 500 }}>{deceptionInteraction.decoyType}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Attacker Dwell Time</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>{deceptionInteraction.dwellTime}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Synthetic Response Served</span>
                  <span className="mono-tag" style={{ color: '#34d399' }}>{deceptionInteraction.fakeResponseStatus}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Telemetry Actions Logged</span>
                  <span style={{ fontWeight: 600 }}>{deceptionInteraction.attackerActionsLogged} probe actions captured</span>
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                No active honeynet diversion container was assigned for this event.
              </p>
            )}
          </div>
        </div>

        {/* Request Metadata Inspection */}
        {requestMetadata && (
          <div className="cyber-card">
            <div className="cyber-card-header">
              <div className="cyber-card-title">
                <Terminal size={18} style={{ color: 'var(--text-primary)' }} />
                <span>Simulated Ingress Request Payload</span>
              </div>
              <span className="demo-tag">SAFE SANITIZED LOG</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span className="demo-tag" style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd' }}>
                  {requestMetadata.method}
                </span>
                <span className="mono-tag" style={{ flex: 1, padding: '4px 8px' }}>
                  {requestMetadata.path}
                </span>
              </div>

              <div style={{ background: 'var(--bg-canvas)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '0.75rem', fontSize: '12px' }}>
                <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>User-Agent:</div>
                <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  {requestMetadata.userAgent}
                </div>

                <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>Flagged Inspection Signature:</div>
                <div style={{ fontFamily: 'var(--font-mono)', color: '#fca5a5', background: 'rgba(239, 68, 68, 0.08)', padding: '6px 8px', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  {requestMetadata.flaggedPayload}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Related Events on Same Application */}
        {relatedEvents.length > 0 && (
          <div className="cyber-card">
            <div className="cyber-card-header">
              <div className="cyber-card-title">
                <Layers size={18} style={{ color: 'var(--text-muted)' }} />
                <span>Related Security Events on {event.application}</span>
              </div>
              <Link to={`/owner/events?appId=${event.applicationId}`} style={{ fontSize: '12px', color: '#60a5fa' }}>
                View all app events →
              </Link>
            </div>

            <div className="cyber-table-container">
              <table className="cyber-table">
                <thead>
                  <tr>
                    <th>Event ID</th>
                    <th>Timestamp</th>
                    <th>Attacker IP</th>
                    <th>Attack Vector</th>
                    <th>Severity</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {relatedEvents.map((rEvt) => (
                    <tr key={rEvt.id}>
                      <td><span className="mono-tag">{rEvt.id}</span></td>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{rEvt.timestamp}</td>
                      <td><span className="mono-tag">{rEvt.sourceIp}</span></td>
                      <td style={{ fontWeight: 500 }}>{rEvt.vector}</td>
                      <td><StatusBadge status={rEvt.severity} /></td>
                      <td style={{ textAlign: 'right' }}>
                        <Link to={`/owner/events/${rEvt.id}`} className="btn btn-ghost btn-sm">
                          <span>Inspect →</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
