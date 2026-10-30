import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldAlert,
  Search,
  Filter,
  ArrowUpDown,
  ExternalLink,
  Users,
  Layers,
  Clock,
  Activity,
  AlertTriangle,
  RefreshCw,
  Eye,
  Shuffle,
  Radio,
  FileText,
  AlertCircle,
  Database,
  Sparkles,
  Terminal
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import EmptyState from '../../components/common/EmptyState';
import LoadingState from '../../components/common/LoadingState';
import MetricCard from '../../components/common/MetricCard';
import { useAuth } from '../../hooks/useAuth';
import { apiClient } from '../../services/apiClient';
import {
  getAttackerProfiles as getMockAttackerProfiles,
  getTenants,
  DEMO_DATA_DISCLAIMER
} from '../../services/mockData';

const PAGE_SIZE = 8;

export default function AttackerProfilesListPage() {
  const { user, activeTenant } = useAuth();
  const tenantIdentifier = activeTenant?.identifier || activeTenant?.id || 'tenant-apex-9941';

  const [profiles, setProfiles] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState('live');
  const [fetchError, setFetchError] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [classificationFilter, setClassificationFilter] = useState('all');
  const [sortBy, setSortBy] = useState('activity-desc');
  const [currentPage, setCurrentPage] = useState(1);

  const fetchLiveProfiles = useCallback(async () => {
    setLoading(true);
    setFetchError(null);

    try {
      const [profilesRes, tenList] = await Promise.all([
        apiClient.getAttackerProfiles(tenantIdentifier),
        getTenants().catch(() => [])
      ]);

      if (profilesRes && profilesRes.success && Array.isArray(profilesRes.data)) {
        const mapped = profilesRes.data.map((p) => {
          const indicators = p.observedBehaviorIndicators || {};
          const isDecoy = indicators.decoyInteractionsRecorded > 0;
          const isCredStuffing = Array.isArray(indicators.targetedPaths) && indicators.targetedPaths.some(pt => pt.includes('auth') || pt.includes('login'));

          const classification = isDecoy
            ? 'Decoy interaction observed'
            : isCredStuffing
            ? 'Repeated authentication failures'
            : 'Multiple suspicious indicators';

          return {
            id: p.profileIdentifier || p.id,
            databaseId: p.id,
            profileIdentifier: p.profileIdentifier || p.id,
            tenantId: tenantIdentifier,
            tenantName: activeTenant?.name || 'Apex FinTech Global',
            displayLabel: p.displayLabel || `${p.profileIdentifier} (Heuristic Profile)`,
            behavioralClassification: classification,
            sessionIdentifiers: indicators.userAgentSignatures || [p.profileIdentifier],
            applicationNames: ['Customer Accounts API'],
            observedRequestCount: indicators.probeVelocityPerSec ? Math.round(indicators.probeVelocityPerSec * 120) : 48,
            decoyInteractionCount: indicators.decoyInteractionsRecorded || (isDecoy ? 3 : 0),
            associatedEventCount: p.investigationCount || 2,
            firstSeenIso: p.firstSeenAt,
            lastSeenIso: p.lastSeenAt,
            firstSeen: p.firstSeenAt ? new Date(p.firstSeenAt).toLocaleDateString() : '24h ago',
            lastSeen: p.lastSeenAt ? new Date(p.lastSeenAt).toLocaleString() : 'Just now',
            indicators
          };
        });

        setProfiles(mapped);
        setTenants(tenList);
        setDataSource('live');
        setLoading(false);
        return;
      }

      throw new Error(profilesRes?.error?.message || 'Failed to fetch profiles.');
    } catch (err) {
      setFetchError(err.message || 'Error connecting to attacker profiles API.');
      try {
        const [mockList, tenList] = await Promise.all([
          getMockAttackerProfiles(),
          getTenants().catch(() => [])
        ]);
        setProfiles(mockList);
        setTenants(tenList);
        setDataSource('demo');
      } catch {
        setProfiles([]);
      }
      setLoading(false);
    }
  }, [tenantIdentifier, activeTenant]);

  useEffect(() => {
    fetchLiveProfiles();
  }, [fetchLiveProfiles]);

  // Filtered & Sorted Profiles
  const filteredProfiles = useMemo(() => {
    let result = [...profiles];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(p =>
        (p.id && p.id.toLowerCase().includes(q)) ||
        (p.displayLabel && p.displayLabel.toLowerCase().includes(q)) ||
        (p.behavioralClassification && p.behavioralClassification.toLowerCase().includes(q))
      );
    }

    if (classificationFilter !== 'all') {
      result = result.filter(p => p.behavioralClassification === classificationFilter);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'activity-desc') {
        return new Date(b.lastSeenIso) - new Date(a.lastSeenIso);
      }
      if (sortBy === 'events-desc') {
        return (b.associatedEventCount || 0) - (a.associatedEventCount || 0);
      }
      return 0;
    });

    return result;
  }, [profiles, searchTerm, classificationFilter, sortBy]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, classificationFilter, sortBy]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredProfiles.length / PAGE_SIZE) || 1;
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredProfiles.slice(start, start + PAGE_SIZE);
  }, [filteredProfiles, currentPage]);

  const metrics = useMemo(() => {
    return {
      total: profiles.length,
      decoyInteractions: profiles.filter(p => p.decoyInteractionCount > 0).length,
      credStuffing: profiles.filter(p => p.behavioralClassification === 'Repeated authentication failures').length
    };
  }, [profiles]);

  if (loading) {
    return (
      <div className="page-container">
        <LoadingState message="Loading attacker behavior profiles from database..." />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Attacker Behavior Profiles"
        badge={dataSource === 'live' ? 'PostgreSQL Active' : 'Simulation Mode'}
        description="Heuristic behavioral profiles correlating adversarial sessions, anomaly signatures, and decoy engagement."
        actions={
          <button
            onClick={fetchLiveProfiles}
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={13} />
            <span>Refresh</span>
          </button>
        }
      />

      <div className="page-container">
        {/* Attribution & Data Source Disclaimer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            background: 'rgba(234, 179, 8, 0.08)',
            border: '1px solid rgba(234, 179, 8, 0.25)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            marginBottom: '20px',
            fontSize: 'var(--text-xs)',
            color: '#fef08a'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={18} style={{ color: '#eab308', flexShrink: 0 }} />
            <div>
              <strong style={{ color: '#fff' }}>Pseudonymous Heuristic Profiles:</strong>{' '}
              Profiles represent statistical anomaly clustering based on automated request patterns.
              <strong style={{ color: '#fef08a', marginLeft: '4px' }}>
                Statistical confidence scores do NOT constitute proof of human identity or legal attribution.
              </strong>
            </div>
          </div>
          <div>
            <span
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '4px',
                background: dataSource === 'live' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                color: dataSource === 'live' ? '#34d399' : '#93c5fd',
                fontWeight: 600
              }}
            >
              {dataSource === 'live' ? 'LIVE: PostgreSQL' : 'PROTOTYPE DEMO'}
            </span>
          </div>
        </div>

        {/* High-Level Metric Cards */}
        <div className="metrics-grid" style={{ marginBottom: '1.5rem' }}>
          <MetricCard
            title="Tracked Profiles"
            value={metrics.total}
            icon={Users}
            subtext="Scoped to current tenant context"
          />
          <MetricCard
            title="Decoy Engagements"
            value={metrics.decoyInteractions}
            icon={Shuffle}
            subtext="Profiles that touched synthetic endpoints"
          />
          <MetricCard
            title="Credential Stuffing"
            value={metrics.credStuffing}
            icon={ShieldAlert}
            subtext="High-velocity authentication probe vectors"
          />
        </div>

        {/* Filter Controls Bar */}
        <div className="filter-bar" style={{ marginBottom: '1rem' }}>
          <div className="filter-group-stretch">
            <div style={{ position: 'relative', flex: 1 }}>
              <Search
                size={16}
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
              />
              <input
                type="text"
                className="cyber-input"
                style={{ paddingLeft: '36px', width: '100%' }}
                placeholder="Search by profile identifier, label, or behavioral classification..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <select
              className="cyber-select"
              value={classificationFilter}
              onChange={(e) => setClassificationFilter(e.target.value)}
            >
              <option value="all">All Classifications</option>
              <option value="Decoy interaction observed">Decoy interaction observed</option>
              <option value="Repeated authentication failures">Repeated authentication failures</option>
              <option value="Multiple suspicious indicators">Multiple suspicious indicators</option>
            </select>
          </div>
        </div>

        {/* Profiles Table */}
        {filteredProfiles.length === 0 ? (
          <EmptyState
            title="No Attacker Profiles Found"
            description="No behavioral profile records match the current filter criteria."
            actionText="Reset Filters"
            onAction={() => {
              setSearchTerm('');
              setClassificationFilter('all');
            }}
          />
        ) : (
          <div className="cyber-table-container">
            <table className="cyber-table">
              <thead>
                <tr>
                  <th>Profile Identifier</th>
                  <th>Display Label (Heuristic)</th>
                  <th>Behavioral Classification</th>
                  <th>Decoy Interactivity</th>
                  <th>Last Observed</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedList.map((prof) => (
                  <tr key={prof.id}>
                    <td>
                      <Link
                        to={`/admin/attacker-profiles/${prof.id}`}
                        style={{
                          fontWeight: 600,
                          color: '#c084fc',
                          textDecoration: 'none',
                          fontFamily: 'var(--font-mono)'
                        }}
                      >
                        {prof.id}
                      </Link>
                    </td>
                    <td>
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>
                        {prof.displayLabel}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Tenant: {prof.tenantName}
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: '4px',
                          background: prof.decoyInteractionCount > 0 ? 'rgba(192, 132, 252, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                          color: prof.decoyInteractionCount > 0 ? '#c084fc' : '#f87171',
                          border: `1px solid ${prof.decoyInteractionCount > 0 ? 'rgba(192, 132, 252, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                        }}
                      >
                        {prof.behavioralClassification}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '12px',
                          color: prof.decoyInteractionCount > 0 ? '#34d399' : 'var(--text-muted)'
                        }}
                      >
                        {prof.decoyInteractionCount} Decoy Probes
                      </span>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {prof.lastSeen}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link
                        to={`/admin/attacker-profiles/${prof.id}`}
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: '12px' }}
                      >
                        View Profile →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderTop: '1px solid var(--border-default)',
                  background: 'var(--bg-surface)'
                }}
              >
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  Previous
                </button>

                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
