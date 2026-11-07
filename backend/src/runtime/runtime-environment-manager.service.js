/**
 * Runtime Environment Manager Service (Stage 5B.1).
 *
 * Models and manages the lifecycle of future isolated deception environments:
 * - Environment creation from approved authorizations
 * - State machine transition validation
 * - Health check simulation and verification modeling
 * - DSG-bound runtime mutation management
 * - Controlled termination and resource quota release
 *
 * Core Research Invariants:
 * - In Stage 5B.1, live Docker containers and honeypots are NOT provisioned.
 * - All environments are recorded with isSimulated: true and executionEvidenceStatus: MISSING.
 * - Terminated environments can NEVER return to ACTIVE.
 * - Mutations against stale DSG versions are strictly rejected.
 */

import { getPrismaClient } from '../db/client.js';
import {
  LifecycleStateMachine,
  RUNTIME_LIFECYCLE_STATES
} from './lifecycle-state-machine.js';
import { ResourceGovernanceService } from './resource-governance.service.js';
import { ExecutionEvidenceRecorder, EXECUTION_EVENT_TYPES } from './execution-evidence-recorder.service.js';
import { AUTHORIZATION_STATUSES } from './execution-authorization.service.js';
import { WorkerClient } from './worker-client.js';

export class RuntimeEnvironmentManager {
  /**
   * @param {Object} [dependencies]
   * @param {Object} [dependencies.prismaClient]
   * @param {ResourceGovernanceService} [dependencies.resourceGovernance]
   * @param {ExecutionEvidenceRecorder} [dependencies.evidenceRecorder]
   * @param {WorkerClient} [dependencies.workerClient]
   */
  constructor({ prismaClient = null, resourceGovernance = null, evidenceRecorder = null, workerClient = null } = {}) {
    this.prisma = prismaClient;
    this.resourceGovernance = resourceGovernance || new ResourceGovernanceService(this.prisma);
    this.evidenceRecorder = evidenceRecorder || new ExecutionEvidenceRecorder(this.prisma);
    this.workerClient = workerClient || new WorkerClient();
  }

  getDb() {
    return this.prisma || getPrismaClient();
  }

