/**
 * Stage 4C.3: Benchmark Reconciled Accounting & Invariants Test Suite
 *
 * Mathematically verifies:
 * 1. Held-out TEST partition denominators: TP + FN = 7, FP + TN = 4 across ALL detectors.
 * 2. Degraded scenarios are excluded from binary classification denominators (TP, FP, TN, FN).
 * 3. Ambiguous scenarios are excluded from binary classification denominators.
 * 4. Every scenario is accounted for exactly once (total = 24).
 * 5. Recomputed metrics (Precision, Recall, F1, FPR, FNR) match ground-truth formulas exactly.
 * 6. Machine-readable scenario-level outcomes exist for all 12 test scenarios.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { BenchmarkEvaluator, SCENARIO_PARTITIONS, BENCHMARK_PARTITIONS } from '../src/detection/evaluation/benchmark-evaluator.js';

describe('Stage 4C.3: Benchmark Accounting & Metric Invariants Suite', () => {
  const evaluator = new BenchmarkEvaluator();
  const report = evaluator.runEvaluation();

  test('1. Total scenario accounting equals exactly 24 across partitions', () => {
    assert.equal(report.totalScenarios, 24);
    assert.equal(report.accountingTable.length, 24);
    assert.equal(report.partitions.trainingCount, 5);
    assert.equal(report.partitions.validationCount, 7);
    assert.equal(report.partitions.testCount, 12);

    const keys = new Set(report.accountingTable.map((r) => r.scenarioKey));
    assert.equal(keys.size, 24, 'Every scenario must appear exactly once');
  });

  test('2. Held-out TEST partition has exact binary denominators: TP + FN = 7, FP + TN = 4 for ALL detectors', () => {
    const testReport = report.heldOutTestEvaluation;
    const branches = ['ruleOnly', 'iforestOnly', 'statisticalBaselineOnly', 'hybridAssessment'];

    for (const b of branches) {
      const metrics = testReport[b];
      assert.ok(metrics, `Branch "${b}" must exist in testReport`);

      const { tp, fn, fp, tn } = metrics.confusionMatrix;
      assert.equal(tp + fn, 7, `Branch "${b}": TP + FN must equal 7 (attacks evaluated)`);
      assert.equal(fp + tn, 4, `Branch "${b}": FP + TN must equal 4 (benign evaluated)`);
      assert.equal(metrics.attacksEvaluated, 7);
      assert.equal(metrics.benignEvaluated, 4);
      assert.equal(metrics.classifiedCount, 11, `Branch "${b}": Total classified must equal 11`);

      // Degraded scenario excluded from binary classification
      assert.equal(metrics.degradedAccounting.total, 1, `Branch "${b}": Must track 1 degraded scenario`);
      assert.equal(metrics.ambiguousAccounting.total, 0, `Branch "${b}": 0 ambiguous scenarios in TEST`);
      assert.equal(metrics.totalEvaluated, 12);
    }
  });

  test('3. Mathematical verification of metric formulas across all branches', () => {
    const testReport = report.heldOutTestEvaluation;
    const branches = ['ruleOnly', 'iforestOnly', 'statisticalBaselineOnly', 'hybridAssessment'];

    for (const b of branches) {
      const m = testReport[b];
      const { tp, fp, tn, fn } = m.confusionMatrix;

      const expectedPrecision = tp + fp > 0 ? Number((tp / (tp + fp)).toFixed(4)) : 0;
      const expectedRecall = tp + fn > 0 ? Number((tp / (tp + fn)).toFixed(4)) : 0;
      const expectedF1 = expectedPrecision + expectedRecall > 0
        ? Number(((2 * expectedPrecision * expectedRecall) / (expectedPrecision + expectedRecall)).toFixed(4))
        : 0;
      const expectedFPR = fp + tn > 0 ? Number((fp / (fp + tn)).toFixed(4)) : 0;
      const expectedFNR = fn + tp > 0 ? Number((fn / (fn + tp)).toFixed(4)) : 0;

      assert.equal(m.precision, expectedPrecision, `${b} precision mismatch`);
      assert.equal(m.recall, expectedRecall, `${b} recall mismatch`);
      assert.equal(m.f1Score, expectedF1, `${b} F1 mismatch`);
      assert.equal(m.falsePositiveRate, expectedFPR, `${b} FPR mismatch`);
      assert.equal(m.falseNegativeRate, expectedFNR, `${b} FNR mismatch`);
    }
  });

  test('4. Machine-readable scenario-level outcomes exist for all 12 test scenarios', () => {
    const outcomes = report.heldOutTestScenarioOutcomes;
    assert.ok(Array.isArray(outcomes));
    assert.equal(outcomes.length, 12);

    for (const row of outcomes) {
      assert.ok(row.scenarioId, 'Must have scenarioId');
      assert.ok(row.scenarioKey, 'Must have scenarioKey');
      assert.ok(row.groundTruthType, 'Must have groundTruthType');
      assert.equal(row.partition, 'TEST');
      assert.ok(row.ruleOnly && typeof row.ruleOnly.triggered === 'boolean');
      assert.ok(row.iforestOnly && typeof row.iforestOnly.anomalyScore === 'number');
      assert.ok(row.statisticalBaselineOnly && typeof row.statisticalBaselineOnly.anomalyScore === 'number');
      assert.ok(row.hybridAssessment && row.hybridAssessment.assessmentLabel);
      assert.ok(row.dataQuality && typeof row.dataQuality.completenessStatus === 'string');
      assert.ok(row.accountingVerdict, 'Must have accountingVerdict');
    }
  });

  test('5. Hybrid assessment is the ONLY branch that flags degraded telemetry as INSUFFICIENT_EVIDENCE', () => {
    const testReport = report.heldOutTestEvaluation;
    // Rule, iForest, Stat baseline treat degraded telemetry as normal/quiet
    assert.equal(testReport.ruleOnly.insufficientEvidenceCount, 0);
    assert.equal(testReport.iforestOnly.insufficientEvidenceCount, 0);
    assert.equal(testReport.statisticalBaselineOnly.insufficientEvidenceCount, 0);

    // Hybrid Assessment (Strategy D) actively gates degraded telemetry to INSUFFICIENT_EVIDENCE
    assert.equal(testReport.hybridAssessment.insufficientEvidenceCount, 1);
    assert.equal(testReport.hybridAssessment.degradedAccounting.flaggedInsufficient, 1);
  });

  test('6. Validation partition accounts for 1 ambiguous scenario and 1 degraded scenario', () => {
    const valReport = report.validationEvaluation;
    for (const b of ['ruleOnly', 'iforestOnly', 'statisticalBaselineOnly', 'hybridAssessment']) {
      const m = valReport[b];
      assert.equal(m.attacksEvaluated, 2, 'Validation attacks: repeated_login_failures, high_frequency_burst');
      assert.equal(m.benignEvaluated, 3, 'Validation benign: legitimate_login_retry, developer_exploration, shared_ip');
      assert.equal(m.ambiguousAccounting.total, 1, 'Validation ambiguous: repeated_not_found');
      assert.equal(m.degradedAccounting.total, 1, 'Validation degraded: incomplete_telemetry');
      assert.equal(m.totalEvaluated, 7);
    }
  });

  test('7. Latency profile reports multi-repetition percentile metrics with explicit context', () => {
    const lp = report.latencyProfile;
    assert.ok(lp);
    assert.equal(lp.repetitions, 200);
    assert.equal(lp.warmUpRuns, 20);
    assert.equal(lp.context.databaseAccessIncluded, false);
    assert.equal(lp.context.networkIOIncluded, false);

    for (const comp of ['ruleEngine', 'isolationForest', 'statisticalBaseline', 'hybridAssessment']) {
      assert.ok(lp.components[comp], `Missing latency component ${comp}`);
      assert.ok(lp.components[comp].meanMs > 0);
      assert.ok(lp.components[comp].medianMs > 0);
      assert.ok(lp.components[comp].p95Ms >= lp.components[comp].medianMs);
      assert.ok(lp.components[comp].p99Ms >= lp.components[comp].p95Ms);
    }
  });
});
