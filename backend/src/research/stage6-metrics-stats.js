/**
 * Stage 6 Independent Research Metrics & Statistical Analysis Engine.
 *
 * Strictly separates evaluation dimensions:
 *   1. Detection Accuracy (Precision, Recall, F1, FPR, FNR, Insufficient-Evidence Rate)
 *   2. Deception Effectiveness (Decoy & Meaningful Interactions, Simulated Duration,
 *      Stages Completed, Synthetic Assets, Consistency Violations, Premature Indicators)
 *   3. Adaptation Quality (Proposed, Validated, Executed, Rejection Rate, Validation Rate,
 *      Adaptation Latency, Repeated Seed Stability)
 *   4. Routing Safety (Actual Origin vs Synthetic Request Accounting, Failed Requests)
 *   5. System Performance (Mean, Median, p95, p99, StdDev, CPU, Memory, Provisioning)
 *
 * Treats SCENARIO (not repeated HTTP requests inside a scenario) as the independent
 * unit of statistical analysis. Uses exact paired Student-t CIs and exact permutation
 * Wilcoxon signed-rank tests without manufacturing statistical significance.
 */

const T_CRITICAL_95 = Object.freeze({
  1: 12.706,
  2: 4.303,
  3: 3.182,
  4: 2.776,
  5: 2.571,
  6: 2.447,
  7: 2.365,
  8: 2.306,
  9: 2.262,
  10: 2.228,
  11: 2.201,
  12: 2.179,
  13: 2.160,
  14: 2.145,
  15: 2.131,
  20: 2.086,
  25: 2.060,
  30: 2.042
});

function getTCritical95(df) {
  if (df <= 0) return null;
  if (T_CRITICAL_95[df]) return T_CRITICAL_95[df];
  if (df > 30) return 1.96;
  const keys = Object.keys(T_CRITICAL_95).map(Number).sort((a, b) => a - b);
  let chosen = keys[0];
  for (const k of keys) {
    if (k <= df) chosen = k;
  }
  return T_CRITICAL_95[chosen];
}

export function summarizeDistribution(values = []) {
  if (!values || values.length === 0) {
    return { count: 0, mean: 0, median: 0, p95: 0, p99: 0, min: 0, max: 0, stdDev: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const mean = sum / sorted.length;
  const median = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
  const p99 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))];
  const variance =
    sorted.length > 1
      ? sorted.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (sorted.length - 1)
      : 0;

  return {
    count: sorted.length,
    mean: Number(mean.toFixed(4)),
    median: Number(median.toFixed(4)),
    p95: Number(p95.toFixed(4)),
    p99: Number(p99.toFixed(4)),
    min: Number(sorted[0].toFixed(4)),
    max: Number(sorted[sorted.length - 1].toFixed(4)),
    stdDev: Number(Math.sqrt(variance).toFixed(4))
  };
}

/**
 * Exact two-sided Wilcoxon signed-rank test on paired numerical differences.
 * Handles zeros (dropped per Wilcoxon convention) and average tie ranks.
 * Computes exact permutation p-value over all 2^m sign assignments when m <= 16.
 */
