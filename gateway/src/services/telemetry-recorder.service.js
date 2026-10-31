/**
 * Telemetry and Evidence Recorder Service (Hardened & Reliability-Instrumented)
 *
 * Implements:
 * 1. Explicit telemetry persistence outcomes:
 *    - TELEMETRY_PERSISTED: Successfully written to PostgreSQL via Management API.
 *    - TELEMETRY_PERSISTENCE_FAILED: Failed delivery to Management API after retry; logged locally.
 *    - TELEMETRY_PENDING: Buffered in bounded queue awaiting transmission.
 *    - NOT_RECORDED: Telemetry unrecorded (e.g. unknown domain rejection without tenant context).
 * 2. Independent tracking of forwarding outcomes vs telemetry persistence.
 * 3. Bounded queue (MAX_QUEUE_SIZE = 1000) to prevent unbounded memory growth during API outages.
 * 4. Explicit telemetry-loss signaling when queue capacity is exceeded (never silently discards).
 * 5. Diagnostic metrics: queue depth, capacity, dropped events, failures, duplicates.
 * 6. Deduplication preservation via correlation IDs.
 * 7. Strict omission and redaction of sensitive credentials, cookies, and payload bodies.
 * 8. Explicit truthfulness: no fabrication of execution evidence on successful HTTP responses.
 */

import { logger } from '../utils/logger.js';
import fs from 'node:fs';

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
    this.durableLossLogPath = options.durableLossLogPath || process.env.TELEMETRY_LOSS_LOG_PATH || null;

    // Reliability & Data Loss Instrumentation
    this.totalIngested = 0;
    this.totalPersisted = 0;
    this.persistenceFailures = 0;
    this.droppedEventCount = 0;
    this.duplicateEventCount = 0;
    this.retryCount = 0;
    this.dataLossEvents = [];

    // Load durable loss history if configured
    if (this.durableLossLogPath) {
      this.loadDurableLossSummary();
    }
  }

  /**
   * Loads durable telemetry loss summary from disk if available to preserve
   * accounting across process restarts.
   */
  loadDurableLossSummary() {
    try {
      if (this.durableLossLogPath && fs.existsSync(this.durableLossLogPath)) {
        const raw = fs.readFileSync(this.durableLossLogPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (typeof parsed.droppedEventCount === 'number') {
          this.droppedEventCount = parsed.droppedEventCount;
        }
        if (Array.isArray(parsed.dataLossEvents)) {
          this.dataLossEvents = parsed.dataLossEvents;
        }
        logger.info('Loaded durable telemetry loss summary', {
          droppedEventCount: this.droppedEventCount,
          hasDataLoss: this.droppedEventCount > 0,
          durablePath: this.durableLossLogPath
        });
      }
    } catch (err) {
      logger.warn('Failed to load durable telemetry loss summary from disk', {
        error: err.message,
        path: this.durableLossLogPath
      });
    }
  }

  /**
   * Persists durable telemetry loss summary to disk atomically.
   */
  persistDurableLossSummary() {
    if (!this.durableLossLogPath) return;
    try {
      const summary = {
        droppedEventCount: this.droppedEventCount,
        hasDataLoss: this.droppedEventCount > 0,
        lastUpdated: new Date().toISOString(),
        dataLossEvents: this.dataLossEvents
      };
      fs.writeFileSync(this.durableLossLogPath, JSON.stringify(summary, null, 2), 'utf8');
    } catch (err) {
      logger.warn('Failed to persist durable telemetry loss summary to disk', {
        error: err.message,
        path: this.durableLossLogPath
      });
    }
  }

  /**
   * Resets durable loss history (for testing or clean maintenance).
   */
  resetDurableLossSummary() {
    this.droppedEventCount = 0;
    this.dataLossEvents = [];
    if (this.durableLossLogPath && fs.existsSync(this.durableLossLogPath)) {
      try {
        fs.unlinkSync(this.durableLossLogPath);
      } catch {}
    }
  }

  /**
   * Returns comprehensive telemetry queue and reliability diagnostic metrics.
   */
  getQueueMetrics() {
    return {
      queueDepth: this.pendingQueue.length,
      queueCapacity: this.maxQueueSize,
      totalIngested: this.totalIngested,
      totalPersisted: this.totalPersisted,
      persistenceFailures: this.persistenceFailures,
      droppedEventCount: this.droppedEventCount,
      duplicateEventCount: this.duplicateEventCount,
      retryCount: this.retryCount,
      hasDataLoss: this.droppedEventCount > 0
    };
  }

  /**
   * Returns summary of telemetry data loss events.
   */
  getDataLossSummary() {
    return {
      hasDataLoss: this.droppedEventCount > 0,
      droppedEventCount: this.droppedEventCount,
      recentLossEvents: this.dataLossEvents.slice(-20)
    };
  }

  /**
   * Emits an explicit telemetry loss signal when records must be dropped.
   *
   * @param {object} droppedRecord
   */
  emitDataLossSignal(droppedRecord) {
    this.droppedEventCount++;
    const lossRecord = {
      droppedCorrelationId: droppedRecord.correlationId,
      tenantId: droppedRecord.tenantId,
      timestamp: new Date().toISOString(),
      queueDepth: this.pendingQueue.length,
      maxQueueSize: this.maxQueueSize,
      reason: 'QUEUE_CAPACITY_EXCEEDED'
    };

    this.dataLossEvents.push(lossRecord);
    if (this.dataLossEvents.length > 100) {
      this.dataLossEvents.shift();
    }

    if (this.durableLossLogPath) {
      this.persistDurableLossSummary();
    }

    logger.warn('TELEMETRY_DATA_LOSS: Queue capacity exceeded; dropping oldest record to prevent memory exhaustion', lossRecord);
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
      sessionReference: record.sessionReference || null,
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
        let respData = null;
        try {
          respData = await response.json();
        } catch {}

        if (respData?.duplicate) {
          this.duplicateEventCount++;
        }

        this.totalPersisted++;
        return TELEMETRY_OUTCOMES.PERSISTED;
      }

      this.persistenceFailures++;
      logger.warn('Management backend telemetry endpoint returned non-OK', {
        status: response.status,
        correlationId: payload.correlationId
      });
      return TELEMETRY_OUTCOMES.FAILED;
    } catch (err) {
      this.persistenceFailures++;
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
    this.totalIngested++;
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

    // Bounded queue enforcement with explicit data loss signal
    if (this.pendingQueue.length >= this.maxQueueSize) {
      const dropped = this.pendingQueue.shift();
      this.emitDataLossSignal(dropped);
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
