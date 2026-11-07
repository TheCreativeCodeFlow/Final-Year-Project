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
  // Authorization
  AUTHORIZATION_REQUESTED: 'AUTHORIZATION_REQUESTED',
  AUTHORIZATION_APPROVED: 'AUTHORIZATION_APPROVED',
  AUTHORIZATION_DENIED: 'AUTHORIZATION_DENIED',
  AUTHORIZATION_REVOKED: 'AUTHORIZATION_REVOKED',
  AUTHORIZATION_EXPIRED: 'AUTHORIZATION_EXPIRED',
  AUTHORIZATION_VALIDATED: 'AUTHORIZATION_VALIDATED',

  // Provisioning & Sandbox
  PROVISIONING_REQUESTED: 'PROVISIONING_REQUESTED',
  PROVISIONING_SUCCEEDED: 'PROVISIONING_SUCCEEDED',
  PROVISIONING_FAILED: 'PROVISIONING_FAILED',
  IMAGE_VERIFIED: 'IMAGE_VERIFIED',
  CONTAINER_CREATED: 'CONTAINER_CREATED',
  NETWORK_CREATED: 'NETWORK_CREATED',
  SECURITY_CONFIG_APPLIED: 'SECURITY_CONFIG_APPLIED',
  NETWORK_ISOLATION_VERIFIED: 'NETWORK_ISOLATION_VERIFIED',
  SERVICE_STARTED: 'SERVICE_STARTED',
  EGRESS_QUARANTINE_VERIFIED: 'EGRESS_QUARANTINE_VERIFIED',

  // Health & Telemetry
  HEALTH_CHECK_PASSED: 'HEALTH_CHECK_PASSED',
  HEALTH_CHECK_EXECUTED: 'HEALTH_CHECK_EXECUTED',
  ENVIRONMENT_HEALTH_VERIFIED: 'ENVIRONMENT_HEALTH_VERIFIED',
  TELEMETRY_CAPTURED: 'TELEMETRY_CAPTURED',
  RUNTIME_DEGRADED: 'RUNTIME_DEGRADED',
  RUNTIME_RECOVERED: 'RUNTIME_RECOVERED',

  // Mutation (Stage 5B.3 & 5B.4 Pipeline)
  MUTATION_REQUESTED: 'MUTATION_REQUESTED',
  MUTATION_VALIDATED: 'MUTATION_VALIDATED',
  MUTATION_AUTHORIZED: 'MUTATION_AUTHORIZED',
  MUTATION_DISPATCHED: 'MUTATION_DISPATCHED',
  MUTATION_ACCEPTED: 'MUTATION_ACCEPTED',
  MUTATION_EXECUTED: 'MUTATION_EXECUTED',
  MUTATION_INSPECTED: 'MUTATION_INSPECTED',
  MUTATION_VERIFIED: 'MUTATION_VERIFIED',
  MUTATION_ROLLBACK_REQUESTED: 'MUTATION_ROLLBACK_REQUESTED',
  MUTATION_ROLLBACK_EXECUTED: 'MUTATION_ROLLBACK_EXECUTED',
  MUTATION_ROLLBACK_VERIFIED: 'MUTATION_ROLLBACK_VERIFIED',
  MUTATION_FAILED: 'MUTATION_FAILED',
  MUTATION_REJECTED: 'MUTATION_REJECTED',
  DSG_TRANSITION_APPLIED: 'DSG_TRANSITION_APPLIED',
  DSG_TRANSITION_REJECTED: 'DSG_TRANSITION_REJECTED',

  // Teardown & Cleanup
  ENVIRONMENT_TERMINATED: 'ENVIRONMENT_TERMINATED',
  RUNTIME_TERMINATED: 'RUNTIME_TERMINATED',
  CLEANUP_COMPLETED: 'CLEANUP_COMPLETED',
  CLEANUP_FAILED: 'CLEANUP_FAILED',

  // Gateway Adaptive Routing (Stage 5B.5)
  GATEWAY_REQUEST_OBSERVED: 'GATEWAY_REQUEST_OBSERVED',
  DETECTION_ASSESSMENT_COMPLETED: 'DETECTION_ASSESSMENT_COMPLETED',
  POLICY_EVALUATED: 'POLICY_EVALUATED',
  DECEPTION_STRATEGY_SELECTED: 'DECEPTION_STRATEGY_SELECTED',
  DSG_PLAN_AVAILABLE: 'DSG_PLAN_AVAILABLE',
  RUNTIME_SELECTED: 'RUNTIME_SELECTED',
  ROUTING_AUTHORIZATION_CHECKED: 'ROUTING_AUTHORIZATION_CHECKED',
  ROUTING_DECISION_CREATED: 'ROUTING_DECISION_CREATED',
  ROUTING_REQUEST_DISPATCHED: 'ROUTING_REQUEST_DISPATCHED',
  SYNTHETIC_RUNTIME_RESPONSE_RECEIVED: 'SYNTHETIC_RUNTIME_RESPONSE_RECEIVED',
  ROUTING_OUTCOME_VERIFIED: 'ROUTING_OUTCOME_VERIFIED',
  SHADOW_DECISION: 'SHADOW_DECISION',
  HYPOTHETICAL_OUTCOME: 'HYPOTHETICAL_OUTCOME',
  ROUTING_FAILED: 'ROUTING_FAILED'
};

