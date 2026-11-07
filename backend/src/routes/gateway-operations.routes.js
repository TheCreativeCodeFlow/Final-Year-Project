/**
 * Gateway Operations Routes (Stage 5B.5).
 *
 * Mount path: /api/v1/tenants/:tenantId/gateway
 *
 * Exposes:
 * - GET  /overview: Dashboard summary, health, statistics, and safety status.
 * - GET  /requests: Paginated list of recent gateway routing decisions.
 * - GET  /requests/:correlationId: 14-stage Request-Decision Explorer data.
 * - POST /routing-mode: Routing mode update with safety validation.
 * - GET  /safety-status: Independent CONTROLLED_LAB readiness audit.
 */

import { Router } from 'express';
import {
  getGatewayOverview,
  listGatewayRequests,
  getRequestExplorerDetail,
  updateRoutingMode,
  getSafetyStatus
} from '../controllers/gateway-operations.controller.js';

export const gatewayOperationsRouter = Router({ mergeParams: true });

gatewayOperationsRouter.get('/overview', getGatewayOverview);
gatewayOperationsRouter.get('/requests', listGatewayRequests);
gatewayOperationsRouter.get('/requests/:correlationId', getRequestExplorerDetail);
gatewayOperationsRouter.post('/routing-mode', updateRoutingMode);
gatewayOperationsRouter.get('/safety-status', getSafetyStatus);
