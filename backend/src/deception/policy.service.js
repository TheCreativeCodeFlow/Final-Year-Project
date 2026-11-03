/**
 * Deception Policy Management Service (Stage 5A).
 *
 * Provides tenant- and application-scoped deception policy resolution and CRUD.
 * Supports:
 * - Priority (1 highest to 1000 lowest)
 * - Applicable classifications
 * - Minimum assessment confidence
 * - Required telemetry quality
 * - Session correlation confidence
 * - Collision risk limits
 * - Rule corroboration requirement
 * - Allowed strategies
 * - Versioning and audit provenance
 */

import { getPrismaClient } from '../db/client.js';
import { recordSecurityAudit } from '../utils/audit.js';

export class PolicyService {
  constructor(prisma = null) {
    this.prisma = prisma;
  }

  getDb() {
    return this.prisma || getPrismaClient();
  }

  /**
   * Resolve the active policy for an assessment and application.
   * Checks application-specific policies first, then tenant-wide, then platform baselines.
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
      },
      orderBy: [{ priority: 'asc' }, { version: 'desc' }, { createdAt: 'desc' }]
    });

    if (policies.length === 0) {
      return null;
    }

    // Filter by applicationId and classification
    for (const policy of policies) {
      // If policy is scoped to a specific application, must match
      if (policy.applicationId && applicationId && policy.applicationId !== applicationId) {
        continue;
      }

      // Check classification match if specified
      if (classification) {
        const criteria = policy.requiredEvidenceCriteria || {};
        const allowedClassifications = criteria.applicableClassifications;
        if (
          Array.isArray(allowedClassifications) &&
          allowedClassifications.length > 0 &&
          !allowedClassifications.includes(classification)
        ) {
          continue;
        }
      }

      return policy;
    }

    // Default to the highest priority active policy if no specific filter excluded it
    return policies[0] || null;
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
        orderBy: [{ priority: 'asc' }, { version: 'desc' }]
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
        priority: Number(payload.priority) || 100,
        version: 1,
        triggerConditions: payload.triggerConditions || {},
        requiredEvidenceCriteria: payload.requiredEvidenceCriteria || {
          minConfidence: 0.75,
          requiredTelemetryQuality: 'COMPLETE',
          minCorrelationConfidence: 0.65,
          requireRuleCorroboration: true,
          applicableClassifications: ['ATTACK']
        },
        permittedActions: payload.permittedActions || ['PROPOSE_DECEPTION', 'ALLOW_NORMAL'],
        prohibitedActions: payload.prohibitedActions || ['RUN_ARBITRARY_COMMAND', 'EXFILTRATE_DATA'],
        protectedIsolationConstraints: payload.protectedIsolationConstraints || {
          strictNamespaceIsolation: true,
          noOutboundEgress: true
        }
      }
    });

    await recordSecurityAudit({
      prisma,
      tenantId,
      actorIdentifier: actorIdentifier || 'SYSTEM_OPERATOR',
      action: 'DECEPTION_POLICY_CREATED',
      targetEntityType: 'DeceptionPolicy',
      targetEntityId: policy.id,
      metadata: { policyIdentifier: policy.policyIdentifier, version: policy.version, priority: policy.priority }
    });

    return policy;
  }

  /**
   * Update a tenant-scoped deception policy (increments version).
   */
  async updatePolicy({ policyId, tenantId, payload, actorIdentifier = null }) {
    const prisma = this.getDb();
    const existing = await prisma.deceptionPolicy.findUnique({ where: { id: policyId } });

    if (!existing) return null;
    if (existing.tenantId !== tenantId) {
      throw new Error('TENANT_FORBIDDEN: Cannot modify policies belonging to other tenants or platform baselines.');
    }

    const updated = await prisma.deceptionPolicy.update({
      where: { id: policyId },
      data: {
        name: payload.name ?? existing.name,
        description: payload.description ?? existing.description,
        enabled: payload.enabled ?? existing.enabled,
        priority: payload.priority ? Number(payload.priority) : existing.priority,
        applicationId: payload.applicationId !== undefined ? payload.applicationId : existing.applicationId,
        triggerConditions: payload.triggerConditions ?? existing.triggerConditions,
        requiredEvidenceCriteria: payload.requiredEvidenceCriteria ?? existing.requiredEvidenceCriteria,
        permittedActions: payload.permittedActions ?? existing.permittedActions,
        prohibitedActions: payload.prohibitedActions ?? existing.prohibitedActions,
        protectedIsolationConstraints: payload.protectedIsolationConstraints ?? existing.protectedIsolationConstraints,
        version: existing.version + 1
      }
    });

    await recordSecurityAudit({
      prisma,
      tenantId,
      actorIdentifier: actorIdentifier || 'SYSTEM_OPERATOR',
      action: 'DECEPTION_POLICY_UPDATED',
      targetEntityType: 'DeceptionPolicy',
      targetEntityId: updated.id,
      metadata: { previousVersion: existing.version, newVersion: updated.version }
    });

    return updated;
  }
}
