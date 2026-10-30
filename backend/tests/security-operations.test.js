/**
 * Stage 3F: Security Operations Integration Test Suite.
 *
 * Verifies all security operations endpoints and semantic integrity requirements:
 * 1. Attacker Behavior Profiles: Tenant scoping, query boundary enforcement, cross-tenant rejection, attribution disclaimer.
 * 2. Deception Policy Management: Scoped CRUD, platform baseline read-only restriction for tenant owners, platform admin modification.
 * 3. Security Events & Observations: Explicit NOT_RECORDED outcome and MISSING execution evidence semantics.
 * 4. Threat Investigations: Scoped listing, detail retrieval, linked profiles, cross-tenant isolation.
 * 5. Deception Strategies: Metadata retrieval, execution disclaimer, read-only guarantees.
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

describe('Stage 3F: Security Operations Endpoints & Semantic Integrity', () => {
  let app;
  let server;
  let baseUrl;
  let prisma;

  let tenantApex;
  let tenantMed;
  let userAdmin;
  let userOwner;
  let userAnalyst;

  let apexApp;
  let baselinePolicy;
  let apexPolicy;
  let globalStrategy;
  let apexProfile;
  let medProfile;
  let apexInvestigation;
  let apexObservationUnconfirmed;

  let ownerCookie;
  let ownerCsrfToken;
  let adminCookie;
  let adminCsrfToken;

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
          in: ['secops-admin@gateway.internal', 'secops-owner@apexfintech.io', 'secops-analyst@medsecure.io']
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

    // Create test users
    const adminHash = await hashPassword('DevAdmin12345!');
    const ownerHash = await hashPassword('DevOwner12345!');

    userAdmin = await prisma.user.create({
      data: {
        email: 'secops-admin@gateway.internal',
        name: 'Sarah Chen (Platform Admin)',
        passwordHash: adminHash,
        status: 'ACTIVE',
        isPlatformAdmin: true
      }
    });

    userOwner = await prisma.user.create({
      data: {
        email: 'secops-owner@apexfintech.io',
        name: 'Alex Vance (Tenant Owner)',
        passwordHash: ownerHash,
        status: 'ACTIVE',
        isPlatformAdmin: false,
        memberships: {
          create: {
            tenantId: tenantApex.id,
            role: 'APPLICATION_OWNER',
            permissions: ['manage_applications', 'view_security_events', 'configure_policies', 'investigate_threats']
          }
        }
      }
    });

    // Seed protected app
    apexApp = await prisma.protectedApplication.create({
      data: {
        tenantId: tenantApex.id,
        applicationIdentifier: 'app-apex-sec-01',
        name: 'Customer Accounts API',
        domain: 'accounts.apexfintech.internal',
        status: 'PROTECTED'
      }
    });

    // Seed baseline policy (tenantId === null)
    baselinePolicy = await prisma.deceptionPolicy.create({
      data: {
        tenantId: null,
        policyIdentifier: 'pol-baseline-sec-01',
        name: 'Global Edge Firewall Containment Baseline',
        description: 'Platform-wide security baseline rule.',
        enabled: true,
        priority: 10,
        version: 1,
        triggerConditions: { method: 'POST', pathPrefix: '/api/v1/auth' },
        requiredEvidenceCriteria: { minConfidenceScore: 0.85 },
        permittedActions: ['CONTAINMENT'],
        prohibitedActions: ['EXECUTE_SHELL'],
        protectedIsolationConstraints: { egressDrop: true }
      }
    });

    // Seed tenant-scoped policy
    apexPolicy = await prisma.deceptionPolicy.create({
      data: {
        tenantId: tenantApex.id,
        policyIdentifier: 'pol-apex-sec-custom',
        name: 'Apex Custom Tarpit Diversion',
        description: 'Custom tenant diversion rule.',
        enabled: true,
        priority: 50,
        version: 1,
        triggerConditions: { rateLimitExceeded: true },
        requiredEvidenceCriteria: { minConfidenceScore: 0.75 },
        permittedActions: ['DIVERSION', 'TARPIT'],
        prohibitedActions: ['MODIFY_PRODUCTION_DATA'],
        protectedIsolationConstraints: { namespace: 'apex-ns' }
      }
    });

    // Seed global strategy
    globalStrategy = await prisma.deceptionStrategy.create({
      data: {
        tenantId: null,
        strategyIdentifier: 'strat-sec-tarpit-01',
        name: 'Adaptive Ingress Tarpit',
        description: 'Injects incremental response delays.',
        strategyType: 'TARPIT',
        enabled: true,
        prerequisites: { minVelocity: 10 },
        permittedStateChangeProposal: { action: 'INJECT_LATENCY', delayMs: 1500 },
        isolationRequirements: { timeoutMs: 8000 }
      }
    });

    // Seed attacker profiles
    apexProfile = await prisma.attackerProfile.create({
      data: {
        tenantId: tenantApex.id,
        profileIdentifier: 'prof-sec-apex-01',
        displayLabel: 'SUSPECT-CRED-STUFFER-901 (Heuristic Profile)',
        observedBehaviorIndicators: {
          userAgentSignatures: ['Go-http-client/1.1'],
          targetedPaths: ['/api/v1/auth/login']
        },
        firstSeenAt: new Date(Date.now() - 3600000),
        lastSeenAt: new Date()
      }
    });

    medProfile = await prisma.attackerProfile.create({
      data: {
        tenantId: tenantMed.id,
        profileIdentifier: 'prof-sec-med-02',
        displayLabel: 'APT-RECON-MED-02 (Heuristic Profile)',
        observedBehaviorIndicators: {
          targetedPaths: ['/ehr/patient/records']
        },
        firstSeenAt: new Date(Date.now() - 7200000),
        lastSeenAt: new Date()
      }
    });

    // Seed investigation with linked profile
    apexInvestigation = await prisma.investigation.create({
      data: {
        tenantId: tenantApex.id,
        applicationId: apexApp.id,
        investigationIdentifier: 'inv-sec-801',
        status: 'OPEN',
        severity: 'HIGH',
        summary: 'Credential stuffing correlation dossier.',
        evidenceReferences: { uniqueIps: 12 }
      }
    });

    await prisma.investigationAttackerProfile.create({
      data: {
        tenantId: tenantApex.id,
        investigationId: apexInvestigation.id,
        attackerProfileId: apexProfile.id
      }
    });

    // Seed observation with unconfirmed telemetry (missing outcome & missing execution)
    apexObservationUnconfirmed = await prisma.securityObservation.create({
      data: {
        tenantId: tenantApex.id,
        applicationId: apexApp.id,
        investigationId: apexInvestigation.id,
        observationIdentifier: 'obs-sec-unconfirmed-99',
        observationType: 'HTTP_PROBE_ANOMALY',
        sanitizedStructuredEvidence: { path: '/api/v1/auth', method: 'POST' },
        evidenceProvenance: 'EDGE_SUPERVISOR',
        correlationId: 'req-corr-sec-99',
        evidenceStatus: 'OBSERVED'
      }
    });

    const apexAssessment = await prisma.behavioralAssessment.create({
      data: {
        tenantId: tenantApex.id,
        observationId: apexObservationUnconfirmed.id,
        investigationId: apexInvestigation.id,
        classification: 'CREDENTIAL_STUFFING',
        riskScore: 0.88,
        confidenceScore: 0.92,
        modelOrRuleVersion: 'detector-v2'
      }
    });

    const apexPolicyDec = await prisma.policyDecision.create({
      data: {
        tenantId: tenantApex.id,
        observationId: apexObservationUnconfirmed.id,
        assessmentId: apexAssessment.id,
        policyId: apexPolicy.id,
        decisionResult: 'RECOMMEND_DIVERSION',
        decisionRationale: 'Policy conditions matched.'
      }
    });

    await prisma.routingDecision.create({
      data: {
        tenantId: tenantApex.id,
        policyDecisionId: apexPolicyDec.id,
        intendedAction: 'DIVERSION',
        correlationId: 'req-corr-sec-99',
        decisionStatus: 'DECISION_PROPOSED'
        // NOTE: Deliberately NO outcome and NO executionEvidence created here!
      }
    });

    // Launch Express test server
    app = createApp({ prisma });
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}/api/v1`;
        resolve();
      });
    });

    // Login Owner
    const ownerLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'secops-owner@apexfintech.io', password: 'DevOwner12345!' })
    });
    assert.strictEqual(ownerLoginRes.status, 200);
    const ownerCookieHeader = ownerLoginRes.headers.get('set-cookie');
    const parsedOwnerCookie = parseCookie(ownerCookieHeader || '');
    ownerCookie = `adg_session=${parsedOwnerCookie.adg_session}`;
    const ownerBody = await ownerLoginRes.json();
    ownerCsrfToken = ownerBody.data.csrfToken;

    // Login Platform Admin
    const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'secops-admin@gateway.internal', password: 'DevAdmin12345!' })
    });
    assert.strictEqual(adminLoginRes.status, 200);
    const adminCookieHeader = adminLoginRes.headers.get('set-cookie');
    const parsedAdminCookie = parseCookie(adminCookieHeader || '');
    adminCookie = `adg_session=${parsedAdminCookie.adg_session}`;
    const adminBody = await adminLoginRes.json();
    adminCsrfToken = adminBody.data.csrfToken;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDatabase(prisma);
  });

  beforeEach(() => {
    defaultLoginLimiter.reset();
  });

  // --------------------------------------------------------------------------
  // 1. Attacker Behavior Profiles Endpoints & Isolation
  // --------------------------------------------------------------------------
  describe('Attacker Behavior Profiles', () => {
    test('Tenant owner can list attacker profiles scoped to their tenant with attribution disclaimer', async () => {
      const res = await fetch(`${baseUrl}/tenants/${tenantApex.identifier}/attacker-profiles`, {
        headers: { Cookie: ownerCookie }
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.ok(Array.isArray(body.data));
      assert.strictEqual(body.data.length, 1);
      assert.strictEqual(body.data[0].profileIdentifier, 'prof-sec-apex-01');
      assert.ok(body.notice.includes('statistical anomaly clustering'));
      assert.ok(body.notice.includes('NOT confirmed human identity'));
    });

    test('Tenant owner cannot access foreign tenant attacker profiles (cross-tenant isolation)', async () => {
      // Direct IDOR attempt: Apex owner queries Med profile via Apex tenant path
      const res = await fetch(`${baseUrl}/tenants/${tenantApex.identifier}/attacker-profiles/${medProfile.profileIdentifier}`, {
        headers: { Cookie: ownerCookie }
      });
      assert.strictEqual(res.status, 404);
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, 'ATTACKER_PROFILE_NOT_FOUND');
    });

    test('Tenant owner cannot query foreign tenant scope directly (403 forbidden)', async () => {
      const res = await fetch(`${baseUrl}/tenants/${tenantMed.identifier}/attacker-profiles`, {
        headers: { Cookie: ownerCookie }
      });
      assert.strictEqual(res.status, 403);
    });

    test('Tenant owner can retrieve single profile with linked investigations', async () => {
      const res = await fetch(`${baseUrl}/tenants/${tenantApex.identifier}/attacker-profiles/${apexProfile.profileIdentifier}`, {
        headers: { Cookie: ownerCookie }
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.profileIdentifier, 'prof-sec-apex-01');
      assert.ok(Array.isArray(body.data.investigations));
      assert.strictEqual(body.data.investigations.length, 1);
      assert.strictEqual(body.data.investigations[0].investigationIdentifier, 'inv-sec-801');
    });
  });

  // --------------------------------------------------------------------------
  // 2. Deception Policy Baseline Modification Guard
  // --------------------------------------------------------------------------
  describe('Deception Policies & Baseline Protection', () => {
    test('Tenant owner attempting to update platform baseline policy is rejected with 403 FORBIDDEN', async () => {
      const res = await fetch(`${baseUrl}/tenants/${tenantApex.identifier}/policies/${baselinePolicy.policyIdentifier}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: ownerCookie,
          'x-csrf-token': ownerCsrfToken
        },
        body: JSON.stringify({ priority: 20 })
      });
      assert.strictEqual(res.status, 403);
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, 'FORBIDDEN');
      assert.ok(body.error.message.includes('Platform Administrators'));
    });

    test('Platform administrator CAN update platform baseline policy', async () => {
      const res = await fetch(`${baseUrl}/tenants/${tenantApex.identifier}/policies/${baselinePolicy.policyIdentifier}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
          'x-csrf-token': adminCsrfToken
        },
        body: JSON.stringify({ priority: 15, description: 'Updated by Platform Admin.' })
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.priority, 15);
    });

    test('Tenant owner can create and update tenant-scoped policy', async () => {
      const createRes = await fetch(`${baseUrl}/tenants/${tenantApex.identifier}/policies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: ownerCookie,
          'x-csrf-token': ownerCsrfToken
        },
        body: JSON.stringify({
          policyIdentifier: 'pol-sec-owner-test',
          name: 'Owner Test Diversion Policy',
          description: 'Created by owner',
          priority: 80,
          enabled: true,
          triggerConditions: { test: true },
          requiredEvidenceCriteria: { minConf: 0.8 },
          permittedActions: ['DIVERSION'],
          prohibitedActions: ['EXECUTE_SHELL'],
          protectedIsolationConstraints: { dropEgress: true }
        })
      });
      assert.strictEqual(createRes.status, 201);
      const createBody = await createRes.json();
      assert.strictEqual(createBody.success, true);
      assert.strictEqual(createBody.data.policyIdentifier, 'pol-sec-owner-test');

      // Update the created policy
      const updateRes = await fetch(`${baseUrl}/tenants/${tenantApex.identifier}/policies/pol-sec-owner-test`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: ownerCookie,
          'x-csrf-token': ownerCsrfToken
        },
        body: JSON.stringify({ priority: 95 })
      });
      assert.strictEqual(updateRes.status, 200);
      const updateBody = await updateRes.json();
      assert.strictEqual(updateBody.data.priority, 95);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Security Events & Observations: Explicit Absence Semantics
  // --------------------------------------------------------------------------
  describe('Security Events Semantic Transparency', () => {
    test('Unconfirmed observation returns explicit NOT_RECORDED outcome and MISSING execution evidence', async () => {
      const res = await fetch(`${baseUrl}/tenants/${tenantApex.identifier}/security-events/${apexObservationUnconfirmed.observationIdentifier}`, {
        headers: { Cookie: ownerCookie }
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);

      const decision = body.data.decisions[0];
      assert.ok(decision);
      const routing = decision.routingDecisions[0];
      assert.ok(routing);

      // Outcome absence truthfulness
      assert.strictEqual(routing.outcome.recorded, false);
      assert.strictEqual(routing.outcome.outcomeStatus, 'NOT_RECORDED');
      assert.ok(routing.outcome.notice.includes('No routing outcome has been recorded'));

      // Execution evidence absence truthfulness
      assert.strictEqual(routing.executionEvidence.verified, false);
      assert.strictEqual(routing.executionEvidence.evidenceStatus, 'MISSING');
      assert.ok(routing.executionEvidence.notice.includes('No telemetry or execution evidence'));
    });
  });

  // --------------------------------------------------------------------------
  // 4. Deception Strategies Metadata & Execution Notice
  // --------------------------------------------------------------------------
  describe('Deception Strategies Metadata', () => {
    test('Strategies endpoint returns definition notice that eligibility != execution', async () => {
      const res = await fetch(`${baseUrl}/tenants/${tenantApex.identifier}/strategies`, {
        headers: { Cookie: ownerCookie }
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.ok(Array.isArray(body.data));
      assert.strictEqual(
        body.notice,
        'Strategy definition metadata only. Strategy eligibility does not constitute proof of execution.'
      );
    });
  });

  // --------------------------------------------------------------------------
  // 5. Threat Investigations Scoping & Cross-Tenant Rejection
  // --------------------------------------------------------------------------
  describe('Threat Investigations', () => {
    test('Investigations list includes linked attacker profiles', async () => {
      const res = await fetch(`${baseUrl}/tenants/${tenantApex.identifier}/investigations`, {
        headers: { Cookie: ownerCookie }
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.ok(Array.isArray(body.data));
      assert.strictEqual(body.data[0].investigationIdentifier, 'inv-sec-801');
      assert.strictEqual(body.data[0].attackerProfiles.length, 1);
      assert.strictEqual(body.data[0].attackerProfiles[0].profileIdentifier, 'prof-sec-apex-01');
    });

    test('Investigation details endpoint returns full dossier with observations', async () => {
      const res = await fetch(`${baseUrl}/tenants/${tenantApex.identifier}/investigations/${apexInvestigation.investigationIdentifier}`, {
        headers: { Cookie: ownerCookie }
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.investigationIdentifier, 'inv-sec-801');
      assert.strictEqual(body.data.status, 'OPEN');
      assert.ok(body.data.observations);
    });
  });
});
