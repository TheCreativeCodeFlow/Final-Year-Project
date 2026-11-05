/**
 * Runtime State Manager Service (Stage 5B.1).
 *
 * Maintains the coherent relationship across:
 * - Policy Decision
 * - Deception State Graph & Topology Version
 * - Deception Strategy
 * - Execution Authorization
 * - Runtime Environment
 * - Synthetic State Model
 * - Execution Evidence
 *
 * Guarantees that runtime state never silently diverges from the underlying DSG model
 * and that mutations against stale graph versions are detected and prevented.
 */

import { getPrismaClient } from '../db/client.js';

export class RuntimeStateManager {
  constructor(prismaClient = null) {
    this.prisma = prismaClient;
  }

  getDb() {
    return this.prisma || getPrismaClient();
  }

  /**
   * Retrieve full relational state mapping for an environment.
   *
   * @param {Object} params
   * @param {string} params.environmentId
   * @param {string} params.tenantId
   * @returns {Promise<Object>}
   */
  async getStateMapping({ environmentId, tenantId }) {
    const prisma = this.getDb();
    const env = await prisma.deceptionRuntimeEnvironment.findFirst({
      where: { id: environmentId, tenantId },
      include: {
        application: true,
        graph: {
          include: {
            nodes: true,
            edges: true
          }
        },
        authorization: {
          include: {
            policyDecision: {
              include: {
                policy: true,
                selectedStrategy: true
              }
            }
          }
        },
        mutations: {
          orderBy: { proposedAt: 'desc' },
          take: 10
        },
        events: {
          orderBy: { recordedAt: 'desc' },
          take: 20
        }
      }
    });

    if (!env) {
      const err = new Error(`Environment "${environmentId}" not found for this tenant.`);
      err.code = 'ENVIRONMENT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    const currentGraphVersion = env.graph?.graphVersion ?? null;
    const environmentGraphVersion = env.dsgGraphVersion;
    const isDrifted = currentGraphVersion !== null && currentGraphVersion !== environmentGraphVersion;

    return {
      environmentId: env.id,
      environmentIdentifier: env.environmentIdentifier,
      lifecycleState: env.lifecycleState,
      tenantId: env.tenantId,
      applicationId: env.applicationId,
      graphBinding: {
        graphId: env.dsgGraphId,
        boundGraphVersion: environmentGraphVersion,
        currentGraphVersion,
        isDrifted,
        driftReason: isDrifted
          ? `Graph topology has progressed to version ${currentGraphVersion}, but environment is bound to version ${environmentGraphVersion}.`
          : null
      },
      authorizationBinding: {
        authorizationId: env.authorization.id,
        status: env.authorization.authorizationStatus,
        authorizedAt: env.authorization.authorizedAt,
        expiresAt: env.authorization.expiresAt
      },
      policyBinding: {
        decisionId: env.authorization.policyDecision.id,
        decisionResult: env.authorization.policyDecision.decisionResult,
        deceptionDisposition: env.authorization.policyDecision.deceptionDisposition,
        policyId: env.authorization.policyDecision.policyId,
        policyVersion: env.authorization.policyDecision.policyVersion
      },
      strategyBinding: {
        strategyIdentifier: env.strategyIdentifier,
        strategyId: env.authorization.selectedStrategyId
      },
      evidenceBinding: {
        executionEvidenceStatus: env.executionEvidenceStatus,
        isSimulated: env.isSimulated
      },
      syntheticStateSnapshot: env.syntheticStateSnapshot
    };
  }

  /**
   * Validate state coherence between the runtime environment and current database models.
   *
   * @param {Object} params
   * @param {string} params.environmentId
   * @param {string} params.tenantId
   * @returns {Promise<{
   *   coherent: boolean,
   *   discrepancies: string[],
   *   details: Object
   * }>}
   */
  async validateStateCoherence({ environmentId, tenantId }) {
    const mapping = await this.getStateMapping({ environmentId, tenantId });
    const discrepancies = [];

    // Check 1: Graph version drift
    if (mapping.graphBinding.isDrifted) {
      discrepancies.push(mapping.graphBinding.driftReason);
    }

    // Check 2: Authorization expiration
    if (new Date() > new Date(mapping.authorizationBinding.expiresAt)) {
      discrepancies.push('Execution authorization has expired.');
    }

    // Check 3: Authorization status must be APPROVED
    if (mapping.authorizationBinding.status !== 'APPROVED') {
      discrepancies.push(`Authorization status is "${mapping.authorizationBinding.status}". Expected APPROVED.`);
    }

    // Check 4: Deception disposition must be PROPOSED
    const disp = mapping.policyBinding.deceptionDisposition;
    if (disp !== 'PROPOSED' && disp !== 'PROPOSE_DECEPTION') {
      discrepancies.push(`Policy decision disposition is "${disp}". Expected PROPOSED.`);
    }

    const coherent = discrepancies.length === 0;

    return {
      coherent,
      discrepancies,
      details: mapping
    };
  }
}
