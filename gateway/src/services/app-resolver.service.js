/**
 * Application and Tenant Resolver Service.
 *
 * Implements:
 * 1. Strict Host header syntax validation.
 * 2. Server-side trusted origin lookup (no client-supplied destination selection).
 * 3. Management API application verification via internal service token.
 * 4. Cross-tenant isolation verification.
 * 5. Fail-closed behavior on unknown hosts, unregistered apps, or backend unavailability.
 */

import { logger } from '../utils/logger.js';

const HOSTNAME_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;

export class ApplicationResolverService {
  /**
   * @param {object} options
   * @param {Record<string, object>} options.trustedOriginMap
   * @param {string} options.managementApiUrl
   * @param {string} options.gatewayInternalToken
   * @param {Function} [options.fetchImpl] - Optional fetch override for testing
   */
  constructor(options = {}) {
    this.trustedOriginMap = options.trustedOriginMap || {};
    this.managementApiUrl = options.managementApiUrl;
    this.gatewayInternalToken = options.gatewayInternalToken;
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
  }

  /**
   * Validates and cleans the Host header string.
   * @param {string} rawHost
   * @returns {{ valid: boolean, hostClean?: string, error?: string }}
   */
  validateHostHeader(rawHost) {
    if (!rawHost || typeof rawHost !== 'string') {
      return { valid: false, error: 'Missing or empty Host header.' };
    }

    const trimmed = rawHost.trim().toLowerCase();

    // Reject dangerous characters
    if (trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes('@') || trimmed.includes('\0') || trimmed.includes(' ')) {
      return { valid: false, error: 'Host header contains invalid characters.' };
    }

    // Strip port if present for hostname verification
    const hostWithoutPort = trimmed.split(':')[0];

    if (!HOSTNAME_REGEX.test(hostWithoutPort)) {
      return { valid: false, error: `Host header "${rawHost}" fails syntax validation.` };
    }

    return { valid: true, hostClean: hostWithoutPort };
  }

  /**
   * Synchronous resolution helper against local trusted origin map for rapid rejection telemetry.
   *
   * @param {string} rawHost
   * @returns {{ tenantId: string, applicationId?: string, upstreamUrl?: string } | null}
   */
  resolveTrustedOriginLocal(rawHost) {
    const val = this.validateHostHeader(rawHost);
    if (!val.valid) return null;
    return this.trustedOriginMap[val.hostClean] || null;
  }

  /**
   * Resolves a request's Host to a verified protected application and trusted upstream origin.
   *
   * @param {string} rawHost
   * @param {string} correlationId
   * @returns {Promise<{
   *   resolved: boolean,
   *   statusCode?: number,
   *   errorCode?: string,
   *   message?: string,
   *   appContext?: {
   *     applicationId: string,
   *     applicationIdentifier: string,
   *     name: string,
   *     domain: string,
   *     tenantId: string,
   *     tenantIdentifier: string,
   *     status: string,
   *     upstreamUrl: string,
   *     allowedMethods: string[],
   *     timeoutMs: number,
   *     maxBodyBytes: number
   *   }
   * }>}
   */
  async resolveApplication(rawHost, correlationId) {
    // 1. Host syntax validation
    const hostCheck = this.validateHostHeader(rawHost);
    if (!hostCheck.valid) {
      return {
        resolved: false,
        statusCode: 400,
        errorCode: 'INVALID_HOST_HEADER',
        message: hostCheck.error
      };
    }

    const domain = hostCheck.hostClean;

    // 2. Server-side trusted origin configuration check
    const trustedConfig = this.trustedOriginMap[domain];
    if (!trustedConfig) {
      logger.warn('Request rejected: Host not present in trusted origin configuration', {
        host: domain,
        correlationId
      });
      return {
        resolved: false,
        statusCode: 404,
        errorCode: 'UNKNOWN_HOST',
        message: `Domain "${domain}" is not configured in gateway trusted origin map.`
      };
    }

    // 3. Verify with Management API (PostgreSQL domain model)
    try {
      const verifyUrl = `${this.managementApiUrl}/internal/gateway/resolve-application?domain=${encodeURIComponent(domain)}`;
      const response = await this.fetchImpl(verifyUrl, {
        method: 'GET',
        headers: {
          'X-Gateway-Service-Token': this.gatewayInternalToken,
          'X-Correlation-ID': correlationId,
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(3000)
      });

      if (response.status === 404) {
        return {
          resolved: false,
          statusCode: 404,
          errorCode: 'UNREGISTERED_APPLICATION',
          message: `Application for domain "${domain}" is not registered in management database.`
        };
      }

      if (response.status === 403) {
        const errorBody = await response.json().catch(() => ({}));
        return {
          resolved: false,
          statusCode: 403,
          errorCode: 'TENANT_INACTIVE',
          message: errorBody.error?.message || `Tenant for domain "${domain}" is inactive. Routing denied.`
        };
      }

      if (!response.ok) {
        logger.error('Management API returned non-OK during application resolution', {
          status: response.status,
          domain,
          correlationId
        });
        return {
          resolved: false,
          statusCode: 502,
          errorCode: 'MANAGEMENT_VERIFICATION_FAILED',
          message: 'Failed to verify application status with management service.'
        };
      }

      const body = await response.json();
      const dbApp = body.data;

      // 4. Verify application is in PROTECTED state
      if (!dbApp.isProtected) {
        return {
          resolved: false,
          statusCode: 403,
          errorCode: 'APPLICATION_NOT_PROTECTED',
          message: `Application "${dbApp.applicationIdentifier}" is currently in ${dbApp.status} status and is not actively protected.`
        };
      }

      // 5. Cross-tenant isolation verification
      if (
        trustedConfig.tenantIdentifier &&
        trustedConfig.tenantIdentifier !== dbApp.tenant.identifier
      ) {
        logger.error('Cross-tenant mapping conflict detected', {
          configuredTenant: trustedConfig.tenantIdentifier,
          databaseTenant: dbApp.tenant.identifier,
          domain,
          correlationId
        });
        return {
          resolved: false,
          statusCode: 403,
          errorCode: 'CROSS_TENANT_CONFLICT',
          message: 'Tenant mapping conflict detected between configuration and database.'
        };
      }

      return {
        resolved: true,
        appContext: {
          applicationId: dbApp.applicationId,
          applicationIdentifier: dbApp.applicationIdentifier,
          name: dbApp.name,
          domain,
          tenantId: dbApp.tenant.id,
          tenantIdentifier: dbApp.tenant.identifier,
          status: dbApp.status,
          upstreamUrl: trustedConfig.upstreamUrl,
          allowedMethods: trustedConfig.allowedMethods || ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
          timeoutMs: trustedConfig.timeoutMs || 5000,
          maxBodyBytes: trustedConfig.maxBodyBytes || 1048576
        }
      };
    } catch (err) {
      logger.error('Management API unreachable during application resolution (failing closed)', {
        domain,
        correlationId,
        error: err.message
      });
      return {
        resolved: false,
        statusCode: 503,
        errorCode: 'MANAGEMENT_SERVICE_UNAVAILABLE',
        message: 'Security validation service is currently unavailable. Failing closed.'
      };
    }
  }
}
