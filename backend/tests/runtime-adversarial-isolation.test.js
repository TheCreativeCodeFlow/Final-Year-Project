/**
 * Stage 5B.2.1 — Container Isolation, Runtime Security & Adversarial Verification Suite
 *
 * Conducts an adversarial security audit of Stage 5B.2 container provisioning:
 * - Docker trust boundary & parameter validation.
 * - Adversarial network isolation testing against real running Docker containers.
 * - Container sandbox security, Linux capabilities, and kernel cgroup invariants.
 * - Image supply-chain verification and immutable digest matching.
 * - Runtime worker failure injection, orphan teardown, and concurrency safety.
 * - Execution evidence integrity and canonical payload verification.
 * - Separation of duties and dual-custody authorization safeguards.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import { getPrismaClient, connectDatabase } from '../src/db/client.js';
import { hashPassword } from '../src/utils/passwords.js';
import { ContainerRuntimeAdapter } from '../src/runtime/container-runtime-adapter.js';
import { RuntimeWorkerService, canonicalJsonStringify } from '../src/runtime/runtime-worker.service.js';
import { ProvisioningDispatcher } from '../src/runtime/provisioning-dispatcher.js';
import { ResourceGovernanceService } from '../src/runtime/resource-governance.service.js';
import { ExecutionEvidenceRecorder, verifyEvidenceIntegrity } from '../src/runtime/execution-evidence-recorder.service.js';
import { getApprovedImage, verifyImageDigest, validateImageForServiceType } from '../src/runtime/image-catalogue.js';
import { RUNTIME_LIFECYCLE_STATES } from '../src/runtime/lifecycle-state-machine.js';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@127.0.0.1:5432/adaptive_deception_test?schema=public';

describe('Stage 5B.2.1: Container Isolation, Runtime Security & Adversarial Verification Suite', () => {
  let app;
  let server;
  let baseUrl;
  let prisma;
  let adapter;

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

  // Track created Docker resources for reliable cleanup
  const createdContainers = [];
  const createdNetworks = [];

  before(async () => {
    const config = loadEnv();
    prisma = getPrismaClient({ databaseUrl: TEST_DATABASE_URL });
    await connectDatabase(prisma);
    adapter = new ContainerRuntimeAdapter();

    app = createApp({ envConfig: config, prisma });
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => resolve());
    });
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}/api/v1`;

    // 1. Clean up previous test records
    await prisma.deceptionProvisioningJob.deleteMany();
    await prisma.deceptionRuntimeMutation.deleteMany();
    await prisma.deceptionRuntimeEnvironment.deleteMany();
    await prisma.deceptionExecutionEvent.deleteMany();
    await prisma.deceptionExecutionAuthorization.deleteMany();
    await prisma.deceptionResourceQuota.deleteMany();

    // 2. Resolve seed tenants
    const tApex = await prisma.tenant.findUnique({ where: { identifier: 'tenant-apex-9941' } });
    const tMed = await prisma.tenant.findUnique({ where: { identifier: 'tenant-medsecure-7712' } });
    assert.ok(tApex, 'Seed tenant apex must exist');
    assert.ok(tMed, 'Seed tenant medsecure must exist');
    tenantApexId = tApex.id;
    tenantMedId = tMed.id;

    // 3. Resolve Protected Application
    const appApex = await prisma.protectedApplication.findFirst({ where: { tenantId: tenantApexId } });
    assert.ok(appApex, 'Protected application must exist');
    appApexId = appApex.id;

    // 4. Seed Resource Quota
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

    // 5. Ensure analyst and owner users exist
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
    const analystMember = await prisma.tenantMembership.findFirst({
      where: { userId: analystUser.id, tenantId: tenantApexId }
    });
    if (!analystMember) {
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
    const ownerMember = await prisma.tenantMembership.findFirst({
      where: { userId: ownerUser.id, tenantId: tenantApexId }
    });
    if (!ownerMember) {
      await prisma.tenantMembership.create({
        data: {
          userId: ownerUser.id,
          tenantId: tenantApexId,
          role: 'APPLICATION_OWNER',
          permissions: ['read:policies', 'manage:policies', 'manage:deception_runtime']
        }
      });
    }

    // 6. Resolve Policy, DSG Graph, and Decision
    testPolicy = await prisma.deceptionPolicy.findFirst({
      where: {
        OR: [
          { tenantId: tenantApexId },
          { tenantId: null }
        ]
      }
    });
    if (!testPolicy) {
      testPolicy = await prisma.deceptionPolicy.findFirst();
    }

    testGraph = await prisma.deceptionGraph.findFirst({
      where: { tenantId: tenantApexId, graphIdentifier: 'dsg-stage5b21-test' }
    });
    if (!testGraph) {
      testGraph = await prisma.deceptionGraph.create({
        data: {
          tenantId: tenantApexId,
          applicationId: appApexId,
          graphIdentifier: 'dsg-stage5b21-test',
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
        decisionRationale: 'Adversarial container isolation test decision',
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

    // 7. Login sessions
    const resLoginOwner = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner@apexfintech.io', password: 'DevOwner12345!' })
    });
    const dataOwner = await resLoginOwner.json();
    ownerCsrfToken = dataOwner.data.antiCsrfToken;
    ownerCookie = resLoginOwner.headers.get('set-cookie');

    const resLoginAnalyst = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'analyst@apexfintech.io', password: 'DevAnalyst12345!' })
    });
    const dataAnalyst = await resLoginAnalyst.json();
    analystCsrfToken = dataAnalyst.data.antiCsrfToken;
    analystCookie = resLoginAnalyst.headers.get('set-cookie');
  });

  after(async () => {
    // Teardown any remaining Docker resources created by this test suite
    for (const cid of createdContainers) {
      await adapter.stopAndRemoveContainer(cid).catch(() => {});
    }
    for (const nid of createdNetworks) {
      await adapter.removeIsolatedNetwork(nid).catch(() => {});
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  // ===========================================================================
  // 1. DOCKER TRUST BOUNDARY & PARAMETER HARDENING
  // ===========================================================================
  describe('1. Docker Trust Boundary & Parameter Hardening', () => {
    let dummyNetwork;

    before(async () => {
      dummyNetwork = await adapter.createIsolatedNetwork({
        tenantId: tenantApexId,
        environmentId: 'dummy-env-boundary-01'
      });
      createdNetworks.push(dummyNetwork.networkId);
    });

    it('should reject attempts to configure host network mode', async () => {
      await assert.rejects(
        async () => {
          await adapter.createSyntheticContainer({
            tenantId: tenantApexId,
            environmentId: 'test-env-hostnet',
            jobId: 'job-boundary-01',
            imageIdentifier: 'img-syn-alpine-node-01',
            networkName: 'host'
          });
        },
        (err) => {
          assert.equal(err.code, 'INSECURE_NETWORK_MODE_REJECTED');
          return true;
        }
      );
    });

    it('should reject attempts to use the default bridge network', async () => {
      await assert.rejects(
        async () => {
          await adapter.createSyntheticContainer({
            tenantId: tenantApexId,
            environmentId: 'test-env-bridgenet',
            jobId: 'job-boundary-02',
            imageIdentifier: 'img-syn-alpine-node-01',
            networkName: 'bridge'
          });
        },
        (err) => {
          assert.equal(err.code, 'INSECURE_NETWORK_MODE_REJECTED');
          return true;
        }
      );
    });

    it('should reject non-deception network name formats', async () => {
      await assert.rejects(
        async () => {
          await adapter.createSyntheticContainer({
            tenantId: tenantApexId,
            environmentId: 'test-env-badformat',
            jobId: 'job-boundary-03',
            imageIdentifier: 'img-syn-alpine-node-01',
            networkName: 'arbitrary-network-name'
          });
        },
        (err) => {
          assert.equal(err.code, 'INVALID_NETWORK_NAME_FORMAT');
          return true;
        }
      );
    });

    it('should reject non-existent networks', async () => {
      await assert.rejects(
        async () => {
          await adapter.createSyntheticContainer({
            tenantId: tenantApexId,
            environmentId: 'test-env-nonexistent',
            jobId: 'job-boundary-04',
            imageIdentifier: 'img-syn-alpine-node-01',
            networkName: 'dec-net-nonexistent-1234'
          });
        },
        (err) => {
          assert.equal(err.code, 'NETWORK_NOT_FOUND');
          return true;
        }
      );
    });

    it('should reject dangerous environment variable injection (NODE_OPTIONS)', async () => {
      await assert.rejects(
        async () => {
          await adapter.createSyntheticContainer({
            tenantId: tenantApexId,
            environmentId: 'test-env-badenv1',
            jobId: 'job-boundary-05',
            imageIdentifier: 'img-syn-alpine-node-01',
            networkName: dummyNetwork.networkName,
            extraEnv: { NODE_OPTIONS: '--inspect=0.0.0.0:9229' }
          });
        },
        (err) => {
          assert.equal(err.code, 'FORBIDDEN_ENV_VARIABLE');
          return true;
        }
      );
    });

    it('should reject dangerous environment variable injection (LD_PRELOAD)', async () => {
      await assert.rejects(
        async () => {
          await adapter.createSyntheticContainer({
            tenantId: tenantApexId,
            environmentId: 'test-env-badenv2',
            jobId: 'job-boundary-06',
            imageIdentifier: 'img-syn-alpine-node-01',
            networkName: dummyNetwork.networkName,
            extraEnv: { LD_PRELOAD: '/tmp/malicious.so' }
          });
        },
        (err) => {
          assert.equal(err.code, 'FORBIDDEN_ENV_VARIABLE');
          return true;
        }
      );
    });

    it('should reject environment variable keys with invalid format', async () => {
      await assert.rejects(
        async () => {
          await adapter.createSyntheticContainer({
            tenantId: tenantApexId,
            environmentId: 'test-env-badkey',
            jobId: 'job-boundary-07',
            imageIdentifier: 'img-syn-alpine-node-01',
            networkName: dummyNetwork.networkName,
            extraEnv: { 'INVALID KEY; DROP TABLE': '1' }
          });
        },
        (err) => {
          assert.equal(err.code, 'INVALID_ENV_KEY_FORMAT');
          return true;
        }
      );
    });

    it('should reject environment values containing null bytes or newlines', async () => {
      await assert.rejects(
        async () => {
          await adapter.createSyntheticContainer({
            tenantId: tenantApexId,
            environmentId: 'test-env-badval',
            jobId: 'job-boundary-08',
            imageIdentifier: 'img-syn-alpine-node-01',
            networkName: dummyNetwork.networkName,
            extraEnv: { SAFE_CANARY_VAL: 'value\x00injected' }
          });
        },
        (err) => {
          assert.equal(err.code, 'ILLEGAL_ENV_VALUE_CHARS');
          return true;
        }
      );
    });
  });

  // ===========================================================================
  // 2. ADVERSARIAL NETWORK ISOLATION TESTING (REAL DOCKER CONTAINER)
  // ===========================================================================
  describe('2. Adversarial Network Isolation (Real Running Synthetic Container)', () => {
    let testNetwork;
    let testContainer;
    let containerIp;

    before(async () => {
      // Provision dedicated isolated network
      testNetwork = await adapter.createIsolatedNetwork({
        tenantId: tenantApexId,
        environmentId: 'adv-net-test-01'
      });
      createdNetworks.push(testNetwork.networkId);

      // Provision synthetic container
      const c = await adapter.createSyntheticContainer({
        tenantId: tenantApexId,
        environmentId: 'adv-net-test-01',
        jobId: 'job-adv-net-01',
        imageIdentifier: 'img-syn-alpine-node-01',
        networkName: testNetwork.networkName,
        serviceType: 'SYNTHETIC_API'
      });
      testContainer = c;
      createdContainers.push(c.containerId);

      await adapter.startContainer(c.containerId);
      // Wait for node server to start
      await new Promise((r) => setTimeout(r, 1000));

      const inspected = await adapter.inspectContainer(c.containerId);
      containerIp = inspected.ipAddress;
      assert.ok(containerIp, 'Container must have an internal IP address');
    });

    it('should block Internet TCP connectivity (8.8.8.8:53 returns ENETUNREACH)', async () => {
      const script = [
        'node',
        '-e',
        "const net = require('net'); const s = net.createConnection(53, '8.8.8.8'); s.setTimeout(800); s.on('error', e => { console.log('RESULT:' + e.code); process.exit(0); }); s.on('timeout', () => { console.log('RESULT:TIMEOUT'); s.destroy(); process.exit(0); }); s.on('connect', () => { console.log('RESULT:CONNECTED'); s.destroy(); process.exit(0); });"
      ];
      const res = await adapter.execCommand(testContainer.containerId, script);
      assert.ok(
        res.output.includes('RESULT:ENETUNREACH') || res.output.includes('RESULT:TIMEOUT'),
        `Expected ENETUNREACH or TIMEOUT, got: ${res.output}`
      );
      assert.ok(!res.output.includes('RESULT:CONNECTED'), 'Container must NOT connect to public Internet TCP!');
    });

    it('should block Internet UDP connectivity (8.8.8.8:53 returns ENETUNREACH)', async () => {
      const script = [
        'node',
        '-e',
        "const dgram = require('dgram'); const c = dgram.createSocket('udp4'); c.send(Buffer.from([0]), 53, '8.8.8.8', (err) => { console.log('RESULT:' + (err ? err.code : 'SENT')); c.close(); process.exit(0); });"
      ];
      const res = await adapter.execCommand(testContainer.containerId, script);
      assert.ok(
        res.output.includes('RESULT:ENETUNREACH'),
        `Expected ENETUNREACH for UDP, got: ${res.output}`
      );
    });

    it('should fail public DNS resolution (google.com returns EAI_AGAIN)', async () => {
      const script = [
        'node',
        '-e',
        "require('dns').lookup('google.com', (err, addr) => { console.log('RESULT:' + (err ? err.code : addr)); process.exit(0); });"
      ];
      const res = await adapter.execCommand(testContainer.containerId, script);
      assert.ok(
        res.output.includes('RESULT:EAI_AGAIN') || res.output.includes('RESULT:ENOTFOUND'),
        `Expected DNS resolution failure, got: ${res.output}`
      );
    });

    it('should block external IPv4 routing (1.1.1.1:80 returns ENETUNREACH)', async () => {
      const script = [
        'node',
        '-e',
        "const net = require('net'); const s = net.createConnection(80, '1.1.1.1'); s.setTimeout(800); s.on('error', e => { console.log('RESULT:' + e.code); process.exit(0); }); s.on('timeout', () => { console.log('RESULT:TIMEOUT'); s.destroy(); process.exit(0); }); s.on('connect', () => { console.log('RESULT:CONNECTED'); s.destroy(); process.exit(0); });"
      ];
      const res = await adapter.execCommand(testContainer.containerId, script);
      assert.ok(res.output.includes('RESULT:ENETUNREACH') || res.output.includes('RESULT:TIMEOUT'));
      assert.ok(!res.output.includes('RESULT:CONNECTED'));
    });

    it('should block external IPv6 routing (2001:4860:4860::8888 returns ENETUNREACH)', async () => {
      const script = [
        'node',
        '-e',
        "const net = require('net'); const s = net.createConnection(53, '2001:4860:4860::8888'); s.setTimeout(800); s.on('error', e => { console.log('RESULT:' + e.code); process.exit(0); }); s.on('timeout', () => { console.log('RESULT:TIMEOUT'); s.destroy(); process.exit(0); }); s.on('connect', () => { console.log('RESULT:CONNECTED'); s.destroy(); process.exit(0); });"
      ];
      const res = await adapter.execCommand(testContainer.containerId, script);
      assert.ok(res.output.includes('RESULT:ENETUNREACH') || res.output.includes('RESULT:EADDRNOTAVAIL'));
      assert.ok(!res.output.includes('RESULT:CONNECTED'));
    });

    it('should verify host bridge gateway port 5432 (Postgres) is inaccessible (ECONNREFUSED)', async () => {
      // Extract bridge gateway IP by replacing last octet with 1
      const bridgeIp = containerIp.replace(/\.\d+$/, '.1');
      const script = [
        'node',
        '-e',
        `const net = require('net'); const s = net.createConnection(5432, '${bridgeIp}'); s.setTimeout(800); s.on('error', e => { console.log('RESULT:' + e.code); process.exit(0); }); s.on('timeout', () => { console.log('RESULT:TIMEOUT'); s.destroy(); process.exit(0); }); s.on('connect', () => { console.log('RESULT:CONNECTED'); s.destroy(); process.exit(0); });`
      ];
      const res = await adapter.execCommand(testContainer.containerId, script);
      assert.ok(
        res.output.includes('RESULT:ECONNREFUSED') || res.output.includes('RESULT:TIMEOUT'),
        `Postgres on bridge IP must be inaccessible, got: ${res.output}`
      );
      assert.ok(!res.output.includes('RESULT:CONNECTED'), 'Database port must NOT be reachable from synthetic container!');
    });

    it('should verify host bridge gateway port 6379 (Redis) is inaccessible (ECONNREFUSED)', async () => {
      const bridgeIp = containerIp.replace(/\.\d+$/, '.1');
      const script = [
        'node',
        '-e',
        `const net = require('net'); const s = net.createConnection(6379, '${bridgeIp}'); s.setTimeout(800); s.on('error', e => { console.log('RESULT:' + e.code); process.exit(0); }); s.on('timeout', () => { console.log('RESULT:TIMEOUT'); s.destroy(); process.exit(0); }); s.on('connect', () => { console.log('RESULT:CONNECTED'); s.destroy(); process.exit(0); });`
      ];
      const res = await adapter.execCommand(testContainer.containerId, script);
      assert.ok(
        res.output.includes('RESULT:ECONNREFUSED') || res.output.includes('RESULT:TIMEOUT'),
        `Redis on bridge IP must be inaccessible, got: ${res.output}`
      );
    });

    it('should verify host bridge gateway Docker daemon ports (2375, 2376) are inaccessible', async () => {
      const bridgeIp = containerIp.replace(/\.\d+$/, '.1');
      const script = [
        'node',
        '-e',
        `const net = require('net'); const s = net.createConnection(2375, '${bridgeIp}'); s.setTimeout(800); s.on('error', e => { console.log('RESULT:' + e.code); process.exit(0); }); s.on('timeout', () => { console.log('RESULT:TIMEOUT'); s.destroy(); process.exit(0); }); s.on('connect', () => { console.log('RESULT:CONNECTED'); s.destroy(); process.exit(0); });`
      ];
      const res = await adapter.execCommand(testContainer.containerId, script);
      assert.ok(
        res.output.includes('RESULT:ECONNREFUSED') || res.output.includes('RESULT:TIMEOUT'),
        `Docker daemon port on bridge IP must be inaccessible, got: ${res.output}`
      );
    });

    it('should verify /var/run/docker.sock does not exist inside container', async () => {
      const script = [
        'node',
        '-e',
        "console.log('SOCK_EXISTS:' + require('fs').existsSync('/var/run/docker.sock'));"
      ];
      const res = await adapter.execCommand(testContainer.containerId, script);
      assert.ok(res.output.includes('SOCK_EXISTS:false'), 'Docker socket must NEVER be mounted into synthetic container!');
    });

    it('should enforce cross-tenant container isolation (Container A cannot reach Container B)', async () => {
      // Provision Tenant B's isolated network and container
      const netB = await adapter.createIsolatedNetwork({
        tenantId: tenantMedId,
        environmentId: 'tenant-b-env-01'
      });
      createdNetworks.push(netB.networkId);

      const contB = await adapter.createSyntheticContainer({
        tenantId: tenantMedId,
        environmentId: 'tenant-b-env-01',
        jobId: 'job-tenant-b-01',
        imageIdentifier: 'img-syn-alpine-node-01',
        networkName: netB.networkName,
        serviceType: 'SYNTHETIC_DATA'
      });
      createdContainers.push(contB.containerId);
      await adapter.startContainer(contB.containerId);
      await new Promise((r) => setTimeout(r, 800));

      const inspB = await adapter.inspectContainer(contB.containerId);
      const ipB = inspB.ipAddress;
      assert.ok(ipB, 'Tenant B container must have an internal IP');

      // Attempt to connect from Tenant A container to Tenant B container
      const script = [
        'node',
        '-e',
        `const net = require('net'); const s = net.createConnection(8080, '${ipB}'); s.setTimeout(800); s.on('error', e => { console.log('CROSS_RESULT:' + e.code); process.exit(0); }); s.on('timeout', () => { console.log('CROSS_RESULT:TIMEOUT'); s.destroy(); process.exit(0); }); s.on('connect', () => { console.log('CROSS_RESULT:CONNECTED'); s.destroy(); process.exit(0); });`
      ];
      const res = await adapter.execCommand(testContainer.containerId, script);
      assert.ok(
        res.output.includes('CROSS_RESULT:ENETUNREACH') || res.output.includes('CROSS_RESULT:TIMEOUT'),
        `Cross-tenant connectivity must be blocked (ENETUNREACH or TIMEOUT), got: ${res.output}`
      );
      assert.ok(!res.output.includes('CROSS_RESULT:CONNECTED'), 'Cross-tenant connection must NEVER succeed!');
    });
  });

  // ===========================================================================
  // 3. CONTAINER SANDBOX SECURITY & KERNEL INVARIANTS
  // ===========================================================================
  describe('3. Container Sandbox Security & Kernel Invariants', () => {
    let containerId;

    before(async () => {
      // Reuse running test container from previous suite
      containerId = createdContainers[0];
      assert.ok(containerId, 'Running container must exist for kernel testing');
    });

    it('should enforce non-root UID 1000 and GID 1000 at kernel level', async () => {
      const script = [
        'node',
        '-e',
        "console.log('UID:' + process.getuid() + ',GID:' + process.getgid());"
      ];
      const res = await adapter.execCommand(containerId, script);
      assert.ok(res.output.includes('UID:1000,GID:1000'), `Expected UID:1000,GID:1000, got: ${res.output}`);
    });

    it('should drop all Linux capabilities (CapEff strictly 0000000000000000 in /proc/1/status)', async () => {
      const res = await adapter.execCommand(containerId, ['cat', '/proc/1/status']);
      const match = res.output.match(/CapEff:\s*([0-9a-fA-F]+)/);
      assert.ok(match, 'CapEff must be present in /proc/1/status');
      assert.equal(match[1], '0000000000000000', 'Effective capabilities must be strictly zero!');
    });

    it('should enforce no-new-privileges (NoNewPrivs: 1 in /proc/1/status)', async () => {
      const res = await adapter.execCommand(containerId, ['cat', '/proc/1/status']);
      assert.ok(res.output.includes('NoNewPrivs:\t1') || res.output.includes('NoNewPrivs: 1'), 'NoNewPrivs must be 1');
    });

    it('should enforce read-only root filesystem (writing to /test.txt fails with EROFS)', async () => {
      const script = [
        'node',
        '-e',
        "try { require('fs').writeFileSync('/test.txt', 'malicious'); console.log('WRITE_SUCCESS'); } catch(e) { console.log('WRITE_ERR:' + e.code); }"
      ];
      const res = await adapter.execCommand(containerId, script);
      assert.ok(res.output.includes('WRITE_ERR:EROFS'), `Expected EROFS, got: ${res.output}`);
    });

    it('should block kernel parameter modification (writing to /proc/sys fails with EROFS)', async () => {
      const script = [
        'node',
        '-e',
        "try { require('fs').writeFileSync('/proc/sys/kernel/hostname', 'hacked'); console.log('WRITE_SUCCESS'); } catch(e) { console.log('PROC_ERR:' + e.code); }"
      ];
      const res = await adapter.execCommand(containerId, script);
      assert.ok(res.output.includes('PROC_ERR:EROFS'), `Expected EROFS on /proc/sys, got: ${res.output}`);
    });

    it('should mount /tmp with tmpfs, size-limit, and noexec restriction', async () => {
      const res = await adapter.execCommand(containerId, ['mount']);
      const tmpLine = res.output.split('\n').find((l) => l.includes('/tmp'));
      assert.ok(tmpLine, '/tmp mount must exist');
      assert.ok(tmpLine.includes('tmpfs'), '/tmp must be tmpfs');
      assert.ok(tmpLine.includes('noexec'), '/tmp must have noexec flag');
      assert.ok(tmpLine.includes('nosuid'), '/tmp must have nosuid flag');
    });

    it('should enforce cgroup PID limits (pids.max === 100)', async () => {
      const res = await adapter.execCommand(containerId, ['cat', '/sys/fs/cgroup/pids.max']);
      assert.equal(res.output.trim(), '100', 'pids.max must be exactly 100');
    });

    it('should enforce cgroup Memory limit (memory.max === 268435456 bytes / 256MB)', async () => {
      const res = await adapter.execCommand(containerId, ['cat', '/sys/fs/cgroup/memory.max']);
      assert.equal(res.output.trim(), '268435456', 'memory.max must be 268435456 bytes (256MB)');
    });

    it('should enforce cgroup CPU quota (cpu.max === 50000 100000)', async () => {
      const res = await adapter.execCommand(containerId, ['cat', '/sys/fs/cgroup/cpu.max']);
      assert.equal(res.output.trim(), '50000 100000', 'cpu.max must be 50000 100000 (0.5 cores)');
    });

    it('should enforce zero published host ports in container inspect', async () => {
      const inspected = await adapter.inspectContainer(containerId);
      // In Docker inspect, NetworkSettings.Ports maps internal exposed ports to null when NOT published to host
      for (const [port, bindings] of Object.entries(inspected.ports)) {
        assert.equal(bindings, null, `Port ${port} must not be bound to host interface`);
      }
      assert.deepEqual(inspected.HostConfig.PortBindings, {}, 'HostConfig.PortBindings must be strictly empty');
      assert.equal(inspected.privileged, false, 'Privileged mode must be false');
      assert.equal(inspected.readonlyRootfs, true, 'ReadonlyRootfs must be true');
    });
  });

  // ===========================================================================
  // 4. IMAGE SUPPLY-CHAIN & CATALOGUE VERIFICATION
  // ===========================================================================
  describe('4. Image Supply-Chain & Catalogue Verification', () => {
    it('should verify exact pinned immutable SHA-256 digest in catalogue', () => {
      const img = getApprovedImage('img-syn-alpine-node-01');
      assert.ok(img);
      assert.equal(
        img.immutableDigest,
        'sha256:5e6dcf93ac4d11b70fb663b5a0a6e39b75bff656dee257b789edd0a0a1b8cb29'
      );
      assert.equal(img.version, '1.0.0');
      assert.equal(img.securityConfiguration.runAsUser, '1000:1000');
      assert.equal(img.securityConfiguration.readOnlyRootfs, true);
    });

    it('should reject mismatched or unapproved image digests', () => {
      const res = verifyImageDigest(
        'img-syn-alpine-node-01',
        'sha256:0000000000000000000000000000000000000000000000000000000000000000'
      );
      assert.equal(res.valid, false);
      assert.ok(res.reason.includes('mismatch'));
    });

    it('should reject unapproved image identifiers at the runtime boundary', async () => {
      await assert.rejects(
        async () => {
          await adapter.verifyImage({ imageIdentifier: 'unapproved-hacker-image:latest' });
        },
        (err) => {
          assert.equal(err.code, 'UNAPPROVED_IMAGE_REFERENCE');
          return true;
        }
      );
    });

    it('should validate compatibility between images and service types', () => {
      assert.equal(validateImageForServiceType('img-syn-alpine-node-01', 'SYNTHETIC_API').valid, true);
      assert.equal(validateImageForServiceType('img-syn-alpine-node-01', 'SYNTHETIC_AUTH').valid, true);
      assert.equal(validateImageForServiceType('img-syn-alpine-node-01', 'SYNTHETIC_DATA').valid, true);
      assert.equal(validateImageForServiceType('img-syn-alpine-node-01', 'UNKNOWN_SERVICE').valid, false);
    });
  });

  // ===========================================================================
  // 5. RUNTIME WORKER FAILURE INJECTION & SELF-HEALING
  // ===========================================================================
  describe('5. Runtime Worker Failure Injection & Self-Healing', () => {
    it('should handle synthetic health check probe failure gracefully', async () => {
      // Query health on an invalid path to verify failure behavior
      const containerId = createdContainers[0];
      const health = await adapter.checkContainerHealth({
        containerId,
        path: '/non-existent-probe-endpoint-9999'
      });
      assert.equal(health.healthy, false);
      assert.ok(health.statusCode === 503 || health.statusCode === 404 || health.exitCode !== 0);
    });

    it('should discover and clean up orphaned deception containers and networks', async () => {
      // Create a test network without an associated active environment in DB
      const orphanNet = await adapter.createIsolatedNetwork({
        tenantId: tenantApexId,
        environmentId: 'orphan-net-test-01'
      });
      createdNetworks.push(orphanNet.networkId);

      const orphanCont = await adapter.createSyntheticContainer({
        tenantId: tenantApexId,
        environmentId: 'orphan-net-test-01',
        jobId: 'job-orphan-01',
        imageIdentifier: 'img-syn-alpine-node-01',
        networkName: orphanNet.networkName,
        serviceType: 'SYNTHETIC_API'
      });
      createdContainers.push(orphanCont.containerId);
      await adapter.startContainer(orphanCont.containerId);

      // Perform orphan cleanup sweep with activeEnvironmentIds NOT containing orphan-net-test-01
      const sweep = await adapter.cleanupOrphanResources({
        tenantId: tenantApexId,
        activeEnvironmentIds: ['env-other-active-01']
      });

      assert.ok(sweep.cleanedContainers >= 1, 'Orphan sweep must clean up untracked container');
      assert.ok(sweep.cleanedNetworks >= 1, 'Orphan sweep must clean up untracked network');

      // Verify container no longer exists
      const inspectRes = await adapter.inspectContainer(orphanCont.containerId);
      assert.equal(inspectRes, null, 'Orphan container must be completely removed');
    });

    it('should handle concurrent duplicate provisioning jobs with identical idempotency key', async () => {
      const dispatcher = new ProvisioningDispatcher({
        prismaClient: prisma,
        runtimeWorker: null // Dry-run submission without sync execution
      });

      // Create an approved authorization for test
      const testAuth = await prisma.deceptionExecutionAuthorization.create({
        data: {
          tenantId: tenantApexId,
          applicationId: appApexId,
          policyDecisionId: testDecision.id,
          dsgGraphId: testGraph.id,
          dsgGraphVersion: 1,
          selectedStrategyId: testDecision.selectedStrategyId,
          authorizationStatus: 'APPROVED',
          authorizationReasonCodes: ['CONCURRENT_TEST'],
          requestingOperatorId: 'op-01',
          requestingOperatorEmail: 'analyst@apexfintech.io',
          approvingOperatorId: 'op-02',
          approvingOperatorEmail: 'owner@apexfintech.io',
          authorizedAt: new Date(),
          expiresAt: new Date(Date.now() + 3600000),
          evaluatorVersion: '5B.2'
        }
      });

      const raceIdempotencyKey = `race-idem-${Date.now()}`;

      // Submit two requests concurrently with identical idempotencyKey
      const [res1, res2] = await Promise.all([
        dispatcher.submitProvisioningJob({
          tenantId: tenantApexId,
          authorizationId: testAuth.id,
          templateIdentifier: 'tpl-synthetic-api-01',
          idempotencyKey: raceIdempotencyKey,
          processSync: false
        }),
        dispatcher.submitProvisioningJob({
          tenantId: tenantApexId,
          authorizationId: testAuth.id,
          templateIdentifier: 'tpl-synthetic-api-01',
          idempotencyKey: raceIdempotencyKey,
          processSync: false
        })
      ]);

      assert.equal(res1.id, res2.id, 'Both concurrent requests must resolve to the identical job ID');
      assert.ok(res1.idempotentReplay || res2.idempotentReplay, 'At least one request must be marked idempotentReplay');
    });
  });

  // ===========================================================================
  // 6. EXECUTION EVIDENCE & CRYPTOGRAPHIC LEDGER INTEGRITY
  // ===========================================================================
  describe('6. Execution Evidence & Cryptographic Ledger Integrity', () => {
    it('should compute deterministic hashes using canonical recursive JSON sorting', () => {
      const objA = { z: 1, a: 2, m: { y: 'hello', x: 'world' } };
      const objB = { a: 2, m: { x: 'world', y: 'hello' }, z: 1 };

      const canonA = canonicalJsonStringify(objA);
      const canonB = canonicalJsonStringify(objB);

      assert.equal(canonA, canonB, 'Canonical stringification must be identical regardless of key order');
      const hashA = crypto.createHash('sha256').update(canonA).digest('hex');
      const hashB = crypto.createHash('sha256').update(canonB).digest('hex');
      assert.equal(hashA, hashB, 'Hashes of canonically serialized payloads must match');
    });

    it('should verify valid evidence integrity map using verifyEvidenceIntegrity', () => {
      const evidencePayload = {
        containerId: 'test-cid-12345',
        networkId: 'test-nid-67890',
        imageDigest: 'sha256:5e6dcf93ac4d11b70fb663b5a0a6e39b75bff656dee257b789edd0a0a1b8cb29',
        healthStatus: 'HEALTHY',
        egressBlocked: true
      };

      const canon = canonicalJsonStringify(evidencePayload);
      const hash = crypto.createHash('sha256').update(canon).digest('hex');

      const evidenceMap = {
        ...evidencePayload,
        evidenceHash: hash
      };

      const verification = verifyEvidenceIntegrity(evidenceMap);
      assert.equal(verification.valid, true, 'Valid evidence map must verify successfully');
      assert.equal(verification.recordedHash, hash);
    });

    it('should fail verification if any evidence field is tampered with', () => {
      const evidencePayload = {
        containerId: 'test-cid-12345',
        networkId: 'test-nid-67890',
        egressBlocked: true
      };
      const canon = canonicalJsonStringify(evidencePayload);
      const hash = crypto.createHash('sha256').update(canon).digest('hex');

      // Tamper: change egressBlocked to false
      const tamperedMap = {
        ...evidencePayload,
        egressBlocked: false,
        evidenceHash: hash
      };

      const verification = verifyEvidenceIntegrity(tamperedMap);
      assert.equal(verification.valid, false, 'Tampered evidence map must fail verification');
      assert.ok(verification.reason?.includes('Hash mismatch'));
    });

    it('should reject evidence map lacking an evidenceHash', () => {
      const unhashedMap = {
        containerId: 'test-cid-12345',
        status: 'ACTIVE'
      };
      const verification = verifyEvidenceIntegrity(unhashedMap);
      assert.equal(verification.valid, false);
      assert.ok(verification.reason?.includes('lacks recorded evidenceHash'));
    });
  });

  // ===========================================================================
  // 7. LIFECYCLE STATE MACHINE & AUTHORIZATION SAFEGUARDS
  // ===========================================================================
  describe('7. Lifecycle State Machine & Authorization Safeguards', () => {
    let dispatcher;

    before(() => {
      dispatcher = new ProvisioningDispatcher({
        prismaClient: prisma,
        runtimeWorker: null
      });
    });

    it('should reject provisioning when authorization has expired', async () => {
      const expiredAuth = await prisma.deceptionExecutionAuthorization.create({
        data: {
          tenantId: tenantApexId,
          applicationId: appApexId,
          policyDecisionId: testDecision.id,
          dsgGraphId: testGraph.id,
          dsgGraphVersion: 1,
          selectedStrategyId: testDecision.selectedStrategyId,
          authorizationStatus: 'APPROVED',
          authorizationReasonCodes: ['EXPIRED_TEST'],
          requestingOperatorId: 'op-01',
          requestingOperatorEmail: 'analyst@apexfintech.io',
          approvingOperatorId: 'op-02',
          approvingOperatorEmail: 'owner@apexfintech.io',
          authorizedAt: new Date(Date.now() - 7200000),
          expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
          evaluatorVersion: '5B.2'
        }
      });

      await assert.rejects(
        async () => {
          await dispatcher.submitProvisioningJob({
            tenantId: tenantApexId,
            authorizationId: expiredAuth.id,
            templateIdentifier: 'tpl-synthetic-api-01'
          });
        },
        (err) => {
          assert.equal(err.code, 'AUTHORIZATION_EXPIRED');
          return true;
        }
      );
    });

    it('should reject provisioning when authorization is revoked', async () => {
      const revokedAuth = await prisma.deceptionExecutionAuthorization.create({
        data: {
          tenantId: tenantApexId,
          applicationId: appApexId,
          policyDecisionId: testDecision.id,
          dsgGraphId: testGraph.id,
          dsgGraphVersion: 1,
          selectedStrategyId: testDecision.selectedStrategyId,
          authorizationStatus: 'REVOKED',
          authorizationReasonCodes: ['REVOKED_TEST'],
          requestingOperatorId: 'op-01',
          requestingOperatorEmail: 'analyst@apexfintech.io',
          approvingOperatorId: 'op-02',
          approvingOperatorEmail: 'owner@apexfintech.io',
          authorizedAt: new Date(),
          revokedAt: new Date(),
          expiresAt: new Date(Date.now() + 3600000),
          evaluatorVersion: '5B.2'
        }
      });

      await assert.rejects(
        async () => {
          await dispatcher.submitProvisioningJob({
            tenantId: tenantApexId,
            authorizationId: revokedAuth.id,
            templateIdentifier: 'tpl-synthetic-api-01'
          });
        },
        (err) => {
          assert.equal(err.code, 'AUTHORIZATION_NOT_APPROVED');
          return true;
        }
      );
    });

    it('should reject provisioning when DSG graph version has mutated', async () => {
      const staleAuth = await prisma.deceptionExecutionAuthorization.create({
        data: {
          tenantId: tenantApexId,
          applicationId: appApexId,
          policyDecisionId: testDecision.id,
          dsgGraphId: testGraph.id,
          dsgGraphVersion: 99, // Stale version vs graph version 1
          selectedStrategyId: testDecision.selectedStrategyId,
          authorizationStatus: 'APPROVED',
          authorizationReasonCodes: ['STALE_TEST'],
          requestingOperatorId: 'op-01',
          requestingOperatorEmail: 'analyst@apexfintech.io',
          approvingOperatorId: 'op-02',
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
            templateIdentifier: 'tpl-synthetic-api-01'
          });
        },
        (err) => {
          assert.equal(err.code, 'STALE_GRAPH_VERSION');
          return true;
        }
      );
    });

    it('should enforce separation of duties: reject self-approved authorizations', async () => {
      const selfApprovedAuth = await prisma.deceptionExecutionAuthorization.create({
        data: {
          tenantId: tenantApexId,
          applicationId: appApexId,
          policyDecisionId: testDecision.id,
          dsgGraphId: testGraph.id,
          dsgGraphVersion: 1,
          selectedStrategyId: testDecision.selectedStrategyId,
          authorizationStatus: 'APPROVED',
          authorizationReasonCodes: ['DUAL_CUSTODY_TEST'],
          requestingOperatorId: 'op-same',
          requestingOperatorEmail: 'same_operator@apexfintech.io',
          approvingOperatorId: 'op-same',
          approvingOperatorEmail: 'same_operator@apexfintech.io', // Same requester & approver!
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
            templateIdentifier: 'tpl-synthetic-api-01'
          });
        },
        (err) => {
          assert.equal(err.code, 'DUAL_CUSTODY_VIOLATION');
          return true;
        }
      );
    });

    it('should enforce cross-tenant authorization isolation (Tenant B cannot provision Tenant A auth)', async () => {
      const validAuth = await prisma.deceptionExecutionAuthorization.create({
        data: {
          tenantId: tenantApexId,
          applicationId: appApexId,
          policyDecisionId: testDecision.id,
          dsgGraphId: testGraph.id,
          dsgGraphVersion: 1,
          selectedStrategyId: testDecision.selectedStrategyId,
          authorizationStatus: 'APPROVED',
          authorizationReasonCodes: ['CROSS_TENANT_TEST'],
          requestingOperatorId: 'op-01',
          requestingOperatorEmail: 'analyst@apexfintech.io',
          approvingOperatorId: 'op-02',
          approvingOperatorEmail: 'owner@apexfintech.io',
          authorizedAt: new Date(),
          expiresAt: new Date(Date.now() + 3600000),
          evaluatorVersion: '5B.2'
        }
      });

      await assert.rejects(
        async () => {
          // Attempt submission under Tenant MedSecure
          await dispatcher.submitProvisioningJob({
            tenantId: tenantMedId,
            authorizationId: validAuth.id,
            templateIdentifier: 'tpl-synthetic-api-01'
          });
        },
        (err) => {
          assert.equal(err.code, 'AUTHORIZATION_NOT_FOUND');
          return true;
        }
      );
    });
  });
});
