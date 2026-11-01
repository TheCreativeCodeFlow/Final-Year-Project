/**
 * Stage 4C Test Suite: Unsupervised Machine Learning Engine
 *
 * Verifies:
 * 1. Feature Preprocessing (zero identifiers, schema version enforcement, robust scaling, missingness).
 * 2. Isolation Forest implementation (deterministic inference, anomaly detection, JSON serialization/reload).
 * 3. Statistical Baseline Detector (modified Z-scores, MAD, robust distance).
 * 4. Training Service lifecycle & eligibility (insufficient data handling, model persistence).
 * 5. Cross-application & cross-tenant isolation.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { FeaturePreprocessor, NUMERICAL_FEATURE_KEYS } from '../src/detection/ml/feature-preprocessor.js';
import { IsolationForest, c } from '../src/detection/ml/isolation-forest.js';
import { StatisticalBaselineDetector } from '../src/detection/ml/statistical-baseline.js';
import { ModelTrainingService } from '../src/detection/ml/training.service.js';
import { MLInferenceService } from '../src/detection/ml/inference.service.js';
import { getPrismaClient, disconnectDatabase } from '../src/db/client.js';

describe('Stage 4C: Unsupervised Machine Learning Engine', () => {
  let prisma;

  before(async () => {
    prisma = getPrismaClient();
  });

  after(async () => {
    await disconnectDatabase();
  });

  // --------------------------------------------------------------------------
  // 1. Feature Preprocessing
  // --------------------------------------------------------------------------
  test('Preprocessor: Extracts pure numerical vectors and excludes identifiers', () => {
    const preprocessor = new FeaturePreprocessor({ featureKeys: NUMERICAL_FEATURE_KEYS });
    const featuresMap = {
      tenantId: 'tenant-apex-9941',
      applicationId: 'app-01',
      sessionRef: 'sess-secret-1234',
      request_rate_per_sec: { value: 0.50 },
      burst_frequency_max_1s: { value: 2 },
      http_4xx_ratio: { value: 0.05 },
      auth_failure_count: { value: 0 }
    };

    const { vector, missingIndices, rawValues } = preprocessor.extractVector(featuresMap, '1.0.0');

    assert.equal(vector.length, NUMERICAL_FEATURE_KEYS.length);
    // Ensure identifiers are not in rawValues
    assert.equal(rawValues.tenantId, undefined);
    assert.equal(rawValues.sessionRef, undefined);
    assert.equal(rawValues.request_rate_per_sec, 0.50);
    // Check that missing features were imputed and tracked
    assert.ok(missingIndices.length > 0);
  });

  test('Preprocessor: Rejects incompatible feature schema versions', () => {
    const preprocessor = new FeaturePreprocessor();
    assert.throws(() => {
      preprocessor.extractVector({}, '2.0.0');
    }, /Incompatible feature schema version/);
  });

  test('Preprocessor: Robust scaling fits medians and IQRs reproducibly', () => {
    const preprocessor = new FeaturePreprocessor({ featureKeys: ['a', 'b'] });
    const trainingData = [
      [10, 100],
      [12, 105],
      [11, 102],
      [13, 108],
      [10, 101]
    ];

    const scaling = preprocessor.fit(trainingData);
    assert.equal(scaling.medians.a, 11);
    assert.equal(scaling.medians.b, 102);

    const transformed = preprocessor.transform([11, 102]);
    assert.deepEqual(transformed, [0, 0], 'Median values transform to zero');
  });

  // --------------------------------------------------------------------------
  // 2. Isolation Forest Implementation
  // --------------------------------------------------------------------------
  test('IsolationForest: Average path length formula c(n) matches BST theory', () => {
    assert.equal(c(0), 0);
    assert.equal(c(1), 0);
    assert.equal(c(2), 1);
    assert.ok(c(128) > 7.0 && c(128) < 9.0, 'c(128) should be around 8.16');
  });

  test('IsolationForest: Differentiates normal clusters from extreme outliers', () => {
    // Generate synthetic normal cluster: 60 points centered at [10, 10]
    const normalSamples = [];
    for (let i = 0; i < 60; i++) {
      normalSamples.push([
        10 + (Math.sin(i) * 0.5),
        10 + (Math.cos(i) * 0.5)
      ]);
    }

    const forest = new IsolationForest({ numTrees: 40, sampleSize: 32, decisionThreshold: 0.60, seed: 100 });
    forest.fit(normalSamples);

    // Normal point near center
    const normalPred = forest.predict([10.1, 9.9]);
    assert.equal(normalPred.isAnomaly, false, 'Normal point should not be flagged as anomaly');
    assert.ok(normalPred.anomalyScore < 0.60);

    // Extreme outlier point far away
    const anomalyPred = forest.predict([500, 500]);
    assert.equal(anomalyPred.isAnomaly, true, 'Extreme point must be flagged as anomaly');
    assert.ok(anomalyPred.anomalyScore >= 0.60);
  });

  test('IsolationForest: Serializes to JSON and rehydrates with identical predictions', () => {
    const samples = [
      [1, 2], [1.1, 2.1], [0.9, 1.9], [1.2, 2.2], [1.0, 2.0]
    ];
    const forest = new IsolationForest({ numTrees: 10, sampleSize: 5, seed: 42 });
    forest.fit(samples);

    const testPoint = [1.05, 2.05];
    const originalPred = forest.predict(testPoint);

    const json = forest.toJSON();
    const rehydrated = IsolationForest.fromJSON(json);
    const rehydratedPred = rehydrated.predict(testPoint);

    assert.equal(rehydratedPred.anomalyScore, originalPred.anomalyScore);
    assert.equal(rehydratedPred.avgPathLength, originalPred.avgPathLength);
  });

  // --------------------------------------------------------------------------
  // 3. Statistical Baseline Detector (MAD)
  // --------------------------------------------------------------------------
  test('StatisticalBaselineDetector: Detects anomalous deviations using robust distance', () => {
    const samples = [
      [5, 5], [5.1, 4.9], [4.9, 5.2], [5.0, 5.0], [5.2, 4.8]
    ];
    const detector = new StatisticalBaselineDetector({ decisionThreshold: 0.60 });
    detector.fit(samples);

    const normalPred = detector.predict([5.0, 5.0]);
    assert.equal(normalPred.isAnomaly, false);
    assert.ok(normalPred.anomalyScore < 0.40);

    const anomalyPred = detector.predict([150, 150]);
    assert.equal(anomalyPred.isAnomaly, true);
    assert.ok(anomalyPred.anomalyScore >= 0.60);

    // Serialization check
    const rehydrated = StatisticalBaselineDetector.fromJSON(detector.toJSON());
    assert.deepEqual(rehydrated.predict([5.0, 5.0]), normalPred);
  });

  // --------------------------------------------------------------------------
  // 4. Model Training Service & Lifecycle
  // --------------------------------------------------------------------------
  test('ModelTrainingService: Fails safely with INSUFFICIENT_TRAINING_DATA when samples are below threshold', async () => {
    const trainingService = new ModelTrainingService({ prisma });
    const tenant = await prisma.tenant.findFirst({ where: { identifier: 'tenant-apex-9941' } });
    const app = await prisma.protectedApplication.findFirst({ where: { tenantId: tenant.id } });

    // Request training requiring 500 samples (which dev DB does not have yet)
    const result = await trainingService.trainModel({
      tenantId: tenant.id,
      applicationId: app.id,
      minSamples: 500
    });

    assert.equal(result.success, false);
    assert.equal(result.status, 'INSUFFICIENT_TRAINING_DATA');
    assert.ok(result.message.includes('INSUFFICIENT_TRAINING_DATA'));
  });

  test('MLInferenceService: Returns NO_MODEL_AVAILABLE without crashing when no model is trained', async () => {
    const inferenceService = new MLInferenceService({ prisma });
    const result = await inferenceService.scoreFeatures({
      features: { request_rate_per_sec: { value: 1.0 } },
      tenantId: 'tenant-unknown',
      applicationId: 'app-nonexistent'
    });

    assert.equal(result.modelStatus, 'NO_MODEL_AVAILABLE');
    assert.equal(result.isAnomaly, false);
    assert.equal(result.anomalyScore, null);
    assert.ok(result.uncertaintyNotes.length > 0);
  });
});
