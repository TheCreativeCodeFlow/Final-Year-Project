import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ShieldAlert,
  Search,
  Filter,
  ArrowUpDown,
  ExternalLink,
  RefreshCw,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Info,
  ChevronLeft,
  ChevronRight,
  Eye,
  Database
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import EmptyState from '../../components/common/EmptyState';
import AssessmentDetailDrawer from './AssessmentDetailDrawer';
import { useAuth } from '../../hooks/useAuth';
import { apiClient } from '../../services/apiClient';
import './detection.css';

const PAGE_SIZE = 15;

export default function AssessmentListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialLabel = searchParams.get('label') || 'ALL';

  const { activeTenant } = useAuth();
  const tenantIdentifier = activeTenant?.id || activeTenant?.identifier || 'tenant-apex-9941';

  const [assessments, setAssessments] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // Filters and search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLabel, setSelectedLabel] = useState(initialLabel);
  const [selectedApp, setSelectedApp] = useState('ALL');
  const [selectedEligibility, setSelectedEligibility] = useState('ALL');
  const [sortField, setSortField] = useState('assessedAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);

  // Detail drawer
  const [selectedAssessment, setSelectedAssessment] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Fetch applications for filter dropdown
  useEffect(() => {
    async function loadApps() {
      try {
        const res = await apiClient.getApplications(tenantIdentifier);
        if (res && res.success && Array.isArray(res.data)) {
          setApplications(res.data);
        }
      } catch {
        // Non-critical; applications dropdown will remain with 'ALL'
      }
    }
    loadApps();
  }, [tenantIdentifier]);

  // Fetch assessments from backend
  const fetchAssessments = useCallback(async () => {
    setLoading(true);
    setFetchError(null);

    try {
      const params = {
        limit: 100, // Fetch up to 100 for client-side search/sort/pagination
        offset: 0
      };
      if (selectedLabel !== 'ALL') {
        params.label = selectedLabel;
      }
      if (selectedApp !== 'ALL') {
        params.applicationId = selectedApp;
      }

      const res = await apiClient.getDetectionAssessments(tenantIdentifier, params);
      if (res && res.success && res.data) {
        setAssessments(res.data.assessments || []);
        setTotalCount(res.data.total || (res.data.assessments ? res.data.assessments.length : 0));
      } else {
        throw new Error(res?.error?.message || 'Failed to retrieve assessments.');
      }
    } catch (err) {
      setFetchError(err.message || 'Error communicating with detection backend.');
      setAssessments([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [tenantIdentifier, selectedLabel, selectedApp]);

  useEffect(() => {
    fetchAssessments();
  }, [fetchAssessments]);

  // Client filtering and sorting
  const filteredAssessments = useMemo(() => {
    return assessments
      .filter((asm) => {
        // Search filter (sessionRef, classification, id)
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const matchSession = asm.sessionRef && asm.sessionRef.toLowerCase().includes(q);
          const matchClass = asm.classification && asm.classification.toLowerCase().includes(q);
          const matchId = asm.id && asm.id.toLowerCase().includes(q);
          if (!matchSession && !matchClass && !matchId) return false;
        }

        // Deception eligibility filter
        if (selectedEligibility !== 'ALL') {
          const expl = typeof asm.explanation === 'object' && asm.explanation !== null ? asm.explanation : {};
          const isEligible = asm.deceptionEligible !== undefined
            ? Boolean(asm.deceptionEligible)
            : Boolean(expl.deceptionEligible);

          if (selectedEligibility === 'ELIGIBLE' && !isEligible) return false;
          if (selectedEligibility === 'INELIGIBLE' && isEligible) return false;
        }

        return true;
      })
      .sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        if (sortField === 'assessedAt') {
          valA = new Date(valA || 0).getTime();
          valB = new Date(valB || 0).getTime();
        } else if (typeof valA === 'number' && typeof valB === 'number') {
          // numeric comparison
        } else {
          valA = String(valA || '').toLowerCase();
          valB = String(valB || '').toLowerCase();
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [assessments, searchTerm, selectedEligibility, sortField, sortOrder]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredAssessments.length / PAGE_SIZE));
  const paginatedAssessments = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredAssessments.slice(start, start + PAGE_SIZE);
  }, [filteredAssessments, currentPage]);

  const handleRowClick = (asm) => {
    setSelectedAssessment(asm);
    setIsDrawerOpen(true);
  };

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  return (
    <div className="detection-page">
      <PageHeader
        title="Behavioral Security Assessments"
        subtitle="Investigation table of hybrid rule and machine-learning anomaly assessments"
        breadcrumbs={[
          { label: 'Detection', to: '/detection/overview' },
          { label: 'Assessments' }
        ]}
        actions={
          <div className="detection-header-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={fetchAssessments}
              disabled={loading}
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
              <span>Refresh</span>
            </button>
            <Link to="/detection/benchmark" className="btn btn-primary btn-sm">
              <Database size={14} />
              <span>Benchmark Explorer</span>
            </Link>
          </div>
        }
      />

      {/* Filter and Search Bar */}
      <div className="detection-filter-bar">
        <div className="detection-search-input">
          <input
            type="text"
            className="cyber-input"
            style={{ width: '100%', fontSize: '0.8125rem' }}
            placeholder="Search by session ref, classification, or ID..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        <div>
          <select
            className="cyber-select"
            value={selectedLabel}
            onChange={(e) => {
              setSelectedLabel(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="ALL">All Classifications</option>
            <option value="NORMAL">Normal</option>
            <option value="SUSPICIOUS">Suspicious</option>
            <option value="HIGHLY_SUSPICIOUS">Highly Suspicious</option>
            <option value="INSUFFICIENT_EVIDENCE">Insufficient Evidence</option>
          </select>
        </div>

        <div>
          <select
            className="cyber-select"
            value={selectedEligibility}
            onChange={(e) => {
              setSelectedEligibility(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="ALL">All Deception Eligibility</option>
            <option value="ELIGIBLE">Deception Eligible</option>
            <option value="INELIGIBLE">Deception Ineligible</option>
          </select>
        </div>

        {applications.length > 0 && (
          <div>
            <select
              className="cyber-select"
              value={selectedApp}
              onChange={(e) => {
                setSelectedApp(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="ALL">All Applications</option>
              {applications.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.name || app.applicationIdentifier}
                </option>
              ))}
            </select>
          </div>
        )}

        <div style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Showing <strong>{filteredAssessments.length}</strong> of <strong>{totalCount}</strong> assessments
        </div>
      </div>

      {/* Main Table View */}
      {loading ? (
        <LoadingState message="Loading tenant behavioral assessments from database..." />
      ) : fetchError ? (
        <div className="detection-card">
          <EmptyState
            icon={ShieldAlert}
            title="Failed to Load Assessments"
            message={fetchError}
            actionLabel="Try Again"
            onAction={fetchAssessments}
          />
        </div>
      ) : paginatedAssessments.length === 0 ? (
        <div className="detection-card">
          <EmptyState
            icon={ShieldAlert}
            title="No Assessments Found"
            message={
              searchTerm || selectedLabel !== 'ALL' || selectedEligibility !== 'ALL'
                ? 'No behavioral assessments match the selected filter criteria.'
                : 'No behavioral assessments have been recorded yet for this tenant.'
            }
            actionLabel={searchTerm || selectedLabel !== 'ALL' ? 'Clear Filters' : 'Refresh'}
            onAction={() => {
              setSearchTerm('');
              setSelectedLabel('ALL');
              setSelectedEligibility('ALL');
              setSelectedApp('ALL');
              fetchAssessments();
            }}
          />
        </div>
      ) : (
        <div className="cyber-table-container">
          <table className="cyber-table">
            <thead>
              <tr>
                <th onClick={() => toggleSort('id')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>ID</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
                <th onClick={() => toggleSort('assessedAt')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>Timestamp</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
                <th>Application</th>
                <th>Session Ref</th>
                <th>Classification</th>
                <th onClick={() => toggleSort('confidenceScore')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>Confidence</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
                <th>Rules</th>
                <th>ML Score</th>
                <th>Telemetry</th>
                <th>Deception Eligibility</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedAssessments.map((asm) => {
                const expl = typeof asm.explanation === 'object' && asm.explanation !== null ? asm.explanation : {};
                const isEligible = asm.deceptionEligible !== undefined
                  ? Boolean(asm.deceptionEligible)
                  : Boolean(expl.deceptionEligible);

                const labelBadgeClass = `badge-label badge-label-${(asm.assessmentLabel || 'NORMAL').toLowerCase()}`;
                const triggeredRules = Array.isArray(asm.ruleFindings)
                  ? asm.ruleFindings.filter((r) => r.triggered).length
                  : 0;

                const mlScore = asm.mlAnomalyResult?.anomalyScore;
                const isMlAnomaly = asm.mlAnomalyResult?.isAnomaly;

                return (
                  <tr
                    key={asm.id}
                    onClick={() => handleRowClick(asm)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <code style={{ fontSize: '0.75rem', color: 'var(--accent-primary-light)' }}>
                        {String(asm.id).slice(0, 8)}...
                      </code>
                    </td>
                    <td style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                      {asm.assessedAt ? new Date(asm.assessedAt).toLocaleTimeString() : 'N/A'}
                      <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                        {asm.assessedAt ? new Date(asm.assessedAt).toLocaleDateString() : ''}
                      </div>
                    </td>
                    <td style={{ fontSize: '0.8125rem' }}>
                      {asm.application?.name || 'Customer Accounts API'}
                    </td>
                    <td>
                      <code style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {asm.sessionRef ? String(asm.sessionRef).slice(0, 14) : 'anonymous'}
                      </code>
                    </td>
                    <td>
                      <span className={labelBadgeClass}>
                        {String(asm.assessmentLabel || 'NORMAL').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono)' }}>
                      {asm.confidenceScore !== null && asm.confidenceScore !== undefined
                        ? `${(asm.confidenceScore * 100).toFixed(0)}%`
                        : 'N/A'}
                    </td>
                    <td>
                      <span
                        className={`status-badge ${triggeredRules > 0 ? 'status-badge-high' : 'status-badge-active'}`}
                        style={{ fontSize: '0.6875rem' }}
                      >
                        {triggeredRules} Triggered
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.75rem',
                          color: isMlAnomaly ? '#fca5a5' : '#6ee7b7'
                        }}
                      >
                        {mlScore !== null && mlScore !== undefined ? mlScore.toFixed(3) : 'N/A'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge-quality badge-quality-${(asm.dataQualityState || 'COMPLETE').toLowerCase()}`}>
                        {asm.telemetryLossDetected ? 'LOSS' : (asm.dataQualityState || 'COMPLETE')}
                      </span>
                    </td>
                    <td>
                      <span className={`badge-eligibility ${isEligible ? 'badge-eligibility-eligible' : 'badge-eligibility-ineligible'}`}>
                        {isEligible ? 'ELIGIBLE' : 'INELIGIBLE'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleRowClick(asm)}
                        style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                      >
                        <Eye size={14} />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.75rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Page {currentPage} of {totalPages}
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft size={14} />
              <span>Previous</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              <span>Next</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Assessment Detail Drawer */}
      <AssessmentDetailDrawer
        assessment={selectedAssessment}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </div>
  );
}
