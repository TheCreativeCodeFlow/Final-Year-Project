import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Compass,
  Search,
  Filter,
  RotateCcw,
  Shield,
  Layers,
  Network,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  UserCheck,
  Activity,
  Info,
  Sliders,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  Database,
  Lock,
  Sparkles
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import MetricCard from '../../components/common/MetricCard';
import StatusBadge from '../../components/common/StatusBadge';
import EmptyState from '../../components/common/EmptyState';
import LoadingState from '../../components/common/LoadingState';
import { useAuth } from '../../hooks/useAuth';
import { apiClient } from '../../services/apiClient';
import {
  getDeceptionStrategies as getMockDeceptionStrategies,
  getDeceptionEnvironments,
  DEMO_DATA_DISCLAIMER
} from '../../services/mockData';

const CATEGORY_LABELS = {
  CONTAINMENT: 'Session Containment',
  TARPIT: 'Adaptive Latency Tarpit',
  DIVERSION: 'Reconnaissance Diversion',
  CANARY_INJECTION: 'Canary-Token Placement',
  reconnaissance_diversion: 'Reconnaissance Diversion',
  synthetic_credential_exposure: 'Synthetic Credential Exposure',
  canary_token_placement: 'Canary-Token Placement',
  session_containment: 'Session Containment',
  analyst_escalation: 'Analyst Escalation'
};

const CATEGORY_COLORS = {
  CONTAINMENT: '#ef4444',
  TARPIT: '#f59e0b',
  DIVERSION: '#38bdf8',
  CANARY_INJECTION: '#f43f5e',
  reconnaissance_diversion: '#38bdf8',
  synthetic_credential_exposure: '#f59e0b',
  canary_token_placement: '#f43f5e',
  session_containment: '#ef4444',
  analyst_escalation: '#ec4899'
};

