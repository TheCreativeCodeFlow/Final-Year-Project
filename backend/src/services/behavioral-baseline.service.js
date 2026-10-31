/**
 * Behavioral Baseline Service (Stage 4B & 4B.1 Hardened)
 *
 * Computes, calibrates, and stores tenant- and application-isolated behavioral baselines:
 * 1. Multi-dimensional baseline quality:
 *    - Minimum eligible observation count (default: 50 observations).
 *    - Minimum calibration duration (default: 3600 seconds / 1 hour; configurable for benchmarks).
 *    - Freshness / staleness detection (transitions to 'STALE' after 168 hours / 7 days).
 *    - Telemetry loss integrity check (transitions to 'INVALID' if calibration data experienced loss).
 * 2. Strict baseline contamination defense:
 *    - Excludes unvalidated requests (request smuggling, duplicate headers, prohibited methods).
 *    - Excludes policy-blocked and SSRF-prohibited attempts.
 *    - Excludes explicit attack probes and quarantined observations.
 *    - SEPARATES observation trustworthiness from legitimate application error behavior:
 *      Validated 404, 401, 403, 429, and transient 503 responses in legitimate application traffic
 *      are INCLUDED so the baseline accurately reflects real-world error distributions (typical4xxRatio,
 *      typical5xxRatio) rather than falsely assuming zero errors.
 * 3. Deterministic baseline computation (identical clean observations yield identical metrics).
 * 4. Explicit lifecycle states:
 *    - CALIBRATING: Observation count < minObservations OR duration < minCalibrationDurationSeconds.
 *    - ESTABLISHED: Both count and duration criteria met, no unmitigated telemetry loss, not stale.
 *    - STALE: Baseline age exceeds stalenessThresholdHours; delta computations paused.
 *    - INVALID: Contaminated by telemetry loss, corruption, or severe observation anomalies.
 *    - SUPERSEDED: Replaced by a newly calibrated baseline version.
 * 5. Tenant-scoped and application-scoped metrics.
 */

export const MIN_OBSERVATIONS_FOR_BASELINE = 50;
export const DEFAULT_MIN_CALIBRATION_DURATION_SECONDS = 3600; // 1 hour
export const DEFAULT_STALENESS_THRESHOLD_HOURS = 168; // 7 days

export const BASELINE_STATUS = {
  CALIBRATING: 'CALIBRATING',
  ESTABLISHED: 'ESTABLISHED',
  STALE: 'STALE',
  INVALID: 'INVALID',
  SUPERSEDED: 'SUPERSEDED'
};

export class BehavioralBaselineService {
  /**
   * @param {object} [options]
   * @param {number} [options.minObservations=50]
   * @param {number} [options.minCalibrationDurationSeconds=3600]
   * @param {number} [options.stalenessThresholdHours=168]
   * @param {string} [options.baselineVersion='1.0.0']
   */
  constructor(options = {}) {
    this.minObservations = options.minObservations !== undefined ? options.minObservations : MIN_OBSERVATIONS_FOR_BASELINE;
    this.minCalibrationDurationSeconds = options.minCalibrationDurationSeconds !== undefined
      ? options.minCalibrationDurationSeconds
      : DEFAULT_MIN_CALIBRATION_DURATION_SECONDS;
    this.stalenessThresholdHours = options.stalenessThresholdHours || DEFAULT_STALENESS_THRESHOLD_HOURS;
    this.baselineVersion = options.baselineVersion || '1.0.0';
  }

  /**
   * Evaluates whether an observation is eligible for baseline inclusion.
   * Separates observation trustworthiness from HTTP response codes.
   *
   * @param {object} observation
   * @returns {boolean}
   */
  isObservationEligibleForBaseline(observation) {
    if (!observation) return false;

    const validation = observation.validationOutcome || 'VALIDATED';
    const forwarding = observation.forwardingResult || 'SUCCESS';

    // 1. Must pass ingress validation checks (rejects smuggling, host spoofing, method tampering)
    if (validation !== 'VALIDATED') {
      return false;
    }

    // 2. Reject blocked, SSRF, or failed-closed requests
    if (
      forwarding === 'SSRF_BLOCKED' ||
      forwarding === 'BLOCKED_BY_POLICY' ||
      forwarding === 'FAIL_CLOSED'
    ) {
      return false;
    }

    // 3. Reject explicitly tagged attack probes / brute force indicators
    if (observation.isAttackProbe === true || observation.isQuarantined === true) {
      return false;
    }

    // 4. Legitimate application errors (404, 401, 403, 429, 502, 503) from validated
    // forwarding ARE eligible to capture real-world operational distributions
    return true;
  }

