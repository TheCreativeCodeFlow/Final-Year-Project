/**
 * Deception Policy Management Service (Stage 5A & Stage 5A.1).
 *
 * Provides tenant- and application-scoped deception policy resolution and CRUD.
 * Supports:
 * - Deterministic Priority & Conflict Resolution:
 *   1. Scope Specificity: Application-specific policies strictly precede tenant-wide policies.
 *   2. Tenant Precedence: Tenant policies precede platform-wide baselines.
 *   3. Priority Ordering: Lower numerical priority takes precedence (1 = highest, 1000 = lowest).
 *   4. Version Precedence: Higher version takes precedence if priority is equal.
 *   5. Deterministic Collation: Alphabetical policyIdentifier tie-breaker for identical priorities.
 *   6. Active Gating: Disabled policies are strictly ignored.
 * - Comprehensive Conflict Accounting & Provenance
 */

import { getPrismaClient } from '../db/client.js';
import { recordSecurityAudit } from '../utils/audit.js';

export const POLICY_RESOLUTION_RULES = {
  SCOPE_THEN_PRIORITY: 'SCOPE_SPECIFICITY_THEN_PRIORITY_ASC_VERSION_DESC_IDENTIFIER_ASC'
};

export class PolicyService {
  constructor(prisma = null) {
    this.prisma = prisma;
  }

  getDb() {
    return this.prisma || getPrismaClient();
  }

  /**
   * Deterministically resolve an applicable policy from a collection of candidate policies.
   * Can be used with database results or purely in-memory in test/simulation scenarios.
   *
   * @param {Array} policies
   * @param {Object} context
   * @param {string} [context.tenantId]
   * @param {string} [context.applicationId]
   * @param {string} [context.classification]
   * @returns {{
   *   policy: Object|null,
   *   conflictResolution: {
   *     candidatesConsidered: Array,
   *     selectedPolicyId: string|null,
   *     resolutionRule: string,
   *     resolutionReason: string
   *   }
   * }}
   */
  static resolvePolicyDeterministically(policies = [], { tenantId = null, applicationId = null, classification = null } = {}) {
    // 1. Filter only enabled policies
    const activePolicies = policies.filter((p) => p.enabled !== false);

    if (activePolicies.length === 0) {
      return {
        policy: null,
        conflictResolution: {
          candidatesConsidered: [],
          selectedPolicyId: null,
          resolutionRule: POLICY_RESOLUTION_RULES.SCOPE_THEN_PRIORITY,
          resolutionReason: 'No active policies available.'
        }
      };
    }

    // 2. Filter by classification compatibility if specified
    const matchingPolicies = activePolicies.filter((policy) => {
      // Tenant boundary check if tenantId is specified
      if (tenantId && policy.tenantId && policy.tenantId !== tenantId) {
        return false;
      }

      // Application boundary check: if policy is application-specific, it only matches that app
      if (policy.applicationId && applicationId && policy.applicationId !== applicationId) {
        return false;
      }
      if (policy.applicationId && !applicationId) {
        // App-specific policy cannot match a generic request without application context
        return false;
      }

      // Classification check
      if (classification) {
        const criteria = policy.requiredEvidenceCriteria || {};
        const allowedClassifications = criteria.applicableClassifications;
        if (
          Array.isArray(allowedClassifications) &&
          allowedClassifications.length > 0 &&
          !allowedClassifications.includes(classification)
        ) {
          return false;
        }
      }

      return true;
    });

    if (matchingPolicies.length === 0) {
      return {
        policy: null,
        conflictResolution: {
          candidatesConsidered: activePolicies.map((p) => ({
            id: p.id,
            policyIdentifier: p.policyIdentifier,
            reason: 'Excluded due to classification or application scope mismatch'
          })),
          selectedPolicyId: null,
          resolutionRule: POLICY_RESOLUTION_RULES.SCOPE_THEN_PRIORITY,
          resolutionReason: 'All active policies were excluded by scope or classification filters.'
        }
      };
    }

    // 3. Assign Tier Score:
    // Tier 1: Application-specific tenant policy (score 300)
    // Tier 2: Tenant-wide policy (score 200)
    // Tier 3: Platform baseline (score 100)
    const getTierScore = (p) => {
      if (p.applicationId && p.tenantId) return 300;
      if (p.tenantId) return 200;
      return 100;
    };

    // 4. Deterministic Multi-key Sorting
    matchingPolicies.sort((a, b) => {
      // 1. Tier score descending (app-specific beats tenant-wide beats baseline)
      const tierA = getTierScore(a);
      const tierB = getTierScore(b);
      if (tierA !== tierB) return tierB - tierA;

      // 2. Priority ascending (1 is higher priority than 100)
      const prioA = Number(a.priority ?? 100);
      const prioB = Number(b.priority ?? 100);
      if (prioA !== prioB) return prioA - prioB;

      // 3. Version descending (higher version wins on equal priority)
      const verA = Number(a.version ?? 1);
      const verB = Number(b.version ?? 1);
      if (verA !== verB) return verB - verA;

      // 4. Alphabetical tie-breaker on policyIdentifier
      const idA = String(a.policyIdentifier || a.id || '');
      const idB = String(b.policyIdentifier || b.id || '');
      return idA.localeCompare(idB);
    });

    const chosen = matchingPolicies[0];
    const candidateSummary = matchingPolicies.map((p) => ({
      id: p.id,
      policyIdentifier: p.policyIdentifier,
      name: p.name,
      priority: p.priority,
      version: p.version,
      applicationId: p.applicationId,
      tierScore: getTierScore(p)
    }));

    let reason = `Selected "${chosen.policyIdentifier}" (priority: ${chosen.priority}, v${chosen.version}) via deterministic resolution rule.`;
    if (matchingPolicies.length > 1) {
      if (getTierScore(chosen) > getTierScore(matchingPolicies[1])) {
        reason += ` Application-specific scope took precedence over tenant-wide policy.`;
      } else if (chosen.priority !== matchingPolicies[1].priority) {
        reason += ` Priority ${chosen.priority} took precedence over ${matchingPolicies[1].priority}.`;
      } else {
        reason += ` Resolved tie with version/identifier collation order.`;
      }
    }

    return {
      policy: chosen,
      conflictResolution: {
        candidatesConsidered: candidateSummary,
        selectedPolicyId: chosen.id,
        resolutionRule: POLICY_RESOLUTION_RULES.SCOPE_THEN_PRIORITY,
        resolutionReason: reason
      }
    };
  }

