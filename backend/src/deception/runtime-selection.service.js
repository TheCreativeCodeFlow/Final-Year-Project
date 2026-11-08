/**
 * Runtime Selection Service (Stage 5B.5).
 *
 * Evaluates candidate isolated synthetic deception environments for a given
 * tenant, protected application, policy decision, and selected strategy.
 *
 * Responsibilities:
 * 1. Filter environments strictly by tenant ownership and application binding.
 * 2. Verify strategy compatibility.
 * 3. Enforce runtime lifecycle and health gating (HEALTHY / DEGRADED only).
 * 4. Verify execution authorization state (APPROVED, dual-custody, non-expired).
 * 5. Verify DSG graph version compatibility.
 * 6. Verify network isolation and host-boundary protection (Hard activation blocker for CONTROLLED_LAB).
 * 7. Verify rollback readiness.
 *
 * Security Invariants:
 * - Never returns an unhealthy, terminated, or unknown environment.
 * - Never returns an environment with an expired or revoked authorization.
 * - Rejects cross-tenant runtime references unconditionally.
 * - Enforces the unresolved host INPUT firewall finding as a mandatory blocker for live diversion.
 */

import { getPrismaClient } from '../db/client.js';
import { logger } from '../utils/logger.js';

export const RUNTIME_REJECTION_REASONS = Object.freeze({
  NO_RUNTIME_CONFIGURED: 'NO_RUNTIME_CONFIGURED',
  NO_COMPATIBLE_RUNTIME: 'NO_COMPATIBLE_RUNTIME',
  RUNTIME_UNHEALTHY: 'RUNTIME_UNHEALTHY',
  RUNTIME_UNKNOWN_HEALTH: 'RUNTIME_UNKNOWN_HEALTH',
  RUNTIME_TERMINATED: 'RUNTIME_TERMINATED',
  RUNTIME_DEGRADED_DISQUALIFIED: 'RUNTIME_DEGRADED_DISQUALIFIED',
  RUNTIME_LIFECYCLE_NOT_ACTIVE: 'RUNTIME_LIFECYCLE_NOT_ACTIVE',
  AUTHORIZATION_NOT_FOUND: 'AUTHORIZATION_NOT_FOUND',
  AUTHORIZATION_NOT_APPROVED: 'AUTHORIZATION_NOT_APPROVED',
  AUTHORIZATION_EXPIRED: 'AUTHORIZATION_EXPIRED',
  AUTHORIZATION_REVOKED: 'AUTHORIZATION_REVOKED',
  STALE_GRAPH_VERSION: 'STALE_GRAPH_VERSION',
  CROSS_TENANT_MISMATCH: 'CROSS_TENANT_MISMATCH',
  HOST_BOUNDARY_UNVERIFIED: 'HOST_BOUNDARY_UNVERIFIED',
  NETWORK_ISOLATION_INCOMPLETE: 'NETWORK_ISOLATION_INCOMPLETE',
  ROLLBACK_NOT_READY: 'ROLLBACK_NOT_READY',
  CAPACITY_EXHAUSTED: 'CAPACITY_EXHAUSTED'
});

/**
 * Specifically documented and validated strategies permitted to evaluate on DEGRADED runtimes
 * provided their explicit safety prerequisites (e.g. degradedPrerequisitesMet) are satisfied.
 * All other strategies (active API facades, credential decoys, data records) are rejected by default.
 */
export const DEGRADED_TOLERANT_STRATEGIES = Object.freeze([
  'strat-service-tarpit-latency-01',
  'SERVICE_INTERACTION_DECEPTION'
]);

export const ROUTING_MODES = Object.freeze({
  OBSERVE_ONLY: 'OBSERVE_ONLY',
  SHADOW: 'SHADOW',
  CONTROLLED_LAB: 'CONTROLLED_LAB'
});

export const ROUTING_DECISION_OUTCOMES = Object.freeze({
  NORMAL_FORWARD: 'NORMAL_FORWARD',
  SHADOW_DECEPTION: 'SHADOW_DECEPTION',
  DECEPTION_ROUTE_PROPOSED: 'DECEPTION_ROUTE_PROPOSED',
  DECEPTION_ROUTE_AUTHORIZED: 'DECEPTION_ROUTE_AUTHORIZED',
  DECEPTION_ROUTE_EXECUTED: 'DECEPTION_ROUTE_EXECUTED',
  BLOCK_REQUEST: 'BLOCK_REQUEST',
  DEFER_TO_ORIGIN: 'DEFER_TO_ORIGIN',
  DEFER_WITH_UNCERTAINTY: 'DEFER_WITH_UNCERTAINTY',
  RUNTIME_UNAVAILABLE: 'RUNTIME_UNAVAILABLE'
});

