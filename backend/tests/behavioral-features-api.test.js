/**
 * Stage 4B: Behavioral Features & Baselines REST API Integration Tests
 *
 * Verifies:
 * 1. Authenticated, tenant-scoped access to derived behavioral feature sets.
 * 2. Querying feature sets with filters (applicationId, windowLabel, sessionRef).
 * 3. Cross-tenant isolation (Tenant A user cannot access Tenant B's feature sets or baselines).
 * 4. Querying and calibrating behavioral baselines from historical observations.
 * 5. Rejection of unauthenticated requests (401 Unauthorized).
 */

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { getPrismaClient, connectDatabase } from '../src/db/client.js';
import argon2 from 'argon2';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgresql://rahulseervi/Documents/GitHub/Final-Year-Project...';

describe('Stage 4B: Behavioral Features & Baselines REST APIs', () => {
  let app;
  let server;
  let baseUrl;
  let prisma;

  let tenantA;
  let tenantB;
  let userA;
  let userB;
  let appA;
  let appB;

  let cookieA;
  let csrfTokenA;
  let cookieB;
  let csrfTokenB;

  let featureSetA;
  let baselineA;

  before(async () => {
    prisma = getPrismaClient({ databaseUrl: TEST_DATABASE_URL, forceNew: true });
    await connectDatabase(prisma);

    // Clean test records
    await prisma.behavioralFeatureSet.deleteMany({});
    await prisma.behavioralBaseline.deleteMany({});
    await prisma.session.deleteMany({});
    await prisma.securityObservation.deleteMany({});
    await prisma.protectedApplication.deleteMany({});
    await prisma.tenantMembership.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { in: ['feat-user-a@apex.test', 'feat-user-b@med.test'] } }
    });

    // Create tenants
    tenantA = await prisma.tenant.upsert({
      where: { identifier: 'tenant-feat-alpha' },
      update: {},
      create: { identifier: 'tenant-feat-alpha', displayName: 'Tenant Feature Alpha', status: 'ACTIVE' }
    });

    tenantB = await prisma.tenant.upsert({
      where: { identifier: 'tenant-feat-beta' },
      update: {},
      create: { identifier: 'tenant-feat-beta', displayName: 'Tenant Feature Beta', status: 'ACTIVE' }
    });

    // Create users & memberships
    const passwordHash = await argon2.hash('TestPass123!Secure');

    userA = await prisma.user.create({
      data: {
        email: 'feat-user-a@apex.test',
        name: 'User A',
        passwordHash,
        status: 'ACTIVE'
      }
    });

    await prisma.tenantMembership.create({
      data: {
        userId: userA.id,
        tenantId: tenantA.id,
        role: 'APPLICATION_OWNER',
        permissions: ['view:applications', 'manage:policies']
      }
    });

    userB = await prisma.user.create({
      data: {
        email: 'feat-user-b@med.test',
        name: 'User B',
        passwordHash,
        status: 'ACTIVE'
      }
    });

    await prisma.tenantMembership.create({
      data: {
        userId: userB.id,
        tenantId: tenantB.id,
        role: 'APPLICATION_OWNER',
        permissions: ['view:applications']
      }
    });

    // Create applications
    appA = await prisma.protectedApplication.create({
      data: {
        tenantId: tenantA.id,
        applicationIdentifier: 'app-feat-a',
        name: 'App Alpha',
        domain: 'alpha.test.internal',
        status: 'PROTECTED'
      }
    });

    appB = await prisma.protectedApplication.create({
      data: {
        tenantId: tenantB.id,
        applicationIdentifier: 'app-feat-b',
        name: 'App Beta',
        domain: 'beta.test.internal',
        status: 'PROTECTED'
      }
    });

    // Create seed feature set for Tenant A
    featureSetA = await prisma.behavioralFeatureSet.create({
      data: {
        tenantId: tenantA.id,
        applicationId: appA.id,
        sessionRef: 'sess-feat-01',
        windowLabel: '5m',
        windowDurationSeconds: 300,
        windowStart: new Date(Date.now() - 300000),
        windowEnd: new Date(),
        observationCount: 15,
        features: {
          request_count: { name: 'request_count', value: 15, type: 'COUNTER', unit: 'count' },
          request_rate_per_sec: { name: 'request_rate_per_sec', value: 0.05, type: 'RATE', unit: 'req/s' },
          http_4xx_ratio: { name: 'http_4xx_ratio', value: 0.0, type: 'RATIO', unit: 'ratio' }
        },
        qualityMetadata: { featureCompletenessRatio: 1.0, missingFieldTotal: 0 },
        sourceObservationIds: ['obs-01', 'obs-02']
      }
    });

    // Create seed baseline for Tenant A
    baselineA = await prisma.behavioralBaseline.create({
      data: {
        tenantId: tenantA.id,
        applicationId: appA.id,
        baselineVersion: '1.0.0',
        status: 'ESTABLISHED',
        observationCount: 75,
        sampleWindowHours: 24,
        metrics: {
          typicalRequestRate: 0.05,
          typicalEndpointDiversity: 0.25,
          typical4xxRatio: 0.0
        },
        establishedAt: new Date()
      }
    });

    // Start App Server
    app = createApp({
      prisma,
      envConfig: {
        NODE_ENV: 'test',
        PORT: 0,
        HOST: '127.0.0.1',
        SESSION_SECRET: 'test-session-secret-at-least-32-chars-long!',
        SESSION_TTL_HOURS: 24,
        COOKIE_NAME: 'adg_session',
        CORS_ORIGIN: ['http://localhost:3000']
      }
    });

    server = app.listen(0, '127.0.0.1');
    await new Promise((res) => server.once('listening', res));
    baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;

    // Login User A
    const loginResA = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'feat-user-a@apex.test', password: 'TestPass123!Secure' })
    });
    const setCookieA = loginResA.headers.get('set-cookie');
    cookieA = setCookieA ? setCookieA.split(';')[0] : '';
    const bodyA = await loginResA.json();
    csrfTokenA = bodyA.data.csrfToken;

    // Login User B
    const loginResB = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'feat-user-b@med.test', password: 'TestPass123!Secure' })
    });
    const setCookieB = loginResB.headers.get('set-cookie');
    cookieB = setCookieB ? setCookieB.split(';')[0] : '';
    const bodyB = await loginResB.json();
    csrfTokenB = bodyB.data.csrfToken;
  });

  after(async () => {
    if (server) await new Promise((res) => server.close(res));
  });

  test('1. Unauthenticated request to behavioral features returns 401', async () => {
    const res = await fetch(`${baseUrl}/tenants/${tenantA.id}/behavioral-features`);
    assert.equal(res.status, 401);
  });

  test('2. Authenticated user can list behavioral features for their tenant', async () => {
    const res = await fetch(`${baseUrl}/tenants/${tenantA.id}/behavioral-features`, {
      headers: {
        Cookie: cookieA,
        'X-CSRF-Token': csrfTokenA
      }
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].id, featureSetA.id);
    assert.equal(body.data[0].windowLabel, '5m');
    assert.equal(body.data[0].features.request_count.value, 15);
  });

  test('3. Querying feature set by ID succeeds within tenant scope', async () => {
    const res = await fetch(`${baseUrl}/tenants/${tenantA.id}/behavioral-features/${featureSetA.id}`, {
      headers: {
        Cookie: cookieA,
        'X-CSRF-Token': csrfTokenA
      }
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.id, featureSetA.id);
    assert.equal(body.data.sessionRef, 'sess-feat-01');
  });

  test('4. Cross-tenant isolation: User B cannot access Tenant A behavioral features', async () => {
    const res = await fetch(`${baseUrl}/tenants/${tenantA.id}/behavioral-features`, {
      headers: {
        Cookie: cookieB,
        'X-CSRF-Token': csrfTokenB
      }
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error.code, 'TENANT_ACCESS_DENIED');
  });

  test('5. Authenticated user can query behavioral baselines for their tenant', async () => {
    const res = await fetch(`${baseUrl}/tenants/${tenantA.id}/behavioral-baselines`, {
      headers: {
        Cookie: cookieA,
        'X-CSRF-Token': csrfTokenA
      }
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].status, 'ESTABLISHED');
    assert.equal(body.data[0].metrics.typicalRequestRate, 0.05);
  });

  test('6. Baseline calibration endpoint recomputes and stores baseline', async () => {
    // Seed 55 clean observations for App A
    const now = Date.now();
    for (let i = 0; i < 55; i++) {
      await prisma.securityObservation.create({
        data: {
          tenantId: tenantA.id,
          applicationId: appA.id,
          observationIdentifier: `obs-calib-${i}`,
          observationType: 'GATEWAY_REQUEST',
          evidenceProvenance: 'GATEWAY_REVERSE_PROXY',
          correlationId: `corr-calib-${i}`,
          observedAt: new Date(now - i * 60000),
          sanitizedStructuredEvidence: {
            method: 'GET',
            normalizedRoute: '/api/v1/accounts/summary',
            responseStatus: 200,
            forwardingResult: 'SUCCESS',
            validationOutcome: 'VALIDATED'
          }
        }
      });
    }

    const res = await fetch(`${baseUrl}/tenants/${tenantA.id}/behavioral-baselines/calibrate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieA,
        'X-CSRF-Token': csrfTokenA
      },
      body: JSON.stringify({ applicationId: appA.id, sampleWindowHours: 24 })
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'ESTABLISHED');
    assert.ok(body.data.observationCount >= 55);
    assert.ok(body.data.metrics.typicalRequestRate > 0);
  });
});
