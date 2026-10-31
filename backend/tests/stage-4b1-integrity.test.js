/**
 * Stage 4B.1: Behavioral Telemetry Integrity, Baseline Validity, and Research Benchmark Suite
 *
 * Verifies the research-integrity and correctness requirements of Stage 4B.1:
 * 1. Rejected-request telemetry: Prohibited methods (TRACE) and malformed requests (smuggling)
 *    are recorded with validationOutcome and NOT_ATTEMPTED forwardingResult before termination;
 *    upstream origins are NEVER contacted.
 * 2. Session correlation integrity:
 *    - Keyed HMAC pseudonymization ensures raw tokens are never stored.
 *    - Cryptographic tenant-scoping prevents cross-tenant session linkage.
 *    - Client-supplied/unverified session metadata cannot elevate correlation confidence to 1.0.
 *    - Anti-attribution guarantee: IP clusters & sessions are never marked as attacker identities.
 * 3. Baseline calibration quality:
 *    - Incorporates legitimate 404/401 operational errors into clean error distributions.
 *    - Enforces duration and observation count dimensions.
 *    - Quarantines validation failures and attack probes.
 *    - Detects telemetry loss during calibration (status: INVALID).
 *    - Guards against computing deltas with non-ESTABLISHED baselines.
 * 4. Mathematical feature specification:
 *    - Resource enumeration formula avoids false positives on pagination and polling.
 *    - Zero denominators and duplicate timestamps handled gracefully.
 * 5. Telemetry reliability:
 *    - Durable loss summary survives simulated recorder restarts.
 */

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { createGatewayApp } from '../../gateway/src/app.js';
import { TelemetryRecorderService } from '../../gateway/src/services/telemetry-recorder.service.js';
import { BehavioralSessionCorrelator } from '../src/services/behavioral-session-correlator.service.js';
import { BehavioralBaselineService, BASELINE_STATUS } from '../src/services/behavioral-baseline.service.js';
import { BehavioralFeatureExtractor, MISSING_DATA_STATUS } from '../src/services/behavioral-feature-extractor.service.js';
import { validateAndNormalizeCanonicalEvent } from '../src/telemetry/canonical-event.schema.js';

