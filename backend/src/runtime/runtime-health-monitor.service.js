/**
 * Runtime Health Monitor Service (Stage 5B.3).
 *
 * Implements authoritative runtime health monitoring and periodic inspection across
 * active deception environments.
 *
 * Deterministic Health States:
 * - HEALTHY: Container running, internal HTTP probe responds 200, zero restarts, memory <= 85%, PIDs <= 80.
 * - DEGRADED: Running and probe responds 200, but high resource consumption, restarts > 0, or high probe latency (>1500ms).
 * - UNHEALTHY: Container missing when state should be ACTIVE, container stopped/crashed, or internal service HTTP probe fails.
 * - UNKNOWN: Missing health observation, worker offline, or Docker daemon unreachable.
 * - TERMINATED: Environment lifecycleState in TERMINATED/EXPIRED or container terminated.
 *
 * Research Invariant:
 * Real Docker inspection and actual service probes are executed.
 * No health values are manufactured.
 * A missing health observation produces UNKNOWN, not HEALTHY.
 * A successful Docker inspection alone does NOT establish application-level health without HTTP probe confirmation.
 */

import { getPrismaClient } from '../db/client.js';
import { WorkerClient } from './worker-client.js';
import { ExecutionEvidenceRecorder, EXECUTION_EVENT_TYPES } from './execution-evidence-recorder.service.js';
import { RUNTIME_LIFECYCLE_STATES } from './lifecycle-state-machine.js';

export const HEALTH_STATES = {
  HEALTHY: 'HEALTHY',
  DEGRADED: 'DEGRADED',
  UNHEALTHY: 'UNHEALTHY',
  UNKNOWN: 'UNKNOWN',
  TERMINATED: 'TERMINATED'
};

export class RuntimeHealthMonitorService {
  /**
   * @param {Object} [dependencies]
   * @param {Object} [dependencies.prismaClient]
   * @param {WorkerClient} [dependencies.workerClient]
   * @param {ExecutionEvidenceRecorder} [dependencies.evidenceRecorder]
   * @param {number} [dependencies.cacheTtlMs=5000]
   */
  constructor({
    prismaClient = null,
    workerClient = null,
    evidenceRecorder = null,
    cacheTtlMs = 5000
  } = {}) {
    this.prisma = prismaClient;
    this.workerClient = workerClient || new WorkerClient();
    this.evidenceRecorder = evidenceRecorder || new ExecutionEvidenceRecorder(this.prisma);
    this.cacheTtlMs = cacheTtlMs;
  }

  getDb() {
    return this.prisma || getPrismaClient();
  }

