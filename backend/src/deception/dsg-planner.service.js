/**
 * Deception State Graph (DSG) Planner Service (Stage 5A).
 *
 * Models adaptive deception environments across 3 strict layers:
 * 1. PROTECTED_DECEPTION_POLICY: Boundary rules, containment policies, isolation constraints
 * 2. CONTROLLED_DYNAMIC_STATE: Synthetic endpoints, honey credentials, fake databases, decoy services
 * 3. OBSERVATIONAL_ATTACKER_STATE: Attacker probe trajectories, session tracks, canary tripwires
 *
 * Core Research Invariant:
 * Proposed DSG mutations are NEVER executed transitions.
 * Live environments are NOT provisioned; execution evidence status remains strictly MISSING.
 */

export const DSG_LAYERS = {
  PROTECTED_DECEPTION_POLICY: 'PROTECTED_DECEPTION_POLICY',
  CONTROLLED_DYNAMIC_STATE: 'CONTROLLED_DYNAMIC_STATE',
  OBSERVATIONAL_ATTACKER_STATE: 'OBSERVATIONAL_ATTACKER_STATE'
};

export const TRANSITION_STATUSES = {
  PROPOSED: 'PROPOSED',
  VALIDATED: 'VALIDATED',
  REJECTED: 'REJECTED',
  PENDING_EXECUTION: 'PENDING_EXECUTION'
};

export class DSGPlannerService {
  /**
   * Validate that all nodes in a proposal belong strictly to one of the 3 supported layers.
   * @param {Array} nodes
   * @returns {boolean}
   */
  static validateLayerClassifications(nodes = []) {
    const validLayers = Object.values(DSG_LAYERS);
    return nodes.every((n) => validLayers.includes(n.layerClassification));
  }

  /**
   * Generate a proposed Deception State Graph mutation plan.
   * @param {Object} params
   * @param {Object} [params.currentGraph] - Existing graph with nodes, edges, transitions
   * @param {Object} params.strategy - Selected DeceptionStrategy record
   * @param {Object} params.assessment - BehavioralAssessment
   * @param {Object} params.policy - DeceptionPolicy
   * @param {string} params.tenantId
   * @param {string} [params.applicationId]
   * @returns {{
   *   status: string,
   *   planId: string,
   *   previousState: Object,
   *   proposedState: Object,
   *   nodesToAdd: Array,
   *   edgesToAdd: Array,
   *   syntheticEnvironmentModel: Object,
   *   validationResult: { valid: boolean, violations: string[] },
   *   nonExecutionNotice: string
   * }}
   */
  planMutation({
    currentGraph = null,
    strategy,
    assessment = {},
    policy = {},
    tenantId,
    applicationId = null
  }) {
    if (!strategy) {
      throw new Error('DSG planning requires a valid selected strategy.');
    }

    const currentNodes = currentGraph?.nodes || [];
    const currentEdges = currentGraph?.edges || [];
    const currentVersion = currentGraph?.graphVersion || 1;

    const previousState = {
      topologyVersion: currentVersion,
      activeNodeCount: currentNodes.length,
      activeEdgeCount: currentEdges.length,
      layerBreakdown: {
        PROTECTED_DECEPTION_POLICY: currentNodes.filter(
          (n) => n.layerClassification === DSG_LAYERS.PROTECTED_DECEPTION_POLICY
        ).length,
        CONTROLLED_DYNAMIC_STATE: currentNodes.filter(
          (n) => n.layerClassification === DSG_LAYERS.CONTROLLED_DYNAMIC_STATE
        ).length,
        OBSERVATIONAL_ATTACKER_STATE: currentNodes.filter(
          (n) => n.layerClassification === DSG_LAYERS.OBSERVATIONAL_ATTACKER_STATE
        ).length
      }
    };

    // Extract nodes and edges from strategy DSG blueprint
    const blueprint = strategy.dsgBlueprint || {};
    const blueprintNodes = Array.isArray(blueprint.nodes) ? blueprint.nodes : [];
    const blueprintEdges = Array.isArray(blueprint.edges) ? blueprint.edges : [];

    // Ensure policy boundary node is represented in proposed state
    const policyGuardNode = {
      nodeIdentifier: `node-policy-boundary-${policy.id || 'default'}`,
      nodeType: 'POLICY_BOUNDARY',
      assetDescription: `Immutable containment rule for ${policy.name || 'Platform Baseline'}`,
      layerClassification: DSG_LAYERS.PROTECTED_DECEPTION_POLICY,
      structuredAttributes: {
        strictNamespaceIsolation: true,
        noOutboundEgress: true,
        maxExecutionDelayMs: 5000,
        policyPriority: policy.priority || 100
      }
    };

    const nodesToAdd = [policyGuardNode, ...blueprintNodes];
    const edgesToAdd = [...blueprintEdges];

    // Model synthetic environment state (mocked users, auth, endpoints, database, files)
    const syntheticEnvironmentModel = {
      mockUsers: [
        { username: 'synthetic_admin', role: 'SECURITY_AUDITOR_DECOY', status: 'ACTIVE' },
        { username: 'honey_service_acc', role: 'READONLY_API_INTEGRATION', status: 'ACTIVE' }
      ],
      mockAuthState: {
        tokenType: 'CANARY_JWT',
        simulatedIssuer: 'https://auth.gateway.internal/v1',
        algorithm: 'HS256',
        canaryTrackingActive: true
      },
      mockEndpoints: strategy.permittedStateChangeProposal?.routes || [
        { path: '/api/v1/internal/admin/status', method: 'GET', simulatedStatus: 200 }
      ],
      mockDatabaseRecords: {
        schema: 'synthetic_data_vault',
        tables: ['synthetic_customers', 'decoy_transactions'],
        sampleRows: 15,
        canaryColumns: ['canary_seed', 'exfil_marker']
      },
      mockFiles: [
        { path: '/.env.backup', simulatedAccess: 'FORBIDDEN_DECOY' },
        { path: '/internal/service-keys.pem', simulatedAccess: 'CANARY_TRAP' }
      ],
      isolationConstraints: strategy.isolationRequirements || {
        strictNamespaceIsolation: true,
        noOutboundEgress: true
      }
    };

    // Validation checks
    const violations = [];
    if (!DSGPlannerService.validateLayerClassifications(nodesToAdd)) {
      violations.push('One or more nodes contain an invalid layerClassification.');
    }
    if (!syntheticEnvironmentModel.isolationConstraints.noOutboundEgress) {
      violations.push('Isolation constraint violation: noOutboundEgress must be true.');
    }

    const valid = violations.length === 0;
    const transitionStatus = valid ? TRANSITION_STATUSES.PROPOSED : TRANSITION_STATUSES.REJECTED;

    const proposedState = {
      topologyVersion: currentVersion + 1,
      proposedNodeCount: currentNodes.length + nodesToAdd.length,
      proposedEdgeCount: currentEdges.length + edgesToAdd.length,
      strategyIdentifier: strategy.strategyIdentifier,
      strategyType: strategy.strategyType,
      nodesToAdd,
      edgesToAdd,
      syntheticEnvironmentModel,
      transitionStatus,
      plannedAt: new Date().toISOString()
    };

    return {
      status: transitionStatus,
      planId: `plan-${strategy.strategyIdentifier}-${Date.now()}`,
      previousState,
      proposedState,
      nodesToAdd,
      edgesToAdd,
      syntheticEnvironmentModel,
      validationResult: { valid, violations },
      nonExecutionNotice: 'STAGE_5A_PLANNING_ONLY: Proposed graph mutations are simulation plans and have NOT been executed. Live environments remain unprovisioned.'
    };
  }
}