  /**
   * Checks whether a baseline is valid and established for computing numeric deltas.
   *
   * @param {object} baseline
   * @returns {boolean}
   */
  isBaselineUsableForDeltas(baseline) {
    if (!baseline || typeof baseline !== 'object') return false;
    if (baseline.status !== BASELINE_STATUS.ESTABLISHED) return false;
    if (!baseline.metrics || typeof baseline.metrics !== 'object') return false;
    return true;
  }

  /**
   * Evaluates whether an existing established baseline has become STALE.
   *
   * @param {object} baseline
   * @param {Date|number|string} [referenceTime=Date.now()]
   * @returns {boolean}
   */
  isBaselineStale(baseline, referenceTime = Date.now()) {
    if (!baseline || baseline.status !== BASELINE_STATUS.ESTABLISHED) return false;
    const establishedDate = baseline.establishedAt ? new Date(baseline.establishedAt).getTime() : 0;
    if (!establishedDate) return true;
    const ageHours = (new Date(referenceTime).getTime() - establishedDate) / (3600 * 1000);
    return ageHours > this.stalenessThresholdHours;
  }

  /**
   * Computes a baseline statistical profile from an array of observations.
   *
   * @param {object} params
   * @param {Array<object>} params.observations
   * @param {string} params.tenantId
   * @param {string} [params.applicationId]
   * @param {number} [params.sampleWindowHours=24]
   * @param {boolean} [params.hasTelemetryLoss=false]
   * @returns {object} Baseline specification
   */
  computeBaseline(params) {
    const {
      observations = [],
      tenantId,
      applicationId = null,
      sampleWindowHours = 24,
      hasTelemetryLoss = false
    } = params;

    // Filter clean observations to prevent baseline contamination
    const cleanObservations = observations.filter((obs) => this.isObservationEligibleForBaseline(obs));
    const cleanCount = cleanObservations.length;

    // Check if telemetry loss occurred during calibration
    const lossObserved = hasTelemetryLoss || observations.some(
      (o) => o.hasDataLoss || o.persistenceStatus === 'TELEMETRY_PERSISTENCE_FAILED'
    );

    if (cleanCount === 0) {
      return {
        tenantId,
        applicationId,
        baselineVersion: this.baselineVersion,
        status: lossObserved ? BASELINE_STATUS.INVALID : BASELINE_STATUS.CALIBRATING,
        observationCount: 0,
        sampleWindowHours,
        metrics: null,
        qualityMetadata: {
          hasTelemetryLoss: lossObserved,
          calibrationDurationSeconds: 0,
          eligibleCount: 0,
          totalProvided: observations.length,
          reason: 'NO_ELIGIBLE_OBSERVATIONS'
        },
        establishedAt: null
      };
    }

    // Sort chronologically
    cleanObservations.sort(
      (a, b) => new Date(a.timestamp || a.observedAt).getTime() - new Date(b.timestamp || b.observedAt).getTime()
    );

    // Calculate time span of observations in seconds
    const firstTimeMs = new Date(cleanObservations[0].timestamp || cleanObservations[0].observedAt).getTime();
    const lastTimeMs = new Date(cleanObservations[cleanCount - 1].timestamp || cleanObservations[cleanCount - 1].observedAt).getTime();
    const durationSpanSec = Math.max(1, (lastTimeMs - firstTimeMs) / 1000);

    // Baseline Quality Criteria:
    // 1. Observation count threshold
    // 2. Minimum calibration duration threshold
    // 3. No telemetry loss during calibration
    let status;
    if (lossObserved) {
      status = BASELINE_STATUS.INVALID;
    } else if (cleanCount >= this.minObservations && durationSpanSec >= this.minCalibrationDurationSeconds) {
      status = BASELINE_STATUS.ESTABLISHED;
    } else {
      status = BASELINE_STATUS.CALIBRATING;
    }

    const typicalRequestRate = Number((cleanCount / durationSpanSec).toFixed(4));

    // Endpoint diversity and error distribution calculations
    const routeCounts = {};
    const methodCounts = {};
    const statusCounts = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 };
    let count4xx = 0;
    let count5xx = 0;
    const intervalsMs = [];
    let prevMs = null;

