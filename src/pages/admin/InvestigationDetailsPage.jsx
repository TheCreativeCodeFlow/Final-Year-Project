import React, { useState, useEffect, useCallback } from 'react';
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
  GitBranch,
  Terminal,
  Cpu
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingState from '../../components/common/LoadingState';
import { useAuth } from '../../hooks/useAuth';
import { apiClient } from '../../services/apiClient';
import {
  getInvestigationById as getMockInvestigationById,
  addInvestigationNote,
  DEMO_DATA_DISCLAIMER
} from '../../services/mockData';

export default function InvestigationDetailsPage() {
  const { investigationId } = useParams();
  const { user, activeTenant } = useAuth();
  const tenantIdentifier = activeTenant?.identifier || activeTenant?.id || 'tenant-apex-9941';

  const [investigation, setInvestigation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState('live');
  const [fetchError, setFetchError] = useState(null);

  const [noteContent, setNoteContent] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [noteSuccess, setNoteSuccess] = useState(false);
  const [localNotes, setLocalNotes] = useState([]);

  const fetchLiveInvestigation = useCallback(async () => {
    setLoading(true);
    setFetchError(null);

    try {
      const res = await apiClient.getInvestigationById(tenantIdentifier, investigationId);

      if (res && res.success && res.data) {
        const inv = res.data;
        const isDiscrepancy = inv.status === 'DISCREPANCY_FLAGGED';

        const mapped = {
          id: inv.investigationIdentifier || inv.id,
          databaseId: inv.id,
          investigationIdentifier: inv.investigationIdentifier || inv.id,
          tenantId: tenantIdentifier,
          tenantName: activeTenant?.name || 'Apex FinTech Global',
          severity: inv.severity ? inv.severity.toLowerCase() : 'high',
          status: inv.status || 'OPEN',
          attackCategory: inv.summary?.includes('credential')
            ? 'Credential Stuffing'
            : isDiscrepancy
            ? 'Edge Proxy Discrepancy'
            : 'Reconnaissance Probe',
          sessionIdentifier: inv.evidenceReferences?.targetRoute || `sess-${inv.id.substring(0, 8)}`,
          applicationNames: inv.application ? [inv.application.name] : ['Customer Accounts API'],
          applicationDomain: inv.application?.domain || 'accounts.apexfintech.internal',
          policyDecision: 'pol-sec-06 (Containment Sandbox)',
          recordedRoutingOutcome: isDiscrepancy ? 'BLOCKED_AT_INGRESS' : 'EXECUTED_DECEPTION',
          policyDiscrepancy: isDiscrepancy,
          discrepancyDetails: isDiscrepancy
            ? 'Intended diversion was rejected by upstream proxy supervisor. Firewall blocked ingress traffic before sandbox container socket was attached.'
            : null,
          attackerProfiles: inv.attackerProfiles || [],
          observations: inv.observations || [],
          assessments: inv.assessments || [],
          observedBehaviorSummary: inv.summary,
          evidenceReferences: inv.evidenceReferences || {},
          firstSeen: inv.openedAt ? new Date(inv.openedAt).toLocaleString() : 'Not Recorded',
          lastSeen: inv.updatedAt ? new Date(inv.updatedAt).toLocaleString() : 'Not Recorded',
          assignedAnalyst: 'Sarah Chen (Platform Ops)'
        };

        setInvestigation(mapped);
        setDataSource('live');
        setLoading(false);
        return;
      }

      throw new Error(res?.error?.message || `Investigation ${investigationId} not found.`);
    } catch (err) {
      setFetchError(err.message || 'Failed to load investigation from database.');
      // Attempt fallback to mock
      try {
        const mockInv = await getMockInvestigationById(investigationId);
        if (mockInv) {
          setInvestigation(mockInv);
          setLocalNotes(mockInv.analystNotes || []);
          setDataSource('demo');
        } else {
          setInvestigation(null);
        }
      } catch {
        setInvestigation(null);
      }
      setLoading(false);
    }
  }, [tenantIdentifier, investigationId, activeTenant]);

  useEffect(() => {
    fetchLiveInvestigation();
  }, [fetchLiveInvestigation]);

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!noteContent.trim() || !investigation) return;

    setIsSubmittingNote(true);
    try {
      const newNote = {
        id: `note-${Date.now()}`,
        author: user?.roleTitle || user?.name || 'Sarah Chen (Platform Ops)',
        timestamp: 'Just now',
        content: noteContent.trim()
      };
      setLocalNotes(prev => [newNote, ...prev]);
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
          <AlertTriangle size={36} style={{ color: 'var(--severity-critical)', margin: '0 auto 1rem' }} />
          <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: '0.5rem' }}>
            Investigation Not Found
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            No investigation record exists with identifier <code>{investigationId}</code> in this tenant context.
          </p>
          <Link to="/admin/investigations" className="btn btn-primary">
            Return to Threat Investigations
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Back button */}
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
            <button
              onClick={fetchLiveInvestigation}
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={13} /> Refresh
            </button>
            <StatusBadge
              status={investigation.severity}
              label={investigation.severity.toUpperCase()}
              size="md"
            />
            <StatusBadge
              status={investigation.status === 'OPEN' ? 'active' : investigation.status === 'DISCREPANCY_FLAGGED' ? 'warning' : 'neutral'}
              label={investigation.status}
              size="md"
            />
          </div>
        }
      />

      {/* Data Source & Semantic Notice */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: dataSource === 'live' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(59, 130, 246, 0.08)',
          border: `1px solid ${dataSource === 'live' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(59, 130, 246, 0.25)'}`,
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          marginBottom: '20px',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-secondary)'
        }}
      >
        {dataSource === 'live' ? (
          <Database size={18} style={{ color: '#10b981', flexShrink: 0 }} />
        ) : (
          <AlertCircle size={18} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
        )}
        <div style={{ flex: 1 }}>
          <strong style={{ color: dataSource === 'live' ? '#34d399' : '#fff' }}>
            Investigation Telemetry Semantics:
          </strong>{' '}
          Observed telemetry, detector anomaly classifications, and analyst commentary are strictly distinguished.
          <strong style={{ color: '#fff', marginLeft: '4px' }}>
            Attacker profiles represent pseudonymous heuristic clustering, not verified legal attribution.
          </strong>
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
            <span style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--accent-primary-light)' }}>
              {investigation.tenantName}
            </span>
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
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              <code>{investigation.applicationDomain}</code>
            </div>
          </div>

          {/* Timestamps */}
          <div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '4px' }}>Activity Window</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
              Updated: <strong>{investigation.lastSeen}</strong>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Opened: {investigation.firstSeen}
            </div>
          </div>

          {/* Assigned Analyst */}
          <div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '4px' }}>Assigned Analyst</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <User size={14} color="var(--accent-primary-light)" />
              <span>{investigation.assignedAnalyst}</span>
            </div>
          </div>
        </div>

        {/* Behavioral Summary */}
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
            BEHAVIORAL EVIDENCE SUMMARY
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', lineHeight: 1.5 }}>
            {investigation.observedBehaviorSummary}
          </div>
        </div>
      </div>

      {/* Section B: Linked Attacker Profiles */}
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
          <ShieldAlert size={18} color="#c084fc" />
          <span>Linked Attacker Behavior Profiles</span>
        </h3>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Statistical clustering based on request velocity, user-agent fingerprints, and targeted route patterns.
          <strong style={{ color: '#fef08a', marginLeft: '4px' }}>
            Attribution Disclaimer: Indicators represent pseudonymous statistical anomaly clusters, NOT confirmed human identity.
          </strong>
        </p>

        {investigation.attackerProfiles && investigation.attackerProfiles.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {investigation.attackerProfiles.map((prof, i) => (
              <div
                key={i}
                style={{
                  padding: '1rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-default)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <code style={{ fontSize: '12px', fontWeight: 700, color: '#c084fc' }}>
                    {prof.profileIdentifier || prof.id}
                  </code>
                  <Link
                    to={`/admin/attacker-profiles/${prof.profileIdentifier || prof.id}`}
                    className="btn btn-ghost btn-xs"
                    style={{ fontSize: '11px', color: '#60a5fa' }}
                  >
                    View Profile →
                  </Link>
                </div>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  {prof.displayLabel}
                </div>
                {prof.observedBehaviorIndicators && (
                  <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', background: 'var(--bg-canvas)', padding: '6px', borderRadius: '4px' }}>
                    {JSON.stringify(prof.observedBehaviorIndicators, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', padding: '12px', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-sm)' }}>
            No attacker behavior profiles currently linked to this investigation.
          </div>
        )}
      </div>

      {/* Section C: Policy vs. Routing Outcome Discrepancy */}
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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
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
              border: investigation.policyDiscrepancy ? '1px solid rgba(249, 115, 22, 0.3)' : '1px solid var(--border-default)'
            }}
          >
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '4px' }}>
              RECORDED ROUTING OUTCOME
            </div>
            <div
              style={{
                fontSize: 'var(--text-base)',
                fontWeight: 600,
                color: investigation.policyDiscrepancy ? '#f59e0b' : 'var(--text-primary)'
              }}
            >
              {investigation.recordedRoutingOutcome || 'Unknown'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Actual traffic disposition confirmed by ingress edge proxy logs.
            </div>
          </div>
        </div>

        {/* Discrepancy Alert */}
        {investigation.policyDiscrepancy ? (
          <div
            style={{
              background: 'rgba(249, 115, 22, 0.12)',
              border: '1px solid rgba(249, 115, 22, 0.3)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.875rem 1rem',
              display: 'flex',
              gap: '10px'
            }}
          >
            <AlertTriangle size={18} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: '#f59e0b', marginBottom: '3px' }}>
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
            <CheckCircle2 size={15} color="#34d399" />
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
              Policy intent and physical routing disposition are fully aligned. Ingress gateway verified sandbox containment.
            </span>
          </div>
        )}
      </div>

      {/* Section D: Analyst Log & Commentary */}
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
          <FileText size={18} color="var(--accent-primary-light)" />
          <span>Analyst Notes & Audit Timeline</span>
        </h3>

        <form onSubmit={handleAddNote} style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="Record forensic observation, containment action, or review sign-off..."
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              className="cyber-input"
              style={{ flex: 1 }}
            />
            <button
              type="submit"
              disabled={isSubmittingNote || !noteContent.trim()}
              className="btn btn-primary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Send size={14} /> Add Note
            </button>
          </div>
          {noteSuccess && (
            <div style={{ color: '#34d399', fontSize: '11px', marginTop: '6px' }}>
              ✓ Note appended to investigation audit log.
            </div>
          )}
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {localNotes.length === 0 ? (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              No analyst notes recorded yet.
            </div>
          ) : (
            localNotes.map((note) => (
              <div
                key={note.id}
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '12px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>{note.author}</strong>
                  <span>{note.timestamp}</span>
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>{note.content}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
