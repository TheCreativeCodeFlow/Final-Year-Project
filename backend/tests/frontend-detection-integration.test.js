/**
 * Stage 4D: Detection Operations Dashboard and Model Lifecycle Integration Test Suite.
 *
 * Verifies frontend-backend detection integration:
 * 1. Tenant switching and tenant isolation (no cross-tenant leakage).
 * 2. Unauthorized access handling (401 unauthenticated, 403 cross-tenant).
 * 3. Assessment listing, detail querying, and evidence parsing.
 * 4. Missing telemetry handling (INSUFFICIENT_EVIDENCE, deceptionEligible: false).
 * 5. ML-only anomaly guardrails (deceptionEligible: false without rule corroboration).
 * 6. Deception-ineligible assessments (collision risk, low correlation confidence).
 * 7. Degraded telemetry accounting in benchmark evaluation.
 * 8. Model lifecycle states and status integrity (never report unavailable model as ACTIVE).
 * 9. Insufficient training data handling (HTTP 422 rejection with required conditions).
 * 10. Research benchmark accounting invariants (TP+FN=7, FP+TN=4 on held-out test partition).
 * 11. Separation of concerns: executionEvidenceStatus is strictly MISSING (no autonomous diversion).
 */

import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import { getPrismaClient, connectDatabase, disconnectDatabase } from '../src/db/client.js';
import {
  apiClient,
  setApiBaseUrl,
  setCsrfToken,
  setNodeSessionCookie,
  ApiError
} from '../../src/services/apiClient.js';
import { authService, ROLES } from '../../src/services/authService.js';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgresql://rahulseervi@localhost:5432/adaptive_deception_test?schema=public';

process.env.DATABASE_URL = TEST_DATABASE_URL;

