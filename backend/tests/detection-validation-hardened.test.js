/**
 * Stage 4C.1 Hardened Validation Test Suite
 *
 * Verifies all mathematical invariants, rule corrections, CORS handling,
 * zero-MAD stability, Isolation Forest traversal, training provenance, and
 * 20-scenario benchmark accounting.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { RuleRegistry } from '../src/detection/rules/rule-registry.js';
import { RuleEngineService } from '../src/detection/rules/rule-engine.service.js';
import { IsolationForest, c } from '../src/detection/ml/isolation-forest.js';
import { StatisticalBaselineDetector } from '../src/detection/ml/statistical-baseline.js';
import { ModelTrainingService } from '../src/detection/ml/training.service.js';
import { HybridAssessmentService, FUSION_STRATEGIES } from '../src/detection/hybrid-assessment.service.js';
import { BenchmarkEvaluator } from '../src/detection/evaluation/benchmark-evaluator.js';

describe('Stage 4C.1: Hardened Detection Engine & Validation Suite', () => {
  const registry = new RuleRegistry();
  const engine = new RuleEngineService({ registry });
  const hybridService = new HybridAssessmentService();

  // =========================================================================
  // 1. RULE_SUSPICIOUS_METHOD & CORS Preflight Correctness
  // =========================================================================
  describe('Rule 4: HTTP Method Taxonomy & CORS Preflight', () => {
    const rule = registry.getRule('RULE_SUSPICIOUS_METHOD');

    test('Legitimate OPTIONS CORS preflight returns severity LOW and triggered: false', () => {
      const finding = rule.evaluate({
        features: {
          http_method_distribution: { value: { OPTIONS: 1.0 } }
        },
        rawObservation: {
          httpMethod: 'OPTIONS',
          validationOutcome: 'VALIDATED',
          forwardingResult: 'SUCCESS',
          responseStatus: 204
        },
        timeWindow: '30s'
      });

      assert.equal(finding.triggered, false);
      assert.equal(finding.severity, 'LOW');
      assert.equal(finding.evidence.isCorsPreflight, true);
      assert.equal(finding.evidence.methodCategory, 'STANDARD_CORS_PREFLIGHT');
      assert.ok(finding.explanation.includes('CORS preflight'));
    });

    test('Prohibited TRACE method is rejected at gateway ingress without forwarding', () => {
      const finding = rule.evaluate({
        features: {},
        rawObservation: {
          httpMethod: 'TRACE',
          validationOutcome: 'METHOD_NOT_ALLOWED',
          forwardingResult: 'INGRESS_REJECTED',
          responseStatus: 405
        },
        timeWindow: '30s'
      });

      assert.equal(finding.triggered, true);
      assert.equal(finding.severity, 'HIGH');
      assert.equal(finding.evidence.upstreamInvoked, false);
      assert.equal(finding.evidence.methodCategory, 'PROHIBITED_SECURITY_RISK');
      assert.ok(finding.explanation.includes('Upstream origin was not invoked'));
    });

    test('Prohibited CONNECT method triggers CRITICAL severity at ingress', () => {
      const finding = rule.evaluate({
        features: {},
        rawObservation: {
          httpMethod: 'CONNECT',
          validationOutcome: 'METHOD_NOT_ALLOWED',
          forwardingResult: 'INGRESS_REJECTED',
          responseStatus: 405
        },
        timeWindow: '30s'
      });

      assert.equal(finding.triggered, true);
      assert.equal(finding.severity, 'CRITICAL');
      assert.equal(finding.evidence.upstreamInvoked, false);
    });

    test('WebDAV / Extension PROPFIND verb triggers MEDIUM severity at ingress', () => {
      const finding = rule.evaluate({
        features: {},
        rawObservation: {
          httpMethod: 'PROPFIND',
          validationOutcome: 'METHOD_NOT_ALLOWED',
          forwardingResult: 'INGRESS_REJECTED',
          responseStatus: 405
        },
        timeWindow: '30s'
      });

      assert.equal(finding.triggered, true);
      assert.equal(finding.severity, 'MEDIUM');
      assert.equal(finding.evidence.upstreamInvoked, false);
      assert.equal(finding.evidence.methodCategory, 'EXTENSION_WEBDAV_VERBS');
    });
  });

  // =========================================================================
  // 2. Benign Counterexamples Across Core Rules
  // =========================================================================
  describe('Rule Hardening & Benign Counterexamples', () => {
    test('Rule 1: Does NOT flag single user typo recovered with subsequent 200 OK', () => {
      const rule = registry.getRule('RULE_AUTH_FAILURE');
      const finding = rule.evaluate({
        features: {
          auth_failure_count: { value: 1 },
          request_count: { value: 5 }
        },
        rawObservation: {
          responseStatus: 200,
          normalizedRoute: '/api/v1/auth/login'
        },
        timeWindow: '30s'
      });

      assert.equal(finding.triggered, false);
      assert.equal(finding.matchedConditions.includes('ISOLATED_AUTH_FAILURE_IGNORED_AS_SESSION_EXPIRY_OR_TYPO'), true);
    });

    test('Rule 2: Does NOT flag high-diversity crawler or doc reader with zero errors', () => {
      const rule = registry.getRule('RULE_ENDPOINT_ENUMERATION');
      const finding = rule.evaluate({
        features: {
          request_count: { value: 40 },
          unique_endpoint_count: { value: 35 },
          endpoint_diversity_ratio: { value: 0.875 },
          repeated_not_found_count: { value: 0 },
          resource_enumeration_score: { value: 0.0 }
        },
        timeWindow: '5m'
      });

      assert.equal(finding.triggered, false);
      assert.equal(finding.matchedConditions.includes('BENIGN_TRAVERSAL_NO_ERRORS'), true);
    });

    test('Rule 3: Does NOT flag SPA asset bundle bursts with diverse static assets', () => {
      const rule = registry.getRule('RULE_REQUEST_BURST');
      const finding = rule.evaluate({
        features: {
          burst_frequency_max_1s: { value: 30 },
          request_rate_per_sec: { value: 30.0 },
          endpoint_diversity_ratio: { value: 0.85 },
          http_4xx_ratio: { value: 0.0 }
        },
        timeWindow: '30s'
      });

      assert.equal(finding.triggered, false);
      assert.equal(finding.matchedConditions.includes('BENIGN_STATIC_ASSET_BURST_IDENTIFIED'), true);
    });

    test('Rule 5: Does NOT flag polling on /status endpoint with low enumeration score', () => {
      const rule = registry.getRule('RULE_REPEATED_RESOURCE_PROBING');
      const finding = rule.evaluate({
        features: {
          repeated_not_found_count: { value: 12 },
          repeated_endpoint_ratio: { value: 1.0 },
          unique_endpoint_count: { value: 1 },
          resource_enumeration_score: { value: 0.04 }
        },
        rawObservation: {
          normalizedRoute: '/api/v1/tasks/uuid-789/status'
        },
        timeWindow: '5m'
      });

      assert.equal(finding.triggered, false);
      assert.equal(finding.matchedConditions.includes('BENIGN_ASYNCHRONOUS_JOB_POLLING_IDENTIFIED'), true);
    });

    test('Rule 6: Excludes transient 503 server errors during backend restart', () => {
      const rule = registry.getRule('RULE_BEHAVIORAL_SHIFT');
      const finding = rule.evaluate({
        features: {
          rate_acceleration_ratio: { value: 4.0 },
          http_5xx_ratio: { value: 0.60 },
          http_4xx_ratio: { value: 0.0 }
        },
        rawObservation: { responseStatus: 503 },
        timeWindow: '5m'
      });

      assert.equal(finding.triggered, false);
      assert.equal(finding.severity, 'LOW');
    });
  });

  // =========================================================================
  // 3. Custom Isolation Forest Invariant Validation
  // =========================================================================
  describe('Isolation Forest Mathematical Invariants', () => {
    test('Standard BST average path length formula c(n) matches theory', () => {
      assert.equal(c(1), 0);
      assert.equal(c(2), 1);
      // For n=64: 2 * (ln(63) + 0.5772156649) - (2 * 63 / 64) ~= 2*(4.143 + 0.577) - 1.96875 ~= 7.47
      const c64 = c(64);
      assert.ok(c64 > 7.0 && c64 < 8.0, `c(64) was ${c64}`);
    });

    test('No artificial root-bounding box: Points outside training bounding box traverse trees naturally', () => {
      const trainingData = [
        [10.0, 10.0], [10.2, 9.8], [9.9, 10.1], [10.1, 10.0],
        [10.0, 9.9], [10.3, 10.2], [9.8, 10.0], [10.1, 10.1]
      ];
      const iforest = new IsolationForest({ numTrees: 25, sampleSize: 8, seed: 42 });
      iforest.fit(trainingData);

      // Mild shift point just outside bounding box: [10.4, 10.4]
      // In the old broken code, this would immediately return path length 1 (score 0.89).
      // In the corrected code, it traverses the tree.
      const mildShift = [10.4, 10.4];
      const mildScore = iforest.predict(mildShift).anomalyScore;
      assert.ok(mildScore < 0.70, `Mild shift score was unexpectedly high: ${mildScore}`);

      // Extreme outlier: [200.0, 200.0]
      const extremeOutlier = [200.0, 200.0];
      const extremePrediction = iforest.predict(extremeOutlier);
      assert.equal(extremePrediction.isAnomaly, true);
      assert.ok(extremePrediction.anomalyScore >= 0.75, `Extreme outlier score too low: ${extremePrediction.anomalyScore}`);
      assert.ok(extremePrediction.distributionShift.maxDivergence > 5.0, 'Out-of-distribution divergence detected');
    });

    test('Serialization and rehydration preserves exact predictions', () => {
      const trainingData = Array.from({ length: 30 }, (_, i) => [i * 0.5, (i % 5) * 1.0]);
      const original = new IsolationForest({ numTrees: 20, sampleSize: 16, seed: 123 });
      original.fit(trainingData);

      const json = original.toJSON();
      const restored = IsolationForest.fromJSON(json);

      const testSample = [7.5, 2.0];
      const origPred = original.predict(testSample);
      const restPred = restored.predict(testSample);

      assert.equal(origPred.anomalyScore, restPred.anomalyScore);
      assert.equal(origPred.isAnomaly, restPred.isAnomaly);
    });
  });

  // =========================================================================
  // 4. Statistical Baseline: Zero-MAD Floor Stability
  // =========================================================================
  describe('Statistical Baseline Zero-MAD Stability', () => {
    test('Constant training features (MAD = 0) do not explode modified Z-score to 674,500', () => {
      // 50 training observations where auth_failure_count is always 0.0
      const constantData = Array.from({ length: 50 }, () => [0.0, 5.0]);
      const detector = new StatisticalBaselineDetector();
      detector.fit(constantData);

      // Verify robust scale for constant column 0 floored at 1.0
      assert.equal(detector.scales[0], 1.0);

      // Test with a single auth failure: [1.0, 5.0]
      // In old code: division by 1e-6 -> Z = 0.6745 * 1 / 1e-6 = 674,500 -> score = 1.0
      // In corrected code: robust scale floors at 1.0 -> Z is small, score remains proportional
      const testPoint = [1.0, 5.0];
      const result = detector.predict(testPoint);

      assert.ok(result.anomalyScore < 0.60, `Score exploded on single non-zero value: ${result.anomalyScore}`);
      assert.equal(result.isAnomaly, false);
    });
  });

  // =========================================================================
  // 5. Training Provenance & Eligibility Classification
  // =========================================================================
  describe('Training Eligibility & Provenance', () => {
    test('Classifies feature sets into 6 explicit provenance labels', () => {
      const trainingService = new ModelTrainingService();

      // Complete clean benign feature set
      const cleanSet = {
        observationCount: 10,
        qualityMetadata: { completenessStatus: 'COMPLETE', telemetryLossDetected: false },
        features: {
          auth_failure_count: { value: 0 },
          resource_enumeration_score: { value: 0.0 },
          http_4xx_ratio: { value: 0.0 },
          http_5xx_ratio: { value: 0.0 }
        }
      };
      assert.equal(trainingService.classifyFeatureSetEligibility(cleanSet).provenance, 'TRUSTED_BENIGN');

      // Unreviewed normal diversity (mild non-critical errors)
      const unreviewedSet = {
        observationCount: 10,
        qualityMetadata: { completenessStatus: 'COMPLETE', telemetryLossDetected: false },
        features: {
          auth_failure_count: { value: 0 },
          resource_enumeration_score: { value: 0.0 },
          http_4xx_ratio: { value: 0.02 },
          http_5xx_ratio: { value: 0.0 }
        }
      };
      assert.equal(trainingService.classifyFeatureSetEligibility(unreviewedSet).provenance, 'UNREVIEWED');

      // Incomplete / degraded telemetry
      const degradedSet = {
        observationCount: 1,
        qualityMetadata: { completenessStatus: 'DEGRADED', telemetryLossDetected: true },
        features: {}
      };
      assert.equal(trainingService.classifyFeatureSetEligibility(degradedSet).provenance, 'INCOMPLETE');

      // High client error contamination with active attack assessment
      const contaminatedSet = {
        observationCount: 10,
        qualityMetadata: { completenessStatus: 'COMPLETE', telemetryLossDetected: false },
        features: {
          http_4xx_ratio: { value: 0.45 }
        }
      };
      const attackAssessment = [{ assessmentLabel: 'HIGHLY_SUSPICIOUS', riskScore: 0.95 }];
      assert.equal(trainingService.classifyFeatureSetEligibility(contaminatedSet, attackAssessment).provenance, 'CONTAMINATED');

      // Suspicious brute force / attack indicators (unreviewed high failure ratio >= 0.50 or auth_failure >= 5)
      const attackSet = {
        observationCount: 10,
        qualityMetadata: { completenessStatus: 'COMPLETE', telemetryLossDetected: false },
        features: {
          auth_failure_count: { value: 12 },
          http_4xx_ratio: { value: 0.80 }
        }
      };
      assert.equal(trainingService.classifyFeatureSetEligibility(attackSet).provenance, 'SUSPICIOUS');
    });
  });

  // =========================================================================
  // 6. Complete 24-Scenario Benchmark Accounting & Ambiguous Isolation
  // =========================================================================
  describe('Benchmark 24-Scenario Accounting & Partitioning', () => {
    const evaluator = new BenchmarkEvaluator();

    test('Evaluates exactly 24 scenarios without dropping degraded telemetry or ambiguous probes', () => {
      const report = evaluator.runEvaluation();

      assert.equal(report.totalScenarios, 24);
      assert.equal(report.partitions.trainingCount, 5);
      assert.equal(report.partitions.validationCount, 7);
      assert.equal(report.partitions.testCount, 12);

      // Verify accounting table has exactly 24 scenario rows
      assert.equal(report.accountingTable.length, 24);

      // Verify degraded telemetry scenarios (Scenarios 10 & 20) are explicitly accounted for
      const s10 = report.accountingTable.find((row) => row.scenarioKey === 'incomplete_telemetry');
      const s20 = report.accountingTable.find((row) => row.scenarioKey === 'telemetry_loss_during_session');

      assert.ok(s10, 'Scenario 10 must be in accounting table');
      assert.ok(s20, 'Scenario 20 must be in accounting table');
      assert.equal(s10.groundTruthIntent, 'TELEMETRY_QUALITY_DEGRADATION');
      assert.equal(s10.accountingVerdict, 'ACCURATELY_FLAGGED_DEGRADED');

      assert.equal(s20.groundTruthIntent, 'DEGRADED_TELEMETRY_LOSS');
      assert.equal(s20.accountingVerdict, 'ACCURATELY_FLAGGED_DEGRADED');

      // Verify ambiguous scenario (Scenario 05 repeated_not_found) is segregated
      const s05 = report.accountingTable.find((row) => row.scenarioKey === 'repeated_not_found');
      assert.ok(s05, 'Scenario 05 must be in accounting table');
      assert.equal(s05.groundTruthType, 'AMBIGUOUS');
      assert.ok(['AMBIGUOUS_ALERTED', 'AMBIGUOUS_QUIET', 'AMBIGUOUS_INSUFFICIENT'].includes(s05.accountingVerdict));

      // Verify new scenarios 21-24 are present
      assert.ok(report.accountingTable.some((r) => r.scenarioKey === 'benign_cors_preflight_stream'));
      assert.ok(report.accountingTable.some((r) => r.scenarioKey === 'distributed_endpoint_enumeration'));
      assert.ok(report.accountingTable.some((r) => r.scenarioKey === 'application_release_deployment'));
      assert.ok(report.accountingTable.some((r) => r.scenarioKey === 'credential_stuffing_distributed'));

      // Ensure execution evidence status remains MISSING across all scenarios
      assert.ok(report.disclaimers.some((d) => d.includes('Execution evidence remains strictly MISSING')));
    });

    test('Compares all 4 fusion strategies side-by-side with explicit denominators', () => {
      const report = evaluator.runEvaluation();
      assert.ok(report.fusionStrategyComparison.strategyA_Existing);
      assert.ok(report.fusionStrategyComparison.strategyB_Conservative);
      assert.ok(report.fusionStrategyComparison.strategyC_RulePriority);
      assert.ok(report.fusionStrategyComparison.strategyD_DataQualityAware);

      // Verify that Data-Quality Aware flags degraded telemetry cleanly
      assert.equal(report.fusionStrategyComparison.strategyD_DataQualityAware.insufficientEvidenceCount, 1);
      assert.equal(report.fusionStrategyComparison.strategyD_DataQualityAware.ambiguousCount, 1);
    });
  });
});
