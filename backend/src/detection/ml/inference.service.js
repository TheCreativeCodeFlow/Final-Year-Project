/**
 * ML Inference Service (Stage 4C)
 *
 * Executes model inference against extracted behavioral features.
 * Guarantees:
 * 1. Safe handling when no active model is available (never fabricates scores).
 * 2. Strict tenant- and application-scoping.
 * 3. Transparent contributing feature explanations.
 * 4. Explicit non-claim: Anomaly score is NOT an attack probability.
 */

import { IsolationForest } from './isolation-forest.js';
import { StatisticalBaselineDetector } from './statistical-baseline.js';
import { FeaturePreprocessor, NUMERICAL_FEATURE_KEYS } from './feature-preprocessor.js';
import { logger } from '../../utils/logger.js';

export class MLInferenceService {
  /**
   * @param {object} options
   * @param {import('@prisma/client').PrismaClient} options.prisma
   */
  constructor(options = {}) {
    this.prisma = options.prisma;
    // In-memory model cache: key `${tenantId}:${applicationId}` -> { modelVersion, forestOrDetector, preprocessor }
    this.modelCache = new Map();
  }

  /**
   * Loads or retrieves cached active model for an application.
   *
   * @param {string} tenantId
   * @param {string} applicationId
   * @returns {Promise<object|null>}
   */
  async getActiveModel(tenantId, applicationId) {
    if (!applicationId) return null;
    const cacheKey = `${tenantId}:${applicationId}`;
    const cached = this.modelCache.get(cacheKey);
    if (cached) return cached;

    const modelRecord = await this.prisma.detectionModelVersion.findFirst({
      where: {
        tenantId,
        applicationId,
        status: 'READY'
      },
      orderBy: { version: 'desc' }
    });

    if (!modelRecord || !modelRecord.modelArtifact) {
      return null;
    }

    try {
      const artifact = modelRecord.modelArtifact;
      const preprocessor = new FeaturePreprocessor({
        featureKeys: modelRecord.featureList || NUMERICAL_FEATURE_KEYS,
        scalingParams: artifact.scalingParams
      });

      let detector;
      if (modelRecord.algorithm === 'STATISTICAL_MAD' && artifact.detector) {
        detector = StatisticalBaselineDetector.fromJSON(artifact.detector);
      } else if (artifact.forest) {
        detector = IsolationForest.fromJSON(artifact.forest);
      } else {
        throw new Error('Unrecognized model artifact structure.');
      }

      const activeEntry = {
        modelRecord,
        detector,
        preprocessor
      };

      this.modelCache.set(cacheKey, activeEntry);
      return activeEntry;
    } catch (err) {
      logger.error('Failed to instantiate active model from artifact', {
        tenantId,
        applicationId,
        error: err.message
      });
      return null;
    }
  }

  /**
   * Invalidates cached model for an application (e.g. after fresh training).
   * @param {string} tenantId
   * @param {string} applicationId
   */
  invalidateCache(tenantId, applicationId) {
    this.modelCache.delete(`${tenantId}:${applicationId}`);
  }

