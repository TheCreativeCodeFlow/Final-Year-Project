/**
 * Stage 5A.1 Test Suite: Policy Semantics, DSG Consistency, and Adaptive Strategy Validation
 *
 * Verifies:
 * 1. Semantic Separation: deceptionDisposition vs originAccessDecision across all states
 * 2. Fail-secure Degraded Handling: Degraded telemetry never becomes proof of benign traffic
 * 3. DSG Versioning & Concurrency: Rejects stale plans, verifies baseGraphVersion, preserves prior state
 * 4. Proposal Idempotency: Deterministic hash prevents duplicate drift
 * 5. Strategy Selection Validation: Full 11-scenario benchmark execution
 * 6. Multi-Stage Strategy Reassessment: Cross-state consistency checking & conflict rejection
 * 7. Decision Provenance & Immutability: Historical records preserved across policy/strategy updates
 * 8. Deterministic Policy Conflict Resolution: Scope specificity, priority ASC, version DESC, collation
 * 9. Tenant Isolation & RBAC
 * 10. Core Invariant: executionEvidenceStatus = MISSING
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { getPrismaClient, connectDatabase, disconnectDatabase } from '../src/db/client.js';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import {
  PolicyEvaluationEngine,
  DECISION_RESULTS,
  DECEPTION_DISPOSITIONS,
  ORIGIN_ACCESS_DECISIONS,
  REASON_CODES
} from '../src/deception/policy-evaluation.service.js';
import { PolicyService } from '../src/deception/policy.service.js';
import { DSGPlannerService, TRANSITION_STATUSES } from '../src/deception/dsg-planner.service.js';
import { DecisionRecorderService } from '../src/deception/decision-recorder.service.js';
import { BASELINE_STRATEGIES } from '../src/deception/strategy-catalog.js';
import { StrategyBenchmarkRunner } from '../src/deception/strategy-scenarios.js';
import { StrategySelectionService } from '../src/deception/strategy-selection.service.js';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgresql://rahulseervi@localhost:5432/adaptive_deception_test?schema=public';

process.env.DATABASE_URL = TEST_DATABASE_URL;

describe('Stage 5A.1: Policy Semantics, DSG Consistency & Adaptive Strategy Suite', () => {
  let app;
  let server;
  let baseUrl;
  let prisma;

  let tenantApexId;
  let tenantMedId;
  let appApexId;
  let ownerCookie;
  let ownerCsrfToken;
  let analystCookie;
  let analystCsrfToken;

  let testPolicy;
  let testGraph;

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

    // 3. Authenticate Owner Apex
    const resLoginOwner = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner@apexfintech.io', password: 'DevOwner12345!' })
    });
    const dataOwner = await resLoginOwner.json();
    ownerCsrfToken = dataOwner.data.antiCsrfToken;
    ownerCookie = resLoginOwner.headers.get('set-cookie');

    // 4. Authenticate Analyst MedSecure
    const resLoginAnalyst = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'analyst@medsecure.io', password: 'DevAnalyst12345!' })
    });
    const dataAnalyst = await resLoginAnalyst.json();
    analystCsrfToken = dataAnalyst.data.antiCsrfToken;
    analystCookie = resLoginAnalyst.headers.get('set-cookie');

    // 5. Create test policy
    testPolicy = await prisma.deceptionPolicy.findFirst({
      where: { tenantId: tenantApexId, policyIdentifier: 'pol-stage5a1-strict-01' }
    });
    if (!testPolicy) {
      testPolicy = await prisma.deceptionPolicy.create({
        data: {
          tenantId: tenantApexId,
          applicationId: appApexId,
          policyIdentifier: 'pol-stage5a1-strict-01',
          name: 'Apex Stage 5A.1 Strict Policy',
          description: 'Strict policy enforcing Stage 5A.1 semantics',
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
          prohibitedActions: ['RUN_ARBITRARY_COMMAND'],
          protectedIsolationConstraints: { strictNamespaceIsolation: true, noOutboundEgress: true },
          version: 1
        }
      });
    }

    // 6. Create test graph
    testGraph = await prisma.deceptionGraph.findFirst({
      where: { tenantId: tenantApexId, graphIdentifier: 'dsg-stage5a1-concurrency' }
    });
    if (!testGraph) {
      testGraph = await prisma.deceptionGraph.create({
        data: {
          tenantId: tenantApexId,
          applicationId: appApexId,
          graphIdentifier: 'dsg-stage5a1-concurrency',
          graphVersion: 2,
          status: 'ACTIVE'
        }
      });
    }
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDatabase();
  });

  // ---------------------------------------------------------------------------
  // Task 1: Separate Deception Disposition from Origin Access
  // ---------------------------------------------------------------------------

  it('1. Missing policy separates deceptionDisposition (DECEPTION_NOT_PROPOSED) from originAccessDecision (DEFER_TO_GATEWAY)', () => {
    const engine = new PolicyEvaluationEngine();
    const evaluation = engine.evaluate({
      assessment: {
        assessmentLabel: 'ATTACK',
        confidenceScore: 0.95,
        ruleFindings: [{ ruleId: 'RULE_AUTH_BRUTE_FORCE', severity: 'CRITICAL' }]
      },
      policy: null,
      tenantId: tenantApexId
    });

    assert.strictEqual(evaluation.decisionResult, DECISION_RESULTS.POLICY_NOT_CONFIGURED);
    assert.strictEqual(evaluation.deceptionDisposition, DECEPTION_DISPOSITIONS.DECEPTION_NOT_PROPOSED);
    assert.strictEqual(evaluation.originAccessDecision, ORIGIN_ACCESS_DECISIONS.DEFER_TO_GATEWAY);
    assert.ok(evaluation.reasonCodes.includes(REASON_CODES.DECEPTION_POLICY_NOT_CONFIGURED_DEFER_GATEWAY));
  });

  it('2. Degraded telemetry strictly rejects deception (DECEPTION_REJECTED) and defers with uncertainty (DEFER_WITH_UNCERTAINTY) without assuming benign traffic', () => {
    const engine = new PolicyEvaluationEngine();
    const evaluation = engine.evaluate({
      assessment: {
        assessmentLabel: 'ATTACK',
        confidenceScore: 0.95,
        dataQualityState: 'DEGRADED',
        telemetryLossDetected: true,
        ruleFindings: [{ ruleId: 'RULE_AUTH_BRUTE_FORCE', severity: 'CRITICAL' }]
      },
      policy: testPolicy,
      tenantId: tenantApexId
    });

    assert.strictEqual(evaluation.decisionResult, DECISION_RESULTS.INSUFFICIENT_EVIDENCE);
    assert.strictEqual(evaluation.deceptionDisposition, DECEPTION_DISPOSITIONS.DECEPTION_REJECTED);
    assert.strictEqual(evaluation.originAccessDecision, ORIGIN_ACCESS_DECISIONS.DEFER_WITH_UNCERTAINTY);
    assert.ok(evaluation.reasonCodes.includes(REASON_CODES.DEGRADED_TELEMETRY_NO_ASSUMPTION_OF_BENIGN));
    assert.match(evaluation.decisionRationale, /never assumed to be benign/i);
  });

  it('3. Benign traffic sets deceptionDisposition (DECEPTION_NOT_PROPOSED) and originAccessDecision (DEFER_TO_GATEWAY)', () => {
    const engine = new PolicyEvaluationEngine();
    const evaluation = engine.evaluate({
      assessment: {
        assessmentLabel: 'BENIGN',
        confidenceScore: 0.98,
        dataQualityState: 'COMPLETE',
        telemetryLossDetected: false,
        ruleFindings: []
      },
      policy: testPolicy,
      tenantId: tenantApexId
    });

    assert.strictEqual(evaluation.decisionResult, DECISION_RESULTS.ALLOW_NORMAL);
    assert.strictEqual(evaluation.deceptionDisposition, DECEPTION_DISPOSITIONS.DECEPTION_NOT_PROPOSED);
    assert.strictEqual(evaluation.originAccessDecision, ORIGIN_ACCESS_DECISIONS.DEFER_TO_GATEWAY);
    assert.ok(evaluation.reasonCodes.includes(REASON_CODES.BENIGN_TRAFFIC_DECEPTION_NOT_PROPOSED));
  });

  it('4. Suspended application denies origin access (DENY_APPLICATION_SUSPENDED) without deception', () => {
    const engine = new PolicyEvaluationEngine();
    const evaluation = engine.evaluate({
      assessment: {
        assessmentLabel: 'ATTACK',
        confidenceScore: 0.90,
        ruleFindings: [{ ruleId: 'RULE_AUTH_BRUTE_FORCE', severity: 'CRITICAL' }]
      },
      application: { status: 'SUSPENDED' },
      policy: testPolicy,
      tenantId: tenantApexId
    });

    assert.strictEqual(evaluation.decisionResult, DECISION_RESULTS.BLOCK_POLICY);
    assert.strictEqual(evaluation.deceptionDisposition, DECEPTION_DISPOSITIONS.DECEPTION_NOT_PROPOSED);
    assert.strictEqual(evaluation.originAccessDecision, ORIGIN_ACCESS_DECISIONS.DENY_APPLICATION_SUSPENDED);
    assert.ok(evaluation.reasonCodes.includes(REASON_CODES.APPLICATION_SUSPENDED_ACCESS_DENIED));
  });

  it('5. Corroborated attack proposes deception (PROPOSE_DECEPTION) and proposes diversion (PROPOSE_DIVERT_TO_DECEPTION)', () => {
    const engine = new PolicyEvaluationEngine();
    const evaluation = engine.evaluate({
      assessment: {
        assessmentLabel: 'ATTACK',
        confidenceScore: 0.92,
        dataQualityState: 'COMPLETE',
        telemetryLossDetected: false,
        sessionCorrelationConfidence: 0.95,
        ruleFindings: [{ ruleId: 'RULE_AUTH_BRUTE_FORCE', severity: 'CRITICAL' }]
      },
      policy: testPolicy,
      currentGraph: testGraph,
      tenantId: tenantApexId
    });

    assert.strictEqual(evaluation.decisionResult, DECISION_RESULTS.PROPOSE_DECEPTION);
    assert.strictEqual(evaluation.deceptionDisposition, DECEPTION_DISPOSITIONS.PROPOSE_DECEPTION);
    assert.strictEqual(evaluation.originAccessDecision, ORIGIN_ACCESS_DECISIONS.PROPOSE_DIVERT_TO_DECEPTION);
    assert.ok(evaluation.reasonCodes.includes(REASON_CODES.DECEPTION_PROPOSED_AWAITING_ROUTING_AUTH));
    assert.ok(evaluation.selectedStrategy);
    assert.ok(evaluation.dsgPlan);
  });

  // ---------------------------------------------------------------------------
  // Task 2: Strengthen DSG Versioning and Concurrency
  // ---------------------------------------------------------------------------

  it('6. DSG Planner accepts proposal when baseGraphVersion matches currentGraph version', () => {
    const planner = new DSGPlannerService();
    const strategy = BASELINE_STRATEGIES[0];
    const plan = planner.planMutation({
      currentGraph: testGraph,
      strategy,
      policy: testPolicy,
      tenantId: tenantApexId,
      baseGraphVersion: testGraph.graphVersion
    });

    assert.strictEqual(plan.status, TRANSITION_STATUSES.PROPOSED);
    assert.strictEqual(plan.baseGraphVersion, testGraph.graphVersion);
    assert.strictEqual(plan.targetGraphVersion, testGraph.graphVersion + 1);
    assert.strictEqual(plan.rejectionReason, null);
    assert.ok(plan.idempotencyKey);
  });

  it('7. DSG Planner rejects stale plan when baseGraphVersion does not match currentGraph version', () => {
    const planner = new DSGPlannerService();
    const strategy = BASELINE_STRATEGIES[0];
    const plan = planner.planMutation({
      currentGraph: testGraph,
      strategy,
      policy: testPolicy,
      tenantId: tenantApexId,
      baseGraphVersion: 1 // Stale: testGraph is at version 2
    });

    assert.strictEqual(plan.status, TRANSITION_STATUSES.REJECTED);
    assert.strictEqual(plan.baseGraphVersion, 1);
    assert.match(plan.rejectionReason, /STALE_GRAPH_VERSION/);
    assert.strictEqual(plan.nodesToAdd.length, 0);
  });

  it('8. Planning generates deterministic idempotency keys for duplicate requests', () => {
    const strategy = BASELINE_STRATEGIES[0];
    const key1 = DSGPlannerService.computeIdempotencyKey({
      graphId: testGraph.id,
      baseGraphVersion: 2,
      strategyIdentifier: strategy.strategyIdentifier,
      policyId: testPolicy.id
    });
    const key2 = DSGPlannerService.computeIdempotencyKey({
      graphId: testGraph.id,
      baseGraphVersion: 2,
      strategyIdentifier: strategy.strategyIdentifier,
      policyId: testPolicy.id
    });

    assert.strictEqual(key1, key2);
    assert.strictEqual(typeof key1, 'string');
    assert.strictEqual(key1.length, 64);
  });

  // ---------------------------------------------------------------------------
  // Task 3: Validate Strategy Selection Across 11 Scenarios
  // ---------------------------------------------------------------------------

  it('9. Strategy Benchmark Suite executes and validates all 11 canonical scenarios with 100% conformance', () => {
    const runner = new StrategyBenchmarkRunner();
    const results = runner.evaluateAllScenarios();

    assert.strictEqual(results.length, 11, 'Must evaluate exactly 11 scenarios');

    const failing = results.filter((r) => !r.pass);
    if (failing.length > 0) {
      console.error('Benchmark failures:', failing);
    }
    assert.strictEqual(failing.length, 0, 'All 11 scenarios must pass with 100% deterministic conformance');

    for (const r of results) {
      assert.ok(r.observedEvidence, 'Must record observed evidence');
      assert.ok(Array.isArray(r.candidateStrategies), 'Must record candidate strategies');
      assert.ok(Array.isArray(r.rejectedStrategies), 'Must record rejected strategies');
      assert.ok(r.rankingRationale, 'Must record ranking rationale');
      assert.ok(r.confidence !== undefined, 'Must record confidence');
      assert.ok(r.uncertainty !== undefined, 'Must record uncertainty');
    }
  });

  // ---------------------------------------------------------------------------
  // Task 4: Implement Strategy Reassessment Planning
  // ---------------------------------------------------------------------------

  it('10. Multi-stage strategy reassessment merges compatible mutations across attack progression', () => {
    const planner = new DSGPlannerService();

    // Step 1: Initial Reconnaissance -> API_DECEPTION proposal
    const reconStrategy = BASELINE_STRATEGIES.find((s) => s.strategyIdentifier === 'strat-api-shadow-facade-01');
    const initialPlan = planner.planMutation({
      currentGraph: testGraph,
      strategy: reconStrategy,
      policy: testPolicy,
      tenantId: tenantApexId
    });
    assert.strictEqual(initialPlan.status, TRANSITION_STATUSES.PROPOSED);

    // Step 2: Attacker escalates to credential probing -> CREDENTIAL_DECEPTION
    const credStrategy = BASELINE_STRATEGIES.find((s) => s.strategyIdentifier === 'strat-credential-canary-token-01');
    const reassessment = planner.reassessStrategy({
      currentGraph: testGraph,
      activeProposal: initialPlan,
      newStrategy: credStrategy,
      policy: testPolicy,
      tenantId: tenantApexId
    });

    assert.strictEqual(reassessment.consistent, true);
    assert.strictEqual(reassessment.reassessmentStatus, 'COMPATIBLE_MUTATION');
    assert.ok(reassessment.mergedPlan);
    assert.strictEqual(reassessment.mergedPlan.status, TRANSITION_STATUSES.PROPOSED);
    assert.ok(reassessment.consistencyChecks.every((c) => c.passed));
  });

  it('11. Strategy reassessment rejects incompatible synthetic state mutations and preserves prior state', () => {
    const planner = new DSGPlannerService();

    // Active proposal with restricted database vault
    const activeProposal = {
      nodesToAdd: [{ nodeIdentifier: 'node-existing-1', layerClassification: 'CONTROLLED_DYNAMIC_STATE' }],
      edgesToAdd: [],
      proposedState: {
        topologyVersion: 2,
        strategyIdentifier: 'strat-data-honey-records-01',
        syntheticEnvironmentModel: {
          mockUsers: [{ username: 'synthetic_admin', role: 'SECURITY_AUDITOR_DECOY', status: 'ACTIVE' }],
          mockAuthState: { tokenType: 'CANARY_JWT' },
          mockEndpoints: [{ path: '/api/v1/auth/login', method: 'POST', simulatedStatus: 200 }],
          mockDatabaseRecords: { schema: 'RESTRICTED_IMMUTABLE', tables: ['vault_a'] }
        }
      }
    };

    // Contrived incompatible strategy with conflicting user role and contradictory endpoint response
    const incompatibleStrategy = {
      strategyIdentifier: 'strat-conflict-test',
      strategyType: 'DATA_ACCESS_DECEPTION',
      dsgBlueprint: { nodes: [], edges: [] },
      isolationRequirements: { strictNamespaceIsolation: true, noOutboundEgress: false },
      permittedStateChangeProposal: {
        honeyTable: 'colliding_table',
        routes: [{ path: '/api/v1/auth/login', method: 'POST', simulatedStatus: 500 }]
      }
    };

    const reassessment = planner.reassessStrategy({
      currentGraph: testGraph,
      activeProposal,
      newStrategy: incompatibleStrategy,
      tenantId: tenantApexId
    });

    assert.strictEqual(reassessment.consistent, false);
    assert.strictEqual(reassessment.reassessmentStatus, 'INCONSISTENT_SYNTHETIC_STATE');
    assert.strictEqual(reassessment.mergedPlan, null);
    assert.match(reassessment.rejectionReason, /INCONSISTENT_SYNTHETIC_STATE/);
  });

  // ---------------------------------------------------------------------------
  // Task 5: Decision Provenance & Immutability
  // ---------------------------------------------------------------------------

  it('12. Recorded decision captures immutable snapshots of policy, strategy, and evidence', async () => {
    const recorder = new DecisionRecorderService(prisma);
    const engine = new PolicyEvaluationEngine();

    const evaluation = engine.evaluate({
      assessment: {
        id: 'eval-prov-test-01',
        assessmentLabel: 'ATTACK',
        confidenceScore: 0.94,
        riskScore: 0.92,
        dataQualityState: 'COMPLETE',
        telemetryLossDetected: false,
        sessionCorrelationConfidence: 0.95,
        ruleFindings: [{ ruleId: 'RULE_AUTH_BRUTE_FORCE', severity: 'CRITICAL' }],
        features: { bruteForceRps: 15 }
      },
      policy: testPolicy,
      currentGraph: testGraph,
      tenantId: tenantApexId
    });

    const recorded = await recorder.recordDecision({
      tenantId: tenantApexId,
      applicationId: appApexId,
      evaluation,
      graphId: testGraph.id,
      actorIdentifier: 'PROVENANCE_TEST_AGENT'
    });

    assert.ok(recorded.id);
    assert.strictEqual(recorded.deceptionDisposition, DECEPTION_DISPOSITIONS.PROPOSE_DECEPTION);
    assert.strictEqual(recorded.originAccessDecision, ORIGIN_ACCESS_DECISIONS.PROPOSE_DIVERT_TO_DECEPTION);
    assert.strictEqual(recorded.policyVersion, testPolicy.version);
    assert.strictEqual(recorded.evaluatorVersion, '5A.1');
    assert.strictEqual(recorded.evidenceReferences.executionEvidenceStatus, 'MISSING');
    assert.ok(recorded.evidenceReferences.policySnapshot);
    assert.ok(recorded.evidenceReferences.selectedStrategySnapshot);
    assert.ok(recorded.evidenceReferences.assessmentSnapshot);

    // Verify audit event
    const auditEvent = await prisma.auditEvent.findFirst({
      where: {
        targetEntityId: recorded.id,
        action: 'POLICY_DECISION_RECORDED'
      }
    });
    assert.ok(auditEvent, 'Audit event must be generated for recorded decision');
  });

  // ---------------------------------------------------------------------------
  // Task 6: Strengthen Policy Priority and Conflict Handling
  // ---------------------------------------------------------------------------

  it('13. Deterministic conflict resolution: Application-specific policy strictly beats tenant-wide policy', () => {
    const appPolicy = {
      id: 'pol-app-01',
      policyIdentifier: 'pol-app-specific',
      name: 'App Specific Policy',
      priority: 50,
      version: 1,
      enabled: true,
      tenantId: tenantApexId,
      applicationId: appApexId
    };

    const tenantPolicy = {
      id: 'pol-tenant-01',
      policyIdentifier: 'pol-tenant-wide',
      name: 'Tenant Wide Policy',
      priority: 10,
      version: 1,
      enabled: true,
      tenantId: tenantApexId,
      applicationId: null
    };

    const resolution = PolicyService.resolvePolicyDeterministically([tenantPolicy, appPolicy], {
      tenantId: tenantApexId,
      applicationId: appApexId
    });

    assert.strictEqual(resolution.policy.id, appPolicy.id);
    assert.match(resolution.conflictResolution.resolutionReason, /Application-specific scope took precedence/);
  });

  it('14. Deterministic conflict resolution: Lower priority number takes precedence within same scope', () => {
    const policyPrio10 = {
      id: 'pol-prio-10',
      policyIdentifier: 'pol-strict-prio-10',
      priority: 10,
      version: 1,
      enabled: true,
      tenantId: tenantApexId,
      applicationId: appApexId
    };

    const policyPrio80 = {
      id: 'pol-prio-80',
      policyIdentifier: 'pol-relaxed-prio-80',
      priority: 80,
      version: 1,
      enabled: true,
      tenantId: tenantApexId,
      applicationId: appApexId
    };

    const resolution = PolicyService.resolvePolicyDeterministically([policyPrio80, policyPrio10], {
      tenantId: tenantApexId,
      applicationId: appApexId
    });

    assert.strictEqual(resolution.policy.id, policyPrio10.id);
    assert.match(resolution.conflictResolution.resolutionReason, /Priority 10 took precedence over 80/);
  });

  it('15. Deterministic conflict resolution: Disabled higher-priority policies are skipped', () => {
    const disabledHighPrio = {
      id: 'pol-disabled-01',
      policyIdentifier: 'pol-disabled-high-prio',
      priority: 5,
      version: 1,
      enabled: false,
      tenantId: tenantApexId,
      applicationId: appApexId
    };

    const activePolicy = {
      id: 'pol-active-01',
      policyIdentifier: 'pol-active-normal-prio',
      priority: 20,
      version: 1,
      enabled: true,
      tenantId: tenantApexId,
      applicationId: appApexId
    };

    const resolution = PolicyService.resolvePolicyDeterministically([disabledHighPrio, activePolicy], {
      tenantId: tenantApexId,
      applicationId: appApexId
    });

    assert.strictEqual(resolution.policy.id, activePolicy.id);
  });

  it('16. Deterministic conflict resolution: Equal priority tie-breaker uses version DESC then alphabetical collation', () => {
    const policyA = {
      id: 'pol-equal-a',
      policyIdentifier: 'pol-alpha-service',
      priority: 50,
      version: 1,
      enabled: true,
      tenantId: tenantApexId,
      applicationId: null
    };

    const policyB = {
      id: 'pol-equal-b',
      policyIdentifier: 'pol-beta-service',
      priority: 50,
      version: 1,
      enabled: true,
      tenantId: tenantApexId,
      applicationId: null
    };

    const resolution = PolicyService.resolvePolicyDeterministically([policyB, policyA], {
      tenantId: tenantApexId
    });

    assert.strictEqual(resolution.policy.policyIdentifier, 'pol-alpha-service');
  });

  // ---------------------------------------------------------------------------
  // Task 7: Security, Tenant Isolation and API Endpoints
  // ---------------------------------------------------------------------------

  it('17. GET /strategies/benchmark returns complete 11-scenario benchmark evaluation', async () => {
    const res = await fetch(`${baseUrl}/tenants/${tenantApexId}/deception/strategies/benchmark`, {
      headers: {
        Cookie: ownerCookie,
        'x-csrf-token': ownerCsrfToken
      }
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.status, 'success');
    assert.strictEqual(body.data.totalScenarios, 11);
    assert.strictEqual(body.data.passedCount, 11);
    assert.strictEqual(body.data.scenarios.length, 11);
  });

  it('18. POST /graphs/:graphId/reassess tests multi-stage strategy transition over API', async () => {
    const res = await fetch(`${baseUrl}/tenants/${tenantApexId}/deception/graphs/${testGraph.id}/reassess`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: ownerCookie,
        'x-csrf-token': ownerCsrfToken
      },
      body: JSON.stringify({
        newStrategyIdentifier: 'strat-credential-canary-token-01',
        activeProposal: {
          proposedState: {
            topologyVersion: 2,
            strategyIdentifier: 'strat-recon-honey-endpoints-01',
            syntheticEnvironmentModel: {
              mockUsers: [{ username: 'synthetic_admin', role: 'SECURITY_AUDITOR_DECOY', status: 'ACTIVE' }],
              mockAuthState: { tokenType: 'CANARY_JWT' },
              mockEndpoints: [{ path: '/debug/pprof', method: 'GET', simulatedStatus: 200 }]
            }
          }
        }
      })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.status, 'success');
    assert.strictEqual(body.data.reassessmentStatus, 'COMPATIBLE_MUTATION');
    assert.strictEqual(body.data.consistent, true);
  });

  it('19. POST /graphs/:graphId/plan rejects stale baseGraphVersion over API with 409 conflict', async () => {
    const res = await fetch(`${baseUrl}/tenants/${tenantApexId}/deception/graphs/${testGraph.id}/plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: ownerCookie,
        'x-csrf-token': ownerCsrfToken
      },
      body: JSON.stringify({
        strategyIdentifier: 'strat-recon-honey-endpoints-01',
        baseGraphVersion: 999
      })
    });

    assert.strictEqual(res.status, 409);
    const body = await res.json();
    assert.strictEqual(body.code, 'MUTATION_PLAN_REJECTED');
    assert.match(body.message, /STALE_GRAPH_VERSION/);
  });

  it('20. Cross-tenant isolation: MedSecure analyst cannot trigger graph planning on Apex graph', async () => {
    const res = await fetch(`${baseUrl}/tenants/${tenantApexId}/deception/graphs/${testGraph.id}/plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: analystCookie, // MedSecure user attempting Apex route
        'x-csrf-token': analystCsrfToken
      },
      body: JSON.stringify({
        strategyIdentifier: 'strat-recon-honey-endpoints-01'
      })
    });

    assert.strictEqual(res.status, 403, 'Cross-tenant request must be rejected with 403 Forbidden');
  });

  it('21. Global Research Invariant: Zero executed transitions and executionEvidenceStatus strictly MISSING', async () => {
    const executedTransitions = await prisma.deceptionGraphTransition.findMany({
      where: { transitionStatus: 'EXECUTED' }
    });
    assert.strictEqual(executedTransitions.length, 0, 'No executed transitions may exist in this milestone');

    const decisions = await prisma.policyDecision.findMany({
      where: { tenantId: tenantApexId, evaluatorVersion: { not: null } },
      take: 20
    });

    assert.ok(decisions.length > 0, 'Must have recorded Stage 5 decisions');
    for (const d of decisions) {
      assert.strictEqual(
        d.evidenceReferences?.executionEvidenceStatus,
        'MISSING',
        `Decision ${d.id} must have executionEvidenceStatus: MISSING`
      );
    }
  });

  it('22. Four-stage strategy selection pipeline: generateCandidates, filterCandidates, rankCandidates, selectStrategy', () => {
    const selector = new StrategySelectionService();
    const assessment = {
      assessmentLabel: 'ATTACK',
      confidenceScore: 0.95,
      dataQualityState: 'COMPLETE',
      sessionCorrelationConfidence: 0.9,
      ruleFindings: [{ ruleId: 'RULE_API_RESOURCE_PROBING', severity: 'HIGH' }]
    };

    // Phase 1: Candidate Generation
    const candidates = selector.generateCandidates({
      strategies: BASELINE_STRATEGIES,
      assessment,
      policy: testPolicy
    });
    assert.strictEqual(candidates.length, BASELINE_STRATEGIES.length);
    assert.ok(candidates.every((c) => typeof c.score === 'number'));

    // Phase 2: Constraint Filtering
    const { eligibleCandidates, rejectedCandidates } = selector.filterCandidates({
      candidates,
      assessment,
      policy: testPolicy
    });
    assert.ok(eligibleCandidates.length > 0);
    assert.ok(rejectedCandidates.length > 0);
    assert.strictEqual(eligibleCandidates.length + rejectedCandidates.length, candidates.length);

    // Phase 3: Deterministic Ranking
    const ranked = selector.rankCandidates({ eligibleCandidates });
    for (let i = 0; i < ranked.length - 1; i++) {
      assert.ok(
        ranked[i].score > ranked[i + 1].score ||
          (ranked[i].score === ranked[i + 1].score &&
            ranked[i].strategyIdentifier.localeCompare(ranked[i + 1].strategyIdentifier) <= 0)
      );
    }

    // Phase 4: Full Selection Output
    const selection = selector.selectStrategy({
      assessment,
      policy: testPolicy
    });
    assert.ok(selection.selectedStrategy);
    assert.strictEqual(selection.selectedStrategy.strategyIdentifier, ranked[0].strategyIdentifier);
    assert.strictEqual(selection.rankingMethod, 'DETERMINISTIC_SCORE_DESC_THEN_IDENTIFIER_ASC');
  });

  it('23. Idempotent replay of identical plan request returns cached proposal without creating duplicate records', async () => {
    const idempotencyKey = `idemp-test-${Date.now()}`;
    const payload = {
      strategyIdentifier: 'strat-recon-honey-endpoints-01',
      idempotencyKey,
      baseGraphVersion: testGraph.graphVersion
    };

    // First request
    const res1 = await fetch(`${baseUrl}/tenants/${tenantApexId}/deception/graphs/${testGraph.id}/plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: ownerCookie,
        'x-csrf-token': ownerCsrfToken
      },
      body: JSON.stringify(payload)
    });
    assert.strictEqual(res1.status, 200);
    const body1 = await res1.json();
    assert.strictEqual(body1.status, 'success');

    // Second request with exact same payload and idempotency key
    const res2 = await fetch(`${baseUrl}/tenants/${tenantApexId}/deception/graphs/${testGraph.id}/plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: ownerCookie,
        'x-csrf-token': ownerCsrfToken
      },
      body: JSON.stringify(payload)
    });
    assert.strictEqual(res2.status, 200);
    const body2 = await res2.json();
    assert.strictEqual(body2.status, 'success');
    assert.strictEqual(body2.data.idempotentReplay, true);

    // Check database to ensure no duplicate transition was created
    const transitions = await prisma.deceptionGraphTransition.findMany({
      where: { tenantId: tenantApexId, idempotencyKey }
    });
    assert.strictEqual(transitions.length, 1, 'Only one transition record must exist for the idempotency key');
  });

  it('24. Reusing idempotency key with conflicting payload returns 409 IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH', async () => {
    const idempotencyKey = `idemp-conflict-${Date.now()}`;
    const initialPayload = {
      strategyIdentifier: 'strat-recon-honey-endpoints-01',
      idempotencyKey,
      baseGraphVersion: testGraph.graphVersion
    };

    // First request
    const res1 = await fetch(`${baseUrl}/tenants/${tenantApexId}/deception/graphs/${testGraph.id}/plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: ownerCookie,
        'x-csrf-token': ownerCsrfToken
      },
      body: JSON.stringify(initialPayload)
    });
    assert.strictEqual(res1.status, 200);

    // Second request with SAME idempotency key but DIFFERENT payload (different strategy)
    const conflictingPayload = {
      strategyIdentifier: 'strat-api-shadow-facade-01',
      idempotencyKey,
      baseGraphVersion: testGraph.graphVersion
    };

    const res2 = await fetch(`${baseUrl}/tenants/${tenantApexId}/deception/graphs/${testGraph.id}/plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: ownerCookie,
        'x-csrf-token': ownerCsrfToken
      },
      body: JSON.stringify(conflictingPayload)
    });

    assert.strictEqual(res2.status, 409);
    const body2 = await res2.json();
    assert.strictEqual(body2.code, 'IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH');
    assert.match(body2.message, /mismatched request payload/i);
  });

  it('25. Multi-stage attack progression (Recon -> Auth -> Data Exfil) and rejection of conflicting 4th stage', () => {
    const planner = new DSGPlannerService();

    // Stage 1: API Reconnaissance -> API_DECEPTION proposal
    const reconStrategy = BASELINE_STRATEGIES.find((s) => s.strategyIdentifier === 'strat-api-shadow-facade-01');
    const stage1Plan = planner.planMutation({
      currentGraph: testGraph,
      strategy: reconStrategy,
      policy: testPolicy,
      tenantId: tenantApexId
    });
    assert.strictEqual(stage1Plan.status, TRANSITION_STATUSES.PROPOSED);

    // Stage 2: Attacker progresses to Auth Probing -> CREDENTIAL_DECEPTION
    const credStrategy = BASELINE_STRATEGIES.find((s) => s.strategyIdentifier === 'strat-credential-canary-token-01');
    const stage2Reassessment = planner.reassessStrategy({
      currentGraph: testGraph,
      activeProposal: stage1Plan,
      newStrategy: credStrategy,
      policy: testPolicy,
      tenantId: tenantApexId
    });
    assert.strictEqual(stage2Reassessment.consistent, true);
    assert.strictEqual(stage2Reassessment.reassessmentStatus, 'COMPATIBLE_MUTATION');

    // Stage 3: Attacker attempts Data Exfiltration -> DATA_ACCESS_DECEPTION
    const dataStrategy = BASELINE_STRATEGIES.find((s) => s.strategyIdentifier === 'strat-data-honey-records-01');
    const stage3Reassessment = planner.reassessStrategy({
      currentGraph: testGraph,
      activeProposal: stage2Reassessment.mergedPlan,
      newStrategy: dataStrategy,
      policy: testPolicy,
      tenantId: tenantApexId
    });
    assert.strictEqual(stage3Reassessment.consistent, true);
    assert.strictEqual(stage3Reassessment.reassessmentStatus, 'COMPATIBLE_MUTATION');
    assert.strictEqual(stage3Reassessment.mergedPlan.status, TRANSITION_STATUSES.PROPOSED);

    // Stage 4: Incompatible mutant attempting colliding routes and broken isolation
    const incompatibleStage4 = {
      strategyIdentifier: 'strat-conflict-stage4',
      strategyType: 'SERVICE_INTERACTION_DECEPTION',
      dsgBlueprint: { nodes: [], edges: [] },
      isolationRequirements: { strictNamespaceIsolation: true, noOutboundEgress: false },
      permittedStateChangeProposal: {
        routes: [{ path: '/api/v1/auth/login', method: 'POST', simulatedStatus: 500 }]
      }
    };
    const stage4Reassessment = planner.reassessStrategy({
      currentGraph: testGraph,
      activeProposal: stage3Reassessment.mergedPlan,
      newStrategy: incompatibleStage4,
      tenantId: tenantApexId
    });
    assert.strictEqual(stage4Reassessment.consistent, false);
    assert.strictEqual(stage4Reassessment.reassessmentStatus, 'INCONSISTENT_SYNTHETIC_STATE');
    assert.match(stage4Reassessment.rejectionReason, /INCONSISTENT_SYNTHETIC_STATE/);
  });
});
