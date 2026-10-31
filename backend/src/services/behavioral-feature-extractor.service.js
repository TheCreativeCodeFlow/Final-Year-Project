/**
 * Behavioral Feature Extraction Engine (Stage 4B)
 *
 * Computes normalized, time-windowed behavioral feature vectors from canonical telemetry:
 * 1. Configurable time windows (default: 30s, 5m, 15m).
 * 2. Request behavior (rate, burstiness, inter-request intervals mean & variance, method/status distributions).
 * 3. Endpoint behavior (diversity, concentration, unusual routes, resource enumeration score).
 * 4. Failure behavior (4xx/5xx ratios, client errors, repeated not-found, upstream failures).
 * 5. Behavioral deltas vs established baselines (rate delta, diversity delta, failure ratio delta).
 * 6. Evidence quality metadata (observation count, missing field count, completeness ratio).
 *
 * Strict Principles:
 * - Features are objective measurements, NEVER automatic verdicts of malice.
 * - Missing-data statuses are explicitly tracked ('COMPLETE', 'PARTIAL', 'INSUFFICIENT_DATA', 'NO_BASELINE').
 * - Preserves complete source observation references.
 */

export const DEFAULT_TIME_WINDOWS = [
  { label: '30s', durationSeconds: 30 },
  { label: '5m', durationSeconds: 300 },
  { label: '15m', durationSeconds: 900 }
];

export const FEATURE_TYPES = {
  COUNTER: 'COUNTER',
  RATE: 'RATE',
  RATIO: 'RATIO',
  DURATION_MS: 'DURATION_MS',
  STATISTIC: 'STATISTIC',
  DISTRIBUTION: 'DISTRIBUTION',
  SCORE: 'SCORE',
  DELTA: 'DELTA'
};

export const MISSING_DATA_STATUS = {
  COMPLETE: 'COMPLETE',
  PARTIAL: 'PARTIAL',
  INSUFFICIENT_DATA: 'INSUFFICIENT_DATA',
  NO_BASELINE: 'NO_BASELINE'
};

export class BehavioralFeatureExtractor {
  /**
   * @param {object} [options]
   * @param {Array<{label: string, durationSeconds: number}>} [options.timeWindows]
   * @param {string} [options.extractionVersion='1.0.0']
   */
  constructor(options = {}) {
    this.timeWindows = options.timeWindows || DEFAULT_TIME_WINDOWS;
    this.extractionVersion = options.extractionVersion || '1.0.0';
  }

  /**
   * Extracts feature sets across all configured time windows for a given session.
   *
   * @param {object} params
   * @param {Array<object>} params.canonicalEvents - Normalized canonical telemetry events
   * @param {string} params.tenantId
   * @param {string} [params.applicationId]
   * @param {string} params.sessionRef - Session identifier or pseudonymous correlation key
   * @param {Date|string|number} [params.referenceTimestamp=new Date()] - Evaluation time boundary
   * @param {object} [params.baseline] - Optional BehavioralBaseline record for delta calculations
   * @returns {Array<object>} Array of FeatureSet objects (one per configured time window)
   */
  extractFeatures(params) {
    const {
      canonicalEvents = [],
      tenantId,
      applicationId = null,
      sessionRef,
      referenceTimestamp = new Date(),
      baseline = null
    } = params;

    const refDate = new Date(referenceTimestamp);
    const refTimeMs = refDate.getTime();

    const featureSets = [];

    for (const windowConfig of this.timeWindows) {
      const { label, durationSeconds } = windowConfig;
      const windowStartMs = refTimeMs - durationSeconds * 1000;
      const windowStartDate = new Date(windowStartMs);

      // Filter events falling strictly within [windowStart, windowEnd]
      const windowEvents = canonicalEvents.filter((ev) => {
        const evTime = new Date(ev.timestamp).getTime();
        return evTime >= windowStartMs && evTime <= refTimeMs;
      });

      // Sort chronological ascending
      windowEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      const computed = this.computeWindowMetrics({
        events: windowEvents,
        windowLabel: label,
        durationSeconds,
        baseline
      });

      featureSets.push({
        tenantId,
        applicationId,
        sessionRef,
        windowLabel: label,
        windowDurationSeconds: durationSeconds,
        windowStart: windowStartDate.toISOString(),
        windowEnd: refDate.toISOString(),
        observationCount: windowEvents.length,
        features: computed.features,
        qualityMetadata: computed.qualityMetadata,
        sourceObservationIds: windowEvents.map((e) => e.eventId || e.id || e.correlationId),
        schemaVersion: '1.0.0',
        extractionVersion: this.extractionVersion,
        createdAt: new Date().toISOString()
      });
    }

    return featureSets;
  }

