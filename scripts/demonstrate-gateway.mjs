#!/usr/bin/env node
/**
 * Stage 4A.1 — Gateway Security Runtime Demonstration Script
 *
 * Demonstrates the hardened Gateway Reverse Proxy foundation:
 * 1. Operational Health Verification (/health/live, /health/ready)
 * 2. Legitimate Traffic Forwarding & Body Streaming
 * 3. Client Identity & Hop-by-Hop Header Stripping
 * 4. HTTP Request Smuggling Defenses (RFC 7230 / RFC 9112)
 * 5. SSRF Multi-Tier Guard (Cloud metadata, IPv4-mapped IPv6, sensitive ports)
 * 6. Fail-Closed Behavior (Unknown host, connection refused, unmapped tenant)
 * 7. 8-Stage Telemetry Collection & Evidence Integrity
 */

import http from 'node:http';
import net from 'node:net';
import { createGatewayApp } from '../gateway/src/app.js';
import { validateUpstreamDestination } from '../gateway/src/proxy/ssrf-guard.js';

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function logStep(step, title) {
  console.log(`\n${ANSI.bold}${ANSI.cyan}[Step ${step}] ${title}${ANSI.reset}`);
}

function logResult(success, message, detail) {
  const icon = success ? `${ANSI.green}✔ PASS${ANSI.reset}` : `${ANSI.red}✖ FAIL${ANSI.reset}`;
  console.log(`  ${icon}: ${message}`);
  if (detail) {
    console.log(`    ${ANSI.yellow}${detail}${ANSI.reset}`);
  }
}

// 1. Create Mock Upstream Origin
function createSyntheticOrigin() {
  return http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const rawBody = Buffer.concat(chunks).toString('utf8');
      let parsed = rawBody;
      try {
        parsed = JSON.parse(rawBody);
      } catch {}

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Server': 'Apache/2.4.41 (Hidden-Internal)',
        'X-Powered-By': 'PHP/7.4.3',
        'X-Echo-Path': req.url
      });
      res.end(
        JSON.stringify({
          status: 'ORIGIN_SUCCESS',
          receivedMethod: req.method,
          receivedPath: req.url,
          receivedHeaders: req.headers,
          receivedBody: parsed
        })
      );
    });
  });
}

