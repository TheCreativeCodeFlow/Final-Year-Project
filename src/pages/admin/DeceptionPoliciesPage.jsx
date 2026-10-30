import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Sliders,
  Plus,
  Search,
  Filter,
  RotateCcw,
  Shield,
  Layers,
  Network,
  Clock,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  FileText,
  ExternalLink,
  Info,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Sparkles,
  Database,
  Lock
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import MetricCard from '../../components/common/MetricCard';
import StatusBadge from '../../components/common/StatusBadge';
import EmptyState from '../../components/common/EmptyState';
import LoadingState from '../../components/common/LoadingState';
import { useAuth } from '../../hooks/useAuth';
import { apiClient } from '../../services/apiClient';
import {
  getDeceptionPolicies as getMockDeceptionPolicies,
  getTenants,
  getDeceptionEnvironments,
  DEMO_DATA_DISCLAIMER
} from '../../services/mockData';

const CATEGORY_LABELS = {
  suspicious_activity_handling: 'Suspicious Activity Handling',
  deception_routing_eligibility: 'Deception Routing Eligibility',
  synthetic_asset_modification: 'Synthetic Asset Modification',
  canary_token_response: 'Canary-Token Response',
  isolation_egress_restrictions: 'Isolation & Egress Restrictions',
  session_termination: 'Session Termination',
  fail_safe_handling: 'Fail-Safe Handling'
};

const CATEGORY_COLORS = {
  suspicious_activity_handling: '#38bdf8',
  deception_routing_eligibility: '#3b82f6',
  synthetic_asset_modification: '#a855f7',
  canary_token_response: '#f43f5e',
  isolation_egress_restrictions: '#f59e0b',
  session_termination: '#ef4444',
  fail_safe_handling: '#10b981'
};

