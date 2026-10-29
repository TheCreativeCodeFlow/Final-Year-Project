import { randomUUID } from 'node:crypto';

// Bounded alphanumeric, hyphen, underscore pattern (max 64 characters)
const SAFE_REQUEST_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;

/**
 * Validates a candidate request ID.
 * Rejects values containing control characters, newlines, spaces, or unexpected symbols.
 * @param {unknown} val
 * @returns {boolean}
 */
export function isValidRequestId(val) {
  return typeof val === 'string' && SAFE_REQUEST_ID_REGEX.test(val);
}

/**
 * Generates a standard RFC 4122 UUIDv4 for request correlation.
 * @returns {string}
 */
export function generateRequestId() {
  return randomUUID();
}

/**
 * Express middleware to correlate requests using an auditable, bounded Request ID.
 * Adopts valid client-provided IDs or safely replaces invalid/missing headers.
 */
export function requestIdMiddleware(req, res, next) {
  const clientHeader = req.headers['x-request-id'] || req.headers['x-correlation-id'];

  let requestId;
  if (clientHeader && isValidRequestId(clientHeader)) {
    requestId = clientHeader;
  } else {
    requestId = generateRequestId();
  }

  req.id = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
}
