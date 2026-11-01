/**
 * Rule 1: Authentication Failure Pattern (RULE_AUTH_FAILURE)
 * Version: 2
 *
 * Detects repeated authentication and authorization rejections (HTTP 401/403).
 * Multi-window aware: differentiates rapid credential stuffing from benign user password typos.
 */

import { createRuleFinding, RULE_SEVERITY } from '../rule-result.schema.js';

export const RULE_AUTH_FAILURE = Object.freeze({
  ruleId: 'RULE_AUTH_FAILURE',
  name: 'Authentication Failure Pattern',
  version: 2,
  description: 'Detects repeated authentication failures, differentiating rapid brute force from sporadic user typos.',
  defaultSeverity: RULE_SEVERITY.HIGH,
  defaultThresholds: {
    // Window-specific failure thresholds
    minFailures30s: 3,
    minRatio30s: 0.60,
    minFailures5m: 5,
    minRatio5m: 0.50,
    minFailures15m: 8,
    minRatio15m: 0.40
  },

  evaluate({ features, timeWindow = '5m', thresholds = {}, sessionContext = {} }) {
    const config = { ...this.defaultThresholds, ...thresholds };
    const matchedConditions = [];
    const uncertaintyNotes = [];

    if (sessionContext?.collisionRisk?.level === 'HIGH') {
      uncertaintyNotes.push('Session handle derived from unverified client header; multiple actors may be conflated.');
    }

    const rawAuthFailures = features?.auth_failure_count?.value ?? (typeof features?.auth_failure_count === 'number' ? features.auth_failure_count : undefined);
    const rawRequestCount = features?.request_count?.value ?? (typeof features?.request_count === 'number' ? features.request_count : undefined);
    const rawHttp4xxRatio = features?.http_4xx_ratio?.value ?? (typeof features?.http_4xx_ratio === 'number' ? features.http_4xx_ratio : undefined);

    // Missing-data audit: Never fabricate 0 if auth_failure_count was not provided
    if (rawAuthFailures === undefined || rawAuthFailures === null) {
      uncertaintyNotes.push('Required feature "auth_failure_count" is missing or unavailable.');
      return createRuleFinding({
        ruleId: this.ruleId,
        ruleName: this.name,
        version: this.version,
        triggered: false,
        severity: RULE_SEVERITY.LOW,
        confidence: 0.10,
        timeWindow,
        matchedConditions: ['MISSING_AUTH_FAILURE_TELEMETRY'],
        evidence: {
          authFailures: null,
          requestCount: rawRequestCount ?? null,
          missingFeatures: ['auth_failure_count']
        },
        uncertaintyNotes,
        explanation: `Authentication failure assessment inconclusive: "auth_failure_count" feature missing from ${timeWindow} evaluation window.`
      });
    }

    const authFailures = rawAuthFailures;
    const requestCount = rawRequestCount ?? 0;
    const http4xxRatio = rawHttp4xxRatio ?? 0.0;
    const statusDist = features?.response_status_distribution?.value || {};
    const successCount = statusDist['2xx'] ?? 0;

    // 1. Zero failures: Clean
    if (authFailures === 0) {
      return createRuleFinding({
        ruleId: this.ruleId,
        ruleName: this.name,
        version: this.version,
        triggered: false,
        severity: RULE_SEVERITY.LOW,
        confidence: 0.95,
        timeWindow,
        matchedConditions: [],
        evidence: { authFailures: 0, requestCount },
        uncertaintyNotes,
        explanation: requestCount > 0
          ? `Zero authentication failures observed across ${requestCount} requests in ${timeWindow} window.`
          : `Zero authentication activity recorded in ${timeWindow} window (requestCount = 0).`
      });
    }

    // 2. Benign session expiry or single typo: 1 or 2 failures with successful subsequent requests
    if (authFailures <= 2) {
      return createRuleFinding({
        ruleId: this.ruleId,
        ruleName: this.name,
        version: this.version,
        triggered: false,
        severity: RULE_SEVERITY.LOW,
        confidence: 0.90,
        timeWindow,
        matchedConditions: ['ISOLATED_AUTH_FAILURE_IGNORED_AS_SESSION_EXPIRY_OR_TYPO'],
        evidence: { authFailures, requestCount, http4xxRatio },
        uncertaintyNotes,
        explanation: `Isolated authentication failure observed (${authFailures}/${requestCount}); consistent with benign session expiry or initial password typo.`
      });
    }

    // 3. User Typo Recovery: If 3 failures were followed by successful 2xx authentication in a 5m/15m window
    if (authFailures === 3 && (timeWindow === '5m' || timeWindow === '15m') && successCount > 0) {
      return createRuleFinding({
        ruleId: this.ruleId,
        ruleName: this.name,
        version: this.version,
        triggered: false,
        severity: RULE_SEVERITY.LOW,
        confidence: 0.88,
        timeWindow,
        matchedConditions: ['BENIGN_USER_TYPO_WITH_SUCCESSFUL_LOGIN'],
        evidence: { authFailures, requestCount, successCount },
        uncertaintyNotes,
        explanation: `User experienced 3 initial login retries followed by successful authentication (${successCount} 2xx responses); consistent with human memory lapse, not credential stuffing.`
      });
    }

    // 4. Multi-window threshold determination
    let requiredMinFailures = config.minFailures5m;
    let requiredMinRatio = config.minRatio5m;
    if (timeWindow === '30s') {
      requiredMinFailures = config.minFailures30s;
      requiredMinRatio = config.minRatio30s;
    } else if (timeWindow === '15m') {
      requiredMinFailures = config.minFailures15m;
      requiredMinRatio = config.minRatio15m;
    }

    const failureRatio = requestCount > 0 ? authFailures / requestCount : 0.0;
    if (authFailures >= requiredMinFailures && failureRatio >= requiredMinRatio) {
      matchedConditions.push(`AUTH_FAILURES_GTE_${requiredMinFailures}`);
      matchedConditions.push(`AUTH_FAILURE_RATIO_GTE_${(requiredMinRatio * 100).toFixed(0)}%`);

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
        evidence: {
          authFailures,
          requestCount,
          failureRatio: Number(failureRatio.toFixed(3)),
          http4xxRatio,
          requiredMinFailures,
          requiredMinRatio
        },
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
      evidence: { authFailures, requestCount, http4xxRatio, requiredMinFailures },
      uncertaintyNotes,
      explanation: `Authentication failures (${authFailures}) below required threshold (${requiredMinFailures}) in ${timeWindow} window.`
    });
  }
});
