/**
 * Deception State Graph (DSG) Consistency Engine (Stage 5B.4).
 *
 * Implements authoritative 7-way cross-component consistency validation:
 * 1. Identity Consistency
 * 2. Authentication Consistency
 * 3. API Route Consistency
 * 4. Database Schema Consistency
 * 5. Service Dependency Consistency
 * 6. Network Isolation Consistency
 * 7. Historical State Consistency
 *
 * Reject any mutation that would create contradictory synthetic behavior.
 */

import { validateMutationSchema, ALLOWED_SYNTHETIC_ROLES } from './dsg-mutation-catalogue.js';

export class DSGConsistencyEngine {
  /**
   * Validates proposed state mutations against the current environment state.
   *
   * @param {Object} params
   * @param {Object} params.currentState - Current synthetic state model
   * @param {Object} params.proposedMutation - Proposed mutation specification
   * @param {number} params.currentGraphVersion - Current graph version (e.g. 1)
   * @param {number} params.targetGraphVersion - Target graph version (must be current + 1)
   * @returns {{
   *   consistent: boolean,
   *   violations: string[],
   *   dimensionResults: {
   *     identity: { passed: boolean, details: string },
   *     authentication: { passed: boolean, details: string },
   *     apiRoute: { passed: boolean, details: string },
   *     databaseSchema: { passed: boolean, details: string },
   *     serviceDependency: { passed: boolean, details: string },
   *     networkIsolation: { passed: boolean, details: string },
   *     historicalState: { passed: boolean, details: string }
   *   }
   * }}
   */
  static validateConsistency({
    currentState = {},
    proposedMutation,
    currentGraphVersion = 1,
    targetGraphVersion = 2
  }) {
    const violations = [];
    const dimensionResults = {
      identity: { passed: true, consistent: true, details: 'Identity references and roles consistent.' },
      authentication: { passed: true, consistent: true, details: 'Authentication credentials map to valid identities.' },
      apiRoute: { passed: true, consistent: true, details: 'API route namespaces and status codes non-colliding.' },
      databaseSchema: { passed: true, consistent: true, details: 'Synthetic data schema and canary columns valid.' },
      serviceDependency: { passed: true, consistent: true, details: 'Service dependencies satisfied.' },
      networkIsolation: { passed: true, consistent: true, details: 'Strict internal network quarantine preserved.' },
      historicalState: { passed: true, consistent: true, details: 'Graph version monotonicity verified.' }
    };

    // 0. Preliminary Schema Validation
    const schemaCheck = validateMutationSchema(proposedMutation);
    if (!schemaCheck.valid) {
      violations.push(...schemaCheck.errors);
      return {
        consistent: false,
        violations,
        dimensionResults
      };
    }

    const { mutationType, operation, payload } = proposedMutation;
    const users = currentState.users || [];
    const routes = currentState.routes || [];
    const schemas = currentState.schemas || [];
    const credentials = currentState.credentials || [];
    const activeServices = new Set(
      Array.isArray(currentState.activeServices)
        ? currentState.activeServices
        : ['SYNTHETIC_API', 'SYNTHETIC_AUTH', 'SYNTHETIC_DATA']
    );

    // -------------------------------------------------------------------------
    // 1. Identity Consistency
    // -------------------------------------------------------------------------
    if (mutationType === 'IDENTITY_MUTATION') {
      if (operation === 'ADD_SYNTHETIC_USER') {
        const existing = users.find((u) => u.username === payload.username);
        if (existing && payload.role && existing.role !== payload.role) {
          const msg = `Identity conflict: User "${payload.username}" already exists with conflicting role "${existing.role}". Use MODIFY_USER_ROLE instead.`;
          violations.push(msg);
          dimensionResults.identity = { passed: false, details: msg };
        }
      } else if (operation === 'MODIFY_USER_ROLE') {
        const target = users.find((u) => u.username === payload.username || u.id === payload.id);
        if (!target) {
          const msg = `Identity missing: Cannot modify role for non-existent user "${payload.username || payload.id}".`;
          violations.push(msg);
          dimensionResults.identity = { passed: false, details: msg };
        }
      } else if (operation === 'LINK_USER_RELATIONSHIP') {
        const target = users.find((u) => u.username === payload.username || u.id === payload.id);
        if (!target) {
          const msg = `Identity missing: Cannot link relationships for non-existent user "${payload.username || payload.id}".`;
          violations.push(msg);
          dimensionResults.identity = { passed: false, details: msg };
        } else if (payload.relationships) {
          // Check that target referenced users exist
          for (const [relKey, refUser] of Object.entries(payload.relationships)) {
            if (refUser && !users.some((u) => u.id === refUser || u.username === refUser)) {
              const msg = `Identity reference dangling: Relationship "${relKey}" references non-existent user "${refUser}".`;
              violations.push(msg);
              dimensionResults.identity = { passed: false, details: msg };
            }
          }
        }
      }
    }

    // -------------------------------------------------------------------------
    // 2. Authentication Consistency
    // -------------------------------------------------------------------------
    if (mutationType === 'CREDENTIAL_MUTATION') {
      if (operation === 'CREATE_DECOY_CREDENTIAL') {
        const targetUser = users.find((u) => u.username === payload.username || u.id === payload.userId);
        if (!targetUser) {
          const msg = `Authentication contradiction: Decoy credential created for non-existent user "${payload.username}".`;
          violations.push(msg);
          dimensionResults.authentication = { passed: false, details: msg };
        } else if (payload.role && targetUser.role !== payload.role) {
          const msg = `Authentication role mismatch: Decoy credential role "${payload.role}" does not match user's assigned role "${targetUser.role}".`;
          violations.push(msg);
          dimensionResults.authentication = { passed: false, details: msg };
        }
      } else if (operation === 'REVOKE_DECOY_CREDENTIAL') {
        const cred = credentials.find((c) => c.id === payload.id || c.token === payload.token);
        if (!cred) {
          const msg = `Authentication missing: Cannot revoke non-existent credential "${payload.id || payload.token}".`;
          violations.push(msg);
          dimensionResults.authentication = { passed: false, details: msg };
        }
      }
    }

    // -------------------------------------------------------------------------
    // 3. API Route Consistency
    // -------------------------------------------------------------------------
    if (mutationType === 'API_TOPOLOGY_MUTATION') {
      if (operation === 'ADD_SYNTHETIC_ROUTE') {
        const method = (payload.method || 'GET').toUpperCase();
        const colliding = routes.find((r) => r.path === payload.path && r.method === method);
        if (colliding && colliding.simulatedStatus !== payload.simulatedStatus) {
          const msg = `API route collision: Endpoint "${method} ${payload.path}" already exists with contradictory status ${colliding.simulatedStatus} (proposed: ${payload.simulatedStatus}).`;
          violations.push(msg);
          dimensionResults.apiRoute = { passed: false, details: msg };
        }

        // Entity existence check: If route references specific user or customer ID
        const userMatch = payload.path.match(/^\/api\/v1\/users\/([^/]+)$/);
        if (userMatch) {
          const targetId = userMatch[1];
          if (!users.some((u) => u.id === targetId || u.username === targetId)) {
            const msg = `API route entity missing: Route "${payload.path}" exposes non-existent synthetic user "${targetId}".`;
            violations.push(msg);
            dimensionResults.apiRoute = { passed: false, details: msg };
          }
        }
      } else if (operation === 'MODIFY_ROUTE_BEHAVIOR' || operation === 'SET_ROUTE_AVAILABILITY') {
        const method = (payload.method || 'GET').toUpperCase();
        const exists = routes.some((r) => r.path === payload.path && r.method === method);
        // If not in dynamic routes, check if it's a known baseline route
        const isBaseline = ['/api/v1/users', '/api/v1/accounts', '/api/v1/resources', '/api/v1/auth/login', '/api/v1/data/customers'].includes(payload.path);
        if (!exists && !isBaseline) {
          const msg = `API route missing: Cannot modify non-existent route "${method} ${payload.path}".`;
          violations.push(msg);
          dimensionResults.apiRoute = { passed: false, details: msg };
        }
      }
    }

    // -------------------------------------------------------------------------
    // 4. Database Schema Consistency
    // -------------------------------------------------------------------------
    if (mutationType === 'DATA_MUTATION') {
      if (operation === 'SCHEMA_MUTATION') {
        // Enforce canary column requirement on sensitive decoy tables
        if (['synthetic_customers', 'decoy_transactions', 'synthetic_ledger'].includes(payload.table)) {
          const hasCanary = payload.columns.some((col) =>
            ['canary_seed', 'exfil_marker', 'audit_beacon', 'synthetic_tag'].includes(col)
          );
          if (!hasCanary) {
            const msg = `Database schema canary missing: Decoy table "${payload.table}" must include a canary tracking column.`;
            violations.push(msg);
            dimensionResults.databaseSchema = { passed: false, details: msg };
          }
        }

        // Forbid references to real production tables
        const forbiddenTables = ['users', 'tenants', 'auth_tokens', 'production_customers', 'stripe_charges'];
        if (forbiddenTables.includes(payload.table.toLowerCase())) {
          const msg = `Database schema safety violation: Table name "${payload.table}" collides with protected production table.`;
          violations.push(msg);
          dimensionResults.databaseSchema = { passed: false, details: msg };
        }
      }
    }

    // -------------------------------------------------------------------------
    // 5. Service Dependency Consistency
    // -------------------------------------------------------------------------
    if (mutationType === 'SERVICE_TOPOLOGY_MUTATION') {
      if (operation === 'DISABLE_SYNTHETIC_SERVICE') {
        const serviceType = String(payload.serviceType || '').toUpperCase();
        if (serviceType === 'SYNTHETIC_AUTH') {
          // If auth is disabled, verify that no new credential mutations or active auth routes are exposed
          const hasAuthRoutes = routes.some((r) => r.path.startsWith('/api/v1/auth') && r.availability !== 'DISABLED');
          if (hasAuthRoutes) {
            const msg = 'Service dependency violation: Cannot disable SYNTHETIC_AUTH while active synthetic authentication routes exist.';
            violations.push(msg);
            dimensionResults.serviceDependency = { passed: false, details: msg };
          }
        }
      }
    }

    // -------------------------------------------------------------------------
    // 6. Network Isolation Consistency
    // -------------------------------------------------------------------------
    // Ensure mutation does NOT attempt to configure external network destinations or DNS
    const rawPayloadStr = JSON.stringify(payload);
    if (/https?:\/\/(?!127\.0\.0\.1|localhost|auth\.gateway\.internal)[^\s"']+/i.test(rawPayloadStr)) {
      const msg = 'Network isolation violation: Mutation payload contains external network URL. External egress strictly forbidden.';
      violations.push(msg);
      dimensionResults.networkIsolation = { passed: false, consistent: false, details: msg };
    }

    // -------------------------------------------------------------------------
    // 7. Historical State Consistency
    // -------------------------------------------------------------------------
    if (targetGraphVersion !== currentGraphVersion + 1) {
      const msg = `STALE_GRAPH_VERSION: targetGraphVersion (${targetGraphVersion}) must be strictly currentGraphVersion + 1 (${currentGraphVersion + 1}).`;
      violations.push(msg);
      dimensionResults.historicalState = { passed: false, consistent: false, details: msg };
    }

    const consistent = violations.length === 0;
    return {
      consistent,
      violations,
      dimensionResults
    };
  }
}

export default DSGConsistencyEngine;
