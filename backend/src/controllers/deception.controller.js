/**
 * Adaptive Deception Policy & DSG Controller (Stage 5A & Stage 5A.1).
 *
 * Exposes tenant-scoped endpoints under /api/v1/tenants/:tenantId/deception/...:
 * - Policies: list, get, create, update (with deterministic priority & conflict resolution)
 * - Strategies: catalogue across 5 categories + /strategies/benchmark
 * - Evaluation: evaluate assessments against policies and record immutable decisions
 *   with separated deceptionDisposition and originAccessDecision
 * - Decisions: list and inspect historical policy decisions
 * - DSG Graphs: list, inspect topology across 3 layers, plan proposed mutations with
 *   version concurrency, and reassess multi-stage strategies
 */

import crypto from 'node:crypto';
import { getPrismaClient } from '../db/client.js';
import { PolicyService } from '../deception/policy.service.js';
import { PolicyEvaluationEngine } from '../deception/policy-evaluation.service.js';
import { DecisionRecorderService } from '../deception/decision-recorder.service.js';
import { StrategySelectionService } from '../deception/strategy-selection.service.js';
import { DSGPlannerService } from '../deception/dsg-planner.service.js';
import { BASELINE_STRATEGIES } from '../deception/strategy-catalog.js';
import { StrategyBenchmarkRunner } from '../deception/strategy-scenarios.js';
import { parsePagination } from '../utils/validators.js';

function getTenantId(req) {
  return req.authorizedTenant?.id || req.params?.tenantId;
}

// -----------------------------------------------------------------------------
// Policies
// -----------------------------------------------------------------------------

