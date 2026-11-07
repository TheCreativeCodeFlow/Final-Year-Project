/**
 * Deception State Graph (DSG) Mutation Catalogue (Stage 5B.4).
 *
 * Defines the strict, allowlisted mutation dimensions, supported operations,
 * payload validation schemas, and pre-flight constraints for dynamic deception.
 *
 * Security Invariants:
 * - Only predefined mutation operations may execute.
 * - Zero arbitrary shell execution, SQL execution, filesystem tampering, or Docker reconfiguration.
 * - Zero real customer data replication or credential collection.
 * - Strict non-root, read-only rootfs, and internal network isolation compatibility.
 */

export const MUTATION_DIMENSIONS = Object.freeze({
  IDENTITY: 'IDENTITY_MUTATION',
  API_TOPOLOGY: 'API_TOPOLOGY_MUTATION',
  DATA: 'DATA_MUTATION',
  SERVICE_TOPOLOGY: 'SERVICE_TOPOLOGY_MUTATION',
  CREDENTIAL: 'CREDENTIAL_MUTATION'
});

export const MUTATION_OPERATIONS = Object.freeze({
  // Identity
  ADD_SYNTHETIC_USER: 'ADD_SYNTHETIC_USER',
  MODIFY_USER_ROLE: 'MODIFY_USER_ROLE',
  LINK_USER_RELATIONSHIP: 'LINK_USER_RELATIONSHIP',

  // API Topology
  ADD_SYNTHETIC_ROUTE: 'ADD_SYNTHETIC_ROUTE',
  MODIFY_ROUTE_BEHAVIOR: 'MODIFY_ROUTE_BEHAVIOR',
  SET_ROUTE_AVAILABILITY: 'SET_ROUTE_AVAILABILITY',

  // Synthetic Data
  ADD_SYNTHETIC_RECORD: 'ADD_SYNTHETIC_RECORD',
  MODIFY_DECOY_ATTRIBUTES: 'MODIFY_DECOY_ATTRIBUTES',
  SCHEMA_MUTATION: 'SCHEMA_MUTATION',

  // Service Topology
  ENABLE_SYNTHETIC_SERVICE: 'ENABLE_SYNTHETIC_SERVICE',
  DISABLE_SYNTHETIC_SERVICE: 'DISABLE_SYNTHETIC_SERVICE',
  UPDATE_SERVICE_CONFIG: 'UPDATE_SERVICE_CONFIG',

  // Credential Deception
  CREATE_DECOY_CREDENTIAL: 'CREATE_DECOY_CREDENTIAL',
  REVOKE_DECOY_CREDENTIAL: 'REVOKE_DECOY_CREDENTIAL',
  UPDATE_AUTH_MAPPING: 'UPDATE_AUTH_MAPPING'
});

export const ALLOWED_SYNTHETIC_ROLES = Object.freeze([
  'ADMINISTRATOR',
  'SECURITY_AUDITOR_DECOY',
  'FINANCIAL_ANALYST',
  'COMPLIANCE_OFFICER',
  'INFRASTRUCTURE_ENGINEER',
  'READONLY_API_INTEGRATION',
  'DATABASE_ADMIN_DECOY'
]);

export const ALLOWED_SYNTHETIC_SERVICES = Object.freeze([
  'SYNTHETIC_API',
  'SYNTHETIC_AUTH',
  'SYNTHETIC_DATA',
  'SYNTHETIC_PAYMENTS',
  'SYNTHETIC_AUDIT'
]);

export const ALLOWED_ROUTE_AVAILABILITIES = Object.freeze([
  'ENABLED',
  'DISABLED',
  'RATE_LIMITED',
  'TARPIT'
]);

export const ALLOWED_DATA_RECORD_TYPES = Object.freeze([
  'CUSTOMER',
  'ACCOUNT',
  'TRANSACTION',
  'AUDIT_LOG',
  'LEDGER'
]);

