import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  AlertCircle,
  Database,
  Sparkles
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import EmptyState from '../../components/common/EmptyState';
import LoadingState from '../../components/common/LoadingState';
import MetricCard from '../../components/common/MetricCard';
import { useAuth } from '../../hooks/useAuth';
import { apiClient } from '../../services/apiClient';
import {
  getInvestigations as getMockInvestigations,
  getTenants,
  DEMO_DATA_DISCLAIMER
} from '../../services/mockData';

const PAGE_SIZE = 8;

export default function InvestigationsListPage() {
  const { user, activeTenant } = useAuth();
  const tenantIdentifier = activeTenant?.identifier || activeTenant?.id || 'tenant-apex-9941';

  const [investigations, setInvestigations] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState('live');
  const [fetchError, setFetchError] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('activity-desc');
  const [currentPage, setCurrentPage] = useState(1);

  const fetchLiveInvestigations = useCallback(async () => {
    setLoading(true);
    setFetchError(null);

    try {
      const [invRes, tenList] = await Promise.all([
        apiClient.getInvestigations(tenantIdentifier),
        getTenants().catch(() => [])
      ]);

      if (invRes && invRes.success && Array.isArray(invRes.data)) {
        const mapped = invRes.data.map(inv => {
          const isDiscrepancy = inv.status === 'DISCREPANCY_FLAGGED';
          return {
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
            policyDecision: 'pol-sec-06 (Containment Sandbox)',
            recordedRoutingOutcome: isDiscrepancy ? 'BLOCKED_AT_INGRESS' : 'EXECUTED_DECEPTION',
            policyDiscrepancy: isDiscrepancy,
            linkedAttackerProfiles: inv.attackerProfiles || [],
            observedBehaviorSummary: inv.summary,
            firstSeenIso: inv.openedAt,
            lastSeenIso: inv.updatedAt || inv.openedAt
          };
        });

        setInvestigations(mapped);
        setTenants(tenList);
        setDataSource('live');
        setLoading(false);
        return;
      }

      throw new Error(invRes?.error?.message || 'Failed to fetch investigations from API.');
    } catch (err) {
      setFetchError(err.message || 'Error connecting to investigations API.');
      try {
        const [mockList, tenList] = await Promise.all([
          getMockInvestigations(),
          getTenants().catch(() => [])
        ]);
        setInvestigations(mockList);
        setTenants(tenList);
        setDataSource('demo');
      } catch {
        setInvestigations([]);
      }
      setLoading(false);
    }
  }, [tenantIdentifier, activeTenant]);

  useEffect(() => {
    fetchLiveInvestigations();
  }, [fetchLiveInvestigations]);

  // Filtered & Sorted Investigations
  const filteredInvestigations = useMemo(() => {
    let result = [...investigations];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(inv =>
        (inv.id && inv.id.toLowerCase().includes(q)) ||
        (inv.tenantName && inv.tenantName.toLowerCase().includes(q)) ||
        (inv.sessionIdentifier && inv.sessionIdentifier.toLowerCase().includes(q)) ||
        (inv.attackCategory && inv.attackCategory.toLowerCase().includes(q)) ||
        (inv.applicationNames && inv.applicationNames.some(name => name.toLowerCase().includes(q))) ||
        (inv.observedBehaviorSummary && inv.observedBehaviorSummary.toLowerCase().includes(q))
      );
    }

    if (severityFilter !== 'all') {
      result = result.filter(inv => inv.severity === severityFilter);
    }

    if (statusFilter !== 'all') {
      result = result.filter(inv => inv.status === statusFilter);
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
      return 0;
    });

    return result;
  }, [investigations, searchTerm, severityFilter, statusFilter, sortBy]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, severityFilter, statusFilter, sortBy]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredInvestigations.length / PAGE_SIZE) || 1;
  const paginatedInvestigations = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredInvestigations.slice(start, start + PAGE_SIZE);
  }, [filteredInvestigations, currentPage]);

  const metrics = useMemo(() => {
    return {
      total: investigations.length,
      open: investigations.filter(i => i.status === 'OPEN').length,
      discrepancy: investigations.filter(i => i.status === 'DISCREPANCY_FLAGGED').length,
      resolved: investigations.filter(i => i.status === 'RESOLVED').length
    };
  }, [investigations]);

  if (loading) {
    return (
      <div className="page-container">
        <LoadingState message="Loading threat investigations from database..." />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Threat Investigations Queue"
        badge={dataSource === 'live' ? 'PostgreSQL Active' : 'Simulation Mode'}
        description="Correlate adversarial sessions, detector anomalies, and deceptive honeynet containment outcomes."
        actions={
          <button
            onClick={fetchLiveInvestigations}
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={13} />
            <span>Refresh</span>
          </button>
        }
      />

      <div className="page-container">
        {/* Data Source & Semantic Audit Notice */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {dataSource === 'live' ? (
              <Database size={16} style={{ color: '#10b981', flexShrink: 0 }} />
            ) : (
              <Sparkles size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
            )}
            <div>
              <span style={{ fontWeight: 700, color: dataSource === 'live' ? '#34d399' : '#93c5fd', marginRight: '6px' }}>
                {dataSource === 'live' ? 'LIVE DATABASE-BACKED (PostgreSQL via REST API):' : 'SIMULATION MODE:'}
              </span>
              <span>
                Investigations correlate observed telemetry with statistical detector models.
                <strong style={{ color: '#fff', marginLeft: '4px' }}>
                  Observed behaviors are distinguished from heuristic inferences. Discrepancy flags mark telemetry deviations.
                </strong>
              </span>
            </div>
          </div>
          <div>
            {dataSource === 'live' ? (
              <button
                onClick={() => {
                  getMockInvestigations().then(m => {
                    setInvestigations(m);
                    setDataSource('demo');
                  });
                }}
                className="btn btn-ghost btn-xs"
                style={{ fontSize: '11px', color: 'var(--text-muted)' }}
              >
                Switch to Offline Mode
              </button>
            ) : (
              <button
                onClick={fetchLiveInvestigations}
                className="btn btn-ghost btn-xs"
                style={{ fontSize: '11px', color: '#60a5fa' }}
              >
                Connect Live Database
              </button>
            )}
          </div>
        </div>

        {/* High-Level Metric Cards */}
        <div className="metrics-grid" style={{ marginBottom: '1.5rem' }}>
          <MetricCard
            title="Total Investigations"
            value={metrics.total}
            icon={Radio}
            subtext="Scoped to current tenant context"
          />
          <MetricCard
            title="Active / Open"
            value={metrics.open}
            icon={AlertTriangle}
            subtext="Pending analyst review or containment"
          />
          <MetricCard
            title="Discrepancies Flagged"
            value={metrics.discrepancy}
            icon={AlertCircle}
            subtext="Routing outcome diverged from policy"
          />
          <MetricCard
            title="Resolved"
            value={metrics.resolved}
            icon={CheckCircle2}
            subtext="Completed investigations"
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
                placeholder="Search by ID, tenant, application, category, or observed behavior..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <select
              className="cyber-select"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <select
              className="cyber-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="DISCREPANCY_FLAGGED">Discrepancy Flagged</option>
              <option value="CONTAINED">Contained</option>
              <option value="RESOLVED">Resolved</option>
            </select>
          </div>
        </div>

        {/* Table */}
        {filteredInvestigations.length === 0 ? (
          <EmptyState
            title="No Investigations Found"
            description="No threat investigations match the active filter criteria."
            actionText="Clear Filters"
            onAction={() => {
              setSearchTerm('');
              setSeverityFilter('all');
              setStatusFilter('all');
            }}
          />
        ) : (
          <div className="cyber-table-container">
            <table className="cyber-table">
              <thead>
                <tr>
                  <th>Investigation ID</th>
                  <th>Protected Application</th>
                  <th>Threat Vector / Summary</th>
                  <th>Severity</th>
                  <th>Status & Discrepancy</th>
                  <th>Linked Profiles</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedInvestigations.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <Link
                        to={`/admin/investigations/${inv.id}`}
                        style={{
                          fontWeight: 600,
                          color: 'var(--accent-primary-light)',
                          textDecoration: 'none',
                          fontFamily: 'var(--font-mono)'
                        }}
                      >
                        {inv.id}
                      </Link>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, fontSize: '13px' }}>
                        {inv.applicationNames?.[0] || 'Customer Accounts API'}
                      </span>
                    </td>
                    <td>
                      <div style={{ maxWidth: '320px', fontSize: '12px' }}>
                        <strong style={{ display: 'block', color: 'var(--text-primary)' }}>
                          {inv.attackCategory}
                        </strong>
                        <span style={{ color: 'var(--text-muted)' }}>
                          {inv.observedBehaviorSummary}
                        </span>
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={inv.severity} label={inv.severity.toUpperCase()} />
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            color: inv.policyDiscrepancy ? '#f59e0b' : '#34d399'
                          }}
                        >
                          {inv.status}
                        </span>
                        {inv.policyDiscrepancy && (
                          <span
                            style={{
                              fontSize: '10px',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              background: 'rgba(245, 158, 11, 0.12)',
                              color: '#fbbf24',
                              border: '1px solid rgba(245, 158, 11, 0.25)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <AlertCircle size={10} /> Discrepancy Flagged
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      {inv.linkedAttackerProfiles && inv.linkedAttackerProfiles.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {inv.linkedAttackerProfiles.map((p, idx) => (
                            <Link
                              key={idx}
                              to={`/admin/attacker-profiles/${p.profileIdentifier || p.id}`}
                              style={{ fontSize: '11px', color: '#c084fc', textDecoration: 'none' }}
                            >
                              {p.profileIdentifier || p.displayLabel || 'Heuristic Profile'}
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>None linked</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link
                        to={`/admin/investigations/${inv.id}`}
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: '12px' }}
                      >
                        Inspect Dossier →
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
