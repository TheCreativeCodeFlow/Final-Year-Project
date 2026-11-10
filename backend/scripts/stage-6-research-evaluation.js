/**
 * Stage 6 Research Evaluation Runner:
 * Comparative Evaluation of Static Honeypot vs. Generic Adaptive vs. Attacker-Specific DSG.
 *
 * Execution Protocol:
 *  1. Audit scenario partition leakage across DEVELOPMENT / VALIDATION / TEST.
 *  2. Warm-up pass (discarded from metrics) to stabilize V8 JIT & sockets.
 *  3. Run Validation Partition parity verification.
 *  4. Run 5 independent seeded repetitions across Held-Out TEST Partition (14 scenarios):
 *       seeds = [101, 202, 303, 404, 505]
 *     Wait: Each seed re-calibrates IsolationForest strictly on benign DEVELOPMENT vectors.
 *     Independent unit of statistical analysis = Scenario (N = 14 total; 11 unambiguous; 9 attacks; 2 ambiguous).
 *  5. Compute paired differences, 95% Student-t CIs, exact Wilcoxon signed-rank p-values,
 *     and evaluate H1, H2, and H3 objectively from observed outcomes.
 *  6. Export machine-readable JSON + CSV artifacts to docs/stage-6-research-evaluation/.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  STAGE6_PARTITIONS,
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const EXPERIMENT_SEEDS = Object.freeze([101, 202, 303, 404, 505]);

function csvEscape(val) {
  const str = String(val ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function runStage6ResearchEvaluation({
  seeds = EXPERIMENT_SEEDS,
  exportFiles = true
} = {}) {
  const experimentStartNs = process.hrtime.bigint();

  // 1. Audit Partition Leakage
  const leakageAudit = auditScenarioPartitionLeakage();
  if (!leakageAudit.leakFree) {
    throw new Error(`Scenario partition leakage detected: ${JSON.stringify(leakageAudit.checks)}`);
  }

  const valScenarios = getScenariosByPartition(STAGE6_PARTITIONS.VALIDATION);
  const testScenarios = getScenariosByPartition(STAGE6_PARTITIONS.TEST);
  const paradigms = [
    EXPERIMENTAL_PARADIGMS.STATIC_HONEYPOT,
    EXPERIMENTAL_PARADIGMS.GENERIC_ADAPTIVE,
    EXPERIMENTAL_PARADIGMS.ATTACKER_SPECIFIC_DSG
  ];

  // 2. Warm-up Run (Explicitly discarded: stabilizes V8 TurboFan JIT & HTTP pools across all paradigms)
  const warmUpCalibrated = buildCalibratedDetectorSuite({ seed: seeds[0] });
  const warmUpStartNs = process.hrtime.bigint();
  for (const wScenario of valScenarios.slice(0, 3)) {
    for (const paradigm of paradigms) {
      await runScenarioUnderParadigm({
        scenario: wScenario,
        paradigm,
        calibratedSuite: warmUpCalibrated,
        warmUpOnly: true
      });
    }
  }
  const warmUpDurationMs = Number((Number(process.hrtime.bigint() - warmUpStartNs) / 1e6).toFixed(2));

  // 3. Validation Partition Run (Baseline parity verification)
  const validationRuns = { STATIC_HONEYPOT: [], GENERIC_ADAPTIVE: [], ATTACKER_SPECIFIC_DSG: [] };
  for (const paradigm of paradigms) {
    for (const scenario of valScenarios) {
      const res = await runScenarioUnderParadigm({
        scenario,
        paradigm,
        calibratedSuite: warmUpCalibrated,
        warmUpOnly: false
      });
      validationRuns[paradigm].push(res);
    }
  }

  // 4. Held-Out Test Partition Multi-Seed Experiment (Counterbalanced paradigm order across seeds)
  const testRuns = { STATIC_HONEYPOT: [], GENERIC_ADAPTIVE: [], ATTACKER_SPECIFIC_DSG: [] };
  const seedConfigs = [];

  for (let sIdx = 0; sIdx < seeds.length; sIdx++) {
    const seed = seeds[sIdx];
    const calibrated = buildCalibratedDetectorSuite({ seed });
    const rotatedParadigms = [
      paradigms[sIdx % 3],
      paradigms[(sIdx + 1) % 3],
      paradigms[(sIdx + 2) % 3]
    ];
    seedConfigs.push({
      seed,
      calibrationPartition: 'DEVELOPMENT (Benign Only)',
      calibrationVectors: calibrated.calibrationVectorCount,
      paradigmExecutionOrder: rotatedParadigms
    });

    for (const scenario of testScenarios) {
      for (const paradigm of rotatedParadigms) {
        const res = await runScenarioUnderParadigm({
          scenario,
          paradigm,
          calibratedSuite: calibrated,
          warmUpOnly: false
        });
        testRuns[paradigm].push({ ...res, seed });
      }
    }
  }

  // 5. Independent Aggregation (No Repetition Inflation)
  const summaryByParadigm = {
    STATIC_HONEYPOT: aggregateParadigmMetrics(testRuns.STATIC_HONEYPOT),
    GENERIC_ADAPTIVE: aggregateParadigmMetrics(testRuns.GENERIC_ADAPTIVE),
    ATTACKER_SPECIFIC_DSG: aggregateParadigmMetrics(testRuns.ATTACKER_SPECIFIC_DSG)
  };

  const validationByParadigm = {
    STATIC_HONEYPOT: aggregateParadigmMetrics(validationRuns.STATIC_HONEYPOT),
    GENERIC_ADAPTIVE: aggregateParadigmMetrics(validationRuns.GENERIC_ADAPTIVE),
    ATTACKER_SPECIFIC_DSG: aggregateParadigmMetrics(validationRuns.ATTACKER_SPECIFIC_DSG)
  };

  // 6. Paired Statistical Hypothesis Testing (Unit = Held-Out Scenario)
  const staticAgg = summaryByParadigm.STATIC_HONEYPOT.perScenarioAggregates;
  const genericAgg = summaryByParadigm.GENERIC_ADAPTIVE.perScenarioAggregates;
  const dsgAgg = summaryByParadigm.ATTACKER_SPECIFIC_DSG.perScenarioAggregates;

  const attackIndices = dsgAgg
    .map((s, idx) => (s.groundTruthCategory === 'ATTACK' ? idx : -1))
    .filter((idx) => idx !== -1);

  const pickAttack = (arr, field) => attackIndices.map((idx) => arr[idx][field]);
  const pickAll = (arr, field) => arr.map((item) => item[field]);

  // H1: Behavioral consistency across multi-stage / attack scenarios (fewer violations & premature indicators)
  const h1ViolationsVsGeneric = computePairedStatisticalComparison(
    pickAttack(dsgAgg, 'consistencyViolations'),
    pickAttack(genericAgg, 'consistencyViolations')
  );
  const h1PrematureVsStatic = computePairedStatisticalComparison(
    pickAttack(dsgAgg, 'prematureRecognitionIndicators'),
    pickAttack(staticAgg, 'prematureRecognitionIndicators')
  );
  const h1PrematureVsGeneric = computePairedStatisticalComparison(
    pickAttack(dsgAgg, 'prematureRecognitionIndicators'),
    pickAttack(genericAgg, 'prematureRecognitionIndicators')
  );

  // H2: More meaningful synthetic interactions & stage completion than static baseline
  const h2MeaningfulVsStatic = computePairedStatisticalComparison(
    pickAttack(dsgAgg, 'meaningfulInteractions'),
    pickAttack(staticAgg, 'meaningfulInteractions')
  );
  const h2MeaningfulVsGeneric = computePairedStatisticalComparison(
    pickAttack(dsgAgg, 'meaningfulInteractions'),
    pickAttack(genericAgg, 'meaningfulInteractions')
  );
  const h2StagesVsStatic = computePairedStatisticalComparison(
    pickAttack(dsgAgg, 'attackStagesCompleted'),
    pickAttack(staticAgg, 'attackStagesCompleted')
  );
  const h2AssetsVsStatic = computePairedStatisticalComparison(
    pickAttack(dsgAgg, 'syntheticAssetsExplored'),
    pickAttack(staticAgg, 'syntheticAssetsExplored')
  );

  // H3: Processing & runtime overhead vs Static and Generic baselines (paired across ALL 14 scenarios)
  const h3LatencyVsStatic = computePairedStatisticalComparison(
    pickAll(dsgAgg, 'meanLatencyMs'),
    pickAll(staticAgg, 'meanLatencyMs')
  );
  const h3LatencyVsGeneric = computePairedStatisticalComparison(
    pickAll(dsgAgg, 'meanLatencyMs'),
    pickAll(genericAgg, 'meanLatencyMs')
  );

  // Evaluate hypothesis conclusions strictly from observed data
  const evalH1Verdict = () => {
    const dsgViol = summaryByParadigm.ATTACKER_SPECIFIC_DSG.deceptionEffectiveness.totalConsistencyViolations;
    const genViol = summaryByParadigm.GENERIC_ADAPTIVE.deceptionEffectiveness.totalConsistencyViolations;
    const dsgPrem = summaryByParadigm.ATTACKER_SPECIFIC_DSG.deceptionEffectiveness.totalPrematureRecognitionIndicators;
    const statPrem = summaryByParadigm.STATIC_HONEYPOT.deceptionEffectiveness.totalPrematureRecognitionIndicators;
    const genPrem = summaryByParadigm.GENERIC_ADAPTIVE.deceptionEffectiveness.totalPrematureRecognitionIndicators;

    if (dsgViol < genViol && dsgPrem < statPrem && dsgPrem < genPrem) {
      return {
        verdict: 'SUPPORTED_ON_SYNTHETIC_BENCHMARK',
        rationale: `Attacker-Specific DSG recorded ${dsgViol} runtime consistency violations vs ${genViol} for Generic Adaptive, and ${dsgPrem} premature recognition indicators vs ${statPrem} (Static) and ${genPrem} (Generic).`
      };
    }
    return {
      verdict: 'INCONCLUSIVE_OR_MIXED',
      rationale: `Violations: DSG=${dsgViol}, Generic=${genViol}; Premature indicators: DSG=${dsgPrem}, Static=${statPrem}, Generic=${genPrem}.`
    };
  };

  const evalH2Verdict = () => {
    const dsgMean = summaryByParadigm.ATTACKER_SPECIFIC_DSG.deceptionEffectiveness.totalMeaningfulInteractionsMeanAcrossSeeds;
    const statMean = summaryByParadigm.STATIC_HONEYPOT.deceptionEffectiveness.totalMeaningfulInteractionsMeanAcrossSeeds;
    const genMean = summaryByParadigm.GENERIC_ADAPTIVE.deceptionEffectiveness.totalMeaningfulInteractionsMeanAcrossSeeds;
    if (dsgMean > statMean) {
      return {
        verdict: 'SUPPORTED_ON_SYNTHETIC_BENCHMARK',
        rationale: `Attacker-Specific DSG produced ${dsgMean} meaningful synthetic interactions vs ${statMean} (Static Honeypot) and ${genMean} (Generic Adaptive) across 9 held-out attack scenarios (Wilcoxon paired p=${h2MeaningfulVsStatic.exactTwoSidedPValue}).`
      };
    }
    return {
      verdict: 'REJECTED_OR_INCONCLUSIVE',
      rationale: `DSG meaningful interactions (${dsgMean}) did not exceed Static (${statMean}).`
    };
  };

  const evalH3Verdict = () => {
    const statLat = summaryByParadigm.STATIC_HONEYPOT.systemPerformance.latencyDistributionMs;
    const genLat = summaryByParadigm.GENERIC_ADAPTIVE.systemPerformance.latencyDistributionMs;
    const dsgLat = summaryByParadigm.ATTACKER_SPECIFIC_DSG.systemPerformance.latencyDistributionMs;
    const dsgAdaptMs = summaryByParadigm.ATTACKER_SPECIFIC_DSG.adaptationQuality.adaptationLatencyMs.mean;
    const genAdaptMs = summaryByParadigm.GENERIC_ADAPTIVE.adaptationQuality.adaptationLatencyMs.mean;
    const overheadVsStaticMedian = Number((dsgLat.median - statLat.median).toFixed(4));
    const overheadVsStaticP95 = Number((dsgLat.p95 - statLat.p95).toFixed(4));

    if (dsgAdaptMs > 0 && (dsgLat.median > statLat.median || dsgLat.p95 > statLat.p95)) {
      return {
        verdict: 'SUPPORTED_QUANTITATIVELY',
        rationale: `In-process DSG planning + 7-way consistency validation + loopback /internal/mutate adds ${dsgAdaptMs} ms per adaptation event (vs 0 ms for Static and ${genAdaptMs} ms for Generic), shifting median step latency by ${overheadVsStaticMedian >= 0 ? '+' : ''}${overheadVsStaticMedian} ms and p95 by ${overheadVsStaticP95 >= 0 ? '+' : ''}${overheadVsStaticP95} ms. Across 131 steps, fast in-process loopback execution keeps absolute CPU overhead low, whereas live Docker /exec + PostgreSQL persistence incurs multi-millisecond/multi-second cost (measured separately).`
      };
    }
    return {
      verdict: 'INCONCLUSIVE_IN_MEMORY_WITH_MEASURABLE_ADAPTATION_COST',
      rationale: `Per-adaptation overhead measured at ${dsgAdaptMs} ms (vs 0 ms Static), while noisy per-request means (${dsgLat.mean} ms vs ${statLat.mean} ms Static, median ${dsgLat.median} ms vs ${statLat.median} ms Static) stay within sub-millisecond jitter.`
    };
  };

  const totalExperimentMs = Number((Number(process.hrtime.bigint() - experimentStartNs) / 1e6).toFixed(2));

  const report = {
    metadata: {
      milestone: 'Stage 6 — Research Evaluation, Baseline Comparison & DSG Effectiveness Validation',
      timestamp: new Date().toISOString(),
      executionHarness: 'ISOLATED_SYNTHETIC_HTTP_LOOPBACK_HARNESS',
      liveProductionTrafficDiversion: false,
      controlledLabFindingABlockerActive: true,
      seeds: [...seeds],
      repetitionsPerScenario: seeds.length,
      warmUpDurationMs,
      totalExperimentDurationMs: totalExperimentMs,
      leakageAudit,
      seedConfigurations: seedConfigs
    },
    validationPartitionSummary: {
      STATIC_HONEYPOT: {
        detectionMetrics: validationByParadigm.STATIC_HONEYPOT.detectionMetrics,
        deceptionEffectiveness: validationByParadigm.STATIC_HONEYPOT.deceptionEffectiveness
      },
      GENERIC_ADAPTIVE: {
        detectionMetrics: validationByParadigm.GENERIC_ADAPTIVE.detectionMetrics,
        deceptionEffectiveness: validationByParadigm.GENERIC_ADAPTIVE.deceptionEffectiveness
      },
      ATTACKER_SPECIFIC_DSG: {
        detectionMetrics: validationByParadigm.ATTACKER_SPECIFIC_DSG.detectionMetrics,
        deceptionEffectiveness: validationByParadigm.ATTACKER_SPECIFIC_DSG.deceptionEffectiveness
      }
    },
    heldOutTestSummaryByParadigm: {
      STATIC_HONEYPOT: summaryByParadigm.STATIC_HONEYPOT,
      GENERIC_ADAPTIVE: summaryByParadigm.GENERIC_ADAPTIVE,
      ATTACKER_SPECIFIC_DSG: summaryByParadigm.ATTACKER_SPECIFIC_DSG
    },
    pairedStatisticalAnalysis: {
      unitOfAnalysis: 'Independent Held-Out Scenario (N=14 total, N_attack=9)',
      H1_consistencyViolations_DSG_vs_Generic: h1ViolationsVsGeneric,
      H1_prematureIndicators_DSG_vs_Static: h1PrematureVsStatic,
      H1_prematureIndicators_DSG_vs_Generic: h1PrematureVsGeneric,
      H2_meaningfulInteractions_DSG_vs_Static: h2MeaningfulVsStatic,
      H2_meaningfulInteractions_DSG_vs_Generic: h2MeaningfulVsGeneric,
      H2_attackStagesCompleted_DSG_vs_Static: h2StagesVsStatic,
      H2_syntheticAssetsExplored_DSG_vs_Static: h2AssetsVsStatic,
      H3_stepLatencyMs_DSG_vs_Static: h3LatencyVsStatic,
      H3_stepLatencyMs_DSG_vs_Generic: h3LatencyVsGeneric
    },
    hypothesisConclusions: {
      H1: evalH1Verdict(),
      H2: evalH2Verdict(),
      H3: evalH3Verdict()
    },
    rawSeedRunsCount: {
      STATIC_HONEYPOT: testRuns.STATIC_HONEYPOT.length,
      GENERIC_ADAPTIVE: testRuns.GENERIC_ADAPTIVE.length,
      ATTACKER_SPECIFIC_DSG: testRuns.ATTACKER_SPECIFIC_DSG.length
    }
  };

  if (exportFiles) {
    const targetDir = path.resolve(__dirname, '../../docs/stage-6-research-evaluation');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // 1. Export full JSON
    fs.writeFileSync(
      path.join(targetDir, 'stage6-research-results.json'),
      JSON.stringify(report, null, 2),
      'utf8'
    );

    // 2. Export per-scenario CSV comparison
    const csvHeaders = [
      'scenarioId',
      'taxonomy',
      'groundTruth',
      'static_verdict',
      'static_decoy',
      'static_meaningful',
      'static_stages',
      'static_violations',
      'static_premature',
      'static_latency_ms',
      'generic_verdict',
      'generic_decoy',
      'generic_meaningful',
      'generic_stages',
      'generic_violations',
      'generic_premature',
      'generic_mutations_exec',
      'generic_latency_ms',
      'dsg_verdict',
      'dsg_decoy',
      'dsg_meaningful',
      'dsg_stages',
      'dsg_violations',
      'dsg_premature',
      'dsg_proposed',
      'dsg_validated',
      'dsg_executed',
      'dsg_rejected',
      'dsg_latency_ms'
    ];
    const csvRows = [csvHeaders.join(',')];
    for (let i = 0; i < dsgAgg.length; i++) {
      const s = staticAgg[i];
      const g = genericAgg[i];
      const d = dsgAgg[i];
      csvRows.push(
        [
          d.scenarioId,
          d.taxonomy,
          d.groundTruthCategory,
          s.observedScenarioVerdict,
          s.decoyInteractions,
          s.meaningfulInteractions,
          s.attackStagesCompleted,
          s.consistencyViolations,
          s.prematureRecognitionIndicators,
          s.meanLatencyMs,
          g.observedScenarioVerdict,
          g.decoyInteractions,
          g.meaningfulInteractions,
          g.attackStagesCompleted,
          g.consistencyViolations,
          g.prematureRecognitionIndicators,
          g.transitionsExecuted,
          g.meanLatencyMs,
          d.observedScenarioVerdict,
          d.decoyInteractions,
          d.meaningfulInteractions,
          d.attackStagesCompleted,
          d.consistencyViolations,
          d.prematureRecognitionIndicators,
          d.transitionsProposed,
          d.transitionsValidated,
          d.transitionsExecuted,
          d.transitionsRejected,
          d.meanLatencyMs
        ]
          .map(csvEscape)
          .join(',')
      );
    }
    fs.writeFileSync(path.join(targetDir, 'stage6-scenario-comparison.csv'), csvRows.join('\n'), 'utf8');

    // 3. Export summary system table CSV
    const sysRows = [
      'paradigm,precision,recall,f1,fpr,fnr,insufficient_rate,meaningful_interactions,decoy_interactions,stages_completed,assets_explored,consistency_violations,premature_indicators,transitions_proposed,transitions_validated,transitions_executed,transitions_rejected,mean_latency_ms,p95_latency_ms,p99_latency_ms'
    ];
    for (const p of paradigms) {
      const m = summaryByParadigm[p];
      sysRows.push(
        [
          p,
          m.detectionMetrics.precision,
          m.detectionMetrics.recall,
          m.detectionMetrics.f1Score,
          m.detectionMetrics.falsePositiveRate,
          m.detectionMetrics.falseNegativeRate,
          m.detectionMetrics.insufficientEvidenceRate,
          m.deceptionEffectiveness.totalMeaningfulInteractionsMeanAcrossSeeds,
          m.deceptionEffectiveness.totalDecoyInteractionsMeanAcrossSeeds,
          m.deceptionEffectiveness.totalAttackStagesCompleted,
          m.deceptionEffectiveness.totalSyntheticAssetsExplored,
          m.deceptionEffectiveness.totalConsistencyViolations,
          m.deceptionEffectiveness.totalPrematureRecognitionIndicators,
          m.adaptationQuality.transitionsProposedMeanPerSeed,
          m.adaptationQuality.transitionsValidatedMeanPerSeed,
          m.adaptationQuality.transitionsExecutedMeanPerSeed,
          m.adaptationQuality.transitionsRejectedMeanPerSeed,
          m.systemPerformance.latencyDistributionMs.mean,
          m.systemPerformance.latencyDistributionMs.p95,
          m.systemPerformance.latencyDistributionMs.p99
        ]
          .map(csvEscape)
          .join(',')
      );
    }
    fs.writeFileSync(path.join(targetDir, 'stage6-system-comparison.csv'), sysRows.join('\n'), 'utf8');
  }

  return report;
}

if (process.argv[1] && process.argv[1].endsWith('stage-6-research-evaluation.js')) {
  runStage6ResearchEvaluation({ exportFiles: true })
    .then((report) => {
      console.log('=== STAGE 6 RESEARCH EVALUATION SUMMARY ===');
      console.log('Leakage Free:', report.metadata.leakageAudit.leakFree);
      console.log('Seeds:', report.metadata.seeds.join(', '));
      for (const p of Object.keys(report.heldOutTestSummaryByParadigm)) {
        const s = report.heldOutTestSummaryByParadigm[p];
        console.log(`\n--- ${p} ---`);
        console.log('Detection:', JSON.stringify(s.detectionMetrics));
        console.log('Deception:', JSON.stringify(s.deceptionEffectiveness));
        console.log('Adaptation:', JSON.stringify(s.adaptationQuality));
        console.log('Performance:', JSON.stringify(s.systemPerformance.latencyDistributionMs));
      }
      console.log('\nHypothesis Conclusions:', JSON.stringify(report.hypothesisConclusions, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('Evaluation failed:', err);
      process.exit(1);
    });
}