  /**
   * Computes internal feature dictionary and evidence quality for a single time window.
   *
   * @private
   */
  computeWindowMetrics({ events, windowLabel, durationSeconds, baseline }) {
    const totalRequests = events.length;
    let missingFieldTotal = 0;

    const persistenceCounts = {
      TELEMETRY_PERSISTED: 0,
      TELEMETRY_PENDING: 0,
      TELEMETRY_PERSISTENCE_FAILED: 0,
      NOT_RECORDED: 0
    };

    const methodCounts = {};
    const statusClassCounts = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 };
    const routeCounts = {};
    const route404Set = new Set();

    let count4xx = 0;
    let count5xx = 0;
    let count404 = 0;
    let countAuthFailures = 0; // 401, 403
    let countUpstreamFailures = 0; // 502, 503, 504

    // 1-second burst buckets
    const secondBuckets = new Map();

    // Intervals between consecutive requests
    const intervalsMs = [];
    let previousTimestampMs = null;

    for (const ev of events) {
      // Check missing optional fields
      if (!ev.applicationId) missingFieldTotal++;
      if (!ev.sessionReference) missingFieldTotal++;

      // Persistence accounting
      const pStatus = ev.persistenceStatus || 'TELEMETRY_PERSISTED';
      persistenceCounts[pStatus] = (persistenceCounts[pStatus] || 0) + 1;

      // Method distribution
      const method = (ev.httpMethod || 'UNKNOWN').toUpperCase();
      methodCounts[method] = (methodCounts[method] || 0) + 1;

      // Endpoint tracking
      const route = ev.normalizedRoute || '/';
      routeCounts[route] = (routeCounts[route] || 0) + 1;

      // Status breakdown
      const status = Number(ev.responseStatus) || 0;
      if (status >= 200 && status < 300) statusClassCounts['2xx']++;
      else if (status >= 300 && status < 400) statusClassCounts['3xx']++;
      else if (status >= 400 && status < 500) statusClassCounts['4xx']++;
      else if (status >= 500 && status < 600) statusClassCounts['5xx']++;

      if (status >= 400 && status < 500) count4xx++;
      if (status >= 500 && status < 600) count5xx++;
      if (status === 404) {
        count404++;
        route404Set.add(route);
      }
      if (status === 401 || status === 403) countAuthFailures++;
      if (status === 502 || status === 503 || status === 504) countUpstreamFailures++;

      // Burst bucketing (per-second epoch)
      const evTimeMs = new Date(ev.timestamp).getTime();
      const secondEpoch = Math.floor(evTimeMs / 1000);
      secondBuckets.set(secondEpoch, (secondBuckets.get(secondEpoch) || 0) + 1);

      // Interval calculation
      if (previousTimestampMs !== null) {
        const interval = Math.max(0, evTimeMs - previousTimestampMs);
        intervalsMs.push(interval);
      }
      previousTimestampMs = evTimeMs;
    }

    // 1. Request Behavior
    const requestRatePerSec = Number((totalRequests / durationSeconds).toFixed(4));
    let burstFrequencyMax1s = 0;
    for (const count of secondBuckets.values()) {
      if (count > burstFrequencyMax1s) burstFrequencyMax1s = count;
    }

    let intervalMeanMs = null;
    let intervalVarianceMs = null;
    let intervalStatus = MISSING_DATA_STATUS.INSUFFICIENT_DATA;

    if (intervalsMs.length > 0) {
      const sum = intervalsMs.reduce((acc, val) => acc + val, 0);
      intervalMeanMs = Number((sum / intervalsMs.length).toFixed(2));

      if (intervalsMs.length >= 2) {
        const squaredDiffs = intervalsMs.map((val) => Math.pow(val - intervalMeanMs, 2));
        const varianceSum = squaredDiffs.reduce((acc, val) => acc + val, 0);
        intervalVarianceMs = Number((varianceSum / intervalsMs.length).toFixed(2));
        intervalStatus = MISSING_DATA_STATUS.COMPLETE;
      } else {
        intervalVarianceMs = 0;
        intervalStatus = MISSING_DATA_STATUS.PARTIAL;
      }
    }

