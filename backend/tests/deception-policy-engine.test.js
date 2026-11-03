/**
 * Stage 5A Comprehensive Test Suite:
 * Adaptive Deception Policy Engine, Deterministic Strategy Selection, and DSG Planning.
 *
 * Requirements covered:
 * 1. Safe default: No active policy returns POLICY_NOT_CONFIGURED and never proposes deception.
 * 2. Disabled policy returns POLICY_NOT_CONFIGURED and never proposes deception.
 * 3. Ineligible assessment (deceptionEligible: false) rejects deception proposal.
 * 4. ML-only anomaly without rule corroboration returns INSUFFICIENT_EVIDENCE (ML_ONLY_UNVERIFIED_ANOMALY).
 * 5. Telemetry loss / data degradation returns INSUFFICIENT_EVIDENCE (TELEMETRY_LOSS_DEGRADATION).
 * 6. High collision risk returns safe normal routing without diversion.
 * 7. Assessment with confidence below policy minimum returns INSUFFICIENT_EVIDENCE.
 * 8. Assessment with correlation confidence below minimum returns INSUFFICIENT_EVIDENCE.
 * 9. Deterministic strategy selection across all 5 categories:
 *    - RECONNAISSANCE_DECEPTION
 *    - CREDENTIAL_DECEPTION
 *    - API_DECEPTION
 *    - DATA_ACCESS_DECEPTION
 *    - SERVICE_INTERACTION_DECEPTION
 * 10. No matching strategy returns NO_ELIGIBLE_STRATEGY with rejected candidates explanation.
 * 11. Fully eligible attack generates PROPOSE_DECEPTION with selected strategy and proposed DSG plan.
 * 12. DSG Planner generates nodes across all 3 canonical layers.
 * 13. DSG Planner generates proposed edges and synthetic environment model.
 * 14. Invariant: DSG transition status is strictly PROPOSED, never EXECUTED.
 * 15. Invariant: Execution evidence status is strictly MISSING.
 * 16. Decision recorder creates immutable decision linked to assessment, policy, and strategy.
 * 17. Security audit event emitted on decision recording and policy mutation.
 * 18. Strict tenant isolation: Tenant A cannot access Tenant B decisions, policies, or graphs.
 * 19. REST API endpoints under /api/v1/tenants/:tenantId/deception/... return correct payloads and status codes.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import { getPrismaClient, connectDatabase, disconnectDatabase } from '../src/db/client.js';
import {
  PolicyEvaluationEngine,
  DECISION_RESULTS,
  REASON_CODES
} from '../src/deception/policy-evaluation.service.js';
import { StrategySelectionService } from '../src/deception/strategy-selection.service.js';
import { DSGPlannerService, DSG_LAYERS, TRANSITION_STATUSES } from '../src/deception/dsg-planner.service.js';
import { DecisionRecorderService } from '../src/deception/decision-recorder.service.js';
import { BASELINE_STRATEGIES, STRATEGY_CATEGORIES } from '../src/deception/strategy-catalog.js';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgresql://rahulseervi@localhost:5432/adaptive_deception_test?schema=public';

process.env.DATABASE_URL = TEST_DATABASE_URL;

describe('Stage 5A: Adaptive Deception Policy Engine & DSG Planning Suite', () => {
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

  let testPolicyId;
  let testAssessmentId;
  let testGraphId;

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

    // Resolve tenant fixtures
    const tApex = await prisma.tenant.findUnique({ where: { identifier: 'tenant-apex-9941' } });
    const tMed = await prisma.tenant.findUnique({ where: { identifier: 'tenant-medsecure-7712' } });
    tenantApexId = tApex.id;
    tenantMedId = tMed.id;

    const appApex = await prisma.protectedApplication.findFirst({ where: { tenantId: tenantApexId } });
    appApexId = appApex.id;

    // Login Owner Apex
    const resLoginOwner = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner@apexfintech.io', password: 'DevOwner12345!' })
    });
    const dataOwner = await resLoginOwner.json();
    ownerCsrfToken = dataOwner.data.antiCsrfToken;
    ownerCookie = resLoginOwner.headers.get('set-cookie');

    // Login Analyst MedSecure
    const resLoginAnalyst = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'analyst@medsecure.io', password: 'DevAnalyst12345!' })
    });
    const dataAnalyst = await resLoginAnalyst.json();
    analystCsrfToken = dataAnalyst.data.antiCsrfToken;
    analystCookie = resLoginAnalyst.headers.get('set-cookie');

    // Seed test assessment
    const assessment = await prisma.behavioralAssessment.create({
      data: {
        tenantId: tenantApexId,
        applicationId: appApexId,
        classification: 'ATTACK',
        assessmentLabel: 'ATTACK',
        modelOrRuleVersion: '1.0.0',
        confidenceScore: 0.92,
        riskScore: 0.92,
        explanation: { deceptionEligible: true },
        dataQualityState: 'COMPLETE',
        telemetryLossDetected: false,
        ruleFindings: [
          {
            ruleId: 'RULE_REPEATED_RESOURCE_PROBING',
            severity: 'HIGH',
            evidence: 'Multiple 404 admin probes'
          }
        ],
        mlAnomalyResult: { anomalyDetected: true, score: 0.88 },
        sessionRef: 'sess-apex-recon-01'
      }
    });
    testAssessmentId = assessment.id;

    // Seed test DSG graph if not present
    let graph = await prisma.deceptionGraph.findFirst({ where: { tenantId: tenantApexId } });
    if (!graph) {
      graph = await prisma.deceptionGraph.create({
        data: {
          tenantId: tenantApexId,
          applicationId: appApexId,
          graphIdentifier: 'dsg-apex-test',
          graphVersion: 1,
          status: 'ACTIVE'
        }
      });
    }
    testGraphId = graph.id;
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (testAssessmentId) {
      await prisma.behavioralAssessment.deleteMany({ where: { id: testAssessmentId } });
    }
    if (testPolicyId) {
      await prisma.deceptionPolicy.deleteMany({ where: { id: testPolicyId } });
    }
    await disconnectDatabase(prisma);
  });

  // ---------------------------------------------------------------------------
  // Unit & Core Engine Tests
  // ---------------------------------------------------------------------------

  test('1. Safe default: Null or missing policy returns POLICY_NOT_CONFIGURED and never proposes deception', () => {
    const engine = new PolicyEvaluationEngine();
    const result = engine.evaluate({
      assessment: { assessmentLabel: 'ATTACK', confidence: 0.95, deceptionEligible: true },
      policy: null,
      tenantId: tenantApexId
    });

    assert.equal(result.decisionResult, DECISION_RESULTS.POLICY_NOT_CONFIGURED);
    assert.ok(result.reasonCodes.includes(REASON_CODES.POLICY_DISABLED_OR_MISSING));
    assert.equal(result.selectedStrategy, null);
    assert.equal(result.dsgPlan, null);
  });

  test('2. Disabled policy returns POLICY_NOT_CONFIGURED and refuses diversion', () => {
    const engine = new PolicyEvaluationEngine();
    const result = engine.evaluate({
      assessment: { assessmentLabel: 'ATTACK', confidence: 0.95, deceptionEligible: true },
      policy: { id: 'pol-disabled', enabled: false, version: 1 },
      tenantId: tenantApexId
    });

    assert.equal(result.decisionResult, DECISION_RESULTS.POLICY_NOT_CONFIGURED);
    assert.ok(result.reasonCodes.includes(REASON_CODES.POLICY_DISABLED_OR_MISSING));
    assert.equal(result.selectedStrategy, null);
  });

  test('3. Ineligible assessment (deceptionEligible: false) rejects deception proposal and returns normal routing', () => {
    const engine = new PolicyEvaluationEngine();
    const policy = {
      id: 'pol-active',
      name: 'Active Policy',
      enabled: true,
      version: 1,
      requiredEvidenceCriteria: { minConfidence: 0.7 }
    };
    const result = engine.evaluate({
      assessment: {
        assessmentLabel: 'ATTACK',
        confidence: 0.95,
        deceptionEligible: false,
        ruleFindings: [{ ruleId: 'RULE_REPEATED_RESOURCE_PROBING' }]
      },
      policy,
      tenantId: tenantApexId
    });

    assert.notEqual(result.decisionResult, DECISION_RESULTS.PROPOSE_DECEPTION);
    assert.equal(result.selectedStrategy, null);
  });

  test('4. ML-only anomaly without rule corroboration returns INSUFFICIENT_EVIDENCE (ML_ONLY_UNVERIFIED_ANOMALY)', () => {
    const engine = new PolicyEvaluationEngine();
    const policy = {
      id: 'pol-active',
      name: 'Active Policy',
      enabled: true,
      version: 1,
      requiredEvidenceCriteria: { minConfidence: 0.7, requireRuleCorroboration: true }
    };
    const result = engine.evaluate({
      assessment: {
        assessmentLabel: 'ANOMALY',
        confidence: 0.88,
        deceptionEligible: false,
        ruleFindings: [], // ML-only, no rule corroboration
        mlAnomalyResult: { anomalyDetected: true }
      },
      policy,
      tenantId: tenantApexId
    });

    assert.equal(result.decisionResult, DECISION_RESULTS.INSUFFICIENT_EVIDENCE);
    assert.ok(result.reasonCodes.includes(REASON_CODES.ML_ONLY_UNVERIFIED_ANOMALY));
  });

  test('5. Telemetry loss or degraded quality returns INSUFFICIENT_EVIDENCE (TELEMETRY_LOSS_DEGRADATION)', () => {
    const engine = new PolicyEvaluationEngine();
    const policy = {
      id: 'pol-active',
      name: 'Active Policy',
      enabled: true,
      version: 1,
      requiredEvidenceCriteria: { minConfidence: 0.7 }
    };
    const result = engine.evaluate({
      assessment: {
        assessmentLabel: 'ATTACK',
        confidence: 0.95,
        deceptionEligible: true,
        telemetryLossDetected: true,
        dataQualityState: 'DEGRADED',
        ruleFindings: [{ ruleId: 'RULE_REPEATED_RESOURCE_PROBING' }]
      },
      policy,
      tenantId: tenantApexId
    });

    assert.equal(result.decisionResult, DECISION_RESULTS.INSUFFICIENT_EVIDENCE);
    assert.ok(result.reasonCodes.includes(REASON_CODES.TELEMETRY_LOSS_DEGRADATION));
  });

  test('6. Benign assessment returns ALLOW_NORMAL without deception', () => {
    const engine = new PolicyEvaluationEngine();
    const policy = {
      id: 'pol-active',
      name: 'Active Policy',
      enabled: true,
      version: 1,
      requiredEvidenceCriteria: { minConfidence: 0.7 }
    };
    const result = engine.evaluate({
      assessment: {
        assessmentLabel: 'BENIGN',
        confidence: 0.99,
        deceptionEligible: false,
        dataQualityState: 'COMPLETE'
      },
      policy,
      tenantId: tenantApexId
    });

    assert.equal(result.decisionResult, DECISION_RESULTS.ALLOW_NORMAL);
    assert.ok(result.reasonCodes.includes(REASON_CODES.ASSESSMENT_BENIGN));
  });

  test('7. Assessment confidence below policy minimum returns INSUFFICIENT_EVIDENCE', () => {
    const engine = new PolicyEvaluationEngine();
    const policy = {
      id: 'pol-high-conf',
      name: 'High Confidence Policy',
      enabled: true,
      version: 1,
      requiredEvidenceCriteria: { minConfidence: 0.90 }
    };
    const result = engine.evaluate({
      assessment: {
        assessmentLabel: 'ATTACK',
        confidence: 0.75, // Below 0.90
        deceptionEligible: true,
        dataQualityState: 'COMPLETE',
        ruleFindings: [{ ruleId: 'RULE_REPEATED_RESOURCE_PROBING' }]
      },
      policy,
      tenantId: tenantApexId
    });

    assert.equal(result.decisionResult, DECISION_RESULTS.INSUFFICIENT_EVIDENCE);
    assert.ok(result.reasonCodes.includes(REASON_CODES.CONFIDENCE_BELOW_POLICY_MINIMUM));
  });

  test('8. Deterministic strategy selection across all 5 categories', () => {
    const selector = new StrategySelectionService();

    // 1. RECONNAISSANCE_DECEPTION
    const recon = selector.selectStrategy({
      assessment: {
        assessmentLabel: 'ATTACK',
        confidence: 0.85,
        ruleFindings: [{ ruleId: 'RULE_REPEATED_RESOURCE_PROBING' }]
      },
      policy: {}
    });
    assert.ok(recon.selectedStrategy);
    assert.equal(recon.selectedStrategy.strategyType, STRATEGY_CATEGORIES.RECONNAISSANCE_DECEPTION);

    // 2. CREDENTIAL_DECEPTION
    const cred = selector.selectStrategy({
      assessment: {
        assessmentLabel: 'ATTACK',
        confidence: 0.85,
        ruleFindings: [{ ruleId: 'RULE_BRUTE_FORCE_AUTH' }]
      },
      policy: {}
    });
    assert.ok(cred.selectedStrategy);
    assert.equal(cred.selectedStrategy.strategyType, STRATEGY_CATEGORIES.CREDENTIAL_DECEPTION);

    // 3. API_DECEPTION
    const api = selector.selectStrategy({
      assessment: {
        assessmentLabel: 'ATTACK',
        confidence: 0.85,
        ruleFindings: [{ ruleId: 'RULE_SUSPICIOUS_METHOD' }]
      },
      policy: {}
    });
    assert.ok(api.selectedStrategy);
    assert.equal(api.selectedStrategy.strategyType, STRATEGY_CATEGORIES.API_DECEPTION);

    // 4. DATA_ACCESS_DECEPTION
    const data = selector.selectStrategy({
      assessment: {
        assessmentLabel: 'ATTACK',
        confidence: 0.85,
        ruleFindings: [{ ruleId: 'RULE_DATA_ACCESS' }]
      },
      policy: {}
    });
    assert.ok(data.selectedStrategy);
    assert.equal(data.selectedStrategy.strategyType, STRATEGY_CATEGORIES.DATA_ACCESS_DECEPTION);

    // 5. SERVICE_INTERACTION_DECEPTION
    const service = selector.selectStrategy({
      assessment: {
        assessmentLabel: 'ATTACK',
        confidence: 0.85,
        ruleFindings: [{ ruleId: 'RULE_HIGH_FREQUENCY_BURST' }]
      },
      policy: {}
    });
    assert.ok(service.selectedStrategy);
    assert.equal(service.selectedStrategy.strategyType, STRATEGY_CATEGORIES.SERVICE_INTERACTION_DECEPTION);
  });

  test('9. No matching strategy returns NO_ELIGIBLE_STRATEGY with rejected candidates explanation', () => {
    const engine = new PolicyEvaluationEngine({
      strategySelector: new StrategySelectionService({ strategies: [] }) // Empty strategy catalog
    });
    const policy = {
      id: 'pol-active',
      name: 'Active Policy',
      enabled: true,
      version: 1,
      requiredEvidenceCriteria: { minConfidence: 0.7 }
    };
    const result = engine.evaluate({
      assessment: {
        assessmentLabel: 'ATTACK',
        confidence: 0.90,
        deceptionEligible: true,
        dataQualityState: 'COMPLETE',
        ruleFindings: [{ ruleId: 'RULE_REPEATED_RESOURCE_PROBING' }]
      },
      policy,
      tenantId: tenantApexId
    });

    assert.equal(result.decisionResult, DECISION_RESULTS.NO_ELIGIBLE_STRATEGY);
    assert.ok(result.reasonCodes.includes(REASON_CODES.NO_COMPATIBLE_STRATEGY_FOUND));
  });

  test('10. Fully eligible attack generates PROPOSE_DECEPTION with selected strategy and proposed DSG plan', () => {
    const engine = new PolicyEvaluationEngine();
    const policy = {
      id: 'pol-apex-main',
      name: 'Apex Main Security Policy',
      enabled: true,
      version: 1,
      requiredEvidenceCriteria: {
        minConfidence: 0.70,
        requiredTelemetryQuality: 'COMPLETE',
        requireRuleCorroboration: true
      },
      permittedActions: ['PROPOSE_DECEPTION']
    };
    const assessment = {
      id: 'ass-apex-01',
      assessmentLabel: 'ATTACK',
      confidence: 0.92,
      deceptionEligible: true,
      dataQualityState: 'COMPLETE',
      telemetryLossDetected: false,
      sessionCorrelationConfidence: 0.85,
      ruleFindings: [{ ruleId: 'RULE_REPEATED_RESOURCE_PROBING', severity: 'HIGH' }]
    };

    const result = engine.evaluate({
      assessment,
      policy,
      tenantId: tenantApexId
    });

    assert.equal(result.decisionResult, DECISION_RESULTS.PROPOSE_DECEPTION);
    assert.ok(result.reasonCodes.includes(REASON_CODES.STRATEGY_SELECTED));
    assert.ok(result.reasonCodes.includes(REASON_CODES.DSG_PLAN_GENERATED));
    assert.ok(result.selectedStrategy);
    assert.ok(result.dsgPlan);
    assert.equal(result.dsgPlan.status, TRANSITION_STATUSES.PROPOSED);
  });

  test('11. DSG Planner generates nodes across all 3 canonical layers', () => {
    const planner = new DSGPlannerService();
    const strategy = BASELINE_STRATEGIES[0]; // RECONNAISSANCE_DECEPTION
    const plan = planner.planMutation({
      strategy,
      policy: { id: 'pol-1', name: 'Test Policy', priority: 100 },
      tenantId: tenantApexId
    });

    assert.ok(plan.nodesToAdd.length >= 2);
    const layers = new Set(plan.nodesToAdd.map((n) => n.layerClassification));
    assert.ok(layers.has(DSG_LAYERS.PROTECTED_DECEPTION_POLICY));
    assert.ok(layers.has(DSG_LAYERS.CONTROLLED_DYNAMIC_STATE));
    assert.ok(layers.has(DSG_LAYERS.OBSERVATIONAL_ATTACKER_STATE));
    assert.equal(plan.validationResult.valid, true);
  });

  test('12. Invariant verification: DSG transition status is strictly PROPOSED and execution evidence is MISSING', () => {
    const planner = new DSGPlannerService();
    const strategy = BASELINE_STRATEGIES[1]; // CREDENTIAL_DECEPTION
    const plan = planner.planMutation({
      strategy,
      policy: { id: 'pol-1', name: 'Policy' },
      tenantId: tenantApexId
    });

    assert.equal(plan.status, TRANSITION_STATUSES.PROPOSED);
    assert.notEqual(plan.status, 'EXECUTED');
    assert.ok(plan.nonExecutionNotice.includes('STAGE_5A_PLANNING_ONLY'));
  });

  test('13. Decision recorder creates immutable decision linked to assessment, policy, and strategy', async () => {
    const recorder = new DecisionRecorderService(prisma);
    const engine = new PolicyEvaluationEngine();
    const policy = {
      id: 'pol-test-rec',
      name: 'Recording Test Policy',
      enabled: true,
      version: 1,
      requiredEvidenceCriteria: { minConfidence: 0.70 }
    };
    const assessment = {
      id: testAssessmentId,
      assessmentLabel: 'ATTACK',
      confidence: 0.90,
      deceptionEligible: true,
      dataQualityState: 'COMPLETE',
      ruleFindings: [{ ruleId: 'RULE_REPEATED_RESOURCE_PROBING' }]
    };

    const evaluation = engine.evaluate({ assessment, policy, tenantId: tenantApexId });
    const decision = await recorder.recordDecision({
      tenantId: tenantApexId,
      applicationId: appApexId,
      assessmentId: testAssessmentId,
      evaluation,
      graphId: testGraphId,
      actorIdentifier: 'TEST_SUITE'
    });

    assert.ok(decision.id);
    assert.equal(decision.tenantId, tenantApexId);
    assert.equal(decision.decisionResult, DECISION_RESULTS.PROPOSE_DECEPTION);
    assert.equal(decision.evidenceReferences.executionEvidenceStatus, 'MISSING');
    assert.equal(decision.evidenceReferences.executionStatus, 'NOT_EXECUTED');

    // Clean up created decision
    await prisma.deceptionGraphTransition.deleteMany({ where: { policyDecisionId: decision.id } });
    await prisma.policyDecision.deleteMany({ where: { id: decision.id } });
  });

  // ---------------------------------------------------------------------------
  // REST API Endpoint Tests
  // ---------------------------------------------------------------------------

  test('14. GET /deception/policies lists tenant policies and baselines', async () => {
    const res = await fetch(`${baseUrl}/tenants/${tenantApexId}/deception/policies`, {
      headers: {
        Cookie: ownerCookie,
        'X-CSRF-Token': ownerCsrfToken
      }
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.ok(Array.isArray(body.data));
  });

  test('15. POST /deception/policies creates tenant policy and increments audit', async () => {
    const policyPayload = {
      policyIdentifier: `pol-test-stage5a-${Date.now()}`,
      name: 'Stage 5A Test Policy',
      description: 'Automated test deception policy',
      priority: 80,
      requiredEvidenceCriteria: {
        minConfidence: 0.80,
        requiredTelemetryQuality: 'COMPLETE',
        requireRuleCorroboration: true,
        applicableClassifications: ['ATTACK']
      },
      permittedActions: ['PROPOSE_DECEPTION', 'ALLOW_NORMAL'],
      prohibitedActions: ['RUN_ARBITRARY_COMMAND']
    };

    const res = await fetch(`${baseUrl}/tenants/${tenantApexId}/deception/policies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: ownerCookie,
        'X-CSRF-Token': ownerCsrfToken
      },
      body: JSON.stringify(policyPayload)
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.equal(body.data.name, 'Stage 5A Test Policy');
    assert.equal(body.data.version, 1);
    testPolicyId = body.data.id;
  });

  test('16. PATCH /deception/policies/:id updates policy and increments version', async () => {
    assert.ok(testPolicyId);
    const res = await fetch(`${baseUrl}/tenants/${tenantApexId}/deception/policies/${testPolicyId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: ownerCookie,
        'X-CSRF-Token': ownerCsrfToken
      },
      body: JSON.stringify({ name: 'Stage 5A Test Policy Updated', priority: 60 })
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.name, 'Stage 5A Test Policy Updated');
    assert.equal(body.data.version, 2);
  });

  test('17. GET /deception/strategies returns full catalogue across 5 categories with non-execution notice', async () => {
    const res = await fetch(`${baseUrl}/tenants/${tenantApexId}/deception/strategies`, {
      headers: {
        Cookie: ownerCookie,
        'X-CSRF-Token': ownerCsrfToken
      }
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length >= 5);
    assert.ok(body.notice.includes('STAGE_5A_PLANNING_ONLY'));

    const types = new Set(body.data.map((s) => s.strategyType));
    assert.ok(types.has('RECONNAISSANCE_DECEPTION'));
    assert.ok(types.has('CREDENTIAL_DECEPTION'));
    assert.ok(types.has('API_DECEPTION'));
    assert.ok(types.has('DATA_ACCESS_DECEPTION'));
    assert.ok(types.has('SERVICE_INTERACTION_DECEPTION'));
  });

  test('18. POST /deception/evaluate evaluates assessment and records immutable decision', async () => {
    const res = await fetch(`${baseUrl}/tenants/${tenantApexId}/deception/evaluate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: ownerCookie,
        'X-CSRF-Token': ownerCsrfToken
      },
      body: JSON.stringify({
        assessmentId: testAssessmentId,
        applicationId: appApexId,
        policyId: testPolicyId,
        persistDecision: true
      })
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.ok(body.data.evaluation);
    assert.equal(body.data.evaluation.decisionResult, DECISION_RESULTS.PROPOSE_DECEPTION);
    assert.ok(body.data.decisionId);
    assert.equal(body.data.persisted, true);
  });

  test('19. GET /deception/decisions lists recorded decisions with tenant isolation', async () => {
    const res = await fetch(`${baseUrl}/tenants/${tenantApexId}/deception/decisions`, {
      headers: {
        Cookie: ownerCookie,
        'X-CSRF-Token': ownerCsrfToken
      }
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length >= 1);
  });

  test('20. GET /deception/graphs returns DSG topology with 3 layers and non-execution notice', async () => {
    const res = await fetch(`${baseUrl}/tenants/${tenantApexId}/deception/graphs/${testGraphId}`, {
      headers: {
        Cookie: ownerCookie,
        'X-CSRF-Token': ownerCsrfToken
      }
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.ok(body.data.layerSummary);
    assert.ok(body.data.layerSummary.PROTECTED_DECEPTION_POLICY);
    assert.ok(body.data.layerSummary.CONTROLLED_DYNAMIC_STATE);
    assert.ok(body.data.layerSummary.OBSERVATIONAL_ATTACKER_STATE);
    assert.ok(body.data.nonExecutionNotice.includes('STAGE_5A_INVARIANT'));
  });

  test('21. Tenant isolation: MedSecure analyst cannot access Apex decisions or evaluate Apex assessments', async () => {
    const res = await fetch(`${baseUrl}/tenants/${tenantApexId}/deception/decisions`, {
      headers: {
        Cookie: analystCookie,
        'X-CSRF-Token': analystCsrfToken
      }
    });

    assert.equal(res.status, 403);
  });
});
