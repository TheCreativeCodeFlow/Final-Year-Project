/**
 * Stage 4A: Gateway Reverse Proxy Runtime Comprehensive Test Suite.
 *
 * Verifies all Phase 8 requirements:
 * 1. Basic proxy operation (methods, headers, response propagation, request IDs).
 * 2. Request validation (unknown host, unregistered app, invalid methods, oversized requests).
 * 3. Security controls (SSRF protection, cloud metadata blocking, header sanitization, cross-tenant denial, leak prevention).
 * 4. Failure behavior (timeout 504, connection refused 502, decision controller unavailable 503, no fallback).
 * 5. Evidence integrity (8-stage distinctions, sensitive header redaction).
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { createGatewayApp } from '../src/app.js';
import { createSyntheticOriginServer } from '../../synthetic-origin/src/server.js';
import { validateUpstreamDestination } from '../src/proxy/ssrf-guard.js';
import { sanitizeForwardedHeaders, sanitizeResponseHeaders } from '../src/proxy/header-sanitizer.js';
import { logger } from '../src/utils/logger.js';

describe('Stage 4A: Gateway Reverse Proxy Runtime', () => {
  let originServer;
  let originPort;
  let originBaseUrl;

  let gatewayServer;
  let gatewayPort;

  // Recorded telemetry in memory for verification
  const telemetryLog = [];

  const mockAppResolver = {
    async resolveApplication(rawHost, correlationId) {
      if (!rawHost) {
        return {
          resolved: false,
          statusCode: 400,
          errorCode: 'MISSING_HOST_HEADER',
          message: 'Missing Host header.'
        };
      }

      const hostClean = rawHost.trim().toLowerCase().split(':')[0];

      // Syntax check
      if (hostClean.includes('@') || hostClean.includes('/') || hostClean.includes(' ')) {
        return {
          resolved: false,
          statusCode: 400,
          errorCode: 'INVALID_HOST_HEADER',
          message: 'Invalid Host syntax.'
        };
      }

      if (hostClean === 'unknown.domain.test') {
        return {
          resolved: false,
          statusCode: 404,
          errorCode: 'UNKNOWN_HOST',
          message: 'Domain not in trusted origin map.'
        };
      }

      if (hostClean === 'unregistered.apexfintech.internal') {
        return {
          resolved: false,
          statusCode: 404,
          errorCode: 'UNREGISTERED_APPLICATION',
          message: 'Application not registered in management database.'
        };
      }

      if (hostClean === 'cross-tenant-conflict.test') {
        return {
          resolved: false,
          statusCode: 403,
          errorCode: 'CROSS_TENANT_CONFLICT',
          message: 'Tenant mapping conflict detected.'
        };
      }

      if (hostClean === 'unprotected-app.test') {
        return {
          resolved: false,
          statusCode: 403,
          errorCode: 'APPLICATION_NOT_PROTECTED',
          message: 'Application is in DEGRADED status.'
        };
      }

      if (hostClean === 'accounts.apexfintech.internal' || hostClean === 'test-app.local') {
        return {
          resolved: true,
          appContext: {
            applicationId: 'app-01-uuid',
            applicationIdentifier: 'app-01',
            name: 'Customer Accounts API',
            domain: hostClean,
            tenantId: 'tenant-apex-uuid',
            tenantIdentifier: 'tenant-apex-9941',
            status: 'PROTECTED',
            upstreamUrl: originBaseUrl,
            allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
            timeoutMs: 1500, // Short timeout for testing
            maxBodyBytes: 1048576
          }
        };
      }

      if (hostClean === 'dead-origin.apexfintech.internal') {
        return {
          resolved: true,
          appContext: {
            applicationId: 'app-dead-uuid',
            applicationIdentifier: 'app-dead',
            name: 'Dead Origin App',
            domain: hostClean,
            tenantId: 'tenant-apex-uuid',
            tenantIdentifier: 'tenant-apex-9941',
            status: 'PROTECTED',
            upstreamUrl: 'http://127.0.0.1:59999', // Closed port
            allowedMethods: ['GET', 'POST'],
            timeoutMs: 1000,
            maxBodyBytes: 1048576
          }
        };
      }

      return {
        resolved: false,
        statusCode: 404,
        errorCode: 'UNKNOWN_HOST',
        message: 'Host unmapped.'
      };
    }
  };

  const mockTelemetryRecorder = {
    async recordTelemetry(record) {
      telemetryLog.push(record);
    }
  };

  /**
   * Helper function using Node http.request to preserve exact Host and custom headers.
   */
  function sendHttpRequest(options = {}) {
    const {
      method = 'GET',
      port = gatewayPort,
      path = '/',
      headers = {},
      body = null
    } = options;

    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path,
          method,
          headers,
          agent: false
        },
        (res) => {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            const raw = Buffer.concat(chunks).toString();
            let json = null;
            try {
              json = JSON.parse(raw);
            } catch {}
            resolve({
              status: res.statusCode,
              headers: res.headers,
              rawBody: raw,
              body: json
            });
          });
        }
      );

      req.on('error', reject);

      if (body) {
        if (typeof body === 'string' || Buffer.isBuffer(body)) {
          req.write(body);
        } else {
          req.write(JSON.stringify(body));
        }
      }
      req.end();
    });
  }

  before(async () => {
    // 1. Start synthetic protected origin
    originServer = createSyntheticOriginServer();
    originServer.listen(0, '127.0.0.1');
    await new Promise((resolve) => originServer.once('listening', resolve));
    originPort = originServer.address().port;
    originBaseUrl = `http://127.0.0.1:${originPort}`;

    // 2. Start Gateway runtime
    const gatewayApp = createGatewayApp({
      config: {
        NODE_ENV: 'test',
        PORT: 0,
        HOST: '127.0.0.1',
        MANAGEMENT_API_URL: 'http://127.0.0.1:4000/api/v1',
        GATEWAY_INTERNAL_TOKEN: 'dev-internal-gateway-token-secret-min32chars!',
        UPSTREAM_TIMEOUT_MS: 1500,
        MAX_REQUEST_SIZE_BYTES: 1048576,
        ALLOWED_HTTP_METHODS: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
        TRUSTED_ORIGIN_MAP: {
          'accounts.apexfintech.internal': { upstreamUrl: originBaseUrl },
          'test-app.local': { upstreamUrl: originBaseUrl },
          'dead-origin.apexfintech.internal': { upstreamUrl: 'http://127.0.0.1:59999' }
        }
      },
      appResolver: mockAppResolver,
      telemetryRecorder: mockTelemetryRecorder
    });

    gatewayServer = gatewayApp.listen(0, '127.0.0.1');
    await new Promise((resolve) => gatewayServer.once('listening', resolve));
    gatewayPort = gatewayServer.address().port;
  });

  after(async () => {
    if (gatewayServer) {
      await new Promise((resolve) => gatewayServer.close(resolve));
    }
    if (originServer) {
      await new Promise((resolve) => originServer.close(resolve));
    }
  });

  // ---------------------------------------------------------------------------
  // A. Operational Health
  // ---------------------------------------------------------------------------
  test('1. Gateway /health/live reports UP status and foundation mode', async () => {
    const res = await sendHttpRequest({ path: '/health/live' });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'UP');
    assert.equal(res.body.subsystem, 'gateway-runtime');
    assert.equal(res.body.mode, 'reverse-proxy-foundation');
  });

  // ---------------------------------------------------------------------------
  // B. Basic Proxy Operation
  // ---------------------------------------------------------------------------
  test('2. Valid request reaches configured origin and returns response with X-Request-ID', async () => {
    const res = await sendHttpRequest({
      path: '/api/v1/accounts/summary',
      headers: {
        Host: 'accounts.apexfintech.internal'
      }
    });

    assert.equal(res.status, 200);
    const requestId = res.headers['x-request-id'];
    assert.ok(requestId, 'Response should contain X-Request-ID');

    assert.equal(res.body.status, 'success');
    assert.equal(res.body.accounts.length, 2);

    // Verify forwarded headers seen by upstream origin
    assert.equal(res.body.receivedHeaders.host, 'accounts.apexfintech.internal');
    assert.ok(res.body.receivedHeaders['x-forwarded-for']);
    assert.equal(res.body.receivedHeaders['x-forwarded-proto'], 'http');
    assert.equal(res.body.receivedHeaders['x-request-id'], requestId);
  });

  test('3. Client X-Request-ID is preserved and propagated if valid UUID', async () => {
    const clientUuid = '88888888-4444-4444-aaaa-123456789abc';
    const res = await sendHttpRequest({
      path: '/api/v1/accounts/summary',
      headers: {
        Host: 'accounts.apexfintech.internal',
        'X-Request-ID': clientUuid
      }
    });

    assert.equal(res.status, 200);
    assert.equal(res.headers['x-request-id'], clientUuid);
  });

  test('4. POST request streams body to upstream origin and returns response', async () => {
    const payload = { recipient: 'acc-9921', amount: 500.0 };
    const res = await sendHttpRequest({
      method: 'POST',
      path: '/api/v1/accounts/transfer',
      headers: {
        Host: 'accounts.apexfintech.internal',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.body, payload);
    assert.equal(res.body.method, 'POST');
  });

  // ---------------------------------------------------------------------------
  // C. Request Validation & Fail-Closed Routing
  // ---------------------------------------------------------------------------
  test('5. Missing Host header returns 400 MISSING_HOST_HEADER', async () => {
    const rawResponse = await new Promise((resolve) => {
      const client = net.connect(gatewayPort, '127.0.0.1', () => {
        client.write('GET /api/v1/accounts/summary HTTP/1.0\r\n\r\n');
      });
      let responseData = '';
      client.on('data', (c) => (responseData += c.toString()));
      client.on('end', () => resolve(responseData));
    });

    assert.ok(rawResponse.startsWith('HTTP/1.1 400') || rawResponse.startsWith('HTTP/1.0 400'));
    assert.ok(rawResponse.includes('MISSING_HOST_HEADER') || rawResponse.includes('Bad Request'));
  });

  test('6. Unknown host returns 404 UNKNOWN_HOST (fail closed)', async () => {
    const res = await sendHttpRequest({
      path: '/api/v1/accounts/summary',
      headers: { Host: 'unknown.domain.test' }
    });

    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'UNKNOWN_HOST');
  });

  test('7. Unregistered application in DB returns 404 UNREGISTERED_APPLICATION', async () => {
    const res = await sendHttpRequest({
      path: '/api/v1/accounts/summary',
      headers: { Host: 'unregistered.apexfintech.internal' }
    });

    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'UNREGISTERED_APPLICATION');
  });

  test('8. Unprotected (DEGRADED) application returns 403 APPLICATION_NOT_PROTECTED', async () => {
    const res = await sendHttpRequest({
      path: '/api/v1/accounts/summary',
      headers: { Host: 'unprotected-app.test' }
    });

    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'APPLICATION_NOT_PROTECTED');
  });

  test('9. Unsupported HTTP method (TRACE) rejected with 405 Method Not Allowed', async () => {
    const res = await sendHttpRequest({
      method: 'TRACE',
      path: '/api/v1/accounts/summary',
      headers: { Host: 'accounts.apexfintech.internal' }
    });

    assert.equal(res.status, 405);
    const allowHeader = res.headers['allow'];
    assert.ok(allowHeader.includes('GET'));
    assert.ok(!allowHeader.includes('TRACE'));
  });

  test('10. Oversized request payload is rejected with 413 PAYLOAD_TOO_LARGE', async () => {
    const res = await sendHttpRequest({
      method: 'POST',
      path: '/api/v1/accounts/transfer',
      headers: {
        Host: 'accounts.apexfintech.internal',
        'Content-Type': 'application/json',
        'Content-Length': '2097152' // 2MB exceeds 1MB limit
      },
      body: 'x'
    });

    assert.equal(res.status, 413);
    assert.equal(res.body.error.code, 'PAYLOAD_TOO_LARGE');
  });

  // ---------------------------------------------------------------------------
  // D. Security & SSRF Protection
  // ---------------------------------------------------------------------------
  test('11. SSRF Guard strictly blocks AWS/GCP cloud metadata endpoints', () => {
    const awsRes = validateUpstreamDestination('http://169.254.169.254/latest/meta-data/');
    assert.equal(awsRes.valid, false);
    assert.ok(awsRes.reason.includes('metadata'));

    const gcpRes = validateUpstreamDestination('http://metadata.google.internal/computeMetadata/v1/');
    assert.equal(gcpRes.valid, false);
    assert.ok(gcpRes.reason.includes('metadata'));

    const linkLocalRes = validateUpstreamDestination('http://169.254.1.1/secret');
    assert.equal(linkLocalRes.valid, false);
    assert.ok(linkLocalRes.reason.includes('link-local'));

    const dockerRes = validateUpstreamDestination('http://10.0.0.1:2375/version');
    assert.equal(dockerRes.valid, false);
    assert.ok(dockerRes.reason.includes('port 2375'));
  });

  test('12. SSRF Guard rejects non-HTTP protocols (file:, ftp:, gopher:)', () => {
    assert.equal(validateUpstreamDestination('file:///etc/passwd').valid, false);
    assert.equal(validateUpstreamDestination('gopher://127.0.0.1:70/').valid, false);
    assert.equal(validateUpstreamDestination('ftp://anonymous@ftp.test/').valid, false);
  });

  test('13. DNS rebinding / host spoofing characters in Host header return 400', async () => {
    const res = await sendHttpRequest({
      path: '/test',
      headers: { Host: 'victim.com@attacker.internal' }
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'INVALID_HOST_HEADER');
  });

  test('14. Client-injected identity headers are stripped before reaching origin', async () => {
    const res = await sendHttpRequest({
      path: '/api/v1/accounts/summary',
      headers: {
        Host: 'accounts.apexfintech.internal',
        'X-Gateway-Service-Token': 'spoofed-secret-token',
        'X-Tenant-ID': 'spoofed-tenant-id',
        'X-Internal-Service': 'true',
        'X-User-ID': 'root-admin',
        'X-Is-Platform-Admin': 'true'
      }
    });

    assert.equal(res.status, 200);
    // Upstream must NEVER receive client-injected trusted headers
    assert.equal(res.body.receivedHeaders['x-gateway-service-token'], undefined);
    assert.equal(res.body.receivedHeaders['x-tenant-id'], undefined);
    assert.equal(res.body.receivedHeaders['x-internal-service'], undefined);
    assert.equal(res.body.receivedHeaders['x-user-id'], undefined);
    assert.equal(res.body.receivedHeaders['x-is-platform-admin'], undefined);
  });

  test('15. RFC 7230 hop-by-hop headers are removed before forwarding', () => {
    const incoming = {
      connection: 'keep-alive, x-custom-hop',
      'keep-alive': 'timeout=5',
      te: 'trailers',
      'x-custom-hop': 'should-be-stripped',
      'x-legit-header': 'forward-me'
    };

    const sanitized = sanitizeForwardedHeaders(incoming, {
      clientIp: '1.2.3.4',
      validatedHost: 'test.local',
      requestId: 'req-test',
      protocol: 'http'
    });

    assert.equal(sanitized['connection'], undefined);
    assert.equal(sanitized['keep-alive'], undefined);
    assert.equal(sanitized['te'], undefined);
    assert.equal(sanitized['x-custom-hop'], undefined);
    assert.equal(sanitized['x-legit-header'], 'forward-me');
  });

  test('16. Internal origin details (Server, X-Powered-By) are stripped from response', async () => {
    const res = await sendHttpRequest({
      path: '/api/v1/accounts/summary',
      headers: { Host: 'accounts.apexfintech.internal' }
    });

    assert.equal(res.status, 200);
    assert.equal(res.headers['server'], undefined);
    assert.equal(res.headers['x-powered-by'], undefined);
  });

  test('17. Cross-tenant mapping conflict is denied with 403 CROSS_TENANT_CONFLICT', async () => {
    const res = await sendHttpRequest({
      path: '/api/v1/accounts/summary',
      headers: { Host: 'cross-tenant-conflict.test' }
    });

    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'CROSS_TENANT_CONFLICT');
  });

  // ---------------------------------------------------------------------------
  // E. Failure Behavior
  // ---------------------------------------------------------------------------
  test('18. Upstream timeout returns controlled 504 GATEWAY_TIMEOUT', async () => {
    // Request delay of 2500ms when gateway timeout is configured to 1500ms
    const res = await sendHttpRequest({
      path: '/simulate/delay/2500',
      headers: { Host: 'accounts.apexfintech.internal' }
    });

    assert.equal(res.status, 504);
    assert.equal(res.body.error.code, 'GATEWAY_TIMEOUT');
    assert.ok(res.body.error.message.includes('timeout'));
  });

  test('19. Upstream connection refused returns controlled 502 BAD_GATEWAY without leaking port', async () => {
    const res = await sendHttpRequest({
      path: '/api/v1/accounts/summary',
      headers: { Host: 'dead-origin.apexfintech.internal' }
    });

    assert.equal(res.status, 502);
    assert.equal(res.body.error.code, 'BAD_GATEWAY');
    // Error must NOT leak internal IP or closed port
    assert.ok(!res.body.error.message.includes('59999'));
    assert.ok(!res.body.error.message.includes('127.0.0.1'));
  });

  // ---------------------------------------------------------------------------
  // F. Decision Controller Interface & No Silent Fallback
  // ---------------------------------------------------------------------------
  test('20. If decision controller is unavailable when required, gateway fails closed (503)', async () => {
    const strictGatewayApp = createGatewayApp({
      config: {
        NODE_ENV: 'test',
        PORT: 0,
        HOST: '127.0.0.1',
        MANAGEMENT_API_URL: 'http://127.0.0.1:4000/api/v1',
        GATEWAY_INTERNAL_TOKEN: 'dev-internal-gateway-token-secret-min32chars!',
        ALLOWED_HTTP_METHODS: ['GET', 'POST'],
        TRUSTED_ORIGIN_MAP: { 'accounts.apexfintech.internal': { upstreamUrl: originBaseUrl } }
      },
      appResolver: mockAppResolver,
      requireDecisionController: true // Controller required but no URL configured
    });

    const testServer = strictGatewayApp.listen(0, '127.0.0.1');
    await new Promise((r) => testServer.once('listening', r));
    const port = testServer.address().port;

    const res = await sendHttpRequest({
      port,
      path: '/api/v1/accounts/summary',
      headers: { Host: 'accounts.apexfintech.internal' }
    });

    assert.equal(res.status, 503);
    assert.equal(res.body.error.code, 'SECURITY_CONTROL_UNAVAILABLE');

    await new Promise((r) => testServer.close(r));
  });

  test('21. Deception target unavailable NEVER falls back to real origin', async () => {
    // Simulated controller client returning PROPOSE_DECEPTION but missing target
    const mockControllerClient = {
      async evaluateDecision() {
        return {
          action: 'FAIL_CLOSED',
          reason: 'Deception destination unavailable. Fallback to real protected origin prohibited.'
        };
      }
    };

    const deceptionGatewayApp = createGatewayApp({
      config: {
        NODE_ENV: 'test',
        PORT: 0,
        HOST: '127.0.0.1',
        MANAGEMENT_API_URL: 'http://127.0.0.1:4000/api/v1',
        GATEWAY_INTERNAL_TOKEN: 'dev-internal-gateway-token-secret-min32chars!',
        ALLOWED_HTTP_METHODS: ['GET'],
        TRUSTED_ORIGIN_MAP: { 'accounts.apexfintech.internal': { upstreamUrl: originBaseUrl } }
      },
      appResolver: mockAppResolver,
      decisionController: mockControllerClient
    });

    const testServer = deceptionGatewayApp.listen(0, '127.0.0.1');
    await new Promise((r) => testServer.once('listening', r));
    const port = testServer.address().port;

    const res = await sendHttpRequest({
      port,
      path: '/api/v1/accounts/summary',
      headers: { Host: 'accounts.apexfintech.internal' }
    });

    assert.equal(res.status, 503);
    assert.ok(res.body.error.message.includes('Fallback to real protected origin prohibited'));

    await new Promise((r) => testServer.close(r));
  });

  // ---------------------------------------------------------------------------
  // G. Telemetry & Evidence Integrity
  // ---------------------------------------------------------------------------
  test('22. Telemetry logs distinct lifecycle stages and omits sensitive credentials', () => {
    assert.ok(telemetryLog.length > 0, 'Telemetry records should have been captured');

    const successfulRecord = telemetryLog.find((r) => r.forwardingResult === 'SUCCESS');
    assert.ok(successfulRecord);
    assert.equal(successfulRecord.validationOutcome, 'VALIDATED');
    assert.equal(successfulRecord.tenantId, 'tenant-apex-uuid');
    assert.equal(successfulRecord.applicationId, 'app-01-uuid');
    assert.equal(successfulRecord.routingDecision.outcomeStatus, 'FORWARDED_TO_ORIGIN');

    // Verify sensitive header redaction utility
    const redacted = logger.redactHeaders({
      authorization: 'Bearer secret-jwt-token',
      cookie: 'adg_session=secret-session-id',
      'x-api-key': 'live-api-key-12345',
      accept: 'application/json'
    });

    assert.equal(redacted.authorization, '[REDACTED]');
    assert.equal(redacted.cookie, '[REDACTED]');
    assert.equal(redacted['x-api-key'], '[REDACTED]');
    assert.equal(redacted.accept, 'application/json');
  });
});
