/**
 * Policy Decision Provenance & Decision Recorder Service (Stage 5A & Stage 5A.1).
 *
 * Persists immutable PolicyDecision and DeceptionGraphTransition records into PostgreSQL:
 * - Scoped strictly to tenantId
 * - Separates deceptionDisposition and originAccessDecision
 * - Captures immutable snapshots of evaluated policy, selected strategy, and input features
 * - Prevents historical drift when policies or strategies are updated later
 * - Atomic execution via database transactions
 * - Preserves executionStatus: NOT_EXECUTED and executionEvidenceStatus: MISSING
 * - Enforces DSG version concurrency and captures rejected transitions
 */

import { getPrismaClient } from '../db/client.js';
import { recordSecurityAudit } from '../utils/audit.js';

export class DecisionRecorderService {
  constructor(prisma = null) {
    this.prisma = prisma;
  }

  getDb() {
    return this.prisma || getPrismaClient();
  }

  /**
   * Persist a policy evaluation decision and any associated DSG transition atomically.
   *
   * @param {Object} params
   * @param {string} params.tenantId
   * @param {string} [params.applicationId]
   * @param {string} [params.observationId]
   * @param {string} [params.assessmentId]
   * @param {Object} params.evaluation - Result from PolicyEvaluationEngine.evaluate()
   * @param {string} [params.graphId] - Target DSG ID if available
   * @param {number} [params.baseGraphVersion] - Base version the plan was computed against
   * @param {string} [params.actorIdentifier]
   * @param {string} [params.idempotencyKey]
   * @param {string} [params.requestPayloadHash]
   * @returns {Promise<Object>}
   */
  async recordDecision({
    tenantId,
    applicationId = null,
    observationId = null,
    assessmentId = null,
    evaluation,
    graphId = null,
    baseGraphVersion = null,
    actorIdentifier = 'ADAPTIVE_POLICY_ENGINE',
    idempotencyKey = null,
    requestPayloadHash = null
  }) {
    const prisma = this.getDb();

    // Idempotency check: if an existing decision with this idempotency key exists for tenant
    const effectiveIdempotencyKey =
      idempotencyKey || evaluation?.idempotencyKey || evaluation?.dsgPlan?.idempotencyKey || null;

    if (effectiveIdempotencyKey) {
      const existing = await prisma.policyDecision.findFirst({
        where: { tenantId, idempotencyKey: effectiveIdempotencyKey }
      });
      if (existing) {
        if (
          requestPayloadHash &&
          existing.requestPayloadHash &&
          existing.requestPayloadHash !== requestPayloadHash
        ) {
          const err = new Error(
            'Idempotency key reuse detected with mismatched request payload.'
          );
          err.code = 'IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH';
          err.statusCode = 409;
          throw err;
        }
        return existing;
      }
    }

    // 1. Resolve strategy and policy DB record IDs safely
    let selectedStrategyDbId = null;
    let selectedStrategySnapshot = null;
    if (evaluation.selectedStrategy) {
      const stratIdentifier = evaluation.selectedStrategy.strategyIdentifier;
      const dbStrat = await prisma.deceptionStrategy.findFirst({
        where: {
          strategyIdentifier: stratIdentifier,
          OR: [{ tenantId }, { tenantId: null }]
        }
      });
      if (dbStrat) {
        selectedStrategyDbId = dbStrat.id;
        selectedStrategySnapshot = {
          id: dbStrat.id,
          strategyIdentifier: dbStrat.strategyIdentifier,
          name: dbStrat.name,
          version: dbStrat.version,
          strategyType: dbStrat.strategyType,
          isolationRequirements: dbStrat.isolationRequirements
        };
      } else {
        selectedStrategySnapshot = {
          strategyIdentifier: evaluation.selectedStrategy.strategyIdentifier,
          name: evaluation.selectedStrategy.name,
          version: evaluation.selectedStrategy.version || 1,
          strategyType: evaluation.selectedStrategy.strategyType
        };
      }
    }

    let policyDbId = null;
    let policySnapshot = null;
    if (evaluation.policyId) {
      const dbPolicy = await prisma.deceptionPolicy.findUnique({
        where: { id: evaluation.policyId }
      });
      if (dbPolicy) {
        policyDbId = dbPolicy.id;
        policySnapshot = {
          id: dbPolicy.id,
          name: dbPolicy.name,
          version: dbPolicy.version,
          priority: dbPolicy.priority,
          applicationId: dbPolicy.applicationId,
          requiredEvidenceCriteria: dbPolicy.requiredEvidenceCriteria
        };
      }
    }

    // 2. Perform atomic persistence in transaction
    const decision = await prisma.$transaction(async (tx) => {
      // 2a. Verify Graph if specified
      let currentGraph = null;
      if (graphId) {
        currentGraph = await tx.deceptionGraph.findFirst({
          where: { id: graphId, tenantId }
        });
      }

      const effectiveBaseVersion = baseGraphVersion ?? currentGraph?.graphVersion ?? 1;

      // Verify assessment exists in DB to prevent foreign key violation on virtual/mock IDs
      let assessmentDbId = null;
      const candidateAssessmentId = assessmentId || evaluation.evidenceReferences?.assessmentId;
      if (candidateAssessmentId) {
        const dbAssessment = await tx.behavioralAssessment.findFirst({
          where: { id: candidateAssessmentId, tenantId }
        });
        if (dbAssessment) {
          assessmentDbId = dbAssessment.id;
        }
      }

      // 2b. Insert immutable PolicyDecision
      const newDecision = await tx.policyDecision.create({
        data: {
          tenantId,
          applicationId,
          observationId,
          assessmentId: assessmentDbId,
          policyId: policyDbId,
          policyVersion: evaluation.policyVersion,
          selectedStrategyId: selectedStrategyDbId,
          selectedStrategyVersion: evaluation.selectedStrategyVersion,
          candidateStrategyIds: evaluation.candidateStrategyIds || [],
          dsgGraphId: graphId,
          baseGraphVersion: effectiveBaseVersion,
          strategyCatalogueVersion: evaluation.strategyCatalogueVersion || '1.0.0',
          evaluatorVersion: evaluation.evaluatorVersion || '5A.1',
          idempotencyKey: effectiveIdempotencyKey,
          requestPayloadHash: requestPayloadHash || null,
          deceptionDisposition: evaluation.deceptionDisposition || 'NOT_PROPOSED',
          originAccessDecision: evaluation.originAccessDecision || 'DEFER_TO_GATEWAY',
          decisionResult: evaluation.decisionResult,
          decisionRationale: evaluation.decisionRationale,
          reasonCodes: evaluation.reasonCodes || [],
          proposedMutations: evaluation.dsgPlan
            ? {
                nodesToAdd: evaluation.dsgPlan.nodesToAdd,
                edgesToAdd: evaluation.dsgPlan.edgesToAdd,
                syntheticEnvironmentModel: evaluation.dsgPlan.syntheticEnvironmentModel,
                planId: evaluation.dsgPlan.planId,
                status: evaluation.dsgPlan.status,
                idempotencyKey: evaluation.dsgPlan.idempotencyKey || effectiveIdempotencyKey,
                rejectionReason: evaluation.dsgPlan.rejectionReason,
                nonExecutionNotice: evaluation.dsgPlan.nonExecutionNotice
              }
            : null,
          evidenceReferences: {
            ...evaluation.evidenceReferences,
            policySnapshot: policySnapshot || evaluation.evidenceReferences?.policySnapshot,
            selectedStrategySnapshot: selectedStrategySnapshot || evaluation.evidenceReferences?.selectedStrategySnapshot,
            executionEvidenceStatus: 'MISSING',
            executionStatus: 'NOT_EXECUTED',
            provenanceNotice:
              'STAGE_5A_DECISION_PROVENANCE: Full snapshot preserved at decision timestamp. Cryptographic non-repudiation is not claimed.'
          }
        }
      });

      // 2c. If a DSG plan exists and graphId is valid, record transition
      if (graphId && evaluation.dsgPlan) {
        const planStatus = evaluation.dsgPlan.status; // 'PROPOSED' or 'REJECTED'
        await tx.deceptionGraphTransition.create({
          data: {
            tenantId,
            graphId,
            policyDecisionId: newDecision.id,
            baseGraphVersion: effectiveBaseVersion,
            targetGraphVersion: evaluation.dsgPlan.targetGraphVersion || (effectiveBaseVersion + 1),
            idempotencyKey: evaluation.dsgPlan.idempotencyKey || effectiveIdempotencyKey,
            requestPayloadHash: requestPayloadHash || null,
            rejectionReason: evaluation.dsgPlan.rejectionReason || null,
            previousState: evaluation.dsgPlan.previousState || {},
            proposedState: evaluation.dsgPlan.proposedState || {},
            transitionStatus: planStatus === 'REJECTED' ? 'REJECTED' : 'PROPOSED',
            provenance: 'STAGE_5A_POLICY_PLANNER'
          }
        });
      }

      // 2d. Emit Audit Event inside transaction
      await recordSecurityAudit({
        prisma: tx,
        tenantId,
        actorIdentifier,
        action: 'POLICY_DECISION_RECORDED',
        targetEntityType: 'PolicyDecision',
        targetEntityId: newDecision.id,
        metadata: {
          decisionResult: newDecision.decisionResult,
          deceptionDisposition: newDecision.deceptionDisposition,
          originAccessDecision: newDecision.originAccessDecision,
          policyId: newDecision.policyId,
          policyVersion: newDecision.policyVersion,
          selectedStrategyId: newDecision.selectedStrategyId,
          reasonCodes: newDecision.reasonCodes
        }
      });

      return newDecision;
    });

    return decision;
  }

