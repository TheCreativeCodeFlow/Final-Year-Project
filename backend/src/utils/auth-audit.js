/**
 * Authentication Audit Logging Utility.
 *
 * Persists security-relevant authentication events into the PostgreSQL
 * audit_events table without logging passwords, tokens, or sensitive credentials.
 */

import { getPrismaClient } from '../db/client.js';
import { logger } from './logger.js';

/**
 * Records an authentication audit event in the database.
 * Fails gracefully without breaking request execution.
 *
 * @param {Object} params
 * @param {string} params.action - e.g. "AUTH_LOGIN_SUCCESS", "AUTH_LOGIN_FAILED", "AUTH_LOGOUT"
 * @param {string} [params.actorIdentifier] - User email, ID, or IP
 * @param {string} [params.targetEntityId] - User ID or Session ID
 * @param {string} [params.tenantId] - Optional tenant scope
 * @param {string} [params.correlationId] - Request correlation ID
 * @param {Object} [params.metadata] - Sanitized operational details (NO passwords or secrets)
 * @param {import('@prisma/client').PrismaClient} [prisma]
 */
export async function recordAuthAudit(params, prisma = getPrismaClient()) {
  const {
    action,
    actorIdentifier = null,
    targetEntityId = 'auth',
    tenantId = null,
    correlationId = null,
    metadata = {}
  } = params;

  try {
    await prisma.auditEvent.create({
      data: {
        action,
        actorIdentifier,
        targetEntityType: 'User',
        targetEntityId: String(targetEntityId),
        tenantId,
        correlationId,
        structuredMetadata: metadata
      }
    });
  } catch (err) {
    logger.error('Failed to persist authentication audit event', {
      action,
      error: err.message
    });
  }
}
