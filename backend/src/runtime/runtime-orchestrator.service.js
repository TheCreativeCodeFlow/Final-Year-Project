/**
 * Runtime Orchestrator Service (Stage 5B.1).
 *
 * Coordinates the execution lifecycle across:
 * - Execution Authorization Service
 * - Resource Governance Service
 * - Runtime Environment Manager
 * - Runtime State Manager
 * - Execution Evidence Recorder
 * - Lifecycle State Machine
 *
 * Core Research Invariant:
 * Strictly planning and architectural coordination.
 * The orchestrator DOES NOT perform direct unrestricted Docker operations,
 * does NOT spin up live honeypot containers, and does NOT alter live traffic routing.
 */

import { getPrismaClient } from '../db/client.js';
import { ExecutionAuthorizationService, AUTHORIZATION_STATUSES } from './execution-authorization.service.js';
import { ResourceGovernanceService } from './resource-governance.service.js';
import { RuntimeEnvironmentManager } from './runtime-environment-manager.service.js';
import { RuntimeStateManager } from './runtime-state-manager.service.js';
import { ExecutionEvidenceRecorder, EXECUTION_EVENT_TYPES } from './execution-evidence-recorder.service.js';
import { RUNTIME_LIFECYCLE_STATES } from './lifecycle-state-machine.js';

export class RuntimeOrchestrator {
  /**
   * @param {Object} [dependencies]
   */
  constructor({
    prismaClient = null,
    authorizationService = null,
    resourceGovernance = null,
    environmentManager = null,
    stateManager = null,
    evidenceRecorder = null
  } = {}) {
    this.prisma = prismaClient;
    this.resourceGovernance = resourceGovernance || new ResourceGovernanceService(this.prisma);
    this.evidenceRecorder = evidenceRecorder || new ExecutionEvidenceRecorder(this.prisma);
    this.authorizationService =
      authorizationService ||
      new ExecutionAuthorizationService({
        prismaClient: this.prisma,
        resourceGovernance: this.resourceGovernance,
        evidenceRecorder: this.evidenceRecorder
      });
    this.environmentManager =
      environmentManager ||
      new RuntimeEnvironmentManager({
        prismaClient: this.prisma,
        resourceGovernance: this.resourceGovernance,
        evidenceRecorder: this.evidenceRecorder
      });
    this.stateManager = stateManager || new RuntimeStateManager(this.prisma);
  }

  getDb() {
    return this.prisma || getPrismaClient();
  }

  /**
   * Compile a comprehensive runtime operations overview for a tenant.
   *
   * @param {Object} params
   * @param {string} params.tenantId
   * @returns {Promise<Object>}
   */
  async getOverview({ tenantId }) {
    const prisma = this.getDb();

    const [
      quota,
      totalAuths,
      pendingAuths,
      approvedAuths,
      deniedAuths,
      expiredAuths,
      activeEnvironments,
      totalEnvironments,
      liveContainersCount,
      queuedJobsCount,
      recentEvents
    ] = await Promise.all([
      this.resourceGovernance.getQuota({ tenantId }),
      prisma.deceptionExecutionAuthorization.count({ where: { tenantId } }),
      prisma.deceptionExecutionAuthorization.count({
        where: { tenantId, authorizationStatus: AUTHORIZATION_STATUSES.PENDING }
      }),
      prisma.deceptionExecutionAuthorization.count({
        where: { tenantId, authorizationStatus: AUTHORIZATION_STATUSES.APPROVED }
      }),
      prisma.deceptionExecutionAuthorization.count({
        where: { tenantId, authorizationStatus: AUTHORIZATION_STATUSES.DENIED }
      }),
      prisma.deceptionExecutionAuthorization.count({
        where: { tenantId, authorizationStatus: AUTHORIZATION_STATUSES.EXPIRED }
      }),
      prisma.deceptionRuntimeEnvironment.count({
        where: {
          tenantId,
          lifecycleState: { in: [RUNTIME_LIFECYCLE_STATES.ACTIVE, RUNTIME_LIFECYCLE_STATES.AUTHORIZED] }
        }
      }),
      prisma.deceptionRuntimeEnvironment.count({ where: { tenantId } }),
      prisma.deceptionRuntimeEnvironment.count({
        where: {
          tenantId,
          isSimulated: false,
          lifecycleState: RUNTIME_LIFECYCLE_STATES.ACTIVE
        }
      }),
      prisma.deceptionProvisioningJob.count({
        where: {
          tenantId,
          jobStatus: { in: ['QUEUED', 'PROCESSING'] }
        }
      }),
      prisma.deceptionExecutionEvent.findMany({
        where: { tenantId },
        orderBy: { recordedAt: 'desc' },
        take: 5
      })
    ]);

    const isLiveActive = liveContainersCount > 0;

    return {
      runtimeArchitectureStatus: isLiveActive
        ? 'STAGE_5B2_PROVISIONING_ACTIVE'
        : 'STAGE_5B1_ARCHITECTURE_READY',
      executionSafetyStatus: isLiveActive
        ? 'ISOLATED_SYNTHETIC_ACTIVE'
        : 'SAFE_UNPROVISIONED',
      executionEvidenceStatus: isLiveActive ? 'VERIFIED' : 'MISSING',
      authorizationsSummary: {
        total: totalAuths,
        pending: pendingAuths,
        approved: approvedAuths,
        denied: deniedAuths,
        expired: expiredAuths
      },
      environmentsSummary: {
        active: activeEnvironments,
        total: totalEnvironments,
        liveContainers: liveContainersCount,
        verifiedContainersLive: liveContainersCount
      },
      jobsSummary: {
        activeJobs: queuedJobsCount
      },
      capacityStatus: quota.capacityStatus, // "UNKNOWN"
      resourceQuota: {
        maxActiveEnvironments: quota.maxActiveEnvironments,
        currentActiveEnvironments: quota.currentActiveEnvironments,
        maxCpuAllocation: quota.maxCpuAllocation,
        currentAllocatedCpu: quota.currentAllocatedCpu,
        maxMemoryMb: quota.maxMemoryMb,
        currentAllocatedMemoryMb: quota.currentAllocatedMemoryMb
      },
      recentEvents,
      nonExecutionNotice: isLiveActive
        ? 'STAGE_5B2_ACTIVE: Isolated synthetic deception containers active on internal networks. Zero gateway traffic diversion.'
        : 'STAGE_5B1_PLANNING_ONLY: Deception runtime architecture established for simulation and authorization. Live execution containers remain unprovisioned.'
    };
  }

  /**
   * Request execution authorization for an existing policy decision.
   */
  async requestAuthorization(params) {
    return this.authorizationService.requestAuthorization(params);
  }

  /**
   * Approve an authorization request with RBAC and separation of duties checks.
   */
  async approveAuthorization(params) {
    return this.authorizationService.approveAuthorization(params);
  }

  /**
   * Deny an authorization request.
   */
  async denyAuthorization(params) {
    return this.authorizationService.denyAuthorization(params);
  }

  /**
   * Revoke an approved authorization.
   */
  async revokeAuthorization(params) {
    return this.authorizationService.revokeAuthorization(params);
  }

  /**
   * Model the environment allocation workflow from an approved authorization.
   */
  async allocateEnvironment(params) {
    return this.environmentManager.createEnvironmentRecord(params);
  }

  /**
   * Terminate an environment record.
   */
  async terminateEnvironment(params) {
    return this.environmentManager.terminateEnvironment(params);
  }
}