  /**
   * Create a new runtime environment record from an APPROVED authorization.
   *
   * @param {Object} params
   * @param {string} params.tenantId
   * @param {string} params.authorizationId
   * @param {string} [params.environmentIdentifier]
   * @param {string} [params.name]
   * @param {number} [params.allocatedCpu=0.5]
   * @param {number} [params.allocatedMemoryMb=256]
   * @param {number} [params.allocatedStorageMb=512]
   * @param {string} [params.networkIsolationMode='SANDBOX_ISOLATED']
   * @param {Object} params.actor - { email, role }
   * @returns {Promise<Object>}
   */
  async createEnvironmentRecord({
    tenantId,
    authorizationId,
    environmentIdentifier = null,
    name = null,
    allocatedCpu = 0.5,
    allocatedMemoryMb = 256,
    allocatedStorageMb = 512,
    networkIsolationMode = 'SANDBOX_ISOLATED',
    actor
  }) {
    const prisma = this.getDb();

    // 1. Resolve and verify authorization
    const auth = await prisma.deceptionExecutionAuthorization.findFirst({
      where: { id: authorizationId, tenantId },
      include: {
        graph: true,
        policyDecision: true
      }
    });

    if (!auth) {
      const err = new Error(`Execution authorization "${authorizationId}" not found for this tenant.`);
      err.code = 'AUTHORIZATION_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    // Must be strictly APPROVED
    if (auth.authorizationStatus !== AUTHORIZATION_STATUSES.APPROVED) {
      const err = new Error(
        `Cannot create environment: Authorization status is "${auth.authorizationStatus}". Must be APPROVED.`
      );
      err.code = 'AUTHORIZATION_NOT_APPROVED';
      err.statusCode = 403;
      throw err;
    }

    // Check expiration
    if (new Date() > new Date(auth.expiresAt)) {
      const err = new Error('Cannot create environment: Execution authorization has expired.');
      err.code = 'AUTHORIZATION_EXPIRED';
      err.statusCode = 410;
      throw err;
    }

    // 2. Reserve resource quota
    await this.resourceGovernance.reserveResources({
      tenantId,
      applicationId: auth.applicationId,
      cpu: allocatedCpu,
      memoryMb: allocatedMemoryMb
    });

    const envId = environmentIdentifier || `env-rt-${auth.graph.graphIdentifier}-${Date.now().toString(36)}`;
    const envName = name || `Simulated Runtime: ${auth.graph.graphIdentifier} (v${auth.dsgGraphVersion})`;

    // Synthetic environment model snapshot from decision
    const syntheticSnapshot = auth.policyDecision?.proposedMutations?.syntheticEnvironmentModel || {
      status: 'PLANNING_BLUEPRINT_ONLY',
      mockRoutes: [],
      isolation: { strictNamespaceIsolation: true, noOutboundEgress: true }
    };

    // 3. Create Runtime Environment record in state AUTHORIZED (not provisioned)
    const environment = await prisma.deceptionRuntimeEnvironment.create({
      data: {
        tenantId,
        applicationId: auth.applicationId,
        authorizationId: auth.id,
        environmentIdentifier: envId,
        name: envName,
        lifecycleState: RUNTIME_LIFECYCLE_STATES.AUTHORIZED,
        statusReason: 'Authorized and queued for future runtime provisioning. Live containers remain unprovisioned.',
        dsgGraphId: auth.dsgGraphId,
        dsgGraphVersion: auth.dsgGraphVersion,
        strategyIdentifier: auth.selectedStrategyId,
        allocatedCpu,
        allocatedMemoryMb,
        allocatedStorageMb,
        networkIsolationMode,
        syntheticStateSnapshot: syntheticSnapshot,
        isSimulated: true, // Core invariant
        executionEvidenceStatus: 'MISSING', // Core invariant
        expiresAt: auth.expiresAt
      }
    });

    // 4. Record Execution Event
    await this.evidenceRecorder.recordEvent({
      tenantId,
      authorizationId: auth.id,
      environmentId: environment.id,
      eventType: EXECUTION_EVENT_TYPES.PROVISIONING_REQUESTED,
      severity: 'INFO',
      message: `Environment record "${envId}" created in state AUTHORIZED from authorization ${auth.id}. Live execution is strictly simulated in Stage 5B.1.`,
      actorIdentifier: actor?.email || 'SYSTEM_OPERATOR',
      actorRole: actor?.role || 'OPERATOR',
      outcomeStatus: 'RECORDED',
      eventPayload: {
        environmentId: environment.id,
        environmentIdentifier: envId,
        dsgGraphVersion: auth.dsgGraphVersion,
        isSimulated: true,
        executionEvidenceStatus: 'MISSING'
      }
    });

    return environment;
  }

  /**
   * Inspect environment health.
   *
   * @param {Object} params
   * @param {string} params.environmentId
   * @param {string} params.tenantId
   * @returns {Promise<Object>}
   */
  async checkEnvironmentHealth({ environmentId, tenantId }) {
    const prisma = this.getDb();
    const env = await prisma.deceptionRuntimeEnvironment.findFirst({
      where: { id: environmentId, tenantId },
      include: { graph: true, authorization: true }
    });

    if (!env) {
      const err = new Error(`Environment "${environmentId}" not found for this tenant.`);
      err.code = 'ENVIRONMENT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    // Real Docker container health check if unsimulated via dedicated Worker
    if (!env.isSimulated && env.containerId) {
      const probeRes = await this.workerClient.getEnvironmentHealth({ environmentId: env.id, tenantId });
      const healthy = probeRes.ok && probeRes.health?.healthy;
      return {
        environmentId: env.id,
        environmentIdentifier: env.environmentIdentifier,
        lifecycleState: env.lifecycleState,
        healthStatus: healthy ? 'HEALTHY' : 'DEGRADED',
        runtimeEvidence: probeRes.ok ? 'VERIFIED' : 'PARTIAL',
        isSimulated: false,
        containerProvisioned: true,
        containerId: env.containerId,
        latencyMs: probeRes.health?.latencyMs || null,
        statusCode: probeRes.health?.statusCode || null,
        allocatedResources: {
          cpu: env.allocatedCpu,
          memoryMb: env.allocatedMemoryMb,
          storageMb: env.allocatedStorageMb
        },
        workerStatus: probeRes.ok ? 'CONNECTED' : 'OFFLINE',
        workerError: probeRes.error || null
      };
    }

    const isTerminated = env.lifecycleState === RUNTIME_LIFECYCLE_STATES.TERMINATED;
    const isExpired = env.expiresAt && new Date() > new Date(env.expiresAt);

    return {
      environmentId: env.id,
      environmentIdentifier: env.environmentIdentifier,
      lifecycleState: env.lifecycleState,
      healthStatus: isTerminated ? 'TERMINATED' : isExpired ? 'EXPIRED' : 'SIMULATED_HEALTHY',
      runtimeEvidence: 'MISSING',
      isSimulated: true,
      containerProvisioned: false,
      allocatedResources: {
        cpu: env.allocatedCpu,
        memoryMb: env.allocatedMemoryMb,
        storageMb: env.allocatedStorageMb
      },
      nonExecutionNotice:
        'STAGE_5B1_SAFETY_INVARIANT: Health status reflects simulated architecture check. Zero Docker containers or honeypots are live.'
    };
  }

  /**
   * Proposes a safe runtime mutation (Stage 5B.3 alias).
   *
   * @param {Object} params
   * @returns {Promise<Object>}
   */
  async proposeRuntimeMutation(params) {
    return this.recordRuntimeMutation(params);
  }

  /**
   * Apply an updated DSG mutation to an existing environment record.
   *
   * @param {Object} params
   * @param {string} params.environmentId
   * @param {string} params.tenantId
   * @param {number} params.targetGraphVersion
   * @param {string} params.mutationType
   * @param {Object} [params.syntheticDiff]
   * @param {Object} params.actor
   * @returns {Promise<Object>}
   */
  async recordRuntimeMutation({
    environmentId,
    tenantId,
    targetGraphVersion,
    mutationType = 'TOPOLOGY_EXPANSION',
    syntheticDiff = {},
    actor
  }) {
    const prisma = this.getDb();
    const env = await prisma.deceptionRuntimeEnvironment.findFirst({
      where: { id: environmentId, tenantId },
      include: { graph: true }
    });

    if (!env) {
      const err = new Error(`Environment "${environmentId}" not found for this tenant.`);
      err.code = 'ENVIRONMENT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    // Terminal state invariant
    if (LifecycleStateMachine.isTerminal(env.lifecycleState)) {
      const err = new Error(`Cannot apply mutation: Environment is in terminal state "${env.lifecycleState}".`);
      err.code = 'ENVIRONMENT_TERMINATED';
      err.statusCode = 409;
      throw err;
    }

    // Staleness check: targetGraphVersion must be strictly greater than current environment graphVersion
    if (targetGraphVersion <= env.dsgGraphVersion) {
      const err = new Error(
        `Stale mutation rejected: Target version (${targetGraphVersion}) must be greater than current environment version (${env.dsgGraphVersion}).`
      );
      err.code = 'STALE_GRAPH_VERSION_MUTATION';
      err.statusCode = 409;
      throw err;
    }

    // Supported safe mutation validation
    const SUPPORTED_MUTATION_TYPES = new Set([
      'TOPOLOGY_EXPANSION',
      'CREDENTIAL_MUTATION',
      'SCHEMA_MUTATION',
      'ISOLATION_UPDATE'
    ]);

    if (!SUPPORTED_MUTATION_TYPES.has(mutationType)) {
      const rejectionReason = `NOT_SUPPORTED: Mutation type "${mutationType}" is not supported. Arbitrary shell, mount, or network mutations are strictly forbidden.`;
      const rejectedMutation = await prisma.deceptionRuntimeMutation.create({
        data: {
          tenantId,
          authorizationId: env.authorizationId,
          environmentId: env.id,
          dsgGraphId: env.dsgGraphId,
          baseGraphVersion: env.dsgGraphVersion,
          targetGraphVersion,
          mutationType,
          mutationStatus: 'REJECTED',
          rejectionReason,
          syntheticDiff
        }
      });

      await this.evidenceRecorder.recordEvent({
        tenantId,
        authorizationId: env.authorizationId,
        environmentId: env.id,
        eventType: EXECUTION_EVENT_TYPES.MUTATION_REJECTED,
        severity: 'WARN',
        message: `Mutation proposal rejected: ${rejectionReason}`,
        actorIdentifier: actor?.email || 'SYSTEM_OPERATOR',
        actorRole: actor?.role || 'OPERATOR',
        outcomeStatus: 'REJECTED',
        eventPayload: { mutationId: rejectedMutation.id, targetGraphVersion, reason: rejectionReason }
      });

      const err = new Error(rejectionReason);
      err.code = 'MUTATION_NOT_SUPPORTED';
      err.statusCode = 422;
      err.mutation = rejectedMutation;
      throw err;
    }

    // Record runtime mutation proposal
    const mutation = await prisma.deceptionRuntimeMutation.create({
      data: {
        tenantId,
        authorizationId: env.authorizationId,
        environmentId: env.id,
        dsgGraphId: env.dsgGraphId,
        baseGraphVersion: env.dsgGraphVersion,
        targetGraphVersion,
        mutationType,
        mutationStatus: 'PROPOSED',
        syntheticDiff
      }
    });

    await this.evidenceRecorder.recordEvent({
      tenantId,
      authorizationId: env.authorizationId,
      environmentId: env.id,
      eventType: EXECUTION_EVENT_TYPES.MUTATION_REQUESTED,
      severity: 'INFO',
      message: `Proposed runtime mutation recorded: ${mutationType} from v${env.dsgGraphVersion} to v${targetGraphVersion}.`,
      actorIdentifier: actor?.email || 'SYSTEM_OPERATOR',
      actorRole: actor?.role || 'OPERATOR',
      outcomeStatus: 'RECORDED',
      eventPayload: {
        mutationId: mutation.id,
        sourceGraphVersion: env.dsgGraphVersion,
        targetGraphVersion,
        mutationType,
        mutationStatus: 'PROPOSED',
        executionStatus: 'PROPOSED_NOT_EXECUTED'
      }
    });

    return mutation;
  }

  /**
   * Terminate an environment record and release allocated quota.
   *
   * @param {Object} params
   * @param {string} params.environmentId
   * @param {string} params.tenantId
   * @param {string} [params.reason]
   * @param {Object} params.actor
   * @returns {Promise<Object>}
   */
  async terminateEnvironment({
    environmentId,
    tenantId,
    reason = 'Terminated by authorized operator.',
    actor
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
      return env; // Idempotent termination
    }

    // Validate state machine transition from current state to TERMINATING and TERMINATED
    LifecycleStateMachine.validateTransition(
      env.lifecycleState,
      RUNTIME_LIFECYCLE_STATES.TERMINATING,
      { allowSimulatedExecution: true }
    );
    LifecycleStateMachine.validateTransition(
      RUNTIME_LIFECYCLE_STATES.TERMINATING,
      RUNTIME_LIFECYCLE_STATES.TERMINATED,
      { allowSimulatedExecution: true }
    );

    // If live container was provisioned, request teardown via dedicated Worker process
    if (env.containerId) {
      const termRes = await this.workerClient.terminateEnvironment({
        environmentId: env.id,
        tenantId,
        reason,
        actor
      }).catch((e) => ({ ok: false, error: e.message }));

      if (termRes.ok && termRes.data) {
        return termRes.data;
      }

      // Fallback: If standalone worker is offline (e.g. legacy test environment), clean up container directly
      try {
        const { ContainerRuntimeAdapter } = await import('./container-runtime-adapter.js');
        const adapter = new ContainerRuntimeAdapter();
        await adapter.removeContainer(env.containerId, { force: true });
        if (env.networkId) {
          await adapter.removeNetwork(env.networkId);
        }
      } catch (_) {}
    }

    // Update state to TERMINATED (simulated environments or worker fallback)
    const terminated = await prisma.deceptionRuntimeEnvironment.update({
      where: { id: env.id },
      data: {
        lifecycleState: RUNTIME_LIFECYCLE_STATES.TERMINATED,
        containerId: null,
        networkId: null,
        statusReason: reason,
        terminatedAt: new Date()
      }
    });

    // Release resource quota
    await this.resourceGovernance.releaseResources({
      tenantId,
      applicationId: env.applicationId,
      cpu: env.allocatedCpu,
      memoryMb: env.allocatedMemoryMb
    });

    // Record Execution Event
    await this.evidenceRecorder.recordEvent({
      tenantId,
      authorizationId: env.authorizationId,
      environmentId: env.id,
      eventType: EXECUTION_EVENT_TYPES.ENVIRONMENT_TERMINATED,
      severity: 'INFO',
      message: `Environment "${env.environmentIdentifier}" terminated: ${reason}`,
      actorIdentifier: actor?.email || 'SYSTEM_OPERATOR',
      actorRole: actor?.role || 'OPERATOR',
      outcomeStatus: 'CONFIRMED',
      eventPayload: { environmentId: env.id, reason }
    });

    return terminated;
  }

  /**
   * Get environment by ID with tenant scoping.
   *
   * @param {Object} params
   * @param {string} params.environmentId
   * @param {string} params.tenantId
   * @returns {Promise<Object|null>}
   */
  async getEnvironment({ environmentId, tenantId }) {
    const prisma = this.getDb();
    return prisma.deceptionRuntimeEnvironment.findFirst({
      where: { id: environmentId, tenantId },
      include: {
        application: true,
        graph: true,
        authorization: true,
        events: {
          orderBy: { recordedAt: 'desc' },
          take: 20
        },
        mutations: {
          orderBy: { proposedAt: 'desc' },
          take: 10
        }
      }
    });
  }

  /**
   * List environment records with tenant scoping, pagination, and state filters.
   *
   * @param {Object} params
   * @param {string} params.tenantId
   * @param {string} [params.applicationId]
   * @param {string} [params.lifecycleState]
   * @param {number} [params.page=1]
   * @param {number} [params.limit=20]
   * @returns {Promise<{ environments: Array, total: number, page: number, limit: number }>}
   */
  async listEnvironments({
    tenantId,
    applicationId = null,
    lifecycleState = null,
    page = 1,
    limit = 20
  }) {
    const prisma = this.getDb();
    const where = { tenantId };

    if (applicationId) where.applicationId = applicationId;
    if (lifecycleState) where.lifecycleState = lifecycleState;

    const [environments, total] = await Promise.all([
      prisma.deceptionRuntimeEnvironment.findMany({
        where,
        include: {
          application: true,
          graph: true,
          authorization: true
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.deceptionRuntimeEnvironment.count({ where })
    ]);

    return { environments, total, page, limit };
  }
}
