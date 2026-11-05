/**
 * Execution Authorization Service (Stage 5B.1).
 *
 * Independently validates whether a proposed deception plan is eligible for execution authorization.
 *
 * Core Research Invariants:
 * - A strategy being selected does NOT authorize execution.
 * - A DSG plan being validated does NOT authorize execution.
 * - A deception disposition of PROPOSED does NOT authorize execution.
 * - Execution requires a separate, explicit, server-side authorization decision.
 * - Bound to exact policy decision ID and exact DSG graph version.
 * - Policy modifications or graph mutations invalidate or reject authorization.
 * - Enforces separation of duties: Analysts cannot approve execution authorizations.
 * - All authorizations are strictly time-bound (expiresAt).
 */

import crypto from 'node:crypto';
import { getPrismaClient } from '../db/client.js';
import { ResourceGovernanceService } from './resource-governance.service.js';
import { ExecutionEvidenceRecorder, EXECUTION_EVENT_TYPES } from './execution-evidence-recorder.service.js';

export const AUTHORIZATION_STATUSES = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  DENIED: 'DENIED',
  EXPIRED: 'EXPIRED',
  REVOKED: 'REVOKED'
};

export const AUTHORIZATION_REASON_CODES = {
  VALIDATION_SUCCESS_PENDING_APPROVAL: 'VALIDATION_SUCCESS_PENDING_APPROVAL',
  VALIDATION_FAILED_INELIGIBLE_DECISION: 'VALIDATION_FAILED_INELIGIBLE_DECISION',
  VALIDATION_FAILED_DISPOSITION_NOT_PROPOSED: 'VALIDATION_FAILED_DISPOSITION_NOT_PROPOSED',
  VALIDATION_FAILED_STALE_GRAPH_VERSION: 'VALIDATION_FAILED_STALE_GRAPH_VERSION',
  VALIDATION_FAILED_POLICY_VERSION_CHANGED: 'VALIDATION_FAILED_POLICY_VERSION_CHANGED',
  VALIDATION_FAILED_QUOTA_EXCEEDED: 'VALIDATION_FAILED_QUOTA_EXCEEDED',
  VALIDATION_FAILED_UNKNOWN_CAPACITY: 'VALIDATION_FAILED_UNKNOWN_CAPACITY',
  SEPARATION_OF_DUTIES_VIOLATION: 'SEPARATION_OF_DUTIES_VIOLATION',
  AUTHORIZATION_APPROVED: 'AUTHORIZATION_APPROVED',
  AUTHORIZATION_DENIED: 'AUTHORIZATION_DENIED',
  AUTHORIZATION_REVOKED: 'AUTHORIZATION_REVOKED',
  AUTHORIZATION_EXPIRED: 'AUTHORIZATION_EXPIRED',
  STALE_GRAPH_VERSION_AT_APPROVAL: 'STALE_GRAPH_VERSION_AT_APPROVAL'
};

export class ExecutionAuthorizationService {
  /**
   * @param {Object} [dependencies]
   * @param {Object} [dependencies.prismaClient]
   * @param {ResourceGovernanceService} [dependencies.resourceGovernance]
   * @param {ExecutionEvidenceRecorder} [dependencies.evidenceRecorder]
   */
  constructor({ prismaClient = null, resourceGovernance = null, evidenceRecorder = null } = {}) {
    this.prisma = prismaClient;
    this.resourceGovernance = resourceGovernance || new ResourceGovernanceService(this.prisma);
    this.evidenceRecorder = evidenceRecorder || new ExecutionEvidenceRecorder(this.prisma);
  }

  getDb() {
    return this.prisma || getPrismaClient();
  }

  /**
   * Helper to compute SHA-256 payload hash.
   */
  static hashPayload(payload) {
    return crypto.createHash('sha256').update(JSON.stringify(payload || {})).digest('hex');
  }