    for (const obs of cleanObservations) {
      const route = obs.normalizedRoute || obs.requestPath || '/';
      routeCounts[route] = (routeCounts[route] || 0) + 1;

      const method = (obs.httpMethod || obs.method || 'GET').toUpperCase();
      methodCounts[method] = (methodCounts[method] || 0) + 1;

      const statusNum = Number(obs.responseStatus || obs.status || 200);
      if (statusNum >= 200 && statusNum < 300) statusCounts['2xx']++;
      else if (statusNum >= 300 && statusNum < 400) statusCounts['3xx']++;
      else if (statusNum >= 400 && statusNum < 500) {
        statusCounts['4xx']++;
        count4xx++;
      } else if (statusNum >= 500 && statusNum < 600) {
        statusCounts['5xx']++;
        count5xx++;
      }

      const obsTimeMs = new Date(obs.timestamp || obs.observedAt).getTime();
      if (prevMs !== null) {
        intervalsMs.push(Math.max(0, obsTimeMs - prevMs));
      }
      prevMs = obsTimeMs;
    }

    const uniqueEndpoints = Object.keys(routeCounts).length;
    const typicalEndpointDiversity = Number((uniqueEndpoints / cleanCount).toFixed(4));
    const typical4xxRatio = Number((count4xx / cleanCount).toFixed(4));
    const typical5xxRatio = Number((count5xx / cleanCount).toFixed(4));

    // Distribution calculations
    const typicalMethodDistribution = {};
    for (const [m, count] of Object.entries(methodCounts)) {
      typicalMethodDistribution[m] = Number((count / cleanCount).toFixed(4));
    }

    const typicalStatusDistribution = {};
    for (const [sc, count] of Object.entries(statusCounts)) {
      typicalStatusDistribution[sc] = Number((count / cleanCount).toFixed(4));
    }

    let typicalIntervalMeanMs = null;
    let typicalIntervalVarianceMs = null;

    if (intervalsMs.length > 0) {
      const sum = intervalsMs.reduce((acc, v) => acc + v, 0);
      typicalIntervalMeanMs = Number((sum / intervalsMs.length).toFixed(2));

      if (intervalsMs.length >= 2) {
        const squaredDiffs = intervalsMs.map((v) => Math.pow(v - typicalIntervalMeanMs, 2));
        const varianceSum = squaredDiffs.reduce((acc, v) => acc + v, 0);
        typicalIntervalVarianceMs = Number((varianceSum / intervalsMs.length).toFixed(2));
      } else {
        typicalIntervalVarianceMs = 0;
      }
    }

    const metrics = {
      typicalRequestRate,
      typicalEndpointDiversity,
      typical4xxRatio,
      typical5xxRatio,
      typicalIntervalMeanMs,
      typicalIntervalVarianceMs,
      typicalMethodDistribution,
      typicalStatusDistribution,
      totalCleanObservations: cleanCount,
      discardedContaminatedObservations: observations.length - cleanCount,
      calibrationDurationSeconds: Math.round(durationSpanSec)
    };

    const qualityMetadata = {
      hasTelemetryLoss: lossObserved,
      minObservationsRequired: this.minObservations,
      minDurationSecondsRequired: this.minCalibrationDurationSeconds,
      actualDurationSeconds: Math.round(durationSpanSec),
      eligibleCount: cleanCount,
      totalObservationsSampled: observations.length,
      calibrationWindowStart: new Date(firstTimeMs).toISOString(),
      calibrationWindowEnd: new Date(lastTimeMs).toISOString(),
      provenance: {
        algorithmVersion: '2.0.0',
        computedAt: new Date().toISOString()
      }
    };

    return {
      tenantId,
      applicationId,
      baselineVersion: this.baselineVersion,
      status,
      observationCount: cleanCount,
      sampleWindowHours,
      metrics,
      qualityMetadata,
      establishedAt: status === BASELINE_STATUS.ESTABLISHED ? new Date().toISOString() : null
    };
  }
}
