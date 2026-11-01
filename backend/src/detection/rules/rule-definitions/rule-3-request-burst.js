/**
 * Rule 3: Request Burst Pattern (RULE_REQUEST_BURST)
 *
 * Detects high-frequency automated bursts, distinguishing benign static asset prefetching
 * (e.g. SPA bundle loading with clean 200s and diverse assets) from aggressive API hammering or brute-force floods.
 */

import { createRuleFinding, RULE_SEVERITY } from '../rule-result.schema.js';

export const RULE_REQUEST_BURST = Object.freeze({
  ruleId: 'RULE_REQUEST_BURST',
  name: 'Request Burst Pattern',
  version: 1,
  description: 'Detects high-frequency request bursts, differentiating legitimate concurrent asset loads from automated API floods.',
  defaultSeverity: RULE_SEVERITY.HIGH,
  defaultThresholds: {
    criticalBurst1s: 25,
    suspiciousBurst1s: 15,
    minDiversityForStaticAssetException: 0.60
  },

  evaluate({ features, timeWindow, thresholds = {}, sessionContext = {} }) {
    const config = { ...this.defaultThresholds, ...thresholds };
    const burst1s = features?.burst_frequency_max_1s?.value ?? 0;
    const requestRate = features?.request_rate_per_sec?.value ?? 0.0;
    const requestCount = features?.request_count?.value ?? 0;
    const endpointDiversity = features?.endpoint_diversity_ratio?.value ?? 0.0;
    const http4xxRatio = features?.http_4xx_ratio?.value ?? 0.0;
    const repeatedEndpointRatio = features?.repeated_endpoint_ratio?.value ?? 0.0;

    const matchedConditions = [];
    const uncertaintyNotes = [];

    if (sessionContext?.collisionRisk?.level === 'HIGH') {
      uncertaintyNotes.push('Session handle derived from unverified client header; burst may reflect multiple clients sharing NAT.');
    }

    // Static Asset Burst Exception:
    // If requests have high endpoint diversity (e.g. 15 distinct JS/CSS files), zero 4xx errors,
    // and moderate overall request count, classify as benign asset loading.
    const isCleanSuccessfulTraffic = http4xxRatio === 0.0;
    const isHighlyDiverseEndpoints = endpointDiversity >= config.minDiversityForStaticAssetException;
    if (burst1s >= config.suspiciousBurst1s && burst1s < config.criticalBurst1s && isCleanSuccessfulTraffic && isHighlyDiverseEndpoints) {
      return createRuleFinding({
        ruleId: this.ruleId,
        ruleName: this.name,
        version: this.version,
        triggered: false,
        severity: RULE_SEVERITY.LOW,
        confidence: 0.88,
        timeWindow,
        matchedConditions: ['BENIGN_STATIC_ASSET_BURST_IDENTIFIED'],
        evidence: { burst1s, endpointDiversity, http4xxRatio },
        uncertaintyNotes,
        explanation: `Sub-second burst of ${burst1s} req/s identified as benign concurrent asset prefetching (diversity: ${endpointDiversity.toFixed(2)}, zero errors).`
      });
    }

    // Critical flood trigger (> 25 req/s)
    if (burst1s >= config.criticalBurst1s) {
      matchedConditions.push(`BURST_1S_GTE_CRITICAL_${config.criticalBurst1s}`);
      return createRuleFinding({
        ruleId: this.ruleId,
        ruleName: this.name,
        version: this.version,
        triggered: true,
        severity: RULE_SEVERITY.CRITICAL,
        confidence: 0.95,
        timeWindow,
        matchedConditions,
        evidence: { burst1s, requestRate, requestCount, endpointDiversity },
        uncertaintyNotes,
        explanation: `Extreme request burst detected: ${burst1s} requests in 1 second (rate: ${requestRate} req/s) indicating automated flood tool.`
      });
    }

    // Suspicious burst trigger: >= 15 req/s with low diversity (focused route hammering) or elevated errors
    if (burst1s >= config.suspiciousBurst1s && (repeatedEndpointRatio > 0.40 || http4xxRatio > 0.15)) {
      matchedConditions.push(`BURST_1S_GTE_${config.suspiciousBurst1s}`);
      if (repeatedEndpointRatio > 0.40) matchedConditions.push('BURST_FOCUSED_ON_SINGLE_ROUTE');
      if (http4xxRatio > 0.15) matchedConditions.push('BURST_ACCOMPANIED_BY_CLIENT_ERRORS');

      return createRuleFinding({
        ruleId: this.ruleId,
        ruleName: this.name,
        version: this.version,
        triggered: true,
        severity: RULE_SEVERITY.HIGH,
        confidence: 0.89,
        timeWindow,
        matchedConditions,
        evidence: { burst1s, requestRate, repeatedEndpointRatio, http4xxRatio },
        uncertaintyNotes,
        explanation: `Suspicious high-frequency burst detected: ${burst1s} req/s targeting concentrated routes (${(repeatedEndpointRatio * 100).toFixed(0)}% repeated hits) in ${timeWindow} window.`
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
      evidence: { burst1s, requestRate },
      uncertaintyNotes,
      explanation: `Peak 1-second burst (${burst1s} req/s) within normal operational limits in ${timeWindow} window.`
    });
  }
});
