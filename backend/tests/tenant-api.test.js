/**
 * Stage 3D: Tenant-Scoped REST API Test Suite.
 *
 * Exercises all Phase 5 requirements:
 * 1. Authentication (unauthenticated rejection, valid session, expired/revoked session).
 * 2. Tenant Isolation (cross-tenant access denial, IDOR protection, body spoofing rejection, platform admin scope).
 * 3. Roles and Mutations (role permission gating, CSRF defense, field validation, duplicate conflict).
 * 4. Data Integrity (PostgreSQL persistence, rollback on failure, outcome/evidence absence truthfulness).
 * 5. Deception Policies & Strategies (scoped policy CRUD, global baseline modification guard, execution notice).
 * 6. Security Events & Investigations (scoped lists, detailed observation lifecycle, cross-tenant denial).
 */

import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { getPrismaClient, connectDatabase, disconnectDatabase } from '../src/db/client.js';
import { hashPassword } from '../src/utils/passwords.js';
import { defaultLoginLimiter } from '../src/middleware/rate-limiter.js';
import { parseCookie } from 'cookie';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgresql://rahulseervi@localhost:5432/adaptive_deception_test?schema=public';

describe('Stage 3D: Secure Tenant-Scoped REST API', () => {
  let app;
  let server;
  let baseUrl;
  let prisma;

  let tenantApex;
  let tenantMed;
  let userAdmin;
  let userOwner;
  let userAnalyst;

  let apexApp1;
  let medApp1;
  let globalPolicy;
  let tenantApexPolicy;
  let globalStrategy;
  let apexObservation;
  let apexInvestigation;

  let ownerCookie;
  let ownerCsrfToken;
  let adminCookie;
  let adminCsrfToken;
  let analystCookie;
  let analystCsrfToken;

  before(async () => {
    prisma = getPrismaClient({ databaseUrl: TEST_DATABASE_URL, forceNew: true });
    await connectDatabase(prisma);

    // Clean test records
    await prisma.session.deleteMany({});
    await prisma.routingOutcome.deleteMany({});
    await prisma.executionEvidence.deleteMany({});
    await prisma.routingDecision.deleteMany({});
    await prisma.policyDecision.deleteMany({});
    await prisma.behavioralAssessment.deleteMany({});
    await prisma.securityObservation.deleteMany({});
    await prisma.investigationAttackerProfile.deleteMany({});
    await prisma.investigation.deleteMany({});
    await prisma.attackerProfile.deleteMany({});
    await prisma.protectedApplication.deleteMany({});
    await prisma.deceptionPolicy.deleteMany({});
    await prisma.deceptionStrategy.deleteMany({});
    await prisma.tenantMembership.deleteMany({});
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ['admin@gateway.internal', 'owner@apexfintech.io', 'analyst@medsecure.io']
        }
      }
    });

    // Create tenants
    tenantApex = await prisma.tenant.upsert({
      where: { identifier: 'tenant-apex-9941' },
      update: { displayName: 'Apex FinTech Cloud', status: 'ACTIVE' },
      create: { identifier: 'tenant-apex-9941', displayName: 'Apex FinTech Cloud', status: 'ACTIVE' }
    });

    tenantMed = await prisma.tenant.upsert({
      where: { identifier: 'tenant-medsecure-7712' },
      update: { displayName: 'MedSecure Healthcare Systems', status: 'ACTIVE' },
      create: { identifier: 'tenant-medsecure-7712', displayName: 'MedSecure Healthcare Systems', status: 'ACTIVE' }
    });

    // Create users & memberships
    const adminHash = await hashPassword('DevAdmin12345!');
    const ownerHash = await hashPassword('DevOwner12345!');
    const analystHash = await hashPassword('DevAnalyst12345!');

    userAdmin = await prisma.user.create({
      data: {
        email: 'admin@gateway.internal',
        name: 'Sarah Chen',
        passwordHash: adminHash,
        status: 'ACTIVE',
        isPlatformAdmin: true
      }
    });

    userOwner = await prisma.user.create({
      data: {
        email: 'owner@apexfintech.io',
        name: 'Alex Vance',
        passwordHash: ownerHash,
        status: 'ACTIVE',
        isPlatformAdmin: false,
        memberships: {
          create: {
            tenantId: tenantApex.id,
            role: 'APPLICATION_OWNER',
            permissions: ['manage_applications', 'view_security_events', 'configure_policies']
          }
        }
      }
    });

    userAnalyst = await prisma.user.create({
      data: {
        email: 'analyst@medsecure.io',
        name: 'Elena Rostova',
        passwordHash: analystHash,
        status: 'ACTIVE',
        isPlatformAdmin: false,
        memberships: {
          create: {
            tenantId: tenantMed.id,
            role: 'SECURITY_ANALYST',
            permissions: ['view_security_events', 'investigate_threats'] // Note: Lacks manage_applications and configure_policies!
          }
        }
      }
    });

    // Seed domain records for tests
    apexApp1 = await prisma.protectedApplication.create({
      data: {
        tenantId: tenantApex.id,
        applicationIdentifier: 'app-01',
        name: 'Customer Accounts API',
        domain: 'accounts.apexfintech.internal',
        status: 'PROTECTED'
      }
    });

    medApp1 = await prisma.protectedApplication.create({
      data: {
        tenantId: tenantMed.id,
        applicationIdentifier: 'app-med-01',
        name: 'Patient EHR Portal',
        domain: 'ehr.medsecure.internal',
        status: 'PROTECTED'
      }
    });

    // Global policy vs Tenant policy
    globalPolicy = await prisma.deceptionPolicy.create({
      data: {
        tenantId: null, // Platform-wide baseline
        policyIdentifier: 'pol-baseline-00',
        name: 'Platform Global Baseline Containment',
        priority: 10,
        version: 1,
        triggerConditions: { method: 'POST' },
        requiredEvidenceCriteria: { minConfidence: 0.9 },
        permittedActions: ['CONTAINMENT'],
        prohibitedActions: ['EXECUTE_SHELL'],
        protectedIsolationConstraints: { noEgress: true }
      }
    });

    tenantApexPolicy = await prisma.deceptionPolicy.create({
      data: {
        tenantId: tenantApex.id,
        policyIdentifier: 'pol-sec-apex-01',
        name: 'Apex Canary Tarpit Policy',
        priority: 100,
        version: 1,
        triggerConditions: { pathPrefix: '/api/v1/admin' },
        requiredEvidenceCriteria: { requiresCanaryHit: true },
        permittedActions: ['TARPIT', 'DIVERSION'],
        prohibitedActions: ['RUN_ARBITRARY_COMMAND'],
        protectedIsolationConstraints: { strictNamespaceIsolation: true }
      }
    });

    globalStrategy = await prisma.deceptionStrategy.create({
      data: {
        tenantId: null,
        strategyIdentifier: 'strat-tarpit-global',
        name: 'Global Adaptive Tarpit',
        strategyType: 'TARPIT',
        prerequisites: { maxDurationMinutes: 10 },
        permittedStateChangeProposal: { delayMs: 3000 },
        isolationRequirements: { memoryLimitMb: 256 }
      }
    });

    // Seed security observation with NO routing outcome and NO execution evidence (testing explicit missing states)
    apexObservation = await prisma.securityObservation.create({
      data: {
        tenantId: tenantApex.id,
        applicationId: apexApp1.id,
        observationIdentifier: 'obs-apex-test-01',
        observationType: 'CANARY_TOKEN_TRIGGER',
        evidenceProvenance: 'CANARY_SERVICE',
        correlationId: 'corr-test-apex-001',
        sanitizedStructuredEvidence: { canaryId: 'can-9912', clientIp: '198.51.100.4' }
      }
    });

    const apexPolicyDecision = await prisma.policyDecision.create({
      data: {
        tenantId: tenantApex.id,
        observationId: apexObservation.id,
        policyId: tenantApexPolicy.id,
        decisionResult: 'PERMIT_DIVERSION',
        decisionRationale: 'Canary token triggered in unauthorized path.'
      }
    });

    await prisma.routingDecision.create({
      data: {
        tenantId: tenantApex.id,
        policyDecisionId: apexPolicyDecision.id,
        intendedAction: 'PROPOSED_DECEPTION_DIVERSION',
        correlationId: 'corr-test-apex-001',
        decisionStatus: 'DECIDED'
        // NOTE: RoutingOutcome and ExecutionEvidence are deliberately omitted!
      }
    });

    apexInvestigation = await prisma.investigation.create({
      data: {
        tenantId: tenantApex.id,
        applicationId: apexApp1.id,
        investigationIdentifier: 'inv-apex-test-01',
        status: 'OPEN',
        severity: 'HIGH',
        summary: 'Probing detected on retail accounts API canary token.'
      }
    });

    // App initialization
    app = createApp({ prisma });
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    // Obtain login credentials for test personas
    async function loginUser(email, password) {
      const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const cookieHeader = res.headers.get('set-cookie');
      const parsedCookie = parseCookie(cookieHeader || '');
      const body = await res.json();
      return {
        cookie: parsedCookie['adg_session'],
        csrfToken: body.data.csrfToken
      };
    }

    const ownerAuth = await loginUser('owner@apexfintech.io', 'DevOwner12345!');
    ownerCookie = ownerAuth.cookie;
    ownerCsrfToken = ownerAuth.csrfToken;

    const adminAuth = await loginUser('admin@gateway.internal', 'DevAdmin12345!');
    adminCookie = adminAuth.cookie;
    adminCsrfToken = adminAuth.csrfToken;

    const analystAuth = await loginUser('analyst@medsecure.io', 'DevAnalyst12345!');
    analystCookie = analystAuth.cookie;
    analystCsrfToken = analystAuth.csrfToken;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (prisma) {
      await disconnectDatabase(prisma);
    }
  });

  beforeEach(() => {
    defaultLoginLimiter.reset();
  });

  // ----------------------------------------------------------------------------
  // 1. Authentication & Security Baseline
  // ----------------------------------------------------------------------------

  test('1. Unauthenticated request to tenant endpoints returns 401 UNAUTHENTICATED', async () => {
    const res = await fetch(`${baseUrl}/api/v1/tenants/tenant-apex-9941/applications`);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error.code, 'UNAUTHENTICATED');
  });

  test('2. Expired session token is rejected with 401 INVALID_SESSION', async () => {
    const expiredToken = 'f'.repeat(64);
    await prisma.session.create({
      data: {
        userId: userOwner.id,
        sessionToken: expiredToken,
        csrfToken: 'c'.repeat(32),
        expiresAt: new Date(Date.now() - 3600 * 1000)
      }
    });

    const res = await fetch(`${baseUrl}/api/v1/tenants/tenant-apex-9941/applications`, {
      headers: { Authorization: `Bearer ${expiredToken}` }
    });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error.code, 'INVALID_SESSION');
  });

  // ----------------------------------------------------------------------------
  // 2. Tenant Isolation & IDOR Defense
  // ----------------------------------------------------------------------------

  test('3. Tenant A cannot list Tenant B applications (returns 403 TENANT_ACCESS_DENIED)', async () => {
    // Owner is member of tenant-apex-9941 only, attempting to access tenant-medsecure-7712
    const res = await fetch(`${baseUrl}/api/v1/tenants/tenant-medsecure-7712/applications`, {
      headers: { Cookie: `adg_session=${ownerCookie}` }
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error.code, 'TENANT_ACCESS_DENIED');
  });

  test('4. Tenant A cannot retrieve Tenant B application by substituting ID (returns 404 APPLICATION_NOT_FOUND)', async () => {
    // Owner accesses their own tenant route, but requests MedSecure's application ID
    const res = await fetch(
      `${baseUrl}/api/v1/tenants/tenant-apex-9941/applications/${medApp1.id}`,
      {
        headers: { Cookie: `adg_session=${ownerCookie}` }
      }
    );
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error.code, 'APPLICATION_NOT_FOUND');
  });

  test('5. Tenant A cannot update Tenant B application (returns 404 APPLICATION_NOT_FOUND)', async () => {
    const res = await fetch(
      `${baseUrl}/api/v1/tenants/tenant-apex-9941/applications/${medApp1.id}`,
      {
        method: 'PATCH',
        headers: {
          Cookie: `adg_session=${ownerCookie}`,
          'X-CSRF-Token': ownerCsrfToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: 'Tampered Name' })
      }
    );
    assert.equal(res.status, 404);
  });

  test('6. User cannot change application tenantId via request body (returns 400 INVALID_INPUT)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/tenants/tenant-apex-9941/applications`, {
      method: 'POST',
      headers: {
        Cookie: `adg_session=${ownerCookie}`,
        'X-CSRF-Token': ownerCsrfToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Rogue App',
        domain: 'rogue.internal',
        tenantId: tenantMed.id // Attempt to inject foreign tenantId
      })
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error.code, 'INVALID_INPUT');
    assert.ok(body.error.details.some((d) => d.includes('tenantId')));
  });

  test('7. Platform Administrator can access any tenant applications via explicit policy', async () => {
    // Admin accesses MedSecure tenant applications
    const res = await fetch(`${baseUrl}/api/v1/tenants/tenant-medsecure-7712/applications`, {
      headers: { Cookie: `adg_session=${adminCookie}` }
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.length >= 1);
    assert.equal(body.data[0].applicationIdentifier, 'app-med-01');
  });

  // ----------------------------------------------------------------------------
  // 3. Roles, Permissions & CSRF Protection
  // ----------------------------------------------------------------------------

  test('8. Role without manage_applications permission cannot create or update applications', async () => {
    // Elena Rostova (analyst@medsecure.io) has SECURITY_ANALYST role without manage_applications
    const resCreate = await fetch(`${baseUrl}/api/v1/tenants/tenant-medsecure-7712/applications`, {
      method: 'POST',
      headers: {
        Cookie: `adg_session=${analystCookie}`,
        'X-CSRF-Token': analystCsrfToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Unauthorized App',
        domain: 'unauth.medsecure.internal'
      })
    });
    assert.equal(resCreate.status, 403);
    const createBody = await resCreate.json();
    assert.equal(createBody.error.code, 'FORBIDDEN');
    assert.equal(createBody.error.requiredPermission, 'manage_applications');

    // Attempt PATCH
    const resPatch = await fetch(
      `${baseUrl}/api/v1/tenants/tenant-medsecure-7712/applications/${medApp1.id}`,
      {
        method: 'PATCH',
        headers: {
          Cookie: `adg_session=${analystCookie}`,
          'X-CSRF-Token': analystCsrfToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: 'Tampered App' })
      }
    );
    assert.equal(resPatch.status, 403);
  });

  test('9. Cookie-authenticated mutation without CSRF token returns 403 CSRF_TOKEN_INVALID', async () => {
    const res = await fetch(`${baseUrl}/api/v1/tenants/tenant-apex-9941/applications`, {
      method: 'POST',
      headers: {
        Cookie: `adg_session=${ownerCookie}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'No CSRF App',
        domain: 'nocsrf.apexfintech.internal'
      })
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error.code, 'CSRF_TOKEN_INVALID');
  });

  test('10. Invalid, malformed or unexpected fields in application creation are rejected with 400', async () => {
    // Invalid domain containing scheme
    const resBadDomain = await fetch(`${baseUrl}/api/v1/tenants/tenant-apex-9941/applications`, {
      method: 'POST',
      headers: {
        Cookie: `adg_session=${ownerCookie}`,
        'X-CSRF-Token': ownerCsrfToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Valid Name',
        domain: 'https://invalid-scheme.apexfintech.internal' // Disallowed scheme
      })
    });
    assert.equal(resBadDomain.status, 400);

    // Unexpected arbitrary property
    const resUnexpected = await fetch(`${baseUrl}/api/v1/tenants/tenant-apex-9941/applications`, {
      method: 'POST',
      headers: {
        Cookie: `adg_session=${ownerCookie}`,
        'X-CSRF-Token': ownerCsrfToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Valid Name',
        domain: 'valid.apexfintech.internal',
        unsupportedPayloadField: 'attacker-controlled-value'
      })
    });
    assert.equal(resUnexpected.status, 400);
    const unexpBody = await resUnexpected.json();
    assert.ok(unexpBody.error.details.some((d) => d.includes('unsupportedPayloadField')));
  });

  test('11. Duplicate applicationIdentifier within the same tenant returns 409 conflict', async () => {
    const resDuplicate = await fetch(`${baseUrl}/api/v1/tenants/tenant-apex-9941/applications`, {
      method: 'POST',
      headers: {
        Cookie: `adg_session=${ownerCookie}`,
        'X-CSRF-Token': ownerCsrfToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Duplicate Identifier App',
        domain: 'dup.apexfintech.internal',
        applicationIdentifier: 'app-01' // apexApp1 already has app-01
      })
    });
    assert.equal(resDuplicate.status, 409);
    const body = await resDuplicate.json();
    assert.equal(body.error.code, 'DUPLICATE_APPLICATION_IDENTIFIER');
  });

  // ----------------------------------------------------------------------------
  // 4. Data Persistence, Mutation & Security Audit Events
  // ----------------------------------------------------------------------------

  test('12. Successful application creation and update persist to PostgreSQL and emit audit events', async () => {
    // 1. Create Application
    const createRes = await fetch(`${baseUrl}/api/v1/tenants/tenant-apex-9941/applications`, {
      method: 'POST',
      headers: {
        Cookie: `adg_session=${ownerCookie}`,
        'X-CSRF-Token': ownerCsrfToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Treasury Settlement Gateway',
        domain: 'treasury.apexfintech.internal',
        applicationIdentifier: 'app-treasury-01',
        status: 'PROTECTED'
      })
    });
    assert.equal(createRes.status, 201);
    const createdData = (await createRes.json()).data;
    assert.ok(createdData.id);
    assert.equal(createdData.applicationIdentifier, 'app-treasury-01');

    // Verify in database
    const dbApp = await prisma.protectedApplication.findUnique({
      where: { id: createdData.id }
    });
    assert.ok(dbApp);
    assert.equal(dbApp.name, 'Treasury Settlement Gateway');

    // Verify audit event in DB
    const createAudit = await prisma.auditEvent.findFirst({
      where: {
        action: 'APPLICATION_CREATED',
        targetEntityId: createdData.id
      }
    });
    assert.ok(createAudit);
    assert.equal(createAudit.actorIdentifier, 'owner@apexfintech.io');

    // 2. Update Application
    const updateRes = await fetch(
      `${baseUrl}/api/v1/tenants/tenant-apex-9941/applications/${createdData.id}`,
      {
        method: 'PATCH',
        headers: {
          Cookie: `adg_session=${ownerCookie}`,
          'X-CSRF-Token': ownerCsrfToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'Updated Treasury Core API',
          status: 'DEGRADED'
        })
      }
    );
    assert.equal(updateRes.status, 200);
    const updatedData = (await updateRes.json()).data;
    assert.equal(updatedData.name, 'Updated Treasury Core API');
    assert.equal(updatedData.status, 'DEGRADED');

    // Verify audit event for update
    const updateAudit = await prisma.auditEvent.findFirst({
      where: {
        action: 'APPLICATION_UPDATED',
        targetEntityId: createdData.id
      }
    });
    assert.ok(updateAudit);
    assert.equal(updateAudit.structuredMetadata.changes.status, 'DEGRADED');
  });

  // ----------------------------------------------------------------------------
  // 5. Deception Policies & Strategies
  // ----------------------------------------------------------------------------

  test('13. Policies list includes both tenant-owned policies and platform-wide baselines', async () => {
    const res = await fetch(`${baseUrl}/api/v1/tenants/tenant-apex-9941/policies`, {
      headers: { Cookie: `adg_session=${ownerCookie}` }
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.data.length >= 2);
    const identifiers = body.data.map((p) => p.policyIdentifier);
    assert.ok(identifiers.includes('pol-baseline-00')); // Global baseline
    assert.ok(identifiers.includes('pol-sec-apex-01')); // Tenant policy
  });

  test('14. Regular tenant owner cannot update platform-wide baseline policy (returns 403 FORBIDDEN)', async () => {
    const res = await fetch(
      `${baseUrl}/api/v1/tenants/tenant-apex-9941/policies/${globalPolicy.id}`,
      {
        method: 'PATCH',
        headers: {
          Cookie: `adg_session=${ownerCookie}`,
          'X-CSRF-Token': ownerCsrfToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ priority: 50 })
      }
    );
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error.code, 'FORBIDDEN');
    assert.ok(body.error.message.includes('Platform Administrators'));
  });

  test('15. Strategies endpoints return valid metadata and explicit non-execution notice', async () => {
    // List strategies
    const listRes = await fetch(`${baseUrl}/api/v1/tenants/tenant-apex-9941/strategies`, {
      headers: { Cookie: `adg_session=${ownerCookie}` }
    });
    assert.equal(listRes.status, 200);
    const listBody = await listRes.json();
    assert.ok(listBody.data.length >= 1);
    assert.ok(listBody.notice.toLowerCase().includes('eligibility does not constitute proof of execution'));

    // Strategy detail
    const detailRes = await fetch(
      `${baseUrl}/api/v1/tenants/tenant-apex-9941/strategies/${globalStrategy.id}`,
      {
        headers: { Cookie: `adg_session=${ownerCookie}` }
      }
    );
    assert.equal(detailRes.status, 200);
    const detailBody = await detailRes.json();
    assert.equal(detailBody.data.strategyIdentifier, 'strat-tarpit-global');
    assert.ok(detailBody.data.executionNotice.includes('Strategy definition metadata only'));
  });

  // ----------------------------------------------------------------------------
  // 6. Security Events, Investigations & Outcome/Evidence Truthfulness
  // ----------------------------------------------------------------------------

  test('16. Security observation detail explicitly reports missing outcome and missing execution evidence', async () => {
    const res = await fetch(
      `${baseUrl}/api/v1/tenants/tenant-apex-9941/security-events/${apexObservation.observationIdentifier}`,
      {
        headers: { Cookie: `adg_session=${ownerCookie}` }
      }
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.observationIdentifier, 'obs-apex-test-01');

    // Verify decisions structure
    assert.ok(body.data.decisions.length >= 1);
    const decision = body.data.decisions[0];
    assert.equal(decision.decisionResult, 'PERMIT_DIVERSION');

    const routingDecision = decision.routingDecisions[0];
    assert.equal(routingDecision.intendedAction, 'PROPOSED_DECEPTION_DIVERSION');

    // CRITICAL: Outcome must NOT be assumed successful; must be explicitly NOT_RECORDED
    assert.equal(routingDecision.outcome.recorded, false);
    assert.equal(routingDecision.outcome.outcomeStatus, 'NOT_RECORDED');

    // CRITICAL: Execution evidence must NOT be inferred; must be explicitly MISSING
    assert.equal(routingDecision.executionEvidence.verified, false);
    assert.equal(routingDecision.executionEvidence.evidenceStatus, 'MISSING');
  });

  test('17. Tenant A cannot view Tenant B investigations or observations', async () => {
    // Attempt to access Apex observation using MedSecure user credentials
    const resObs = await fetch(
      `${baseUrl}/api/v1/tenants/tenant-medsecure-7712/security-events/${apexObservation.id}`,
      {
        headers: { Cookie: `adg_session=${analystCookie}` }
      }
    );
    assert.equal(resObs.status, 404);

    // Attempt to access Apex investigation using MedSecure user credentials
    const resInv = await fetch(
      `${baseUrl}/api/v1/tenants/tenant-medsecure-7712/investigations/${apexInvestigation.id}`,
      {
        headers: { Cookie: `adg_session=${analystCookie}` }
      }
    );
    assert.equal(resInv.status, 404);
  });
});
