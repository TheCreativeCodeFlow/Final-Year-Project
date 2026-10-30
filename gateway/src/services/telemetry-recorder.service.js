/**
 * Telemetry and Evidence Recorder Service.
 *
 * Implements:
 * 1. Capture of the 8 distinct lifecycle stages.
 * 2. Strict omission and redaction of sensitive credentials, cookies, and payload bodies.
 * 3. Asynchronous transmission to the backend management API.
 * 4. Local operational structured audit on delivery failure (non-blocking).
 */

import { logger } from '../utils/logger.js';

export class TelemetryRecorderService {
  /**
   * @param {object} options
   * @param {string} options.managementApiUrl
   * @param {string} options.gatewayInternalToken
   * @param {Function} [options.fetchImpl]
   */
  constructor(options = {}) {
    this.managementApiUrl = options.managementApiUrl;
    this.gatewayInternalToken = options.gatewayInternalToken;
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
  }

  /**
   * Dispatches a structured telemetry record to the management API.
   *
   * @param {object} record
   * @param {string} record.correlationId
   * @param {string} [record.tenantId]
   * @param {string} [record.applicationId]
   * @param {string} record.method
   * @param {string} record.normalizedRoute
   * @param {number} record.responseStatus
   * @param {number} record.durationMs
   * @param {number} [record.requestSizeBytes=0]
   * @param {number} [record.responseSizeBytes=0]
   * @param {string} [record.clientIp]
   * @param {string} record.validationOutcome
   * @param {string} record.forwardingResult
   * @param {object} [record.routingDecision]
   * @returns {Promise<void>}
   */
  async recordTelemetry(record) {
    const payload = {
      tenantId: record.tenantId || null,
      applicationId: record.applicationId || null,
      correlationId: record.correlationId,
      method: record.method,
      normalizedRoute: record.normalizedRoute,
      responseStatus: record.responseStatus,
      durationMs: record.durationMs,
      requestSizeBytes: record.requestSizeBytes || 0,
      responseSizeBytes: record.responseSizeBytes || 0,
      clientIp: record.clientIp || 'UNKNOWN',
      validationOutcome: record.validationOutcome,
      forwardingResult: record.forwardingResult,
      routingDecision: record.routingDecision || null,
      timestamp: new Date().toISOString()
    };

    // If no tenantId is available (e.g. unknown domain rejection before app resolution),
    // log structured record locally without attempting DB persistence requiring a tenant.
    if (!payload.tenantId) {
      logger.info('Gateway telemetry (unresolved tenant, logged locally)', {
        correlationId: payload.correlationId,
        validationOutcome: payload.validationOutcome,
        responseStatus: payload.responseStatus
      });
      return;
    }

    try {
      const url = `${this.managementApiUrl}/internal/gateway/telemetry`;
      const response = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Gateway-Service-Token': this.gatewayInternalToken,
          'X-Correlation-ID': record.correlationId
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(3000)
      });

      if (!response.ok) {
        logger.warn('Failed to persist gateway telemetry to management backend', {
          status: response.status,
          correlationId: record.correlationId
        });
      }
    } catch (err) {
      logger.warn('Management backend telemetry endpoint unreachable', {
        correlationId: record.correlationId,
        error: err.message
      });
    }
  }
}