export default function DeceptionPoliciesPage() {
  const { user, activeTenant } = useAuth();

  const [policies, setPolicies] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [environments, setEnvironments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState('live'); // 'live' | 'demo'
  const [fetchError, setFetchError] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedScope, setSelectedScope] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  const tenantIdentifier = activeTenant?.identifier || activeTenant?.id || 'tenant-apex-9941';

  const fetchLivePolicies = useCallback(async () => {
    setLoading(true);
    setFetchError(null);

    try {
      const [policiesRes, tenList, envList] = await Promise.all([
        apiClient.getPolicies(tenantIdentifier),
        getTenants().catch(() => []),
        getDeceptionEnvironments().catch(() => [])
      ]);

      if (policiesRes && policiesRes.success) {
        // Map backend policies to unified structure
        const mapped = (policiesRes.data || []).map((p) => {
          const isBaseline = p.tenantId === null;
          let cat = 'suspicious_activity_handling';
          if (p.permittedActions && Array.isArray(p.permittedActions)) {
            if (p.permittedActions.includes('CONTAINMENT')) cat = 'isolation_egress_restrictions';
            else if (p.permittedActions.includes('CANARY_INJECTION')) cat = 'canary_token_response';
            else if (p.permittedActions.includes('DIVERSION')) cat = 'deception_routing_eligibility';
          }

          return {
            id: p.policyIdentifier || p.id,
            databaseId: p.id,
            policyIdentifier: p.policyIdentifier || p.id,
            name: p.name,
            description: p.description,
            scope: isBaseline ? 'platform' : 'tenant',
            tenantId: p.tenantId,
            tenantName: isBaseline ? 'Platform-Wide Baseline' : (activeTenant?.name || 'Active Tenant'),
            category: p.category || cat,
            priority: p.priority ?? 100,
            status: p.enabled ? 'Enabled (Simulated)' : 'Disabled',
            enabled: Boolean(p.enabled),
            isBaseline,
            humanReviewRequired: p.priority <= 10,
            owner: isBaseline ? 'Platform Administrator' : 'Tenant Security Lead',
            associatedStrategyIds: Array.isArray(p.permittedActions) ? p.permittedActions : [],
            triggerConditions: p.triggerConditions || {},
            requiredEvidence: p.requiredEvidenceCriteria || {},
            permittedActions: p.permittedActions || [],
            prohibitedActions: p.prohibitedActions || [],
            safetyConstraints: p.protectedIsolationConstraints || {},
            updatedAt: p.updatedAt ? new Date(p.updatedAt).toISOString() : null
          };
        });

        setPolicies(mapped);
        setTenants(tenList);
        setEnvironments(envList);
        setDataSource('live');
        setLoading(false);
        return;
      }

      throw new Error(policiesRes?.error?.message || 'Failed to fetch policies from gateway API.');
    } catch (err) {
      setFetchError(err.message || 'Error connecting to policies REST API.');
      setLoading(false);
    }
  }, [tenantIdentifier, activeTenant]);

  const loadOfflineDemoData = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const [mockList, tenList, envList] = await Promise.all([
        getMockDeceptionPolicies(),
        getTenants(),
        getDeceptionEnvironments()
      ]);
      setPolicies(mockList);
      setTenants(tenList);
      setEnvironments(envList);
      setDataSource('demo');
    } catch {
      setFetchError('Failed to load offline demonstration fixtures.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLivePolicies();
  }, [fetchLivePolicies]);

  // Filtered Policies
  const filteredPolicies = useMemo(() => {
    return policies.filter(p => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = p.name && p.name.toLowerCase().includes(q);
        const matchesId = p.id && p.id.toLowerCase().includes(q);
        const matchesDesc = p.description && p.description.toLowerCase().includes(q);
        const matchesTenant = p.tenantName && p.tenantName.toLowerCase().includes(q);
        const matchesEnv = p.environmentName && p.environmentName.toLowerCase().includes(q);
        const matchesOwner = p.owner && p.owner.toLowerCase().includes(q);
        if (!matchesName && !matchesId && !matchesDesc && !matchesTenant && !matchesEnv && !matchesOwner) {
          return false;
        }
      }

      // Category filter
      if (selectedCategory !== 'all' && p.category !== selectedCategory) {
        return false;
      }

      // Scope filter
      if (selectedScope !== 'all' && p.scope !== selectedScope) {
        return false;
      }

      // Status filter
      if (selectedStatus !== 'all' && p.status !== selectedStatus) {
        return false;
      }

      return true;
    });
  }, [policies, searchQuery, selectedCategory, selectedScope, selectedStatus]);

  // Metric Computations
  const metrics = useMemo(() => {
    return {
      total: policies.length,
      enabled: policies.filter(p => p.status === 'Enabled (Simulated)' || p.enabled === true).length,
      baseline: policies.filter(p => p.isBaseline).length,
      tenantScoped: policies.filter(p => !p.isBaseline).length
    };
  }, [policies]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredPolicies.length / ITEMS_PER_PAGE) || 1;
  const paginatedPolicies = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredPolicies.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredPolicies, currentPage]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedScope('all');
    setSelectedStatus('all');
    setCurrentPage(1);
  };

  if (loading) {
    return <LoadingState message="Loading deception policies from database..." />;
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Header */}
      <PageHeader
        title="Deception Policies"
        description="Configure, review, and validate operational deception policies governing adversary diversion, honeynet containment, and tripwire response rules."
        actions={
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={fetchLivePolicies}
              className="btn btn-secondary btn-sm"
              title="Refresh from PostgreSQL API"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={14} /> Refresh
            </button>
            <Link
              to="/admin/deception-policies/new"
              className="btn btn-primary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={16} /> Create Policy
            </Link>
          </div>
        }
      />

      {/* Data Source & Telemetry Integrity Banner */}
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
              {dataSource === 'live' ? 'LIVE DATABASE-BACKED (PostgreSQL via REST API):' : 'DEMONSTRATION MODE:'}
            </span>
            <span>
              Policy configurations represent tenant-scoped rules stored in the gateway database.
              <strong style={{ color: '#fff', marginLeft: '4px' }}>
                Policy configuration does not constitute proof of active live traffic enforcement.
              </strong>
            </span>
          </div>
        </div>
        <div>
          {dataSource === 'live' ? (
            <button
              onClick={loadOfflineDemoData}
              className="btn btn-ghost btn-xs"
              style={{ fontSize: '11px', color: 'var(--text-muted)' }}
            >
              Switch to Offline Fixtures
            </button>
          ) : (
            <button
              onClick={fetchLivePolicies}
              className="btn btn-ghost btn-xs"
              style={{ fontSize: '11px', color: '#60a5fa' }}
            >
              Connect to Live Database
            </button>
          )}
        </div>
      </div>

      {fetchError && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            fontSize: 'var(--text-xs)',
            color: '#fca5a5'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} />
            <span>{fetchError}</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={fetchLivePolicies} className="btn btn-secondary btn-xs">
              Retry Connection
            </button>
            <button onClick={loadOfflineDemoData} className="btn btn-ghost btn-xs">
              Load Offline Fixtures
            </button>
          </div>
        </div>
      )}

      {/* Metric Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}
      >
        <MetricCard
          title="Total Policies"
          value={metrics.total}
          subtitle="Accessible in current tenant context"
          icon={Sliders}
        />
        <MetricCard
          title="Active Candidate Policies"
          value={metrics.enabled}
          subtitle="Enabled for policy evaluation"
          icon={CheckCircle2}
        />
        <MetricCard
          title="Global Baselines"
          value={metrics.baseline}
          subtitle="Platform-wide baseline rules (Read-Only)"
          icon={Shield}
        />
        <MetricCard
          title="Tenant-Scoped"
          value={metrics.tenantScoped}
          subtitle="Custom rules for this tenant"
          icon={Layers}
        />
      </div>

      {/* Search & Multi-criteria Filtering Bar */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
          marginBottom: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', flex: '1 1 280px' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }}
            />
            <input
              type="text"
              placeholder="Search by policy name, ID, or description..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                width: '100%',
                background: 'var(--bg-canvas)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 12px 8px 36px',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)'
              }}
            />
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              background: 'var(--bg-canvas)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 12px',
              color: 'var(--text-primary)',
              fontSize: 'var(--text-sm)',
              cursor: 'pointer'
            }}
          >
            <option value="all">All Policy Categories</option>
            {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>

          {/* Scope Filter */}
          <select
            value={selectedScope}
            onChange={(e) => {
              setSelectedScope(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              background: 'var(--bg-canvas)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 12px',
              color: 'var(--text-primary)',
              fontSize: 'var(--text-sm)',
              cursor: 'pointer'
            }}
          >
            <option value="all">All Scopes</option>
            <option value="platform">Platform-Wide Baseline</option>
            <option value="tenant">Tenant-Scoped</option>
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              background: 'var(--bg-canvas)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 12px',
              color: 'var(--text-primary)',
              fontSize: 'var(--text-sm)',
              cursor: 'pointer'
            }}
          >
            <option value="all">All Statuses</option>
            <option value="Enabled (Simulated)">Enabled</option>
            <option value="Disabled">Disabled</option>
          </select>

          {/* Reset Filters */}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={handleResetFilters}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RotateCcw size={14} /> Reset Filters
          </button>
        </div>

        {/* Filter Results Summary */}
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>
            Showing {filteredPolicies.length} of {policies.length} deception policies
          </span>
          {filteredPolicies.length > 0 && (
            <span>
              Page {currentPage} of {totalPages}
            </span>
          )}
        </div>
      </div>

      {/* Policies Directory Table */}
      {filteredPolicies.length === 0 ? (
        <EmptyState
          title="No Deception Policies Found"
          description="No policy rules match the selected filter criteria. Try clearing search filters or create a new policy."
          actionText="Reset Filters"
          onAction={handleResetFilters}
        />
      ) : (
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            marginBottom: '20px'
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--text-xs)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-default)', background: 'var(--bg-surface)' }}>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Policy Name & ID</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Target Scope</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Category</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Priority</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Permitted Actions</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Last Modified</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPolicies.map((pol) => {
                  const catColor = CATEGORY_COLORS[pol.category] || 'var(--accent-primary)';
                  const catLabel = CATEGORY_LABELS[pol.category] || pol.category;
                  const canEdit = !pol.isBaseline || user?.isPlatformAdmin;

                  return (
                    <tr
                      key={pol.id}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        transition: 'background 0.15s ease'
                      }}
                      className="table-row-hover"
                    >
                      {/* Name & ID */}
                      <td style={{ padding: '12px 16px' }}>
                        <Link
                          to={`/admin/deception-policies/${pol.id}`}
                          style={{
                            fontSize: 'var(--text-sm)',
                            fontWeight: 600,
                            color: 'var(--accent-primary-light)',
                            textDecoration: 'none',
                            display: 'block',
                            marginBottom: '2px'
                          }}
                        >
                          {pol.name}
                        </Link>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <code style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{pol.id}</code>
                          {pol.isBaseline && (
                            <span
                              style={{
                                fontSize: '10px',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                background: 'rgba(234, 179, 8, 0.12)',
                                color: '#eab308',
                                border: '1px solid rgba(234, 179, 8, 0.25)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <Lock size={10} /> Global Baseline
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Scope & Context */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ textTransform: 'capitalize', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '2px' }}>
                          {pol.isBaseline ? 'Platform Baseline' : 'Tenant-Scoped'}
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                          {pol.tenantName || 'All Tenants'}
                        </div>
                      </td>

                      {/* Category Badge */}
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            background: `${catColor}14`,
                            border: `1px solid ${catColor}33`,
                            color: catColor,
                            fontSize: '11px',
                            fontWeight: 500
                          }}
                        >
                          {catLabel}
                        </span>
                      </td>

                      {/* Priority */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              background: pol.priority <= 10 ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-canvas)',
                              color: pol.priority <= 10 ? '#ef4444' : 'var(--text-secondary)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '11px',
                              fontWeight: 700,
                              border: `1px solid ${pol.priority <= 10 ? 'rgba(239, 68, 68, 0.3)' : 'var(--border-subtle)'}`
                            }}
                          >
                            {pol.priority}
                          </span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                            {pol.priority <= 10 ? 'High Precedence' : pol.priority <= 50 ? 'Medium' : 'Baseline'}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px 16px' }}>
                        <StatusBadge
                          status={pol.enabled ? 'operational' : 'low'}
                          label={pol.enabled ? 'Enabled' : 'Disabled'}
                          size="sm"
                        />
                      </td>

                      {/* Associated Actions/Strategies */}
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            background: 'rgba(56, 189, 248, 0.1)',
                            color: '#38bdf8',
                            border: '1px solid rgba(56, 189, 248, 0.25)'
                          }}
                        >
                          {pol.associatedStrategyIds?.length || 0} Actions Permitted
                        </span>
                      </td>

                      {/* Last Modified */}
                      <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '11px' }}>
                        {pol.updatedAt ? pol.updatedAt.slice(0, 10) : 'Not Recorded'}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <Link
                            to={`/admin/deception-policies/${pol.id}`}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 8px', fontSize: '11px' }}
                          >
                            View
                          </Link>
                          {canEdit ? (
                            <Link
                              to={`/admin/deception-policies/${pol.id}/edit`}
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '4px 8px', fontSize: '11px' }}
                            >
                              Edit
                            </Link>
                          ) : (
                            <span
                              title="Global baseline policies can only be edited by Platform Administrators."
                              style={{
                                padding: '4px 8px',
                                fontSize: '11px',
                                color: 'var(--text-muted)',
                                cursor: 'not-allowed',
                                opacity: 0.6
                              }}
                            >
                              Locked
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

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
                <ChevronLeft size={14} /> Previous
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
                Next <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
