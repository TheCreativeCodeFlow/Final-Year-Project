/**
 * Runtime Telemetry Service (Stage 5B.3).
 *
 * Implements bounded, tenant-isolated synthetic runtime telemetry collection:
 * - Captures HTTP request metrics, synthetic API calls, auth attempt simulations,
 *   resource consumption samples, and lifecycle observations.
 * - Enforces strict data hygiene: NO real user credentials, tokens, or customer secrets.
 * - Masks and pseudonymizes session references and auth headers.
 * - Implements bounded in-memory ring-buffers with explicit drop accounting.
 * - Bounded storage: fixed capacity per environment (default 500 events).
 * - Telemetry loss is explicitly recorded as TELEMETRY_DATA_LOSS.
 */

import crypto from 'node:crypto';
import { getPrismaClient } from '../db/client.js';

export const TELEMETRY_EVENT_TYPES = {
  HTTP_REQUEST_OBSERVED: 'HTTP_REQUEST_OBSERVED',
  SYNTHETIC_AUTH_ATTEMPT: 'SYNTHETIC_AUTH_ATTEMPT',
  MOCK_API_INTERACTION: 'MOCK_API_INTERACTION',
  RESOURCE_UTILIZATION_SAMPLE: 'RESOURCE_UTILIZATION_SAMPLE',
  HEALTH_PROBE_OBSERVED: 'HEALTH_PROBE_OBSERVED',
  LIFECYCLE_CHANGE: 'LIFECYCLE_CHANGE',
  TELEMETRY_DATA_LOSS: 'TELEMETRY_DATA_LOSS'
};

export const TELEMETRY_QUALITY = {
  NOMINAL: 'NOMINAL',
  DEGRADED: 'DEGRADED',
  CORRUPTED: 'CORRUPTED',
  QUEUE_OVERFLOW: 'QUEUE_OVERFLOW'
};

const SENSITIVE_KEY_REGEX = /^(authorization|cookie|set-cookie|password|token|secret|apiKey|api_key|credential|bearer)$/i;

/**
 * Sanitizes headers and payload dictionaries by redacting sensitive secrets.
 *
 * @param {any} data
 * @returns {any}
 */
