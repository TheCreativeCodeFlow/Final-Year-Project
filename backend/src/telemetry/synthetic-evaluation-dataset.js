/**
 * Synthetic Research Evaluation Dataset Generator (Stage 4B)
 *
 * Generates reproducible, realistic behavioral telemetry scenarios for
 * validating normalization, session correlation, and feature extraction:
 *
 * Scenarios:
 * 1.  normal_browsing: Steady pacing, legitimate endpoints, 200 OKs, human jitter.
 * 2.  repeated_login_failures: Rapid repeated authentication failures (401s), low interval variance.
 * 3.  endpoint_enumeration: Rapid directory traversal and spidering across nonexistent routes (404s).
 * 4.  high_frequency_burst: High-volume request spike within 2 seconds.
 * 5.  repeated_not_found: Persistent probing of a single non-existent resource.
 * 6.  unusual_method_distribution: Skewed HTTP verb distribution (DELETE, PATCH, HEAD).
 * 7.  slow_irregular_probing: Low-and-slow reconnaissance with wide intervals.
 * 8.  sudden_behavioral_change: Benign normal browsing that suddenly pivots into aggressive scanning.
 * 9.  shared_ip_distinct_sessions: Multiple distinct sessions originating from a single NAT/proxy IP.
 * 10. incomplete_telemetry: Telemetry records with missing optional fields, testing pipeline robustness.
 *
 * Note: Ground-truth scenario labels are kept strictly separate from observable facts.
 */

import crypto from 'node:crypto';
import { validateAndNormalizeCanonicalEvent } from './canonical-event.schema.js';

/**
 * Generates the 10 representative research evaluation scenarios.
 *
 * @param {object} [options]
 * @param {string} [options.tenantId='tenant-apex-9941']
 * @param {string} [options.applicationId='app-apex-01']
 * @param {string} [options.baseTimestamp='2026-10-31T20:00:00.000Z']
 * @returns {Record<string, { scenarioName: string, description: string, groundTruthIntent: string, events: Array<object> }>}
 */
