/**
 * Rule 2: Endpoint Enumeration Pattern (RULE_ENDPOINT_ENUMERATION)
 * Version: 2
 *
 * Detects directory spidering and reconnaissance scanning across non-existent resources.
 * Distinguishes multi-path scanning from benign high-diversity browsing (e.g. docs, blog),
 * occasional 404s during developer exploration, and single-endpoint asset loops.
 */

import { createRuleFinding, RULE_SEVERITY } from '../rule-result.schema.js';

export const RULE_ENDPOINT_ENUMERATION = Object.freeze({
  ruleId: 'RULE_ENDPOINT_ENUMERATION',
  name: 'Endpoint Enumeration Pattern',
  version: 2,
  description: 'Detects directory enumeration and route reconnaissance across multiple missing or sensitive endpoints.',
  defaultSeverity: RULE_SEVERITY.HIGH,
  defaultThresholds: {
    minEnumerationScore: 0.35,
    minUniqueNotFoundRoutes: 4,
    min404Ratio: 0.35,
    minRequestCount: 5
  },

  evaluate({ features, timeWindow = '5m', thresholds = {}, sessionContext = {} }) {
    const config = { ...this.defaultThresholds, ...thresholds };
    const requestCount = features?.request_count?.value ?? 0;
    const uniqueEndpoints = features?.unique_endpoint_count?.value ?? 0;
    const endpointDiversity = features?.endpoint_diversity_ratio?.value ?? 0.0;
    const notFoundCount = features?.repeated_not_found_count?.value ?? 0;
    const fallback404Ratio = requestCount > 0 ? notFoundCount / requestCount : 0.0;
    const http404Ratio = features?.http_404_ratio?.value ?? features?.unusual_route_ratio?.value ?? fallback404Ratio;
    const resourceEnumerationScore = features?.resource_enumeration_score?.value ?? 0.0;

    const matchedConditions = [];
    const uncertaintyNotes = [];

    if (sessionContext?.collisionRisk?.level === 'HIGH') {
      uncertaintyNotes.push('Session handle derived from unverified client header; multiple actors may be conflated.');
    }

    if (requestCount < config.minRequestCount) {
      return createRuleFinding({
        ruleId: this.ruleId,
        ruleName: this.name,
        version: this.version,
        triggered: false,
        severity: RULE_SEVERITY.LOW,
        confidence: 0.80,
        timeWindow,
        matchedConditions: [],
        evidence: { requestCount, minRequired: config.minRequestCount },
        uncertaintyNotes,
        explanation: `Insufficient requests (${requestCount} < ${config.minRequestCount}) to assess endpoint enumeration in ${timeWindow} window.`
      });
    }

    // Benign check 1: high diversity with zero 404s (e.g. benign web crawler or reader browsing valid pages)
    if (notFoundCount === 0) {
      return createRuleFinding({
        ruleId: this.ruleId,
        ruleName: this.name,
        version: this.version,
        triggered: false,
        severity: RULE_SEVERITY.LOW,
        confidence: 0.95,
        timeWindow,
        matchedConditions: ['BENIGN_TRAVERSAL_NO_ERRORS'],
        evidence: { uniqueEndpoints, endpointDiversity, notFoundCount },
        uncertaintyNotes,
        explanation: `Healthy endpoint traversal across ${uniqueEndpoints} distinct routes with zero 404 errors; consistent with normal site navigation or documentation crawling.`
      });
    }

    // Benign check 2: Occasional 404 during developer exploration or minor link brokenness (404 ratio < 20%)
    if (http404Ratio < 0.20 && notFoundCount <= 2) {
      return createRuleFinding({
        ruleId: this.ruleId,
        ruleName: this.name,
        version: this.version,
        triggered: false,
        severity: RULE_SEVERITY.LOW,
        confidence: 0.90,
        timeWindow,
        matchedConditions: ['BENIGN_OCCASIONAL_404_EXPLORATION'],
        evidence: { uniqueEndpoints, notFoundCount, http404Ratio },
        uncertaintyNotes,
        explanation: `Isolated 404 responses (${notFoundCount}/${requestCount}) during multi-endpoint navigation; consistent with legitimate developer exploration or broken internal hyperlink.`
      });
    }

    // Spidering trigger: elevated resourceEnumerationScore AND multi-route 404 count AND elevated 404 ratio
    if (
      resourceEnumerationScore >= config.minEnumerationScore &&
      notFoundCount >= config.minUniqueNotFoundRoutes &&
      http404Ratio >= config.min404Ratio
    ) {
      matchedConditions.push(`RESOURCE_ENUMERATION_SCORE_GTE_${config.minEnumerationScore}`);
      matchedConditions.push(`NOT_FOUND_COUNT_GTE_${config.minUniqueNotFoundRoutes}`);
      matchedConditions.push(`HTTP_404_RATIO_GTE_${(config.min404Ratio * 100).toFixed(0)}%`);

      const severity = resourceEnumerationScore >= 0.70 ? RULE_SEVERITY.CRITICAL : RULE_SEVERITY.HIGH;

      return createRuleFinding({
        ruleId: this.ruleId,
        ruleName: this.name,
        version: this.version,
        triggered: true,
        severity,
        confidence: 0.92,
        timeWindow,
        matchedConditions,
        evidence: {
          resourceEnumerationScore,
          uniqueEndpoints,
          notFoundCount,
          http404Ratio,
          endpointDiversity
        },
        uncertaintyNotes,
        explanation: `Endpoint enumeration detected: ${notFoundCount} 404 responses across ${uniqueEndpoints} distinct routes (score: ${resourceEnumerationScore.toFixed(2)}, error ratio: ${(http404Ratio * 100).toFixed(1)}%) indicating path reconnaissance in ${timeWindow} window.`
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
      evidence: { resourceEnumerationScore, notFoundCount, http404Ratio },
      uncertaintyNotes,
      explanation: `Endpoint access patterns within baseline parameters (score: ${resourceEnumerationScore.toFixed(2)}, ${notFoundCount} 404s) in ${timeWindow} window.`
    });
  }
});
