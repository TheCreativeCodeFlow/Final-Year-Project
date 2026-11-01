/**
 * Detection Routes (Stage 4C)
 *
 * Mount path: /api/v1/tenants/:tenantId/detection
 */

import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import {
  listAssessments,
  getAssessment,
  listModels,
  triggerModelTraining,
  listRules,
  getEvaluationBenchmark
} from '../controllers/detection.controller.js';

export const detectionRouter = Router({ mergeParams: true });

// Assessment query endpoints
detectionRouter.get('/assessments', listAssessments);
detectionRouter.get('/assessments/:assessmentId', getAssessment);

// Model lifecycle and training endpoints
detectionRouter.get('/models', listModels);
detectionRouter.post(
  '/models/train',
  requireRole(['APPLICATION_OWNER', 'PLATFORM_ADMIN']),
  triggerModelTraining
);

// Rule definitions and configuration
detectionRouter.get('/rules', listRules);

// Research evaluation benchmark
detectionRouter.get('/evaluation', getEvaluationBenchmark);
