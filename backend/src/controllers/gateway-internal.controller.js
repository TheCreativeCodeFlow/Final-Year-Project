/**
 * Internal Gateway Controller.
 *
 * Provides dedicated endpoints for the Gateway runtime process:
 * 1. Application and tenant resolution by domain/host.
 * 2. Ingestion of structured security telemetry and routing outcomes.
 * 3. Gateway subsystem health checks.
 *
 * Enforces:
 * - Internal service token authentication.
 * - Strict tenant boundary preservation.
 * - Sanitized telemetry persistence (no credentials or sensitive payloads).
 */

import crypto from 'node:crypto';
import { getPrismaClient } from '../db/client.js';
import { logger } from '../utils/logger.js';
import { BehavioralTelemetryPipelineService } from '../services/behavioral-telemetry-pipeline.service.js';

/**
 * Resolves a protected application and its parent tenant by domain.
 */
export async function resolveApplication(req, res, next) {
  const prisma = req.prisma || getPrismaClient();
  const domainQuery = req.query.domain || req.query.host;

  if (!domainQuery || typeof domainQuery !== 'string') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_DOMAIN_PARAMETER',
        message: 'Query parameter "domain" or "host" is required.'
      }
    });
  }

  // Normalize host: lowercase, trim, remove port if present
  const normalizedDomain = domainQuery.trim().toLowerCase().split(':')[0];

  try {
    const app = await prisma.protectedApplication.findFirst({
      where: { domain: normalizedDomain },
      include: {
        tenant: {
          select: {
            id: true,
            identifier: true,
            displayName: true,
            status: true
          }
        }
      }
    });

    if (!app) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'APPLICATION_NOT_FOUND',
          message: `No protected application registered for domain "${normalizedDomain}".`
        }
      });
    }

    // Verify tenant status
    if (app.tenant.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'TENANT_INACTIVE',
          message: `The tenant "${app.tenant.identifier}" associated with this application is ${app.tenant.status}. Routing denied.`
        }
      });
    }

    res.status(200).json({
      success: true,
      data: {
        applicationId: app.id,
        applicationIdentifier: app.applicationIdentifier,
        name: app.name,
        domain: app.domain,
        status: app.status,
        isProtected: app.status === 'PROTECTED',
        tenant: {
          id: app.tenant.id,
          identifier: app.tenant.identifier,
          displayName: app.tenant.displayName,
          status: app.tenant.status
        }
      }
    });
  } catch (err) {
    logger.error('Failed to resolve application by domain', {
      domain: normalizedDomain,
      error: err.message
    });
    next(err);
  }
}

/**
 * Ingests structured gateway telemetry and persists security observations.
 */
export async function recordTelemetry(req, res, next) {
  const prisma = req.prisma || getPrismaClient();
  const {
    tenantId,
    applicationId,
    correlationId,
    observationType = 'GATEWAY_REQUEST',
    method,
    normalizedRoute,
    responseStatus,
    durationMs,
    requestSizeBytes,
    responseSizeBytes,
    clientIp,
    validationOutcome,
    forwardingResult,
    routingDecision: decisionPayload
  } = req.body;

  if (!tenantId || !correlationId) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_REQUIRED_FIELDS',
        message: 'Fields "tenantId" and "correlationId" are required for gateway telemetry.'
      }
    });
  }

  try {
    // Verify tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TENANT_NOT_FOUND',
          message: `Tenant "${tenantId}" not found for telemetry recording.`
        }
      });
    }

    // Process through behavioral telemetry pipeline
    const pipeline = new BehavioralTelemetryPipelineService({ prisma });
    const result = await pipeline.processTelemetryEvent(req.body, {
      expectedTenantId: tenantId
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TELEMETRY_PAYLOAD',
          message: 'The telemetry record failed canonical schema validation.',
          details: result.errors
        }
      });
    }

    if (result.duplicate) {
      return res.status(200).json({
        success: true,
        duplicate: true,
        persistenceStatus: 'TELEMETRY_PERSISTED',
        data: {
          observationId: result.observationId,
          observationIdentifier: result.observationIdentifier,
          correlationId: result.canonicalEvent.correlationId
        }
      });
    }

    res.status(201).json({
      success: true,
      persistenceStatus: 'TELEMETRY_PERSISTED',
      data: {
        observationId: result.observationId,
        observationIdentifier: result.observationIdentifier,
        routingDecisionId: result.routingDecisionId,
        correlationId: result.canonicalEvent.correlationId,
        sessionRef: result.correlation?.sessionRef || null,
        featureSetsExtracted: result.featureSets ? result.featureSets.length : 0
      }
    });
  } catch (err) {
    logger.error('Failed to record gateway telemetry', {
      correlationId,
      error: err.message
    });
    next(err);
  }
}

