/**
 * Input Validation Utilities for Stage 3D REST API.
 */

const HOSTNAME_REGEX = /^(?!:\/\/)([a-zA-Z0-9-_]+\.)+[a-zA-Z]{2,}$/;
const IP_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const IDENTIFIER_REGEX = /^[a-zA-Z0-9-_]{3,50}$/;

export const ALLOWED_APPLICATION_STATUSES = ['PROTECTED', 'DEGRADED', 'BYPASS'];
export const ALLOWED_PERMITTED_ACTIONS = [
  'DIVERSION',
  'CONTAINMENT',
  'DELAY',
  'TARPIT',
  'HONEYPOT_DIVERSION',
  'CANARY_INJECTION',
  'BLOCK',
  'NORMAL_ROUTING'
];

/**
 * Validates a domain or hostname.
 * @param {string} domain
 * @returns {boolean}
 */
export function isValidDomainOrHostname(domain) {
  if (typeof domain !== 'string') return false;
  const clean = domain.trim().toLowerCase();
  if (clean.startsWith('http://') || clean.startsWith('https://')) return false;
  if (clean.includes('/') || clean.includes(':')) return false;
  return HOSTNAME_REGEX.test(clean) || IP_REGEX.test(clean) || clean === 'localhost';
}

/**
 * Validates an identifier format (e.g. app-01, pol-sec-01).
 * @param {string} id
 * @returns {boolean}
 */
export function isValidIdentifier(id) {
  if (typeof id !== 'string') return false;
  return IDENTIFIER_REGEX.test(id.trim());
}

/**
 * Parses and bounds pagination parameters.
 * @param {Object} query
 * @returns {{ page: number, limit: number, skip: number }}
 */
