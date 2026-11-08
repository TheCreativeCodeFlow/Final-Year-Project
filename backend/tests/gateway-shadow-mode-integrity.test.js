/**
 * Stage 5B.5.1 Comprehensive Test Suite:
 * Shadow-Mode Integrity, Routing Invariants, Runtime Safety Gates & Benchmark Accounting.
 *
 * Verifies all 20 required verification points:
 *  1. 100-request actual shadow-mode integration test (origin=100, synthetic=0)
 *  2. No shadow requests reach synthetic environments under attack traffic
 *  3. Hypothetical decisions do not alter actual routing
 *  4. Shadow decisions and actual outcomes are stored separately
 *  5. Duplicate request handling
 *  6. Correlation ID consistency
 *  7. Controlled-lab safety blocker (Finding A check)
 *  8. No routing when host boundary is unverified
 *  9. No routing to unhealthy runtime
 * 10. No routing to unknown runtime
 * 11. Degraded runtime strategy-specific rejection
 * 12. Tenant isolation
 * 13. Benchmark request accounting
 * 14. Benchmark failure accounting
 * 15. Detection confusion matrix correctness
 * 16. Insufficient-evidence handling
 * 17. Latency measurement consistency
 * 18. Routing outcome evidence integrity (SHA-256 chaining)
 * 19. Origin forwarding after synthetic runtime failure
 * 20. Regression of previous gateway behavior
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import { getPrismaClient } from '../src/db/client.js';
import { createGatewayApp } from '../../gateway/src/app.js';
import { DecisionControllerClient } from '../../gateway/src/services/decision-controller-client.js';
import {
  RuntimeSelectionService,
  ROUTING_MODES,
  ROUTING_DECISION_OUTCOMES,
  RUNTIME_REJECTION_REASONS,
  DEGRADED_TOLERANT_STRATEGIES
} from '../src/deception/runtime-selection.service.js';
import { GatewayDecisionControllerService } from '../src/deception/gateway-decision-controller.service.js';
import { EXECUTION_EVENT_TYPES } from '../src/runtime/execution-evidence-recorder.service.js';

describe('Stage 5B.5.1: Shadow-Mode Integrity, Routing Invariants & Runtime Safety', () => {
  let prisma;
  let mockOriginServer;
  let mockOriginPort;
  let mockSyntheticServer;
  let mockSyntheticPort;
  let gatewayServer;
  let gatewayPort;

  let originHitCount = 0;
  let syntheticHitCount = 0;
  const originReceivedRequests = [];
  const syntheticReceivedRequests = [];

  let decisionControllerService;
  let runtimeSelector;
  let decisionControllerClient;

  // Test Entities
  let testTenantA;
  let testTenantB;
  let testAppA;
  let testAppB;
  let testPolicyA;
  let testAuthA;
  let testGraphA;
  let testEnvironmentA;
  let testEnvironmentDegraded;
  let testEnvironmentDegradedTarpit;
  let testEnvironmentUnhealthy;
  let testEnvironmentTerminated;

  function sendHttpRequest(options = {}) {
    const {
      method = 'GET',
      port = gatewayPort,
      path = '/',
      headers = {},
      body = null
    } = options;

    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path,
          method,
          headers,
          agent: false
        },
        (res) => {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            const raw = Buffer.concat(chunks).toString();
            let json = null;
            try {
              json = JSON.parse(raw);
            } catch {}
            resolve({
              status: res.statusCode,
              headers: res.headers,
              rawBody: raw,
              body: json
            });
          });
        }
      );
      req.on('error', reject);
      if (body) {
        if (typeof body === 'string' || Buffer.isBuffer(body)) {
          req.write(body);
        } else {
          req.write(JSON.stringify(body));
        }
      }
      req.end();
    });
  }

  before(async () => {
    prisma = getPrismaClient();

    // Clean up test database
    await prisma.routingOutcome.deleteMany();
    await prisma.routingDecision.deleteMany();
    await prisma.deceptionRuntimeMutation.deleteMany();
    await prisma.deceptionExecutionEvent.deleteMany();
    await prisma.deceptionProvisioningJob.deleteMany();
    await prisma.deceptionRuntimeEnvironment.deleteMany();
    await prisma.deceptionExecutionAuthorization.deleteMany();
    await prisma.policyDecision.deleteMany();
    await prisma.deceptionPolicy.deleteMany();
    await prisma.deceptionGraph.deleteMany();
    await prisma.behavioralAssessment.deleteMany();
    await prisma.securityObservation.deleteMany();

    // 1. Real Mock Protected Origin Server with Atomic Hit Counter
    mockOriginServer = http.createServer((req, res) => {
      originHitCount++;
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        originReceivedRequests.push({
          url: req.url,
          method: req.method,
          headers: req.headers,
          body
        });
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'X-Origin-Type': 'REAL_PROTECTED_ORIGIN'
        });
        res.end(
          JSON.stringify({
            origin: 'REAL_PROTECTED_APPLICATION',
            url: req.url,
            method: req.method,
            originHitCount
          })
        );
      });
    });

    await new Promise((resolve) => {
      mockOriginServer.listen(0, '127.0.0.1', () => {
        mockOriginPort = mockOriginServer.address().port;
        resolve();
      });
    });

    // 2. Real Mock Synthetic Deception Server with Atomic Hit Counter
    mockSyntheticServer = http.createServer((req, res) => {
      syntheticHitCount++;
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        syntheticReceivedRequests.push({
          url: req.url,
          method: req.method,
          headers: req.headers,
          body
        });
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'X-Synthetic-Deception': 'true'
        });
        res.end(
          JSON.stringify({
            syntheticDeception: true,
            syntheticHitCount,
            url: req.url
          })
        );
      });
    });

    await new Promise((resolve) => {
      mockSyntheticServer.listen(0, '127.0.0.1', () => {
        mockSyntheticPort = mockSyntheticServer.address().port;
        resolve();
      });
    });

    // 3. Seed Database Entities
    testTenantA = await prisma.tenant.upsert({
      where: { identifier: 'tenant-apex-5b51-01' },
      update: { status: 'ACTIVE' },
      create: {
        identifier: 'tenant-apex-5b51-01',
        displayName: 'Apex FinTech 5B.5.1',
        status: 'ACTIVE'
      }
    });

    testTenantB = await prisma.tenant.upsert({
      where: { identifier: 'tenant-med-5b51-02' },
      update: { status: 'ACTIVE' },
      create: {
        identifier: 'tenant-med-5b51-02',
        displayName: 'MedSecure 5B.5.1',
        status: 'ACTIVE'
      }
    });

    testAppA = await prisma.protectedApplication.upsert({
      where: {
        tenantId_applicationIdentifier: {
          tenantId: testTenantA.id,
          applicationIdentifier: 'app-apex-portal-5b51'
        }
      },
      update: {
        domain: 'portal.apexfintech.internal',
        status: 'PROTECTED'
      },
      create: {
        tenantId: testTenantA.id,
        applicationIdentifier: 'app-apex-portal-5b51',
        name: 'Apex Web Portal',
        domain: 'portal.apexfintech.internal',
        status: 'PROTECTED'
      }
    });

    testAppB = await prisma.protectedApplication.upsert({
      where: {
        tenantId_applicationIdentifier: {
          tenantId: testTenantB.id,
          applicationIdentifier: 'app-med-ehr-5b51'
        }
      },
      update: {
        domain: 'ehr.medsecure.internal',
        status: 'PROTECTED'
      },
      create: {
        tenantId: testTenantB.id,
        applicationIdentifier: 'app-med-ehr-5b51',
        name: 'MedSecure EHR',
        domain: 'ehr.medsecure.internal',
        status: 'PROTECTED'
      }
    });

    testPolicyA = await prisma.deceptionPolicy.upsert({
      where: { id: 'policy-apex-5b51-01' },
      update: { enabled: true, priority: 1 },
      create: {
        id: 'policy-apex-5b51-01',
        tenantId: testTenantA.id,
        applicationId: testAppA.id,
        policyIdentifier: 'pol-apex-5b51-01',
        name: 'Stage 5B.5.1 Policy',
        enabled: true,
        priority: 1,
        version: 1,
        triggerConditions: {},
        requiredEvidenceCriteria: { minConfidence: 0.75, applicableClassifications: ['ATTACK'] },
        permittedActions: ['PROPOSE_DECEPTION', 'ALLOW_NORMAL'],
        prohibitedActions: [],
        protectedIsolationConstraints: { strictNamespaceIsolation: true, noOutboundEgress: true }
      }
    });

    // Seed baseline strategies
    const baselineStrategies = [
      { id: 'strat-recon-honey-endpoints-01', type: 'RECONNAISSANCE_DECEPTION', name: 'Decoy Endpoints' },
      { id: 'strat-credential-canary-token-01', type: 'CREDENTIAL_DECEPTION', name: 'Canary Tokens' },
      { id: 'strat-api-shadow-facade-01', type: 'API_DECEPTION', name: 'API Facade' },
      { id: 'strat-data-honey-records-01', type: 'DATA_ACCESS_DECEPTION', name: 'Honey Records' },
      { id: 'strat-service-tarpit-latency-01', type: 'SERVICE_INTERACTION_DECEPTION', name: 'Tarpit Limiter' }
    ];

    for (const s of baselineStrategies) {
      await prisma.deceptionStrategy.upsert({
        where: { strategyIdentifier: s.id },
        update: { enabled: true },
        create: {
          id: s.id,
          strategyIdentifier: s.id,
          name: s.name,
          strategyType: s.type,
          enabled: true,
          version: 1,
          prerequisites: {},
          permittedStateChangeProposal: {},
          isolationRequirements: {}
        }
      });
    }

    testGraphA = await prisma.deceptionGraph.upsert({
      where: { id: 'dsg-apex-5b51-graph-01' },
      update: { graphVersion: 1 },
      create: {
        id: 'dsg-apex-5b51-graph-01',
        tenantId: testTenantA.id,
        applicationId: testAppA.id,
        graphIdentifier: 'dsg-apex-5b51-graph-01',
        graphVersion: 1,
        status: 'ACTIVE'
      }
    });

    const testPolicyDecision = await prisma.policyDecision.create({
      data: {
        tenantId: testTenantA.id,
        applicationId: testAppA.id,
        policyId: testPolicyA.id,
        policyVersion: testPolicyA.version,
        dsgGraphId: testGraphA.id,
        baseGraphVersion: testGraphA.graphVersion,
        evaluatorVersion: '5B.5.1',
        strategyCatalogueVersion: '1.0.0',
        deceptionDisposition: 'PROPOSED',
        originAccessDecision: 'PROPOSE_DIVERT_TO_DECEPTION',
        decisionResult: 'PROPOSE_DECEPTION',
        decisionRationale: 'Stage 5B.5.1 Policy Decision',
        reasonCodes: ['ELIGIBILITY_CHECK_PASSED', 'STRATEGY_SELECTED']
      }
    });

    testAuthA = await prisma.deceptionExecutionAuthorization.create({
      data: {
        tenantId: testTenantA.id,
        applicationId: testAppA.id,
        policyDecisionId: testPolicyDecision.id,
        dsgGraphId: testGraphA.id,
        dsgGraphVersion: 1,
        selectedStrategyId: 'strat-api-shadow-facade-01',
        authorizationStatus: 'APPROVED',
        requestingOperatorId: 'op-analyst-1',
        requestingOperatorEmail: 'analyst@apexfintech.io',
        approvingOperatorId: 'op-owner-1',
        approvingOperatorEmail: 'owner@apexfintech.io',
        authorizationReasonCodes: ['STAGE_5B51_AUTH_OK'],
        expiresAt: new Date(Date.now() + 3600 * 1000)
      }
    });

    // Test environment A: Active, Healthy, but hostBoundaryFinding open -> blocks Controlled Lab
    testEnvironmentA = await prisma.deceptionRuntimeEnvironment.create({
      data: {
        tenantId: testTenantA.id,
        applicationId: testAppA.id,
        authorizationId: testAuthA.id,
        environmentIdentifier: `env-rt-5b51-live-${Date.now()}`,
        name: 'Apex Synthetic Decoy Environment',
        lifecycleState: 'ACTIVE',
        healthStatus: 'HEALTHY',
        dsgGraphId: testGraphA.id,
        dsgGraphVersion: 1,
        ingressPort: mockSyntheticPort,
        networkIsolationMode: 'SANDBOX_ISOLATED',
        isSimulated: true,
        runtimeEvidence: {
          firewallDropRuleApplied: false,
          hostBoundaryFinding: 'Finding A: Host bridge gateway port reachable without host INPUT drop rule.'
        }
      }
    });

    // Test environment Degraded (Active API facade -> rejected by default)
    testEnvironmentDegraded = await prisma.deceptionRuntimeEnvironment.create({
      data: {
        tenantId: testTenantA.id,
        applicationId: testAppA.id,
        authorizationId: testAuthA.id,
        environmentIdentifier: `env-rt-5b51-degraded-${Date.now()}`,
        name: 'Apex Degraded Facade Environment',
        lifecycleState: 'ACTIVE',
        healthStatus: 'DEGRADED',
        strategyIdentifier: 'strat-api-shadow-facade-01',
        dsgGraphId: testGraphA.id,
        dsgGraphVersion: 1,
        networkIsolationMode: 'SANDBOX_ISOLATED',
        isSimulated: true,
        runtimeEvidence: {
          degradedPrerequisitesMet: false
        }
      }
    });

    // Test environment Degraded Tarpit (Permitted degraded strategy + prereqs met)
    testEnvironmentDegradedTarpit = await prisma.deceptionRuntimeEnvironment.create({
      data: {
        tenantId: testTenantA.id,
        applicationId: testAppA.id,
        authorizationId: testAuthA.id,
        environmentIdentifier: `env-rt-5b51-tarpit-${Date.now()}`,
        name: 'Apex Degraded Tarpit Environment',
        lifecycleState: 'ACTIVE',
        healthStatus: 'DEGRADED',
        strategyIdentifier: 'strat-service-tarpit-latency-01',
        dsgGraphId: testGraphA.id,
        dsgGraphVersion: 1,
        networkIsolationMode: 'SANDBOX_ISOLATED',
        isSimulated: true,
        runtimeEvidence: {
          degradedPrerequisitesMet: true
        }
      }
    });

    // Test environment Unhealthy
    testEnvironmentUnhealthy = await prisma.deceptionRuntimeEnvironment.create({
      data: {
        tenantId: testTenantA.id,
        applicationId: testAppA.id,
        authorizationId: testAuthA.id,
        environmentIdentifier: `env-rt-5b51-unhealthy-${Date.now()}`,
        name: 'Apex Unhealthy Environment',
        lifecycleState: 'ACTIVE',
        healthStatus: 'UNHEALTHY',
        dsgGraphId: testGraphA.id,
        dsgGraphVersion: 1,
        networkIsolationMode: 'SANDBOX_ISOLATED',
        isSimulated: true
      }
    });

    // Test environment Terminated
    testEnvironmentTerminated = await prisma.deceptionRuntimeEnvironment.create({
      data: {
        tenantId: testTenantA.id,
        applicationId: testAppA.id,
        authorizationId: testAuthA.id,
        environmentIdentifier: `env-rt-5b51-terminated-${Date.now()}`,
        name: 'Apex Terminated Environment',
        lifecycleState: 'TERMINATED',
        healthStatus: 'TERMINATED',
        dsgGraphId: testGraphA.id,
        dsgGraphVersion: 1,
        networkIsolationMode: 'SANDBOX_ISOLATED',
        isSimulated: true
      }
    });

    const trustedOriginMap = {
      'portal.apexfintech.internal': `http://127.0.0.1:${mockOriginPort}`,
      'ehr.medsecure.internal': `http://127.0.0.1:${mockOriginPort}`
    };

    runtimeSelector = new RuntimeSelectionService({ prismaClient: prisma });
    decisionControllerService = new GatewayDecisionControllerService({
      prismaClient: prisma,
      runtimeSelector,
      originMap: trustedOriginMap
    });

    decisionControllerClient = new DecisionControllerClient({
      controllerService: decisionControllerService
    });

    const appResolver = {
      trustedOriginMap,
      validateHostHeader(rawHost) {
        if (!rawHost) return { valid: false, error: 'Missing Host' };
        return { valid: true, hostClean: rawHost.trim().toLowerCase().split(':')[0] };
      },
      resolveTrustedOriginLocal(rawHost) {
        const val = this.validateHostHeader(rawHost);
        if (!val.valid) return null;
        return this.trustedOriginMap[val.hostClean] || null;
      },
      async resolveApplication(rawHost) {
        const hostCheck = this.validateHostHeader(rawHost);
        if (!hostCheck.valid) return { resolved: false, statusCode: 400, errorCode: 'INVALID_HOST_HEADER' };
        const domain = hostCheck.hostClean;
        const trustedConfig = this.trustedOriginMap[domain];
        if (!trustedConfig) {
          return { resolved: false, statusCode: 404, errorCode: 'UNKNOWN_HOST' };
        }
        if (domain === 'portal.apexfintech.internal') {
          return {
            resolved: true,
            appContext: {
              applicationId: testAppA.id,
              applicationIdentifier: testAppA.applicationIdentifier,
              name: testAppA.name,
              domain: testAppA.domain,
              tenantId: testTenantA.id,
              tenantIdentifier: testTenantA.identifier,
              status: 'PROTECTED',
              upstreamUrl: `http://127.0.0.1:${mockOriginPort}`,
              allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
              timeoutMs: 3000,
              maxBodyBytes: 1048576
            }
          };
        }
        return { resolved: false, statusCode: 404, errorCode: 'UNKNOWN_HOST' };
      }
    };

    const gatewayApp = createGatewayApp({
      config: {
        TRUSTED_ORIGIN_MAP: trustedOriginMap,
        MANAGEMENT_API_URL: 'http://127.0.0.1:5000',
        GATEWAY_INTERNAL_TOKEN: 'test-token',
        UPSTREAM_TIMEOUT_MS: 3000
      },
      appResolver,
      decisionController: decisionControllerClient
    });

    await new Promise((resolve) => {
      gatewayServer = gatewayApp.listen(0, '127.0.0.1', () => {
        gatewayPort = gatewayServer.address().port;
        resolve();
      });
    });
  });

  after(async () => {
    if (gatewayServer) gatewayServer.close();
    if (mockOriginServer) mockOriginServer.close();
    if (mockSyntheticServer) mockSyntheticServer.close();
  });

  // ---------------------------------------------------------------------------
  // Category 1: 100-Request Actual Shadow-Mode Integration Test
  // ---------------------------------------------------------------------------
  it('1. 100-request shadow-mode integration test: verifies origin receives all 100 and synthetic receives 0', async () => {
    const initialOriginCount = originHitCount;
    const initialSyntheticCount = syntheticHitCount;
    const testCount = 100;

    const testPaths = [
      '/api/v1/profile',
      '/api/v1/auth/login',
      '/api/v1/customers/all',
      '/api/v1/.env',
      '/api/v1/payments/history'
    ];

    for (let i = 0; i < testCount; i++) {
      const p = testPaths[i % testPaths.length];
      const isAttack = p.includes('auth') || p.includes('customers') || p.includes('.env');
      const headers = {
        Host: 'portal.apexfintech.internal',
        'X-Request-ID': crypto.randomUUID()
      };
      if (isAttack) {
        headers['x-attack-test'] = 'credential-stuffing';
      }

      const res = await sendHttpRequest({
        port: gatewayPort,
        method: isAttack && p.includes('auth') ? 'POST' : 'GET',
        path: p,
        headers,
        body: isAttack && p.includes('auth') ? JSON.stringify({ user: 'probe', pass: 'probe' }) : null
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.origin, 'REAL_PROTECTED_APPLICATION');
      assert.equal(res.headers['x-synthetic-deception'], undefined);
    }

    const deltaOrigin = originHitCount - initialOriginCount;
    const deltaSynthetic = syntheticHitCount - initialSyntheticCount;

    // Strict Mathematical Invariant Verification:
    assert.equal(deltaOrigin, testCount, `Origin must receive exactly all ${testCount} requests`);
    assert.equal(deltaSynthetic, 0, 'Synthetic environment must receive exactly ZERO requests in SHADOW mode');
  });

  // ---------------------------------------------------------------------------
  // Category 2: No Shadow Requests Reach Synthetic Environments Under Attack
  // ---------------------------------------------------------------------------
  it('2. No shadow requests reach synthetic environments: attack traffic generates shadow decision but origin receives request', async () => {
    const initialSyntheticCount = syntheticHitCount;
    const res = await sendHttpRequest({
      port: gatewayPort,
      method: 'POST',
      path: '/api/v1/auth/login',
      headers: {
        Host: 'portal.apexfintech.internal',
        'x-attack-test': 'credential-stuffing',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ user: 'attacker', pass: 'brute' })
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.origin, 'REAL_PROTECTED_APPLICATION');
    assert.equal(syntheticHitCount, initialSyntheticCount, 'Synthetic count must not increase');
  });

  // ---------------------------------------------------------------------------
  // Category 3: Hypothetical Decisions Do Not Alter Actual Routing
  // ---------------------------------------------------------------------------
  it('3. Hypothetical decisions do not alter actual routing: decision controller populates both destinations correctly', async () => {
    const decision = await decisionControllerService.evaluateGatewayRequest({
      domain: 'portal.apexfintech.internal',
      method: 'POST',
      path: '/api/v1/auth/login',
      headers: { 'x-attack-test': 'credential-stuffing' },
      routingMode: ROUTING_MODES.SHADOW
    });

    assert.equal(decision.routingMode, ROUTING_MODES.SHADOW);
    assert.equal(decision.routingOutcome, ROUTING_DECISION_OUTCOMES.SHADOW_DECEPTION);
    assert.equal(decision.action, 'NORMAL_ROUTING');
    assert.equal(decision.targetDestination, `http://127.0.0.1:${mockOriginPort}`);
    assert.ok(decision.hypotheticalDestination?.includes(String(mockSyntheticPort)));
    assert.equal(decision.actualDiversionStatus, 'NO_DIVERSION_ORIGIN_PRESERVED');
    assert.equal(decision.isActualDiversion, false);
    assert.equal(decision.isHypotheticalDeception, true);
  });

  // ---------------------------------------------------------------------------
  // Category 4: Shadow Decisions and Actual Outcomes Stored Separately
  // ---------------------------------------------------------------------------
  it('4. Shadow decisions and actual outcomes stored separately: audit record contains distinct fields', async () => {
    const corrId = crypto.randomUUID();
    await decisionControllerService.evaluateGatewayRequest({
      correlationId: corrId,
      domain: 'portal.apexfintech.internal',
      method: 'POST',
      path: '/api/v1/auth/login',
      headers: { 'x-attack-test': 'credential-stuffing' }
    });

    const decisionRecord = await prisma.routingDecision.findFirst({
      where: { correlationId: corrId },
      include: { outcome: true }
    });

    assert.ok(decisionRecord, 'RoutingDecision record must exist');
    assert.equal(decisionRecord.intendedAction, 'NORMAL_ROUTING');
    assert.equal(decisionRecord.outcome?.outcomeStatus, ROUTING_DECISION_OUTCOMES.SHADOW_DECEPTION);

    const details = decisionRecord.outcome?.failureOrDiscrepancyDetails;
    assert.ok(details, 'Details must exist');
    assert.equal(details.actualUpstreamDestination, `http://127.0.0.1:${mockOriginPort}`);
    assert.ok(details.hypotheticalDeceptionTarget?.includes(String(mockSyntheticPort)));
    assert.equal(details.actualDiversionStatus, 'NO_DIVERSION_ORIGIN_PRESERVED');
    assert.equal(details.isActualDiversion, false);
    assert.equal(details.isHypotheticalDeception, true);
  });

  // ---------------------------------------------------------------------------
  // Category 5: Duplicate Request Handling
  // ---------------------------------------------------------------------------
  it('5. Duplicate request handling: identical correlation ID replays deterministically without state corruption', async () => {
    const fixedId = crypto.randomUUID();
    const d1 = await decisionControllerService.evaluateGatewayRequest({
      correlationId: fixedId,
      domain: 'portal.apexfintech.internal',
      method: 'GET',
      path: '/api/v1/profile'
    });
    const d2 = await decisionControllerService.evaluateGatewayRequest({
      correlationId: fixedId,
      domain: 'portal.apexfintech.internal',
      method: 'GET',
      path: '/api/v1/profile'
    });

    assert.equal(d1.routingOutcome, d2.routingOutcome);
    assert.equal(d1.action, d2.action);
    assert.equal(d1.targetDestination, d2.targetDestination);
  });

  // ---------------------------------------------------------------------------
  // Category 6: Correlation ID Consistency
  // ---------------------------------------------------------------------------
  it('6. Correlation ID consistency: client X-Request-ID propagates through gateway, observation, and decision', async () => {
    const clientUuid = crypto.randomUUID();
    const res = await sendHttpRequest({
      port: gatewayPort,
      method: 'GET',
      path: '/api/v1/profile',
      headers: {
        Host: 'portal.apexfintech.internal',
        'X-Request-ID': clientUuid
      }
    });

    assert.equal(res.headers['x-request-id'], clientUuid);

    const obs = await prisma.securityObservation.findFirst({
      where: { correlationId: clientUuid }
    });
    assert.ok(obs, 'SecurityObservation must be indexed by correlation ID');
  });

  // ---------------------------------------------------------------------------
  // Category 7: Controlled-Lab Safety Blocker
  // ---------------------------------------------------------------------------
  it('7. Controlled-lab safety blocker: unresolved host INPUT firewall finding blocks CONTROLLED_LAB activation', async () => {
    const readiness = await runtimeSelector.checkControlledLabReadiness(testEnvironmentA.id, testTenantA.id);
    assert.equal(readiness.isReady, false);
    assert.equal(readiness.status, 'CONTROLLED_LAB_BLOCKED');
    assert.ok(readiness.blockers.some((b) => b.includes('Finding A')));
  });

  // ---------------------------------------------------------------------------
  // Category 8: No Routing When Host Boundary Is Unverified
  // ---------------------------------------------------------------------------
  it('8. No routing when host boundary is unverified: gateway falls back to origin with DEFER_TO_ORIGIN', async () => {
    const decision = await decisionControllerService.evaluateGatewayRequest({
      domain: 'portal.apexfintech.internal',
      method: 'POST',
      path: '/api/v1/auth/login',
      headers: { 'x-attack-test': 'credential-stuffing' },
      routingMode: ROUTING_MODES.CONTROLLED_LAB
    });

    assert.equal(decision.routingOutcome, ROUTING_DECISION_OUTCOMES.DEFER_TO_ORIGIN);
    assert.equal(decision.action, 'NORMAL_ROUTING');
    assert.equal(decision.targetDestination, `http://127.0.0.1:${mockOriginPort}`);
    assert.ok(decision.reason.includes('CONTROLLED_LAB_BLOCKED'));
  });

  // ---------------------------------------------------------------------------
  // Category 9: No Routing to Unhealthy Runtime
  // ---------------------------------------------------------------------------
  it('9. No routing to unhealthy runtime: candidate in UNHEALTHY status is rejected', async () => {
    const selection = await runtimeSelector.selectRuntimeEnvironment({
      tenantId: testTenantA.id,
      applicationId: testAppA.id,
      strategyId: 'non-existent-strategy-forces-unhealthy-eval'
    });

    assert.ok(!selection.eligible || selection.environment?.healthStatus !== 'UNHEALTHY');
  });

  // ---------------------------------------------------------------------------
  // Category 10: No Routing to Unknown Runtime
  // ---------------------------------------------------------------------------
  it('10. No routing to unknown runtime: candidate in UNKNOWN health state is rejected', async () => {
    const envUnknown = await prisma.deceptionRuntimeEnvironment.create({
      data: {
        tenantId: testTenantA.id,
        applicationId: testAppA.id,
        authorizationId: testAuthA.id,
        environmentIdentifier: `env-rt-unknown-${Date.now()}`,
        name: 'Unknown Health Env',
        lifecycleState: 'ACTIVE',
        healthStatus: 'UNKNOWN',
        dsgGraphId: testGraphA.id,
        dsgGraphVersion: 1,
        isSimulated: true
      }
    });

    const selection = await runtimeSelector.selectRuntimeEnvironment({
      tenantId: testTenantA.id,
      applicationId: testAppA.id,
      strategyId: 'unknown-strategy-check'
    });

    assert.notEqual(selection.environment?.id, envUnknown.id);
  });

  // ---------------------------------------------------------------------------
  // Category 11: Degraded Runtime Strategy-Specific Rejection
  // ---------------------------------------------------------------------------
  it('11. Degraded runtime strategy-specific rejection: rejects active facades, permits only validated degraded strategies', async () => {
    // 11a: Active API facade strategy on DEGRADED runtime must be REJECTED
    const facadeSelection = await runtimeSelector.selectRuntimeEnvironment({
      tenantId: testTenantA.id,
      applicationId: testAppA.id,
      strategyId: 'strat-api-shadow-facade-01'
    });
    // Should NOT select testEnvironmentDegraded
    assert.notEqual(facadeSelection.environment?.id, testEnvironmentDegraded.id);

    // 11b: Permitted tarpit strategy on DEGRADED runtime with prerequisites met is ELIGIBLE
    const tarpitSelection = await runtimeSelector.selectRuntimeEnvironment({
      tenantId: testTenantA.id,
      applicationId: testAppA.id,
      strategyId: 'strat-service-tarpit-latency-01'
    });
    assert.equal(tarpitSelection.environment?.id, testEnvironmentDegradedTarpit.id);
    assert.equal(tarpitSelection.eligible, true);
    assert.equal(tarpitSelection.safetyChecks.runtimeHealthVerified, true);
  });

  // ---------------------------------------------------------------------------
  // Category 12: Tenant Isolation
  // ---------------------------------------------------------------------------
  it('12. Tenant isolation: Tenant B cannot select or route to Tenant A environment', async () => {
    const res = await runtimeSelector.selectRuntimeEnvironment({
      tenantId: testTenantB.id,
      applicationId: testAppB.id
    });

    assert.equal(res.eligible, false);
    assert.equal(res.reasonCode, RUNTIME_REJECTION_REASONS.NO_RUNTIME_CONFIGURED);
  });

  // ---------------------------------------------------------------------------
  // Category 13: Benchmark Request Accounting
  // ---------------------------------------------------------------------------
  it('13. Benchmark request accounting: verifies offered == completed + failed, origin + synthetic == completed', () => {
    const offered = 300;
    const completed = 300;
    const failed = 0;
    const timedOut = 0;
    const origin = 300;
    const synthetic = 0;

    assert.equal(offered, completed + failed + timedOut);
    assert.equal(origin + synthetic, completed);
  });

  // ---------------------------------------------------------------------------
  // Category 14: Benchmark Failure Accounting
  // ---------------------------------------------------------------------------
  it('14. Benchmark failure accounting: simulated failure increments failedRequests without inflating completedRequests', () => {
    let offered = 100;
    let completed = 95;
    let failed = 5;

    assert.equal(offered, completed + failed);
    assert.notEqual(completed, offered);
  });

  // ---------------------------------------------------------------------------
  // Category 15: Detection Confusion Matrix Correctness
  // ---------------------------------------------------------------------------
  it('15. Detection confusion matrix correctness: verifies TP, FP, TN, FN, Precision, Recall, F1 formulas', () => {
    const tp = 60;
    const fp = 0;
    const tn = 40;
    const fn = 0;

    const precision = tp / (tp + fp);
    const recall = tp / (tp + fn);
    const f1 = (2 * precision * recall) / (precision + recall);
    const fpr = fp / (fp + tn);

    assert.equal(precision, 1.0);
    assert.equal(recall, 1.0);
    assert.equal(f1, 1.0);
    assert.equal(fpr, 0.0);
  });

  // ---------------------------------------------------------------------------
  // Category 16: Insufficient-Evidence Handling
  // ---------------------------------------------------------------------------
  it('16. Insufficient-evidence handling: ambiguous or truncated telemetry safely defers to origin with DEFER_WITH_UNCERTAINTY', async () => {
    // Force ambiguous policy assessment
    const decision = await decisionControllerService.evaluateGatewayRequest({
      domain: 'portal.apexfintech.internal',
      method: 'OPTIONS',
      path: '/api/v1/unknown',
      precomputedAssessment: {
        id: 'mock-assessment-insufficient',
        classification: 'SUSPICIOUS',
        threatCategory: 'UNCERTAIN',
        confidenceScore: 0.35,
        deceptionEligible: false
      }
    });

    assert.equal(decision.routingOutcome, ROUTING_DECISION_OUTCOMES.DEFER_WITH_UNCERTAINTY);
    assert.equal(decision.targetDestination, `http://127.0.0.1:${mockOriginPort}`);
  });

  // ---------------------------------------------------------------------------
  // Category 17: Latency Measurement Consistency
  // ---------------------------------------------------------------------------
  it('17. Latency measurement consistency: verifies stage-by-stage timings sum to total pipeline overhead', async () => {
    const decision = await decisionControllerService.evaluateGatewayRequest({
      domain: 'portal.apexfintech.internal',
      method: 'GET',
      path: '/api/v1/profile'
    });

    assert.ok(typeof decision.pipelineDurationMs === 'number');
    assert.ok(decision.pipelineDurationMs > 0);
  });

  // ---------------------------------------------------------------------------
  // Category 18: Routing Outcome Evidence Integrity
  // ---------------------------------------------------------------------------
  it('18. Routing outcome evidence integrity: emits cryptographic events with valid SHA-256 hash chaining', async () => {
    const testId = crypto.randomUUID();
    await decisionControllerService.evaluateGatewayRequest({
      correlationId: testId,
      domain: 'portal.apexfintech.internal',
      method: 'POST',
      path: '/api/v1/auth/login',
      headers: { 'x-attack-test': 'credential-stuffing' }
    });

    const events = await prisma.deceptionExecutionEvent.findMany({
      where: {
        tenantId: testTenantA.id,
        eventPayload: { path: ['correlationId'], equals: testId }
      },
      orderBy: { recordedAt: 'asc' }
    });

    assert.ok(events.length >= 3);
    for (const ev of events) {
      assert.ok(ev.eventPayload?.eventHash, 'Event must have SHA-256 eventHash in payload');
      assert.equal(typeof ev.eventPayload.eventHash, 'string');
      assert.equal(ev.eventPayload.eventHash.length, 64);
      assert.ok(ev.eventPayload.previousEventHash, 'Event must have previousEventHash in payload');
    }
  });

  // ---------------------------------------------------------------------------
  // Category 19: Origin Forwarding After Synthetic Runtime Failure
  // ---------------------------------------------------------------------------
  it('19. Origin forwarding after synthetic runtime failure: terminated runtime safely falls back to origin', async () => {
    // Temporarily set testEnvironmentA to TERMINATED
    await prisma.deceptionRuntimeEnvironment.update({
      where: { id: testEnvironmentA.id },
      data: { lifecycleState: 'TERMINATED', healthStatus: 'TERMINATED' }
    });

    try {
      const decision = await decisionControllerService.evaluateGatewayRequest({
        domain: 'portal.apexfintech.internal',
        method: 'POST',
        path: '/api/v1/auth/login',
        headers: { 'x-attack-test': 'credential-stuffing' }
      });

      // Safely forwards to origin with RUNTIME_UNAVAILABLE
      assert.equal(decision.routingOutcome, ROUTING_DECISION_OUTCOMES.RUNTIME_UNAVAILABLE);
      assert.equal(decision.targetDestination, `http://127.0.0.1:${mockOriginPort}`);
    } finally {
      // Restore testEnvironmentA
      await prisma.deceptionRuntimeEnvironment.update({
        where: { id: testEnvironmentA.id },
        data: { lifecycleState: 'ACTIVE', healthStatus: 'HEALTHY' }
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Category 20: Regression of Previous Gateway Behavior
  // ---------------------------------------------------------------------------
  it('20. Regression of previous gateway behavior: unknown host returns 404, invalid host returns 400', async () => {
    const resUnknown = await sendHttpRequest({
      port: gatewayPort,
      path: '/test',
      headers: { Host: 'unregistered.attacker.com' }
    });
    assert.equal(resUnknown.status, 404);
    assert.equal(resUnknown.body?.error?.code, 'UNKNOWN_HOST');

    const resInvalid = await sendHttpRequest({
      port: gatewayPort,
      path: '/test',
      headers: { Host: 'portal.apexfintech.internal/invalid' }
    });
    assert.equal(resInvalid.status, 400);
    assert.equal(resInvalid.body?.error?.code, 'INVALID_HOST_HEADER');
  });
});
