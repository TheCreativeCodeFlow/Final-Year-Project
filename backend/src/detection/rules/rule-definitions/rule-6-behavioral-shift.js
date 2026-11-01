/**
 * Rule 6: Behavioral Shift (RULE_BEHAVIORAL_SHIFT)
 *
 * Evaluates behavioral transitions across short and long time windows (30s vs 5m vs 15m)
 * and deviations against established statistical baselines.
 * Does not assume a short burst is malicious; requires combined pacing acceleration and failure/diversity deviation.
 */

import { createRuleFinding, RULE_SEVERITY } from '../rule-result.schema.js';

export const RULE_BEHAVIORAL_SHIFT = Object.freeze({
  ruleId: 'RULE_BEHAVIORAL_SHIFT',
  name: 'Behavioral Shift Pattern',
  version: 1,
  description: 'Detects abrupt behavioral shifts between short and long windows, or significant divergence from established application baselines.',
  defaultSeverity: RULE_SEVERITY.MEDIUM,
  defaultThresholds: {
    minRateAcceleration: 3.0, // Short-window rate is 3x the long-window rate
    minFailureDelta: 0.25,     // Failure ratio increased by >= 25%
    minBaselineRateDelta: 5.0  // Rate exceeded baseline by >= 5.0 req/s
  },

  /**
   * @param {object} context
   * @param {object} context.features - Features for primary evaluation window (usually 30s or 5m)
   * @param {object} [context.multiWindowFeatures] - Map of windowLabel -> features ({ '30s': ..., '5m': ..., '15m': ... })
   * @param {object} [context.baseline] - Established baseline object
   */
  evaluate({ features, multiWindowFeatures = {}, baseline = null, timeWindow = '30s', thresholds = {}, sessionContext = {} }) {
    const config = { ...this.defaultThresholds, ...thresholds };
    const matchedConditions = [];
    const uncertaintyNotes = [];

    const f30 = multiWindowFeatures['30s'] || (timeWindow === '30s' ? features : null);
    const f5m = multiWindowFeatures['5m'] || (timeWindow === '5m' ? features : null);

    const rateDelta = features?.rate_delta_vs_baseline?.value;
    const failureDelta = features?.failure_ratio_delta?.value;
    const baselineStatus = baseline?.status || 'NO_BASELINE';

    if (baselineStatus !== 'ESTABLISHED') {
      uncertaintyNotes.push(`Application baseline is in state "${baselineStatus}"; baseline deltas cannot be reliably assessed.`);
    }

    // Shift Test 1: Cross-Window Acceleration (30s burst vs 5m background)
    let crossWindowShiftTriggered = false;
    let rateRatio = 1.0;
    if (f30 && f5m) {
      const rate30 = f30.request_rate_per_sec?.value ?? 0.0;
      const rate5m = f5m.request_rate_per_sec?.value ?? 0.0;
      const errorRatio30 = f30.http_4xx_ratio?.value ?? 0.0;
      const errorRatio5m = f5m.http_4xx_ratio?.value ?? 0.0;

      if (rate5m > 0) {
        rateRatio = rate30 / rate5m;
      }

      // Check if sudden acceleration is accompanied by error surge (pivoting from normal to attack)
      const errorSurge = errorRatio30 - errorRatio5m;
      if (rateRatio >= config.minRateAcceleration && errorSurge >= config.minFailureDelta && f30.request_count?.value >= 5) {
        crossWindowShiftTriggered = true;
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
          evidence: { rateDelta, failureDelta, baselineVersion: baseline.baselineVersion },
          uncertaintyNotes,
          explanation: `Significant deviation from established baseline (v${baseline.baselineVersion}): Rate increased by ${rateDelta.toFixed(2)} req/s and failure ratio increased by ${(failureDelta * 100).toFixed(1)}%.`
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
      explanation: `Behavioral trajectory between short and long evaluation windows is consistent with benign workflow transitions.`
    });
  }
});
