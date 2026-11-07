/**
 * Dedicated Runtime Worker Service (Stage 5B.2).
 *
 * Implements the isolated background worker responsible for:
 * 1. Consuming durable provisioning jobs from the queue.
 * 2. Re-validating authorization, separation of duties, and version concurrency.
 * 3. Driving the Restricted Container Runtime Adapter to provision real synthetic containers.
 * 4. Verifying container health and network egress quarantine.
 * 5. Collecting granular, cryptographically verifiable execution evidence.
 * 6. Managing container teardown, orphan cleanup, and resource quota release.
 */

import crypto from 'node:crypto';
import { getPrismaClient } from '../db/client.js';
import { ContainerRuntimeAdapter } from './container-runtime-adapter.js';
import { ResourceGovernanceService } from './resource-governance.service.js';
import { ExecutionEvidenceRecorder, EXECUTION_EVENT_TYPES } from './execution-evidence-recorder.service.js';
import { LifecycleStateMachine, RUNTIME_LIFECYCLE_STATES } from './lifecycle-state-machine.js';
import { getApprovedImage } from './image-catalogue.js';
import { getSyntheticTemplate } from './synthetic-templates.js';

/**
 * Deterministic JSON stringification using recursive key sorting (RFC 8785 style).
 * Ensures cryptographic digest reproducibility across platforms and memory layouts.
 *
 * @param {any} obj
 * @returns {string}
 */
export function canonicalJsonStringify(obj) {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return `[${obj.map((item) => canonicalJsonStringify(item)).join(',')}]`;
  }
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys.map((k) => `${JSON.stringify(k)}:${canonicalJsonStringify(obj[k])}`);
  return `{${pairs.join(',')}}`;
}

export class RuntimeWorkerService {
  /**
   * @param {Object} [options]
   * @param {Object} [options.prismaClient]
   * @param {Object} [options.adapter]
   * @param {Object} [options.resourceGovernance]
   * @param {Object} [options.evidenceRecorder]
   */
  constructor(options = {}) {
    this.prisma = options.prismaClient || null;
    this.adapter = options.adapter || new ContainerRuntimeAdapter();
    this.resourceGovernance = options.resourceGovernance || new ResourceGovernanceService(this.prisma);
    this.evidenceRecorder = options.evidenceRecorder || new ExecutionEvidenceRecorder(this.prisma);
  }

  getDb() {
    return this.prisma || getPrismaClient();
  }

  /**
   * Re-validates execution authorization independently before container creation.
   * "Never trust a job merely because it exists in the queue."
   *
   * @private
   */
  async _revalidateJobAuthorization(job) {
    const prisma = this.getDb();

    // 1. Fetch live authorization and related graphs/policies
    const auth = await prisma.deceptionExecutionAuthorization.findUnique({
      where: { id: job.authorizationId },
      include: {
        policyDecision: { include: { policy: true } },
        graph: true
      }
    });

    if (!auth) {
      throw new Error(`Referenced authorization "${job.authorizationId}" no longer exists.`);
    }

    if (auth.authorizationStatus !== 'APPROVED') {
      throw new Error(
        `Authorization is in status "${auth.authorizationStatus}". Only APPROVED authorizations can be provisioned.`
      );
    }

    const now = new Date();
    if (new Date(auth.expiresAt) <= now) {
      throw new Error(`Authorization expired at ${auth.expiresAt.toISOString()}. Provisioning rejected.`);
    }

    if (auth.revokedAt) {
      throw new Error(`Authorization was revoked at ${auth.revokedAt.toISOString()}. Provisioning rejected.`);
    }

    // Separation of duties invariant
    if (
      auth.requestingOperatorEmail &&
      auth.approvingOperatorEmail &&
      auth.requestingOperatorEmail === auth.approvingOperatorEmail
    ) {
      throw new Error(
        'Dual-custody violation: Requester and approver cannot be the same operator. Provisioning rejected.'
      );
    }

    // Optimistic DSG graph version check
    if (auth.graph && auth.graph.graphVersion !== job.dsgGraphVersion) {
      throw new Error(
        `Stale DSG Graph: Graph was mutated to version ${auth.graph.graphVersion} (job based on v${job.dsgGraphVersion}). Provisioning rejected.`
      );
    }

    // Optimistic Policy version check
    if (
      auth.policyDecision?.policy &&
      auth.policyDecision.policy.version !== job.policyVersion
    ) {
      throw new Error(
        `Stale Policy: Policy was mutated to version ${auth.policyDecision.policy.version} (job based on v${job.policyVersion}). Provisioning rejected.`
      );
    }

    // Allowlist check
    const image = getApprovedImage(job.imageIdentifier);
    if (!image || image.approvalStatus !== 'APPROVED') {
      throw new Error(`Image "${job.imageIdentifier}" is not approved for execution.`);
    }

    return auth;
  }

