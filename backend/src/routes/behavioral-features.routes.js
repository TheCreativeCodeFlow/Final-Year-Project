/**
 * Behavioral Telemetry Feature and Baseline Routes.
 * Mount paths:
 *   /api/v1/tenants/:tenantId/behavioral-features
 *   /api/v1/tenants/:tenantId/behavioral-baselines
 */

import { Router } from 'express';
import {
  listBehavioralFeatures,
  getBehavioralFeatureById,
  listBehavioralBaselines,
  getBehavioralBaselineById,
  calibrateBaseline
} from '../controllers/behavioral-features.controller.js';

export const behavioralFeaturesRouter = Router({ mergeParams: true });
export const behavioralBaselinesRouter = Router({ mergeParams: true });

// Feature sets endpoints
behavioralFeaturesRouter.get('/', listBehavioralFeatures);
behavioralFeaturesRouter.get('/:id', getBehavioralFeatureById);

// Baselines endpoints
behavioralBaselinesRouter.get('/', listBehavioralBaselines);
behavioralBaselinesRouter.get('/:id', getBehavioralBaselineById);
behavioralBaselinesRouter.post('/calibrate', calibrateBaseline);
