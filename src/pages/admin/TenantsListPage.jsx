import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Search,
  Filter,
  ArrowUpDown,
  ExternalLink,
  Shield,
  Layers,
  AlertTriangle,
  Activity,
  Sparkles,
  RefreshCw,
  Building,
  CheckCircle2
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import EmptyState from '../../components/common/EmptyState';
import LoadingState from '../../components/common/LoadingState';
import { getTenants, DEMO_DATA_DISCLAIMER } from '../../services/mockData';

const PAGE_SIZE = 6;

export default function TenantsListPage() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name-asc');
  const [currentPage, setCurrentPage] = useState(1);

  const fetchTenants = () => {
    setLoading(true);
    getTenants().then((res) => {
      setTenants(res);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  // Unique tiers list for dropdown
  const tiers = useMemo(() => {
    const set = new Set(tenants.map(t => t.tier).filter(Boolean));
    return Array.from(set);
  }, [tenants]);

  // Filtered & Sorted
  const filteredTenants = useMemo(() => {
    let result = [...tenants];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(
        t =>
          t.name.toLowerCase().includes(q) ||
          t.id.toLowerCase().includes(q) ||
          t.tier.toLowerCase().includes(q) ||
          t.contactEmail.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q))
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter(t => t.status === statusFilter);
    }

    if (tierFilter !== 'all') {
      result = result.filter(t => t.tier === tierFilter);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
      if (sortBy === 'name-desc') return b.name.localeCompare(a.name);
      if (sortBy === 'apps-desc') return (b.applicationCount || 0) - (a.applicationCount || 0);
      if (sortBy === 'threats-desc') return (b.threatCount || 0) - (a.threatCount || 0);
      return 0;
    });

    return result;
  }, [tenants, searchTerm, statusFilter, tierFilter, sortBy]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, tierFilter, sortBy]);

  const totalPages = Math.ceil(filteredTenants.length / PAGE_SIZE) || 1;
  const paginatedTenants = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredTenants.slice(start, start + PAGE_SIZE);
  }, [filteredTenants, currentPage]);

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setTierFilter('all');
    setSortBy('name-asc');
  };

  if (loading) {
    return (
      <div className="page-container">
        <LoadingState message="Loading platform tenant directory..." />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Tenant Directory"
        badge="Platform Multi-Tenancy"
        description="Inspect enrolled organizations, cluster isolation domains, and service protection states."
        actions={
          <button className="btn btn-secondary btn-sm" onClick={fetchTenants} title="Refresh tenant registry">
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
        }
      />

      <div className="page-container">
        {/* Simulation Banner */}
        <div className="demo-banner">
          <Sparkles size={16} style={{ flexShrink: 0 }} />
          <div>
            <strong>Simulated Multi-Tenant Registry:</strong> {DEMO_DATA_DISCLAIMER} All customer profiles and cluster resource quotas are simulated prototypes.
          </div>
        </div>

        {/* Search, Filter & Sort Bar */}
        <div className="cyber-card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1rem',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            {/* Search Input */}
            <div style={{ position: 'relative', minWidth: '280px', flex: 1 }}>
              <Search
                size={16}
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
                className="cyber-input"
                style={{ width: '100%', paddingLeft: '32px' }}
                placeholder="Search by tenant name, ID (e.g. tenant-apex-9941), or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Filter Dropdowns */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
              <div>
                <select
                  className="cyber-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label="Filter by Status"
                >
                  <option value="all">All Tenant Statuses</option>
                  <option value="active">Active</option>
                  <option value="provisioning">Provisioning</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>

              <div>
                <select
                  className="cyber-select"
                  value={tierFilter}
                  onChange={(e) => setTierFilter(e.target.value)}
                  aria-label="Filter by Plan Tier"
                >
                  <option value="all">All Service Tiers</option>
                  {tiers.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  className="cyber-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  aria-label="Sort Tenants"
                >
                  <option value="name-asc">Name (A → Z)</option>
                  <option value="name-desc">Name (Z → A)</option>
                  <option value="apps-desc">Most Applications</option>
                  <option value="threats-desc">Highest Threats</option>
                </select>
              </div>

              {(searchTerm || statusFilter !== 'all' || tierFilter !== 'all') && (
                <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Counter Info Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
          <span>
            Showing <strong>{filteredTenants.length}</strong> of {tenants.length} enrolled organizations
          </span>
          <span className="demo-tag">EDGE CLUSTER MATRIX</span>
        </div>

        {/* Tenants Table or Empty State */}
        {filteredTenants.length === 0 ? (
          <EmptyState
            title="No Tenants Found"
            description="No enrolled tenant matches the current search and filter criteria."
            actionText="Clear All Filters"
            onAction={clearFilters}
          />
        ) : (
          <div className="cyber-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="cyber-table-container" style={{ border: 'none' }}>
              <table className="cyber-table">
                <thead>
                  <tr>
                    <th>Tenant Organization</th>
                    <th>Service Tier</th>
                    <th>Protected Apps</th>
                    <th>Status</th>
                    <th>Daily Volume</th>
                    <th>Threat Events</th>
                    <th>Decoys</th>
                    <th>Last Activity</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTenants.map((tenant) => (
                    <tr key={tenant.id}>
                      {/* Name & ID */}
                      <td>
                        <Link
                          to={`/admin/tenants/${tenant.id}`}
                          style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'block' }}
                        >
                          {tenant.name}
                        </Link>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                          <span className="mono-tag" style={{ fontSize: '11px', color: '#93c5fd' }}>{tenant.id}</span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>• {tenant.assignedIngressCluster}</span>
                        </div>
                      </td>

                      {/* Tier */}
                      <td>
                        <span className="demo-tag" style={{ backgroundColor: 'rgba(37, 99, 235, 0.12)', color: '#60a5fa' }}>
                          {tenant.tier}
                        </span>
                      </td>

                      {/* Apps Count */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Layers size={14} style={{ color: 'var(--text-muted)' }} />
                          <span style={{ fontWeight: 600 }}>{tenant.applicationCount} Apps</span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--status-success)', marginTop: '2px' }}>
                          {tenant.shieldedAppCount} Shielded
                          {tenant.monitoringAppCount > 0 && ` • ${tenant.monitoringAppCount} Monitoring`}
                        </div>
                      </td>

                      {/* Status */}
                      <td>
                        <StatusBadge
                          status={tenant.status === 'active' ? 'operational' : tenant.status === 'provisioning' ? 'medium' : 'offline'}
                          label={tenant.status}
                        />
                      </td>

                      {/* Volume */}
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                          {tenant.requestVolume}
                        </span>
                      </td>

                      {/* Threat Count */}
                      <td>
                        <span style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '12px',
                          color: tenant.threatCount > 500 ? 'var(--severity-high)' : 'var(--text-secondary)'
                        }}>
                          {tenant.threatCount} detected
                        </span>
                      </td>

                      {/* Active Decoys */}
                      <td>
                        <span className="demo-tag" style={{ backgroundColor: 'var(--accent-deception-subtle)', color: '#c084fc', borderColor: 'rgba(192, 132, 252, 0.3)' }}>
                          {tenant.activeDecoys} Decoys
                        </span>
                      </td>

                      {/* Last Activity */}
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {tenant.lastActivity}
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <Link to={`/admin/tenants/${tenant.id}`} className="btn btn-secondary btn-sm">
                          <span>Inspect →</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1.25rem',
              borderTop: '1px solid var(--border-subtle)',
              background: 'var(--bg-surface-elevated)'
            }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> ({filteredTenants.length} tenants)
              </span>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  aria-label="Previous page"
                >
                  <span>Prev</span>
                </button>

                <button
                  className="btn btn-secondary btn-sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  aria-label="Next page"
                >
                  <span>Next</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