export function sanitizeTelemetryPayload(data) {
  if (data === null || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeTelemetryPayload);
  }

  const clean = {};
  for (const [k, v] of Object.entries(data)) {
    if (SENSITIVE_KEY_REGEX.test(k)) {
      clean[k] = '[REDACTED]';
    } else if (typeof v === 'string' && /^(bearer\s+|ey[a-zA-Z0-9_-]{10,})/i.test(v)) {
      clean[k] = '[REDACTED_TOKEN]';
    } else if (k === 'sessionRef' || k === 'sessionId') {
      // Pseudonymize session tokens with one-way hash
      const hash = crypto.createHash('sha256').update(String(v)).digest('hex').slice(0, 8);
      clean[k] = `sess-anon-${hash}`;
    } else if (typeof v === 'object' && v !== null) {
      clean[k] = sanitizeTelemetryPayload(v);
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

export class RuntimeTelemetryService {
  /**
   * @param {Object} [options]
   * @param {number} [options.maxEventsPerEnvironment=500]
   * @param {Object} [options.prismaClient]
   */
  constructor({ maxEventsPerEnvironment = 500, prismaClient = null } = {}) {
    this.maxEventsPerEnvironment = maxEventsPerEnvironment;
    this.prisma = prismaClient;

    // In-memory tenant/environment ring buffers:
    // Map<tenantId:environmentId, { events: Array<Object>, droppedCount: number, stats: Object }>
    this.buffers = new Map();
  }

  getDb() {
    return this.prisma || getPrismaClient();
  }

  _getBufferKey(tenantId, environmentId) {
    return `${tenantId}:${environmentId || 'global'}`;
  }

  _getOrCreateBuffer(tenantId, environmentId) {
    const key = this._getBufferKey(tenantId, environmentId);
    let buf = this.buffers.get(key);
    if (!buf) {
      buf = {
        tenantId,
        environmentId,
        events: [],
        droppedCount: 0,
        lossRecorded: false,
        stats: {
          totalObserved: 0,
          requestCount: 0,
          methods: {},
          paths: {},
          statusCodes: {},
          totalLatencyMs: 0,
          errorCount: 0,
          authAttempts: 0,
          mockApiCalls: 0
        }
      };
      this.buffers.set(key, buf);
    }
    return buf;
  }

  /**
   * Records a synthetic runtime telemetry observation into the bounded buffer.
   *
   * @param {Object} params
   * @param {string} params.tenantId
   * @param {string} params.environmentId
   * @param {string} params.eventType
   * @param {string} [params.sourceComponent='RUNTIME_WORKER']
   * @param {string} [params.correlationId]
   * @param {string} [params.evidenceReference]
   * @param {Object} [params.payload]
   * @param {string} [params.quality='NOMINAL']
   * @returns {Object} The recorded telemetry event
   */
  recordEvent({
    tenantId,
    environmentId,
    eventType = TELEMETRY_EVENT_TYPES.HTTP_REQUEST_OBSERVED,
    sourceComponent = 'RUNTIME_WORKER',
    correlationId = crypto.randomUUID(),
    evidenceReference = null,
    payload = {},
    quality = TELEMETRY_QUALITY.NOMINAL
  }) {
    if (!tenantId) {
      throw new Error('tenantId is required to record runtime telemetry.');
    }

    const buf = this._getOrCreateBuffer(tenantId, environmentId);
    const sanitized = sanitizeTelemetryPayload(payload);

    const event = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      tenantId,
      environmentId: environmentId || null,
      eventType,
      eventSchemaVersion: '1.0.0',
      sourceComponent,
      correlationId,
      evidenceReference,
      telemetryQuality: quality,
      payload: sanitized
    };

    // Update aggregate metrics
    buf.stats.totalObserved++;
    if (eventType === TELEMETRY_EVENT_TYPES.HTTP_REQUEST_OBSERVED) {
      buf.stats.requestCount++;
      const method = sanitized.method || 'GET';
      buf.stats.methods[method] = (buf.stats.methods[method] || 0) + 1;

      const path = sanitized.path || '/';
      buf.stats.paths[path] = (buf.stats.paths[path] || 0) + 1;

      const status = sanitized.statusCode || 200;
      buf.stats.statusCodes[status] = (buf.stats.statusCodes[status] || 0) + 1;

      if (typeof sanitized.latencyMs === 'number') {
        buf.stats.totalLatencyMs += sanitized.latencyMs;
      }
      if (status >= 400) {
        buf.stats.errorCount++;
      }
    } else if (eventType === TELEMETRY_EVENT_TYPES.SYNTHETIC_AUTH_ATTEMPT) {
      buf.stats.authAttempts++;
    } else if (eventType === TELEMETRY_EVENT_TYPES.MOCK_API_INTERACTION) {
      buf.stats.mockApiCalls++;
    }

    // Enforce ring-buffer bounded storage
    if (buf.events.length >= this.maxEventsPerEnvironment) {
      buf.events.shift(); // Drop oldest event
      buf.droppedCount++;
      buf.lossRecorded = true;
    }

    buf.events.push(event);
    return event;
  }

  /**
   * Explicitly records an event describing telemetry loss / queue overflow.
   *
   * @param {Object} params
   * @param {string} params.tenantId
   * @param {string} params.environmentId
   * @param {number} params.count
   * @param {string} [params.reason='QUEUE_CAPACITY_EXCEEDED']
   */
  recordTelemetryLoss({ tenantId, environmentId, count = 1, reason = 'QUEUE_CAPACITY_EXCEEDED' }) {
    const buf = this._getOrCreateBuffer(tenantId, environmentId);
    buf.droppedCount += count;
    buf.lossRecorded = true;

    return this.recordEvent({
      tenantId,
      environmentId,
      eventType: TELEMETRY_EVENT_TYPES.TELEMETRY_DATA_LOSS,
      sourceComponent: 'TELEMETRY_BUFFER',
      quality: TELEMETRY_QUALITY.QUEUE_OVERFLOW,
      payload: {
        droppedCount: count,
        totalDropped: buf.droppedCount,
        reason,
        notice: 'TELEMETRY_DATA_LOSS: Capacity exceeded. Bounded buffer dropped oldest events to protect memory.'
      }
    });
  }

  /**
   * Retrieves summary telemetry statistics for an environment or entire tenant.
   *
   * @param {Object} params
   * @param {string} params.tenantId
   * @param {string} [params.environmentId]
   * @returns {Object}
   */
  getTelemetrySummary({ tenantId, environmentId = null }) {
    if (!tenantId) {
      throw new Error('tenantId is required to retrieve telemetry summary.');
    }

    if (environmentId) {
      const buf = this.buffers.get(this._getBufferKey(tenantId, environmentId));
      if (!buf) {
        return {
          tenantId,
          environmentId,
          totalObserved: 0,
          requestCount: 0,
          methods: {},
          paths: {},
          statusCodes: {},
          avgLatencyMs: 0,
          errorCount: 0,
          authAttempts: 0,
          mockApiCalls: 0,
          droppedCount: 0,
          telemetryQuality: TELEMETRY_QUALITY.NOMINAL
        };
      }

      const avgLatency =
        buf.stats.requestCount > 0
          ? Math.round((buf.stats.totalLatencyMs / buf.stats.requestCount) * 100) / 100
          : 0;

      return {
        tenantId,
        environmentId,
        totalObserved: buf.stats.totalObserved,
        requestCount: buf.stats.requestCount,
        methods: buf.stats.methods,
        paths: buf.stats.paths,
        statusCodes: buf.stats.statusCodes,
        avgLatencyMs: avgLatency,
        errorCount: buf.stats.errorCount,
        authAttempts: buf.stats.authAttempts,
        mockApiCalls: buf.stats.mockApiCalls,
        droppedCount: buf.droppedCount,
        telemetryQuality: buf.droppedCount > 0 ? TELEMETRY_QUALITY.QUEUE_OVERFLOW : TELEMETRY_QUALITY.NOMINAL
      };
    }

    // Aggregate across all environments of the tenant
    let totalObserved = 0;
    let requestCount = 0;
    const methods = {};
    const paths = {};
    const statusCodes = {};
    let totalLatency = 0;
    let errorCount = 0;
    let authAttempts = 0;
    let mockApiCalls = 0;
    let droppedCount = 0;

    for (const [key, b] of this.buffers.entries()) {
      if (b.tenantId === tenantId) {
        totalObserved += b.stats.totalObserved;
        requestCount += b.stats.requestCount;
        totalLatency += b.stats.totalLatencyMs;
        errorCount += b.stats.errorCount;
        authAttempts += b.stats.authAttempts;
        mockApiCalls += b.stats.mockApiCalls;
        droppedCount += b.droppedCount;

        for (const [m, count] of Object.entries(b.stats.methods)) {
          methods[m] = (methods[m] || 0) + count;
        }
        for (const [p, count] of Object.entries(b.stats.paths)) {
          paths[p] = (paths[p] || 0) + count;
        }
        for (const [s, count] of Object.entries(b.stats.statusCodes)) {
          statusCodes[s] = (statusCodes[s] || 0) + count;
        }
      }
    }

    const avgLatency =
      requestCount > 0 ? Math.round((totalLatency / requestCount) * 100) / 100 : 0;

    return {
      tenantId,
      totalObserved,
      requestCount,
      methods,
      paths,
      statusCodes,
      avgLatencyMs: avgLatency,
      errorCount,
      authAttempts,
      mockApiCalls,
      droppedCount,
      telemetryQuality: droppedCount > 0 ? TELEMETRY_QUALITY.QUEUE_OVERFLOW : TELEMETRY_QUALITY.NOMINAL
    };
  }

  /**
   * Retrieves paginated telemetry events for an environment.
   *
   * @param {Object} params
   * @param {string} params.tenantId
   * @param {string} params.environmentId
   * @param {number} [params.limit=50]
   * @param {number} [params.offset=0]
   * @param {string} [params.eventType]
   * @returns {Object}
   */
  getTelemetryEvents({
    tenantId,
    environmentId,
    limit = 50,
    offset = 0,
    eventType = null
  }) {
    if (!tenantId || !environmentId) {
      throw new Error('tenantId and environmentId are required to query telemetry events.');
    }

    const buf = this.buffers.get(this._getBufferKey(tenantId, environmentId));
    if (!buf) {
      return {
        tenantId,
        environmentId,
        total: 0,
        limit,
        offset,
        events: []
      };
    }

    let filtered = buf.events;
    if (eventType) {
      filtered = filtered.filter((e) => e.eventType === eventType);
    }

    const paginated = filtered.slice(offset, offset + limit);

    return {
      tenantId,
      environmentId,
      total: filtered.length,
      limit,
      offset,
      droppedCount: buf.droppedCount,
      telemetryQuality: buf.droppedCount > 0 ? TELEMETRY_QUALITY.QUEUE_OVERFLOW : TELEMETRY_QUALITY.NOMINAL,
      events: paginated
    };
  }

  /**
   * Clears in-memory buffers (primarily used in test teardown).
   */
  clear() {
    this.buffers.clear();
  }
}

// Global default singleton instance for shared usage
export const defaultRuntimeTelemetry = new RuntimeTelemetryService();
export default RuntimeTelemetryService;
