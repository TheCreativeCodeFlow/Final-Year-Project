/**
 * Execution Evidence Recorder Service (Stage 5B.2.2).
 *
 * Records chronological execution events and maintains audit evidence across the
 * runtime lifecycle with append-linked SHA-256 hash chaining:
 *   event_hash = SHA256(canonical_payload + previous_event_hash)
 *
 * Cryptographic Integrity Semantics:
 * - Payload integrity: VERIFIED (recomputed canonical SHA-256 matches eventHash).
 * - Chain sequencing: VERIFIED (detects deleted, inserted, or reordered events).
 * - Non-repudiation: NOT_IMPLEMENTED (events are signed by the application, not an asymmetric external PKI key).
 * - Independent trust anchor: NOT_IMPLEMENTED (no RFC 3161 timestamp authority or external transparency log).
 */

import crypto from 'node:crypto';
import { getPrismaClient } from '../db/client.js';
import { recordSecurityAudit } from '../utils/audit.js';

export const GENESIS_PREVIOUS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Deterministic JSON stringification using recursive key sorting (RFC 8785 style).
 *
 * @param {any} obj
 * @returns {string}
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
 * Computes deterministic SHA-256 hash for an append-linked event chain node:
 *   event_hash = SHA256(canonicalStringify(payloadWithoutHash) + previousEventHash)
 *
 * @param {Object} params
 * @param {Object} params.payload
 * @param {string} params.previousEventHash
 * @param {number} params.sequenceNumber
 * @returns {string}
 */
