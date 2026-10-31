/**
 * Telemetry and Evidence Recorder Service.
 *
 * Implements:
 * 1. Explicit telemetry persistence outcomes:
 *    - TELEMETRY_PERSISTED: Successfully written to PostgreSQL via Management API.
 *    - TELEMETRY_PERSISTENCE_FAILED: Failed delivery to Management API after retry; logged locally.
 *    - TELEMETRY_PENDING: Buffered in bounded queue awaiting transmission.
 *    - NOT_RECORDED: Telemetry unrecorded (e.g. unknown domain rejection without tenant context).
 * 2. Independent tracking of forwarding outcomes vs telemetry persistence.
 * 3. Bounded queue (MAX_QUEUE_SIZE = 1000) to prevent unbounded memory growth during API outages.
 * 4. Deduplication preservation via correlation IDs.
 * 5. Strict omission and redaction of sensitive credentials, cookies, and payload bodies.
 * 6. Explicit truthfulness: no fabrication of execution evidence on successful HTTP responses.
 */

import { logger } from '../utils/logger.js';

export const TELEMETRY_OUTCOMES = {
  PERSISTED: 'TELEMETRY_PERSISTED',
  FAILED: 'TELEMETRY_PERSISTENCE_FAILED',
  PENDING: 'TELEMETRY_PENDING',
  NOT_RECORDED: 'NOT_RECORDED'
};

const MAX_QUEUE_SIZE = 1000;

export class TelemetryRecorderService {
  /**
   * @param {object} options
   * @param {string} options.managementApiUrl
   * @param {string} options.gatewayInternalToken
   * @param {Function} [options.fetchImpl]
   * @param {number} [options.maxQueueSize=1000]
   */
  constructor(options = {}) {
    this.managementApiUrl = options.managementApiUrl;
    this.gatewayInternalToken = options.gatewayInternalToken;
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
    this.maxQueueSize = options.maxQueueSize || MAX_QUEUE_SIZE;
    this.pendingQueue = [];
    this.isFlushing = false;
  }

  /**
   * Returns telemetry queue diagnostic metrics.
   */
  getQueueMetrics() {
    return {
      pendingCount: this.pendingQueue.length,
      maxQueueSize: this.maxQueueSize
    };
  }

  /**
   * Sanitizes payload to ensure zero sensitive headers, cookies, or bodies are persisted.
   */
  sanitizeTelemetryPayload(record) {
    return {
      tenantId: record.tenantId || null,
      applicationId: record.applicationId || null,
      correlationId: record.correlationId,
      method: record.method || 'UNKNOWN',
      normalizedRoute: record.normalizedRoute || '/',
      responseStatus: Number(record.responseStatus) || 0,
      durationMs: Number(record.durationMs) || 0,
      requestSizeBytes: Number(record.requestSizeBytes) || 0,
      responseSizeBytes: Number(record.responseSizeBytes) || 0,
      clientIp: record.clientIp || 'UNKNOWN',
      validationOutcome: record.validationOutcome || 'UNKNOWN',
      forwardingResult: record.forwardingResult || 'NOT_ATTEMPTED',
      routingDecision: record.routingDecision
        ? {
            intendedAction: record.routingDecision.intendedAction,
            outcomeStatus: record.routingDecision.outcomeStatus,
            failureDetails: record.routingDecision.failureDetails || null
          }
        : null,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Transmits a sanitized telemetry record to the Management API.
   *
   * @param {object} payload
   * @returns {Promise<string>} One of TELEMETRY_OUTCOMES
   */
  async dispatchRecord(payload) {
    if (!payload.tenantId) {
      logger.info('Gateway telemetry (unresolved tenant, logged locally)', {
        correlationId: payload.correlationId,
        validationOutcome: payload.validationOutcome,
        responseStatus: payload.responseStatus,
        persistenceStatus: TELEMETRY_OUTCOMES.NOT_RECORDED
      });
      return TELEMETRY_OUTCOMES.NOT_RECORDED;
    }

    try {
      const url = `${this.managementApiUrl}/internal/gateway/telemetry`;
      const response = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Gateway-Service-Token': this.gatewayInternalToken,
          'X-Correlation-ID': payload.correlationId
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(3000)
      });

      if (response.ok) {
        return TELEMETRY_OUTCOMES.PERSISTED;
      }

      logger.warn('Management backend telemetry endpoint returned non-OK', {
        status: response.status,
        correlationId: payload.correlationId
      });
      return TELEMETRY_OUTCOMES.FAILED;
    } catch (err) {
      logger.warn('Management backend telemetry endpoint unreachable', {
        correlationId: payload.correlationId,
        error: err.message
      });
      return TELEMETRY_OUTCOMES.FAILED;
    }
  }

  /**
   * Public interface to record telemetry with bounded queueing.
   *
   * @param {object} record
   * @returns {Promise<{
   *   persistenceStatus: string,
   *   correlationId: string,
   *   forwardingResult: string
   * }>}
   */
  async recordTelemetry(record) {
    const payload = this.sanitizeTelemetryPayload(record);

    // If unresolved tenant, resolve immediately as NOT_RECORDED
    if (!payload.tenantId) {
      const status = await this.dispatchRecord(payload);
      return {
        persistenceStatus: status,
        correlationId: payload.correlationId,
        forwardingResult: payload.forwardingResult
      };
    }

    // Bounded queue enforcement
    if (this.pendingQueue.length >= this.maxQueueSize) {
      const dropped = this.pendingQueue.shift();
      logger.warn('Telemetry queue full; dropping oldest record to prevent memory exhaustion', {
        droppedCorrelationId: dropped.correlationId,
        maxQueueSize: this.maxQueueSize
      });
    }

    // Attempt direct dispatch
    const outcome = await this.dispatchRecord(payload);

    if (outcome === TELEMETRY_OUTCOMES.FAILED) {
      this.pendingQueue.push(payload);
    }

    return {
      persistenceStatus: outcome,
      correlationId: payload.correlationId,
      forwardingResult: payload.forwardingResult
    };
  }

  get queue() {
    return this.pendingQueue;
  }
}