describe('Stage 4D: Frontend Detection Operations & Model Lifecycle Integration', () => {
  let app;
  let server;
  let baseUrl;
  let prisma;

  let tenantApexId;
  let tenantMedId;
  let appApexId;

  let testAssessmentIds = [];
  let testModelVersionId;

  let highRuleAssessmentId;
  let degradedAssessmentId;
  let mlOnlyAssessmentId;

  before(async () => {
    const config = loadEnv();
    prisma = getPrismaClient();
    await connectDatabase(prisma);

    app = createApp({ envConfig: config, prisma });
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => resolve());
    });
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}/api/v1`;
    setApiBaseUrl(baseUrl);

    // Resolve existing seeded tenants
    const tApex = await prisma.tenant.findUnique({ where: { identifier: 'tenant-apex-9941' } });
    const tMed = await prisma.tenant.findUnique({ where: { identifier: 'tenant-medsecure-7712' } });
    tenantApexId = tApex.id;
    tenantMedId = tMed.id;

    const appApex = await prisma.protectedApplication.findFirst({ where: { tenantId: tenantApexId } });
    appApexId = appApex.id;

    // Seed test assessments under Apex
    // Case A: High-severity rule corroborated attack -> deceptionEligible: true
    const asm1 = await prisma.behavioralAssessment.create({
      data: {
        tenantId: tenantApexId,
        applicationId: appApexId,
        sessionRef: 'sess-apex-corroborated-01',
        windowLabel: '5m',
        assessmentLabel: 'HIGHLY_SUSPICIOUS',
        classification: 'CREDENTIAL_STUFFING',
        riskScore: 0.98,
        confidenceScore: 0.92,
        modelOrRuleVersion: 'hybrid-strategy-d',
        ruleFindings: [
          { ruleId: 'RULE_AUTH_FAILURE', severity: 'CRITICAL', triggered: true, explanation: '15 failed logins in 300ms' }
        ],
        mlAnomalyResult: {
          algorithm: 'ISOLATION_FOREST',
          modelStatus: 'READY',
          anomalyScore: 0.9450,
          decisionThreshold: 0.60,
          isAnomaly: true
        },
        explanation: {
          text: 'HIGHLY_SUSPICIOUS: CREDENTIAL_STUFFING',
          deceptionEligible: true,
          executionEvidenceStatus: 'MISSING'
        },
        dataQualityState: 'COMPLETE',
        telemetryLossDetected: false
      }
    });
    highRuleAssessmentId = asm1.id;
    testAssessmentIds.push(asm1.id);

    // Case B: Degraded Telemetry -> INSUFFICIENT_EVIDENCE -> deceptionEligible: false
    const asmDegraded = await prisma.behavioralAssessment.create({
      data: {
        tenantId: tenantApexId,
        applicationId: appApexId,
        sessionRef: 'sess-apex-degraded-02',
        windowLabel: '5m',
        assessmentLabel: 'INSUFFICIENT_EVIDENCE',
        classification: 'UNVERIFIED_INCOMPLETE_TELEMETRY',
        riskScore: 0.0,
        confidenceScore: 0.35,
        modelOrRuleVersion: 'hybrid-strategy-d',
        ruleFindings: [
          { ruleId: 'RULE_REQUEST_BURST', missingFeatures: ['burst_frequency_max_1s'], triggered: false }
        ],
        mlAnomalyResult: {
          algorithm: 'ISOLATION_FOREST',
          anomalyScore: 0.5400,
          isAnomaly: false
        },
        explanation: {
          text: 'INSUFFICIENT_EVIDENCE: Telemetry buffer drop during session',
          deceptionEligible: false,
          executionEvidenceStatus: 'MISSING'
        },
        dataQualityState: 'PARTIAL',
        telemetryLossDetected: true
      }
    });
    degradedAssessmentId = asmDegraded.id;
    testAssessmentIds.push(asmDegraded.id);

    // Case C: ML-only Anomaly without Rule Corroboration -> deceptionEligible: false
    const asmMLOnly = await prisma.behavioralAssessment.create({
      data: {
        tenantId: tenantApexId,
        applicationId: appApexId,
        sessionRef: 'sess-apex-ml-only-03',
        windowLabel: '5m',
        assessmentLabel: 'SUSPICIOUS',
        classification: 'UNSUPERVISED_BEHAVIORAL_ANOMALY',
        riskScore: 0.68,
        confidenceScore: 0.85,
        modelOrRuleVersion: 'hybrid-strategy-d',
        ruleFindings: [], // Zero rules triggered
        mlAnomalyResult: {
          algorithm: 'ISOLATION_FOREST',
          modelStatus: 'READY',
          anomalyScore: 0.8650,
          decisionThreshold: 0.60,
          isAnomaly: true
        },
        explanation: {
          text: 'SUSPICIOUS: Unsupervised behavioral anomaly without rule violation',
          deceptionEligible: false,
          executionEvidenceStatus: 'MISSING'
        },
        dataQualityState: 'COMPLETE',
        telemetryLossDetected: false
      }
    });
    mlOnlyAssessmentId = asmMLOnly.id;
    testAssessmentIds.push(asmMLOnly.id);

    // Seed test model version for Apex
    const testModel = await prisma.detectionModelVersion.create({
      data: {
        tenantId: tenantApexId,
        applicationId: appApexId,
        modelIdentifier: 'model-iforest-apex-test-v1',
        version: 99,
        algorithm: 'ISOLATION_FOREST',
        status: 'READY',
        hyperparameters: { numTrees: 50, sampleSize: 64 },
        modelArtifact: { trees: [] },
        featureList: ['request_rate_per_sec', 'auth_failure_count', 'unique_endpoint_count'],
        trainingSampleCount: 64,
        decisionThreshold: 0.60
      }
    });
    testModelVersionId = testModel.id;
  });

  after(async () => {
    if (testAssessmentIds.length > 0) {
      await prisma.behavioralAssessment.deleteMany({
        where: { id: { in: testAssessmentIds } }
      });
    }
    if (testModelVersionId) {
      await prisma.detectionModelVersion.deleteMany({
        where: { id: testModelVersionId }
      });
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDatabase();
  });

  beforeEach(() => {
    setNodeSessionCookie(null);
    setCsrfToken(null);
  });

  // Helper login methods using authService
  async function loginAsApexOwner() {
    return authService.login('owner@apexfintech.io', 'DevOwner12345!');
  }

  async function loginAsMedAnalyst() {
    return authService.login('analyst@medsecure.io', 'DevAnalyst12345!');
  }

  // --------------------------------------------------------------------------
  // 1. Authentication and Tenant Isolation
  // --------------------------------------------------------------------------
  test('1. Unauthenticated requests to detection endpoints return 401', async () => {
    await assert.rejects(
      async () => {
        await apiClient.getDetectionAssessments(tenantApexId);
      },
      (err) => {
        assert.equal(err instanceof ApiError, true);
        assert.equal(err.status, 401);
        return true;
      }
    );
  });

  test('2. Cross-tenant isolation: MedSecure analyst cannot access Apex detection assessments (403)', async () => {
    await loginAsMedAnalyst();

    await assert.rejects(
      async () => {
        await apiClient.getDetectionAssessments(tenantApexId);
      },
      (err) => {
        assert.equal(err instanceof ApiError, true);
        assert.equal(err.status, 403);
        return true;
      }
    );
  });

  test('3. Tenant switching: Switching active tenant queries correct tenant assessments', async () => {
    // A. Query as Apex Owner
    await loginAsApexOwner();
    const apexRes = await apiClient.getDetectionAssessments(tenantApexId);
    assert.equal(apexRes.success, true);
    assert.ok(apexRes.data.total >= 3);
    assert.ok(apexRes.data.assessments.every((a) => a.tenantId === tenantApexId));

    // B. Switch to MedSecure Analyst
    await loginAsMedAnalyst();
    const medRes = await apiClient.getDetectionAssessments(tenantMedId);
    assert.equal(medRes.success, true);
    // MedSecure has 0 assessments
    assert.equal(medRes.data.total, 0);
  });

  // --------------------------------------------------------------------------
  // 2. Assessment List and Detail Inspection
  // --------------------------------------------------------------------------
  test('4. Assessment listing returns structured metadata and application relations', async () => {
    await loginAsApexOwner();
    const res = await apiClient.getDetectionAssessments(tenantApexId);
    assert.equal(res.success, true);
    assert.ok(Array.isArray(res.data.assessments));

    const item = res.data.assessments.find((a) => a.id === highRuleAssessmentId);
    assert.ok(item);
    assert.equal(item.assessmentLabel, 'HIGHLY_SUSPICIOUS');
    assert.equal(item.classification, 'CREDENTIAL_STUFFING');
    assert.ok(item.application);
  });

  test('5. Assessment detail endpoint returns full behavioral evidence and observation fields', async () => {
    await loginAsApexOwner();
    const res = await apiClient.getDetectionAssessmentById(tenantApexId, highRuleAssessmentId);
    assert.equal(res.success, true);
    const asm = res.data;

    assert.equal(asm.id, highRuleAssessmentId);
    assert.equal(asm.assessmentLabel, 'HIGHLY_SUSPICIOUS');
    assert.equal(asm.classification, 'CREDENTIAL_STUFFING');
    assert.equal(asm.riskScore, 0.98);
    assert.equal(asm.confidenceScore, 0.92);
    assert.ok(Array.isArray(asm.ruleFindings));
    assert.equal(asm.ruleFindings[0].ruleId, 'RULE_AUTH_FAILURE');
    assert.equal(asm.mlAnomalyResult.algorithm, 'ISOLATION_FOREST');
    assert.equal(asm.mlAnomalyResult.isAnomaly, true);
  });

  // --------------------------------------------------------------------------
  // 3. Decision Safety and Deception Eligibility Guardrails
  // --------------------------------------------------------------------------
  test('6. Corroborated high-severity attack with complete telemetry is deceptionEligible: true', async () => {
    await loginAsApexOwner();
    const res = await apiClient.getDetectionAssessmentById(tenantApexId, highRuleAssessmentId);
    assert.equal(res.success, true);
    const asm = res.data;

    const isEligible = asm.explanation?.deceptionEligible === true || asm.deceptionEligible === true;
    assert.equal(isEligible, true);
  });

  test('7. ML-only anomaly without rule corroboration is deceptionEligible: false', async () => {
    await loginAsApexOwner();
    const res = await apiClient.getDetectionAssessmentById(tenantApexId, mlOnlyAssessmentId);
    assert.equal(res.success, true);
    const asm = res.data;

    const isEligible = asm.explanation?.deceptionEligible === true || asm.deceptionEligible === true;
    assert.equal(isEligible, false, 'Unsupervised ML anomaly alone must NEVER authorize deception diversion');
  });

  test('8. Degraded telemetry / telemetry loss yields INSUFFICIENT_EVIDENCE and deceptionEligible: false', async () => {
    await loginAsApexOwner();
    const res = await apiClient.getDetectionAssessmentById(tenantApexId, degradedAssessmentId);
    assert.equal(res.success, true);
    const asm = res.data;

    assert.equal(asm.assessmentLabel, 'INSUFFICIENT_EVIDENCE');
    assert.equal(asm.telemetryLossDetected, true);
    const isEligible = asm.explanation?.deceptionEligible === true || asm.deceptionEligible === true;
    assert.equal(isEligible, false, 'Degraded telemetry must NEVER authorize deception diversion');
  });

  test('9. Execution evidence status is strictly MISSING across all emitted records', async () => {
    await loginAsApexOwner();
    const res = await apiClient.getDetectionAssessments(tenantApexId);
    assert.equal(res.success, true);

    for (const asm of res.data.assessments) {
      const expl = typeof asm.explanation === 'object' && asm.explanation !== null ? asm.explanation : {};
      const status = expl.executionEvidenceStatus || asm.executionEvidenceStatus;
      assert.equal(status, 'MISSING', 'Gateway foundation must never claim countermeasure execution');
    }
  });

  // --------------------------------------------------------------------------
  // 4. Model Lifecycle & Training Gate
  // --------------------------------------------------------------------------
  test('10. Models endpoint lists active model versions with algorithm and threshold', async () => {
    await loginAsApexOwner();
    const res = await apiClient.getDetectionModels(tenantApexId);
    assert.equal(res.success, true);
    assert.ok(res.data.models.length >= 1);

    const model = res.data.models.find((m) => m.id === testModelVersionId);
    assert.ok(model);
    assert.equal(model.modelIdentifier, 'model-iforest-apex-test-v1');
    assert.equal(model.algorithm, 'ISOLATION_FOREST');
    assert.equal(model.status, 'READY');
    assert.equal(model.decisionThreshold, 0.60);
  });

  test('11. Triggering model training with insufficient baseline data returns HTTP 422', async () => {
    await loginAsApexOwner();

    await assert.rejects(
      async () => {
        await apiClient.triggerModelTraining(tenantApexId, {
          applicationId: appApexId,
          algorithm: 'ISOLATION_FOREST',
          minSamples: 200
        });
      },
      (err) => {
        assert.equal(err instanceof ApiError, true);
        assert.equal(err.status, 422);
        assert.equal(err.code, 'HTTP_422');
        return true;
      }
    );
  });

  // --------------------------------------------------------------------------
  // 5. Research Benchmark Evaluation & Accounting Invariants
  // --------------------------------------------------------------------------
  test('12. Research benchmark evaluation returns reconciled 24-scenario metrics', async () => {
    await loginAsApexOwner();
    const res = await apiClient.getDetectionEvaluation(tenantApexId);
    assert.equal(res.success, true);

    const data = res.data;
    assert.equal(data.totalScenarios, 24);
    assert.ok(data.partitions);
    assert.equal(data.partitions.trainingCount, 5);
    assert.equal(data.partitions.validationCount, 7);
    assert.equal(data.partitions.testCount, 12);

    // Verify held-out test binary denominator invariants: TP + FN = 7, FP + TN = 4
    const testComparison = data.heldOutTestEvaluation?.comparison || data.comparison;
    assert.ok(testComparison);

    const branches = ['ruleOnly', 'iforestOnly', 'statisticalBaselineOnly', 'hybridAssessment'];
    for (const b of branches) {
      const stats = testComparison[b];
      assert.ok(stats, `Branch ${b} must exist in test comparison`);
      const tp = stats.confusionMatrix.tp;
      const fn = stats.confusionMatrix.fn;
      const fp = stats.confusionMatrix.fp;
      const tn = stats.confusionMatrix.tn;

      assert.equal(tp + fn, 7, `Branch ${b} must have TP + FN = 7`);
      assert.equal(fp + tn, 4, `Branch ${b} must have FP + TN = 4`);
    }

    // Verify degraded scenario is segregated (not in binary denominators)
    const hybridDegraded = testComparison.hybridAssessment.degradedAccounting;
    assert.ok(hybridDegraded);
    assert.equal(hybridDegraded.total, 1);
    assert.equal(hybridDegraded.flaggedInsufficient, 1);
  });

  test('13. Rules catalog returns all 6 registered deterministic rules with missing-data behavior', async () => {
    await loginAsApexOwner();
    const res = await apiClient.getDetectionRules(tenantApexId);
    assert.equal(res.success, true);
    assert.ok(Array.isArray(res.data.rules));
    assert.equal(res.data.rules.length, 6);

    const ruleIds = res.data.rules.map((r) => r.ruleId);
    assert.ok(ruleIds.includes('RULE_AUTH_FAILURE'));
    assert.ok(ruleIds.includes('RULE_ENDPOINT_ENUMERATION'));
    assert.ok(ruleIds.includes('RULE_REQUEST_BURST'));
    assert.ok(ruleIds.includes('RULE_SUSPICIOUS_METHOD'));
    assert.ok(ruleIds.includes('RULE_REPEATED_RESOURCE_PROBING'));
    assert.ok(ruleIds.includes('RULE_BEHAVIORAL_SHIFT'));
  });
});
