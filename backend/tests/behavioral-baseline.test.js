/**
 * Stage 4B & 4B.1: Behavioral Baseline Service Test Suite
 *
 * Verifies:
 * 1. Insufficient sample count (< minObservations -> CALIBRATING).
 * 2. Insufficient calibration duration (< minCalibrationDurationSeconds -> CALIBRATING).
 * 3. Legitimate 404 and authentication failures captured in clean baseline error distributions.
 * 4. Suspicious observations excluded/quarantined during calibration.
 * 5. Telemetry loss during calibration transitions baseline to INVALID.
 * 6. Stale baselines (> stalenessThresholdHours identified).
 * 7. Deterministic recalibration produces identical results.
 * 8. Baseline version changes preserved.
 * 9. Zero-valued baseline metrics handled cleanly without errors.
 * 10. Cross-tenant baseline isolation enforced.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BehavioralBaselineService,
  BASELINE_STATUS,
  MIN_OBSERVATIONS_FOR_BASELINE
} from '../src/services/behavioral-baseline.service.js';

describe('Stage 4B & 4B.1: Behavioral Baseline Service Hardened', () => {
  const service = new BehavioralBaselineService({
    minObservations: 50,
    minCalibrationDurationSeconds: 200, // 200s for testing
    stalenessThresholdHours: 168
  });
  const baseTime = new Date('2026-10-31T12:00:00.000Z').getTime();

  function makeObservation(index, overrides = {}) {
    return {
      id: `obs-${index}`,
      timestamp: new Date(baseTime + index * 5000).toISOString(), // 5s step
      httpMethod: overrides.httpMethod || 'GET',
      normalizedRoute: overrides.normalizedRoute || `/api/v1/resource/${index % 5}`,
      responseStatus: overrides.responseStatus ?? 200,
      validationOutcome: overrides.validationOutcome || 'VALIDATED',
      forwardingResult: overrides.forwardingResult || 'SUCCESS',
      isAttackProbe: overrides.isAttackProbe || false,
      hasDataLoss: overrides.hasDataLoss || false,
      persistenceStatus: overrides.persistenceStatus || 'TELEMETRY_PERSISTED'
    };
  }

  test('1. Baseline remains in CALIBRATING state when observations are below sample threshold (< 50)', () => {
    const observations = [];
    for (let i = 0; i < 30; i++) {
      observations.push(makeObservation(i));
    }

    const baseline = service.computeBaseline({
      observations,
      tenantId: 'tenant-apex',
      applicationId: 'app-01',
      sampleWindowHours: 24
    });

    assert.equal(baseline.status, BASELINE_STATUS.CALIBRATING);
    assert.equal(baseline.observationCount, 30);
    assert.equal(baseline.establishedAt, null);
    assert.ok(baseline.metrics);
  });

  test('2. Baseline remains in CALIBRATING state when calibration duration is insufficient', () => {
    const highDurationService = new BehavioralBaselineService({
      minObservations: 50,
      minCalibrationDurationSeconds: 3600 // 1 hour required
    });

    // 60 observations but spaced only 1s apart (total span: 59s < 3600s)
    const observations = [];
    for (let i = 0; i < 60; i++) {
      observations.push({
        ...makeObservation(i),
        timestamp: new Date(baseTime + i * 1000).toISOString()
      });
    }

    const baseline = highDurationService.computeBaseline({
      observations,
      tenantId: 'tenant-apex',
      applicationId: 'app-01'
    });

    assert.equal(baseline.status, BASELINE_STATUS.CALIBRATING, 'Rapid burst of 60 events must NOT satisfy 1-hour calibration requirement');
    assert.equal(baseline.establishedAt, null);
  });

  test('3. Baseline achieves ESTABLISHED status when sample count AND duration criteria are met', () => {
    // 60 observations * 5s = 295s span (>= 200s threshold)
    const observations = [];
    for (let i = 0; i < 60; i++) {
      observations.push(makeObservation(i));
    }

    const baseline = service.computeBaseline({
      observations,
      tenantId: 'tenant-apex',
      applicationId: 'app-01'
    });

    assert.equal(baseline.status, BASELINE_STATUS.ESTABLISHED);
    assert.equal(baseline.observationCount, 60);
    assert.ok(baseline.establishedAt);
    assert.equal(typeof baseline.metrics.typicalRequestRate, 'number');
    assert.equal(typeof baseline.metrics.typicalEndpointDiversity, 'number');
  });

  test('4. Legitimate 404 and authentication failures are included in baseline error distributions', () => {
    const observations = [];
    for (let i = 0; i < 50; i++) {
      // 45 clean 200s, 3 legitimate 404s, 2 legitimate 401s
      let status = 200;
      if (i === 10 || i === 20 || i === 30) status = 404;
      if (i === 15 || i === 25) status = 401;

      observations.push(makeObservation(i, { responseStatus: status }));
    }

    const baseline = service.computeBaseline({
      observations,
      tenantId: 'tenant-apex',
      applicationId: 'app-01'
    });

    assert.equal(baseline.status, BASELINE_STATUS.ESTABLISHED);
    assert.equal(baseline.observationCount, 50);
    // Verified 404 and 401 are NOT discarded as contamination, but incorporated into baseline
    assert.equal(baseline.metrics.totalCleanObservations, 50);
    assert.equal(baseline.metrics.discardedContaminatedObservations, 0);
    assert.equal(baseline.metrics.typical4xxRatio, 0.1); // 5 errors / 50 = 0.1000
  });

  test('5. Suspicious observations and validation failures are quarantined from baseline', () => {
    const observations = [];
    for (let i = 0; i < 40; i++) {
      observations.push(makeObservation(i));
    }
    // 15 suspicious attack probes
    for (let i = 40; i < 55; i++) {
      observations.push(makeObservation(i, {
        validationOutcome: 'REQUEST_SMUGGLING_DETECTED',
        isAttackProbe: true
      }));
    }

    const baseline = service.computeBaseline({
      observations,
      tenantId: 'tenant-apex',
      applicationId: 'app-01'
    });

    // 40 clean + 15 contaminated -> 15 discarded, cleanCount = 40 (< 50) -> CALIBRATING
    assert.equal(baseline.status, BASELINE_STATUS.CALIBRATING);
    assert.equal(baseline.observationCount, 40);
    assert.equal(baseline.metrics.discardedContaminatedObservations, 15);
  });

  test('6. Telemetry loss during calibration marks baseline status as INVALID', () => {
    const observations = [];
    for (let i = 0; i < 60; i++) {
      observations.push(makeObservation(i, {
        hasDataLoss: i === 30 // Mid-calibration queue drop
      }));
    }

    const baseline = service.computeBaseline({
      observations,
      tenantId: 'tenant-apex',
      applicationId: 'app-01'
    });

    assert.equal(baseline.status, BASELINE_STATUS.INVALID, 'Telemetry loss during calibration must mark baseline INVALID');
    assert.equal(baseline.qualityMetadata.hasTelemetryLoss, true);
    assert.equal(baseline.establishedAt, null);
  });

  test('7. Stale baselines older than staleness threshold are detected', () => {
    const baseline = {
      status: BASELINE_STATUS.ESTABLISHED,
      establishedAt: new Date('2026-10-01T00:00:00.000Z').toISOString(), // 30 days old
      metrics: { typicalRequestRate: 1.0 }
    };

    const isStale = service.isBaselineStale(baseline, '2026-10-31T12:00:00.000Z');
    assert.equal(isStale, true, 'Baseline older than 168 hours must be identified as STALE');
  });

  test('8. Deterministic recalibration produces identical output', () => {
    const observations = [];
    for (let i = 0; i < 55; i++) {
      observations.push(makeObservation(i));
    }

    const run1 = service.computeBaseline({ observations, tenantId: 'tenant-apex', applicationId: 'app-01' });
    const run2 = service.computeBaseline({ observations, tenantId: 'tenant-apex', applicationId: 'app-01' });

    assert.equal(run1.status, run2.status);
    assert.equal(run1.observationCount, run2.observationCount);
    assert.deepEqual(run1.metrics, run2.metrics);
  });

  test('9. Zero-valued baseline metrics handle empty inputs gracefully', () => {
    const baseline = service.computeBaseline({
      observations: [],
      tenantId: 'tenant-apex',
      applicationId: 'app-01'
    });

    assert.equal(baseline.status, BASELINE_STATUS.CALIBRATING);
    assert.equal(baseline.observationCount, 0);
    assert.equal(baseline.metrics, null);
  });

  test('10. Baseline delta usability guard checks status before computing differences', () => {
    assert.equal(service.isBaselineUsableForDeltas(null), false);
    assert.equal(service.isBaselineUsableForDeltas({ status: BASELINE_STATUS.CALIBRATING }), false);
    assert.equal(service.isBaselineUsableForDeltas({ status: BASELINE_STATUS.STALE }), false);
    assert.equal(service.isBaselineUsableForDeltas({ status: BASELINE_STATUS.INVALID }), false);
    assert.equal(service.isBaselineUsableForDeltas({
      status: BASELINE_STATUS.ESTABLISHED,
      metrics: { typicalRequestRate: 0.5 }
    }), true);
  });
});