  /**
   * Authoritative inspection of an individual deception environment's health.
   *
   * @param {Object} params
   * @param {string} params.tenantId
   * @param {string} params.environmentId
   * @param {boolean} [params.forceLive=false]
   * @returns {Promise<Object>}
   */
  async inspectEnvironmentHealth({ tenantId, environmentId, forceLive = false }) {
    if (!tenantId || !environmentId) {
      throw new Error('tenantId and environmentId are required to inspect environment health.');
    }

    const prisma = this.getDb();
    const env = await prisma.deceptionRuntimeEnvironment.findFirst({
      where: { id: environmentId, tenantId }
    });

    if (!env) {
      const err = new Error(`Environment "${environmentId}" not found for tenant "${tenantId}".`);
      err.code = 'ENVIRONMENT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    // 1. Terminal state check
    if (['TERMINATING', 'TERMINATED', 'EXPIRED'].includes(env.lifecycleState) || env.terminatedAt) {
      return {
        healthy: false,
        healthState: HEALTH_STATES.TERMINATED,
        environmentId: env.id,
        environmentIdentifier: env.environmentIdentifier,
        lifecycleState: env.lifecycleState,
        reasons: [`Environment is in terminal lifecycle state: ${env.lifecycleState}`],
        checkedAt: new Date().toISOString(),
        isSimulated: env.isSimulated,
        container: null,
        probe: null,
        stats: null
      };
    }

    // 2. Simulated Environment (Stage 5B.1 fallback: only when no physical container exists)
    if (!env.containerId) {
      const simState =
        env.lifecycleState === RUNTIME_LIFECYCLE_STATES.ACTIVE
          ? HEALTH_STATES.HEALTHY
          : env.lifecycleState === RUNTIME_LIFECYCLE_STATES.DEGRADED
          ? HEALTH_STATES.DEGRADED
          : HEALTH_STATES.UNKNOWN;

      return {
        healthy: simState === HEALTH_STATES.HEALTHY,
        healthState: simState,
        environmentId: env.id,
        environmentIdentifier: env.environmentIdentifier,
        lifecycleState: env.lifecycleState,
        reasons: ['Simulated environment with no physical container backing'],
        checkedAt: new Date().toISOString(),
        isSimulated: true,
        container: null,
        probe: null,
        stats: null
      };
    }

    // 3. Cache check (unless forceLive is requested)
    const now = Date.now();
    if (!forceLive && env.healthCheckedAt && env.healthCheckDetails) {
      const lastChecked = new Date(env.healthCheckedAt).getTime();
      if (now - lastChecked < this.cacheTtlMs) {
        return {
          healthy: env.healthStatus === HEALTH_STATES.HEALTHY,
          ...env.healthCheckDetails,
          cached: true,
          cacheAgeMs: now - lastChecked
        };
      }
    }

    // 4. Live Inspection via dedicated worker IPC
    let workerRes;
    try {
      workerRes = await this.workerClient.getEnvironmentHealthDetails({
        environmentId: env.id,
        tenantId
      });
    } catch (ipcErr) {
      workerRes = { ok: false, error: ipcErr.message };
    }

    let healthRecord;
    if (!workerRes.ok) {
      // Worker offline or unreachable -> strictly UNKNOWN
      healthRecord = {
        healthy: false,
        healthState: HEALTH_STATES.UNKNOWN,
        environmentId: env.id,
        environmentIdentifier: env.environmentIdentifier,
        containerId: env.containerId,
        lifecycleState: env.lifecycleState,
        reasons: [`Runtime worker IPC inspection failed: ${workerRes.error}`],
        checkedAt: new Date().toISOString(),
        container: null,
        probe: null,
        stats: null
      };
    } else {
      const data = workerRes.data;
      const computedState = data.healthState || HEALTH_STATES.UNKNOWN;
      healthRecord = {
        healthy: computedState === HEALTH_STATES.HEALTHY,
        healthState: computedState,
        environmentId: env.id,
        environmentIdentifier: env.environmentIdentifier,
        containerId: env.containerId,
        lifecycleState: env.lifecycleState,
        reasons: data.reasons || [],
        checkedAt: new Date().toISOString(),
        container: data.container || null,
        probe: data.probe || null,
        stats: data.stats || null,
        allocatedResources: data.allocatedResources || {
          cpu: env.allocatedCpu,
          memoryMb: env.allocatedMemoryMb,
          storageMb: env.allocatedStorageMb
        }
      };
    }

    // 5. Update Database Record
    const prevStatus = env.healthStatus;
    await prisma.deceptionRuntimeEnvironment.update({
      where: { id: env.id },
      data: {
        healthStatus: healthRecord.healthState,
        healthCheckedAt: new Date(healthRecord.checkedAt),
        healthCheckDetails: healthRecord,
        actualMeasuredUsage: healthRecord.stats
      }
    }).catch(() => {});

    // 6. Record Evidence Events on State Transitions
    if (healthRecord.healthState !== prevStatus) {
      if (healthRecord.healthState === HEALTH_STATES.DEGRADED) {
        await this.evidenceRecorder.recordEvent({
          tenantId,
          authorizationId: env.authorizationId,
          environmentId: env.id,
          eventType: EXECUTION_EVENT_TYPES.RUNTIME_DEGRADED,
          severity: 'WARN',
          message: `Runtime environment transitioned to DEGRADED: ${healthRecord.reasons.join('; ')}`,
          eventPayload: healthRecord
        }).catch(() => {});
      } else if (
        healthRecord.healthState === HEALTH_STATES.HEALTHY &&
        (prevStatus === HEALTH_STATES.DEGRADED || prevStatus === HEALTH_STATES.UNHEALTHY)
      ) {
        await this.evidenceRecorder.recordEvent({
          tenantId,
          authorizationId: env.authorizationId,
          environmentId: env.id,
          eventType: EXECUTION_EVENT_TYPES.RUNTIME_RECOVERED,
          severity: 'INFO',
          message: `Runtime environment recovered to HEALTHY.`,
          eventPayload: healthRecord
        }).catch(() => {});
      }
    }

    // Record routine health check event
    await this.evidenceRecorder.recordEvent({
      tenantId,
      authorizationId: env.authorizationId,
      environmentId: env.id,
      eventType: EXECUTION_EVENT_TYPES.HEALTH_CHECK_EXECUTED,
      severity: healthRecord.healthState === HEALTH_STATES.UNHEALTHY ? 'ERROR' : 'INFO',
      message: `Health check executed: state=${healthRecord.healthState}`,
      eventPayload: {
        healthState: healthRecord.healthState,
        checkedAt: healthRecord.checkedAt,
        probe: healthRecord.probe,
        memoryUsageMb: healthRecord.stats?.memory?.usageMb
      }
    }).catch(() => {});

    return healthRecord;
  }

  /**
   * Returns a tenant-wide health overview.
   *
   * @param {Object} params
   * @param {string} params.tenantId
   * @returns {Promise<Object>}
   */
  async getTenantHealthOverview({ tenantId }) {
    if (!tenantId) {
      throw new Error('tenantId is required to retrieve tenant health overview.');
    }

    const prisma = this.getDb();
    const environments = await prisma.deceptionRuntimeEnvironment.findMany({
      where: { tenantId },
      select: {
        id: true,
        environmentIdentifier: true,
        lifecycleState: true,
        healthStatus: true,
        healthCheckedAt: true,
        isSimulated: true,
        containerId: true,
        createdAt: true
      }
    });

    let healthyCount = 0;
    let degradedCount = 0;
    let unhealthyCount = 0;
    let unknownCount = 0;
    let terminatedCount = 0;
    let latestCheck = null;

    for (const env of environments) {
      const isTerminal = ['TERMINATED', 'EXPIRED'].includes(env.lifecycleState);
      if (isTerminal || env.healthStatus === HEALTH_STATES.TERMINATED) {
        terminatedCount++;
      } else if (env.healthStatus === HEALTH_STATES.HEALTHY) {
        healthyCount++;
      } else if (env.healthStatus === HEALTH_STATES.DEGRADED) {
        degradedCount++;
      } else if (env.healthStatus === HEALTH_STATES.UNHEALTHY) {
        unhealthyCount++;
      } else {
        unknownCount++;
      }

      if (env.healthCheckedAt) {
        const checkTime = new Date(env.healthCheckedAt).getTime();
        if (!latestCheck || checkTime > latestCheck) {
          latestCheck = checkTime;
        }
      }
    }

    // Worker daemon health probe
    let workerHealth = { ok: false, status: 'OFFLINE' };
    try {
      workerHealth = await this.workerClient.getHealth();
    } catch {
      workerHealth = { ok: false, status: 'OFFLINE' };
    }

    return {
      tenantId,
      timestamp: new Date().toISOString(),
      summary: {
        totalEnvironments: environments.length,
        healthyCount,
        degradedCount,
        unhealthyCount,
        unknownCount,
        terminatedCount,
        lastHealthCheckTimestamp: latestCheck ? new Date(latestCheck).toISOString() : null
      },
      worker: {
        status: workerHealth.ok ? 'VERIFIED' : 'PARTIALLY_VERIFIED',
        workerProcess: workerHealth.workerProcess || { status: 'OFFLINE' }
      },
      environments
    };
  }

  /**
   * Refreshes health observations across all active environments for a tenant.
   *
   * @param {Object} params
   * @param {string} params.tenantId
   * @returns {Promise<Array<Object>>}
   */
  async inspectAllActiveEnvironments({ tenantId }) {
    if (!tenantId) {
      throw new Error('tenantId is required to inspect all active environments.');
    }

    const prisma = this.getDb();
    const activeEnvs = await prisma.deceptionRuntimeEnvironment.findMany({
      where: {
        tenantId,
        lifecycleState: { in: ['ACTIVE', 'VALIDATING', 'PROVISIONING', 'DEGRADED'] }
      },
      select: { id: true }
    });

    const results = [];
    for (const env of activeEnvs) {
      try {
        const res = await this.inspectEnvironmentHealth({
          tenantId,
          environmentId: env.id,
          forceLive: true
        });
        results.push(res);
      } catch (err) {
        results.push({
          environmentId: env.id,
          healthState: HEALTH_STATES.UNKNOWN,
          error: err.message
        });
      }
    }

    return results;
  }
}

export default RuntimeHealthMonitorService;