  /**
   * Resolve the active policy for an assessment and application from database.
   *
   * @param {Object} params
   * @param {string} params.tenantId
   * @param {string} [params.applicationId]
   * @param {string} [params.classification]
   * @returns {Promise<Object|null>}
   */
  async resolveApplicablePolicy({ tenantId, applicationId = null, classification = null }) {
    const prisma = this.getDb();

    // Query active policies for this tenant and platform baselines
    const policies = await prisma.deceptionPolicy.findMany({
      where: {
        enabled: true,
        OR: [{ tenantId }, { tenantId: null }]
      }
    });

    const resolution = PolicyService.resolvePolicyDeterministically(policies, {
      tenantId,
      applicationId,
      classification
    });

    if (resolution.policy) {
      // Attach conflict resolution provenance to the returned policy object for audit
      return {
        ...resolution.policy,
        _conflictResolution: resolution.conflictResolution
      };
    }

    return null;
  }

  /**
   * List policies accessible by tenant (tenant policies + platform baselines).
   */
  async listPolicies({ tenantId, enabled, applicationId, page = 1, limit = 50 }) {
    const prisma = this.getDb();
    const skip = (Math.max(1, page) - 1) * limit;

    const where = {
      OR: [{ tenantId }, { tenantId: null }]
    };

    if (enabled !== undefined) {
      where.enabled = Boolean(enabled);
    }

    if (applicationId) {
      where.OR = [
        { tenantId, applicationId },
        { tenantId, applicationId: null },
        { tenantId: null }
      ];
    }

    const [policies, total] = await Promise.all([
      prisma.deceptionPolicy.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ priority: 'asc' }, { version: 'desc' }, { policyIdentifier: 'asc' }]
      }),
      prisma.deceptionPolicy.count({ where })
    ]);

    return { policies, total, page, limit };
  }

  /**
   * Retrieve a policy by ID, enforcing tenant scoping.
   */
  async getPolicyById({ policyId, tenantId }) {
    const prisma = this.getDb();
    const policy = await prisma.deceptionPolicy.findUnique({
      where: { id: policyId }
    });

    if (!policy) return null;

    // Tenant can read their own or platform baseline (tenantId === null)
    if (policy.tenantId && policy.tenantId !== tenantId) {
      return null;
    }

    return policy;
  }

  /**
   * Create a new tenant-scoped deception policy.
   */
  async createPolicy({ tenantId, payload, actorIdentifier = null }) {
    const prisma = this.getDb();

    const policy = await prisma.deceptionPolicy.create({
      data: {
        tenantId,
        applicationId: payload.applicationId || null,
        policyIdentifier: payload.policyIdentifier,
        name: payload.name,
        description: payload.description || null,
        enabled: payload.enabled !== undefined ? payload.enabled : true,
        priority: payload.priority ? Number(payload.priority) : 100,
        triggerConditions: payload.triggerConditions || {},
        requiredEvidenceCriteria: payload.requiredEvidenceCriteria || {},
        permittedActions: payload.permittedActions || ['PROPOSE_DECEPTION'],
        prohibitedActions: payload.prohibitedActions || [],
        protectedIsolationConstraints: payload.protectedIsolationConstraints || { strictNamespaceIsolation: true, noOutboundEgress: true },
        version: 1
      }
    });

    await recordSecurityAudit({
      prisma,
      tenantId,
      actorIdentifier,
      action: 'DECEPTION_POLICY_CREATED',
      targetEntityType: 'DeceptionPolicy',
      targetEntityId: policy.id,
      metadata: {
        policyIdentifier: policy.policyIdentifier,
        priority: policy.priority,
        applicationId: policy.applicationId
      }
    });

    return policy;
  }

  /**
   * Update an existing policy, incrementing version and verifying tenant ownership.
   */
  async updatePolicy({ policyId, tenantId, payload, actorIdentifier = null }) {
    const prisma = this.getDb();

    const existing = await prisma.deceptionPolicy.findUnique({
      where: { id: policyId }
    });

    if (!existing) return null;

    if (existing.tenantId !== tenantId) {
      throw new Error(`TENANT_FORBIDDEN: Tenant "${tenantId}" cannot modify policy "${policyId}".`);
    }

    const updated = await prisma.deceptionPolicy.update({
      where: { id: policyId },
      data: {
        name: payload.name !== undefined ? payload.name : existing.name,
        description: payload.description !== undefined ? payload.description : existing.description,
        enabled: payload.enabled !== undefined ? payload.enabled : existing.enabled,
        priority: payload.priority !== undefined ? Number(payload.priority) : existing.priority,
        requiredEvidenceCriteria: payload.requiredEvidenceCriteria !== undefined ? payload.requiredEvidenceCriteria : existing.requiredEvidenceCriteria,
        permittedActions: payload.permittedActions !== undefined ? payload.permittedActions : existing.permittedActions,
        version: existing.version + 1
      }
    });

    await recordSecurityAudit({
      prisma,
      tenantId,
      actorIdentifier,
      action: 'DECEPTION_POLICY_UPDATED',
      targetEntityType: 'DeceptionPolicy',
      targetEntityId: updated.id,
      metadata: {
        policyIdentifier: updated.policyIdentifier,
        previousVersion: existing.version,
        newVersion: updated.version,
        updatedFields: Object.keys(payload)
      }
    });

    return updated;
  }
}