export const MUTATION_EXECUTION_STATUSES = {
  REQUESTED: 'REQUESTED',
  VALIDATED: 'VALIDATED',
  AUTHORIZED: 'AUTHORIZED',
  DISPATCHED: 'DISPATCHED',
  ACCEPTED: 'ACCEPTED',
  EXECUTED: 'EXECUTED',
  INSPECTED: 'INSPECTED',
  VERIFIED: 'VERIFIED',
  FAILED: 'FAILED',
  UNKNOWN: 'UNKNOWN',
  ROLLED_BACK: 'ROLLED_BACK'
};

/**
 * Evaluates the full execution evidence completeness and provenance across an environment's lifecycle.
 *
 * Checks:
 * 1. Event-level cryptographic hash integrity.
 * 2. Sequence continuity and unbroken hash chaining.
 * 3. Chronological event order (non-decreasing timestamps).
 * 4. Missing required lifecycle milestones.
 * 5. Duplicate non-idempotent events.
 * 6. Tenant and environment provenance consistency.
 *
 * @param {Object} params
 * @param {string} params.tenantId
 * @param {string} params.environmentId
 * @param {Array<Object>} [params.events] - Optional in-memory events array
 * @param {Object} [params.prismaClient]
 * @returns {Promise<Object>}
 */
