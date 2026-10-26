import React, { useState, useEffect, useMemo } from 'react';
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
  ExternalLink
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import MetricCard from '../../components/common/MetricCard';
import StatusBadge from '../../components/common/StatusBadge';
import EmptyState from '../../components/common/EmptyState';
import LoadingState from '../../components/common/LoadingState';
import {
  getDeceptionStrategies,
  getDeceptionEnvironments,
  DEMO_DATA_DISCLAIMER
} from '../../services/mockData';

const CATEGORY_LABELS = {
  reconnaissance_diversion: 'Reconnaissance Diversion',
  synthetic_credential_exposure: 'Synthetic Credential Exposure',
  canary_token_placement: 'Canary-Token Placement',
  synthetic_lateral_path_construction: 'Synthetic Lateral Path Construction',
  observation_intensification: 'Observation Intensification',
  session_containment: 'Session Containment',
  analyst_escalation: 'Analyst Escalation'
};

const CATEGORY_COLORS = {
  reconnaissance_diversion: '#38bdf8',
  synthetic_credential_exposure: '#f59e0b',
  canary_token_placement: '#f43f5e',
  synthetic_lateral_path_construction: '#a855f7',
  observation_intensification: '#3b82f6',
  session_containment: '#ef4444',
  analyst_escalation: '#ec4899'
};

