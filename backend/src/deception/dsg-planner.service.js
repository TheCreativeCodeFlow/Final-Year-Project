/**
 * Deception State Graph (DSG) Planner Service (Stage 5A & Stage 5A.1).
 *
 * Models adaptive deception environments across 3 strict layers:
 * 1. PROTECTED_DECEPTION_POLICY: Boundary rules, containment policies, isolation constraints
 * 2. CONTROLLED_DYNAMIC_STATE: Synthetic endpoints, honey credentials, fake databases, decoy services
 * 3. OBSERVATIONAL_ATTACKER_STATE: Attacker probe trajectories, session tracks, canary tripwires
 *
 * Stage 5A.1 Enhancements:
 * - Strict graph versioning & staleness validation (rejects stale base versions)
 * - Concurrency control & idempotent proposal generation
 * - Multi-stage strategy reassessment with cross-state consistency validation:
 *   * Synthetic user identity compatibility
 *   * Authentication token and key consistency
 *   * API route namespace non-collision
 *   * Database schema and canary column invariants
 *   * Service isolation boundary preservation
 *
 * Core Research Invariant:
 * Proposed DSG mutations are NEVER executed transitions.
 * Live environments are NOT provisioned; execution evidence status remains strictly MISSING.
 */

import crypto from 'node:crypto';

export const DSG_LAYERS = {
  PROTECTED_DECEPTION_POLICY: 'PROTECTED_DECEPTION_POLICY',
  CONTROLLED_DYNAMIC_STATE: 'CONTROLLED_DYNAMIC_STATE',
  OBSERVATIONAL_ATTACKER_STATE: 'OBSERVATIONAL_ATTACKER_STATE'
};

