/**
 * Model Training Service (Stage 4C)
 *
 * Coordinates application-specific unsupervised ML anomaly model training.
 * Enforces strict training data eligibility, model versioning, and lifecycle management.
 */

import { IsolationForest } from './isolation-forest.js';
import { StatisticalBaselineDetector } from './statistical-baseline.js';
import { FeaturePreprocessor, NUMERICAL_FEATURE_KEYS } from './feature-preprocessor.js';
import { logger } from '../../utils/logger.js';

export const MIN_ELIGIBLE_TRAINING_SAMPLES = 20;

export class ModelTrainingService {
  /**
   * @param {object} options
   * @param {import('@prisma/client').PrismaClient} options.prisma
   */
  constructor(options = {}) {
    this.prisma = options.prisma;
  }

  /**
   * Trains a new model version for a specific protected application within a tenant boundary.
   *
   * @param {object} params
   * @param {string} params.tenantId
   * @param {string} params.applicationId
   * @param {string} [params.algorithm='ISOLATION_FOREST'] - 'ISOLATION_FOREST' or 'STATISTICAL_MAD'
   * @param {number} [params.minSamples=20]
   * @param {string} [params.initiatedBy='operator']
   * @returns {Promise<{ success: boolean, status: string, modelVersion?: object, trainingRunId?: string, message: string }>}
   */
  async trainModel({
    tenantId,
    applicationId,
    algorithm = 'ISOLATION_FOREST',
    minSamples = MIN_ELIGIBLE_TRAINING_SAMPLES,
    initiatedBy = 'system'
  }) {
    const startTime = Date.now();

    // 1. Create ModelTrainingRun record (Audit Trail)
    const trainingRun = await this.prisma.modelTrainingRun.create({
      data: {
        tenantId,
        applicationId,
        algorithm,
        status: 'IN_PROGRESS',
        initiatedBy,
        startedAt: new Date()
      }
    });

    try {
      // 2. Verify Application Boundary
      const app = await this.prisma.protectedApplication.findFirst({
        where: { id: applicationId, tenantId }
      });
      if (!app) {
        throw new Error(`Application "${applicationId}" not found for tenant "${tenantId}".`);
      }

      // 3. Query Eligible Feature Sets
      // Eligibility criteria:
      // - Belongs strictly to (tenantId, applicationId)
      // - Complete telemetry (telemetryLossDetected !== true)
      // - Schema version 1.0.0
      const candidateFeatureSets = await this.prisma.behavioralFeatureSet.findMany({
        where: {
          tenantId,
          applicationId,
          schemaVersion: '1.0.0'
        },
        orderBy: { windowEnd: 'asc' },
        take: 1000
      });

      // Filter out feature sets with data loss or unestablished baselines
      const eligibleFeatureSets = candidateFeatureSets.filter((fSet) => {
        const qm = fSet.qualityMetadata || {};
        if (qm.telemetryLossDetected === true) return false;
        if (qm.hasDataLoss === true) return false;
        return true;
      });

      // 4. Insufficient Data Check
      if (eligibleFeatureSets.length < minSamples) {
        const errorMsg = `INSUFFICIENT_TRAINING_DATA: Found ${eligibleFeatureSets.length} eligible feature sets; minimum required is ${minSamples}.`;
        logger.warn(errorMsg, { tenantId, applicationId });

        await this.prisma.modelTrainingRun.update({
          where: { id: trainingRun.id },
          data: {
            status: 'INSUFFICIENT_DATA',
            sampleCount: eligibleFeatureSets.length,
            errorMessage: errorMsg,
            completedAt: new Date(),
            trainingDurationMs: Date.now() - startTime
          }
        });

        return {
          success: false,
          status: 'INSUFFICIENT_TRAINING_DATA',
          trainingRunId: trainingRun.id,
          message: errorMsg
        };
      }

      // 5. Preprocessing & Vector Extraction
      const preprocessor = new FeaturePreprocessor({ featureKeys: NUMERICAL_FEATURE_KEYS });
      const rawVectors = [];
      for (const fSet of eligibleFeatureSets) {
        const { vector } = preprocessor.extractVector(fSet.features, fSet.schemaVersion);
        rawVectors.push(vector);
      }

      // Fit robust scaling
      const scalingParams = preprocessor.fit(rawVectors);
      const scaledVectors = rawVectors.map((v) => preprocessor.transform(v));

      // 6. Train Algorithm
      let trainedModelArtifact;
      let hyperparameters = {};
      let decisionThreshold = 0.60;

      if (algorithm === 'STATISTICAL_MAD') {
        const statModel = new StatisticalBaselineDetector({ decisionThreshold: 0.60 });
        statModel.fit(scaledVectors);
        trainedModelArtifact = {
          type: 'STATISTICAL_MAD',
          scalingParams,
          detector: statModel.toJSON()
        };
        hyperparameters = { algorithm: 'STATISTICAL_MAD', decisionThreshold: 0.60 };
      } else {
        // Default: ISOLATION_FOREST
        const numTrees = 50;
        const sampleSize = Math.min(128, scaledVectors.length);
        const iforest = new IsolationForest({
          numTrees,
          sampleSize,
          decisionThreshold: 0.60,
          seed: 42
        });
        iforest.fit(scaledVectors);
        trainedModelArtifact = {
          type: 'ISOLATION_FOREST',
          scalingParams,
          forest: iforest.toJSON()
        };
        hyperparameters = {
          algorithm: 'ISOLATION_FOREST',
          numTrees,
          sampleSize,
          decisionThreshold: 0.60,
          seed: 42
        };
      }

      // 7. Resolve Next Version Number
      const latestModel = await this.prisma.detectionModelVersion.findFirst({
        where: { tenantId, applicationId },
        orderBy: { version: 'desc' }
      });
      const nextVersion = (latestModel?.version || 0) + 1;
      const modelIdentifier = `model-${algorithm.toLowerCase().replace('_', '-')}-${app.applicationIdentifier}-v${nextVersion}`;

      // 8. Persist DetectionModelVersion in PostgreSQL
      const createdModel = await this.prisma.detectionModelVersion.create({
        data: {
          tenantId,
          applicationId,
          modelIdentifier,
          version: nextVersion,
          algorithm,
          status: 'READY',
          hyperparameters,
          modelArtifact: trainedModelArtifact,
          featureSchemaVersion: '1.0.0',
          featureList: NUMERICAL_FEATURE_KEYS,
          trainingSampleCount: eligibleFeatureSets.length,
          trainingPeriodStart: eligibleFeatureSets[0].windowStart,
          trainingPeriodEnd: eligibleFeatureSets[eligibleFeatureSets.length - 1].windowEnd,
          decisionThreshold,
          evaluationMetrics: {
            sampleCount: eligibleFeatureSets.length,
            fittedFeaturesCount: NUMERICAL_FEATURE_KEYS.length
          }
        }
      });

      // 9. Update Training Run Record
      const durationMs = Date.now() - startTime;
      await this.prisma.modelTrainingRun.update({
        where: { id: trainingRun.id },
        data: {
          modelVersionId: createdModel.id,
          status: 'COMPLETED',
          sampleCount: eligibleFeatureSets.length,
          trainingDurationMs: durationMs,
          completedAt: new Date(),
          evaluationMetrics: createdModel.evaluationMetrics
        }
      });

      logger.info('Model training completed successfully', {
        tenantId,
        applicationId,
        modelIdentifier,
        version: nextVersion,
        samples: eligibleFeatureSets.length,
        durationMs
      });

      return {
        success: true,
        status: 'READY',
        modelVersion: createdModel,
        trainingRunId: trainingRun.id,
        message: `Successfully trained ${algorithm} model v${nextVersion} using ${eligibleFeatureSets.length} eligible samples.`
      };
    } catch (err) {
      logger.error('Model training failed', { tenantId, applicationId, error: err.message });

      await this.prisma.modelTrainingRun.update({
        where: { id: trainingRun.id },
        data: {
          status: 'FAILED',
          errorMessage: err.message,
          completedAt: new Date(),
          trainingDurationMs: Date.now() - startTime
        }
      });

      return {
        success: false,
        status: 'FAILED',
        trainingRunId: trainingRun.id,
        message: `Model training failed: ${err.message}`
      };
    }
  }
}
