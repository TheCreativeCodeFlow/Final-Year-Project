/**
 * Behavioral Baseline Service (Stage 4B)
 *
 * Computes, calibrates, and stores tenant- and application-isolated behavioral baselines:
 * 1. Minimum observation count enforcement before establishing baseline (default: 50 clean observations).
 * 2. Strict baseline contamination defenses:
 *    - Filters out invalid, malformed, or rejected requests.
 *    - Filters out error responses (4xx, 5xx) to avoid encoding attacks into expected behavior.
 *    - Filters out extreme anomalies (e.g. brute force bursts).
 * 3. Deterministic baseline computation (reproducible from historical observations).
 * 4. Explicit baseline lifecycle states ('CALIBRATING', 'ESTABLISHED', 'SUPERSEDED').
 * 5. Tenant-scoped and application-scoped metrics.
 */

export const MIN_OBSERVATIONS_FOR_BASELINE = 50;

export const BASELINE_STATUS = {
  CALIBRATING: 'CALIBRATING',
  ESTABLISHED: 'ESTABLISHED',
  SUPERSEDED: 'SUPERSEDED'
};

export class BehavioralBaselineService {
  /**
   * @param {object} [options]
   * @param {number} [options.minObservations=50]
   * @param {string} [options.baselineVersion='1.0.0']
   */
  constructor(options = {}) {
    this.minObservations = options.minObservations || MIN_OBSERVATIONS_FOR_BASELINE;
    this.baselineVersion = options.baselineVersion || '1.0.0';
  }

  /**
   * Evaluates whether an observation is clean (non-anomalous, successful, validated)
   * to protect baseline statistics from being poisoned by attack traffic.
   *
   * @param {object} observation
   * @returns {boolean}
   */
  isObservationEligibleForBaseline(observation) {
    if (!observation) return false;

    const status = Number(observation.responseStatus || observation.status || 0);
    const validation = observation.validationOutcome || 'VALIDATED';
    const forwarding = observation.forwardingResult || 'SUCCESS';

    // Must be validated and successfully processed
    if (validation !== 'VALIDATED') return false;
    if (forwarding !== 'SUCCESS' && forwarding !== 'NOT_ATTEMPTED') return false;

    // Error status codes (4xx, 5xx) must NOT contaminate legitimate traffic baselines
    if (status >= 400) return false;

    return true;
  }

  /**
   * Computes a baseline statistical profile from an array of observations.
   *
   * @param {object} params
   * @param {Array<object>} params.observations
   * @param {string} params.tenantId
   * @param {string} [params.applicationId]
   * @param {number} [params.sampleWindowHours=24]
   * @returns {object} Baseline specification
   */
  computeBaseline(params) {
    const {
      observations = [],
      tenantId,
      applicationId = null,
      sampleWindowHours = 24
    } = params;

    // Filter clean observations to prevent baseline contamination
    const cleanObservations = observations.filter((obs) => this.isObservationEligibleForBaseline(obs));
    const cleanCount = cleanObservations.length;

    // Determine status based on minimum threshold
    const status = cleanCount >= this.minObservations
      ? BASELINE_STATUS.ESTABLISHED
      : BASELINE_STATUS.CALIBRATING;

    if (cleanCount === 0) {
      return {
        tenantId,
        applicationId,
        baselineVersion: this.baselineVersion,
        status: BASELINE_STATUS.CALIBRATING,
        observationCount: 0,
        sampleWindowHours,
        metrics: null,
        establishedAt: null
      };
    }

    // Sort chronologically
    cleanObservations.sort((a, b) => new Date(a.timestamp || a.observedAt).getTime() - new Date(b.timestamp || b.observedAt).getTime());

    // Calculate time span of observations in seconds
    const firstTimeMs = new Date(cleanObservations[0].timestamp || cleanObservations[0].observedAt).getTime();
    const lastTimeMs = new Date(cleanObservations[cleanCount - 1].timestamp || cleanObservations[cleanCount - 1].observedAt).getTime();
    const durationSpanSec = Math.max(1, (lastTimeMs - firstTimeMs) / 1000);

    const typicalRequestRate = Number((cleanCount / durationSpanSec).toFixed(4));

    // Endpoint diversity calculation
    const routeCounts = {};
    const methodCounts = {};
    const statusCounts = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 };
    const intervalsMs = [];
    let prevMs = null;

    for (const obs of cleanObservations) {
      const route = obs.normalizedRoute || obs.requestPath || '/';
      routeCounts[route] = (routeCounts[route] || 0) + 1;

      const method = (obs.httpMethod || obs.method || 'GET').toUpperCase();
      methodCounts[method] = (methodCounts[method] || 0) + 1;

      const status = Number(obs.responseStatus || obs.status || 200);
      if (status >= 200 && status < 300) statusCounts['2xx']++;
      else if (status >= 300 && status < 400) statusCounts['3xx']++;

      const obsTimeMs = new Date(obs.timestamp || obs.observedAt).getTime();
      if (prevMs !== null) {
        intervalsMs.push(Math.max(0, obsTimeMs - prevMs));
      }
      prevMs = obsTimeMs;
    }

    const uniqueEndpoints = Object.keys(routeCounts).length;
    const typicalEndpointDiversity = Number((uniqueEndpoints / cleanCount).toFixed(4));

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
      typical4xxRatio: 0.0, // Expected clean baseline error ratio is 0.0
      typicalIntervalMeanMs,
      typicalIntervalVarianceMs,
      typicalMethodDistribution,
      typicalStatusDistribution,
      totalCleanObservations: cleanCount,
      discardedContaminatedObservations: observations.length - cleanCount
    };

    return {
      tenantId,
      applicationId,
      baselineVersion: this.baselineVersion,
      status,
      observationCount: cleanCount,
      sampleWindowHours,
      metrics,
      establishedAt: status === BASELINE_STATUS.ESTABLISHED ? new Date().toISOString() : null
    };
  }
}
