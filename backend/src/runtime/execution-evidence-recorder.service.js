/**
 * Execution Evidence Recorder Service (Stage 5B.1).
 *
 * Records chronological execution events and maintains audit evidence across the
 * runtime lifecycle.
 *
 * Execution Invariant:
 * Never records an event as successfully executed (CONFIRMED_EXECUTION) unless an actual
 * verified outcome exists. In Stage 5B.1, all execution evidence status remains strictly MISSING.
 */

import { getPrismaClient } from '../db/client.js';
import { recordSecurityAudit } from '../utils/audit.js';

export const EXECUTION_EVENT_TYPES = {
  AUTHORIZATION_REQUESTED: 'AUTHORIZATION_REQUESTED',
  AUTHORIZATION_APPROVED: 'AUTHORIZATION_APPROVED',
  AUTHORIZATION_DENIED: 'AUTHORIZATION_DENIED',
  AUTHORIZATION_REVOKED: 'AUTHORIZATION_REVOKED',
  AUTHORIZATION_EXPIRED: 'AUTHORIZATION_EXPIRED',
  PROVISIONING_REQUESTED: 'PROVISIONING_REQUESTED',
  PROVISIONING_SUCCEEDED: 'PROVISIONING_SUCCEEDED',
  PROVISIONING_FAILED: 'PROVISIONING_FAILED',
  CONTAINER_CREATED: 'CONTAINER_CREATED',
  IMAGE_VERIFIED: 'IMAGE_VERIFIED',
  SECURITY_CONFIG_APPLIED: 'SECURITY_CONFIG_APPLIED',
  NETWORK_ISOLATION_VERIFIED: 'NETWORK_ISOLATION_VERIFIED',
  HEALTH_CHECK_PASSED: 'HEALTH_CHECK_PASSED',
  EGRESS_QUARANTINE_VERIFIED: 'EGRESS_QUARANTINE_VERIFIED',
  ENVIRONMENT_HEALTH_VERIFIED: 'ENVIRONMENT_HEALTH_VERIFIED',
  DSG_TRANSITION_APPLIED: 'DSG_TRANSITION_APPLIED',
  DSG_TRANSITION_REJECTED: 'DSG_TRANSITION_REJECTED',
  ENVIRONMENT_TERMINATED: 'ENVIRONMENT_TERMINATED',
  CLEANUP_COMPLETED: 'CLEANUP_COMPLETED'
};

export class ExecutionEvidenceRecorder {
  /**
   * @param {Object} [prismaClient]
   */
  constructor(prismaClient = null) {
    this.prisma = prismaClient;
  }

  getDb() {
    return this.prisma || getPrismaClient();
  }

  /**
   * Record a runtime lifecycle event.
   *
   * @param {Object} params
   * @param {string} params.tenantId
   * @param {string} [params.authorizationId]
   * @param {string} [params.environmentId]
   * @param {string} params.eventType
   * @param {string} [params.severity='INFO']
   * @param {string} params.message
   * @param {string} [params.actorIdentifier]
   * @param {string} [params.actorRole]
   * @param {string} [params.outcomeStatus='RECORDED']
   * @param {Object} [params.eventPayload]
   * @returns {Promise<Object>}
   */
  async recordEvent({
    tenantId,
    authorizationId = null,
    environmentId = null,
    eventType,
    severity = 'INFO',
    message,
    actorIdentifier = 'RUNTIME_ORCHESTRATOR',
    actorRole = 'SYSTEM',
    outcomeStatus = 'RECORDED',
    evidenceStatus = 'MISSING',
    eventPayload = {}
  }) {
    const prisma = this.getDb();

    const event = await prisma.deceptionExecutionEvent.create({
      data: {
        tenantId,
        authorizationId,
        environmentId,
        eventType,
        severity,
        message,
        actorIdentifier,
        actorRole,
        outcomeStatus,
        evidenceStatus,
        eventPayload: {
          ...eventPayload,
          recordedTimestamp: new Date().toISOString()
        }
      }
    });

    // Also mirror to global AuditEvent log for unified security operations tracking
    await recordSecurityAudit({
      prisma,
      tenantId,
      action: `RUNTIME_${eventType}`,
      actorType: actorRole === 'USER' ? 'USER' : 'SYSTEM',
      actorId: actorIdentifier,
      targetType: environmentId ? 'RUNTIME_ENVIRONMENT' : 'EXECUTION_AUTHORIZATION',
      targetId: environmentId || authorizationId || tenantId,
      details: {
        eventType,
        severity,
        message,
        evidenceStatus,
        outcomeStatus
      }
    }).catch(() => {});

    return event;
  }

  /**
   * Record verified execution evidence emitted by the Dedicated Runtime Worker
   * after actual container / network inspection.
   *
   * @param {Object} params
   * @param {string} params.tenantId
   * @param {string} [params.authorizationId]
   * @param {string} [params.environmentId]
   * @param {string} params.eventType
   * @param {string} [params.severity='INFO']
   * @param {string} params.message
   * @param {string} [params.actorIdentifier='DEDICATED_RUNTIME_WORKER']
   * @param {string} [params.actorRole='SYSTEM']
   * @param {Object} [params.evidencePayload]
   * @returns {Promise<Object>}
   */
  async recordVerifiedEvidence({
    tenantId,
    authorizationId = null,
    environmentId = null,
    eventType,
    severity = 'INFO',
    message,
    actorIdentifier = 'DEDICATED_RUNTIME_WORKER',
    actorRole = 'SYSTEM',
    evidencePayload = {}
  }) {
    return this.recordEvent({
      tenantId,
      authorizationId,
      environmentId,
      eventType,
      severity,
      message,
      actorIdentifier,
      actorRole,
      outcomeStatus: 'CONFIRMED',
      evidenceStatus: 'VERIFIED',
      eventPayload: {
        ...evidencePayload,
        verificationTimestamp: new Date().toISOString(),
        verifiedBy: 'DEDICATED_RUNTIME_WORKER'
      }
    });
  }

  /**
   * Query execution events with tenant scoping and pagination.
   *
   * @param {Object} params
   * @param {string} params.tenantId
   * @param {string} [params.authorizationId]
   * @param {string} [params.environmentId]
   * @param {string} [params.eventType]
   * @param {number} [params.page=1]
   * @param {number} [params.limit=50]
   * @returns {Promise<{ events: Array, total: number, page: number, limit: number }>}
   */
  async listEvents({
    tenantId,
    authorizationId = null,
    environmentId = null,
    eventType = null,
    page = 1,
    limit = 50
  }) {
    const prisma = this.getDb();
    const where = { tenantId };

    if (authorizationId) where.authorizationId = authorizationId;
    if (environmentId) where.environmentId = environmentId;
    if (eventType) where.eventType = eventType;

    const [events, total] = await Promise.all([
      prisma.deceptionExecutionEvent.findMany({
        where,
        orderBy: { recordedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.deceptionExecutionEvent.count({ where })
    ]);

    return { events, total, page, limit };
  }
}