  /**
   * Request a new execution authorization for an existing policy decision.
   *
   * @param {Object} params
   * @param {string} params.tenantId
   * @param {string} [params.applicationId]
   * @param {string} params.policyDecisionId
   * @param {string} [params.dsgGraphId]
   * @param {number} [params.baseGraphVersion]
   * @param {Object} params.requestingOperator - { id, email, role }
   * @param {number} [params.lifetimeMinutes=120]
   * @param {string} [params.idempotencyKey]
   * @param {string} [params.requestPayloadHash]
   * @returns {Promise<Object>}
   */
  async requestAuthorization({
    tenantId,
    applicationId = null,
    policyDecisionId,
    dsgGraphId = null,
    baseGraphVersion = null,
    requestingOperator,
    lifetimeMinutes = 120,
    idempotencyKey = null,
    requestPayloadHash = null
  }) {
    const prisma = this.getDb();
    const effectiveHash = requestPayloadHash || ExecutionAuthorizationService.hashPayload({
      tenantId,
      applicationId,
      policyDecisionId,
      dsgGraphId,
      baseGraphVersion
    });

    // 1. Idempotency Check
    if (idempotencyKey) {
      const existing = await prisma.deceptionExecutionAuthorization.findFirst({
        where: { tenantId, idempotencyKey }
      });
      if (existing) {
        if (existing.requestPayloadHash && existing.requestPayloadHash !== effectiveHash) {
          const err = new Error('Idempotency key reuse detected with mismatched request payload.');
          err.code = 'IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH';
          err.statusCode = 409;
          throw err;
        }
        return { ...existing, idempotentReplay: true };
      }
    }

    // 2. Resolve Policy Decision
    const decision = await prisma.policyDecision.findFirst({
      where: { id: policyDecisionId, tenantId },
      include: {
        policy: true,
        graph: true
      }
    });

    if (!decision) {
      const err = new Error(`Policy decision "${policyDecisionId}" not found for this tenant.`);
      err.code = 'POLICY_DECISION_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    const resolvedAppId = applicationId || decision.applicationId;
    if (decision.applicationId && resolvedAppId !== decision.applicationId) {
      const err = new Error('Application ID mismatch with policy decision.');
      err.code = 'APPLICATION_ID_MISMATCH';
      err.statusCode = 400;
      throw err;
    }

    // 3. Resolve Target DSG Graph
    const targetGraphId = dsgGraphId || decision.dsgGraphId;
    if (!targetGraphId) {
      const err = new Error('Policy decision does not reference a target Deception State Graph.');
      err.code = 'MISSING_DSG_GRAPH';
      err.statusCode = 400;
      throw err;
    }

    const graph = await prisma.deceptionGraph.findFirst({
      where: { id: targetGraphId, tenantId }
    });

    if (!graph) {
      const err = new Error(`Deception State Graph "${targetGraphId}" not found for this tenant.`);
      err.code = 'GRAPH_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    const effectiveBaseVersion = baseGraphVersion ?? decision.baseGraphVersion ?? graph.graphVersion;

    // 4. Independent Authorization Validation Checks
    const reasonCodes = [];
    let validationPassed = true;
    let failureReason = null;

    // Check A: Deception disposition must be strictly PROPOSED (or PROPOSE_DECEPTION)
    const disposition = decision.deceptionDisposition;
    if (disposition !== 'PROPOSED' && disposition !== 'PROPOSE_DECEPTION') {
      validationPassed = false;
      failureReason = `Decision disposition is "${disposition}". Only decisions with deceptionDisposition: "PROPOSED" can be authorized for execution.`;
      reasonCodes.push(AUTHORIZATION_REASON_CODES.VALIDATION_FAILED_DISPOSITION_NOT_PROPOSED);
    }

    // Check B: DSG graph version must match current graph version (staleness guard)
    if (effectiveBaseVersion !== graph.graphVersion) {
      validationPassed = false;
      failureReason = `Proposal was based on graph version ${effectiveBaseVersion}, but current graph is version ${graph.graphVersion}. Plan is stale.`;
      reasonCodes.push(AUTHORIZATION_REASON_CODES.VALIDATION_FAILED_STALE_GRAPH_VERSION);
    }

    // Check C: Active Policy Version Check (ensure policy was not mutated since decision)
    if (decision.policyId && decision.policy) {
      if (decision.policy.version !== decision.policyVersion) {
        validationPassed = false;
        failureReason = `Policy has been updated (v${decision.policy.version}) since decision was evaluated (v${decision.policyVersion}). Re-evaluation required.`;
        reasonCodes.push(AUTHORIZATION_REASON_CODES.VALIDATION_FAILED_POLICY_VERSION_CHANGED);
      }
    }

    // Check D: Resource Quota Admission
    const admission = await this.resourceGovernance.validateResourceAdmission({
      tenantId,
      applicationId: resolvedAppId,
      requestedCpu: 0.5,
      requestedMemoryMb: 256
    });

    if (!admission.eligible) {
      validationPassed = false;
      failureReason = admission.violations.join('; ');
      reasonCodes.push(AUTHORIZATION_REASON_CODES.VALIDATION_FAILED_QUOTA_EXCEEDED);
    }

    const initialStatus = validationPassed
      ? AUTHORIZATION_STATUSES.PENDING
      : AUTHORIZATION_STATUSES.DENIED;

    if (validationPassed) {
      reasonCodes.push(AUTHORIZATION_REASON_CODES.VALIDATION_SUCCESS_PENDING_APPROVAL);
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + lifetimeMinutes * 60 * 1000);

    // 5. Persist Authorization Record
    const authorization = await prisma.deceptionExecutionAuthorization.create({
      data: {
        tenantId,
        applicationId: resolvedAppId,
        policyDecisionId: decision.id,
        dsgGraphId: graph.id,
        dsgGraphVersion: effectiveBaseVersion,
        selectedStrategyId: decision.selectedStrategyId,
        requestingOperatorId: requestingOperator.id || null,
        requestingOperatorEmail: requestingOperator.email || 'OPERATOR',
        requestingOperatorRole: requestingOperator.role || 'SECURITY_ANALYST',
        authorizationStatus: initialStatus,
        authorizationReasonCodes: reasonCodes,
        decisionRationale: failureReason || 'Execution authorization request validated and submitted for review.',
        requestedAt: now,
        expiresAt,
        evaluatorVersion: '5B.1',
        idempotencyKey,
        requestPayloadHash: effectiveHash,
        metadata: {
          decisionResult: decision.decisionResult,
          deceptionDisposition: decision.deceptionDisposition,
          originAccessDecision: decision.originAccessDecision,
          graphIdentifier: graph.graphIdentifier,
          quotaSnapshot: admission.quota
        }
      }
    });

    // 6. Record Execution Event
    await this.evidenceRecorder.recordEvent({
      tenantId,
      authorizationId: authorization.id,
      eventType: validationPassed
        ? EXECUTION_EVENT_TYPES.AUTHORIZATION_REQUESTED
        : EXECUTION_EVENT_TYPES.AUTHORIZATION_DENIED,
      severity: validationPassed ? 'INFO' : 'WARN',
      message: validationPassed
        ? `Execution authorization requested by ${requestingOperator.email} for decision ${decision.id}`
        : `Execution authorization request failed validation: ${failureReason}`,
      actorIdentifier: requestingOperator.email,
      actorRole: requestingOperator.role,
      outcomeStatus: validationPassed ? 'RECORDED' : 'REJECTED',
      eventPayload: {
        policyDecisionId: decision.id,
        graphId: graph.id,
        dsgGraphVersion: effectiveBaseVersion,
        reasonCodes
      }
    });

    return authorization;
  }

  /**
   * Approve an execution authorization request.
   * Enforces Separation of Duties:
   * Only APPLICATION_OWNER or PLATFORM_ADMIN can approve.
   *
   * @param {Object} params
   * @param {string} params.authorizationId
   * @param {string} params.tenantId
   * @param {Object} params.approver - { id, email, role, isPlatformAdmin }
   * @param {string} [params.approvalReason]
   * @returns {Promise<Object>}
   */
  async approveAuthorization({
    authorizationId,
    tenantId,
    approver,
    approvalReason = 'Approved by authorized tenant operator.'
  }) {
    const prisma = this.getDb();

    // Role check: Only APPLICATION_OWNER or PLATFORM_ADMIN can approve
    const isOwner = approver.role === 'APPLICATION_OWNER';
    const isAdmin = approver.isPlatformAdmin === true;
    if (!isOwner && !isAdmin) {
      const err = new Error('Access denied: Only APPLICATION_OWNER or PLATFORM_ADMIN can approve execution authorizations.');
      err.code = 'FORBIDDEN_OPERATOR_ROLE';
      err.statusCode = 403;
      throw err;
    }

    const auth = await prisma.deceptionExecutionAuthorization.findFirst({
      where: { id: authorizationId, tenantId },
      include: {
        graph: true,
        policyDecision: {
          include: { policy: true }
        }
      }
    });

    if (!auth) {
      const err = new Error(`Authorization "${authorizationId}" not found for this tenant.`);
      err.code = 'AUTHORIZATION_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    if (auth.authorizationStatus !== AUTHORIZATION_STATUSES.PENDING) {
      const err = new Error(
        `Cannot approve authorization in "${auth.authorizationStatus}" status. Must be PENDING.`
      );
      err.code = 'INVALID_AUTHORIZATION_STATUS';
      err.statusCode = 409;
      throw err;
    }

    // Expiration check
    if (new Date() > new Date(auth.expiresAt)) {
      await prisma.deceptionExecutionAuthorization.update({
        where: { id: auth.id },
        data: { authorizationStatus: AUTHORIZATION_STATUSES.EXPIRED }
      });
      const err = new Error('Authorization request has expired and cannot be approved.');
      err.code = 'AUTHORIZATION_EXPIRED';
      err.statusCode = 410;
      throw err;
    }

    // Re-verify current graph version at approval moment
    if (auth.graph.graphVersion !== auth.dsgGraphVersion) {
      const err = new Error(
        `Stale DSG version: Graph was mutated to version ${auth.graph.graphVersion} after request was made (version ${auth.dsgGraphVersion}). Approval rejected.`
      );
      err.code = 'STALE_GRAPH_VERSION_AT_APPROVAL';
      err.statusCode = 409;
      throw err;
    }

    // Re-verify active policy version
    if (auth.policyDecision?.policy) {
      if (auth.policyDecision.policy.version !== auth.policyDecision.policyVersion) {
        const err = new Error('Policy was updated after decision was evaluated. Re-evaluation required.');
        err.code = 'POLICY_VERSION_MUTATED';
        err.statusCode = 409;
        throw err;
      }
    }

    // Separation of Duties check: if requested by an Analyst, approver must not be the same user
    if (auth.requestingOperatorRole === 'SECURITY_ANALYST' && auth.requestingOperatorEmail === approver.email) {
      const err = new Error('Separation of duties violation: An analyst cannot approve their own authorization request.');
      err.code = 'SEPARATION_OF_DUTIES_VIOLATION';
      err.statusCode = 403;
      throw err;
    }

    const updatedReasonCodes = Array.isArray(auth.authorizationReasonCodes)
      ? [...auth.authorizationReasonCodes, AUTHORIZATION_REASON_CODES.AUTHORIZATION_APPROVED]
      : [AUTHORIZATION_REASON_CODES.AUTHORIZATION_APPROVED];

    const approvedAuth = await prisma.deceptionExecutionAuthorization.update({
      where: { id: auth.id },
      data: {
        authorizationStatus: AUTHORIZATION_STATUSES.APPROVED,
        approvingOperatorId: approver.id || null,
        approvingOperatorEmail: approver.email,
        authorizedAt: new Date(),
        decisionRationale: approvalReason,
        authorizationReasonCodes: updatedReasonCodes
      }
    });

    await this.evidenceRecorder.recordEvent({
      tenantId,
      authorizationId: approvedAuth.id,
      eventType: EXECUTION_EVENT_TYPES.AUTHORIZATION_APPROVED,
      severity: 'INFO',
      message: `Execution authorization approved by ${approver.email}: ${approvalReason}`,
      actorIdentifier: approver.email,
      actorRole: approver.role || (isAdmin ? 'PLATFORM_ADMIN' : 'APPLICATION_OWNER'),
      outcomeStatus: 'CONFIRMED',
      eventPayload: {
        authorizationId: approvedAuth.id,
        dsgGraphVersion: approvedAuth.dsgGraphVersion,
        approvalReason
      }
    });

    return approvedAuth;
  }

  /**
   * Deny an execution authorization request.
   *
   * @param {Object} params
   * @param {string} params.authorizationId
   * @param {string} params.tenantId
   * @param {Object} params.operator
   * @param {string} params.denialReason
   * @returns {Promise<Object>}
   */
  async denyAuthorization({ authorizationId, tenantId, operator, denialReason }) {
    const prisma = this.getDb();
    const auth = await prisma.deceptionExecutionAuthorization.findFirst({
      where: { id: authorizationId, tenantId }
    });

    if (!auth) {
      const err = new Error(`Authorization "${authorizationId}" not found for this tenant.`);
      err.code = 'AUTHORIZATION_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    if (auth.authorizationStatus !== AUTHORIZATION_STATUSES.PENDING) {
      const err = new Error(`Cannot deny authorization in "${auth.authorizationStatus}" status.`);
      err.code = 'INVALID_AUTHORIZATION_STATUS';
      err.statusCode = 409;
      throw err;
    }

    const updatedReasonCodes = Array.isArray(auth.authorizationReasonCodes)
      ? [...auth.authorizationReasonCodes, AUTHORIZATION_REASON_CODES.AUTHORIZATION_DENIED]
      : [AUTHORIZATION_REASON_CODES.AUTHORIZATION_DENIED];

    const denied = await prisma.deceptionExecutionAuthorization.update({
      where: { id: auth.id },
      data: {
        authorizationStatus: AUTHORIZATION_STATUSES.DENIED,
        approvingOperatorId: operator.id || null,
        approvingOperatorEmail: operator.email,
        decisionRationale: denialReason || 'Execution authorization denied by operator.',
        authorizationReasonCodes: updatedReasonCodes
      }
    });

    await this.evidenceRecorder.recordEvent({
      tenantId,
      authorizationId: denied.id,
      eventType: EXECUTION_EVENT_TYPES.AUTHORIZATION_DENIED,
      severity: 'WARN',
      message: `Execution authorization denied by ${operator.email}: ${denialReason}`,
      actorIdentifier: operator.email,
      actorRole: operator.role,
      outcomeStatus: 'REJECTED',
      eventPayload: { authorizationId: denied.id, denialReason }
    });

    return denied;
  }

  /**
   * Revoke a previously approved execution authorization.
   *
   * @param {Object} params
   * @param {string} params.authorizationId
   * @param {string} params.tenantId
   * @param {Object} params.operator
   * @param {string} params.revocationReason
   * @returns {Promise<Object>}
   */
  async revokeAuthorization({ authorizationId, tenantId, operator, revocationReason }) {
    const prisma = this.getDb();
    const auth = await prisma.deceptionExecutionAuthorization.findFirst({
      where: { id: authorizationId, tenantId }
    });

    if (!auth) {
      const err = new Error(`Authorization "${authorizationId}" not found for this tenant.`);
      err.code = 'AUTHORIZATION_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    if (auth.authorizationStatus !== AUTHORIZATION_STATUSES.APPROVED) {
      const err = new Error(
        `Cannot revoke authorization in "${auth.authorizationStatus}" status. Must be APPROVED.`
      );
      err.code = 'INVALID_AUTHORIZATION_STATUS';
      err.statusCode = 409;
      throw err;
    }

    const updatedReasonCodes = Array.isArray(auth.authorizationReasonCodes)
      ? [...auth.authorizationReasonCodes, AUTHORIZATION_REASON_CODES.AUTHORIZATION_REVOKED]
      : [AUTHORIZATION_REASON_CODES.AUTHORIZATION_REVOKED];

    const revoked = await prisma.deceptionExecutionAuthorization.update({
      where: { id: auth.id },
      data: {
        authorizationStatus: AUTHORIZATION_STATUSES.REVOKED,
        revocationReason: revocationReason || 'Revoked by authorized operator.',
        revokedAt: new Date(),
        revokedBy: operator.email,
        authorizationReasonCodes: updatedReasonCodes
      }
    });

    await this.evidenceRecorder.recordEvent({
      tenantId,
      authorizationId: revoked.id,
      eventType: EXECUTION_EVENT_TYPES.AUTHORIZATION_REVOKED,
      severity: 'WARN',
      message: `Execution authorization revoked by ${operator.email}: ${revocationReason}`,
      actorIdentifier: operator.email,
      actorRole: operator.role,
      outcomeStatus: 'REJECTED',
      eventPayload: { authorizationId: revoked.id, revocationReason }
    });

    return revoked;
  }

  /**
   * Get an authorization record by ID with tenant scoping.
   *
   * @param {Object} params
   * @param {string} params.authorizationId
   * @param {string} params.tenantId
   * @returns {Promise<Object|null>}
   */
  async getAuthorization({ authorizationId, tenantId }) {
    const prisma = this.getDb();
    return prisma.deceptionExecutionAuthorization.findFirst({
      where: { id: authorizationId, tenantId },
      include: {
        application: true,
        graph: true,
        policyDecision: true,
        environments: true,
        executionEvents: {
          orderBy: { recordedAt: 'desc' },
          take: 20
        }
      }
    });
  }

  /**
   * List authorization records with tenant scoping, pagination, and status filters.
   *
   * @param {Object} params
   * @param {string} params.tenantId
   * @param {string} [params.applicationId]
   * @param {string} [params.status]
   * @param {number} [params.page=1]
   * @param {number} [params.limit=20]
   * @returns {Promise<{ authorizations: Array, total: number, page: number, limit: number }>}
   */
  async listAuthorizations({
    tenantId,
    applicationId = null,
    status = null,
    page = 1,
    limit = 20
  }) {
    const prisma = this.getDb();
    const where = { tenantId };

    if (applicationId) where.applicationId = applicationId;
    if (status) where.authorizationStatus = status;

    const [authorizations, total] = await Promise.all([
      prisma.deceptionExecutionAuthorization.findMany({
        where,
        include: {
          application: true,
          graph: true,
          policyDecision: true
        },
        orderBy: { requestedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.deceptionExecutionAuthorization.count({ where })
    ]);

    return { authorizations, total, page, limit };
  }
}
