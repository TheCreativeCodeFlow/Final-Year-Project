/**
 * Stage 4A.1 — Gateway Security Hardening and Verification Suite
 *
 * Comprehensive tests verifying:
 * 1. HTTP Request Smuggling Defenses (RFC 7230 / RFC 9112)
 *    - Conflicting Transfer-Encoding & Content-Length rejection
 *    - Duplicate Content-Length rejection
 *    - Duplicate Host header rejection
 *    - Non-numeric Content-Length validation
 *    - Host header syntax & traversal rejection
 * 2. SSRF Guard Multi-Tier Defense:
 *    - IPv4-mapped IPv6 bypasses (::ffff:169.254.169.254, ::ffff:a9fe:a9fe, ::ffff:10.0.0.1)
 *    - Cloud metadata endpoints (IPv4 169.254.169.254, 100.100.100.200, IPv6 fd00:ec2::254)
 *    - IPv6 link-local and documentation ranges
 *    - Prohibited infrastructure ports (22, 2375, 2376, 3306, 5432, 6379, 10250)
 * 3. DNS Rebinding & Connection Pinning:
 *    - Pre-resolution and socket pinning verification
 *    - Mixed record safety (failing when prohibited IP is returned)
 * 4. HEAD request handling & body suppression
 * 5. Telemetry bounded queue & deduplication
 */

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { createGatewayApp } from '../src/app.js';
import {
  validateUpstreamDestination,
  validateIpAddress,
  resolveAndPinUpstreamDestination,
  stripIpv6Brackets,
  extractIpv4FromIpv6
} from '../src/proxy/ssrf-guard.js';
import { TelemetryRecorderService, TELEMETRY_OUTCOMES } from '../src/services/telemetry-recorder.service.js';