export function computeChainHash({ payload, previousEventHash = GENESIS_PREVIOUS_HASH, sequenceNumber = 1 }) {
  const cleanPayload = {};
  for (const [k, v] of Object.entries(payload || {})) {
    if (k !== 'eventHash' && k !== 'evidenceHash' && k !== 'canonicalPayloadSha256') {
      cleanPayload[k] = v;
    }
  }
  cleanPayload.previousEventHash = previousEventHash;
  cleanPayload.sequenceNumber = sequenceNumber;

  const canonical = canonicalStringify(cleanPayload);
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

/**
 * Verifies the cryptographic integrity of an execution evidence map.
 * Recomputes SHA-256 over canonicalized payload and checks match.
 *
 * @param {Object} evidenceMap
 * @returns {{ valid: boolean, calculatedHash: string, recordedHash: string, nonRepudiation: string, independentTrustAnchor: string, reason?: string }}
 */
export function verifyEvidenceIntegrity(evidenceMap) {
  if (!evidenceMap || typeof evidenceMap !== 'object') {
    return {
      valid: false,
      calculatedHash: null,
      recordedHash: null,
      nonRepudiation: 'NOT_IMPLEMENTED',
      independentTrustAnchor: 'NOT_IMPLEMENTED',
      reason: 'Invalid evidence map object.'
    };
  }

  const recordedHash = evidenceMap.evidenceHash || evidenceMap.canonicalPayloadSha256 || evidenceMap.eventHash;
  if (!recordedHash) {
    return {
      valid: false,
      calculatedHash: null,
      recordedHash: null,
      nonRepudiation: 'NOT_IMPLEMENTED',
      independentTrustAnchor: 'NOT_IMPLEMENTED',
      reason: 'Evidence map lacks recorded evidenceHash or eventHash.'
    };
  }

  // Clone evidence map excluding hash fields
  const cleanPayload = {};
  for (const [k, v] of Object.entries(evidenceMap)) {
    if (k !== 'evidenceHash' && k !== 'canonicalPayloadSha256' && k !== 'eventHash') {
      cleanPayload[k] = v;
    }
  }

  const canonical = canonicalStringify(cleanPayload);
  const calculatedHash = crypto.createHash('sha256').update(canonical).digest('hex');

  // Also verify against original unstripped payload if hashed that way
  const matches =
    calculatedHash === recordedHash ||
    crypto.createHash('sha256').update(canonicalStringify(evidenceMap)).digest('hex') === recordedHash;

  return {
    valid: matches,
    calculatedHash,
    recordedHash,
    canonicalLength: canonical.length,
    nonRepudiation: 'NOT_IMPLEMENTED',
    independentTrustAnchor: 'NOT_IMPLEMENTED',
    reason: matches ? undefined : `Hash mismatch: expected ${recordedHash}, calculated ${calculatedHash}`
  };
}

/**
 * Verifies the append-linked evidence chain across a sequence of chronological events.
 * Detects:
 * - Modified event payloads (tamper detection)
 * - Modified event hashes
 * - Deleted intermediate events (broken sequence numbers)
 * - Reordered events
 * - Broken previous-event hash references
 *
 * @param {Object} params
 * @param {string} params.tenantId
 * @param {string} [params.environmentId]
 * @param {string} [params.authorizationId]
 * @param {Array<Object>} [params.events] - Optional in-memory events array; if omitted, queries DB
 * @param {Object} [params.prismaClient]
 * @returns {Promise<{ valid: boolean, chainLength: number, scope: string, violations: Array<Object>, genesisHash: string|null, latestHash: string|null, nonRepudiation: string, independentTrustAnchor: string }>}
 */
export async function verifyEvidenceChain({
  tenantId,
  environmentId = null,
  authorizationId = null,
  events = null,
  prismaClient = null
} = {}) {
  const prisma = prismaClient || getPrismaClient();
  let chainEvents = events;

  if (!chainEvents) {
    const where = { tenantId };
    if (environmentId) where.environmentId = environmentId;
    else if (authorizationId) where.authorizationId = authorizationId;

    chainEvents = await prisma.deceptionExecutionEvent.findMany({
      where,
      orderBy: { recordedAt: 'asc' }
    });
  }

  const scope = environmentId
    ? `environment:${environmentId}`
    : authorizationId
    ? `authorization:${authorizationId}`
    : `tenant:${tenantId}`;

  if (!chainEvents || chainEvents.length === 0) {
    return {
      valid: true,
      chainLength: 0,
      scope,
      violations: [],
      genesisHash: null,
      latestHash: null,
      nonRepudiation: 'NOT_IMPLEMENTED',
      independentTrustAnchor: 'NOT_IMPLEMENTED'
    };
  }

  const violations = [];
  let expectedPrevHash = GENESIS_PREVIOUS_HASH;
  let expectedSeq = 1;

  for (let idx = 0; idx < chainEvents.length; idx++) {
    const ev = chainEvents[idx];
    const payload = ev.eventPayload || {};
    const recordedHash = payload.eventHash || payload.evidenceHash;
    const prevHash = payload.previousEventHash;
    const seq = payload.sequenceNumber;

    // Check 1: Sequence number continuity
    if (typeof seq === 'number') {
      if (seq !== expectedSeq) {
        violations.push({
          type: 'SEQUENCE_GAP',
          index: idx,
          eventId: ev.id,
          expectedSequence: expectedSeq,
          recordedSequence: seq,
          message: `Sequence gap detected: expected #${expectedSeq}, got #${seq}. Possible deleted event.`
        });
      }
      expectedSeq = seq + 1;
    } else {
      expectedSeq++;
    }

    // Check 2: Previous event hash linkage
    if (prevHash) {
      if (prevHash !== expectedPrevHash) {
        violations.push({
          type: 'BROKEN_CHAIN_LINK',
          index: idx,
          eventId: ev.id,
          expectedPreviousHash: expectedPrevHash,
          recordedPreviousHash: prevHash,
          message: `Broken chain reference at index ${idx}: expected previous hash ${expectedPrevHash.slice(0, 16)}..., got ${prevHash.slice(0, 16)}...`
        });
      }
    }

    // Check 3: Cryptographic payload hash verification
    if (recordedHash) {
      const computedHash = computeChainHash({
        payload,
        previousEventHash: prevHash || expectedPrevHash,
        sequenceNumber: seq || idx + 1
      });

      if (computedHash !== recordedHash) {
        violations.push({
          type: 'PAYLOAD_TAMPERED',
          index: idx,
          eventId: ev.id,
          expectedHash: computedHash,
          recordedHash,
          message: `Tampered payload at event ${ev.id}: hash recomputation mismatch.`
        });
      }
      expectedPrevHash = recordedHash;
    } else if (prevHash) {
      expectedPrevHash = prevHash;
    }
  }

  return {
    valid: violations.length === 0,
    chainLength: chainEvents.length,
    scope,
    violations,
    genesisHash: chainEvents[0]?.eventPayload?.previousEventHash || null,
    latestHash: chainEvents[chainEvents.length - 1]?.eventPayload?.eventHash || null,
    nonRepudiation: 'NOT_IMPLEMENTED',
    independentTrustAnchor: 'NOT_IMPLEMENTED'
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
   * Record a runtime lifecycle event with append-linked SHA-256 chaining.
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
   * @param {string} [params.evidenceStatus='MISSING']
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

    // Determine chain scope and fetch last event to link hashes
    const scopeWhere = { tenantId };
    if (environmentId) scopeWhere.environmentId = environmentId;
    else if (authorizationId) scopeWhere.authorizationId = authorizationId;

    let previousEventHash = GENESIS_PREVIOUS_HASH;
    let sequenceNumber = 1;

    try {
      const lastEvent = await prisma.deceptionExecutionEvent.findFirst({
        where: scopeWhere,
        orderBy: { recordedAt: 'desc' }
      });

      if (lastEvent?.eventPayload) {
        const lastPayload = typeof lastEvent.eventPayload === 'string'
          ? JSON.parse(lastEvent.eventPayload)
          : lastEvent.eventPayload;

        if (lastPayload.eventHash) {
          previousEventHash = lastPayload.eventHash;
        } else if (lastPayload.evidenceHash) {
          previousEventHash = lastPayload.evidenceHash;
        }

        if (typeof lastPayload.sequenceNumber === 'number') {
          sequenceNumber = lastPayload.sequenceNumber + 1;
        }
      }
    } catch {
      // Fallback to genesis if query fails
    }

    const recordedTimestamp = new Date().toISOString();
    const chainScope = environmentId
      ? `environment:${environmentId}`
      : authorizationId
      ? `authorization:${authorizationId}`
      : `tenant:${tenantId}`;

    const payloadWithoutHash = {
      ...eventPayload,
      recordedTimestamp,
      sequenceNumber,
      previousEventHash,
      chainScope
    };

    const eventHash = computeChainHash({
      payload: payloadWithoutHash,
      previousEventHash,
      sequenceNumber
    });

    const finalPayload = {
      ...payloadWithoutHash,
      eventHash,
      evidenceHash: eventHash,
      canonicalPayloadSha256: eventHash
    };

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
        eventPayload: finalPayload
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
        outcomeStatus,
        eventHash,
        sequenceNumber
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
   * Verify the append-linked evidence chain for a specific environment or authorization.
   *
   * @param {Object} params
   * @param {string} params.tenantId
   * @param {string} [params.environmentId]
   * @param {string} [params.authorizationId]
   * @returns {Promise<Object>}
   */
  async verifyChain({ tenantId, environmentId = null, authorizationId = null }) {
    return verifyEvidenceChain({
      tenantId,
      environmentId,
      authorizationId,
      prismaClient: this.getDb()
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
