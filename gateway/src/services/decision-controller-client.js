/**
 * Decision Controller Interface Client.
 *
 * Defines the contract between the Gateway runtime and the AI Decision Controller.
 * In Stage 4A (Isolated Reverse Proxy Foundation):
 * - Evaluates baseline eligibility for upstream forwarding.
 * - Enforces fail-closed semantics when controller is unavailable.
 * - Explicitly prevents silent fallback to the real origin if deception is selected but unavailable.
 */

import { logger } from '../utils/logger.js';

export class DecisionControllerClient {
  /**
   * @param {object} [options]
   * @param {string} [options.controllerUrl]
   * @param {boolean} [options.requireController=false] - Whether controller is strictly required
   * @param {Function} [options.fetchImpl]
   */
  constructor(options = {}) {
    this.controllerUrl = options.controllerUrl || null;
    this.requireController = Boolean(options.requireController);
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
   * @returns {Promise<{
   *   action: 'NORMAL_ROUTING' | 'BLOCK' | 'PROPOSE_DECEPTION' | 'FAIL_CLOSED',
   *   targetDestination?: string,
   *   reason: string,
   *   policyId?: string
   * }>}
   */
  async evaluateDecision(params) {
    const { correlationId, appContext, method, path, clientIp } = params;

    // If an external decision controller URL is configured, query it
    if (this.controllerUrl) {
      try {
        const response = await this.fetchImpl(`${this.controllerUrl}/evaluate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Correlation-ID': correlationId
          },
          body: JSON.stringify({
            correlationId,
            tenantId: appContext.tenantId,
            applicationId: appContext.applicationId,
            method,
            path,
            clientIp
          }),
          signal: AbortSignal.timeout(2000)
        });

        if (!response.ok) {
          logger.warn('Decision controller returned non-OK; failing closed', {
            status: response.status,
            correlationId
          });
          return {
            action: 'FAIL_CLOSED',
            reason: `Decision controller returned status ${response.status}. Indeterminate classification.`
          };
        }

        const data = await response.json();
        const action = data.action;

        // Safety Rule: If deception is requested but target environment is invalid or missing,
        // NEVER fall back to the real origin!
        if (action === 'PROPOSE_DECEPTION') {
          if (!data.targetDestination) {
            logger.error('CRITICAL SAFETY VIOLATION PREVENTED: Deception target missing. Refusing fallback to real origin.', {
              correlationId,
              action
            });
            return {
              action: 'FAIL_CLOSED',
              reason: 'Deception destination unavailable. Fallback to real protected origin prohibited.'
            };
          }
        }

        return {
          action: action || 'NORMAL_ROUTING',
          targetDestination: data.targetDestination,
          reason: data.reason || 'Decision controller evaluated routing.',
          policyId: data.policyId
        };
      } catch (err) {
        logger.error('Decision controller unreachable; failing closed', {
          correlationId,
          error: err.message
        });

        // Fail-closed rule: Do not assume benign or malicious
        return {
          action: 'FAIL_CLOSED',
          reason: 'Decision controller unavailable. Failing closed per safety policy.'
        };
      }
    }

    // Baseline Stage 4A operation (without dynamic ML controller)
    if (this.requireController) {
      return {
        action: 'FAIL_CLOSED',
        reason: 'Decision controller is required but not configured.'
      };
    }

    return {
      action: 'NORMAL_ROUTING',
      targetDestination: appContext.upstreamUrl,
      reason: 'Stage 4A baseline: Validated application forwarded to trusted upstream.'
    };
  }
}
