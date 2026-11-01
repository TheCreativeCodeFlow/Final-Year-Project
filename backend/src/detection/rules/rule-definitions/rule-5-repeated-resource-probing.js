/**
 * Rule 5: Repeated Resource Probing (RULE_REPEATED_RESOURCE_PROBING)
 * Version: 2
 *
 * Detects repeated probing of missing or sensitive resources.
 * Explicitly distinguishes legitimate health checks and asynchronous job polling
 * from malicious probing of hidden configuration files or admin endpoints.
 */

import { createRuleFinding, RULE_SEVERITY } from '../rule-result.schema.js';

const SENSITIVE_CREDENTIAL_PATTERNS = [
  /\.env/i,
  /\.git/i,
  /\.aws/i,
  /\.ssh/i,
  /id_rsa/i,
  /wp-config/i,
  /web\.config/i,
  /secrets/i
];

const BENIGN_HEALTH_OR_POLLING_PATTERNS = [
  /\/health/i,
  /\/actuator\/health/i,
  /\/actuator\/info/i,
  /\/jobs?\//i,
  /\/tasks?\//i,
  /\/status/i,
  /\/progress/i,
  /\/poll/i
];

export const RULE_REPEATED_RESOURCE_PROBING = Object.freeze({
  ruleId: 'RULE_REPEATED_RESOURCE_PROBING',
  name: 'Repeated Resource Probing Pattern',
  version: 2,
  description: 'Detects repeated access to missing or sensitive resources, distinguishing legitimate health checks and async job polling from persistent probing.',
  defaultSeverity: RULE_SEVERITY.MEDIUM,
  defaultThresholds: {
    minRepeated404Count: 5,
    minRepeatedRouteConcentration: 0.60
  },

  evaluate({ features, rawObservation = {}, timeWindow = '5m', thresholds = {}, sessionContext = {} }) {
    const config = { ...this.defaultThresholds, ...thresholds };
    const matchedConditions = [];
    const uncertaintyNotes = [];

    if (sessionContext?.collisionRisk?.level === 'HIGH') {
      uncertaintyNotes.push('Session handle derived from unverified client header; multiple actors may be conflated.');
    }

    const rawNotFound = features?.repeated_not_found_count?.value ?? (typeof features?.repeated_not_found_count === 'number' ? features.repeated_not_found_count : undefined);
    const rawRouteRatio = features?.repeated_endpoint_ratio?.value ?? (typeof features?.repeated_endpoint_ratio === 'number' ? features.repeated_endpoint_ratio : undefined);
    const rawRoute = rawObservation.normalizedRoute || rawObservation.path || null;
    const rawStatus = typeof rawObservation.responseStatus === 'number' ? rawObservation.responseStatus : (typeof rawObservation.status === 'number' ? rawObservation.status : null);

    const hasProbingTelemetry = rawNotFound !== undefined || rawRouteRatio !== undefined || rawRoute !== null;

    if (!hasProbingTelemetry) {
      uncertaintyNotes.push('Required resource probing telemetry is missing or unavailable.');
      return createRuleFinding({
        ruleId: this.ruleId,
        ruleName: this.name,
        version: this.version,
        triggered: false,
        severity: RULE_SEVERITY.LOW,
        confidence: 0.10,
        timeWindow,
        matchedConditions: ['MISSING_RESOURCE_PROBING_TELEMETRY'],
        evidence: {
          notFoundCount: null,
          repeatedRouteRatio: null,
          normalizedRoute: null,
          responseStatus: rawStatus,
          missingFeatures: ['repeated_not_found_count', 'repeated_endpoint_ratio', 'normalizedRoute']
        },
        uncertaintyNotes,
        explanation: `Repeated resource probing assessment inconclusive: telemetry missing from ${timeWindow} evaluation window.`
      });
    }

    const notFoundCount = rawNotFound ?? 0;
    const repeatedRouteRatio = rawRouteRatio ?? 0.0;
    const uniqueEndpoints = features?.unique_endpoint_count?.value ?? (typeof features?.unique_endpoint_count === 'number' ? features.unique_endpoint_count : 0);
    const resourceEnumerationScore = features?.resource_enumeration_score?.value ?? (typeof features?.resource_enumeration_score === 'number' ? features.resource_enumeration_score : 0.0);
    const normalizedRoute = rawRoute || '';
    const responseStatus = rawStatus !== null ? rawStatus : 200;

    // 1. High-risk credential / secret file probing (.env, .git, id_rsa, etc.)
    const isCredentialPath = SENSITIVE_CREDENTIAL_PATTERNS.some((pattern) => pattern.test(normalizedRoute));
    if (isCredentialPath) {
      matchedConditions.push('TARGETS_HIGH_RISK_SENSITIVE_CREDENTIAL_PATH');
      return createRuleFinding({
        ruleId: this.ruleId,
        ruleName: this.name,
        version: this.version,
        triggered: true,
        severity: RULE_SEVERITY.HIGH,
        confidence: 0.96,
        timeWindow,
        matchedConditions,
        evidence: { normalizedRoute, notFoundCount, sensitiveTarget: true, responseStatus },
        uncertaintyNotes,
        explanation: `Targeted reconnaissance probe of sensitive system/credential path (${normalizedRoute}) detected in ${timeWindow} window.`
      });
    }

    // 2. Polling Exception Check:
    // If the traffic is focused on a single polling/status route with low enumeration score (<= 0.10)
    const isHealthOrMonitoring = BENIGN_HEALTH_OR_POLLING_PATTERNS.some((pattern) => pattern.test(normalizedRoute));
    if (uniqueEndpoints <= 1 && isHealthOrMonitoring && resourceEnumerationScore <= 0.10) {
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
        explanation: `Repeated requests (${notFoundCount}) on single endpoint (${normalizedRoute}) identified as benign asynchronous job status polling.`
      });
    }

    // 3. Health check or monitoring exception (e.g. /actuator/health returning 200 OK)
    if (isHealthOrMonitoring && responseStatus < 400) {
      return createRuleFinding({
        ruleId: this.ruleId,
        ruleName: this.name,
        version: this.version,
        triggered: false,
        severity: RULE_SEVERITY.LOW,
        confidence: 0.95,
        timeWindow,
        matchedConditions: ['BENIGN_HEALTH_MONITORING_CONFIRMED'],
        evidence: { normalizedRoute, responseStatus },
        uncertaintyNotes,
        explanation: `Legitimate application health check or status endpoint (${normalizedRoute}) returning ${responseStatus} OK; verified benign.`
      });
    }

    // 4. Persistent probing on a dead or missing resource (not a recognized job/status endpoint)
    if (notFoundCount >= config.minRepeated404Count && repeatedRouteRatio >= config.minRepeatedRouteConcentration) {
      matchedConditions.push(`REPEATED_NOT_FOUND_GTE_${config.minRepeated404Count}`);
      matchedConditions.push(`ROUTE_CONCENTRATION_GTE_${(config.minRepeatedRouteConcentration * 100).toFixed(0)}%`);

      return createRuleFinding({
        ruleId: this.ruleId,
        ruleName: this.name,
        version: this.version,
        triggered: true,
        severity: RULE_SEVERITY.MEDIUM,
        confidence: 0.85,
        timeWindow,
        matchedConditions,
        evidence: {
          normalizedRoute,
          notFoundCount,
          repeatedRouteRatio,
          resourceEnumerationScore
        },
        uncertaintyNotes,
        explanation: `Persistent single-resource probing detected: ${notFoundCount} consecutive 404 responses focused on route (${normalizedRoute || 'concentrated path'}, ${(repeatedRouteRatio * 100).toFixed(0)}% concentration) in ${timeWindow} window.`
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
      explanation: `Resource probing within acceptable baseline bounds (${notFoundCount} 404s, concentration: ${(repeatedRouteRatio * 100).toFixed(0)}%) in ${timeWindow} window.`
    });
  }
});
