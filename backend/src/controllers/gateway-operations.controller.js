/**
 * Gateway Operations Controller (Stage 5B.5).
 *
 * Exposes tenant-scoped operational endpoints for the Gateway Operations Dashboard:
 * 1. GET  /overview: Status, mode, health, volumes, shadow decisions, and safety checklist.
 * 2. GET  /requests: Paginated request routing decisions list.
 * 3. GET  /requests/:correlationId: Comprehensive 14-stage Request-Decision Explorer data.
 * 4. POST /routing-mode: Mode change with hard safety verification.
 * 5. GET  /safety-status: Independent readiness audit for CONTROLLED_LAB.
 */

import { getPrismaClient } from '../db/client.js';
import { logger } from '../utils/logger.js';
import {
  RuntimeSelectionService,
  ROUTING_MODES,
  ROUTING_DECISION_OUTCOMES,
  getApplicationRoutingMode,
  setApplicationRoutingMode
} from '../deception/runtime-selection.service.js';
import { parsePagination } from '../utils/validators.js';

function getTenantId(req) {
  return req.authorizedTenant?.id || req.params?.tenantId;
}

/**
 * Returns comprehensive Gateway Operations Dashboard overview data.
 */
export async function getGatewayOverview(req, res, next) {
  const prisma = req.prisma || getPrismaClient();
  const tenantId = getTenantId(req);

  try {
    const runtimeSelector = new RuntimeSelectionService({ prismaClient: prisma });

    // 1. Fetch Tenant Applications & Active Environments
    const [applications, environments, decisionsCount, outcomes] = await Promise.all([
      prisma.protectedApplication.findMany({
        where: { tenantId }
      }),
      prisma.deceptionRuntimeEnvironment.findMany({
        where: { tenantId, lifecycleState: { in: ['ACTIVE', 'UPDATING', 'DEGRADED'] } },
        include: { authorization: true }
      }),
      prisma.routingDecision.count({
        where: { tenantId }
      }),
      prisma.routingOutcome.findMany({
        where: { tenantId },
        orderBy: { recordedAt: 'desc' },
        take: 100
      })
    ]);

    // 2. Count outcomes by category
    const outcomeCounts = {
      NORMAL_FORWARD: 0,
      SHADOW_DECEPTION: 0,
      DECEPTION_ROUTE_EXECUTED: 0,
      BLOCK_REQUEST: 0,
      DEFER_TO_ORIGIN: 0,
      DEFER_WITH_UNCERTAINTY: 0,
      RUNTIME_UNAVAILABLE: 0,
      OTHER: 0
    };

    for (const outcome of outcomes) {
      if (outcomeCounts[outcome.outcomeStatus] !== undefined) {
        outcomeCounts[outcome.outcomeStatus]++;
      } else {
        outcomeCounts.OTHER++;
      }
    }

    // 3. Determine Overall Active Routing Mode
    let activeRoutingMode = getApplicationRoutingMode(tenantId) || ROUTING_MODES.SHADOW;
    if (applications.length > 0) {
      const appMode = getApplicationRoutingMode(applications[0].id);
      if (appMode) activeRoutingMode = appMode;
    }

    // 4. Evaluate Safety Status for CONTROLLED_LAB
    let controlledLabReadiness = { isReady: false, status: 'CONTROLLED_LAB_BLOCKED', blockers: ['No active environment.'] };
    if (environments.length > 0) {
      controlledLabReadiness = await runtimeSelector.checkControlledLabReadiness(environments[0].id, tenantId);
    }

    // 5. Derive Safety Indicator
    let safetyIndicator = 'SHADOW_ACTIVE';
    if (activeRoutingMode === ROUTING_MODES.OBSERVE_ONLY) {
      safetyIndicator = 'OBSERVE_ONLY';
    } else if (activeRoutingMode === ROUTING_MODES.CONTROLLED_LAB) {
      safetyIndicator = controlledLabReadiness.isReady ? 'CONTROLLED_LAB_READY' : 'CONTROLLED_LAB_BLOCKED';
    } else {
      safetyIndicator = 'SHADOW_ACTIVE';
    }

    res.status(200).json({
      status: 'success',
      data: {
        activeRoutingMode,
        safetyIndicator,
        controlledLabReadiness,
        gatewayHealth: { status: 'HEALTHY', mode: 'REVERSE_PROXY_FOUNDATION' },
        detectionServiceHealth: { status: 'HEALTHY', engine: 'HYBRID_ASSESSMENT_4C1' },
        statistics: {
          totalRequestsObserved: decisionsCount,
          shadowDecisionsCount: outcomeCounts.SHADOW_DECEPTION,
          normalForwardCount: outcomeCounts.NORMAL_FORWARD + outcomeCounts.DEFER_TO_ORIGIN,
          blockedRequestsCount: outcomeCounts.BLOCK_REQUEST,
          deceptionExecutedCount: outcomeCounts.DECEPTION_ROUTE_EXECUTED,
          runtimeUnavailableCount: outcomeCounts.RUNTIME_UNAVAILABLE,
          outcomeBreakdown: outcomeCounts
        },
        applications: applications.map((a) => ({
          id: a.id,
          name: a.name,
          domain: a.domain,
          status: a.status,
          routingMode: getApplicationRoutingMode(a.id) || a.routingMode || ROUTING_MODES.SHADOW
        })),
        environments: environments.map((e) => ({
          id: e.id,
          name: e.name,
          environmentIdentifier: e.environmentIdentifier,
          lifecycleState: e.lifecycleState,
          healthStatus: e.healthStatus,
          dsgGraphVersion: e.dsgGraphVersion,
          networkIsolationMode: e.networkIsolationMode,
          isSimulated: e.isSimulated
        }))
      }
    });
  } catch (err) {
    logger.error('Failed to get gateway operations overview', { tenantId, error: err.message });
    next(err);
  }
}