export function generateSyntheticEvaluationDataset(options = {}) {
  const tenantId = options.tenantId || 'tenant-apex-9941';
  const applicationId = options.applicationId || 'app-apex-01';
  const baseTimeMs = new Date(options.baseTimestamp || '2026-10-31T20:00:00.000Z').getTime();

  function buildEvent(overrides = {}) {
    const raw = {
      schemaVersion: '1.0.0',
      eventId: crypto.randomUUID(),
      correlationId: overrides.correlationId || crypto.randomUUID(),
      tenantId,
      applicationId,
      timestamp: new Date(overrides.timestampMs || baseTimeMs).toISOString(),
      httpMethod: overrides.httpMethod || 'GET',
      normalizedRoute: overrides.normalizedRoute || '/api/v1/accounts/summary',
      responseStatus: overrides.responseStatus ?? 200,
      requestSizeBytes: overrides.requestSizeBytes ?? 256,
      responseSizeBytes: overrides.responseSizeBytes ?? 1024,
      durationMs: overrides.durationMs ?? 45.2,
      forwardingResult: overrides.forwardingResult || 'SUCCESS',
      validationOutcome: overrides.validationOutcome || 'VALIDATED',
      sessionReference: overrides.sessionReference !== undefined ? overrides.sessionReference : null,
      clientIp: overrides.clientIp || '198.51.100.42',
      persistenceStatus: overrides.persistenceStatus || 'TELEMETRY_PERSISTED'
    };

    const res = validateAndNormalizeCanonicalEvent(raw);
    if (!res.valid) {
      throw new Error(`Synthetic event failed validation: ${res.errors.join(', ')}`);
    }
    return res.canonicalEvent;
  }

  // 1. Scenario: Normal Browsing (30 requests over 5 minutes with human jitter)
  const normalBrowsingEvents = [];
  let t1 = baseTimeMs;
  const normalRoutes = [
    '/api/v1/accounts/summary',
    '/api/v1/accounts/:id',
    '/api/v1/transactions/recent',
    '/api/v1/profile',
    '/api/v1/notifications'
  ];
  for (let i = 0; i < 30; i++) {
    t1 += 3000 + Math.floor(Math.sin(i) * 2000) + 1000; // Human intervals between 2s and 6s
    normalBrowsingEvents.push(
      buildEvent({
        timestampMs: t1,
        httpMethod: i % 7 === 0 ? 'POST' : 'GET',
        normalizedRoute: normalRoutes[i % normalRoutes.length],
        responseStatus: 200,
        sessionReference: 'sess-legit-user-01',
        clientIp: '198.51.100.10'
      })
    );
  }

  // 2. Scenario: Repeated Login Failures (15 rapid 401s in 45s)
  const repeatedLoginFailureEvents = [];
  let t2 = baseTimeMs;
  for (let i = 0; i < 15; i++) {
    t2 += 2500; // Fixed 2.5s pacing
    repeatedLoginFailureEvents.push(
      buildEvent({
        timestampMs: t2,
        httpMethod: 'POST',
        normalizedRoute: '/api/v1/auth/login',
        responseStatus: 401,
        requestSizeBytes: 412,
        responseSizeBytes: 128,
        sessionReference: null,
        clientIp: '198.51.100.88'
      })
    );
  }

  // 3. Scenario: Endpoint Enumeration (25 rapid 404s across distinct administrative/secret paths)
  const endpointEnumerationEvents = [];
  let t3 = baseTimeMs;
  const enumPaths = [
    '/admin', '/admin/login', '/.env', '/.git/HEAD', '/config.json',
    '/wp-admin', '/phpmyadmin', '/api/v1/debug', '/actuator/health',
    '/backup.sql', '/server-status', '/api/v2/private', '/swagger.json',
    '/internal/metrics', '/console', '/database.yml', '/secrets',
    '/v1/tokens', '/auth/master', '/cgi-bin/test', '/root',
    '/api/v1/test-bypass', '/debug/pprof', '/manage/env', '/api/v1/keys'
  ];
  for (let i = 0; i < enumPaths.length; i++) {
    t3 += 400; // 400ms rapid spacing
    endpointEnumerationEvents.push(
      buildEvent({
        timestampMs: t3,
        httpMethod: 'GET',
        normalizedRoute: enumPaths[i],
        responseStatus: 404,
        sessionReference: null,
        clientIp: '198.51.100.99'
      })
    );
  }

  // 4. Scenario: High-Frequency Request Burst (50 requests in 2 seconds)
  const burstEvents = [];
  let t4 = baseTimeMs;
  for (let i = 0; i < 50; i++) {
    t4 += 35; // 35ms delta
    burstEvents.push(
      buildEvent({
        timestampMs: t4,
        httpMethod: 'GET',
        normalizedRoute: '/api/v1/accounts/summary',
        responseStatus: 200,
        sessionReference: 'sess-burst-scraper',
        clientIp: '198.51.100.120'
      })
    );
  }

  // 5. Scenario: Repeated Access to Nonexistent Resources (20 requests hitting identical 404 route)
  const repeatedNotFoundEvents = [];
  let t5 = baseTimeMs;
  for (let i = 0; i < 20; i++) {
    t5 += 1500;
    repeatedNotFoundEvents.push(
      buildEvent({
        timestampMs: t5,
        httpMethod: 'GET',
        normalizedRoute: '/api/v1/legacy/export-dead-link',
        responseStatus: 404,
        sessionReference: 'sess-broken-client',
        clientIp: '198.51.100.130'
      })
    );
  }

  // 6. Scenario: Unusual HTTP Method Distribution (Excessive DELETE, PATCH, HEAD verbs)
  const unusualMethodEvents = [];
  let t6 = baseTimeMs;
  const methods = ['DELETE', 'PATCH', 'HEAD', 'DELETE', 'OPTIONS', 'DELETE', 'PUT', 'HEAD'];
  for (let i = 0; i < 24; i++) {
    t6 += 2000;
    unusualMethodEvents.push(
      buildEvent({
        timestampMs: t6,
        httpMethod: methods[i % methods.length],
        normalizedRoute: '/api/v1/accounts/:id',
        responseStatus: i % 3 === 0 ? 405 : 200,
        sessionReference: 'sess-method-scanner',
        clientIp: '198.51.100.140'
      })
    );
  }

  // 7. Scenario: Slow and Irregular Probing (Low & slow reconnaissance; 60s to 120s intervals)
  const slowProbingEvents = [];
  let t7 = baseTimeMs;
  for (let i = 0; i < 10; i++) {
    t7 += 60000 + (i * 12000); // 60s to 180s pacing
    slowProbingEvents.push(
      buildEvent({
        timestampMs: t7,
        httpMethod: 'GET',
        normalizedRoute: `/api/v1/stealth/probe-${i}`,
        responseStatus: 200,
        sessionReference: 'sess-slowloris-probe',
        clientIp: '198.51.100.150'
      })
    );
  }

  // 8. Scenario: Sudden Behavioral Change (Normal browsing transitioning into sudden enumeration)
  const suddenChangeEvents = [];
  let t8 = baseTimeMs;
  // Part A: Calm normal browsing (10 requests)
  for (let i = 0; i < 10; i++) {
    t8 += 4000;
    suddenChangeEvents.push(
      buildEvent({
        timestampMs: t8,
        httpMethod: 'GET',
        normalizedRoute: '/api/v1/accounts/summary',
        responseStatus: 200,
        sessionReference: 'sess-compromised-account',
        clientIp: '198.51.100.160'
      })
    );
  }
  // Part B: Sudden pivot into rapid scanning (15 requests)
  for (let i = 0; i < 15; i++) {
    t8 += 300;
    suddenChangeEvents.push(
      buildEvent({
        timestampMs: t8,
        httpMethod: 'GET',
        normalizedRoute: `/internal/admin/secrets/${i}`,
        responseStatus: 403,
        sessionReference: 'sess-compromised-account',
        clientIp: '198.51.100.160'
      })
    );
  }

  // 9. Scenario: Shared IP with Distinct Sessions (NAT / Proxy with distinct legitimate sessions)
  const sharedIpEvents = [];
  let t9 = baseTimeMs;
  const sessionIds = ['user-alpha-session', 'user-beta-session', 'user-gamma-session'];
  for (let i = 0; i < 30; i++) {
    t9 += 1000;
    const sessionRef = sessionIds[i % sessionIds.length];
    sharedIpEvents.push(
      buildEvent({
        timestampMs: t9,
        httpMethod: 'GET',
        normalizedRoute: `/api/v1/user/dashboard`,
        responseStatus: 200,
        sessionReference: sessionRef,
        clientIp: '203.0.113.50' // Identical public NAT egress IP
      })
    );
  }

  // 10. Scenario: Missing and Incomplete Telemetry (Events with missing optional fields)
  const incompleteEvents = [];
  let t10 = baseTimeMs;
  for (let i = 0; i < 12; i++) {
    t10 += 2000;
    incompleteEvents.push(
      buildEvent({
        timestampMs: t10,
        httpMethod: 'GET',
        normalizedRoute: '/api/v1/telemetry/incomplete',
        responseStatus: 200,
        requestSizeBytes: 0,
        responseSizeBytes: 0,
        durationMs: 0,
        sessionReference: null,
        clientIp: '127.0.0.1',
        persistenceStatus: i % 2 === 0 ? 'TELEMETRY_PENDING' : 'TELEMETRY_PERSISTENCE_FAILED'
      })
    );
  }

  return {
    normal_browsing: {
      scenarioName: 'normal_browsing',
      description: 'Human operator navigating customer accounts portal with variable pacing and expected routes.',
      groundTruthIntent: 'BENIGN_AUTHORIZED',
      events: normalBrowsingEvents
    },
    repeated_login_failures: {
      scenarioName: 'repeated_login_failures',
      description: 'Repeated authentication failures against login endpoint with low interval variance.',
      groundTruthIntent: 'POTENTIAL_CREDENTIAL_STUFFING',
      events: repeatedLoginFailureEvents
    },
    endpoint_enumeration: {
      scenarioName: 'endpoint_enumeration',
      description: 'Rapid scanning of sensitive and administrative paths returning 404 Not Found.',
      groundTruthIntent: 'RECONNAISSANCE_SCAN',
      events: endpointEnumerationEvents
    },
    high_frequency_burst: {
      scenarioName: 'high_frequency_burst',
      description: 'High-volume request spike within a 2-second interval.',
      groundTruthIntent: 'SCRAPER_OR_BURST_FLOOD',
      events: burstEvents
    },
    repeated_not_found: {
      scenarioName: 'repeated_not_found',
      description: 'Persistent repeated access attempts to a single missing endpoint.',
      groundTruthIntent: 'BROKEN_INTEGRATION_OR_PROBE',
      events: repeatedNotFoundEvents
    },
    unusual_method_distribution: {
      scenarioName: 'unusual_method_distribution',
      description: 'High frequency of DELETE, PATCH, and HEAD verbs on REST endpoints.',
      groundTruthIntent: 'METHOD_TAMPERING_PROBE',
      events: unusualMethodEvents
    },
    slow_irregular_probing: {
      scenarioName: 'slow_irregular_probing',
      description: 'Covert reconnaissance spaced 60 to 180 seconds apart.',
      groundTruthIntent: 'STEALTH_RECONNAISSANCE',
      events: slowProbingEvents
    },
    sudden_behavioral_change: {
      scenarioName: 'sudden_behavioral_change',
      description: 'Session begins with benign browsing before abruptly pivoting to aggressive scanning.',
      groundTruthIntent: 'SESSION_HIJACK_OR_PIVOT',
      events: suddenChangeEvents
    },
    shared_ip_distinct_sessions: {
      scenarioName: 'shared_ip_distinct_sessions',
      description: 'Three distinct client sessions multiplexed behind a single NAT/corporate proxy IP.',
      groundTruthIntent: 'SHARED_NAT_INFRASTRUCTURE',
      events: sharedIpEvents
    },
    incomplete_telemetry: {
      scenarioName: 'incomplete_telemetry',
      description: 'Telemetry observations with missing optional fields and persistence degradation.',
      groundTruthIntent: 'TELEMETRY_QUALITY_DEGRADATION',
      events: incompleteEvents
    }
  };
}
