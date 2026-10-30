import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Sliders,
  Shield,
  Layers,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Edit,
  ExternalLink,
  Info,
  HelpCircle,
  Compass,
  FileText,
  User,
  Zap,
  Activity,
  Database,
  Lock,
  RefreshCw
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingState from '../../components/common/LoadingState';
import { useAuth } from '../../hooks/useAuth';
import { apiClient } from '../../services/apiClient';
import {
  getDeceptionPolicyById as getMockDeceptionPolicyById,
  validateDeceptionPolicy,
  getPolicyChangeHistory,
  getDeceptionStrategies,
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

export default function DeceptionPolicyDetailsPage() {
  const { policyId } = useParams();
  const { user, activeTenant } = useAuth();

  const [policy, setPolicy] = useState(null);
  const [history, setHistory] = useState([]);
  const [associatedStrategies, setAssociatedStrategies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState('live'); // 'live' | 'demo'
  const [fetchError, setFetchError] = useState(null);

  const tenantIdentifier = activeTenant?.identifier || activeTenant?.id || 'tenant-apex-9941';

  const fetchLivePolicy = useCallback(async () => {
    setLoading(true);
    setFetchError(null);

    try {
      const [res, allStrats] = await Promise.all([
        apiClient.getPolicyById(tenantIdentifier, policyId),
        apiClient.getStrategies(tenantIdentifier).catch(() => ({ success: false }))
      ]);

      if (res && res.success && res.data) {
        const raw = res.data;
        const isBaseline = raw.tenantId === null;

        // Normalize JSON / array attributes
        const normalizeArrayOrObject = (val) => {
          if (!val) return [];
          if (Array.isArray(val)) return val;
          if (typeof val === 'object') {
            return Object.entries(val).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
          }
          return [String(val)];
        };

        const triggerConditions = normalizeArrayOrObject(raw.triggerConditions);
        const requiredEvidence = normalizeArrayOrObject(raw.requiredEvidenceCriteria);
        const permittedActions = Array.isArray(raw.permittedActions) ? raw.permittedActions : [];
        const prohibitedActions = Array.isArray(raw.prohibitedActions) ? raw.prohibitedActions : [];
        const safetyConstraints = normalizeArrayOrObject(raw.protectedIsolationConstraints);

        const mappedPolicy = {
          id: raw.policyIdentifier || raw.id,
          databaseId: raw.id,
          policyIdentifier: raw.policyIdentifier || raw.id,
          name: raw.name,
          description: raw.description,
          scope: isBaseline ? 'platform' : 'tenant',
          tenantId: raw.tenantId,
          tenantName: isBaseline ? 'Platform-Wide Baseline' : (activeTenant?.name || 'Active Tenant'),
          category: raw.category || 'suspicious_activity_handling',
          priority: raw.priority ?? 100,
          status: raw.enabled ? 'Enabled (Simulated)' : 'Disabled',
          enabled: Boolean(raw.enabled),
          version: raw.version || 1,
          isBaseline,
          humanReviewRequired: raw.priority <= 10,
          owner: isBaseline ? 'Platform Administrator' : 'Tenant Security Lead',
          associatedStrategyIds: permittedActions,
          triggerConditions,
          requiredEvidence,
          permittedActions,
          prohibitedActions,
          safetyConstraints,
          createdAt: raw.createdAt,
          updatedAt: raw.updatedAt
        };

        setPolicy(mappedPolicy);

        // Find associated strategies
        if (allStrats && allStrats.success && Array.isArray(allStrats.data)) {
          const matched = allStrats.data.filter(s =>
            permittedActions.some(act => act.toLowerCase() === s.strategyType?.toLowerCase() || s.strategyIdentifier?.includes(act.toLowerCase()))
          );
          setAssociatedStrategies(matched);
        } else {
          setAssociatedStrategies([]);
        }

        setDataSource('live');
        setLoading(false);
        return;
      }

      throw new Error(res?.error?.message || `Policy ${policyId} not found.`);
    } catch (err) {
      setFetchError(err.message || 'Failed to load policy from database API.');
      // Attempt fallback to mock data
      try {
        const [mockPol, histList, mockStrats] = await Promise.all([
          getMockDeceptionPolicyById(policyId),
          getPolicyChangeHistory(policyId).catch(() => []),
          getDeceptionStrategies().catch(() => [])
        ]);

        if (mockPol) {
          setPolicy(mockPol);
          setHistory(histList || []);
          if (mockPol.associatedStrategyIds) {
            setAssociatedStrategies(mockStrats.filter(s => mockPol.associatedStrategyIds.includes(s.id)));
          }
          setDataSource('demo');
        } else {
          setPolicy(null);
        }
      } catch {
        setPolicy(null);
      }
      setLoading(false);
    }
  }, [tenantIdentifier, policyId, activeTenant]);

  useEffect(() => {
    fetchLivePolicy();
  }, [fetchLivePolicy]);

  if (loading) {
    return <LoadingState message={`Loading deception policy ${policyId} from gateway database...`} />;
  }

  // Not Found State
  if (!policy) {
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
            Deception Policy Not Found
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginBottom: '24px' }}>
            The requested policy identifier <code style={{ color: 'var(--accent-primary)' }}>{policyId}</code> does not exist or has been removed from the platform registry.
          </p>
          <Link to="/admin/deception-policies" className="btn btn-secondary">
            Back to Deception Policies
          </Link>
        </div>
      </div>
    );
  }

  const validation = validateDeceptionPolicy(policy);
  const catLabel = CATEGORY_LABELS[policy.category] || policy.category;
  const canEdit = !policy.isBaseline || user?.isPlatformAdmin;

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Back Link */}
      <div style={{ marginBottom: '16px' }}>
        <Link
          to="/admin/deception-policies"
          className="btn btn-ghost btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <ArrowLeft size={16} /> Back to Deception Policies
        </Link>
      </div>

      {/* Page Header */}
      <PageHeader
        title={policy.name}
        description={`Policy Identifier: ${policy.id} • Categorized under ${catLabel}`}
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={fetchLivePolicy}
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={14} /> Refresh
            </button>
            {canEdit ? (
              <Link
                to={`/admin/deception-policies/${policy.id}/edit`}
                className="btn btn-primary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Edit size={14} /> Edit Policy
              </Link>
            ) : (
              <button
                disabled
                className="btn btn-secondary btn-sm"
                title="Global baseline policies can only be edited by Platform Administrators."
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', opacity: 0.6, cursor: 'not-allowed' }}
              >
                <Lock size={14} /> Baseline Locked (Read-Only)
              </button>
            )}
          </div>
        }
      />

      {/* Global Baseline Protection Alert */}
      {policy.isBaseline && !user?.isPlatformAdmin && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: 'rgba(234, 179, 8, 0.08)',
            border: '1px solid rgba(234, 179, 8, 0.25)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            marginBottom: '20px',
            fontSize: 'var(--text-xs)',
            color: '#fef08a'
          }}
        >
          <Lock size={16} style={{ color: '#eab308', flexShrink: 0 }} />
          <div>
            <strong>Global Baseline Policy (Read-Only):</strong> This policy is a platform-wide security baseline rule.
            Modifications require Platform Administrator authorization. Tenant owners cannot alter platform-wide defaults.
          </div>
        </div>
      )}

      {/* Data Source & Semantic Audit Notice */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: dataSource === 'live' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(59, 130, 246, 0.08)',
          border: `1px solid ${dataSource === 'live' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(59, 130, 246, 0.25)'}`,
          borderRadius: 'var(--radius-md)',
          padding: '10px 16px',
          marginBottom: '20px',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-secondary)'
        }}
      >
        {dataSource === 'live' ? (
          <Database size={16} style={{ color: '#10b981', flexShrink: 0 }} />
        ) : (
          <Info size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
        )}
        <div style={{ flex: 1 }}>
          <strong style={{ color: dataSource === 'live' ? '#34d399' : '#fff' }}>
            {dataSource === 'live' ? 'PostgreSQL Data Source:' : 'Demonstration Data Source:'}
          </strong>{' '}
          The trigger conditions, permitted actions, and prohibited actions defined below represent configured policy specifications stored in the database.
          <strong style={{ color: '#fff', marginLeft: '4px' }}>
            Policy configuration does not constitute proof of active live traffic enforcement.
          </strong>
        </div>
      </div>

      {/* Grid: Left Column + Right Column */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '24px',
          marginBottom: '24px',
          alignItems: 'start'
        }}
      >
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Section A: Policy Summary */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '20px'
            }}
          >
            <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sliders size={18} style={{ color: 'var(--accent-primary)' }} />
              Section A: Policy Summary & Scope
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Policy Identifier</div>
                <code style={{ fontSize: 'var(--text-xs)', color: 'var(--accent-primary)', fontWeight: 600 }}>{policy.id}</code>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Operational Status</div>
                <StatusBadge
                  status={policy.enabled ? 'operational' : 'low'}
                  label={policy.enabled ? 'Enabled' : 'Disabled'}
                  size="sm"
                />
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Evaluation Priority</div>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Priority {policy.priority} ({policy.priority <= 10 ? 'High Precedence' : 'Normal'})
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Enforcement Scope</div>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                  {policy.isBaseline ? 'Platform-Wide Baseline' : 'Tenant-Scoped Policy'}
                </div>
              </div>

              {policy.tenantId && (
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Associated Tenant</div>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--accent-primary-light)', fontWeight: 500 }}>
                    {policy.tenantName}
                  </span>
                </div>
              )}

              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Policy Owner</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-primary)' }}>{policy.owner || 'Security Operations'}</div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Human Review Required</div>
                <div style={{ fontSize: 'var(--text-xs)', color: policy.humanReviewRequired ? '#eab308' : 'var(--text-muted)', fontWeight: 500 }}>
                  {policy.humanReviewRequired ? 'Yes (Sign-off Mandated)' : 'No (Automated Preconditions)'}
                </div>
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
              <strong style={{ color: 'var(--text-primary)' }}>Tactical Description:</strong> {policy.description}
            </div>
          </div>

          {/* Section B: Trigger Conditions & Required Evidence */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '20px'
            }}
          >
            <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} style={{ color: 'var(--accent-primary)' }} />
              Section B: Trigger Conditions & Evidence Criteria
            </h2>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              These criteria represent configured evaluation rules that make this policy eligible for consideration. They are not historical attacker detections.
            </p>

            {/* Trigger Conditions List */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>
                Evaluation Preconditions:
              </div>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: 'var(--text-xs)', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {(policy.triggerConditions || []).map((cond, idx) => (
                  <li key={idx} style={{ lineHeight: 1.4 }}>
                    <code style={{ background: 'var(--bg-canvas)', padding: '2px 6px', borderRadius: '4px', color: '#38bdf8' }}>{cond}</code>
                  </li>
                ))}
              </ul>
            </div>

            {/* Required Evidence List */}
            <div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>
                Required Behavioral Evidence:
              </div>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: 'var(--text-xs)', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {(policy.requiredEvidence || []).map((ev, idx) => (
                  <li key={idx} style={{ lineHeight: 1.4, color: 'var(--text-secondary)' }}>
                    {ev}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Section C: Permitted vs. Prohibited Actions */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '20px'
            }}
          >
            <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={18} style={{ color: 'var(--accent-primary)' }} />
              Section C: Permitted vs Prohibited Actions & Safety Boundaries
            </h2>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Strict separation between authorized synthetic honeynet actions and strictly prohibited actions against production resources.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '16px' }}>
              {/* Permitted Actions */}
              <div
                style={{
                  background: 'var(--bg-canvas)',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '12px'
                }}
              >
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: '#60a5fa', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={14} /> Permitted Synthetic Actions
                </div>
                <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {(policy.permittedActions || []).map((act, idx) => (
                    <li key={idx} style={{ lineHeight: 1.4 }}>{act}</li>
                  ))}
                </ul>
              </div>

              {/* Prohibited Actions */}
              <div
                style={{
                  background: 'var(--bg-canvas)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '12px'
                }}
              >
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: '#f87171', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <XCircle size={14} /> Prohibited Actions (Forbidden)
                </div>
                <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {(policy.prohibitedActions || []).map((act, idx) => (
                    <li key={idx} style={{ lineHeight: 1.4 }}>{act}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Safety Constraints */}
            <div
              style={{
                background: 'rgba(245, 158, 11, 0.06)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: 'var(--radius-sm)',
                padding: '12px'
              }}
            >
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: '#fbbf24', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Shield size={14} /> Mandatory Safety Boundaries & Boundary Invariants
              </div>
              <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {(policy.safetyConstraints || []).map((sc, idx) => (
                  <li key={idx} style={{ lineHeight: 1.4 }}>{sc}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Section D: Associated Deception Strategies */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '20px'
            }}
          >
            <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Compass size={18} style={{ color: 'var(--accent-primary)' }} />
              Section D: Linked Tactical Strategies
            </h2>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Tactical blueprints permitted by this policy rule. Strategy eligibility does not constitute proof of active execution.
            </p>

            {associatedStrategies.length === 0 ? (
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', padding: '12px', background: 'var(--bg-canvas)', borderRadius: 'var(--radius-sm)' }}>
                No active strategies currently associated with this policy definition.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {associatedStrategies.map((strat) => (
                  <Link
                    key={strat.id}
                    to={`/admin/deception-strategies/${strat.strategyIdentifier || strat.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      background: 'var(--bg-canvas)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      textDecoration: 'none',
                      color: 'var(--text-primary)',
                      fontSize: 'var(--text-xs)'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--accent-primary-light)' }}>{strat.name}</div>
                      <code style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{strat.strategyIdentifier || strat.id}</code>
                    </div>
                    <ExternalLink size={14} style={{ color: 'var(--text-muted)' }} />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Section E: Policy Integrity Audit */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '20px'
            }}
          >
            <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18} style={{ color: 'var(--accent-primary)' }} />
              Section E: Policy Configuration Audit
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: 'var(--text-xs)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Database UUID:</span>
                <code style={{ fontSize: '10px', color: 'var(--text-primary)' }}>{policy.databaseId || policy.id}</code>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Version:</span>
                <span style={{ fontWeight: 600 }}>v{policy.version}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Baseline Protected:</span>
                <span style={{ color: policy.isBaseline ? '#eab308' : '#34d399', fontWeight: 600 }}>
                  {policy.isBaseline ? 'Yes (Platform Enforced)' : 'No (Tenant Scoped)'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Last Record Timestamp:</span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {policy.updatedAt ? new Date(policy.updatedAt).toLocaleString() : 'Not Recorded'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