describe('Stage 4A.1: Gateway Security Hardening Suite', () => {
  let gatewayServer;
  let gatewayPort;
  let originServer;
  let originPort;
  let originBaseUrl;

  const capturedTelemetry = [];

  function createMockOriginServer() {
    return http.createServer((req, res) => {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const bodyStr = Buffer.concat(chunks).toString('utf8');
        let parsed = null;
        try {
          parsed = JSON.parse(bodyStr);
        } catch {
          parsed = bodyStr;
        }

        if (req.method === 'HEAD') {
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Content-Length': '42',
            'X-Echo-Method': 'HEAD'
          });
          res.end();
          return;
        }

        res.writeHead(200, {
          'Content-Type': 'application/json',
          'X-Echo-Method': req.method
        });
        res.end(
          JSON.stringify({
            receivedMethod: req.method,
            receivedHeaders: req.headers,
            body: parsed
          })
        );
      });
    });
  }

  const mockAppResolver = {
    async resolveApplication(domain) {
      if (domain === 'secure.test.internal') {
        return {
          resolved: true,
          appContext: {
            applicationId: 'app-sec-01',
            applicationIdentifier: 'app-sec-01',
            name: 'Secure Test App',
            domain: 'secure.test.internal',
            tenantId: 'tenant-sec-01',
            tenantIdentifier: 'tenant-sec-01',
            status: 'PROTECTED',
            upstreamUrl: originBaseUrl,
            allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'],
            timeoutMs: 1500,
            maxBodyBytes: 1048576
          }
        };
      }
      return { resolved: false, statusCode: 404, errorCode: 'UNKNOWN_HOST', message: 'Host unmapped.' };
    }
  };

  const mockTelemetryRecorder = {
    async recordTelemetry(record) {
      capturedTelemetry.push(record);
    }
  };

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

  before(async () => {
    originServer = createMockOriginServer();
    originServer.listen(0, '127.0.0.1');
    await new Promise((resolve) => originServer.once('listening', resolve));
    originPort = originServer.address().port;
    originBaseUrl = `http://127.0.0.1:${originPort}`;

    const app = createGatewayApp({
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
          'secure.test.internal': { upstreamUrl: originBaseUrl }
        }
      },
      appResolver: mockAppResolver,
      telemetryRecorder: mockTelemetryRecorder
    });

    gatewayServer = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => gatewayServer.once('listening', resolve));
    gatewayPort = gatewayServer.address().port;
  });

  after(async () => {
    if (gatewayServer) await new Promise((res) => gatewayServer.close(res));
    if (originServer) await new Promise((res) => originServer.close(res));
  });

  // ===========================================================================
  // 1. HTTP Request Smuggling Defenses (RFC 7230 §3.3.3 / RFC 9112 §6.1)
  // ===========================================================================
  test('1. Conflicting Transfer-Encoding & Content-Length is rejected with 400 Bad Request', async () => {
    const rawReq =
      'POST /api/v1/test HTTP/1.1\r\n' +
      'Host: secure.test.internal\r\n' +
      'Transfer-Encoding: chunked\r\n' +
      'Content-Length: 13\r\n' +
      'Connection: close\r\n' +
      'Content-Type: text/plain\r\n\r\n' +
      '0\r\n\r\n';

    const rawRes = await sendRawHttpRequest(rawReq);
    assert.ok(rawRes.includes('HTTP/1.1 400 Bad Request'), 'Must respond with 400 Bad Request');
    assert.ok(rawRes.toLowerCase().includes('connection: close'), 'Must send Connection: close');
  });

  test('2. Duplicate Host header is rejected with 400 DUPLICATE_HOST_HEADER', async () => {
    const rawReq =
      'GET /api/v1/test HTTP/1.1\r\n' +
      'Host: secure.test.internal\r\n' +
      'Host: evil.internal\r\n' +
      'Connection: close\r\n' +
      '\r\n';

    const rawRes = await sendRawHttpRequest(rawReq);
    assert.ok(rawRes.includes('HTTP/1.1 400 Bad Request'));
    assert.ok(rawRes.includes('DUPLICATE_HOST_HEADER'));
    assert.ok(rawRes.toLowerCase().includes('connection: close'));
  });

  test('3. Duplicate Content-Length header is rejected with 400 Bad Request', async () => {
    const rawReq =
      'POST /api/v1/test HTTP/1.1\r\n' +
      'Host: secure.test.internal\r\n' +
      'Content-Length: 5\r\n' +
      'Content-Length: 5\r\n' +
      'Connection: close\r\n' +
      'Content-Type: text/plain\r\n\r\n' +
      'hello';

    const rawRes = await sendRawHttpRequest(rawReq);
    assert.ok(rawRes.includes('HTTP/1.1 400 Bad Request'));
    assert.ok(rawRes.toLowerCase().includes('connection: close'));
  });

  test('4. Non-numeric or invalid Content-Length is rejected with 400 Bad Request', async () => {
    const rawReq =
      'POST /api/v1/test HTTP/1.1\r\n' +
      'Host: secure.test.internal\r\n' +
      'Content-Length: 10abc\r\n' +
      'Connection: close\r\n' +
      'Content-Type: text/plain\r\n\r\n' +
      '0123456789';

    const rawRes = await sendRawHttpRequest(rawReq);
    assert.ok(rawRes.includes('HTTP/1.1 400 Bad Request'));
    assert.ok(rawRes.toLowerCase().includes('connection: close'));
  });

  test('5. Host header with directory traversal or null bytes is rejected with 400 INVALID_HOST_HEADER', async () => {
    const rawReq =
      'GET /api/v1/test HTTP/1.1\r\n' +
      'Host: secure.test.internal/../../evil\r\n' +
      'Connection: close\r\n' +
      '\r\n';

    const rawRes = await sendRawHttpRequest(rawReq);
    assert.ok(rawRes.includes('HTTP/1.1 400 Bad Request'));
    assert.ok(rawRes.includes('INVALID_HOST_HEADER'));
  });

  // ===========================================================================
  // 2. SSRF Multi-Tier Security: IPv4-Mapped IPv6 & Cloud Metadata
  // ===========================================================================
  test('6. extractIpv4FromIpv6 extracts embedded IPv4 addresses correctly', () => {
    assert.equal(extractIpv4FromIpv6('::ffff:169.254.169.254'), '169.254.169.254');
    assert.equal(extractIpv4FromIpv6('::ffff:a9fe:a9fe'), '169.254.169.254');
    assert.equal(extractIpv4FromIpv6('::ffff:10.0.0.1'), '10.0.0.1');
    assert.equal(extractIpv4FromIpv6('::ffff:7f00:1'), '127.0.0.1');
    assert.equal(extractIpv4FromIpv6('fe80::1'), null);
    assert.equal(extractIpv4FromIpv6('2001:db8::1'), null);
  });

  test('7. validateIpAddress rejects IPv4-mapped IPv6 cloud metadata attempts', () => {
    // Dotted-quad IPv4-mapped
    const r1 = validateIpAddress('::ffff:169.254.169.254');
    assert.equal(r1.valid, false);
    assert.ok(r1.reason.includes('metadata'));

    // Hex-notation IPv4-mapped
    const r2 = validateIpAddress('::ffff:a9fe:a9fe');
    assert.equal(r2.valid, false);
    assert.ok(r2.reason.includes('metadata'));

    // IPv4-mapped private IP (10.0.0.1) without authorization
    const r3 = validateIpAddress('::ffff:10.0.0.1', { allowPrivateIps: false });
    assert.equal(r3.valid, false);
    assert.ok(r3.reason.includes('private IPv4'));

    // IPv4-mapped loopback without authorization
    const r4 = validateIpAddress('::ffff:127.0.0.1', { allowLoopback: false });
    assert.equal(r4.valid, false);
    assert.ok(r4.reason.includes('loopback'));
  });

  test('8. validateIpAddress strictly forbids AWS IPv6 instance metadata (fd00:ec2::254)', () => {
    const r = validateIpAddress('fd00:ec2::254');
    assert.equal(r.valid, false);
    assert.ok(r.reason.includes('cloud instance metadata IPv6'));
  });

  test('9. validateIpAddress rejects IPv6 Link-Local and Documentation addresses', () => {
    const linkLocal = validateIpAddress('fe80::1');
    assert.equal(linkLocal.valid, false);
    assert.ok(linkLocal.reason.includes('link-local'));

    const doc = validateIpAddress('2001:db8::1');
    assert.equal(doc.valid, false);
    assert.ok(doc.reason.includes('documentation'));
  });

  test('10. validateUpstreamDestination blocks sensitive infrastructure ports', () => {
    const ports = [22, 2375, 2376, 3306, 5432, 6379, 8500, 9200, 10250];
    for (const p of ports) {
      const res = validateUpstreamDestination(`http://api.internal:${p}/status`);
      assert.equal(res.valid, false, `Port ${p} must be blocked`);
      assert.ok(res.reason.includes(String(p)));
    }
  });

  // ===========================================================================
  // 3. DNS Rebinding & Connection Pinning Defense
  // ===========================================================================
  test('11. resolveAndPinUpstreamDestination pins validated IP and prevents DNS rebinding TOCTOU', async () => {
    let callCount = 0;
    // Mock resolver that returns benign IP on first call, but malicious IP on subsequent calls
    const rebindingResolver = async (hostname) => {
      callCount++;
      if (callCount === 1) {
        return [{ address: '93.184.216.34', family: 4 }]; // example.com benign public IP
      }
      return [{ address: '169.254.169.254', family: 4 }]; // Malicious rebinding IP
    };

    const pinResult = await resolveAndPinUpstreamDestination('http://rebinding.test.domain/api', {
      dnsResolver: rebindingResolver,
      allowPrivateIps: false,
      allowLoopback: false
    });

    assert.equal(pinResult.valid, true);
    assert.equal(pinResult.pinnedIp, '93.184.216.34');
    assert.equal(pinResult.family, 4);
  });

  test('12. resolveAndPinUpstreamDestination fails closed if any returned A/AAAA record is prohibited', async () => {
    // Resolver returns multiple records: one benign public IP, one prohibited cloud metadata IP
    const mixedResolver = async () => [
      { address: '93.184.216.34', family: 4 },
      { address: '169.254.169.254', family: 4 }
    ];

    const pinResult = await resolveAndPinUpstreamDestination('http://mixed.test.domain/api', {
      dnsResolver: mixedResolver,
      allowPrivateIps: false,
      allowLoopback: false
    });

    assert.equal(pinResult.valid, false);
    assert.ok(pinResult.reason.includes('metadata'));
  });

  // ===========================================================================
  // 4. HTTP HEAD Method Handling
  // ===========================================================================
  test('13. HEAD requests forward correctly and suppress response body', async () => {
    const rawReq =
      'HEAD /api/v1/test HTTP/1.1\r\n' +
      'Host: secure.test.internal\r\n' +
      'Connection: close\r\n' +
      '\r\n';

    const rawRes = await sendRawHttpRequest(rawReq);
    assert.ok(rawRes.includes('HTTP/1.1 200 OK'));
    assert.ok(rawRes.toLowerCase().includes('x-echo-method: head'));

    const parts = rawRes.split('\r\n\r\n');
    assert.equal(parts.length >= 2, true);
    const bodyPart = parts.slice(1).join('\r\n\r\n');
    assert.equal(bodyPart, '', 'HEAD response must have an empty body');
  });

  // ===========================================================================
  // 5. Telemetry Bounded Queue and Persistence Status Handling
  // ===========================================================================
  test('14. TelemetryRecorderService enforces bounded queue size to prevent OOM', async () => {
    const failingService = new TelemetryRecorderService({
      managementApiUrl: 'http://127.0.0.1:59998/api/v1',
      gatewayInternalToken: 'secret-token',
      maxQueueSize: 5,
      fetchImpl: async () => {
        throw new Error('Connection refused');
      }
    });

    const results = [];
    for (let i = 0; i < 8; i++) {
      const res = await failingService.recordTelemetry({
        correlationId: `corr-${i}`,
        requestId: `req-${i}`,
        tenantId: 'tenant-test',
        applicationId: 'app-test',
        clientIp: '127.0.0.1',
        httpMethod: 'GET',
        requestPath: '/test',
        requestSizeBytes: 0,
        responseSizeBytes: 0,
        responseStatusCode: 200,
        gatewayDurationMs: 5.0,
        originDurationMs: 4.0,
        forwardingResult: 'SUCCESS',
        observedEvidence: { headers: {} },
        decisionStage: 'FORWARD_ORIGIN',
        routingOutcome: 'FORWARDED_ORIGIN',
        executionEvidence: 'MISSING'
      });
      results.push(res);
    }

    assert.equal(failingService.queue.length, 5, 'Queue size must not exceed maxQueueSize (5)');
    const failedResults = results.filter((r) => r.persistenceStatus === TELEMETRY_OUTCOMES.FAILED);
    assert.equal(failedResults.length, 8, 'All results must report TELEMETRY_PERSISTENCE_FAILED');
  });

  test('15. stripIpv6Brackets correctly strips brackets for URL hostnames', () => {
    assert.equal(stripIpv6Brackets('[::1]'), '::1');
    assert.equal(stripIpv6Brackets('[::ffff:169.254.169.254]'), '::ffff:169.254.169.254');
    assert.equal(stripIpv6Brackets('127.0.0.1'), '127.0.0.1');
    assert.equal(stripIpv6Brackets('example.com'), 'example.com');
  });
});
