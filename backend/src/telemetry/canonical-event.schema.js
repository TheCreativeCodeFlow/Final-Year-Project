/**
 * Canonical Telemetry Event Schema and Validation Specification (v1.0.0)
 *
 * Enforces a strict, versioned telemetry event structure:
 * 1. Strict semver version validation (rejects unsupported schema versions).
 * 2. Immutable UTC timestamp normalization.
 * 3. Range and type constraints (HTTP status 100-599, non-negative byte sizes, non-negative durations).
 * 4. Tenant boundary integrity (prevents client-supplied tenant spoofing).
 * 5. Route normalization (strips query strings and masks identifier parameters like UUIDs/integers).
 * 6. Privacy and zero-credential guarantee (rejects any passwords, cookies, authorization tokens, or raw request bodies).
 * 7. Non-attributive source metadata (subnet-level pseudonymization instead of treating raw IP as permanent identity).
 */

import crypto from 'node:crypto';

export const CANONICAL_SCHEMA_VERSION = '1.0.0';
export const SUPPORTED_SCHEMA_VERSIONS = new Set(['1.0.0']);

export const ALLOWED_HTTP_METHODS = new Set([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
  'TRACE',
  'CONNECT',
  'PROPFIND',
  'SEARCH'
]);

export const FORWARDING_RESULTS = new Set([
  'SUCCESS',
  'TIMEOUT',
  'CONNECTION_REFUSED',
  'CONNECTION_ERROR',
  'SSRF_BLOCKED',
  'STREAMING_FAILURE',
  'CLIENT_CLOSED_REQUEST',
  'NOT_ATTEMPTED',
  'BLOCKED_BY_POLICY',
  'FAIL_CLOSED'
]);

export const VALIDATION_OUTCOMES = new Set([
  'VALIDATED',
  'UNKNOWN_HOST',
  'UNREGISTERED_APPLICATION',
  'APPLICATION_NOT_PROTECTED',
  'TENANT_INACTIVE',
  'CROSS_TENANT_CONFLICT',
  'REQUEST_SMUGGLING_DETECTED',
  'DUPLICATE_HOST_HEADER',
  'DUPLICATE_CONTENT_LENGTH',
  'INVALID_HOST_HEADER',
  'MISSING_HOST_HEADER',
  'INVALID_CONTENT_LENGTH',
  'METHOD_NOT_ALLOWED',
  'PAYLOAD_TOO_LARGE',
  'PROHIBITED_UPSTREAM_DESTINATION',
  'SECURITY_CONTROL_UNAVAILABLE',
  'REJECTED'
]);

export const PERSISTENCE_STATUSES = new Set([
  'TELEMETRY_PERSISTED',
  'TELEMETRY_PENDING',
  'TELEMETRY_PERSISTENCE_FAILED',
  'NOT_RECORDED'
]);

const FORBIDDEN_CREDENTIAL_FIELDS = new Set([
  'password',
  'passwd',
  'secret',
  'authorization',
  'cookie',
  'set-cookie',
  'token',
  'apikey',
  'api_key',
  'body',
  'rawbody',
  'raw_body'
]);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CORRELATION_ID_REGEX = /^[a-zA-Z0-9_\-.]{8,64}$/;

/**
 * Normalizes an HTTP route by stripping query strings, trailing slashes,
 * and parameterizing dynamic resource IDs (UUIDs and numeric IDs) into ":id".
 *
 * Examples:
 *   "/api/v1/accounts/12345?debug=true" -> "/api/v1/accounts/:id"
 *   "/api/v1/users/550e8400-e29b-41d4-a716-446655440000" -> "/api/v1/users/:id"
 *
 * @param {string} rawPath
 * @returns {string}
 */
export function normalizeRouteTemplate(rawPath) {
  if (!rawPath || typeof rawPath !== 'string') return '/';

  // Strip query string and fragment
  const pathWithoutQuery = rawPath.split('?')[0].split('#')[0].trim();
  if (!pathWithoutQuery) return '/';

  // Normalize slashes
  const segments = pathWithoutQuery
    .replace(/\/+/g, '/')
    .replace(/^\/|\/$/g, '')
    .split('/');

  if (segments.length === 0 || (segments.length === 1 && segments[0] === '')) {
    return '/';
  }

  const normalizedSegments = segments.map((seg) => {
    // Check if segment is pure integer ID
    if (/^\d+$/.test(seg)) {
      return ':id';
    }
    // Check if segment is UUID
    if (UUID_REGEX.test(seg)) {
      return ':id';
    }
    // Check if segment looks like an opaque hash (e.g. hex or md5 > 24 chars)
    if (/^[0-9a-f]{24,}$/i.test(seg)) {
      return ':id';
    }
    return seg.toLowerCase();
  });

  return '/' + normalizedSegments.join('/');
}

