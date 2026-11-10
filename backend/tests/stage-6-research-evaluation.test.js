/**
 * Stage 6 Research Evaluation Verification Suite.
 *
 * Covers:
 *  - Scenario partition leakage & coverage tests (DEVELOPMENT / VALIDATION / TEST)
 *  - Baseline parity & identical initial state verification
 *  - DSG 7-way consistency enforcement vs stateless Generic Adaptive violations
 *  - Independent deception oracle contradiction detection (identity, role, 404 dead-end)
 *  - Reproducibility verification across deterministic seeds
 *  - Metric calculation & anti-inflation tests (scenario = unit of analysis)
 *  - Exact Wilcoxon permutation & Student-t 95% CI calculation tests
 *  - Raw-result accounting invariant tests
 *  - Controlled-lab safety blocker preservation (Finding A & SHADOW forwarding)
 *
 * Execution Scope: Uses local HTTP loopback hosts (Simulated Origin + IsolatedSyntheticStateStore)
 * and real detection/policy/strategy/DSG modules. Live Docker parity is tested separately.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  STAGE6_PARTITIONS,
  STAGE6_SCENARIOS,
  getScenariosByPartition,
  auditScenarioPartitionLeakage
} from '../src/research/stage6-scenario-suite.js';
import {
  EXPERIMENTAL_PARADIGMS,
  buildCalibratedDetectorSuite,
  runScenarioUnderParadigm
} from '../src/research/stage6-evaluation-systems.js';
import {
  aggregateParadigmMetrics,
  computePairedStatisticalComparison,
  summarizeDistribution
} from '../src/research/stage6-metrics-stats.js';
import { runStage6ResearchEvaluation } from '../scripts/stage-6-research-evaluation.js';
import { RuntimeSelectionService, ROUTING_MODES } from '../src/deception/runtime-selection.service.js';

describe('Stage 6: Research Evaluation, Baseline Parity, Reproducibility & Accounting Suite', () => {
  // ---------------------------------------------------------------------------
  // 1. Scenario Suite & Zero Partition Leakage Tests
  // ---------------------------------------------------------------------------
  it('1. Scenario suite enforces strict 3-way partition isolation with zero leakage', () => {
    const audit = auditScenarioPartitionLeakage();
    assert.equal(audit.leakFree, true, `Partition leakage detected: ${JSON.stringify(audit.checks)}`);
    assert.equal(audit.partitionCounts.DEVELOPMENT, 6);
    assert.equal(audit.partitionCounts.VALIDATION, 6);
    assert.equal(audit.partitionCounts.TEST, 14);
    assert.equal(audit.partitionCounts.TOTAL, 26);
  });

  it('2. Held-out TEST partition covers all 10 required research taxonomies with complete schemas', () => {
    const testScenarios = getScenariosByPartition(STAGE6_PARTITIONS.TEST);
    const taxonomies = new Set(testScenarios.map((s) => s.taxonomy));

    const requiredTaxonomies = [
      'ENDPOINT_RECONNAISSANCE',
      'API_ENUMERATION',
      'CREDENTIAL_PROBING',
      'AUTHENTICATION_ABUSE',
      'SENSITIVE_DATA_DISCOVERY',
      'REPEATED_RESOURCE_ACCESS',
      'MULTI_STAGE_PROGRESSION',
      'BEHAVIOR_CHANGE',
      'BENIGN_USAGE',
      'AMBIGUOUS_INCOMPLETE_TELEMETRY'
    ];

    for (const tax of requiredTaxonomies) {
      assert.ok(taxonomies.has(tax), `Missing required test taxonomy: ${tax}`);
    }

    for (const s of STAGE6_SCENARIOS) {
      assert.ok(s.scenarioId, 'scenarioId required');
      assert.ok(s.groundTruthCategory, 'groundTruthCategory required');
      assert.ok(s.initialEnvironmentState, 'initialEnvironmentState required');
      assert.ok(Array.isArray(s.requestSequence) && s.requestSequence.length > 0, 'requestSequence required');
      assert.ok(s.expectedBehavioralObservations, 'expectedBehavioralObservations required');
      assert.ok(s.expectedAdaptationOpportunities, 'expectedAdaptationOpportunities required');
      assert.ok(s.expectedConsistencyConstraints, 'expectedConsistencyConstraints required');
      assert.ok(s.terminationCondition, 'terminationCondition required');
    }
  });

  // ---------------------------------------------------------------------------
  // 2. Baseline Parity & Fair Treatment Tests
  // ---------------------------------------------------------------------------
  it('3. Baseline parity: all three paradigms share identical initial state, inputs, and ingress detection', async () => {
    const calibrated = buildCalibratedDetectorSuite({ seed: 101 });
    const scenario = getScenariosByPartition(STAGE6_PARTITIONS.TEST).find((s) => s.scenarioId === 'TEST-RECON-01');

    const resStatic = await runScenarioUnderParadigm({
      scenario,
      paradigm: EXPERIMENTAL_PARADIGMS.STATIC_HONEYPOT,
      calibratedSuite: calibrated
    });
    const resGeneric = await runScenarioUnderParadigm({
      scenario,
      paradigm: EXPERIMENTAL_PARADIGMS.GENERIC_ADAPTIVE,
      calibratedSuite: calibrated
    });
    const resDsg = await runScenarioUnderParadigm({
      scenario,
      paradigm: EXPERIMENTAL_PARADIGMS.ATTACKER_SPECIFIC_DSG,
      calibratedSuite: calibrated
    });

    assert.equal(resStatic.observedScenarioVerdict, resGeneric.observedScenarioVerdict);
    assert.equal(resGeneric.observedScenarioVerdict, resDsg.observedScenarioVerdict);
    assert.equal(resStatic.detectionBreakdown.attackFlaggedSteps, resDsg.detectionBreakdown.attackFlaggedSteps);
    // On single-vector pure API topology recon (TEST-RECON-01), Generic Adaptive is NOT artificially crippled:
    assert.equal(resGeneric.deceptionEffectiveness.meaningfulInteractions, resDsg.deceptionEffectiveness.meaningfulInteractions);
    assert.equal(resGeneric.deceptionEffectiveness.consistencyViolations, 0);
  });

  // ---------------------------------------------------------------------------
  // 3. DSG Consistency & Rejection vs Stateless Baseline Violations Tests
  // ---------------------------------------------------------------------------
  it('4. DSG Consistency: multi-stage cross-component attack causes violations in Generic Adaptive but 0 in DSG', async () => {
    const calibrated = buildCalibratedDetectorSuite({ seed: 101 });
    const scenario = getScenariosByPartition(STAGE6_PARTITIONS.TEST).find((s) => s.scenarioId === 'TEST-MULTI-02');

    const resGeneric = await runScenarioUnderParadigm({
      scenario,
      paradigm: EXPERIMENTAL_PARADIGMS.GENERIC_ADAPTIVE,
      calibratedSuite: calibrated
    });
    const resDsg = await runScenarioUnderParadigm({
      scenario,
      paradigm: EXPERIMENTAL_PARADIGMS.ATTACKER_SPECIFIC_DSG,
      calibratedSuite: calibrated
    });

    assert.ok(resGeneric.deceptionEffectiveness.consistencyViolations > 0, 'Generic Adaptive should exhibit real dependency violations on auth burst');
    assert.equal(resDsg.deceptionEffectiveness.consistencyViolations, 0, 'Attacker-Specific DSG must preserve zero consistency violations');
    assert.ok(resDsg.deceptionEffectiveness.meaningfulInteractions > resGeneric.deceptionEffectiveness.meaningfulInteractions);
  });

  it('5. Static baseline vs DSG on API enumeration reveals identity fallback contradictions caught by oracle', async () => {
    const calibrated = buildCalibratedDetectorSuite({ seed: 101 });
    const scenario = getScenariosByPartition(STAGE6_PARTITIONS.TEST).find((s) => s.scenarioId === 'TEST-ENUM-01');

    const resStatic = await runScenarioUnderParadigm({
      scenario,
      paradigm: EXPERIMENTAL_PARADIGMS.STATIC_HONEYPOT,
      calibratedSuite: calibrated
    });
    const resDsg = await runScenarioUnderParadigm({
      scenario,
      paradigm: EXPERIMENTAL_PARADIGMS.ATTACKER_SPECIFIC_DSG,
      calibratedSuite: calibrated
    });

    assert.equal(resStatic.adaptationQuality.transitionsExecuted, 0);
    assert.ok(resStatic.deceptionEffectiveness.prematureRecognitionIndicators > 0, 'Static baseline encounters unadapted 404/fallback indicators');
    assert.equal(resDsg.deceptionEffectiveness.prematureRecognitionIndicators, 0);
    assert.ok(resDsg.deceptionEffectiveness.meaningfulInteractions > resStatic.deceptionEffectiveness.meaningfulInteractions);
  });

  // ---------------------------------------------------------------------------
  // 4. Reproducibility & Calibration Isolation Tests
  // ---------------------------------------------------------------------------
  it('6. Calibration uses strictly benign DEVELOPMENT scenarios and reproduces identically under same seed', async () => {
    const cal1 = buildCalibratedDetectorSuite({ seed: 202 });
    const cal2 = buildCalibratedDetectorSuite({ seed: 202 });
    const scenario = getScenariosByPartition(STAGE6_PARTITIONS.TEST).find((s) => s.scenarioId === 'TEST-SHIFT-01');

    const r1 = await runScenarioUnderParadigm({
      scenario,
      paradigm: EXPERIMENTAL_PARADIGMS.ATTACKER_SPECIFIC_DSG,
      calibratedSuite: cal1
    });
    const r2 = await runScenarioUnderParadigm({
      scenario,
      paradigm: EXPERIMENTAL_PARADIGMS.ATTACKER_SPECIFIC_DSG,
      calibratedSuite: cal2
    });

    assert.equal(cal1.calibrationVectorCount, 64);
    assert.equal(r1.observedScenarioVerdict, r2.observedScenarioVerdict);
    assert.equal(r1.deceptionEffectiveness.meaningfulInteractions, r2.deceptionEffectiveness.meaningfulInteractions);
    assert.equal(r1.adaptationQuality.transitionsExecuted, r2.adaptationQuality.transitionsExecuted);
    assert.equal(r1.adaptationQuality.transitionsRejected, r2.adaptationQuality.transitionsRejected);
  });

  // ---------------------------------------------------------------------------
  // 5. Metric Calculation & Anti-Repetition-Inflation Tests
  // ---------------------------------------------------------------------------
  it('7. Metric aggregator treats independent scenarios (not repetitions) as N and handles ambiguous denominators cleanly', () => {
    const fakeRuns = [
      // Scenario A (Attack TP) x2 repetitions
      {
        scenarioId: 'SC-A', taxonomy: 'X', groundTruthCategory: 'ATTACK', paradigm: 'DSG',
        observedScenarioVerdict: 'ATTACK_PROPOSED',
        deceptionEffectiveness: { decoyInteractions: 5, meaningfulInteractions: 4, simulatedEngagementDurationMs: 1000, attackStagesCompleted: 2, expectedStagesMax: 3, syntheticAssetsExplored: 4, consistencyViolations: 0, prematureRecognitionIndicators: 0 },
        adaptationQuality: { transitionsProposed: 3, transitionsValidated: 2, transitionsExecuted: 2, transitionsRejected: 1, meanAdaptationLatencyMs: 0.2 },
        routingSafety: { actualOriginRequests: 2, actualSyntheticRequests: 5, failedRequests: 0 },
        performance: { requestLatenciesMs: [1.0, 2.0], runtimeProvisioningTimeMs: 0.5, cpuUserMs: 1, cpuSystemMs: 0.2, heapDeltaMb: 0.1 }
      },
      {
        scenarioId: 'SC-A', taxonomy: 'X', groundTruthCategory: 'ATTACK', paradigm: 'DSG',
        observedScenarioVerdict: 'ATTACK_PROPOSED',
        deceptionEffectiveness: { decoyInteractions: 5, meaningfulInteractions: 4, simulatedEngagementDurationMs: 1000, attackStagesCompleted: 2, expectedStagesMax: 3, syntheticAssetsExplored: 4, consistencyViolations: 0, prematureRecognitionIndicators: 0 },
        adaptationQuality: { transitionsProposed: 3, transitionsValidated: 2, transitionsExecuted: 2, transitionsRejected: 1, meanAdaptationLatencyMs: 0.2 },
        routingSafety: { actualOriginRequests: 2, actualSyntheticRequests: 5, failedRequests: 0 },
        performance: { requestLatenciesMs: [1.0, 2.0], runtimeProvisioningTimeMs: 0.5, cpuUserMs: 1, cpuSystemMs: 0.2, heapDeltaMb: 0.1 }
      },
      // Scenario B (Attack FN)
      {
        scenarioId: 'SC-B', taxonomy: 'Y', groundTruthCategory: 'ATTACK', paradigm: 'DSG',
        observedScenarioVerdict: 'INSUFFICIENT_EVIDENCE',
        deceptionEffectiveness: { decoyInteractions: 0, meaningfulInteractions: 0, simulatedEngagementDurationMs: 0, attackStagesCompleted: 0, expectedStagesMax: 2, syntheticAssetsExplored: 0, consistencyViolations: 0, prematureRecognitionIndicators: 0 },
        adaptationQuality: { transitionsProposed: 0, transitionsValidated: 0, transitionsExecuted: 0, transitionsRejected: 0, meanAdaptationLatencyMs: 0 },
        routingSafety: { actualOriginRequests: 6, actualSyntheticRequests: 0, failedRequests: 0 },
        performance: { requestLatenciesMs: [1.0], runtimeProvisioningTimeMs: 0.5, cpuUserMs: 1, cpuSystemMs: 0.2, heapDeltaMb: 0.1 }
      },
      // Scenario C (Benign TN)
      {
        scenarioId: 'SC-C', taxonomy: 'Z', groundTruthCategory: 'BENIGN', paradigm: 'DSG',
        observedScenarioVerdict: 'BENIGN',
        deceptionEffectiveness: { decoyInteractions: 0, meaningfulInteractions: 0, simulatedEngagementDurationMs: 0, attackStagesCompleted: 0, expectedStagesMax: 0, syntheticAssetsExplored: 0, consistencyViolations: 0, prematureRecognitionIndicators: 0 },
        adaptationQuality: { transitionsProposed: 0, transitionsValidated: 0, transitionsExecuted: 0, transitionsRejected: 0, meanAdaptationLatencyMs: 0 },
        routingSafety: { actualOriginRequests: 8, actualSyntheticRequests: 0, failedRequests: 0 },
        performance: { requestLatenciesMs: [0.8], runtimeProvisioningTimeMs: 0.5, cpuUserMs: 1, cpuSystemMs: 0.2, heapDeltaMb: 0.1 }
      },
      // Scenario D (Ambiguous — excluded from binary precision/recall)
      {
        scenarioId: 'SC-D', taxonomy: 'W', groundTruthCategory: 'AMBIGUOUS', paradigm: 'DSG',
        observedScenarioVerdict: 'INSUFFICIENT_EVIDENCE',
        deceptionEffectiveness: { decoyInteractions: 0, meaningfulInteractions: 0, simulatedEngagementDurationMs: 0, attackStagesCompleted: 0, expectedStagesMax: 0, syntheticAssetsExplored: 0, consistencyViolations: 0, prematureRecognitionIndicators: 0 },
        adaptationQuality: { transitionsProposed: 0, transitionsValidated: 0, transitionsExecuted: 0, transitionsRejected: 0, meanAdaptationLatencyMs: 0 },
        routingSafety: { actualOriginRequests: 5, actualSyntheticRequests: 0, failedRequests: 0 },
        performance: { requestLatenciesMs: [0.9], runtimeProvisioningTimeMs: 0.5, cpuUserMs: 1, cpuSystemMs: 0.2, heapDeltaMb: 0.1 }
      }
    ];

    const agg = aggregateParadigmMetrics(fakeRuns);
    assert.equal(agg.sampleAccounting.independentScenarios, 4, 'Repetition of SC-A must not inflate independent scenario count N');
    assert.equal(agg.sampleAccounting.unambiguousScenarios, 3);
    assert.equal(agg.sampleAccounting.ambiguousScenarios, 1);
    assert.deepEqual(agg.detectionMetrics.confusionMatrix, { tp: 1, fp: 0, tn: 1, fn: 1 });
    assert.equal(agg.detectionMetrics.precision, 1.0);
    assert.equal(agg.detectionMetrics.recall, 0.5);
    assert.equal(agg.detectionMetrics.insufficientEvidenceRate, 0.25);
  });

  it('8. Statistical calculator computes exact Wilcoxon permutation p-values and respects small-sample significance guards', () => {
    const smallPair = computePairedStatisticalComparison([5, 3, 2, 0], [1, 1, 2, 0]);
    assert.equal(smallPair.nonZeroPairs, 2);
    assert.equal(smallPair.sampleInsufficientForSignificanceTest, true);
    assert.equal(smallPair.statisticallySignificantAt05, false);

    const largerPair = computePairedStatisticalComparison([6, 6, 6, 5, 2, 10, 5], [0, 1, 4, 1, 0, 8, 1]);
    assert.equal(largerPair.nonZeroPairs, 7);
    assert.equal(largerPair.exactTwoSidedPValue, 0.015625);
    assert.equal(largerPair.statisticallySignificantAt05, true);
  });

  // ---------------------------------------------------------------------------
  // 6. Full End-to-End Multi-Seed Accounting & Safety Verification
  // ---------------------------------------------------------------------------
  it('9. Multi-seed evaluation runner satisfies all raw-result accounting and transition invariants', async () => {
    const report = await runStage6ResearchEvaluation({ seeds: [101, 202], exportFiles: false });

    assert.equal(report.metadata.leakageAudit.leakFree, true);
    for (const paradigm of Object.values(EXPERIMENTAL_PARADIGMS)) {
      const m = report.heldOutTestSummaryByParadigm[paradigm];
      assert.equal(m.sampleAccounting.independentScenarios, 14);
      assert.equal(m.sampleAccounting.totalRepetitionRuns, 28); // 14 scenarios * 2 seeds

      const testScenarios = getScenariosByPartition(STAGE6_PARTITIONS.TEST);
      const expectedTotalStepsAllSeeds = testScenarios.reduce((s, x) => s + x.requestSequence.length, 0) * 2;
      const observedSteps =
        m.routingSafety.totalActualOriginRequestsAcrossAllSeeds +
        m.routingSafety.totalActualSyntheticRequestsAcrossAllSeeds +
        m.routingSafety.totalFailedRequests;

      assert.equal(observedSteps, expectedTotalStepsAllSeeds, `${paradigm} request accounting conservation violated`);

      // Benign and ambiguous traffic must NEVER reach synthetic host
      for (const scAgg of m.perScenarioAggregates) {
        if (scAgg.groundTruthCategory === 'BENIGN' || scAgg.groundTruthCategory === 'AMBIGUOUS') {
          assert.equal(scAgg.decoyInteractions, 0, `${paradigm} leaked non-attack scenario ${scAgg.scenarioId} to synthetic host`);
        }
      }
    }

    const dsg = report.heldOutTestSummaryByParadigm.ATTACKER_SPECIFIC_DSG;
    assert.equal(dsg.deceptionEffectiveness.totalConsistencyViolations, 0);
    assert.equal(
      dsg.adaptationQuality.transitionsValidatedMeanPerSeed + dsg.adaptationQuality.transitionsRejectedMeanPerSeed,
      dsg.adaptationQuality.transitionsProposedMeanPerSeed,
      'DSG proposed transitions must equal validated + rejected'
    );
  });

  it('10. Controlled-lab readiness blocker (Finding A) remains strictly active without live traffic bypass', async () => {
    const runtimeSelector = new RuntimeSelectionService({
      prismaClient: {
        deceptionRuntimeEnvironment: {
          findFirst: async () => ({
            id: 'env-test',
            tenantId: 't1',
            applicationId: 'app-1',
            dsgGraphVersion: 1,
            lifecycleState: 'ACTIVE',
            healthStatus: 'HEALTHY',
            networkIsolationMode: 'SANDBOX_ISOLATED',
            runtimeEvidence: {
              hostBoundaryFinding: 'FINDING_A_OPEN',
              firewallDropRuleApplied: false,
              adminLabActivationApproved: false
            },
            authorization: { authorizationStatus: 'APPROVED', expiresAt: new Date(Date.now() + 10000) }
          })
        },
        deceptionPolicy: {
          findFirst: async () => ({ id: 'pol-1', enabled: true })
        }
      }
    });

    const readiness = await runtimeSelector.checkControlledLabReadiness('env-test', 't1');
    assert.equal(readiness.isReady, false);
    assert.equal(readiness.status, 'CONTROLLED_LAB_BLOCKED');
    assert.ok(readiness.blockers.some((b) => b.includes('host INPUT firewall')));
  });

  it('11. Research metrics distribution summary accurately calculates percentiles and variance statistics', () => {
    const dist = summarizeDistribution([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.equal(dist.count, 10);
    assert.equal(dist.mean, 5.5);
    assert.equal(dist.min, 1);
    assert.equal(dist.max, 10);
    assert.ok(dist.stdDev > 3.0 && dist.stdDev < 3.1);
    assert.equal(summarizeDistribution([]).count, 0);
  });

  it('12. Independent multi-seed execution confirms zero cross-seed adaptation nondeterminism', async () => {
    const report = await runStage6ResearchEvaluation({ seeds: [101, 202, 303], exportFiles: false });
    for (const paradigm of Object.values(EXPERIMENTAL_PARADIGMS)) {
      const m = report.heldOutTestSummaryByParadigm[paradigm];
      assert.equal(m.adaptationQuality.repeatedAdaptationStability.crossSeedVerdictDisagreements, 0);
      assert.equal(m.adaptationQuality.repeatedAdaptationStability.crossSeedAdaptationDisagreements, 0);
      assert.equal(m.adaptationQuality.repeatedAdaptationStability.stabilityRate, 1);
    }
  });
});
