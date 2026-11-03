import React from 'react';
import {
  X,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Activity,
  Cpu,
  Layers,
  FileText,
  Clock,
  Compass,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Radio,
  Lock,
  Info
} from 'lucide-react';
import './detection.css';

export default function AssessmentDetailDrawer({ assessment, isOpen, onClose }) {
  if (!isOpen || !assessment) return null;

  const {
    id,
    sessionRef,
    windowLabel = '5m',
    assessmentLabel = 'NORMAL',
    classification = 'BENIGN_BASELINE',
    riskScore = null,
    confidenceScore = null,
    modelOrRuleVersion = 'N/A',
    ruleFindings = [],
    mlAnomalyResult = {},
    explanation = {},
    dataQualityState = 'COMPLETE',
    telemetryLossDetected = false,
    assessedAt,
    application,
    observation
  } = assessment;

  // Extract explanation details
  const explObj = typeof explanation === 'object' && explanation !== null ? explanation : {};
  const uncertaintyNotes = explObj.uncertaintyNotes || [];
  const contributingFactors = explObj.contributingFactors || [];
  const explanationText = explObj.text || explObj.summary || (typeof explanation === 'string' ? explanation : 'No explanation provided.');

  // Determine deception eligibility
  // Check both direct property and explanation property
  const deceptionEligible = assessment.deceptionEligible !== undefined
    ? Boolean(assessment.deceptionEligible)
    : (explObj.deceptionEligible !== undefined ? Boolean(explObj.deceptionEligible) : false);

  // Extract structured behavioral evidence from raw observation or structured fields
  const rawEv = observation?.sanitizedStructuredEvidence || {};
  const httpMethod = rawEv.method || rawEv.httpMethod || 'N/A';
  const requestPath = rawEv.path || rawEv.targetPath || 'N/A';
  const clientIp = rawEv.clientIp || rawEv.sourceIp || 'N/A';
  const statusCode = rawEv.statusCode || rawEv.status || 'N/A';

  const labelClass = `badge-label badge-label-${assessmentLabel.toLowerCase()}`;
  const isEligible = deceptionEligible;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        {/* Drawer Header */}
        <div className="drawer-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span className={labelClass}>{assessmentLabel.replace(/_/g, ' ')}</span>
              <span className={`badge-eligibility ${isEligible ? 'badge-eligibility-eligible' : 'badge-eligibility-ineligible'}`}>
                {isEligible ? 'DECEPTION ELIGIBLE' : 'DECEPTION INELIGIBLE'}
              </span>
            </div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Assessment #{String(id).slice(0, 13)}
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Assessed: {assessedAt ? new Date(assessedAt).toLocaleString() : 'N/A'} • Session: <code style={{ color: 'var(--accent-primary-light)' }}>{sessionRef || 'anonymous'}</code>
            </span>
          </div>

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            aria-label="Close drawer"
            style={{ padding: '6px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="drawer-body">
          {/* Integrity Notice Banner */}
          <div className="detection-banner detection-banner-neutral">
            <Info size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Audit Integrity Notice:</strong> Behavioral assessments combine deterministic rule evaluation with unsupervised machine learning. Deception eligibility evaluates whether policy criteria are met; <em>countermeasure execution evidence remains strictly MISSING</em>.
            </div>
          </div>

          {/* D. Assessment Reasoning Path */}
          <div className="detection-card">
            <div className="detection-card-title">
              <span>D. Assessment Reasoning Path</span>
              <Compass size={16} style={{ color: 'var(--accent-deception)' }} />
            </div>
            <div className="reasoning-path">
              <div className="reasoning-step">
                <span className="reasoning-step-number">Step 1</span>
                <span className="reasoning-step-title">Ingress Event</span>
                <span className="reasoning-step-desc">{httpMethod} {requestPath}</span>
                <span className="reasoning-step-badge" style={{ color: '#6ee7b7' }}>Observed</span>
              </div>
              <div className="reasoning-step">
                <span className="reasoning-step-number">Step 2</span>
                <span className="reasoning-step-title">Feature Extraction</span>
                <span className="reasoning-step-desc">{windowLabel} sliding window</span>
                <span className="reasoning-step-badge" style={{ color: dataQualityState === 'COMPLETE' ? '#6ee7b7' : '#fdba74' }}>
                  {dataQualityState}
                </span>
              </div>
              <div className="reasoning-step">
                <span className="reasoning-step-number">Step 3</span>
                <span className="reasoning-step-title">Deterministic Rules</span>
                <span className="reasoning-step-desc">
                  {ruleFindings.filter((r) => r.triggered).length} Triggered
                </span>
                <span className="reasoning-step-badge" style={{ color: ruleFindings.some((r) => r.triggered) ? '#fca5a5' : '#6ee7b7' }}>
                  {ruleFindings.some((r) => r.triggered) ? 'Violations' : 'Clean'}
                </span>
              </div>
              <div className="reasoning-step">
                <span className="reasoning-step-number">Step 4</span>
                <span className="reasoning-step-title">ML Anomaly</span>
                <span className="reasoning-step-desc">
                  Score: {mlAnomalyResult?.anomalyScore !== null && mlAnomalyResult?.anomalyScore !== undefined ? mlAnomalyResult.anomalyScore.toFixed(3) : 'N/A'}
                </span>
                <span className="reasoning-step-badge" style={{ color: mlAnomalyResult?.isAnomaly ? '#fca5a5' : '#6ee7b7' }}>
                  {mlAnomalyResult?.isAnomaly ? 'Anomaly' : 'Baseline'}
                </span>
              </div>
              <div className="reasoning-step">
                <span className="reasoning-step-number">Step 5</span>
                <span className="reasoning-step-title">Hybrid Fusion</span>
                <span className="reasoning-step-desc">{classification}</span>
                <span className="reasoning-step-badge" style={{ color: '#d8b4fe' }}>
                  {riskScore !== null ? `Risk ${(riskScore * 100).toFixed(0)}%` : 'Insufficient'}
                </span>
              </div>
              <div className="reasoning-step" style={{ borderColor: isEligible ? 'rgba(139, 92, 246, 0.6)' : 'var(--border-default)' }}>
                <span className="reasoning-step-number">Step 6</span>
                <span className="reasoning-step-title">Deception Gate</span>
                <span className="reasoning-step-desc">{isEligible ? 'Criteria Met' : 'Suppressed'}</span>
                <span className="reasoning-step-badge" style={{ color: isEligible ? '#d8b4fe' : '#94a3b8' }}>
                  {isEligible ? 'ELIGIBLE' : 'INELIGIBLE'}
                </span>
              </div>
            </div>
          </div>

          {/* E. Decision Safety & Guardrails */}
          <div className="detection-card">
            <div className="detection-card-title">
              <span>E. Decision Safety & Guardrails</span>
              <ShieldCheck size={16} style={{ color: isEligible ? '#a78bfa' : '#94a3b8' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '1rem' }}>
              <div className="feature-box">
                <div className="feature-label">Telemetry Completeness</div>
                <div className="feature-val" style={{ color: dataQualityState === 'COMPLETE' ? '#6ee7b7' : '#f87171' }}>
                  {dataQualityState}
                </div>
              </div>
              <div className="feature-box">
                <div className="feature-label">Telemetry Loss</div>
                <div className="feature-val" style={{ color: telemetryLossDetected ? '#f87171' : '#6ee7b7' }}>
                  {telemetryLossDetected ? 'LOSS DETECTED' : 'NONE'}
                </div>
              </div>
              <div className="feature-box">
                <div className="feature-label">Confidence Score</div>
                <div className="feature-val">
                  {confidenceScore !== null ? `${(confidenceScore * 100).toFixed(0)}%` : 'N/A'}
                </div>
              </div>
              <div className="feature-box">
                <div className="feature-label">Deception Policy Gate</div>
                <div className="feature-val" style={{ color: isEligible ? '#d8b4fe' : '#94a3b8' }}>
                  {isEligible ? 'ELIGIBLE' : 'INELIGIBLE'}
                </div>
              </div>
            </div>

            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', background: 'var(--bg-surface-elevated)', padding: '0.75rem', borderRadius: '6px' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                Eligibility Rationale:
              </div>
              <div>
                {isEligible
                  ? 'Eligible: Corroborated deterministic attack pattern with complete telemetry, high confidence (>= 0.70), and low session collision risk.'
                  : (telemetryLossDetected || dataQualityState !== 'COMPLETE'
                      ? 'Ineligible: Degraded telemetry or data loss detected during session; diversion strictly prohibited to prevent misattribution.'
                      : (ruleFindings.filter((r) => r.triggered).length === 0
                          ? 'Ineligible: Unsupervised ML anomaly alone lacks deterministic rule corroboration; autonomous diversion is blocked.'
                          : 'Ineligible: Insufficient confidence or absence of HIGH/CRITICAL rule corroboration prevents countermeasure activation.'
                        )
                    )
                }
              </div>
              <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.75rem', color: '#f87171' }}>
                <strong>Execution Evidence Status:</strong> <code>MISSING</code> (No traffic diversion or honeypot execution has been performed by the gateway foundation).
              </div>
            </div>
          </div>

          {/* A. Behavioral Evidence */}
          <div className="detection-card">
            <div className="detection-card-title">
              <span>A. Behavioral Evidence (Observation Window: {windowLabel})</span>
              <Activity size={16} style={{ color: 'var(--accent-primary-light)' }} />
            </div>

            <div className="feature-grid">
              <div className="feature-box">
                <div className="feature-label">Target Application</div>
                <div className="feature-val" style={{ fontSize: '0.875rem' }}>
                  {application?.name || 'Customer Accounts API'}
                </div>
              </div>
              <div className="feature-box">
                <div className="feature-label">Client IP Reference</div>
                <div className="feature-val" style={{ fontSize: '0.875rem' }}>
                  {clientIp}
                </div>
              </div>
              <div className="feature-box">
                <div className="feature-label">HTTP Verb & Route</div>
                <div className="feature-val" style={{ fontSize: '0.8125rem', wordBreak: 'break-all' }}>
                  {httpMethod} {requestPath}
                </div>
              </div>
              <div className="feature-box">
                <div className="feature-label">Observation Status</div>
                <div className="feature-val">
                  HTTP {statusCode}
                </div>
              </div>
            </div>

            {explanationText && (
              <div style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                <strong>Evaluated Summary:</strong> {explanationText}
              </div>
            )}
          </div>

          {/* B. Deterministic Rule Findings */}
          <div className="detection-card">
            <div className="detection-card-title">
              <span>B. Deterministic Rule Findings ({ruleFindings.length} Evaluated)</span>
              <FileText size={16} style={{ color: '#fdba74' }} />
            </div>

            {ruleFindings.length === 0 ? (
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                No deterministic rule violations recorded for this window.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {ruleFindings.map((finding, idx) => {
                  const isTriggered = finding.triggered === true;
                  const severity = finding.severity || 'LOW';
                  return (
                    <div key={idx} className={`rule-card ${isTriggered ? 'triggered' : ''}`}>
                      <div className="rule-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
                            {finding.ruleId || `RULE_${idx + 1}`}
                          </span>
                          <span className={`status-badge status-badge-${severity.toLowerCase()}`}>
                            {severity}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: isTriggered ? '#fca5a5' : '#6ee7b7' }}>
                          {isTriggered ? 'TRIGGERED' : 'CLEAN'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {finding.explanation || finding.description || (isTriggered ? 'Deterministic signature violation detected.' : 'Threshold passed.')}
                      </div>
                      {finding.missingFeatures && finding.missingFeatures.length > 0 && (
                        <div style={{ fontSize: '0.6875rem', color: '#facc15' }}>
                          <strong>Missing Features:</strong> {finding.missingFeatures.join(', ')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* C. ML Detection */}
          <div className="detection-card">
            <div className="detection-card-title">
              <span>C. Unsupervised Machine Learning Anomaly Detection</span>
              <Cpu size={16} style={{ color: '#c4b5fd' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginBottom: '0.75rem' }}>
              <div className="feature-box">
                <div className="feature-label">Algorithm</div>
                <div className="feature-val" style={{ fontSize: '0.8125rem' }}>
                  {mlAnomalyResult?.algorithm || 'ISOLATION_FOREST'}
                </div>
              </div>
              <div className="feature-box">
                <div className="feature-label">Anomaly Score</div>
                <div className="feature-val" style={{ color: mlAnomalyResult?.isAnomaly ? '#fca5a5' : '#6ee7b7' }}>
                  {mlAnomalyResult?.anomalyScore !== null && mlAnomalyResult?.anomalyScore !== undefined
                    ? mlAnomalyResult.anomalyScore.toFixed(4)
                    : 'N/A'}
                </div>
              </div>
              <div className="feature-box">
                <div className="feature-label">Decision Threshold</div>
                <div className="feature-val">
                  {mlAnomalyResult?.decisionThreshold ?? '0.6000'}
                </div>
              </div>
              <div className="feature-box">
                <div className="feature-label">Model Status</div>
                <div className="feature-val" style={{ fontSize: '0.8125rem' }}>
                  {mlAnomalyResult?.modelStatus || 'READY'}
                </div>
              </div>
            </div>

            {/* Mandatory Scientific Label */}
            <div className="detection-banner detection-banner-info" style={{ fontSize: '0.75rem' }}>
              <Info size={14} style={{ flexShrink: 0 }} />
              <div>
                <strong>Scientific Note:</strong> Statistical deviation represents unusual behavioral dispersion from learned baseline features and constitutes anomaly evidence, <em>NOT proof of maliciousness or attacker identity</em>.
              </div>
            </div>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="drawer-footer">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}
