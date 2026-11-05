/**
 * Synthetic Service Templates Catalogue (Stage 5B.2).
 *
 * Provides pre-approved, hardened synthetic service blueprints for deception environments:
 * 1. Synthetic API Service (simulated REST endpoints)
 * 2. Synthetic Authentication Service (simulated identity verification & tokens)
 * 3. Synthetic Data Service (simulated administrative and customer data records)
 *
 * Invariants:
 * - Fixed, documented synthetic datasets only.
 * - Absolutely zero connection to production application databases or real identities.
 * - No deliberately vulnerable OS configurations; safe, monitored synthetic application layer.
 */

export const SYNTHETIC_SERVICE_TYPES = Object.freeze({
  SYNTHETIC_API: 'SYNTHETIC_API',
  SYNTHETIC_AUTH: 'SYNTHETIC_AUTH',
  SYNTHETIC_DATA: 'SYNTHETIC_DATA'
});

export const SYNTHETIC_SERVICE_TEMPLATES = Object.freeze([
  {
    templateIdentifier: 'tpl-synthetic-api-01',
    name: 'Synthetic REST API Service',
    description: 'Simulates REST application endpoints with mock users, accounts, and resources',
    serviceType: 'SYNTHETIC_API',
    defaultImageIdentifier: 'img-syn-alpine-node-01',
    exposedInternalPort: 8080,
    healthCheckPath: '/health',
    endpoints: [
      { method: 'GET', path: '/health', description: 'Container liveness and service health probe' },
      { method: 'GET', path: '/api/v1/users', description: 'Synthetic user listings' },
      { method: 'GET', path: '/api/v1/users/:id', description: 'Synthetic user profile' },
      { method: 'GET', path: '/api/v1/accounts', description: 'Synthetic financial account balances' },
      { method: 'GET', path: '/api/v1/resources', description: 'Synthetic resource directory' }
    ],
    defaultEnvironmentVariables: {
      SYNTHETIC_SERVICE_TYPE: 'SYNTHETIC_API',
      PORT: '8080',
      NODE_ENV: 'production'
    },
    resourceDefaults: {
      allocatedCpu: 0.5,
      allocatedMemoryMb: 256,
      allocatedStorageMb: 512
    },
    isolationMode: 'SANDBOX_ISOLATED',
    version: '1.0.0'
  },
  {
    templateIdentifier: 'tpl-synthetic-auth-01',
    name: 'Synthetic Authentication Gateway',
    description: 'Simulates identity provider login endpoints, role issuance, and fake JWT generation',
    serviceType: 'SYNTHETIC_AUTH',
    defaultImageIdentifier: 'img-syn-alpine-node-01',
    exposedInternalPort: 8080,
    healthCheckPath: '/health',
    endpoints: [
      { method: 'GET', path: '/health', description: 'Service health check' },
      { method: 'POST', path: '/api/v1/auth/login', description: 'Consumes credentials and returns synthetic token' },
      { method: 'GET', path: '/api/v1/auth/session', description: 'Returns synthetic session claims' },
      { method: 'GET', path: '/api/v1/auth/roles', description: 'Returns synthetic role permissions' }
    ],
    defaultEnvironmentVariables: {
      SYNTHETIC_SERVICE_TYPE: 'SYNTHETIC_AUTH',
      PORT: '8080',
      NODE_ENV: 'production'
    },
    resourceDefaults: {
      allocatedCpu: 0.5,
      allocatedMemoryMb: 256,
      allocatedStorageMb: 512
    },
    isolationMode: 'SANDBOX_ISOLATED',
    version: '1.0.0'
  },
  {
    templateIdentifier: 'tpl-synthetic-data-01',
    name: 'Synthetic Data & Records Service',
    description: 'Simulates database and record enumeration services with fake customer records and schemas',
    serviceType: 'SYNTHETIC_DATA',
    defaultImageIdentifier: 'img-syn-alpine-node-01',
    exposedInternalPort: 8080,
    healthCheckPath: '/health',
    endpoints: [
      { method: 'GET', path: '/health', description: 'Service health check' },
      { method: 'GET', path: '/api/v1/data/customers', description: 'Synthetic enterprise customer accounts' },
      { method: 'GET', path: '/api/v1/data/schemas', description: 'Synthetic relational database schemas' },
      { method: 'GET', path: '/api/v1/data/records', description: 'Synthetic transaction and audit records' }
    ],
    defaultEnvironmentVariables: {
      SYNTHETIC_SERVICE_TYPE: 'SYNTHETIC_DATA',
      PORT: '8080',
      NODE_ENV: 'production'
    },
    resourceDefaults: {
      allocatedCpu: 0.5,
      allocatedMemoryMb: 256,
      allocatedStorageMb: 512
    },
    isolationMode: 'SANDBOX_ISOLATED',
    version: '1.0.0'
  }
]);

/**
 * Resolves a synthetic service template by identifier or type.
 *
 * @param {string} identifierOrType
 * @returns {Object|null}
 */
export function getSyntheticTemplate(identifierOrType) {
  if (!identifierOrType || typeof identifierOrType !== 'string') {
    return null;
  }
  const clean = identifierOrType.trim();
  const match = SYNTHETIC_SERVICE_TEMPLATES.find(
    (t) =>
      t.templateIdentifier.toLowerCase() === clean.toLowerCase() ||
      t.serviceType.toLowerCase() === clean.toLowerCase()
  );
  return match ? { ...match } : null;
}

/**
 * Returns all available synthetic service templates.
 *
 * @returns {Object[]}
 */
export function listSyntheticTemplates() {
  return SYNTHETIC_SERVICE_TEMPLATES.map((t) => ({ ...t }));
}
