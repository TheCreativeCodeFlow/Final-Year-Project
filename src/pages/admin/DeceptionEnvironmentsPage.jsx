import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Network,
  Search,
  Filter,
  ArrowUpDown,
  ExternalLink,
  Shield,
  Layers,
  AlertTriangle,
  GitBranch,
  Eye,
  RefreshCw,
  Sparkles,
  Server,
  Activity,
  AlertCircle,
  Radio
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import EmptyState from '../../components/common/EmptyState';
import LoadingState from '../../components/common/LoadingState';
import MetricCard from '../../components/common/MetricCard';
import { getDeceptionEnvironments, getTenants, DEMO_DATA_DISCLAIMER } from '../../services/mockData';

const PAGE_SIZE = 6;

export default function DeceptionEnvironmentsPage() {
  const [environments, setEnvironments] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [tenantFilter, setTenantFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name-asc');
  const [currentPage, setCurrentPage] = useState(1);

  const fetchData = () => {
    setLoading(true);
    Promise.all([getDeceptionEnvironments(), getTenants()]).then(([envList, tenantList]) => {
      setEnvironments(envList);
      setTenants(tenantList);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered & Sorted Environments
  const filteredEnvironments = useMemo(() => {
    let result = [...environments];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(env =>
        env.id.toLowerCase().includes(q) ||
        env.name.toLowerCase().includes(q) ||
        env.tenantName.toLowerCase().includes(q) ||
        (env.applicationName && env.applicationName.toLowerCase().includes(q)) ||
        env.type.toLowerCase().includes(q) ||
        env.description.toLowerCase().includes(q)
      );
    }

    if (tenantFilter !== 'all') {
      result = result.filter(env => env.tenantId === tenantFilter);
    }

    if (typeFilter !== 'all') {
      result = result.filter(env => env.type === typeFilter);
    }

    if (statusFilter !== 'all') {
      result = result.filter(env => env.status === statusFilter);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
      if (sortBy === 'name-desc') return b.name.localeCompare(a.name);
      if (sortBy === 'assets-desc') return (b.activeAssetCount || 0) - (a.activeAssetCount || 0);
      if (sortBy === 'updated-desc') return new Date(b.updatedAt) - new Date(a.updatedAt);
      return 0;
    });

    return result;
  }, [environments, searchTerm, tenantFilter, typeFilter, statusFilter, sortBy]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, tenantFilter, typeFilter, statusFilter, sortBy]);

  const totalPages = Math.ceil(filteredEnvironments.length / PAGE_SIZE) || 1;
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredEnvironments.slice(start, start + PAGE_SIZE);
  }, [filteredEnvironments, currentPage]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = environments.length;
    const active = environments.filter(e => e.status === 'Active').length;
    const reviewReq = environments.filter(e => e.status === 'Review Required').length;
    const totalAssets = environments.reduce((sum, e) => sum + (e.activeAssetCount || 0), 0);
    return { total, active, reviewReq, totalAssets };
  }, [environments]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setTenantFilter('all');
    setTypeFilter('all');
    setStatusFilter('all');
    setSortBy('name-asc');
  };

  return (
    <div className="page-container">
      <PageHeader
        title="Deception Environments"
        description="Directory of synthetic decoy environments, honeynet sandbox clusters, and virtual asset topologies across gateway tenants."
        actions={
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={fetchData}
            disabled={loading}
            title="Refresh environments"
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Refresh Environments</span>
          </button>
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
          <strong style={{ color: 'var(--text-primary)' }}>SIMULATION CONTEXT:</strong> All deception environments, synthetic asset counts, and operational statuses are simulated for prototyping. Active statuses indicate simulated readiness, not live infrastructure.
        </div>
      </div>

      {/* Summary Metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}
      >
        <MetricCard
          title="Registered Environments"
          value={metrics.total}
          subtext="Configured decoy sandboxes"
          icon={Network}
        />
        <MetricCard
          title="Simulated Active"
          value={metrics.active}
          subtext="Ready for deception diversion"
          icon={Server}
        />
        <MetricCard
          title="Review Required"
          value={metrics.reviewReq}
          subtext="Air-gap or policy check needed"
          icon={AlertTriangle}
        />
        <MetricCard
          title="Total Synthetic Assets"
          value={metrics.totalAssets}
          subtext="Endpoints, credentials & traps"
          icon={Layers}
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
              placeholder="Search by ID, name, tenant, or application..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '32px', width: '100%', height: '36px', fontSize: 'var(--text-sm)' }}
            />
          </div>

          {/* Environment Type Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={14} color="var(--text-muted)" />
            <select
              className="input-field"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{ height: '36px', fontSize: 'var(--text-xs)', width: '190px' }}
            >
              <option value="all">All Environment Types</option>
              <option value="High-interaction honeynet">High-interaction honeynet</option>
              <option value="Synthetic API environment">Synthetic API environment</option>
              <option value="Low-interaction decoy">Low-interaction decoy</option>
              <option value="Synthetic enterprise network">Synthetic enterprise network</option>
            </select>
          </div>

          {/* Status Filter */}
          <select
            className="input-field"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ height: '36px', fontSize: 'var(--text-xs)', width: '140px' }}
          >
            <option value="all">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Review Required">Review Required</option>
            <option value="Maintenance">Maintenance</option>
            <option value="Provisioning">Provisioning</option>
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
              style={{ height: '36px', fontSize: 'var(--text-xs)', width: '160px' }}
            >
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="assets-desc">Synthetic Assets</option>
              <option value="updated-desc">Latest Update</option>
            </select>
          </div>
        </div>

        {/* Clear Filters */}
        {(searchTerm || tenantFilter !== 'all' || typeFilter !== 'all' || statusFilter !== 'all') && (
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

      {/* Environments Table */}
      {loading ? (
        <LoadingState message="Loading deception environments..." />
      ) : filteredEnvironments.length === 0 ? (
        <EmptyState
          title="No Deception Environments Found"
          description="No environment records match the current filter criteria."
          actionText="Reset All Filters"
          onAction={handleResetFilters}
        />
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-default)' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Environment / ID</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Tenant & Application</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Environment Type</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Simulated Status</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Synthetic Assets</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Linked Investigations</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedList.map((env) => (
                  <tr
                    key={env.id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background var(--transition-fast)'
                    }}
                    className="table-row-hover"
                  >
                    {/* Name & ID */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <Link
                          to={`/admin/deception-environments/${env.id}`}
                          style={{
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            textDecoration: 'none',
                            fontSize: 'var(--text-sm)'
                          }}
                        >
                          {env.name}
                        </Link>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '11px',
                            color: 'var(--accent-primary-light)'
                          }}
                        >
                          {env.id}
                        </span>
                      </div>
                    </td>

                    {/* Tenant & Application */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <Link
                          to={`/admin/tenants/${env.tenantId}`}
                          style={{
                            fontSize: 'var(--text-sm)',
                            color: 'var(--text-primary)',
                            fontWeight: 500,
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <span>{env.tenantName}</span>
                          <ExternalLink size={10} color="var(--text-muted)" />
                        </Link>
                        {env.applicationName && (
                          <span
                            style={{
                              fontSize: '11px',
                              color: 'var(--text-secondary)'
                            }}
                          >
                            Shielding: {env.applicationName}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Type */}
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          color: 'var(--text-primary)',
                          background: 'var(--bg-surface-elevated)',
                          border: '1px solid var(--border-subtle)',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-xs)',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {env.type}
                      </span>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '12px 16px' }}>
                      <StatusBadge
                        status={
                          env.status === 'Active'
                            ? 'operational'
                            : env.status === 'Review Required'
                            ? 'warning'
                            : env.status === 'Maintenance'
                            ? 'neutral'
                            : 'low'
                        }
                        label={`${env.status} (Simulated)`}
                        size="sm"
                      />
                    </td>

                    {/* Synthetic Assets */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Layers size={14} color="var(--accent-deception)" />
                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {env.activeAssetCount} assets
                        </span>
                      </div>
                    </td>

                    {/* Linked Investigations */}
                    <td style={{ padding: '12px 16px' }}>
                      {env.linkedInvestigationIds?.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {env.linkedInvestigationIds.map(invId => (
                            <Link
                              key={invId}
                              to={`/admin/investigations/${invId}`}
                              style={{
                                fontSize: '11px',
                                fontFamily: 'var(--font-mono)',
                                color: 'var(--accent-primary-light)',
                                background: 'rgba(59, 130, 246, 0.1)',
                                padding: '1px 6px',
                                borderRadius: 'var(--radius-xs)',
                                textDecoration: 'none'
                              }}
                            >
                              {invId}
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>None recorded</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                        <Link
                          to={`/admin/deception-environments/${env.id}`}
                          className="btn btn-secondary btn-sm"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          title="View Environment Details"
                        >
                          <Eye size={13} />
                          <span>Details</span>
                        </Link>
                        <Link
                          to={`/admin/deception-state-graph/${env.id}`}
                          className="btn btn-primary btn-sm"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          title="Open Deception State Graph Explorer"
                        >
                          <GitBranch size={13} />
                          <span>DSG Graph</span>
                        </Link>
                      </div>
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
                Showing {(currentPage - 1) * PAGE_SIZE + 1} - {Math.min(currentPage * PAGE_SIZE, filteredEnvironments.length)} of {filteredEnvironments.length} environments
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
