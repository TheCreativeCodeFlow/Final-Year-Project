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

    // Deduplication check: if observation already exists with this correlationId
    const existingObservation = await prisma.securityObservation.findFirst({
      where: { tenantId, correlationId }
    });

    if (existingObservation) {
      return res.status(200).json({
        success: true,
        duplicate: true,
        persistenceStatus: 'TELEMETRY_PERSISTED',
        data: {
          observationId: existingObservation.id,
          observationIdentifier: existingObservation.observationIdentifier,
          correlationId
        }
      });
    }

    // Create SecurityObservation record
    const observationIdentifier = `obs-gw-${crypto.randomUUID().slice(0, 8)}`;
    const observation = await prisma.securityObservation.create({
      data: {
        tenantId,
        applicationId: applicationId || null,
        observationIdentifier,
        observationType,
        evidenceProvenance: 'GATEWAY_REVERSE_PROXY',
        correlationId,
        evidenceStatus: 'OBSERVED',
        sanitizedStructuredEvidence: {
          method: method || 'UNKNOWN',
          normalizedRoute: normalizedRoute || '/',
          responseStatus: Number(responseStatus) || 0,
          durationMs: Number(durationMs) || 0,
          requestSizeBytes: Number(requestSizeBytes) || 0,
          responseSizeBytes: Number(responseSizeBytes) || 0,
          clientIp: clientIp || 'UNKNOWN',
          validationOutcome: validationOutcome || 'UNKNOWN',
          forwardingResult: forwardingResult || 'NOT_ATTEMPTED',
          recordedAt: new Date().toISOString()
        }
      }
    });

    let recordedRoutingDecisionId = null;

    // Record RoutingDecision and RoutingOutcome if provided
    if (decisionPayload && typeof decisionPayload === 'object') {
      const routingDecision = await prisma.routingDecision.create({
        data: {
          tenantId,
          targetApplicationId: applicationId || null,
          intendedAction: decisionPayload.intendedAction || 'NORMAL_ROUTING',
          correlationId,
          decisionStatus: 'DECIDED'
        }
      });
      recordedRoutingDecisionId = routingDecision.id;

      await prisma.routingOutcome.create({
        data: {
          tenantId,
          routingDecisionId: routingDecision.id,
          outcomeStatus: decisionPayload.outcomeStatus || 'FORWARDED_TO_ORIGIN',
          outcomeSource: 'GATEWAY_REVERSE_PROXY',
          failureOrDiscrepancyDetails: decisionPayload.failureDetails || null
        }
      });
    }

    res.status(201).json({
      success: true,
      persistenceStatus: 'TELEMETRY_PERSISTED',
      data: {
        observationId: observation.id,
        observationIdentifier: observation.observationIdentifier,
        routingDecisionId: recordedRoutingDecisionId,
        correlationId
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
 * Health check for the internal gateway communication interface.
 */
export async function getGatewayHealth(req, res) {
  res.status(200).json({
    status: 'UP',
    subsystem: 'gateway-internal-management-interface',
    timestamp: new Date().toISOString()
  });
}
