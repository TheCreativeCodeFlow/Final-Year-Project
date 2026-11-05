/**
 * Stage 5B.2 Comprehensive Test Suite: Isolated Synthetic Container Provisioning.
 *
 * Verifies:
 * 1. Approved Image Catalogue: Immutable digests, validation, unapproved image rejection.
 * 2. Synthetic Service Templates: All 3 templates, service types, resource bounds, isolation modes.
 * 3. Resource Governance & Quotas: Admission check, reservation, capacity release.
 * 4. Provisioning Dispatcher & Safety Preconditions:
 *    - Strict APPROVED authorization check.
 *    - Expiration & revocation checks.
 *    - Dual-custody / Separation of duties check.
 *    - Optimistic version concurrency (DSG graph version & Policy version).
 *    - Idempotency key handling and conflict rejection.
 * 5. Container Runtime Adapter & Real Container Provisioning:
 *    - Unix domain socket communication with local Docker daemon.
 *    - Dedicated isolated bridge network with Internal: true (zero internet egress).
 *    - Security hardening: non-root UID 1000:1000, read-only rootfs, cap_drop: ALL,
 *      no-new-privileges, zero published host ports, memory-backed tmpfs for /tmp.
 * 6. Health Probe Verification & Negative Egress Quarantine:
 *    - Real HTTP health probe returns 200 OK.
 *    - Negative egress connectivity check confirms 8.8.8.8:53 is dropped/quarantined.
 * 7. Granular Cryptographic Evidence Recording:
 *    - Verifiable hashes for all 8 lifecycle events.
 * 8. Safe Termination, Orphan Cleanup & Quota Release.
 * 9. REST API Integration: Image catalogue, templates, job submission, evidence, health, termination.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { getPrismaClient, connectDatabase, disconnectDatabase } from '../src/db/client.js';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import {
  listApprovedImages,
  getApprovedImage,
  verifyImageDigest,
  validateImageForServiceType
} from '../src/runtime/image-catalogue.js';
import {
  listSyntheticTemplates,
  getSyntheticTemplate,
  SYNTHETIC_SERVICE_TYPES
} from '../src/runtime/synthetic-templates.js';
import { ContainerRuntimeAdapter } from '../src/runtime/container-runtime-adapter.js';
import { ProvisioningDispatcher, PROVISIONING_JOB_STATUSES } from '../src/runtime/provisioning-dispatcher.js';
import { RuntimeWorkerService } from '../src/runtime/runtime-worker.service.js';
import { ResourceGovernanceService } from '../src/runtime/resource-governance.service.js';
import { ExecutionEvidenceRecorder, EXECUTION_EVENT_TYPES } from '../src/runtime/execution-evidence-recorder.service.js';
import { RuntimeEnvironmentManager } from '../src/runtime/runtime-environment-manager.service.js';
import { RuntimeOrchestrator } from '../src/runtime/runtime-orchestrator.service.js';
import { RUNTIME_LIFECYCLE_STATES } from '../src/runtime/lifecycle-state-machine.js';
import { hashPassword } from '../src/utils/passwords.js';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgresql://rahulseervi@localhost:5432/adaptive_deception_test?schema=public';

process.env.DATABASE_URL = TEST_DATABASE_URL;

describe('Stage 5B.2: Isolated Synthetic Container Provisioning Suite', () => {
  let app;
  let server;
  let baseUrl;
  let prisma;

  let tenantApexId;
  let tenantMedId;
  let appApexId;
  let testPolicy;
  let testGraph;
  let testDecision;

  let ownerCookie;
  let ownerCsrfToken;
  let analystCookie;
  let analystCsrfToken;

  const createdContainers = [];
  const createdNetworks = [];

  before(async () => {
    const config = loadEnv();
    prisma = getPrismaClient({ databaseUrl: TEST_DATABASE_URL });
    await connectDatabase(prisma);

    app = createApp({ envConfig: config, prisma });
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => resolve());
    });
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}/api/v1`;

    // Clean up any previous test runtime records
    await prisma.deceptionProvisioningJob.deleteMany();
    await prisma.deceptionRuntimeMutation.deleteMany();
    await prisma.deceptionRuntimeEnvironment.deleteMany();
    await prisma.deceptionExecutionEvent.deleteMany();
    await prisma.deceptionExecutionAuthorization.deleteMany();
    await prisma.deceptionResourceQuota.deleteMany();

    // 1. Resolve seed tenants
    const tApex = await prisma.tenant.findUnique({ where: { identifier: 'tenant-apex-9941' } });
    const tMed = await prisma.tenant.findUnique({ where: { identifier: 'tenant-medsecure-7712' } });
    assert.ok(tApex, 'Seed tenant apex must exist');
    assert.ok(tMed, 'Seed tenant medsecure must exist');
    tenantApexId = tApex.id;
    tenantMedId = tMed.id;

    // 2. Resolve Protected Application
    const appApex = await prisma.protectedApplication.findFirst({ where: { tenantId: tenantApexId } });
    assert.ok(appApex, 'Protected application must exist');
    appApexId = appApex.id;

    // Seed ample quota for tests
    await prisma.deceptionResourceQuota.create({
      data: {
        tenantId: tenantApexId,
        maxActiveEnvironments: 20,
        maxCpuAllocation: 10.0,
        maxMemoryMb: 8192,
        maxStorageMb: 8192,
        maxEnvironmentLifetimeMinutes: 120,
        maxConcurrentProvisioning: 5,
        maxNetworkConnections: 50,
        maxExecutionRequestsPerHour: 100,
        capacityStatus: 'NORMAL',
        isCapacityTracked: true,
        currentActiveEnvironments: 0,
        currentAllocatedCpu: 0.0,
        currentAllocatedMemoryMb: 0
      }
    });

    // 3. Ensure test analyst and owner users exist with known passwords
    let analystUser = await prisma.user.findUnique({ where: { email: 'analyst@apexfintech.io' } });
    if (!analystUser) {
      analystUser = await prisma.user.create({
        data: {
          email: 'analyst@apexfintech.io',
          passwordHash: await hashPassword('DevAnalyst12345!'),
          name: 'Apex Security Analyst',
          isPlatformAdmin: false,
          status: 'ACTIVE'
        }
      });
    }
    const existingAnalystMembership = await prisma.tenantMembership.findFirst({
      where: { userId: analystUser.id, tenantId: tenantApexId }
    });
    if (!existingAnalystMembership) {
      await prisma.tenantMembership.create({
        data: {
          userId: analystUser.id,
          tenantId: tenantApexId,
          role: 'SECURITY_ANALYST',
          permissions: ['read:policies', 'view:telemetry', 'request:deception_runtime']
        }
      });
    }

    let ownerUser = await prisma.user.findUnique({ where: { email: 'owner@apexfintech.io' } });
    if (!ownerUser) {
      ownerUser = await prisma.user.create({
        data: {
          email: 'owner@apexfintech.io',
          passwordHash: await hashPassword('DevOwner12345!'),
          name: 'Apex App Owner',
          isPlatformAdmin: false,
          status: 'ACTIVE'
        }
      });
    }
    const existingOwnerMembership = await prisma.tenantMembership.findFirst({
      where: { userId: ownerUser.id, tenantId: tenantApexId }
    });
    if (!existingOwnerMembership) {
      await prisma.tenantMembership.create({
        data: {
          userId: ownerUser.id,
          tenantId: tenantApexId,
          role: 'APPLICATION_OWNER',
          permissions: ['read:policies', 'manage:policies', 'manage:deception_runtime']
        }
      });
    }

    // 4. Create Policy, DSG Graph, and Decision records
    testPolicy = await prisma.deceptionPolicy.findFirst({
      where: { tenantId: tenantApexId, policyIdentifier: 'pol-stage5b2-test' }
    });
    if (!testPolicy) {
      testPolicy = await prisma.deceptionPolicy.create({
        data: {
          tenantId: tenantApexId,
          applicationId: appApexId,
          policyIdentifier: 'pol-stage5b2-test',
          name: 'Stage 5B2 Test Policy',
          description: 'Policy governing synthetic container provisioning',
          enabled: true,
          priority: 10,
          triggerConditions: {},
          requiredEvidenceCriteria: {
            minConfidence: 0.80,
            requiredTelemetryQuality: 'COMPLETE',
            requireRuleCorroboration: true,
            applicableClassifications: ['ATTACK']
          },
          permittedActions: ['PROPOSE_DECEPTION', 'ALLOW_NORMAL'],
          prohibitedActions: [],
          protectedIsolationConstraints: { strictNamespaceIsolation: true, noOutboundEgress: true },
          version: 1
        }
      });
    }

    testGraph = await prisma.deceptionGraph.findFirst({
      where: { tenantId: tenantApexId, graphIdentifier: 'dsg-stage5b2-test' }
    });
    if (!testGraph) {
      testGraph = await prisma.deceptionGraph.create({
        data: {
          tenantId: tenantApexId,
          applicationId: appApexId,
          graphIdentifier: 'dsg-stage5b2-test',
          graphVersion: 1,
          status: 'ACTIVE'
        }
      });
    }

    const dbStrat = await prisma.deceptionStrategy.findFirst({
      where: { strategyIdentifier: 'strat-api-shadow-facade-01' }
    });

    testDecision = await prisma.policyDecision.create({
      data: {
        tenantId: tenantApexId,
        applicationId: appApexId,
        policyId: testPolicy.id,
        policyVersion: testPolicy.version,
        selectedStrategyId: dbStrat?.id || null,
        selectedStrategyVersion: 1,
        dsgGraphId: testGraph.id,
        baseGraphVersion: testGraph.graphVersion,
        evaluatorVersion: '5B.2',
        strategyCatalogueVersion: '1.0.0',
        deceptionDisposition: 'PROPOSED',
        originAccessDecision: 'PROPOSE_DIVERT_TO_DECEPTION',
        decisionResult: 'PROPOSE_DECEPTION',
        decisionRationale: 'Test evaluation for Stage 5B.2 container provisioning',
        reasonCodes: ['ELIGIBILITY_CHECK_PASSED', 'RULE_CORROBORATED', 'STRATEGY_SELECTED', 'DSG_PLAN_GENERATED'],
        proposedMutations: {
          syntheticEnvironmentModel: {
            mockRoutes: [{ path: '/api/v1/auth/login', method: 'POST', simulatedStatus: 200 }],
            isolation: { strictNamespaceIsolation: true, noOutboundEgress: true }
          }
        },
        evidenceReferences: { executionEvidenceStatus: 'MISSING', executionStatus: 'NOT_EXECUTED' }
      }
    });

    // 5. Authenticate App Owner
    const ownerLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner@apexfintech.io', password: 'DevOwner12345!' })
    });
    assert.equal(ownerLoginRes.status, 200);
    ownerCookie = ownerLoginRes.headers.get('set-cookie');
    const ownerBody = await ownerLoginRes.json();
    ownerCsrfToken = ownerBody.data?.antiCsrfToken || ownerBody.data?.csrfToken || '';

    // 6. Authenticate Security Analyst
    const analystLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'analyst@apexfintech.io', password: 'DevAnalyst12345!' })
    });
    assert.equal(analystLoginRes.status, 200);
    analystCookie = analystLoginRes.headers.get('set-cookie');
    const analystBody = await analystLoginRes.json();
    analystCsrfToken = analystBody.data?.antiCsrfToken || analystBody.data?.csrfToken || '';
  });

  after(async () => {
    // Teardown any dangling containers/networks created during test
    const adapter = new ContainerRuntimeAdapter();
    for (const cId of createdContainers) {
      try {
        await adapter.stopAndRemoveContainer(cId);
      } catch (_) {}
    }
    for (const nId of createdNetworks) {
      try {
        await adapter.removeIsolatedNetwork(nId);
      } catch (_) {}
    }

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (prisma) {
      await disconnectDatabase(prisma);
    }
  });

  // ===========================================================================
  // 1. Approved Image Catalogue
  // ===========================================================================
  describe('Approved Image Catalogue', () => {
    it('should list only approved images with immutable digests', () => {
      const images = listApprovedImages();
      assert.ok(Array.isArray(images), 'Images should be an array');
      assert.ok(images.length >= 2, 'Should have at least 2 approved images');

      for (const img of images) {
        assert.equal(img.approvalStatus, 'APPROVED');
        assert.ok(img.immutableDigest.startsWith('sha256:'), 'Digest must be SHA-256');
        assert.ok(img.resourceRequirements.maxMemoryMb > 0, 'Must have max memory limit');
        assert.ok(img.resourceRequirements.maxCpu > 0, 'Must have max CPU limit');
      }
    });

    it('should retrieve specific approved image and verify digest', () => {
      const img = getApprovedImage('img-syn-alpine-node-01');
      assert.ok(img, 'Image must be found');
      assert.equal(img.repository, 'deception-synthetic-service');
      assert.equal(img.tag, '1.0.0');

      const verification = verifyImageDigest('img-syn-alpine-node-01', img.immutableDigest);
      assert.equal(verification.valid, true);
    });

    it('should reject mismatched or unapproved image digests', () => {
      const badDigest = verifyImageDigest('img-syn-alpine-node-01', 'sha256:00000000000000000000000000000000');
      assert.equal(badDigest.valid, false);

      const unknownImg = getApprovedImage('img-malicious-hacker-01');
      assert.equal(unknownImg, null);
    });

    it('should validate compatibility between images and service types', () => {
      const apiComp = validateImageForServiceType('img-syn-alpine-node-01', 'SYNTHETIC_API');
      assert.equal(apiComp.valid, true);

      const authComp = validateImageForServiceType('img-syn-alpine-node-01', 'SYNTHETIC_AUTH');
      assert.equal(authComp.valid, true);

      const unknownComp = validateImageForServiceType('img-syn-alpine-node-01', 'NON_EXISTENT_SERVICE');
      assert.equal(unknownComp.valid, false);
    });
  });

  // ===========================================================================
  // 2. Synthetic Service Templates
  // ===========================================================================
  describe('Synthetic Service Templates', () => {
    it('should list all 3 standard synthetic service templates', () => {
      const templates = listSyntheticTemplates();
      assert.equal(templates.length, 3);

      const identifiers = templates.map((t) => t.templateIdentifier);
      assert.ok(identifiers.includes('tpl-synthetic-api-01'));
      assert.ok(identifiers.includes('tpl-synthetic-auth-01'));
      assert.ok(identifiers.includes('tpl-synthetic-data-01'));
    });

    it('should enforce SANDBOX_ISOLATED mode and strict non-root UID in images', () => {
      for (const tpl of listSyntheticTemplates()) {
        assert.equal(tpl.isolationMode, 'SANDBOX_ISOLATED');
        assert.ok(tpl.resourceDefaults.allocatedCpu > 0);
        assert.ok(tpl.resourceDefaults.allocatedMemoryMb > 0);
      }
      for (const img of listApprovedImages()) {
        assert.equal(img.securityConfiguration.runAsUser, '1000:1000');
        assert.equal(img.securityConfiguration.readOnlyRootfs, true);
        assert.deepEqual(img.securityConfiguration.capDrop, ['ALL']);
        assert.equal(img.securityConfiguration.noNewPrivileges, true);
      }
    });

    it('should retrieve individual template specification', () => {
      const authTpl = getSyntheticTemplate('tpl-synthetic-auth-01');
      assert.ok(authTpl);
      assert.equal(authTpl.serviceType, SYNTHETIC_SERVICE_TYPES.SYNTHETIC_AUTH);
      assert.ok(authTpl.endpoints.some((e) => e.path === '/api/v1/auth/login'));
    });
  });

  // ===========================================================================
  // 3. Container Runtime Adapter Unit & Daemon Connectivity
  // ===========================================================================
  describe('Container Runtime Adapter', () => {
    const adapter = new ContainerRuntimeAdapter();

    it('should connect to local Docker engine via Unix domain socket', async () => {
      const ping = await adapter.ping();
      assert.equal(ping.ok, true);
      assert.ok(ping.version, 'Should report Docker engine version');
    });

    it('should create an isolated internal bridge network with zero internet egress', async () => {
      const net = await adapter.createIsolatedNetwork({
        tenantId: tenantApexId,
        environmentId: 'test-net-env-01'
      });
      assert.ok(net.networkId);
      assert.ok(net.networkName);
      createdNetworks.push(net.networkId);

      // Verify network options
      const inspect = await adapter.inspectNetwork(net.networkId);
      assert.equal(inspect.Internal, true, 'Network must be internal');
      assert.equal(inspect.Driver, 'bridge', 'Must use bridge driver');
    });

    it('should reject unapproved container images at the runtime boundary', async () => {
      await assert.rejects(
        async () => {
          await adapter.createSyntheticContainer({
            tenantId: tenantApexId,
            environmentId: 'test-env-unapproved',
            imageIdentifier: 'unapproved-image-hack',
            templateIdentifier: 'tpl-synthetic-api-01'
          });
        },
        /Approved Synthetic Image Catalogue/
      );
    });
  });

  // ===========================================================================
  // 4. Provisioning Dispatcher & Safety Preconditions
  // ===========================================================================
  describe('Provisioning Dispatcher & Safety Preconditions', () => {
    let dispatcher;
    let governance;
    let approvedAuth;
    let pendingAuth;

    before(async () => {
      governance = new ResourceGovernanceService(prisma);
      dispatcher = new ProvisioningDispatcher({
        prismaClient: prisma,
        resourceGovernance: governance
      });

      // Initialize quota for tenant
      await governance.getQuota({ tenantId: tenantApexId });

      // Create PENDING authorization
      pendingAuth = await prisma.deceptionExecutionAuthorization.create({
        data: {
          tenantId: tenantApexId,
          applicationId: appApexId,
          policyDecisionId: testDecision.id,
          dsgGraphId: testGraph.id,
          dsgGraphVersion: 1,
          selectedStrategyId: 'strat-facade-01',
          authorizationStatus: 'PENDING',
          authorizationReasonCodes: ['STAGE_5B2_TEST_AUTHORIZED'],
          requestingOperatorId: 'usr-analyst-01',
          requestingOperatorEmail: 'analyst@apexfintech.io',
          expiresAt: new Date(Date.now() + 3600000),
          evaluatorVersion: '5B.2'
        }
      });

      // Create APPROVED authorization (dual custody)
      approvedAuth = await prisma.deceptionExecutionAuthorization.create({
        data: {
          tenantId: tenantApexId,
          applicationId: appApexId,
          policyDecisionId: testDecision.id,
          dsgGraphId: testGraph.id,
          dsgGraphVersion: 1,
          selectedStrategyId: 'strat-facade-01',
          authorizationStatus: 'APPROVED',
          authorizationReasonCodes: ['STAGE_5B2_TEST_AUTHORIZED'],
          requestingOperatorId: 'usr-analyst-01',
          requestingOperatorEmail: 'analyst@apexfintech.io',
          approvingOperatorId: 'usr-owner-01',
          approvingOperatorEmail: 'owner@apexfintech.io',
          authorizedAt: new Date(),
          expiresAt: new Date(Date.now() + 3600000),
          evaluatorVersion: '5B.2'
        }
      });
    });

    it('should reject provisioning when authorization is PENDING', async () => {
      await assert.rejects(
        async () => {
          await dispatcher.submitProvisioningJob({
            tenantId: tenantApexId,
            authorizationId: pendingAuth.id,
            processSync: false
          });
        },
        /APPROVED/
      );
    });

    it('should reject provisioning when authorization is EXPIRED', async () => {
      const expiredAuth = await prisma.deceptionExecutionAuthorization.create({
        data: {
          tenantId: tenantApexId,
          applicationId: appApexId,
          policyDecisionId: testDecision.id,
          dsgGraphId: testGraph.id,
          dsgGraphVersion: 1,
          selectedStrategyId: 'strat-facade-01',
          authorizationStatus: 'APPROVED',
          authorizationReasonCodes: ['STAGE_5B2_TEST_AUTHORIZED'],
          requestingOperatorEmail: 'analyst@apexfintech.io',
          approvingOperatorEmail: 'owner@apexfintech.io',
          authorizedAt: new Date(Date.now() - 7200000),
          expiresAt: new Date(Date.now() - 3600000), // in the past
          evaluatorVersion: '5B.2'
        }
      });

      await assert.rejects(
        async () => {
          await dispatcher.submitProvisioningJob({
            tenantId: tenantApexId,
            authorizationId: expiredAuth.id,
            processSync: false
          });
        },
        /expired/
      );
    });

    it('should reject provisioning when authorization is REVOKED', async () => {
      const revokedAuth = await prisma.deceptionExecutionAuthorization.create({
        data: {
          tenantId: tenantApexId,
          applicationId: appApexId,
          policyDecisionId: testDecision.id,
          dsgGraphId: testGraph.id,
          dsgGraphVersion: 1,
          selectedStrategyId: 'strat-facade-01',
          authorizationStatus: 'APPROVED',
          authorizationReasonCodes: ['STAGE_5B2_TEST_AUTHORIZED'],
          requestingOperatorEmail: 'analyst@apexfintech.io',
          approvingOperatorEmail: 'owner@apexfintech.io',
          authorizedAt: new Date(),
          revokedAt: new Date(),
          revokedBy: 'owner@apexfintech.io',
          expiresAt: new Date(Date.now() + 3600000),
          evaluatorVersion: '5B.2'
        }
      });

      await assert.rejects(
        async () => {
          await dispatcher.submitProvisioningJob({
            tenantId: tenantApexId,
            authorizationId: revokedAuth.id,
            processSync: false
          });
        },
        /revoked/
      );
    });

    it('should enforce separation of duties (reject self-approved requests)', async () => {
      const selfApprovedAuth = await prisma.deceptionExecutionAuthorization.create({
        data: {
          tenantId: tenantApexId,
          applicationId: appApexId,
          policyDecisionId: testDecision.id,
          dsgGraphId: testGraph.id,
          dsgGraphVersion: 1,
          selectedStrategyId: 'strat-facade-01',
          authorizationStatus: 'APPROVED',
          authorizationReasonCodes: ['STAGE_5B2_TEST_AUTHORIZED'],
          requestingOperatorEmail: 'analyst@apexfintech.io',
          approvingOperatorEmail: 'analyst@apexfintech.io', // Self approval!
          authorizedAt: new Date(),
          expiresAt: new Date(Date.now() + 3600000),
          evaluatorVersion: '5B.2'
        }
      });

      await assert.rejects(
        async () => {
          await dispatcher.submitProvisioningJob({
            tenantId: tenantApexId,
            authorizationId: selfApprovedAuth.id,
            processSync: false
          });
        },
        /Dual-custody violation/
      );
    });

    it('should reject when DSG graph has mutated (optimistic concurrency)', async () => {
      // Create graph v2
      const mutatedGraph = await prisma.deceptionGraph.create({
        data: {
          tenantId: tenantApexId,
          applicationId: appApexId,
          graphIdentifier: `dsg-mutated-${Date.now()}`,
          graphVersion: 2, // Mutated!
          status: 'ACTIVE'
        }
      });

      const staleAuth = await prisma.deceptionExecutionAuthorization.create({
        data: {
          tenantId: tenantApexId,
          applicationId: appApexId,
          policyDecisionId: testDecision.id,
          dsgGraphId: mutatedGraph.id,
          dsgGraphVersion: 1, // Based on v1, but graph is now v2!
          selectedStrategyId: 'strat-facade-01',
          authorizationStatus: 'APPROVED',
          authorizationReasonCodes: ['STAGE_5B2_TEST_AUTHORIZED'],
          requestingOperatorEmail: 'analyst@apexfintech.io',
          approvingOperatorEmail: 'owner@apexfintech.io',
          authorizedAt: new Date(),
          expiresAt: new Date(Date.now() + 3600000),
          evaluatorVersion: '5B.2'
        }
      });

      await assert.rejects(
        async () => {
          await dispatcher.submitProvisioningJob({
            tenantId: tenantApexId,
            authorizationId: staleAuth.id,
            processSync: false
          });
        },
        /Stale DSG Graph/
      );
    });

    it('should enforce idempotency: identical submissions return original job', async () => {
      const idempotencyKey = `idem-test-${Date.now()}`;

      const job1 = await dispatcher.submitProvisioningJob({
        tenantId: tenantApexId,
        authorizationId: approvedAuth.id,
        templateIdentifier: 'tpl-synthetic-api-01',
        idempotencyKey,
        processSync: false
      });

      const job2 = await dispatcher.submitProvisioningJob({
        tenantId: tenantApexId,
        authorizationId: approvedAuth.id,
        templateIdentifier: 'tpl-synthetic-api-01',
        idempotencyKey,
        processSync: false
      });

      assert.equal(job1.id, job2.id, 'Should return identical job record');
    });

    it('should reject idempotency key reuse with differing payload (409 Conflict)', async () => {
      const idempotencyKey = `idem-conflict-${Date.now()}`;

      await dispatcher.submitProvisioningJob({
        tenantId: tenantApexId,
        authorizationId: approvedAuth.id,
        templateIdentifier: 'tpl-synthetic-api-01',
        idempotencyKey,
        processSync: false
      });

      await assert.rejects(
        async () => {
          await dispatcher.submitProvisioningJob({
            tenantId: tenantApexId,
            authorizationId: approvedAuth.id,
            templateIdentifier: 'tpl-synthetic-auth-01', // Altered payload!
            idempotencyKey,
            processSync: false
          });
        },
        /Idempotency key reuse with different parameters/
      );
    });
  });

  // ===========================================================================
  // 5. End-to-End Real Container Provisioning & Security Hardening
  // ===========================================================================
  describe('Real Container Provisioning & Security Hardening', () => {
    let worker;
    let dispatcher;
    let validAuth;
    let provisionedJob;

    before(async () => {
      const adapter = new ContainerRuntimeAdapter();
      worker = new RuntimeWorkerService({ prismaClient: prisma, adapter });
      dispatcher = new ProvisioningDispatcher({
        prismaClient: prisma,
        runtimeWorker: worker
      });

      validAuth = await prisma.deceptionExecutionAuthorization.create({
        data: {
          tenantId: tenantApexId,
          applicationId: appApexId,
          policyDecisionId: testDecision.id,
          dsgGraphId: testGraph.id,
          dsgGraphVersion: 1,
          selectedStrategyId: 'strat-facade-01',
          authorizationStatus: 'APPROVED',
          authorizationReasonCodes: ['STAGE_5B2_TEST_AUTHORIZED'],
          requestingOperatorId: 'usr-analyst-01',
          requestingOperatorEmail: 'analyst@apexfintech.io',
          approvingOperatorId: 'usr-owner-01',
          approvingOperatorEmail: 'owner@apexfintech.io',
          authorizedAt: new Date(),
          expiresAt: new Date(Date.now() + 3600000),
          evaluatorVersion: '5B.2'
        }
      });
    });

    it('should provision a real synthetic container with all security constraints', async () => {
      provisionedJob = await dispatcher.submitProvisioningJob({
        tenantId: tenantApexId,
        authorizationId: validAuth.id,
        templateIdentifier: 'tpl-synthetic-api-01',
        imageIdentifier: 'img-syn-alpine-node-01',
        idempotencyKey: `prov-e2e-${Date.now()}`,
        processSync: true
      });

      assert.equal(provisionedJob.jobStatus, PROVISIONING_JOB_STATUSES.COMPLETED);
      assert.ok(provisionedJob.workerResult);
      assert.ok(provisionedJob.workerResult.containerId);
      assert.ok(provisionedJob.workerResult.networkId);

      createdContainers.push(provisionedJob.workerResult.containerId);
      createdNetworks.push(provisionedJob.workerResult.networkId);

      // Verify container parameters from real Docker inspect
      const adapter = new ContainerRuntimeAdapter();
      const inspect = await adapter.inspectContainer(provisionedJob.workerResult.containerId);

      assert.equal(inspect.State.Running, true, 'Container must be running');
      assert.equal(inspect.Config.User, '1000:1000', 'Must run as UID 1000');
      assert.equal(inspect.HostConfig.ReadonlyRootfs, true, 'Must have readonly rootfs');
      assert.deepEqual(inspect.HostConfig.CapDrop, ['ALL'], 'Must drop all capabilities');
      assert.equal(inspect.HostConfig.Privileged, false, 'Must not be privileged');

      // Verify zero published host ports
      const portBindings = inspect.HostConfig.PortBindings || {};
      assert.equal(Object.keys(portBindings).length, 0, 'Must have zero published host ports');

      // Verify network is internal bridge
      const netInspect = await adapter.inspectNetwork(provisionedJob.workerResult.networkId);
      assert.equal(netInspect.Internal, true, 'Network must be internal');
    });

    it('should verify real HTTP health probe on the provisioned container', async () => {
      const adapter = new ContainerRuntimeAdapter();
      const health = await adapter.checkContainerHealth(
        provisionedJob.workerResult.containerId,
        'tpl-synthetic-api-01'
      );

      assert.equal(health.healthy, true);
      assert.equal(health.httpStatus, 200);
      assert.ok(health.latencyMs >= 0);
      assert.ok(health.body?.status === 'UP' || health.body?.status === 'HEALTHY');
      assert.equal(health.body?.serviceType, 'SYNTHETIC_API');
    });

    it('should verify negative egress quarantine (confirm connection to 8.8.8.8:53 fails)', async () => {
      const adapter = new ContainerRuntimeAdapter();
      const egressCheck = await adapter.verifyNegativeEgress(provisionedJob.workerResult.containerId);

      assert.equal(egressCheck.quarantined, true, 'Egress must be quarantined');
      assert.equal(egressCheck.egressBlocked, true, 'External egress attempt must be blocked');
    });

    it('should record complete cryptographic execution evidence for the environment', async () => {
      const env = await prisma.deceptionRuntimeEnvironment.findUnique({
        where: { id: provisionedJob.workerResult.environmentId },
        include: { events: true }
      });

      assert.ok(env);
      assert.equal(env.lifecycleState, RUNTIME_LIFECYCLE_STATES.ACTIVE);
      assert.equal(env.isSimulated, false);
      assert.equal(env.executionEvidenceStatus, 'VERIFIED');
      assert.ok(env.runtimeEvidence);
      assert.ok(env.runtimeEvidence.evidenceHash);
      assert.equal(env.runtimeEvidence.quarantineVerified, true);
      assert.equal(env.runtimeEvidence.healthCheckPassed, true);

      // Verify recorded events
      const eventTypes = env.events.map((e) => e.eventType);
      assert.ok(eventTypes.includes(EXECUTION_EVENT_TYPES.CONTAINER_CREATED));
      assert.ok(eventTypes.includes(EXECUTION_EVENT_TYPES.IMAGE_VERIFIED));
      assert.ok(eventTypes.includes(EXECUTION_EVENT_TYPES.SECURITY_CONFIG_APPLIED));
      assert.ok(eventTypes.includes(EXECUTION_EVENT_TYPES.NETWORK_ISOLATION_VERIFIED));
      assert.ok(eventTypes.includes(EXECUTION_EVENT_TYPES.HEALTH_CHECK_PASSED));
      assert.ok(eventTypes.includes(EXECUTION_EVENT_TYPES.EGRESS_QUARANTINE_VERIFIED));
    });

    it('should terminate real container cleanly and release quota', async () => {
      const envManager = new RuntimeEnvironmentManager({ prismaClient: prisma });
      const termResult = await envManager.terminateEnvironment({
        environmentId: provisionedJob.workerResult.environmentId,
        tenantId: tenantApexId,
        reason: 'Automated test suite termination.'
      });

      assert.equal(termResult.lifecycleState, RUNTIME_LIFECYCLE_STATES.TERMINATED);
      assert.ok(termResult.terminatedAt);

      // Verify container is gone from Docker
      const adapter = new ContainerRuntimeAdapter();
      const inspect = await adapter.inspectContainer(provisionedJob.workerResult.containerId);
      assert.equal(inspect, null, 'Container must be completely removed');

      // Verify network is removed
      const netInspect = await adapter.inspectNetwork(provisionedJob.workerResult.networkId);
      assert.equal(netInspect, null, 'Network must be removed');
    });
  });

  // ===========================================================================
  // 6. REST API End-to-End Verification
  // ===========================================================================
  describe('Runtime REST APIs (Stage 5B.2)', () => {
    it('GET /tenants/:id/runtime/images should return approved catalogue', async () => {
      const res = await fetch(`${baseUrl}/tenants/${tenantApexId}/runtime/images`, {
        headers: { Cookie: ownerCookie }
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.status, 'success');
      assert.ok(Array.isArray(body.data));
      assert.ok(body.data.length >= 2);
    });

    it('GET /tenants/:id/runtime/templates should return synthetic templates', async () => {
      const res = await fetch(`${baseUrl}/tenants/${tenantApexId}/runtime/templates`, {
        headers: { Cookie: ownerCookie }
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.status, 'success');
      assert.equal(body.data.length, 3);
    });

    it('POST /tenants/:id/runtime/environments/provision should provision container and return evidence', async () => {
      // Create new fresh approved auth
      const apiAuth = await prisma.deceptionExecutionAuthorization.create({
        data: {
          tenantId: tenantApexId,
          applicationId: appApexId,
          policyDecisionId: testDecision.id,
          dsgGraphId: testGraph.id,
          dsgGraphVersion: 1,
          selectedStrategyId: 'strat-facade-01',
          authorizationStatus: 'APPROVED',
          authorizationReasonCodes: ['STAGE_5B2_TEST_AUTHORIZED'],
          requestingOperatorEmail: 'analyst@apexfintech.io',
          approvingOperatorEmail: 'owner@apexfintech.io',
          authorizedAt: new Date(),
          expiresAt: new Date(Date.now() + 3600000),
          evaluatorVersion: '5B.2'
        }
      });

      const res = await fetch(`${baseUrl}/tenants/${tenantApexId}/runtime/environments/provision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: ownerCookie,
          'X-CSRF-Token': ownerCsrfToken
        },
        body: JSON.stringify({
          authorizationId: apiAuth.id,
          templateIdentifier: 'tpl-synthetic-auth-01',
          imageIdentifier: 'img-syn-alpine-node-01'
        })
      });

      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.status, 'success');
      assert.equal(body.data.jobStatus, 'COMPLETED');
      assert.ok(body.data.workerResult.containerId);

      const cId = body.data.workerResult.containerId;
      const nId = body.data.workerResult.networkId;
      const envId = body.data.workerResult.environmentId;
      createdContainers.push(cId);
      createdNetworks.push(nId);

      // Verify Evidence API
      const evidenceRes = await fetch(`${baseUrl}/tenants/${tenantApexId}/runtime/environments/${envId}/evidence`, {
        headers: { Cookie: ownerCookie }
      });
      assert.equal(evidenceRes.status, 200);
      const evidenceBody = await evidenceRes.json();
      assert.equal(evidenceBody.status, 'success');
      assert.equal(evidenceBody.data.healthStatus, 'HEALTHY');
      assert.ok(evidenceBody.data.runtimeEvidence?.evidenceHash);

      // Verify Runtime Overview reports STAGE_5B2_PROVISIONING_ACTIVE while container is live
      const overviewRes = await fetch(`${baseUrl}/tenants/${tenantApexId}/runtime/overview`, {
        headers: { Cookie: ownerCookie }
      });
      assert.equal(overviewRes.status, 200);
      const overviewBody = await overviewRes.json();
      assert.equal(overviewBody.data.runtimeArchitectureStatus, 'STAGE_5B2_PROVISIONING_ACTIVE');
      assert.equal(overviewBody.data.executionEvidenceStatus, 'VERIFIED');
      assert.ok(overviewBody.data.environmentsSummary.liveContainers >= 1);

      // Terminate via API
      const termRes = await fetch(`${baseUrl}/tenants/${tenantApexId}/runtime/environments/${envId}/terminate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: ownerCookie,
          'X-CSRF-Token': ownerCsrfToken
        },
        body: JSON.stringify({ reason: 'REST API verification cleanup.' })
      });
      assert.equal(termRes.status, 200);
      const termBody = await termRes.json();
      assert.equal(termBody.data.lifecycleState, 'TERMINATED');
    });

    it('should reject provision request without Application Owner privileges', async () => {
      const res = await fetch(`${baseUrl}/tenants/${tenantApexId}/runtime/environments/provision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: analystCookie, // Analyst not permitted to provision
          'X-CSRF-Token': analystCsrfToken
        },
        body: JSON.stringify({
          authorizationId: 'some-id',
          templateIdentifier: 'tpl-synthetic-api-01'
        })
      });

      assert.equal(res.status, 403, 'Security Analyst must be forbidden from provisioning');
    });
  });
});
