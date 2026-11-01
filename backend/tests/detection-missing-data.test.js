/**
 * Stage 4C.2 Regression Test Suite: Missing-Data and Malformed Input Semantics
 *
 * Verifies that:
 * 1. Missing required features are never fabricated into normal zeroes.
 * 2. Undefined HTTP methods are never defaulted to GET.
 * 3. Malformed HTTP method syntax triggers CRITICAL protocol violation.
 * 4. Empty feature dictionaries return explicit missing-telemetry findings.
 * 5. Rule engine aggregates missing-telemetry evidence and uncertainty notes.
 * 6. Hybrid assessment gates degraded or missing telemetry to INSUFFICIENT_EVIDENCE.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { RuleRegistry } from '../src/detection/rules/rule-registry.js';
import { RuleEngineService } from '../src/detection/rules/rule-engine.service.js';
import { HybridAssessmentService, ASSESSMENT_LABELS } from '../src/detection/hybrid-assessment.service.js';

describe('Stage 4C.2: Missing-Data & Malformed Input Audit Suite', () => {
  const registry = new RuleRegistry();
  const engine = new RuleEngineService({ registry });
  const hybrid = new HybridAssessmentService();

  test('Rule 1: Missing auth_failure_count returns MISSING_AUTH_FAILURE_TELEMETRY (never fabricates 0)', () => {
    const rule = registry.getRule('RULE_AUTH_FAILURE');
    const finding = rule.evaluate({ features: {}, timeWindow: '5m' });

    assert.equal(finding.triggered, false);
    assert.equal(finding.confidence, 0.10);
    assert.ok(finding.matchedConditions.includes('MISSING_AUTH_FAILURE_TELEMETRY'));
    assert.ok(finding.uncertaintyNotes.some((n) => n.includes('missing or unavailable')));
    assert.equal(finding.evidence.authFailures, null);
    assert.ok(finding.explanation.includes('inconclusive'));
  });

  test('Rule 2: Missing enumeration features returns MISSING_ENDPOINT_ENUMERATION_TELEMETRY', () => {
    const rule = registry.getRule('RULE_ENDPOINT_ENUMERATION');
    const finding = rule.evaluate({ features: {}, timeWindow: '5m' });

    assert.equal(finding.triggered, false);
    assert.equal(finding.confidence, 0.10);
    assert.ok(finding.matchedConditions.includes('MISSING_ENDPOINT_ENUMERATION_TELEMETRY'));
    assert.equal(finding.evidence.requestCount, null);
    assert.ok(finding.explanation.includes('inconclusive'));
  });

  test('Rule 3: Missing burst features returns MISSING_BURST_TELEMETRY', () => {
    const rule = registry.getRule('RULE_REQUEST_BURST');
    const finding = rule.evaluate({ features: {}, timeWindow: '5m' });

    assert.equal(finding.triggered, false);
    assert.equal(finding.confidence, 0.10);
    assert.ok(finding.matchedConditions.includes('MISSING_BURST_TELEMETRY'));
    assert.equal(finding.evidence.burst1s, null);
    assert.ok(finding.explanation.includes('inconclusive'));
  });

  test('Rule 4: Undefined HTTP method and empty distribution returns METHOD_DATA_MISSING (never defaults to GET)', () => {
    const rule = registry.getRule('RULE_SUSPICIOUS_METHOD');
    const finding = rule.evaluate({
      features: {},
      rawObservation: {},
      timeWindow: '5m'
    });

    assert.equal(finding.triggered, false);
    assert.equal(finding.confidence, 0.10);
    assert.ok(finding.matchedConditions.includes('METHOD_DATA_MISSING'));
    assert.equal(finding.evidence.observedMethod, null);
    assert.equal(finding.evidence.methodCategory, 'UNKNOWN_MISSING');
    assert.ok(!finding.explanation.includes('GET/POST'), 'Must NOT fabricate GET/POST');
    assert.ok(finding.explanation.includes('method data missing'));
  });

  test('Rule 4: Malformed method syntax containing whitespace or control chars triggers CRITICAL protocol violation', () => {
    const rule = registry.getRule('RULE_SUSPICIOUS_METHOD');
    const finding = rule.evaluate({
      features: {},
      rawObservation: {
        httpMethod: 'GET /index.html HTTP/1.1\r\nHost: evil.com'
      },
      timeWindow: '30s'
    });

    assert.equal(finding.triggered, true);
    assert.equal(finding.severity, 'CRITICAL');
    assert.ok(finding.matchedConditions.includes('PROTOCOL_VIOLATION_INVALID_METHOD_SYNTAX'));
    assert.equal(finding.evidence.upstreamInvoked, false);
    assert.ok(finding.explanation.includes('Malformed HTTP method token'));
  });

  test('Rule 5: Missing probing telemetry returns MISSING_RESOURCE_PROBING_TELEMETRY', () => {
    const rule = registry.getRule('RULE_REPEATED_RESOURCE_PROBING');
    const finding = rule.evaluate({
      features: {},
      rawObservation: {},
      timeWindow: '5m'
    });

    assert.equal(finding.triggered, false);
    assert.equal(finding.confidence, 0.10);
    assert.ok(finding.matchedConditions.includes('MISSING_RESOURCE_PROBING_TELEMETRY'));
    assert.equal(finding.evidence.notFoundCount, null);
    assert.ok(finding.explanation.includes('inconclusive'));
  });

  test('Rule 6: Missing multi-window metrics returns MISSING_BEHAVIORAL_SHIFT_TELEMETRY', () => {
    const rule = registry.getRule('RULE_BEHAVIORAL_SHIFT');
    const finding = rule.evaluate({
      features: {},
      multiWindowFeatures: {},
      timeWindow: '30s'
    });

    assert.equal(finding.triggered, false);
    assert.equal(finding.confidence, 0.10);
    assert.ok(finding.matchedConditions.includes('MISSING_BEHAVIORAL_SHIFT_TELEMETRY'));
    assert.equal(finding.evidence.rateRatio, null);
    assert.ok(finding.explanation.includes('inconclusive'));
  });

  test('RuleEngineService: Completely missing featureSets reports missing telemetry summary', () => {
    const res = engine.evaluate({ featureSets: [], rawObservation: {} });

    assert.equal(res.hasTriggeredRules, false);
    assert.equal(res.hasMissingTelemetry, true);
    assert.equal(res.missingTelemetryRuleCount, 6);
    assert.ok(res.summary.includes('inconclusive: all registered rules reported missing or unavailable telemetry'));
  });

  test('HybridAssessmentService: Gated to INSUFFICIENT_EVIDENCE when telemetry is degraded or loss detected', () => {
    const assessment = hybrid.evaluateAssessment({
      ruleResult: { hasTriggeredRules: false, triggeredFindings: [], findings: [] },
      mlResult: { isAnomaly: false, anomalyScore: 0.35, modelStatus: 'ACTIVE' },
      featureSet: {
        windowLabel: '5m',
        observationCount: 3,
        qualityMetadata: {
          completenessStatus: 'DEGRADED',
          telemetryLossDetected: true
        }
      },
      tenantId: 'tenant-test'
    });

    assert.equal(assessment.assessmentLabel, ASSESSMENT_LABELS.INSUFFICIENT_EVIDENCE);
    assert.equal(assessment.riskScore, null);
    assert.equal(assessment.confidenceScore, 0.35);
    assert.equal(assessment.classification, 'INSUFFICIENT_TELEMETRY');
    assert.equal(assessment.executionEvidenceStatus, 'MISSING');
  });
});
