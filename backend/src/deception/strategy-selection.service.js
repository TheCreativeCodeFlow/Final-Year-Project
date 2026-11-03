/**
 * Deterministic Deception Strategy Selection Engine (Stage 5A).
 *
 * Implements deterministic strategy selection across the 5 categories:
 * - RECONNAISSANCE_DECEPTION
 * - CREDENTIAL_DECEPTION
 * - API_DECEPTION
 * - DATA_ACCESS_DECEPTION
 * - SERVICE_INTERACTION_DECEPTION
 *
 * Enforces explicit compatibility checks, prerequisite validation, and explainability.
 */

import { BASELINE_STRATEGIES, STRATEGY_CATEGORIES } from './strategy-catalog.js';

export class StrategySelectionService {
  /**
   * @param {Object} [dependencies]
   * @param {Array} [dependencies.strategies]
   */
  constructor({ strategies = null } = {}) {
    this.strategies = strategies || BASELINE_STRATEGIES;
  }

  /**
   * Map assessment rule findings and features to compatible strategy categories.
   * @param {Object} assessment
   * @returns {string[]}
   */
  inferTargetCategories(assessment = {}) {
    const categories = new Set();
    const findings = Array.isArray(assessment.ruleFindings) ? assessment.ruleFindings : [];
    const ruleIds = findings.map((f) => f.ruleId || f.id || '');

    for (const ruleId of ruleIds) {
      if (ruleId.includes('REPEATED_RESOURCE_PROBING') || ruleId.includes('SCANNER')) {
        categories.add(STRATEGY_CATEGORIES.RECONNAISSANCE_DECEPTION);
      }
      if (ruleId.includes('BRUTE_FORCE') || ruleId.includes('AUTH')) {
        categories.add(STRATEGY_CATEGORIES.CREDENTIAL_DECEPTION);
      }
      if (ruleId.includes('SUSPICIOUS_METHOD') || ruleId.includes('API')) {
        categories.add(STRATEGY_CATEGORIES.API_DECEPTION);
      }
      if (ruleId.includes('DATA_ACCESS') || ruleId.includes('EXFIL')) {
        categories.add(STRATEGY_CATEGORIES.DATA_ACCESS_DECEPTION);
      }
      if (ruleId.includes('HIGH_FREQUENCY_BURST') || ruleId.includes('RATE')) {
        categories.add(STRATEGY_CATEGORIES.SERVICE_INTERACTION_DECEPTION);
      }
    }

    // Default fallback based on primary classification if no specific rule matched
    if (categories.size === 0) {
      if (assessment.assessmentLabel === 'ATTACK') {
        categories.add(STRATEGY_CATEGORIES.RECONNAISSANCE_DECEPTION);
      }
    }

    return Array.from(categories);
  }

