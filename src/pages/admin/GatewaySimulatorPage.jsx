import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Play,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Shield,
  Layers,
  Network,
  Sliders,
  Compass,
  Activity,
  Cpu,
  Clock,
  ExternalLink,
  Info,
  FileText,
  AlertCircle,
  ArrowRight,
  Trash2
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingState from '../../components/common/LoadingState';
import { DEMO_DATA_DISCLAIMER } from '../../services/mockData';
import {
  DEFAULT_SIMULATOR_SCENARIOS,
  runGatewaySimulation,
  getStoredSimulationHistory,
  saveSimulationRun,
  clearSimulationHistory
} from '../../services/gatewaySimulator';
import './GatewaySimulatorPage.css';

export default function GatewaySimulatorPage() {
  const [selectedScenarioId, setSelectedScenarioId] = useState(DEFAULT_SIMULATOR_SCENARIOS[0].id);
  const [activeRunResult, setActiveRunResult] = useState(null);
  const [simHistory, setSimHistory] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load history on mount
  useEffect(() => {
    const history = getStoredSimulationHistory();
    setSimHistory(history);
    setLoading(false);
  }, []);

  const selectedScenario = DEFAULT_SIMULATOR_SCENARIOS.find(s => s.id === selectedScenarioId) || DEFAULT_SIMULATOR_SCENARIOS[0];

  // Execute simulation
  const handleRunSimulation = async (scenarioToRunId = selectedScenarioId) => {
    setIsSimulating(true);
    try {
      const result = await runGatewaySimulation(scenarioToRunId);
      setActiveRunResult(result);
      const updatedHistory = saveSimulationRun(result);
      setSimHistory(updatedHistory);
    } catch (err) {
      console.error('Failed to run gateway simulation:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  // Reopen a saved historical simulation run without re-executing
  const handleSelectHistoryRun = (run) => {
    setSelectedScenarioId(run.scenarioId);
    setActiveRunResult(run);
  };

  // Clear simulation history
  const handleClearHistory = () => {
    const cleared = clearSimulationHistory();
    setSimHistory(cleared);
  };

  if (loading) {
    return <LoadingState message="Initializing Gateway Decision Simulator workspace..." />;
  }

  return (
    <div className="sim-container">
      {/* Header */}
      <PageHeader
        title="Gateway Decision Simulator"
        description="End-to-end interactive workspace modeling simulated request ingestion, evidence correlation, policy evaluation, strategy eligibility, and recorded routing outcomes."
      />

      {/* Demonstration Alert Banner */}
      <div className="sim-disclaimer-banner">
        <Info size={18} style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: '2px' }} />
        <div>
          <strong>Demonstration Decision Model:</strong> {DEMO_DATA_DISCLAIMER} This simulator demonstrates the conceptual architecture of the AI-Enabled Adaptive Cyber Deception Gateway. No real reverse proxy, live packet inspection, honeynet container deployment, or socket manipulation is performed. All outputs represent simulated decision workflows.
        </div>
      </div>

      {/* Section A: Scenario Setup */}
      <div className="sim-section">
        <div className="sim-section-header">
          <div className="sim-section-title-wrap">
            <Cpu size={18} style={{ color: 'var(--accent-primary)' }} />
            <h3 className="sim-section-title">Section A: Fictional Request Scenario Setup</h3>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Select from 7 Standard Prototype Scenarios
          </span>
        </div>

        <p className="sim-section-desc">
          Select a predefined fictional request scenario to evaluate. Each scenario contains safe synthetic paths, mock telemetry headers, and behavioral parameters designed to test specific gateway decision invariants.
        </p>

        {/* Scenario Selection Grid */}
        <div className="sim-scenario-grid">
          {DEFAULT_SIMULATOR_SCENARIOS.map((scen) => {
            const isSelected = scen.id === selectedScenarioId;
            return (
              <button
                key={scen.id}
                type="button"
                className={`sim-scenario-card ${isSelected ? 'active' : ''}`}
                onClick={() => setSelectedScenarioId(scen.id)}
              >
                <div>
                  <div className="sim-scenario-card-header">
                    <span className="sim-scenario-card-title">{scen.shortName}</span>
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '1px 6px',
                        borderRadius: '3px',
                        background: isSelected ? 'var(--accent-primary)' : 'var(--bg-card)',
                        color: isSelected ? '#fff' : 'var(--text-muted)',
                        fontWeight: 600
                      }}
                    >
                      {scen.id}
                    </span>
                  </div>
                  <p className="sim-scenario-card-desc">{scen.description}</p>
                </div>

                <div className="sim-scenario-card-meta">
                  <span className="sim-scenario-meta-tag">{scen.httpMethod} {scen.syntheticPath}</span>
                  <span className="sim-scenario-meta-tag">{scen.tenantName}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Scenario Parameters Summary & Run Action Bar */}
        <div className="sim-action-bar">
          <div className="sim-action-info">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="sim-action-title">Selected Scenario: {selectedScenario.title}</span>
              <span
                style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: 'rgba(59, 130, 246, 0.1)',
                  color: 'var(--accent-primary-light)',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  fontWeight: 500
                }}
              >
                Simulated Input
              </span>
            </div>
            <span className="sim-action-subtitle">
              Target: <strong style={{ color: 'var(--text-primary)' }}>{selectedScenario.applicationName}</strong> ({selectedScenario.applicationId}) • Tenant: <strong style={{ color: 'var(--text-primary)' }}>{selectedScenario.tenantName}</strong> • Session: <code style={{ color: 'var(--accent-primary-light)' }}>{selectedScenario.sessionIdentifier}</code> • Telemetry: <strong style={{ color: selectedScenario.telemetryCompleteness.includes('Incomplete') ? '#fbbf24' : '#34d399' }}>{selectedScenario.telemetryCompleteness}</strong>
            </span>
          </div>

          <button
            type="button"
            className="sim-run-btn"
            onClick={() => handleRunSimulation(selectedScenarioId)}
            disabled={isSimulating}
          >
            <Play size={16} />
            <span>{isSimulating ? 'Evaluating Gateway Rules...' : 'Run Simulation'}</span>
          </button>
        </div>
      </div>

      {/* Active Simulation Results Display */}
      {activeRunResult && (
        <>
          {/* Explicit Discrepancy Warning Banner if Detected */}
          {activeRunResult.discrepancy?.hasDiscrepancy && (
            <div className="sim-discrepancy-banner">
              <AlertTriangle size={24} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
              <div className="sim-discrepancy-content">
                <div className="sim-discrepancy-title">
                  Discrepancy Detected Between Intended Policy Decision and Recorded Gateway Outcome
                </div>
                <div className="sim-discrepancy-text">
                  {activeRunResult.discrepancy.details}
                </div>
                <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                  Intended Policy Route: <strong style={{ color: '#60a5fa' }}>{activeRunResult.discrepancy.intendedRoute}</strong> | Recorded Edge Outcome: <strong style={{ color: '#f87171' }}>{activeRunResult.discrepancy.recordedOutcome}</strong>
                </div>
              </div>
            </div>
          )}

          {/* Section B: Request Evidence */}
          <div className="sim-section">
            <div className="sim-section-header">
              <div className="sim-section-title-wrap">
                <FileText size={18} style={{ color: 'var(--accent-primary)' }} />
                <h3 className="sim-section-title">Section B: Request Evidence Breakdown</h3>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Facts vs. Detector Interpretations vs. Missing Signals
              </span>
            </div>

            <p className="sim-section-desc">
              Deterministic separation of directly observed ingress facts from detector-derived classifier scores. Missing telemetry is explicitly preserved as Unknown / Not Recorded and never assumed safe.
            </p>

            <div className="sim-evidence-grid">
              {/* Directly Observed Facts */}
              <div className="sim-evidence-col">
                <div className="sim-evidence-col-title" style={{ color: '#38bdf8' }}>
                  <CheckCircle2 size={14} /> Directly Observed Facts ({activeRunResult.observedEvidence.directlyObservedFacts.length})
                </div>
                {activeRunResult.observedEvidence.directlyObservedFacts.map((fact, idx) => (
                  <div key={idx} className="sim-fact-item">
                    <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '2px' }}>
                      {fact.indicator}
                    </strong>
                    <span style={{ color: 'var(--text-secondary)' }}>{fact.fact}</span>
                    <span className="sim-fact-source">Source: {fact.source}</span>
                  </div>
                ))}
              </div>

              {/* Detector-Derived Interpretations */}
              <div className="sim-evidence-col">
                <div className="sim-evidence-col-title" style={{ color: '#a855f7' }}>
                  <Activity size={14} /> Detector Interpretations ({activeRunResult.observedEvidence.detectorDerivedInterpretations.length})
                </div>
                {activeRunResult.observedEvidence.detectorDerivedInterpretations.map((interp, idx) => (
                  <div key={idx} className="sim-fact-item">
                    <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '2px' }}>
                      {interp.detector}
                    </strong>
                    <span style={{ color: 'var(--text-secondary)' }}>{interp.interpretation}</span>
                    <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '10px', color: '#c084fc', fontWeight: 600 }}>
                        Simulated Score: {interp.score}
                      </span>
                    </div>
                    <span className="sim-fact-source" style={{ fontStyle: 'italic', marginTop: '4px' }}>
                      Disclaimer: {interp.caveat}
                    </span>
                  </div>
                ))}
              </div>

              {/* Missing or Unavailable Evidence */}
              <div className="sim-evidence-col">
                <div className="sim-evidence-col-title" style={{ color: activeRunResult.observedEvidence.missingEvidence.length > 0 ? '#fbbf24' : '#34d399' }}>
                  <HelpCircle size={14} /> Missing / Unavailable Evidence ({activeRunResult.observedEvidence.missingEvidence.length})
                </div>
                {activeRunResult.observedEvidence.missingEvidence.length > 0 ? (
                  activeRunResult.observedEvidence.missingEvidence.map((missing, idx) => (
                    <div key={idx} className="sim-fact-item" style={{ borderLeft: '3px solid #fbbf24' }}>
                      <span style={{ color: '#fbbf24', fontWeight: 600 }}>{missing}</span>
                      <span className="sim-fact-source">Status: Not Recorded (Unavailable to Inspection Engine)</span>
                    </div>
                  ))
                ) : (
                  <div className="sim-fact-item" style={{ color: '#34d399' }}>
                    All expected telemetry signals were captured successfully. No missing evidence fields recorded.
                  </div>
                )}
                {activeRunResult.observedEvidence.missingEvidence.length > 0 && (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-card)', padding: '8px', borderRadius: '4px' }}>
                    <strong>Safety Invariant:</strong> Incomplete telemetry must never be defaulted to benign or malicious without verifiable evidence.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section C: Behavioral Assessment */}
          <div className="sim-section">
            <div className="sim-section-header">
              <div className="sim-section-title-wrap">
                <Activity size={18} style={{ color: 'var(--accent-primary)' }} />
                <h3 className="sim-section-title">Section C: Simulated Behavioral Assessment</h3>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Rule-Based Inference (No Live ML Executed)
              </span>
            </div>

            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Inferred Classification:</span>
                  <span
                    style={{
                      fontSize: 'var(--text-sm)',
                      fontWeight: 700,
                      color:
                        activeRunResult.behavioralAssessment.classification.includes('No suspicious')
                          ? '#34d399'
                          : activeRunResult.behavioralAssessment.classification.includes('Incomplete')
                          ? '#fbbf24'
                          : '#60a5fa',
                      background: 'var(--bg-card)',
                      padding: '4px 12px',
                      borderRadius: '16px',
                      border: '1px solid var(--border-default)'
                    }}
                  >
                    {activeRunResult.behavioralAssessment.classification}
                  </span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {activeRunResult.behavioralAssessment.confidenceNote}
                </span>
              </div>

              <div>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Assessment Rationale:
                </span>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>
                  {activeRunResult.behavioralAssessment.rationale}
                </p>
              </div>
            </div>
          </div>

          {/* Section D: Policy Evaluation */}
          <div className="sim-section">
            <div className="sim-section-header">
              <div className="sim-section-title-wrap">
                <Sliders size={18} style={{ color: 'var(--accent-primary)' }} />
                <h3 className="sim-section-title">Section D: Policy Evaluation & Scoping Compliance</h3>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {activeRunResult.policyEvaluation.evaluatedPolicies.length} Candidate Policy Definitions Evaluated
              </span>
            </div>

            <p className="sim-section-desc">
              Evaluates registered deception policies respecting enforcement scopes (Platform-Wide vs. Tenant-Scoped vs. Environment-Scoped). Policies assigned to foreign tenants or failing required safety checks are disqualified.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              {activeRunResult.policyEvaluation.evaluatedPolicies.map((ep) => {
                const isSelected = activeRunResult.policyEvaluation.selectedPolicy?.id === ep.policy.id;
                return (
                  <div
                    key={ep.policy.id}
                    style={{
                      background: isSelected ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-surface)',
                      border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Link
                          to={`/admin/deception-policies/${ep.policy.id}`}
                          style={{ fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'none', fontSize: 'var(--text-sm)' }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-primary)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                        >
                          {ep.policy.name}
                        </Link>
                        <code style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({ep.policy.id})</code>
                        {isSelected && (
                          <span
                            style={{
                              fontSize: '10px',
                              padding: '2px 8px',
                              borderRadius: '10px',
                              background: 'var(--accent-primary)',
                              color: '#fff',
                              fontWeight: 600
                            }}
                          >
                            Selected Governing Policy
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          Scope: <strong style={{ color: 'var(--text-secondary)' }}>{ep.policy.scope}</strong>
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          Priority: <strong style={{ color: 'var(--text-secondary)' }}>{ep.policy.priority}</strong>
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: ep.matchStatus === 'Applicable' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                            color: ep.matchStatus === 'Applicable' ? '#34d399' : 'var(--text-muted)',
                            fontWeight: 600
                          }}
                        >
                          {ep.matchStatus}
                        </span>
                      </div>
                    </div>

                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                      {ep.applicabilityReason}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '11px', marginTop: '4px' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Trigger Conditions: </span>
                        <span style={{ color: 'var(--text-secondary)' }}>{ep.policy.triggerConditions?.join('; ') || 'None'}</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Validation Finding: </span>
                        <span style={{ color: ep.validation.status === 'Valid' ? '#34d399' : '#fbbf24' }}>
                          {ep.validation.status} ({ep.validation.issues.length} issues)
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section E: Strategy Eligibility Assessment */}
          <div className="sim-section">
            <div className="sim-section-header">
              <div className="sim-section-title-wrap">
                <Compass size={18} style={{ color: 'var(--accent-primary)' }} />
                <h3 className="sim-section-title">Section E: Strategy Eligibility & Precondition Verification</h3>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Deterministic Strategy Rule Checker
              </span>
            </div>

            <p className="sim-section-desc">
              Determines whether tactical deception strategies meet empirical preconditions. Strategy eligibility represents candidate availability—not confirmed runtime mutation.
            </p>

            {activeRunResult.strategyEligibility ? (
              <div
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    {activeRunResult.strategyEligibility.strategy ? (
                      <Link
                        to={`/admin/deception-strategies/${activeRunResult.strategyEligibility.strategy.id}`}
                        style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'none' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-primary)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                      >
                        {activeRunResult.strategyEligibility.strategy.name}
                      </Link>
                    ) : (
                      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                        No Deception Strategy Candidate
                      </span>
                    )}
                  </div>

                  <div>
                    {activeRunResult.strategyEligibility.status === 'Eligible (Simulated)' && (
                      <span
                        style={{
                          fontSize: '12px',
                          padding: '4px 12px',
                          borderRadius: '16px',
                          background: 'rgba(16, 185, 129, 0.15)',
                          color: '#34d399',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <CheckCircle2 size={14} /> Eligible (Simulated)
                      </span>
                    )}
                    {activeRunResult.strategyEligibility.status === 'Requires Review' && (
                      <span
                        style={{
                          fontSize: '12px',
                          padding: '4px 12px',
                          borderRadius: '16px',
                          background: 'rgba(245, 158, 11, 0.15)',
                          color: '#fbbf24',
                          border: '1px solid rgba(245, 158, 11, 0.3)',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <AlertTriangle size={14} /> Requires Review
                      </span>
                    )}
                    {activeRunResult.strategyEligibility.status === 'Ineligible (Fail-Closed)' && (
                      <span
                        style={{
                          fontSize: '12px',
                          padding: '4px 12px',
                          borderRadius: '16px',
                          background: 'rgba(239, 68, 68, 0.15)',
                          color: '#f87171',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <XCircle size={14} /> Ineligible (Fail-Closed)
                      </span>
                    )}
                    {activeRunResult.strategyEligibility.status === 'Not Evaluated' && (
                      <span
                        style={{
                          fontSize: '12px',
                          padding: '4px 12px',
                          borderRadius: '16px',
                          background: 'rgba(100, 116, 139, 0.15)',
                          color: 'var(--text-muted)',
                          border: '1px solid rgba(100, 116, 139, 0.3)',
                          fontWeight: 600
                        }}
                      >
                        Not Evaluated
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                  {activeRunResult.strategyEligibility.reason}
                </div>

                {/* Precondition breakdown */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', marginTop: '4px' }}>
                  <div style={{ background: 'var(--bg-card)', padding: '10px', borderRadius: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#34d399', display: 'block', marginBottom: '4px' }}>
                      Satisfied Preconditions ({activeRunResult.strategyEligibility.satisfiedConditions.length})
                    </span>
                    {activeRunResult.strategyEligibility.satisfiedConditions.length > 0 ? (
                      <ul style={{ margin: 0, paddingLeft: '14px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {activeRunResult.strategyEligibility.satisfiedConditions.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    ) : (
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>None satisfied</span>
                    )}
                  </div>

                  <div style={{ background: 'var(--bg-card)', padding: '10px', borderRadius: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#f87171', display: 'block', marginBottom: '4px' }}>
                      Unmet Preconditions ({activeRunResult.strategyEligibility.unmetConditions.length})
                    </span>
                    {activeRunResult.strategyEligibility.unmetConditions.length > 0 ? (
                      <ul style={{ margin: 0, paddingLeft: '14px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {activeRunResult.strategyEligibility.unmetConditions.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    ) : (
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>None</span>
                    )}
                  </div>

                  <div style={{ background: 'var(--bg-card)', padding: '10px', borderRadius: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#fbbf24', display: 'block', marginBottom: '4px' }}>
                      Unknown Conditions ({activeRunResult.strategyEligibility.unknownConditions.length})
                    </span>
                    {activeRunResult.strategyEligibility.unknownConditions.length > 0 ? (
                      <ul style={{ margin: 0, paddingLeft: '14px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {activeRunResult.strategyEligibility.unknownConditions.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    ) : (
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>None</span>
                    )}
                  </div>
                </div>

                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  Proposed Synthetic Action:{' '}
                  <span style={{ color: 'var(--accent-primary-light)', fontWeight: 500 }}>
                    {activeRunResult.strategyEligibility.proposedSyntheticAction}
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                No strategy candidates evaluated for this scenario.
              </div>
            )}
          </div>

          {/* Section F & G: Intended Routing Decision vs Recorded Outcome */}
          <div className="sim-section">
            <div className="sim-section-header">
              <div className="sim-section-title-wrap">
                <Network size={18} style={{ color: 'var(--accent-primary)' }} />
                <h3 className="sim-section-title">Sections F & G: Intended Decision vs. Recorded Outcome</h3>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Decoupled Decision & Outcome Verification
              </span>
            </div>

            <p className="sim-section-desc">
              The intended routing decision represents the theoretical routing choice derived from policy rules. The recorded outcome represents the independently logged edge gateway outcome. Discrepancies between the two are preserved as explicit security anomalies.
            </p>

            <div className="sim-comparison-grid">
              {/* Intended Routing Decision */}
              <div className="sim-comparison-box">
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Section F: Intended Routing Decision (Simulated)
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      fontSize: 'var(--text-sm)',
                      fontWeight: 700,
                      color:
                        activeRunResult.intendedRoutingDecision.decision.includes('protected')
                          ? '#34d399'
                          : activeRunResult.intendedRoutingDecision.decision.includes('Block')
                          ? '#f87171'
                          : activeRunResult.intendedRoutingDecision.decision.includes('deception')
                          ? '#38bdf8'
                          : '#fbbf24'
                    }}
                  >
                    {activeRunResult.intendedRoutingDecision.decision}
                  </span>
                </div>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                  {activeRunResult.intendedRoutingDecision.rationale}
                </p>

                {activeRunResult.targetEnvironment && (
                  <div style={{ marginTop: '8px', padding: '8px', background: 'var(--bg-card)', borderRadius: '4px', fontSize: '11px' }}>
                    <div style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>Target Deception Sandbox:</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Link
                        to={`/admin/deception-environments/${activeRunResult.targetEnvironment.id}`}
                        style={{ color: 'var(--accent-primary-light)', textDecoration: 'none', fontWeight: 500 }}
                      >
                        {activeRunResult.targetEnvironment.name}
                      </Link>
                      <Link
                        to={`/admin/deception-state-graph?envId=${activeRunResult.targetEnvironment.id}`}
                        title="Open in DSG Explorer"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <ExternalLink size={12} />
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Recorded Outcome */}
              <div className="sim-comparison-box">
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Section G: Recorded Routing Outcome (Independent)
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      fontSize: 'var(--text-sm)',
                      fontWeight: 700,
                      color:
                        activeRunResult.routingOutcome.status.includes('Protected')
                          ? '#34d399'
                          : activeRunResult.routingOutcome.status.includes('Blocked')
                          ? '#f87171'
                          : activeRunResult.routingOutcome.status.includes('Deception')
                          ? '#38bdf8'
                          : 'var(--text-muted)'
                    }}
                  >
                    {activeRunResult.routingOutcome.status}
                  </span>
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: 'var(--text-muted)'
                    }}
                  >
                    Simulated Output
                  </span>
                </div>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                  {activeRunResult.routingOutcome.details}
                </p>

                {activeRunResult.discrepancy.hasDiscrepancy ? (
                  <div
                    style={{
                      marginTop: '8px',
                      padding: '8px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      borderRadius: '4px',
                      fontSize: '11px',
                      color: '#f87171'
                    }}
                  >
                    <strong>Discrepancy Status:</strong> Discrepancy Flagged. Intended route does not match confirmed edge outcome.
                  </div>
                ) : (
                  <div
                    style={{
                      marginTop: '8px',
                      padding: '8px',
                      background: 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid rgba(16, 185, 129, 0.2)',
                      borderRadius: '4px',
                      fontSize: '11px',
                      color: '#34d399'
                    }}
                  >
                    <strong>Discrepancy Status:</strong> None. Intended decision matches recorded edge outcome.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section H: Chronological Decision Trace */}
          <div className="sim-section">
            <div className="sim-section-header">
              <div className="sim-section-title-wrap">
                <Clock size={18} style={{ color: 'var(--accent-primary)' }} />
                <h3 className="sim-section-title">Section H: Chronological Gateway Decision Trace</h3>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                8-Step Lifecycle Execution Trace (Run: {activeRunResult.runId})
              </span>
            </div>

            <p className="sim-section-desc">
              Step-by-step forensic progression from ingress request parsing through behavioral classification, policy scoping, strategy eligibility, intended decision, and recorded outcome.
            </p>

            <div className="sim-trace-list">
              {activeRunResult.decisionTrace.map((step) => (
                <div key={step.stepNumber} className="sim-trace-item">
                  <div className="sim-trace-step-num">{step.stepNumber}</div>
                  <div className="sim-trace-content">
                    <div className="sim-trace-header">
                      <span className="sim-trace-stage">Step {step.stepNumber}: {step.stageName}</span>
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: 'rgba(59, 130, 246, 0.1)',
                          color: 'var(--accent-primary-light)',
                          fontWeight: 500
                        }}
                      >
                        {step.simulatedStatus}
                      </span>
                    </div>

                    <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                      Result: <span style={{ color: 'var(--accent-primary-light)' }}>{step.result}</span>
                    </div>

                    <p className="sim-trace-explanation">{step.explanation}</p>

                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Reference: {step.evidenceReference}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Section I: Simulation History */}
      <div className="sim-section">
        <div className="sim-section-header">
          <div className="sim-section-title-wrap">
            <RotateCcw size={18} style={{ color: 'var(--accent-primary)' }} />
            <h3 className="sim-section-title">Section I: Local Simulation Run History</h3>
          </div>
          {simHistory.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="btn btn-ghost btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '11px' }}
            >
              <Trash2 size={13} /> Clear History
            </button>
          )}
        </div>

        <p className="sim-section-desc">
          History of deterministic simulation runs executed in this browser session. Selecting a past run reopens its exact evaluation outputs without re-executing logic or modifying application event stores.
        </p>

        {simHistory.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-xs)', fontStyle: 'italic' }}>
            No simulation runs recorded yet. Select a scenario above and click "Run Simulation".
          </div>
        ) : (
          <div style={{ overflowX: 'auto', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}>
            <table className="sim-history-table">
              <thead>
                <tr>
                  <th>Run ID & Scenario</th>
                  <th>Tenant & Application</th>
                  <th>Behavioral Assessment</th>
                  <th>Intended Decision</th>
                  <th>Recorded Outcome</th>
                  <th>Discrepancy</th>
                  <th>Timestamp</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {simHistory.map((run) => (
                  <tr key={run.runId} onClick={() => handleSelectHistoryRun(run)}>
                    <td>
                      <div>
                        <strong style={{ color: 'var(--text-primary)' }}>{run.scenario?.shortName || run.scenarioId}</strong>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{run.runId}</div>
                      </div>
                    </td>
                    <td>
                      <div>{run.tenant?.name || run.scenario?.tenantName}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{run.application?.name || run.scenario?.applicationName}</div>
                    </td>
                    <td>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {run.behavioralAssessment?.classification}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '11px', color: 'var(--accent-primary-light)', fontWeight: 500 }}>
                        {run.intendedRoutingDecision?.decision}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {run.routingOutcome?.status}
                      </span>
                    </td>
                    <td>
                      {run.discrepancy?.hasDiscrepancy ? (
                        <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', fontWeight: 600 }}>
                          Discrepancy
                        </span>
                      ) : (
                        <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.1)', color: '#34d399' }}>
                          Matching
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(run.timestamp).toLocaleTimeString()}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: '11px', padding: '4px 8px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectHistoryRun(run);
                        }}
                      >
                        Reopen Run <ArrowRight size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
