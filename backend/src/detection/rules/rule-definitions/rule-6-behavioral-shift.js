/**
 * Rule 6: Behavioral Shift (RULE_BEHAVIORAL_SHIFT)
 * Version: 2
 *
 * Evaluates behavioral transitions across short and long time windows (30s vs 5m vs 15m)
 * and deviations against established statistical baselines.
 *
 * Excludes transient 503 Service Unavailable responses during application restarts,
 * focusing strictly on client-driven error surges (4xx) and pacing changes.
 */

import { createRuleFinding, RULE_SEVERITY } from '../rule-result.schema.js';

export const RULE_BEHAVIORAL_SHIFT = Object.freeze({
  ruleId: 'RULE_BEHAVIORAL_SHIFT',
  name: 'Behavioral Shift Pattern',
  version: 2,
  description: 'Detects abrupt behavioral shifts between short and long windows, or significant divergence from established application baselines.',
  defaultSeverity: RULE_SEVERITY.MEDIUM,
  defaultThresholds: {
    minRateAcceleration: 3.0, // Short-window rate is 3x the long-window rate
    minFailureDelta: 0.25,     // Client failure ratio increased by >= 25%
    minBaselineRateDelta: 5.0  // Rate exceeded baseline by >= 5.0 req/s
  },

  evaluate({ features, multiWindowFeatures = {}, baseline = null, timeWindow = '30s', thresholds = {}, sessionContext = {} }) {
    const config = { ...this.defaultThresholds, ...thresholds };
    const matchedConditions = [];
    const uncertaintyNotes = [];

    const f30 = multiWindowFeatures['30s'] || (timeWindow === '30s' ? features : null);
    const f5m = multiWindowFeatures['5m'] || (timeWindow === '5m' ? features : null);
    const hasF30 = f30 && typeof f30 === 'object' && Object.keys(f30).length > 0;
    const hasF5m = f5m && typeof f5m === 'object' && Object.keys(f5m).length > 0;

    const rateDelta = features?.rate_delta_vs_baseline?.value;
    const failureDelta = features?.failure_ratio_delta?.value;
    const baselineStatus = baseline?.status || 'NO_BASELINE';

    // Missing-data check: If neither multi-window features nor baseline metrics are available
    if (!hasF30 && !hasF5m && rateDelta === undefined && failureDelta === undefined) {
      uncertaintyNotes.push('Multi-window feature telemetry unavailable for behavioral shift assessment.');
      return createRuleFinding({
        ruleId: this.ruleId,
        ruleName: this.name,
        version: this.version,
        triggered: false,
        severity: RULE_SEVERITY.LOW,
        confidence: 0.10,
        timeWindow,
        matchedConditions: ['MISSING_BEHAVIORAL_SHIFT_TELEMETRY'],
        evidence: {
          rateRatio: null,
          baselineStatus,
          missingFeatures: ['multiWindowFeatures', 'rate_delta_vs_baseline', 'failure_ratio_delta']
        },
        uncertaintyNotes,
        explanation: `Behavioral shift assessment inconclusive: multi-window feature telemetry missing from ${timeWindow} evaluation window.`
      });
    }

    if (baselineStatus !== 'ESTABLISHED') {
      uncertaintyNotes.push(`Application baseline is in state "${baselineStatus}"; baseline deltas cannot be reliably assessed.`);
    }

    // Shift Test 1: Cross-Window Acceleration (30s burst vs 5m background)
    let rateRatio = 1.0;
    if (f30 && f5m) {
      const rate30 = f30.request_rate_per_sec?.value ?? 0.0;
      const rate5m = f5m.request_rate_per_sec?.value ?? 0.0;
      const errorRatio30 = f30.http_4xx_ratio?.value ?? 0.0;
      const errorRatio5m = f5m.http_4xx_ratio?.value ?? 0.0;

      if (rate5m > 0) {
        rateRatio = rate30 / rate5m;
      }

      // Check if sudden acceleration is accompanied by client error surge (pivoting from normal to attack)
      const errorSurge = errorRatio30 - errorRatio5m;
      if (rateRatio >= config.minRateAcceleration && errorSurge >= config.minFailureDelta && (f30.request_count?.value ?? 0) >= 5) {
        matchedConditions.push(`RATE_ACCELERATION_GTE_${config.minRateAcceleration}X`);
        matchedConditions.push(`ERROR_SURGE_GTE_${(config.minFailureDelta * 100).toFixed(0)}%`);

        return createRuleFinding({
          ruleId: this.ruleId,
          ruleName: this.name,
          version: this.version,
          triggered: true,
          severity: RULE_SEVERITY.HIGH,
          confidence: 0.88,
          timeWindow,
          matchedConditions,
          evidence: {
            rate30,
            rate5m,
            rateRatio: Number(rateRatio.toFixed(2)),
            errorRatio30,
            errorRatio5m,
            errorSurge: Number(errorSurge.toFixed(2))
          },
          uncertaintyNotes,
          explanation: `Abrupt behavioral transition detected: Request rate accelerated ${rateRatio.toFixed(1)}x in the 30s window (${rate30} req/s vs ${rate5m} req/s in 5m) with simultaneous ${(errorSurge * 100).toFixed(0)}% increase in client errors.`
        });
      }
    }

    // Shift Test 2: Divergence from Established Baseline
    if (baselineStatus === 'ESTABLISHED' && typeof rateDelta === 'number' && typeof failureDelta === 'number') {
      if (rateDelta >= config.minBaselineRateDelta && failureDelta >= config.minFailureDelta) {
        matchedConditions.push(`RATE_DELTA_VS_BASELINE_GTE_${config.minBaselineRateDelta}`);
        matchedConditions.push(`FAILURE_DELTA_VS_BASELINE_GTE_${config.minFailureDelta}`);

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
            rateDelta,
            failureDelta,
            minBaselineRateDelta: config.minBaselineRateDelta,
            minFailureDelta: config.minFailureDelta
          },
          uncertaintyNotes,
          explanation: `Statistically significant divergence from established application baseline: request rate increased by +${rateDelta.toFixed(1)} req/s and error ratio increased by +${(failureDelta * 100).toFixed(0)}%.`
        });
      }
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
      evidence: { rateRatio: Number(rateRatio.toFixed(2)), baselineStatus },
      uncertaintyNotes,
      explanation: `No significant behavioral shift detected across evaluation windows or baseline comparison in ${timeWindow} window.`
    });
  }
});