export function parsePagination(query = {}) {
  const rawPage = parseInt(query.page, 10);
  const rawLimit = parseInt(query.limit, 10);

  const page = !isNaN(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit = !isNaN(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 20;
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

/**
 * Validates Application creation payload.
 * Rejects unexpected keys and ensures required fields are valid.
 * @param {Object} body
 * @returns {{ valid: boolean, errors?: string[], sanitized?: Object }}
 */
export function validateCreateApplicationPayload(body = {}) {
  const errors = [];
  const allowedKeys = ['name', 'domain', 'applicationIdentifier', 'status'];

  // Check for disallowed tenantId or other unexpected fields
  for (const key of Object.keys(body)) {
    if (!allowedKeys.includes(key)) {
      if (key === 'tenantId') {
        errors.push('Modifying or specifying tenantId in the request body is prohibited.');
      } else {
        errors.push(`Unsupported or unrecognized field: "${key}".`);
      }
    }
  }

  const { name, domain, applicationIdentifier, status = 'PROTECTED' } = body;

  if (!name || typeof name !== 'string' || name.trim().length < 3 || name.trim().length > 100) {
    errors.push('Field "name" is required and must be between 3 and 100 characters.');
  }

  if (!domain || typeof domain !== 'string' || !isValidDomainOrHostname(domain)) {
    errors.push('Field "domain" is required and must be a valid hostname (e.g. api.example.com).');
  }

  if (status && !ALLOWED_APPLICATION_STATUSES.includes(status)) {
    errors.push(`Field "status" must be one of: ${ALLOWED_APPLICATION_STATUSES.join(', ')}.`);
  }

  if (applicationIdentifier !== undefined) {
    if (typeof applicationIdentifier !== 'string' || !isValidIdentifier(applicationIdentifier)) {
      errors.push('Field "applicationIdentifier" must be 3-50 characters (alphanumeric and hyphens).');
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    sanitized: {
      name: name.trim(),
      domain: domain.trim().toLowerCase(),
      applicationIdentifier: applicationIdentifier ? applicationIdentifier.trim() : undefined,
      status: status || 'PROTECTED'
    }
  };
}

/**
 * Validates Application update payload.
 * @param {Object} body
 * @returns {{ valid: boolean, errors?: string[], sanitized?: Object }}
 */
export function validateUpdateApplicationPayload(body = {}) {
  const errors = [];
  const allowedKeys = ['name', 'domain', 'status'];

  if (!body || typeof body !== 'object' || Object.keys(body).length === 0) {
    return { valid: false, errors: ['Request body must contain at least one field to update.'] };
  }

  for (const key of Object.keys(body)) {
    if (!allowedKeys.includes(key)) {
      if (key === 'tenantId') {
        errors.push('Modifying tenantId in the request body is prohibited.');
      } else if (key === 'applicationIdentifier') {
        errors.push('Changing applicationIdentifier is not permitted.');
      } else {
        errors.push(`Unsupported or unrecognized field: "${key}".`);
      }
    }
  }

  const sanitized = {};

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length < 3 || body.name.trim().length > 100) {
      errors.push('Field "name" must be between 3 and 100 characters.');
    } else {
      sanitized.name = body.name.trim();
    }
  }

  if (body.domain !== undefined) {
    if (typeof body.domain !== 'string' || !isValidDomainOrHostname(body.domain)) {
      errors.push('Field "domain" must be a valid hostname (e.g. api.example.com).');
    } else {
      sanitized.domain = body.domain.trim().toLowerCase();
    }
  }

  if (body.status !== undefined) {
    if (!ALLOWED_APPLICATION_STATUSES.includes(body.status)) {
      errors.push(`Field "status" must be one of: ${ALLOWED_APPLICATION_STATUSES.join(', ')}.`);
    } else {
      sanitized.status = body.status;
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, sanitized };
}

/**
 * Validates Deception Policy creation payload.
 * @param {Object} body
 * @returns {{ valid: boolean, errors?: string[], sanitized?: Object }}
 */
export function validateCreatePolicyPayload(body = {}) {
  const errors = [];
  const allowedKeys = [
    'name',
    'policyIdentifier',
    'description',
    'enabled',
    'priority',
    'triggerConditions',
    'requiredEvidenceCriteria',
    'permittedActions',
    'prohibitedActions',
    'protectedIsolationConstraints'
  ];

  for (const key of Object.keys(body)) {
    if (!allowedKeys.includes(key)) {
      if (key === 'tenantId') {
        errors.push('Modifying or specifying tenantId in the request body is prohibited.');
      } else {
        errors.push(`Unsupported or unrecognized field: "${key}".`);
      }
    }
  }

  const {
    name,
    policyIdentifier,
    description = null,
    enabled = true,
    priority = 100,
    triggerConditions,
    requiredEvidenceCriteria,
    permittedActions,
    prohibitedActions,
    protectedIsolationConstraints
  } = body;

  if (!name || typeof name !== 'string' || name.trim().length < 3 || name.trim().length > 100) {
    errors.push('Field "name" is required and must be between 3 and 100 characters.');
  }

  if (policyIdentifier !== undefined) {
    if (typeof policyIdentifier !== 'string' || !isValidIdentifier(policyIdentifier)) {
      errors.push('Field "policyIdentifier" must be 3-50 characters (alphanumeric and hyphens).');
    }
  }

  const numPriority = Number(priority);
  if (!Number.isInteger(numPriority) || numPriority < 1 || numPriority > 1000) {
    errors.push('Field "priority" must be an integer between 1 and 1000.');
  }

  if (typeof enabled !== 'boolean') {
    errors.push('Field "enabled" must be a boolean.');
  }

  if (!triggerConditions || typeof triggerConditions !== 'object' || Array.isArray(triggerConditions)) {
    errors.push('Field "triggerConditions" must be an object.');
  }

  if (!requiredEvidenceCriteria || typeof requiredEvidenceCriteria !== 'object' || Array.isArray(requiredEvidenceCriteria)) {
    errors.push('Field "requiredEvidenceCriteria" must be an object.');
  }

  if (!Array.isArray(permittedActions) || permittedActions.length === 0) {
    errors.push('Field "permittedActions" must be a non-empty array of action strings.');
  } else {
    for (const action of permittedActions) {
      if (!ALLOWED_PERMITTED_ACTIONS.includes(action)) {
        errors.push(`Unsupported action in permittedActions: "${action}". Allowed: ${ALLOWED_PERMITTED_ACTIONS.join(', ')}.`);
      }
    }
  }

  if (!Array.isArray(prohibitedActions)) {
    errors.push('Field "prohibitedActions" must be an array.');
  }

  if (!protectedIsolationConstraints || typeof protectedIsolationConstraints !== 'object' || Array.isArray(protectedIsolationConstraints)) {
    errors.push('Field "protectedIsolationConstraints" must be an object.');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    sanitized: {
      name: name.trim(),
      policyIdentifier: policyIdentifier ? policyIdentifier.trim() : undefined,
      description: description ? String(description).trim() : null,
      enabled,
      priority: numPriority,
      triggerConditions,
      requiredEvidenceCriteria,
      permittedActions,
      prohibitedActions,
      protectedIsolationConstraints
    }
  };
}

/**
 * Validates Deception Policy update payload.
 * @param {Object} body
 * @returns {{ valid: boolean, errors?: string[], sanitized?: Object }}
 */
export function validateUpdatePolicyPayload(body = {}) {
  const errors = [];
  const allowedKeys = [
    'name',
    'description',
    'enabled',
    'priority',
    'triggerConditions',
    'requiredEvidenceCriteria',
    'permittedActions',
    'prohibitedActions',
    'protectedIsolationConstraints'
  ];

  if (!body || typeof body !== 'object' || Object.keys(body).length === 0) {
    return { valid: false, errors: ['Request body must contain at least one field to update.'] };
  }

  for (const key of Object.keys(body)) {
    if (!allowedKeys.includes(key)) {
      if (key === 'tenantId') {
        errors.push('Modifying tenantId in the request body is prohibited.');
      } else if (key === 'policyIdentifier') {
        errors.push('Changing policyIdentifier is not permitted.');
      } else {
        errors.push(`Unsupported or unrecognized field: "${key}".`);
      }
    }
  }

  const sanitized = {};

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length < 3 || body.name.trim().length > 100) {
      errors.push('Field "name" must be between 3 and 100 characters.');
    } else {
      sanitized.name = body.name.trim();
    }
  }

  if (body.description !== undefined) {
    sanitized.description = body.description ? String(body.description).trim() : null;
  }

  if (body.enabled !== undefined) {
    if (typeof body.enabled !== 'boolean') {
      errors.push('Field "enabled" must be a boolean.');
    } else {
      sanitized.enabled = body.enabled;
    }
  }

  if (body.priority !== undefined) {
    const numPriority = Number(body.priority);
    if (!Number.isInteger(numPriority) || numPriority < 1 || numPriority > 1000) {
      errors.push('Field "priority" must be an integer between 1 and 1000.');
    } else {
      sanitized.priority = numPriority;
    }
  }

  if (body.triggerConditions !== undefined) {
    if (!body.triggerConditions || typeof body.triggerConditions !== 'object' || Array.isArray(body.triggerConditions)) {
      errors.push('Field "triggerConditions" must be an object.');
    } else {
      sanitized.triggerConditions = body.triggerConditions;
    }
  }

  if (body.requiredEvidenceCriteria !== undefined) {
    if (!body.requiredEvidenceCriteria || typeof body.requiredEvidenceCriteria !== 'object' || Array.isArray(body.requiredEvidenceCriteria)) {
      errors.push('Field "requiredEvidenceCriteria" must be an object.');
    } else {
      sanitized.requiredEvidenceCriteria = body.requiredEvidenceCriteria;
    }
  }

  if (body.permittedActions !== undefined) {
    if (!Array.isArray(body.permittedActions) || body.permittedActions.length === 0) {
      errors.push('Field "permittedActions" must be a non-empty array of action strings.');
    } else {
      for (const action of body.permittedActions) {
        if (!ALLOWED_PERMITTED_ACTIONS.includes(action)) {
          errors.push(`Unsupported action in permittedActions: "${action}". Allowed: ${ALLOWED_PERMITTED_ACTIONS.join(', ')}.`);
        }
      }
      sanitized.permittedActions = body.permittedActions;
    }
  }

  if (body.prohibitedActions !== undefined) {
    if (!Array.isArray(body.prohibitedActions)) {
      errors.push('Field "prohibitedActions" must be an array.');
    } else {
      sanitized.prohibitedActions = body.prohibitedActions;
    }
  }

  if (body.protectedIsolationConstraints !== undefined) {
    if (!body.protectedIsolationConstraints || typeof body.protectedIsolationConstraints !== 'object' || Array.isArray(body.protectedIsolationConstraints)) {
      errors.push('Field "protectedIsolationConstraints" must be an object.');
    } else {
      sanitized.protectedIsolationConstraints = body.protectedIsolationConstraints;
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, sanitized };
}