    // Normalized distributions
    const httpMethodDistribution = {};
    for (const [m, count] of Object.entries(methodCounts)) {
      httpMethodDistribution[m] = totalRequests > 0 ? Number((count / totalRequests).toFixed(4)) : 0;
    }

    const responseStatusDistribution = {};
    for (const [sClass, count] of Object.entries(statusClassCounts)) {
      responseStatusDistribution[sClass] = totalRequests > 0 ? Number((count / totalRequests).toFixed(4)) : 0;
    }

    // 2. Endpoint Behavior
    const uniqueEndpointCount = Object.keys(routeCounts).length;
    const endpointDiversityRatio = totalRequests > 0
      ? Number((uniqueEndpointCount / totalRequests).toFixed(4))
      : 0;

    let maxRouteHits = 0;
    for (const count of Object.values(routeCounts)) {
      if (count > maxRouteHits) maxRouteHits = count;
    }
    const repeatedEndpointRatio = totalRequests > 0
      ? Number((maxRouteHits / totalRequests).toFixed(4))
      : 0;

    const unusualRouteRatio = totalRequests > 0
      ? Number((count404 / totalRequests).toFixed(4))
      : 0;

    // Resource enumeration reproducible score (0.0 to 1.0)
    // Formula: product of breadth (ratio of distinct 404 paths vs threshold K=5)
    // and route 404 concentration factor. Avoids false positives on repeated hits to
    // a single missing asset or legitimate multi-endpoint pagination/crawling.
    const notFoundUniqueRouteCount = route404Set.size;
    const enumerationBreadth = Math.min(1.0, notFoundUniqueRouteCount / 5);
    const notFoundDiversityRatio = uniqueEndpointCount > 0
      ? notFoundUniqueRouteCount / uniqueEndpointCount
      : 0;
    const resourceEnumerationScore = Number((enumerationBreadth * notFoundDiversityRatio).toFixed(4));

    // 3. Failure Behavior
    const http4xxRatio = totalRequests > 0 ? Number((count4xx / totalRequests).toFixed(4)) : 0;
    const http5xxRatio = totalRequests > 0 ? Number((count5xx / totalRequests).toFixed(4)) : 0;

    // 4. Behavioral Changes (vs Baseline)
    let rateDeltaVsBaseline = null;
    let endpointDiversityDelta = null;
    let failureRatioDelta = null;
    let baselineDataStatus = MISSING_DATA_STATUS.NO_BASELINE;

    // Only compute numeric deltas if the baseline is ESTABLISHED
    const isBaselineUsable = baseline && baseline.status === 'ESTABLISHED' && baseline.metrics;

    if (isBaselineUsable) {
      baselineDataStatus = MISSING_DATA_STATUS.COMPLETE;
      const bMetrics = baseline.metrics;

      if (typeof bMetrics.typicalRequestRate === 'number') {
        rateDeltaVsBaseline = Number((requestRatePerSec - bMetrics.typicalRequestRate).toFixed(4));
      }
      if (typeof bMetrics.typicalEndpointDiversity === 'number') {
        endpointDiversityDelta = Number((endpointDiversityRatio - bMetrics.typicalEndpointDiversity).toFixed(4));
      }
      if (typeof bMetrics.typical4xxRatio === 'number') {
        failureRatioDelta = Number((http4xxRatio - bMetrics.typical4xxRatio).toFixed(4));
      }
    } else if (baseline && baseline.status === 'STALE') {
      baselineDataStatus = 'BASELINE_STALE';
    } else if (baseline && baseline.status === 'INVALID') {
      baselineDataStatus = 'BASELINE_INVALID';
    } else if (baseline && baseline.status === 'CALIBRATING') {
      baselineDataStatus = 'BASELINE_CALIBRATING';
    }