  /**
   * Evaluates behavioral features using the active ML model.
   *
   * @param {object} params
   * @param {object} params.features - Extracted features map
   * @param {string} params.tenantId
   * @param {string} [params.applicationId]
   * @param {string} [params.schemaVersion='1.0.0']
   * @returns {Promise<object>} MLAnomalyResult
   */
  async scoreFeatures({
    features = {},
    tenantId,
    applicationId = null,
    schemaVersion = '1.0.0'
  }) {
    // If unmapped application or no applicationId provided
    if (!applicationId) {
      return {
        modelStatus: 'UNAVAILABLE_NO_APPLICATION_MAPPING',
        isAnomaly: false,
        anomalyScore: null,
        decisionThreshold: 0.60,
        modelId: null,
        modelVersion: null,
        algorithm: null,
        featureSchemaVersion: schemaVersion,
        contributingFeatures: [],
        uncertaintyNotes: ['Observation is not mapped to a registered protected application; ML inference skipped.'],
        explanation: 'ML anomaly scoring unavailable: No application mapping.'
      };
    }

    const activeModel = await this.getActiveModel(tenantId, applicationId);

    // If no trained model exists for this application
    if (!activeModel) {
      return {
        modelStatus: 'NO_MODEL_AVAILABLE',
        isAnomaly: false,
        anomalyScore: null,
        decisionThreshold: 0.60,
        modelId: null,
        modelVersion: null,
        algorithm: null,
        featureSchemaVersion: schemaVersion,
        contributingFeatures: [],
        uncertaintyNotes: [`Application "${applicationId}" has no trained model in READY status.`],
        explanation: 'ML anomaly scoring unavailable: Application model not trained or in calibrating state.'
      };
    }

    const { modelRecord, detector, preprocessor } = activeModel;

    try {
      // 1. Extract & Preprocess
      const { vector, missingIndices, rawValues } = preprocessor.extractVector(features, schemaVersion);
      const scaledVector = preprocessor.transform(vector);

      // 2. Predict
      const prediction = detector.predict(scaledVector);
      const anomalyScore = prediction.anomalyScore;
      const isAnomaly = prediction.isAnomaly;
      const decisionThreshold = prediction.decisionThreshold;

      // 3. Identify Top Contributing Features (largest absolute robust z-scores)
      const featureKeys = preprocessor.featureKeys;
      const contributions = [];
      for (let i = 0; i < featureKeys.length; i++) {
        const key = featureKeys[i];
        const rawVal = rawValues[key];
        const scaledVal = scaledVector[i];
        const deviation = Math.abs(scaledVal);
        contributions.push({
          name: key,
          rawValue: rawVal,
          scaledDeviation: Number(deviation.toFixed(2))
        });
      }

      contributions.sort((a, b) => b.scaledDeviation - a.scaledDeviation);
      const topContributing = contributions.slice(0, 3);

      const uncertaintyNotes = [];
      if (missingIndices.length > 0) {
        uncertaintyNotes.push(`Features contained ${missingIndices.length} missing values that were imputed with baseline medians.`);
      }

      const explanation = isAnomaly
        ? `${modelRecord.algorithm} detected statistical anomaly (score: ${anomalyScore.toFixed(2)} >= threshold ${decisionThreshold.toFixed(2)}). Top contributing deviations: ${topContributing.map((c) => `${c.name} (dev: ${c.scaledDeviation})`).join(', ')}. NOTE: Anomaly score reflects statistical deviation, not calibrated attack probability.`
        : `${modelRecord.algorithm} evaluated behavioral feature vector as normal (score: ${anomalyScore.toFixed(2)} < threshold ${decisionThreshold.toFixed(2)}).`;

      return {
        modelStatus: 'ACTIVE',
        isAnomaly,
        anomalyScore,
        decisionThreshold,
        modelId: modelRecord.id,
        modelIdentifier: modelRecord.modelIdentifier,
        modelVersion: modelRecord.version,
        algorithm: modelRecord.algorithm,
        featureSchemaVersion: modelRecord.featureSchemaVersion,
        contributingFeatures: topContributing,
        uncertaintyNotes,
        explanation
      };
    } catch (err) {
      logger.error('Inference execution error', { tenantId, applicationId, error: err.message });
      return {
        modelStatus: 'INFERENCE_ERROR',
        isAnomaly: false,
        anomalyScore: null,
        decisionThreshold: 0.60,
        modelId: modelRecord.id,
        modelVersion: modelRecord.version,
        algorithm: modelRecord.algorithm,
        featureSchemaVersion: schemaVersion,
        contributingFeatures: [],
        uncertaintyNotes: [`Inference failure: ${err.message}`],
        explanation: `ML inference encountered runtime error: ${err.message}`
      };
    }
  }
}