export function computePairedStatisticalComparison(valuesC, valuesBaseline) {
  if (!Array.isArray(valuesC) || !Array.isArray(valuesBaseline) || valuesC.length !== valuesBaseline.length) {
    throw new Error('Paired statistical comparison requires equal-length arrays.');
  }

  const n = valuesC.length;
  const diffs = valuesC.map((v, i) => Number((v - valuesBaseline[i]).toFixed(6)));
  const stats = summarizeDistribution(diffs);

  let ci95 = null;
  if (n > 1) {
    const tCrit = getTCritical95(n - 1);
    const se = stats.stdDev / Math.sqrt(n);
    ci95 = {
      lower: Number((stats.mean - tCrit * se).toFixed(4)),
      upper: Number((stats.mean + tCrit * se).toFixed(4)),
      tCritical: tCrit,
      df: n - 1
    };
  }

  // Non-zero paired differences for Wilcoxon signed-rank test
  const nonZero = diffs.filter((d) => Math.abs(d) > 1e-9);
  const m = nonZero.length;

  if (m === 0) {
    return {
      pairedSampleSize: n,
      nonZeroPairs: 0,
      meanDiff: stats.mean,
      medianDiff: stats.median,
      stdDevDiff: stats.stdDev,
      ci95,
      wilcoxonWPlus: 0,
      wilcoxonWMinus: 0,
      exactTwoSidedPValue: 1.0,
      statisticallySignificantAt05: false,
      note: 'All paired differences are identically zero; no directional divergence observed.'
    };
  }

  const absRanked = nonZero
    .map((d, idx) => ({ diff: d, abs: Math.abs(d), idx }))
    .sort((a, b) => a.abs - b.abs);

  // Assign average ranks for ties
  const ranks = new Array(m);
  let i = 0;
  while (i < m) {
    let j = i;
    while (j + 1 < m && Math.abs(absRanked[j + 1].abs - absRanked[i].abs) < 1e-9) {
      j++;
    }
    const avgRank = (i + 1 + (j + 1)) / 2;
    for (let k = i; k <= j; k++) {
      ranks[k] = avgRank;
    }
    i = j + 1;
  }

  let wPlus = 0;
  let wMinus = 0;
  for (let k = 0; k < m; k++) {
    if (absRanked[k].diff > 0) wPlus += ranks[k];
    else wMinus += ranks[k];
  }

  const observedStat = Math.max(wPlus, wMinus);
  let exactP = null;

  if (m <= 16) {
    const totalPerms = 1 << m;
    let extremeCount = 0;
    for (let mask = 0; mask < totalPerms; mask++) {
      let wp = 0;
      let wm = 0;
      for (let bit = 0; bit < m; bit++) {
        if ((mask >> bit) & 1) wp += ranks[bit];
        else wm += ranks[bit];
      }
      if (Math.max(wp, wm) >= observedStat - 1e-9) {
        extremeCount++;
      }
    }
    exactP = Number((extremeCount / totalPerms).toFixed(6));
  }

  const minAchievableP = 2 / Math.pow(2, m);
  return {
    pairedSampleSize: n,
    nonZeroPairs: m,
    meanDiff: stats.mean,
    medianDiff: stats.median,
    stdDevDiff: stats.stdDev,
    ci95,
    wilcoxonWPlus: wPlus,
    wilcoxonWMinus: wMinus,
    exactTwoSidedPValue: exactP,
    minAchievableTwoSidedPValue: Number(minAchievableP.toFixed(6)),
    sampleInsufficientForSignificanceTest: minAchievableP > 0.05,
    statisticallySignificantAt05: exactP !== null ? exactP < 0.05 : false,
    note:
      minAchievableP > 0.05
        ? `With only m=${m} non-zero paired differences, minimum achievable two-sided permutation p-value is ${minAchievableP.toFixed(4)} (> 0.05); report descriptive statistics without overclaiming significance.`
        : `Exact Wilcoxon permutation test over m=${m} non-zero paired scenarios.`
  };
}

/**
 * Aggregates metrics for a set of scenario evaluation runs under a single paradigm
 * (treating each unique scenario as one unit of analysis, averaging across multi-seed repetitions
 * so repetitions never inflate sample size N!).
 */
