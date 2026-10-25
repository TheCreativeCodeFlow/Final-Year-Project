import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Search,
  Filter,
  ArrowUpDown,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Shield,
  Clock,
  Terminal,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import EmptyState from '../../components/common/EmptyState';
import LoadingState from '../../components/common/LoadingState';
import {
  getPlatformAuditLogs,
  getTenants,
  DEMO_DATA_DISCLAIMER
} from '../../services/mockData';

const PAGE_SIZE = 6;

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedResult, setSelectedResult] = useState('all');
  const [selectedTenant, setSelectedTenant] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRowId, setExpandedRowId] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    Promise.all([
      getPlatformAuditLogs(),
      getTenants()
    ]).then(([auditLogs, tenantList]) => {
      if (isMounted) {
        setLogs(auditLogs);
        setTenants(tenantList);
        setLoading(false);
      }
    });

    return () => { isMounted = false; };
  }, []);

  // Categories list derived from logs
  const categories = useMemo(() => {
    const set = new Set(logs.map(l => l.category).filter(Boolean));
    return Array.from(set);
  }, [logs]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    let list = [...logs];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(l =>
        l.id.toLowerCase().includes(q) ||
        l.actor.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q) ||
        l.target.toLowerCase().includes(q) ||
        (l.tenantName && l.tenantName.toLowerCase().includes(q)) ||
        (l.details && l.details.toLowerCase().includes(q))
      );
    }

    if (selectedCategory !== 'all') {
      list = list.filter(l => l.category === selectedCategory);
    }

    if (selectedResult !== 'all') {
      list = list.filter(l => l.result === selectedResult);
    }

    if (selectedTenant !== 'all') {
      list = list.filter(l => l.tenantId === selectedTenant || l.tenantId === 'all');
    }

    return list;
  }, [logs, searchTerm, selectedCategory, selectedResult, selectedTenant]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, selectedResult, selectedTenant]);

  const totalPages = Math.ceil(filteredLogs.length / PAGE_SIZE) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredLogs.slice(start, start + PAGE_SIZE);
  }, [filteredLogs, currentPage]);

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('all');
    setSelectedResult('all');
    setSelectedTenant('all');
    setExpandedRowId(null);
  };

  const toggleExpand = (id) => {
    setExpandedRowId(prev => (prev === id ? null : id));
  };

  if (loading) {
    return (
      <div className="page-container">
        <LoadingState message="Loading administrative audit history..." />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Platform Audit Log Explorer"
        badge="Compliance & Operations"
        description="Immutable administrative actions, policy alterations, and cluster scaling events across all tenant spaces."
      />

      <div className="page-container" style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
        {/* Simulation Banner */}
        <div className="demo-banner">
          <Sparkles size={16} style={{ flexShrink: 0 }} />
          <div>
            <strong>Simulated Audit Store:</strong> {DEMO_DATA_DISCLAIMER} Audit entries are simulated operational records; frontend state does not represent immutable storage.
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="cyber-card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
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
                  placeholder="Search by actor (e.g. sarah.chen), action, event ID, or target scope..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {(searchTerm || selectedCategory !== 'all' || selectedResult !== 'all' || selectedTenant !== 'all') && (
                <button className="btn btn-secondary btn-sm" onClick={clearFilters}>
                  <RotateCcw size={13} />
                  <span>Reset Filters</span>
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
              {/* Category Filter */}
              <div>
                <select
                  className="cyber-select"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  aria-label="Filter by Category"
                >
                  <option value="all">All Action Categories</option>
                  {categories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Result Filter */}
              <div>
                <select
                  className="cyber-select"
                  value={selectedResult}
                  onChange={(e) => setSelectedResult(e.target.value)}
                  aria-label="Filter by Result"
                >
                  <option value="all">All Execution Results</option>
                  <option value="Success">Success</option>
                  <option value="Denied">Denied / Unauthorized</option>
                  <option value="Failed">Failed</option>
                </select>
              </div>

              {/* Tenant Filter */}
              <div>
                <select
                  className="cyber-select"
                  value={selectedTenant}
                  onChange={(e) => setSelectedTenant(e.target.value)}
                  aria-label="Filter by Tenant"
                >
                  <option value="all">All Tenant Contexts</option>
                  {tenants.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Counter Info Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
          <span>
            Displaying <strong>{filteredLogs.length}</strong> matching audit entries
          </span>
          <span className="demo-tag">APPEND-ONLY DEMO LOG</span>
        </div>

        {/* Audit Log Table or Empty State */}
        {filteredLogs.length === 0 ? (
          <EmptyState
            title="No Audit Records Found"
            description="No administrative actions match your current search and filter parameters."
            actionText="Reset All Filters"
            onAction={clearFilters}
          />
        ) : (
          <div className="cyber-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="cyber-table-container" style={{ border: 'none' }}>
              <table className="cyber-table">
                <thead>
                  <tr>
                    <th>Log ID</th>
                    <th>Timestamp</th>
                    <th>Operator Identity</th>
                    <th>Action</th>
                    <th>Target Scope</th>
                    <th>Tenant Context</th>
                    <th>Result</th>
                    <th style={{ textAlign: 'right' }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLogs.map((log) => {
                    const isExpanded = expandedRowId === log.id;
                    return (
                      <React.Fragment key={log.id}>
                        <tr>
                          {/* Log ID */}
                          <td>
                            <span className="mono-tag" style={{ color: '#60a5fa', fontWeight: 600 }}>
                              {log.id}
                            </span>
                          </td>

                          {/* Timestamp */}
                          <td style={{ whiteSpace: 'nowrap', fontSize: '12px', color: 'var(--text-muted)' }}>
                            {log.timestamp}
                          </td>

                          {/* Operator */}
                          <td>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                              {log.actor}
                            </div>
                            {log.actorRole && (
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                {log.actorRole}
                              </div>
                            )}
                          </td>

                          {/* Action */}
                          <td>
                            <span className="mono-tag" style={{ color: '#93c5fd' }}>
                              {log.action}
                            </span>
                          </td>

                          {/* Target Scope */}
                          <td style={{ fontSize: '12px', maxWidth: '280px' }}>
                            <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={log.target}>
                              {log.target}
                            </div>
                          </td>

                          {/* Tenant Context */}
                          <td>
                            {log.tenantId && log.tenantId !== 'all' ? (
                              <Link to={`/admin/tenants/${log.tenantId}`} style={{ color: '#60a5fa', fontSize: '12px' }}>
                                {log.tenantName}
                              </Link>
                            ) : (
                              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                {log.tenantName || 'Global Platform'}
                              </span>
                            )}
                          </td>

                          {/* Result */}
                          <td>
                            <StatusBadge
                              status={log.result === 'Success' ? 'operational' : log.result === 'Denied' ? 'critical' : 'medium'}
                              label={log.result}
                            />
                          </td>

                          {/* Expand Details Action */}
                          <td style={{ textAlign: 'right' }}>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => toggleExpand(log.id)}
                              aria-label="Expand audit details"
                            >
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                          </td>
                        </tr>

                        {/* Expandable Details Drawer */}
                        {isExpanded && (
                          <tr>
                            <td colSpan={8} style={{ background: 'var(--bg-surface)', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-default)' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '12px' }}>
                                <div style={{ display: 'flex', gap: '1.5rem', color: 'var(--text-muted)' }}>
                                  <div>Source IP: <span className="mono-tag">{log.ip}</span></div>
                                  <div>Category: <span className="demo-tag">{log.category}</span></div>
                                  <div>Timestamp: <span style={{ fontFamily: 'var(--font-mono)' }}>{log.isoTimestamp || log.timestamp}</span></div>
                                </div>
                                <div style={{ color: 'var(--text-primary)', marginTop: '4px', lineHeight: 1.5 }}>
                                  <strong>Operational Details:</strong> {log.details}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
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
                Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> ({filteredLogs.length} audit records)
              </span>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={14} />
                  <span>Prev</span>
                </button>

                <button
                  className="btn btn-secondary btn-sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  aria-label="Next page"
                >
                  <span>Next</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
