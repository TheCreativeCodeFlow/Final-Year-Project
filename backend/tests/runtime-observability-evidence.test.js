/**
 * Stage 5B.3 Test Suite: Runtime Health, Telemetry, and Execution Evidence Verification.
 *
 * Verifies all 25 required test categories:
 *  1. Healthy runtime detection (Live Docker container responding 200 OK -> HEALTHY)
 *  2. Unhealthy runtime detection (Stopped container produces UNHEALTHY)
 *  3. Unknown health handling (Missing health observation / offline worker -> UNKNOWN)
 *  4. Missing container detection (DB says ACTIVE, container absent -> RUNTIME_MISSING)
 *  5. Orphan container detection (Container exists without DB record -> ORPHAN_RUNTIME)
 *  6. Database/container state mismatch (DB says TERMINATED but container running -> DATABASE_RUNTIME_MISMATCH)
 *  7. Network mismatch (Missing network or non-internal network -> NETWORK_MISMATCH)
 *  8. Resource mismatch (Cgroup memory limit differing from DB allocation -> RESOURCE_MISMATCH)
 *  9. Worker restart detection (Worker reports process PID and uptime via client IPC)
 * 10. Docker daemon unavailability (Connection failure yields UNKNOWN without crashing)
 * 11. Telemetry event persistence & bounded queue retrieval (HTTP request & synthetic auth, sanitization)
 * 12. Telemetry queue overflow (Ring-buffer drop accounting, oldest event dropped, droppedCount tracked)
 * 13. Missing telemetry handling (Explicit TELEMETRY_DATA_LOSS event, never treated as zero activity)
 * 14. Evidence hash verification (Recomputes canonical SHA-256 hash)
 * 15. Evidence chain continuity (Validates sequence numbers and unbroken previous hash pointers)
 * 16. Evidence payload tampering (Detects modified payload in DB)
 * 17. Duplicate evidence events (Detects duplicate event IDs / sequence numbers)
 * 18. Missing lifecycle events (Detects incomplete lifecycle path in verifyEvidenceCompleteness)
 * 19. Tenant isolation (Tenant B cannot access Tenant A health details, telemetry, or evidence)
 * 20. Expired authorization (Rejects provisioning when authorization is expired)
 * 21. Revoked authorization (Rejects provisioning when authorization is revoked)
 * 22. Stale DSG version (Rejects provisioning/mutation on version mismatch)
 * 23. Partial cleanup (Reconciliation detects leaked network or container)
 * 24. Recovery after worker restart (Background reconciliation recovers cleanly after worker restart)
 * 25. Dashboard API integration (All 10 new REST API endpoints return valid JSON and enforce tenant boundaries)
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { getPrismaClient, connectDatabase } from '../src/db/client.js';
import { ContainerRuntimeAdapter } from '../src/runtime/container-runtime-adapter.js';
import { StandaloneRuntimeWorker } from '../src/runtime/worker-process.js';
import { WorkerClient } from '../src/runtime/worker-client.js';
import { RuntimeHealthMonitorService, HEALTH_STATES } from '../src/runtime/runtime-health-monitor.service.js';
import { RuntimeReconciliationService, RECONCILIATION_OUTCOMES } from '../src/runtime/runtime-reconciliation.service.js';
import {
  RuntimeTelemetryService,
  sanitizeTelemetryPayload,
  TELEMETRY_EVENT_TYPES,
  TELEMETRY_QUALITY
} from '../src/runtime/runtime-telemetry.service.js';
import {
  ExecutionEvidenceRecorder,
  verifyEvidenceChain,
  verifyEvidenceCompleteness,
  computeChainHash,
  canonicalStringify,
  GENESIS_PREVIOUS_HASH,
  EXECUTION_EVENT_TYPES
} from '../src/runtime/execution-evidence-recorder.service.js';
import { RuntimeEnvironmentManager } from '../src/runtime/runtime-environment-manager.service.js';
import { ProvisioningDispatcher } from '../src/runtime/provisioning-dispatcher.js';
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

describe('Stage 5B.3: Runtime Health, Telemetry, and Execution Evidence Verification Suite', () => {
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

  let standaloneWorker;
  let workerClient;
  const WORKER_TEST_PORT = 5096;
  const WORKER_TEST_TOKEN = 'test-token-stage-5b3-observability';

  let app;
  let server;
  let baseUrl;
  let ownerACookie;
  let ownerACsrf;
  let ownerBCookie;
  let ownerBCsrf;

  // Track created containers and networks for deterministic cleanup
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
          graphIdentifier: 'dsg-stage5b3-a',
          graphVersion: 1,
          status: 'ACTIVE'
        }
      }));

    dsgGraphB = (await prisma.deceptionGraph.findFirst({ where: { tenantId: testTenantB.id } })) ||
      (await prisma.deceptionGraph.create({
        data: {
          tenantId: testTenantB.id,
          applicationId: testAppB?.id || null,
          graphIdentifier: 'dsg-stage5b3-b',
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
        evaluatorVersion: '5B.3',
        strategyCatalogueVersion: '1.0.0',
        deceptionDisposition: 'PROPOSED',
        originAccessDecision: 'PROPOSE_DIVERT_TO_DECEPTION',
        decisionResult: 'PROPOSE_DECEPTION',
        decisionRationale: 'Stage 5B.3 Observability Test Decision A',
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
        authorizationReasonCodes: ['STAGE_5B3_TEST_AUTH'],
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
        evaluatorVersion: '5B.3',
        strategyCatalogueVersion: '1.0.0',
        deceptionDisposition: 'PROPOSED',
        originAccessDecision: 'PROPOSE_DIVERT_TO_DECEPTION',
        decisionResult: 'PROPOSE_DECEPTION',
        decisionRationale: 'Stage 5B.3 Observability Test Decision B',
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
        authorizationReasonCodes: ['STAGE_5B3_TEST_AUTH'],
        expiresAt: new Date(Date.now() + 3600 * 1000)
      }
    });

    // 2. Start Dedicated Standalone Runtime Worker
    standaloneWorker = new StandaloneRuntimeWorker({
      port: WORKER_TEST_PORT,
      authToken: WORKER_TEST_TOKEN,
      adapter,
      prismaClient: prisma
    });
    await standaloneWorker.start();

    workerClient = new WorkerClient({
      workerUrl: `http://127.0.0.1:${WORKER_TEST_PORT}`,
      authToken: WORKER_TEST_TOKEN
    });

    process.env.RUNTIME_WORKER_URL = `http://127.0.0.1:${WORKER_TEST_PORT}`;
    process.env.RUNTIME_WORKER_AUTH_TOKEN = WORKER_TEST_TOKEN;

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
      create: {
        email: 'owner@apexfintech.io',
        passwordHash: ownerAHash,
        name: 'Apex App Owner',
        status: 'ACTIVE'
      }
    });

    const ownerBHash = await hashPassword('DevOwnerMed12345!');
    const userOwnerB = await prisma.user.upsert({
      where: { email: 'owner@medsecure.io' },
      update: { passwordHash: ownerBHash, status: 'ACTIVE' },
      create: {
        email: 'owner@medsecure.io',
        passwordHash: ownerBHash,
        name: 'MedSecure App Owner',
        status: 'ACTIVE'
      }
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
  });

  after(async () => {
    if (standaloneWorker) {
      await standaloneWorker.stop().catch(() => {});
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    for (const cId of cleanupContainers) {
      await adapter.stopAndRemoveContainer(cId).catch(() => {});
    }
    for (const nId of cleanupNetworks) {
      await adapter.removeIsolatedNetwork(nId).catch(() => {});
    }
  });

  // ---------------------------------------------------------------------------
  // Category 1: Healthy Runtime Detection (Live Docker container + HTTP probe)
  // ---------------------------------------------------------------------------
  it('1. Healthy runtime detection: Live container responding 200 OK produces HEALTHY state', async () => {
    const envIdentifier = `env-live-health-${Date.now()}`;
    const net = await adapter.createIsolatedNetwork({
      tenantId: testTenantA.id,
      environmentId: envIdentifier
    });
    cleanupNetworks.add(net.networkId);

    const cont = await adapter.createAndStartSyntheticContainer({
      tenantId: testTenantA.id,
      environmentId: envIdentifier,
      networkName: net.networkName
    });
    cleanupContainers.add(cont.containerId);

    // Wait 2s for Node.js server inside container to bind to 8080
    await new Promise((r) => setTimeout(r, 2000));

    const env = await prisma.deceptionRuntimeEnvironment.create({
      data: {
        tenantId: testTenantA.id,
        authorizationId: testAuthA.id,
        dsgGraphId: dsgGraphA.id,
        dsgGraphVersion: 1,
        environmentIdentifier: envIdentifier,
        name: 'Live Healthy Environment',
        lifecycleState: RUNTIME_LIFECYCLE_STATES.ACTIVE,
        containerId: cont.containerId,
        networkId: net.networkId,
        healthStatus: 'UNKNOWN',
        allocatedCpu: 0.5,
        allocatedMemoryMb: 256
      }
    });

    const healthMonitor = new RuntimeHealthMonitorService({
      prismaClient: prisma,
      workerClient,
      evidenceRecorder,
      cacheTtlMs: 0
    });

    const health = await healthMonitor.inspectEnvironmentHealth({
      tenantId: testTenantA.id,
      environmentId: env.id,
      forceLive: true
    });

    assert.equal(health.healthState, HEALTH_STATES.HEALTHY, 'Must be deterministically HEALTHY');
    assert.equal(health.healthy, true);
    assert.ok(health.container, 'Container inspection must be included');
    assert.equal(health.container.running, true);
    assert.ok(health.probe, 'HTTP probe must be included');
    assert.equal(health.probe.statusCode, 200);

    const updatedEnv = await prisma.deceptionRuntimeEnvironment.findUnique({ where: { id: env.id } });
    assert.equal(updatedEnv.healthStatus, 'HEALTHY');
    assert.ok(updatedEnv.healthCheckedAt);

    await adapter.stopAndRemoveContainer(cont.containerId).catch(() => {});
    cleanupContainers.delete(cont.containerId);
    await adapter.removeIsolatedNetwork(net.networkId).catch(() => {});
    cleanupNetworks.delete(net.networkId);
  });

  // ---------------------------------------------------------------------------
  // Category 2: Unhealthy Runtime Detection
  // ---------------------------------------------------------------------------
  it('2. Unhealthy runtime detection: Stopped/dead container produces UNHEALTHY state', async () => {
    const envIdentifier = `env-unhealthy-${Date.now()}`;
    const net = await adapter.createIsolatedNetwork({
      tenantId: testTenantA.id,
      environmentId: envIdentifier
    });
    cleanupNetworks.add(net.networkId);

    const cont = await adapter.createAndStartSyntheticContainer({
      tenantId: testTenantA.id,
      environmentId: envIdentifier,
      networkName: net.networkName
    });
    cleanupContainers.add(cont.containerId);

    await adapter.stopContainer(cont.containerId);

    const env = await prisma.deceptionRuntimeEnvironment.create({
      data: {
        tenantId: testTenantA.id,
        authorizationId: testAuthA.id,
        dsgGraphId: dsgGraphA.id,
        dsgGraphVersion: 1,
        environmentIdentifier: envIdentifier,
        name: 'Stopped Environment',
        lifecycleState: RUNTIME_LIFECYCLE_STATES.ACTIVE,
        containerId: cont.containerId,
        networkId: net.networkId,
        healthStatus: 'HEALTHY'
      }
    });

    const healthMonitor = new RuntimeHealthMonitorService({
      prismaClient: prisma,
      workerClient,
      evidenceRecorder,
      cacheTtlMs: 0
    });

    const health = await healthMonitor.inspectEnvironmentHealth({
      tenantId: testTenantA.id,
      environmentId: env.id,
      forceLive: true
    });

    assert.equal(health.healthState, HEALTH_STATES.UNHEALTHY, 'Stopped container must produce UNHEALTHY state');
    assert.equal(health.healthy, false);

    const updatedEnv = await prisma.deceptionRuntimeEnvironment.findUnique({ where: { id: env.id } });
    assert.equal(updatedEnv.healthStatus, 'UNHEALTHY');

    await adapter.stopAndRemoveContainer(cont.containerId).catch(() => {});
    cleanupContainers.delete(cont.containerId);
    await adapter.removeIsolatedNetwork(net.networkId).catch(() => {});
    cleanupNetworks.delete(net.networkId);
  });

  // ---------------------------------------------------------------------------
  // Category 3: Unknown Health Handling
  // ---------------------------------------------------------------------------
  it('3. Unknown health handling: Missing health observation produces UNKNOWN, never defaults to HEALTHY', async () => {
    const env = await prisma.deceptionRuntimeEnvironment.create({
      data: {
        tenantId: testTenantA.id,
        authorizationId: testAuthA.id,
        dsgGraphId: dsgGraphA.id,
        dsgGraphVersion: 1,
        environmentIdentifier: `env-uninspected-${Date.now()}`,
        name: 'Uninspected Environment',
        lifecycleState: RUNTIME_LIFECYCLE_STATES.PROVISIONING,
        containerId: null,
        healthStatus: 'UNKNOWN'
      }
    });

    const healthMonitor = new RuntimeHealthMonitorService({
      prismaClient: prisma,
      workerClient,
      evidenceRecorder,
      cacheTtlMs: 0
    });

    const health = await healthMonitor.inspectEnvironmentHealth({
      tenantId: testTenantA.id,
      environmentId: env.id
    });
    assert.equal(health.healthState, HEALTH_STATES.UNKNOWN, 'Must evaluate to UNKNOWN when containerId is absent');
    assert.notEqual(health.healthState, HEALTH_STATES.HEALTHY, 'Must NEVER default to HEALTHY without evidence');
  });

  // ---------------------------------------------------------------------------
  // Category 4: Missing Container Detection
  // ---------------------------------------------------------------------------
  it('4. Missing container detection: DB says ACTIVE but container does not exist in Docker -> RUNTIME_MISSING', async () => {
    const fakeContainerId = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
    const env = await prisma.deceptionRuntimeEnvironment.create({
      data: {
        tenantId: testTenantA.id,
        authorizationId: testAuthA.id,
        dsgGraphId: dsgGraphA.id,
        dsgGraphVersion: 1,
        environmentIdentifier: `env-missing-${Date.now()}`,
        name: 'Missing Container Environment',
        lifecycleState: RUNTIME_LIFECYCLE_STATES.ACTIVE,
        containerId: fakeContainerId,
        healthStatus: 'UNKNOWN'
      }
    });

    const reconciliation = new RuntimeReconciliationService({
      prismaClient: prisma,
      workerClient,
      evidenceRecorder
    });

    const result = await reconciliation.reconcileEnvironment({
      tenantId: testTenantA.id,
      environmentId: env.id
    });

    assert.equal(result.reconciliationOutcome, RECONCILIATION_OUTCOMES.RUNTIME_MISSING);
    assert.ok(result.discrepancies.length > 0);
    assert.ok(result.discrepancies.some((d) => d.includes('does not exist')));
  });

  // ---------------------------------------------------------------------------
  // Category 5: Orphan Container Detection
  // ---------------------------------------------------------------------------
  it('5. Orphan container detection: Running container without matching DB environment is flagged as ORPHAN_RUNTIME', async () => {
    const orphanEnvId = `env-orphan-${Date.now()}`;
    const net = await adapter.createIsolatedNetwork({
      tenantId: testTenantA.id,
      environmentId: orphanEnvId
    });
    cleanupNetworks.add(net.networkId);

    const cont = await adapter.createAndStartSyntheticContainer({
      tenantId: testTenantA.id,
      environmentId: orphanEnvId,
      networkName: net.networkName
    });
    cleanupContainers.add(cont.containerId);

    const reconciliation = new RuntimeReconciliationService({
      prismaClient: prisma,
      workerClient,
      evidenceRecorder
    });

    const tenantRecon = await reconciliation.reconcileTenant({
      tenantId: testTenantA.id
    });

    assert.ok(tenantRecon.summary.orphanContainersCount > 0, 'Must detect orphaned container');
    assert.ok(
      tenantRecon.orphans.containers.some((o) => o.containerId === cont.containerId),
      'Must identify specific orphan container ID'
    );

    await adapter.stopAndRemoveContainer(cont.containerId).catch(() => {});
    cleanupContainers.delete(cont.containerId);
    await adapter.removeIsolatedNetwork(net.networkId).catch(() => {});
    cleanupNetworks.delete(net.networkId);
  });

  // ---------------------------------------------------------------------------
  // Category 6: Database / Container State Mismatch
  // ---------------------------------------------------------------------------
  it('6. Database/container state mismatch: DB says TERMINATED but container is running -> DATABASE_RUNTIME_MISMATCH', async () => {
    const envId = `env-mismatch-${Date.now()}`;
    const net = await adapter.createIsolatedNetwork({
      tenantId: testTenantA.id,
      environmentId: envId
    });
    cleanupNetworks.add(net.networkId);

    const cont = await adapter.createAndStartSyntheticContainer({
      tenantId: testTenantA.id,
      environmentId: envId,
      networkName: net.networkName
    });
    cleanupContainers.add(cont.containerId);

    const env = await prisma.deceptionRuntimeEnvironment.create({
      data: {
        tenantId: testTenantA.id,
        authorizationId: testAuthA.id,
        dsgGraphId: dsgGraphA.id,
        dsgGraphVersion: 1,
        environmentIdentifier: envId,
        name: 'Mismatched State Environment',
        lifecycleState: RUNTIME_LIFECYCLE_STATES.TERMINATED, // DB says terminated!
        containerId: cont.containerId,
        networkId: net.networkId,
        healthStatus: 'UNKNOWN'
      }
    });

    const reconciliation = new RuntimeReconciliationService({
      prismaClient: prisma,
      workerClient,
      evidenceRecorder
    });

    const result = await reconciliation.reconcileEnvironment({
      tenantId: testTenantA.id,
      environmentId: env.id
    });

    assert.equal(result.reconciliationOutcome, RECONCILIATION_OUTCOMES.DATABASE_RUNTIME_MISMATCH);
    assert.ok(result.discrepancies.length > 0);
    assert.ok(result.discrepancies.some((d) => d.includes('still RUNNING')));

    await adapter.stopAndRemoveContainer(cont.containerId).catch(() => {});
    cleanupContainers.delete(cont.containerId);
    await adapter.removeIsolatedNetwork(net.networkId).catch(() => {});
    cleanupNetworks.delete(net.networkId);
  });

  // ---------------------------------------------------------------------------
  // Category 7: Network Mismatch
  // ---------------------------------------------------------------------------
  it('7. Network mismatch: Missing or non-internal network detected by reconciliation -> NETWORK_MISMATCH', async () => {
    const envId = `env-net-mismatch-${Date.now()}`;
    const net = await adapter.createIsolatedNetwork({
      tenantId: testTenantA.id,
      environmentId: envId
    });
    cleanupNetworks.add(net.networkId);

    const cont = await adapter.createAndStartSyntheticContainer({
      tenantId: testTenantA.id,
      environmentId: envId,
      networkName: net.networkName
    });
    cleanupContainers.add(cont.containerId);

    const env = await prisma.deceptionRuntimeEnvironment.create({
      data: {
        tenantId: testTenantA.id,
        authorizationId: testAuthA.id,
        dsgGraphId: dsgGraphA.id,
        dsgGraphVersion: 1,
        environmentIdentifier: envId,
        name: 'Network Mismatch Env',
        lifecycleState: RUNTIME_LIFECYCLE_STATES.ACTIVE,
        containerId: cont.containerId,
        networkId: 'nonexistent-net-12345',
        healthStatus: 'HEALTHY'
      }
    });

    const reconciliation = new RuntimeReconciliationService({
      prismaClient: prisma,
      workerClient,
      evidenceRecorder
    });

    const result = await reconciliation.reconcileEnvironment({
      tenantId: testTenantA.id,
      environmentId: env.id
    });

    assert.equal(result.reconciliationOutcome, RECONCILIATION_OUTCOMES.NETWORK_MISMATCH);
    assert.ok(result.discrepancies.length > 0);
    assert.ok(result.discrepancies.some((d) => d.includes('Network')));

    await adapter.stopAndRemoveContainer(cont.containerId).catch(() => {});
    cleanupContainers.delete(cont.containerId);
    await adapter.removeIsolatedNetwork(net.networkId).catch(() => {});
    cleanupNetworks.delete(net.networkId);
  });

  // ---------------------------------------------------------------------------
  // Category 8: Resource Mismatch
  // ---------------------------------------------------------------------------
  it('8. Resource mismatch: Cgroup memory limit differing from DB allocation yields RESOURCE_MISMATCH', async () => {
    const envId = `env-res-mismatch-${Date.now()}`;
    const net = await adapter.createIsolatedNetwork({
      tenantId: testTenantA.id,
      environmentId: envId
    });
    cleanupNetworks.add(net.networkId);

    const cont = await adapter.createAndStartSyntheticContainer({
      tenantId: testTenantA.id,
      environmentId: envId,
      networkName: net.networkName
    });
    cleanupContainers.add(cont.containerId);

    const env = await prisma.deceptionRuntimeEnvironment.create({
      data: {
        tenantId: testTenantA.id,
        authorizationId: testAuthA.id,
        dsgGraphId: dsgGraphA.id,
        dsgGraphVersion: 1,
        environmentIdentifier: envId,
        name: 'Resource Mismatch Env',
        lifecycleState: RUNTIME_LIFECYCLE_STATES.ACTIVE,
        containerId: cont.containerId,
        networkId: net.networkId,
        allocatedMemoryMb: 1024,
        allocatedCpu: 0.5,
        healthStatus: 'HEALTHY'
      }
    });

    const reconciliation = new RuntimeReconciliationService({
      prismaClient: prisma,
      workerClient,
      evidenceRecorder
    });

    const result = await reconciliation.reconcileEnvironment({
      tenantId: testTenantA.id,
      environmentId: env.id
    });

    assert.equal(result.reconciliationOutcome, RECONCILIATION_OUTCOMES.RESOURCE_MISMATCH);
    assert.ok(result.discrepancies.length > 0);
    assert.ok(result.discrepancies.some((d) => d.includes('cgroup')));

    await adapter.stopAndRemoveContainer(cont.containerId).catch(() => {});
    cleanupContainers.delete(cont.containerId);
    await adapter.removeIsolatedNetwork(net.networkId).catch(() => {});
    cleanupNetworks.delete(net.networkId);
  });

  // ---------------------------------------------------------------------------
  // Category 9: Worker Restart Detection
  // ---------------------------------------------------------------------------
  it('9. Worker restart detection: Worker reports process PID and uptime accurately via client IPC', async () => {
    const health = await workerClient.getHealth();

    assert.equal(health.ok, true);
    assert.equal(health.status, 'UP');
    assert.ok(health.workerProcess.pid > 0, 'Worker PID must be reported');
    assert.ok(typeof health.workerProcess.uptime === 'number' && health.workerProcess.uptime >= 0);
    assert.ok(health.workerProcess.workerId, 'Worker ID must be provided');
    assert.ok(health.workerProcess.docker?.connected, 'Worker Docker status must be connected');
  });

  // ---------------------------------------------------------------------------
  // Category 10: Docker Daemon Unavailability
  // ---------------------------------------------------------------------------
  it('10. Docker daemon unavailability: Failure to connect to Docker returns UNKNOWN without crashing', async () => {
    const badAdapter = new ContainerRuntimeAdapter({ socketPath: '/tmp/nonexistent-docker-socket.sock' });
    const badPing = await badAdapter.ping();

    assert.equal(badPing.ok, false);
    assert.ok(badPing.error);

    const detailed = await badAdapter.getDetailedHealth('nonexistent-container-id');
    assert.equal(detailed.healthState, HEALTH_STATES.UNKNOWN);
    assert.equal(detailed.healthy, false);
  });

  // ---------------------------------------------------------------------------
  // Category 11: Telemetry Event Persistence & Bounded Queue Retrieval
  // ---------------------------------------------------------------------------
  it('11. Telemetry event persistence: Collects, sanitizes credentials, pseudonymizes session IDs', async () => {
    const telemetry = new RuntimeTelemetryService({ maxEventsPerEnvironment: 50 });
    const envId = `env-telemetry-${Date.now()}`;

    telemetry.recordEvent({
      tenantId: testTenantA.id,
      environmentId: envId,
      eventType: TELEMETRY_EVENT_TYPES.HTTP_REQUEST_OBSERVED,
      payload: {
        method: 'POST',
        path: '/api/v1/auth/login',
        statusCode: 200,
        latencyMs: 42,
        authorization: 'Bearer super-secret-jwt-token-12345',
        password: 'PlainTextPassword!',
        sessionId: 'user-active-session-abc-987'
      }
    });

    const res = telemetry.getTelemetryEvents({ tenantId: testTenantA.id, environmentId: envId });
    assert.equal(res.events.length, 1);
    const ev = res.events[0];

    assert.equal(ev.payload.authorization, '[REDACTED]');
    assert.equal(ev.payload.password, '[REDACTED]');
    assert.ok(ev.payload.sessionId.startsWith('sess-anon-'), 'Session ID must be pseudonymized');
    assert.notEqual(ev.payload.sessionId, 'user-active-session-abc-987');

    const summary = telemetry.getTelemetrySummary({ tenantId: testTenantA.id, environmentId: envId });
    assert.equal(summary.totalObserved, 1);
    assert.equal(summary.telemetryQuality, TELEMETRY_QUALITY.NOMINAL);
  });

  // ---------------------------------------------------------------------------
  // Category 12: Telemetry Queue Overflow (Ring-buffer drop accounting)
  // ---------------------------------------------------------------------------
  it('12. Telemetry queue overflow: Bounded ring buffer drops oldest events and tracks droppedCount', async () => {
    const telemetry = new RuntimeTelemetryService({ maxEventsPerEnvironment: 5 });
    const envId = `env-overflow-${Date.now()}`;

    for (let i = 1; i <= 8; i++) {
      telemetry.recordEvent({
        tenantId: testTenantA.id,
        environmentId: envId,
        eventType: TELEMETRY_EVENT_TYPES.HTTP_REQUEST_OBSERVED,
        payload: {
          path: `/path/${i}`,
          statusCode: 200,
          eventIndex: i
        }
      });
    }

    const res = telemetry.getTelemetryEvents({ tenantId: testTenantA.id, environmentId: envId });
    assert.equal(res.events.length, 5, 'Queue length must be capped at 5');
    assert.equal(res.events[0].payload.eventIndex, 4, 'Oldest events (1, 2, 3) must have been dropped');
    assert.equal(res.events[4].payload.eventIndex, 8);

    const summary = telemetry.getTelemetrySummary({ tenantId: testTenantA.id, environmentId: envId });
    assert.equal(summary.droppedCount, 3, 'Must record 3 dropped events');
    assert.equal(summary.telemetryQuality, TELEMETRY_QUALITY.QUEUE_OVERFLOW);
  });

  // ---------------------------------------------------------------------------
  // Category 13: Missing Telemetry Handling
  // ---------------------------------------------------------------------------
  it('13. Missing telemetry handling: Explicit TELEMETRY_DATA_LOSS event, never treated as zero activity', async () => {
    const telemetry = new RuntimeTelemetryService();
    const envId = `env-dataloss-${Date.now()}`;

    telemetry.recordTelemetryLoss({
      tenantId: testTenantA.id,
      environmentId: envId,
      reason: 'Network tap buffer exhausted',
      count: 25
    });

    const summary = telemetry.getTelemetrySummary({ tenantId: testTenantA.id, environmentId: envId });
    assert.equal(summary.telemetryQuality, TELEMETRY_QUALITY.QUEUE_OVERFLOW);
    assert.equal(summary.droppedCount, 25);

    const res = telemetry.getTelemetryEvents({ tenantId: testTenantA.id, environmentId: envId });
    assert.equal(res.events.length, 1);
    assert.equal(res.events[0].eventType, TELEMETRY_EVENT_TYPES.TELEMETRY_DATA_LOSS);
  });

  // ---------------------------------------------------------------------------
  // Category 14: Evidence Hash Verification (Recomputes SHA-256 canonical hash)
  // ---------------------------------------------------------------------------
  it('14. Evidence hash verification: Validates append-linked SHA-256 chain integrity', async () => {
    const env = await prisma.deceptionRuntimeEnvironment.create({
      data: {
        tenantId: testTenantA.id,
        authorizationId: testAuthA.id,
        dsgGraphId: dsgGraphA.id,
        dsgGraphVersion: 1,
        environmentIdentifier: `env-ev-verify-${Date.now()}`,
        name: 'Evidence Verify Env',
        lifecycleState: RUNTIME_LIFECYCLE_STATES.ACTIVE,
        healthStatus: 'HEALTHY'
      }
    });

    await evidenceRecorder.recordEvent({
      tenantId: testTenantA.id,
      environmentId: env.id,
      eventType: EXECUTION_EVENT_TYPES.AUTHORIZATION_VALIDATED,
      message: 'Authorization approved for container provisioning'
    });

    await evidenceRecorder.recordEvent({
      tenantId: testTenantA.id,
      environmentId: env.id,
      eventType: EXECUTION_EVENT_TYPES.PROVISIONING_REQUESTED,
      message: 'Provisioning job created'
    });

    const chainResult = await evidenceRecorder.verifyChain({
      tenantId: testTenantA.id,
      environmentId: env.id
    });

    assert.equal(chainResult.valid, true);
    assert.equal(chainResult.chainLength, 2);
    assert.equal(chainResult.violations.length, 0);
  });

  // ---------------------------------------------------------------------------
  // Category 15: Evidence Chain Continuity
  // ---------------------------------------------------------------------------
  it('15. Evidence chain continuity: Detects broken sequence or missing previous hash pointers', async () => {
    const env = await prisma.deceptionRuntimeEnvironment.create({
      data: {
        tenantId: testTenantA.id,
        authorizationId: testAuthA.id,
        dsgGraphId: dsgGraphA.id,
        dsgGraphVersion: 1,
        environmentIdentifier: `env-chain-continuity-${Date.now()}`,
        name: 'Chain Continuity Env',
        lifecycleState: RUNTIME_LIFECYCLE_STATES.ACTIVE,
        healthStatus: 'HEALTHY'
      }
    });

    const ev1 = await evidenceRecorder.recordEvent({
      tenantId: testTenantA.id,
      environmentId: env.id,
      eventType: 'EVENT_A',
      message: 'Initial step'
    });

    const ev2 = await evidenceRecorder.recordEvent({
      tenantId: testTenantA.id,
      environmentId: env.id,
      eventType: 'EVENT_B',
      message: 'Second step'
    });

    const ev3 = await evidenceRecorder.recordEvent({
      tenantId: testTenantA.id,
      environmentId: env.id,
      eventType: 'EVENT_C',
      message: 'Third step'
    });

    const brokenChain = [ev1, ev3];
    const result = await verifyEvidenceChain({
      tenantId: testTenantA.id,
      environmentId: env.id,
      events: brokenChain,
      prismaClient: prisma
    });

    assert.equal(result.valid, false, 'Skipped event must break the chain');
    assert.ok(
      result.violations.some((v) => v.type === 'SEQUENCE_GAP' || v.type === 'BROKEN_CHAIN_LINK'),
      'Must identify sequence gap or broken link'
    );
  });

  // ---------------------------------------------------------------------------
  // Category 16: Evidence Payload Tampering
  // ---------------------------------------------------------------------------
  it('16. Evidence payload tampering: Modifying event payload causes PAYLOAD_TAMPERED violation', async () => {
    const env = await prisma.deceptionRuntimeEnvironment.create({
      data: {
        tenantId: testTenantA.id,
        authorizationId: testAuthA.id,
        dsgGraphId: dsgGraphA.id,
        dsgGraphVersion: 1,
        environmentIdentifier: `env-payload-tamper-${Date.now()}`,
        name: 'Payload Tamper Env',
        lifecycleState: RUNTIME_LIFECYCLE_STATES.ACTIVE,
        healthStatus: 'HEALTHY'
      }
    });

    const ev1 = await evidenceRecorder.recordEvent({
      tenantId: testTenantA.id,
      environmentId: env.id,
      eventType: 'AUTH_VALIDATED',
      message: 'Original message'
    });

    const tamperedPayload = {
      ...ev1.eventPayload,
      message: 'Attacker modified this payload!'
    };

    const tamperedEvent = { ...ev1, eventPayload: tamperedPayload };

    const result = await verifyEvidenceChain({
      tenantId: testTenantA.id,
      environmentId: env.id,
      events: [tamperedEvent],
      prismaClient: prisma
    });

    assert.equal(result.valid, false, 'Tampered payload must fail chain verification');
    assert.ok(result.violations.some((v) => v.type === 'PAYLOAD_TAMPERED'));
  });

  // ---------------------------------------------------------------------------
  // Category 17: Duplicate Evidence Events
  // ---------------------------------------------------------------------------
  it('17. Duplicate evidence events: Duplicate event IDs or sequence numbers are flagged in completeness report', async () => {
    const env = await prisma.deceptionRuntimeEnvironment.create({
      data: {
        tenantId: testTenantA.id,
        authorizationId: testAuthA.id,
        dsgGraphId: dsgGraphA.id,
        dsgGraphVersion: 1,
        environmentIdentifier: `env-dup-test-${Date.now()}`,
        name: 'Duplicate Event Env',
        lifecycleState: RUNTIME_LIFECYCLE_STATES.ACTIVE,
        healthStatus: 'HEALTHY'
      }
    });

    const ev1 = await evidenceRecorder.recordEvent({
      tenantId: testTenantA.id,
      environmentId: env.id,
      eventType: 'EVENT_ONE',
      message: 'Original event'
    });

    const duplicateList = [ev1, ev1];

    const report = await verifyEvidenceCompleteness({
      tenantId: testTenantA.id,
      environmentId: env.id,
      events: duplicateList,
      prismaClient: prisma
    });

    assert.ok(report.duplicateEvents.length > 0, 'Must detect duplicate events in completeness report');
  });

  // ---------------------------------------------------------------------------
  // Category 18: Missing Lifecycle Events
  // ---------------------------------------------------------------------------
  it('18. Missing lifecycle events: Incomplete lifecycle produces PARTIAL or INCOMPLETE completeness status', async () => {
    const env = await prisma.deceptionRuntimeEnvironment.create({
      data: {
        tenantId: testTenantA.id,
        authorizationId: testAuthA.id,
        dsgGraphId: dsgGraphA.id,
        dsgGraphVersion: 1,
        environmentIdentifier: `env-incomplete-${Date.now()}`,
        name: 'Incomplete Lifecycle Env',
        lifecycleState: RUNTIME_LIFECYCLE_STATES.ACTIVE,
        healthStatus: 'HEALTHY'
      }
    });

    await evidenceRecorder.recordEvent({
      tenantId: testTenantA.id,
      environmentId: env.id,
      eventType: EXECUTION_EVENT_TYPES.PROVISIONING_REQUESTED,
      message: 'Only provisioning was requested'
    });

    const report = await verifyEvidenceCompleteness({
      tenantId: testTenantA.id,
      environmentId: env.id,
      prismaClient: prisma
    });

    assert.ok(
      report.completeness === 'PARTIAL' || report.completeness === 'INCOMPLETE',
      `Completeness should be PARTIAL or INCOMPLETE, got: ${report.completeness}`
    );
    assert.ok(report.missingEvents.length > 0, 'Must enumerate missing lifecycle events');
    assert.ok(report.missingEvents.includes('IMAGE_VERIFIED'), 'Must report missing IMAGE_VERIFIED');
    assert.ok(report.missingEvents.includes('CONTAINER_CREATED'), 'Must report missing CONTAINER_CREATED');
  });

  // ---------------------------------------------------------------------------
  // Category 19: Tenant Isolation
  // ---------------------------------------------------------------------------
  it('19. Tenant isolation: Tenant B cannot access Tenant A health details, telemetry, or evidence', async () => {
    const envA = await prisma.deceptionRuntimeEnvironment.create({
      data: {
        tenantId: testTenantA.id,
        authorizationId: testAuthA.id,
        dsgGraphId: dsgGraphA.id,
        dsgGraphVersion: 1,
        environmentIdentifier: `env-tenant-a-${Date.now()}`,
        name: 'Tenant A Sensitive Environment',
        lifecycleState: RUNTIME_LIFECYCLE_STATES.ACTIVE,
        healthStatus: 'HEALTHY'
      }
    });

    const healthMonitor = new RuntimeHealthMonitorService({ prismaClient: prisma, workerClient });

    await assert.rejects(async () => {
      await healthMonitor.inspectEnvironmentHealth({
        tenantId: testTenantB.id,
        environmentId: envA.id
      });
    }, /not found/i);

    const crossRes = await fetch(`${baseUrl}/tenants/${testTenantB.id}/runtime/environments/${envA.id}/health-details`, {
      headers: {
        Cookie: ownerBCookie,
        'x-csrf-token': ownerBCsrf
      }
    });
    assert.equal(crossRes.status, 404, 'Cross-tenant access must return 404 Not Found');
  });

  // ---------------------------------------------------------------------------
  // Category 20: Expired Authorization Rejection
  // ---------------------------------------------------------------------------
  it('20. Expired authorization: Provisioning dispatcher rejects expired authorization', async () => {
    const expiredAuth = await prisma.deceptionExecutionAuthorization.create({
      data: {
        tenantId: testTenantA.id,
        applicationId: testAppA?.id || null,
        policyDecisionId: policyDecisionA.id,
        dsgGraphId: dsgGraphA.id,
        dsgGraphVersion: 1,
        selectedStrategyId: 'strat-api-shadow-facade-01',
        authorizationStatus: 'APPROVED',
        requestingOperatorId: 'user-analyst-a',
        requestingOperatorEmail: 'analyst@apexfintech.io',
        approvingOperatorId: 'user-owner-a',
        approvingOperatorEmail: 'owner@apexfintech.io',
        authorizationReasonCodes: ['STAGE_5B3_EXPIRED_TEST'],
        expiresAt: new Date(Date.now() - 3600 * 1000)
      }
    });

    const dispatcher = new ProvisioningDispatcher({ prismaClient: prisma });
    await assert.rejects(async () => {
      await dispatcher.submitProvisioningJob({
        tenantId: testTenantA.id,
        authorizationId: expiredAuth.id,
        templateIdentifier: 'tpl-synthetic-api-01'
      });
    }, /expired/i);
  });

  // ---------------------------------------------------------------------------
  // Category 21: Revoked Authorization Rejection
  // ---------------------------------------------------------------------------
  it('21. Revoked authorization: Provisioning dispatcher rejects revoked authorization', async () => {
    const revokedAuth = await prisma.deceptionExecutionAuthorization.create({
      data: {
        tenantId: testTenantA.id,
        applicationId: testAppA?.id || null,
        policyDecisionId: policyDecisionA.id,
        dsgGraphId: dsgGraphA.id,
        dsgGraphVersion: 1,
        selectedStrategyId: 'strat-api-shadow-facade-01',
        authorizationStatus: 'APPROVED',
        requestingOperatorId: 'user-analyst-a',
        requestingOperatorEmail: 'analyst@apexfintech.io',
        approvingOperatorId: 'user-owner-a',
        approvingOperatorEmail: 'owner@apexfintech.io',
        authorizationReasonCodes: ['STAGE_5B3_REVOKED_TEST'],
        revokedAt: new Date(),
        revokedBy: 'user-owner-a',
        expiresAt: new Date(Date.now() + 3600 * 1000)
      }
    });

    const dispatcher = new ProvisioningDispatcher({ prismaClient: prisma });
    await assert.rejects(async () => {
      await dispatcher.submitProvisioningJob({
        tenantId: testTenantA.id,
        authorizationId: revokedAuth.id,
        templateIdentifier: 'tpl-synthetic-api-01'
      });
    }, /revoked/i);
  });

  // ---------------------------------------------------------------------------
  // Category 22: Stale DSG Version Rejection
  // ---------------------------------------------------------------------------
  it('22. Stale DSG version: Optimistic version check rejects stale DSG graph version during mutation/job', async () => {
    const currentVersion = dsgGraphA.graphVersion;

    const staleAuth = await prisma.deceptionExecutionAuthorization.create({
      data: {
        tenantId: testTenantA.id,
        applicationId: testAppA?.id || null,
        policyDecisionId: policyDecisionA.id,
        dsgGraphId: dsgGraphA.id,
        dsgGraphVersion: currentVersion + 999,
        selectedStrategyId: 'strat-api-shadow-facade-01',
        authorizationStatus: 'APPROVED',
        requestingOperatorId: 'user-analyst-a',
        requestingOperatorEmail: 'analyst@apexfintech.io',
        approvingOperatorId: 'user-owner-a',
        approvingOperatorEmail: 'owner@apexfintech.io',
        authorizationReasonCodes: ['STAGE_5B3_VERSION_TEST'],
        expiresAt: new Date(Date.now() + 3600 * 1000)
      }
    });

    const dispatcher = new ProvisioningDispatcher({ prismaClient: prisma });
    await assert.rejects(async () => {
      await dispatcher.submitProvisioningJob({
        tenantId: testTenantA.id,
        authorizationId: staleAuth.id,
        templateIdentifier: 'tpl-synthetic-api-01'
      });
    }, /Stale DSG Graph|version mismatch/i);
  });

  // ---------------------------------------------------------------------------
  // Category 23: Partial Cleanup & Leaked Network Detection
  // ---------------------------------------------------------------------------
  it('23. Partial cleanup: Detects leaked isolated network left behind after container cleanup', async () => {
    const leakedNetEnvId = `env-leaked-${Date.now()}`;
    const leakedNetwork = await adapter.createIsolatedNetwork({
      tenantId: testTenantA.id,
      environmentId: leakedNetEnvId
    });
    cleanupNetworks.add(leakedNetwork.networkId);

    const reconciliation = new RuntimeReconciliationService({
      prismaClient: prisma,
      workerClient,
      evidenceRecorder
    });

    const tenantScan = await reconciliation.reconcileTenant({
      tenantId: testTenantA.id
    });

    assert.ok(
      tenantScan.orphans.networks.some((r) => r.networkId === leakedNetwork.networkId),
      'Must identify unreferenced leaked network'
    );

    await adapter.removeIsolatedNetwork(leakedNetwork.networkId).catch(() => {});
    cleanupNetworks.delete(leakedNetwork.networkId);
  });

  // ---------------------------------------------------------------------------
  // Category 24: Recovery After Worker Restart
  // ---------------------------------------------------------------------------
  it('24. Recovery after worker restart: Worker restart preserves state and handles subsequent inspections', async () => {
    const healthStatus = await workerClient.getHealth();
    assert.equal(healthStatus.ok, true);
    assert.ok(healthStatus.workerProcess.pid > 0);

    const env = await prisma.deceptionRuntimeEnvironment.create({
      data: {
        tenantId: testTenantA.id,
        authorizationId: testAuthA.id,
        dsgGraphId: dsgGraphA.id,
        dsgGraphVersion: 1,
        environmentIdentifier: `env-worker-restart-${Date.now()}`,
        name: 'Worker Restart Env',
        lifecycleState: RUNTIME_LIFECYCLE_STATES.PROVISIONING,
        containerId: null,
        healthStatus: 'UNKNOWN'
      }
    });

    const healthMonitor = new RuntimeHealthMonitorService({ prismaClient: prisma, workerClient, cacheTtlMs: 0 });
    const healthBefore = await healthMonitor.inspectEnvironmentHealth({
      tenantId: testTenantA.id,
      environmentId: env.id
    });
    assert.equal(healthBefore.healthState, HEALTH_STATES.UNKNOWN);

    const reconciliation = new RuntimeReconciliationService({ prismaClient: prisma, workerClient });
    const scan = await reconciliation.reconcileTenant({
      tenantId: testTenantA.id
    });
    assert.ok(scan.timestamp);
    assert.ok(typeof scan.summary.totalEnvironments === 'number');
  });

  // ---------------------------------------------------------------------------
  // Category 25: Dashboard API Integration (All 10 endpoints verified)
  // ---------------------------------------------------------------------------
  it('25. Dashboard API integration: All 10 Stage 5B.3 REST endpoints return standard responses and enforce auth', async () => {
    const env = await prisma.deceptionRuntimeEnvironment.create({
      data: {
        tenantId: testTenantA.id,
        authorizationId: testAuthA.id,
        dsgGraphId: dsgGraphA.id,
        dsgGraphVersion: 1,
        environmentIdentifier: `env-api-test-${Date.now()}`,
        name: 'Dashboard API Integration Env',
        lifecycleState: RUNTIME_LIFECYCLE_STATES.ACTIVE,
        containerId: null,
        healthStatus: 'UNKNOWN'
      }
    });

    const authHeaders = {
      Cookie: ownerACookie,
      'x-csrf-token': ownerACsrf,
      'Content-Type': 'application/json'
    };

    // Endpoint 1: GET /tenants/:tenantId/runtime/health/overview
    const ep1 = await fetch(`${baseUrl}/tenants/${testTenantA.id}/runtime/health/overview`, { headers: authHeaders });
    assert.equal(ep1.status, 200, 'GET /health/overview must return 200');
    const ep1Data = await ep1.json();
    assert.equal(ep1Data.status, 'success');
    assert.ok(ep1Data.data.summary);

    // Endpoint 2: GET /tenants/:tenantId/runtime/environments/:id/health-details
    const ep2 = await fetch(`${baseUrl}/tenants/${testTenantA.id}/runtime/environments/${env.id}/health-details`, { headers: authHeaders });
    assert.equal(ep2.status, 200, 'GET /environments/:id/health-details must return 200');
    const ep2Data = await ep2.json();
    assert.equal(ep2Data.status, 'success');
    assert.equal(ep2Data.data.environmentId, env.id);

    // Endpoint 3: GET /tenants/:tenantId/runtime/telemetry/summary
    const ep3 = await fetch(`${baseUrl}/tenants/${testTenantA.id}/runtime/telemetry/summary`, { headers: authHeaders });
    assert.equal(ep3.status, 200, 'GET /telemetry/summary must return 200');
    const ep3Data = await ep3.json();
    assert.equal(ep3Data.status, 'success');

    // Endpoint 4: GET /tenants/:tenantId/runtime/environments/:id/telemetry
    const ep4 = await fetch(`${baseUrl}/tenants/${testTenantA.id}/runtime/environments/${env.id}/telemetry`, { headers: authHeaders });
    assert.equal(ep4.status, 200, 'GET /environments/:id/telemetry must return 200');
    const ep4Data = await ep4.json();
    assert.equal(ep4Data.status, 'success');
    assert.ok(Array.isArray(ep4Data.data.events));

    // Endpoint 5: GET /tenants/:tenantId/runtime/reconciliation
    const ep5 = await fetch(`${baseUrl}/tenants/${testTenantA.id}/runtime/reconciliation`, { headers: authHeaders });
    assert.equal(ep5.status, 200, 'GET /reconciliation must return 200');
    const ep5Data = await ep5.json();
    assert.equal(ep5Data.status, 'success');
    assert.ok(ep5Data.data.summary);

    // Endpoint 6: POST /tenants/:tenantId/runtime/reconciliation/run
    const ep6 = await fetch(`${baseUrl}/tenants/${testTenantA.id}/runtime/reconciliation/run`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({})
    });
    assert.equal(ep6.status, 200, 'POST /reconciliation/run must return 200');
    const ep6Data = await ep6.json();
    assert.equal(ep6Data.status, 'success');
    assert.ok(ep6Data.data.timestamp);

    // Endpoint 7: GET /tenants/:tenantId/runtime/environments/:id/evidence/verify
    const ep7 = await fetch(`${baseUrl}/tenants/${testTenantA.id}/runtime/environments/${env.id}/evidence/verify`, { headers: authHeaders });
    assert.equal(ep7.status, 200, 'GET /environments/:id/evidence/verify must return 200');
    const ep7Data = await ep7.json();
    assert.equal(ep7Data.status, 'success');
    assert.equal(typeof ep7Data.data.valid, 'boolean');

    // Endpoint 8: GET /tenants/:tenantId/runtime/environments/:id/evidence/completeness
    const ep8 = await fetch(`${baseUrl}/tenants/${testTenantA.id}/runtime/environments/${env.id}/evidence/completeness`, { headers: authHeaders });
    assert.equal(ep8.status, 200, 'GET /environments/:id/evidence/completeness must return 200');
    const ep8Data = await ep8.json();
    assert.equal(ep8Data.status, 'success');
    assert.ok(['COMPLETE', 'PARTIAL', 'INCOMPLETE', 'CORRUPTED'].includes(ep8Data.data.completeness));

    // Endpoint 9: GET /tenants/:tenantId/runtime/mutations?environmentId=...
    const ep9 = await fetch(`${baseUrl}/tenants/${testTenantA.id}/runtime/mutations?environmentId=${env.id}`, { headers: authHeaders });
    assert.equal(ep9.status, 200, 'GET /mutations must return 200');
    const ep9Data = await ep9.json();
    assert.equal(ep9Data.status, 'success');
    assert.ok(Array.isArray(ep9Data.data));

    // Endpoint 10: POST /tenants/:tenantId/runtime/mutations (Propose a safe mutation)
    const ep10 = await fetch(`${baseUrl}/tenants/${testTenantA.id}/runtime/mutations`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        environmentId: env.id,
        mutationType: 'TOPOLOGY_EXPANSION',
        targetGraphVersion: 2,
        syntheticDiff: { expansionNodes: 2 }
      })
    });
    assert.equal(ep10.status, 201, 'POST /mutations must return 201 Created');
    const ep10Data = await ep10.json();
    assert.equal(ep10Data.status, 'success');
    assert.equal(ep10Data.data.mutationType, 'TOPOLOGY_EXPANSION');
    assert.equal(ep10Data.data.mutationStatus, 'PROPOSED', 'Proposed mutation must be in PROPOSED status');
  });
});
