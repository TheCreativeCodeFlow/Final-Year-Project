/**
 * Deterministic Deception Strategy Selection Engine (Stage 5A & Stage 5A.1).
 *
 * Implements deterministic strategy selection across the 5 canonical categories:
 * 1. RECONNAISSANCE_DECEPTION
 * 2. CREDENTIAL_DECEPTION
 * 3. API_DECEPTION
 * 4. DATA_ACCESS_DECEPTION
 * 5. SERVICE_INTERACTION_DECEPTION
 *
 * Enforces explicit compatibility checks, prerequisite validation, multi-stage
 * attack arbitration, uncertainty penalties, and explainable ranking.
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
   * Helper to check if a targeted rule pattern matches an active rule finding.
   * Checks exact match, substring match, and word set equivalence.
   */
  static matchesRulePattern(targetPattern, activeRuleId) {
    const t = String(targetPattern || '').toUpperCase().trim();
    const a = String(activeRuleId || '').toUpperCase().trim();
    if (!t || !a) return false;
    if (t === a) return true;
    if (t.includes(a) || a.includes(t)) return true;

    // Word set match (e.g. RULE_AUTH_BRUTE_FORCE vs RULE_BRUTE_FORCE_AUTH)
    const tTokens = t.replace(/^RULE_/, '').split('_').filter(Boolean);
    const aTokens = a.replace(/^RULE_/, '').split('_').filter(Boolean);
    if (tTokens.length > 0 && aTokens.length > 0) {
      const matchCount = tTokens.filter((token) => aTokens.includes(token)).length;
      if (matchCount >= 2 && matchCount === Math.min(tTokens.length, aTokens.length)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Map assessment rule findings and features to compatible strategy categories.
   * Differentiates single-vector and multi-vector / multi-stage attack signatures.
   *
   * @param {Object} assessment
   * @returns {string[]}
   */
  inferTargetCategories(assessment = {}) {
    const categories = new Set();
    const findings = Array.isArray(assessment.ruleFindings) ? assessment.ruleFindings : [];
    const ruleIds = findings.map((f) => String(f.ruleId || f.id || '').toUpperCase());

    for (const ruleId of ruleIds) {
      if (
        ruleId.includes('RESOURCE_PROBING') ||
        ruleId.includes('SCANNER') ||
        ruleId.includes('SLOW_RECON') ||
        ruleId.includes('RECON')
      ) {
        categories.add(STRATEGY_CATEGORIES.RECONNAISSANCE_DECEPTION);
      }
      if (
        ruleId.includes('BRUTE_FORCE') ||
        ruleId.includes('AUTH') ||
        ruleId.includes('CREDENTIAL') ||
        ruleId.includes('PASSWORD')
      ) {
        categories.add(STRATEGY_CATEGORIES.CREDENTIAL_DECEPTION);
      }
      if (
        ruleId.includes('METHOD') ||
        ruleId.includes('API') ||
        ruleId.includes('REST') ||
        ruleId.includes('ENUMERATION')
      ) {
        categories.add(STRATEGY_CATEGORIES.API_DECEPTION);
      }
      if (
        ruleId.includes('DATA_ACCESS') ||
        ruleId.includes('EXFIL') ||
        ruleId.includes('SQL') ||
        ruleId.includes('INJECTION') ||
        ruleId.includes('QUERY_TAMPER')
      ) {
        categories.add(STRATEGY_CATEGORIES.DATA_ACCESS_DECEPTION);
      }
      if (
        ruleId.includes('BURST') ||
        ruleId.includes('RATE') ||
        ruleId.includes('SERVICE_DISCOVERY') ||
        ruleId.includes('INTERACTION')
      ) {
        categories.add(STRATEGY_CATEGORIES.SERVICE_INTERACTION_DECEPTION);
      }
    }

    // Secondary inference: check behavioral feature indicators if rule IDs didn't match
    const features = assessment.features || assessment.featureSnapshot || {};
    if (categories.size === 0) {
      if (Number(features.authFailureCount || 0) > 3) {
        categories.add(STRATEGY_CATEGORIES.CREDENTIAL_DECEPTION);
      }
      if (Number(features.distinctPathsSampled || 0) > 10) {
        categories.add(STRATEGY_CATEGORIES.RECONNAISSANCE_DECEPTION);
      }
      if (Number(features.highFrequencyBurstRatio || 0) > 0.8) {
        categories.add(STRATEGY_CATEGORIES.SERVICE_INTERACTION_DECEPTION);
      }
    }

    // Default fallback based on primary classification if no specific rule matched
    if (categories.size === 0) {
      if (assessment.assessmentLabel === 'ATTACK' || assessment.classification === 'ATTACK') {
        categories.add(STRATEGY_CATEGORIES.RECONNAISSANCE_DECEPTION);
      }
    }

    return Array.from(categories);
  }

  /**
   * Evaluate a single strategy against assessment, policy, and environment constraints.
   * Computes a multi-factor deterministic score reflecting category match, severity,
   * corroborating evidence, and uncertainty penalties.
   *
   * @param {Object} strategy
   * @param {Object} assessment
   * @param {Object} policy
   * @returns {{
   *   eligible: boolean,
   *   score: number,
   *   reasons: string[],
   *   scoreBreakdown: {
   *     categoryMatch: number,
   *     ruleMatch: number,
   *     severityWeight: number,
   *     confidenceWeight: number,
   *     uncertaintyPenalty: number
   *   }
   * }}
   */
  evaluateCandidate(strategy, assessment = {}, policy = {}) {
    const reasons = [];
    let eligible = true;
    let score = 0;

    const scoreBreakdown = {
      categoryMatch: 0,
      ruleMatch: 0,
      severityWeight: 0,
      confidenceWeight: 0,
      uncertaintyPenalty: 0
    };

    // 1. Check enabled
    if (strategy.enabled === false) {
      reasons.push('STRATEGY_DISABLED');
      return { eligible: false, score: 0, reasons, scoreBreakdown };
    }

    // 2. Policy-allowed strategies filter (Application or Tenant Level)
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
      reasons.push(
        `INCOMPATIBLE_CATEGORY: Target categories are [${targetCategories.join(', ')}], strategy provides ${strategy.strategyType}`
      );
      eligible = false;
    } else {
      scoreBreakdown.categoryMatch = 50;
      score += 50;
    }

    // 4. Targeted rule match and severity weighting
    const findings = Array.isArray(assessment.ruleFindings) ? assessment.ruleFindings : [];
    const targetedRules = prereqs.targetedRules || [];

    // Find which findings in the assessment match this strategy's targeted rules
    const matchedFindings = findings.filter((f) => {
      const activeRuleId = f.ruleId || f.id || '';
      return targetedRules.some((tRule) => StrategySelectionService.matchesRulePattern(tRule, activeRuleId));
    });

    const ruleBonus = matchedFindings.length * 25;
    scoreBreakdown.ruleMatch = ruleBonus;
    score += ruleBonus;

    // Severity weighting: high severity findings matching THIS strategy increase ranking
    let severityBonus = 0;
    for (const finding of matchedFindings) {
      const sev = String(finding.severity || '').toUpperCase();
      if (sev === 'CRITICAL') severityBonus += 25;
      else if (sev === 'HIGH') severityBonus += 15;
      else if (sev === 'MEDIUM') severityBonus += 8;
    }
    scoreBreakdown.severityWeight = severityBonus;
    score += severityBonus;

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
      const confBonus = Math.round(assessmentConfidence * 20);
      scoreBreakdown.confidenceWeight = confBonus;
      score += confBonus;
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

    // 8. Session correlation prerequisite & uncertainty penalty
    const correlationConf = Number(
      assessment.sessionCorrelationConfidence ??
      assessment.correlationConfidence ??
      0.8
    );
    const minCorrelation = Number(prereqs.minCorrelationConfidence ?? 0.6);
    if (correlationConf < minCorrelation) {
      reasons.push(`CORRELATION_CONFIDENCE_TOO_LOW: Has ${correlationConf}, requires ${minCorrelation}`);
      eligible = false;
    } else if (correlationConf < 0.8) {
      // Apply slight uncertainty penalty if correlation is marginal (0.6 - 0.8)
      const penalty = Math.round((0.8 - correlationConf) * 25);
      scoreBreakdown.uncertaintyPenalty = penalty;
      score = Math.max(0, score - penalty);
    }

    // 9. Application-specific isolation compatibility
    const isolation = strategy.isolationRequirements || {};
    if (policy.requiredEvidenceCriteria?.strictNamespaceRequired && !isolation.strictNamespaceIsolation) {
      reasons.push('INCOMPATIBLE_ISOLATION: Policy requires strictNamespaceIsolation');
      eligible = false;
    }

    return { eligible, score, reasons, scoreBreakdown };
  }

  /**
   * Deterministically select the best strategy for the given assessment and policy.
   *
   * @param {Object} params
   * @param {Object} params.assessment
   * @param {Object} params.policy
   * @param {Array} [params.customStrategies]
   * @returns {{
   *   selectedStrategy: Object|null,
   *   candidates: Array,
   *   rejectedCandidates: Array,
   *   selectionRationale: string,
   *   rankingMethod: string
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
        scoreBreakdown: evaluation.scoreBreakdown,
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
        selectionRationale:
          'No deception strategy met category compatibility, minimum confidence, or telemetry quality prerequisites.',
        rankingMethod: 'DETERMINISTIC_SCORE_DESC_THEN_IDENTIFIER_ASC'
      };
    }

    // Deterministic ranking:
    // 1. Score descending
    // 2. Collation on strategyIdentifier ascending
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
      selectionRationale,
      rankingMethod: 'DETERMINISTIC_SCORE_DESC_THEN_IDENTIFIER_ASC'
    };
  }
}
