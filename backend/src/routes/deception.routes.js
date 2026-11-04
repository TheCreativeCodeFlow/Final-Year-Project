/**
 * Tenant-Scoped Deception Router (Stage 5A & Stage 5A.1).
 *
 * Mount path: /api/v1/tenants/:tenantId/deception
 *
 * Exposes:
 * - /policies: CRUD for deception policies
 * - /strategies: catalog of the 5 deception strategies
 * - /strategies/benchmark: 11-scenario strategy selection validation suite
 * - /evaluate: policy evaluation engine execution
 * - /decisions: immutable decision history
 * - /graphs: Deception State Graph topology and planning
 * - /graphs/:graphId/reassess: multi-stage strategy reassessment and consistency verification
 */

import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import {
  listPolicies,
  getPolicy,
  createPolicy,
  updatePolicy,
  listStrategies,
  getStrategy,
  getStrategyBenchmark,
  evaluatePolicy,
  listDecisions,
  getDecision,
  listGraphs,
  getGraph,
  planGraphMutation,
  reassessGraphMutation
} from '../controllers/deception.controller.js';

export const deceptionRouter = Router({ mergeParams: true });

// Policies
deceptionRouter.get(
  '/policies',
  requireRole('APPLICATION_OWNER', 'SECURITY_ANALYST'),
  listPolicies
);
deceptionRouter.post(
  '/policies',
  requireRole('APPLICATION_OWNER'),
  createPolicy
);
deceptionRouter.get(
  '/policies/:policyId',
  requireRole('APPLICATION_OWNER', 'SECURITY_ANALYST'),
  getPolicy
);
deceptionRouter.patch(
  '/policies/:policyId',
  requireRole('APPLICATION_OWNER'),
  updatePolicy
);

// Strategies
deceptionRouter.get(
  '/strategies/benchmark',
  requireRole('APPLICATION_OWNER', 'SECURITY_ANALYST'),
  getStrategyBenchmark
);
deceptionRouter.get(
  '/strategies',
  requireRole('APPLICATION_OWNER', 'SECURITY_ANALYST'),
  listStrategies
);
deceptionRouter.get(
  '/strategies/:strategyId',
  requireRole('APPLICATION_OWNER', 'SECURITY_ANALYST'),
  getStrategy
);

// Policy Evaluation
deceptionRouter.post(
  '/evaluate',
  requireRole('APPLICATION_OWNER', 'SECURITY_ANALYST'),
  evaluatePolicy
);

// Policy Decisions Explorer
deceptionRouter.get(
  '/decisions',
  requireRole('APPLICATION_OWNER', 'SECURITY_ANALYST'),
  listDecisions
);
deceptionRouter.get(
  '/decisions/:decisionId',
  requireRole('APPLICATION_OWNER', 'SECURITY_ANALYST'),
  getDecision
);

// Deception State Graphs (DSG)
deceptionRouter.get(
  '/graphs',
  requireRole('APPLICATION_OWNER', 'SECURITY_ANALYST'),
  listGraphs
);
deceptionRouter.get(
  '/graphs/:graphId',
  requireRole('APPLICATION_OWNER', 'SECURITY_ANALYST'),
  getGraph
);
deceptionRouter.post(
  '/graphs/:graphId/plan',
  requireRole('APPLICATION_OWNER', 'SECURITY_ANALYST'),
  planGraphMutation
);
deceptionRouter.post(
  '/graphs/:graphId/reassess',
  requireRole('APPLICATION_OWNER', 'SECURITY_ANALYST'),
  reassessGraphMutation
);