export default function DeceptionStrategiesPage() {
  const [strategies, setStrategies] = useState([]);
  const [environments, setEnvironments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedEnvType, setSelectedEnvType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getDeceptionStrategies(),
      getDeceptionEnvironments()
    ]).then(([stratList, envList]) => {
      setStrategies(stratList);
      setEnvironments(envList);
      setLoading(false);
    });
  }, []);

  // Filtered strategies
  const filteredStrategies = useMemo(() => {
    return strategies.filter(s => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = s.name.toLowerCase().includes(q);
        const matchesId = s.id.toLowerCase().includes(q);
        const matchesDesc = s.description.toLowerCase().includes(q);
        const matchesCat = (CATEGORY_LABELS[s.category] || s.category).toLowerCase().includes(q);
        if (!matchesName && !matchesId && !matchesDesc && !matchesCat) {
          return false;
        }
      }

      // Category
      if (selectedCategory !== 'all' && s.category !== selectedCategory) {
        return false;
      }

      // Environment Type
      if (selectedEnvType !== 'all') {
        if (!s.applicableEnvironmentTypes || !s.applicableEnvironmentTypes.includes(selectedEnvType)) {
          return false;
        }
      }

      // Status
      if (selectedStatus !== 'all' && s.status !== selectedStatus) {
        return false;
      }

      return true;
    });
  }, [strategies, searchQuery, selectedCategory, selectedEnvType, selectedStatus]);

  // Derived metrics
  const metrics = useMemo(() => {
    const total = strategies.length;
    const active = strategies.filter(s => s.status === 'Active (Simulated)').length;
    const reviewReq = strategies.filter(s => s.humanReviewRequired || s.status === 'Under Review').length;
    const allEnvIds = new Set();
    strategies.forEach(s => {
      if (Array.isArray(s.associatedEnvironmentIds)) {
        s.associatedEnvironmentIds.forEach(id => allEnvIds.add(id));
      }
    });
    return {
      total,
      active,
      reviewReq,
      associatedEnvs: allEnvIds.size
    };
  }, [strategies]);

  // Distinct environment types for filter
  const distinctEnvTypes = useMemo(() => {
    const types = new Set();
    strategies.forEach(s => {
      if (Array.isArray(s.applicableEnvironmentTypes)) {
        s.applicableEnvironmentTypes.forEach(t => types.add(t));
      }
    });
    return Array.from(types).sort();
  }, [strategies]);

  // Pagination slice
  const totalPages = Math.ceil(filteredStrategies.length / ITEMS_PER_PAGE) || 1;
  const paginatedStrategies = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredStrategies.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredStrategies, currentPage]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedEnvType('all');
    setSelectedStatus('all');
    setCurrentPage(1);
  };

  if (loading) {
    return <LoadingState message="Loading deception strategy catalog, preconditions, and simulated responses..." />;
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Header */}
      <PageHeader
        title="Deception Strategies"
        description="Catalog of adaptive deception tactics, decoy orchestration rules, and synthetic state mutations evaluated against observed adversary telemetry."
        actions={
          <Link
            to="/admin/deception-policies"
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Sliders size={16} /> View Governing Policies
          </Link>
        }
      />

      {/* Demonstration Alert Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 16px',
          marginBottom: '20px',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-secondary)'
        }}
      >
        <Info size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <strong style={{ color: '#fff' }}>Demonstration Strategy Control Plane:</strong>{' '}
          {DEMO_DATA_DISCLAIMER} All strategy execution candidates, precondition interlocks, and intended synthetic state changes are simulated models for evaluation and research preview.
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
          title="Total Strategies"
          value={metrics.total}
          subtitle="Tactical deception blueprints"
          icon={Compass}
        />
        <MetricCard
          title="Active (Simulated)"
          value={metrics.active}
          subtitle="Eligible for automated trigger"
          icon={CheckCircle2}
        />
        <MetricCard
          title="Human Review Required"
          value={metrics.reviewReq}
          subtitle="Mandates analyst sign-off"
          icon={UserCheck}
        />
        <MetricCard
          title="Target Environments"
          value={metrics.associatedEnvs}
          subtitle="Sandbox namespaces linked"
          icon={Layers}
        />
      </div>

      {/* Search & Filters */}
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
          {/* Search */}
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
              placeholder="Search by strategy name, ID, tactic, or keyword..."
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)'
              }}
            />
          </div>

          {/* Category Filter */}
          <div style={{ minWidth: '180px' }}>
            <select
              value={selectedCategory}
              onChange={e => {
                setSelectedCategory(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)'
              }}
            >
              <option value="all">All Categories</option>
              {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Environment Type Filter */}
          <div style={{ minWidth: '180px' }}>
            <select
              value={selectedEnvType}
              onChange={e => {
                setSelectedEnvType(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)'
              }}
            >
              <option value="all">All Environment Types</option>
              {distinctEnvTypes.map(t => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div style={{ minWidth: '160px' }}>
            <select
              value={selectedStatus}
              onChange={e => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)'
              }}
            >
              <option value="all">All Statuses</option>
              <option value="Active (Simulated)">Active (Simulated)</option>
              <option value="Under Review">Under Review</option>
              <option value="Draft">Draft</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          {/* Reset */}
          {(searchQuery || selectedCategory !== 'all' || selectedEnvType !== 'all' || selectedStatus !== 'all') && (
            <button
              onClick={handleResetFilters}
              className="btn btn-ghost btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}
            >
              <RotateCcw size={14} /> Reset
            </button>
          )}
        </div>
      </div>

      {/* Strategies List / Table */}
      {filteredStrategies.length === 0 ? (
        <EmptyState
          icon={Compass}
          title="No Deception Strategies Match Filter"
          description="Adjust your search query or reset the filter criteria to browse simulated deception tactics."
          action={
            <button onClick={handleResetFilters} className="btn btn-secondary btn-sm">
              Reset Filters
            </button>
          }
        />
      ) : (
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden'
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-default)', background: 'var(--bg-surface)' }}>
                  <th style={{ padding: '12px 16px', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Strategy & Category
                  </th>
                  <th style={{ padding: '12px 16px', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Target Environments
                  </th>
                  <th style={{ padding: '12px 16px', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Compatible Policies
                  </th>
                  <th style={{ padding: '12px 16px', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Safety Boundaries
                  </th>
                  <th style={{ padding: '12px 16px', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Human Sign-Off
                  </th>
                  <th style={{ padding: '12px 16px', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Status
                  </th>
                  <th style={{ padding: '12px 16px', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedStrategies.map(strategy => {
                  const catLabel = CATEGORY_LABELS[strategy.category] || strategy.category;
                  const catColor = CATEGORY_COLORS[strategy.category] || 'var(--accent-primary)';
                  const constraintsCount = Array.isArray(strategy.safetyConstraints) ? strategy.safetyConstraints.length : 0;
                  const envCount = Array.isArray(strategy.associatedEnvironmentIds) ? strategy.associatedEnvironmentIds.length : 0;

                  return (
                    <tr
                      key={strategy.id}
                      style={{
                        borderBottom: '1px solid var(--border-default)',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* Name & Category */}
                      <td style={{ padding: '14px 16px', maxWidth: '320px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <Link
                            to={`/admin/deception-strategies/${strategy.id}`}
                            style={{
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                              fontSize: 'var(--text-sm)',
                              textDecoration: 'none'
                            }}
                            onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-primary)')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                          >
                            {strategy.name}
                          </Link>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <code style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{strategy.id}</code>
                            <span
                              style={{
                                display: 'inline-block',
                                fontSize: '11px',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                background: `${catColor}15`,
                                color: catColor,
                                border: `1px solid ${catColor}30`,
                                fontWeight: 500
                              }}
                            >
                              {catLabel}
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: 'var(--text-xs)',
                              color: 'var(--text-secondary)',
                              marginTop: '2px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                            title={strategy.description}
                          >
                            {strategy.description}
                          </div>
                        </div>
                      </td>

                      {/* Applicable Environment Types */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '240px' }}>
                            {strategy.applicableEnvironmentTypes?.slice(0, 2).map((t, i) => (
                              <span
                                key={i}
                                style={{
                                  fontSize: '11px',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  background: 'var(--bg-surface)',
                                  border: '1px solid var(--border-default)',
                                  color: 'var(--text-secondary)'
                                }}
                              >
                                {t}
                              </span>
                            ))}
                            {strategy.applicableEnvironmentTypes?.length > 2 && (
                              <span
                                style={{
                                  fontSize: '11px',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  background: 'var(--bg-surface)',
                                  color: 'var(--text-muted)'
                                }}
                              >
                                +{strategy.applicableEnvironmentTypes.length - 2} more
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {envCount} linked environment{envCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </td>

                      {/* Compatible Policies */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '200px' }}>
                          {strategy.compatiblePolicyIds?.map(polId => (
                            <Link
                              key={polId}
                              to={`/admin/deception-policies/${polId}`}
                              style={{
                                fontSize: '11px',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: 'rgba(59, 130, 246, 0.1)',
                                border: '1px solid rgba(59, 130, 246, 0.25)',
                                color: '#60a5fa',
                                textDecoration: 'none'
                              }}
                            >
                              {polId}
                            </Link>
                          ))}
                        </div>
                      </td>

                      {/* Safety Boundaries */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Shield size={14} style={{ color: 'var(--accent-primary)' }} />
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                            {constraintsCount} constraint{constraintsCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </td>

                      {/* Human Review Required */}
                      <td style={{ padding: '14px 16px' }}>
                        {strategy.humanReviewRequired ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              background: 'rgba(245, 158, 11, 0.12)',
                              color: '#fbbf24',
                              border: '1px solid rgba(245, 158, 11, 0.25)',
                              fontWeight: 500
                            }}
                          >
                            <AlertTriangle size={12} /> Required
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              background: 'rgba(16, 185, 129, 0.1)',
                              color: '#34d399',
                              border: '1px solid rgba(16, 185, 129, 0.2)',
                              fontWeight: 500
                            }}
                          >
                            <CheckCircle2 size={12} /> Automated
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 16px' }}>
                        <StatusBadge status={strategy.status} />
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <Link
                          to={`/admin/deception-strategies/${strategy.id}`}
                          className="btn btn-ghost btn-sm"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: 'var(--text-xs)'
                          }}
                        >
                          Details <ArrowRight size={14} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div
            style={{
              padding: '12px 16px',
              borderTop: '1px solid var(--border-default)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'var(--bg-surface)',
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)'
            }}
          >
            <div>
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
              {Math.min(currentPage * ITEMS_PER_PAGE, filteredStrategies.length)} of {filteredStrategies.length}{' '}
              strategies
            </div>
            {totalPages > 1 && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="btn btn-ghost btn-sm"
                  style={{ padding: '4px 8px' }}
                >
                  <ChevronLeft size={16} />
                </button>
                <span>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="btn btn-ghost btn-sm"
                  style={{ padding: '4px 8px' }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
