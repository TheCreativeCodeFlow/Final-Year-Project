/**
 * Adaptive Deception Policy Evaluation Engine (Stage 5A & Stage 5A.1).
 *
 * Implements strict separation between:
 * 1. deceptionDisposition: Represents whether deception is proposed, not proposed, or rejected.
 * 2. originAccessDecision: Deferral to gateway's independent access-control policy (never grants origin access).
 *
 * Invariants:
 * - A missing deception policy must NOT override an existing gateway security restriction.
 * - A degraded detection assessment must NOT become proof that traffic is benign.
 * - Deception eligibility safeguards prevent legitimate user disruption.
 * - Decisions record complete immutable snapshots of policy, strategy, and evidence.
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

export const DECEPTION_DISPOSITIONS = {
  PROPOSED: 'PROPOSED',
  NOT_PROPOSED: 'NOT_PROPOSED',
  REJECTED: 'REJECTED',
  // Backward compatibility aliases
  PROPOSE_DECEPTION: 'PROPOSED',
  DECEPTION_NOT_PROPOSED: 'NOT_PROPOSED',
  DECEPTION_REJECTED: 'REJECTED'
};

export const ORIGIN_ACCESS_DECISIONS = {
  DEFER_TO_GATEWAY: 'DEFER_TO_GATEWAY',
  PROPOSE_DIVERT_TO_DECEPTION: 'PROPOSE_DIVERT_TO_DECEPTION',
  DENY_APPLICATION_SUSPENDED: 'DENY_APPLICATION_SUSPENDED',
  DEFER_WITH_UNCERTAINTY: 'DEFER_WITH_UNCERTAINTY'
};

export const REASON_CODES = {
  // Foundational codes
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
  DSG_PLAN_GENERATED: 'DSG_PLAN_GENERATED',

  // Stage 5A.1 Semantic Separation & Disambiguation Codes
  DECEPTION_POLICY_NOT_CONFIGURED_DEFER_GATEWAY: 'DECEPTION_POLICY_NOT_CONFIGURED_DEFER_GATEWAY',
  DEGRADED_TELEMETRY_NO_ASSUMPTION_OF_BENIGN: 'DEGRADED_TELEMETRY_NO_ASSUMPTION_OF_BENIGN',
  BENIGN_TRAFFIC_DECEPTION_NOT_PROPOSED: 'BENIGN_TRAFFIC_DECEPTION_NOT_PROPOSED',
  DECEPTION_REJECTED_UNVERIFIED_ML_ANOMALY: 'DECEPTION_REJECTED_UNVERIFIED_ML_ANOMALY',
  DECEPTION_REJECTED_LOW_CONFIDENCE: 'DECEPTION_REJECTED_LOW_CONFIDENCE',
  DECEPTION_REJECTED_MISSING_CORROBORATION: 'DECEPTION_REJECTED_MISSING_CORROBORATION',
  DECEPTION_REJECTED_COLLISION_RISK: 'DECEPTION_REJECTED_COLLISION_RISK',
  APPLICATION_SUSPENDED_ACCESS_DENIED: 'APPLICATION_SUSPENDED_ACCESS_DENIED',
  DECEPTION_PROPOSED_AWAITING_ROUTING_AUTH: 'DECEPTION_PROPOSED_AWAITING_ROUTING_AUTH',
  NO_ELIGIBLE_STRATEGY_DECEPTION_REJECTED: 'NO_ELIGIBLE_STRATEGY_DECEPTION_REJECTED'
};

export class PolicyEvaluationEngine {
  constructor({ strategySelector = null, dsgPlanner = null } = {}) {
    this.strategySelector = strategySelector || new StrategySelectionService();
    this.dsgPlanner = dsgPlanner || new DSGPlannerService();
    this.evaluatorVersion = '5A.1';
    this.strategyCatalogueVersion = '1.0.0';
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
    return (
      (assessment.assessmentLabel === 'ATTACK' || assessment.classification === 'ATTACK') &&
      hasCorroboration &&
      isComplete
    );
  }

  /**
   * Build immutable assessment and policy snapshots for provenance.
   */
  static buildAssessmentSnapshot(assessment = {}) {
    return {
      id: assessment.id || null,
      label: assessment.assessmentLabel || assessment.classification || 'UNKNOWN',
      confidence: Number(
        assessment.confidence ??
        assessment.confidenceScore ??
        assessment.riskScore ??
        assessment.assessmentScore ??
        0
      ),
      riskScore: Number(assessment.riskScore ?? 0),
      dataQualityState: assessment.dataQualityState || 'COMPLETE',
      telemetryLossDetected: Boolean(assessment.telemetryLossDetected),
      deceptionEligible: PolicyEvaluationEngine.isDeceptionEligible(assessment),
      ruleFindingCount: Array.isArray(assessment.ruleFindings) ? assessment.ruleFindings.length : 0,
      mlAnomalyDetected: Boolean(assessment.mlAnomalyResult?.anomalyDetected),
      featureSnapshot: assessment.features || assessment.featureSnapshot || null
    };
  }

  static buildPolicySnapshot(policy = null) {
    if (!policy) return null;
    return {
      id: policy.id,
      name: policy.name,
      policyIdentifier: policy.policyIdentifier,
      version: policy.version || 1,
      priority: policy.priority || 100,
      applicationId: policy.applicationId || null,
      requiredEvidenceCriteria: policy.requiredEvidenceCriteria || {},
      permittedActions: policy.permittedActions || []
    };
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
   *   deceptionDisposition: string,
   *   originAccessDecision: string,
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
   *   strategyCatalogueVersion: string,
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
    const assessmentSnapshot = PolicyEvaluationEngine.buildAssessmentSnapshot(assessment);
    const policySnapshot = PolicyEvaluationEngine.buildPolicySnapshot(policy);
    const assessmentConfidence = assessmentSnapshot.confidence;
    const deceptionEligible = assessmentSnapshot.deceptionEligible;

    const evidenceReferences = {
      assessmentId: assessmentSnapshot.id,
      assessmentLabel: assessmentSnapshot.label,
      confidence: assessmentConfidence,
      dataQualityState: assessmentSnapshot.dataQualityState,
      telemetryLossDetected: assessmentSnapshot.telemetryLossDetected,
      deceptionEligible,
      ruleFindingCount: assessmentSnapshot.ruleFindingCount,
      mlAnomalyDetected: assessmentSnapshot.mlAnomalyDetected,
      assessmentSnapshot,
      policySnapshot,
      featureSnapshot: assessmentSnapshot.featureSnapshot
    };

    // Helper to package consistent return structure
    const createResult = ({
      decisionResult,
      deceptionDisposition,
      originAccessDecision,
      decisionRationale,
      selectedStrategy = null,
      selectedStrategyVersion = null,
      candidateStrategyIds = [],
      rejectedCandidates = [],
      dsgPlan = null
    }) => ({
      decisionResult,
      deceptionDisposition,
      originAccessDecision,
      decisionRationale,
      reasonCodes,
      policyId: policy?.id || null,
      policyVersion: policy?.version || null,
      selectedStrategy,
      selectedStrategyId: selectedStrategy ? (selectedStrategy.id || selectedStrategy.strategyIdentifier) : null,
      selectedStrategyVersion,
      candidateStrategyIds,
      rejectedCandidates,
      dsgPlan,
      evaluatorVersion: this.evaluatorVersion,
      strategyCatalogueVersion: this.strategyCatalogueVersion,
      evidenceReferences: {
        ...evidenceReferences,
        selectedStrategySnapshot: selectedStrategy
          ? {
              strategyIdentifier: selectedStrategy.strategyIdentifier,
              strategyType: selectedStrategy.strategyType,
              version: selectedStrategyVersion || selectedStrategy.version || 1
            }
          : null
      }
    });

    // -------------------------------------------------------------------------
    // Guard 1: Policy Configuration Safe Default
    // -------------------------------------------------------------------------
    if (!policy || policy.enabled === false) {
      reasonCodes.push(REASON_CODES.POLICY_DISABLED_OR_MISSING);
      reasonCodes.push(REASON_CODES.DECEPTION_POLICY_NOT_CONFIGURED_DEFER_GATEWAY);
      return createResult({
        decisionResult: DECISION_RESULTS.POLICY_NOT_CONFIGURED,
        deceptionDisposition: DECEPTION_DISPOSITIONS.NOT_PROPOSED,
        originAccessDecision: ORIGIN_ACCESS_DECISIONS.DEFER_TO_GATEWAY,
        decisionRationale:
          'No active deception policy is configured for this tenant or application. Deception is not proposed. Origin access control is deferred to independent gateway routing policy.'
      });
    }

    // -------------------------------------------------------------------------
    // Guard 2: Application Readiness
    // -------------------------------------------------------------------------
    if (application && application.status === 'SUSPENDED') {
      reasonCodes.push(REASON_CODES.APPLICATION_SUSPENDED);
      reasonCodes.push(REASON_CODES.APPLICATION_SUSPENDED_ACCESS_DENIED);
      return createResult({
        decisionResult: DECISION_RESULTS.BLOCK_POLICY,
        deceptionDisposition: DECEPTION_DISPOSITIONS.NOT_PROPOSED,
        originAccessDecision: ORIGIN_ACCESS_DECISIONS.DENY_APPLICATION_SUSPENDED,
        decisionRationale:
          'Protected application is administratively suspended. Origin access is denied per administrative policy; deception is not proposed.'
      });
    }

    // -------------------------------------------------------------------------
    // Guard 3: Telemetry Degradation and Missing Evidence
    // -------------------------------------------------------------------------
    if (assessment.telemetryLossDetected || assessment.dataQualityState === 'DEGRADED') {
      reasonCodes.push(REASON_CODES.TELEMETRY_LOSS_DEGRADATION);
      reasonCodes.push(REASON_CODES.DEGRADED_TELEMETRY_NO_ASSUMPTION_OF_BENIGN);
      return createResult({
        decisionResult: DECISION_RESULTS.INSUFFICIENT_EVIDENCE,
        deceptionDisposition: DECEPTION_DISPOSITIONS.REJECTED,
        originAccessDecision: ORIGIN_ACCESS_DECISIONS.DEFER_WITH_UNCERTAINTY,
        decisionRationale:
          'Telemetry loss or degraded data quality detected during observation window. Deception is strictly rejected. Origin access decision is deferred to gateway under uncertainty condition — degraded telemetry is never assumed to be benign.'
      });
    }

    if (assessment.assessmentLabel === 'INSUFFICIENT_EVIDENCE') {
      reasonCodes.push(REASON_CODES.ASSESSMENT_INSUFFICIENT_EVIDENCE);
      reasonCodes.push(REASON_CODES.DEGRADED_TELEMETRY_NO_ASSUMPTION_OF_BENIGN);
      return createResult({
        decisionResult: DECISION_RESULTS.INSUFFICIENT_EVIDENCE,
        deceptionDisposition: DECEPTION_DISPOSITIONS.REJECTED,
        originAccessDecision: ORIGIN_ACCESS_DECISIONS.DEFER_WITH_UNCERTAINTY,
        decisionRationale:
          'Detection assessment explicitly labeled as INSUFFICIENT_EVIDENCE. Deception is rejected. Origin access decision is deferred to gateway with uncertainty flag.'
      });
    }

    // -------------------------------------------------------------------------
    // Guard 4: Benign Behavior
    // -------------------------------------------------------------------------
    if (assessment.assessmentLabel === 'BENIGN') {
      reasonCodes.push(REASON_CODES.ASSESSMENT_BENIGN);
      reasonCodes.push(REASON_CODES.BENIGN_TRAFFIC_DECEPTION_NOT_PROPOSED);
      return createResult({
        decisionResult: DECISION_RESULTS.ALLOW_NORMAL,
        deceptionDisposition: DECEPTION_DISPOSITIONS.NOT_PROPOSED,
        originAccessDecision: ORIGIN_ACCESS_DECISIONS.DEFER_TO_GATEWAY,
        decisionRationale:
          'Observed behavioral telemetry conforms to benign baseline parameters. Deception is not proposed. Origin access control is deferred to gateway upstream policy.'
      });
    }

    // -------------------------------------------------------------------------
    // Guard 5: Deception Eligibility Safeguards
    // -------------------------------------------------------------------------
    if (deceptionEligible !== true) {
      const ruleCount = Array.isArray(assessment.ruleFindings) ? assessment.ruleFindings.length : 0;
      const isMlOnly = ruleCount === 0 && Boolean(assessment.mlAnomalyResult?.anomalyDetected);

      if (isMlOnly) {
        reasonCodes.push(REASON_CODES.ML_ONLY_UNVERIFIED_ANOMALY);
        reasonCodes.push(REASON_CODES.DECEPTION_REJECTED_UNVERIFIED_ML_ANOMALY);
        return createResult({
          decisionResult: DECISION_RESULTS.INSUFFICIENT_EVIDENCE,
          deceptionDisposition: DECEPTION_DISPOSITIONS.REJECTED,
          originAccessDecision: ORIGIN_ACCESS_DECISIONS.DEFER_WITH_UNCERTAINTY,
          decisionRationale:
            'Unsupervised ML anomaly detected without deterministic security rule corroboration. Deception rejected; requires verified rule corroboration to avoid legitimate user disruption. Origin access deferred with uncertainty.'
        });
      }

      reasonCodes.push(REASON_CODES.HIGH_COLLISION_RISK);
      reasonCodes.push(REASON_CODES.DECEPTION_REJECTED_COLLISION_RISK);
      return createResult({
        decisionResult: DECISION_RESULTS.ALLOW_NORMAL,
        deceptionDisposition: DECEPTION_DISPOSITIONS.REJECTED,
        originAccessDecision: ORIGIN_ACCESS_DECISIONS.DEFER_TO_GATEWAY,
        decisionRationale:
          'Assessment failed deception eligibility criteria (e.g. potential legitimate user collision risk or unverified session attribution). Deception rejected; origin access deferred to gateway policy.'
      });
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
      reasonCodes.push(REASON_CODES.DECEPTION_REJECTED_LOW_CONFIDENCE);
      return createResult({
        decisionResult: DECISION_RESULTS.INSUFFICIENT_EVIDENCE,
        deceptionDisposition: DECEPTION_DISPOSITIONS.REJECTED,
        originAccessDecision: ORIGIN_ACCESS_DECISIONS.DEFER_WITH_UNCERTAINTY,
        decisionRationale: `Assessment confidence (${assessmentConfidence}) does not meet policy minimum requirement (${minConfidence}). Deception rejected.`
      });
    }
    reasonCodes.push(REASON_CODES.CONFIDENCE_THRESHOLD_MET);

    // 6b. Rule corroboration requirement
    const requireRuleCorroboration = criteria.requireRuleCorroboration !== false;
    const ruleFindings = Array.isArray(assessment.ruleFindings) ? assessment.ruleFindings : [];
    if (requireRuleCorroboration && ruleFindings.length === 0) {
      reasonCodes.push(REASON_CODES.RULE_CORROBORATION_REQUIRED);
      reasonCodes.push(REASON_CODES.DECEPTION_REJECTED_MISSING_CORROBORATION);
      return createResult({
        decisionResult: DECISION_RESULTS.INSUFFICIENT_EVIDENCE,
        deceptionDisposition: DECEPTION_DISPOSITIONS.REJECTED,
        originAccessDecision: ORIGIN_ACCESS_DECISIONS.DEFER_WITH_UNCERTAINTY,
        decisionRationale:
          'Policy strictly requires deterministic rule corroboration, but no deterministic rule findings were present in the assessment. Deception rejected.'
      });
    }
    if (ruleFindings.length > 0) {
      reasonCodes.push(REASON_CODES.RULE_CORROBORATED);
    }

    // 6c. Telemetry quality requirement
    const requiredQuality = criteria.requiredTelemetryQuality || 'COMPLETE';
    if (requiredQuality === 'COMPLETE' && assessment.dataQualityState !== 'COMPLETE') {
      reasonCodes.push(REASON_CODES.TELEMETRY_QUALITY_INSUFFICIENT);
      reasonCodes.push(REASON_CODES.DEGRADED_TELEMETRY_NO_ASSUMPTION_OF_BENIGN);
      return createResult({
        decisionResult: DECISION_RESULTS.INSUFFICIENT_EVIDENCE,
        deceptionDisposition: DECEPTION_DISPOSITIONS.REJECTED,
        originAccessDecision: ORIGIN_ACCESS_DECISIONS.DEFER_WITH_UNCERTAINTY,
        decisionRationale: `Policy requires "${requiredQuality}" telemetry quality, but assessment reports "${assessment.dataQualityState}". Deception rejected.`
      });
    }

    // 6d. Check permitted actions in policy
    const permittedActions = Array.isArray(policy.permittedActions) ? policy.permittedActions : [];
    const permitsDeception =
      permittedActions.includes('PROPOSE_DECEPTION') ||
      permittedActions.includes('DIVERSION') ||
      permittedActions.length === 0; // Default permits if unspecified
    if (!permitsDeception) {
      reasonCodes.push(REASON_CODES.ACTION_NOT_PERMITTED_BY_POLICY);
      return createResult({
        decisionResult: DECISION_RESULTS.ALLOW_NORMAL,
        deceptionDisposition: DECEPTION_DISPOSITIONS.NOT_PROPOSED,
        originAccessDecision: ORIGIN_ACCESS_DECISIONS.DEFER_TO_GATEWAY,
        decisionRationale:
          'Policy does not permit deception proposal or diversion actions. Deception is not proposed; origin access deferred to gateway.'
      });
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
      reasonCodes.push(REASON_CODES.NO_ELIGIBLE_STRATEGY_DECEPTION_REJECTED);
      return createResult({
        decisionResult: DECISION_RESULTS.NO_ELIGIBLE_STRATEGY,
        deceptionDisposition: DECEPTION_DISPOSITIONS.REJECTED,
        originAccessDecision: ORIGIN_ACCESS_DECISIONS.DEFER_TO_GATEWAY,
        decisionRationale: `Assessment passed eligibility criteria, but no deception strategy met category and compatibility requirements. ${selection.selectionRationale}`,
        candidateStrategyIds,
        rejectedCandidates: selection.rejectedCandidates
      });
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
    reasonCodes.push(REASON_CODES.DECEPTION_PROPOSED_AWAITING_ROUTING_AUTH);

    const decisionRationale = `Corroborated ${assessmentSnapshot.label} attack (confidence: ${assessmentConfidence}). Policy "${policy.name}" criteria satisfied. Selected strategy "${selectedStrategy.strategyIdentifier}" (${selectedStrategy.strategyType}). Generated proposed DSG mutation plan (${dsgPlan.nodesToAdd.length} nodes, ${dsgPlan.edgesToAdd.length} edges). Deception is proposed awaiting routing authorization. Origin access remains governed by gateway.`;

    return createResult({
      decisionResult: DECISION_RESULTS.PROPOSE_DECEPTION,
      deceptionDisposition: DECEPTION_DISPOSITIONS.PROPOSED,
      originAccessDecision: ORIGIN_ACCESS_DECISIONS.PROPOSE_DIVERT_TO_DECEPTION,
      decisionRationale,
      selectedStrategy,
      selectedStrategyVersion: selectedStrategy.version || 1,
      candidateStrategyIds,
      rejectedCandidates: selection.rejectedCandidates,
      dsgPlan
    });
  }
}
