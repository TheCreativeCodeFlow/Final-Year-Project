/**
 * Internal Gateway Routes.
 *
 * Exposes endpoints for the isolated Gateway runtime process:
 * - Application resolution
 * - Telemetry and outcome ingestion
 * - Gateway subsystem health
 *
 * All endpoints require the X-Gateway-Service-Token header matching GATEWAY_INTERNAL_TOKEN.
 */

import { Router } from 'express';
import crypto from 'node:crypto';
import {
  resolveApplication,
  recordTelemetry,
  getGatewayHealth
} from '../controllers/gateway-internal.controller.js';

export const gatewayInternalRouter = Router();

/**
 * Middleware: Verify internal gateway service token with timing-safe comparison.
 */
export function requireGatewayServiceToken(req, res, next) {
  const token = req.headers['x-gateway-service-token'];
  const expectedToken =
    req.app.get('envConfig')?.GATEWAY_INTERNAL_TOKEN ||
    process.env.GATEWAY_INTERNAL_TOKEN ||
    'dev-internal-gateway-token-secret-min32chars!';

  if (!token || typeof token !== 'string') {
    return res.status(401).json({
      success: false,
      error: {
        code: 'MISSING_SERVICE_TOKEN',
        message: 'Internal gateway service token is required in X-Gateway-Service-Token header.'
      }
    });
  }

  const tokenBuf = Buffer.from(token);
  const expectedBuf = Buffer.from(expectedToken);

  if (tokenBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(tokenBuf, expectedBuf)) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'INVALID_SERVICE_TOKEN',
        message: 'Invalid internal gateway service token.'
      }
    });
  }

  next();
}

// Subsystem health (unauthenticated or authenticated; allow unauthenticated for health probing)
gatewayInternalRouter.get('/health', getGatewayHealth);

// Application resolution and telemetry endpoints require service token
gatewayInternalRouter.use(requireGatewayServiceToken);
gatewayInternalRouter.get('/resolve-application', resolveApplication);
gatewayInternalRouter.post('/telemetry', recordTelemetry);
