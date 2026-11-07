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
  updateQuotas,
  getApprovedImagesHandler,
  getServiceTemplatesHandler,
  submitProvisioningJob,
  listProvisioningJobs,
  getProvisioningJob,
  getEnvironmentEvidence,
  getRuntimeHealthOverviewHandler,
  getEnvironmentHealthDetailsHandler,
  getRuntimeTelemetrySummaryHandler,
  getEnvironmentTelemetryEventsHandler,
  getRuntimeReconciliationHandler,
  runRuntimeReconciliationHandler,
  verifyEnvironmentEvidenceHandler,
  getEvidenceCompletenessHandler,
  listRuntimeMutationsHandler,
  proposeRuntimeMutationHandler
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

runtimeRouter.get(
  '/environments/:environmentId/evidence',
  requireRole('APPLICATION_OWNER', 'SECURITY_ANALYST'),
  getEnvironmentEvidence
);

runtimeRouter.post(
  '/environments/:environmentId/terminate',
  requireRole('APPLICATION_OWNER'),
  terminateEnvironment
);

// -----------------------------------------------------------------------------
// Approved Image Catalogue & Service Templates (Stage 5B.2)
// -----------------------------------------------------------------------------

runtimeRouter.get(
  '/images',
  requireRole('APPLICATION_OWNER', 'SECURITY_ANALYST'),
  getApprovedImagesHandler
);

runtimeRouter.get(
  '/templates',
  requireRole('APPLICATION_OWNER', 'SECURITY_ANALYST'),
  getServiceTemplatesHandler
);

// -----------------------------------------------------------------------------
// Provisioning Dispatcher & Job Queue (Stage 5B.2)
// -----------------------------------------------------------------------------

runtimeRouter.post(
  '/environments/provision',
  requireRole('APPLICATION_OWNER'),
  submitProvisioningJob
);

runtimeRouter.post(
  '/jobs',
  requireRole('APPLICATION_OWNER'),
  submitProvisioningJob
);

runtimeRouter.get(
  '/jobs',
  requireRole('APPLICATION_OWNER', 'SECURITY_ANALYST'),
  listProvisioningJobs
);

runtimeRouter.get(
  '/jobs/:jobId',
  requireRole('APPLICATION_OWNER', 'SECURITY_ANALYST'),
  getProvisioningJob
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

// -----------------------------------------------------------------------------
// Runtime Observability, Telemetry & Evidence (Stage 5B.3)
// -----------------------------------------------------------------------------

runtimeRouter.get(
  '/health/overview',
  requireRole('APPLICATION_OWNER', 'SECURITY_ANALYST'),
  getRuntimeHealthOverviewHandler
);

runtimeRouter.get(
  '/environments/:environmentId/health-details',
  requireRole('APPLICATION_OWNER', 'SECURITY_ANALYST'),
  getEnvironmentHealthDetailsHandler
);

runtimeRouter.get(
  '/telemetry/summary',
  requireRole('APPLICATION_OWNER', 'SECURITY_ANALYST'),
  getRuntimeTelemetrySummaryHandler
);

runtimeRouter.get(
  '/environments/:environmentId/telemetry',
  requireRole('APPLICATION_OWNER', 'SECURITY_ANALYST'),
  getEnvironmentTelemetryEventsHandler
);

runtimeRouter.get(
  '/reconciliation',
  requireRole('APPLICATION_OWNER', 'SECURITY_ANALYST'),
  getRuntimeReconciliationHandler
);

runtimeRouter.post(
  '/reconciliation/run',
  requireRole('APPLICATION_OWNER', 'SECURITY_ANALYST'),
  runRuntimeReconciliationHandler
);

runtimeRouter.get(
  '/environments/:environmentId/evidence/verify',
  requireRole('APPLICATION_OWNER', 'SECURITY_ANALYST'),
  verifyEnvironmentEvidenceHandler
);

runtimeRouter.get(
  '/environments/:environmentId/evidence/completeness',
  requireRole('APPLICATION_OWNER', 'SECURITY_ANALYST'),
  getEvidenceCompletenessHandler
);

runtimeRouter.get(
  '/mutations',
  requireRole('APPLICATION_OWNER', 'SECURITY_ANALYST'),
  listRuntimeMutationsHandler
);

runtimeRouter.post(
  '/mutations',
  requireRole('APPLICATION_OWNER'),
  proposeRuntimeMutationHandler
);
