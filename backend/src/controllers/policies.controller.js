/**
 * Deception Policies Controller.
 *
 * Provides database-backed CRUD operations for tenant-scoped deception policies:
 * - Scoped strictly to req.authorizedTenant.id (plus platform-wide baselines for reads).
 * - Enforces that global baseline policies (tenantId === null) can only be updated by Platform Admins.
 * - Validates permittedActions, triggerConditions, priority, and isolation constraints.
 * - Emits security audit events on creation and updates.
 */

import crypto from 'node:crypto';
import { getPrismaClient } from '../db/client.js';
import {
  parsePagination,
  validateCreatePolicyPayload,
  validateUpdatePolicyPayload
} from '../utils/validators.js';
import { recordSecurityAudit } from '../utils/audit.js';

/**
 * List policies accessible by authorized tenant (tenant policies + platform baselines).
 */
export async function listPolicies(req, res, next) {
  const prisma = req.prisma || getPrismaClient();
  const tenantId = req.authorizedTenant.id;
  const correlationId = req.id || null;

  try {
    const { page, limit, skip } = parsePagination(req.query);

    const where = {
      OR: [{ tenantId }, { tenantId: null }]
    };

    if (req.query.enabled !== undefined) {
      if (req.query.enabled === 'true') where.enabled = true;
      if (req.query.enabled === 'false') where.enabled = false;
    }

    if (req.query.search && typeof req.query.search === 'string') {
      const search = req.query.search.trim();
      if (search.length > 0) {
        where.AND = [
          {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { policyIdentifier: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } }
            ]
          }
        ];
      }
    }

    const [policies, total] = await Promise.all([
      prisma.deceptionPolicy.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }]
      }),
      prisma.deceptionPolicy.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: policies,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      },
      requestId: correlationId
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Creates a new deception policy scoped to the authorized tenant.
 */
export async function createPolicy(req, res, next) {
  const prisma = req.prisma || getPrismaClient();
  const tenantId = req.authorizedTenant.id;
  const correlationId = req.id || null;

  try {
    const { valid, errors, sanitized } = validateCreatePolicyPayload(req.body);
    if (!valid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Deception policy payload validation failed.',
          details: errors,
          requestId: correlationId,
          timestamp: new Date().toISOString()
        }
      });
    }

    const policyIdentifier =
      sanitized.policyIdentifier || `pol-sec-${crypto.randomBytes(3).toString('hex')}`;

    // Verify policyIdentifier + version uniqueness
    const existing = await prisma.deceptionPolicy.findUnique({
      where: {
        policyIdentifier_version: {
          policyIdentifier,
          version: 1
        }
      }
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_POLICY_IDENTIFIER',
          message: `Policy identifier "${policyIdentifier}" version 1 already exists.`,
          requestId: correlationId,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Persist policy and audit event in transaction
    const newPolicy = await prisma.$transaction(async (tx) => {
      const created = await tx.deceptionPolicy.create({
        data: {
          tenantId,
          policyIdentifier,
          name: sanitized.name,
          description: sanitized.description,
          enabled: sanitized.enabled,
          priority: sanitized.priority,
          version: 1,
          triggerConditions: sanitized.triggerConditions,
          requiredEvidenceCriteria: sanitized.requiredEvidenceCriteria,
          permittedActions: sanitized.permittedActions,
          prohibitedActions: sanitized.prohibitedActions,
          protectedIsolationConstraints: sanitized.protectedIsolationConstraints
        }
      });

      await recordSecurityAudit(
        {
          action: 'POLICY_CREATED',
          actorIdentifier: req.user ? req.user.email : 'authenticated-user',
          targetEntityType: 'DeceptionPolicy',
          targetEntityId: created.id,
          tenantId,
          correlationId,
          metadata: {
            name: created.name,
            policyIdentifier: created.policyIdentifier,
            priority: created.priority,
            permittedActions: created.permittedActions
          }
        },
        tx
      );

      return created;
    });

    res.status(201).json({
      success: true,
      data: newPolicy,
      requestId: correlationId
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Retrieves a single deception policy by ID or policyIdentifier.
 */
export async function getPolicyById(req, res, next) {
  const prisma = req.prisma || getPrismaClient();
  const tenantId = req.authorizedTenant.id;
  const { policyId } = req.params;
  const correlationId = req.id || null;

  try {
    const policy = await prisma.deceptionPolicy.findFirst({
      where: {
        OR: [{ tenantId }, { tenantId: null }],
        AND: [
          {
            OR: [
              { id: policyId },
              { policyIdentifier: policyId }
            ]
          }
        ]
      }
    });

    if (!policy) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'POLICY_NOT_FOUND',
          message: `Deception policy "${policyId}" was not found in authorized tenant context.`,
          requestId: correlationId,
          timestamp: new Date().toISOString()
        }
      });
    }

    res.status(200).json({
      success: true,
      data: policy,
      requestId: correlationId
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Updates an existing deception policy.
 */
export async function updatePolicy(req, res, next) {
  const prisma = req.prisma || getPrismaClient();
  const tenantId = req.authorizedTenant.id;
  const { policyId } = req.params;
  const correlationId = req.id || null;

  try {
    const { valid, errors, sanitized } = validateUpdatePolicyPayload(req.body);
    if (!valid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Update policy payload validation failed.',
          details: errors,
          requestId: correlationId,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Locate policy
    const existing = await prisma.deceptionPolicy.findFirst({
      where: {
        OR: [
          { id: policyId },
          { policyIdentifier: policyId }
        ]
      }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'POLICY_NOT_FOUND',
          message: `Deception policy "${policyId}" was not found.`,
          requestId: correlationId,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Tenant boundary check:
    // If policy is global (tenantId === null), only Platform Admins can modify it
    if (existing.tenantId === null && !req.user.isPlatformAdmin) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied: Only Platform Administrators can modify platform-wide baseline policies.',
          requestId: correlationId,
          timestamp: new Date().toISOString()
        }
      });
    }

    // If policy is owned by another tenant, return 404 (do not disclose foreign tenant existence)
    if (existing.tenantId !== null && existing.tenantId !== tenantId && !req.user.isPlatformAdmin) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'POLICY_NOT_FOUND',
          message: `Deception policy "${policyId}" was not found in authorized tenant context.`,
          requestId: correlationId,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Persist update and audit event in transaction
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.deceptionPolicy.update({
        where: { id: existing.id },
        data: sanitized
      });

      await recordSecurityAudit(
        {
          action: 'POLICY_UPDATED',
          actorIdentifier: req.user ? req.user.email : 'authenticated-user',
          targetEntityType: 'DeceptionPolicy',
          targetEntityId: result.id,
          tenantId: result.tenantId || tenantId,
          correlationId,
          metadata: {
            changes: sanitized,
            previous: {
              name: existing.name,
              priority: existing.priority,
              enabled: existing.enabled
            }
          }
        },
        tx
      );

      return result;
    });

    res.status(200).json({
      success: true,
      data: updated,
      requestId: correlationId
    });
  } catch (err) {
    next(err);
  }
}