  /**
   * Evaluate a single strategy against assessment and policy.
   * @param {Object} strategy
   * @param {Object} assessment
   * @param {Object} policy
   * @returns {{ eligible: boolean, score: number, reasons: string[] }}
   */
  evaluateCandidate(strategy, assessment = {}, policy = {}) {
    const reasons = [];
    let eligible = true;
    let score = 0;

    // 1. Check enabled
    if (strategy.enabled === false) {
      reasons.push('STRATEGY_DISABLED');
      return { eligible: false, score: 0, reasons };
    }

    // 2. Policy-allowed strategies filter
    const allowedStrategies =
      policy.requiredEvidenceCriteria?.allowedStrategies ||
      policy.allowedStrategies ||
      null;
    if (
      Array.isArray(allowedStrategies) &&
      allowedStrategies.length > 0 &&
      !allowedStrategies.includes(strategy.strategyIdentifier) &&
      !allowedStrategies.includes(strategy.strategyType)
    ) {
      reasons.push('POLICY_STRATEGY_NOT_PERMITTED');
      eligible = false;
    }

    const prereqs = strategy.prerequisites || {};

    // 3. Category compatibility
    const targetCategories = this.inferTargetCategories(assessment);
    const categoryMatches = targetCategories.includes(strategy.strategyType);
    if (!categoryMatches) {
      reasons.push(`INCOMPATIBLE_CATEGORY: Requires one of [${targetCategories.join(', ')}], strategy is ${strategy.strategyType}`);
      eligible = false;
    } else {
      score += 50;
    }

    // 4. Rule targeted match
    const findings = Array.isArray(assessment.ruleFindings) ? assessment.ruleFindings : [];
    const activeRuleIds = findings.map((f) => f.ruleId || f.id || '');
    const targetedRules = prereqs.targetedRules || [];
    const matchedRules = targetedRules.filter((r) => activeRuleIds.includes(r));
    score += matchedRules.length * 20;

    // 5. Confidence prerequisite
    const assessmentConfidence = Number(
      assessment.confidence ??
      assessment.confidenceScore ??
      assessment.riskScore ??
      assessment.assessmentScore ??
      0
    );
    const minConfidence = Number(prereqs.minConfidence ?? 0.7);
    if (assessmentConfidence < minConfidence) {
      reasons.push(`CONFIDENCE_TOO_LOW: Assessment has ${assessmentConfidence}, strategy requires ${minConfidence}`);
      eligible = false;
    } else {
      score += Math.round(assessmentConfidence * 20);
    }

    // 6. Telemetry quality prerequisite
    const dataQuality = assessment.dataQualityState || 'COMPLETE';
    const requiredQuality = prereqs.requiredTelemetryQuality || 'COMPLETE';
    if (requiredQuality === 'COMPLETE' && (dataQuality === 'DEGRADED' || assessment.telemetryLossDetected)) {
      reasons.push('TELEMETRY_DEGRADED: Strategy requires COMPLETE telemetry without data loss');
      eligible = false;
    }

    // 7. Rule corroboration prerequisite
    const ruleCorroborated = findings.length > 0;
    if (prereqs.requireRuleCorroboration && !ruleCorroborated) {
      reasons.push('MISSING_RULE_CORROBORATION: Strategy requires deterministic rule corroboration');
      eligible = false;
    }

    // 8. Session correlation prerequisite
    const correlationConf = Number(assessment.sessionCorrelationConfidence ?? assessment.correlationConfidence ?? 0.8);
    const minCorrelation = Number(prereqs.minCorrelationConfidence ?? 0.6);
    if (correlationConf < minCorrelation) {
      reasons.push(`CORRELATION_CONFIDENCE_TOO_LOW: Has ${correlationConf}, requires ${minCorrelation}`);
      eligible = false;
    }

    return { eligible, score, reasons };
  }

  /**
   * Deterministically select the best strategy for the given assessment and policy.
   * @param {Object} params
   * @param {Object} params.assessment
   * @param {Object} params.policy
   * @param {Array} [params.customStrategies]
   * @returns {{
   *   selectedStrategy: Object|null,
   *   candidates: Array,
   *   rejectedCandidates: Array,
   *   selectionRationale: string
   * }}
   */
  selectStrategy({ assessment = {}, policy = {}, customStrategies = null }) {
    const strategyPool = customStrategies || this.strategies;
    const candidates = [];
    const rejectedCandidates = [];

    for (const strategy of strategyPool) {
      const evaluation = this.evaluateCandidate(strategy, assessment, policy);
      const candidateInfo = {
        id: strategy.id || strategy.strategyIdentifier,
        strategyIdentifier: strategy.strategyIdentifier,
        name: strategy.name,
        strategyType: strategy.strategyType,
        version: strategy.version || 1,
        score: evaluation.score,
        eligible: evaluation.eligible,
        reasons: evaluation.reasons,
        rawStrategy: strategy
      };

      candidates.push(candidateInfo);

      if (!evaluation.eligible) {
        rejectedCandidates.push({
          strategyIdentifier: strategy.strategyIdentifier,
          strategyType: strategy.strategyType,
          reasons: evaluation.reasons
        });
      }
    }

    // Filter eligible candidates
    const eligibleCandidates = candidates.filter((c) => c.eligible);

    if (eligibleCandidates.length === 0) {
      return {
        selectedStrategy: null,
        candidates,
        rejectedCandidates,
        selectionRationale: 'No deception strategy met the prerequisite confidence, rule corroboration, or category requirements.'
      };
    }

    // Deterministic ranking: highest score first, then alphabetical strategyIdentifier
    eligibleCandidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.strategyIdentifier.localeCompare(b.strategyIdentifier);
    });

    const bestCandidate = eligibleCandidates[0];
    const selectionRationale = `Selected strategy "${bestCandidate.strategyIdentifier}" (${bestCandidate.strategyType}) with score ${bestCandidate.score} matching assessment category and meeting all isolation prerequisites.`;

    return {
      selectedStrategy: bestCandidate.rawStrategy,
      candidates,
      rejectedCandidates,
      selectionRationale
    };
  }
}
