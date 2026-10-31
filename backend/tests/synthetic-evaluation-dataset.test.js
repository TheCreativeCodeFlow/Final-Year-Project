/**
 * Stage 4B: Synthetic Research Evaluation Dataset Test Suite
 *
 * Verifies that all 10 synthetic evaluation scenarios generate valid canonical telemetry
 * and produce distinct, predictable behavioral feature vectors:
 * 1.  Normal Browsing
 * 2.  Repeated Login Failures
 * 3.  Endpoint Enumeration
 * 4.  High-Frequency Burst
 * 5.  Repeated Not Found
 * 6.  Unusual Method Distribution
 * 7.  Slow Irregular Probing
 * 8.  Sudden Behavioral Change
 * 9.  Shared IP with Distinct Sessions
 * 10. Incomplete Telemetry Handling
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { generateSyntheticEvaluationDataset } from '../src/telemetry/synthetic-evaluation-dataset.js';
import { BehavioralFeatureExtractor } from '../src/services/behavioral-feature-extractor.service.js';
import { BehavioralSessionCorrelator } from '../src/services/behavioral-session-correlator.service.js';

describe('Stage 4B: Synthetic Research Evaluation Dataset & Extraction Pipeline', () => {
  const dataset = generateSyntheticEvaluationDataset();
  const extractor = new BehavioralFeatureExtractor();
  const correlator = new BehavioralSessionCorrelator();

  test('1. Dataset produces all 10 distinct scenario specifications with ground-truth separation', () => {
    const keys = Object.keys(dataset);
    assert.equal(keys.length, 10);
    assert.ok(keys.includes('normal_browsing'));
    assert.ok(keys.includes('repeated_login_failures'));
    assert.ok(keys.includes('endpoint_enumeration'));
    assert.ok(keys.includes('high_frequency_burst'));
    assert.ok(keys.includes('repeated_not_found'));
    assert.ok(keys.includes('unusual_method_distribution'));
    assert.ok(keys.includes('slow_irregular_probing'));
    assert.ok(keys.includes('sudden_behavioral_change'));
    assert.ok(keys.includes('shared_ip_distinct_sessions'));
    assert.ok(keys.includes('incomplete_telemetry'));

    for (const [key, scen] of Object.entries(dataset)) {
      assert.ok(scen.scenarioName, `${key} missing scenarioName`);
      assert.ok(scen.groundTruthIntent, `${key} missing groundTruthIntent`);
      assert.ok(Array.isArray(scen.events), `${key} missing events array`);
      assert.ok(scen.events.length > 0, `${key} events must not be empty`);
    }
  });

  test('2. Scenario 1 (Normal Browsing) reflects clean success ratios and multi-endpoint traversal', () => {
    const scen = dataset.normal_browsing;
    const refTime = scen.events[scen.events.length - 1].timestamp;

    const featureSets = extractor.extractFeatures({
      canonicalEvents: scen.events,
      tenantId: 'tenant-apex-9941',
      applicationId: 'app-apex-01',
      sessionRef: 'sess-legit-user-01',
      referenceTimestamp: refTime
    });

    const f15 = featureSets.find((f) => f.windowLabel === '15m').features;
    assert.equal(f15.request_count.value, 30);
    assert.equal(f15.http_4xx_ratio.value, 0.0, 'Normal browsing should have 0% failure ratio');
    assert.ok(f15.unique_endpoint_count.value >= 4, 'Should access multiple endpoints');
  });

  test('3. Scenario 2 (Repeated Login Failures) indicates 100% 4xx ratio and high auth failure count', () => {
    const scen = dataset.repeated_login_failures;
    const refTime = scen.events[scen.events.length - 1].timestamp;

    const featureSets = extractor.extractFeatures({
      canonicalEvents: scen.events,
      tenantId: 'tenant-apex-9941',
      applicationId: 'app-apex-01',
      sessionRef: 'pseudo-sess-login',
      referenceTimestamp: refTime
    });

    const f5m = featureSets.find((f) => f.windowLabel === '5m').features;
    assert.equal(f5m.request_count.value, 15);
    assert.equal(f5m.auth_failure_count.value, 15);
    assert.equal(f5m.http_4xx_ratio.value, 1.0);
    assert.equal(f5m.unique_endpoint_count.value, 1); // Targeted only /api/v1/auth/login
  });

  test('4. Scenario 3 (Endpoint Enumeration) produces high unique endpoint count and enumeration score', () => {
    const scen = dataset.endpoint_enumeration;
    const refTime = scen.events[scen.events.length - 1].timestamp;

    const featureSets = extractor.extractFeatures({
      canonicalEvents: scen.events,
      tenantId: 'tenant-apex-9941',
      applicationId: 'app-apex-01',
      sessionRef: 'pseudo-sess-enum',
      referenceTimestamp: refTime
    });

    const f5m = featureSets.find((f) => f.windowLabel === '5m').features;
    assert.equal(f5m.unique_endpoint_count.value, 25);
    assert.equal(f5m.unusual_route_ratio.value, 1.0);
    assert.equal(f5m.resource_enumeration_score.value, 1.0);
  });

  test('5. Scenario 4 (High-Frequency Burst) exhibits elevated burst frequency in 1-second sub-window', () => {
    const scen = dataset.high_frequency_burst;
    const refTime = scen.events[scen.events.length - 1].timestamp;

    const featureSets = extractor.extractFeatures({
      canonicalEvents: scen.events,
      tenantId: 'tenant-apex-9941',
      applicationId: 'app-apex-01',
      sessionRef: 'sess-burst-scraper',
      referenceTimestamp: refTime
    });

    const f30 = featureSets.find((f) => f.windowLabel === '30s').features;
    assert.equal(f30.request_count.value, 50);
    assert.ok(f30.burst_frequency_max_1s.value >= 25, 'Peak burst must be >= 25 req/s');
  });

  test('6. Scenario 5 (Repeated Not Found) concentrates on a single route with 100% 404s', () => {
    const scen = dataset.repeated_not_found;
    const refTime = scen.events[scen.events.length - 1].timestamp;

    const featureSets = extractor.extractFeatures({
      canonicalEvents: scen.events,
      tenantId: 'tenant-apex-9941',
      applicationId: 'app-apex-01',
      sessionRef: 'sess-broken-client',
      referenceTimestamp: refTime
    });

    const f5m = featureSets.find((f) => f.windowLabel === '5m').features;
    assert.equal(f5m.repeated_not_found_count.value, 20);
    assert.equal(f5m.unique_endpoint_count.value, 1);
    assert.equal(f5m.repeated_endpoint_ratio.value, 1.0);
  });

  test('7. Scenario 6 (Unusual Method Distribution) reflects high proportion of non-GET verbs', () => {
    const scen = dataset.unusual_method_distribution;
    const refTime = scen.events[scen.events.length - 1].timestamp;

    const featureSets = extractor.extractFeatures({
      canonicalEvents: scen.events,
      tenantId: 'tenant-apex-9941',
      applicationId: 'app-apex-01',
      sessionRef: 'sess-method-scanner',
      referenceTimestamp: refTime
    });

    const f5m = featureSets.find((f) => f.windowLabel === '5m').features;
    const methodDist = f5m.http_method_distribution.value;
    assert.ok(methodDist['DELETE'] > 0);
    assert.ok(methodDist['PATCH'] > 0);
    assert.ok(methodDist['HEAD'] > 0);
  });

  test('8. Scenario 9 (Shared IP with Distinct Sessions) correctly correlates 3 separate sessions', () => {
    const scen = dataset.shared_ip_distinct_sessions;
    const correlatedSessions = new Set();

    for (const ev of scen.events) {
      const res = correlator.correlateEvent(ev);
      correlatedSessions.add(res.sessionRef);
    }

    // Must have preserved exactly 3 distinct sessions despite identical source IP
    assert.equal(correlatedSessions.size, 3);
    assert.ok(correlatedSessions.has('user-alpha-session'));
    assert.ok(correlatedSessions.has('user-beta-session'));
    assert.ok(correlatedSessions.has('user-gamma-session'));
  });

  test('9. Scenario 10 (Incomplete Telemetry) processes without throwing and records quality metadata', () => {
    const scen = dataset.incomplete_telemetry;
    const refTime = scen.events[scen.events.length - 1].timestamp;

    const featureSets = extractor.extractFeatures({
      canonicalEvents: scen.events,
      tenantId: 'tenant-apex-9941',
      applicationId: 'app-apex-01',
      sessionRef: 'pseudo-sess-incomplete',
      referenceTimestamp: refTime
    });

    assert.equal(featureSets.length, 3);
    const set5m = featureSets.find((f) => f.windowLabel === '5m');
    assert.ok(set5m.qualityMetadata.featureCompletenessRatio > 0);
    assert.ok(set5m.qualityMetadata.missingFieldTotal > 0);
  });
});
