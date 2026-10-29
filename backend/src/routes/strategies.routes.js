/**
 * Deception Strategies Routes.
 * Mount path: /api/v1/tenants/:tenantId/strategies
 */

import { Router } from 'express';
import {
  listStrategies,
  getStrategyById
} from '../controllers/strategies.controller.js';

export const strategiesRouter = Router({ mergeParams: true });

// Read-only list of strategies
strategiesRouter.get('/', listStrategies);

// Read-only strategy detail
strategiesRouter.get('/:strategyId', getStrategyById);
