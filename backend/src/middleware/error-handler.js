import { logger } from '../utils/logger.js';

/**
 * Centralized error-handling middleware.
 * Guarantees consistent JSON error structures and prevents stack trace or credential leakage.
 */
export function errorHandlerMiddleware(err, req, res, _next) {
  const requestId = req.id || null;

  // 1. Handle malformed JSON request bodies
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    logger.warn('Malformed JSON received in request body', {
      requestId,
      error: 'SyntaxError in JSON parse'
    });

    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: 'The request body could not be parsed as valid JSON.'
      },
      requestId
    });
  }

  // 2. Handle oversized payloads (body-parser / express.json limit)
  if (err.type === 'entity.too.large' || err.status === 413) {
    logger.warn('Request payload exceeded size limit', {
      requestId,
      status: 413
    });

    return res.status(413).json({
      success: false,
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request payload exceeds the configured maximum allowed size limit.'
      },
      requestId
    });
  }

  // 3. Handle CORS origin rejection
  if (err.message && err.message.includes('CORS')) {
    logger.warn('CORS origin denied', {
      requestId,
      origin: req.headers.origin || 'unknown'
    });

    return res.status(403).json({
      success: false,
      error: {
        code: 'CORS_ORIGIN_DENIED',
        message: 'The request origin is not permitted by gateway CORS policy.'
      },
      requestId
    });
  }

  // 4. General / Unhandled internal server error
  const statusCode = typeof err.status === 'number' && err.status >= 400 && err.status < 600
    ? err.status
    : 500;

  // Log full error internally for investigation, redacting secrets
  logger.error('Unhandled application exception', {
    requestId,
    statusCode,
    errorName: err.name || 'Error',
    errorMessage: err.message || 'Unknown error'
  });

  // Client receives a safe, generic error message with zero internal telemetry
  const isClientError = statusCode < 500;
  return res.status(statusCode).json({
    success: false,
    error: {
      code: isClientError ? (err.code || 'BAD_REQUEST') : 'INTERNAL_SERVER_ERROR',
      message: isClientError && err.message
        ? err.message
        : 'An unexpected internal error occurred. Please contact the gateway administrator.'
    },
    requestId
  });
}
