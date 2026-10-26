import React, { useState, useEffect } from 'react';
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
  Activity
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingState from '../../components/common/LoadingState';
import {
  getDeceptionPolicyById,
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

  const [policy, setPolicy] = useState(null);
  const [history, setHistory] = useState([]);
  const [associatedStrategies, setAssociatedStrategies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getDeceptionPolicyById(policyId),
      getPolicyChangeHistory(policyId),
      getDeceptionStrategies()
    ]).then(([pol, histList, allStrats]) => {
      setPolicy(pol);
      setHistory(histList || []);
      if (pol && pol.associatedStrategyIds) {
        const strats = allStrats.filter(s => pol.associatedStrategyIds.includes(s.id));
        setAssociatedStrategies(strats);
      } else {
        setAssociatedStrategies([]);
      }
      setLoading(false);
    });
  }, [policyId]);

  if (loading) {
    return <LoadingState message="Loading deception policy details, boundaries, and validation audits..." />;
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
        description={`Policy Definition: ${policy.id} • Categorized under ${catLabel}`}
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Link
              to={`/admin/deception-policies/${policy.id}/edit`}
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Edit size={14} /> Edit Policy
            </Link>
          </div>
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
          <strong style={{ color: '#fff' }}>Demonstration Policy Rules:</strong>{' '}
          {DEMO_DATA_DISCLAIMER} The trigger conditions, permitted actions, and prohibited actions defined below represent configured policy specifications for research demonstration. They do not claim live gateway enforcement.
        </div>
      </div>

      {/* Grid: Left Column (Sections A, B, C) + Right Column (Sections D, E, F) */}
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
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Simulated Status</div>
                <StatusBadge
                  status={
                    policy.status === 'Enabled (Simulated)'
                      ? 'operational'
                      : policy.status === 'Review Required'
                      ? 'warning'
                      : policy.status === 'Draft'
                      ? 'neutral'
                      : 'low'
                  }
                  label={policy.status}
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
                  {policy.scope === 'platform' ? 'Platform-Wide' : `${policy.scope} Scoped`}
                </div>
              </div>

              {policy.tenantId && (
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Associated Tenant</div>
                  <Link
                    to={`/admin/tenants/${policy.tenantId}`}
                    style={{ fontSize: 'var(--text-xs)', color: 'var(--accent-primary-light)', textDecoration: 'none', fontWeight: 500 }}
                  >
                    {policy.tenantName || policy.tenantId}
                  </Link>
                </div>
              )}

              {policy.environmentId && (
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Associated Deception Environment</div>
                  <Link
                    to={`/admin/deception-environments/${policy.environmentId}`}
                    style={{ fontSize: 'var(--text-xs)', color: 'var(--accent-primary-light)', textDecoration: 'none', fontWeight: 500 }}
                  >
                    {policy.environmentName || policy.environmentId}
                  </Link>
                </div>
              )}

              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Policy Owner</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-primary)' }}>{policy.owner || 'Platform Ops'}</div>
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
          {/* Section D: Validation Results */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '20px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={18} style={{ color: validation.status === 'Valid' ? '#10b981' : validation.status === 'Warnings' ? '#eab308' : '#ef4444' }} />
                Section D: Policy Validation Engine Audit
              </h2>

              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background:
                    validation.status === 'Valid'
                      ? 'rgba(16, 185, 129, 0.15)'
                      : validation.status === 'Warnings'
                      ? 'rgba(234, 179, 8, 0.15)'
                      : 'rgba(239, 68, 68, 0.15)',
                  color:
                    validation.status === 'Valid'
                      ? '#10b981'
                      : validation.status === 'Warnings'
                      ? '#eab308'
                      : '#ef4444'
                }}
              >
                {validation.status}
              </span>
            </div>

            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: 1.4 }}>
              Local deterministic verification against scoping, priority boundaries, action contradictions, and research integrity guarantees.
            </p>

            {validation.issues.length === 0 ? (
              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 12px',
                  fontSize: 'var(--text-xs)',
                  color: '#10b981'
                }}
              >
                All 8 deterministic integrity checks passed with zero warnings or errors.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {validation.issues.map((issue, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: issue.type === 'error' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(234, 179, 8, 0.08)',
                      border: `1px solid ${issue.type === 'error' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(234, 179, 8, 0.25)'}`,
                      borderRadius: 'var(--radius-sm)',
                      padding: '8px 12px',
                      fontSize: '11px',
                      color: issue.type === 'error' ? '#fca5a5' : '#fde68a',
                      lineHeight: 1.4
                    }}
                  >
                    <strong>{issue.type === 'error' ? 'Validation Error:' : 'Auditor Warning:'}</strong> {issue.message}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section E: Policy Change History */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '20px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} style={{ color: 'var(--accent-primary)' }} />
                Section E: Policy Change History
              </h2>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {history.length > 0 ? `${history.length} Record(s)` : 'Not Recorded'}
              </span>
            </div>

            {history.length === 0 ? (
              <div
                style={{
                  background: 'var(--bg-canvas)',
                  border: '1px dashed var(--border-default)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '20px',
                  textAlign: 'center',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-muted)'
                }}
              >
                Not Recorded (No administrative modifications logged for this policy)
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {history.map((h) => (
                  <div
                    key={h.id}
                    style={{
                      background: 'var(--bg-canvas)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '10px 12px',
                      fontSize: '11px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: 'var(--text-muted)' }}>
                      <span>{h.timestamp}</span>
                      <span>By: <strong style={{ color: 'var(--text-primary)' }}>{h.actor || 'Not Recorded'}</strong></span>
                    </div>

                    <div style={{ color: 'var(--text-secondary)', marginBottom: '4px', lineHeight: 1.4 }}>
                      {h.changeDescription}
                    </div>

                    {h.previousStatus && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Status Transition:</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{h.previousStatus}</span>
                        <span style={{ color: 'var(--accent-primary)' }}>→</span>
                        <span style={{ color: '#38bdf8', fontWeight: 600 }}>{h.newStatus}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section F: Associated Deception Strategies */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '20px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Compass size={18} style={{ color: 'var(--accent-primary)' }} />
                Section F: Compatible Deception Strategies
              </h2>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {associatedStrategies.length} Linked
              </span>
            </div>

            {associatedStrategies.length === 0 ? (
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontStyle: 'italic', padding: '12px', background: 'var(--bg-canvas)', borderRadius: 'var(--radius-sm)' }}>
                No active deception strategies currently declare compatibility with this policy.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {associatedStrategies.map((strat) => (
                  <div
                    key={strat.id}
                    style={{
                      background: 'var(--bg-canvas)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '10px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px'
                    }}
                  >
                    <div>
                      <Link
                        to={`/admin/deception-strategies/${strat.id}`}
                        style={{
                          fontSize: 'var(--text-xs)',
                          fontWeight: 600,
                          color: 'var(--accent-primary-light)',
                          textDecoration: 'none',
                          display: 'block'
                        }}
                      >
                        {strat.name}
                      </Link>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        ID: {strat.id} • Category: {strat.category}
                      </div>
                    </div>

                    <Link
                      to={`/admin/deception-strategies/${strat.id}`}
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '2px 8px', fontSize: '10px' }}
                    >
                      View Strategy
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
