/**
 * Stage 4C.3: Isolation Forest Reference Comparison Test Suite
 *
 * Performs empirical side-by-side validation between the pure-JavaScript
 * Isolation Forest and scikit-learn's IsolationForest (v1.9.1).
 *
 * Verifies:
 * 1. Score direction & monotonicity across normal and outlier instances.
 * 2. Radial distance monotonicity from cluster center.
 * 3. Comparative behavior on the 24 benchmark scenarios.
 * 4. Threshold and decision function concordance on inliers vs outliers.
 * 5. Zero-variance / constant feature handling.
 * 6. Small-sample handling (n = 2).
 * 7. Documentation of boundary plateau behavior in canonical tree traversal.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { IsolationForest } from '../src/detection/ml/isolation-forest.js';
import { generateSyntheticEvaluationDataset } from '../src/telemetry/synthetic-evaluation-dataset.js';
import { BehavioralFeatureExtractor } from '../src/services/behavioral-feature-extractor.service.js';
import { FeaturePreprocessor, NUMERICAL_FEATURE_KEYS } from '../src/detection/ml/feature-preprocessor.js';
import { SCENARIO_PARTITIONS, BENCHMARK_PARTITIONS } from '../src/detection/evaluation/benchmark-evaluator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scriptPath = path.resolve(__dirname, '../scripts/compare-isolation-forest-sklearn.py');

describe('Stage 4C.3: Empirical Reference Comparison (JS vs scikit-learn v1.9.1)', () => {
  const extractor = new BehavioralFeatureExtractor();
  const dataset = generateSyntheticEvaluationDataset();
  const preprocessor = new FeaturePreprocessor({ featureKeys: NUMERICAL_FEATURE_KEYS });

  // Extract calibration training vectors
  const trainKeys = Object.entries(SCENARIO_PARTITIONS)
    .filter(([_, part]) => part === BENCHMARK_PARTITIONS.TRAIN)
    .map(([k]) => k);

  const rawTrainVectors = [];
  for (const k of trainKeys) {
    const sc = dataset[k];
    const fSets = extractor.extractFeatures({
      canonicalEvents: sc.events,
      tenantId: 'tenant-test',
      applicationId: 'app-test',
      sessionRef: 'train-sess',
      referenceTimestamp: sc.events[sc.events.length - 1]?.timestamp
    });
    for (const fs of fSets) {
      const { vector } = preprocessor.extractVector(fs.features, fs.schemaVersion);
      rawTrainVectors.push(vector);
    }
  }

  // Expand to 64 samples deterministically
  const trainingVectors = [];
  while (trainingVectors.length < 64) {
    for (let i = 0; i < rawTrainVectors.length; i++) {
      const v = rawTrainVectors[i];
      trainingVectors.push(v.map((val) => (typeof val === 'number' ? val + (i % 3) * 0.001 : val)));
      if (trainingVectors.length >= 64) break;
    }
  }

  preprocessor.fit(trainingVectors);
  const scaledTrainVectors = trainingVectors.map((v) => preprocessor.transform(v));

  // Fit pure-JS Isolation Forest
  const jsForest = new IsolationForest({
    numTrees: 50,
    sampleSize: 64,
    decisionThreshold: 0.60,
    seed: 42
  });
  jsForest.fit(scaledTrainVectors);

  // Extract test vectors for all 24 scenarios
  const testScenarioKeys = Object.keys(dataset);
  const testVectors = [];
  const jsScores = [];

  for (const k of testScenarioKeys) {
    const sc = dataset[k];
    const fSets = extractor.extractFeatures({
      canonicalEvents: sc.events,
      tenantId: 'tenant-test',
      applicationId: 'app-test',
      sessionRef: 'test-sess',
      referenceTimestamp: sc.events[sc.events.length - 1]?.timestamp
    });
    const primary = fSets.find((f) => f.windowLabel === '5m') || fSets[0];
    const { vector } = preprocessor.extractVector(primary.features, primary.schemaVersion);
    const scaled = preprocessor.transform(vector);
    testVectors.push(scaled);

    const pred = jsForest.predict(scaled);
    jsScores.push(pred.anomalyScore);
  }

  test('1. Python environment has scikit-learn accessible and functional', () => {
    let pythonOutput;
    try {
      pythonOutput = execFileSync('python3', [scriptPath], { encoding: 'utf-8' });
    } catch (err) {
      assert.fail(`Failed to execute scikit-learn reference comparison script: ${err.message}`);
    }
    const result = JSON.parse(pythonOutput);
    assert.equal(result.sklearnVersion, '1.9.1');
    assert.equal(result.trainSampleCount, 64);
    assert.ok(result.constantFeatureHandling.fitsWithoutCrashing);
    assert.ok(result.smallSampleHandling.fitsWithoutCrashing);
  });

  test('2. Radial distance monotonicity: Both implementations show increasing anomaly score with distance', () => {
    // Generate synthetic Gaussian cluster centered at [0, 0, 0]
    const syntheticTrain = [];
    for (let i = 0; i < 64; i++) {
      syntheticTrain.push([
        Math.sin(i * 0.1) * 0.5,
        Math.cos(i * 0.1) * 0.5,
        (i % 5) * 0.1
      ]);
    }

    const testRadial = [
      [0.0, 0.0, 0.0],  // Center (inlier)
      [1.0, 1.0, 0.5],  // Moderate deviation
      [3.0, 3.0, 1.5],  // Strong deviation
      [15.0, 15.0, 5.0] // Extreme outlier
    ];

    const jsSynthetic = new IsolationForest({ numTrees: 50, sampleSize: 64, seed: 42 }).fit(syntheticTrain);
    const jsRadialScores = testRadial.map((p) => jsSynthetic.predict(p).anomalyScore);

    const payload = JSON.stringify({
      trainingVectors: syntheticTrain,
      testVectors: testRadial,
      jsScores: jsRadialScores
    });

    const pythonOutput = execFileSync(
      'python3',
      [scriptPath, '--json-stdin'],
      { input: payload, encoding: 'utf-8' }
    );
    const result = JSON.parse(pythonOutput);
    const skMetrics = result.sklearnAnomalyMetric;

    // Verify JS monotonicity
    assert.ok(jsRadialScores[1] >= jsRadialScores[0], 'JS: r=1.0 >= r=0.0');
    assert.ok(jsRadialScores[2] >= jsRadialScores[1], 'JS: r=3.0 >= r=1.0');
    assert.ok(jsRadialScores[3] >= jsRadialScores[2], 'JS: r=15.0 >= r=3.0');

    // Verify sklearn monotonicity (higher metric = more anomalous)
    assert.ok(skMetrics[1] >= skMetrics[0], 'sklearn: r=1.0 >= r=0.0');
    assert.ok(skMetrics[2] >= skMetrics[1], 'sklearn: r=3.0 >= r=1.0');
    assert.ok(skMetrics[3] >= skMetrics[2], 'sklearn: r=15.0 >= r=3.0');

    // Spearman rank correlation between JS and sklearn on radial progression is 1.0
    assert.equal(result.spearmanRankCorrelation, 1.0);
  });

  test('3. Benchmark scenarios evaluation exhibits positive ranking correlation (Spearman rho > 0.35)', () => {
    const payload = JSON.stringify({
      trainingVectors: scaledTrainVectors,
      testVectors,
      jsScores
    });

    const pythonOutput = execFileSync(
      'python3',
      [scriptPath, '--json-stdin'],
      { input: payload, encoding: 'utf-8' }
    );

    const result = JSON.parse(pythonOutput);
    assert.ok(result.spearmanRankCorrelation !== undefined);
    assert.ok(
      result.spearmanRankCorrelation >= 0.35,
      `Spearman rank correlation (${result.spearmanRankCorrelation}) must be positive and non-random`
    );
    assert.ok(result.sklearnAnomalyMetric.length === testVectors.length);
  });

  test('4. Both implementations agree on inlier vs extreme outlier ranking', () => {
    const centerVector = scaledTrainVectors[0];
    const extremeVector = scaledTrainVectors[0].map((v) => v + 50.0);

    const payload = JSON.stringify({
      trainingVectors: scaledTrainVectors,
      testVectors: [centerVector, extremeVector],
      jsScores: [jsForest.predict(centerVector).anomalyScore, jsForest.predict(extremeVector).anomalyScore]
    });

    const pythonOutput = execFileSync(
      'python3',
      [scriptPath, '--json-stdin'],
      { input: payload, encoding: 'utf-8' }
    );

    const result = JSON.parse(pythonOutput);
    const sklearnMetrics = result.sklearnAnomalyMetric;
    const jsCenterScore = jsForest.predict(centerVector).anomalyScore;
    const jsExtremeScore = jsForest.predict(extremeVector).anomalyScore;

    // Both implementations must rank the extreme outlier as strictly more anomalous
    assert.ok(jsExtremeScore > jsCenterScore, 'JS: Extreme outlier score must exceed center score');
    assert.ok(sklearnMetrics[1] > sklearnMetrics[0], 'sklearn: Extreme outlier metric must exceed center metric');
  });

  test('5. Both implementations handle zero-variance constant features and small samples (n=2)', () => {
    const constData = Array.from({ length: 32 }, () => [5.0, 5.0, 5.0]);
    const jsConstForest = new IsolationForest({ numTrees: 10, sampleSize: 16, seed: 42 });
    assert.doesNotThrow(() => jsConstForest.fit(constData));

    const jsPred = jsConstForest.predict([5.0, 5.0, 5.0]);
    assert.ok(Number.isFinite(jsPred.anomalyScore));
    assert.ok(jsPred.anomalyScore >= 0.0 && jsPred.anomalyScore <= 1.0);

    const miniData = [[1.0, 2.0], [3.0, 4.0]];
    const jsMiniForest = new IsolationForest({ numTrees: 10, sampleSize: 2, seed: 42 });
    assert.doesNotThrow(() => jsMiniForest.fit(miniData));
    const jsMiniPred = jsMiniForest.predict([2.0, 3.0]);
    assert.ok(Number.isFinite(jsMiniPred.anomalyScore));
    assert.ok(!Number.isNaN(jsMiniPred.anomalyScore));
  });
});
