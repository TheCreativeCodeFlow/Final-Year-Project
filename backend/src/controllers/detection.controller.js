/**
 * Detection Controller (Stage 4C)
 *
 * Exposes tenant-scoped REST APIs for:
 * - Querying hybrid behavioral assessments.
 * - Inspecting detection rules and effective thresholds.
 * - Managing application-specific ML anomaly models and training runs.
 * - Retrieving research evaluation benchmark metrics.
 */

import { getPrismaClient } from '../db/client.js';
import { RuleRegistry } from '../detection/rules/rule-registry.js';
import { ModelTrainingService } from '../detection/ml/training.service.js';
import { BenchmarkEvaluator } from '../detection/evaluation/benchmark-evaluator.js';
import { logger } from '../utils/logger.js';

const ruleRegistry = new RuleRegistry();
const benchmarkEvaluator = new BenchmarkEvaluator();

/**
 * Lists behavioral assessments for a tenant.
 */
export async function listAssessments(req, res, next) {
  try {
    const tenantId = req.authorizedTenant?.id || req.params.tenantId;
    const { applicationId, sessionRef, label, limit = 50, offset = 0 } = req.query;
    const prisma = getPrismaClient();

    const where = { tenantId };
    if (applicationId) where.applicationId = String(applicationId);
    if (sessionRef) where.sessionRef = String(sessionRef);
    if (label) where.assessmentLabel = String(label).toUpperCase();

    const [total, assessments] = await Promise.all([
      prisma.behavioralAssessment.count({ where }),
      prisma.behavioralAssessment.findMany({
        where,
        orderBy: { assessedAt: 'desc' },
        take: Math.min(100, Math.max(1, parseInt(limit, 10) || 50)),
        skip: Math.max(0, parseInt(offset, 10) || 0),
        include: {
          application: {
            select: { id: true, applicationIdentifier: true, name: true, domain: true }
          }
        }
      })
    ]);

    const normalized = assessments.map((asm) => ({
      ...asm,
      executionEvidenceStatus: 'MISSING'
    }));

    res.json({
      success: true,
      data: {
        total,
        limit: parseInt(limit, 10) || 50,
        offset: parseInt(offset, 10) || 0,
        assessments: normalized
      },
      requestId: req.id
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Retrieves a single behavioral assessment by ID.
 */
export async function getAssessment(req, res, next) {
  try {
    const tenantId = req.authorizedTenant?.id || req.params.tenantId;
    const { assessmentId } = req.params;
    const prisma = getPrismaClient();

    const assessment = await prisma.behavioralAssessment.findFirst({
      where: { id: assessmentId, tenantId },
      include: {
        application: {
          select: { id: true, applicationIdentifier: true, name: true, domain: true }
        },
        observation: {
          select: {
            id: true,
            observationIdentifier: true,
            observationType: true,
            evidenceProvenance: true,
            observedAt: true,
            sanitizedStructuredEvidence: true
          }
        }
      }
    });

    if (!assessment) {
      return res.status(404).json({
        success: false,
        error: { code: 'ASSESSMENT_NOT_FOUND', message: `Assessment "${assessmentId}" was not found.` },
        requestId: req.id
      });
    }

    res.json({
      success: true,
      data: {
        ...assessment,
        executionEvidenceStatus: 'MISSING'
      },
      requestId: req.id
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Lists available detection model versions for a tenant.
 */
export async function listModels(req, res, next) {
  try {
    const tenantId = req.authorizedTenant?.id || req.params.tenantId;
    const { applicationId } = req.query;
    const prisma = getPrismaClient();

    const where = { tenantId };
    if (applicationId) where.applicationId = String(applicationId);

    const models = await prisma.detectionModelVersion.findMany({
      where,
      orderBy: { version: 'desc' },
      select: {
        id: true,
        tenantId: true,
        applicationId: true,
        modelIdentifier: true,
        version: true,
        algorithm: true,
        status: true,
        trainingSampleCount: true,
        decisionThreshold: true,
        evaluationMetrics: true,
        trainedAt: true,
        expiresAt: true,
        application: {
          select: { id: true, applicationIdentifier: true, name: true, domain: true }
        }
      }
    });

    res.json({
      success: true,
      data: { models },
      requestId: req.id
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Triggers model training for a protected application.
 */
export async function triggerModelTraining(req, res, next) {
  try {
    const tenantId = req.authorizedTenant?.id || req.params.tenantId;
    const { applicationId, algorithm = 'ISOLATION_FOREST', minSamples } = req.body || {};
    const prisma = getPrismaClient();

    if (!applicationId) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_APPLICATION_ID', message: 'applicationId is required in request body.' },
        requestId: req.id
      });
    }

    const trainingService = new ModelTrainingService({ prisma });
    const result = await trainingService.trainModel({
      tenantId,
      applicationId,
      algorithm,
      minSamples: minSamples ? parseInt(minSamples, 10) : undefined,
      initiatedBy: req.user?.email || 'authenticated-operator'
    });

    const statusCode = result.success ? 201 : (result.status === 'INSUFFICIENT_TRAINING_DATA' ? 422 : 400);

    res.status(statusCode).json({
      success: result.success,
      data: result,
      requestId: req.id
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Lists detection rules with effective thresholds for this tenant.
 */
export async function listRules(req, res, next) {
  try {
    const tenantId = req.authorizedTenant?.id || req.params.tenantId;
    const rules = ruleRegistry.listRules(tenantId);

    res.json({
      success: true,
      data: { rules },
      requestId: req.id
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Executes or retrieves the research evaluation benchmark results.
 */
export async function getEvaluationBenchmark(req, res, next) {
  try {
    const results = benchmarkEvaluator.runEvaluation();

    res.json({
      success: true,
      data: results,
      requestId: req.id
    });
  } catch (err) {
    next(err);
  }
}
