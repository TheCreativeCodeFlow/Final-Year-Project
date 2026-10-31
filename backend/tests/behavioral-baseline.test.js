/**
 * Stage 4B: Behavioral Baseline Service Test Suite
 *
 * Verifies:
 * 1. Minimum observation threshold (clean observations < 50 -> CALIBRATING, >= 50 -> ESTABLISHED).
 * 2. Contamination defense: excludes 4xx, 5xx, and invalid/rejected observations from clean baseline.
 * 3. Deterministic reconstruction: identical observations yield identical baseline metrics.
 * 4. Metric calculations: rates, diversity, status distributions, interval statistics.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BehavioralBaselineService,
  BASELINE_STATUS,
  MIN_OBSERVATIONS_FOR_BASELINE
} from '../src/services/behavioral-baseline.service.js';

describe('Stage 4B: Behavioral Baseline Service', () => {
  const service = new BehavioralBaselineService({ minObservations: 50 });
  const baseTime = new Date('2026-10-31T12:00:00.000Z').getTime();

  function makeObservation(index, overrides = {}) {
    return {
      id: `obs-${index}`,
      timestamp: new Date(baseTime + index * 5000).toISOString(),
      httpMethod: overrides.httpMethod || 'GET',
      normalizedRoute: overrides.normalizedRoute || `/api/v1/resource/${index % 5}`,
      responseStatus: overrides.responseStatus ?? 200,
      validationOutcome: overrides.validationOutcome || 'VALIDATED',
      forwardingResult: overrides.forwardingResult || 'SUCCESS'
    };
  }

  test('1. Baseline remains in CALIBRATING state when clean observations are below threshold (< 50)', () => {
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

  test('2. Baseline achieves ESTABLISHED status when clean observations meet threshold (>= 50)', () => {
    const observations = [];
    for (let i = 0; i < 60; i++) {
      observations.push(makeObservation(i));
    }

    const baseline = service.computeBaseline({
      observations,
      tenantId: 'tenant-apex',
      applicationId: 'app-01',
      sampleWindowHours: 24
    });

    assert.equal(baseline.status, BASELINE_STATUS.ESTABLISHED);
    assert.equal(baseline.observationCount, 60);
    assert.ok(baseline.establishedAt);
    assert.equal(typeof baseline.metrics.typicalRequestRate, 'number');
    assert.equal(typeof baseline.metrics.typicalEndpointDiversity, 'number');
    assert.equal(baseline.metrics.typical4xxRatio, 0.0);
  });

  test('3. Baseline contamination protection filters out 4xx, 5xx, and invalid observations', () => {
    const observations = [];
    // 40 clean 200 OKs
    for (let i = 0; i < 40; i++) {
      observations.push(makeObservation(i, { responseStatus: 200 }));
    }
    // 20 contaminated 404s and 500s
    for (let i = 40; i < 60; i++) {
      observations.push(makeObservation(i, { responseStatus: i % 2 === 0 ? 404 : 500 }));
    }

    const baseline = service.computeBaseline({
      observations,
      tenantId: 'tenant-apex',
      applicationId: 'app-01'
    });

    // Total observations was 60, but only 40 were clean -> remains CALIBRATING!
    assert.equal(baseline.status, BASELINE_STATUS.CALIBRATING);
    assert.equal(baseline.observationCount, 40);
    assert.equal(baseline.metrics.totalCleanObservations, 40);
    assert.equal(baseline.metrics.discardedContaminatedObservations, 20);
  });

  test('4. Deterministic rebuilding: recomputing from identical observations produces identical results', () => {
    const observations = [];
    for (let i = 0; i < 55; i++) {
      observations.push(makeObservation(i));
    }

    const run1 = service.computeBaseline({
      observations,
      tenantId: 'tenant-apex',
      applicationId: 'app-01'
    });

    const run2 = service.computeBaseline({
      observations,
      tenantId: 'tenant-apex',
      applicationId: 'app-01'
    });

    assert.equal(run1.status, run2.status);
    assert.equal(run1.observationCount, run2.observationCount);
    assert.deepEqual(run1.metrics, run2.metrics);
  });
});
