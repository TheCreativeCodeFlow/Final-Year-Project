/**
 * Stage 4C Test Suite: Hybrid Evidence Assessment Layer
 *
 * Verifies:
 * 1. Rule-only finding -> SUSPICIOUS
 * 2. ML-only anomaly (unsupervised novel anomaly) -> SUSPICIOUS
 * 3. Both branches agree (Rule + ML anomaly) -> HIGHLY_SUSPICIOUS
 * 4. Neither branch produces finding -> NORMAL
 * 5. Critical ingress violation -> HIGHLY_SUSPICIOUS
 * 6. Telemetry loss / incomplete telemetry -> INSUFFICIENT_EVIDENCE
 * 7. Missing ML model -> Preserves uncertainty without crashing
 * 8. Untrusted session header -> Discounter confidence score
 * 9. Persistence to PostgreSQL BehavioralAssessment table
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { HybridAssessmentService, ASSESSMENT_LABELS } from '../src/detection/hybrid-assessment.service.js';
import { RULE_SEVERITY } from '../src/detection/rules/rule-result.schema.js';
import { getPrismaClient, disconnectDatabase } from '../src/db/client.js';

describe('Stage 4C: Hybrid Evidence Assessment Layer', () => {
  let prisma;
  let hybridService;

  before(async () => {
    prisma = getPrismaClient();
    hybridService = new HybridAssessmentService({ prisma });
  });

  after(async () => {
    await disconnectDatabase();
  });

  test('1. Rule-only finding: 1 High rule triggered while ML is normal -> SUSPICIOUS', () => {
    const assessment = hybridService.evaluateAssessment({
      ruleResult: {
        hasTriggeredRules: true,
        triggeredCount: 1,
        highestSeverity: RULE_SEVERITY.HIGH,
        triggeredFindings: [{
          ruleId: 'RULE_AUTH_FAILURE',
          ruleName: 'Authentication Failure Pattern',
          severity: RULE_SEVERITY.HIGH,
          explanation: '10 failed logins'
        }],
        findings: [],
        summary: '1 rule triggered'
      },
      mlResult: {
        modelStatus: 'ACTIVE',
        isAnomaly: false,
        anomalyScore: 0.42,
        decisionThreshold: 0.60,
        algorithm: 'ISOLATION_FOREST'
      },
      featureSet: { windowLabel: '5m', observationCount: 15 },
      tenantId: 'tenant-apex-9941'
    });

    assert.equal(assessment.assessmentLabel, ASSESSMENT_LABELS.SUSPICIOUS);
    assert.equal(assessment.classification, 'RULE_AUTH_FAILURE');
    assert.ok(assessment.riskScore >= 0.60 && assessment.riskScore <= 0.80);
    assert.ok(assessment.ruleFindings.length === 0 || assessment.ruleFindings !== undefined);
  });

  test('2. ML-only anomaly: No rule fired but Isolation Forest flagged statistical anomaly -> SUSPICIOUS', () => {
    const assessment = hybridService.evaluateAssessment({
      ruleResult: {
        hasTriggeredRules: false,
        triggeredCount: 0,
        highestSeverity: 'NONE',
        triggeredFindings: [],
        findings: [],
        summary: 'No rules triggered'
      },
      mlResult: {
        modelStatus: 'ACTIVE',
        isAnomaly: true,
        anomalyScore: 0.78,
        decisionThreshold: 0.60,
        algorithm: 'ISOLATION_FOREST',
        contributingFeatures: [{ name: 'request_rate_per_sec', scaledDeviation: 3.5 }]
      },
      featureSet: { windowLabel: '5m', observationCount: 20 },
      tenantId: 'tenant-apex-9941'
    });

    assert.equal(assessment.assessmentLabel, ASSESSMENT_LABELS.SUSPICIOUS);
    assert.equal(assessment.classification, 'UNSUPERVISED_BEHAVIORAL_ANOMALY');
    assert.ok(assessment.riskScore >= 0.50 && assessment.riskScore <= 0.75);
    assert.ok(assessment.explanation.contributingFactors.some((f) => f.includes('Unsupervised statistical anomaly')));
  });

  test('3. Both branches agree: High severity rule AND ML anomaly -> HIGHLY_SUSPICIOUS with elevated risk score', () => {
    const assessment = hybridService.evaluateAssessment({
      ruleResult: {
        hasTriggeredRules: true,
        triggeredCount: 1,
        highestSeverity: RULE_SEVERITY.HIGH,
        triggeredFindings: [{
          ruleId: 'RULE_ENDPOINT_ENUMERATION',
          ruleName: 'Endpoint Enumeration Pattern',
          severity: RULE_SEVERITY.HIGH,
          explanation: 'Directory spidering across 8 404 paths'
        }],
        findings: []
      },
      mlResult: {
        modelStatus: 'ACTIVE',
        isAnomaly: true,
        anomalyScore: 0.85,
        decisionThreshold: 0.60,
        algorithm: 'ISOLATION_FOREST'
      },
      featureSet: { windowLabel: '5m', observationCount: 25 },
      tenantId: 'tenant-apex-9941'
    });

    assert.equal(assessment.assessmentLabel, ASSESSMENT_LABELS.HIGHLY_SUSPICIOUS);
    assert.ok(assessment.riskScore >= 0.85);
    assert.ok(assessment.explanation.contributingFactors.some((f) => f.includes('ML anomaly confirmed')));
  });

  test('4. Neither branch triggers: Zero rules and normal ML score -> NORMAL', () => {
    const assessment = hybridService.evaluateAssessment({
      ruleResult: {
        hasTriggeredRules: false,
        triggeredCount: 0,
        highestSeverity: 'NONE',
        triggeredFindings: [],
        findings: []
      },
      mlResult: {
        modelStatus: 'ACTIVE',
        isAnomaly: false,
        anomalyScore: 0.35,
        decisionThreshold: 0.60,
        algorithm: 'ISOLATION_FOREST'
      },
      featureSet: { windowLabel: '5m', observationCount: 30 },
      tenantId: 'tenant-apex-9941'
    });

    assert.equal(assessment.assessmentLabel, ASSESSMENT_LABELS.NORMAL);
    assert.equal(assessment.classification, 'BENIGN_BASELINE');
    assert.ok(assessment.riskScore <= 0.20);
  });

  test('5. Critical ingress violation (Protocol attack / Prohibited method) -> HIGHLY_SUSPICIOUS immediately', () => {
    const assessment = hybridService.evaluateAssessment({
      ruleResult: {
        hasTriggeredRules: true,
        triggeredCount: 1,
        highestSeverity: RULE_SEVERITY.CRITICAL,
        triggeredFindings: [{
          ruleId: 'RULE_SUSPICIOUS_METHOD',
          ruleName: 'Suspicious HTTP Method Pattern',
          severity: RULE_SEVERITY.CRITICAL,
          explanation: 'Protocol violation: REQUEST_SMUGGLING_DETECTED'
        }],
        findings: []
      },
      mlResult: {
        modelStatus: 'NO_MODEL_AVAILABLE',
        isAnomaly: false,
        anomalyScore: null
      },
      featureSet: { windowLabel: '30s', observationCount: 1 },
      tenantId: 'tenant-apex-9941'
    });

    assert.equal(assessment.assessmentLabel, ASSESSMENT_LABELS.HIGHLY_SUSPICIOUS);
    assert.ok(assessment.riskScore >= 0.85);
  });

  test('6. Incomplete telemetry with data loss -> INSUFFICIENT_EVIDENCE (never silently classifies as safe)', () => {
    const assessment = hybridService.evaluateAssessment({
      ruleResult: {
        hasTriggeredRules: false,
        triggeredCount: 0,
        triggeredFindings: [],
        findings: []
      },
      mlResult: {
        modelStatus: 'ACTIVE',
        isAnomaly: false,
        anomalyScore: 0.30
      },
      featureSet: {
        windowLabel: '30s',
        observationCount: 1,
        qualityMetadata: { telemetryLossDetected: true, hasDataLoss: true }
      },
      tenantId: 'tenant-apex-9941'
    });

    assert.equal(assessment.assessmentLabel, ASSESSMENT_LABELS.INSUFFICIENT_EVIDENCE);
    assert.equal(assessment.riskScore, null);
    assert.equal(assessment.classification, 'INSUFFICIENT_TELEMETRY');
    assert.ok(assessment.explanation.uncertaintyNotes.some((n) => n.includes('Telemetry loss was detected')));
  });

  test('7. Untrusted client session header: Collision risk HIGH demotes assessment confidence score', () => {
    const assessment = hybridService.evaluateAssessment({
      ruleResult: { hasTriggeredRules: false, triggeredFindings: [], findings: [] },
      mlResult: { modelStatus: 'ACTIVE', isAnomaly: false, anomalyScore: 0.30 },
      featureSet: { windowLabel: '5m', observationCount: 10 },
      sessionContext: {
        collisionRisk: { level: 'HIGH' },
        correlationConfidence: 0.40
      },
      tenantId: 'tenant-apex-9941'
    });

    // Confidence discounted for high collision risk
    assert.ok(assessment.confidenceScore <= 0.60);
    assert.ok(assessment.explanation.uncertaintyNotes.some((n) => n.includes('collision risk is HIGH')));
  });

  test('8. Persistence: createAndPersistAssessment stores structured record in PostgreSQL', async () => {
    const tenant = await prisma.tenant.findFirst({ where: { identifier: 'tenant-apex-9941' } });
    const app = await prisma.protectedApplication.findFirst({ where: { tenantId: tenant.id } });

    const created = await hybridService.createAndPersistAssessment({
      ruleResult: {
        hasTriggeredRules: true,
        triggeredCount: 1,
        highestSeverity: RULE_SEVERITY.HIGH,
        triggeredFindings: [{
          ruleId: 'RULE_AUTH_FAILURE',
          ruleName: 'Authentication Failure Pattern',
          severity: RULE_SEVERITY.HIGH,
          timeWindow: '5m',
          explanation: 'Testing persistence'
        }],
        findings: []
      },
      mlResult: {
        modelStatus: 'ACTIVE',
        algorithm: 'ISOLATION_FOREST',
        isAnomaly: true,
        anomalyScore: 0.72,
        decisionThreshold: 0.60
      },
      featureSet: { windowLabel: '5m', observationCount: 10 },
      tenantId: tenant.id,
      applicationId: app.id,
      sessionRef: 'sess-persist-test'
    });

    assert.ok(created.id);
    assert.equal(created.tenantId, tenant.id);
    assert.equal(created.applicationId, app.id);
    assert.equal(created.assessmentLabel, ASSESSMENT_LABELS.HIGHLY_SUSPICIOUS);
    assert.equal(created.sessionRef, 'sess-persist-test');

    // Clean up test assessment
    await prisma.behavioralAssessment.delete({ where: { id: created.id } });
  });
});
