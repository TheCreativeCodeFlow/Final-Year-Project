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
 * Generates the 20 representative research evaluation scenarios (10 baseline + 10 difficult counterexamples).
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

  // 11. Scenario: Legitimate User with Repeated Failed Login Attempts (Typo then success)
  const legitimateLoginRetryEvents = [];
  let t11 = baseTimeMs;
  // 3 failed password typos (401)
  for (let i = 0; i < 3; i++) {
    t11 += 4000;
    legitimateLoginRetryEvents.push(
      buildEvent({
        timestampMs: t11,
        httpMethod: 'POST',
        normalizedRoute: '/api/v1/auth/login',
        responseStatus: 401,
        sessionReference: null,
        clientIp: '198.51.100.170'
      })
    );
  }
  // User pauses 10 seconds, then logs in successfully with 200 OK
  t11 += 10000;
  legitimateLoginRetryEvents.push(
    buildEvent({
      timestampMs: t11,
      httpMethod: 'POST',
      normalizedRoute: '/api/v1/auth/login',
      responseStatus: 200,
      sessionReference: 'sess-user-typo-auth',
      clientIp: '198.51.100.170'
    })
  );
  // Normal session activity follows
  for (let i = 0; i < 3; i++) {
    t11 += 3000;
    legitimateLoginRetryEvents.push(
      buildEvent({
        timestampMs: t11,
        httpMethod: 'GET',
        normalizedRoute: '/api/v1/user/profile',
        responseStatus: 200,
        sessionReference: 'sess-user-typo-auth',
        clientIp: '198.51.100.170'
      })
    );
  }

  // 12. Scenario: Legitimate High-Frequency API Polling (Single endpoint queried every 1.5s)
  const apiPollingEvents = [];
  let t12 = baseTimeMs;
  for (let i = 0; i < 15; i++) {
    t12 += 1500;
    apiPollingEvents.push(
      buildEvent({
        timestampMs: t12,
        httpMethod: 'GET',
        normalizedRoute: '/api/v1/system/status',
        responseStatus: 200,
        sessionReference: 'sess-dashboard-poller',
        clientIp: '198.51.100.180'
      })
    );
  }

  // 13. Scenario: Legitimate Crawler Traversing Many Endpoints (15 distinct endpoints, 100% 200 OK)
  const crawlerEvents = [];
  let t13 = baseTimeMs;
  const docEndpoints = [
    '/docs/intro', '/docs/getting-started', '/docs/architecture', '/docs/api-reference',
    '/docs/authentication', '/docs/authorization', '/docs/rate-limiting', '/docs/telemetry',
    '/docs/models', '/docs/deployment', '/docs/configuration', '/docs/monitoring',
    '/docs/troubleshooting', '/docs/faq', '/docs/changelog'
  ];
  for (let i = 0; i < docEndpoints.length; i++) {
    t13 += 1200;
    crawlerEvents.push(
      buildEvent({
        timestampMs: t13,
        httpMethod: 'GET',
        normalizedRoute: docEndpoints[i],
        responseStatus: 200,
        sessionReference: 'sess-doc-crawler',
        clientIp: '198.51.100.190'
      })
    );
  }

  // 14. Scenario: Developer Performing Broad Endpoint Exploration (Mostly 200, 1 occasional 404)
  const developerExplorationEvents = [];
  let t14 = baseTimeMs;
  const devEndpoints = [
    { route: '/api/v1/accounts', status: 200 },
    { route: '/api/v1/accounts/:id', status: 200 },
    { route: '/api/v1/orders', status: 200 },
    { route: '/api/v1/orders/:id', status: 200 },
    { route: '/api/v1/analytics', status: 200 },
    { route: '/api/v1/experimental/draft-v2', status: 404 }, // Occasional developer 404
    { route: '/api/v1/webhooks', status: 200 },
    { route: '/api/v1/settings', status: 200 }
  ];
  for (let i = 0; i < devEndpoints.length; i++) {
    t14 += 2500;
    developerExplorationEvents.push(
      buildEvent({
        timestampMs: t14,
        httpMethod: 'GET',
        normalizedRoute: devEndpoints[i].route,
        responseStatus: devEndpoints[i].status,
        sessionReference: 'sess-dev-explorer',
        clientIp: '198.51.100.195'
      })
    );
  }

  // 15. Scenario: Legitimate Repeated 404 Responses (Single missing asset requested 6 times)
  const repeated404AssetEvents = [];
  let t15 = baseTimeMs;
  for (let i = 0; i < 6; i++) {
    t15 += 2000;
    repeated404AssetEvents.push(
      buildEvent({
        timestampMs: t15,
        httpMethod: 'GET',
        normalizedRoute: '/assets/images/missing-logo.png',
        responseStatus: 404,
        sessionReference: 'sess-browser-broken-img',
        clientIp: '198.51.100.205'
      })
    );
  }

  // 16. Scenario: Multiple Users Behind Same NAT with Identical User-Agent (Distinct HMAC sessions)
  const sharedNatIdenticalUaEvents = [];
  let t16 = baseTimeMs;
  const natUsers = ['corporate-user-alice', 'corporate-user-bob'];
  for (let i = 0; i < 20; i++) {
    t16 += 800;
    const user = natUsers[i % natUsers.length];
    sharedNatIdenticalUaEvents.push(
      buildEvent({
        timestampMs: t16,
        httpMethod: 'GET',
        normalizedRoute: `/api/v1/portal/feed`,
        responseStatus: 200,
        sessionReference: `sess-token-${user}`,
        clientIp: '198.51.100.210' // Identical corporate NAT IP
      })
    );
  }

  // 17. Scenario: Legitimate API Pagination (Paging through orders; single normalized route)
  const paginationEvents = [];
  let t17 = baseTimeMs;
  for (let i = 0; i < 12; i++) {
    t17 += 600; // Paging requests every 600ms
    paginationEvents.push(
      buildEvent({
        timestampMs: t17,
        httpMethod: 'GET',
        normalizedRoute: '/api/v1/transactions', // Normalized template preserves route
        responseStatus: 200,
        sessionReference: 'sess-page-reader',
        clientIp: '198.51.100.220'
      })
    );
  }

  // 18. Scenario: Normal Mobile Client Irregular Request Timing (High cellular jitter)
  const mobileJitterEvents = [];
  let t18 = baseTimeMs;
  const jitterIntervals = [120, 4800, 7500, 200, 6100, 350, 8900, 400];
  for (let i = 0; i < jitterIntervals.length; i++) {
    t18 += jitterIntervals[i];
    mobileJitterEvents.push(
      buildEvent({
        timestampMs: t18,
        httpMethod: 'GET',
        normalizedRoute: '/api/v1/mobile/feed',
        responseStatus: 200,
        sessionReference: 'sess-mobile-traveler',
        clientIp: '198.51.100.230'
      })
    );
  }

  // 19. Scenario: Attacker-Like Traffic Mixed with Normal Behavior (Covert attack embedding)
  const mixedAttackerEvents = [];
  let t19 = baseTimeMs;
  // 4 clean requests
  for (let i = 0; i < 4; i++) {
    t19 += 3000;
    mixedAttackerEvents.push(
      buildEvent({
        timestampMs: t19,
        httpMethod: 'GET',
        normalizedRoute: '/api/v1/store/catalog',
        responseStatus: 200,
        sessionReference: 'sess-covert-attacker',
        clientIp: '198.51.100.240'
      })
    );
  }
  // 3 probe requests
  const probeRoutes = ['/etc/passwd', '/.env', '/proc/self/environ'];
  for (let i = 0; i < probeRoutes.length; i++) {
    t19 += 400;
    mixedAttackerEvents.push(
      buildEvent({
        timestampMs: t19,
        httpMethod: 'GET',
        normalizedRoute: probeRoutes[i],
        responseStatus: 403,
        sessionReference: 'sess-covert-attacker',
        clientIp: '198.51.100.240'
      })
    );
  }
  // 3 more clean requests
  for (let i = 0; i < 3; i++) {
    t19 += 3000;
    mixedAttackerEvents.push(
      buildEvent({
        timestampMs: t19,
        httpMethod: 'GET',
        normalizedRoute: '/api/v1/store/catalog',
        responseStatus: 200,
        sessionReference: 'sess-covert-attacker',
        clientIp: '198.51.100.240'
      })
    );
  }

  // 20. Scenario: Telemetry Loss During an Otherwise Normal Session (Buffer drop flag)
  const sessionLossEvents = [];
  let t20 = baseTimeMs;
  for (let i = 0; i < 8; i++) {
    t20 += 2000;
    sessionLossEvents.push(
      buildEvent({
        timestampMs: t20,
        httpMethod: 'GET',
        normalizedRoute: '/api/v1/account/dashboard',
        responseStatus: 200,
        sessionReference: 'sess-degraded-telemetry',
        clientIp: '198.51.100.250',
        persistenceStatus: i === 3 || i === 4 ? 'TELEMETRY_PERSISTENCE_FAILED' : 'TELEMETRY_PERSISTED'
      })
    );
  }

  return {
    normal_browsing: {
      scenarioId: 'scenario-01',
      scenarioName: 'normal_browsing',
      description: 'Human operator navigating customer accounts portal with variable pacing and expected routes.',
      groundTruthIntent: 'BENIGN_AUTHORIZED',
      events: normalBrowsingEvents
    },
    repeated_login_failures: {
      scenarioId: 'scenario-02',
      scenarioName: 'repeated_login_failures',
      description: 'Repeated authentication failures against login endpoint with low interval variance.',
      groundTruthIntent: 'POTENTIAL_CREDENTIAL_STUFFING',
      events: repeatedLoginFailureEvents
    },
    endpoint_enumeration: {
      scenarioId: 'scenario-03',
      scenarioName: 'endpoint_enumeration',
      description: 'Rapid scanning of sensitive and administrative paths returning 404 Not Found.',
      groundTruthIntent: 'RECONNAISSANCE_SCAN',
      events: endpointEnumerationEvents
    },
    high_frequency_burst: {
      scenarioId: 'scenario-04',
      scenarioName: 'high_frequency_burst',
      description: 'High-volume request spike within a 2-second interval.',
      groundTruthIntent: 'SCRAPER_OR_BURST_FLOOD',
      events: burstEvents
    },
    repeated_not_found: {
      scenarioId: 'scenario-05',
      scenarioName: 'repeated_not_found',
      description: 'Persistent repeated access attempts to a single missing endpoint.',
      groundTruthIntent: 'BROKEN_INTEGRATION_OR_PROBE',
      events: repeatedNotFoundEvents
    },
    unusual_method_distribution: {
      scenarioId: 'scenario-06',
      scenarioName: 'unusual_method_distribution',
      description: 'High frequency of DELETE, PATCH, and HEAD verbs on REST endpoints.',
      groundTruthIntent: 'METHOD_TAMPERING_PROBE',
      events: unusualMethodEvents
    },
    slow_irregular_probing: {
      scenarioId: 'scenario-07',
      scenarioName: 'slow_irregular_probing',
      description: 'Covert reconnaissance spaced 60 to 180 seconds apart.',
      groundTruthIntent: 'STEALTH_RECONNAISSANCE',
      events: slowProbingEvents
    },
    sudden_behavioral_change: {
      scenarioId: 'scenario-08',
      scenarioName: 'sudden_behavioral_change',
      description: 'Session begins with benign browsing before abruptly pivoting to aggressive scanning.',
      groundTruthIntent: 'SESSION_HIJACK_OR_PIVOT',
      events: suddenChangeEvents
    },
    shared_ip_distinct_sessions: {
      scenarioId: 'scenario-09',
      scenarioName: 'shared_ip_distinct_sessions',
      description: 'Three distinct client sessions multiplexed behind a single NAT/corporate proxy IP.',
      groundTruthIntent: 'SHARED_NAT_INFRASTRUCTURE',
      events: sharedIpEvents
    },
    incomplete_telemetry: {
      scenarioId: 'scenario-10',
      scenarioName: 'incomplete_telemetry',
      description: 'Telemetry observations with missing optional fields and persistence degradation.',
      groundTruthIntent: 'TELEMETRY_QUALITY_DEGRADATION',
      events: incompleteEvents
    },
    legitimate_repeated_login_failures: {
      scenarioId: 'scenario-11',
      scenarioName: 'legitimate_repeated_login_failures',
      description: 'Legitimate user typo-ing credentials 3 times before successfully logging in.',
      groundTruthIntent: 'BENIGN_USER_TYPO',
      difficultyExplanation: 'Naive brute-force rules trigger on consecutive 401s, misclassifying human memory lapse as credential stuffing.',
      events: legitimateLoginRetryEvents
    },
    legitimate_api_polling: {
      scenarioId: 'scenario-12',
      scenarioName: 'legitimate_api_polling',
      description: 'Automated frontend dashboard periodically polling system health with 0 errors.',
      groundTruthIntent: 'BENIGN_API_POLLING',
      difficultyExplanation: 'High volume and repeated route concentration mimic automated tooling, but enumeration score must stay 0.0.',
      events: apiPollingEvents
    },
    legitimate_crawler_traversal: {
      scenarioId: 'scenario-13',
      scenarioName: 'legitimate_crawler_traversal',
      description: 'Legitimate documentation crawler visiting 15 distinct routes with 100% 200 OK.',
      groundTruthIntent: 'BENIGN_CRAWLER_TRAVERSAL',
      difficultyExplanation: 'High endpoint diversity (1.0) resembles directory scanning, but failure ratios and 404s are zero.',
      events: crawlerEvents
    },
    developer_endpoint_exploration: {
      scenarioId: 'scenario-14',
      scenarioName: 'developer_endpoint_exploration',
      description: 'Developer exploring API endpoints with valid authentication and 1 occasional 404.',
      groundTruthIntent: 'BENIGN_DEVELOPER_EXPLORATION',
      difficultyExplanation: 'Touches multiple routes with a 404 error, but lacks multi-route enumeration breadth.',
      events: developerExplorationEvents
    },
    legitimate_repeated_404_asset: {
      scenarioId: 'scenario-15',
      scenarioName: 'legitimate_repeated_404_asset',
      description: 'Repeated 404 errors caused by a single missing image/asset path in browser.',
      groundTruthIntent: 'BENIGN_MISSING_ASSET_404',
      difficultyExplanation: '100% 404 error ratio, but confined to a single route rather than broad reconnaissance.',
      events: repeated404AssetEvents
    },
    shared_nat_identical_user_agents: {
      scenarioId: 'scenario-16',
      scenarioName: 'shared_nat_identical_user_agents',
      description: 'Multiple corporate users sharing NAT IP and identical Chrome User-Agent with distinct session tokens.',
      groundTruthIntent: 'BENIGN_SHARED_NAT_COLLISION_TEST',
      difficultyExplanation: 'Without HMAC token correlation, network heuristics merge distinct users into a shared profile.',
      events: sharedNatIdenticalUaEvents
    },
    legitimate_api_pagination: {
      scenarioId: 'scenario-17',
      scenarioName: 'legitimate_api_pagination',
      description: 'Rapid client pagination across database records on a single normalized endpoint.',
      groundTruthIntent: 'BENIGN_API_PAGINATION',
      difficultyExplanation: 'High request velocity on a single route could be mistaken for DoS or scraping without normalized template recognition.',
      events: paginationEvents
    },
    mobile_client_irregular_timing: {
      scenarioId: 'scenario-18',
      scenarioName: 'mobile_client_irregular_timing',
      description: 'Mobile user experiencing cellular latency fluctuations with high interval variance.',
      groundTruthIntent: 'BENIGN_MOBILE_NETWORK_JITTER',
      difficultyExplanation: 'High inter-request interval variance resembles artificial jitter evasion techniques.',
      events: mobileJitterEvents
    },
    mixed_attacker_and_normal_traffic: {
      scenarioId: 'scenario-19',
      scenarioName: 'mixed_attacker_and_normal_traffic',
      description: 'Attacker embedding path traversal probes within legitimate catalog browsing.',
      groundTruthIntent: 'MALICIOUS_COVERT_ATTACK_MIXED',
      difficultyExplanation: 'Benign requests dilute the overall failure ratio, making aggregate thresholds ineffective.',
      events: mixedAttackerEvents
    },
    telemetry_loss_during_session: {
      scenarioId: 'scenario-20',
      scenarioName: 'telemetry_loss_during_session',
      description: 'User session where telemetry persistence failed mid-stream due to buffer pressure.',
      groundTruthIntent: 'DEGRADED_TELEMETRY_LOSS',
      difficultyExplanation: 'Loss of observations must be flagged as PARTIAL rather than being falsely presented as inactivity.',
      events: sessionLossEvents
    }
  };
}
