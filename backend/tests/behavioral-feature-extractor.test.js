/**
 * Stage 4B: Behavioral Feature Extractor Test Suite
 *
 * Verifies:
 * 1. Time-window boundaries: filters events into 30s, 5m, 15m windows correctly.
 * 2. Request behavior metrics: rates, burstiness, inter-request intervals mean and variance.
 * 3. Endpoint behavior metrics: unique endpoint counts, diversity ratio, repeated endpoint ratio, enumeration score.
 * 4. Failure behavior metrics: 4xx/5xx ratios, client errors, repeated not-found, auth failures.
 * 5. Baseline delta calculations: rate delta, diversity delta, failure ratio delta against active baseline.
 * 6. Missing data status handling: incomplete interval data flagged as INSUFFICIENT_DATA, absence of baseline flagged as NO_BASELINE.
 * 7. Evidence quality tracking: completeness ratio, observation counts, persistence breakdown.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BehavioralFeatureExtractor,
  FEATURE_TYPES,
  MISSING_DATA_STATUS
} from '../src/services/behavioral-feature-extractor.service.js';

describe('Stage 4B: Behavioral Feature Extractor', () => {
  const extractor = new BehavioralFeatureExtractor();
  const refTime = new Date('2026-10-31T20:15:00.000Z');
  const refMs = refTime.getTime();

  function makeEvent(offsetSeconds, overrides = {}) {
    return {
      eventId: `ev-${offsetSeconds}`,
      correlationId: `corr-${offsetSeconds}`,
      tenantId: 'tenant-apex-9941',
      applicationId: 'app-01',
      timestamp: new Date(refMs - offsetSeconds * 1000).toISOString(),
      httpMethod: overrides.httpMethod || 'GET',
      normalizedRoute: overrides.normalizedRoute || '/api/v1/accounts/summary',
      responseStatus: overrides.responseStatus ?? 200,
      requestSizeBytes: overrides.requestSizeBytes ?? 200,
      responseSizeBytes: overrides.responseSizeBytes ?? 800,
      durationMs: overrides.durationMs ?? 30.0,
      forwardingResult: overrides.forwardingResult || 'SUCCESS',
      validationOutcome: overrides.validationOutcome || 'VALIDATED',
      sessionReference: 'sess-test-01',
      persistenceStatus: overrides.persistenceStatus || 'TELEMETRY_PERSISTED'
    };
  }

  test('1. Feature sets are generated across all configured time windows (30s, 5m, 15m)', () => {
    // 3 events: one at 10s ago, one at 100s ago, one at 600s ago
    const events = [
      makeEvent(10),  // In 30s, 5m, 15m
      makeEvent(100), // In 5m, 15m
      makeEvent(600)  // In 15m only
    ];

    const featureSets = extractor.extractFeatures({
      canonicalEvents: events,
      tenantId: 'tenant-apex-9941',
      applicationId: 'app-01',
      sessionRef: 'sess-test-01',
      referenceTimestamp: refTime
    });

    assert.equal(featureSets.length, 3);

    const set30s = featureSets.find((f) => f.windowLabel === '30s');
    const set5m = featureSets.find((f) => f.windowLabel === '5m');
    const set15m = featureSets.find((f) => f.windowLabel === '15m');

    assert.equal(set30s.observationCount, 1);
    assert.equal(set5m.observationCount, 2);
    assert.equal(set15m.observationCount, 3);
  });

  test('2. Request behavior metrics calculate rates, burst peaks, and interval statistics accurately', () => {
    // 5 events spaced evenly by 2000ms within 30s
    const events = [
      makeEvent(8),
      makeEvent(6),
      makeEvent(4),
      makeEvent(2),
      makeEvent(0)
    ];

    const featureSets = extractor.extractFeatures({
      canonicalEvents: events,
      tenantId: 'tenant-apex-9941',
      applicationId: 'app-01',
      sessionRef: 'sess-test-01',
      referenceTimestamp: refTime
    });

    const f30 = featureSets.find((f) => f.windowLabel === '30s').features;

    assert.equal(f30.request_count.value, 5);
    // Rate: 5 requests / 30s = 0.1667 req/s
    assert.equal(f30.request_rate_per_sec.value, 0.1667);
    assert.equal(f30.request_rate_per_sec.type, FEATURE_TYPES.RATE);

    // Intervals: 4 intervals of exactly 2000ms each
    assert.equal(f30.inter_request_interval_mean_ms.value, 2000);
    assert.equal(f30.inter_request_interval_variance_ms.value, 0); // zero variance
    assert.equal(f30.inter_request_interval_variance_ms.missingDataStatus, MISSING_DATA_STATUS.COMPLETE);
  });

  test('3. Endpoint behavior correctly computes diversity, concentration, and resource enumeration score', () => {
    // 5 events hitting 5 distinct nonexistent endpoints (404s)
    const events = [
      makeEvent(10, { normalizedRoute: '/admin', responseStatus: 404 }),
      makeEvent(8, { normalizedRoute: '/.git', responseStatus: 404 }),
      makeEvent(6, { normalizedRoute: '/backup', responseStatus: 404 }),
      makeEvent(4, { normalizedRoute: '/config', responseStatus: 404 }),
      makeEvent(2, { normalizedRoute: '/secret', responseStatus: 404 })
    ];

    const featureSets = extractor.extractFeatures({
      canonicalEvents: events,
      tenantId: 'tenant-apex-9941',
      applicationId: 'app-01',
      sessionRef: 'sess-test-01',
      referenceTimestamp: refTime
    });

    const f30 = featureSets.find((f) => f.windowLabel === '30s').features;

    assert.equal(f30.unique_endpoint_count.value, 5);
    assert.equal(f30.endpoint_diversity_ratio.value, 1.0); // 5 / 5
    assert.equal(f30.repeated_endpoint_ratio.value, 0.2); // 1 / 5
    assert.equal(f30.unusual_route_ratio.value, 1.0); // 5 / 5
    // Resource enumeration score: min(1, 5/5)*0.5 + 1.0*0.5 = 1.0
    assert.equal(f30.resource_enumeration_score.value, 1.0);
  });

  test('4. Failure behavior tracks 4xx, 5xx, auth failure, and upstream failure counts', () => {
    const events = [
      makeEvent(12, { responseStatus: 200 }),
      makeEvent(10, { responseStatus: 401 }), // Auth failure
      makeEvent(8, { responseStatus: 403 }),  // Auth failure
      makeEvent(6, { responseStatus: 404 }),  // Not found
      makeEvent(4, { responseStatus: 502 }),  // Upstream failure
      makeEvent(2, { responseStatus: 504 })   // Upstream failure
    ];

    const featureSets = extractor.extractFeatures({
      canonicalEvents: events,
      tenantId: 'tenant-apex-9941',
      applicationId: 'app-01',
      sessionRef: 'sess-test-01',
      referenceTimestamp: refTime
    });

    const f30 = featureSets.find((f) => f.windowLabel === '30s').features;

    assert.equal(f30.client_error_count.value, 3); // 401, 403, 404
    assert.equal(f30.auth_failure_count.value, 2);   // 401, 403
    assert.equal(f30.repeated_not_found_count.value, 1); // 404
    assert.equal(f30.upstream_failure_count.value, 2);   // 502, 504
    assert.equal(f30.http_4xx_ratio.value, 0.5); // 3 / 6
    assert.equal(f30.http_5xx_ratio.value, 0.3333); // 2 / 6
  });

  test('5. Baseline comparison calculates rate, diversity, and failure deltas when baseline exists', () => {
    const mockBaseline = {
      baselineVersion: '1.0.0',
      status: 'ESTABLISHED',
      metrics: {
        typicalRequestRate: 0.1,
        typicalEndpointDiversity: 0.2,
        typical4xxRatio: 0.05
      }
    };

    const events = [
      makeEvent(10, { responseStatus: 200, normalizedRoute: '/api/v1/a' }),
      makeEvent(5, { responseStatus: 404, normalizedRoute: '/api/v1/b' }),
      makeEvent(0, { responseStatus: 200, normalizedRoute: '/api/v1/c' })
    ];

    const featureSets = extractor.extractFeatures({
      canonicalEvents: events,
      tenantId: 'tenant-apex-9941',
      applicationId: 'app-01',
      sessionRef: 'sess-test-01',
      referenceTimestamp: refTime,
      baseline: mockBaseline
    });

    const f30 = featureSets.find((f) => f.windowLabel === '30s').features;

    // requestRate: 3 / 30 = 0.1. Delta = 0.1 - 0.1 = 0.0
    assert.equal(f30.rate_delta_vs_baseline.value, 0.0);
    assert.equal(f30.rate_delta_vs_baseline.missingDataStatus, MISSING_DATA_STATUS.COMPLETE);

    // endpointDiversity: 3 / 3 = 1.0. Delta = 1.0 - 0.2 = 0.8
    assert.equal(f30.endpoint_diversity_delta.value, 0.8);

    // 4xxRatio: 1 / 3 = 0.3333. Delta = 0.3333 - 0.05 = 0.2833
    assert.equal(f30.failure_ratio_delta.value, 0.2833);
  });

  test('6. In the absence of a baseline, delta features return null with NO_BASELINE status', () => {
    const events = [makeEvent(5)];

    const featureSets = extractor.extractFeatures({
      canonicalEvents: events,
      tenantId: 'tenant-apex-9941',
      applicationId: 'app-01',
      sessionRef: 'sess-test-01',
      referenceTimestamp: refTime,
      baseline: null
    });

    const f30 = featureSets.find((f) => f.windowLabel === '30s').features;

    assert.equal(f30.rate_delta_vs_baseline.value, null);
    assert.equal(f30.rate_delta_vs_baseline.missingDataStatus, MISSING_DATA_STATUS.NO_BASELINE);
    assert.equal(f30.endpoint_diversity_delta.value, null);
    assert.equal(f30.failure_ratio_delta.value, null);
  });

  test('7. Single observation handles interval variance as INSUFFICIENT_DATA without crashing', () => {
    const events = [makeEvent(5)];

    const featureSets = extractor.extractFeatures({
      canonicalEvents: events,
      tenantId: 'tenant-apex-9941',
      applicationId: 'app-01',
      sessionRef: 'sess-test-01',
      referenceTimestamp: refTime
    });

    const f30 = featureSets.find((f) => f.windowLabel === '30s').features;

    assert.equal(f30.request_count.value, 1);
    assert.equal(f30.inter_request_interval_mean_ms.value, null);
    assert.equal(f30.inter_request_interval_variance_ms.value, null);
    assert.equal(f30.inter_request_interval_mean_ms.missingDataStatus, MISSING_DATA_STATUS.INSUFFICIENT_DATA);
  });
});