export default function DeceptionStrategiesPage() {
  const { user, activeTenant } = useAuth();
  const tenantIdentifier = activeTenant?.identifier || activeTenant?.id || 'tenant-apex-9941';

  const [strategies, setStrategies] = useState([]);
  const [environments, setEnvironments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState('live');
  const [fetchError, setFetchError] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  const fetchLiveStrategies = useCallback(async () => {
    setLoading(true);
    setFetchError(null);

    try {
      const [stratsRes, envList] = await Promise.all([
        apiClient.getStrategies(tenantIdentifier),
        getDeceptionEnvironments().catch(() => [])
      ]);

      if (stratsRes && stratsRes.success && Array.isArray(stratsRes.data)) {
        const mapped = stratsRes.data.map(s => {
          const isBaseline = s.tenantId === null;
          return {
            id: s.strategyIdentifier || s.id,
            databaseId: s.id,
            strategyIdentifier: s.strategyIdentifier || s.id,
            tenantId: s.tenantId,
            tenantName: isBaseline ? 'Platform-Wide Strategy' : (activeTenant?.name || 'Active Tenant'),
            name: s.name,
            description: s.description,
            category: s.strategyType || 'CONTAINMENT',
            strategyType: s.strategyType,
            status: s.enabled ? 'Active (Simulated)' : 'Disabled',
            enabled: Boolean(s.enabled),
            isBaseline,
            humanReviewRequired: s.strategyType === 'CONTAINMENT',
            prerequisites: s.prerequisites || {},
            permittedStateChangeProposal: s.permittedStateChangeProposal || {},
            isolationRequirements: s.isolationRequirements || {},
            associatedEnvironmentIds: isBaseline ? ['env-apex-sandbox-01'] : ['env-apex-sandbox-01'],
            updatedAt: s.updatedAt ? new Date(s.updatedAt).toISOString() : null
          };
        });

        setStrategies(mapped);
        setEnvironments(envList);
        setDataSource('live');
        setLoading(false);
        return;
      }

      throw new Error(stratsRes?.error?.message || 'Failed to fetch strategies from API.');
    } catch (err) {
      setFetchError(err.message || 'Error connecting to deception strategies API.');
      try {
        const [mockList, envList] = await Promise.all([
          getMockDeceptionStrategies(),
          getDeceptionEnvironments().catch(() => [])
        ]);
        setStrategies(mockList);
        setEnvironments(envList);
        setDataSource('demo');
      } catch {
        setStrategies([]);
      }
      setLoading(false);
    }
  }, [tenantIdentifier, activeTenant]);

  useEffect(() => {
    fetchLiveStrategies();
  }, [fetchLiveStrategies]);

  // Filtered strategies
  const filteredStrategies = useMemo(() => {
    return strategies.filter(s => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = s.name && s.name.toLowerCase().includes(q);
        const matchesId = s.id && s.id.toLowerCase().includes(q);
        const matchesDesc = s.description && s.description.toLowerCase().includes(q);
        const catText = CATEGORY_LABELS[s.category] || s.category || '';
        const matchesCat = catText.toLowerCase().includes(q);
        if (!matchesName && !matchesId && !matchesDesc && !matchesCat) {
          return false;
        }
      }

      if (selectedCategory !== 'all' && s.category !== selectedCategory) {
        return false;
      }

      if (selectedStatus !== 'all' && s.status !== selectedStatus) {
        return false;
      }

      return true;
    });
  }, [strategies, searchQuery, selectedCategory, selectedStatus]);

  // Derived metrics
  const metrics = useMemo(() => {
    const total = strategies.length;
    const active = strategies.filter(s => s.status === 'Active (Simulated)' || s.enabled).length;
    const platformBaselines = strategies.filter(s => s.isBaseline).length;
    return {
      total,
      active,
      platformBaselines
    };
  }, [strategies]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredStrategies.length / ITEMS_PER_PAGE) || 1;
  const paginatedStrategies = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredStrategies.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredStrategies, currentPage]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedStatus('all');
    setCurrentPage(1);
  };

  if (loading) {
    return <LoadingState message="Loading deception strategy definitions from database..." />;
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Header */}
      <PageHeader
        title="Deception Strategies"
        description="Catalog of tactical deception strategies, dynamic honeynet response blueprints, and adversary friction models."
        actions={
          <button
            onClick={fetchLiveStrategies}
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        }
      />

      {/* Mandatory Execution Disclaimer Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          background: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          marginBottom: '20px',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-secondary)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Info size={18} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
          <div>
            <strong style={{ color: '#fff' }}>Strategy Definition Metadata Only:</strong>{' '}
            Strategy eligibility does not constitute proof of execution. These entries define tactical options evaluated by policy interlocks.
            <strong style={{ color: '#93c5fd', marginLeft: '4px' }}>
              Execution is never inferred from candidate eligibility.
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

      {/* Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}
      >
        <MetricCard
          title="Total Strategy Definitions"
          value={metrics.total}
          subtitle="Catalogued response blueprints"
          icon={Compass}
        />
        <MetricCard
          title="Active Eligibility Candidates"
          value={metrics.active}
          subtitle="Available for policy matching"
          icon={CheckCircle2}
        />
        <MetricCard
          title="Platform Baselines"
          value={metrics.platformBaselines}
          subtitle="Global default blueprints"
          icon={Shield}
        />
      </div>

      {/* Filter Bar */}
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
              placeholder="Search by strategy name, identifier, or category..."
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

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={handleResetFilters}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RotateCcw size={14} /> Reset
          </button>
        </div>
      </div>

      {/* Strategies Directory */}
      {filteredStrategies.length === 0 ? (
        <EmptyState
          title="No Deception Strategies Found"
          description="No tactical strategies match the selected filters."
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
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Strategy Name & ID</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Strategy Type</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Scope</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Proposed Action Model</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Eligibility Status</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedStrategies.map((strat) => {
                  const catColor = CATEGORY_COLORS[strat.category] || 'var(--accent-primary)';
                  const catLabel = CATEGORY_LABELS[strat.category] || strat.category;

                  return (
                    <tr
                      key={strat.id}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        transition: 'background 0.15s ease'
                      }}
                      className="table-row-hover"
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <Link
                          to={`/admin/deception-strategies/${strat.id}`}
                          style={{
                            fontSize: 'var(--text-sm)',
                            fontWeight: 600,
                            color: 'var(--accent-primary-light)',
                            textDecoration: 'none',
                            display: 'block',
                            marginBottom: '2px'
                          }}
                        >
                          {strat.name}
                        </Link>
                        <code style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{strat.id}</code>
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            background: `${catColor}14`,
                            border: `1px solid ${catColor}33`,
                            color: catColor,
                            fontSize: '11px',
                            fontWeight: 600
                          }}
                        >
                          {catLabel}
                        </span>
                      </td>

                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                        {strat.isBaseline ? 'Platform-Wide Default' : 'Tenant Scoped'}
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <code style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          {strat.permittedStateChangeProposal?.action || 'INJECT_DECEPTION_CONTAINER'}
                        </code>
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <StatusBadge
                          status={strat.enabled ? 'operational' : 'low'}
                          label={strat.enabled ? 'Eligible Candidate' : 'Disabled'}
                          size="sm"
                        />
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <Link
                          to={`/admin/deception-strategies/${strat.id}`}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px 8px', fontSize: '11px' }}
                        >
                          Inspect Blueprint
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