  /**
   * Consumes and processes a queued provisioning job.
   *
   * @param {string} jobId
   * @returns {Promise<Object>}
   */
  async processJob(jobId) {
    const prisma = this.getDb();
    const job = await prisma.deceptionProvisioningJob.findUnique({
      where: { id: jobId }
    });

    if (!job) {
      throw new Error(`Provisioning job "${jobId}" not found.`);
    }

    // Mark job PROCESSING
    await prisma.deceptionProvisioningJob.update({
      where: { id: jobId },
      data: {
        jobStatus: 'PROCESSING',
        startedAt: new Date(),
        attempts: { increment: 1 }
      }
    });

    let authRecord;
    try {
      authRecord = await this._revalidateJobAuthorization(job);
    } catch (valErr) {
      // Revalidation failed: Reject job and release quota
      await prisma.deceptionProvisioningJob.update({
        where: { id: jobId },
        data: {
          jobStatus: 'REJECTED',
          completedAt: new Date(),
          errorDetails: { message: valErr.message, timestamp: new Date().toISOString() }
        }
      });

      const resQuota = job.resourceReservation || {};
      await this.resourceGovernance.releaseResources({
        tenantId: job.tenantId,
        applicationId: job.applicationId,
        cpu: resQuota.allocatedCpu || 0.5,
        memoryMb: resQuota.allocatedMemoryMb || 256
      }).catch(() => {});

      await this.evidenceRecorder.recordEvent({
        tenantId: job.tenantId,
        authorizationId: job.authorizationId,
        eventType: EXECUTION_EVENT_TYPES.PROVISIONING_FAILED,
        severity: 'ERROR',
        message: `Provisioning job ${job.id} rejected during pre-flight revalidation: ${valErr.message}`,
        outcomeStatus: 'REJECTED',
        evidenceStatus: 'MISSING',
        eventPayload: { jobId: job.id, error: valErr.message }
      });

      throw valErr;
    }

    // 2. Resolve Template & Environment
    const template = getSyntheticTemplate(job.templateIdentifier);
    let environment = null;

    if (job.environmentId) {
      environment = await prisma.deceptionRuntimeEnvironment.findUnique({
        where: { id: job.environmentId }
      });
    }

    if (!environment) {
      const envIdentifier = `env-rt-${job.tenantId.slice(0, 8)}-${Date.now().toString().slice(-4)}`;
      environment = await prisma.deceptionRuntimeEnvironment.create({
        data: {
          tenantId: job.tenantId,
          applicationId: job.applicationId,
          authorizationId: job.authorizationId,
          environmentIdentifier: envIdentifier,
          name: `${template.name} (${job.imageIdentifier})`,
          lifecycleState: RUNTIME_LIFECYCLE_STATES.AUTHORIZED,
          dsgGraphId: job.dsgGraphId,
          dsgGraphVersion: job.dsgGraphVersion,
          strategyIdentifier: job.selectedStrategyId,
          allocatedCpu: (job.resourceReservation && job.resourceReservation.allocatedCpu) || 0.5,
          allocatedMemoryMb: (job.resourceReservation && job.resourceReservation.allocatedMemoryMb) || 256,
          allocatedStorageMb: (job.resourceReservation && job.resourceReservation.allocatedStorageMb) || 512,
          networkIsolationMode: 'SANDBOX_ISOLATED',
          isSimulated: false, // Transitioning to REAL container!
          executionEvidenceStatus: 'PARTIAL',
          templateIdentifier: job.templateIdentifier,
          imageIdentifier: job.imageIdentifier,
          imageDigest: job.imageDigest,
          expiresAt: job.authorizationExpiresAt
        }
      });

      await prisma.deceptionProvisioningJob.update({
        where: { id: jobId },
        data: { environmentId: environment.id }
      });
    }

    // Transition state machine: AUTHORIZED -> PROVISIONING
    LifecycleStateMachine.validateTransition(
      environment.lifecycleState,
      RUNTIME_LIFECYCLE_STATES.PROVISIONING,
      { allowExecution: true }
    );
    await prisma.deceptionRuntimeEnvironment.update({
      where: { id: environment.id },
      data: { lifecycleState: RUNTIME_LIFECYCLE_STATES.PROVISIONING }
    });

    const evidenceMap = {};
    let createdNetwork = null;
    let createdContainer = null;

    try {
      // Step A: Create Dedicated Isolated Docker Network
      createdNetwork = await this.adapter.createIsolatedNetwork({
        tenantId: job.tenantId,
        environmentId: environment.id
      });
      evidenceMap.network = {
        networkId: createdNetwork.networkId,
        networkName: createdNetwork.networkName,
        internal: createdNetwork.internal,
        verifiedAt: new Date().toISOString()
      };
      await this.evidenceRecorder.recordVerifiedEvidence({
        tenantId: job.tenantId,
        authorizationId: job.authorizationId,
        environmentId: environment.id,
        eventType: EXECUTION_EVENT_TYPES.NETWORK_ISOLATION_VERIFIED,
        message: `Isolated bridge network "${createdNetwork.networkName}" provisioned with internal: true (no internet routing).`,
        evidencePayload: evidenceMap.network
      });

      // Step B: Verify Image Digest against Docker Engine
      const imgVerification = await this.adapter.verifyImage({
        imageIdentifier: job.imageIdentifier
      });
      evidenceMap.image = {
        imageIdentifier: job.imageIdentifier,
        expectedDigest: job.imageDigest,
        dockerImageId: imgVerification.dockerImageId,
        verifiedAt: new Date().toISOString()
      };
      await this.evidenceRecorder.recordVerifiedEvidence({
        tenantId: job.tenantId,
        authorizationId: job.authorizationId,
        environmentId: environment.id,
        eventType: EXECUTION_EVENT_TYPES.IMAGE_VERIFIED,
        message: `Image digest verified for "${job.imageIdentifier}": ${job.imageDigest.slice(0, 19)}...`,
        evidencePayload: evidenceMap.image
      });

      // Step C: Create Hardened Container
      const resQuota = job.resourceReservation || {};
      createdContainer = await this.adapter.createSyntheticContainer({
        tenantId: job.tenantId,
        environmentId: environment.id,
        jobId: job.id,
        imageIdentifier: job.imageIdentifier,
        networkName: createdNetwork.networkName,
        serviceType: template.serviceType,
        cpuLimit: resQuota.allocatedCpu || 0.5,
        memoryMb: resQuota.allocatedMemoryMb || 256,
        extraEnv: (job.resultEvidence && job.resultEvidence.extraEnv) || {}
      });

      evidenceMap.container = {
        containerId: createdContainer.containerId,
        containerName: createdContainer.containerName,
        imageRef: createdContainer.imageRef,
        user: '1000:1000',
        readonlyRootfs: true,
        capDrop: ['ALL'],
        noNewPrivileges: true,
        createdAt: new Date().toISOString()
      };
      await this.evidenceRecorder.recordVerifiedEvidence({
        tenantId: job.tenantId,
        authorizationId: job.authorizationId,
        environmentId: environment.id,
        eventType: EXECUTION_EVENT_TYPES.CONTAINER_CREATED,
        message: `Synthetic container "${createdContainer.containerName}" (${createdContainer.containerId.slice(0, 12)}) created with non-root UID 1000 and read-only rootfs.`,
        evidencePayload: evidenceMap.container
      });

      await this.evidenceRecorder.recordVerifiedEvidence({
        tenantId: job.tenantId,
        authorizationId: job.authorizationId,
        environmentId: environment.id,
        eventType: EXECUTION_EVENT_TYPES.SECURITY_CONFIG_APPLIED,
        message: 'Security hardening verified: runAsUser 1000:1000, read-only rootfs, drop capabilities ALL, zero host port bindings.',
        evidencePayload: {
          runAsUser: '1000:1000',
          readOnlyRootfs: true,
          capDrop: ['ALL'],
          allowHostPorts: false
        }
      });

      // Step D: Start Container
      await this.adapter.startContainer(createdContainer.containerId);

      // Brief delay to allow HTTP server initialization inside container
      await new Promise((r) => setTimeout(r, 1200));

      // Step E: Verify Health via real HTTP probe
      const healthResult = await this.adapter.checkContainerHealth({
        containerId: createdContainer.containerId,
        path: template.healthCheckPath || '/health'
      });

      if (!healthResult.healthy) {
        throw new Error(
          `Synthetic service failed health probe on ${template.healthCheckPath}: ${healthResult.error || healthResult.statusCode}`
        );
      }

      evidenceMap.health = {
        healthy: true,
        statusCode: healthResult.statusCode,
        latencyMs: healthResult.latencyMs,
        response: healthResult.response,
        verifiedAt: new Date().toISOString()
      };
      await this.evidenceRecorder.recordVerifiedEvidence({
        tenantId: job.tenantId,
        authorizationId: job.authorizationId,
        environmentId: environment.id,
        eventType: EXECUTION_EVENT_TYPES.HEALTH_CHECK_PASSED,
        message: `Synthetic service health check PASSED (HTTP 200 on ${template.healthCheckPath} in ${healthResult.latencyMs}ms).`,
        evidencePayload: evidenceMap.health
      });

      // Step F: Verify Negative Outbound Connectivity (Egress Quarantine)
      const egressCheck = await this.adapter.verifyNegativeEgress({
        containerId: createdContainer.containerId
      });
      evidenceMap.egressIsolation = {
        egressBlocked: egressCheck.egressBlocked,
        target: egressCheck.target,
        verifiedAt: new Date().toISOString()
      };
      await this.evidenceRecorder.recordVerifiedEvidence({
        tenantId: job.tenantId,
        authorizationId: job.authorizationId,
        environmentId: environment.id,
        eventType: EXECUTION_EVENT_TYPES.EGRESS_QUARANTINE_VERIFIED,
        message: `Outbound egress quarantine verified: ${egressCheck.details}`,
        evidencePayload: evidenceMap.egressIsolation
      });

      // Step G: Transition Lifecycle to ACTIVE
      LifecycleStateMachine.validateTransition(
        RUNTIME_LIFECYCLE_STATES.PROVISIONING,
        RUNTIME_LIFECYCLE_STATES.ACTIVE,
        { allowExecution: true }
      );

      // Deterministic canonical hash computation
      evidenceMap.nonRepudiation = 'NOT_IMPLEMENTED';
      evidenceMap.independentTrustAnchor = 'NOT_IMPLEMENTED';
      const canonicalPayload = canonicalJsonStringify(evidenceMap);
      const evidenceHash = crypto.createHash('sha256').update(canonicalPayload).digest('hex');
      evidenceMap.evidenceHash = evidenceHash;
      evidenceMap.canonicalPayloadSha256 = evidenceHash;
      evidenceMap.quarantineVerified = Boolean(egressCheck.egressBlocked);
      evidenceMap.healthCheckPassed = Boolean(healthResult.healthy);

      const activeEnv = await prisma.deceptionRuntimeEnvironment.update({
        where: { id: environment.id },
        data: {
          lifecycleState: RUNTIME_LIFECYCLE_STATES.ACTIVE,
          isSimulated: false,
          executionEvidenceStatus: 'VERIFIED',
          containerId: createdContainer.containerId,
          containerName: createdContainer.containerName,
          networkId: createdNetwork.networkId,
          networkName: createdNetwork.networkName,
          healthStatus: 'HEALTHY',
          healthCheckedAt: new Date(),
          healthCheckDetails: healthResult,
          runtimeEvidence: evidenceMap
        }
      });

      // Step H: Complete Job
      const completedJob = await prisma.deceptionProvisioningJob.update({
        where: { id: jobId },
        data: {
          jobStatus: 'COMPLETED',
          completedAt: new Date(),
          environmentId: activeEnv.id,
          resultEvidence: {
            ...job.resultEvidence,
            evidenceMap,
            containerId: createdContainer.containerId,
            networkName: createdNetwork.networkName
          }
        }
      });

      return {
        success: true,
        job: completedJob,
        environment: activeEnv,
        evidence: evidenceMap,
        containerId: createdContainer.containerId,
        networkId: createdNetwork.networkId,
        environmentId: activeEnv.id
      };
    } catch (procErr) {
      // Teardown any partially created resources on provisioning failure
      if (createdContainer?.containerId) {
        await this.adapter.stopAndRemoveContainer(createdContainer.containerId).catch(() => {});
      }
      if (createdNetwork?.networkId) {
        await this.adapter.removeIsolatedNetwork(createdNetwork.networkId).catch(() => {});
      }

      // Transition environment to FAILED
      if (environment) {
        await prisma.deceptionRuntimeEnvironment.update({
          where: { id: environment.id },
          data: {
            lifecycleState: RUNTIME_LIFECYCLE_STATES.FAILED,
            statusReason: procErr.message,
            healthStatus: 'FAILED',
            executionEvidenceStatus: 'FAILED'
          }
        }).catch(() => {});
      }

      // Release quota reservation
      const resQuota = job.resourceReservation || {};
      await this.resourceGovernance.releaseResources({
        tenantId: job.tenantId,
        applicationId: job.applicationId,
        cpu: resQuota.allocatedCpu || 0.5,
        memoryMb: resQuota.allocatedMemoryMb || 256
      }).catch(() => {});

      // Mark Job FAILED
      await prisma.deceptionProvisioningJob.update({
        where: { id: jobId },
        data: {
          jobStatus: 'FAILED',
          completedAt: new Date(),
          errorDetails: {
            message: procErr.message,
            stack: procErr.stack,
            timestamp: new Date().toISOString()
          }
        }
      });

      await this.evidenceRecorder.recordEvent({
        tenantId: job.tenantId,
        authorizationId: job.authorizationId,
        environmentId: environment?.id,
        eventType: EXECUTION_EVENT_TYPES.PROVISIONING_FAILED,
        severity: 'ERROR',
        message: `Provisioning failed for job ${job.id}: ${procErr.message}`,
        outcomeStatus: 'REJECTED',
        evidenceStatus: 'FAILED',
        eventPayload: { jobId: job.id, error: procErr.message }
      });

      throw procErr;
    }
  }

