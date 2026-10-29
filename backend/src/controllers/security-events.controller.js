/**
 * Security Events and Investigations Controller.
 *
 * Provides database-backed read-only access to persisted security observations,
 * behavioral assessments, routing decisions, outcomes, and investigations:
 * - Scoped strictly to req.authorizedTenant.id.
 * - Enforces strict semantic separation between observed events, decisions, outcomes, and evidence.
 * - When execution evidence or routing outcomes are missing, returns an explicit NOT_RECORDED
 *   or MISSING state (NEVER defaulted to benign success or inferred from policy decisions).
 */

import { getPrismaClient } from '../db/client.js';
import { parsePagination } from '../utils/validators.js';

/**
 * Lists security events (observations) belonging to authorized tenant.
 */
export async function listSecurityEvents(req, res, next) {
  const prisma = req.prisma || getPrismaClient();
  const tenantId = req.authorizedTenant.id;
  const correlationId = req.id || null;

  try {
    const { page, limit, skip } = parsePagination(req.query);

    const where = { tenantId };

    if (req.query.observationType) {
      where.observationType = String(req.query.observationType).trim().toUpperCase();
    }

    if (req.query.applicationId) {
      where.applicationId = String(req.query.applicationId).trim();
    }

    if (req.query.evidenceStatus) {
      where.evidenceStatus = String(req.query.evidenceStatus).trim().toUpperCase();
    }

    if (req.query.search && typeof req.query.search === 'string') {
      const search = req.query.search.trim();
      if (search.length > 0) {
        where.OR = [
          { observationIdentifier: { contains: search, mode: 'insensitive' } },
          { observationType: { contains: search, mode: 'insensitive' } },
          { evidenceProvenance: { contains: search, mode: 'insensitive' } }
        ];
      }
    }

    const [observations, total] = await Promise.all([
      prisma.securityObservation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { observedAt: 'desc' },
        select: {
          id: true,
          tenantId: true,
          applicationId: true,
          investigationId: true,
          observationIdentifier: true,
          observationType: true,
          observedAt: true,
          evidenceProvenance: true,
          evidenceStatus: true,
          correlationId: true,
          application: {
            select: {
              id: true,
              applicationIdentifier: true,
              name: true,
              domain: true
            }
          },
          assessments: {
            select: {
              id: true,
              classification: true,
              riskScore: true,
              confidenceScore: true
            }
          }
        }
      }),
      prisma.securityObservation.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: observations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      },
      requestId: correlationId
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Retrieves a single security observation by ID or observationIdentifier.
 * Returns full decision lifecycle with explicit outcome and evidence states.
 */
export async function getSecurityEventById(req, res, next) {
  const prisma = req.prisma || getPrismaClient();
  const tenantId = req.authorizedTenant.id;
  const { eventId } = req.params;
  const correlationId = req.id || null;

  try {
    const observation = await prisma.securityObservation.findFirst({
      where: {
        tenantId,
        OR: [
          { id: eventId },
          { observationIdentifier: eventId }
        ]
      },
      include: {
        application: {
          select: {
            id: true,
            applicationIdentifier: true,
            name: true,
            domain: true,
            status: true
          }
        },
        investigation: {
          select: {
            id: true,
            investigationIdentifier: true,
            status: true,
            severity: true,
            summary: true
          }
        },
        assessments: true,
        policyDecisions: {
          include: {
            policy: {
              select: {
                id: true,
                policyIdentifier: true,
                name: true,
                priority: true
              }
            },
            routingDecisions: {
              include: {
                outcome: true,
                executionEvidence: true
              }
            }
          }
        }
      }
    });

    if (!observation) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SECURITY_EVENT_NOT_FOUND',
          message: `Security event "${eventId}" was not found in authorized tenant context.`,
          requestId: correlationId,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Format routing decisions with explicit absence representation
    const formattedPolicyDecisions = observation.policyDecisions.map((pd) => ({
      id: pd.id,
      decisionResult: pd.decisionResult,
      decisionRationale: pd.decisionRationale,
      decidedAt: pd.decidedAt,
      evidenceReferences: pd.evidenceReferences,
      policy: pd.policy,
      routingDecisions: pd.routingDecisions.map((rd) => ({
        id: rd.id,
        intendedAction: rd.intendedAction,
        decisionStatus: rd.decisionStatus,
        decidedAt: rd.decidedAt,
        targetApplicationId: rd.targetApplicationId,
        targetEnvironmentId: rd.targetEnvironmentId,
        // Semantic transparency: Outcome is NOT inferred from intended routing
        outcome: rd.outcome
          ? {
              recorded: true,
              outcomeStatus: rd.outcome.outcomeStatus,
              outcomeSource: rd.outcome.outcomeSource,
              recordedAt: rd.outcome.recordedAt,
              failureOrDiscrepancyDetails: rd.outcome.failureOrDiscrepancyDetails
            }
          : {
              recorded: false,
              outcomeStatus: 'NOT_RECORDED',
              notice: 'No routing outcome has been recorded by ingress or proxy supervisor.'
            },
        // Semantic transparency: Execution evidence is NOT inferred from outcome or decision
        executionEvidence: rd.executionEvidence
          ? {
              verified: rd.executionEvidence.evidenceStatus === 'CONFIRMED_EXECUTION',
              evidenceStatus: rd.executionEvidence.evidenceStatus,
              evidenceSource: rd.executionEvidence.evidenceSource,
              recordedAt: rd.executionEvidence.recordedAt,
              evidenceData: rd.executionEvidence.evidenceData
            }
          : {
              verified: false,
              evidenceStatus: 'MISSING',
              notice: 'No telemetry or execution evidence has been recorded for this routing decision.'
            }
      }))
    }));

    res.status(200).json({
      success: true,
      data: {
        id: observation.id,
        observationIdentifier: observation.observationIdentifier,
        observationType: observation.observationType,
        observedAt: observation.observedAt,
        evidenceProvenance: observation.evidenceProvenance,
        evidenceStatus: observation.evidenceStatus,
        sanitizedStructuredEvidence: observation.sanitizedStructuredEvidence,
        correlationId: observation.correlationId,
        application: observation.application,
        investigation: observation.investigation,
        assessments: observation.assessments,
        decisions: formattedPolicyDecisions
      },
      requestId: correlationId
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Lists investigations belonging to the authorized tenant.
 */
export async function listInvestigations(req, res, next) {
  const prisma = req.prisma || getPrismaClient();
  const tenantId = req.authorizedTenant.id;
  const correlationId = req.id || null;

  try {
    const { page, limit, skip } = parsePagination(req.query);

    const where = { tenantId };

    if (req.query.status) {
      where.status = String(req.query.status).trim().toUpperCase();
    }

    if (req.query.severity) {
      where.severity = String(req.query.severity).trim().toUpperCase();
    }

    if (req.query.applicationId) {
      where.applicationId = String(req.query.applicationId).trim();
    }

    if (req.query.search && typeof req.query.search === 'string') {
      const search = req.query.search.trim();
      if (search.length > 0) {
        where.OR = [
          { investigationIdentifier: { contains: search, mode: 'insensitive' } },
          { summary: { contains: search, mode: 'insensitive' } }
        ];
      }
    }

    const [investigations, total] = await Promise.all([
      prisma.investigation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { openedAt: 'desc' },
        include: {
          application: {
            select: {
              id: true,
              applicationIdentifier: true,
              name: true,
              domain: true
            }
          },
          attackerProfiles: {
            include: {
              attackerProfile: {
                select: {
                  id: true,
                  profileIdentifier: true,
                  displayLabel: true
                }
              }
            }
          }
        }
      }),
      prisma.investigation.count({ where })
    ]);

    const formatted = investigations.map((inv) => ({
      id: inv.id,
      investigationIdentifier: inv.investigationIdentifier,
      status: inv.status,
      severity: inv.severity,
      summary: inv.summary,
      evidenceReferences: inv.evidenceReferences,
      openedAt: inv.openedAt,
      updatedAt: inv.updatedAt,
      application: inv.application,
      attackerProfiles: inv.attackerProfiles.map((ap) => ap.attackerProfile)
    }));

    res.status(200).json({
      success: true,
      data: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      },
      requestId: correlationId
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Retrieves a single investigation by ID or investigationIdentifier.
 */
export async function getInvestigationById(req, res, next) {
  const prisma = req.prisma || getPrismaClient();
  const tenantId = req.authorizedTenant.id;
  const { investigationId } = req.params;
  const correlationId = req.id || null;

  try {
    const investigation = await prisma.investigation.findFirst({
      where: {
        tenantId,
        OR: [
          { id: investigationId },
          { investigationIdentifier: investigationId }
        ]
      },
      include: {
        application: {
          select: {
            id: true,
            applicationIdentifier: true,
            name: true,
            domain: true,
            status: true
          }
        },
        attackerProfiles: {
          include: {
            attackerProfile: true
          }
        },
        observations: {
          select: {
            id: true,
            observationIdentifier: true,
            observationType: true,
            observedAt: true,
            evidenceProvenance: true,
            evidenceStatus: true
          }
        },
        behavioralAssessments: true
      }
    });

    if (!investigation) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'INVESTIGATION_NOT_FOUND',
          message: `Investigation "${investigationId}" was not found in authorized tenant context.`,
          requestId: correlationId,
          timestamp: new Date().toISOString()
        }
      });
    }

    res.status(200).json({
      success: true,
      data: {
        id: investigation.id,
        investigationIdentifier: investigation.investigationIdentifier,
        status: investigation.status,
        severity: investigation.severity,
        summary: investigation.summary,
        evidenceReferences: investigation.evidenceReferences,
        openedAt: investigation.openedAt,
        updatedAt: investigation.updatedAt,
        application: investigation.application,
        attackerProfiles: investigation.attackerProfiles.map((ap) => ap.attackerProfile),
        observations: investigation.observations,
        assessments: investigation.behavioralAssessments
      },
      requestId: correlationId
    });
  } catch (err) {
    next(err);
  }
}
