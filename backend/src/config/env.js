/**
 * Environment configuration and startup validation for Adaptive Deception Gateway Backend.
 * Fails fast with descriptive error messages on malformed configuration.
 */

const VALID_NODE_ENVS = ['development', 'production', 'test'];
const VALID_LOG_LEVELS = ['debug', 'info', 'warn', 'error'];

/**
 * Validates and normalizes an integer port string or number.
 * @param {string|number|undefined} val
 * @param {number} defaultPort
 * @returns {number}
 */
function parsePort(val, defaultPort = 4000) {
  if (val === undefined || val === null || val === '') {
    return defaultPort;
  }

  const portNum = Number(val);
  if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
    throw new Error(
      `Invalid PORT configuration: "${val}". Port must be an integer between 1 and 65535.`
    );
  }
  return portNum;
}

/**
 * Normalizes CORS origins into an array of trimmed origin strings.
 * Disallows wildcard '*' in production or when explicit allowlist is expected.
 * @param {string|undefined} val
 * @returns {string[]}
 */
function parseCorsOrigins(val) {
  const raw = val || 'http://localhost:3000';
  const origins = raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    throw new Error('Invalid CORS_ORIGIN configuration: At least one origin must be specified.');
  }

  for (const origin of origins) {
    if (origin === '*') {
      throw new Error(
        'Invalid CORS_ORIGIN: Wildcard "*" is prohibited for secure enterprise gateway deployments. Use explicit origins.'
      );
    }
  }

  return origins;
}

/**
 * Validates and returns the application environment configuration.
 * @param {Record<string, string|undefined>} [sourceEnv=process.env]
 * @returns {Readonly<{
 *   NODE_ENV: string,
 *   HOST: string,
 *   PORT: number,
 *   LOG_LEVEL: string,
 *   CORS_ORIGIN: string[],
 *   BODY_LIMIT: string,
 *   DATABASE_URL?: string,
 *   isProduction: boolean,
 *   isDevelopment: boolean,
 *   isTest: boolean
 * }>}
 */
export function loadEnv(sourceEnv = process.env) {
  const NODE_ENV = (sourceEnv.NODE_ENV || 'development').toLowerCase();
  if (!VALID_NODE_ENVS.includes(NODE_ENV)) {
    throw new Error(
      `Invalid NODE_ENV "${NODE_ENV}". Expected one of: ${VALID_NODE_ENVS.join(', ')}.`
    );
  }

  const LOG_LEVEL = (sourceEnv.LOG_LEVEL || 'info').toLowerCase();
  if (!VALID_LOG_LEVELS.includes(LOG_LEVEL)) {
    throw new Error(
      `Invalid LOG_LEVEL "${LOG_LEVEL}". Expected one of: ${VALID_LOG_LEVELS.join(', ')}.`
    );
  }

  const PORT = parsePort(sourceEnv.PORT, 4000);
  const HOST = sourceEnv.HOST ? sourceEnv.HOST.trim() : '127.0.0.1';
  const CORS_ORIGIN = parseCorsOrigins(sourceEnv.CORS_ORIGIN);
  const BODY_LIMIT = sourceEnv.BODY_LIMIT ? sourceEnv.BODY_LIMIT.trim() : '100kb';

  const config = {
    NODE_ENV,
    HOST,
    PORT,
    LOG_LEVEL,
    CORS_ORIGIN,
    BODY_LIMIT,
    SESSION_TTL_HOURS: Number(sourceEnv.SESSION_TTL_HOURS) || 24,
    COOKIE_NAME: sourceEnv.COOKIE_NAME ? sourceEnv.COOKIE_NAME.trim() : 'adg_session',
    isProduction: NODE_ENV === 'production',
    isDevelopment: NODE_ENV === 'development',
    isTest: NODE_ENV === 'test'
  };

  // Attach SESSION_SECRET only if explicitly provided
  if (typeof sourceEnv.SESSION_SECRET === 'string' && sourceEnv.SESSION_SECRET.trim()) {
    if (NODE_ENV === 'production' && sourceEnv.SESSION_SECRET.trim().length < 32) {
      throw new Error('In production, SESSION_SECRET must be at least 32 characters long.');
    }
    config.SESSION_SECRET = sourceEnv.SESSION_SECRET.trim();
  }

  // Attach GATEWAY_INTERNAL_TOKEN (internal service authentication)
  const gatewayToken = sourceEnv.GATEWAY_INTERNAL_TOKEN
    ? sourceEnv.GATEWAY_INTERNAL_TOKEN.trim()
    : 'dev-internal-gateway-token-secret-min32chars!';
  if (NODE_ENV === 'production' && gatewayToken.length < 32) {
    throw new Error('In production, GATEWAY_INTERNAL_TOKEN must be at least 32 characters long.');
  }
  config.GATEWAY_INTERNAL_TOKEN = gatewayToken;

  // Only attach DATABASE_URL property if explicitly present in source environment
  if (typeof sourceEnv.DATABASE_URL === 'string' && sourceEnv.DATABASE_URL.trim()) {
    config.DATABASE_URL = sourceEnv.DATABASE_URL.trim();
  }

  return Object.freeze(config);
}

/**
 * Validates database configuration when database operations are requested.
 * @param {Record<string, any>} [sourceEnv=process.env]
 * @returns {string}
 */
export function validateDatabaseConfig(sourceEnv = process.env) {
  const url = sourceEnv.DATABASE_URL || (sourceEnv.DATABASE_URL ? sourceEnv.DATABASE_URL : null);
  if (!url || typeof url !== 'string' || !url.trim()) {
    throw new Error('DATABASE_URL is required for database operations but was not provided in the environment.');
  }

  const trimmed = url.trim();
  if (!/^postgres(ql)?:\/\//i.test(trimmed)) {
    throw new Error('Invalid DATABASE_URL: Must be a valid PostgreSQL connection URL starting with postgresql:// or postgres://');
  }

  return trimmed;
}

// Export pre-evaluated default environment for standard runtime imports
export const env = loadEnv();