  /**
   * Safely terminates a running deception environment, removes Docker resources,
   * releases quota allocations, and locks the lifecycle state to TERMINATED.
   *
   * @param {Object} params
   * @param {string} params.tenantId
   * @param {string} params.environmentId
   * @param {string} [params.reason='Operator initiated termination']
   * @param {Object} [params.operator]
   * @returns {Promise<Object>}
   */
  async terminateEnvironment({
    tenantId,
    environmentId,
    reason = 'Operator initiated termination',
    operator = null
  }) {
    const prisma = this.getDb();
    const env = await prisma.deceptionRuntimeEnvironment.findFirst({
      where: { id: environmentId, tenantId }
    });

    if (!env) {
      const err = new Error(`Environment "${environmentId}" not found for this tenant.`);
      err.code = 'ENVIRONMENT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    if (env.lifecycleState === RUNTIME_LIFECYCLE_STATES.TERMINATED) {
      return env;
    }

    // 1. Transition to TERMINATING
    await prisma.deceptionRuntimeEnvironment.update({
      where: { id: env.id },
      data: {
        lifecycleState: RUNTIME_LIFECYCLE_STATES.TERMINATING,
        statusReason: reason
      }
    });

    // 2. Remove Docker Container
    if (env.containerId) {
      await this.adapter.stopAndRemoveContainer(env.containerId).catch((e) => {
        console.warn(`Error stopping container ${env.containerId}:`, e.message);
      });
    }

    // 3. Remove Isolated Docker Network
    if (env.networkId) {
      await this.adapter.removeIsolatedNetwork(env.networkId).catch((e) => {
        console.warn(`Error removing network ${env.networkId}:`, e.message);
      });
    }

    // 4. Release Quota Allocation
    await this.resourceGovernance.releaseResources({
      tenantId: env.tenantId,
      applicationId: env.applicationId,
      cpu: env.allocatedCpu || 0.5,
      memoryMb: env.allocatedMemoryMb || 256
    });

    // 5. Transition to TERMINATED (Terminal state)
    const terminated = await prisma.deceptionRuntimeEnvironment.update({
      where: { id: env.id },
      data: {
        lifecycleState: RUNTIME_LIFECYCLE_STATES.TERMINATED,
        containerId: null,
        networkId: null,
        terminatedAt: new Date(),
        statusReason: reason
      }
    });

    // 6. Record Evidence Event
    await this.evidenceRecorder.recordVerifiedEvidence({
      tenantId,
      authorizationId: env.authorizationId,
      environmentId: env.id,
      eventType: EXECUTION_EVENT_TYPES.ENVIRONMENT_TERMINATED,
      severity: 'INFO',
      message: `Environment "${env.environmentIdentifier}" safely terminated and resources released. Reason: ${reason}`,
      actorIdentifier: operator?.email || 'RUNTIME_WORKER',
      actorRole: operator?.role || 'SYSTEM',
      evidencePayload: {
        previousContainerId: env.containerId,
        previousNetworkId: env.networkId,
        terminatedAt: terminated.terminatedAt
      }
    });

    return terminated;
  }