export async function listPolicies(req, res, next) {
  try {
    const tenantId = getTenantId(req);
    const { page, limit } = parsePagination(req.query);
    const service = new PolicyService(req.prisma);

    const result = await service.listPolicies({
      tenantId,
      enabled: req.query.enabled !== undefined ? req.query.enabled === 'true' : undefined,
      applicationId: req.query.applicationId,
      page,
      limit
    });

    res.status(200).json({
      status: 'success',
      data: result.policies,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function getPolicy(req, res, next) {
  try {
    const tenantId = getTenantId(req);
    const { policyId } = req.params;
    const service = new PolicyService(req.prisma);

    const policy = await service.getPolicyById({ policyId, tenantId });
    if (!policy) {
      return res.status(404).json({
        status: 'error',
        code: 'POLICY_NOT_FOUND',
        message: `Deception policy "${policyId}" not found for this tenant.`
      });
    }

    res.status(200).json({ status: 'success', data: policy });
  } catch (err) {
    next(err);
  }
}

export async function createPolicy(req, res, next) {
  try {
    const tenantId = getTenantId(req);
    const service = new PolicyService(req.prisma);

    const policy = await service.createPolicy({
      tenantId,
      payload: req.body,
      actorIdentifier: req.user?.email || 'API_USER'
    });

    res.status(201).json({ status: 'success', data: policy });
  } catch (err) {
    next(err);
  }
}

export async function updatePolicy(req, res, next) {
  try {
    const tenantId = getTenantId(req);
    const { policyId } = req.params;
    const service = new PolicyService(req.prisma);

    const updated = await service.updatePolicy({
      policyId,
      tenantId,
      payload: req.body,
      actorIdentifier: req.user?.email || 'API_USER'
    });

    if (!updated) {
      return res.status(404).json({
        status: 'error',
        code: 'POLICY_NOT_FOUND',
        message: `Deception policy "${policyId}" not found.`
      });
    }

    res.status(200).json({ status: 'success', data: updated });
  } catch (err) {
    if (err.message.includes('TENANT_FORBIDDEN')) {
      return res.status(403).json({
        status: 'error',
        code: 'TENANT_FORBIDDEN',
        message: err.message
      });
    }
    next(err);
  }
}

// -----------------------------------------------------------------------------
// Strategies
// -----------------------------------------------------------------------------

export async function listStrategies(req, res, next) {
  try {
    const tenantId = getTenantId(req);
    const prisma = req.prisma || getPrismaClient();

    const dbStrategies = await prisma.deceptionStrategy.findMany({
      where: {
        OR: [{ tenantId }, { tenantId: null }]
      }
    });

    const mergedStrategies = BASELINE_STRATEGIES.map((base) => {
      const match = dbStrategies.find((s) => s.strategyIdentifier === base.strategyIdentifier);
      return {
        ...base,
        id: match?.id || base.strategyIdentifier,
        tenantId: match?.tenantId || null
      };
    });

    res.status(200).json({
      status: 'success',
      data: mergedStrategies,
      notice:
        'STAGE_5A_PLANNING_ONLY: Deception strategies define simulation blueprints. No live containers or honeypots are executed in this milestone.'
    });
  } catch (err) {
    next(err);
  }
}

export async function getStrategy(req, res, next) {
  try {
    const { strategyId } = req.params;
    const base = BASELINE_STRATEGIES.find(
      (s) => s.strategyIdentifier === strategyId || s.id === strategyId
    );

    if (base) {
      return res.status(200).json({ status: 'success', data: base });
    }

    const prisma = req.prisma || getPrismaClient();
    const dbStrat = await prisma.deceptionStrategy.findUnique({
      where: { id: strategyId }
    });

    if (!dbStrat) {
      return res.status(404).json({
        status: 'error',
        code: 'STRATEGY_NOT_FOUND',
        message: `Strategy "${strategyId}" not found.`
      });
    }

    res.status(200).json({ status: 'success', data: dbStrat });
  } catch (err) {
    next(err);
  }
}

export async function getStrategyBenchmark(req, res, next) {
  try {
    const runner = new StrategyBenchmarkRunner();
    const benchmarkResults = runner.evaluateAllScenarios();

    res.status(200).json({
      status: 'success',
      data: {
        totalScenarios: benchmarkResults.length,
        passedCount: benchmarkResults.filter((r) => r.pass).length,
        scenarios: benchmarkResults
      }
    });
  } catch (err) {
    next(err);
  }
}

// -----------------------------------------------------------------------------
// Policy Evaluation Engine
// -----------------------------------------------------------------------------

export async function evaluatePolicy(req, res, next) {
  try {
    const tenantId = getTenantId(req);
    const prisma = req.prisma || getPrismaClient();
    const {
      assessmentId,
      applicationId,
      policyId,
      customAssessment,
      baseGraphVersion,
      persistDecision = true,
      idempotencyKey: bodyIdempotencyKey
    } = req.body;

    const headerIdempotencyKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
    const idempotencyKey = headerIdempotencyKey || bodyIdempotencyKey || null;
    const requestPayloadHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(req.body || {}))
      .digest('hex');

    // 0. Check for existing decision by idempotency key
    if (idempotencyKey) {
      const existingDecision = await prisma.policyDecision.findFirst({
        where: { tenantId, idempotencyKey }
      });
      if (existingDecision) {
        if (
          existingDecision.requestPayloadHash &&
          existingDecision.requestPayloadHash !== requestPayloadHash
        ) {
          return res.status(409).json({
            status: 'error',
            code: 'IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH',
            message: 'Idempotency key reuse detected with mismatched request payload.'
          });
        }
        return res.status(200).json({
          status: 'success',
          data: {
            evaluation: {
              decisionResult: existingDecision.decisionResult,
              deceptionDisposition: existingDecision.deceptionDisposition,
              originAccessDecision: existingDecision.originAccessDecision,
              decisionRationale: existingDecision.decisionRationale,
              reasonCodes: existingDecision.reasonCodes,
              dsgPlan: existingDecision.proposedMutations,
              evidenceReferences: existingDecision.evidenceReferences
            },
            decisionId: existingDecision.id,
            persisted: true,
            deceptionDisposition: existingDecision.deceptionDisposition,
            originAccessDecision: existingDecision.originAccessDecision,
            idempotentReplay: true
          }
        });
      }
    }

    // 1. Resolve Assessment
    let assessment = customAssessment || null;
    if (assessmentId) {
      assessment = await prisma.behavioralAssessment.findFirst({
        where: { id: assessmentId, tenantId },
        include: { application: true }
      });
      if (!assessment) {
        return res.status(404).json({
          status: 'error',
          code: 'ASSESSMENT_NOT_FOUND',
          message: `Behavioral assessment "${assessmentId}" not found for this tenant.`
        });
      }
    }

    // 2. Resolve Application
    const resolvedAppId = applicationId || assessment?.applicationId;
    let application = null;
    if (resolvedAppId) {
      application = await prisma.protectedApplication.findFirst({
        where: { id: resolvedAppId, tenantId }
      });
    }

    // 3. Resolve Policy (with deterministic priority & conflict resolution)
    const policyService = new PolicyService(prisma);
    let policy = null;
    if (policyId) {
      policy = await policyService.getPolicyById({ policyId, tenantId });
    } else {
      policy = await policyService.resolveApplicablePolicy({
        tenantId,
        applicationId: resolvedAppId,
        classification: assessment?.assessmentLabel || assessment?.classification
      });
    }

    // 4. Resolve Active DSG Graph
    let currentGraph = await prisma.deceptionGraph.findFirst({
      where: { tenantId, status: 'ACTIVE' },
      include: { nodes: true, edges: true }
    });

    // 5. Evaluate policy
    const engine = new PolicyEvaluationEngine();
    const evaluation = engine.evaluate({
      assessment,
      application,
      policy,
      strategies: BASELINE_STRATEGIES,
      currentGraph,
      tenantId
    });

    // 6. Optionally persist decision
    let recordedDecision = null;
    if (persistDecision) {
      const recorder = new DecisionRecorderService(prisma);
      recordedDecision = await recorder.recordDecision({
        tenantId,
        applicationId: resolvedAppId,
        assessmentId: assessment?.id || null,
        observationId: assessment?.observationId || null,
        evaluation,
        graphId: currentGraph?.id || null,
        baseGraphVersion: baseGraphVersion ?? currentGraph?.graphVersion,
        actorIdentifier: req.user?.email || 'POLICY_EVALUATOR',
        idempotencyKey,
        requestPayloadHash
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        evaluation,
        decisionId: recordedDecision?.id || null,
        persisted: Boolean(recordedDecision),
        deceptionDisposition: evaluation.deceptionDisposition,
        originAccessDecision: evaluation.originAccessDecision
      }
    });
  } catch (err) {
    if (err.code === 'IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH') {
      return res.status(409).json({
        status: 'error',
        code: 'IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH',
        message: err.message
      });
    }
    next(err);
  }
}

// -----------------------------------------------------------------------------
// Decisions Explorer
// -----------------------------------------------------------------------------

export async function listDecisions(req, res, next) {
  try {
    const tenantId = getTenantId(req);
    const { page, limit } = parsePagination(req.query);
    const recorder = new DecisionRecorderService(req.prisma);

    const result = await recorder.listDecisions({
      tenantId,
      page,
      limit,
      decisionResult: req.query.decisionResult,
      deceptionDisposition: req.query.deceptionDisposition,
      applicationId: req.query.applicationId
    });

    res.status(200).json({
      status: 'success',
      data: result.decisions,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function getDecision(req, res, next) {
  try {
    const tenantId = getTenantId(req);
    const { decisionId } = req.params;
    const recorder = new DecisionRecorderService(req.prisma);

    const decision = await recorder.getDecisionById({ decisionId, tenantId });
    if (!decision) {
      return res.status(404).json({
        status: 'error',
        code: 'DECISION_NOT_FOUND',
        message: `Policy decision "${decisionId}" not found for this tenant.`
      });
    }

    res.status(200).json({ status: 'success', data: decision });
  } catch (err) {
    next(err);
  }
}

// -----------------------------------------------------------------------------
// Deception State Graphs (DSG)
// -----------------------------------------------------------------------------

export async function listGraphs(req, res, next) {
  try {
    const tenantId = getTenantId(req);
    const prisma = req.prisma || getPrismaClient();

    const graphs = await prisma.deceptionGraph.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: { nodes: true, edges: true, transitions: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({ status: 'success', data: graphs });
  } catch (err) {
    next(err);
  }
}

export async function getGraph(req, res, next) {
  try {
    const tenantId = getTenantId(req);
    const { graphId } = req.params;
    const prisma = req.prisma || getPrismaClient();

    const graph = await prisma.deceptionGraph.findFirst({
      where: { id: graphId, tenantId },
      include: {
        nodes: true,
        edges: true,
        transitions: {
          orderBy: { proposedAt: 'desc' },
          take: 20
        }
      }
    });

    if (!graph) {
      return res.status(404).json({
        status: 'error',
        code: 'GRAPH_NOT_FOUND',
        message: `Deception State Graph "${graphId}" not found.`
      });
    }

    const layerSummary = {
      PROTECTED_DECEPTION_POLICY: graph.nodes.filter(
        (n) => n.layerClassification === 'PROTECTED_DECEPTION_POLICY'
      ),
      CONTROLLED_DYNAMIC_STATE: graph.nodes.filter(
        (n) => n.layerClassification === 'CONTROLLED_DYNAMIC_STATE'
      ),
      OBSERVATIONAL_ATTACKER_STATE: graph.nodes.filter(
        (n) => n.layerClassification === 'OBSERVATIONAL_ATTACKER_STATE'
      )
    };

    res.status(200).json({
      status: 'success',
      data: {
        graph,
        layerSummary,
        nonExecutionNotice:
          'STAGE_5A_INVARIANT: Graph topology represents model state and proposed mutations. Transitions with status PROPOSED have not been executed.'
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function planGraphMutation(req, res, next) {
  try {
    const tenantId = getTenantId(req);
    const { graphId } = req.params;
    const { strategyIdentifier, assessmentId, policyId, baseGraphVersion } = req.body;
    const headerIdempotencyKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
    const idempotencyKey = headerIdempotencyKey || req.body.idempotencyKey || null;
    const requestPayloadHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(req.body || {}))
      .digest('hex');
    const prisma = req.prisma || getPrismaClient();

    const graph = await prisma.deceptionGraph.findFirst({
      where: { id: graphId, tenantId },
      include: { nodes: true, edges: true }
    });

    if (!graph) {
      return res.status(404).json({
        status: 'error',
        code: 'GRAPH_NOT_FOUND',
        message: `Graph "${graphId}" not found.`
      });
    }

    // Check for existing transition by idempotency key
    if (idempotencyKey) {
      const existingTransition = await prisma.deceptionGraphTransition.findFirst({
        where: { tenantId, idempotencyKey }
      });
      if (existingTransition) {
        if (
          existingTransition.requestPayloadHash &&
          existingTransition.requestPayloadHash !== requestPayloadHash
        ) {
          return res.status(409).json({
            status: 'error',
            code: 'IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH',
            message: 'Idempotency key reuse detected with mismatched request payload.'
          });
        }
        return res.status(200).json({
          status: 'success',
          data: {
            status: existingTransition.transitionStatus,
            planId: `plan-replay-${existingTransition.id}`,
            idempotencyKey,
            baseGraphVersion: existingTransition.baseGraphVersion,
            targetGraphVersion: existingTransition.targetGraphVersion,
            rejectionReason: existingTransition.rejectionReason,
            previousState: existingTransition.previousState,
            proposedState: existingTransition.proposedState,
            nodesToAdd: existingTransition.proposedState?.nodesToAdd || [],
            edgesToAdd: existingTransition.proposedState?.edgesToAdd || [],
            syntheticEnvironmentModel:
              existingTransition.proposedState?.syntheticEnvironmentModel || null,
            validationResult: {
              valid: existingTransition.transitionStatus !== 'REJECTED',
              violations: existingTransition.rejectionReason ? [existingTransition.rejectionReason] : []
            },
            nonExecutionNotice:
              'STAGE_5A_PLANNING_ONLY: Replayed proposed plan. Live environments remain unprovisioned.',
            idempotentReplay: true
          }
        });
      }
    }

    const strategy = BASELINE_STRATEGIES.find((s) => s.strategyIdentifier === strategyIdentifier);
    if (!strategy) {
      return res.status(404).json({
        status: 'error',
        code: 'STRATEGY_NOT_FOUND',
        message: `Strategy "${strategyIdentifier}" not found in catalogue.`
      });
    }

    const planner = new DSGPlannerService();
    const plan = planner.planMutation({
      currentGraph: graph,
      strategy,
      assessment: assessmentId ? { id: assessmentId } : {},
      policy: policyId ? { id: policyId } : {},
      tenantId,
      baseGraphVersion
    });

    if (plan.status === 'REJECTED') {
      return res.status(409).json({
        status: 'error',
        code: 'MUTATION_PLAN_REJECTED',
        message: plan.rejectionReason,
        data: plan
      });
    }

    if (idempotencyKey) {
      await prisma.deceptionGraphTransition.create({
        data: {
          tenantId,
          graphId,
          baseGraphVersion: plan.baseGraphVersion,
          targetGraphVersion: plan.targetGraphVersion,
          idempotencyKey,
          requestPayloadHash,
          rejectionReason: null,
          previousState: plan.previousState || {},
          proposedState: plan.proposedState || {},
          transitionStatus: 'PROPOSED',
          provenance: 'STAGE_5A_DSG_PLANNER'
        }
      });
    }

    res.status(200).json({ status: 'success', data: plan });
  } catch (err) {
    next(err);
  }
}

export async function reassessGraphMutation(req, res, next) {
  try {
    const tenantId = getTenantId(req);
    const { graphId } = req.params;
    const { activeProposal, newStrategyIdentifier, newAssessmentId, policyId } = req.body;
    const prisma = req.prisma || getPrismaClient();

    const graph = await prisma.deceptionGraph.findFirst({
      where: { id: graphId, tenantId },
      include: { nodes: true, edges: true }
    });

    if (!graph) {
      return res.status(404).json({
        status: 'error',
        code: 'GRAPH_NOT_FOUND',
        message: `Graph "${graphId}" not found.`
      });
    }

    const newStrategy = BASELINE_STRATEGIES.find((s) => s.strategyIdentifier === newStrategyIdentifier);
    if (!newStrategy) {
      return res.status(404).json({
        status: 'error',
        code: 'STRATEGY_NOT_FOUND',
        message: `Strategy "${newStrategyIdentifier}" not found in catalogue.`
      });
    }

    const planner = new DSGPlannerService();
    const reassessment = planner.reassessStrategy({
      currentGraph: graph,
      activeProposal,
      newStrategy,
      newAssessment: newAssessmentId ? { id: newAssessmentId } : {},
      policy: policyId ? { id: policyId } : {},
      tenantId
    });

    if (!reassessment.consistent) {
      return res.status(422).json({
        status: 'error',
        code: 'INCONSISTENT_SYNTHETIC_STATE',
        message: reassessment.rejectionReason,
        data: reassessment
      });
    }

    res.status(200).json({ status: 'success', data: reassessment });
  } catch (err) {
    next(err);
  }
}