export async function verifyEvidenceCompleteness({
  tenantId,
  environmentId,
  events = null,
  prismaClient = null
} = {}) {
  const prisma = prismaClient || getPrismaClient();

  if (!tenantId || !environmentId) {
    throw new Error('tenantId and environmentId are required to verify evidence completeness.');
  }

  let chainEvents = events;
  if (!chainEvents) {
    chainEvents = await prisma.deceptionExecutionEvent.findMany({
      where: { tenantId, environmentId },
      orderBy: { recordedAt: 'asc' }
    });
  }

  // Fetch environment record to inspect intended lifecycle state
  let env = null;
  try {
    env = await prisma.deceptionRuntimeEnvironment.findFirst({
      where: { id: environmentId, tenantId }
    });
  } catch {
    // Non-fatal if DB query fails in purely in-memory test
  }

  // 1. Run base chain verification
  const chainResult = await verifyEvidenceChain({
    tenantId,
    environmentId,
    events: chainEvents,
    prismaClient: prisma
  });

  const provenanceViolations = [];
  const duplicateEvents = [];
  const missingEvents = [];
  const seenEventIds = new Set();
  const seenSequences = new Set();
  const presentTypes = new Set();

  for (let idx = 0; idx < chainEvents.length; idx++) {
    const ev = chainEvents[idx];
    const payload = ev.eventPayload || {};
    presentTypes.add(ev.eventType);

    // Provenance Check: Tenant ID and Environment ID
    if (ev.tenantId !== tenantId) {
      provenanceViolations.push({
        type: 'TENANT_PROVENANCE_VIOLATION',
        index: idx,
        eventId: ev.id,
        expectedTenantId: tenantId,
        recordedTenantId: ev.tenantId,
        message: `Event ${ev.id} belongs to tenant "${ev.tenantId}", not "${tenantId}".`
      });
    }

    if (ev.environmentId && ev.environmentId !== environmentId) {
      provenanceViolations.push({
        type: 'ENVIRONMENT_PROVENANCE_VIOLATION',
        index: idx,
        eventId: ev.id,
        expectedEnvironmentId: environmentId,
        recordedEnvironmentId: ev.environmentId,
        message: `Event ${ev.id} belongs to environment "${ev.environmentId}", not "${environmentId}".`
      });
    }

    // Chronological Timestamp Check
    if (idx > 0) {
      const prevTime = new Date(chainEvents[idx - 1].recordedAt).getTime();
      const currTime = new Date(ev.recordedAt).getTime();
      if (currTime < prevTime) {
        provenanceViolations.push({
          type: 'TIMESTAMP_OUT_OF_ORDER',
          index: idx,
          eventId: ev.id,
          previousTimestamp: chainEvents[idx - 1].recordedAt,
          currentTimestamp: ev.recordedAt,
          message: `Event ${ev.id} timestamp (${ev.recordedAt}) precedes previous event timestamp (${chainEvents[idx - 1].recordedAt}).`
        });
      }
    }

    // Duplicate Check: Event ID
    if (ev.id) {
      if (seenEventIds.has(ev.id)) {
        duplicateEvents.push(`Duplicate event ID "${ev.id}" at index ${idx}`);
      }
      seenEventIds.add(ev.id);
    }

    // Duplicate Check: Sequence Number
    const seq = payload.sequenceNumber;
    if (typeof seq === 'number') {
      if (seenSequences.has(seq)) {
        duplicateEvents.push(`Duplicate sequenceNumber #${seq} at index ${idx}`);
      }
      seenSequences.add(seq);
    }
  }

  // 2. Expected Lifecycle Milestones Check
  const isActive = env ? ['ACTIVE', 'VALIDATING', 'PROVISIONING'].includes(env.lifecycleState) : true;
  const isTerminated = env ? ['TERMINATED', 'EXPIRED'].includes(env.lifecycleState) : false;

  // Expected Active Lifecycle Milestones
  const hasAuth =
    presentTypes.has(EXECUTION_EVENT_TYPES.AUTHORIZATION_APPROVED) ||
    presentTypes.has(EXECUTION_EVENT_TYPES.AUTHORIZATION_VALIDATED);
  if (!hasAuth) missingEvents.push('AUTHORIZATION_VALIDATED');

  if (!presentTypes.has(EXECUTION_EVENT_TYPES.PROVISIONING_REQUESTED)) {
    missingEvents.push('PROVISIONING_REQUESTED');
  }
  if (!presentTypes.has(EXECUTION_EVENT_TYPES.IMAGE_VERIFIED)) {
    missingEvents.push('IMAGE_VERIFIED');
  }
  if (!presentTypes.has(EXECUTION_EVENT_TYPES.CONTAINER_CREATED)) {
    missingEvents.push('CONTAINER_CREATED');
  }
  if (
    !presentTypes.has(EXECUTION_EVENT_TYPES.NETWORK_CREATED) &&
    !presentTypes.has(EXECUTION_EVENT_TYPES.NETWORK_ISOLATION_VERIFIED)
  ) {
    missingEvents.push('NETWORK_CREATED');
  }
  if (!presentTypes.has(EXECUTION_EVENT_TYPES.SERVICE_STARTED)) {
    missingEvents.push('SERVICE_STARTED');
  }
  if (
    !presentTypes.has(EXECUTION_EVENT_TYPES.HEALTH_CHECK_EXECUTED) &&
    !presentTypes.has(EXECUTION_EVENT_TYPES.HEALTH_CHECK_PASSED) &&
    !presentTypes.has(EXECUTION_EVENT_TYPES.ENVIRONMENT_HEALTH_VERIFIED)
  ) {
    missingEvents.push('HEALTH_CHECK_EXECUTED');
  }

  // If environment was terminated, check for teardown events
  if (isTerminated) {
    if (
      !presentTypes.has(EXECUTION_EVENT_TYPES.ENVIRONMENT_TERMINATED) &&
      !presentTypes.has(EXECUTION_EVENT_TYPES.RUNTIME_TERMINATED)
    ) {
      missingEvents.push('ENVIRONMENT_TERMINATED');
    }
    if (!presentTypes.has(EXECUTION_EVENT_TYPES.CLEANUP_COMPLETED)) {
      missingEvents.push('CLEANUP_COMPLETED');
    }
  }

  // Determine overall completeness status
  let completeness = 'COMPLETE';
  if (!chainResult.valid || provenanceViolations.some((v) => v.type.includes('PROVENANCE'))) {
    completeness = 'CORRUPTED';
  } else if (missingEvents.length > 0) {
    completeness = missingEvents.length > 3 ? 'INCOMPLETE' : 'PARTIAL';
  }

  return {
    completeness,
    chainValid: chainResult.valid,
    provenanceValid: provenanceViolations.length === 0,
    chainLength: chainEvents.length,
    missingEvents,
    duplicateEvents,
    violations: [...chainResult.violations, ...provenanceViolations],
    genesisHash: chainResult.genesisHash,
    latestHash: chainResult.latestHash,
    eventsSummary: chainEvents.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      recordedAt: e.recordedAt,
      sequenceNumber: e.eventPayload?.sequenceNumber,
      eventHash: e.eventPayload?.eventHash || e.eventPayload?.evidenceHash
    })),
    nonRepudiation: 'NOT_IMPLEMENTED',
    independentTrustAnchor: 'NOT_IMPLEMENTED'
  };
}

export class ExecutionEvidenceRecorder {
  /**
   * @param {Object} [prismaClient]
   */
  constructor(prismaClient = null) {
    this.prisma = (prismaClient && prismaClient.prismaClient) ? prismaClient.prismaClient : prismaClient;
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