export function aggregateParadigmMetrics(scenarioRuns = []) {
  if (scenarioRuns.length === 0) {
    throw new Error('Cannot aggregate empty scenarioRuns array.');
  }

  // Group runs by unique scenarioId across repetitions/seeds
  const byScenario = new Map();
  for (const r of scenarioRuns) {
    if (!byScenario.has(r.scenarioId)) byScenario.set(r.scenarioId, []);
    byScenario.get(r.scenarioId).push(r);
  }

  const uniqueScenariosCount = byScenario.size;
  const totalRepetitionsExecuted = scenarioRuns.length;

  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;
  let ambiguousTotal = 0;
  let ambiguousDeferredCleanly = 0;
  let ambiguousFalselyDiverted = 0;

  // Detection metrics per unique scenario (majority/mean verdict across seeds; plus track seed variance)
  let crossSeedVerdictDisagreements = 0;
  let crossSeedAdaptationDisagreements = 0;

  const perScenarioAggregates = [];

  const allRequestLatencies = [];
  const allAdaptationLatencies = [];
  const allProvisioningTimes = [];

  let totalDecoyInteractions = 0;
  let totalMeaningfulInteractions = 0;
  let totalSimulatedEngagementMs = 0;
  let totalAttackStagesCompleted = 0;
  let totalAttackStagesExpected = 0;
  let totalSyntheticAssetsExplored = 0;
  let totalConsistencyViolations = 0;
  let totalPrematureRecognitionIndicators = 0;

  let totalTransitionsProposed = 0;
  let totalTransitionsValidated = 0;
  let totalTransitionsExecuted = 0;
  let totalTransitionsRejected = 0;

  let totalOriginRequests = 0;
  let totalSyntheticRequests = 0;
  let totalFailedRequests = 0;
  let totalCpuUserMs = 0;
  let totalCpuSystemMs = 0;
  const heapDeltas = [];

  for (const [scenarioId, runs] of byScenario.entries()) {
    const sample = runs[0];
    const gt = sample.groundTruthCategory;

    const verdicts = new Set(runs.map((r) => r.observedScenarioVerdict));
    if (verdicts.size > 1) crossSeedVerdictDisagreements++;

    const mutCounts = new Set(runs.map((r) => r.adaptationQuality.transitionsExecuted));
    if (mutCounts.size > 1) crossSeedAdaptationDisagreements++;

    // Scenario primary verdict from deterministic Seed[0] + consensus check
    const flaggedCount = runs.filter((r) => r.observedScenarioVerdict === 'ATTACK_PROPOSED').length;
    const isScenarioFlaggedAttack = flaggedCount > runs.length / 2;

    if (gt === 'ATTACK') {
      if (isScenarioFlaggedAttack) tp++;
      else fn++;
    } else if (gt === 'BENIGN') {
      if (isScenarioFlaggedAttack) fp++;
      else tn++;
    } else if (gt === 'AMBIGUOUS') {
      ambiguousTotal++;
      if (isScenarioFlaggedAttack) ambiguousFalselyDiverted++;
      else ambiguousDeferredCleanly++;
    }

    const avg = (fnExtract) => runs.reduce((s, r) => s + fnExtract(r), 0) / runs.length;

    const scDecoy = avg((r) => r.deceptionEffectiveness.decoyInteractions);
    const scMeaningful = avg((r) => r.deceptionEffectiveness.meaningfulInteractions);
    const scEngMs = avg((r) => r.deceptionEffectiveness.simulatedEngagementDurationMs);
    const scStages = avg((r) => r.deceptionEffectiveness.attackStagesCompleted);
    const scStagesMax = sample.deceptionEffectiveness.expectedStagesMax;
    const scAssets = avg((r) => r.deceptionEffectiveness.syntheticAssetsExplored);
    const scViolations = avg((r) => r.deceptionEffectiveness.consistencyViolations);
    const scPremature = avg((r) => r.deceptionEffectiveness.prematureRecognitionIndicators);

    const scProp = avg((r) => r.adaptationQuality.transitionsProposed);
    const scVal = avg((r) => r.adaptationQuality.transitionsValidated);
    const scExec = avg((r) => r.adaptationQuality.transitionsExecuted);
    const scRej = avg((r) => r.adaptationQuality.transitionsRejected);

    if (gt === 'ATTACK') {
      totalDecoyInteractions += scDecoy;
      totalMeaningfulInteractions += scMeaningful;
      totalSimulatedEngagementMs += scEngMs;
      totalAttackStagesCompleted += scStages;
      totalAttackStagesExpected += scStagesMax;
      totalSyntheticAssetsExplored += scAssets;
    }

    totalConsistencyViolations += scViolations;
    totalPrematureRecognitionIndicators += scPremature;

    totalTransitionsProposed += scProp;
    totalTransitionsValidated += scVal;
    totalTransitionsExecuted += scExec;
    totalTransitionsRejected += scRej;

    perScenarioAggregates.push({
      scenarioId,
      taxonomy: sample.taxonomy,
      groundTruthCategory: gt,
      observedScenarioVerdict: sample.observedScenarioVerdict,
      repetitionsCount: runs.length,
      decoyInteractions: Number(scDecoy.toFixed(2)),
      meaningfulInteractions: Number(scMeaningful.toFixed(2)),
      simulatedEngagementDurationMs: Number(scEngMs.toFixed(2)),
      attackStagesCompleted: Number(scStages.toFixed(2)),
      expectedStagesMax: scStagesMax,
      syntheticAssetsExplored: Number(scAssets.toFixed(2)),
      consistencyViolations: Number(scViolations.toFixed(2)),
      prematureRecognitionIndicators: Number(scPremature.toFixed(2)),
      transitionsProposed: Number(scProp.toFixed(2)),
      transitionsValidated: Number(scVal.toFixed(2)),
      transitionsExecuted: Number(scExec.toFixed(2)),
      transitionsRejected: Number(scRej.toFixed(2)),
      meanLatencyMs: summarizeDistribution(runs.flatMap((r) => r.performance.requestLatenciesMs)).mean
    });

    for (const r of runs) {
      allRequestLatencies.push(...r.performance.requestLatenciesMs);
      if (r.adaptationQuality.meanAdaptationLatencyMs > 0) {
        allAdaptationLatencies.push(r.adaptationQuality.meanAdaptationLatencyMs);
      }
      allProvisioningTimes.push(r.performance.runtimeProvisioningTimeMs);
      totalOriginRequests += r.routingSafety.actualOriginRequests;
      totalSyntheticRequests += r.routingSafety.actualSyntheticRequests;
      totalFailedRequests += r.routingSafety.failedRequests;
      totalCpuUserMs += r.performance.cpuUserMs;
      totalCpuSystemMs += r.performance.cpuSystemMs;
      heapDeltas.push(r.performance.heapDeltaMb);
    }
  }

  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const fpr = fp + tn > 0 ? fp / (fp + tn) : 0;
  const fnr = fn + tp > 0 ? fn / (fn + tp) : 0;
  const insufficientEvidenceRate = uniqueScenariosCount > 0 ? ambiguousTotal / uniqueScenariosCount : 0;

  const rejectionRate =
    totalTransitionsProposed > 0 ? totalTransitionsRejected / totalTransitionsProposed : 0;
  const validationRate =
    totalTransitionsProposed > 0 ? totalTransitionsValidated / totalTransitionsProposed : null;

  return {
    paradigm: scenarioRuns[0].paradigm,
    sampleAccounting: {
      independentScenarios: uniqueScenariosCount,
      unambiguousScenarios: tp + fp + tn + fn,
      ambiguousScenarios: ambiguousTotal,
      totalRepetitionRuns: totalRepetitionsExecuted
    },
    detectionMetrics: {
      confusionMatrix: { tp, fp, tn, fn },
      precision: Number(precision.toFixed(4)),
      recall: Number(recall.toFixed(4)),
      f1Score: Number(f1Score.toFixed(4)),
      falsePositiveRate: Number(fpr.toFixed(4)),
      falseNegativeRate: Number(fnr.toFixed(4)),
      insufficientEvidenceCount: ambiguousTotal,
      insufficientEvidenceDeferredCleanly: ambiguousDeferredCleanly,
      insufficientEvidenceFalselyDiverted: ambiguousFalselyDiverted,
      insufficientEvidenceRate: Number(insufficientEvidenceRate.toFixed(4))
    },
    deceptionEffectiveness: {
      meanDecoyInteractionsPerAttackScenario: Number((totalDecoyInteractions / Math.max(1, tp + fn)).toFixed(3)),
      totalDecoyInteractionsMeanAcrossSeeds: Number(totalDecoyInteractions.toFixed(2)),
      meanMeaningfulInteractionsPerAttackScenario: Number((totalMeaningfulInteractions / Math.max(1, tp + fn)).toFixed(3)),
      totalMeaningfulInteractionsMeanAcrossSeeds: Number(totalMeaningfulInteractions.toFixed(2)),
      meaningfulRatio:
        totalDecoyInteractions > 0
          ? Number((totalMeaningfulInteractions / totalDecoyInteractions).toFixed(4))
          : 0,
      meanSimulatedEngagementDurationMs: Number((totalSimulatedEngagementMs / Math.max(1, tp + fn)).toFixed(2)),
      totalAttackStagesCompleted: Number(totalAttackStagesCompleted.toFixed(2)),
      totalAttackStagesExpected: totalAttackStagesExpected,
      stageCompletionRate:
        totalAttackStagesExpected > 0
          ? Number((totalAttackStagesCompleted / totalAttackStagesExpected).toFixed(4))
          : 0,
      totalSyntheticAssetsExplored: Number(totalSyntheticAssetsExplored.toFixed(2)),
      totalConsistencyViolations: Number(totalConsistencyViolations.toFixed(2)),
      totalPrematureRecognitionIndicators: Number(totalPrematureRecognitionIndicators.toFixed(2))
    },
    adaptationQuality: {
      transitionsProposedMeanPerSeed: Number(totalTransitionsProposed.toFixed(2)),
      transitionsValidatedMeanPerSeed: Number(totalTransitionsValidated.toFixed(2)),
      transitionsExecutedMeanPerSeed: Number(totalTransitionsExecuted.toFixed(2)),
      transitionsRejectedMeanPerSeed: Number(totalTransitionsRejected.toFixed(2)),
      transitionRejectionRate: Number(rejectionRate.toFixed(4)),
      graphConsistencyValidationRate: validationRate !== null ? Number(validationRate.toFixed(4)) : null,
      adaptationLatencyMs: summarizeDistribution(allAdaptationLatencies),
      repeatedAdaptationStability: {
        crossSeedVerdictDisagreements,
        crossSeedAdaptationDisagreements,
        stabilityRate: Number(
          (((uniqueScenariosCount - crossSeedAdaptationDisagreements) / uniqueScenariosCount)).toFixed(4)
        )
      }
    },
    routingSafety: {
      totalActualOriginRequestsAcrossAllSeeds: totalOriginRequests,
      totalActualSyntheticRequestsAcrossAllSeeds: totalSyntheticRequests,
      totalFailedRequests: totalFailedRequests
    },
    systemPerformance: {
      latencyDistributionMs: summarizeDistribution(allRequestLatencies),
      provisioningTimeMs: summarizeDistribution(allProvisioningTimes),
      totalCpuUserMs: Number(totalCpuUserMs.toFixed(3)),
      totalCpuSystemMs: Number(totalCpuSystemMs.toFixed(3)),
      meanHeapDeltaMb: Number((heapDeltas.reduce((a, b) => a + b, 0) / heapDeltas.length).toFixed(4))
    },
    perScenarioAggregates
  };
}
