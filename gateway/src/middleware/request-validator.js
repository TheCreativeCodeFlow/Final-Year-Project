/**
 * Gateway Request Validation Middleware.
 *
 * Implements:
 * 1. HTTP Method validation against the documented allowlist.
 * 2. Explicit rejection of TRACE (Cross-Site Tracing defense) and unsupported methods with 405.
 * 3. Host header presence and initial syntax verification.
 * 4. Content-Length payload size enforcement (413 Payload Too Large).
 */

import { gatewayConfig } from '../config/env.js';

const ALLOWED_METHODS = new Set(gatewayConfig.ALLOWED_HTTP_METHODS);

/**
 * Validates incoming HTTP requests before any upstream processing.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function validateGatewayRequest(req, res, next) {
  const method = req.method.toUpperCase();
  const requestId = req.headers['x-request-id'] || 'req-init';

  // 1. Method Validation
  if (!ALLOWED_METHODS.has(method)) {
    res.setHeader('Allow', Array.from(ALLOWED_METHODS).join(', '));
    res.setHeader('Connection', 'close');
    return res.status(405).json({
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: `HTTP method "${req.method}" is not supported by the gateway.`
      },
      requestId
    });
  }

  // 2. Host Header Validation
  const host = req.headers.host;
  if (!host || typeof host !== 'string' || !host.trim()) {
    res.setHeader('Connection', 'close');
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_HOST_HEADER',
        message: 'A valid Host header is required for application routing.'
      },
      requestId
    });
  }

  // 3. Request Size Limit Verification
  const contentLength = req.headers['content-length'];
  if (contentLength) {
    const lengthBytes = Number(contentLength);
    if (!isNaN(lengthBytes) && lengthBytes > gatewayConfig.MAX_REQUEST_SIZE_BYTES) {
      res.setHeader('Connection', 'close');
      return res.status(413).json({
        success: false,
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: `Request body exceeds maximum permitted size of ${gatewayConfig.MAX_REQUEST_SIZE_BYTES} bytes.`
        },
        requestId
      });
    }
  }

  next();
}
