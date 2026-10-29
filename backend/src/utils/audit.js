/**
 * Security Audit Logging Utility.
 *
 * Persists security-relevant application, policy, and tenant events into the PostgreSQL
 * audit_events table without logging passwords, tokens, or sensitive credentials.
 */

import { getPrismaClient } from '../db/client.js';
import { logger } from './logger.js';

/**
 * Records a security audit event in the database.
 * Fails gracefully without breaking request execution.
 *
 * @param {Object} params
 * @param {string} params.action - e.g. "APPLICATION_CREATED", "POLICY_UPDATED"
 * @param {string} [params.actorIdentifier] - User email, ID, or IP
 * @param {string} params.targetEntityType - e.g. "ProtectedApplication", "DeceptionPolicy"
 * @param {string} params.targetEntityId - Identifier or ID of affected entity
 * @param {string} [params.tenantId] - Tenant scope
 * @param {string} [params.correlationId] - Request correlation ID
 * @param {Object} [params.metadata] - Sanitized operational details
 * @param {import('@prisma/client').PrismaClient} [prisma]
 */
export async function recordSecurityAudit(params, prisma = getPrismaClient()) {
  const {
    action,
    actorIdentifier = 'system',
    targetEntityType,
    targetEntityId,
    tenantId = null,
    correlationId = null,
    metadata = {}
  } = params;

  try {
    await prisma.auditEvent.create({
      data: {
        action,
        actorIdentifier: String(actorIdentifier),
        targetEntityType: String(targetEntityType),
        targetEntityId: String(targetEntityId),
        tenantId,
        correlationId,
        structuredMetadata: metadata
      }
    });
  } catch (err) {
    logger.error('Failed to persist security audit event', {
      action,
      targetEntityType,
      targetEntityId,
      error: err.message
    });
  }
}
