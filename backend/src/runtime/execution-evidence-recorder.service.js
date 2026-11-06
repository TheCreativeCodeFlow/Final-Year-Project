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

import crypto from 'node:crypto';
import { getPrismaClient } from '../db/client.js';
import { recordSecurityAudit } from '../utils/audit.js';

/**
 * Deterministic JSON stringification using recursive key sorting (RFC 8785 style).
 */
export function canonicalStringify(obj) {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return `[${obj.map((item) => canonicalStringify(item)).join(',')}]`;
  }
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys.map((k) => `${JSON.stringify(k)}:${canonicalStringify(obj[k])}`);
  return `{${pairs.join(',')}}`;
}

/**
 * Verifies the cryptographic integrity of an execution evidence map.
 * Recomputes SHA-256 over canonicalized payload and checks match.
 *
 * @param {Object} evidenceMap
 * @returns {{ valid: boolean, calculatedHash: string, recordedHash: string, reason?: string }}
 */
export function verifyEvidenceIntegrity(evidenceMap) {
  if (!evidenceMap || typeof evidenceMap !== 'object') {
    return { valid: false, calculatedHash: null, recordedHash: null, reason: 'Invalid evidence map object.' };
  }

  const recordedHash = evidenceMap.evidenceHash || evidenceMap.canonicalPayloadSha256;
  if (!recordedHash) {
    return { valid: false, calculatedHash: null, recordedHash: null, reason: 'Evidence map lacks recorded evidenceHash.' };
  }

  // Clone evidence map excluding hash fields
  const cleanPayload = {};
  for (const [k, v] of Object.entries(evidenceMap)) {
    if (k !== 'evidenceHash' && k !== 'canonicalPayloadSha256') {
      cleanPayload[k] = v;
    }
  }

  const canonical = canonicalStringify(cleanPayload);
  const calculatedHash = crypto.createHash('sha256').update(canonical).digest('hex');

  // Also verify against original unstripped payload if hashed that way
  const matches = calculatedHash === recordedHash ||
    crypto.createHash('sha256').update(canonicalStringify(evidenceMap)).digest('hex') === recordedHash;

  return {
    valid: matches,
    calculatedHash,
    recordedHash,
    canonicalLength: canonical.length,
    reason: matches ? undefined : `Hash mismatch: expected ${recordedHash}, calculated ${calculatedHash}`
  };
}

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
