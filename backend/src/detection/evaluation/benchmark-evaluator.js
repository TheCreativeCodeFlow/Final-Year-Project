/**
 * Research Evaluation Framework (Stage 4C / 4C.1 Hardened)
 *
 * Evaluates and compares:
 * 1. Branch A: Deterministic Rule-Based Detection
 * 2. Branch B1: Unsupervised ML (Isolation Forest)
 * 3. Branch B2: Statistical Anomaly Baseline (Robust Median/MAD)
 * 4. Hybrid Evidence Assessment (Fusion Strategies A, B, C, D)
 *
 * Methodological Principles (Stage 4C.1):
 * - Strict 3-Way Partitioning: Train (4) / Validation (6) / Held-Out Test (10).
 * - Scenario-held-out isolation: Zero training contamination; test partition strictly held out.
 * - Accounting for all 20 scenarios without silent exclusion.
 * - Explicit insufficient-evidence quantification and transparent denominators.
 * - Systematic fusion strategy evaluation (Strategies A, B, C, D).
 * - Threshold sensitivity analysis (0.50 - 0.70).
 */

import { generateSyntheticEvaluationDataset } from '../../telemetry/synthetic-evaluation-dataset.js';
import { BehavioralFeatureExtractor } from '../../services/behavioral-feature-extractor.service.js';
import { RuleEngineService } from '../rules/rule-engine.service.js';
import { IsolationForest } from '../ml/isolation-forest.js';
import { StatisticalBaselineDetector } from '../ml/statistical-baseline.js';
import { FeaturePreprocessor, NUMERICAL_FEATURE_KEYS } from '../ml/feature-preprocessor.js';
import { HybridAssessmentService, ASSESSMENT_LABELS, FUSION_STRATEGIES } from '../hybrid-assessment.service.js';

export const BENCHMARK_PARTITIONS = Object.freeze({
  TRAIN: 'TRAIN',
  VALIDATION: 'VALIDATION',
  TEST: 'TEST'
});

export const SCENARIO_PARTITIONS = Object.freeze({
  // Training Partition (5 strictly benign baseline scenarios, 0 attacks)
  normal_browsing: BENCHMARK_PARTITIONS.TRAIN,
  legitimate_api_polling: BENCHMARK_PARTITIONS.TRAIN,
  legitimate_crawler_traversal: BENCHMARK_PARTITIONS.TRAIN,
  legitimate_api_pagination: BENCHMARK_PARTITIONS.TRAIN,
  benign_cors_preflight_stream: BENCHMARK_PARTITIONS.TRAIN,

  // Validation Partition (7 scenarios for threshold & fusion strategy calibration)
  repeated_login_failures: BENCHMARK_PARTITIONS.VALIDATION,
  high_frequency_burst: BENCHMARK_PARTITIONS.VALIDATION,
  legitimate_repeated_login_failures: BENCHMARK_PARTITIONS.VALIDATION,
  developer_endpoint_exploration: BENCHMARK_PARTITIONS.VALIDATION,
  shared_ip_distinct_sessions: BENCHMARK_PARTITIONS.VALIDATION,
  incomplete_telemetry: BENCHMARK_PARTITIONS.VALIDATION,
  repeated_not_found: BENCHMARK_PARTITIONS.VALIDATION,

  // Held-Out Test Partition (12 scenarios strictly held out for final reporting)
  endpoint_enumeration: BENCHMARK_PARTITIONS.TEST,
  unusual_method_distribution: BENCHMARK_PARTITIONS.TEST,
  slow_irregular_probing: BENCHMARK_PARTITIONS.TEST,
  sudden_behavioral_change: BENCHMARK_PARTITIONS.TEST,
  mixed_attacker_and_normal_traffic: BENCHMARK_PARTITIONS.TEST,
  distributed_endpoint_enumeration: BENCHMARK_PARTITIONS.TEST,
  credential_stuffing_distributed: BENCHMARK_PARTITIONS.TEST,
  legitimate_repeated_404_asset: BENCHMARK_PARTITIONS.TEST,
  shared_nat_identical_user_agents: BENCHMARK_PARTITIONS.TEST,
  mobile_client_irregular_timing: BENCHMARK_PARTITIONS.TEST,
  application_release_deployment: BENCHMARK_PARTITIONS.TEST,
  telemetry_loss_during_session: BENCHMARK_PARTITIONS.TEST
});

