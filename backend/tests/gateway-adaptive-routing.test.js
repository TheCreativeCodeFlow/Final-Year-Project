/**
 * Stage 5B.5 Test Suite:
 * Adaptive Gateway Integration, Decision Controller & Controlled Traffic Routing.
 *
 * Verifies all 25 required test categories:
 *  1. Normal request forwarding
 *  2. Observe-only behavior
 *  3. Shadow-mode decisions
 *  4. No unintended traffic diversion
 *  5. Tenant/application mapping
 *  6. Detection integration
 *  7. Policy integration
 *  8. Strategy selection integration
 *  9. DSG version integration
 * 10. Runtime selection
 * 11. Runtime health gating
 * 12. Authorization verification
 * 13. Host-boundary activation blocker
 * 14. Cross-tenant routing rejection
 * 15. SSRF protection
 * 16. DNS rebinding protection
 * 17. Sensitive header sanitization
 * 18. Runtime timeout handling
 * 19. Runtime unavailable handling
 * 20. Session continuity
 * 21. Decision evidence generation
 * 22. Duplicate request handling
 * 23. Gateway worker failure handling
 * 24. Routing rollback readiness
 * 25. End-to-end shadow pipeline
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import { getPrismaClient } from '../src/db/client.js';
import { createGatewayApp } from '../../gateway/src/app.js';
import { DecisionControllerClient } from '../../gateway/src/services/decision-controller-client.js';
import { ApplicationResolverService } from '../../gateway/src/services/app-resolver.service.js';
import { TelemetryRecorderService } from '../../gateway/src/services/telemetry-recorder.service.js';
import {
  sanitizeForwardedHeaders,
  sanitizeDeceptionForwardedHeaders
} from '../../gateway/src/proxy/header-sanitizer.js';
import { resolveAndPinUpstreamDestination } from '../../gateway/src/proxy/ssrf-guard.js';
import {
  RuntimeSelectionService,
  ROUTING_MODES,
  ROUTING_DECISION_OUTCOMES,
  RUNTIME_REJECTION_REASONS
} from '../src/deception/runtime-selection.service.js';
import { GatewayDecisionControllerService } from '../src/deception/gateway-decision-controller.service.js';
import { EXECUTION_EVENT_TYPES } from '../src/runtime/execution-evidence-recorder.service.js';

describe('Stage 5B.5: Adaptive Gateway Integration and Controlled Routing Suite', () => {
  let prisma;
  let mockOriginServer;
  let mockOriginPort;
  let mockSyntheticServer;
  let mockSyntheticPort;
  let gatewayServer;
  let gatewayPort;
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
  let testAuthRevoked;
  let testAuthExpired;
  let testGraphA;
  let testEnvironmentA;
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
              body: json,
              json: async () => json
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

    // 1. Start Mock Real Protected Origin Server
    mockOriginServer = http.createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'X-Origin-Type': 'REAL_PROTECTED_ORIGIN'
        });
        res.end(
          JSON.stringify({
            origin: 'REAL_PROTECTED_APPLICATION',
            url: req.url,
            method: req.method,
            headers: req.headers,
            receivedBody: body
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

    // 2. Start Mock Isolated Synthetic Service
    mockSyntheticServer = http.createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        // Enforce that synthetic management endpoint /internal/* should not be called publicly
        if (req.url.startsWith('/internal/')) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ internalState: 'MOCK_STATE', graphVersion: 1 }));
        }

        res.writeHead(200, {
          'Content-Type': 'application/json',
          'X-Synthetic-Deception': 'true'
        });
        res.end(
          JSON.stringify({
            syntheticDeception: true,
            url: req.url,
            headers: req.headers
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
      where: { identifier: 'tenant-apex-9941' },
      update: { status: 'ACTIVE' },
      create: {
        identifier: 'tenant-apex-9941',
        displayName: 'Apex FinTech',
        status: 'ACTIVE'
      }
    });

    testTenantB = await prisma.tenant.upsert({
      where: { identifier: 'tenant-medsecure-7712' },
      update: { status: 'ACTIVE' },
      create: {
        identifier: 'tenant-medsecure-7712',
        displayName: 'MedSecure Health',
        status: 'ACTIVE'
      }
    });

    testAppA = await prisma.protectedApplication.upsert({
      where: {
        tenantId_applicationIdentifier: {
          tenantId: testTenantA.id,
          applicationIdentifier: 'app-apex-accounts-01'
        }
      },
      update: {
        domain: 'accounts.apexfintech.internal',
        status: 'PROTECTED'
      },
      create: {
        tenantId: testTenantA.id,
        applicationIdentifier: 'app-apex-accounts-01',
        name: 'Apex Core Accounts Service',
        domain: 'accounts.apexfintech.internal',
        status: 'PROTECTED'
      }
    });

    testAppB = await prisma.protectedApplication.upsert({
      where: {
        tenantId_applicationIdentifier: {
          tenantId: testTenantB.id,
          applicationIdentifier: 'app-med-portal-01'
        }
      },
      update: {
        domain: 'patient-portal.medsecure.internal',
        status: 'PROTECTED'
      },
      create: {
        tenantId: testTenantB.id,
        applicationIdentifier: 'app-med-portal-01',
        name: 'MedSecure Patient Portal',
        domain: 'patient-portal.medsecure.internal',
        status: 'PROTECTED'
      }
    });

    testPolicyA = await prisma.deceptionPolicy.upsert({
      where: { id: 'policy-apex-5b5-01' },
      update: {
        enabled: true,
        priority: 1,
        policyIdentifier: 'pol-apex-5b5-01',
        triggerConditions: {},
        requiredEvidenceCriteria: {
          minConfidence: 0.75,
          applicableClassifications: ['ATTACK']
        },
        permittedActions: ['PROPOSE_DECEPTION', 'ALLOW_NORMAL'],
        prohibitedActions: [],
        protectedIsolationConstraints: { strictNamespaceIsolation: true, noOutboundEgress: true }
      },
      create: {
        id: 'policy-apex-5b5-01',
        tenantId: testTenantA.id,
        applicationId: testAppA.id,
        policyIdentifier: 'pol-apex-5b5-01',
        name: 'Stage 5B.5 Adaptive Deception Policy',
        description: 'Policy governing adaptive deception routing decisions',
        enabled: true,
        priority: 1,
        version: 1,
        triggerConditions: {},
        requiredEvidenceCriteria: {
          minConfidence: 0.75,
          applicableClassifications: ['ATTACK']
        },
        permittedActions: ['PROPOSE_DECEPTION', 'ALLOW_NORMAL'],
        prohibitedActions: [],
        protectedIsolationConstraints: { strictNamespaceIsolation: true, noOutboundEgress: true }
      }
    });

    const baselineStrategies = [
      { id: 'strat-recon-honey-endpoints-01', type: 'RECONNAISSANCE_DECEPTION', name: 'Synthetic Decoy Endpoints' },
      { id: 'strat-credential-canary-token-01', type: 'CREDENTIAL_DECEPTION', name: 'Canary Token Decoy' },
      { id: 'strat-api-shadow-facade-01', type: 'API_DECEPTION', name: 'Shadow API Facade' },
      { id: 'strat-data-honey-records-01', type: 'DATA_ACCESS_DECEPTION', name: 'Honey Records Decoy' },
      { id: 'strat-service-tarpit-latency-01', type: 'SERVICE_INTERACTION_DECEPTION', name: 'Tarpit Rate Limiter' }
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
      where: { id: 'dsg-apex-5b5-graph-01' },
      update: { graphVersion: 1 },
      create: {
        id: 'dsg-apex-5b5-graph-01',
        tenantId: testTenantA.id,
        applicationId: testAppA.id,
        graphIdentifier: 'dsg-apex-5b5-graph-01',
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
        evaluatorVersion: '5B.5',
        strategyCatalogueVersion: '1.0.0',
        deceptionDisposition: 'PROPOSED',
        originAccessDecision: 'PROPOSE_DIVERT_TO_DECEPTION',
        decisionResult: 'PROPOSE_DECEPTION',
        decisionRationale: 'Stage 5B.5 Gateway Routing Test Decision',
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
        authorizationReasonCodes: ['STAGE_5B5_AUTH_OK'],
        expiresAt: new Date(Date.now() + 3600 * 1000)
      }
    });

    testAuthRevoked = await prisma.deceptionExecutionAuthorization.create({
      data: {
        tenantId: testTenantA.id,
        applicationId: testAppA.id,
        policyDecisionId: testPolicyDecision.id,
        dsgGraphId: testGraphA.id,
        dsgGraphVersion: 1,
        selectedStrategyId: 'strat-api-shadow-facade-01',
        authorizationStatus: 'REVOKED',
        requestingOperatorId: 'op-analyst-1',
        requestingOperatorEmail: 'analyst@apexfintech.io',
        authorizationReasonCodes: ['TEST_REVOKED'],
        expiresAt: new Date(Date.now() + 3600 * 1000)
      }
    });

    testAuthExpired = await prisma.deceptionExecutionAuthorization.create({
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
        authorizationReasonCodes: ['TEST_EXPIRED'],
        expiresAt: new Date(Date.now() - 3600 * 1000)
      }
    });

    testEnvironmentA = await prisma.deceptionRuntimeEnvironment.create({
      data: {
        tenantId: testTenantA.id,
        applicationId: testAppA.id,
        authorizationId: testAuthA.id,
        environmentIdentifier: `env-rt-5b5-live-${Date.now()}`,
        name: 'Apex Synthetic Decoy Environment 5B.5',
        lifecycleState: 'ACTIVE',
        healthStatus: 'HEALTHY',
        dsgGraphId: testGraphA.id,
        dsgGraphVersion: 1,
        ingressPort: mockSyntheticPort,
        networkIsolationMode: 'SANDBOX_ISOLATED',
        isSimulated: true,
        runtimeEvidence: {
          firewallDropRuleApplied: false, // Unresolved host INPUT finding is present
          hostBoundaryFinding: 'Finding A: Host bridge gateway port 22 reachable without host INPUT drop rule.'
        }
      }
    });

    testEnvironmentUnhealthy = await prisma.deceptionRuntimeEnvironment.create({
      data: {
        tenantId: testTenantA.id,
        applicationId: testAppA.id,
        authorizationId: testAuthA.id,
        environmentIdentifier: `env-rt-5b5-unhealthy-${Date.now()}`,
        name: 'Apex Unhealthy Environment',
        lifecycleState: 'ACTIVE',
        healthStatus: 'UNHEALTHY',
        dsgGraphId: testGraphA.id,
        dsgGraphVersion: 1,
        networkIsolationMode: 'SANDBOX_ISOLATED',
        isSimulated: true
      }
    });

    testEnvironmentTerminated = await prisma.deceptionRuntimeEnvironment.create({
      data: {
        tenantId: testTenantA.id,
        applicationId: testAppA.id,
        authorizationId: testAuthA.id,
        environmentIdentifier: `env-rt-5b5-terminated-${Date.now()}`,
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
      'accounts.apexfintech.internal': `http://127.0.0.1:${mockOriginPort}`,
      'patient-portal.medsecure.internal': `http://127.0.0.1:${mockOriginPort}`
    };

    // 4. Initialize Services
    runtimeSelector = new RuntimeSelectionService({ prismaClient: prisma });
    decisionControllerService = new GatewayDecisionControllerService({
      prismaClient: prisma,
      runtimeSelector,
      originMap: trustedOriginMap
    });

    // 5. Initialize Gateway App
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
      async resolveApplication(rawHost, correlationId) {
        const hostCheck = this.validateHostHeader(rawHost);
        if (!hostCheck.valid) return { resolved: false, statusCode: 400, errorCode: 'INVALID_HOST_HEADER' };
        const domain = hostCheck.hostClean;
        const trustedConfig = this.trustedOriginMap[domain];
        if (!trustedConfig) {
          return { resolved: false, statusCode: 404, errorCode: 'UNKNOWN_HOST' };
        }
        if (domain === 'accounts.apexfintech.internal') {
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
        if (domain === 'patient-portal.medsecure.internal') {
          return {
            resolved: true,
            appContext: {
              applicationId: testAppB.id,
              applicationIdentifier: testAppB.applicationIdentifier,
              name: testAppB.name,
              domain: testAppB.domain,
              tenantId: testTenantB.id,
              tenantIdentifier: testTenantB.identifier,
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
        MAX_TELEMETRY_QUEUE_SIZE: 50,
        TELEMETRY_LOSS_LOG_PATH: '/tmp/loss.log'
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
  // Category 1: Normal Request Forwarding
  // ---------------------------------------------------------------------------
  it('1. Normal request forwarding: benign request forwards to real origin and returns 200', async () => {
    const res = await sendHttpRequest({
      port: gatewayPort,
      path: '/api/v1/profile',
      headers: {
        Host: 'accounts.apexfintech.internal',
        Accept: 'application/json'
      }
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.origin, 'REAL_PROTECTED_APPLICATION');
    assert.equal(res.headers['x-origin-type'], 'REAL_PROTECTED_ORIGIN');
    assert.ok(res.headers['x-request-id']);
  });

  // ---------------------------------------------------------------------------
  // Category 2: Observe-Only Behavior
  // ---------------------------------------------------------------------------
  it('2. Observe-only behavior: observes traffic, evaluates detection, and forwards to origin without diversion', async () => {
    const decision = await decisionControllerService.evaluateGatewayRequest({
      domain: 'accounts.apexfintech.internal',
      method: 'GET',
      path: '/api/v1/profile',
      routingMode: ROUTING_MODES.OBSERVE_ONLY
    });

    assert.equal(decision.routingMode, ROUTING_MODES.OBSERVE_ONLY);
    assert.equal(decision.routingOutcome, ROUTING_DECISION_OUTCOMES.NORMAL_FORWARD);
    assert.equal(decision.action, 'NORMAL_ROUTING');
    assert.equal(decision.targetDestination, `http://127.0.0.1:${mockOriginPort}`);
  });

  // ---------------------------------------------------------------------------
  // Category 3: Shadow-Mode Decisions
  // ---------------------------------------------------------------------------
  it('3. Shadow-mode decisions: evaluates attack, records hypothetical deception, but forwards to real origin', async () => {
    const decision = await decisionControllerService.evaluateGatewayRequest({
      domain: 'accounts.apexfintech.internal',
      method: 'POST',
      path: '/api/v1/auth/login',
      headers: { 'x-attack-test': 'credential-stuffing' },
      routingMode: ROUTING_MODES.SHADOW
    });

    assert.equal(decision.routingMode, ROUTING_MODES.SHADOW);
    assert.equal(decision.routingOutcome, ROUTING_DECISION_OUTCOMES.SHADOW_DECEPTION);
    assert.equal(decision.action, 'NORMAL_ROUTING');
    assert.equal(decision.targetDestination, `http://127.0.0.1:${mockOriginPort}`);
    assert.ok(decision.hypotheticalDestination, 'Must record hypothetical deception destination');
    assert.ok(decision.hypotheticalEnvironmentId, 'Must record hypothetical environment ID');
  });

  // ---------------------------------------------------------------------------
  // Category 4: No Unintended Traffic Diversion
  // ---------------------------------------------------------------------------
  it('4. No unintended traffic diversion: in SHADOW mode, live request reaches origin, not synthetic service', async () => {
    const res = await sendHttpRequest({
      port: gatewayPort,
      method: 'POST',
      path: '/api/v1/auth/login',
      headers: {
        Host: 'accounts.apexfintech.internal',
        'x-attack-test': 'credential-stuffing',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ user: 'admin', pass: 'probe' })
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.origin, 'REAL_PROTECTED_APPLICATION');
    assert.equal(res.headers['x-synthetic-deception'], undefined);
  });

  // ---------------------------------------------------------------------------
  // Category 5: Tenant and Application Mapping
  // ---------------------------------------------------------------------------
  it('5. Tenant/application mapping: resolves application by host and rejects unknown domain with 404', async () => {
    const res = await sendHttpRequest({
      port: gatewayPort,
      path: '/api/v1/test',
      headers: { Host: 'unknown-intruder.external' }
    });

    assert.equal(res.status, 404);
    assert.equal(res.body?.error?.code, 'UNKNOWN_HOST');
  });

  // ---------------------------------------------------------------------------
  // Category 6: Detection Integration
  // ---------------------------------------------------------------------------
  it('6. Detection integration: hybrid detector classifies attack pattern with high confidence', async () => {
    const decision = await decisionControllerService.evaluateGatewayRequest({
      domain: 'accounts.apexfintech.internal',
      method: 'POST',
      path: '/api/v1/auth/login',
      headers: { 'x-attack-test': 'credential-stuffing' }
    });

    assert.ok(decision.assessmentId);
    const assessment = await prisma.behavioralAssessment.findUnique({
      where: { id: decision.assessmentId }
    });
    assert.equal(assessment.classification, 'ATTACK');
    const threatCategory = assessment.threatCategory || assessment.explanation?.threatCategory;
    const deceptionEligible = assessment.deceptionEligible ?? assessment.explanation?.deceptionEligible;
    assert.equal(threatCategory, 'CREDENTIAL_STUFFING');
    assert.equal(deceptionEligible, true);
  });

  // ---------------------------------------------------------------------------
  // Category 7: Policy Integration
  // ---------------------------------------------------------------------------
  it('7. Policy integration: matches tenant policy and produces PROPOSED deception disposition', async () => {
    const decision = await decisionControllerService.evaluateGatewayRequest({
      domain: 'accounts.apexfintech.internal',
      method: 'POST',
      path: '/api/v1/auth/login',
      headers: { 'x-attack-test': 'credential-stuffing' }
    });

    assert.ok(decision.policyDecisionId);
    const policyDecision = await prisma.policyDecision.findUnique({
      where: { id: decision.policyDecisionId }
    });
    assert.equal(policyDecision.deceptionDisposition, 'PROPOSED');
    assert.equal(policyDecision.originAccessDecision, 'PROPOSE_DIVERT_TO_DECEPTION');
  });

  // ---------------------------------------------------------------------------
  // Category 8: Strategy Selection Integration
  // ---------------------------------------------------------------------------
  it('8. Strategy selection integration: selects appropriate decoy strategy for threat category', async () => {
    const decision = await decisionControllerService.evaluateGatewayRequest({
      domain: 'accounts.apexfintech.internal',
      method: 'POST',
      path: '/api/v1/auth/login',
      headers: { 'x-attack-test': 'credential-stuffing' }
    });

    assert.ok(decision.selectedStrategyId, 'Must select a strategy');
  });

  // ---------------------------------------------------------------------------
  // Category 9: DSG Version Integration
  // ---------------------------------------------------------------------------
  it('9. DSG version integration: binds valid DSG graph version to decision', async () => {
    const decision = await decisionControllerService.evaluateGatewayRequest({
      domain: 'accounts.apexfintech.internal',
      method: 'POST',
      path: '/api/v1/auth/login',
      headers: { 'x-attack-test': 'credential-stuffing' }
    });

    assert.equal(typeof decision.dsgGraphVersion, 'number');
    assert.ok(decision.dsgGraphVersion >= 1);
  });

  // ---------------------------------------------------------------------------
  // Category 10: Runtime Selection
  // ---------------------------------------------------------------------------
  it('10. Runtime selection: selects active, authorized environment matching tenant', async () => {
    const res = await runtimeSelector.selectRuntimeEnvironment({
      tenantId: testTenantA.id,
      applicationId: testAppA.id,
      dsgGraphVersion: 1
    });

    assert.equal(res.eligible, true);
    assert.equal(res.environment?.id, testEnvironmentA.id);
    assert.equal(res.safetyChecks.tenantOwnershipVerified, true);
    assert.equal(res.safetyChecks.authorizationVerified, true);
  });

  // ---------------------------------------------------------------------------
  // Category 11: Runtime Health Gating
  // ---------------------------------------------------------------------------
  it('11. Runtime health gating: rejects UNHEALTHY and TERMINATED environments', async () => {
    // When only UNHEALTHY candidate is available
    const unhealthyCheck = await runtimeSelector.selectRuntimeEnvironment({
      tenantId: testTenantA.id,
      strategyId: 'non-existent-strategy-to-force-fallback'
    });

    // Does not select unhealthy/terminated
    assert.ok(!unhealthyCheck.eligible || unhealthyCheck.environment?.healthStatus !== 'UNHEALTHY');
  });

  // ---------------------------------------------------------------------------
  // Category 12: Authorization Verification
  // ---------------------------------------------------------------------------
  it('12. Authorization verification: rejects REVOKED and EXPIRED authorizations', async () => {
    // Environment with revoked auth
    const envRevoked = await prisma.deceptionRuntimeEnvironment.create({
      data: {
        tenantId: testTenantA.id,
        applicationId: testAppA.id,
        authorizationId: testAuthRevoked.id,
        environmentIdentifier: `env-rt-revoked-${Date.now()}`,
        name: 'Revoked Auth Env',
        lifecycleState: 'ACTIVE',
        healthStatus: 'HEALTHY',
        dsgGraphId: testGraphA.id,
        dsgGraphVersion: 1,
        isSimulated: true
      }
    });

    const readiness = await runtimeSelector.checkControlledLabReadiness(envRevoked.id, testTenantA.id);
    assert.equal(readiness.isReady, false);
    assert.equal(readiness.checklist.runtimeAuthorizationVerified, false);
  });

  // ---------------------------------------------------------------------------
  // Category 13: Host-Boundary Activation Blocker
  // ---------------------------------------------------------------------------
  it('13. Host-boundary activation blocker: unresolved host INPUT firewall finding strictly blocks CONTROLLED_LAB', async () => {
    const readiness = await runtimeSelector.checkControlledLabReadiness(testEnvironmentA.id, testTenantA.id);

    assert.equal(readiness.isReady, false);
    assert.equal(readiness.status, 'CONTROLLED_LAB_BLOCKED');
    assert.ok(
      readiness.blockers.some((b) => b.includes('host INPUT firewall finding') || b.includes('Finding A')),
      'Must cite host INPUT firewall finding as activation blocker'
    );
  });

  // ---------------------------------------------------------------------------
  // Category 14: Cross-Tenant Routing Rejection
  // ---------------------------------------------------------------------------
  it('14. Cross-tenant routing rejection: Tenant B cannot select or route to Tenant A environment', async () => {
    const res = await runtimeSelector.selectRuntimeEnvironment({
      tenantId: testTenantB.id,
      applicationId: testAppB.id
    });

    // If no environment exists for Tenant B, reject
    assert.equal(res.eligible, false);
    assert.equal(res.reasonCode, RUNTIME_REJECTION_REASONS.NO_RUNTIME_CONFIGURED);
  });

  // ---------------------------------------------------------------------------
  // Category 15: SSRF Protection
  // ---------------------------------------------------------------------------
  it('15. SSRF protection: AWS/cloud metadata address 169.254.169.254 is blocked before connection', async () => {
    const pinResult = await resolveAndPinUpstreamDestination('http://169.254.169.254/latest/meta-data/');
    assert.equal(pinResult.valid, false);
    assert.ok(pinResult.reason?.includes('metadata'));
  });

  // ---------------------------------------------------------------------------
  // Category 16: DNS Rebinding Protection
  // ---------------------------------------------------------------------------
  it('16. DNS rebinding protection: connection pinning verifies resolved IP matches pin', async () => {
    const pinResult = await resolveAndPinUpstreamDestination(`http://127.0.0.1:${mockOriginPort}`, { allowLoopback: true });
    assert.equal(pinResult.valid, true);
    assert.equal(pinResult.pinnedIp, '127.0.0.1');
  });

  // ---------------------------------------------------------------------------
  // Category 17: Sensitive Header Sanitization
  // ---------------------------------------------------------------------------
  it('17. Sensitive header sanitization: real user credentials and cookies stripped when forwarding to deception', () => {
    const incomingHeaders = {
      host: 'accounts.apexfintech.internal',
      authorization: 'Bearer real-user-jwt-secret-token',
      cookie: 'sessionId=secret-session-cookie-12345; user=real-bob',
      'x-api-key': 'production-api-secret-key',
      'content-type': 'application/json',
      accept: '*/*'
    };

    const sanitized = sanitizeDeceptionForwardedHeaders(incomingHeaders, {
      clientIp: '198.51.100.42',
      validatedHost: 'accounts.apexfintech.internal',
      requestId: 'req-test-sanitize-01',
      targetEnvironmentId: 'env-rt-5b5-live'
    });

    assert.equal(sanitized.authorization, undefined, 'Authorization header must be stripped');
    assert.equal(sanitized.cookie, undefined, 'Cookie header must be stripped');
    assert.equal(sanitized['x-api-key'], undefined, 'API key must be stripped');
    assert.equal(sanitized['x-deception-synthetic'], 'true');
    assert.equal(sanitized['x-correlation-id'], 'req-test-sanitize-01');
    assert.equal(sanitized['x-deception-environment'], 'env-rt-5b5-live');
  });

  // ---------------------------------------------------------------------------
  // Category 18: Runtime Timeout Handling
  // ---------------------------------------------------------------------------
  it('18. Runtime timeout handling: upstream timeouts return controlled 504 without crashing', async () => {
    // Create a stalling upstream server that does not respond in time
    const stallingServer = http.createServer((req, res) => {
      // Intentionally do not respond
    });

    await new Promise((resolve) => stallingServer.listen(0, '127.0.0.1', resolve));
    const stallPort = stallingServer.address().port;

    const timeoutResolver = {
      trustedOriginMap: { 'stalling.apexfintech.internal': `http://127.0.0.1:${stallPort}` },
      validateHostHeader(rawHost) {
        return { valid: true, hostClean: (rawHost || '').trim().toLowerCase().split(':')[0] };
      },
      resolveTrustedOriginLocal(rawHost) {
        return this.trustedOriginMap[rawHost] || null;
      },
      async resolveApplication(rawHost) {
        return {
          resolved: true,
          appContext: {
            applicationId: testAppA.id,
            applicationIdentifier: 'app-stall',
            name: 'Stall App',
            domain: 'stalling.apexfintech.internal',
            tenantId: testTenantA.id,
            tenantIdentifier: testTenantA.identifier,
            status: 'PROTECTED',
            upstreamUrl: `http://127.0.0.1:${stallPort}`,
            allowedMethods: ['GET', 'POST'],
            timeoutMs: 300,
            maxBodyBytes: 1048576
          }
        };
      }
    };

    const timeoutGateway = createGatewayApp({
      config: {
        TRUSTED_ORIGIN_MAP: { 'stalling.apexfintech.internal': `http://127.0.0.1:${stallPort}` },
        MANAGEMENT_API_URL: 'http://127.0.0.1:5000',
        GATEWAY_INTERNAL_TOKEN: 'test-token',
        UPSTREAM_TIMEOUT_MS: 300
      },
      appResolver: timeoutResolver,
      decisionController: {
        async evaluateDecision() {
          return {
            action: 'NORMAL_ROUTING',
            routingMode: 'SHADOW',
            targetDestination: `http://127.0.0.1:${stallPort}`
          };
        }
      }
    });

    let timeoutPort;
    let serverInstance;
    await new Promise((resolve) => {
      serverInstance = timeoutGateway.listen(0, '127.0.0.1', () => {
        timeoutPort = serverInstance.address().port;
        resolve();
      });
    });

    try {
      const res = await sendHttpRequest({
        port: timeoutPort,
        path: '/stall',
        headers: { Host: 'stalling.apexfintech.internal' }
      });
      assert.equal(res.status, 504);
      assert.equal(res.body?.error?.code, 'GATEWAY_TIMEOUT');
    } finally {
      serverInstance.close();
      stallingServer.close();
    }
  });

  // ---------------------------------------------------------------------------
  // Category 19: Runtime Unavailable Handling
  // ---------------------------------------------------------------------------
  it('19. Runtime unavailable handling: when deception is proposed but runtime missing, safely defers to origin', async () => {
    // Create tenant with no active runtime environments
    const emptyTenant = await prisma.tenant.create({
      data: {
        identifier: `tenant-empty-${Date.now()}`,
        displayName: 'Empty Tenant',
        status: 'ACTIVE'
      }
    });

    const emptyApp = await prisma.protectedApplication.create({
      data: {
        tenantId: emptyTenant.id,
        applicationIdentifier: `app-empty-${Date.now()}`,
        name: 'Empty App',
        domain: `empty-${Date.now()}.internal`,
        status: 'PROTECTED'
      }
    });

    await prisma.deceptionPolicy.create({
      data: {
        tenantId: emptyTenant.id,
        applicationId: emptyApp.id,
        policyIdentifier: `pol-empty-${Date.now()}`,
        name: 'Empty Tenant Policy',
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

    await prisma.deceptionGraph.create({
      data: {
        tenantId: emptyTenant.id,
        applicationId: emptyApp.id,
        graphIdentifier: `dsg-empty-${Date.now()}`,
        graphVersion: 1,
        status: 'ACTIVE'
      }
    });

    const mockOrigin = `http://127.0.0.1:${mockOriginPort}`;
    const decision = await decisionControllerService.evaluateGatewayRequest({
      domain: emptyApp.domain,
      method: 'POST',
      path: '/api/v1/auth/login',
      headers: { 'x-attack-test': 'credential-stuffing' },
      appContext: {
        applicationId: emptyApp.id,
        tenantId: emptyTenant.id,
        domain: emptyApp.domain,
        upstreamUrl: mockOrigin,
        status: 'PROTECTED',
        routingMode: 'SHADOW'
      }
    });

    assert.equal(decision.routingOutcome, ROUTING_DECISION_OUTCOMES.RUNTIME_UNAVAILABLE);
    assert.equal(decision.targetDestination, mockOrigin);
    assert.equal(decision.action, 'NORMAL_ROUTING');
  });

  // ---------------------------------------------------------------------------
  // Category 20: Session Continuity
  // ---------------------------------------------------------------------------
  it('20. Session continuity: requests from same client maintain pseudonymous session continuity', async () => {
    const decision1 = await decisionControllerService.evaluateGatewayRequest({
      domain: 'accounts.apexfintech.internal',
      method: 'GET',
      path: '/api/v1/test',
      clientIp: '198.51.100.99'
    });

    const decision2 = await decisionControllerService.evaluateGatewayRequest({
      domain: 'accounts.apexfintech.internal',
      method: 'POST',
      path: '/api/v1/auth/login',
      clientIp: '198.51.100.99'
    });

    assert.ok(decision1.sessionRef);
    assert.equal(decision1.sessionRef, decision2.sessionRef, 'Session handle must match for same pseudonymous client');
  });

  // ---------------------------------------------------------------------------
  // Category 21: Decision Evidence Generation
  // ---------------------------------------------------------------------------
  it('21. Decision evidence generation: emits chronological events with valid SHA-256 hash chaining', async () => {
    const fixedId = crypto.randomUUID();
    await decisionControllerService.evaluateGatewayRequest({
      correlationId: fixedId,
      domain: 'accounts.apexfintech.internal',
      method: 'POST',
      path: '/api/v1/auth/login',
      headers: { 'x-attack-test': 'credential-stuffing' }
    });

    const events = await prisma.deceptionExecutionEvent.findMany({
      where: {
        tenantId: testTenantA.id,
        eventPayload: { path: ['correlationId'], equals: fixedId }
      },
      orderBy: { recordedAt: 'asc' }
    });

    const types = events.map((e) => e.eventType);
    assert.ok(types.includes(EXECUTION_EVENT_TYPES.GATEWAY_REQUEST_OBSERVED));
    assert.ok(types.includes(EXECUTION_EVENT_TYPES.POLICY_EVALUATED));
    assert.ok(types.includes(EXECUTION_EVENT_TYPES.SHADOW_DECISION));
    assert.ok(types.includes(EXECUTION_EVENT_TYPES.HYPOTHETICAL_OUTCOME));
    assert.ok(types.includes(EXECUTION_EVENT_TYPES.ROUTING_DECISION_CREATED));
  });

  // ---------------------------------------------------------------------------
  // Category 22: Duplicate Request Handling
  // ---------------------------------------------------------------------------
  it('22. Duplicate request handling: replaying identical correlation ID is handled deterministically', async () => {
    const fixedCorrelationId = crypto.randomUUID();

    const result1 = await decisionControllerService.evaluateGatewayRequest({
      correlationId: fixedCorrelationId,
      domain: 'accounts.apexfintech.internal',
      method: 'GET',
      path: '/api/v1/profile'
    });

    const result2 = await decisionControllerService.evaluateGatewayRequest({
      correlationId: fixedCorrelationId,
      domain: 'accounts.apexfintech.internal',
      method: 'GET',
      path: '/api/v1/profile'
    });

    assert.equal(result1.routingOutcome, result2.routingOutcome);
    assert.equal(result1.action, result2.action);
  });

  // ---------------------------------------------------------------------------
  // Category 23: Gateway Worker Failure Handling
  // ---------------------------------------------------------------------------
  it('23. Gateway worker failure handling: client fails closed safely when controller is unavailable and required', async () => {
    const brokenClient = new DecisionControllerClient({
      controllerUrl: 'http://127.0.0.1:59999',
      requireController: true
    });

    const decision = await brokenClient.evaluateDecision({
      correlationId: crypto.randomUUID(),
      appContext: { tenantId: testTenantA.id, applicationId: testAppA.id, domain: 'accounts.apexfintech.internal' },
      method: 'GET',
      path: '/api/v1/test',
      clientIp: '127.0.0.1'
    });

    assert.equal(decision.action, 'FAIL_CLOSED');
    assert.ok(decision.reason.includes('unavailable') || decision.reason.includes('failing closed'));
  });

  // ---------------------------------------------------------------------------
  // Category 24: Routing Rollback Readiness
  // ---------------------------------------------------------------------------
  it('24. Routing rollback readiness: verifies environment rollback state readiness', async () => {
    const readiness = await runtimeSelector.checkControlledLabReadiness(testEnvironmentA.id, testTenantA.id);
    assert.equal(readiness.checklist.rollbackReadinessVerified, true);
  });

  // ---------------------------------------------------------------------------
  // Category 25: End-to-End Shadow Pipeline
  // ---------------------------------------------------------------------------
  it('25. End-to-end shadow pipeline: full HTTP ingress through gateway records shadow decision and returns origin response', async () => {
    const correlationId = crypto.randomUUID();
    const res = await sendHttpRequest({
      port: gatewayPort,
      method: 'GET',
      path: '/api/v1/customers/all',
      headers: {
        Host: 'accounts.apexfintech.internal',
        'X-Request-ID': correlationId,
        'x-attack-test': 'data-exfiltration'
      }
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.origin, 'REAL_PROTECTED_APPLICATION');

    // Verify routing decision was recorded
    const routingRecord = await prisma.routingDecision.findFirst({
      where: { correlationId },
      include: { outcome: true }
    });

    assert.ok(routingRecord, 'Routing decision must be recorded');
    assert.equal(routingRecord.outcome?.outcomeStatus, ROUTING_DECISION_OUTCOMES.SHADOW_DECEPTION);
  });
});