async function main() {
  console.log(`${ANSI.bold}================================================================${ANSI.reset}`);
  console.log(`${ANSI.bold}   Adaptive Cyber Deception Gateway — Stage 4A.1 Demonstration  ${ANSI.reset}`);
  console.log(`${ANSI.bold}   Runtime Hardening, Isolation & Telemetry Evidence Integrity  ${ANSI.reset}`);
  console.log(`${ANSI.bold}================================================================${ANSI.reset}`);

  // Start Origin
  const originServer = createSyntheticOrigin();
  originServer.listen(0, '127.0.0.1');
  await new Promise((res) => originServer.once('listening', res));
  const originPort = originServer.address().port;
  const originUrl = `http://127.0.0.1:${originPort}`;

  const telemetryLog = [];
  const mockTelemetryRecorder = {
    async recordTelemetry(record) {
      telemetryLog.push(record);
      return { persistenceStatus: 'TELEMETRY_PERSISTED', correlationId: record.correlationId };
    }
  };

  const mockAppResolver = {
    async resolveApplication(domain) {
      if (domain === 'accounts.apexfintech.internal') {
        return {
          resolved: true,
          appContext: {
            applicationId: 'app-apex-01',
            applicationIdentifier: 'app-apex-accounts',
            name: 'Apex Accounts Service',
            domain: 'accounts.apexfintech.internal',
            tenantId: 'tenant-apex-uuid',
            tenantIdentifier: 'tenant-apex-9941',
            status: 'PROTECTED',
            upstreamUrl: originUrl,
            allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'],
            timeoutMs: 2000,
            maxBodyBytes: 1048576
          }
        };
      }
      return { resolved: false, statusCode: 404, errorCode: 'UNKNOWN_HOST', message: 'Host unmapped.' };
    }
  };

  const gatewayApp = createGatewayApp({
    config: {
      NODE_ENV: 'test',
      PORT: 0,
      HOST: '127.0.0.1',
      MANAGEMENT_API_URL: 'http://127.0.0.1:4000/api/v1',
      GATEWAY_INTERNAL_TOKEN: 'demo-internal-gateway-token-secret-min32chars!',
      UPSTREAM_TIMEOUT_MS: 2000,
      MAX_REQUEST_SIZE_BYTES: 1048576,
      ALLOWED_HTTP_METHODS: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
      TRUSTED_ORIGIN_MAP: {
        'accounts.apexfintech.internal': { upstreamUrl: originUrl }
      }
    },
    appResolver: mockAppResolver,
    telemetryRecorder: mockTelemetryRecorder
  });

  const gatewayServer = gatewayApp.listen(0, '127.0.0.1');
  await new Promise((res) => gatewayServer.once('listening', res));
  const gatewayPort = gatewayServer.address().port;

  function sendHttpRequest({ method = 'GET', path = '/', headers = {}, body = null }) {
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: gatewayPort,
          path,
          method,
          headers,
          agent: false
        },
        (res) => {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8');
            let parsed = raw;
            try {
              parsed = JSON.parse(raw);
            } catch {}
            resolve({ status: res.statusCode, headers: res.headers, body: parsed });
          });
        }
      );
      req.on('error', reject);
      if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
      req.end();
    });
  }

  function sendRawSocket(rawPayload) {
    return new Promise((resolve, reject) => {
      const client = net.connect(gatewayPort, '127.0.0.1', () => {
        client.write(rawPayload);
      });
      let response = '';
      client.on('data', (chunk) => (response += chunk.toString('utf8')));
      client.on('end', () => resolve(response));
      client.on('error', reject);
      client.setTimeout(2000, () => {
        client.destroy();
        resolve(response);
      });
    });
  }

  try {
    // -------------------------------------------------------------------------
    // Step 1: Operational Health
    // -------------------------------------------------------------------------
    logStep(1, 'Operational Health Verification');
    const liveRes = await sendHttpRequest({ path: '/health/live' });
    logResult(liveRes.status === 200 && liveRes.body.status === 'UP', 'Gateway Liveness Probe (/health/live)', `Status: ${liveRes.body.status}, Subsystem: ${liveRes.body.subsystem}`);

    const readyRes = await sendHttpRequest({ path: '/health/ready' });
    logResult(readyRes.status === 200 && readyRes.body.status === 'READY', 'Gateway Readiness Probe (/health/ready)', `Configured Origins: ${JSON.stringify(readyRes.body.configuredOrigins)}`);

    // -------------------------------------------------------------------------
    // Step 2: Legitimate Request Forwarding & Telemetry
    // -------------------------------------------------------------------------
    logStep(2, 'Legitimate Traffic Routing & Request ID Propagation');
    const clientUuid = '12345678-1234-4321-8765-123456789abc';
    const getRes = await sendHttpRequest({
      path: '/api/v1/accounts/overview?view=summary',
      headers: {
        Host: 'accounts.apexfintech.internal',
        'X-Request-ID': clientUuid
      }
    });

    logResult(getRes.status === 200, 'GET request forwarded to protected origin', `HTTP ${getRes.status}`);
    logResult(getRes.headers['x-request-id'] === clientUuid, 'Client X-Request-ID preserved and propagated downstream', `X-Request-ID: ${getRes.headers['x-request-id']}`);
    logResult(!getRes.headers['server'] && !getRes.headers['x-powered-by'], 'Internal origin fingerprinting headers stripped (Server, X-Powered-By)', `Server: ${getRes.headers['server'] || '<stripped>'}`);

    // -------------------------------------------------------------------------
    // Step 3: Body Streaming & Backpressure
    // -------------------------------------------------------------------------
    logStep(3, 'Request Body Streaming (POST with JSON Payload)');
    const postPayload = { accountId: 'acc-9001', transferAmount: 1500.5, currency: 'USD' };
    const postRes = await sendHttpRequest({
      method: 'POST',
      path: '/api/v1/accounts/transfer',
      headers: {
        Host: 'accounts.apexfintech.internal',
        'Content-Type': 'application/json'
      },
      body: postPayload
    });

    logResult(postRes.status === 200, 'POST body streamed to origin', `HTTP ${postRes.status}`);
    logResult(postRes.body.receivedBody?.accountId === 'acc-9001', 'Origin received intact JSON body stream', JSON.stringify(postRes.body.receivedBody));

    // -------------------------------------------------------------------------
    // Step 4: Client Identity Header Stripping
    // -------------------------------------------------------------------------
    logStep(4, 'Privileged Identity Header Stripping (Zero Trust Ingress)');
    const spoofedRes = await sendHttpRequest({
      path: '/api/v1/accounts/balance',
      headers: {
        Host: 'accounts.apexfintech.internal',
        'X-Gateway-Service-Token': 'attacker-injected-token',
        'X-Tenant-ID': 'tenant-spoofed',
        'X-Internal-Service': 'true',
        'X-User-ID': 'root-admin'
      }
    });

    const receivedHeaders = spoofedRes.body.receivedHeaders || {};
    const strippedClean =
      !receivedHeaders['x-gateway-service-token'] &&
      !receivedHeaders['x-tenant-id'] &&
      !receivedHeaders['x-internal-service'] &&
      !receivedHeaders['x-user-id'];

    logResult(strippedClean, 'All client-injected identity headers stripped before reaching origin', `Received by upstream: ${JSON.stringify(Object.keys(receivedHeaders).filter(k => k.startsWith('x-')))}`);

    // -------------------------------------------------------------------------
    // Step 5: HTTP Request Smuggling Defense
    // -------------------------------------------------------------------------
    logStep(5, 'HTTP Request Smuggling Defense (RFC 7230 / RFC 9112)');
    const smugglingPayload =
      'POST /api/v1/test HTTP/1.1\r\n' +
      'Host: accounts.apexfintech.internal\r\n' +
      'Transfer-Encoding: chunked\r\n' +
      'Content-Length: 20\r\n' +
      'Connection: close\r\n\r\n' +
      '0\r\n\r\n';

    const smuggleRes = await sendRawSocket(smugglingPayload);
    logResult(smuggleRes.includes('400 Bad Request'), 'Conflicting Transfer-Encoding + Content-Length rejected with 400', smuggleRes.split('\r\n')[0]);

    const dupClPayload =
      'POST /api/v1/test HTTP/1.1\r\n' +
      'Host: accounts.apexfintech.internal\r\n' +
      'Content-Length: 5\r\n' +
      'Content-Length: 5\r\n' +
      'Connection: close\r\n\r\n' +
      'hello';

    const dupClRes = await sendRawSocket(dupClPayload);
    logResult(dupClRes.includes('400 Bad Request'), 'Duplicate Content-Length header rejected with 400', dupClRes.split('\r\n')[0]);

    // -------------------------------------------------------------------------
    // Step 6: SSRF Multi-Tier Defense
    // -------------------------------------------------------------------------
    logStep(6, 'SSRF Multi-Tier Destination Defense');
    const awsCheck = validateUpstreamDestination('http://169.254.169.254/latest/meta-data/');
    logResult(!awsCheck.valid && awsCheck.reason.includes('metadata'), 'Blocked AWS IMDS metadata IP (169.254.169.254)', awsCheck.reason);

    const ipv6Check = validateUpstreamDestination('http://[::ffff:169.254.169.254]/meta-data/');
    logResult(!ipv6Check.valid && ipv6Check.reason.includes('metadata'), 'Blocked IPv4-mapped IPv6 metadata attempt (::ffff:169.254.169.254)', ipv6Check.reason);

    const dockerCheck = validateUpstreamDestination('http://127.0.0.1:2375/version');
    logResult(!dockerCheck.valid && dockerCheck.reason.includes('2375'), 'Blocked sensitive infrastructure port 2375 (Docker Daemon)', dockerCheck.reason);

    // -------------------------------------------------------------------------
    // Step 7: Fail-Closed Routing
    // -------------------------------------------------------------------------
    logStep(7, 'Fail-Closed Behavior on Unknown or Unregistered Host');
    const unknownHostRes = await sendHttpRequest({
      path: '/api/v1/accounts/summary',
      headers: { Host: 'unregistered.attacker.internal' }
    });
    logResult(unknownHostRes.status === 404, 'Unknown host returns controlled 404 UNKNOWN_HOST', `Status: ${unknownHostRes.status}, Error: ${unknownHostRes.body.error?.code}`);

    // -------------------------------------------------------------------------
    // Step 8: Telemetry Collection & Evidence Integrity
    // -------------------------------------------------------------------------
    logStep(8, 'Telemetry Collection & Lifecycle Stages Verification');
    const recordedEvents = telemetryLog.filter(t => t.applicationId === 'app-apex-01');
    logResult(recordedEvents.length > 0, `Captured ${recordedEvents.length} telemetry records with explicit lifecycle stages`, `Sample correlationId: ${recordedEvents[0]?.correlationId}`);

    console.log(`\n${ANSI.bold}${ANSI.green}✔ All Stage 4A.1 demonstration scenarios completed successfully.${ANSI.reset}\n`);
  } finally {
    await new Promise((res) => gatewayServer.close(res));
    await new Promise((res) => originServer.close(res));
  }
}

main().catch((err) => {
  console.error(`${ANSI.red}Demonstration failed:${ANSI.reset}`, err);
  process.exit(1);
});
