/**
 * Stage 4C.3: Deception Eligibility Verification & Decision Safety Test Suite
 *
 * Verifies that deception routing authorization (deceptionEligible) is audited
 * independently of classification label across all 10 decision-safety cases:
 *
 * 1.  ML-only anomaly -> deceptionEligible: false
 * 2.  High-severity rule with complete telemetry -> deceptionEligible: true
 * 3.  Low-confidence session correlation -> deceptionEligible: false
 * 4.  Shared NAT / proxy collision (collisionRisk: HIGH) -> deceptionEligible: false
 * 5.  Mobile timing irregularity -> deceptionEligible: false
 * 6.  Incomplete telemetry -> deceptionEligible: false
 * 7.  Telemetry persistence failure -> deceptionEligible: false
 * 8.  Ambiguous ground truth (solitary medium probing) -> deceptionEligible: false
 * 9.  Application release deployment (transient 503 surge) -> deceptionEligible: false
 * 10. Conflicting rule and ML outputs -> deceptionEligible: false
 *
 * Invariant: executionEvidenceStatus is strictly 'MISSING' across all cases.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { HybridAssessmentService, ASSESSMENT_LABELS } from '../src/detection/hybrid-assessment.service.js';
import { RULE_SEVERITY } from '../src/detection/rules/rule-result.schema.js';

describe('Stage 4C.3: Deception Eligibility & Decision Safety Audit Suite', () => {
  const hybridService = new HybridAssessmentService();

  test('Case 1: ML-only anomaly without rule corroboration -> deceptionEligible: false', () => {
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
        isAnomaly: true,
        anomalyScore: 0.88,
        decisionThreshold: 0.60,
        algorithm: 'ISOLATION_FOREST'
      },
      featureSet: {
        windowLabel: '5m',
        observationCount: 30,
        features: { http_4xx_ratio: { value: 0.0 }, auth_failure_count: { value: 0 } },
        qualityMetadata: { completenessStatus: 'COMPLETE', telemetryLossDetected: false }
      },
      sessionContext: { collisionRisk: { level: 'LOW' }, correlationConfidence: 0.95 },
      tenantId: 'tenant-apex'
    });

    assert.equal(assessment.assessmentLabel, ASSESSMENT_LABELS.SUSPICIOUS);
    assert.equal(assessment.classification, 'UNSUPERVISED_BEHAVIORAL_ANOMALY');
    assert.equal(assessment.deceptionEligible, false, 'ML anomaly alone must never authorize deception diversion');
    assert.equal(assessment.executionEvidenceStatus, 'MISSING');
    assert.ok(assessment.uncertaintyNotes.some((n) => n.includes('non-actionable for autonomous deception')));
  });

  test('Case 2: High-severity rule with complete telemetry and low collision risk -> deceptionEligible: true', () => {
    const assessment = hybridService.evaluateAssessment({
      ruleResult: {
        hasTriggeredRules: true,
        triggeredCount: 1,
        highestSeverity: RULE_SEVERITY.HIGH,
        triggeredFindings: [{
          ruleId: 'RULE_ENDPOINT_ENUMERATION',
          ruleName: 'Endpoint Enumeration Pattern',
          severity: RULE_SEVERITY.HIGH,
          explanation: '30 distinct admin paths scanned'
        }],
        findings: []
      },
      mlResult: {
        modelStatus: 'ACTIVE',
        isAnomaly: true,
        anomalyScore: 0.92,
        decisionThreshold: 0.60
      },
      featureSet: {
        windowLabel: '5m',
        observationCount: 30,
        qualityMetadata: { completenessStatus: 'COMPLETE', telemetryLossDetected: false }
      },
      sessionContext: { collisionRisk: { level: 'LOW' }, correlationConfidence: 0.95 },
      tenantId: 'tenant-apex'
    });

    assert.equal(assessment.assessmentLabel, ASSESSMENT_LABELS.HIGHLY_SUSPICIOUS);
    assert.equal(assessment.deceptionEligible, true, 'Corroborated high-severity rule with complete telemetry is eligible');
    assert.equal(assessment.executionEvidenceStatus, 'MISSING');
  });

  test('Case 3: Low-confidence session correlation (< 0.70) -> deceptionEligible: false', () => {
    const assessment = hybridService.evaluateAssessment({
      ruleResult: {
        hasTriggeredRules: true,
        triggeredCount: 1,
        highestSeverity: RULE_SEVERITY.HIGH,
        triggeredFindings: [{
          ruleId: 'RULE_AUTH_FAILURE',
          severity: RULE_SEVERITY.HIGH
        }],
        findings: []
      },
      mlResult: { isAnomaly: true, anomalyScore: 0.85 },
      featureSet: {
        windowLabel: '5m',
        observationCount: 20,
        qualityMetadata: { completenessStatus: 'COMPLETE', telemetryLossDetected: false }
      },
      sessionContext: {
        collisionRisk: { level: 'LOW' },
        correlationConfidence: 0.45 // Low confidence correlation
      },
      tenantId: 'tenant-apex'
    });

    assert.equal(assessment.deceptionEligible, false, 'Low correlation confidence must suppress deception diversion');
    assert.ok(assessment.confidenceScore < 0.70);
    assert.equal(assessment.executionEvidenceStatus, 'MISSING');
  });

  test('Case 4: Shared NAT / proxy collision (collisionRisk: HIGH) -> deceptionEligible: false', () => {
    const assessment = hybridService.evaluateAssessment({
      ruleResult: {
        hasTriggeredRules: true,
        triggeredCount: 2,
        highestSeverity: RULE_SEVERITY.HIGH,
        triggeredFindings: [{
          ruleId: 'RULE_ENDPOINT_ENUMERATION',
          severity: RULE_SEVERITY.HIGH
        }],
        findings: []
      },
      mlResult: { isAnomaly: true, anomalyScore: 0.90 },
      featureSet: {
        windowLabel: '5m',
        observationCount: 25,
        qualityMetadata: { completenessStatus: 'COMPLETE', telemetryLossDetected: false }
      },
      sessionContext: {
        collisionRisk: { level: 'HIGH', reason: 'Unkeyed IP proxy pool' },
        correlationConfidence: 0.85
      },
      tenantId: 'tenant-apex'
    });

    assert.equal(assessment.deceptionEligible, false, 'High collision risk must suppress deception to protect co-located users');
    assert.ok(assessment.uncertaintyNotes.some((n) => n.includes('collision risk is HIGH')));
    assert.equal(assessment.executionEvidenceStatus, 'MISSING');
  });

  test('Case 5: Mobile timing irregularity -> deceptionEligible: false', () => {
    const assessment = hybridService.evaluateAssessment({
      ruleResult: { hasTriggeredRules: false, triggeredCount: 0, triggeredFindings: [] },
      mlResult: { isAnomaly: true, anomalyScore: 0.64 }, // Mild mobile jitter deviation
      featureSet: {
        windowLabel: '5m',
        observationCount: 15,
        features: {
          http_4xx_ratio: { value: 0.0 },
          auth_failure_count: { value: 0 },
          resource_enumeration_score: { value: 0.0 }
        },
        qualityMetadata: { completenessStatus: 'COMPLETE', telemetryLossDetected: false }
      },
      sessionContext: { collisionRisk: { level: 'LOW' }, correlationConfidence: 0.90 },
      tenantId: 'tenant-apex'
    });

    assert.equal(assessment.assessmentLabel, ASSESSMENT_LABELS.NORMAL);
    assert.equal(assessment.classification, 'BENIGN_ENVIRONMENTAL_VARIANCE');
    assert.equal(assessment.deceptionEligible, false);
    assert.equal(assessment.executionEvidenceStatus, 'MISSING');
  });

  test('Case 6: Incomplete telemetry stream -> deceptionEligible: false', () => {
    const assessment = hybridService.evaluateAssessment({
      ruleResult: {
        hasTriggeredRules: true,
        triggeredCount: 1,
        highestSeverity: RULE_SEVERITY.HIGH,
        triggeredFindings: [{ ruleId: 'RULE_ENDPOINT_ENUMERATION', severity: RULE_SEVERITY.HIGH }]
      },
      mlResult: { isAnomaly: true, anomalyScore: 0.85 },
      featureSet: {
        windowLabel: '5m',
        observationCount: 10,
        qualityMetadata: { completenessStatus: 'DEGRADED', telemetryLossDetected: true }
      },
      sessionContext: { collisionRisk: { level: 'LOW' } },
      tenantId: 'tenant-apex'
    });

    assert.equal(assessment.assessmentLabel, ASSESSMENT_LABELS.INSUFFICIENT_EVIDENCE);
    assert.equal(assessment.deceptionEligible, false);
    assert.equal(assessment.executionEvidenceStatus, 'MISSING');
  });

  test('Case 7: Telemetry persistence failure -> deceptionEligible: false', () => {
    const assessment = hybridService.evaluateAssessment({
      ruleResult: {
        hasTriggeredRules: true,
        triggeredCount: 1,
        highestSeverity: RULE_SEVERITY.CRITICAL,
        triggeredFindings: [{ ruleId: 'RULE_SUSPICIOUS_METHOD', severity: RULE_SEVERITY.CRITICAL }]
      },
      mlResult: { isAnomaly: true, anomalyScore: 0.95 },
      featureSet: {
        windowLabel: '5m',
        observationCount: 5,
        qualityMetadata: { completenessStatus: 'PARTIAL', telemetryLossDetected: true }
      },
      sessionContext: { collisionRisk: { level: 'LOW' } },
      tenantId: 'tenant-apex'
    });

    assert.equal(assessment.assessmentLabel, ASSESSMENT_LABELS.INSUFFICIENT_EVIDENCE);
    assert.equal(assessment.deceptionEligible, false);
    assert.equal(assessment.executionEvidenceStatus, 'MISSING');
  });

  test('Case 8: Ambiguous ground truth (solitary medium probing) -> deceptionEligible: false', () => {
    // Solitary medium severity rule triggered (e.g. repeated 404 to single legacy dead link)
    const assessment = hybridService.evaluateAssessment({
      ruleResult: {
        hasTriggeredRules: true,
        triggeredCount: 1,
        highestSeverity: RULE_SEVERITY.MEDIUM,
        triggeredFindings: [{
          ruleId: 'RULE_RESOURCE_PROBING',
          ruleName: 'Resource Probing Pattern',
          severity: RULE_SEVERITY.MEDIUM,
          explanation: 'Repeated 404s on single route'
        }],
        findings: []
      },
      mlResult: {
        isAnomaly: true,
        anomalyScore: 0.72,
        decisionThreshold: 0.60
      },
      featureSet: {
        windowLabel: '5m',
        observationCount: 12,
        qualityMetadata: { completenessStatus: 'COMPLETE', telemetryLossDetected: false }
      },
      sessionContext: { collisionRisk: { level: 'LOW' }, correlationConfidence: 0.90 },
      tenantId: 'tenant-apex'
    });

    assert.equal(assessment.assessmentLabel, ASSESSMENT_LABELS.SUSPICIOUS);
    assert.equal(assessment.classification, 'RULE_RESOURCE_PROBING');
    assert.equal(assessment.deceptionEligible, false, 'Solitary medium probing without high/critical corroboration must not authorize deception');
    assert.equal(assessment.executionEvidenceStatus, 'MISSING');
  });

  test('Case 9: Application release deployment (transient 503 surge) -> deceptionEligible: false', () => {
    const assessment = hybridService.evaluateAssessment({
      ruleResult: { hasTriggeredRules: false, triggeredCount: 0, triggeredFindings: [] },
      mlResult: { isAnomaly: true, anomalyScore: 0.83 }, // Spike due to 5xx departure
      featureSet: {
        windowLabel: '5m',
        observationCount: 10,
        features: {
          http_4xx_ratio: { value: 0.0 },
          auth_failure_count: { value: 0 },
          resource_enumeration_score: { value: 0.0 }
        },
        qualityMetadata: { completenessStatus: 'COMPLETE', telemetryLossDetected: false }
      },
      sessionContext: { collisionRisk: { level: 'LOW' }, correlationConfidence: 0.90 },
      tenantId: 'tenant-apex'
    });

    assert.equal(assessment.deceptionEligible, false, 'Backend restart / infrastructure errors must never authorize deception diversion');
    assert.equal(assessment.executionEvidenceStatus, 'MISSING');
  });

  test('Case 10: Conflicting rule and ML outputs -> deceptionEligible: false', () => {
    // Branch discrepancy: ML indicates strong anomaly, but 0 security rules fired
    const assessment = hybridService.evaluateAssessment({
      ruleResult: {
        hasTriggeredRules: false,
        triggeredCount: 0,
        highestSeverity: 'NONE',
        triggeredFindings: []
      },
      mlResult: {
        modelStatus: 'ACTIVE',
        isAnomaly: true,
        anomalyScore: 0.79,
        algorithm: 'ISOLATION_FOREST'
      },
      featureSet: {
        windowLabel: '5m',
        observationCount: 20,
        qualityMetadata: { completenessStatus: 'COMPLETE', telemetryLossDetected: false }
      },
      sessionContext: { collisionRisk: { level: 'LOW' }, correlationConfidence: 0.90 },
      tenantId: 'tenant-apex'
    });

    assert.equal(assessment.deceptionEligible, false, 'Branch conflict requires manual analyst review, not autonomous diversion');
    assert.equal(assessment.executionEvidenceStatus, 'MISSING');
  });
});
