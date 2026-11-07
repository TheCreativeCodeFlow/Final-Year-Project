/**
 * Runtime Lifecycle Reconciliation Service (Stage 5B.3).
 *
 * Reconciles the multi-tiered state of the Adaptive Cyber Deception Gateway by
 * continuously comparing:
 * 1. Database runtime state (Prisma DeceptionRuntimeEnvironment).
 * 2. Worker-reported daemon state (WorkerClient IPC).
 * 3. Docker container state (Docker Engine inspection).
 * 4. Network state (Docker isolated bridge inspection).
 * 5. Recorded execution evidence (Append-linked SHA-256 chain & completeness).
 *
 * Deterministic Reconciliation Outcomes:
 * - CONSISTENT: All 5 layers agree without discrepancies.
 * - DATABASE_RUNTIME_MISMATCH: DB says ACTIVE but container is dead/stopped, or DB says TERMINATED but container runs.
 * - RUNTIME_MISSING: DB says ACTIVE/PROVISIONING but container ID is not found in Docker.
 * - ORPHAN_RUNTIME: Container exists with deception.managed: true but no active DB environment record exists.
 * - RESOURCE_MISMATCH: Live cgroups (memory, CPU, PIDs) differ from approved quotas.
 * - NETWORK_MISMATCH: Target network missing, not marked Internal: true, or bridge disconnected.
 * - EVIDENCE_MISMATCH: Evidence chain broken, tampered, or missing required lifecycle events.
 * - UNKNOWN: Worker daemon is offline or Docker API is unreachable.
 *
 * Safety Invariant:
 * Inconsistent runtimes are NEVER marked as healthy.
 * Missing DB records do NOT trigger silent deletion; discrepancies are recorded for authorized cleanup.
 */

import { getPrismaClient } from '../db/client.js';
import { WorkerClient } from './worker-client.js';
import {
  ExecutionEvidenceRecorder,
  verifyEvidenceCompleteness
} from './execution-evidence-recorder.service.js';
import { RUNTIME_LIFECYCLE_STATES } from './lifecycle-state-machine.js';

export const RECONCILIATION_OUTCOMES = {
  CONSISTENT: 'CONSISTENT',
  DATABASE_RUNTIME_MISMATCH: 'DATABASE_RUNTIME_MISMATCH',
  RUNTIME_MISSING: 'RUNTIME_MISSING',
  ORPHAN_RUNTIME: 'ORPHAN_RUNTIME',
  RESOURCE_MISMATCH: 'RESOURCE_MISMATCH',
  NETWORK_MISMATCH: 'NETWORK_MISMATCH',
  EVIDENCE_MISMATCH: 'EVIDENCE_MISMATCH',
  UNKNOWN: 'UNKNOWN'
};

export class RuntimeReconciliationService {
  /**
   * @param {Object} [dependencies]
   * @param {Object} [dependencies.prismaClient]
   * @param {WorkerClient} [dependencies.workerClient]
   * @param {ExecutionEvidenceRecorder} [dependencies.evidenceRecorder]
   */
  constructor({
    prismaClient = null,
    workerClient = null,
    evidenceRecorder = null
  } = {}) {
    this.prisma = prismaClient;
    this.workerClient = workerClient || new WorkerClient();
    this.evidenceRecorder = evidenceRecorder || new ExecutionEvidenceRecorder(this.prisma);
  }

  getDb() {
    return this.prisma || getPrismaClient();
  }

