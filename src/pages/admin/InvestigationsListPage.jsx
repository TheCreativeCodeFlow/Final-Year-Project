import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Radio,
  Search,
  Filter,
  ArrowUpDown,
  ExternalLink,
  ShieldAlert,
  AlertTriangle,
  Layers,
  Clock,
  Users,
  CheckCircle2,
  ChevronRight,
  RefreshCw,
  Eye,
  Shuffle,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import EmptyState from '../../components/common/EmptyState';
import LoadingState from '../../components/common/LoadingState';
import MetricCard from '../../components/common/MetricCard';
import { getInvestigations, getTenants, DEMO_DATA_DISCLAIMER } from '../../services/mockData';

const PAGE_SIZE = 6;

export default function InvestigationsListPage() {
  const [investigations, setInvestigations] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tenantFilter, setTenantFilter] = useState('all');
  const [sortBy, setSortBy] = useState('activity-desc');
  const [currentPage, setCurrentPage] = useState(1);

  const fetchData = () => {
    setLoading(true);
    Promise.all([getInvestigations(), getTenants()]).then(([invList, tenantList]) => {
      setInvestigations(invList);
      setTenants(tenantList);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered & Sorted Investigations
  const filteredInvestigations = useMemo(() => {
    let result = [...investigations];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(inv =>
        inv.id.toLowerCase().includes(q) ||
        inv.tenantName.toLowerCase().includes(q) ||
        inv.sessionIdentifier.toLowerCase().includes(q) ||
        inv.attackCategory.toLowerCase().includes(q) ||
        (inv.applicationNames && inv.applicationNames.some(name => name.toLowerCase().includes(q))) ||
        inv.observedBehaviorSummary.toLowerCase().includes(q)
      );
    }

    if (severityFilter !== 'all') {
      result = result.filter(inv => inv.severity === severityFilter);
    }

    if (statusFilter !== 'all') {
      result = result.filter(inv => inv.status === statusFilter);
    }

    if (tenantFilter !== 'all') {
      result = result.filter(inv => inv.tenantId === tenantFilter);
    }

    // Sort
    const severityRank = { critical: 4, high: 3, medium: 2, low: 1 };
    result.sort((a, b) => {
      if (sortBy === 'severity-desc') {
        const diff = (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0);
        if (diff !== 0) return diff;
        return new Date(b.lastSeenIso) - new Date(a.lastSeenIso);
      }
      if (sortBy === 'activity-desc') {
        return new Date(b.lastSeenIso) - new Date(a.lastSeenIso);
      }
      if (sortBy === 'firstseen-asc') {
        return new Date(a.firstSeenIso) - new Date(b.firstSeenIso);
      }
      if (sortBy === 'firstseen-desc') {
        return new Date(b.firstSeenIso) - new Date(a.firstSeenIso);
      }
      return 0;
    });

    return result;
  }, [investigations, searchTerm, severityFilter, statusFilter, tenantFilter, sortBy]);

  // Reset page on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, severityFilter, statusFilter, tenantFilter, sortBy]);

  const totalPages = Math.ceil(filteredInvestigations.length / PAGE_SIZE) || 1;
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredInvestigations.slice(start, start + PAGE_SIZE);
  }, [filteredInvestigations, currentPage]);

  // Metrics
  const metrics = useMemo(() => {
    const active = investigations.filter(i => i.status === 'Open' || i.status === 'In Review').length;
    const critical = investigations.filter(i => i.severity === 'critical').length;
    const discrepancies = investigations.filter(i => i.policyDiscrepancy).length;
    const diverted = investigations.filter(i =>
      String(i.recordedRoutingOutcome).toLowerCase().includes('deception') ||
      String(i.recordedRoutingOutcome).toLowerCase().includes('decoy')
    ).length;

    return { active, critical, discrepancies, diverted };
  }, [investigations]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setSeverityFilter('all');
    setStatusFilter('all');
    setTenantFilter('all');
    setSortBy('activity-desc');
  };

  return (
    <div className="page-container">
      <PageHeader
        title="Threat Investigations"
        description="Simulated administrator incident queue correlating anomalous ingress sessions, detection evidence, and deception routing outcomes."
        actions={
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={fetchData}
            disabled={loading}
            title="Refresh queue"
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Refresh Queue</span>
          </button>
        }
      />

      {/* Simulated Telemetry Notice */}
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
          <strong style={{ color: 'var(--text-primary)' }}>SIMULATED TELEMETRY:</strong> All investigation records, session identifiers, and analyst assignments are synthetic demonstration artifacts. No live intrusion response or real analyst attribution is implied.
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
          title="Active Investigations"
          value={metrics.active}
          subtext="Open or In Review incidents"
          icon={Radio}
        />
        <MetricCard
          title="Critical Incidents"
          value={metrics.critical}
          subtext="High-risk session anomalies"
          icon={ShieldAlert}
        />
        <MetricCard
          title="Deception Diversions"
          value={metrics.diverted}
          subtext="Sessions routed to sandbox"
          icon={Shuffle}
        />
        <MetricCard
          title="Policy Discrepancies"
          value={metrics.discrepancies}
          subtext="Outcome differed from policy"
          icon={AlertTriangle}
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
              placeholder="Search by ID, tenant, session, or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '32px', width: '100%', height: '36px', fontSize: 'var(--text-sm)' }}
            />
          </div>

          {/* Severity Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={14} color="var(--text-muted)" />
            <select
              className="input-field"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              style={{ height: '36px', fontSize: 'var(--text-xs)', width: '140px' }}
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Status Filter */}
          <select
            className="input-field"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ height: '36px', fontSize: 'var(--text-xs)', width: '130px' }}
          >
            <option value="all">All Statuses</option>
            <option value="Open">Open</option>
            <option value="In Review">In Review</option>
            <option value="Mitigated">Mitigated</option>
            <option value="Closed">Closed</option>
          </select>

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
              style={{ height: '36px', fontSize: 'var(--text-xs)', width: '170px' }}
            >
              <option value="activity-desc">Latest Activity</option>
              <option value="severity-desc">Severity (High to Low)</option>
              <option value="firstseen-desc">First Seen (Newest)</option>
              <option value="firstseen-asc">First Seen (Oldest)</option>
            </select>
          </div>
        </div>

        {/* Clear Filters */}
        {(searchTerm || severityFilter !== 'all' || statusFilter !== 'all' || tenantFilter !== 'all') && (
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

      {/* Investigations Table */}
      {loading ? (
        <LoadingState message="Loading threat investigations..." />
      ) : filteredInvestigations.length === 0 ? (
        <EmptyState
          title="No Threat Investigations Found"
          description="No investigation records matched the selected filters and search query."
          actionText="Reset All Filters"
          onAction={handleResetFilters}
        />
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-default)' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>ID / Severity</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Tenant & Target</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Attack Category / Session</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Policy Decision vs Outcome</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Timeline</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Status</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedList.map((inv) => (
                  <tr
                    key={inv.id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background var(--transition-fast)'
                    }}
                    className="table-row-hover"
                  >
                    {/* ID & Severity */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
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
                        <StatusBadge
                          status={inv.severity}
                          label={inv.severity.toUpperCase()}
                          size="sm"
                        />
                      </div>
                    </td>

                    {/* Tenant & Applications */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <Link
                          to={`/admin/tenants/${inv.tenantId}`}
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
                          <span>{inv.tenantName}</span>
                          <ExternalLink size={11} color="var(--text-muted)" />
                        </Link>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
                          {inv.applicationNames?.map((appName, i) => (
                            <span
                              key={i}
                              style={{
                                fontSize: '11px',
                                background: 'var(--bg-surface-elevated)',
                                border: '1px solid var(--border-subtle)',
                                padding: '1px 6px',
                                borderRadius: 'var(--radius-xs)',
                                color: 'var(--text-secondary)'
                              }}
                            >
                              {appName}
                            </span>
                          ))}
                        </div>
                      </div>
                    </td>

                    {/* Category & Session */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontWeight: 500 }}>
                          {inv.attackCategory}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                          <span>Session:</span>
                          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                            {inv.sessionIdentifier}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Policy vs Routing Outcome */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Policy: </span>
                          <span>{inv.policyDecision}</span>
                        </div>
                        <div style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Outcome: </span>
                          <span
                            style={{
                              color: inv.policyDiscrepancy ? 'var(--severity-high)' : 'var(--text-primary)',
                              fontWeight: inv.policyDiscrepancy ? 600 : 400
                            }}
                          >
                            {inv.recordedRoutingOutcome || 'Unknown'}
                          </span>
                          {inv.policyDiscrepancy && (
                            <span
                              title="Outcome differed from policy"
                              style={{
                                background: 'rgba(249, 115, 22, 0.15)',
                                color: 'var(--severity-high)',
                                fontSize: '10px',
                                padding: '1px 4px',
                                borderRadius: 'var(--radius-xs)'
                              }}
                            >
                              Discrepancy
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Timeline */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '11px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          Last: <strong style={{ color: 'var(--text-primary)' }}>{inv.lastSeen}</strong>
                        </span>
                        <span style={{ color: 'var(--text-muted)' }}>
                          First: {inv.firstSeen}
                        </span>
                      </div>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <StatusBadge
                          status={inv.status === 'Open' ? 'active' : inv.status === 'In Review' ? 'warning' : inv.status === 'Mitigated' ? 'success' : 'neutral'}
                          label={inv.status}
                          size="sm"
                        />
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          {inv.eventIds?.length || 0} associated events
                        </span>
                      </div>
                    </td>

                    {/* Action */}
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <Link
                        to={`/admin/investigations/${inv.id}`}
                        className="btn btn-secondary btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Eye size={13} />
                        <span>Inspect</span>
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
                Showing {(currentPage - 1) * PAGE_SIZE + 1} - {Math.min(currentPage * PAGE_SIZE, filteredInvestigations.length)} of {filteredInvestigations.length} investigations
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
