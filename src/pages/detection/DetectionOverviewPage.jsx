import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldAlert,
  ShieldCheck,
  Activity,
  Cpu,
  Layers,
  FileText,
  Clock,
  Compass,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Database,
  BarChart2,
  PieChart as PieIcon,
  HelpCircle,
  Eye,
  Info
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import EmptyState from '../../components/common/EmptyState';
import AssessmentDetailDrawer from './AssessmentDetailDrawer';
import { useAuth } from '../../hooks/useAuth';
import { apiClient } from '../../services/apiClient';
import './detection.css';

export default function DetectionOverviewPage() {
  const { activeTenant } = useAuth();
  const tenantIdentifier = activeTenant?.id || activeTenant?.identifier || 'tenant-apex-9941';

  const [assessments, setAssessments] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [models, setModels] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // Detail drawer state
  const [selectedAssessment, setSelectedAssessment] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setFetchError(null);

    try {
      const [assessmentsRes, modelsRes, rulesRes] = await Promise.all([
        apiClient.getDetectionAssessments(tenantIdentifier, { limit: 100 }).catch((e) => {
          return { success: false, error: e };
        }),
        apiClient.getDetectionModels(tenantIdentifier).catch((e) => {
          return { success: false, error: e };
        }),
        apiClient.getDetectionRules(tenantIdentifier).catch((e) => {
          return { success: false, error: e };
        })
      ]);

      if (assessmentsRes && assessmentsRes.success && assessmentsRes.data) {
        setAssessments(assessmentsRes.data.assessments || []);
        setTotalCount(assessmentsRes.data.total || (assessmentsRes.data.assessments ? assessmentsRes.data.assessments.length : 0));
      } else if (assessmentsRes?.error) {
        throw new Error(assessmentsRes.error.message || 'Failed to load assessments.');
      }

      if (modelsRes && modelsRes.success && modelsRes.data) {
        setModels(modelsRes.data.models || []);
      }

      if (rulesRes && rulesRes.success && rulesRes.data) {
        setRules(rulesRes.data.rules || []);
      }
    } catch (err) {
      setFetchError(err.message || 'Error communicating with detection backend.');
    } finally {
      setLoading(false);
    }
  }, [tenantIdentifier]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Aggregate metrics from real backend assessments
  const metrics = useMemo(() => {
    let normal = 0;
    let suspicious = 0;
    let highlySuspicious = 0;
    let insufficient = 0;
    let deceptionEligible = 0;

    let qualityComplete = 0;
    let qualityPartial = 0;
    let qualityLoss = 0;

    assessments.forEach((asm) => {
      const label = asm.assessmentLabel || 'NORMAL';
      if (label === 'NORMAL') normal++;
      else if (label === 'SUSPICIOUS') suspicious++;
      else if (label === 'HIGHLY_SUSPICIOUS') highlySuspicious++;
      else if (label === 'INSUFFICIENT_EVIDENCE') insufficient++;

      const expl = typeof asm.explanation === 'object' && asm.explanation !== null ? asm.explanation : {};
      const isEligible = asm.deceptionEligible !== undefined
        ? Boolean(asm.deceptionEligible)
        : Boolean(expl.deceptionEligible);

      if (isEligible) deceptionEligible++;

      if (asm.telemetryLossDetected) {
        qualityLoss++;
      } else if (asm.dataQualityState === 'PARTIAL') {
        qualityPartial++;
      } else {
        qualityComplete++;
      }
    });

    const activeModels = models.filter((m) => m.status === 'READY' || m.status === 'ACTIVE');

    return {
      total: totalCount,
      normal,
      suspicious,
      highlySuspicious,
      insufficient,
      deceptionEligible,
      qualityComplete,
      qualityPartial,
      qualityLoss,
      activeModelsCount: activeModels.length,
      totalModelsCount: models.length,
      rulesCount: rules.length
    };
  }, [assessments, totalCount, models, rules]);

  const recentAssessments = useMemo(() => {
    return assessments.slice(0, 6);
  }, [assessments]);

  return (
    <div className="detection-page">
      <PageHeader
        title="Detection & Anomaly Operations"
        subtitle={`Tenant-scoped hybrid behavioral detection engine for ${activeTenant?.displayName || 'Apex FinTech Cloud'}`}
        breadcrumbs={[
          { label: 'Security Operations', to: '/owner/overview' },
          { label: 'Detection Overview' }
        ]}
        actions={
          <div className="detection-header-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={loadDashboardData}
              disabled={loading}
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
              <span>Refresh Telemetry</span>
            </button>
            <Link to="/detection/benchmark" className="btn btn-primary btn-sm">
              <Database size={14} />
              <span>Benchmark Explorer</span>
            </Link>
          </div>
        }
      />

      {/* Provenance & Distinction Banner */}
      <div className="detection-banner detection-banner-neutral">
        <Info size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <strong>Operational Telemetry Scope</strong>
            <span className="provenance-tag provenance-live">Live Ingress Telemetry</span>
          </div>
          <div>
            Metrics on this overview are computed directly from real database-backed security observations and hybrid behavioral assessments. Controlled evaluation figures from the 24-scenario benchmark are strictly separated in the <Link to="/detection/benchmark" style={{ color: 'var(--accent-primary-light)', textDecoration: 'underline' }}>Benchmark Explorer</Link>.
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingState message="Aggregating live behavioral detection metrics..." />
      ) : fetchError ? (
        <div className="detection-card">
          <EmptyState
            icon={ShieldAlert}
            title="Failed to Load Detection Overview"
            message={fetchError}
            actionLabel="Try Again"
            onAction={loadDashboardData}
          />
        </div>
      ) : (
        <>
          {/* Top Metric Cards */}
          <div className="detection-metric-grid">
            <div className="detection-card">
              <div className="detection-card-title">
                <span>Total Assessments</span>
                <Activity size={16} style={{ color: 'var(--accent-primary-light)' }} />
              </div>
              <div className="detection-card-value">{metrics.total}</div>
              <div className="detection-card-subtitle">
                Tenant-scoped evaluated windows
              </div>
            </div>

            <div className="detection-card">
              <div className="detection-card-title">
                <span>Normal Baseline</span>
                <CheckCircle2 size={16} style={{ color: '#6ee7b7' }} />
              </div>
              <div className="detection-card-value" style={{ color: '#6ee7b7' }}>
                {metrics.normal}
              </div>
              <div className="detection-card-subtitle">
                Within learned baseline profile
              </div>
            </div>

            <div className="detection-card">
              <div className="detection-card-title">
                <span>Suspicious Anomalies</span>
                <AlertTriangle size={16} style={{ color: '#fdba74' }} />
              </div>
              <div className="detection-card-value" style={{ color: '#fdba74' }}>
                {metrics.suspicious}
              </div>
              <div className="detection-card-subtitle">
                Elevated behavioral risk
              </div>
            </div>

            <div className="detection-card">
              <div className="detection-card-title">
                <span>Highly Suspicious</span>
                <ShieldAlert size={16} style={{ color: '#fca5a5' }} />
              </div>
              <div className="detection-card-value" style={{ color: '#fca5a5' }}>
                {metrics.highlySuspicious}
              </div>
              <div className="detection-card-subtitle">
                Corroborated adversarial patterns
              </div>
            </div>

            <div className="detection-card">
              <div className="detection-card-title">
                <span>Insufficient Evidence</span>
                <HelpCircle size={16} style={{ color: '#94a3b8' }} />
              </div>
              <div className="detection-card-value" style={{ color: '#94a3b8' }}>
                {metrics.insufficient}
              </div>
              <div className="detection-card-subtitle">
                Telemetry loss or incomplete data
              </div>
            </div>

            <div className="detection-card">
              <div className="detection-card-title">
                <span>Deception Eligible</span>
                <ShieldCheck size={16} style={{ color: '#d8b4fe' }} />
              </div>
              <div className="detection-card-value" style={{ color: '#d8b4fe' }}>
                {metrics.deceptionEligible}
              </div>
              <div className="detection-card-subtitle">
                Satisfies policy diversion gates
              </div>
            </div>
          </div>

          {/* Operational Subsystems & Health Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
            {/* Telemetry Quality Health */}
            <div className="detection-card">
              <div className="detection-card-title">
                <span>Telemetry Ingestion Quality</span>
                <BarChart2 size={16} style={{ color: 'var(--accent-primary-light)' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="badge-quality badge-quality-complete">COMPLETE</span>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Full Canonical Stream</span>
                  </div>
                  <strong style={{ fontFamily: 'var(--font-mono)' }}>{metrics.qualityComplete}</strong>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="badge-quality badge-quality-partial">PARTIAL</span>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Missing Optional Fields</span>
                  </div>
                  <strong style={{ fontFamily: 'var(--font-mono)' }}>{metrics.qualityPartial}</strong>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="badge-quality badge-quality-loss">LOSS</span>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Ingestion Buffer Drops</span>
                  </div>
                  <strong style={{ fontFamily: 'var(--font-mono)' }}>{metrics.qualityLoss}</strong>
                </div>
              </div>

              <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Degraded telemetry automatically caps assessment confidence and suppresses countermeasure diversion to prevent false positives.
              </div>
            </div>

            {/* Model Lifecycle & Detection Engines */}
            <div className="detection-card">
              <div className="detection-card-title">
                <span>Active Detection Engines</span>
                <Cpu size={16} style={{ color: '#c4b5fd' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Branch A: Deterministic Rules</span>
                  <span className="status-badge status-badge-active">{metrics.rulesCount} Rules Registered</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Branch B1: Isolation Forest ML</span>
                  {metrics.activeModelsCount > 0 ? (
                    <span className="status-badge status-badge-active">{metrics.activeModelsCount} Ready Models</span>
                  ) : (
                    <span className="provenance-tag provenance-unavailable">No Trained Model</span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Branch B2: Statistical Baseline</span>
                  <span className="status-badge status-badge-active">MAD Z-Score Active</span>
                </div>
              </div>

              <div style={{ marginTop: 'auto', paddingTop: '1rem', display: 'flex', gap: '8px' }}>
                <Link to="/detection/models" className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                  Manage Models ({metrics.totalModelsCount})
                </Link>
                <Link to="/detection/rules" className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                  Rule Catalog ({metrics.rulesCount})
                </Link>
              </div>
            </div>
          </div>

          {/* Latest Detection Activity Table */}
          <div className="detection-card">
            <div className="detection-card-title">
              <span>Latest Detection Activity</span>
              <Link to="/detection/assessments" style={{ fontSize: '0.75rem', color: 'var(--accent-primary-light)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>View All Assessments</span>
                <ArrowRight size={12} />
              </Link>
            </div>

            {recentAssessments.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                No behavioral assessments recorded yet. Ingress HTTP traffic through the gateway reverse proxy will populate this timeline.
              </div>
            ) : (
              <div className="cyber-table-container">
                <table className="cyber-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Time</th>
                      <th>Application</th>
                      <th>Session</th>
                      <th>Classification</th>
                      <th>Confidence</th>
                      <th>Eligibility</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentAssessments.map((asm) => {
                      const expl = typeof asm.explanation === 'object' && asm.explanation !== null ? asm.explanation : {};
                      const isEligible = asm.deceptionEligible !== undefined
                        ? Boolean(asm.deceptionEligible)
                        : Boolean(expl.deceptionEligible);

                      const labelClass = `badge-label badge-label-${(asm.assessmentLabel || 'NORMAL').toLowerCase()}`;

                      return (
                        <tr
                          key={asm.id}
                          onClick={() => {
                            setSelectedAssessment(asm);
                            setIsDrawerOpen(true);
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          <td>
                            <code style={{ fontSize: '0.75rem', color: 'var(--accent-primary-light)' }}>
                              {String(asm.id).slice(0, 8)}...
                            </code>
                          </td>
                          <td style={{ fontSize: '0.75rem' }}>
                            {asm.assessedAt ? new Date(asm.assessedAt).toLocaleTimeString() : 'N/A'}
                          </td>
                          <td style={{ fontSize: '0.8125rem' }}>
                            {asm.application?.name || 'Customer Accounts API'}
                          </td>
                          <td>
                            <code style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              {asm.sessionRef ? String(asm.sessionRef).slice(0, 12) : 'anonymous'}
                            </code>
                          </td>
                          <td>
                            <span className={labelClass}>
                              {String(asm.assessmentLabel || 'NORMAL').replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono)' }}>
                            {asm.confidenceScore !== null && asm.confidenceScore !== undefined
                              ? `${(asm.confidenceScore * 100).toFixed(0)}%`
                              : 'N/A'}
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
                              onClick={() => {
                                setSelectedAssessment(asm);
                                setIsDrawerOpen(true);
                              }}
                              style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                            >
                              <Eye size={13} />
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
          </div>
        </>
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
