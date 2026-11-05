/**
 * Resource Governance Service (Stage 5B.1).
 *
 * Enforces per-tenant and per-application limits on deception environments:
 * - Maximum active environments
 * - Maximum CPU allocation
 * - Maximum memory allocation (MB)
 * - Maximum storage allocation (MB)
 * - Maximum environment lifetime (minutes)
 * - Maximum concurrent provisioning operations
 * - Maximum network connections
 * - Maximum execution request rate (requests / hour)
 *
 * Core Research Invariant:
 * If no real infrastructure capacity monitoring is connected, capacity is explicitly
 * represented as "UNKNOWN", preventing execution authorization from treating unknown
 * capacity as available.
 */

import { getPrismaClient } from '../db/client.js';

export const CAPACITY_STATUSES = {
  UNKNOWN: 'UNKNOWN',
  NORMAL: 'NORMAL',
  CONSTRAINED: 'CONSTRAINED',
  EXHAUSTED: 'EXHAUSTED'
};

export const DEFAULT_QUOTAS = {
  // Research & Development Baseline Limits
  RESEARCH_DEV: {
    maxActiveEnvironments: 3,
    maxCpuAllocation: 2.0,
    maxMemoryMb: 1024,
    maxStorageMb: 2048,
    maxEnvironmentLifetimeMinutes: 120,
    maxConcurrentProvisioning: 1,
    maxNetworkConnections: 50,
    maxExecutionRequestsPerHour: 20,
    capacityStatus: CAPACITY_STATUSES.UNKNOWN
  },
  // Production Specification Reference
  PRODUCTION: {
    maxActiveEnvironments: 10,
    maxCpuAllocation: 8.0,
    maxMemoryMb: 8192,
    maxStorageMb: 16384,
    maxEnvironmentLifetimeMinutes: 240,
    maxConcurrentProvisioning: 3,
    maxNetworkConnections: 250,
    maxExecutionRequestsPerHour: 100,
    capacityStatus: CAPACITY_STATUSES.UNKNOWN
  }
};

export class ResourceGovernanceService {
  constructor(prismaClient = null) {
    this.prisma = prismaClient;
  }

  getDb() {
    return this.prisma || getPrismaClient();
  }

  /**
   * Retrieve or initialize resource quota for a tenant or application.
   *
   * @param {Object} params
   * @param {string} params.tenantId
   * @param {string} [params.applicationId]
   * @returns {Promise<Object>}
   */
  async getQuota({ tenantId, applicationId = null }) {
    const prisma = this.getDb();

    let quota = await prisma.deceptionResourceQuota.findFirst({
      where: { tenantId, applicationId }
    });

    if (!quota) {
      // Create initial research-dev default quota
      quota = await prisma.deceptionResourceQuota.create({
        data: {
          tenantId,
          applicationId,
          ...DEFAULT_QUOTAS.RESEARCH_DEV,
          isCapacityTracked: false,
          capacityStatus: CAPACITY_STATUSES.UNKNOWN,
          currentActiveEnvironments: 0,
          currentAllocatedCpu: 0.0,
          currentAllocatedMemoryMb: 0
        }
      });
    }

    return quota;
  }

