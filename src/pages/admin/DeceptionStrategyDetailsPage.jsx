import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Compass,
  Shield,
  Layers,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sliders,
  ExternalLink,
  Info,
  Network,
  UserCheck,
  Zap,
  Activity,
  FileText,
  Database,
  RefreshCw
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingState from '../../components/common/LoadingState';
import { useAuth } from '../../hooks/useAuth';
import { apiClient } from '../../services/apiClient';
import {
  getDeceptionStrategyById as getMockDeceptionStrategyById,
  getDeceptionPolicies,
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

export default function DeceptionStrategyDetailsPage() {
  const { strategyId } = useParams();
  const { activeTenant } = useAuth();
  const tenantIdentifier = activeTenant?.identifier || activeTenant?.id || 'tenant-apex-9941';

  const [strategy, setStrategy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState('live');
  const [fetchError, setFetchError] = useState(null);

  const fetchLiveStrategy = useCallback(async () => {
    setLoading(true);
    setFetchError(null);

    try {
      const res = await apiClient.getStrategyById(tenantIdentifier, strategyId);

      if (res && res.success && res.data) {
        const raw = res.data;
        const isBaseline = raw.tenantId === null;

        const mapped = {
          id: raw.strategyIdentifier || raw.id,
          databaseId: raw.id,
          strategyIdentifier: raw.strategyIdentifier || raw.id,
          tenantId: raw.tenantId,
          tenantName: isBaseline ? 'Platform-Wide Baseline' : (activeTenant?.name || 'Active Tenant'),
          name: raw.name,
          description: raw.description,
          category: raw.strategyType || 'CONTAINMENT',
          strategyType: raw.strategyType,
          status: raw.enabled ? 'Active (Simulated)' : 'Disabled',
          enabled: Boolean(raw.enabled),
          isBaseline,
          humanReviewRequired: raw.strategyType === 'CONTAINMENT',
          prerequisites: raw.prerequisites || {},
          permittedStateChangeProposal: raw.permittedStateChangeProposal || {},
          isolationRequirements: raw.isolationRequirements || {},
          associatedEnvironmentIds: ['env-apex-sandbox-01']
        };

        setStrategy(mapped);
        setDataSource('live');
        setLoading(false);
        return;
      }

      throw new Error(res?.error?.message || `Strategy ${strategyId} not found.`);
    } catch (err) {
      setFetchError(err.message || 'Failed to fetch strategy from database.');
      // Fallback to mock
      try {
        const mockStrat = await getMockDeceptionStrategyById(strategyId);
        if (mockStrat) {
          setStrategy(mockStrat);
          setDataSource('demo');
        } else {
          setStrategy(null);
        }
      } catch {
        setStrategy(null);
      }
      setLoading(false);
    }
  }, [tenantIdentifier, strategyId, activeTenant]);

  useEffect(() => {
    fetchLiveStrategy();
  }, [fetchLiveStrategy]);

  if (loading) {
    return <LoadingState message={`Loading deception strategy definition ${strategyId}...`} />;
  }

  // Not Found Fallback
  if (!strategy) {
    return (
      <div style={{ padding: '24px', maxWidth: '800px', margin: '40px auto', textAlign: 'center' }}>
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)',
            padding: '48px 24px'
          }}
        >
          <AlertTriangle size={48} style={{ color: 'var(--warning-text)', marginBottom: '16px' }} />
          <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, marginBottom: '8px' }}>
            Deception Strategy Not Found
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginBottom: '24px' }}>
            The requested deception strategy identifier <code style={{ color: 'var(--accent-primary)' }}>{strategyId}</code> was not found.
          </p>
          <Link to="/admin/deception-strategies" className="btn btn-secondary">
            Back to Deception Strategies
          </Link>
        </div>
      </div>
    );
  }

  const catLabel = CATEGORY_LABELS[strategy.category] || strategy.category;
  const catColor = CATEGORY_COLORS[strategy.category] || 'var(--accent-primary)';

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Back Link */}
      <div style={{ marginBottom: '16px' }}>
        <Link
          to="/admin/deception-strategies"
          className="btn btn-ghost btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <ArrowLeft size={16} /> Back to Deception Strategies
        </Link>
      </div>

      {/* Header */}
      <PageHeader
        title={strategy.name}
        description={`Strategy Definition: ${strategy.id} • Tactical Blueprint for ${catLabel}`}
        actions={
          <button
            onClick={fetchLiveStrategy}
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        }
      />

      {/* Mandatory Strategy Definition Disclaimer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          marginBottom: '24px',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-secondary)'
        }}
      >
        <Info size={18} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <strong style={{ color: '#fff' }}>Strategy Definition Metadata Only:</strong>{' '}
          Strategy eligibility does not constitute proof of execution. This screen presents candidate response specifications evaluated by gateway policies.
          <strong style={{ color: '#93c5fd', marginLeft: '4px' }}>
            No live execution controls are exposed here. Execution telemetry must be independently confirmed.
          </strong>
        </div>
      </div>

      {/* 2-Column Grid Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 340px',
          gap: '24px',
          alignItems: 'start'
        }}
      >
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Section A: Strategy Overview */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '20px'
            }}
          >
            <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Compass size={18} style={{ color: 'var(--accent-primary)' }} />
              Section A: Strategy Overview & Objectives
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Strategy Identifier</div>
                <code style={{ fontSize: 'var(--text-xs)', color: 'var(--accent-primary)', fontWeight: 600 }}>{strategy.id}</code>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Operational Scope</div>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {strategy.isBaseline ? 'Platform-Wide Default' : 'Tenant Scoped'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Candidate Status</div>
                <StatusBadge
                  status={strategy.enabled ? 'operational' : 'low'}
                  label={strategy.enabled ? 'Active Candidate' : 'Disabled'}
                  size="sm"
                />
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Strategy Category</div>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '2px 8px',
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
              </div>
            </div>

            <div
              style={{
                background: 'var(--bg-canvas)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '12px',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-secondary)',
                lineHeight: 1.5
              }}
            >
              <strong style={{ color: 'var(--text-primary)' }}>Tactical Description:</strong> {strategy.description}
            </div>
          </div>

          {/* Section B: Prerequisites & Activation Thresholds */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '20px'
            }}
          >
            <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} style={{ color: 'var(--accent-primary)' }} />
              Section B: Activation Prerequisites & Preconditions
            </h2>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Specific criteria required for policy evaluation to select this strategy as an eligible candidate.
            </p>

            <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-primary)', background: 'var(--bg-canvas)', padding: '12px', borderRadius: '4px' }}>
              {JSON.stringify(strategy.prerequisites || {}, null, 2)}
            </pre>
          </div>

          {/* Section C: Permitted State Changes & Proposal */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '20px'
            }}
          >
            <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={18} style={{ color: '#fbbf24' }} />
              Section C: Proposed State Change Specification
            </h2>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Defines the exact synthetic transformation or container dispatch proposed by this strategy.
            </p>

            <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#fef08a', background: 'var(--bg-canvas)', padding: '12px', borderRadius: '4px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
              {JSON.stringify(strategy.permittedStateChangeProposal || {}, null, 2)}
            </pre>
          </div>

          {/* Section D: Isolation & Boundary Requirements */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '20px'
            }}
          >
            <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={18} style={{ color: '#ef4444' }} />
              Section D: Mandatory Isolation Requirements
            </h2>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Resource quotas, egress drop policies, and memory bounds enforced during sandbox containment.
            </p>

            <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#fca5a5', background: 'var(--bg-canvas)', padding: '12px', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              {JSON.stringify(strategy.isolationRequirements || {}, null, 2)}
            </pre>
          </div>

        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Metadata Card */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '20px'
            }}
          >
            <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: '12px' }}>
              Blueprint Metadata
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: 'var(--text-xs)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Database UUID:</span>
                <code style={{ fontSize: '10px' }}>{strategy.databaseId || strategy.id}</code>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Human Review:</span>
                <span style={{ color: strategy.humanReviewRequired ? '#fbbf24' : 'var(--text-muted)' }}>
                  {strategy.humanReviewRequired ? 'Mandated' : 'Autonomous'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Data Store:</span>
                <span style={{ color: '#34d399', fontWeight: 600 }}>{dataSource === 'live' ? 'PostgreSQL' : 'Prototype'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
