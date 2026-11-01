/**
 * Rule 1: Authentication Failure Pattern (RULE_AUTH_FAILURE)
 *
 * Detects repeated authentication and authorization rejections (HTTP 401/403).
 * Distinguishes repeated brute-force / credential stuffing attempts from a single expired session.
 */

import { createRuleFinding, RULE_SEVERITY } from '../rule-result.schema.js';

export const RULE_AUTH_FAILURE = Object.freeze({
  ruleId: 'RULE_AUTH_FAILURE',
  name: 'Authentication Failure Pattern',
  version: 1,
  description: 'Detects repeated authentication failures over a time window, distinguishing brute force from single session expiry.',
  defaultSeverity: RULE_SEVERITY.HIGH,
  defaultThresholds: {
    minFailures: 3,
    minFailureRatio: 0.40,
    singleFailureIsSuspicious: false
  },

  /**
   * Evaluates the rule against extracted features for a specific window.
   *
   * @param {object} context
   * @param {object} context.features - Extracted features map
   * @param {string} context.timeWindow - "30s", "5m", or "15m"
   * @param {object} [context.thresholds] - Configurable threshold overrides
   * @param {object} [context.sessionContext] - Session correlation context
   * @returns {object} RuleFinding
   */
  evaluate({ features, timeWindow, thresholds = {}, sessionContext = {} }) {
    const config = { ...this.defaultThresholds, ...thresholds };
    const authFailures = features?.auth_failure_count?.value ?? 0;
    const requestCount = features?.request_count?.value ?? 0;
    const http4xxRatio = features?.http_4xx_ratio?.value ?? 0.0;

    const matchedConditions = [];
    const uncertaintyNotes = [];

    // Caveat for untrusted client headers
    if (sessionContext?.collisionRisk?.level === 'HIGH') {
      uncertaintyNotes.push('Session handle derived from unverified client header; multiple actors may be conflated.');
    }

    // Single expired session check: 1 failure among multiple requests is normal
    if (authFailures === 1) {
      return createRuleFinding({
        ruleId: this.ruleId,
        ruleName: this.name,
        version: this.version,
        triggered: false,
        severity: RULE_SEVERITY.LOW,
        confidence: 0.90,
        timeWindow,
        matchedConditions: ['SINGLE_AUTH_FAILURE_IGNORED_AS_SESSION_EXPIRY'],
        evidence: { authFailures, requestCount, http4xxRatio },
        uncertaintyNotes,
        explanation: `Single authentication failure observed (${authFailures}/${requestCount}); consistent with benign session expiry.`
      });
    }

    // Trigger condition: failures exceed minFailures AND failure ratio meets threshold
    const failureRatio = requestCount > 0 ? authFailures / requestCount : 0.0;
    if (authFailures >= config.minFailures && failureRatio >= config.minFailureRatio) {
      matchedConditions.push(`AUTH_FAILURES_GTE_${config.minFailures}`);
      matchedConditions.push(`AUTH_FAILURE_RATIO_GTE_${(config.minFailureRatio * 100).toFixed(0)}%`);

      const severity = authFailures >= 10 ? RULE_SEVERITY.CRITICAL : RULE_SEVERITY.HIGH;

      return createRuleFinding({
        ruleId: this.ruleId,
        ruleName: this.name,
        version: this.version,
        triggered: true,
        severity,
        confidence: sessionContext?.collisionRisk?.level === 'HIGH' ? 0.65 : 0.92,
        timeWindow,
        matchedConditions,
        evidence: { authFailures, requestCount, failureRatio: Number(failureRatio.toFixed(3)), http4xxRatio },
        uncertaintyNotes,
        explanation: `Repeated authentication failures detected: ${authFailures} unauthorized/forbidden responses across ${requestCount} requests (${(failureRatio * 100).toFixed(1)}% error rate) in ${timeWindow} window.`
      });
    }

    return createRuleFinding({
      ruleId: this.ruleId,
      ruleName: this.name,
      version: this.version,
      triggered: false,
      severity: RULE_SEVERITY.LOW,
      confidence: 0.85,
      timeWindow,
      matchedConditions: [],
      evidence: { authFailures, requestCount, http4xxRatio },
      uncertaintyNotes,
      explanation: `Authentication failures (${authFailures}) below threshold (${config.minFailures}) in ${timeWindow} window.`
    });
  }
});