export class BenchmarkEvaluator {
  constructor() {
    this.featureExtractor = new BehavioralFeatureExtractor();
    this.ruleEngine = new RuleEngineService();
    this.hybridService = new HybridAssessmentService({ prisma: null });
  }

  /**
   * Prepares benign calibration training data from designated training scenarios.
   *
   * @param {object} dataset
   * @returns {{ preprocessor: FeaturePreprocessor, rawVectors: Array<number[]>, scaledVectors: Array<number[]> }}
   */
  _prepareBenignTrainingData(dataset) {
    const trainingVectors = [];
    const preprocessor = new FeaturePreprocessor({ featureKeys: NUMERICAL_FEATURE_KEYS });

    const trainKeys = Object.entries(SCENARIO_PARTITIONS)
      .filter(([_, part]) => part === BENCHMARK_PARTITIONS.TRAIN)
      .map(([k]) => k);

    for (const key of trainKeys) {
      const scenario = dataset[key];
      if (!scenario) continue;
      const lastEvent = scenario.events[scenario.events.length - 1];
      const featureSets = this.featureExtractor.extractFeatures({
        canonicalEvents: scenario.events,
        tenantId: 'tenant-apex-9941',
        applicationId: 'app-apex-01',
        sessionRef: 'training-session',
        referenceTimestamp: lastEvent ? lastEvent.timestamp : undefined,
        baseline: null
      });

      for (const fSet of featureSets) {
        const { vector } = preprocessor.extractVector(fSet.features, fSet.schemaVersion);
        trainingVectors.push(vector);
      }
    }

    if (trainingVectors.length === 0) {
      throw new Error('No benign training vectors could be extracted from training dataset partition.');
    }

    // Expand samples deterministically with reproducible minor variance for robust calibration (64 samples)
    const expandedVectors = [];
    while (expandedVectors.length < 64) {
      for (let i = 0; i < trainingVectors.length; i++) {
        const v = trainingVectors[i];
        const jittered = v.map((val) => (typeof val === 'number' ? val + (i % 3) * 0.001 : val));
        expandedVectors.push(jittered);
        if (expandedVectors.length >= 64) break;
      }
    }

    preprocessor.fit(expandedVectors);
    const scaledVectors = expandedVectors.map((v) => preprocessor.transform(v));

    return { preprocessor, rawVectors: expandedVectors, scaledVectors };
  }

  /**
   * Helper to compute reproducible evaluation metrics.
   *
   * @param {object} stats - { tp, fp, tn, fn, insufficient, totalDurationMs }
   * @param {number} totalScenarios
   * @returns {object}
   */
  _computeMetrics(stats, totalScenarios) {
    const { tp = 0, fp = 0, tn = 0, fn = 0, insufficient = 0, ambiguousAlerted = 0, ambiguousQuiet = 0, totalDurationMs = 0 } = stats;
    const classifiedCount = tp + fp + tn + fn;
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    const fpr = fp + tn > 0 ? fp / (fp + tn) : 0;
    const fnr = fn + tp > 0 ? fn / (fn + tp) : 0;
    const avgLatencyMs = totalScenarios > 0 ? totalDurationMs / totalScenarios : 0;
    const insufficientEvidenceRate = totalScenarios > 0 ? insufficient / totalScenarios : 0;
    const ambiguousCount = ambiguousAlerted + ambiguousQuiet;

    return {
      confusionMatrix: { tp, fp, tn, fn },
      precision: Number(precision.toFixed(4)),
      recall: Number(recall.toFixed(4)),
      f1Score: Number(f1.toFixed(4)),
      falsePositiveRate: Number(fpr.toFixed(4)),
      falseNegativeRate: Number(fnr.toFixed(4)),
      insufficientEvidenceCount: insufficient,
      insufficientEvidenceRate: Number(insufficientEvidenceRate.toFixed(4)),
      ambiguousCount,
      ambiguousAlertedCount: ambiguousAlerted,
      ambiguousQuietCount: ambiguousQuiet,
      classifiedCount,
      totalEvaluated: totalScenarios,
      attacksEvaluated: tp + fn,
      benignEvaluated: fp + tn,
      avgLatencyMs: Number(avgLatencyMs.toFixed(3))
    };
  }

