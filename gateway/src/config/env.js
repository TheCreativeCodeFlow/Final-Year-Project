/**
 * Gateway Runtime Environment Configuration.
 *
 * Validates startup parameters:
 * - Ingress port and host
 * - Management API connection and service authentication
 * - Server-side trusted origin resolution map
 * - Request limits and connection timeouts
 */

const DEFAULT_ORIGIN_MAP = {
  'accounts.apexfintech.internal': {
    tenantIdentifier: 'tenant-apex-9941',
    applicationIdentifier: 'app-01',
    upstreamUrl: process.env.TEST_UPSTREAM_URL || 'http://127.0.0.1:8081',
    allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
    timeoutMs: 5000,
    maxBodyBytes: 1048576
  },
  'test-app.local': {
    tenantIdentifier: 'tenant-apex-9941',
    applicationIdentifier: 'app-01',
    upstreamUrl: process.env.TEST_UPSTREAM_URL || 'http://127.0.0.1:8081',
    allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
    timeoutMs: 5000,
    maxBodyBytes: 1048576
  },
  'idp.apexfintech.internal': {
    tenantIdentifier: 'tenant-apex-9941',
    applicationIdentifier: 'app-14',
    upstreamUrl: process.env.TEST_UPSTREAM_URL || 'http://127.0.0.1:8081',
    allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
    timeoutMs: 5000,
    maxBodyBytes: 1048576
  }
};

/**
 * Parses and validates the trusted origin map from environment or fallback.
 */
function parseOriginMap(rawJson) {
  if (!rawJson) return DEFAULT_ORIGIN_MAP;

  try {
    const parsed = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('GATEWAY_ORIGIN_MAP must be a JSON object mapping domains to origin configurations.');
    }

    const validated = {};
    for (const [domain, config] of Object.entries(parsed)) {
      if (!config.upstreamUrl) {
        throw new Error(`Domain "${domain}" in GATEWAY_ORIGIN_MAP is missing required "upstreamUrl".`);
      }
      validated[domain.toLowerCase().trim()] = {
        tenantIdentifier: config.tenantIdentifier || null,
        applicationIdentifier: config.applicationIdentifier || null,
        upstreamUrl: config.upstreamUrl.trim(),
        allowedMethods: config.allowedMethods || ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
        timeoutMs: Number(config.timeoutMs) || 5000,
        maxBodyBytes: Number(config.maxBodyBytes) || 1048576
      };
    }
    return validated;
  } catch (err) {
    throw new Error(`Failed to parse GATEWAY_ORIGIN_MAP: ${err.message}`);
  }
}

export function loadGatewayConfig(sourceEnv = process.env) {
  const NODE_ENV = (sourceEnv.NODE_ENV || 'development').toLowerCase();
  const PORT = Number(sourceEnv.PORT) || 8000;
  const HOST = sourceEnv.HOST || '0.0.0.0';
  const MANAGEMENT_API_URL = (
    sourceEnv.MANAGEMENT_API_URL || 'http://127.0.0.1:4000/api/v1'
  ).replace(/\/$/, '');

  const GATEWAY_INTERNAL_TOKEN =
    sourceEnv.GATEWAY_INTERNAL_TOKEN || 'dev-internal-gateway-token-secret-min32chars!';

  if (NODE_ENV === 'production' && GATEWAY_INTERNAL_TOKEN.length < 32) {
    throw new Error('In production, GATEWAY_INTERNAL_TOKEN must be at least 32 characters long.');
  }

  const UPSTREAM_TIMEOUT_MS = Number(sourceEnv.UPSTREAM_TIMEOUT_MS) || 5000;
  const MAX_REQUEST_SIZE_BYTES = Number(sourceEnv.MAX_REQUEST_SIZE_BYTES) || 1048576; // 1 MB
  const LOG_LEVEL = (sourceEnv.LOG_LEVEL || 'info').toLowerCase();
  const TRUSTED_ORIGIN_MAP = parseOriginMap(sourceEnv.GATEWAY_ORIGIN_MAP);

  // Supported standard HTTP methods
  const ALLOWED_HTTP_METHODS = [
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'HEAD',
    'OPTIONS'
  ];

  return Object.freeze({
    NODE_ENV,
    PORT,
    HOST,
    MANAGEMENT_API_URL,
    GATEWAY_INTERNAL_TOKEN,
    UPSTREAM_TIMEOUT_MS,
    MAX_REQUEST_SIZE_BYTES,
    LOG_LEVEL,
    TRUSTED_ORIGIN_MAP,
    ALLOWED_HTTP_METHODS,
    DECISION_CONTROLLER_URL: sourceEnv.DECISION_CONTROLLER_URL || null,
    isProduction: NODE_ENV === 'production',
    isTest: NODE_ENV === 'test'
  });
}

export const gatewayConfig = loadGatewayConfig();
