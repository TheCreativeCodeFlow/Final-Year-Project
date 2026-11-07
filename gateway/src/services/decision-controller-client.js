/**
 * Decision Controller Interface Client (Stage 5B.5).
 *
 * Defines the contract between the Gateway runtime and the Unified Gateway Decision Controller.
 * Supports:
 * - Direct in-process controller service invocation.
 * - Authenticated remote HTTP query with service token.
 * - Comprehensive routing outcomes (NORMAL_FORWARD, SHADOW_DECEPTION, CONTROLLED_LAB, etc.).
 * - Fail-closed semantics when controller is unavailable.
 * - Explicit prevention of silent fallback to the real origin if deception is selected.
 */

import { logger } from '../utils/logger.js';

export class DecisionControllerClient {
  /**
   * @param {object} [options]
   * @param {string} [options.controllerUrl]
   * @param {object} [options.controllerService] - Direct in-process GatewayDecisionControllerService instance
   * @param {boolean} [options.requireController=false] - Whether controller is strictly required
   * @param {string} [options.gatewayInternalToken]
   * @param {Function} [options.fetchImpl]
   */
  constructor(options = {}) {
    this.controllerUrl = options.controllerUrl || null;
    this.controllerService = options.controllerService || null;
    this.requireController = Boolean(options.requireController);
    this.gatewayInternalToken = options.gatewayInternalToken || process.env.GATEWAY_INTERNAL_TOKEN || null;
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
  }

  /**
   * Evaluates the routing decision for a validated request.
   *
   * @param {object} params
   * @param {string} params.correlationId
   * @param {object} params.appContext
   * @param {string} params.method
   * @param {string} params.path
   * @param {string} params.clientIp
   * @param {object} [params.headers={}]
   * @param {string} [params.routingMode]
   * @returns {Promise<{
   *   action: 'NORMAL_ROUTING' | 'BLOCK' | 'PROPOSE_DECEPTION' | 'FAIL_CLOSED',
   *   routingOutcome: string,
   *   routingMode: string,
   *   targetDestination?: string,
   *   hypotheticalDestination?: string,
   *   environmentId?: string,
   *   hypotheticalEnvironmentId?: string,
   *   reason: string,
   *   policyId?: string,
   *   decisionRecordId?: string,
   *   safetyChecks?: object
   * }>}
   */
  async evaluateDecision(params) {
    const { correlationId, appContext, method, path, clientIp, headers = {}, routingMode } = params;

    // 1. Direct In-Process Controller Service (if provided)
    if (this.controllerService && typeof this.controllerService.evaluateGatewayRequest === 'function') {
      try {
        const decision = await this.controllerService.evaluateGatewayRequest({
          correlationId,
          appContext,
          method,
          path,
          domain: appContext.domain,
          clientIp,
          headers,
          routingMode
        });
        return decision;
      } catch (svcErr) {
        logger.error('In-process decision controller error', { correlationId, error: svcErr.message });
        return {
          action: 'FAIL_CLOSED',
          routingOutcome: 'BLOCK_REQUEST',
          routingMode: routingMode || 'SHADOW',
          reason: `Decision controller failure: ${svcErr.message}`
        };
      }
    }

    // 2. Remote HTTP Decision Controller Service (if URL configured)
    if (this.controllerUrl) {
      try {
        const evalUrl = this.controllerUrl.endsWith('/evaluate') || this.controllerUrl.endsWith('/evaluate-decision')
          ? this.controllerUrl
          : `${this.controllerUrl}/evaluate`;

        const requestHeaders = {
          'Content-Type': 'application/json',
          'X-Correlation-ID': correlationId
        };
        if (this.gatewayInternalToken) {
          requestHeaders['X-Gateway-Service-Token'] = this.gatewayInternalToken;
        }

        const response = await this.fetchImpl(evalUrl, {
          method: 'POST',
          headers: requestHeaders,
          body: JSON.stringify({
            correlationId,
            tenantId: appContext.tenantId,
            applicationId: appContext.applicationId,
            appContext,
            domain: appContext.domain,
            method,
            path,
            clientIp,
            headers,
            routingMode
          }),
          signal: AbortSignal.timeout(2500)
        });

        if (!response.ok) {
          logger.warn('Decision controller returned non-OK; failing closed', {
            status: response.status,
            correlationId
          });
          return {
            action: 'FAIL_CLOSED',
            routingOutcome: 'BLOCK_REQUEST',
            routingMode: routingMode || 'SHADOW',
            reason: `Decision controller returned status ${response.status}. Indeterminate classification.`
          };
        }

        const data = await response.json();
        const payload = data.data || data;
        const action = payload.action;

        // Safety Rule: If deception is requested but target environment is invalid or missing,
        // NEVER fall back to the real origin!
        if (action === 'PROPOSE_DECEPTION') {
          if (!payload.targetDestination) {
            logger.error('CRITICAL SAFETY VIOLATION PREVENTED: Deception target missing. Refusing fallback to real origin.', {
              correlationId,
              action
            });
            return {
              action: 'FAIL_CLOSED',
              routingOutcome: 'RUNTIME_UNAVAILABLE',
              routingMode: payload.routingMode || 'SHADOW',
              reason: 'Deception destination unavailable. Fallback to real protected origin prohibited.'
            };
          }
        }

        return {
          action: action || 'NORMAL_ROUTING',
          routingOutcome: payload.routingOutcome || (action === 'BLOCK' ? 'BLOCK_REQUEST' : 'NORMAL_FORWARD'),
          routingMode: payload.routingMode || 'SHADOW',
          targetDestination: payload.targetDestination,
          hypotheticalDestination: payload.hypotheticalDestination,
          environmentId: payload.environmentId,
          hypotheticalEnvironmentId: payload.hypotheticalEnvironmentId,
          reason: payload.reason || 'Decision controller evaluated routing.',
          policyId: payload.policyId,
          decisionRecordId: payload.decisionRecordId,
          safetyChecks: payload.safetyChecks
        };
      } catch (err) {
        logger.error('Decision controller unreachable; failing closed', {
          correlationId,
          error: err.message
        });

        // Fail-closed rule: Do not assume benign or malicious
        return {
          action: 'FAIL_CLOSED',
          routingOutcome: 'BLOCK_REQUEST',
          routingMode: routingMode || 'SHADOW',
          reason: 'Decision controller unavailable. Failing closed per safety policy.'
        };
      }
    }

    // 3. Fallback when no controller is configured
    if (this.requireController) {
      return {
        action: 'FAIL_CLOSED',
        routingOutcome: 'BLOCK_REQUEST',
        routingMode: 'OBSERVE_ONLY',
        reason: 'Decision controller is required but not configured.'
      };
    }

    return {
      action: 'NORMAL_ROUTING',
      routingOutcome: 'NORMAL_FORWARD',
      routingMode: 'OBSERVE_ONLY',
      targetDestination: appContext.upstreamUrl,
      reason: 'No decision controller configured; defaulting to origin forwarding.'
    };
  }
}
