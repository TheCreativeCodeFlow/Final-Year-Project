/**
 * Stage 4B: Telemetry Reliability and Data Loss Test Suite
 *
 * Verifies:
 * 1. Bounded queue overflow prevents memory exhaustion during backend outages.
 * 2. Explicit telemetry loss signal is emitted when records are dropped (never silently discarded).
 * 3. Diagnostic reliability metrics (depth, capacity, dropped events, persistence failures, duplicates).
 * 4. Ingestion deduplication by correlation ID.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { TelemetryRecorderService, TELEMETRY_OUTCOMES } from '../../gateway/src/services/telemetry-recorder.service.js';

describe('Stage 4B: Telemetry Reliability and Data Loss Tracking', () => {
  test('1. Bounded queue drops oldest events and emits explicit data loss signal on capacity breach', async () => {
    const failingService = new TelemetryRecorderService({
      managementApiUrl: 'http://127.0.0.1:59997/api/v1',
      gatewayInternalToken: 'secret-token',
      maxQueueSize: 3,
      fetchImpl: async () => {
        throw new Error('Connection refused');
      }
    });

    for (let i = 1; i <= 6; i++) {
      await failingService.recordTelemetry({
        correlationId: `corr-loss-${i}`,
        tenantId: 'tenant-apex',
        applicationId: 'app-01',
        method: 'GET',
        responseStatus: 200
      });
    }

    const metrics = failingService.getQueueMetrics();
    assert.equal(metrics.queueDepth, 3, 'Queue depth must not exceed max capacity of 3');
    assert.equal(metrics.queueCapacity, 3);
    assert.equal(metrics.droppedEventCount, 3, 'Must track exactly 3 dropped events');
    assert.equal(metrics.hasDataLoss, true);

    const lossSummary = failingService.getDataLossSummary();
    assert.equal(lossSummary.hasDataLoss, true);
    assert.equal(lossSummary.droppedEventCount, 3);
    assert.ok(lossSummary.recentLossEvents.length >= 3);
    assert.equal(lossSummary.recentLossEvents[0].reason, 'QUEUE_CAPACITY_EXCEEDED');
  });

  test('2. Successful transmission updates totalPersisted and reports zero data loss', async () => {
    const successfulService = new TelemetryRecorderService({
      managementApiUrl: 'http://127.0.0.1:4000/api/v1',
      gatewayInternalToken: 'secret-token',
      maxQueueSize: 100,
      fetchImpl: async () => ({
        ok: true,
        status: 201,
        json: async () => ({ success: true })
      })
    });

    const res = await successfulService.recordTelemetry({
      correlationId: 'corr-ok-01',
      tenantId: 'tenant-apex',
      applicationId: 'app-01',
      method: 'GET',
      responseStatus: 200
    });

    assert.equal(res.persistenceStatus, TELEMETRY_OUTCOMES.PERSISTED);
    const metrics = successfulService.getQueueMetrics();
    assert.equal(metrics.totalPersisted, 1);
    assert.equal(metrics.droppedEventCount, 0);
    assert.equal(metrics.hasDataLoss, false);
  });

  test('3. Deduplicated acknowledgment increments duplicateEventCount', async () => {
    const dedupService = new TelemetryRecorderService({
      managementApiUrl: 'http://127.0.0.1:4000/api/v1',
      gatewayInternalToken: 'secret-token',
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => ({ success: true, duplicate: true })
      })
    });

    await dedupService.recordTelemetry({
      correlationId: 'corr-dup-01',
      tenantId: 'tenant-apex',
      applicationId: 'app-01',
      method: 'GET',
      responseStatus: 200
    });

    const metrics = dedupService.getQueueMetrics();
    assert.equal(metrics.duplicateEventCount, 1);
  });

  test('4. Durable loss summary survives simulated process restarts via persistent log', async () => {
    const testLogPath = './test-telemetry-loss.json';

    // Instance 1: drops 2 records
    const service1 = new TelemetryRecorderService({
      managementApiUrl: 'http://127.0.0.1:59997/api/v1',
      gatewayInternalToken: 'secret-token',
      maxQueueSize: 2,
      durableLossLogPath: testLogPath,
      fetchImpl: async () => {
        throw new Error('Down');
      }
    });

    for (let i = 1; i <= 4; i++) {
      await service1.recordTelemetry({
        correlationId: `corr-restart-${i}`,
        tenantId: 'tenant-apex',
        applicationId: 'app-01',
        method: 'GET',
        responseStatus: 200
      });
    }

    assert.equal(service1.getQueueMetrics().droppedEventCount, 2);

    // Instance 2 (Simulated Process Restart): reads from same testLogPath
    const service2 = new TelemetryRecorderService({
      managementApiUrl: 'http://127.0.0.1:59997/api/v1',
      gatewayInternalToken: 'secret-token',
      maxQueueSize: 2,
      durableLossLogPath: testLogPath,
      fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ success: true }) })
    });

    const metricsRestart = service2.getQueueMetrics();
    assert.equal(metricsRestart.droppedEventCount, 2, 'Restarted service must recover historical droppedEventCount');
    assert.equal(metricsRestart.hasDataLoss, true, 'hasDataLoss must remain true after restart');

    // Clean up test file
    service2.resetDurableLossSummary();
  });
});
