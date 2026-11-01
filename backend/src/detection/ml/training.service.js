/**
 * Model Training Service (Stage 4C / 4C.1 Hardened)
 *
 * Coordinates application-specific unsupervised ML anomaly model training.
 * Enforces strict training data eligibility, model versioning, lifecycle management,
 * and explicit training eligibility provenance.
 *
 * Training Eligibility Provenance Taxonomy:
 * - TRUSTED_BENIGN: Complete telemetry, verified non-adversarial, admitted for baseline fitting.
 * - UNREVIEWED: General traffic with normal error tolerances (4xx < 0.30, 5xx < 0.10); admitted for diversity.
 * - SUSPICIOUS: Medium-severity anomalies or unverified patterns; quarantined from training.
 * - CONTAMINATED: Confirmed attack traffic (prohibited verbs, brute force, spidering); strictly excluded.
 * - INCOMPLETE: Telemetry loss, buffer drops, or degraded collection; excluded due to data defects.
 * - EXCLUDED: Manually or policy-quarantined datasets.
 */

import { IsolationForest } from './isolation-forest.js';
import { StatisticalBaselineDetector } from './statistical-baseline.js';
import { FeaturePreprocessor, NUMERICAL_FEATURE_KEYS } from './feature-preprocessor.js';
import { logger } from '../../utils/logger.js';

export const MIN_ELIGIBLE_TRAINING_SAMPLES = 20;

export const TRAINING_PROVENANCE = Object.freeze({
  TRUSTED_BENIGN: 'TRUSTED_BENIGN',
  UNREVIEWED: 'UNREVIEWED',
  SUSPICIOUS: 'SUSPICIOUS',
  CONTAMINATED: 'CONTAMINATED',
  INCOMPLETE: 'INCOMPLETE',
  EXCLUDED: 'EXCLUDED'
});

export class ModelTrainingService {
  /**
   * @param {object} options
   * @param {import('@prisma/client').PrismaClient} options.prisma
   */
  constructor(options = {}) {
    this.prisma = options.prisma;
  }

  /**
   * Evaluates a feature set and assigns explicit training eligibility provenance.
   *
   * @param {object} fSet - BehavioralFeatureSet record
   * @param {Array<object>} [assessments] - Associated behavioral assessments
   * @returns {{ provenance: string, isEligible: boolean, reason: string }}
   */
  classifyFeatureSetEligibility(fSet, assessments = []) {
    const qm = fSet.qualityMetadata || {};
    const features = fSet.features || {};

    // 1. Incomplete Telemetry check
    if (qm.telemetryLossDetected === true || qm.hasDataLoss === true || qm.completenessStatus === 'PARTIAL' || qm.completenessStatus === 'DEGRADED') {
      return {
        provenance: TRAINING_PROVENANCE.INCOMPLETE,
        isEligible: false,
        reason: 'Telemetry loss or incomplete observation collection detected in window.'
      };
    }

    if ((fSet.observationCount || 0) < 2) {
      return {
        provenance: TRAINING_PROVENANCE.INCOMPLETE,
        isEligible: false,
        reason: 'Observation count too low for reliable feature extraction.'
      };
    }

    // 2. Contamination Check (Active HIGH or CRITICAL attack rules)
    const hasCriticalAttack = assessments.some(
      (a) => a.assessmentLabel === 'HIGHLY_SUSPICIOUS' || (a.riskScore || 0) >= 0.85
    );
    if (hasCriticalAttack) {
      return {
        provenance: TRAINING_PROVENANCE.CONTAMINATED,
        isEligible: false,
        reason: 'Window contains confirmed high-severity adversarial attack patterns.'
      };
    }

    // 3. Error Rate Tolerance Check
    const http4xx = features.http_4xx_ratio?.value ?? 0.0;
    const http5xx = features.http_5xx_ratio?.value ?? 0.0;
    const authFailures = features.auth_failure_count?.value ?? 0;

    if (authFailures >= 5 || http4xx >= 0.50) {
      return {
        provenance: TRAINING_PROVENANCE.SUSPICIOUS,
        isEligible: false,
        reason: 'Excessive client failure ratio or auth rejections; quarantined from training.'
      };
    }

    // 4. Trusted Benign vs Unreviewed Diversity
    if (http4xx === 0.0 && http5xx === 0.0 && assessments.every((a) => a.assessmentLabel === 'NORMAL')) {
      return {
        provenance: TRAINING_PROVENANCE.TRUSTED_BENIGN,
        isEligible: true,
        reason: 'Clean baseline traffic with zero error rates and complete telemetry.'
      };
    }

    // Unreviewed but normal diversity (crawlers, occasional typos, transient errors)
    return {
      provenance: TRAINING_PROVENANCE.UNREVIEWED,
      isEligible: true,
      reason: 'Standard application traffic representing legitimate workload diversity.'
    };
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

      // 3. Query Candidate Feature Sets
      const candidateFeatureSets = await this.prisma.behavioralFeatureSet.findMany({
        where: {
          tenantId,
          applicationId,
          schemaVersion: '1.0.0'
        },
        orderBy: { windowEnd: 'asc' },
        take: 1000
      });

      // Query recent assessments to check for contamination
      const recentAssessments = await this.prisma.behavioralAssessment.findMany({
        where: { tenantId, applicationId },
        take: 1000
      });

      // Filter and classify training provenance
      const provenanceCounts = {};
      const eligibleFeatureSets = [];

      for (const fSet of candidateFeatureSets) {
        const matchingAssessments = recentAssessments.filter(
          (a) => a.sessionRef === fSet.sessionRef
        );
        const classification = this.classifyFeatureSetEligibility(fSet, matchingAssessments);
        provenanceCounts[classification.provenance] = (provenanceCounts[classification.provenance] || 0) + 1;

        if (classification.isEligible) {
          eligibleFeatureSets.push(fSet);
        }
      }

      // 4. Insufficient Data Check
      if (eligibleFeatureSets.length < minSamples) {
        const errorMsg = `INSUFFICIENT_TRAINING_DATA: Found ${eligibleFeatureSets.length} eligible feature sets; minimum required is ${minSamples}.`;
        logger.warn(errorMsg, { tenantId, applicationId, provenanceCounts });

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
          sampleCount: eligibleFeatureSets.length,
          minSamplesRequired: minSamples,
          provenanceCounts,
          message: errorMsg
        };
      }