    // Build structured feature dictionary
    const features = {
      // A. Request Behavior
      request_count: {
        name: 'request_count',
        value: totalRequests,
        type: FEATURE_TYPES.COUNTER,
        unit: 'count',
        timeWindow: windowLabel,
        observationCount: totalRequests,
        provenance: 'computed_from_canonical_observations',
        missingDataStatus: MISSING_DATA_STATUS.COMPLETE
      },
      request_rate_per_sec: {
        name: 'request_rate_per_sec',
        value: requestRatePerSec,
        type: FEATURE_TYPES.RATE,
        unit: 'req/s',
        timeWindow: windowLabel,
        observationCount: totalRequests,
        provenance: 'computed_from_canonical_observations',
        missingDataStatus: MISSING_DATA_STATUS.COMPLETE
      },
      burst_frequency_max_1s: {
        name: 'burst_frequency_max_1s',
        value: burstFrequencyMax1s,
        type: FEATURE_TYPES.COUNTER,
        unit: 'req/s_peak',
        timeWindow: windowLabel,
        observationCount: totalRequests,
        provenance: 'computed_from_canonical_observations',
        missingDataStatus: MISSING_DATA_STATUS.COMPLETE
      },
      inter_request_interval_mean_ms: {
        name: 'inter_request_interval_mean_ms',
        value: intervalMeanMs,
        type: FEATURE_TYPES.DURATION_MS,
        unit: 'ms',
        timeWindow: windowLabel,
        observationCount: intervalsMs.length,
        provenance: 'computed_from_canonical_observations',
        missingDataStatus: intervalStatus
      },
      inter_request_interval_variance_ms: {
        name: 'inter_request_interval_variance_ms',
        value: intervalVarianceMs,
        type: FEATURE_TYPES.STATISTIC,
        unit: 'ms^2',
        timeWindow: windowLabel,
        observationCount: intervalsMs.length,
        provenance: 'computed_from_canonical_observations',
        missingDataStatus: intervalStatus
      },
      http_method_distribution: {
        name: 'http_method_distribution',
        value: httpMethodDistribution,
        type: FEATURE_TYPES.DISTRIBUTION,
        unit: 'ratio_map',
        timeWindow: windowLabel,
        observationCount: totalRequests,
        provenance: 'computed_from_canonical_observations',
        missingDataStatus: MISSING_DATA_STATUS.COMPLETE
      },
      response_status_distribution: {
        name: 'response_status_distribution',
        value: responseStatusDistribution,
        type: FEATURE_TYPES.DISTRIBUTION,
        unit: 'ratio_map',
        timeWindow: windowLabel,
        observationCount: totalRequests,
        provenance: 'computed_from_canonical_observations',
        missingDataStatus: MISSING_DATA_STATUS.COMPLETE
      },

      // B. Endpoint Behavior
      unique_endpoint_count: {
        name: 'unique_endpoint_count',
        value: uniqueEndpointCount,
        type: FEATURE_TYPES.COUNTER,
        unit: 'count',
        timeWindow: windowLabel,
        observationCount: totalRequests,
        provenance: 'computed_from_canonical_observations',
        missingDataStatus: MISSING_DATA_STATUS.COMPLETE
      },
      endpoint_diversity_ratio: {
        name: 'endpoint_diversity_ratio',
        value: endpointDiversityRatio,
        type: FEATURE_TYPES.RATIO,
        unit: 'ratio',
        timeWindow: windowLabel,
        observationCount: totalRequests,
        provenance: 'computed_from_canonical_observations',
        missingDataStatus: MISSING_DATA_STATUS.COMPLETE
      },
      repeated_endpoint_ratio: {
        name: 'repeated_endpoint_ratio',
        value: repeatedEndpointRatio,
        type: FEATURE_TYPES.RATIO,
        unit: 'ratio',
        timeWindow: windowLabel,
        observationCount: totalRequests,
        provenance: 'computed_from_canonical_observations',
        missingDataStatus: MISSING_DATA_STATUS.COMPLETE
      },
      unusual_route_ratio: {
        name: 'unusual_route_ratio',
        value: unusualRouteRatio,
        type: FEATURE_TYPES.RATIO,
        unit: 'ratio',
        timeWindow: windowLabel,
        observationCount: totalRequests,
        provenance: 'computed_from_canonical_observations',
        missingDataStatus: MISSING_DATA_STATUS.COMPLETE
      },
      resource_enumeration_score: {
        name: 'resource_enumeration_score',
        value: resourceEnumerationScore,
        type: FEATURE_TYPES.SCORE,
        unit: 'score_0_1',
        timeWindow: windowLabel,
        observationCount: totalRequests,
        provenance: 'computed_from_canonical_observations',
        missingDataStatus: MISSING_DATA_STATUS.COMPLETE
      },

      // C. Failure Behavior
      http_4xx_ratio: {
        name: 'http_4xx_ratio',
        value: http4xxRatio,
        type: FEATURE_TYPES.RATIO,
        unit: 'ratio',
        timeWindow: windowLabel,
        observationCount: totalRequests,
        provenance: 'computed_from_canonical_observations',
        missingDataStatus: MISSING_DATA_STATUS.COMPLETE
      },
      http_5xx_ratio: {
        name: 'http_5xx_ratio',
        value: http5xxRatio,
        type: FEATURE_TYPES.RATIO,
        unit: 'ratio',
        timeWindow: windowLabel,
        observationCount: totalRequests,
        provenance: 'computed_from_canonical_observations',
        missingDataStatus: MISSING_DATA_STATUS.COMPLETE
      },
      client_error_count: {
        name: 'client_error_count',
        value: count4xx,
        type: FEATURE_TYPES.COUNTER,
        unit: 'count',
        timeWindow: windowLabel,
        observationCount: totalRequests,
        provenance: 'computed_from_canonical_observations',
        missingDataStatus: MISSING_DATA_STATUS.COMPLETE
      },
      repeated_not_found_count: {
        name: 'repeated_not_found_count',
        value: count404,
        type: FEATURE_TYPES.COUNTER,
        unit: 'count',
        timeWindow: windowLabel,
        observationCount: totalRequests,
        provenance: 'computed_from_canonical_observations',
        missingDataStatus: MISSING_DATA_STATUS.COMPLETE
      },
      auth_failure_count: {
        name: 'auth_failure_count',
        value: countAuthFailures,
        type: FEATURE_TYPES.COUNTER,
        unit: 'count',
        timeWindow: windowLabel,
        observationCount: totalRequests,
        provenance: 'computed_from_canonical_observations',
        missingDataStatus: MISSING_DATA_STATUS.COMPLETE
      },
      upstream_failure_count: {
        name: 'upstream_failure_count',
        value: countUpstreamFailures,
        type: FEATURE_TYPES.COUNTER,
        unit: 'count',
        timeWindow: windowLabel,
        observationCount: totalRequests,
        provenance: 'computed_from_canonical_observations',
        missingDataStatus: MISSING_DATA_STATUS.COMPLETE
      },

      // D. Behavioral Changes (vs Baseline)
      rate_delta_vs_baseline: {
        name: 'rate_delta_vs_baseline',
        value: rateDeltaVsBaseline,
        type: FEATURE_TYPES.DELTA,
        unit: 'req/s_diff',
        timeWindow: windowLabel,
        observationCount: totalRequests,
        provenance: 'computed_from_canonical_observations',
        missingDataStatus: baselineDataStatus
      },
      endpoint_diversity_delta: {
        name: 'endpoint_diversity_delta',
        value: endpointDiversityDelta,
        type: FEATURE_TYPES.DELTA,
        unit: 'ratio_diff',
        timeWindow: windowLabel,
        observationCount: totalRequests,
        provenance: 'computed_from_canonical_observations',
        missingDataStatus: baselineDataStatus
      },
      failure_ratio_delta: {
        name: 'failure_ratio_delta',
        value: failureRatioDelta,
        type: FEATURE_TYPES.DELTA,
        unit: 'ratio_diff',
        timeWindow: windowLabel,
        observationCount: totalRequests,
        provenance: 'computed_from_canonical_observations',
        missingDataStatus: baselineDataStatus
      }
    };

    // Calculate completeness ratio
    const featureKeys = Object.keys(features);
    let validFeatures = 0;
    for (const key of featureKeys) {
      if (features[key].value !== null) validFeatures++;
    }
    const featureCompletenessRatio = Number((validFeatures / featureKeys.length).toFixed(4));

    const hasTelemetryLoss = events.some(
      (ev) =>
        ev.hasDataLoss ||
        ev.persistenceStatus === 'TELEMETRY_PERSISTENCE_FAILED' ||
        ev.persistenceStatus === 'NOT_RECORDED'
    );

    const qualityMetadata = {
      totalObservationCount: totalRequests,
      missingFieldTotal,
      telemetryPersistenceBreakdown: persistenceCounts,
      featureCompletenessRatio,
      hasSufficientData: totalRequests >= 1,
      telemetryLossDetected: hasTelemetryLoss,
      windowCompleteness: hasTelemetryLoss
        ? 'PARTIAL'
        : totalRequests > 0
          ? 'COMPLETE'
          : 'EMPTY'
    };

    return { features, qualityMetadata };
  }
}