/**
 * Evaluates an ingress gateway request through the unified decision pipeline.
 */
export async function evaluateDecision(req, res, next) {
  const prisma = req.prisma || getPrismaClient();
  const {
    correlationId,
    tenantId,
    applicationId,
    domain,
    method,
    path,
    clientIp,
    headers,
    routingMode,
    appContext
  } = req.body;

  try {
    const { GatewayDecisionControllerService } = await import('../deception/gateway-decision-controller.service.js');
    const controller = new GatewayDecisionControllerService({ prismaClient: prisma });

    const decision = await controller.evaluateGatewayRequest({
      correlationId,
      tenantId,
      applicationId,
      domain,
      method,
      path,
      clientIp,
      headers,
      routingMode,
      appContext
    });

    res.status(200).json({
      success: true,
      status: 'success',
      data: decision
    });
  } catch (err) {
    logger.error('Gateway decision evaluation failed', {
      correlationId,
      error: err.message
    });
    next(err);
  }
}

/**
 * Retrieves the current gateway routing mode and safety status for a tenant or application.
 */
export async function getRoutingMode(req, res, next) {
  const prisma = req.prisma || getPrismaClient();
  const { tenantId, applicationId } = req.query;

  try {
    let app = null;
    if (applicationId) {
      app = await prisma.protectedApplication.findUnique({
        where: { id: applicationId }
      });
    }

    const { RuntimeSelectionService, ROUTING_MODES, getApplicationRoutingMode } = await import('../deception/runtime-selection.service.js');
    const runtimeSelector = new RuntimeSelectionService({ prismaClient: prisma });

    let labReadiness = { isReady: false, status: 'CONTROLLED_LAB_BLOCKED', blockers: [] };
    if (tenantId) {
      const activeEnv = await prisma.deceptionRuntimeEnvironment.findFirst({
        where: { tenantId, lifecycleState: 'ACTIVE' }
      });
      if (activeEnv) {
        labReadiness = await runtimeSelector.checkControlledLabReadiness(activeEnv.id, tenantId);
      }
    }

    const currentMode = (applicationId && getApplicationRoutingMode(applicationId)) ||
                        (tenantId && getApplicationRoutingMode(tenantId)) ||
                        app?.routingMode ||
                        ROUTING_MODES.SHADOW;

    res.status(200).json({
      success: true,
      data: {
        currentMode,
        defaultMode: ROUTING_MODES.SHADOW,
        availableModes: Object.values(ROUTING_MODES),
        controlledLabReadiness: labReadiness
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Updates the routing mode for a protected application with mandatory safety validation.
 */
export async function setRoutingMode(req, res, next) {
  const prisma = req.prisma || getPrismaClient();
  const { applicationId, routingMode, tenantId } = req.body;

  try {
    const { RuntimeSelectionService, ROUTING_MODES, setApplicationRoutingMode } = await import('../deception/runtime-selection.service.js');

    if (!Object.values(ROUTING_MODES).includes(routingMode)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ROUTING_MODE',
          message: `Invalid routing mode "${routingMode}". Allowed: ${Object.values(ROUTING_MODES).join(', ')}`
        }
      });
    }

    // If activating CONTROLLED_LAB, verify all mandatory conditions
    if (routingMode === ROUTING_MODES.CONTROLLED_LAB) {
      const runtimeSelector = new RuntimeSelectionService({ prismaClient: prisma });
      const env = await prisma.deceptionRuntimeEnvironment.findFirst({
        where: { tenantId, lifecycleState: 'ACTIVE' }
      });

      if (!env) {
        return res.status(422).json({
          success: false,
          error: {
            code: 'CONTROLLED_LAB_BLOCKED',
            message: 'Cannot enable CONTROLLED_LAB: No active deception runtime environment provisioned.',
            blockers: ['No active deception runtime environment found.']
          }
        });
      }

      const readiness = await runtimeSelector.checkControlledLabReadiness(env.id, tenantId);
      if (!readiness.isReady) {
        return res.status(422).json({
          success: false,
          error: {
            code: 'CONTROLLED_LAB_BLOCKED',
            message: 'Cannot enable CONTROLLED_LAB: Mandatory safety conditions are not satisfied.',
            blockers: readiness.blockers,
            checklist: readiness.checklist
          }
        });
      }
    }

    if (applicationId) {
      setApplicationRoutingMode(applicationId, routingMode);
    }
    if (tenantId) {
      setApplicationRoutingMode(tenantId, routingMode);
    }

    res.status(200).json({
      success: true,
      data: {
        applicationId,
        routingMode,
        status: 'UPDATED'
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Health check for the internal gateway communication interface.
 */
export async function getGatewayHealth(req, res) {
  res.status(200).json({
    status: 'UP',
    subsystem: 'gateway-internal-management-interface',
    timestamp: new Date().toISOString()
  });
}