  /**
   * Runs the complete benchmark across all 24 scenarios, computing:
   * 1. 24-Scenario Accounting Table with explicit ambiguous separation.
   * 2. Partitioned Metrics (Validation vs Held-Out Test vs Full).
   * 3. Comparison of Fusion Strategies A, B, C, D on Validation Set.
   * 4. Anomaly Threshold Sensitivity Analysis.
   *
   * @returns {object} Full benchmark report
   */
  runEvaluation() {
    const dataset = generateSyntheticEvaluationDataset();
    const { preprocessor, scaledVectors } = this._prepareBenignTrainingData(dataset);

    // 1. Fit ML Models on Clean Training Partition (sample size 64)
    const trainStart = performance.now();
    const iforest = new IsolationForest({
      numTrees: 50,
      sampleSize: 64,
      decisionThreshold: 0.60,
      seed: 42
    });
    iforest.fit(scaledVectors);

    const statDetector = new StatisticalBaselineDetector({ decisionThreshold: 0.60 });
    statDetector.fit(scaledVectors);
    const trainingDurationMs = Number((performance.now() - trainStart).toFixed(2));

    // Stats tracking per partition and branch
    const initBranchStats = () => ({
      ruleOnly: { tp: 0, fp: 0, tn: 0, fn: 0, insufficient: 0, ambiguousAlerted: 0, ambiguousQuiet: 0, totalDurationMs: 0 },
      iforestOnly: { tp: 0, fp: 0, tn: 0, fn: 0, insufficient: 0, ambiguousAlerted: 0, ambiguousQuiet: 0, totalDurationMs: 0 },
      statOnly: { tp: 0, fp: 0, tn: 0, fn: 0, insufficient: 0, ambiguousAlerted: 0, ambiguousQuiet: 0, totalDurationMs: 0 },
      hybridA: { tp: 0, fp: 0, tn: 0, fn: 0, insufficient: 0, ambiguousAlerted: 0, ambiguousQuiet: 0, totalDurationMs: 0 },
      hybridB: { tp: 0, fp: 0, tn: 0, fn: 0, insufficient: 0, ambiguousAlerted: 0, ambiguousQuiet: 0, totalDurationMs: 0 },
      hybridC: { tp: 0, fp: 0, tn: 0, fn: 0, insufficient: 0, ambiguousAlerted: 0, ambiguousQuiet: 0, totalDurationMs: 0 },
      hybridD: { tp: 0, fp: 0, tn: 0, fn: 0, insufficient: 0, ambiguousAlerted: 0, ambiguousQuiet: 0, totalDurationMs: 0 }
    });

    const fullStats = initBranchStats();
    const validationStats = initBranchStats();
    const testStats = initBranchStats();

    const accountingTable = [];

    // 2. Evaluate Each Scenario
    for (const [scenarioKey, scenario] of Object.entries(dataset)) {
      const partition = SCENARIO_PARTITIONS[scenarioKey] || BENCHMARK_PARTITIONS.TEST;
      const intent = scenario.groundTruthIntent || '';

      const isAmbiguous = scenario.groundTruthType === 'AMBIGUOUS' || intent === 'BROKEN_INTEGRATION_OR_PROBE';
      const isDegradedTelemetry =
        scenario.groundTruthType === 'DEGRADED_TELEMETRY' ||
        intent === 'TELEMETRY_QUALITY_DEGRADATION' ||
        intent === 'DEGRADED_TELEMETRY_LOSS' ||
        intent.includes('TELEMETRY');

      const isAttack = !isAmbiguous && !isDegradedTelemetry && (
        scenario.groundTruthType === 'ATTACK' ||
        [
          'POTENTIAL_CREDENTIAL_STUFFING',
          'RECONNAISSANCE_SCAN',
          'SCRAPER_OR_BURST_FLOOD',
          'METHOD_TAMPERING_PROBE',
          'STEALTH_RECONNAISSANCE',
          'SESSION_HIJACK_OR_PIVOT',
          'MALICIOUS_COVERT_ATTACK_MIXED',
          'DISTRIBUTED_RECONNAISSANCE',
          'DISTRIBUTED_CREDENTIAL_STUFFING'
        ].includes(intent)
      );

      const isBenign = !isAmbiguous && !isDegradedTelemetry && !isAttack;

      const groundTruthType = isAmbiguous
        ? 'AMBIGUOUS'
        : isDegradedTelemetry
          ? 'DEGRADED_TELEMETRY'
          : isAttack
            ? 'ATTACK'
            : 'BENIGN';

      // Feature extraction with scenario reference timestamp
      const lastEvent = scenario.events[scenario.events.length - 1];
      const featureSets = this.featureExtractor.extractFeatures({
        canonicalEvents: scenario.events,
        tenantId: 'tenant-apex-9941',
        applicationId: 'app-apex-01',
        sessionRef: scenario.events[0]?.sessionReference || 'eval-sess',
        referenceTimestamp: lastEvent ? lastEvent.timestamp : undefined,
        baseline: null
      });

      const primaryFeatureSet = featureSets.find((f) => f.windowLabel === '5m') || featureSets[0] || {};
      const primaryFeatures = primaryFeatureSet.features || {};

      // Branch A: Deterministic Rule Engine
      const ruleStart = performance.now();
      const ruleResult = this.ruleEngine.evaluate({
        featureSets,
        rawObservation: scenario.events[0] || {},
        baseline: null,
        sessionContext: { collisionRisk: { level: 'LOW' }, correlationConfidence: 0.90 },
        tenantId: 'tenant-apex-9941',
        applicationId: 'app-apex-01'
      });
      const ruleDuration = performance.now() - ruleStart;

      // Branch B1: Isolation Forest
      const { vector } = preprocessor.extractVector(primaryFeatures, primaryFeatureSet.schemaVersion || '1.0.0');
      const scaledVector = preprocessor.transform(vector);

      const iforestStart = performance.now();
      const iforestPred = iforest.predict(scaledVector);
      const iforestDuration = performance.now() - iforestStart;

      // Branch B2: Statistical Baseline Detector
      const statStart = performance.now();
      const statPred = statDetector.predict(scaledVector);
      const statDuration = performance.now() - statStart;

      // Hybrid Fusion Strategies (A, B, C, D)
      const evaluateHybrid = (strategy) => {
        const hStart = performance.now();
        const assessment = this.hybridService.evaluateAssessment({
          ruleResult,
          mlResult: {
            modelStatus: 'ACTIVE',
            algorithm: 'ISOLATION_FOREST',
            isAnomaly: iforestPred.isAnomaly,
            anomalyScore: iforestPred.anomalyScore,
            decisionThreshold: iforestPred.decisionThreshold,
            contributingFeatures: [],
            distributionShift: iforestPred.distributionShift
          },
          featureSet: primaryFeatureSet,
          rawObservation: scenario.events[0] || {},
          baseline: null,
          sessionContext: { collisionRisk: { level: 'LOW' }, correlationConfidence: 0.90 },
          fusionStrategy: strategy,
          tenantId: 'tenant-apex-9941',
          applicationId: 'app-apex-01'
        });
        const duration = performance.now() - hStart;
        return { assessment, duration };
      };

      const resHybridA = evaluateHybrid(FUSION_STRATEGIES.EXISTING);
      const resHybridB = evaluateHybrid(FUSION_STRATEGIES.CONSERVATIVE);
      const resHybridC = evaluateHybrid(FUSION_STRATEGIES.RULE_PRIORITY);
      const resHybridD = evaluateHybrid(FUSION_STRATEGIES.DATA_QUALITY_AWARE);

      // Selected default strategy for reporting is Strategy D (Data-Quality Aware)
      const selectedHybrid = resHybridD.assessment;
      const hybridDuration = resHybridD.duration;

      // Helper to update branch stats
      const recordBranch = (targetStats, isFlagged, isInsufficient, duration) => {
        targetStats.totalDurationMs += duration;
        if (isAmbiguous) {
          if (isFlagged) targetStats.ambiguousAlerted++;
          else targetStats.ambiguousQuiet++;
        } else if (isInsufficient) {
          targetStats.insufficient++;
        } else if (isAttack) {
          if (isFlagged) targetStats.tp++;
          else targetStats.fn++;
        } else if (isBenign) {
          if (isFlagged) targetStats.fp++;
          else targetStats.tn++;
        } else if (isDegradedTelemetry) {
          // If degraded telemetry was not flagged as insufficient, record whether it gave false alarm
          if (isFlagged) targetStats.fp++;
          else targetStats.tn++;
        }
      };

      const updateAllStats = (statsObj) => {
        recordBranch(statsObj.ruleOnly, ruleResult.hasTriggeredRules, false, ruleDuration);
        recordBranch(statsObj.iforestOnly, iforestPred.isAnomaly, false, iforestDuration);
        recordBranch(statsObj.statOnly, statPred.isAnomaly, false, statDuration);

        const checkHybridFlag = (ass) => ass.assessmentLabel === ASSESSMENT_LABELS.SUSPICIOUS || ass.assessmentLabel === ASSESSMENT_LABELS.HIGHLY_SUSPICIOUS;
        const checkHybridIncomplete = (ass) => ass.assessmentLabel === ASSESSMENT_LABELS.INSUFFICIENT_EVIDENCE;

        recordBranch(statsObj.hybridA, checkHybridFlag(resHybridA.assessment), checkHybridIncomplete(resHybridA.assessment), resHybridA.duration);
        recordBranch(statsObj.hybridB, checkHybridFlag(resHybridB.assessment), checkHybridIncomplete(resHybridB.assessment), resHybridB.duration);
        recordBranch(statsObj.hybridC, checkHybridFlag(resHybridC.assessment), checkHybridIncomplete(resHybridC.assessment), resHybridC.duration);
        recordBranch(statsObj.hybridD, checkHybridFlag(resHybridD.assessment), checkHybridIncomplete(resHybridD.assessment), resHybridD.duration);
      };

      updateAllStats(fullStats);
      if (partition === BENCHMARK_PARTITIONS.VALIDATION) {
        updateAllStats(validationStats);
      } else if (partition === BENCHMARK_PARTITIONS.TEST) {
        updateAllStats(testStats);
      }

      // Determine accounting verdict for this scenario
      const isHybridSuspicious = selectedHybrid.assessmentLabel === ASSESSMENT_LABELS.SUSPICIOUS || selectedHybrid.assessmentLabel === ASSESSMENT_LABELS.HIGHLY_SUSPICIOUS;
      const isHybridInsufficient = selectedHybrid.assessmentLabel === ASSESSMENT_LABELS.INSUFFICIENT_EVIDENCE;

      let accountingVerdict = 'NORMAL';
      if (isAmbiguous) {
        accountingVerdict = isHybridSuspicious ? 'AMBIGUOUS_ALERTED' : (isHybridInsufficient ? 'AMBIGUOUS_INSUFFICIENT' : 'AMBIGUOUS_QUIET');
      } else if (isDegradedTelemetry) {
        accountingVerdict = isHybridInsufficient ? 'ACCURATELY_FLAGGED_DEGRADED' : (isHybridSuspicious ? 'DEGRADED_FALSE_ALARM' : 'DEGRADED_UNNOTICED');
      } else if (isAttack) {
        accountingVerdict = isHybridSuspicious ? 'TRUE_POSITIVE' : 'FALSE_NEGATIVE';
      } else {
        accountingVerdict = isHybridSuspicious ? 'FALSE_POSITIVE' : 'TRUE_NEGATIVE';
      }

      accountingTable.push({
        scenarioId: scenario.scenarioId || scenarioKey,
        scenarioKey,
        scenarioName: scenario.scenarioName,
        groundTruthIntent: scenario.groundTruthIntent,
        groundTruthType,
        groundTruthRationale: scenario.groundTruthRationale || null,
        partition,
        ruleOnly: {
          triggered: ruleResult.hasTriggeredRules,
          triggeredCount: ruleResult.triggeredCount,
          highestSeverity: ruleResult.highestSeverity,
          triggeredRules: ruleResult.triggeredFindings.map((f) => f.ruleId)
        },
        iforestOnly: {
          anomalyScore: iforestPred.anomalyScore,
          isAnomaly: iforestPred.isAnomaly,
          decisionThreshold: iforestPred.decisionThreshold
        },
        statisticalBaselineOnly: {
          anomalyScore: statPred.anomalyScore,
          isAnomaly: statPred.isAnomaly,
          robustDistance: statPred.robustDistance
        },
        hybridAssessment: {
          assessmentLabel: selectedHybrid.assessmentLabel,
          riskScore: selectedHybrid.riskScore,
          classification: selectedHybrid.classification,
          strategy: selectedHybrid.fusionStrategy
        },
        accountingVerdict,
        latenciesMs: {
          ruleMs: Number(ruleDuration.toFixed(3)),
          iforestMs: Number(iforestDuration.toFixed(3)),
          statMs: Number(statDuration.toFixed(3)),
          hybridMs: Number(hybridDuration.toFixed(3))
        }
      });
    }

    // 3. Compute Metrics Across Partitions
    const formatPartitionReport = (statsObj, count) => ({
      ruleOnly: this._computeMetrics(statsObj.ruleOnly, count),
      iforestOnly: this._computeMetrics(statsObj.iforestOnly, count),
      statisticalBaselineOnly: this._computeMetrics(statsObj.statOnly, count),
      hybridAssessment: this._computeMetrics(statsObj.hybridD, count)
    });

    const valCount = Object.values(SCENARIO_PARTITIONS).filter((p) => p === BENCHMARK_PARTITIONS.VALIDATION).length;
    const testCount = Object.values(SCENARIO_PARTITIONS).filter((p) => p === BENCHMARK_PARTITIONS.TEST).length;
    const totalCount = accountingTable.length;

    // 4. Comparison of All 4 Fusion Strategies on Validation Partition
    const strategyComparisonOnValidation = {
      strategyA_Existing: this._computeMetrics(validationStats.hybridA, valCount),
      strategyB_Conservative: this._computeMetrics(validationStats.hybridB, valCount),
      strategyC_RulePriority: this._computeMetrics(validationStats.hybridC, valCount),
      strategyD_DataQualityAware: this._computeMetrics(validationStats.hybridD, valCount)
    };

    // 5. Sensitivity Analysis Across Anomaly Thresholds (0.50 to 0.70)
    const sensitivityThresholds = [0.50, 0.55, 0.60, 0.65, 0.70];
    const iforestSensitivityAnalysis = sensitivityThresholds.map((threshold) => {
      let tp = 0; let fp = 0; let tn = 0; let fn = 0;
      for (const row of accountingTable) {
        if (row.partition === BENCHMARK_PARTITIONS.TRAIN) continue;
        const isAnomaly = row.iforestOnly.anomalyScore >= threshold;
        if (row.groundTruthType === 'ATTACK') {
          if (isAnomaly) tp++;
          else fn++;
        } else if (row.groundTruthType === 'BENIGN') {
          if (isAnomaly) fp++;
          else tn++;
        }
      }
      const prec = tp + fp > 0 ? tp / (tp + fp) : 0;
      const rec = tp + fn > 0 ? tp / (tp + fn) : 0;
      const f1 = prec + rec > 0 ? (2 * prec * rec) / (prec + rec) : 0;
      return {
        threshold,
        precision: Number(prec.toFixed(4)),
        recall: Number(rec.toFixed(4)),
        f1Score: Number(f1.toFixed(4)),
        confusionMatrix: { tp, fp, tn, fn }
      };
    });

    return {
      evaluatedAt: new Date().toISOString(),
      evaluationFrameworkVersion: '4C.2-integrity',
      trainingDurationMs,
      totalScenarios: totalCount,
      partitions: {
        trainingCount: Object.values(SCENARIO_PARTITIONS).filter((p) => p === BENCHMARK_PARTITIONS.TRAIN).length,
        validationCount: valCount,
        testCount: testCount
      },
      // Held-Out Test Partition Report (12 Scenarios - Primary Empirical Benchmark)
      heldOutTestEvaluation: formatPartitionReport(testStats, testCount),
      comparison: formatPartitionReport(testStats, testCount),
      // Validation Partition Report (7 Scenarios)
      validationEvaluation: formatPartitionReport(validationStats, valCount),
      // Full 24-Scenario Composite Report
      fullBenchmarkEvaluation: formatPartitionReport(fullStats, totalCount),
      // Side-by-Side Comparison of 4 Fusion Strategies
      fusionStrategyComparison: strategyComparisonOnValidation,
      // Anomaly Threshold Sensitivity
      sensitivityAnalysis: iforestSensitivityAnalysis,
      // Exact Accounting Table for All 24 Scenarios (Zero Omissions)
      accountingTable,
      perScenarioResults: accountingTable,
      disclaimers: [
        'Evaluation enforces strict 3-way partitioning: Train (5), Validation (7), Held-Out Test (12).',
        'Synthetic evaluation is a controlled research benchmark; it does not claim real-world production equivalence.',
        'Isolation Forest anomaly scores quantify statistical deviation, NOT attack probability.',
        'Ambiguous scenarios are segregated into an explicit accounting category to prevent forced-choice metric distortion.',
        'Execution evidence remains strictly MISSING; no dynamic deception diversion was executed.'
      ]
    };
  }
}
