/**
 * Forwarded Headers Sanitizer.
 *
 * Implements:
 * 1. RFC 7230 hop-by-hop header removal.
 * 2. Elimination of client-injected proxy identity headers (preventing privilege escalation).
 * 3. Safe injection of standard reverse proxy headers (X-Forwarded-*, X-Request-ID).
 * 4. Response header sanitization (preventing upstream infrastructure fingerprinting).
 */

const STANDARD_HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade'
]);

// Headers that untrusted clients must NOT be allowed to inject
const SPOOFABLE_IDENTITY_HEADERS = new Set([
  'x-gateway-service-token',
  'x-gateway-identity',
  'x-internal-service',
  'x-tenant-id',
  'x-application-id',
  'x-user-id',
  'x-role',
  'x-is-platform-admin'
]);

// Response headers to strip to avoid leaking internal origin topology
const LEAKABLE_RESPONSE_HEADERS = new Set([
  'server',
  'x-powered-by',
  'x-aspnet-version',
  'x-aspnetmvc-version'
]);

/**
 * Sanitizes incoming client request headers before forwarding upstream.
 *
 * @param {import('node:http').IncomingHttpHeaders} incomingHeaders
 * @param {object} context
 * @param {string} context.clientIp
 * @param {string} context.validatedHost
 * @param {string} context.requestId
 * @param {string} context.protocol
 * @returns {Record<string, string>}
 */
export function sanitizeForwardedHeaders(incomingHeaders, context) {
  const { clientIp, validatedHost, requestId, protocol = 'http' } = context;
  const forwarded = {};

  // Parse any custom hop-by-hop headers listed in Connection header
  const customHopByHop = new Set();
  if (incomingHeaders.connection) {
    incomingHeaders.connection
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .forEach((h) => customHopByHop.add(h));
  }

  for (const [key, value] of Object.entries(incomingHeaders)) {
    const lowerKey = key.toLowerCase();

    // 1. Skip standard and custom hop-by-hop headers
    if (STANDARD_HOP_BY_HOP.has(lowerKey) || customHopByHop.has(lowerKey)) {
      continue;
    }

    // 2. Strip client-supplied proxy identity headers
    if (SPOOFABLE_IDENTITY_HEADERS.has(lowerKey)) {
      continue;
    }

    forwarded[key] = value;
  }

  // 3. Set standard proxy correlation and forwarding headers
  forwarded['host'] = validatedHost;

  // Append client IP to X-Forwarded-For
  const existingXff = incomingHeaders['x-forwarded-for'];
  if (existingXff) {
    forwarded['x-forwarded-for'] = `${existingXff}, ${clientIp}`;
  } else {
    forwarded['x-forwarded-for'] = clientIp;
  }

  forwarded['x-forwarded-proto'] = protocol;
  forwarded['x-forwarded-host'] = validatedHost;
  forwarded['x-request-id'] = requestId;

  return forwarded;
}

/**
 * Sanitizes upstream response headers before returning to the downstream client.
 *
 * @param {import('node:http').IncomingHttpHeaders} upstreamHeaders
 * @param {string} requestId
 * @returns {Record<string, string>}
 */
export function sanitizeResponseHeaders(upstreamHeaders, requestId) {
  const sanitized = {};

  for (const [key, value] of Object.entries(upstreamHeaders)) {
    const lowerKey = key.toLowerCase();

    // 1. Strip hop-by-hop response headers
    if (STANDARD_HOP_BY_HOP.has(lowerKey)) {
      continue;
    }

    // 2. Strip server fingerprinting headers
    if (LEAKABLE_RESPONSE_HEADERS.has(lowerKey)) {
      continue;
    }

    sanitized[key] = value;
  }

  // Propagate correlation ID on response
  sanitized['x-request-id'] = requestId;

  return sanitized;
}