/**
 * Validates a proposed mutation operation and its payload against strict schema rules.
 *
 * @param {Object} mutation
 * @param {string} mutation.mutationType
 * @param {string} mutation.operation
 * @param {Object} mutation.payload
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateMutationSchema(mutation) {
  const errors = [];

  if (!mutation || typeof mutation !== 'object') {
    return { valid: false, errors: ['Mutation specification must be an object.'] };
  }

  const { mutationType, operation, payload } = mutation;

  if (!Object.values(MUTATION_DIMENSIONS).includes(mutationType)) {
    errors.push(`Invalid mutationType "${mutationType}". Must be one of: ${Object.values(MUTATION_DIMENSIONS).join(', ')}`);
  }

  if (!Object.values(MUTATION_OPERATIONS).includes(operation)) {
    errors.push(`Invalid operation "${operation}". Must be one of: ${Object.values(MUTATION_OPERATIONS).join(', ')}`);
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    errors.push('Mutation payload must be a non-null object.');
    return { valid: false, errors };
  }

  // Dimension-specific validations
  switch (operation) {
    case MUTATION_OPERATIONS.ADD_SYNTHETIC_USER:
      if (!payload.username || typeof payload.username !== 'string' || !/^[a-z0-9._-]+$/i.test(payload.username)) {
        errors.push('ADD_SYNTHETIC_USER requires a valid alphanumeric username.');
      }
      if (payload.role && !ALLOWED_SYNTHETIC_ROLES.includes(payload.role)) {
        errors.push(`Invalid role "${payload.role}". Allowed roles: ${ALLOWED_SYNTHETIC_ROLES.join(', ')}`);
      }
      break;

    case MUTATION_OPERATIONS.MODIFY_USER_ROLE:
      if (!payload.username && !payload.id) {
        errors.push('MODIFY_USER_ROLE requires a target username or user ID.');
      }
      if (!payload.role || !ALLOWED_SYNTHETIC_ROLES.includes(payload.role)) {
        errors.push(`MODIFY_USER_ROLE requires a valid new role from: ${ALLOWED_SYNTHETIC_ROLES.join(', ')}`);
      }
      break;

    case MUTATION_OPERATIONS.LINK_USER_RELATIONSHIP:
      if (!payload.username && !payload.id) {
        errors.push('LINK_USER_RELATIONSHIP requires a target username or user ID.');
      }
      if (!payload.relationships || typeof payload.relationships !== 'object') {
        errors.push('LINK_USER_RELATIONSHIP requires a relationships object (e.g. reportsTo, approverFor).');
      }
      break;

    case MUTATION_OPERATIONS.ADD_SYNTHETIC_ROUTE:
      if (!payload.path || typeof payload.path !== 'string' || !payload.path.startsWith('/api/')) {
        errors.push('ADD_SYNTHETIC_ROUTE requires path starting with /api/.');
      }
      if (payload.method && !['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(String(payload.method).toUpperCase())) {
        errors.push('ADD_SYNTHETIC_ROUTE requires standard HTTP method (GET, POST, PUT, DELETE, PATCH).');
      }
      if (payload.simulatedStatus && (typeof payload.simulatedStatus !== 'number' || payload.simulatedStatus < 200 || payload.simulatedStatus > 599)) {
        errors.push('ADD_SYNTHETIC_ROUTE simulatedStatus must be valid HTTP status code (200-599).');
      }
      if (payload.availability && !ALLOWED_ROUTE_AVAILABILITIES.includes(payload.availability)) {
        errors.push(`Invalid route availability "${payload.availability}". Allowed: ${ALLOWED_ROUTE_AVAILABILITIES.join(', ')}`);
      }
      break;

    case MUTATION_OPERATIONS.MODIFY_ROUTE_BEHAVIOR:
    case MUTATION_OPERATIONS.SET_ROUTE_AVAILABILITY:
      if (!payload.path || typeof payload.path !== 'string') {
        errors.push('Route mutation requires a target path.');
      }
      if (payload.availability && !ALLOWED_ROUTE_AVAILABILITIES.includes(payload.availability)) {
        errors.push(`Invalid route availability "${payload.availability}". Allowed: ${ALLOWED_ROUTE_AVAILABILITIES.join(', ')}`);
      }
      break;

    case MUTATION_OPERATIONS.ADD_SYNTHETIC_RECORD:
      if (!payload.type || !ALLOWED_DATA_RECORD_TYPES.includes(payload.type)) {
        errors.push(`ADD_SYNTHETIC_RECORD requires type from: ${ALLOWED_DATA_RECORD_TYPES.join(', ')}`);
      }
      if (!payload.record || typeof payload.record !== 'object') {
        errors.push('ADD_SYNTHETIC_RECORD requires a record object.');
      }
      break;

    case MUTATION_OPERATIONS.SCHEMA_MUTATION:
      if (!payload.table || typeof payload.table !== 'string' || !/^[a-z0-9_]+$/i.test(payload.table)) {
        errors.push('SCHEMA_MUTATION requires a valid alphanumeric table identifier.');
      }
      if (!Array.isArray(payload.columns) || payload.columns.length === 0) {
        errors.push('SCHEMA_MUTATION requires a non-empty columns array.');
      }
      break;

    case MUTATION_OPERATIONS.ENABLE_SYNTHETIC_SERVICE:
    case MUTATION_OPERATIONS.DISABLE_SYNTHETIC_SERVICE:
      if (!payload.serviceType || !ALLOWED_SYNTHETIC_SERVICES.includes(String(payload.serviceType).toUpperCase())) {
        errors.push(`Service mutation requires serviceType from: ${ALLOWED_SYNTHETIC_SERVICES.join(', ')}`);
      }
      break;

    case MUTATION_OPERATIONS.CREATE_DECOY_CREDENTIAL:
      if (!payload.username || typeof payload.username !== 'string') {
        errors.push('CREATE_DECOY_CREDENTIAL requires a target username.');
      }
      if (payload.token && (typeof payload.token !== 'string' || payload.token.length < 8)) {
        errors.push('CREATE_DECOY_CREDENTIAL token must be a string of at least 8 characters.');
      }
      break;

    default:
      break;
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
