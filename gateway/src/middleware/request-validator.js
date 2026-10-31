/**
 * Gateway Request Validation Middleware.
 *
 * Implements hardened ingress protocol checks:
 * 1. HTTP Method validation against the documented allowlist.
 * 2. Explicit rejection of TRACE (Cross-Site Tracing defense) and unsupported methods with 405.
 * 3. HTTP Request Smuggling Defenses (RFC 7230 §3.3.3 / RFC 9112 §6.1):
 *    - Rejection of conflicting Transfer-Encoding and Content-Length headers.
 *    - Rejection of duplicate Content-Length headers.
 *    - Content-Length digit-only syntax verification.
 * 4. Host header validation:
 *    - Rejection of duplicate Host headers.
 *    - Syntax verification (preventing path traversal, null bytes, userinfo '@', spaces).
 * 5. Content-Length payload size enforcement (413 Payload Too Large).
 */

import { gatewayConfig } from '../config/env.js';

const ALLOWED_METHODS = new Set(gatewayConfig.ALLOWED_HTTP_METHODS);
const HOSTNAME_SYNTAX_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*(:[0-9]+)?$/i;

/**
 * Helper to record telemetry for rejected requests before connection termination.
 * Safe metadata only; never forwards to upstream origins.
 */
function recordRejectionTelemetry(req, { statusCode, errorCode }) {
  if (!req.telemetryRecorder) return;
  const startTime = req.startTime || process.hrtime.bigint();
  const durationMs = Number(process.hrtime.bigint() - startTime) / 1e6;
  const clientIp = req.ip || req.socket?.remoteAddress || '127.0.0.1';
  const host = req.headers?.host;

  let tenantId = null;
  let applicationId = null;
  if (req.appResolver && host && typeof host === 'string') {
    try {
      const local = req.appResolver.resolveTrustedOriginLocal(host);
      if (local) {
        tenantId = local.tenantId || null;
        applicationId = local.applicationId || null;
      }
    } catch {}
  }

  req.telemetryRecorder.recordTelemetry({
    tenantId,
    applicationId,
    correlationId: req.id || req.headers['x-request-id'] || 'req-rejected',
    method: req.method || 'UNKNOWN',
    normalizedRoute: req.url || '/',
    responseStatus: statusCode,
    durationMs,
    clientIp,
    validationOutcome: errorCode,
    forwardingResult: 'NOT_ATTEMPTED',
    routingDecision: null
  });
}

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
    recordRejectionTelemetry(req, { statusCode: 405, errorCode: 'METHOD_NOT_ALLOWED' });
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

  // 2. Request Smuggling Defense: Conflicting Transfer-Encoding & Content-Length
  const hasTransferEncoding = Boolean(req.headers['transfer-encoding']);
  const hasContentLength = Boolean(req.headers['content-length']);

  if (hasTransferEncoding && hasContentLength) {
    recordRejectionTelemetry(req, { statusCode: 400, errorCode: 'REQUEST_SMUGGLING_DETECTED' });
    res.setHeader('Connection', 'close');
    return res.status(400).json({
      success: false,
      error: {
        code: 'REQUEST_SMUGGLING_DETECTED',
        message: 'Conflicting Transfer-Encoding and Content-Length headers detected.'
      },
      requestId
    });
  }

  // 3. Inspect raw headers for duplicate headers
  if (Array.isArray(req.rawHeaders)) {
    let hostCount = 0;
    let clCount = 0;

    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      const headerName = req.rawHeaders[i].toLowerCase();
      if (headerName === 'host') hostCount++;
      if (headerName === 'content-length') clCount++;
    }

    if (hostCount > 1) {
      recordRejectionTelemetry(req, { statusCode: 400, errorCode: 'DUPLICATE_HOST_HEADER' });
      res.setHeader('Connection', 'close');
      return res.status(400).json({
        success: false,
        error: {
          code: 'DUPLICATE_HOST_HEADER',
          message: 'Multiple Host headers are prohibited.'
        },
        requestId
      });
    }

    if (clCount > 1) {
      recordRejectionTelemetry(req, { statusCode: 400, errorCode: 'DUPLICATE_CONTENT_LENGTH' });
      res.setHeader('Connection', 'close');
      return res.status(400).json({
        success: false,
        error: {
          code: 'DUPLICATE_CONTENT_LENGTH',
          message: 'Multiple Content-Length headers are prohibited.'
        },
        requestId
      });
    }
  }

  // 4. Host Header Presence and Syntax Validation
  const host = req.headers.host;
  if (!host || typeof host !== 'string' || !host.trim()) {
    recordRejectionTelemetry(req, { statusCode: 400, errorCode: 'MISSING_HOST_HEADER' });
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

  const trimmedHost = host.trim();
  if (
    trimmedHost.includes('/') ||
    trimmedHost.includes('\\') ||
    trimmedHost.includes('@') ||
    trimmedHost.includes('\0') ||
    trimmedHost.includes(' ')
  ) {
    recordRejectionTelemetry(req, { statusCode: 400, errorCode: 'INVALID_HOST_HEADER' });
    res.setHeader('Connection', 'close');
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_HOST_HEADER',
        message: 'Host header contains invalid characters or userinfo.'
      },
      requestId
    });
  }

  // 5. Content-Length Syntax & Payload Size Enforcement
  const rawCl = req.headers['content-length'];
  if (rawCl !== undefined) {
    if (typeof rawCl !== 'string' || !/^\d+$/.test(rawCl.trim())) {
      recordRejectionTelemetry(req, { statusCode: 400, errorCode: 'INVALID_CONTENT_LENGTH' });
      res.setHeader('Connection', 'close');
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_CONTENT_LENGTH',
          message: 'Content-Length header must be a non-negative integer.'
        },
        requestId
      });
    }

    const lengthBytes = Number(rawCl.trim());
    if (lengthBytes > gatewayConfig.MAX_REQUEST_SIZE_BYTES) {
      recordRejectionTelemetry(req, { statusCode: 413, errorCode: 'PAYLOAD_TOO_LARGE' });
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