/**
 * Lists paginated routing decisions with filtering for the Request Explorer.
 */
export async function listGatewayRequests(req, res, next) {
  const prisma = req.prisma || getPrismaClient();
  const tenantId = getTenantId(req);
  const { page, limit } = parsePagination(req.query);
  const { outcomeStatus, search } = req.query;

  try {
    const where = { tenantId };

    if (search) {
      where.OR = [
        { correlationId: { contains: search, mode: 'insensitive' } },
        { intendedAction: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (outcomeStatus) {
      where.outcome = { outcomeStatus };
    }

    const [total, decisions] = await Promise.all([
      prisma.routingDecision.count({ where }),
      prisma.routingDecision.findMany({
        where,
        include: {
          outcome: true,
          policyDecision: {
            include: {
              assessment: true,
              selectedStrategy: true
            }
          },
          targetApplication: true,
          targetEnvironment: true
        },
        orderBy: { decidedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      })
    ]);

    const formattedRequests = decisions.map((d) => ({
      id: d.id,
      correlationId: d.correlationId,
      decidedAt: d.decidedAt,
      intendedAction: d.intendedAction,
      decisionStatus: d.decisionStatus,
      outcomeStatus: d.outcome?.outcomeStatus || 'UNKNOWN',
      routingMode: d.outcome?.failureOrDiscrepancyDetails?.routingMode || 'SHADOW',
      decisionReason: d.outcome?.failureOrDiscrepancyDetails?.decisionReason || d.policyDecision?.decisionRationale || 'Evaluated gateway policy.',
      targetDestination: d.outcome?.failureOrDiscrepancyDetails?.targetDestination || d.targetApplication?.upstreamUrl,
      hypotheticalDestination: d.outcome?.failureOrDiscrepancyDetails?.hypotheticalDestination || null,
      hypotheticalEnvironmentId: d.outcome?.failureOrDiscrepancyDetails?.hypotheticalEnvironmentId || null,
      application: d.targetApplication ? { id: d.targetApplication.id, name: d.targetApplication.name, domain: d.targetApplication.domain } : null,
      classification: d.policyDecision?.assessment?.classification || 'BENIGN',
      threatCategory: d.policyDecision?.assessment?.threatCategory || null,
      confidenceScore: d.policyDecision?.assessment?.confidenceScore || 0,
      deceptionDisposition: d.policyDecision?.deceptionDisposition || 'NOT_PROPOSED',
      selectedStrategy: d.policyDecision?.selectedStrategy?.name || null
    }));

    res.status(200).json({
      status: 'success',
      data: formattedRequests,
      meta: { page, limit, total }
    });
  } catch (err) {
    logger.error('Failed to list gateway requests', { tenantId, error: err.message });
    next(err);
  }
}

/**
 * Retrieves the comprehensive 14-stage Request-Decision Explorer data for a specific correlation ID.
 */
export async function getRequestExplorerDetail(req, res, next) {
  const prisma = req.prisma || getPrismaClient();
  const tenantId = getTenantId(req);
  const { correlationId } = req.params;

  try {
    // 1. Fetch Routing Decision
    const routingDecision = await prisma.routingDecision.findFirst({
      where: { tenantId, correlationId },
      include: {
        outcome: true,
        policyDecision: {
          include: {
            assessment: true,
            selectedStrategy: true,
            graph: true
          }
        },
        targetApplication: true,
        targetEnvironment: true
      }
    });

    // 2. Fetch Security Observation
    const observation = await prisma.securityObservation.findFirst({
      where: { tenantId, correlationId }
    });

    // 3. Fetch Execution Events Chain
    const events = await prisma.deceptionExecutionEvent.findMany({
      where: { tenantId, eventPayload: { path: ['correlationId'], equals: correlationId } },
      orderBy: { recordedAt: 'asc' }
    });

    // Fallback: If event payload query returns few, search broader tenant events around the same timestamp
    let lifecycleEvents = events;
    if (lifecycleEvents.length === 0 && routingDecision) {
      lifecycleEvents = await prisma.deceptionExecutionEvent.findMany({
        where: {
          tenantId,
          recordedAt: {
            gte: new Date(new Date(routingDecision.decidedAt).getTime() - 5000),
            lte: new Date(new Date(routingDecision.decidedAt).getTime() + 5000)
          }
        },
        orderBy: { recordedAt: 'asc' },
        take: 20
      });
    }

    if (!routingDecision && !observation) {
      return res.status(404).json({
        status: 'error',
        code: 'REQUEST_NOT_FOUND',
        message: `No request decision records found for correlation ID "${correlationId}".`
      });
    }

    const details = routingDecision?.outcome?.failureOrDiscrepancyDetails || {};
    const assessment = routingDecision?.policyDecision?.assessment || null;
    const policyDecision = routingDecision?.policyDecision || null;

    res.status(200).json({
      status: 'success',
      data: {
        correlationId,
        decidedAt: routingDecision?.decidedAt || observation?.createdAt,
        routingMode: details.routingMode || 'SHADOW',
        intendedAction: routingDecision?.intendedAction || 'NORMAL_ROUTING',
        outcomeStatus: routingDecision?.outcome?.outcomeStatus || 'UNKNOWN',
        decisionReason: details.decisionReason || policyDecision?.decisionRationale || 'Evaluated gateway policy.',
        targetDestination: details.targetDestination || routingDecision?.targetApplication?.upstreamUrl,
        hypotheticalDestination: details.hypotheticalDestination || null,
        hypotheticalEnvironmentId: details.hypotheticalEnvironmentId || null,

        // 14-Stage Explorer Steps
        pipeline: {
          stage1_observation: {
            method: observation?.method || 'GET',
            path: observation?.rawPath || '/',
            clientIp: observation?.clientIp || '127.0.0.1',
            domain: observation?.sanitizedHeaders?.host || 'unknown',
            observedAt: observation?.createdAt
          },
          stage2_telemetry: {
            normalizedRoute: observation?.normalizedRoute || '/',
            status: observation?.observationStatus || 'NORMALIZED'
          },
          stage3_session: {
            sessionRef: assessment?.sessionRef || 'sess-anonymous'
          },
          stage4_detection: {
            assessmentId: assessment?.id,
            assessmentLabel: assessment?.assessmentLabel,
            classification: assessment?.classification,
            confidenceScore: assessment?.confidenceScore,
            threatCategory: assessment?.threatCategory,
            ruleFindings: assessment?.ruleFindings || [],
            mlAnomalyScore: assessment?.mlAnomalyScore,
            deceptionEligible: assessment?.deceptionEligible
          },
          stage5_policy: {
            policyId: policyDecision?.policyId,
            policyVersion: policyDecision?.policyVersion,
            decisionResult: policyDecision?.decisionResult,
            deceptionDisposition: policyDecision?.deceptionDisposition,
            originAccessDecision: policyDecision?.originAccessDecision,
            decisionRationale: policyDecision?.decisionRationale,
            reasonCodes: policyDecision?.reasonCodes || []
          },
          stage6_strategy: {
            selectedStrategyId: policyDecision?.selectedStrategyId,
            strategyName: policyDecision?.selectedStrategy?.name,
            strategyType: policyDecision?.selectedStrategy?.strategyType
          },
          stage7_dsg: {
            dsgGraphId: policyDecision?.dsgGraphId,
            baseGraphVersion: policyDecision?.baseGraphVersion,
            proposedMutations: policyDecision?.proposedMutations
          },
          stage8_runtime: {
            targetEnvironmentId: routingDecision?.targetEnvironmentId,
            environmentName: routingDecision?.targetEnvironment?.name,
            lifecycleState: routingDecision?.targetEnvironment?.lifecycleState,
            healthStatus: routingDecision?.targetEnvironment?.healthStatus,
            hypotheticalEnvironmentId: details.hypotheticalEnvironmentId || null
          },
          stage9_decision: {
            intendedAction: routingDecision?.intendedAction,
            outcomeStatus: routingDecision?.outcome?.outcomeStatus,
            routingMode: details.routingMode,
            actualDestination: details.targetDestination,
            hypotheticalDestination: details.hypotheticalDestination
          }
        },

        // Cryptographic Lifecycle Events
        executionEvents: lifecycleEvents.map((e) => ({
          id: e.id,
          eventType: e.eventType,
          severity: e.severity,
          message: e.message,
          actorIdentifier: e.actorIdentifier,
          recordedAt: e.recordedAt,
          eventPayload: e.eventPayload
        }))
      }
    });
  } catch (err) {
    logger.error('Failed to get request explorer detail', { correlationId, error: err.message });
    next(err);
  }
}

/**
 * Updates routing mode for an application or tenant with hard safety validation.
 */
export async function updateRoutingMode(req, res, next) {
  const prisma = req.prisma || getPrismaClient();
  const tenantId = getTenantId(req);
  const { applicationId, routingMode } = req.body;

  try {
    const { RuntimeSelectionService, ROUTING_MODES } = await import('../deception/runtime-selection.service.js');

    if (!Object.values(ROUTING_MODES).includes(routingMode)) {
      return res.status(400).json({
        status: 'error',
        code: 'INVALID_ROUTING_MODE',
        message: `Invalid routing mode "${routingMode}". Allowed: ${Object.values(ROUTING_MODES).join(', ')}`
      });
    }

    if (routingMode === ROUTING_MODES.CONTROLLED_LAB) {
      const runtimeSelector = new RuntimeSelectionService({ prismaClient: prisma });
      const env = await prisma.deceptionRuntimeEnvironment.findFirst({
        where: { tenantId, lifecycleState: 'ACTIVE' }
      });

      if (!env) {
        return res.status(422).json({
          status: 'error',
          code: 'CONTROLLED_LAB_BLOCKED',
          message: 'Cannot activate CONTROLLED_LAB: No active deception runtime environment provisioned.',
          blockers: ['No active deception runtime environment found.']
        });
      }

      const readiness = await runtimeSelector.checkControlledLabReadiness(env.id, tenantId);
      if (!readiness.isReady) {
        return res.status(422).json({
          status: 'error',
          code: 'CONTROLLED_LAB_BLOCKED',
          message: 'Cannot activate CONTROLLED_LAB: Mandatory safety conditions are not satisfied.',
          blockers: readiness.blockers,
          checklist: readiness.checklist
        });
      }
    }

    if (applicationId) {
      setApplicationRoutingMode(applicationId, routingMode);
    } else {
      setApplicationRoutingMode(tenantId, routingMode);
      const apps = await prisma.protectedApplication.findMany({ where: { tenantId } });
      for (const a of apps) {
        setApplicationRoutingMode(a.id, routingMode);
      }
    }

    res.status(200).json({
      status: 'success',
      data: {
        tenantId,
        applicationId: applicationId || 'ALL',
        routingMode,
        status: 'UPDATED'
      }
    });
  } catch (err) {
    logger.error('Failed to update routing mode', { tenantId, error: err.message });
    next(err);
  }
}

/**
 * Returns independent safety checklist status for CONTROLLED_LAB mode.
 */
export async function getSafetyStatus(req, res, next) {
  const prisma = req.prisma || getPrismaClient();
  const tenantId = getTenantId(req);

  try {
    const { RuntimeSelectionService } = await import('../deception/runtime-selection.service.js');
    const runtimeSelector = new RuntimeSelectionService({ prismaClient: prisma });

    const activeEnv = await prisma.deceptionRuntimeEnvironment.findFirst({
      where: { tenantId, lifecycleState: 'ACTIVE' }
    });

    if (!activeEnv) {
      return res.status(200).json({
        status: 'success',
        data: {
          isReady: false,
          status: 'CONTROLLED_LAB_BLOCKED',
          blockers: ['No active deception runtime environment found.'],
          checklist: {
            adminActivation: false,
            applicationConfigured: false,
            tenantOwnershipVerified: false,
            runtimeAuthorizationVerified: false,
            runtimeHealthVerified: false,
            networkIsolationVerified: false,
            hostBoundaryVerified: false,
            environmentIdentityVerified: false,
            validGraphVersion: false,
            validRoutingPolicy: false,
            rollbackReadinessVerified: false
          }
        }
      });
    }

    const readiness = await runtimeSelector.checkControlledLabReadiness(activeEnv.id, tenantId);
    res.status(200).json({
      status: 'success',
      data: readiness
    });
  } catch (err) {
    next(err);
  }
}
