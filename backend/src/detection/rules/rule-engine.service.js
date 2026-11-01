/**
 * Rule Engine Service (Stage 4C)
 *
 * Orchestrates deterministic rule evaluation over behavioral feature sets and gateway observations.
 * Emits explainable, structured findings.
 */

import { RuleRegistry } from './rule-registry.js';
import { RULE_SEVERITY } from './rule-result.schema.js';

export class RuleEngineService {
  /**
   * @param {object} [options]
   * @param {RuleRegistry} [options.registry]
   */
  constructor(options = {}) {
    this.registry = options.registry || new RuleRegistry();
  }

  /**
   * Evaluates all enabled rules against the provided feature sets and context.
   *
   * @param {object} params
   * @param {Array<object>} params.featureSets - Array of BehavioralFeatureSet objects (30s, 5m, 15m)
   * @param {object} [params.rawObservation] - Original gateway observation evidence
   * @param {object} [params.baseline] - Established application baseline
   * @param {object} [params.sessionContext] - Correlation metadata (collisionRisk, caveats)
   * @param {string} [params.tenantId]
   * @param {string} [params.applicationId]
   * @returns {{
   *   hasTriggeredRules: boolean,
   *   triggeredCount: number,
   *   highestSeverity: string,
   *   findings: Array<object>,
   *   triggeredFindings: Array<object>,
   *   ruleEngineVersion: string,
   *   summary: string
   * }}
   */
  evaluate({
    featureSets = [],
    rawObservation = {},
    baseline = null,
    sessionContext = {},
    tenantId = null,
    applicationId = null
  }) {
    // Organize feature sets by windowLabel
    const multiWindowFeatures = {};
    for (const fSet of featureSets) {
      if (fSet && fSet.windowLabel) {
        multiWindowFeatures[fSet.windowLabel] = fSet.features || {};
      }
    }

    // Default primary window: 5m if available, otherwise 30s or 15m
    const primaryFeatures = multiWindowFeatures['5m'] || multiWindowFeatures['30s'] || multiWindowFeatures['15m'] || {};
    const primaryWindow = multiWindowFeatures['5m'] ? '5m' : (multiWindowFeatures['30s'] ? '30s' : '15m');

    const allFindings = [];
    const triggeredFindings = [];

    const registeredRules = this.registry.listRules(tenantId);

    for (const ruleMeta of registeredRules) {
      if (!ruleMeta.enabled) continue;

      const rule = this.registry.getRule(ruleMeta.ruleId);
      if (!rule) continue;

      const effectiveThresholds = this.registry.getEffectiveThresholds(rule.ruleId, tenantId);

      try {
        const finding = rule.evaluate({
          features: primaryFeatures,
          multiWindowFeatures,
          rawObservation,
          baseline,
          timeWindow: primaryWindow,
          thresholds: effectiveThresholds,
          sessionContext,
          tenantId,
          applicationId
        });

        allFindings.push(finding);
        if (finding.triggered) {
          triggeredFindings.push(finding);
        }
      } catch (err) {
        // Safe rule evaluation failure handling
        allFindings.push({
          ruleId: rule.ruleId,
          ruleName: rule.name,
          version: rule.version,
          triggered: false,
          severity: RULE_SEVERITY.LOW,
          confidence: 0.0,
          timeWindow: primaryWindow,
          matchedConditions: [],
          evidence: { error: err.message },
          uncertaintyNotes: ['Rule evaluation encountered runtime error'],
          explanation: `Evaluation failed: ${err.message}`
        });
      }
    }

    // Determine highest severity
    let highestSeverity = RULE_SEVERITY.LOW;
    const severityRank = {
      [RULE_SEVERITY.CRITICAL]: 4,
      [RULE_SEVERITY.HIGH]: 3,
      [RULE_SEVERITY.MEDIUM]: 2,
      [RULE_SEVERITY.LOW]: 1
    };

    for (const finding of triggeredFindings) {
      if ((severityRank[finding.severity] || 0) > (severityRank[highestSeverity] || 0)) {
        highestSeverity = finding.severity;
      }
    }

    const missingTelemetryFindings = allFindings.filter((f) => f.matchedConditions?.some((c) => c.startsWith('MISSING_') || c === 'METHOD_DATA_MISSING'));
    const isCompletelyMissingTelemetry = allFindings.length > 0 && missingTelemetryFindings.length === allFindings.length;

    let summary;
    if (triggeredFindings.length > 0) {
      summary = `Deterministic rule engine triggered ${triggeredFindings.length} rule(s) [Highest Severity: ${highestSeverity}]: ${triggeredFindings.map((f) => f.ruleName).join(', ')}.`;
    } else if (isCompletelyMissingTelemetry) {
      summary = 'Rule engine evaluation inconclusive: all registered rules reported missing or unavailable telemetry features.';
    } else {
      summary = 'No deterministic security rules were triggered; behavior matches standard operational profiles.';
    }

    return {
      hasTriggeredRules: triggeredFindings.length > 0,
      triggeredCount: triggeredFindings.length,
      highestSeverity: triggeredFindings.length > 0 ? highestSeverity : 'NONE',
      findings: allFindings,
      triggeredFindings,
      hasMissingTelemetry: missingTelemetryFindings.length > 0,
      missingTelemetryRuleCount: missingTelemetryFindings.length,
      ruleEngineVersion: '1.0.0',
      summary
    };
  }
}
