/**
 * Rule 5: Repeated Resource Probing (RULE_REPEATED_RESOURCE_PROBING)
 *
 * Detects repeated probing of missing or sensitive resources.
 * Explicitly distinguishes legitimate asynchronous job polling (e.g. polling a single task status route)
 * from malicious probing of hidden configuration files or admin endpoints.
 */

import { createRuleFinding, RULE_SEVERITY } from '../rule-result.schema.js';

const SENSITIVE_PATH_PATTERNS = [
  /\.env/i,
  /\.git/i,
  /\.aws/i,
  /\.ssh/i,
  /id_rsa/i,
  /wp-config/i,
  /phpmyadmin/i,
  /web\.config/i,
  /actuator/i
];

const BENIGN_POLLING_PATTERNS = [
  /\/jobs?\//i,
  /\/tasks?\//i,
  /\/status/i,
  /\/progress/i,
  /\/poll/i,
  /\/health/i
];

export const RULE_REPEATED_RESOURCE_PROBING = Object.freeze({
  ruleId: 'RULE_REPEATED_RESOURCE_PROBING',
  name: 'Repeated Resource Probing Pattern',
  version: 1,
  description: 'Detects repeated access to missing or sensitive resources, distinguishing legitimate async job polling from persistent probing.',
  defaultSeverity: RULE_SEVERITY.MEDIUM,
  defaultThresholds: {
    minRepeated404Count: 5,
    minRepeatedRouteConcentration: 0.60
  },

  evaluate({ features, rawObservation = {}, timeWindow, thresholds = {}, sessionContext = {} }) {
    const config = { ...this.defaultThresholds, ...thresholds };
    const notFoundCount = features?.repeated_not_found_count?.value ?? 0;
    const repeatedRouteRatio = features?.repeated_endpoint_ratio?.value ?? 0.0;
    const uniqueEndpoints = features?.unique_endpoint_count?.value ?? 0;
    const resourceEnumerationScore = features?.resource_enumeration_score?.value ?? 0.0;
    const normalizedRoute = rawObservation.normalizedRoute || rawObservation.path || '';

    const matchedConditions = [];
    const uncertaintyNotes = [];

    // Check if target is a known sensitive credential/configuration path
    const isSensitivePath = SENSITIVE_PATH_PATTERNS.some((pattern) => pattern.test(normalizedRoute));
    if (isSensitivePath) {
      matchedConditions.push('TARGETS_HIGH_RISK_SENSITIVE_CONFIGURATION_PATH');
      return createRuleFinding({
        ruleId: this.ruleId,
        ruleName: this.name,
        version: this.version,
        triggered: true,
        severity: RULE_SEVERITY.HIGH,
        confidence: 0.95,
        timeWindow,
        matchedConditions,
        evidence: { normalizedRoute, notFoundCount, sensitiveTarget: true },
        uncertaintyNotes,
        explanation: `Targeted probe of sensitive system/credential path (${normalizedRoute}) detected in ${timeWindow} window.`
      });
    }

    // Polling Exception Check:
    // If the traffic is focused on a single route (uniqueEndpoints === 1), matches polling patterns,
    // and resource enumeration score is low (<= 0.10), treat as benign polling.
    const isPollingRoute = BENIGN_POLLING_PATTERNS.some((pattern) => pattern.test(normalizedRoute));
    if (uniqueEndpoints === 1 && (isPollingRoute || resourceEnumerationScore <= 0.10) && notFoundCount > 0) {
      return createRuleFinding({
        ruleId: this.ruleId,
        ruleName: this.name,
        version: this.version,
        triggered: false,
        severity: RULE_SEVERITY.LOW,
        confidence: 0.88,
        timeWindow,
        matchedConditions: ['BENIGN_ASYNCHRONOUS_JOB_POLLING_IDENTIFIED'],
        evidence: { normalizedRoute, notFoundCount, uniqueEndpoints, resourceEnumerationScore },
        uncertaintyNotes,
        explanation: `Repeated 404 responses (${notFoundCount}) on single endpoint (${normalizedRoute}) identified as benign asynchronous job status polling.`
      });
    }

    // Persistent hammering on a dead or missing resource (not a recognized job/status endpoint)
    if (notFoundCount >= config.minRepeated404Count && repeatedRouteRatio >= config.minRepeatedRouteConcentration) {
      matchedConditions.push(`REPEATED_NOT_FOUND_GTE_${config.minRepeated404Count}`);
      matchedConditions.push(`ROUTE_CONCENTRATION_GTE_${(config.minRepeatedRouteConcentration * 100).toFixed(0)}%`);

      return createRuleFinding({
        ruleId: this.ruleId,
        ruleName: this.name,
        version: this.version,
        triggered: true,
        severity: RULE_SEVERITY.MEDIUM,
        confidence: 0.82,
        timeWindow,
        matchedConditions,
        evidence: { notFoundCount, repeatedRouteRatio, normalizedRoute },
        uncertaintyNotes,
        explanation: `Repeated dead-resource probing detected: ${notFoundCount} 404s concentrated on "${normalizedRoute}" (${(repeatedRouteRatio * 100).toFixed(0)}% repetition) in ${timeWindow} window.`
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
      evidence: { notFoundCount, repeatedRouteRatio },
      uncertaintyNotes,
      explanation: `Repeated resource probing metrics within normal baseline tolerance.`
    });
  }
});