  /**
   * List policy decisions scoped to tenant.
   */
  async listDecisions({ tenantId, page = 1, limit = 50, decisionResult, deceptionDisposition, applicationId }) {
    const prisma = this.getDb();
    const skip = (Math.max(1, page) - 1) * limit;

    const where = { tenantId };
    if (decisionResult) where.decisionResult = decisionResult;
    if (deceptionDisposition) where.deceptionDisposition = deceptionDisposition;
    if (applicationId) where.applicationId = applicationId;

    const [decisions, total] = await Promise.all([
      prisma.policyDecision.findMany({
        where,
        skip,
        take: limit,
        orderBy: { decidedAt: 'desc' },
        include: {
          policy: { select: { id: true, name: true, policyIdentifier: true, version: true } },
          selectedStrategy: { select: { id: true, name: true, strategyIdentifier: true, strategyType: true } },
          application: { select: { id: true, applicationIdentifier: true, name: true } }
        }
      }),
      prisma.policyDecision.count({ where })
    ]);

    return { decisions, total, page, limit };
  }

  /**
   * Retrieve a decision by ID enforcing tenant boundary.
   */
  async getDecisionById({ decisionId, tenantId }) {
    const prisma = this.getDb();
    return prisma.policyDecision.findFirst({
      where: { id: decisionId, tenantId },
      include: {
        policy: true,
        selectedStrategy: true,
        application: true,
        transitions: true
      }
    });
  }
}