export const TRANSITION_STATUSES = {
  PROPOSED: 'PROPOSED',
  VALIDATED: 'VALIDATED',
  REJECTED: 'REJECTED'
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
   * Compute deterministic idempotency key for a proposal.
   */
  static computeIdempotencyKey({ graphId, baseGraphVersion, strategyIdentifier, policyId }) {
    const payload = `${graphId || 'virtual'}:${baseGraphVersion || 1}:${strategyIdentifier}:${policyId || 'default'}`;
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  /**
   * Generate a proposed Deception State Graph mutation plan.
   *
   * @param {Object} params
   * @param {Object} [params.currentGraph] - Existing graph with nodes, edges, transitions
   * @param {Object} params.strategy - Selected DeceptionStrategy record
   * @param {Object} [params.assessment] - BehavioralAssessment
   * @param {Object} [params.policy] - DeceptionPolicy
   * @param {string} params.tenantId
   * @param {string} [params.applicationId]
   * @param {number} [params.baseGraphVersion] - Version the proposal is based on
   * @returns {{
   *   status: string,
   *   planId: string,
   *   idempotencyKey: string,
   *   baseGraphVersion: number,
   *   targetGraphVersion: number,
   *   rejectionReason: string|null,
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
    applicationId = null,
    baseGraphVersion = null
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

    const idempotencyKey = DSGPlannerService.computeIdempotencyKey({
      graphId: currentGraph?.id,
      baseGraphVersion: baseGraphVersion ?? currentVersion,
      strategyIdentifier: strategy.strategyIdentifier,
      policyId: policy.id
    });

    // -------------------------------------------------------------------------
    // Guard 1: Concurrency and Staleness Validation
    // -------------------------------------------------------------------------
    if (baseGraphVersion !== null && baseGraphVersion !== undefined && baseGraphVersion !== currentVersion) {
      const staleReason = `STALE_GRAPH_VERSION: Proposal was based on graph version ${baseGraphVersion}, but current graph is version ${currentVersion}. Plan rejected to prevent silent overwrite.`;
      return {
        status: TRANSITION_STATUSES.REJECTED,
        planId: `plan-rejected-${strategy.strategyIdentifier}-${Date.now()}`,
        idempotencyKey,
        baseGraphVersion,
        targetGraphVersion: currentVersion,
        rejectionReason: staleReason,
        previousState,
        proposedState: previousState,
        nodesToAdd: [],
        edgesToAdd: [],
        syntheticEnvironmentModel: null,
        validationResult: { valid: false, violations: [staleReason] },
        nonExecutionNotice: 'STAGE_5A_PLANNING_ONLY: Stale plan rejected. Graph state unchanged.'
      };
    }

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

    // Model synthetic environment state
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
      idempotencyKey,
      baseGraphVersion: currentVersion,
      targetGraphVersion: currentVersion + 1,
      rejectionReason: valid ? null : violations.join('; '),
      previousState,
      proposedState,
      nodesToAdd,
      edgesToAdd,
      syntheticEnvironmentModel,
      validationResult: { valid, violations },
      nonExecutionNotice:
        'STAGE_5A_PLANNING_ONLY: Proposed graph mutations are simulation plans and have NOT been executed. Live environments remain unprovisioned.'
    };
  }

  /**
   * Reassess strategy after new attacker observations arrive (Planning-Only).
   *
   * Validates consistency across:
   * 1. Synthetic user identities (no contradictory roles/status)
   * 2. Authentication state (compatible token types)
   * 3. API resources (no colliding route paths with conflicting handlers)
   * 4. Service relationships (no contradictory isolation requirements)
   * 5. Database-like records (no conflicting table schemas)
   *
   * If consistent: returns a merged proposed state.
   * If inconsistent: rejects mutation and explains why.
   *
   * @param {Object} params
   * @param {Object} [params.currentGraph]
   * @param {Object} params.activeProposal - Previously proposed state plan
   * @param {Object} params.newStrategy - Newly selected DeceptionStrategy
   * @param {Object} [params.newAssessment] - New observation assessment
   * @param {Object} [params.policy] - DeceptionPolicy
   * @param {string} params.tenantId
   * @returns {{
   *   reassessmentStatus: string,
   *   consistent: boolean,
   *   rejectionReason: string|null,
   *   consistencyChecks: Array<{ check: string, passed: boolean, details: string }>,
   *   mergedPlan: Object|null
   * }}
   */
  reassessStrategy({
    currentGraph = null,
    activeProposal,
    newStrategy,
    newAssessment = {},
    policy = {},
    tenantId
  }) {
    if (!newStrategy) {
      throw new Error('Strategy reassessment requires a new strategy candidate.');
    }

    // If no active proposal exists, evaluate clean new mutation
    if (!activeProposal || !activeProposal.proposedState) {
      const freshPlan = this.planMutation({
        currentGraph,
        strategy: newStrategy,
        assessment: newAssessment,
        policy,
        tenantId
      });
      return {
        reassessmentStatus: 'FRESH_PLAN_GENERATED',
        consistent: true,
        rejectionReason: null,
        consistencyChecks: [{ check: 'INITIAL_STATE_INIT', passed: true, details: 'No prior proposal existed.' }],
        mergedPlan: freshPlan
      };
    }

    const priorEnv = activeProposal.proposedState.syntheticEnvironmentModel || {};
    const consistencyChecks = [];
    let isConsistent = true;
    const violations = [];

    // 1. Synthetic User Identity Consistency Check
    // Check if new strategy introduces conflicting roles for existing synthetic identities
    const priorUsers = priorEnv.mockUsers || [];
    const newProposalUsers = [
      { username: 'synthetic_admin', role: 'SECURITY_AUDITOR_DECOY', status: 'ACTIVE' },
      { username: 'honey_service_acc', role: 'READONLY_API_INTEGRATION', status: 'ACTIVE' }
    ];

    let userConflict = false;
    for (const nu of newProposalUsers) {
      const match = priorUsers.find((pu) => pu.username === nu.username);
      if (match && match.role !== nu.role) {
        userConflict = true;
        violations.push(`User role conflict: user "${nu.username}" previously had role "${match.role}", new strategy defines "${nu.role}"`);
      }
    }
    consistencyChecks.push({
      check: 'SYNTHETIC_USER_IDENTITY_CONSISTENCY',
      passed: !userConflict,
      details: userConflict
        ? 'Conflicting synthetic user roles detected.'
        : 'Synthetic user identities are compatible.'
    });
    if (userConflict) isConsistent = false;

    // 2. Authentication State Compatibility Check
    // E.g. Check for token type contradiction
    const priorAuth = priorEnv.mockAuthState || {};
    const newAuthTokenType = newStrategy.strategyType === 'CREDENTIAL_DECEPTION' ? 'CANARY_JWT' : priorAuth.tokenType;
    let authConflict = false;
    if (priorAuth.tokenType && newAuthTokenType && priorAuth.tokenType !== newAuthTokenType) {
      authConflict = true;
      violations.push(`Auth state conflict: existing tokenType "${priorAuth.tokenType}" incompatible with new "${newAuthTokenType}"`);
    }
    consistencyChecks.push({
      check: 'AUTHENTICATION_STATE_COMPATIBILITY',
      passed: !authConflict,
      details: authConflict
        ? 'Incompatible synthetic authentication token format.'
        : 'Authentication state remains consistent across transitions.'
    });
    if (authConflict) isConsistent = false;

    // 3. API Resource & Route Collision Check
    const priorEndpoints = priorEnv.mockEndpoints || [];
    const newRoutes = newStrategy.permittedStateChangeProposal?.routes || [];
    let routeConflict = false;
    for (const nr of newRoutes) {
      const colliding = priorEndpoints.find((pe) => pe.path === nr.path && pe.method === nr.method);
      if (colliding && colliding.simulatedStatus !== nr.simulatedStatus) {
        routeConflict = true;
        violations.push(
          `API route collision: endpoint "${nr.method} ${nr.path}" has conflicting status code (existing: ${colliding.simulatedStatus}, proposed: ${nr.simulatedStatus})`
        );
      }
    }
    consistencyChecks.push({
      check: 'API_RESOURCE_NON_COLLISION',
      passed: !routeConflict,
      details: routeConflict
        ? 'Route handler collision detected with contradictory simulated statuses.'
        : 'API route namespaces do not conflict.'
    });
    if (routeConflict) isConsistent = false;

    // 4. Database Schema Invariants Check
    const priorDb = priorEnv.mockDatabaseRecords || {};
    let dbConflict = false;
    if (newStrategy.strategyType === 'DATA_ACCESS_DECEPTION' && priorDb.schema) {
      const newSchema = newStrategy.permittedStateChangeProposal?.honeyTable;
      // Invariant: cannot drop or override existing table without migration
      if (newSchema && priorDb.tables && !priorDb.tables.includes(newSchema) && priorDb.schema === 'RESTRICTED_IMMUTABLE') {
        dbConflict = true;
        violations.push(`Database invariant violation: cannot inject table "${newSchema}" into immutable vault.`);
      }
    }
    consistencyChecks.push({
      check: 'DATABASE_SCHEMA_INVARIANT',
      passed: !dbConflict,
      details: dbConflict
        ? 'Database schema collision detected.'
        : 'Database schemas and canary columns are preserved.'
    });
    if (dbConflict) isConsistent = false;

    // 5. Service Isolation Boundary Check
    const isolation = newStrategy.isolationRequirements || {};
    let isolationConflict = false;
    if (isolation.noOutboundEgress !== true) {
      isolationConflict = true;
      violations.push('Isolation boundary violation: new strategy does not enforce noOutboundEgress.');
    }
    consistencyChecks.push({
      check: 'SERVICE_ISOLATION_BOUNDARY_PRESERVATION',
      passed: !isolationConflict,
      details: isolationConflict
        ? 'Isolation constraint violation.'
        : 'Isolation boundaries are strictly maintained.'
    });
    if (isolationConflict) isConsistent = false;

    // If any checks failed, reject the reassessment proposal
    if (!isConsistent) {
      const rejectionReason = `INCONSISTENT_SYNTHETIC_STATE: ${violations.join('; ')}`;
      return {
        reassessmentStatus: 'INCONSISTENT_SYNTHETIC_STATE',
        consistent: false,
        rejectionReason,
        consistencyChecks,
        mergedPlan: null
      };
    }

    // Merge compatible plans
    const blueprint = newStrategy.dsgBlueprint || {};
    const blueprintNodes = Array.isArray(blueprint.nodes) ? blueprint.nodes : [];
    const blueprintEdges = Array.isArray(blueprint.edges) ? blueprint.edges : [];

    const existingNodes = activeProposal.nodesToAdd || [];
    const existingEdges = activeProposal.edgesToAdd || [];

    // Deduplicate nodes by nodeIdentifier
    const mergedNodes = [...existingNodes];
    for (const bn of blueprintNodes) {
      if (!mergedNodes.some((en) => en.nodeIdentifier === bn.nodeIdentifier)) {
        mergedNodes.push(bn);
      }
    }

    const mergedEdges = [...existingEdges, ...blueprintEdges];

    const currentVersion = activeProposal.proposedState?.topologyVersion || 2;
    const mergedPlan = {
      status: TRANSITION_STATUSES.PROPOSED,
      planId: `reassessed-plan-${newStrategy.strategyIdentifier}-${Date.now()}`,
      baseGraphVersion: currentVersion,
      targetGraphVersion: currentVersion + 1,
      rejectionReason: null,
      previousState: activeProposal.proposedState,
      proposedState: {
        topologyVersion: currentVersion + 1,
        proposedNodeCount: mergedNodes.length,
        proposedEdgeCount: mergedEdges.length,
        strategyIdentifier: newStrategy.strategyIdentifier,
        strategyType: newStrategy.strategyType,
        transitionStatus: TRANSITION_STATUSES.PROPOSED,
        reassessedFromStrategy: activeProposal.proposedState.strategyIdentifier,
        syntheticEnvironmentModel: {
          mockUsers: priorUsers,
          mockAuthState: priorAuth,
          mockEndpoints: [...priorEndpoints, ...newRoutes],
          mockDatabaseRecords: priorDb,
          isolationConstraints: { strictNamespaceIsolation: true, noOutboundEgress: true }
        },
        nodesToAdd: mergedNodes,
        edgesToAdd: mergedEdges,
        plannedAt: new Date().toISOString()
      },
      consistencyChecks,
      nonExecutionNotice:
        'STAGE_5A_PLANNING_ONLY: Reassessed DSG plan has been merged for simulation and NOT executed.'
    };

    return {
      reassessmentStatus: 'COMPATIBLE_MUTATION',
      consistent: true,
      rejectionReason: null,
      consistencyChecks,
      mergedPlan
    };
  }
}