  /**
   * Reconciles an individual deception environment across DB, Worker, Docker, Network, and Evidence.
   *
   * @param {Object} params
   * @param {string} params.tenantId
   * @param {string} params.environmentId
   * @returns {Promise<Object>}
   */
  async reconcileEnvironment({ tenantId, environmentId }) {
    if (!tenantId || !environmentId) {
      throw new Error('tenantId and environmentId are required for reconciliation.');
    }

    const prisma = this.getDb();
    const env = await prisma.deceptionRuntimeEnvironment.findFirst({
      where: { id: environmentId, tenantId },
      include: {
        authorization: true,
        events: { orderBy: { recordedAt: 'asc' } }
      }
    });

    if (!env) {
      const err = new Error(`Environment "${environmentId}" not found for tenant "${tenantId}".`);
      err.code = 'ENVIRONMENT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    // Check worker connectivity first
    const workerPing = await this.workerClient.getHealth().catch(() => ({ ok: false }));
    if (!workerPing.ok) {
      return {
        environmentId: env.id,
        environmentIdentifier: env.environmentIdentifier,
        reconciliationOutcome: RECONCILIATION_OUTCOMES.UNKNOWN,
        discrepancies: ['Runtime worker daemon is offline or unreachable'],
        timestamp: new Date().toISOString(),
        details: {
          databaseState: env.lifecycleState,
          workerConnected: false
        }
      };
    }

    const discrepancies = [];
    let outcome = RECONCILIATION_OUTCOMES.CONSISTENT;

    // A. Simulated Environment Check (Stage 5B.1 fallback: only when no containerId exists)
    if (!env.containerId) {
      const isTerminal = ['TERMINATED', 'EXPIRED'].includes(env.lifecycleState);
      return {
        environmentId: env.id,
        environmentIdentifier: env.environmentIdentifier,
        reconciliationOutcome: RECONCILIATION_OUTCOMES.CONSISTENT,
        discrepancies: [],
        timestamp: new Date().toISOString(),
        details: {
          isSimulated: true,
          databaseState: env.lifecycleState,
          terminal: isTerminal
        }
      };
    }

    // B. Live Docker Container & Health Inspection
    const liveHealth = await this.workerClient
      .getEnvironmentHealthDetails({ environmentId: env.id, tenantId })
      .catch((err) => ({ ok: false, error: err.message }));

    if (!liveHealth.ok) {
      outcome = RECONCILIATION_OUTCOMES.UNKNOWN;
      discrepancies.push(`Failed to inspect container via worker: ${liveHealth.error}`);
    } else {
      const liveData = liveHealth.data;

      // 1. Missing Container Check
      if (
        !liveData.container &&
        ['ACTIVE', 'PROVISIONING', 'VALIDATING'].includes(env.lifecycleState)
      ) {
        outcome = RECONCILIATION_OUTCOMES.RUNTIME_MISSING;
        discrepancies.push(`Database reports "${env.lifecycleState}" but Docker container "${env.containerId}" does not exist`);
      }

      // 2. Database vs Runtime State Mismatch
      if (liveData.container) {
        const isDbTerminal = ['TERMINATED', 'EXPIRED'].includes(env.lifecycleState);
        if (isDbTerminal && liveData.container.running) {
          outcome = RECONCILIATION_OUTCOMES.DATABASE_RUNTIME_MISMATCH;
          discrepancies.push(`Database reports "${env.lifecycleState}" but container is still RUNNING in Docker (leaked container)`);
        } else if (!isDbTerminal && !liveData.container.running) {
          outcome = RECONCILIATION_OUTCOMES.DATABASE_RUNTIME_MISMATCH;
          discrepancies.push(`Database reports "${env.lifecycleState}" but container is NOT running (Docker state: ${liveData.container.state})`);
        }
      }

      // 3. Resource & Cgroup Limits Mismatch
      if (liveData.container?.running) {
        const expectedMemBytes = env.allocatedMemoryMb * 1024 * 1024;
        const actualMemLimit = liveData.container?.memoryLimitBytes || liveData.stats?.memory?.limitBytes;
        if (actualMemLimit && Math.abs(actualMemLimit - expectedMemBytes) > 1024 * 1024) {
          if (outcome === RECONCILIATION_OUTCOMES.CONSISTENT) {
            outcome = RECONCILIATION_OUTCOMES.RESOURCE_MISMATCH;
          }
          discrepancies.push(`Memory cgroup mismatch: expected ${expectedMemBytes} bytes, got ${actualMemLimit} bytes`);
        }

        const actualPidsLimit = liveData.stats?.pids?.limit;
        if (actualPidsLimit && actualPidsLimit !== 100) {
          if (outcome === RECONCILIATION_OUTCOMES.CONSISTENT) {
            outcome = RECONCILIATION_OUTCOMES.RESOURCE_MISMATCH;
          }
          discrepancies.push(`PIDs limit mismatch: expected 100, got ${actualPidsLimit}`);
        }
      }

      // 4. Network Isolation & Configuration Mismatch
      if (env.networkId) {
        if (!liveData.networkDetails) {
          if (outcome === RECONCILIATION_OUTCOMES.CONSISTENT) {
            outcome = RECONCILIATION_OUTCOMES.NETWORK_MISMATCH;
          }
          discrepancies.push(`Network "${env.networkId}" referenced in database does not exist in Docker engine`);
        } else if (!liveData.networkDetails.internal) {
          if (outcome === RECONCILIATION_OUTCOMES.CONSISTENT) {
            outcome = RECONCILIATION_OUTCOMES.NETWORK_MISMATCH;
          }
          discrepancies.push(`Network "${liveData.networkDetails.name}" is not configured with Internal: true`);
        }
      }

      if (liveData.container?.networkName) {
        if (!liveData.container.networkName.startsWith('dec-net-')) {
          if (outcome === RECONCILIATION_OUTCOMES.CONSISTENT) {
            outcome = RECONCILIATION_OUTCOMES.NETWORK_MISMATCH;
          }
          discrepancies.push(`Insecure network attached: "${liveData.container.networkName}" does not match dec-net- prefix`);
        }
      }
    }

    // C. Evidence Chain Verification & Completeness
    const evidenceReport = await verifyEvidenceCompleteness({
      tenantId,
      environmentId: env.id,
      events: env.events,
      prismaClient: prisma
    });

    if (!evidenceReport.chainValid || evidenceReport.completeness === 'CORRUPTED') {
      if (outcome === RECONCILIATION_OUTCOMES.CONSISTENT) {
        outcome = RECONCILIATION_OUTCOMES.EVIDENCE_MISMATCH;
      }
      discrepancies.push(`Evidence chain integrity broken or corrupted: ${evidenceReport.violations.map((v) => v.type).join(', ')}`);
    } else if (
      ['ACTIVE'].includes(env.lifecycleState) &&
      evidenceReport.completeness === 'INCOMPLETE'
    ) {
      if (outcome === RECONCILIATION_OUTCOMES.CONSISTENT) {
        outcome = RECONCILIATION_OUTCOMES.EVIDENCE_MISMATCH;
      }
      discrepancies.push(`Missing required execution evidence milestones: ${evidenceReport.missingEvents.join(', ')}`);
    }

    return {
      environmentId: env.id,
      environmentIdentifier: env.environmentIdentifier,
      reconciliationOutcome: outcome,
      discrepancies,
      timestamp: new Date().toISOString(),
      details: {
        databaseState: env.lifecycleState,
        containerState: liveHealth.ok ? liveHealth.data?.container?.state || 'missing' : 'unknown',
        containerRunning: liveHealth.ok ? Boolean(liveHealth.data?.container?.running) : null,
        networkName: env.networkName,
        cgroupsMatch: !discrepancies.some((d) => d.includes('cgroup')),
        evidenceChainValid: evidenceReport.chainValid,
        evidenceCompleteness: evidenceReport.completeness,
        missingEvidenceEvents: evidenceReport.missingEvents
      }
    };
  }

  /**
   * Performs a comprehensive tenant-wide reconciliation scan:
   * 1. Reconciles all known DB environments.
   * 2. Scans for orphaned deception containers and networks on Docker.
   *
   * @param {Object} params
   * @param {string} params.tenantId
   * @returns {Promise<Object>}
   */
  async reconcileTenant({ tenantId }) {
    if (!tenantId) {
      throw new Error('tenantId is required for tenant-wide reconciliation.');
    }

    const prisma = this.getDb();
    const environments = await prisma.deceptionRuntimeEnvironment.findMany({
      where: { tenantId },
      select: { id: true, environmentIdentifier: true, containerId: true, networkId: true }
    });

    // 1. Reconcile known environments
    const environmentResults = [];
    for (const env of environments) {
      const res = await this.reconcileEnvironment({ tenantId, environmentId: env.id });
      environmentResults.push(res);
    }

    // 2. Discover Orphan Containers & Networks
    const knownContainerIds = new Set(environments.map((e) => e.containerId).filter(Boolean));
    const knownNetworkIds = new Set(environments.map((e) => e.networkId).filter(Boolean));

    const orphanContainers = [];
    const orphanNetworks = [];

    const snapshot = await this.workerClient.getReconciliationSnapshot({ tenantId }).catch(() => null);
    if (snapshot?.ok && snapshot.data) {
      for (const c of snapshot.data.containers || []) {
        if (!knownContainerIds.has(c.id)) {
          orphanContainers.push({
            containerId: c.id,
            names: c.names,
            state: c.state,
            environmentId: c.environmentId,
            tenantId: c.tenantId,
            reason: 'Container exists on Docker but is not registered in tenant database'
          });
        }
      }

      for (const n of snapshot.data.networks || []) {
        if (!knownNetworkIds.has(n.id)) {
          orphanNetworks.push({
            networkId: n.id,
            name: n.name,
            environmentId: n.environmentId,
            tenantId: n.tenantId,
            reason: 'Isolated bridge network exists on Docker but is not registered in tenant database'
          });
        }
      }
    }

    const hasMismatches =
      environmentResults.some((r) => r.reconciliationOutcome !== RECONCILIATION_OUTCOMES.CONSISTENT) ||
      orphanContainers.length > 0 ||
      orphanNetworks.length > 0;

    return {
      tenantId,
      timestamp: new Date().toISOString(),
      overallStatus: hasMismatches ? 'DISCREPANCIES_DETECTED' : 'CONSISTENT',
      summary: {
        totalEnvironments: environments.length,
        consistentCount: environmentResults.filter((r) => r.reconciliationOutcome === RECONCILIATION_OUTCOMES.CONSISTENT).length,
        mismatchCount: environmentResults.filter((r) => r.reconciliationOutcome !== RECONCILIATION_OUTCOMES.CONSISTENT).length,
        orphanContainersCount: orphanContainers.length,
        orphanNetworksCount: orphanNetworks.length
      },
      environments: environmentResults,
      orphans: {
        containers: orphanContainers,
        networks: orphanNetworks
      }
    };
  }
}

export default RuntimeReconciliationService;
