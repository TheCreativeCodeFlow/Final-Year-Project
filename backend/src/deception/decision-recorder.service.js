/**
 * Policy Decision Provenance & Decision Recorder Service (Stage 5A).
 *
 * Persists immutable PolicyDecision records into PostgreSQL:
 * - Scoped strictly to tenantId
 * - Linked to assessment, policy, candidate strategies, selected strategy, and DSG proposed mutations
 * - Emits audit events with structured provenance
 * - Preserves executionStatus: NOT_EXECUTED and executionEvidenceStatus: MISSING
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
   * Persist a policy evaluation decision and any associated DSG transition.
   *
   * @param {Object} params
   * @param {string} params.tenantId
   * @param {string} [params.applicationId]
   * @param {string} [params.observationId]
   * @param {string} [params.assessmentId]
   * @param {Object} params.evaluation - Result from PolicyEvaluationEngine.evaluate()
   * @param {string} [params.graphId] - Target DSG ID if available
   * @param {string} [params.actorIdentifier]
   * @returns {Promise<Object>}
   */
  async recordDecision({
    tenantId,
    applicationId = null,
    observationId = null,
    assessmentId = null,
    evaluation,
    graphId = null,
    actorIdentifier = 'ADAPTIVE_POLICY_ENGINE'
  }) {
    const prisma = this.getDb();

    // 1. Resolve strategy and policy DB record IDs safely
    let selectedStrategyDbId = null;
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
      }
    }

    let policyDbId = null;
    if (evaluation.policyId) {
      const dbPolicy = await prisma.deceptionPolicy.findUnique({
        where: { id: evaluation.policyId }
      });
      if (dbPolicy) {
        policyDbId = dbPolicy.id;
      }
    }

    // 2. Persist immutable PolicyDecision
    const decision = await prisma.policyDecision.create({
      data: {
        tenantId,
        applicationId,
        observationId,
        assessmentId: assessmentId || evaluation.evidenceReferences?.assessmentId || null,
        policyId: policyDbId,
        policyVersion: evaluation.policyVersion,
        selectedStrategyId: selectedStrategyDbId,
        selectedStrategyVersion: evaluation.selectedStrategyVersion,
        candidateStrategyIds: evaluation.candidateStrategyIds || [],
        dsgGraphId: graphId,
        proposedMutations: evaluation.dsgPlan
          ? {
              nodesToAdd: evaluation.dsgPlan.nodesToAdd,
              edgesToAdd: evaluation.dsgPlan.edgesToAdd,
              syntheticEnvironmentModel: evaluation.dsgPlan.syntheticEnvironmentModel,
              planId: evaluation.dsgPlan.planId,
              status: evaluation.dsgPlan.status,
              nonExecutionNotice: evaluation.dsgPlan.nonExecutionNotice
            }
          : null,
        reasonCodes: evaluation.reasonCodes || [],
        evaluatorVersion: evaluation.evaluatorVersion || '5A.1',
        decisionResult: evaluation.decisionResult,
        decisionRationale: evaluation.decisionRationale,
        evidenceReferences: {
          ...evaluation.evidenceReferences,
          executionEvidenceStatus: 'MISSING',
          executionStatus: 'NOT_EXECUTED'
        }
      }
    });

    // 3. If a DSG plan exists and graphId is valid, record proposed transition
    if (graphId && evaluation.dsgPlan) {
      try {
        await prisma.deceptionGraphTransition.create({
          data: {
            tenantId,
            graphId,
            policyDecisionId: decision.id,
            previousState: evaluation.dsgPlan.previousState,
            proposedState: evaluation.dsgPlan.proposedState,
            transitionStatus: 'PROPOSED', // strictly PROPOSED, never EXECUTED
            provenance: 'STAGE_5A_POLICY_PLANNER'
          }
        });
      } catch (err) {
        // Log transition recording failure without failing decision record
        console.warn('Failed to record DSG transition:', err.message);
      }
    }

    // 4. Emit Audit Event
    await recordSecurityAudit({
      prisma,
      tenantId,
      actorIdentifier,
      action: 'POLICY_DECISION_RECORDED',
      targetEntityType: 'PolicyDecision',
      targetEntityId: decision.id,
      metadata: {
        decisionResult: decision.decisionResult,
        policyId: decision.policyId,
        selectedStrategyId: decision.selectedStrategyId,
        reasonCodes: decision.reasonCodes
      }
    });

    return decision;
  }

  /**
   * List policy decisions scoped to tenant.
   */
  async listDecisions({ tenantId, page = 1, limit = 50, decisionResult, applicationId }) {
    const prisma = this.getDb();
    const skip = (Math.max(1, page) - 1) * limit;

    const where = { tenantId };
    if (decisionResult) {
      where.decisionResult = decisionResult;
    }
    if (applicationId) {
      where.applicationId = applicationId;
    }

    const [decisions, total] = await Promise.all([
      prisma.policyDecision.findMany({
        where,
        skip,
        take: limit,
        orderBy: { decidedAt: 'desc' },
        include: {
          policy: { select: { id: true, name: true, policyIdentifier: true, version: true } },
          selectedStrategy: { select: { id: true, name: true, strategyIdentifier: true, strategyType: true } },
          application: { select: { id: true, name: true, applicationIdentifier: true } }
        }
      }),
      prisma.policyDecision.count({ where })
    ]);

    return { decisions, total, page, limit };
  }

  /**
   * Get single policy decision detail by ID.
   */
  async getDecisionById({ decisionId, tenantId }) {
    const prisma = this.getDb();
    return prisma.policyDecision.findFirst({
      where: { id: decisionId, tenantId },
      include: {
        policy: true,
        selectedStrategy: true,
        application: true,
        assessment: true,
        transitions: true
      }
    });
  }
}