  /**
   * Update resource quota limits. Requires APPLICATION_OWNER or PLATFORM_ADMIN.
   *
   * @param {Object} params
   * @param {string} params.tenantId
   * @param {string} [params.applicationId]
   * @param {Object} params.updates
   * @returns {Promise<Object>}
   */
  async updateQuota({ tenantId, applicationId = null, updates = {} }) {
    const prisma = this.getDb();
    const existing = await this.getQuota({ tenantId, applicationId });

    const allowedFields = [
      'maxActiveEnvironments',
      'maxCpuAllocation',
      'maxMemoryMb',
      'maxStorageMb',
      'maxEnvironmentLifetimeMinutes',
      'maxConcurrentProvisioning',
      'maxNetworkConnections',
      'maxExecutionRequestsPerHour',
      'capacityStatus',
      'isCapacityTracked'
    ];

    const data = {};
    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        data[key] = updates[key];
      }
    }

    const updated = await prisma.deceptionResourceQuota.update({
      where: { id: existing.id },
      data
    });

    return updated;
  }

  /**
   * Validate whether requested execution resources can be admitted under quota limits.
   *
   * @param {Object} params
   * @param {string} params.tenantId
   * @param {string} [params.applicationId]
   * @param {number} [params.requestedCpu=0.5]
   * @param {number} [params.requestedMemoryMb=256]
   * @param {boolean} [params.strictCapacityEnforcement=false]
   * @returns {Promise<{
   *   eligible: boolean,
   *   reasons: string[],
   *   quota: Object,
   *   violations: string[]
   * }>}
   */
  async validateResourceAdmission({
    tenantId,
    applicationId = null,
    requestedCpu = 0.5,
    requestedMemoryMb = 256,
    strictCapacityEnforcement = false
  }) {
    const prisma = this.getDb();
    const quota = await this.getQuota({ tenantId, applicationId });
    const reasons = [];
    const violations = [];
    let eligible = true;

    // 1. Capacity Status Check
    if (quota.capacityStatus === CAPACITY_STATUSES.EXHAUSTED) {
      violations.push('CAPACITY_EXHAUSTED: Host infrastructure reports zero available deception capacity.');
      eligible = false;
    } else if (strictCapacityEnforcement && quota.capacityStatus === CAPACITY_STATUSES.UNKNOWN) {
      violations.push('UNKNOWN_CAPACITY: Host capacity is UNKNOWN; strict policy prohibits authorization without verified monitoring.');
      eligible = false;
    }

    // 2. Maximum Active Environments Check
    if (quota.currentActiveEnvironments + 1 > quota.maxActiveEnvironments) {
      violations.push(
        `QUOTA_ENVIRONMENTS_EXCEEDED: Requested 1 environment, but quota limit (${quota.maxActiveEnvironments}) already reached (${quota.currentActiveEnvironments} active).`
      );
      eligible = false;
    }

    // 3. CPU Allocation Check
    if (quota.currentAllocatedCpu + requestedCpu > quota.maxCpuAllocation) {
      violations.push(
        `QUOTA_CPU_EXCEEDED: Requested ${requestedCpu} CPU cores exceeds remaining allocation (${quota.maxCpuAllocation - quota.currentAllocatedCpu} available of ${quota.maxCpuAllocation}).`
      );
      eligible = false;
    }

    // 4. Memory Allocation Check
    if (quota.currentAllocatedMemoryMb + requestedMemoryMb > quota.maxMemoryMb) {
      violations.push(
        `QUOTA_MEMORY_EXCEEDED: Requested ${requestedMemoryMb} MB memory exceeds remaining allocation (${quota.maxMemoryMb - quota.currentAllocatedMemoryMb} MB available of ${quota.maxMemoryMb} MB).`
      );
      eligible = false;
    }

    // 5. Hourly Execution Rate Limit Check
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentRequestsCount = await prisma.deceptionExecutionAuthorization.count({
      where: {
        tenantId,
        requestedAt: { gte: oneHourAgo }
      }
    });

    if (recentRequestsCount >= quota.maxExecutionRequestsPerHour) {
      violations.push(
        `RATE_LIMIT_EXCEEDED: Tenant exceeded hourly execution authorization rate limit (${recentRequestsCount}/${quota.maxExecutionRequestsPerHour} requests in past hour).`
      );
      eligible = false;
    }

    if (eligible) {
      reasons.push('RESOURCE_ADMISSION_PASSED');
    } else {
      reasons.push(...violations);
    }

    return { eligible, reasons, quota, violations };
  }

  /**
   * Atomically reserve resources when an environment enters provisioning or authorization.
   *
   * @param {Object} params
   * @param {string} params.tenantId
   * @param {string} [params.applicationId]
   * @param {number} [params.cpu=0.5]
   * @param {number} [params.memoryMb=256]
   * @returns {Promise<Object>}
   */
  async reserveResources({ tenantId, applicationId = null, cpu = 0.5, memoryMb = 256 }) {
    const prisma = this.getDb();
    const quota = await this.getQuota({ tenantId, applicationId });

    return prisma.deceptionResourceQuota.update({
      where: { id: quota.id },
      data: {
        currentActiveEnvironments: { increment: 1 },
        currentAllocatedCpu: { increment: cpu },
        currentAllocatedMemoryMb: { increment: memoryMb }
      }
    });
  }

  /**
   * Release resources when an environment is terminated or expired.
   *
   * @param {Object} params
   * @param {string} params.tenantId
   * @param {string} [params.applicationId]
   * @param {number} [params.cpu=0.5]
   * @param {number} [params.memoryMb=256]
   * @returns {Promise<Object>}
   */
  async releaseResources({ tenantId, applicationId = null, cpu = 0.5, memoryMb = 256 }) {
    const prisma = this.getDb();
    const quota = await this.getQuota({ tenantId, applicationId });

    return prisma.deceptionResourceQuota.update({
      where: { id: quota.id },
      data: {
        currentActiveEnvironments: Math.max(0, quota.currentActiveEnvironments - 1),
        currentAllocatedCpu: Math.max(0, quota.currentAllocatedCpu - cpu),
        currentAllocatedMemoryMb: Math.max(0, quota.currentAllocatedMemoryMb - memoryMb)
      }
    });
  }
}