const routingModeRegistry = new Map();

export function setApplicationRoutingMode(key, mode) {
  if (key) {
    routingModeRegistry.set(String(key), mode);
  }
}

export function getApplicationRoutingMode(key, defaultMode = null) {
  if (!key) return defaultMode;
  return routingModeRegistry.get(String(key)) || defaultMode;
}

export function clearApplicationRoutingModes() {
  routingModeRegistry.clear();
}

export class RuntimeSelectionService {
  /**
   * @param {object} [options]
   * @param {import('@prisma/client').PrismaClient} [options.prismaClient]
   * @param {object} [options.healthMonitor]
   */
  constructor(options = {}) {
    this.prisma = options.prismaClient || getPrismaClient();
    this.healthMonitor = options.healthMonitor || null;
  }

  /**
   * Evaluates candidate deception runtime environments and selects an eligible one.
   *
   * @param {object} params
   * @param {string} params.tenantId
   * @param {string} [params.applicationId]
   * @param {string} [params.strategyId]
   * @param {number} [params.dsgGraphVersion]
   * @param {string} [params.routingMode='SHADOW']
   * @param {boolean} [params.forceLiveCheck=false]
   * @returns {Promise<{
   *   eligible: boolean,
   *   environment: object|null,
   *   reasonCode: string,
   *   rejectionReason: string|null,
   *   safetyChecks: {
   *     tenantOwnershipVerified: boolean,
   *     applicationVerified: boolean,
   *     runtimeHealthVerified: boolean,
   *     authorizationVerified: boolean,
   *     networkIsolationVerified: boolean,
   *     hostBoundaryVerified: boolean,
   *     dsgGraphVersionVerified: boolean,
   *     rollbackReadinessVerified: boolean
   *   }
   * }>}
   */
  async selectRuntimeEnvironment(params) {
    const {
      tenantId,
      applicationId = null,
      strategyId = null,
      dsgGraphVersion = null,
      routingMode = ROUTING_MODES.SHADOW,
      forceLiveCheck = false
    } = params;

    const safetyChecks = {
      tenantOwnershipVerified: false,
      applicationVerified: false,
      runtimeHealthVerified: false,
      authorizationVerified: false,
      networkIsolationVerified: false,
      hostBoundaryVerified: false,
      dsgGraphVersionVerified: false,
      rollbackReadinessVerified: false
    };

    if (!tenantId) {
      return {
        eligible: false,
        environment: null,
        reasonCode: RUNTIME_REJECTION_REASONS.CROSS_TENANT_MISMATCH,
        rejectionReason: 'Tenant ID must be specified for runtime selection.',
        safetyChecks
      };
    }

    // 1. Fetch Candidate Environments for Tenant
    const whereClause = {
      tenantId,
      lifecycleState: { in: ['ACTIVE', 'UPDATING'] }
    };

    if (applicationId) {
      whereClause.OR = [{ applicationId }, { applicationId: null }];
    }

    const candidateEnvironments = await this.prisma.deceptionRuntimeEnvironment.findMany({
      where: whereClause,
      include: {
        authorization: true,
        graph: true
      },
      orderBy: { updatedAt: 'desc' }
    });

    if (candidateEnvironments.length === 0) {
      return {
        eligible: false,
        environment: null,
        reasonCode: RUNTIME_REJECTION_REASONS.NO_RUNTIME_CONFIGURED,
        rejectionReason: `No active deception runtime environment provisioned for tenant "${tenantId}".`,
        safetyChecks
      };
    }

    let lastRejection = null;

    // 2. Evaluate Each Candidate against Safety & Health Invariants
    for (const env of candidateEnvironments) {
      const currentChecks = {
        tenantOwnershipVerified: false,
        applicationVerified: false,
        runtimeHealthVerified: false,
        authorizationVerified: false,
        networkIsolationVerified: false,
        hostBoundaryVerified: false,
        dsgGraphVersionVerified: false,
        rollbackReadinessVerified: false
      };

      // 2a. Tenant Ownership Verification
      if (env.tenantId !== tenantId) {
        lastRejection = {
          reasonCode: RUNTIME_REJECTION_REASONS.CROSS_TENANT_MISMATCH,
          rejectionReason: `Tenant mismatch for environment "${env.id}".`
        };
        continue;
      }
      currentChecks.tenantOwnershipVerified = true;

      // 2b. Application Verification
      if (applicationId && env.applicationId && env.applicationId !== applicationId) {
        lastRejection = {
          reasonCode: RUNTIME_REJECTION_REASONS.NO_COMPATIBLE_RUNTIME,
          rejectionReason: `Environment "${env.id}" is bound to another application.`
        };
        continue;
      }
      currentChecks.applicationVerified = true;

      // 2c. Strategy Compatibility
      if (strategyId && env.strategyIdentifier && env.strategyIdentifier !== strategyId) {
        if (candidateEnvironments.length > 1) {
          lastRejection = {
            reasonCode: RUNTIME_REJECTION_REASONS.NO_COMPATIBLE_RUNTIME,
            rejectionReason: `Strategy "${strategyId}" incompatible with environment.`
          };
          continue;
        }
      }

      // 2d. Runtime Health Verification
      let healthStatus = env.healthStatus || 'UNKNOWN';
      if (forceLiveCheck && this.healthMonitor) {
        try {
          const inspection = await this.healthMonitor.inspectEnvironmentHealth({
            tenantId,
            environmentId: env.id,
            forceLive: true
          });
          healthStatus = inspection.healthState || healthStatus;
        } catch (healthErr) {
          logger.warn('Failed live health check during runtime selection', {
            environmentId: env.id,
            error: healthErr.message
          });
        }
      }

      if (['UNHEALTHY', 'TERMINATED'].includes(healthStatus)) {
        lastRejection = {
          reasonCode: healthStatus === 'TERMINATED'
            ? RUNTIME_REJECTION_REASONS.RUNTIME_TERMINATED
            : RUNTIME_REJECTION_REASONS.RUNTIME_UNHEALTHY,
          rejectionReason: `Target environment "${env.id}" health state is "${healthStatus}".`
        };
        continue;
      }

      if (healthStatus === 'UNKNOWN') {
        lastRejection = {
          reasonCode: RUNTIME_REJECTION_REASONS.RUNTIME_UNKNOWN_HEALTH,
          rejectionReason: `Target environment "${env.id}" has UNKNOWN health status.`
        };
        continue;
      }

      if (healthStatus === 'DEGRADED') {
        // Explicit strategy-specific eligibility check:
        // DEGRADED runtimes are rejected by default.
        // A degraded runtime is ONLY eligible if the REQUEST specifically matches a degraded-tolerant strategy
        // AND the environment matches that strategy AND prerequisites are met.
        const isRequestedStrategyTolerant = Boolean(strategyId && DEGRADED_TOLERANT_STRATEGIES.includes(strategyId));
        const isEnvStrategyTolerant = Boolean(env.strategyIdentifier && DEGRADED_TOLERANT_STRATEGIES.includes(env.strategyIdentifier));
        const prereqsMet = Boolean(
          env.runtimeEvidence &&
          (env.runtimeEvidence.degradedPrerequisitesMet === true || env.runtimeEvidence.allowDegradedOperation === true)
        );

        if (!isRequestedStrategyTolerant || !isEnvStrategyTolerant || !prereqsMet) {
          lastRejection = {
            reasonCode: RUNTIME_REJECTION_REASONS.RUNTIME_DEGRADED_DISQUALIFIED,
            rejectionReason: `Target environment "${env.id}" is in DEGRADED status. Degraded runtimes are rejected by default unless the request explicitly requires a validated degraded-tolerant strategy (requested=${strategyId}, env=${env.strategyIdentifier}, prereqsMet=${prereqsMet}).`
          };
          continue;
        }

        currentChecks.runtimeHealthVerified = true;
      } else if (healthStatus === 'HEALTHY') {
        currentChecks.runtimeHealthVerified = true;
      } else {
        lastRejection = {
          reasonCode: RUNTIME_REJECTION_REASONS.RUNTIME_UNKNOWN_HEALTH,
          rejectionReason: `Target environment "${env.id}" has unhandled health state "${healthStatus}".`
        };
        continue;
      }

      // 2e. Execution Authorization Verification
      const auth = env.authorization;
      if (!auth) {
        lastRejection = {
          reasonCode: RUNTIME_REJECTION_REASONS.AUTHORIZATION_NOT_FOUND,
          rejectionReason: `Target environment "${env.id}" has no bound execution authorization.`
        };
        continue;
      }

      if (auth.authorizationStatus === 'REVOKED') {
        lastRejection = {
          reasonCode: RUNTIME_REJECTION_REASONS.AUTHORIZATION_REVOKED,
          rejectionReason: `Authorization "${auth.id}" is REVOKED.`
        };
        continue;
      }

      if (auth.authorizationStatus !== 'APPROVED') {
        lastRejection = {
          reasonCode: RUNTIME_REJECTION_REASONS.AUTHORIZATION_NOT_APPROVED,
          rejectionReason: `Authorization "${auth.id}" is in status "${auth.authorizationStatus}".`
        };
        continue;
      }

      if (auth.expiresAt && new Date(auth.expiresAt) < new Date()) {
        lastRejection = {
          reasonCode: RUNTIME_REJECTION_REASONS.AUTHORIZATION_EXPIRED,
          rejectionReason: `Authorization "${auth.id}" expired at ${auth.expiresAt.toISOString()}.`
        };
        continue;
      }

      currentChecks.authorizationVerified = true;

      // 2f. DSG Graph Version Verification
      if (dsgGraphVersion !== null && dsgGraphVersion !== undefined) {
        if (env.dsgGraphVersion !== dsgGraphVersion && env.dsgGraphVersion < dsgGraphVersion) {
          lastRejection = {
            reasonCode: RUNTIME_REJECTION_REASONS.STALE_GRAPH_VERSION,
            rejectionReason: `Environment graph version (${env.dsgGraphVersion}) does not match requested version (${dsgGraphVersion}).`
          };
          continue;
        }
      }
      currentChecks.dsgGraphVersionVerified = true;

      // 2g. Network Isolation Verification
      const networkMode = env.networkIsolationMode || 'SANDBOX_ISOLATED';
      currentChecks.networkIsolationVerified = networkMode === 'SANDBOX_ISOLATED' || networkMode === 'STRICT_AIRGAP';

      // 2h. Host Boundary Verification (Hard Blocker Check)
      const runtimeEvidence = env.runtimeEvidence || {};
      const hostBoundaryFinding = runtimeEvidence.hostBoundaryFinding || null;
      const firewallDropRuleApplied = runtimeEvidence.firewallDropRuleApplied === true;
      currentChecks.hostBoundaryVerified = !hostBoundaryFinding && firewallDropRuleApplied;

      // 2i. Rollback Readiness Verification
      const stateSnapshot = env.syntheticStateSnapshot;
      currentChecks.rollbackReadinessVerified = Boolean(stateSnapshot || env.dsgGraphVersion >= 1);

      // In CONTROLLED_LAB mode, ALL mandatory safety conditions must pass!
      if (routingMode === ROUTING_MODES.CONTROLLED_LAB) {
        if (!currentChecks.hostBoundaryVerified) {
          lastRejection = {
            reasonCode: RUNTIME_REJECTION_REASONS.HOST_BOUNDARY_UNVERIFIED,
            rejectionReason: 'CONTROLLED_LAB_BLOCKED: Unresolved host INPUT firewall rule (Finding A) is a hard activation blocker.'
          };
          continue;
        }

        if (!currentChecks.networkIsolationVerified) {
          lastRejection = {
            reasonCode: RUNTIME_REJECTION_REASONS.NETWORK_ISOLATION_INCOMPLETE,
            rejectionReason: 'CONTROLLED_LAB_BLOCKED: Network isolation mode unverified.'
          };
          continue;
        }

        if (!currentChecks.rollbackReadinessVerified) {
          lastRejection = {
            reasonCode: RUNTIME_REJECTION_REASONS.ROLLBACK_NOT_READY,
            rejectionReason: 'CONTROLLED_LAB_BLOCKED: Rollback snapshot readiness check failed.'
          };
          continue;
        }
      }

      return {
        eligible: true,
        environment: env,
        reasonCode: 'RUNTIME_ELIGIBLE',
        rejectionReason: null,
        safetyChecks: currentChecks
      };
    }

    return {
      eligible: false,
      environment: null,
      reasonCode: lastRejection?.reasonCode || RUNTIME_REJECTION_REASONS.NO_COMPATIBLE_RUNTIME,
      rejectionReason: lastRejection?.rejectionReason || 'No runtime environment satisfied all compatibility constraints.',
      safetyChecks
    };
  }

