/**
 * Adaptive Deception Policy Evaluation Engine (Stage 5A).
 *
 * Consumes:
 * - BehavioralAssessment (detection assessment with rule findings and ML anomaly results)
 * - ProtectedApplication (target application configuration and routing mode)
 * - DeceptionPolicy (tenant/application policy with evidence criteria and permitted actions)
 * - DeceptionStrategy metadata (available strategy catalogue)
 * - DeceptionGraph (current graph topology)
 *
 * Returns deterministic PolicyDecision:
 * - ALLOW_NORMAL
 * - BLOCK_POLICY
 * - INSUFFICIENT_EVIDENCE
 * - POLICY_NOT_CONFIGURED
 * - NO_ELIGIBLE_STRATEGY
 * - PROPOSE_DECEPTION
 *
 * Invariant: Never proposes diversion when no policy is configured or evidence is degraded.
 */

import { StrategySelectionService } from './strategy-selection.service.js';
import { DSGPlannerService } from './dsg-planner.service.js';

export const DECISION_RESULTS = {
  ALLOW_NORMAL: 'ALLOW_NORMAL',
  BLOCK_POLICY: 'BLOCK_POLICY',
  INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE',
  POLICY_NOT_CONFIGURED: 'POLICY_NOT_CONFIGURED',
  NO_ELIGIBLE_STRATEGY: 'NO_ELIGIBLE_STRATEGY',
  PROPOSE_DECEPTION: 'PROPOSE_DECEPTION'
};

export const REASON_CODES = {
  POLICY_DISABLED_OR_MISSING: 'POLICY_DISABLED_OR_MISSING',
  ASSESSMENT_BENIGN: 'ASSESSMENT_BENIGN',
  ASSESSMENT_INSUFFICIENT_EVIDENCE: 'ASSESSMENT_INSUFFICIENT_EVIDENCE',
  TELEMETRY_LOSS_DEGRADATION: 'TELEMETRY_LOSS_DEGRADATION',
  ML_ONLY_UNVERIFIED_ANOMALY: 'ML_ONLY_UNVERIFIED_ANOMALY',
  HIGH_COLLISION_RISK: 'HIGH_COLLISION_RISK',
  CONFIDENCE_BELOW_POLICY_MINIMUM: 'CONFIDENCE_BELOW_POLICY_MINIMUM',
  CORRELATION_CONFIDENCE_INSUFFICIENT: 'CORRELATION_CONFIDENCE_INSUFFICIENT',
  TELEMETRY_QUALITY_INSUFFICIENT: 'TELEMETRY_QUALITY_INSUFFICIENT',
  RULE_CORROBORATION_REQUIRED: 'RULE_CORROBORATION_REQUIRED',
  ACTION_NOT_PERMITTED_BY_POLICY: 'ACTION_NOT_PERMITTED_BY_POLICY',
  APPLICATION_SUSPENDED: 'APPLICATION_SUSPENDED',
  NO_COMPATIBLE_STRATEGY_FOUND: 'NO_COMPATIBLE_STRATEGY_FOUND',
  ELIGIBILITY_CHECK_PASSED: 'ELIGIBILITY_CHECK_PASSED',
  CONFIDENCE_THRESHOLD_MET: 'CONFIDENCE_THRESHOLD_MET',
  RULE_CORROBORATED: 'RULE_CORROBORATED',
  STRATEGY_SELECTED: 'STRATEGY_SELECTED',
  DSG_PLAN_GENERATED: 'DSG_PLAN_GENERATED'
};

export class PolicyEvaluationEngine {
  constructor({ strategySelector = null, dsgPlanner = null } = {}) {
    this.strategySelector = strategySelector || new StrategySelectionService();
    this.dsgPlanner = dsgPlanner || new DSGPlannerService();
    this.evaluatorVersion = '5A.1';
  }

