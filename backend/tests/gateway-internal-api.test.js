/**
 * Stage 4A: Gateway Internal Management API Integration Test Suite.
 *
 * Exercises the internal service contract between the Gateway runtime and the Management API:
 * 1. Internal service token authentication (401 on missing, 403 on invalid, timing-safe).
 * 2. Application resolution by domain (PostgreSQL-backed, tenant status gating, 404 on unregistered).
 * 3. Telemetry ingestion and persistence (SecurityObservation, RoutingDecision, RoutingOutcome).
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { getPrismaClient, connectDatabase, disconnectDatabase } from '../src/db/client.js';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgresql://rahulseervi@localhost:5432/adaptive_deception_test?schema=public';

const SERVICE_TOKEN = 'test-internal-gateway-token-secret-min32chars!';

describe('Stage 4A: Gateway Internal Management API', () => {
  let app;
  let server;
  let baseUrl;
  let prisma;

  let tenantApex;
  let tenantSuspended;
  let activeApp;
  let suspendedApp;

  before(async () => {
    process.env.DATABASE_URL = TEST_DATABASE_URL;
    process.env.GATEWAY_INTERNAL_TOKEN = SERVICE_TOKEN;

    prisma = getPrismaClient({ databaseUrl: TEST_DATABASE_URL, forceNew: true });
    await connectDatabase(prisma);

    app = createApp({
      prisma,
      envConfig: {
        NODE_ENV: 'test',
        HOST: '127.0.0.1',
        PORT: 0,
        LOG_LEVEL: 'warn',
        CORS_ORIGIN: ['http://localhost:3000'],
        BODY_LIMIT: '100kb',
        GATEWAY_INTERNAL_TOKEN: SERVICE_TOKEN,
        COOKIE_NAME: 'adg_session',
        SESSION_TTL_HOURS: 24,
        isProduction: false,
        isTest: true
      }
    });

    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}/api/v1/internal/gateway`;

    // Seed test fixtures
    tenantApex = await prisma.tenant.upsert({
      where: { identifier: 'tenant-gw-test-apex' },
      update: { status: 'ACTIVE' },
      create: {
        identifier: 'tenant-gw-test-apex',
        displayName: 'Apex Gateway Test Org',
        status: 'ACTIVE'
      }
    });

    tenantSuspended = await prisma.tenant.upsert({
      where: { identifier: 'tenant-gw-test-suspended' },
      update: { status: 'SUSPENDED' },
      create: {
        identifier: 'tenant-gw-test-suspended',
        displayName: 'Suspended Test Org',
        status: 'SUSPENDED'
      }
    });

    activeApp = await prisma.protectedApplication.upsert({
      where: {
        tenantId_applicationIdentifier: {
          tenantId: tenantApex.id,
          applicationIdentifier: 'app-gw-01'
        }
      },
      update: { domain: 'gw-active.test.internal', status: 'PROTECTED' },
      create: {
        tenantId: tenantApex.id,
        applicationIdentifier: 'app-gw-01',
        name: 'Active Test Gateway App',
        domain: 'gw-active.test.internal',
        status: 'PROTECTED'
      }
    });

    suspendedApp = await prisma.protectedApplication.upsert({
      where: {
        tenantId_applicationIdentifier: {
          tenantId: tenantSuspended.id,
          applicationIdentifier: 'app-gw-suspended'
        }
      },
      update: { domain: 'gw-suspended.test.internal', status: 'PROTECTED' },
      create: {
        tenantId: tenantSuspended.id,
        applicationIdentifier: 'app-gw-suspended',
        name: 'Suspended Tenant Gateway App',
        domain: 'gw-suspended.test.internal',
        status: 'PROTECTED'
      }
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDatabase(prisma);
  });

  test('1. Subsystem health endpoint responds 200 without authentication', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'UP');
  });

  test('2. Missing X-Gateway-Service-Token returns 401 MISSING_SERVICE_TOKEN', async () => {
    const res = await fetch(`${baseUrl}/resolve-application?domain=gw-active.test.internal`);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error.code, 'MISSING_SERVICE_TOKEN');
  });

  test('3. Invalid X-Gateway-Service-Token returns 403 INVALID_SERVICE_TOKEN', async () => {
    const res = await fetch(`${baseUrl}/resolve-application?domain=gw-active.test.internal`, {
      headers: { 'X-Gateway-Service-Token': 'wrong-token-value-here-1234567890!' }
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error.code, 'INVALID_SERVICE_TOKEN');
  });

  test('4. Missing domain parameter returns 400 MISSING_DOMAIN_PARAMETER', async () => {
    const res = await fetch(`${baseUrl}/resolve-application`, {
      headers: { 'X-Gateway-Service-Token': SERVICE_TOKEN }
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error.code, 'MISSING_DOMAIN_PARAMETER');
  });

  test('5. Valid registered domain resolves application and active tenant metadata', async () => {
    const res = await fetch(`${baseUrl}/resolve-application?domain=gw-active.test.internal`, {
      headers: { 'X-Gateway-Service-Token': SERVICE_TOKEN }
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.domain, 'gw-active.test.internal');
    assert.equal(body.data.isProtected, true);
    assert.equal(body.data.tenant.identifier, 'tenant-gw-test-apex');
    assert.equal(body.data.tenant.status, 'ACTIVE');
  });

  test('6. Unregistered domain returns 404 APPLICATION_NOT_FOUND', async () => {
    const res = await fetch(`${baseUrl}/resolve-application?domain=unknown.domain.internal`, {
      headers: { 'X-Gateway-Service-Token': SERVICE_TOKEN }
    });
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error.code, 'APPLICATION_NOT_FOUND');
  });

  test('7. Application under SUSPENDED tenant returns 403 TENANT_INACTIVE', async () => {
    const res = await fetch(`${baseUrl}/resolve-application?domain=gw-suspended.test.internal`, {
      headers: { 'X-Gateway-Service-Token': SERVICE_TOKEN }
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error.code, 'TENANT_INACTIVE');
  });

  test('8. Telemetry ingestion persists SecurityObservation and RoutingOutcome to PostgreSQL', async () => {
    const correlationId = 'test-corr-gw-01';
    const res = await fetch(`${baseUrl}/telemetry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Gateway-Service-Token': SERVICE_TOKEN
      },
      body: JSON.stringify({
        tenantId: tenantApex.id,
        applicationId: activeApp.id,
        correlationId,
        method: 'GET',
        normalizedRoute: '/api/v1/accounts/summary',
        responseStatus: 200,
        durationMs: 14.2,
        requestSizeBytes: 120,
        responseSizeBytes: 450,
        clientIp: '192.168.1.100',
        validationOutcome: 'VALIDATED',
        forwardingResult: 'SUCCESS',
        routingDecision: {
          intendedAction: 'NORMAL_ROUTING',
          outcomeStatus: 'FORWARDED_TO_ORIGIN'
        }
      })
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.observationId);
    assert.ok(body.data.routingDecisionId);

    // Verify observation in PostgreSQL
    const savedObs = await prisma.securityObservation.findUnique({
      where: { id: body.data.observationId }
    });
    assert.ok(savedObs);
    assert.equal(savedObs.correlationId, correlationId);
    assert.equal(savedObs.evidenceProvenance, 'GATEWAY_REVERSE_PROXY');
    assert.equal(savedObs.sanitizedStructuredEvidence.responseStatus, 200);

    // Verify routing outcome in PostgreSQL
    const savedDecision = await prisma.routingDecision.findUnique({
      where: { id: body.data.routingDecisionId },
      include: { outcome: true }
    });
    assert.ok(savedDecision);
    assert.equal(savedDecision.intendedAction, 'NORMAL_ROUTING');
    assert.equal(savedDecision.outcome.outcomeStatus, 'FORWARDED_TO_ORIGIN');
  });
});
