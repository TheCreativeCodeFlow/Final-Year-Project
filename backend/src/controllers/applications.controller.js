/**
 * Protected Applications Controller.
 *
 * Provides database-backed CRUD operations for tenant-owned applications:
 * - Scoped strictly to req.authorizedTenant.id.
 * - Validated pagination, sorting, search, and payload validation.
 * - Disallows cross-tenant reassignment or unintended field mutations.
 * - Emits security audit events on creation and updates.
 */

import crypto from 'node:crypto';
import { getPrismaClient } from '../db/client.js';
import {
  parsePagination,
  validateCreateApplicationPayload,
  validateUpdateApplicationPayload,
  ALLOWED_APPLICATION_STATUSES
} from '../utils/validators.js';
import { recordSecurityAudit } from '../utils/audit.js';

/**
 * List all applications belonging to the authorized tenant.
 */
export async function listApplications(req, res, next) {
  const prisma = req.prisma || getPrismaClient();
  const tenantId = req.authorizedTenant.id;
  const correlationId = req.id || null;

  try {
    const { page, limit, skip } = parsePagination(req.query);

    // Build filter conditions
    const where = { tenantId };

    if (req.query.status) {
      const statusUpper = String(req.query.status).trim().toUpperCase();
      if (ALLOWED_APPLICATION_STATUSES.includes(statusUpper)) {
        where.status = statusUpper;
      }
    }

    if (req.query.search && typeof req.query.search === 'string') {
      const search = req.query.search.trim();
      if (search.length > 0) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { domain: { contains: search, mode: 'insensitive' } },
          { applicationIdentifier: { contains: search, mode: 'insensitive' } }
        ];
      }
    }

    // Sorting
    const allowedSortFields = ['name', 'domain', 'status', 'createdAt', 'updatedAt'];
    const sortBy = allowedSortFields.includes(req.query.sortBy) ? req.query.sortBy : 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 'asc' : 'desc';

    const [applications, total] = await Promise.all([
      prisma.protectedApplication.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          tenantId: true,
          applicationIdentifier: true,
          name: true,
          domain: true,
          status: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      prisma.protectedApplication.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: applications,
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
 * Creates a new protected application under the authorized tenant.
 */
export async function createApplication(req, res, next) {
  const prisma = req.prisma || getPrismaClient();
  const tenantId = req.authorizedTenant.id;
  const correlationId = req.id || null;

  try {
    const { valid, errors, sanitized } = validateCreateApplicationPayload(req.body);
    if (!valid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Application payload validation failed.',
          details: errors,
          requestId: correlationId,
          timestamp: new Date().toISOString()
        }
      });
    }

    const appIdentifier =
      sanitized.applicationIdentifier || `app-${crypto.randomBytes(3).toString('hex')}`;

    // Verify applicationIdentifier is unique within this tenant
    const existing = await prisma.protectedApplication.findUnique({
      where: {
        tenantId_applicationIdentifier: {
          tenantId,
          applicationIdentifier: appIdentifier
        }
      }
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_APPLICATION_IDENTIFIER',
          message: `Application identifier "${appIdentifier}" already exists in this tenant.`,
          requestId: correlationId,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Persist application and audit event atomically
    const newApp = await prisma.$transaction(async (tx) => {
      const created = await tx.protectedApplication.create({
        data: {
          tenantId,
          applicationIdentifier: appIdentifier,
          name: sanitized.name,
          domain: sanitized.domain,
          status: sanitized.status
        },
        select: {
          id: true,
          tenantId: true,
          applicationIdentifier: true,
          name: true,
          domain: true,
          status: true,
          createdAt: true,
          updatedAt: true
        }
      });

      await recordSecurityAudit(
        {
          action: 'APPLICATION_CREATED',
          actorIdentifier: req.user ? req.user.email : 'authenticated-user',
          targetEntityType: 'ProtectedApplication',
          targetEntityId: created.id,
          tenantId,
          correlationId,
          metadata: {
            name: created.name,
            domain: created.domain,
            applicationIdentifier: created.applicationIdentifier,
            status: created.status
          }
        },
        tx
      );

      return created;
    });

    res.status(201).json({
      success: true,
      data: newApp,
      requestId: correlationId
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Retrieve a single protected application by ID or applicationIdentifier.
 */
export async function getApplicationById(req, res, next) {
  const prisma = req.prisma || getPrismaClient();
  const tenantId = req.authorizedTenant.id;
  const { applicationId } = req.params;
  const correlationId = req.id || null;

  try {
    const app = await prisma.protectedApplication.findFirst({
      where: {
        tenantId,
        OR: [
          { id: applicationId },
          { applicationIdentifier: applicationId }
        ]
      },
      select: {
        id: true,
        tenantId: true,
        applicationIdentifier: true,
        name: true,
        domain: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!app) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'APPLICATION_NOT_FOUND',
          message: `Protected application "${applicationId}" was not found in authorized tenant context.`,
          requestId: correlationId,
          timestamp: new Date().toISOString()
        }
      });
    }

    res.status(200).json({
      success: true,
      data: app,
      requestId: correlationId
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Updates an existing protected application.
 */
export async function updateApplication(req, res, next) {
  const prisma = req.prisma || getPrismaClient();
  const tenantId = req.authorizedTenant.id;
  const { applicationId } = req.params;
  const correlationId = req.id || null;

  try {
    const { valid, errors, sanitized } = validateUpdateApplicationPayload(req.body);
    if (!valid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Update application payload validation failed.',
          details: errors,
          requestId: correlationId,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Locate application within authorized tenant boundary
    const existing = await prisma.protectedApplication.findFirst({
      where: {
        tenantId,
        OR: [
          { id: applicationId },
          { applicationIdentifier: applicationId }
        ]
      }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'APPLICATION_NOT_FOUND',
          message: `Protected application "${applicationId}" was not found in authorized tenant context.`,
          requestId: correlationId,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Persist update and audit log in a transaction
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.protectedApplication.update({
        where: { id: existing.id },
        data: sanitized,
        select: {
          id: true,
          tenantId: true,
          applicationIdentifier: true,
          name: true,
          domain: true,
          status: true,
          createdAt: true,
          updatedAt: true
        }
      });

      await recordSecurityAudit(
        {
          action: 'APPLICATION_UPDATED',
          actorIdentifier: req.user ? req.user.email : 'authenticated-user',
          targetEntityType: 'ProtectedApplication',
          targetEntityId: result.id,
          tenantId,
          correlationId,
          metadata: {
            changes: sanitized,
            previous: {
              name: existing.name,
              domain: existing.domain,
              status: existing.status
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