  /**
   * Helper to determine deception eligibility safely from assessment object or DB row.
   */
  static isDeceptionEligible(assessment = {}) {
    if (assessment.deceptionEligible !== undefined) {
      return Boolean(assessment.deceptionEligible);
    }
    if (assessment.explanation?.deceptionEligible !== undefined) {
      return Boolean(assessment.explanation.deceptionEligible);
    }
    const findings = Array.isArray(assessment.ruleFindings) ? assessment.ruleFindings : [];
    const hasCorroboration = findings.length > 0;
    const isComplete = !assessment.telemetryLossDetected && assessment.dataQualityState !== 'DEGRADED';
    return (assessment.assessmentLabel === 'ATTACK' || assessment.classification === 'ATTACK') && hasCorroboration && isComplete;
  }

  /**
   * Deterministically evaluate policy against an assessment.
   *
   * @param {Object} params
   * @param {Object} params.assessment - BehavioralAssessment record
   * @param {Object} [params.application] - ProtectedApplication record
   * @param {Object} [params.policy] - DeceptionPolicy record
   * @param {Array} [params.strategies] - Available strategies
   * @param {Object} [params.currentGraph] - Current DSG
   * @param {string} params.tenantId
   * @returns {{
   *   decisionResult: string,
   *   decisionRationale: string,
   *   reasonCodes: string[],
   *   policyId: string|null,
   *   policyVersion: number|null,
   *   selectedStrategy: Object|null,
   *   selectedStrategyId: string|null,
   *   selectedStrategyVersion: number|null,
   *   candidateStrategyIds: string[],
   *   rejectedCandidates: Array,
   *   dsgPlan: Object|null,
   *   evaluatorVersion: string,
   *   evidenceReferences: Object
   * }}
   */
  evaluate({
    assessment = {},
    application = null,
    policy = null,
    strategies = null,
    currentGraph = null,
    tenantId
  }) {
    const reasonCodes = [];
    const assessmentConfidence = Number(
      assessment.confidence ??
      assessment.confidenceScore ??
      assessment.riskScore ??
      assessment.assessmentScore ??
      0
    );
    const deceptionEligible = PolicyEvaluationEngine.isDeceptionEligible(assessment);

    const evidenceReferences = {
      assessmentId: assessment.id || null,
      assessmentLabel: assessment.assessmentLabel || assessment.classification || 'UNKNOWN',
      confidence: assessmentConfidence,
      dataQualityState: assessment.dataQualityState || 'COMPLETE',
      telemetryLossDetected: Boolean(assessment.telemetryLossDetected),
      deceptionEligible,
      ruleFindingCount: Array.isArray(assessment.ruleFindings) ? assessment.ruleFindings.length : 0,
      mlAnomalyDetected: Boolean(assessment.mlAnomalyResult?.anomalyDetected)
    };

    // -------------------------------------------------------------------------
    // Guard 1: Policy Configuration Safe Default
    // -------------------------------------------------------------------------
    if (!policy || policy.enabled === false) {
      reasonCodes.push(REASON_CODES.POLICY_DISABLED_OR_MISSING);
      return {
        decisionResult: DECISION_RESULTS.POLICY_NOT_CONFIGURED,
        decisionRationale:
          'No active deception policy is configured for this tenant or application. System defaults safely to normal traffic flow without deception proposal.',
        reasonCodes,
        policyId: policy?.id || null,
        policyVersion: policy?.version || null,
        selectedStrategy: null,
        selectedStrategyId: null,
        selectedStrategyVersion: null,
        candidateStrategyIds: [],
        rejectedCandidates: [],
        dsgPlan: null,
        evaluatorVersion: this.evaluatorVersion,
        evidenceReferences
      };
    }

    // -------------------------------------------------------------------------
    // Guard 2: Application Readiness
    // -------------------------------------------------------------------------
    if (application && application.status === 'SUSPENDED') {
      reasonCodes.push(REASON_CODES.APPLICATION_SUSPENDED);
      return {
        decisionResult: DECISION_RESULTS.BLOCK_POLICY,
        decisionRationale: 'Protected application is suspended. Access is blocked per administrative policy.',
        reasonCodes,
        policyId: policy.id,
        policyVersion: policy.version,
        selectedStrategy: null,
        selectedStrategyId: null,
        selectedStrategyVersion: null,
        candidateStrategyIds: [],
        rejectedCandidates: [],
        dsgPlan: null,
        evaluatorVersion: this.evaluatorVersion,
        evidenceReferences
      };
    }

    // -------------------------------------------------------------------------
    // Guard 3: Telemetry Degradation and Missing Evidence
    // -------------------------------------------------------------------------
    if (assessment.telemetryLossDetected || assessment.dataQualityState === 'DEGRADED') {
      reasonCodes.push(REASON_CODES.TELEMETRY_LOSS_DEGRADATION);
      return {
        decisionResult: DECISION_RESULTS.INSUFFICIENT_EVIDENCE,
        decisionRationale:
          'Telemetry loss or degraded data quality detected during observation window. Deception proposals are strictly prohibited on degraded observations.',
        reasonCodes,
        policyId: policy.id,
        policyVersion: policy.version,
        selectedStrategy: null,
        selectedStrategyId: null,
        selectedStrategyVersion: null,
        candidateStrategyIds: [],
        rejectedCandidates: [],
        dsgPlan: null,
        evaluatorVersion: this.evaluatorVersion,
        evidenceReferences
      };
    }

    if (assessment.assessmentLabel === 'INSUFFICIENT_EVIDENCE') {
      reasonCodes.push(REASON_CODES.ASSESSMENT_INSUFFICIENT_EVIDENCE);
      return {
        decisionResult: DECISION_RESULTS.INSUFFICIENT_EVIDENCE,
        decisionRationale:
          'Detection assessment explicitly labeled as INSUFFICIENT_EVIDENCE. Cannot authorize deception planning without sufficient behavioral ground truth.',
        reasonCodes,
        policyId: policy.id,
        policyVersion: policy.version,
        selectedStrategy: null,
        selectedStrategyId: null,
        selectedStrategyVersion: null,
        candidateStrategyIds: [],
        rejectedCandidates: [],
        dsgPlan: null,
        evaluatorVersion: this.evaluatorVersion,
        evidenceReferences
      };
    }

    // -------------------------------------------------------------------------
    // Guard 4: Benign Behavior
    // -------------------------------------------------------------------------
    if (assessment.assessmentLabel === 'BENIGN') {
      reasonCodes.push(REASON_CODES.ASSESSMENT_BENIGN);
      return {
        decisionResult: DECISION_RESULTS.ALLOW_NORMAL,
        decisionRationale:
          'Observed behavioral telemetry conforms to benign baseline parameters. Routed normally without diversion.',
        reasonCodes,
        policyId: policy.id,
        policyVersion: policy.version,
        selectedStrategy: null,
        selectedStrategyId: null,
        selectedStrategyVersion: null,
        candidateStrategyIds: [],
        rejectedCandidates: [],
        dsgPlan: null,
        evaluatorVersion: this.evaluatorVersion,
        evidenceReferences
      };
    }

    // -------------------------------------------------------------------------
    // Guard 5: Deception Eligibility Safeguards
    // -------------------------------------------------------------------------
    if (deceptionEligible !== true) {
      // Differentiate why it's not eligible
      const ruleCount = Array.isArray(assessment.ruleFindings) ? assessment.ruleFindings.length : 0;
      const isMlOnly = ruleCount === 0 && assessment.mlAnomalyResult?.anomalyDetected;

      if (isMlOnly) {
        reasonCodes.push(REASON_CODES.ML_ONLY_UNVERIFIED_ANOMALY);
        return {
          decisionResult: DECISION_RESULTS.INSUFFICIENT_EVIDENCE,
          decisionRationale:
            'Unsupervised ML anomaly detected without deterministic security rule corroboration. Deception proposals require verified rule corroboration to avoid legitimate user disruption.',
          reasonCodes,
          policyId: policy.id,
          policyVersion: policy.version,
          selectedStrategy: null,
          selectedStrategyId: null,
          selectedStrategyVersion: null,
          candidateStrategyIds: [],
          rejectedCandidates: [],
          dsgPlan: null,
          evaluatorVersion: this.evaluatorVersion,
          evidenceReferences
        };
      }

      reasonCodes.push(REASON_CODES.HIGH_COLLISION_RISK);
      return {
        decisionResult: DECISION_RESULTS.ALLOW_NORMAL,
        decisionRationale:
          'Assessment failed deception eligibility criteria (e.g. potential legitimate user collision risk or unverified session attribution). Allowed normal flow.',
        reasonCodes,
        policyId: policy.id,
        policyVersion: policy.version,
        selectedStrategy: null,
        selectedStrategyId: null,
        selectedStrategyVersion: null,
        candidateStrategyIds: [],
        rejectedCandidates: [],
        dsgPlan: null,
        evaluatorVersion: this.evaluatorVersion,
        evidenceReferences
      };
    }

    reasonCodes.push(REASON_CODES.ELIGIBILITY_CHECK_PASSED);

    // -------------------------------------------------------------------------
    // Guard 6: Policy Evidence Criteria Evaluation
    // -------------------------------------------------------------------------
    const criteria = policy.requiredEvidenceCriteria || {};

    // 6a. Minimum confidence threshold
    const minConfidence = Number(criteria.minConfidence ?? 0.7);
    if (assessmentConfidence < minConfidence) {
      reasonCodes.push(REASON_CODES.CONFIDENCE_BELOW_POLICY_MINIMUM);
      return {
        decisionResult: DECISION_RESULTS.INSUFFICIENT_EVIDENCE,
        decisionRationale: `Assessment confidence (${assessmentConfidence}) does not meet policy minimum requirement (${minConfidence}).`,
        reasonCodes,
        policyId: policy.id,
        policyVersion: policy.version,
        selectedStrategy: null,
        selectedStrategyId: null,
        selectedStrategyVersion: null,
        candidateStrategyIds: [],
        rejectedCandidates: [],
        dsgPlan: null,
        evaluatorVersion: this.evaluatorVersion,
        evidenceReferences
      };
    }
    reasonCodes.push(REASON_CODES.CONFIDENCE_THRESHOLD_MET);

    // 6b. Rule corroboration requirement
    const requireRuleCorroboration = criteria.requireRuleCorroboration !== false;
    const ruleFindings = Array.isArray(assessment.ruleFindings) ? assessment.ruleFindings : [];
    if (requireRuleCorroboration && ruleFindings.length === 0) {
      reasonCodes.push(REASON_CODES.RULE_CORROBORATION_REQUIRED);
      return {
        decisionResult: DECISION_RESULTS.INSUFFICIENT_EVIDENCE,
        decisionRationale:
          'Policy strictly requires deterministic rule corroboration, but no deterministic rule findings were present in the assessment.',
        reasonCodes,
        policyId: policy.id,
        policyVersion: policy.version,
        selectedStrategy: null,
        selectedStrategyId: null,
        selectedStrategyVersion: null,
        candidateStrategyIds: [],
        rejectedCandidates: [],
        dsgPlan: null,
        evaluatorVersion: this.evaluatorVersion,
        evidenceReferences
      };
    }
    if (ruleFindings.length > 0) {
      reasonCodes.push(REASON_CODES.RULE_CORROBORATED);
    }

    // 6c. Telemetry quality requirement
    const requiredQuality = criteria.requiredTelemetryQuality || 'COMPLETE';
    if (requiredQuality === 'COMPLETE' && assessment.dataQualityState !== 'COMPLETE') {
      reasonCodes.push(REASON_CODES.TELEMETRY_QUALITY_INSUFFICIENT);
      return {
        decisionResult: DECISION_RESULTS.INSUFFICIENT_EVIDENCE,
        decisionRationale: `Policy requires "${requiredQuality}" telemetry quality, but assessment reports "${assessment.dataQualityState}".`,
        reasonCodes,
        policyId: policy.id,
        policyVersion: policy.version,
        selectedStrategy: null,
        selectedStrategyId: null,
        selectedStrategyVersion: null,
        candidateStrategyIds: [],
        rejectedCandidates: [],
        dsgPlan: null,
        evaluatorVersion: this.evaluatorVersion,
        evidenceReferences
      };
    }

    // 6d. Check permitted actions in policy
    const permittedActions = Array.isArray(policy.permittedActions) ? policy.permittedActions : [];
    const permitsDeception =
      permittedActions.includes('PROPOSE_DECEPTION') ||
      permittedActions.includes('DIVERSION') ||
      permittedActions.length === 0; // Default permits if open
    if (!permitsDeception) {
      reasonCodes.push(REASON_CODES.ACTION_NOT_PERMITTED_BY_POLICY);
      return {
        decisionResult: DECISION_RESULTS.ALLOW_NORMAL,
        decisionRationale: 'Policy does not permit deception proposal or diversion actions.',
        reasonCodes,
        policyId: policy.id,
        policyVersion: policy.version,
        selectedStrategy: null,
        selectedStrategyId: null,
        selectedStrategyVersion: null,
        candidateStrategyIds: [],
        rejectedCandidates: [],
        dsgPlan: null,
        evaluatorVersion: this.evaluatorVersion,
        evidenceReferences
      };
    }

    // -------------------------------------------------------------------------
    // Guard 7: Deterministic Strategy Selection
    // -------------------------------------------------------------------------
    const selection = this.strategySelector.selectStrategy({
      assessment,
      policy,
      customStrategies: strategies
    });

    const candidateStrategyIds = selection.candidates.map((c) => c.strategyIdentifier);

    if (!selection.selectedStrategy) {
      reasonCodes.push(REASON_CODES.NO_COMPATIBLE_STRATEGY_FOUND);
      return {
        decisionResult: DECISION_RESULTS.NO_ELIGIBLE_STRATEGY,
        decisionRationale: `Assessment passed eligibility criteria, but no deception strategy met category and compatibility requirements. ${selection.selectionRationale}`,
        reasonCodes,
        policyId: policy.id,
        policyVersion: policy.version,
        selectedStrategy: null,
        selectedStrategyId: null,
        selectedStrategyVersion: null,
        candidateStrategyIds,
        rejectedCandidates: selection.rejectedCandidates,
        dsgPlan: null,
        evaluatorVersion: this.evaluatorVersion,
        evidenceReferences
      };
    }

    reasonCodes.push(REASON_CODES.STRATEGY_SELECTED);

    // -------------------------------------------------------------------------
    // Guard 8: Deception State Graph Planning
    // -------------------------------------------------------------------------
    const selectedStrategy = selection.selectedStrategy;
    const dsgPlan = this.dsgPlanner.planMutation({
      currentGraph,
      strategy: selectedStrategy,
      assessment,
      policy,
      tenantId,
      applicationId: application?.id || null
    });

    reasonCodes.push(REASON_CODES.DSG_PLAN_GENERATED);

    const decisionRationale = `Corroborated ${assessment.assessmentLabel} attack (confidence: ${assessmentConfidence}). Policy "${policy.name}" criteria satisfied. Selected strategy "${selectedStrategy.strategyIdentifier}" (${selectedStrategy.strategyType}). Generated proposed DSG mutation plan (${dsgPlan.nodesToAdd.length} nodes, ${dsgPlan.edgesToAdd.length} edges). Live execution remains unprovisioned.`;

    return {
      decisionResult: DECISION_RESULTS.PROPOSE_DECEPTION,
      decisionRationale,
      reasonCodes,
      policyId: policy.id,
      policyVersion: policy.version,
      selectedStrategy,
      selectedStrategyId: selectedStrategy.id || selectedStrategy.strategyIdentifier,
      selectedStrategyVersion: selectedStrategy.version || 1,
      candidateStrategyIds,
      rejectedCandidates: selection.rejectedCandidates,
      dsgPlan,
      evaluatorVersion: this.evaluatorVersion,
      evidenceReferences
    };
  }
}
