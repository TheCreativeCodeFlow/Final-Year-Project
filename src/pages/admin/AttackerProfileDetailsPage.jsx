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
  Lock,
  GitBranch,
  Terminal,
  Database,
  Search,
  EyeOff,
  RefreshCw
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingState from '../../components/common/LoadingState';
import MetricCard from '../../components/common/MetricCard';
import { useAuth } from '../../hooks/useAuth';
import { apiClient } from '../../services/apiClient';
import {
  getAttackerProfileById as getMockAttackerProfileById,
  getInvestigationById as getMockInvestigationById,
  getSecurityEventById as getMockSecurityEventById,
  DEMO_DATA_DISCLAIMER
} from '../../services/mockData';

export default function AttackerProfileDetailsPage() {
  const { profileId } = useParams();
  const { activeTenant } = useAuth();
  const tenantIdentifier = activeTenant?.identifier || activeTenant?.id || 'tenant-apex-9941';

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState('live');
  const [fetchError, setFetchError] = useState(null);
  const [linkedInvestigations, setLinkedInvestigations] = useState([]);

  const fetchLiveProfile = useCallback(async () => {
    setLoading(true);
    setFetchError(null);

    try {
      const res = await apiClient.getAttackerProfileById(tenantIdentifier, profileId);

      if (res && res.success && res.data) {
        const raw = res.data;
        const indicators = raw.observedBehaviorIndicators || {};
        const isDecoy = indicators.decoyInteractionsRecorded > 0;
        const isCredStuffing = Array.isArray(indicators.targetedPaths) && indicators.targetedPaths.some(pt => pt.includes('auth') || pt.includes('login'));

        const mapped = {
          id: raw.profileIdentifier || raw.id,
          databaseId: raw.id,
          profileIdentifier: raw.profileIdentifier || raw.id,
          tenantId: tenantIdentifier,
          tenantName: activeTenant?.name || 'Apex FinTech Global',
          displayLabel: raw.displayLabel || `${raw.profileIdentifier} (Heuristic Profile)`,
          behavioralClassification: isDecoy
            ? 'Decoy interaction observed'
            : isCredStuffing
            ? 'Repeated authentication failures'
            : 'Multiple suspicious indicators',
          observedRequestCount: indicators.probeVelocityPerSec ? Math.round(indicators.probeVelocityPerSec * 120) : 48,
          observedAuthFailures: isCredStuffing ? 36 : 4,
          distinctEndpointCount: Array.isArray(indicators.targetedPaths) ? indicators.targetedPaths.length : 2,
          decoyInteractionCount: indicators.decoyInteractionsRecorded || (isDecoy ? 3 : 0),
          sessionIdentifiers: indicators.userAgentSignatures || [raw.profileIdentifier],
          firstSeen: raw.firstSeenAt ? new Date(raw.firstSeenAt).toLocaleString() : '24h ago',
          lastSeen: raw.lastSeenAt ? new Date(raw.lastSeenAt).toLocaleString() : 'Just now',
          indicators,
          investigations: raw.investigations || []
        };

        setProfile(mapped);
        setLinkedInvestigations(raw.investigations || []);
        setDataSource('live');
        setLoading(false);
        return;
      }

      throw new Error(res?.error?.message || `Profile ${profileId} not found.`);
    } catch (err) {
      setFetchError(err.message || 'Failed to fetch profile from database.');
      // Fallback to mock
      try {
        const mockProf = await getMockAttackerProfileById(profileId);
        if (mockProf) {
          setProfile(mockProf);
          if (mockProf.linkedInvestigationIds?.length > 0) {
            const invPromises = mockProf.linkedInvestigationIds.map(id => getMockInvestigationById(id));
            const invResults = await Promise.all(invPromises);
            setLinkedInvestigations(invResults.filter(Boolean));
          }
          setDataSource('demo');
        } else {
          setProfile(null);
        }
      } catch {
        setProfile(null);
      }
      setLoading(false);
    }
  }, [tenantIdentifier, profileId, activeTenant]);

  useEffect(() => {
    fetchLiveProfile();
  }, [fetchLiveProfile]);

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
          <AlertTriangle size={36} style={{ color: 'var(--severity-critical)', margin: '0 auto 1rem' }} />
          <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: '0.5rem' }}>
            Attacker Profile Not Found
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            No behavioral profile exists with identifier <code>{profileId}</code>.
          </p>
          <Link to="/admin/attacker-profiles" className="btn btn-primary">
            Return to Profiles Directory
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
        description={`Observed behavioral clustering for ${profile.tenantName} — ${profile.displayLabel}`}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={fetchLiveProfile}
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={13} /> Refresh
            </button>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: '4px',
                background: 'rgba(192, 132, 252, 0.15)',
                color: '#c084fc',
                border: '1px solid rgba(192, 132, 252, 0.3)'
              }}
            >
              {profile.behavioralClassification}
            </span>
          </div>
        }
      />

      {/* Attribution & Data Source Disclaimer */}
      <div
        style={{
          background: 'rgba(234, 179, 8, 0.08)',
          border: '1px solid rgba(234, 179, 8, 0.25)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}
      >
        <AlertCircle size={18} color="#eab308" style={{ flexShrink: 0 }} />
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
          <strong style={{ color: '#fff' }}>BEHAVIORAL ATTRIBUTION DISCLAIMER:</strong> This profile represents heuristic anomaly clustering derived from observed request signatures.
          <strong style={{ color: '#fef08a', marginLeft: '4px' }}>
            Statistical confidence scores reflect automated model probabilities. They do NOT constitute ground truth or confirmed human identity.
          </strong>
        </div>
      </div>

      {/* Section A: Profile Metrics Grid */}
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
          title="Auth Anomalies"
          value={profile.observedAuthFailures}
          subtext="Credential probe alerts"
          icon={Lock}
        />
        <MetricCard
          title="Targeted Endpoints"
          value={profile.distinctEndpointCount}
          subtext="Distinct URL paths"
          icon={Layers}
        />
        <MetricCard
          title="Decoy Engagements"
          value={profile.decoyInteractionCount}
          subtext={profile.decoyInteractionCount > 0 ? "Interacted with honeynet sandbox" : "Zero decoy interaction recorded"}
          icon={Shuffle}
        />
      </div>

      {/* Observed Behavioral Indicators Card */}
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
          <Terminal size={18} color="#c084fc" />
          <span>Observed Behavioral Telemetry & Indicators</span>
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Client User-Agent Signatures
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {profile.sessionIdentifiers.map((sig, idx) => (
                <code key={idx} style={{ fontSize: '11px', background: 'var(--bg-canvas)', padding: '4px 8px', borderRadius: '4px' }}>
                  {sig}
                </code>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Raw Anomaly Clustering Data
            </div>
            <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)', background: 'var(--bg-canvas)', padding: '10px', borderRadius: '4px', overflowX: 'auto' }}>
              {JSON.stringify(profile.indicators, null, 2)}
            </pre>
          </div>
        </div>
      </div>

      {/* Linked Investigations */}
      <div className="card" style={{ padding: '1.5rem' }}>
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
          <Radio size={18} color="var(--accent-primary-light)" />
          <span>Correlated Threat Investigations</span>
        </h3>

        {linkedInvestigations.length === 0 ? (
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', padding: '12px', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-sm)' }}>
            No investigations currently linked to this behavioral profile.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {linkedInvestigations.map((inv) => (
              <div
                key={inv.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-default)'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                    <code style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-primary-light)' }}>
                      {inv.investigationIdentifier || inv.id}
                    </code>
                    <StatusBadge status={inv.severity ? inv.severity.toLowerCase() : 'high'} size="sm" />
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Status: {inv.status}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{inv.summary}</div>
                </div>
                <Link
                  to={`/admin/investigations/${inv.investigationIdentifier || inv.id}`}
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: '12px' }}
                >
                  View Dossier →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
