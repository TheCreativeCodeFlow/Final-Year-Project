/**
 * Runtime Operations Router (Stage 5B.1).
 * Mount path: /api/v1/tenants/:tenantId/runtime
 *
 * Enforces role-based access control and tenant isolation across the
 * Adaptive Deception Runtime Architecture.
 */

import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import {
  getRuntimeOverview,
  listAuthorizations,
  getAuthorization,
  createAuthorizationRequest,
  approveAuthorization,
  denyAuthorization,
  revokeAuthorization,
  listEnvironments,
  getEnvironment,
  createEnvironment,
  checkEnvironmentHealth,
  terminateEnvironment,
  listExecutionEvents,
  getQuotas,
  updateQuotas
} from '../controllers/runtime.controller.js';

export const runtimeRouter = Router({ mergeParams: true });

// -----------------------------------------------------------------------------
// Runtime Overview
// -----------------------------------------------------------------------------

runtimeRouter.get(
  '/overview',
  requireRole('APPLICATION_OWNER', 'SECURITY_ANALYST'),
  getRuntimeOverview
);

// -----------------------------------------------------------------------------
// Execution Authorizations
// -----------------------------------------------------------------------------

runtimeRouter.get(
  '/authorizations',
  requireRole('APPLICATION_OWNER', 'SECURITY_ANALYST'),
  listAuthorizations
);

runtimeRouter.get(
  '/authorizations/:authorizationId',
  requireRole('APPLICATION_OWNER', 'SECURITY_ANALYST'),
  getAuthorization
);

runtimeRouter.post(
  '/authorizations',
  requireRole('APPLICATION_OWNER', 'SECURITY_ANALYST'),
  createAuthorizationRequest
);

// Approval requires APPLICATION_OWNER (Separation of duties)
runtimeRouter.post(
  '/authorizations/:authorizationId/approve',
  requireRole('APPLICATION_OWNER'),
  approveAuthorization
);

runtimeRouter.post(
  '/authorizations/:authorizationId/deny',
  requireRole('APPLICATION_OWNER', 'SECURITY_ANALYST'),
  denyAuthorization
);

runtimeRouter.post(
  '/authorizations/:authorizationId/revoke',
  requireRole('APPLICATION_OWNER'),
  revokeAuthorization
);

// -----------------------------------------------------------------------------
// Environment Registry
// -----------------------------------------------------------------------------

runtimeRouter.get(
  '/environments',
  requireRole('APPLICATION_OWNER', 'SECURITY_ANALYST'),
  listEnvironments
);

runtimeRouter.get(
  '/environments/:environmentId',
  requireRole('APPLICATION_OWNER', 'SECURITY_ANALYST'),
  getEnvironment
);

runtimeRouter.post(
  '/environments',
  requireRole('APPLICATION_OWNER'),
  createEnvironment
);

runtimeRouter.get(
  '/environments/:environmentId/health',
  requireRole('APPLICATION_OWNER', 'SECURITY_ANALYST'),
  checkEnvironmentHealth
);

runtimeRouter.post(
  '/environments/:environmentId/terminate',
  requireRole('APPLICATION_OWNER'),
  terminateEnvironment
);

// -----------------------------------------------------------------------------
// Execution Events
// -----------------------------------------------------------------------------

runtimeRouter.get(
  '/events',
  requireRole('APPLICATION_OWNER', 'SECURITY_ANALYST'),
  listExecutionEvents
);

// -----------------------------------------------------------------------------
// Resource Governance & Quotas
// -----------------------------------------------------------------------------

runtimeRouter.get(
  '/quotas',
  requireRole('APPLICATION_OWNER', 'SECURITY_ANALYST'),
  getQuotas
);

runtimeRouter.patch(
  '/quotas',
  requireRole('APPLICATION_OWNER'),
  updateQuotas
);
