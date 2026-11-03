import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Shield,
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  Info,
  CheckCircle2,
  Lock,
  Layers,
  ArrowRight,
  Database
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import EmptyState from '../../components/common/EmptyState';
import { useAuth } from '../../hooks/useAuth';
import { apiClient } from '../../services/apiClient';
import './detection.css';

export default function DetectionRulesPage() {
  const { activeTenant } = useAuth();
  const tenantIdentifier = activeTenant?.id || activeTenant?.identifier || 'tenant-apex-9941';

  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState('ALL');

  const fetchRules = useCallback(async () => {
    setLoading(true);
    setFetchError(null);

    try {
      const res = await apiClient.getDetectionRules(tenantIdentifier);
      if (res && res.success && res.data) {
        setRules(res.data.rules || []);
      } else {
        throw new Error(res?.error?.message || 'Failed to retrieve rules catalog.');
      }
    } catch (err) {
      setFetchError(err.message || 'Error communicating with detection backend.');
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, [tenantIdentifier]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const filteredRules = useMemo(() => {
    return rules.filter((r) => {
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchId = r.ruleId && r.ruleId.toLowerCase().includes(q);
        const matchName = r.name && r.name.toLowerCase().includes(q);
        const matchDesc = r.description && r.description.toLowerCase().includes(q);
        if (!matchId && !matchName && !matchDesc) return false;
      }

      if (selectedSeverity !== 'ALL' && (r.severity || '').toUpperCase() !== selectedSeverity) {
        return false;
      }

      return true;
    });
  }, [rules, searchTerm, selectedSeverity]);

  return (
    <div className="detection-page">
      <PageHeader
        title="Detection Rules Management"
        subtitle="Deterministic behavioral signatures and missing-data enforcement policies"
        breadcrumbs={[
          { label: 'Detection', to: '/detection/overview' },
          { label: 'Rule Catalog' }
        ]}
        actions={
          <div className="detection-header-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={fetchRules}
              disabled={loading}
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
              <span>Refresh Rules</span>
            </button>
            <Link to="/detection/benchmark" className="btn btn-primary btn-sm">
              <Database size={14} />
              <span>Benchmark Explorer</span>
            </Link>
          </div>
        }
      />

      {/* Platform Governance Notice */}
      <div className="detection-banner detection-banner-neutral">
        <Lock size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <strong>Platform Governance Notice:</strong> Deterministic security rule implementations and mathematical invariants are managed centrally by platform security policies to ensure tenant isolation and audit integrity. Rule conditions enforce strict missing-data semantics; missing telemetry fields produce explicit <code>MISSING_TELEMETRY</code> findings and reduce confidence to <code>0.10</code> rather than defaulting to benign zeros.
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="detection-filter-bar">
        <div className="detection-search-input">
          <input
            type="text"
            className="cyber-input"
            style={{ width: '100%', fontSize: '0.8125rem' }}
            placeholder="Search rules by name, ID, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div>
          <select
            className="cyber-select"
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>

        <div style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Showing <strong>{filteredRules.length}</strong> of <strong>{rules.length}</strong> registered rules
        </div>
      </div>

      {/* Rules Content */}
      {loading ? (
        <LoadingState message="Loading detection rules catalog..." />
      ) : fetchError ? (
        <div className="detection-card">
          <EmptyState
            icon={ShieldAlert}
            title="Failed to Load Rules"
            message={fetchError}
            actionLabel="Try Again"
            onAction={fetchRules}
          />
        </div>
      ) : filteredRules.length === 0 ? (
        <div className="detection-card">
          <EmptyState
            icon={FileText}
            title="No Matching Rules Found"
            message="No security rules match the selected filter criteria."
            actionLabel="Clear Filters"
            onAction={() => {
              setSearchTerm('');
              setSelectedSeverity('ALL');
            }}
          />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem' }}>
          {filteredRules.map((rule) => {
            const severity = (rule.severity || 'MEDIUM').toUpperCase();
            const isEnabled = rule.enabled !== false;

            return (
              <div key={rule.ruleId} className="detection-card" style={{ gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span className={`status-badge status-badge-${severity.toLowerCase()}`}>
                        {severity}
                      </span>
                      <span className="provenance-tag provenance-live">
                        v{rule.version || '1.0.0'}
                      </span>
                      <span className={`status-badge ${isEnabled ? 'status-badge-active' : 'status-badge-offline'}`} style={{ fontSize: '0.6875rem' }}>
                        {isEnabled ? 'ACTIVE' : 'DISABLED'}
                      </span>
                    </div>
                    <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {rule.name || rule.ruleId}
                    </h4>
                    <code style={{ fontSize: '0.75rem', color: 'var(--accent-primary-light)' }}>
                      {rule.ruleId}
                    </code>
                  </div>
                </div>

                <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  {rule.description || 'Deterministic behavioral evaluation rule.'}
                </p>

                {/* Required Features */}
                <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.65rem 0.75rem', borderRadius: '6px', fontSize: '0.75rem' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.6875rem', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Required Features
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {Array.isArray(rule.requiredFeatures) && rule.requiredFeatures.length > 0 ? (
                      rule.requiredFeatures.map((f, i) => (
                        <code key={i} style={{ background: 'var(--bg-surface-card)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.6875rem', color: 'var(--text-primary)' }}>
                          {f}
                        </code>
                      ))
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>Ingress Observation Telemetry</span>
                    )}
                  </div>
                </div>

                {/* Effective Thresholds */}
                {rule.thresholds && Object.keys(rule.thresholds).length > 0 && (
                  <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.65rem 0.75rem', borderRadius: '6px', fontSize: '0.75rem' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.6875rem', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Effective Thresholds
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '6px' }}>
                      {Object.entries(rule.thresholds).map(([k, v]) => (
                        <div key={k} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>{k}: </span>
                          <strong style={{ color: 'var(--text-primary)' }}>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Missing Data Semantics */}
                <div style={{ marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <strong>Missing-Data Behavior:</strong> {rule.missingDataBehavior || 'Strict: Generates MISSING_TELEMETRY finding, discounts confidence to 0.10, and prevents deception diversion.'}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