/**
 * Generates pseudonymous non-attributive source metadata for an IP address.
 * Anonymizes the host portion of the address into a /24 (IPv4) or /48 (IPv6) subnet hash.
 *
 * @param {string} ip
 * @returns {{ clientIpType: string, ipSubnetHash: string, isLoopbackOrPrivate: boolean }}
 */
export function generateSourceMetadata(ip) {
  const cleanIp = (ip || '').trim().replace(/^::ffff:/, '');

  let clientIpType = 'UNKNOWN';
  let isLoopbackOrPrivate = false;
  let subnetBasis = cleanIp;

  if (cleanIp === '127.0.0.1' || cleanIp === '::1' || cleanIp === 'localhost') {
    clientIpType = 'LOOPBACK';
    isLoopbackOrPrivate = true;
    subnetBasis = 'loopback';
  } else if (/^\d{1,3}(\.\d{1,3}){3}$/.test(cleanIp)) {
    clientIpType = 'IPV4';
    const parts = cleanIp.split('.');
    const firstOctet = Number(parts[0]);
    const secondOctet = Number(parts[1]);

    if (
      firstOctet === 10 ||
      (firstOctet === 172 && secondOctet >= 16 && secondOctet <= 31) ||
      (firstOctet === 192 && secondOctet === 168)
    ) {
      isLoopbackOrPrivate = true;
    }
    // Truncate to /24 subnet (e.g. 198.51.100.x)
    subnetBasis = `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
  } else if (cleanIp.includes(':')) {
    clientIpType = 'IPV6';
    const parts = cleanIp.split(':').filter(Boolean);
    if (cleanIp.toLowerCase().startsWith('fe80:') || cleanIp.toLowerCase().startsWith('fc') || cleanIp.toLowerCase().startsWith('fd')) {
      isLoopbackOrPrivate = true;
    }
    // Truncate to first 3 hextets (/48 prefix)
    subnetBasis = parts.slice(0, 3).join(':') + '::/48';
  }

  // Generate deterministic SHA-256 hash of the subnet
  const ipSubnetHash = crypto.createHash('sha256').update(subnetBasis).digest('hex').slice(0, 16);

  return {
    clientIpType,
    ipSubnetHash,
    isLoopbackOrPrivate
  };
}

/**
 * Validates and normalizes raw telemetry into the Canonical Telemetry Event Schema.
 *
 * @param {object} rawEvent
 * @param {object} [options]
 * @param {string} [options.expectedTenantId] - If supplied, rejects mismatched tenant IDs.
 * @returns {{ valid: boolean, canonicalEvent?: object, errors?: string[] }}
 */
export function validateAndNormalizeCanonicalEvent(rawEvent, options = {}) {
  const errors = [];

  if (!rawEvent || typeof rawEvent !== 'object' || Array.isArray(rawEvent)) {
    return { valid: false, errors: ['EVENT_MUST_BE_OBJECT'] };
  }

  // 1. Schema Version Enforcement
  const schemaVersion = rawEvent.schemaVersion || CANONICAL_SCHEMA_VERSION;
  if (!SUPPORTED_SCHEMA_VERSIONS.has(schemaVersion)) {
    errors.push(`UNSUPPORTED_SCHEMA_VERSION: Version "${schemaVersion}" is not supported.`);
  }

  // 2. Correlation & Event Identifiers
  const rawCorr = rawEvent.correlationId;
  if (!rawCorr || typeof rawCorr !== 'string' || !CORRELATION_ID_REGEX.test(rawCorr.trim())) {
    errors.push('INVALID_CORRELATION_ID: correlationId must be a valid correlation identifier string or UUID (8-64 chars).');
  }
  const correlationId = rawCorr ? rawCorr.trim() : null;

  const eventId = rawEvent.eventId && UUID_REGEX.test(rawEvent.eventId)
    ? rawEvent.eventId
    : crypto.randomUUID();

  // 3. Tenant Boundary Verification
  const tenantId = rawEvent.tenantId;
  if (!tenantId || typeof tenantId !== 'string') {
    errors.push('MISSING_TENANT_ID: tenantId is strictly required.');
  } else if (options.expectedTenantId && tenantId !== options.expectedTenantId) {
    errors.push(`TENANT_MISMATCH: Provided tenantId does not match expected boundary "${options.expectedTenantId}".`);
  }

  // 4. Protected Application ID (optional for unmapped gateway ingress)
  const applicationId = rawEvent.applicationId || null;

  // 5. Timestamp Normalization (UTC ISO)
  let timestamp;
  try {
    const d = rawEvent.timestamp ? new Date(rawEvent.timestamp) : new Date();
    if (isNaN(d.getTime())) {
      errors.push('INVALID_TIMESTAMP: Provided timestamp cannot be parsed into a valid Date.');
    } else {
      timestamp = d.toISOString();
    }
  } catch {
    errors.push('INVALID_TIMESTAMP: Failed to process timestamp.');
  }

  // 6. HTTP Method Validation
  const httpMethod = (rawEvent.httpMethod || rawEvent.method || '').toUpperCase();
  const isValidMethodToken = /^[A-Z]{3,16}$/.test(httpMethod);
  if (!isValidMethodToken || (!ALLOWED_HTTP_METHODS.has(httpMethod) && !rawEvent.validationOutcome)) {
    errors.push(`INVALID_HTTP_METHOD: Method "${httpMethod}" is not a valid or recognized HTTP method.`);
  }

  // 7. Route Normalization
  const rawPath = rawEvent.normalizedRoute || rawEvent.requestPath || rawEvent.path || '/';
  const normalizedRoute = normalizeRouteTemplate(rawPath);

  // 8. HTTP Response Status Code (100 - 599)
  const responseStatus = Number(rawEvent.responseStatus || rawEvent.status || 0);
  if (!Number.isInteger(responseStatus) || responseStatus < 100 || responseStatus > 599) {
    errors.push(`INVALID_RESPONSE_STATUS: Status code "${responseStatus}" must be an integer between 100 and 599.`);
  }

  // 9. Numeric Request & Response Sizes (Non-negative)
  const requestSizeBytes = Number(rawEvent.requestSizeBytes ?? 0);
  if (!Number.isFinite(requestSizeBytes) || requestSizeBytes < 0) {
    errors.push('INVALID_REQUEST_SIZE: requestSizeBytes must be a non-negative number.');
  }

  const responseSizeBytes = Number(rawEvent.responseSizeBytes ?? 0);
  if (!Number.isFinite(responseSizeBytes) || responseSizeBytes < 0) {
    errors.push('INVALID_RESPONSE_SIZE: responseSizeBytes must be a non-negative number.');
  }

  // 10. Duration in Milliseconds (Non-negative)
  const durationMs = Number(rawEvent.durationMs ?? 0);
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    errors.push('INVALID_DURATION: durationMs must be a non-negative number.');
  }

  // 11. Forwarding Outcome & Validation Outcome
  const forwardingResult = rawEvent.forwardingResult || 'NOT_ATTEMPTED';
  if (!FORWARDING_RESULTS.has(forwardingResult)) {
    errors.push(`INVALID_FORWARDING_RESULT: Value "${forwardingResult}" is not a recognized forwarding result.`);
  }

  const validationOutcome = rawEvent.validationOutcome || 'VALIDATED';
  if (!VALIDATION_OUTCOMES.has(validationOutcome)) {
    errors.push(`INVALID_VALIDATION_OUTCOME: Value "${validationOutcome}" is not a recognized validation outcome.`);
  }

  // 12. Telemetry Persistence Status
  const persistenceStatus = rawEvent.persistenceStatus || 'TELEMETRY_PERSISTED';
  if (!PERSISTENCE_STATUSES.has(persistenceStatus)) {
    errors.push(`INVALID_PERSISTENCE_STATUS: Value "${persistenceStatus}" is not a recognized persistence status.`);
  }

  // 13. Privacy & Zero-Credential Verification
  // Deep check for forbidden credentials in any passed object
  const checkForbiddenKeys = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    for (const key of Object.keys(obj)) {
      if (FORBIDDEN_CREDENTIAL_FIELDS.has(key.toLowerCase())) {
        errors.push(`CREDENTIAL_LEAK_PREVENTED: Field "${key}" contains sensitive authentication data and is forbidden in canonical telemetry.`);
      }
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        checkForbiddenKeys(obj[key]);
      }
    }
  };
  checkForbiddenKeys(rawEvent);

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // 14. Non-Attributive Source Metadata & Session Reference
  const sourceMetadata = generateSourceMetadata(rawEvent.clientIp || rawEvent.sourceIp || '127.0.0.1');

  // Provenance metadata
  const provenance = {
    subsystem: rawEvent.provenance?.subsystem || 'GATEWAY_REVERSE_PROXY',
    ingressNode: rawEvent.provenance?.ingressNode || 'gw-local-node',
    normalizedAt: new Date().toISOString()
  };

  const canonicalEvent = {
    eventId,
    schemaVersion,
    correlationId,
    tenantId,
    applicationId,
    timestamp,
    httpMethod,
    normalizedRoute,
    responseStatus,
    requestSizeBytes: Math.round(requestSizeBytes),
    responseSizeBytes: Math.round(responseSizeBytes),
    durationMs: Number(durationMs.toFixed(3)),
    forwardingResult,
    validationOutcome,
    sessionReference: rawEvent.sessionReference || null,
    sourceMetadata,
    provenance,
    persistenceStatus
  };

  return { valid: true, canonicalEvent };
}