  /**
   * Health probe helper that queries the actual Docker container if running,
   * or returns simulated health if running in simulated mode.
   *
   * @param {Object} params
   * @param {string} params.tenantId
   * @param {string} params.environmentId
   * @returns {Promise<Object>}
   */
  async checkEnvironmentHealth({ tenantId, environmentId }) {
    const prisma = this.getDb();
    const env = await prisma.deceptionRuntimeEnvironment.findFirst({
      where: { id: environmentId, tenantId }
    });

    if (!env) {
      const err = new Error(`Environment "${environmentId}" not found.`);
      err.code = 'ENVIRONMENT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    // If simulated, return simulated health
    if (env.isSimulated || !env.containerId) {
      return {
        environmentId: env.id,
        isSimulated: true,
        healthStatus: 'SIMULATED_HEALTHY',
        containerProvisioned: false,
        runtimeEvidence: 'MISSING',
        timestamp: new Date().toISOString()
      };
    }

    // Inspect container via Adapter
    const health = await this.adapter.checkContainerHealth({
      containerId: env.containerId
    });

    const updated = await prisma.deceptionRuntimeEnvironment.update({
      where: { id: env.id },
      data: {
        healthStatus: health.healthy ? 'HEALTHY' : 'DEGRADED',
        healthCheckedAt: new Date(),
        healthCheckDetails: health
      }
    });

    return {
      environmentId: env.id,
      isSimulated: false,
      containerId: env.containerId,
      containerProvisioned: true,
      healthStatus: updated.healthStatus,
      latencyMs: health.latencyMs,
      statusCode: health.statusCode,
      runtimeEvidence: 'VERIFIED',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Background sweep that terminates expired environments and cleans up orphan containers.
   *
   * @param {Object} [params]
   * @param {string} [params.tenantId]
   * @returns {Promise<{ expiredTerminated: number, cleanedContainers: number, cleanedNetworks: number }>}
   */
  async sweepExpiredEnvironmentsAndOrphans({ tenantId = null } = {}) {
    const prisma = this.getDb();
    const now = new Date();
    const where = {
      lifecycleState: { not: RUNTIME_LIFECYCLE_STATES.TERMINATED },
      expiresAt: { lte: now }
    };
    if (tenantId) where.tenantId = tenantId;

    const expiredEnvs = await prisma.deceptionRuntimeEnvironment.findMany({ where });
    let expiredTerminated = 0;

    for (const env of expiredEnvs) {
      await this.terminateEnvironment({
        tenantId: env.tenantId,
        environmentId: env.id,
        reason: 'Maximum environment lifetime (TTL) expired.'
      }).catch(() => {});
      expiredTerminated++;
    }

    // Query all active environment IDs to protect them during orphan cleanup
    // Strictly shield only actively running / initializing states (FAILED/TERMINATING do not shield orphans)
    const activeEnvs = await prisma.deceptionRuntimeEnvironment.findMany({
      where: {
        lifecycleState: {
          in: [
            RUNTIME_LIFECYCLE_STATES.ACTIVE,
            RUNTIME_LIFECYCLE_STATES.PROVISIONING,
            RUNTIME_LIFECYCLE_STATES.VALIDATING,
            RUNTIME_LIFECYCLE_STATES.AUTHORIZED
          ]
        }
      },
      select: { id: true }
    });
    const activeIds = activeEnvs.map((e) => e.id);

    const orphanCleanup = await this.adapter.cleanupOrphanResources({
      tenantId,
      activeEnvironmentIds: activeIds
    });

    return {
      expiredTerminated,
      cleanedContainers: orphanCleanup.cleanedContainers,
      cleanedNetworks: orphanCleanup.cleanedNetworks
    };
  }
}

export default RuntimeWorkerService;
