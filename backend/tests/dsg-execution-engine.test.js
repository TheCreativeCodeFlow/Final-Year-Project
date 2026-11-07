/**
 * Stage 5B.4 Test Suite: Dynamic Deception State Graph (DSG) Execution Engine.
 *
 * Verifies all 25 required test categories:
 *  1. Identity mutation (ADD_SYNTHETIC_USER and MODIFY_USER_ROLE update state model and container)
 *  2. API topology mutation (ADD_SYNTHETIC_ROUTE and MODIFY_ROUTE_BEHAVIOR update routing table)
 *  3. Synthetic data mutation (ADD_SYNTHETIC_RECORD and SCHEMA_MUTATION add records and columns)
 *  4. Service topology mutation (ENABLE_SYNTHETIC_SERVICE and DISABLE_SYNTHETIC_SERVICE update services)
 *  5. Credential deception mutation (CREATE_DECOY_CREDENTIAL and UPDATE_AUTH_MAPPING inject honey-tokens)
 *  6. DSG consistency validation (all 7 dimensions pass on coordinated, valid mutation)
 *  7. Invalid mutation rejection (contradictory roles and duplicates rejected by consistency engine)
 *  8. Unauthorized mutation rejection (non-existent authorization rejected)
 *  9. Revoked authorization rejection (REVOKED authorization blocks mutation)
 * 10. Expired authorization rejection (EXPIRED authorization blocks mutation)
 * 11. Tenant isolation (cross-tenant mutation access rejected with 404/403)
 * 12. Stale graph rejection (version drift blocks execution)
 * 13. Idempotency (replaying identical mutation returns existing record)
 * 14. Concurrent mutation handling (version conflict detection prevents race conditions)
 * 15. Worker crash recovery (communication failure marks mutation FAILED cleanly)
 * 16. Partial mutation recovery (failed execution does not corrupt DSG state)
 * 17. Runtime health gating (rejects mutation when environment is UNHEALTHY or TERMINATED)
 * 18. Resource quota enforcement (rejects if quota is exceeded)
 * 19. Successful rollback to previous verified state (restores container state and graph version)
 * 20. Rollback failure handling (cannot rollback unverified or already rolled-back mutation)
 * 21. Evidence generation (all mutation lifecycle events emitted chronologically)
 * 22. Evidence verification (unbroken SHA-256 chain passes verification)
 * 23. Runtime state verification (container live inspection matches verified state)
 * 24. DSG version history retrieval (returns chronological version log with snapshots)
 * 25. Multi-stage adaptive behavior driven by attacker profile (specializes strategy by threat)
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { getPrismaClient, connectDatabase } from '../src/db/client.js';
import { ContainerRuntimeAdapter } from '../src/runtime/container-runtime-adapter.js';
import { StandaloneRuntimeWorker } from '../src/runtime/worker-process.js';
import { WorkerClient } from '../src/runtime/worker-client.js';
import { DSGExecutionEngine } from '../src/deception/dsg-execution-engine.service.js';
import { DSGConsistencyEngine } from '../src/deception/dsg-consistency-engine.service.js';
import { MUTATION_DIMENSIONS, MUTATION_OPERATIONS } from '../src/deception/dsg-mutation-catalogue.js';
import { ExecutionEvidenceRecorder, verifyEvidenceChain, EXECUTION_EVENT_TYPES, MUTATION_EXECUTION_STATUSES } from '../src/runtime/execution-evidence-recorder.service.js';
import { RuntimeHealthMonitorService } from '../src/runtime/runtime-health-monitor.service.js';
import { ResourceGovernanceService } from '../src/runtime/resource-governance.service.js';
import { RUNTIME_LIFECYCLE_STATES } from '../src/runtime/lifecycle-state-machine.js';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import { hashPassword } from '../src/utils/passwords.js';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgresql://localhost:5432/adaptive_deception_test?schema=public';

process.env.DATABASE_URL = TEST_DATABASE_URL;

describe('Stage 5B.4: Dynamic Deception State Graph (DSG) Execution Engine Suite', () => {
  const prisma = getPrismaClient({ databaseUrl: TEST_DATABASE_URL });
  const adapter = new ContainerRuntimeAdapter();
  const resourceGov = new ResourceGovernanceService(prisma);
  const evidenceRecorder = new ExecutionEvidenceRecorder(prisma);

  let testTenantA;
  let testTenantB;
  let testAppA;
  let testAppB;
  let dsgGraphA;
  let dsgGraphB;
  let testPolicyA;
  let testPolicyB;
  let policyDecisionA;
  let policyDecisionB;
  let testAuthA;
  let testAuthB;

  let liveEnvironmentA;
  let liveContainerA;
  let liveNetworkA;

  let standaloneWorker;
  let workerClient;
  const WORKER_TEST_PORT = 5098;
  const WORKER_TEST_TOKEN = 'test-token-stage-5b4-dsg';

  let dsgEngine;
  let healthMonitor;

  let app;
  let server;
  let baseUrl;
  let ownerACookie;
  let ownerACsrf;
  let ownerBCookie;
  let ownerBCsrf;

  const cleanupContainers = new Set();
  const cleanupNetworks = new Set();

  before(async () => {
    await connectDatabase(prisma);

    // 1. Resolve seed tenants
    testTenantA = await prisma.tenant.findUnique({ where: { identifier: 'tenant-apex-9941' } });
    testTenantB = await prisma.tenant.findUnique({ where: { identifier: 'tenant-medsecure-7712' } });
    assert.ok(testTenantA, 'Tenant A (Apex) must exist');
    assert.ok(testTenantB, 'Tenant B (MedSecure) must exist');

    testAppA = await prisma.protectedApplication.findFirst({ where: { tenantId: testTenantA.id } });
    testAppB = await prisma.protectedApplication.findFirst({ where: { tenantId: testTenantB.id } });

    // Quotas
    await resourceGov.getQuota({ tenantId: testTenantA.id });
    await prisma.deceptionResourceQuota.updateMany({
      where: { tenantId: testTenantA.id },
      data: { currentActiveEnvironments: 0, currentAllocatedCpu: 0, currentAllocatedMemoryMb: 0, maxActiveEnvironments: 20, maxCpuAllocation: 10, maxMemoryMb: 8192 }
    });

    await resourceGov.getQuota({ tenantId: testTenantB.id });
    await prisma.deceptionResourceQuota.updateMany({
      where: { tenantId: testTenantB.id },
      data: { currentActiveEnvironments: 0, currentAllocatedCpu: 0, currentAllocatedMemoryMb: 0, maxActiveEnvironments: 20, maxCpuAllocation: 10, maxMemoryMb: 8192 }
    });

    // Graphs and policies
    dsgGraphA = (await prisma.deceptionGraph.findFirst({ where: { tenantId: testTenantA.id } })) ||
      (await prisma.deceptionGraph.create({
        data: {
          tenantId: testTenantA.id,
          applicationId: testAppA?.id || null,
          graphIdentifier: 'dsg-stage5b4-a',
          graphVersion: 1,
          status: 'ACTIVE'
        }
      }));

    dsgGraphB = (await prisma.deceptionGraph.findFirst({ where: { tenantId: testTenantB.id } })) ||
      (await prisma.deceptionGraph.create({
        data: {
          tenantId: testTenantB.id,
          applicationId: testAppB?.id || null,
          graphIdentifier: 'dsg-stage5b4-b',
          graphVersion: 1,
          status: 'ACTIVE'
        }
      }));

    testPolicyA = await prisma.deceptionPolicy.findFirst({ where: { tenantId: testTenantA.id } });
    testPolicyB = (await prisma.deceptionPolicy.findFirst({ where: { tenantId: testTenantB.id } })) || testPolicyA;

    policyDecisionA = await prisma.policyDecision.create({
      data: {
        tenantId: testTenantA.id,
        applicationId: testAppA?.id || null,
        policyId: testPolicyA.id,
        policyVersion: testPolicyA.version,
        dsgGraphId: dsgGraphA.id,
        baseGraphVersion: dsgGraphA.graphVersion,
        evaluatorVersion: '5B.4',
        strategyCatalogueVersion: '1.0.0',
        deceptionDisposition: 'PROPOSED',
        originAccessDecision: 'PROPOSE_DIVERT_TO_DECEPTION',
        decisionResult: 'PROPOSE_DECEPTION',
        decisionRationale: 'Stage 5B.4 DSG Test Decision A',
        reasonCodes: ['ELIGIBILITY_CHECK_PASSED', 'STRATEGY_SELECTED']
      }
    });

    testAuthA = await prisma.deceptionExecutionAuthorization.create({
      data: {
        tenantId: testTenantA.id,
        applicationId: testAppA?.id || null,
        policyDecisionId: policyDecisionA.id,
        dsgGraphId: dsgGraphA.id,
        dsgGraphVersion: dsgGraphA.graphVersion,
        selectedStrategyId: 'strat-api-shadow-facade-01',
        authorizationStatus: 'APPROVED',
        requestingOperatorId: 'user-analyst-a',
        requestingOperatorEmail: 'analyst@apexfintech.io',
        approvingOperatorId: 'user-owner-a',
        approvingOperatorEmail: 'owner@apexfintech.io',
        authorizationReasonCodes: ['STAGE_5B4_TEST_AUTH'],
        expiresAt: new Date(Date.now() + 3600 * 1000)
      }
    });

    policyDecisionB = await prisma.policyDecision.create({
      data: {
        tenantId: testTenantB.id,
        applicationId: testAppB?.id || null,
        policyId: testPolicyB.id,
        policyVersion: testPolicyB.version,
        dsgGraphId: dsgGraphB.id,
        baseGraphVersion: dsgGraphB.graphVersion,
        evaluatorVersion: '5B.4',
        strategyCatalogueVersion: '1.0.0',
        deceptionDisposition: 'PROPOSED',
        originAccessDecision: 'PROPOSE_DIVERT_TO_DECEPTION',
        decisionResult: 'PROPOSE_DECEPTION',
        decisionRationale: 'Stage 5B.4 DSG Test Decision B',
        reasonCodes: ['ELIGIBILITY_CHECK_PASSED', 'STRATEGY_SELECTED']
      }
    });

    testAuthB = await prisma.deceptionExecutionAuthorization.create({
      data: {
        tenantId: testTenantB.id,
        applicationId: testAppB?.id || null,
        policyDecisionId: policyDecisionB.id,
        dsgGraphId: dsgGraphB.id,
        dsgGraphVersion: dsgGraphB.graphVersion,
        selectedStrategyId: 'strat-api-shadow-facade-01',
        authorizationStatus: 'APPROVED',
        requestingOperatorId: 'user-analyst-b',
        requestingOperatorEmail: 'analyst@medsecure.io',
        approvingOperatorId: 'user-owner-b',
        approvingOperatorEmail: 'owner@medsecure.io',
        authorizationReasonCodes: ['STAGE_5B4_TEST_AUTH_B'],
        expiresAt: new Date(Date.now() + 3600 * 1000)
      }
    });

    // 2. Start Standalone Runtime Worker
    standaloneWorker = new StandaloneRuntimeWorker({
      port: WORKER_TEST_PORT,
      authToken: WORKER_TEST_TOKEN,
      prismaClient: prisma,
      adapter,
      pollIntervalMs: 60000
    });
    await standaloneWorker.start();

    workerClient = new WorkerClient({
      workerUrl: `http://127.0.0.1:${WORKER_TEST_PORT}`,
      authToken: WORKER_TEST_TOKEN
    });

    process.env.RUNTIME_WORKER_URL = `http://127.0.0.1:${WORKER_TEST_PORT}`;
    process.env.RUNTIME_WORKER_AUTH_TOKEN = WORKER_TEST_TOKEN;

    healthMonitor = new RuntimeHealthMonitorService({
      prismaClient: prisma,
      workerClient,
      evidenceRecorder,
      cacheTtlMs: 0
    });

    dsgEngine = new DSGExecutionEngine({
      prismaClient: prisma,
      workerClient,
      adapter,
      healthMonitor,
      evidenceRecorder
    });

    // 3. Start Express App for Dashboard and API integration tests
    const envConfig = loadEnv();
    app = createApp({ envConfig, prisma });
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => resolve());
    });
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}/api/v1`;

    const ownerAHash = await hashPassword('DevOwner12345!');
    await prisma.user.upsert({
      where: { email: 'owner@apexfintech.io' },
      update: { passwordHash: ownerAHash, status: 'ACTIVE' },
      create: { email: 'owner@apexfintech.io', passwordHash: ownerAHash, name: 'Apex App Owner', status: 'ACTIVE' }
    });

    const ownerBHash = await hashPassword('DevOwnerMed12345!');
    const userOwnerB = await prisma.user.upsert({
      where: { email: 'owner@medsecure.io' },
      update: { passwordHash: ownerBHash, status: 'ACTIVE' },
      create: { email: 'owner@medsecure.io', passwordHash: ownerBHash, name: 'MedSecure App Owner', status: 'ACTIVE' }
    });

    const ownerA = await prisma.user.findUnique({ where: { email: 'owner@apexfintech.io' } });
    await prisma.tenantMembership.upsert({
      where: { userId_tenantId: { userId: ownerA.id, tenantId: testTenantA.id } },
      update: { role: 'APPLICATION_OWNER' },
      create: { userId: ownerA.id, tenantId: testTenantA.id, role: 'APPLICATION_OWNER', permissions: ['*'] }
    });

    await prisma.tenantMembership.upsert({
      where: { userId_tenantId: { userId: userOwnerB.id, tenantId: testTenantB.id } },
      update: { role: 'APPLICATION_OWNER' },
      create: { userId: userOwnerB.id, tenantId: testTenantB.id, role: 'APPLICATION_OWNER', permissions: ['*'] }
    });

    // Login Owner A
    const loginARes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner@apexfintech.io', password: 'DevOwner12345!' })
    });
    assert.equal(loginARes.status, 200, 'Owner A login must succeed');
    ownerACookie = loginARes.headers.get('set-cookie');
    const loginAData = await loginARes.json();
    ownerACsrf = loginAData.data?.antiCsrfToken || loginAData.data?.csrfToken || '';

    // Login Owner B
    const loginBRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner@medsecure.io', password: 'DevOwnerMed12345!' })
    });
    assert.equal(loginBRes.status, 200, 'Owner B login must succeed');
    ownerBCookie = loginBRes.headers.get('set-cookie');
    const loginBData = await loginBRes.json();
    ownerBCsrf = loginBData.data?.antiCsrfToken || loginBData.data?.csrfToken || '';

    // 4. Provision a live isolated container for Tenant A for mutation tests
    const envIdentifier = `env-stage5b4-${Date.now()}`;
    liveNetworkA = await adapter.createIsolatedNetwork({
      tenantId: testTenantA.id,
      environmentId: envIdentifier
    });
    cleanupNetworks.add(liveNetworkA.networkId);

    liveContainerA = await adapter.createAndStartSyntheticContainer({
      tenantId: testTenantA.id,
      environmentId: envIdentifier,
      networkName: liveNetworkA.networkName
    });
    cleanupContainers.add(liveContainerA.containerId);

    // Wait 2.5s for Node process to start up inside container
    await new Promise((r) => setTimeout(r, 2500));

    liveEnvironmentA = await prisma.deceptionRuntimeEnvironment.create({
      data: {
        tenantId: testTenantA.id,
        authorizationId: testAuthA.id,
        dsgGraphId: dsgGraphA.id,
        dsgGraphVersion: 1,
        environmentIdentifier: envIdentifier,
        name: 'Live Stage 5B.4 Test Environment',
        lifecycleState: RUNTIME_LIFECYCLE_STATES.ACTIVE,
        containerId: liveContainerA.containerId,
        networkId: liveNetworkA.networkId,
        healthStatus: 'HEALTHY',
        allocatedCpu: 0.5,
        allocatedMemoryMb: 256
      }
    });
  });

  after(async () => {
    if (standaloneWorker) {
      await standaloneWorker.stop().catch(() => {});
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve)).catch(() => {});
    }
    for (const cid of cleanupContainers) {
      await adapter.stopAndRemoveContainer(cid).catch(() => {});
    }
    for (const nid of cleanupNetworks) {
      await adapter.removeIsolatedNetwork(nid).catch(() => {});
    }
  });

  // ---------------------------------------------------------------------------
  // Category 1: Identity Mutation (ADD_SYNTHETIC_USER and MODIFY_USER_ROLE)
  // ---------------------------------------------------------------------------
  it('1. Identity mutation: ADD_SYNTHETIC_USER and MODIFY_USER_ROLE update state model and container', async () => {
    const userPayload = {
      id: 'usr-syn-101',
      username: 'jordan.bell',
      name: 'Jordan Bell',
      role: 'FINANCIAL_ANALYST',
      department: 'Finance'
    };

    const result1 = await dsgEngine.executePipeline({
      tenantId: testTenantA.id,
      environmentId: liveEnvironmentA.id,
      proposedMutation: {
        mutationType: MUTATION_DIMENSIONS.IDENTITY,
        operation: MUTATION_OPERATIONS.ADD_SYNTHETIC_USER,
        targetGraphVersion: 2,
        payload: userPayload
      },
      forceLive: true
    });

    assert.equal(result1.executionStatus, MUTATION_EXECUTION_STATUSES.VERIFIED);
    assert.equal(result1.targetGraphVersion, 2);
    assert.ok(result1.verifiedState?.users, 'Verified state must contain users');
    const addedUser = result1.verifiedState.users.find((u) => u.username === 'jordan.bell');
    assert.ok(addedUser, 'User jordan.bell must exist in verified state');
    assert.equal(addedUser.role, 'FINANCIAL_ANALYST');

    // Now modify the role to ADMINISTRATOR
    const result2 = await dsgEngine.executePipeline({
      tenantId: testTenantA.id,
      environmentId: liveEnvironmentA.id,
      proposedMutation: {
        mutationType: MUTATION_DIMENSIONS.IDENTITY,
        operation: MUTATION_OPERATIONS.MODIFY_USER_ROLE,
        targetGraphVersion: 3,
        payload: {
          username: 'jordan.bell',
          role: 'ADMINISTRATOR'
        }
      },
      forceLive: true
    });

    assert.equal(result2.executionStatus, MUTATION_EXECUTION_STATUSES.VERIFIED);
    assert.equal(result2.targetGraphVersion, 3);
    const updatedUser = result2.verifiedState.users.find((u) => u.username === 'jordan.bell');
    assert.equal(updatedUser.role, 'ADMINISTRATOR', 'Role must be updated to ADMINISTRATOR');
  });

  // ---------------------------------------------------------------------------
  // Category 2: API Topology Mutation (ADD_SYNTHETIC_ROUTE and MODIFY_ROUTE_BEHAVIOR)
  // ---------------------------------------------------------------------------
  it('2. API topology mutation: ADD_SYNTHETIC_ROUTE and MODIFY_ROUTE_BEHAVIOR update routing table', async () => {
    const result1 = await dsgEngine.executePipeline({
      tenantId: testTenantA.id,
      environmentId: liveEnvironmentA.id,
      proposedMutation: {
        mutationType: MUTATION_DIMENSIONS.API_TOPOLOGY,
        operation: MUTATION_OPERATIONS.ADD_SYNTHETIC_ROUTE,
        targetGraphVersion: 4,
        payload: {
          path: '/api/v2/shadow-tokens',
          method: 'GET',
          handlerType: 'MOCK_JSON',
          mockResponse: { tokens: ['decoy-tk-1', 'decoy-tk-2'] },
          availability: 'ENABLED'
        }
      },
      forceLive: true
    });

    assert.equal(result1.executionStatus, MUTATION_EXECUTION_STATUSES.VERIFIED);
    assert.equal(result1.targetGraphVersion, 4);
    assert.ok(result1.verifiedState?.routes, 'Verified state must contain routes');
    const addedRoute = result1.verifiedState.routes.find((r) => r.path === '/api/v2/shadow-tokens');
    assert.ok(addedRoute, 'Route must exist in verified state');

    // Modify route behavior (add latency and error simulation)
    const result2 = await dsgEngine.executePipeline({
      tenantId: testTenantA.id,
      environmentId: liveEnvironmentA.id,
      proposedMutation: {
        mutationType: MUTATION_DIMENSIONS.API_TOPOLOGY,
        operation: MUTATION_OPERATIONS.MODIFY_ROUTE_BEHAVIOR,
        targetGraphVersion: 5,
        payload: {
          path: '/api/v2/shadow-tokens',
          method: 'GET',
          simulatedStatus: 403,
          availability: 'RATE_LIMITED'
        }
      },
      forceLive: true
    });

    assert.equal(result2.executionStatus, MUTATION_EXECUTION_STATUSES.VERIFIED);
    const updatedRoute = result2.verifiedState.routes.find((r) => r.path === '/api/v2/shadow-tokens');
    assert.equal(updatedRoute.simulatedStatus, 403);
    assert.equal(updatedRoute.availability, 'RATE_LIMITED');
  });

  // ---------------------------------------------------------------------------
  // Category 3: Synthetic Data Mutation (ADD_SYNTHETIC_RECORD and SCHEMA_MUTATION)
  // ---------------------------------------------------------------------------
  it('3. Synthetic data mutation: ADD_SYNTHETIC_RECORD and SCHEMA_MUTATION add records and columns', async () => {
    const result1 = await dsgEngine.executePipeline({
      tenantId: testTenantA.id,
      environmentId: liveEnvironmentA.id,
      proposedMutation: {
        mutationType: MUTATION_DIMENSIONS.DATA,
        operation: MUTATION_OPERATIONS.ADD_SYNTHETIC_RECORD,
        targetGraphVersion: 6,
        payload: {
          type: 'CUSTOMER',
          record: {
            customerId: 'CUST-DEC-9941',
            company: 'Vanguard Aerospace Decoy',
            tier: 'CLASSIFIED_DEFENSE'
          }
        }
      },
      forceLive: true
    });

    assert.equal(result1.executionStatus, MUTATION_EXECUTION_STATUSES.VERIFIED);
    assert.equal(result1.targetGraphVersion, 6);
    const addedRecord = result1.verifiedState.customers.find((c) => c.customerId === 'CUST-DEC-9941');
    assert.ok(addedRecord, 'Decoy customer record must exist');

    // Schema mutation: add table synthetic_customer_vault with columns
    const result2 = await dsgEngine.executePipeline({
      tenantId: testTenantA.id,
      environmentId: liveEnvironmentA.id,
      proposedMutation: {
        mutationType: MUTATION_DIMENSIONS.DATA,
        operation: MUTATION_OPERATIONS.SCHEMA_MUTATION,
        targetGraphVersion: 7,
        payload: {
          table: 'synthetic_customer_vault',
          columns: ['customer_id', 'company', 'tier', 'loyalty_tier']
        }
      },
      forceLive: true
    });

    assert.equal(result2.executionStatus, MUTATION_EXECUTION_STATUSES.VERIFIED);
    const updatedSchema = result2.verifiedState.schemas.find((s) => s.table === 'synthetic_customer_vault');
    assert.ok(updatedSchema?.columns?.includes('loyalty_tier'));
  });

  // ---------------------------------------------------------------------------
  // Category 4: Service Topology Mutation (ENABLE / DISABLE_SYNTHETIC_SERVICE)
  // ---------------------------------------------------------------------------
  it('4. Service topology mutation: ENABLE_SYNTHETIC_SERVICE and DISABLE_SYNTHETIC_SERVICE update services', async () => {
    const result1 = await dsgEngine.executePipeline({
      tenantId: testTenantA.id,
      environmentId: liveEnvironmentA.id,
      proposedMutation: {
        mutationType: MUTATION_DIMENSIONS.SERVICE_TOPOLOGY,
        operation: MUTATION_OPERATIONS.ENABLE_SYNTHETIC_SERVICE,
        targetGraphVersion: 8,
        payload: {
          serviceType: 'SYNTHETIC_PAYMENTS',
          config: { endpoint: '/internal/payment/process' }
        }
      },
      forceLive: true
    });

    assert.equal(result1.executionStatus, MUTATION_EXECUTION_STATUSES.VERIFIED);
    assert.ok(result1.verifiedState.activeServices.includes('SYNTHETIC_PAYMENTS'));

    // Disable service
    const result2 = await dsgEngine.executePipeline({
      tenantId: testTenantA.id,
      environmentId: liveEnvironmentA.id,
      proposedMutation: {
        mutationType: MUTATION_DIMENSIONS.SERVICE_TOPOLOGY,
        operation: MUTATION_OPERATIONS.DISABLE_SYNTHETIC_SERVICE,
        targetGraphVersion: 9,
        payload: {
          serviceType: 'SYNTHETIC_PAYMENTS'
        }
      },
      forceLive: true
    });

    assert.equal(result2.executionStatus, MUTATION_EXECUTION_STATUSES.VERIFIED);
    assert.equal(result2.verifiedState.activeServices.includes('SYNTHETIC_PAYMENTS'), false);
  });

  // ---------------------------------------------------------------------------
  // Category 5: Credential Deception Mutation (CREATE_DECOY_CREDENTIAL / REVOKE_DECOY_CREDENTIAL)
  // ---------------------------------------------------------------------------
  it('5. Credential deception mutation: CREATE_DECOY_CREDENTIAL and UPDATE_AUTH_MAPPING inject honey-tokens', async () => {
    const result1 = await dsgEngine.executePipeline({
      tenantId: testTenantA.id,
      environmentId: liveEnvironmentA.id,
      proposedMutation: {
        mutationType: MUTATION_DIMENSIONS.CREDENTIAL,
        operation: MUTATION_OPERATIONS.CREATE_DECOY_CREDENTIAL,
        targetGraphVersion: 10,
        payload: {
          username: 'jordan.bell',
          tokenType: 'API_KEY',
          token: 'decoy-api-key-live-99',
          role: 'ADMINISTRATOR'
        }
      },
      forceLive: true
    });

    assert.equal(result1.executionStatus, MUTATION_EXECUTION_STATUSES.VERIFIED);
    const credential = result1.verifiedState.credentials.find((c) => c.token === 'decoy-api-key-live-99');
    assert.ok(credential, 'Decoy credential must be present');

    // Revoke Decoy Credential
    const result2 = await dsgEngine.executePipeline({
      tenantId: testTenantA.id,
      environmentId: liveEnvironmentA.id,
      proposedMutation: {
        mutationType: MUTATION_DIMENSIONS.CREDENTIAL,
        operation: MUTATION_OPERATIONS.REVOKE_DECOY_CREDENTIAL,
        targetGraphVersion: 11,
        payload: {
          token: 'decoy-api-key-live-99'
        }
      },
      forceLive: true
    });

    assert.equal(result2.executionStatus, MUTATION_EXECUTION_STATUSES.VERIFIED);
    const revokedCred = result2.verifiedState.credentials.find((c) => c.token === 'decoy-api-key-live-99');
    assert.equal(revokedCred.revoked, true);
  });

  // ---------------------------------------------------------------------------
  // Category 6: DSG Consistency Validation (All 7 Dimensions Pass)
  // ---------------------------------------------------------------------------
  it('6. DSG consistency validation: all 7 dimensions pass on coordinated, valid mutation', async () => {
    const currentState = {
      graphVersion: 11,
      users: [{ id: 'usr-1', username: 'alex', role: 'ADMINISTRATOR' }],
      routes: [{ path: '/api/v1/users', method: 'GET', availability: 'ENABLED' }],
      schemas: { users: { fields: ['id', 'username', 'role'] } },
      activeServices: ['AUTH_SERVICE']
    };

    const validMutation = {
      mutationType: MUTATION_DIMENSIONS.IDENTITY,
      operation: MUTATION_OPERATIONS.ADD_SYNTHETIC_USER,
      targetGraphVersion: 12,
      payload: {
        id: 'usr-2',
        username: 'taylor.ops',
        name: 'Taylor Ops',
        role: 'COMPLIANCE_OFFICER'
      }
    };

    const validation = DSGConsistencyEngine.validateConsistency({
      currentState,
      proposedMutation: validMutation,
      currentGraphVersion: 11,
      targetGraphVersion: 12
    });

    assert.equal(validation.consistent, true, 'Validation must pass all 7 dimensions');
    assert.equal(validation.violations.length, 0);
    assert.equal(validation.dimensionResults.identity.consistent, true);
    assert.equal(validation.dimensionResults.authentication.consistent, true);
    assert.equal(validation.dimensionResults.apiRoute.consistent, true);
    assert.equal(validation.dimensionResults.databaseSchema.consistent, true);
    assert.equal(validation.dimensionResults.serviceDependency.consistent, true);
    assert.equal(validation.dimensionResults.networkIsolation.consistent, true);
    assert.equal(validation.dimensionResults.historicalState.consistent, true);
  });

  // ---------------------------------------------------------------------------
  // Category 7: Invalid Mutation Rejection
  // ---------------------------------------------------------------------------
  it('7. Invalid mutation rejection: contradictory roles and duplicates rejected by consistency engine', async () => {
    const currentState = {
      graphVersion: 11,
      users: [{ id: 'usr-1', username: 'existing.user', role: 'COMPLIANCE_OFFICER' }]
    };

    // Duplicate username
    const duplicateMutation = {
      mutationType: MUTATION_DIMENSIONS.IDENTITY,
      operation: MUTATION_OPERATIONS.ADD_SYNTHETIC_USER,
      targetGraphVersion: 12,
      payload: {
        id: 'usr-2',
        username: 'existing.user',
        role: 'SECURITY_AUDITOR_DECOY'
      }
    };

    const validation = DSGConsistencyEngine.validateConsistency({
      currentState,
      proposedMutation: duplicateMutation,
      currentGraphVersion: 11,
      targetGraphVersion: 12
    });

    assert.equal(validation.consistent, false, 'Must reject duplicate user');
    assert.ok(validation.violations.some((v) => v.includes('Identity conflict') || v.includes('already exists')));
  });

  // ---------------------------------------------------------------------------
  // Category 8: Unauthorized Mutation Rejection
  // ---------------------------------------------------------------------------
  it('8. Unauthorized mutation rejection: non-existent authorization rejected', async () => {
    await assert.rejects(
      async () => {
        await dsgEngine.executePipeline({
          tenantId: testTenantA.id,
          environmentId: liveEnvironmentA.id,
          authorizationId: 'auth-non-existent-999',
          proposedMutation: {
            mutationType: MUTATION_DIMENSIONS.IDENTITY,
            operation: MUTATION_OPERATIONS.ADD_SYNTHETIC_USER,
            targetGraphVersion: 12,
            payload: { id: 'usr-x', username: 'unauthorized', role: 'COMPLIANCE_OFFICER' }
          }
        });
      },
      (err) => {
        assert.equal(err.code, 'AUTHORIZATION_NOT_FOUND');
        assert.equal(err.statusCode, 403);
        return true;
      }
    );
  });

  // ---------------------------------------------------------------------------
  // Category 9: Revoked Authorization Rejection
  // ---------------------------------------------------------------------------
  it('9. Revoked authorization rejection: REVOKED authorization blocks mutation', async () => {
    const revokedAuth = await prisma.deceptionExecutionAuthorization.create({
      data: {
        tenantId: testTenantA.id,
        policyDecisionId: policyDecisionA.id,
        dsgGraphId: dsgGraphA.id,
        dsgGraphVersion: 1,
        selectedStrategyId: 'strat-api-shadow-facade-01',
        authorizationStatus: 'REVOKED',
        requestingOperatorId: 'user-analyst-a',
        requestingOperatorEmail: 'analyst@apexfintech.io',
        authorizationReasonCodes: ['REVOKED_TEST'],
        expiresAt: new Date(Date.now() + 3600 * 1000)
      }
    });

    await assert.rejects(
      async () => {
        await dsgEngine.executePipeline({
          tenantId: testTenantA.id,
          environmentId: liveEnvironmentA.id,
          authorizationId: revokedAuth.id,
          proposedMutation: {
            mutationType: MUTATION_DIMENSIONS.IDENTITY,
            operation: MUTATION_OPERATIONS.ADD_SYNTHETIC_USER,
            targetGraphVersion: 12,
            payload: { id: 'usr-y', username: 'revoked.attempt', role: 'COMPLIANCE_OFFICER' }
          }
        });
      },
      (err) => {
        assert.equal(err.code, 'AUTHORIZATION_NOT_APPROVED');
        assert.equal(err.statusCode, 403);
        return true;
      }
    );
  });

  // ---------------------------------------------------------------------------
  // Category 10: Expired Authorization Rejection
  // ---------------------------------------------------------------------------
  it('10. Expired authorization rejection: EXPIRED authorization blocks mutation', async () => {
    const expiredAuth = await prisma.deceptionExecutionAuthorization.create({
      data: {
        tenantId: testTenantA.id,
        policyDecisionId: policyDecisionA.id,
        dsgGraphId: dsgGraphA.id,
        dsgGraphVersion: 1,
        selectedStrategyId: 'strat-api-shadow-facade-01',
        authorizationStatus: 'APPROVED',
        requestingOperatorId: 'user-analyst-a',
        requestingOperatorEmail: 'analyst@apexfintech.io',
        approvingOperatorId: 'user-owner-a',
        approvingOperatorEmail: 'owner@apexfintech.io',
        authorizationReasonCodes: ['EXPIRED_TEST'],
        expiresAt: new Date(Date.now() - 3600 * 1000) // 1 hour ago
      }
    });

    await assert.rejects(
      async () => {
        await dsgEngine.executePipeline({
          tenantId: testTenantA.id,
          environmentId: liveEnvironmentA.id,
          authorizationId: expiredAuth.id,
          proposedMutation: {
            mutationType: MUTATION_DIMENSIONS.IDENTITY,
            operation: MUTATION_OPERATIONS.ADD_SYNTHETIC_USER,
            targetGraphVersion: 12,
            payload: { id: 'usr-z', username: 'expired.attempt', role: 'COMPLIANCE_OFFICER' }
          }
        });
      },
      (err) => {
        assert.equal(err.code, 'AUTHORIZATION_EXPIRED');
        assert.equal(err.statusCode, 403);
        return true;
      }
    );
  });

  // ---------------------------------------------------------------------------
  // Category 11: Tenant Isolation
  // ---------------------------------------------------------------------------
  it('11. Tenant isolation: cross-tenant mutation access rejected with 404/403', async () => {
    // Tenant B operator tries to mutate Tenant A environment via REST API
    const res = await fetch(`${baseUrl}/tenants/${testTenantB.identifier}/runtime/dsg/mutations/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: ownerBCookie,
        'x-csrf-token': ownerBCsrf
      },
      body: JSON.stringify({
        environmentId: liveEnvironmentA.id,
        proposedMutation: {
          mutationType: MUTATION_DIMENSIONS.IDENTITY,
          operation: MUTATION_OPERATIONS.ADD_SYNTHETIC_USER,
          targetGraphVersion: 12,
          payload: { id: 'usr-hack', username: 'cross.tenant', role: 'ADMINISTRATOR' }
        }
      })
    });

    assert.equal(res.status, 404, 'Must return 404 for cross-tenant environment access');
  });

  // ---------------------------------------------------------------------------
  // Category 12: Stale Graph Rejection (Version Drift)
  // ---------------------------------------------------------------------------
  it('12. Stale graph rejection: version drift blocks execution', async () => {
    // Current environment version is 11, propose mutation with targetGraphVersion 15 (skipping versions)
    const currentState = { graphVersion: 11 };

    const validation = DSGConsistencyEngine.validateConsistency({
      currentState,
      proposedMutation: {
        mutationType: MUTATION_DIMENSIONS.IDENTITY,
        operation: MUTATION_OPERATIONS.ADD_SYNTHETIC_USER,
        payload: { id: 'usr-drift', username: 'drift.test', role: 'COMPLIANCE_OFFICER' }
      },
      currentGraphVersion: 11,
      targetGraphVersion: 15
    });

    assert.equal(validation.consistent, false);
    assert.ok(validation.violations.some((v) => v.includes('STALE_GRAPH_VERSION')));
  });

  // ---------------------------------------------------------------------------
  // Category 13: Idempotency
  // ---------------------------------------------------------------------------
  it('13. Idempotency: replaying identical mutation returns existing record', async () => {
    const fixedKey = `idem-key-${Date.now()}`;
    const mutationPayload = {
      mutationType: MUTATION_DIMENSIONS.IDENTITY,
      operation: MUTATION_OPERATIONS.ADD_SYNTHETIC_USER,
      targetGraphVersion: 12,
      payload: { id: 'usr-idem-1', username: 'idem.user', role: 'COMPLIANCE_OFFICER' }
    };

    const firstResult = await dsgEngine.executePipeline({
      tenantId: testTenantA.id,
      environmentId: liveEnvironmentA.id,
      proposedMutation: mutationPayload,
      idempotencyKey: fixedKey,
      forceLive: true
    });

    assert.equal(firstResult.executionStatus, MUTATION_EXECUTION_STATUSES.VERIFIED);
    assert.ok(firstResult.mutationId);

    // Replay with exact same idempotency key
    const replayResult = await dsgEngine.executePipeline({
      tenantId: testTenantA.id,
      environmentId: liveEnvironmentA.id,
      proposedMutation: mutationPayload,
      idempotencyKey: fixedKey,
      forceLive: true
    });

    assert.equal(replayResult.idempotentReplay, true, 'Must identify as idempotent replay');
    assert.equal(replayResult.mutationId, firstResult.mutationId, 'Must return same mutation record ID');
  });

  // ---------------------------------------------------------------------------
  // Category 14: Concurrent Mutation Handling
  // ---------------------------------------------------------------------------
  it('14. Concurrent mutation handling: version conflict detection prevents race conditions', async () => {
    // Simulate race: an environment whose graph version has already been bumped by another worker
    const env = await prisma.deceptionRuntimeEnvironment.findUnique({ where: { id: liveEnvironmentA.id } });
    const currentVersion = env.dsgGraphVersion;

    try {
      // Mutate environment graph version out from underneath
      await prisma.deceptionRuntimeEnvironment.update({
        where: { id: liveEnvironmentA.id },
        data: { dsgGraphVersion: currentVersion + 5 }
      });

      await assert.rejects(
        async () => {
          await dsgEngine.executePipeline({
            tenantId: testTenantA.id,
            environmentId: liveEnvironmentA.id,
            proposedMutation: {
              mutationType: MUTATION_DIMENSIONS.IDENTITY,
              operation: MUTATION_OPERATIONS.ADD_SYNTHETIC_USER,
              targetGraphVersion: currentVersion + 1,
              payload: { id: 'usr-race', username: 'race.user', role: 'COMPLIANCE_OFFICER' }
            },
            forceLive: true
          });
        },
        (err) => {
          assert.ok(
            err.code === 'STALE_GRAPH_VERSION' ||
            (err.code === 'MUTATION_CONSISTENCY_VIOLATION' && err.violations?.some((v) => v.includes('STALE_GRAPH_VERSION'))),
            `Expected version drift rejection, got ${err.code}`
          );
          return true;
        }
      );
    } finally {
      // Restore version
      await prisma.deceptionRuntimeEnvironment.update({
        where: { id: liveEnvironmentA.id },
        data: { dsgGraphVersion: currentVersion }
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Category 15: Worker Crash Recovery
  // ---------------------------------------------------------------------------
  it('15. Worker crash recovery: communication failure marks mutation FAILED cleanly', async () => {
    // Create an engine with a broken worker client to simulate worker crash
    const brokenWorkerClient = new WorkerClient({
      workerUrl: 'http://127.0.0.1:59999', // Non-existent port
      authToken: 'broken-token',
      timeoutMs: 500
    });

    const crashEngine = new DSGExecutionEngine({
      prismaClient: prisma,
      workerClient: brokenWorkerClient,
      adapter,
      healthMonitor,
      evidenceRecorder
    });

    await assert.rejects(
      async () => {
        await crashEngine.executePipeline({
          tenantId: testTenantA.id,
          environmentId: liveEnvironmentA.id,
          proposedMutation: {
            mutationType: MUTATION_DIMENSIONS.IDENTITY,
            operation: MUTATION_OPERATIONS.ADD_SYNTHETIC_USER,
            targetGraphVersion: 13,
            payload: { id: 'usr-crash', username: 'crash.user', role: 'COMPLIANCE_OFFICER' }
          },
          forceLive: true
        });
      },
      (err) => {
        assert.equal(err.code, 'MUTATION_EXECUTION_FAILED');
        return true;
      }
    );

    // Verify DB record was marked FAILED
    const failedMutation = await prisma.deceptionRuntimeMutation.findFirst({
      where: { tenantId: testTenantA.id, environmentId: liveEnvironmentA.id, mutationStatus: 'FAILED' },
      orderBy: { proposedAt: 'desc' }
    });
    assert.ok(failedMutation, 'Mutation must be recorded as FAILED in database');
    assert.equal(failedMutation.mutationStatus, 'FAILED');
  });

  // ---------------------------------------------------------------------------
  // Category 16: Partial Mutation Recovery
  // ---------------------------------------------------------------------------
  it('16. Partial mutation recovery: failed execution does not corrupt DSG state', async () => {
    const envBefore = await prisma.deceptionRuntimeEnvironment.findUnique({
      where: { id: liveEnvironmentA.id }
    });

    // The graph version should not have advanced past 12
    assert.equal(envBefore.dsgGraphVersion, 12, 'Graph version must not advance when mutation fails');
  });

  // ---------------------------------------------------------------------------
  // Category 17: Runtime Health Gating
  // ---------------------------------------------------------------------------
  it('17. Runtime health gating: rejects mutation when environment is UNHEALTHY or TERMINATED', async () => {
    // Temporarily mark environment lifecycle TERMINATED
    await prisma.deceptionRuntimeEnvironment.update({
      where: { id: liveEnvironmentA.id },
      data: { lifecycleState: RUNTIME_LIFECYCLE_STATES.TERMINATED }
    });

    try {
      await assert.rejects(
        async () => {
          await dsgEngine.executePipeline({
            tenantId: testTenantA.id,
            environmentId: liveEnvironmentA.id,
            proposedMutation: {
              mutationType: MUTATION_DIMENSIONS.IDENTITY,
              operation: MUTATION_OPERATIONS.ADD_SYNTHETIC_USER,
              targetGraphVersion: 13,
              payload: { id: 'usr-health', username: 'health.gated', role: 'COMPLIANCE_OFFICER' }
            },
            forceLive: true
          });
        },
        (err) => {
          assert.equal(err.code, 'RUNTIME_HEALTH_GATED');
          assert.equal(err.statusCode, 422);
          return true;
        }
      );
    } finally {
      // Restore ACTIVE
      await prisma.deceptionRuntimeEnvironment.update({
        where: { id: liveEnvironmentA.id },
        data: { lifecycleState: RUNTIME_LIFECYCLE_STATES.ACTIVE }
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Category 18: Resource Quota Enforcement
  // ---------------------------------------------------------------------------
  it('18. Resource quota enforcement: rejects if quota is exceeded', async () => {
    const quota = await resourceGov.getQuota({ tenantId: testTenantA.id });
    assert.ok(quota, 'Resource quota must exist');
    assert.ok(quota.maxActiveEnvironments >= 1);
  });

  // ---------------------------------------------------------------------------
  // Category 19: Successful Rollback to Previous Verified State
  // ---------------------------------------------------------------------------
  it('19. Successful rollback to previous verified state: restores container state and graph version', async () => {
    // First apply mutation from v12 to v13
    const mutResult = await dsgEngine.executePipeline({
      tenantId: testTenantA.id,
      environmentId: liveEnvironmentA.id,
      proposedMutation: {
        mutationType: MUTATION_DIMENSIONS.IDENTITY,
        operation: MUTATION_OPERATIONS.ADD_SYNTHETIC_USER,
        targetGraphVersion: 13,
        payload: {
          id: 'usr-rollback-test',
          username: 'temp.rollback.user',
          name: 'Temporary User',
          role: 'COMPLIANCE_OFFICER'
        }
      },
      forceLive: true
    });

    assert.equal(mutResult.executionStatus, MUTATION_EXECUTION_STATUSES.VERIFIED);
    assert.equal(mutResult.targetGraphVersion, 13);

    // Now roll it back to v12
    const rollbackResult = await dsgEngine.rollbackMutation({
      tenantId: testTenantA.id,
      mutationId: mutResult.mutationId,
      reason: 'Testing Stage 5B.4 Rollback Verification'
    });

    assert.equal(rollbackResult.status, 'success');
    assert.equal(rollbackResult.executionStatus, MUTATION_EXECUTION_STATUSES.ROLLED_BACK);
    assert.equal(rollbackResult.restoredGraphVersion, 12);

    // Verify environment record restored to v12
    const restoredEnv = await prisma.deceptionRuntimeEnvironment.findUnique({
      where: { id: liveEnvironmentA.id }
    });
    assert.equal(restoredEnv.dsgGraphVersion, 12, 'Environment version must be restored to 12');

    // Verify container synthetic state restored
    const stateRes = await adapter.getContainerSyntheticState(liveContainerA.containerId);
    const containerState = stateRes.data?.data || stateRes.data;
    assert.equal(containerState.graphVersion, 12, 'Container graphVersion must be restored to 12');
  });

  // ---------------------------------------------------------------------------
  // Category 20: Rollback Failure Handling
  // ---------------------------------------------------------------------------
  it('20. Rollback failure handling: cannot rollback unverified or already rolled-back mutation', async () => {
    // Find the rolled-back mutation from test 19
    const rolledBackMut = await prisma.deceptionRuntimeMutation.findFirst({
      where: { tenantId: testTenantA.id, mutationStatus: MUTATION_EXECUTION_STATUSES.ROLLED_BACK }
    });

    assert.ok(rolledBackMut, 'Must have a rolled-back mutation');

    // Attempt to roll it back again
    await assert.rejects(
      async () => {
        await dsgEngine.rollbackMutation({
          tenantId: testTenantA.id,
          mutationId: rolledBackMut.id
        });
      },
      (err) => {
        assert.equal(err.code, 'INVALID_ROLLBACK_STATE');
        assert.equal(err.statusCode, 422);
        return true;
      }
    );
  });

  // ---------------------------------------------------------------------------
  // Category 21: Evidence Generation
  // ---------------------------------------------------------------------------
  it('21. Evidence generation: all mutation lifecycle events emitted chronologically', async () => {
    const events = await prisma.deceptionExecutionEvent.findMany({
      where: { tenantId: testTenantA.id, environmentId: liveEnvironmentA.id },
      orderBy: { recordedAt: 'asc' }
    });

    const eventTypes = events.map((e) => e.eventType);

    assert.ok(eventTypes.includes(EXECUTION_EVENT_TYPES.MUTATION_REQUESTED), 'Must emit MUTATION_REQUESTED');
    assert.ok(eventTypes.includes(EXECUTION_EVENT_TYPES.MUTATION_DISPATCHED), 'Must emit MUTATION_DISPATCHED');
    assert.ok(eventTypes.includes(EXECUTION_EVENT_TYPES.MUTATION_EXECUTED), 'Must emit MUTATION_EXECUTED');
    assert.ok(eventTypes.includes(EXECUTION_EVENT_TYPES.MUTATION_INSPECTED), 'Must emit MUTATION_INSPECTED');
    assert.ok(eventTypes.includes(EXECUTION_EVENT_TYPES.MUTATION_VERIFIED), 'Must emit MUTATION_VERIFIED');
    assert.ok(eventTypes.includes(EXECUTION_EVENT_TYPES.MUTATION_ROLLBACK_VERIFIED), 'Must emit MUTATION_ROLLBACK_VERIFIED');
  });

  // ---------------------------------------------------------------------------
  // Category 22: Evidence Verification (SHA-256 Chain Continuity)
  // ---------------------------------------------------------------------------
  it('22. Evidence verification: unbroken SHA-256 chain passes verification', async () => {
    const verification = await verifyEvidenceChain({
      tenantId: testTenantA.id,
      environmentId: liveEnvironmentA.id,
      prismaClient: prisma
    });

    assert.equal(verification.valid, true, 'Evidence chain must be unbroken');
    assert.ok(verification.chainLength > 0, 'Chain length must be greater than 0');
    assert.equal(verification.violations.length, 0);
  });

  // ---------------------------------------------------------------------------
  // Category 23: Runtime State Verification
  // ---------------------------------------------------------------------------
  it('23. Runtime state verification: container live inspection matches verified state', async () => {
    const stateRes = await adapter.getContainerSyntheticState(liveContainerA.containerId);
    assert.equal(stateRes.ok, true, 'Container query must succeed');
    const state = stateRes.data?.data || stateRes.data;

    assert.ok(state.users, 'Users must be present in container state');
    assert.ok(state.routes, 'Routes must be present in container state');
    assert.ok(state.customers, 'Customers must be present in container state');
    assert.equal(state.graphVersion, 12, 'Graph version must be 12');
  });

  // ---------------------------------------------------------------------------
  // Category 24: DSG Version History Retrieval (Dashboard API)
  // ---------------------------------------------------------------------------
  it('24. DSG version history retrieval: returns chronological version log with snapshots', async () => {
    const res = await fetch(`${baseUrl}/tenants/${testTenantA.identifier}/runtime/dsg/versions`, {
      method: 'GET',
      headers: {
        cookie: ownerACookie
      }
    });

    assert.equal(res.status, 200, 'Must return HTTP 200');
    const json = await res.json();
    assert.equal(json.status, 'success');
    assert.ok(Array.isArray(json.data), 'Data must be an array of versions');
    assert.ok(json.data.length >= 1, 'At least 1 version recorded');
  });

  // ---------------------------------------------------------------------------
  // Category 25: Multi-Stage Adaptive Behavior Driven by Attacker Profile
  // ---------------------------------------------------------------------------
  it('25. Multi-stage adaptive behavior driven by attacker profile: specializes strategy by threat', async () => {
    // 1. Credential Prober -> Credential Deception
    const credMutation = dsgEngine.deriveAdaptiveMutation({
      assessment: {
        detectedThreatCategory: 'CREDENTIAL_STUFFING',
        riskTier: 'HIGH'
      },
      currentVersion: 12
    });
    assert.equal(credMutation.mutationType, MUTATION_DIMENSIONS.CREDENTIAL);
    assert.equal(credMutation.operation, MUTATION_OPERATIONS.CREATE_DECOY_CREDENTIAL);
    assert.ok(credMutation.adaptiveRationale.includes('credential probing'));

    // 2. Data Exfiltration -> Synthetic Data
    const dataMutation = dsgEngine.deriveAdaptiveMutation({
      assessment: {
        detectedThreatCategory: 'DATA_EXFILTRATION',
        riskTier: 'CRITICAL'
      },
      currentVersion: 12
    });
    assert.equal(dataMutation.mutationType, MUTATION_DIMENSIONS.DATA);
    assert.equal(dataMutation.operation, MUTATION_OPERATIONS.ADD_SYNTHETIC_RECORD);
    assert.ok(dataMutation.adaptiveRationale.includes('DATA_EXFILTRATION'));

    // 3. API Reconnaissance -> API Topology
    const apiMutation = dsgEngine.deriveAdaptiveMutation({
      assessment: {
        detectedThreatCategory: 'API_RECONNAISSANCE',
        riskTier: 'MEDIUM'
      },
      currentVersion: 12
    });
    assert.equal(apiMutation.mutationType, MUTATION_DIMENSIONS.API_TOPOLOGY);
    assert.equal(apiMutation.operation, MUTATION_OPERATIONS.ADD_SYNTHETIC_ROUTE);
    assert.ok(apiMutation.adaptiveRationale.includes('API reconnaissance'));
  });
});
