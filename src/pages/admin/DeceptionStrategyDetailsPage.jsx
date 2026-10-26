import React, { useState, useEffect } from 'react';
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
  Play,
  FileText
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingState from '../../components/common/LoadingState';
import {
  getDeceptionStrategyById,
  getDeceptionPolicies,
  getDeceptionEnvironments,
  getStrategyEvaluationScenarios,
  evaluateStrategyScenario,
  validateDeceptionPolicy,
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

export default function DeceptionStrategyDetailsPage() {
  const { strategyId } = useParams();

  const [strategy, setStrategy] = useState(null);
  const [environments, setEnvironments] = useState([]);
  const [compatiblePolicies, setCompatiblePolicies] = useState([]);
  const [scenarios, setScenarios] = useState({});
  const [selectedScenarioKey, setSelectedScenarioKey] = useState('recon_activity');
  const [evaluationResult, setEvaluationResult] = useState(null);
  const [evaluating, setEvaluating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getDeceptionStrategyById(strategyId),
      getDeceptionEnvironments(),
      getDeceptionPolicies(),
      getStrategyEvaluationScenarios()
    ]).then(([strat, envList, polList, scenDict]) => {
      setStrategy(strat);
      setEnvironments(envList);
      setScenarios(scenDict || {});

      if (strat && strat.compatiblePolicyIds) {
        const matchedPols = polList.filter(p => strat.compatiblePolicyIds.includes(p.id));
        setCompatiblePolicies(matchedPols);
      } else {
        setCompatiblePolicies([]);
      }

      setLoading(false);
    });
  }, [strategyId]);

  // Run evaluation whenever strategy or selected scenario changes
  useEffect(() => {
    if (strategy && selectedScenarioKey) {
      setEvaluating(true);
      evaluateStrategyScenario(strategy.id, selectedScenarioKey).then(res => {
        setEvaluationResult(res);
        setEvaluating(false);
      });
    }
  }, [strategy, selectedScenarioKey]);

  if (loading) {
    return <LoadingState message="Loading deception strategy definition, preconditions, and evaluation rules..." />;
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
            The requested deception strategy identifier <code style={{ color: 'var(--accent-primary)' }}>{strategyId}</code> does not exist or has been removed from the platform catalog.
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

  // Find linked environment objects
  const linkedEnvironments = environments.filter(
    e => strategy.associatedEnvironmentIds && strategy.associatedEnvironmentIds.includes(e.id)
  );

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
          <div style={{ display: 'flex', gap: '8px' }}>
            {strategy.associatedEnvironmentIds && strategy.associatedEnvironmentIds.length > 0 && (
              <Link
                to={`/admin/deception-state-graph?envId=${strategy.associatedEnvironmentIds[0]}`}
                className="btn btn-secondary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Network size={16} /> View in DSG Explorer
              </Link>
            )}
            <Link
              to="/admin/deception-policies"
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Sliders size={16} /> Governing Policies
            </Link>
          </div>
        }
      />

      {/* Demonstration Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 16px',
          marginBottom: '24px',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-secondary)'
        }}
      >
        <Info size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <strong style={{ color: '#fff' }}>Demonstration Strategy Definition:</strong>{' '}
          {DEMO_DATA_DISCLAIMER} All preconditions, proposed synthetic state changes, and evaluation preview outcomes are simulated models. In production, real-time adaptation requires strict live telemetry verification and kernel egress enforcement.
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
        {/* Left Column (Main Details & Sections A-F) */}
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
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
                borderBottom: '1px solid var(--border-default)',
                paddingBottom: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Compass size={18} style={{ color: catColor }} />
                <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Section A: Strategy Overview & Objectives
                </h3>
              </div>
              <StatusBadge status={strategy.status} />
            </div>

            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.6 }}>
              {strategy.description}
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
                padding: '16px'
              }}
            >
              <div>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Strategy Category
                </span>
                <span
                  style={{
                    display: 'inline-block',
                    fontSize: '12px',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: `${catColor}15`,
                    color: catColor,
                    border: `1px solid ${catColor}30`,
                    fontWeight: 600
                  }}
                >
                  {catLabel}
                </span>
              </div>

              <div>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Human Review Required
                </span>
                {strategy.humanReviewRequired ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: 'rgba(245, 158, 11, 0.12)',
                      color: '#fbbf24',
                      border: '1px solid rgba(245, 158, 11, 0.25)',
                      fontWeight: 600
                    }}
                  >
                    <AlertTriangle size={12} /> Yes (Analyst Sign-Off Mandatory)
                  </span>
                ) : (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: 'rgba(16, 185, 129, 0.1)',
                      color: '#34d399',
                      border: '1px solid rgba(16, 185, 129, 0.2)',
                      fontWeight: 600
                    }}
                  >
                    <CheckCircle2 size={12} /> No (Automated Execution Allowed)
                  </span>
                )}
              </div>

              <div>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Target Environment Types
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {strategy.applicableEnvironmentTypes?.map((t, idx) => (
                    <span
                      key={idx}
                      style={{
                        fontSize: '11px',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-default)',
                        color: 'var(--text-secondary)'
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Last Catalog Revision
                </span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                  {strategy.updatedAt ? new Date(strategy.updatedAt).toUTCString() : 'Active Seed Record'}
                </span>
              </div>
            </div>

            {/* Linked Environments */}
            <div style={{ marginTop: '16px' }}>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                Associated Deception Environments
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {linkedEnvironments.length > 0 ? (
                  linkedEnvironments.map(env => (
                    <div
                      key={env.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 10px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-default)',
                        fontSize: 'var(--text-xs)'
                      }}
                    >
                      <Layers size={14} style={{ color: 'var(--accent-primary)' }} />
                      <Link
                        to={`/admin/deception-environments/${env.id}`}
                        style={{ color: 'var(--text-primary)', fontWeight: 500, textDecoration: 'none' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-primary)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                      >
                        {env.name}
                      </Link>
                      <code style={{ fontSize: '10px', color: 'var(--text-muted)' }}>({env.id})</code>
                      <Link
                        to={`/admin/deception-state-graph?envId=${env.id}`}
                        title="Open in DSG Explorer"
                        style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
                      >
                        <ExternalLink size={12} />
                      </Link>
                    </div>
                  ))
                ) : (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    No specific environments directly linked in strategy seed.
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Section B: Preconditions & Required Evidence */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '20px'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px',
                borderBottom: '1px solid var(--border-default)',
                paddingBottom: '12px'
              }}
            >
              <Activity size={18} style={{ color: 'var(--accent-primary)' }} />
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)' }}>
                Section B: Preconditions & Behavioral Evidence Criteria
              </h3>
            </div>

            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
              A deception strategy cannot be deployed arbitrarily. Every tactical response requires verified empirical evidence from the upstream gateway inspection engine before considering state transition.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-primary)' }}>
                Required Behavioral Preconditions:
              </span>
              {strategy.requiredEvidence && strategy.requiredEvidence.length > 0 ? (
                strategy.requiredEvidence.map((ev, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(59, 130, 246, 0.04)',
                      border: '1px solid rgba(59, 130, 246, 0.15)',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-primary)'
                    }}
                  >
                    <CheckCircle2 size={14} style={{ color: '#38bdf8', flexShrink: 0, marginTop: '2px' }} />
                    <span>{ev}</span>
                  </div>
                ))
              ) : (
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  Default baseline heuristics applied.
                </span>
              )}
            </div>

            {/* Explicit Missing Evidence Semantics Notice */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 14px',
                fontSize: 'var(--text-xs)',
                color: 'var(--warning-text)'
              }}
            >
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Missing Evidence Semantics:</strong> Conditions with unrecorded or missing telemetry are strictly treated as <em>Unmet / Unknown</em>. The gateway policy engine never defaults missing signals to benign or satisfied traffic.
              </div>
            </div>
          </div>

          {/* Section C: Proposed Synthetic State Changes */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '20px'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
                borderBottom: '1px solid var(--border-default)',
                paddingBottom: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={18} style={{ color: '#a855f7' }} />
                <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Section C: Proposed Synthetic State Changes
                </h3>
              </div>
              <span
                style={{
                  fontSize: '11px',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  background: 'rgba(168, 85, 247, 0.12)',
                  color: '#c084fc',
                  border: '1px solid rgba(168, 85, 247, 0.3)',
                  fontWeight: 600
                }}
              >
                Simulated Proposal — Not Executed
              </span>
            </div>

            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
              Tactical blueprint specifying what changes the gateway would request from the Deception State Graph (DSG) if activated. These represent planned synthetic mutations, not active changes to production infrastructure.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              {strategy.intendedSyntheticStateChanges && strategy.intendedSyntheticStateChanges.length > 0 ? (
                strategy.intendedSyntheticStateChanges.map((change, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-default)',
                      fontSize: 'var(--text-xs)'
                    }}
                  >
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '1px 6px',
                        borderRadius: '3px',
                        background: 'rgba(168, 85, 247, 0.15)',
                        color: '#c084fc',
                        fontWeight: 600,
                        marginTop: '1px'
                      }}
                    >
                      Step {idx + 1}
                    </span>
                    <span style={{ color: 'var(--text-primary)', flex: 1 }}>{change}</span>
                  </div>
                ))
              ) : (
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  No synthetic state changes registered for this strategy.
                </span>
              )}
            </div>

            {strategy.associatedEnvironmentIds && strategy.associatedEnvironmentIds.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Link
                  to={`/admin/deception-state-graph?envId=${strategy.associatedEnvironmentIds[0]}`}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: 'var(--text-xs)' }}
                >
                  <Network size={14} /> Inspect Affected Environment in DSG Explorer
                </Link>
              </div>
            )}
          </div>

          {/* Section D: Safety Constraints & Isolation Boundaries */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '20px'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px',
                borderBottom: '1px solid var(--border-default)',
                paddingBottom: '12px'
              }}
            >
              <Shield size={18} style={{ color: 'var(--accent-primary)' }} />
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)' }}>
                Section D: Safety Constraints & Boundary Interlocks
              </h3>
            </div>

            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
              Inviolable platform invariants that strictly limit this strategy's scope. Any attempt by an adversary to breach these boundaries immediately halts simulation and triggers containment.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {strategy.safetyConstraints && strategy.safetyConstraints.length > 0 ? (
                strategy.safetyConstraints.map((constraint, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(239, 68, 68, 0.04)',
                      border: '1px solid rgba(239, 68, 68, 0.15)',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-primary)'
                    }}
                  >
                    <Shield size={14} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
                    <span>{constraint}</span>
                  </div>
                ))
              ) : (
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  Standard zero-egress containment rules enforced by default.
                </span>
              )}
            </div>
          </div>

          {/* Section E: Policy Compatibility */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '20px'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px',
                borderBottom: '1px solid var(--border-default)',
                paddingBottom: '12px'
              }}
            >
              <Sliders size={18} style={{ color: 'var(--accent-primary)' }} />
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)' }}>
                Section E: Compatible Governing Policies
              </h3>
            </div>

            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
              Policies authorizing or regulating this deception strategy. A strategy cannot be considered unless at least one compatible policy evaluates to valid and enabled.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {compatiblePolicies.length > 0 ? (
                compatiblePolicies.map(pol => {
                  const val = validateDeceptionPolicy(pol);
                  const isHealthy = val.status === 'Valid';
                  return (
                    <div
                      key={pol.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 14px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-default)'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Link
                            to={`/admin/deception-policies/${pol.id}`}
                            style={{
                              fontSize: 'var(--text-sm)',
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                              textDecoration: 'none'
                            }}
                            onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-primary)')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                          >
                            {pol.name}
                          </Link>
                          <code style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{pol.id}</code>
                        </div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          Scope: {pol.scope} • Priority: {pol.priority}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: isHealthy ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                            color: isHealthy ? '#34d399' : '#fbbf24',
                            border: `1px solid ${isHealthy ? 'rgba(16, 185, 129, 0.25)' : 'rgba(245, 158, 11, 0.25)'}`,
                            fontWeight: 500
                          }}
                        >
                          {val.status}
                        </span>
                        <Link
                          to={`/admin/deception-policies/${pol.id}`}
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '4px 8px' }}
                        >
                          <ExternalLink size={14} />
                        </Link>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', padding: '12px' }}>
                  No compatible policies currently linked.
                </div>
              )}
            </div>
          </div>

          {/* Section F: Strategy Selection Preview (Interactive Simulator) */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '20px'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
                borderBottom: '1px solid var(--border-default)',
                paddingBottom: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Play size={18} style={{ color: 'var(--accent-primary)' }} />
                <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Section F: Strategy Selection Preview (Interactive Simulator)
                </h3>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Demonstration Precondition Engine
              </span>
            </div>

            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
              Select a simulated adversary telemetry scenario below to preview how the policy and strategy engine evaluates eligibility, enforces containment invariants, and formats synthetic response actions.
            </p>

            {/* Scenario Selector Pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
              {Object.entries(scenarios).map(([key, sc]) => {
                const isSelected = selectedScenarioKey === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedScenarioKey(key)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 'var(--radius-sm)',
                      border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-default)',
                      background: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-surface)',
                      color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)',
                      fontSize: 'var(--text-xs)',
                      fontWeight: isSelected ? 600 : 400,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>{sc.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Evaluation Results Card */}
            {evaluationResult && (
              <div
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px'
                }}
              >
                {/* Result Status Header */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingBottom: '12px',
                    borderBottom: '1px solid var(--border-default)'
                  }}
                >
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>
                      Scenario Evaluated:
                    </span>
                    <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                      {evaluationResult.scenario?.name}
                    </strong>
                  </div>

                  <div>
                    {evaluationResult.status === 'Eligible (Simulated)' && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '12px',
                          padding: '4px 12px',
                          borderRadius: '16px',
                          background: 'rgba(16, 185, 129, 0.15)',
                          color: '#34d399',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          fontWeight: 600
                        }}
                      >
                        <CheckCircle2 size={14} /> Eligible (Simulated)
                      </span>
                    )}
                    {evaluationResult.status === 'Requires Review' && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '12px',
                          padding: '4px 12px',
                          borderRadius: '16px',
                          background: 'rgba(245, 158, 11, 0.15)',
                          color: '#fbbf24',
                          border: '1px solid rgba(245, 158, 11, 0.3)',
                          fontWeight: 600
                        }}
                      >
                        <AlertTriangle size={14} /> Requires Review
                      </span>
                    )}
                    {evaluationResult.status === 'Ineligible' && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '12px',
                          padding: '4px 12px',
                          borderRadius: '16px',
                          background: 'rgba(239, 68, 68, 0.15)',
                          color: '#f87171',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          fontWeight: 600
                        }}
                      >
                        <XCircle size={14} /> Ineligible (Fail-Closed)
                      </span>
                    )}
                  </div>
                </div>

                {/* Simulated Telemetry Evidence */}
                <div>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Simulated Ingress Telemetry:
                  </span>
                  <div
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-secondary)',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '10px 12px',
                      fontFamily: 'monospace'
                    }}
                  >
                    {evaluationResult.scenario?.simulatedEvidence}
                  </div>
                </div>

                {/* Evidence Available vs Unknown Conditions */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {/* Available */}
                  <div
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '12px'
                    }}
                  >
                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: '#34d399', display: 'block', marginBottom: '8px' }}>
                      Evidence Available:
                    </span>
                    <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {evaluationResult.evidenceAvailable?.map((ev, i) => (
                        <li key={i} style={{ marginBottom: '4px' }}>{ev}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Unknown */}
                  <div
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '12px'
                    }}
                  >
                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: '#fbbf24', display: 'block', marginBottom: '8px' }}>
                      Unknown / Unmet Signals:
                    </span>
                    {evaluationResult.unknownConditions && evaluationResult.unknownConditions.length > 0 ? (
                      <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {evaluationResult.unknownConditions.map((cond, i) => (
                          <li key={i} style={{ marginBottom: '4px' }}>{cond}</li>
                        ))}
                      </ul>
                    ) : (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>None (Telemetry complete)</span>
                    )}
                  </div>
                </div>

                {/* Reasoning Breakdown */}
                <div
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '12px'
                  }}
                >
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Decision Engine Reasoning:
                  </span>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>
                    {evaluationResult.reason}
                  </p>
                </div>

                {/* Proposed Synthetic Action */}
                <div
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '12px'
                  }}
                >
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Proposed Synthetic Gateway Action:
                  </span>
                  <div
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: evaluationResult.status === 'Ineligible' ? '#f87171' : 'var(--accent-primary)',
                      fontWeight: 500
                    }}
                  >
                    {evaluationResult.proposedAction || evaluationResult.scenario?.eligibilityResult?.proposedSyntheticAction}
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Right Sidebar (Quick Info & Nav) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Quick Summary Card */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '20px'
            }}
          >
            <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: '12px', color: 'var(--text-primary)' }}>
              Tactical Summary
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: 'var(--text-xs)' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block' }}>Strategy Identifier</span>
                <code style={{ color: 'var(--accent-primary)' }}>{strategy.id}</code>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block' }}>Status</span>
                <StatusBadge status={strategy.status} />
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block' }}>Governing Policies</span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {strategy.compatiblePolicyIds?.length || 0} policy definitions
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block' }}>Associated Sandboxes</span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {strategy.associatedEnvironmentIds?.length || 0} environments
                </span>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '20px'
            }}
          >
            <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: '12px', color: 'var(--text-primary)' }}>
              Related Administrative Views
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Link
                to="/admin/deception-policies"
                className="btn btn-secondary btn-sm"
                style={{ width: '100%', justifyContent: 'flex-start' }}
              >
                <Sliders size={14} /> Deception Policies
              </Link>
              <Link
                to="/admin/deception-environments"
                className="btn btn-secondary btn-sm"
                style={{ width: '100%', justifyContent: 'flex-start' }}
              >
                <Layers size={14} /> Deception Environments
              </Link>
              <Link
                to="/admin/deception-state-graph"
                className="btn btn-secondary btn-sm"
                style={{ width: '100%', justifyContent: 'flex-start' }}
              >
                <Network size={14} /> DSG Explorer
              </Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