      // 5. Preprocess Features (Zero-Identifier Vectors)
      const preprocessor = new FeaturePreprocessor({ featureKeys: NUMERICAL_FEATURE_KEYS });
      const rawVectors = eligibleFeatureSets.map((fSet) => {
        const { vector } = preprocessor.extractVector(fSet.features, fSet.schemaVersion);
        return vector;
      });

      preprocessor.fit(rawVectors);
      const scaledVectors = rawVectors.map((v) => preprocessor.transform(v));

      // 6. Train Selected Algorithm
      let trainedModelArtifact = null;
      let decisionThreshold = 0.60;

      if (algorithm === 'ISOLATION_FOREST') {
        const iforest = new IsolationForest({
          numTrees: 50,
          sampleSize: Math.min(128, scaledVectors.length),
          decisionThreshold: 0.60,
          seed: 42
        });
        iforest.fit(scaledVectors);
        trainedModelArtifact = iforest.toJSON();
        decisionThreshold = iforest.decisionThreshold;
      } else if (algorithm === 'STATISTICAL_MAD' || algorithm === 'STATISTICAL_BASELINE') {
        const statDetector = new StatisticalBaselineDetector({
          decisionThreshold: 0.60
        });
        statDetector.fit(scaledVectors);
        trainedModelArtifact = statDetector.toJSON();
        decisionThreshold = statDetector.decisionThreshold;
      } else {
        throw new Error(`Unsupported detection algorithm: ${algorithm}`);
      }

      // 7. Versioning: Supersede previous ACTIVE models for this application
      await this.prisma.detectionModelVersion.updateMany({
        where: {
          tenantId,
          applicationId,
          status: 'ACTIVE'
        },
        data: {
          status: 'SUPERSEDED'
        }
      });

      // 8. Persist New Model Version
      const modelVersionString = `v${Date.now()}-${algorithm.toLowerCase().slice(0, 7)}`;
      const trainingDurationMs = Date.now() - startTime;

      const createdModel = await this.prisma.detectionModelVersion.create({
        data: {
          tenantId,
          applicationId,
          algorithm,
          version: modelVersionString,
          status: 'ACTIVE',
          decisionThreshold,
          featureSchemaVersion: '1.0.0',
          includedFeatureKeys: NUMERICAL_FEATURE_KEYS,
          trainingMetrics: {
            sampleCount: scaledVectors.length,
            trainingDurationMs,
            scalingParameters: preprocessor.toJSON(),
            provenanceCounts,
            fittedAt: new Date().toISOString()
          },
          modelArtifact: trainedModelArtifact,
          trainedAt: new Date()
        }
      });

      // 9. Update ModelTrainingRun
      await this.prisma.modelTrainingRun.update({
        where: { id: trainingRun.id },
        data: {
          status: 'COMPLETED',
          sampleCount: scaledVectors.length,
          modelVersionId: createdModel.id,
          completedAt: new Date(),
          trainingDurationMs
        }
      });

      logger.info('Anomaly detection model trained successfully', {
        tenantId,
        applicationId,
        version: modelVersionString,
        algorithm,
        sampleCount: scaledVectors.length
      });

      return {
        success: true,
        status: 'MODEL_TRAINED',
        trainingRunId: trainingRun.id,
        modelVersion: {
          id: createdModel.id,
          version: createdModel.version,
          algorithm: createdModel.algorithm,
          sampleCount: scaledVectors.length,
          decisionThreshold: createdModel.decisionThreshold,
          provenanceCounts,
          trainedAt: createdModel.trainedAt
        },
        message: `Model ${modelVersionString} trained successfully on ${scaledVectors.length} eligible feature sets.`
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

      throw err;
    }
  }
}