  /**
   * Helper to perform a comprehensive safety audit check of an environment
   * against all mandatory conditions for CONTROLLED_LAB mode.
   *
   * @param {string} environmentId
   * @param {string} tenantId
   * @returns {Promise<{
   *   isReady: boolean,
   *   status: 'CONTROLLED_LAB_READY' | 'CONTROLLED_LAB_BLOCKED',
   *   blockers: string[],
   *   checklist: Record<string, boolean>
   * }>}
   */
  async checkControlledLabReadiness(environmentId, tenantId) {
    const env = await this.prisma.deceptionRuntimeEnvironment.findFirst({
      where: { id: environmentId, tenantId },
      include: { authorization: true, application: true }
    });

    const blockers = [];
    const checklist = {
      adminActivation: false,
      applicationConfigured: false,
      tenantOwnershipVerified: false,
      runtimeAuthorizationVerified: false,
      runtimeHealthVerified: false,
      networkIsolationVerified: false,
      hostBoundaryVerified: false,
      environmentIdentityVerified: false,
      validGraphVersion: false,
      validRoutingPolicy: false,
      rollbackReadinessVerified: false
    };

    if (!env) {
      blockers.push('Environment not found for tenant.');
      return { isReady: false, status: 'CONTROLLED_LAB_BLOCKED', blockers, checklist };
    }

    checklist.tenantOwnershipVerified = env.tenantId === tenantId;
    checklist.environmentIdentityVerified = Boolean(env.containerId || env.isSimulated);
    checklist.applicationConfigured = Boolean(env.applicationId || env.application);
    checklist.runtimeAuthorizationVerified = env.authorization?.authorizationStatus === 'APPROVED' &&
      new Date(env.authorization.expiresAt) > new Date();
    const isDegradedTolerant = env.healthStatus === 'DEGRADED' &&
      DEGRADED_TOLERANT_STRATEGIES.includes(env.strategyIdentifier) &&
      Boolean(env.runtimeEvidence?.degradedPrerequisitesMet || env.runtimeEvidence?.allowDegradedOperation);
    checklist.runtimeHealthVerified = env.healthStatus === 'HEALTHY' || isDegradedTolerant;
    checklist.networkIsolationVerified = ['SANDBOX_ISOLATED', 'STRICT_AIRGAP'].includes(env.networkIsolationMode);
    checklist.validGraphVersion = env.dsgGraphVersion >= 1;
    checklist.rollbackReadinessVerified = Boolean(env.syntheticStateSnapshot || env.dsgGraphVersion >= 1);

    // Host boundary verification: Finding A is a hard blocker
    const runtimeEvidence = env.runtimeEvidence || {};
    checklist.hostBoundaryVerified = runtimeEvidence.firewallDropRuleApplied === true && !runtimeEvidence.hostBoundaryFinding;

    // Check policy
    const policy = await this.prisma.deceptionPolicy.findFirst({
      where: { tenantId, enabled: true }
    });
    checklist.validRoutingPolicy = Boolean(policy);

    // Explicit platform admin activation
    checklist.adminActivation = runtimeEvidence.adminLabActivationApproved === true;

    for (const [key, passed] of Object.entries(checklist)) {
      if (!passed) {
        if (key === 'hostBoundaryVerified') {
          blockers.push('Unresolved host INPUT firewall finding (Stage 5B.2.2 Finding A).');
        } else if (key === 'adminActivation') {
          blockers.push('Missing explicit platform administrator activation approval.');
        } else {
          blockers.push(`Condition "${key}" not satisfied.`);
        }
      }
    }

    const isReady = blockers.length === 0;
    return {
      isReady,
      status: isReady ? 'CONTROLLED_LAB_READY' : 'CONTROLLED_LAB_BLOCKED',
      blockers,
      checklist
    };
  }
}
