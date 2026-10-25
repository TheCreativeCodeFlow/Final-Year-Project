import React, { useState, useEffect, useMemo } from 'react';
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
  AlertCircle
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import EmptyState from '../../components/common/EmptyState';
import LoadingState from '../../components/common/LoadingState';
import MetricCard from '../../components/common/MetricCard';
import { getAttackerProfiles, getTenants, DEMO_DATA_DISCLAIMER } from '../../services/mockData';

const PAGE_SIZE = 6;

export default function AttackerProfilesListPage() {
  const [profiles, setProfiles] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [tenantFilter, setTenantFilter] = useState('all');
  const [classificationFilter, setClassificationFilter] = useState('all');
  const [sortBy, setSortBy] = useState('activity-desc');
  const [currentPage, setCurrentPage] = useState(1);

  const fetchData = () => {
    setLoading(true);
    Promise.all([getAttackerProfiles(), getTenants()]).then(([profileList, tenantList]) => {
      setProfiles(profileList);
      setTenants(tenantList);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered & Sorted Profiles
  const filteredProfiles = useMemo(() => {
    let result = [...profiles];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(p =>
        p.id.toLowerCase().includes(q) ||
        (p.sessionIdentifiers && p.sessionIdentifiers.some(s => s.toLowerCase().includes(q))) ||
        p.tenantName.toLowerCase().includes(q) ||
        p.behavioralClassification.toLowerCase().includes(q) ||
        (p.applicationNames && p.applicationNames.some(name => name.toLowerCase().includes(q)))
      );
    }

    if (tenantFilter !== 'all') {
      result = result.filter(p => p.tenantId === tenantFilter);
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
      if (sortBy === 'requests-desc') {
        return (b.observedRequestCount || 0) - (a.observedRequestCount || 0);
      }
      if (sortBy === 'decoys-desc') {
        return (b.decoyInteractionCount || 0) - (a.decoyInteractionCount || 0);
      }
      return 0;
    });

    return result;
  }, [profiles, searchTerm, tenantFilter, classificationFilter, sortBy]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, tenantFilter, classificationFilter, sortBy]);

  const totalPages = Math.ceil(filteredProfiles.length / PAGE_SIZE) || 1;
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredProfiles.slice(start, start + PAGE_SIZE);
  }, [filteredProfiles, currentPage]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const totalProfiles = profiles.length;
    const withDecoy = profiles.filter(p => p.decoyInteractionCount > 0).length;
    const authFailures = profiles.reduce((acc, p) => acc + (p.observedAuthFailures || 0), 0);
    const multiVector = profiles.filter(p => p.behavioralClassification === 'Multiple suspicious indicators').length;

    return { totalProfiles, withDecoy, authFailures, multiVector };
  }, [profiles]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setTenantFilter('all');
    setClassificationFilter('all');
    setSortBy('activity-desc');
  };

  return (
    <div className="page-container">
      <PageHeader
        title="Attacker Behavior Profiles"
        description="Behavioral clustering of anomalous sessions and observed attack patterns across gateway tenants. Attribution is simulated."
        actions={
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={fetchData}
            disabled={loading}
            title="Refresh profiles"
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Refresh Directory</span>
          </button>
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
          <strong style={{ color: 'var(--text-primary)' }}>BEHAVIORAL ATTRIBUTION DISCLAIMER:</strong> Profiles reflect observed heuristic telemetry and session clustering, not verified real-world actor identities or forensic proof.
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}
      >
        <MetricCard
          title="Profiles Tracked"
          value={metrics.totalProfiles}
          subtext="Simulated behavioral clusters"
          icon={ShieldAlert}
        />
        <MetricCard
          title="Decoy Engaged"
          value={metrics.withDecoy}
          subtext="Profiles triggering honeynets"
          icon={Shuffle}
        />
        <MetricCard
          title="Observed Auth Failures"
          value={metrics.authFailures}
          subtext="Credential spraying attempts"
          icon={AlertTriangle}
        />
        <MetricCard
          title="Multi-Vector Profiles"
          value={metrics.multiVector}
          subtext="Multiple suspicious indicators"
          icon={Activity}
        />
      </div>

      {/* Filter and Search Bar */}
      <div
        className="card"
        style={{
          padding: '1rem',
          marginBottom: '1.25rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', flex: 1, minWidth: '280px' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', minWidth: '240px', flex: 1 }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }}
            />
            <input
              type="text"
              className="input-field"
              placeholder="Search by Profile ID or session identifier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '32px', width: '100%', height: '36px', fontSize: 'var(--text-sm)' }}
            />
          </div>

          {/* Classification Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={14} color="var(--text-muted)" />
            <select
              className="input-field"
              value={classificationFilter}
              onChange={(e) => setClassificationFilter(e.target.value)}
              style={{ height: '36px', fontSize: 'var(--text-xs)', width: '200px' }}
            >
              <option value="all">All Classifications</option>
              <option value="Decoy interaction observed">Decoy interaction observed</option>
              <option value="Reconnaissance-like behavior">Reconnaissance-like behavior</option>
              <option value="Repeated authentication failures">Repeated auth failures</option>
              <option value="Multiple suspicious indicators">Multiple suspicious indicators</option>
              <option value="Unclassified">Unclassified</option>
            </select>
          </div>

          {/* Tenant Filter */}
          <select
            className="input-field"
            value={tenantFilter}
            onChange={(e) => setTenantFilter(e.target.value)}
            style={{ height: '36px', fontSize: 'var(--text-xs)', width: '170px' }}
          >
            <option value="all">All Tenants</option>
            {tenants.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          {/* Sort By */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ArrowUpDown size={14} color="var(--text-muted)" />
            <select
              className="input-field"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{ height: '36px', fontSize: 'var(--text-xs)', width: '160px' }}
            >
              <option value="activity-desc">Latest Activity</option>
              <option value="events-desc">Event Count</option>
              <option value="requests-desc">Observed Requests</option>
              <option value="decoys-desc">Decoy Engagements</option>
            </select>
          </div>
        </div>

        {/* Clear Filters */}
        {(searchTerm || tenantFilter !== 'all' || classificationFilter !== 'all') && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={handleResetFilters}
            style={{ fontSize: 'var(--text-xs)', color: 'var(--accent-primary-light)' }}
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Profiles Table */}
      {loading ? (
        <LoadingState message="Loading attacker behavior profiles..." />
      ) : filteredProfiles.length === 0 ? (
        <EmptyState
          title="No Attacker Profiles Found"
          description="No behavioral profile records match the current filter criteria."
          actionText="Reset All Filters"
          onAction={handleResetFilters}
        />
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-default)' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Profile ID / Sessions</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Tenant & Target Apps</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Behavioral Classification</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Telemetry Metrics</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Decoy Engagements</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Last Activity</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedList.map((prof) => (
                  <tr
                    key={prof.id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background var(--transition-fast)'
                    }}
                    className="table-row-hover"
                  >
                    {/* Profile ID & Sessions */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <Link
                          to={`/admin/attacker-profiles/${prof.id}`}
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 600,
                            color: 'var(--accent-primary-light)',
                            textDecoration: 'none'
                          }}
                        >
                          {prof.id}
                        </Link>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                          {prof.sessionIdentifiers?.slice(0, 2).map((s, i) => (
                            <span
                              key={i}
                              style={{
                                fontSize: '10px',
                                fontFamily: 'var(--font-mono)',
                                color: 'var(--text-secondary)',
                                background: 'var(--bg-surface)',
                                padding: '1px 4px',
                                borderRadius: 'var(--radius-xs)'
                              }}
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    </td>

                    {/* Tenant & Apps */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <Link
                          to={`/admin/tenants/${prof.tenantId}`}
                          style={{
                            color: 'var(--text-primary)',
                            fontSize: 'var(--text-sm)',
                            fontWeight: 500,
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <span>{prof.tenantName}</span>
                          <ExternalLink size={11} color="var(--text-muted)" />
                        </Link>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {prof.applicationNames?.map((app, i) => (
                            <span
                              key={i}
                              style={{
                                fontSize: '11px',
                                color: 'var(--text-muted)',
                                background: 'var(--bg-surface-elevated)',
                                padding: '1px 5px',
                                borderRadius: 'var(--radius-xs)'
                              }}
                            >
                              {app}
                            </span>
                          ))}
                        </div>
                      </div>
                    </td>

                    {/* Classification */}
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-pill)',
                          background:
                            prof.behavioralClassification === 'Decoy interaction observed'
                              ? 'rgba(139, 92, 246, 0.15)'
                              : prof.behavioralClassification === 'Repeated authentication failures'
                              ? 'rgba(239, 68, 68, 0.15)'
                              : prof.behavioralClassification === 'Multiple suspicious indicators'
                              ? 'rgba(249, 115, 22, 0.15)'
                              : 'rgba(100, 116, 139, 0.15)',
                          color:
                            prof.behavioralClassification === 'Decoy interaction observed'
                              ? 'var(--accent-deception)'
                              : prof.behavioralClassification === 'Repeated authentication failures'
                              ? 'var(--severity-critical)'
                              : prof.behavioralClassification === 'Multiple suspicious indicators'
                              ? 'var(--severity-high)'
                              : 'var(--text-secondary)',
                          border: '1px solid var(--border-subtle)'
                        }}
                      >
                        {prof.behavioralClassification}
                      </span>
                    </td>

                    {/* Telemetry Metrics */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '11px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          Requests: <strong style={{ color: 'var(--text-primary)' }}>{prof.observedRequestCount}</strong>
                        </span>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          Auth Failures: <strong style={{ color: prof.observedAuthFailures > 0 ? 'var(--severity-critical)' : 'var(--text-muted)' }}>{prof.observedAuthFailures}</strong>
                        </span>
                        <span style={{ color: 'var(--text-muted)' }}>
                          Distinct Endpoints: {prof.distinctEndpointCount}
                        </span>
                      </div>
                    </td>

                    {/* Decoy Engagements */}
                    <td style={{ padding: '12px 16px' }}>
                      {prof.decoyInteractionCount > 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Shuffle size={14} color="var(--accent-deception)" />
                          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--accent-deception)' }}>
                            {prof.decoyInteractionCount} actions
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          0 recorded
                        </span>
                      )}
                    </td>

                    {/* Last Activity */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        <div>{prof.lastSeen}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>First: {prof.firstSeen}</div>
                      </div>
                    </td>

                    {/* Action */}
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <Link
                        to={`/admin/attacker-profiles/${prof.id}`}
                        className="btn btn-secondary btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Eye size={13} />
                        <span>Profile</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.75rem 1rem',
                borderTop: '1px solid var(--border-default)',
                background: 'var(--bg-surface-elevated)'
              }}
            >
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                Showing {(currentPage - 1) * PAGE_SIZE + 1} - {Math.min(currentPage * PAGE_SIZE, filteredProfiles.length)} of {filteredProfiles.length} profiles
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 8px',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-secondary)'
                  }}
                >
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
