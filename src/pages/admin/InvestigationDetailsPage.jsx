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
  Send,
  RefreshCw,
  Compass,
  Database,
  Lock,
  GitBranch
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingState from '../../components/common/LoadingState';
import {
  getInvestigationById,
  addInvestigationNote,
  DEMO_DATA_DISCLAIMER
} from '../../services/mockData';
import { useAuth } from '../../hooks/useAuth';

export default function InvestigationDetailsPage() {
  const { investigationId } = useParams();
  const { user } = useAuth();

  const [investigation, setInvestigation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [noteContent, setNoteContent] = useState('');
  const [noteAuthor, setNoteAuthor] = useState(user?.roleTitle || 'Sarah Chen (Simulated)');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [noteSuccess, setNoteSuccess] = useState(false);

  const fetchInvestigation = () => {
    setLoading(true);
    getInvestigationById(investigationId).then((res) => {
      setInvestigation(res);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchInvestigation();
  }, [investigationId]);

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!noteContent.trim() || !investigation) return;

    setIsSubmittingNote(true);
    try {
      const updated = await addInvestigationNote(investigation.id, {
        author: noteAuthor,
        content: noteContent
      });
      setInvestigation(updated);
      setNoteContent('');
      setNoteSuccess(true);
      setTimeout(() => setNoteSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to add note", err);
    } finally {
      setIsSubmittingNote(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <LoadingState message={`Loading threat investigation ${investigationId}...`} />
      </div>
    );
  }

  // Not Found State
  if (!investigation) {
    return (
      <div className="page-container">
        <div style={{ marginBottom: '1.5rem' }}>
          <Link
            to="/admin/investigations"
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <ArrowLeft size={14} />
            <span>Back to Investigations Queue</span>
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
            Investigation Not Found
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto 1.5rem' }}>
            No investigation record exists with identifier <code style={{ color: 'var(--accent-primary-light)' }}>{investigationId}</code>. It may have been closed or removed from the simulation queue.
          </p>
          <Link to="/admin/investigations" className="btn btn-primary">
            Return to Threat Investigations
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
          to="/admin/investigations"
          className="btn btn-secondary btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <ArrowLeft size={14} />
          <span>Back to Threat Investigations</span>
        </Link>
      </div>

      <PageHeader
        title={`Investigation: ${investigation.id}`}
        description={`Correlated session analysis for ${investigation.tenantName} — Attack Category: ${investigation.attackCategory}`}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <StatusBadge
              status={investigation.severity}
              label={investigation.severity.toUpperCase()}
              size="md"
            />
            <StatusBadge
              status={investigation.status === 'Open' ? 'active' : investigation.status === 'In Review' ? 'warning' : investigation.status === 'Mitigated' ? 'success' : 'neutral'}
              label={investigation.status}
              size="md"
            />
          </div>
        }
      />

      {/* Simulated Notice */}
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
          <strong style={{ color: 'var(--text-primary)' }}>SIMULATION CONTEXT:</strong> All forensic evidence, detector anomaly scores, and session identifiers are synthetically generated for demonstration.
        </div>
      </div>

      {/* Section A: Investigation Summary Card */}
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
          <span>Investigation Overview & Context</span>
        </h3>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1.25rem'
          }}
        >
          {/* Tenant Info */}
          <div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '4px' }}>Tenant Organization</div>
            <Link
              to={`/admin/tenants/${investigation.tenantId}`}
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
              <span>{investigation.tenantName}</span>
              <ExternalLink size={12} />
            </Link>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
              {investigation.tenantId}
            </div>
          </div>

          {/* Target Applications */}
          <div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '4px' }}>Target Application(s)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {investigation.applicationNames?.map((app, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-xs)',
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-primary)'
                  }}
                >
                  {app}
                </span>
              ))}
            </div>
          </div>

          {/* Session Identifier & Profile */}
          <div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '4px' }}>Session / Attacker Profile</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontWeight: 600 }}>
              {investigation.sessionIdentifier}
            </div>
            {investigation.profileId && (
              <div style={{ marginTop: '4px' }}>
                <Link
                  to={`/admin/attacker-profiles/${investigation.profileId}`}
                  style={{
                    fontSize: '11px',
                    color: 'var(--accent-primary-light)',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span>View Attacker Profile ({investigation.profileId})</span>
                  <ExternalLink size={10} />
                </Link>
              </div>
            )}
          </div>

          {/* Timestamps */}
          <div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '4px' }}>Activity Window</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
              Last: <strong>{investigation.lastSeen}</strong>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              First: {investigation.firstSeen}
            </div>
          </div>

          {/* Assigned Analyst */}
          <div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '4px' }}>Assigned Analyst (Simulated)</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <User size={14} color="var(--accent-primary-light)" />
              <span>{investigation.assignedAnalyst || 'Unassigned'}</span>
            </div>
          </div>

          {/* Primary Attack Category */}
          <div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '4px' }}>Attack Classification</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontWeight: 600 }}>
              {investigation.attackCategory}
            </div>
          </div>
        </div>

        {/* Observed Behavior Summary */}
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
            BEHAVIORAL SUMMARY
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', lineHeight: 1.5 }}>
            {investigation.observedBehaviorSummary}
          </div>
        </div>
      </div>

      {/* Section D: Action History & Policy vs. Routing Outcome Discrepancy */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3
          style={{
            fontSize: 'var(--text-md)',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <GitBranch size={18} color="var(--accent-primary-light)" />
          <span>Action History & Routing Semantics</span>
        </h3>

        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
          Verification of policy intent versus recorded edge routing outcome. In high-assurance architectures, policy decisions are recorded separately from the physical routing result to catch fail-safe bypasses and network fallback modes.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1rem',
            marginBottom: '1rem'
          }}
        >
          {/* Policy Decision */}
          <div
            style={{
              padding: '1rem',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-default)'
            }}
          >
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '4px' }}>
              INTENDED POLICY DECISION
            </div>
            <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)' }}>
              {investigation.policyDecision || 'Not Recorded'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Action mandated by automated detection policy ruleset.
            </div>
          </div>

          {/* Recorded Outcome */}
          <div
            style={{
              padding: '1rem',
              borderRadius: 'var(--radius-sm)',
              background: investigation.policyDiscrepancy ? 'rgba(249, 115, 22, 0.08)' : 'var(--bg-surface-elevated)',
              border: investigation.policyDiscrepancy ? '1px solid var(--severity-high-border)' : '1px solid var(--border-default)'
            }}
          >
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '4px' }}>
              RECORDED ROUTING OUTCOME
            </div>
            <div
              style={{
                fontSize: 'var(--text-base)',
                fontWeight: 600,
                color: investigation.policyDiscrepancy ? 'var(--severity-high)' : 'var(--text-primary)'
              }}
            >
              {investigation.recordedRoutingOutcome || 'Unknown / Not Recorded'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Actual traffic disposition confirmed by ingress edge proxy logs.
            </div>
          </div>
        </div>

        {/* Explicit Discrepancy Alert if Mismatch Exists */}
        {investigation.policyDiscrepancy ? (
          <div
            style={{
              background: 'rgba(249, 115, 22, 0.12)',
              border: '1px solid var(--severity-high-border)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.875rem 1rem',
              display: 'flex',
              gap: '10px'
            }}
          >
            <AlertTriangle size={18} color="var(--severity-high)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--severity-high)', marginBottom: '3px' }}>
                EXPLICIT POLICY-OUTCOME DISCREPANCY DETECTED
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                {investigation.discrepancyDetails}
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              background: 'rgba(16, 185, 129, 0.06)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.625rem 0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <CheckCircle2 size={15} color="var(--status-success)" />
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
              Policy intent and physical routing disposition are fully aligned. Ingress gateway verified sandbox containment.
            </span>
          </div>
        )}
      </div>

      {/* Section C: Behavioral Evidence */}
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
          <span>Observed Behavioral Indicators</span>
        </h3>

        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
          Distinguishing directly observed facts from detector-generated interpretations. Evidence sources, frequency metrics, and confidence estimates are detailed below.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {investigation.behavioralEvidence?.map((ev) => (
            <div
              key={ev.id}
              style={{
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-surface-elevated)',
                padding: '1rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>
                  {ev.indicator}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--accent-primary-light)',
                    background: 'var(--bg-surface)',
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-xs)',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  Source: {ev.source}
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: '0.75rem',
                  marginTop: '8px'
                }}
              >
                {/* Directly Observed Fact */}
                <div
                  style={{
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-xs)',
                    padding: '8px 10px'
                  }}
                >
                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '3px', textTransform: 'uppercase' }}>
                    Directly Observed Fact
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                    {ev.observedFact}
                  </div>
                </div>

                {/* Detector-Generated Interpretation */}
                <div
                  style={{
                    background: 'rgba(37, 99, 235, 0.06)',
                    border: '1px solid rgba(37, 99, 235, 0.2)',
                    borderRadius: 'var(--radius-xs)',
                    padding: '8px 10px'
                  }}
                >
                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent-primary-light)', marginBottom: '3px', textTransform: 'uppercase' }}>
                    Detector-Generated Interpretation
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {ev.detectorInterpretation}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: '8px',
                  fontSize: '11px',
                  color: 'var(--text-muted)'
                }}
              >
                <span>Observation Window: <strong style={{ color: 'var(--text-secondary)' }}>{ev.timeRange}</strong></span>
                <span>Occurrence Count: <strong style={{ color: 'var(--text-primary)' }}>{ev.count}</strong></span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section B: Event Timeline */}
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
          <span>Chronological Event Timeline</span>
        </h3>

        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
          Sequence of observed requests, trigger activations, and gateway diversion transitions.
        </p>

        <div style={{ position: 'relative', paddingLeft: '1.5rem', borderLeft: '2px solid var(--border-default)', marginLeft: '8px' }}>
          {investigation.timelineEvents?.map((tl, index) => (
            <div
              key={tl.id || index}
              style={{
                marginBottom: '1.5rem',
                position: 'relative'
              }}
            >
              {/* Timeline marker */}
              <div
                style={{
                  position: 'absolute',
                  left: '-31px',
                  top: '2px',
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: 'var(--accent-primary)',
                  border: '2px solid var(--bg-surface)'
                }}
              />

              <div
                style={{
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '1rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {tl.eventType}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {tl.timestamp}
                  </span>
                </div>

                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Behavior:</strong> {tl.observedBehavior}
                </div>

                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Detection Evidence:</strong> {tl.detectionEvidence}
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '1rem',
                    fontSize: '11px',
                    paddingTop: '6px',
                    borderTop: '1px solid var(--border-subtle)'
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Policy: </span>
                    <span style={{ color: 'var(--text-primary)' }}>{tl.policyDecision || 'Not Recorded'}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Outcome: </span>
                    <span style={{ color: 'var(--accent-primary-light)', fontWeight: 500 }}>
                      {tl.routingOutcome || 'Unknown'}
                    </span>
                  </div>
                </div>

                {tl.discrepancyNote && (
                  <div
                    style={{
                      marginTop: '6px',
                      fontSize: '11px',
                      color: 'var(--severity-high)',
                      background: 'rgba(249, 115, 22, 0.08)',
                      padding: '4px 8px',
                      borderRadius: 'var(--radius-xs)'
                    }}
                  >
                    {tl.discrepancyNote}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Associated Security Events Links */}
        {investigation.eventIds?.length > 0 && (
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '6px' }}>
              Associated Forensic Security Events:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {investigation.eventIds.map((evtId) => (
                <Link
                  key={evtId}
                  to={`/owner/events/${evtId}`}
                  className="btn btn-secondary btn-sm"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}
                >
                  <ExternalLink size={11} />
                  <span>Inspect Event {evtId}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Section E: Analyst Notes (Local Demonstration Notes) */}
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
          <FileText size={18} color="var(--accent-primary-light)" />
          <span>Analyst Notes & Operational Journal</span>
        </h3>

        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
          Local demonstration analyst notes. Notes are persisted in browser demo storage for this session and are not shared across remote administrators or cryptographically signed.
        </p>

        {/* Add Note Form */}
        <form onSubmit={handleAddNote} style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '220px' }}>
              <input
                type="text"
                className="input-field"
                placeholder="Analyst Name / Title"
                value={noteAuthor}
                onChange={(e) => setNoteAuthor(e.target.value)}
                style={{ width: '100%', height: '36px', fontSize: 'var(--text-xs)' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '0.75rem' }}>
            <textarea
              className="input-field"
              rows={3}
              placeholder="Record forensic notes, attacker behavioral shifts, or containment actions..."
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              style={{ width: '100%', fontSize: 'var(--text-sm)', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {noteSuccess ? (
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--status-success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={13} />
                <span>Note saved to local demonstration session.</span>
              </span>
            ) : <span />}

            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={isSubmittingNote || !noteContent.trim()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Send size={13} />
              <span>{isSubmittingNote ? 'Saving...' : 'Add Demonstration Note'}</span>
            </button>
          </div>
        </form>

        {/* Notes List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {investigation.notes?.length > 0 ? (
            investigation.notes.map((note) => (
              <div
                key={note.id}
                style={{
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.875rem 1rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--accent-primary-light)' }}>
                    {note.author}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {note.timestamp}
                  </span>
                </div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                  {note.content}
                </div>
              </div>
            ))
          ) : (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.5rem 0' }}>
              No notes recorded yet for this investigation.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
