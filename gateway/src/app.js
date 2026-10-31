/**
 * Gateway Runtime Express Application.
 *
 * Assembles:
 * 1. Request ID generation and propagation.
 * 2. Operational health endpoints (/health/live, /health/ready).
 * 3. Request validation and HTTP method allowlist enforcement.
 * 4. Application and tenant resolution.
 * 5. Decision controller interface gating.
 * 6. Secure upstream proxying.
 * 7. 8-stage telemetry and evidence collection.
 */

import express from 'express';
import crypto from 'node:crypto';
import { gatewayConfig as defaultGatewayConfig } from './config/env.js';
import { logger } from './utils/logger.js';
import { validateGatewayRequest } from './middleware/request-validator.js';
import { ApplicationResolverService } from './services/app-resolver.service.js';
import { DecisionControllerClient } from './services/decision-controller-client.js';
import { TelemetryRecorderService } from './services/telemetry-recorder.service.js';
import { proxyRequest } from './proxy/reverse-proxy.js';

export function createGatewayApp(options = {}) {
  const config = options.config || defaultGatewayConfig;
  const app = express();

  // 1. Disable technology fingerprinting
  app.disable('x-powered-by');

  // Initialize Services
  const appResolver =
    options.appResolver ||
    new ApplicationResolverService({
      trustedOriginMap: config.TRUSTED_ORIGIN_MAP,
      managementApiUrl: config.MANAGEMENT_API_URL,
      gatewayInternalToken: config.GATEWAY_INTERNAL_TOKEN,
      fetchImpl: options.fetchImpl
    });

  const decisionController =
    options.decisionController ||
    new DecisionControllerClient({
      controllerUrl: config.DECISION_CONTROLLER_URL,
      requireController: options.requireDecisionController || false,
      fetchImpl: options.fetchImpl
    });

  const telemetryRecorder =
    options.telemetryRecorder ||
    new TelemetryRecorderService({
      managementApiUrl: config.MANAGEMENT_API_URL,
      gatewayInternalToken: config.GATEWAY_INTERNAL_TOKEN,
      fetchImpl: options.fetchImpl
    });

  // 2. Request ID & Correlation Middleware
  app.use((req, res, next) => {
    const incomingId = req.headers['x-request-id'] || req.headers['x-correlation-id'];
    // Validate UUID format if provided, otherwise generate fresh cryptographic UUID
    const isValidUuid =
      typeof incomingId === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(incomingId.trim());

    req.id = isValidUuid ? incomingId.trim() : crypto.randomUUID();
    res.setHeader('X-Request-ID', req.id);
    next();
  });

  // 3. Operational Health Check Routes (Directly served by Gateway; not proxied)
  app.get('/health/live', (req, res) => {
    res.status(200).json({
      status: 'UP',
      subsystem: 'gateway-runtime',
      mode: 'reverse-proxy-foundation',
      timestamp: new Date().toISOString()
    });
  });

  app.get('/health/ready', (req, res) => {
    res.status(200).json({
      status: 'READY',
      configuredOrigins: Object.keys(config.TRUSTED_ORIGIN_MAP),
      timestamp: new Date().toISOString()
    });
  });

  // 4. Ingress Request Validation
  app.use(validateGatewayRequest);

  // 5. Main Gateway Reverse Proxy Handler
  app.use(async (req, res) => {
    const startTime = process.hrtime.bigint();
    const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const method = req.method;
    const rawPath = req.url;

    // Stage 1: REQUEST_OBSERVED
    logger.debug('Ingress HTTP request observed', {
      requestId: req.id,
      method,
      host: req.headers.host,
      clientIp
    });

    // Stage 2: REQUEST_VALIDATED -> Resolve Application and Tenant
    const resolution = await appResolver.resolveApplication(req.headers.host, req.id);

    if (!resolution.resolved) {
      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1e6;

      // Fail-closed rejection response
      res.status(resolution.statusCode || 400).json({
        success: false,
        error: {
          code: resolution.errorCode || 'ROUTING_REJECTED',
          message: resolution.message || 'Routing rejected by gateway.'
        },
        requestId: req.id
      });

      // Record telemetry for rejected request
      telemetryRecorder.recordTelemetry({
        correlationId: req.id,
        method,
        normalizedRoute: rawPath,
        responseStatus: resolution.statusCode || 400,
        durationMs,
        clientIp,
        validationOutcome: resolution.errorCode || 'REJECTED',
        forwardingResult: 'NOT_ATTEMPTED'
      });

      return;
    }

    const { appContext } = resolution;

    // Stage 3 & 4: SECURITY_ASSESSMENT & POLICY_EVALUATION -> Decision Controller
    const decision = await decisionController.evaluateDecision({
      correlationId: req.id,
      appContext,
      method,
      path: rawPath,
      clientIp
    });

    // Stage 5: ROUTING_DECISION_MADE
    if (decision.action === 'FAIL_CLOSED' || decision.action === 'BLOCK') {
      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1e6;

      const blockStatus = decision.action === 'BLOCK' ? 403 : 503;
      res.status(blockStatus).json({
        success: false,
        error: {
          code: decision.action === 'BLOCK' ? 'REQUEST_BLOCKED' : 'SECURITY_CONTROL_UNAVAILABLE',
          message: decision.reason
        },
        requestId: req.id
      });

      telemetryRecorder.recordTelemetry({
        tenantId: appContext.tenantId,
        applicationId: appContext.applicationId,
        correlationId: req.id,
        method,
        normalizedRoute: rawPath,
        responseStatus: blockStatus,
        durationMs,
        clientIp,
        validationOutcome: 'VALIDATED',
        forwardingResult: decision.action === 'BLOCK' ? 'BLOCKED_BY_POLICY' : 'FAIL_CLOSED',
        routingDecision: {
          intendedAction: decision.action,
          outcomeStatus: decision.action === 'BLOCK' ? 'BLOCKED_AT_INGRESS' : 'FAIL_CLOSED_REJECTION',
          failureDetails: { reason: decision.reason }
        }
      });

      return;
    }

    // Stage 6: UPSTREAM_FORWARDING_ATTEMPTED
    const targetOrigin = decision.targetDestination || appContext.upstreamUrl;

    const proxyOutcome = await proxyRequest({
      req,
      res,
      upstreamBaseUrl: targetOrigin,
      validatedHost: appContext.domain,
      requestId: req.id,
      timeoutMs: appContext.timeoutMs,
      options: options.proxyOptions || { dnsResolver: options.dnsResolver }
    });

    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1e6;

    // Stage 7 & 8: ROUTING_OUTCOME_RECORDED & TELEMETRY
    telemetryRecorder.recordTelemetry({
      tenantId: appContext.tenantId,
      applicationId: appContext.applicationId,
      correlationId: req.id,
      method,
      normalizedRoute: rawPath,
      responseStatus: proxyOutcome.statusCode,
      durationMs,
      requestSizeBytes: proxyOutcome.requestSizeBytes,
      responseSizeBytes: proxyOutcome.responseSizeBytes,
      clientIp,
      validationOutcome: 'VALIDATED',
      forwardingResult: proxyOutcome.forwardingResult,
      routingDecision: {
        intendedAction: decision.action,
        outcomeStatus:
          proxyOutcome.forwardingResult === 'SUCCESS'
            ? 'FORWARDED_TO_ORIGIN'
            : proxyOutcome.forwardingResult === 'TIMEOUT'
              ? 'FAILED_UPSTREAM_TIMEOUT'
              : 'FAILED_UPSTREAM_CONNECTION',
        failureDetails: proxyOutcome.errorDetails ? { error: proxyOutcome.errorDetails } : null
      }
    });
  });

  return app;
}

export const gatewayApp = createGatewayApp();