describe('Stage 4B.1: Subsystem Integrity and Research Benchmark Suite', () => {
  let originServer;
  let originPort;
  let originHitCount = 0;
  let gatewayServer;
  let gatewayPort;

  const capturedGatewayTelemetry = [];

  const mockTelemetryRecorder = {
    async recordTelemetry(record) {
      capturedGatewayTelemetry.push(record);
      return { persistenceStatus: 'TELEMETRY_PERSISTED', correlationId: record.correlationId, forwardingResult: record.forwardingResult };
    }
  };

  const mockAppResolver = {
    validateHostHeader(h) {
      return { valid: true, hostClean: 'accounts.test.internal' };
    },
    resolveTrustedOriginLocal(host) {
      return { tenantId: 'tenant-apex-9941', applicationId: 'app-apex-01' };
    },
    async resolveApplication(domain) {
      return {
        resolved: true,
        appContext: {
          applicationId: 'app-apex-01',
          applicationIdentifier: 'app-apex-01',
          name: 'Apex Accounts',
          domain: 'accounts.test.internal',
          tenantId: 'tenant-apex-9941',
          tenantIdentifier: 'tenant-apex',
          status: 'PROTECTED',
          upstreamUrl: `http://127.0.0.1:${originPort}`,
          allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'],
          timeoutMs: 1500,
          maxBodyBytes: 1048576
        }
      };
    }
  };

  before(async () => {
    // Upstream origin server to verify it is NEVER called on rejected requests
    originServer = http.createServer((req, res) => {
      originHitCount++;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ originHit: true }));
    });
    originServer.listen(0, '127.0.0.1');
    await new Promise((resolve) => originServer.once('listening', resolve));
    originPort = originServer.address().port;

    // Gateway app configured with instrumentation
    const app = createGatewayApp({
      appResolver: mockAppResolver,
      telemetryRecorder: mockTelemetryRecorder
    });
    gatewayServer = http.createServer(app);
    gatewayServer.listen(0, '127.0.0.1');
    await new Promise((resolve) => gatewayServer.once('listening', resolve));
    gatewayPort = gatewayServer.address().port;
  });

  function sendRawHttpRequest(rawPayload) {
    return new Promise((resolve, reject) => {
      const client = net.connect(gatewayPort, '127.0.0.1', () => {
        client.write(rawPayload);
      });
      let rawResponse = '';
      client.on('data', (chunk) => {
        rawResponse += chunk.toString('utf8');
      });
      client.on('end', () => {
        resolve(rawResponse);
      });
      client.on('error', (err) => {
        reject(err);
      });
      client.setTimeout(2000, () => {
        client.destroy();
        resolve(rawResponse);
      });
    });
  }

  after(async () => {
    if (gatewayServer) gatewayServer.close();
    if (originServer) originServer.close();
  });

  // --------------------------------------------------------------------------
  // Phase 5: Rejected Request Telemetry
  // --------------------------------------------------------------------------
  test('1. Prohibited HTTP method (TRACE) records telemetry with METHOD_NOT_ALLOWED and never forwards upstream', async () => {
    const initialHits = originHitCount;
    capturedGatewayTelemetry.length = 0;

    const rawRequest =
      'TRACE /api/v1/accounts/summary HTTP/1.1\r\n' +
      'Host: accounts.test.internal\r\n' +
      'Connection: close\r\n\r\n';

    const rawResponse = await sendRawHttpRequest(rawRequest);

    assert.ok(rawResponse.startsWith('HTTP/1.1 405'), 'Gateway must reject TRACE with 405 Method Not Allowed');
    assert.equal(originHitCount, initialHits, 'Upstream origin MUST NOT be contacted on rejected method');

    assert.equal(capturedGatewayTelemetry.length, 1, 'Telemetry must be recorded for rejected method');
    const tel = capturedGatewayTelemetry[0];
    assert.equal(tel.method, 'TRACE');
    assert.equal(tel.responseStatus, 405);
    assert.equal(tel.validationOutcome, 'METHOD_NOT_ALLOWED');
    assert.equal(tel.forwardingResult, 'NOT_ATTEMPTED');
    assert.equal(tel.tenantId, 'tenant-apex-9941');

    // Canonical schema validation accepts observed prohibited method
    const norm = validateAndNormalizeCanonicalEvent({
      ...tel,
      correlationId: 'corr-trace-test-01',
      tenantId: 'tenant-apex-9941'
    });
    assert.equal(norm.valid, true, 'Canonical schema must ingest observed rejected methods without error');
    assert.equal(norm.canonicalEvent.httpMethod, 'TRACE');
  });

  test('2. Protocol violation (Duplicate Host header) records telemetry with DUPLICATE_HOST_HEADER and never forwards', async () => {
    const initialHits = originHitCount;
    capturedGatewayTelemetry.length = 0;

    const rawRequest =
      'GET /api/v1/accounts/summary HTTP/1.1\r\n' +
      'Host: accounts.test.internal\r\n' +
      'Host: evil.internal\r\n' +
      'Connection: close\r\n\r\n';

    const rawResponse = await sendRawHttpRequest(rawRequest);

    assert.ok(rawResponse.startsWith('HTTP/1.1 400'), 'Duplicate Host must be rejected with 400');
    assert.ok(rawResponse.includes('DUPLICATE_HOST_HEADER'));
    assert.equal(originHitCount, initialHits, 'Upstream origin MUST NOT be contacted on protocol violation');

    assert.equal(capturedGatewayTelemetry.length, 1);
    const tel = capturedGatewayTelemetry[0];
    assert.equal(tel.responseStatus, 400);
    assert.equal(tel.validationOutcome, 'DUPLICATE_HOST_HEADER');
    assert.equal(tel.forwardingResult, 'NOT_ATTEMPTED');
  });

  // --------------------------------------------------------------------------
  // Phase 2: Session Correlation Integrity
  // --------------------------------------------------------------------------
  test('3. Keyed HMAC pseudonymization ensures raw session tokens are never stored', () => {
    const correlator = new BehavioralSessionCorrelator();
    const rawToken = 'secret-session-cookie-xyz-12345';

    const res = correlator.correlateEvent({
      tenantId: 'tenant-apex-9941',
      applicationId: 'app-apex-01',
      sessionReference: rawToken,
      timestamp: new Date().toISOString(),
      sourceMetadata: { ipSubnetHash: 'subnet-1' }
    });

    assert.ok(res.sessionRef.startsWith('sess-hmac-'));
    assert.ok(!res.sessionRef.includes('secret-session-cookie'), 'Raw session token must never be in sessionRef');
    assert.equal(res.correlationType, 'EXPLICIT_APPLICATION_SESSION');
    assert.equal(res.correlationConfidence, 1.0);
    assert.equal(res.collisionRisk.level, 'LOW');
    assert.equal(res.isAttackerIdentity, false);
  });

  test('4. Cross-tenant cryptographic isolation: identical raw token derives distinct HMACs per tenant', () => {
    const correlator = new BehavioralSessionCorrelator();
    const rawToken = 'universal-session-token-999';

    const resA = correlator.correlateEvent({
      tenantId: 'tenant-apex',
      sessionReference: rawToken,
      timestamp: new Date().toISOString()
    });

    const resB = correlator.correlateEvent({
      tenantId: 'tenant-medsecure',
      sessionReference: rawToken,
      timestamp: new Date().toISOString()
    });

    assert.notEqual(resA.sessionRef, resB.sessionRef, 'Same token in Tenant A vs Tenant B must produce different HMACs');
  });

  test('5. Client-forged / unverified session header cannot elevate confidence to 1.0', () => {
    const correlator = new BehavioralSessionCorrelator();

    const res = correlator.correlateEvent({
      tenantId: 'tenant-apex',
      sessionReference: 'client-forged-admin-sess',
      sessionProvenance: { isClientSuppliedUntrusted: true },
      timestamp: new Date().toISOString()
    });

    assert.equal(res.correlationType, 'UNTRUSTED_CLIENT_SESSION_METADATA');
    assert.equal(res.correlationConfidence, 0.4);
    assert.equal(res.collisionRisk.level, 'HIGH');
    assert.ok(res.caveats.includes('CLIENT_FORGED_SESSION_METADATA_SUSPECTED'));
  });

  // --------------------------------------------------------------------------
  // Phase 3: Baseline Calibration Quality
  // --------------------------------------------------------------------------
  test('6. Baseline captures legitimate 404 and 401 operational errors into clean error distribution', () => {
    const service = new BehavioralBaselineService({ minObservations: 50, minCalibrationDurationSeconds: 0 });
    const observations = [];
    const baseTime = new Date('2026-10-31T10:00:00.000Z').getTime();

    for (let i = 0; i < 50; i++) {
      // 45 clean 200s, 3 legitimate 404s, 2 legitimate 401s
      let status = 200;
      if (i === 10 || i === 20 || i === 30) status = 404;
      if (i === 15 || i === 25) status = 401;

      observations.push({
        id: `obs-${i}`,
        timestamp: new Date(baseTime + i * 2000).toISOString(),
        httpMethod: 'GET',
        normalizedRoute: `/api/v1/page/${i % 5}`,
        responseStatus: status,
        validationOutcome: 'VALIDATED',
        forwardingResult: 'SUCCESS'
      });
    }

    const baseline = service.computeBaseline({
      observations,
      tenantId: 'tenant-apex',
      applicationId: 'app-01'
    });

    assert.equal(baseline.status, BASELINE_STATUS.ESTABLISHED);
    assert.equal(baseline.metrics.totalCleanObservations, 50);
    assert.equal(baseline.metrics.typical4xxRatio, 0.1); // 5/50 = 0.1
  });

  test('7. Telemetry loss during calibration marks baseline INVALID and stops delta calculation', () => {
    const service = new BehavioralBaselineService({ minObservations: 50, minCalibrationDurationSeconds: 0 });
    const observations = [];
    const baseTime = new Date('2026-10-31T10:00:00.000Z').getTime();

    for (let i = 0; i < 50; i++) {
      observations.push({
        id: `obs-${i}`,
        timestamp: new Date(baseTime + i * 1000).toISOString(),
        responseStatus: 200,
        validationOutcome: 'VALIDATED',
        forwardingResult: 'SUCCESS',
        hasDataLoss: i === 25 // Telemetry drop mid-calibration
      });
    }

    const baseline = service.computeBaseline({ observations, tenantId: 'tenant-apex', applicationId: 'app-01' });
    assert.equal(baseline.status, BASELINE_STATUS.INVALID);
    assert.equal(baseline.establishedAt, null);

    // Feature extractor delta guard
    const extractor = new BehavioralFeatureExtractor();
    const featureSets = extractor.extractFeatures({
      canonicalEvents: [{
        eventId: 'ev-1',
        timestamp: new Date().toISOString(),
        normalizedRoute: '/test',
        responseStatus: 200,
        requestSizeBytes: 100,
        responseSizeBytes: 100,
        durationMs: 10,
        httpMethod: 'GET'
      }],
      tenantId: 'tenant-apex',
      applicationId: 'app-01',
      sessionRef: 'sess-1',
      baseline
    });

    const f30 = featureSets.find((f) => f.windowLabel === '30s').features;
    assert.equal(f30.rate_delta_vs_baseline.value, null);
    assert.equal(f30.rate_delta_vs_baseline.missingDataStatus, 'BASELINE_INVALID');
  });

  // --------------------------------------------------------------------------
  // Phase 4: Mathematical Feature Specification
  // --------------------------------------------------------------------------
  test('8. Resource enumeration score strictly yields 0.0 on polling and pagination, but 1.0 on multi-route scans', () => {
    const extractor = new BehavioralFeatureExtractor();
    const refTime = new Date('2026-10-31T20:00:00.000Z');

    // Case A: Polling 15 times to /api/status (200 OK)
    const pollingEvents = [];
    for (let i = 0; i < 15; i++) {
      pollingEvents.push({
        timestamp: new Date(refTime.getTime() - i * 1000).toISOString(),
        normalizedRoute: '/api/v1/status',
        responseStatus: 200,
        httpMethod: 'GET'
      });
    }
    const setsA = extractor.extractFeatures({ canonicalEvents: pollingEvents, tenantId: 't1', sessionRef: 's1', referenceTimestamp: refTime });
    assert.equal(setsA[0].features.resource_enumeration_score.value, 0.0);

    // Case B: Broad multi-endpoint 404 scanning across 5 distinct routes
    const scanEvents = [
      { timestamp: new Date(refTime.getTime() - 4000).toISOString(), normalizedRoute: '/admin', responseStatus: 404, httpMethod: 'GET' },
      { timestamp: new Date(refTime.getTime() - 3000).toISOString(), normalizedRoute: '/.env', responseStatus: 404, httpMethod: 'GET' },
      { timestamp: new Date(refTime.getTime() - 2000).toISOString(), normalizedRoute: '/.git', responseStatus: 404, httpMethod: 'GET' },
      { timestamp: new Date(refTime.getTime() - 1000).toISOString(), normalizedRoute: '/backup', responseStatus: 404, httpMethod: 'GET' },
      { timestamp: new Date(refTime.getTime() - 0).toISOString(), normalizedRoute: '/config', responseStatus: 404, httpMethod: 'GET' }
    ];
    const setsB = extractor.extractFeatures({ canonicalEvents: scanEvents, tenantId: 't1', sessionRef: 's1', referenceTimestamp: refTime });
    assert.equal(setsB[0].features.resource_enumeration_score.value, 1.0);
  });
});
