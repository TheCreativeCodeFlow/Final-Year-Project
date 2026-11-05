/**
 * Runtime Operations Controller (Stage 5B.1).
 *
 * Exposes tenant-scoped REST APIs for the Adaptive Deception Runtime Architecture:
 * - Runtime Overview & Architecture Status
 * - Execution Authorizations (Request, Approve, Deny, Revoke, Inspect)
 * - Environment Registry & Lifecycle State Inspection
 * - Chronological Execution Events
 * - Resource Governance & Quota Management
 *
 * Safety Invariant:
 * Endpoints coordinate architecture, state validation, and authorization records.
 * Live Docker containers are NEVER provisioned and executionEvidenceStatus is strictly MISSING.
 */

import crypto from 'node:crypto';
import { getPrismaClient } from '../db/client.js';
import { RuntimeOrchestrator } from '../runtime/runtime-orchestrator.service.js';
import { ExecutionAuthorizationService } from '../runtime/execution-authorization.service.js';
import { RuntimeEnvironmentManager } from '../runtime/runtime-environment-manager.service.js';
import { ResourceGovernanceService } from '../runtime/resource-governance.service.js';
import { ExecutionEvidenceRecorder } from '../runtime/execution-evidence-recorder.service.js';
import { parsePagination } from '../utils/validators.js';

function getTenantId(req) {
  return req.authorizedTenant?.id || req.params?.tenantId;
}

function getOperatorInfo(req) {
  const user = req.user || {};
  const memberships = req.memberships || [];
  const tenantId = getTenantId(req);
  const userTenantMembership = memberships.find((m) => m.tenantId === tenantId);

  return {
    id: user.id || null,
    email: user.email || 'OPERATOR',
    role: userTenantMembership?.role || (user.isPlatformAdmin ? 'PLATFORM_ADMIN' : 'SECURITY_ANALYST'),
    isPlatformAdmin: Boolean(user.isPlatformAdmin)
  };
}

// -----------------------------------------------------------------------------
// Runtime Overview
// -----------------------------------------------------------------------------

export async function getRuntimeOverview(req, res, next) {
  try {
    const tenantId = getTenantId(req);
    const orchestrator = new RuntimeOrchestrator({ prismaClient: req.prisma || getPrismaClient() });
    const overview = await orchestrator.getOverview({ tenantId });

    res.status(200).json({ status: 'success', data: overview });
  } catch (err) {
    next(err);
  }
}

// -----------------------------------------------------------------------------
// Execution Authorizations
// -----------------------------------------------------------------------------

export async function listAuthorizations(req, res, next) {
  try {
    const tenantId = getTenantId(req);
    const { page, limit } = parsePagination(req.query);
    const service = new ExecutionAuthorizationService({ prismaClient: req.prisma || getPrismaClient() });

    const result = await service.listAuthorizations({
      tenantId,
      applicationId: req.query.applicationId || null,
      status: req.query.status || null,
      page,
      limit
    });

    res.status(200).json({
      status: 'success',
      data: result.authorizations,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function getAuthorization(req, res, next) {
  try {
    const tenantId = getTenantId(req);
    const { authorizationId } = req.params;
    const service = new ExecutionAuthorizationService({ prismaClient: req.prisma || getPrismaClient() });

    const auth = await service.getAuthorization({ authorizationId, tenantId });
    if (!auth) {
      return res.status(404).json({
        status: 'error',
        code: 'AUTHORIZATION_NOT_FOUND',
        message: `Execution authorization "${authorizationId}" not found for this tenant.`
      });
    }

    res.status(200).json({ status: 'success', data: auth });
  } catch (err) {
    next(err);
  }
}

export async function createAuthorizationRequest(req, res, next) {
  try {
    const tenantId = getTenantId(req);
    const operator = getOperatorInfo(req);
    const {
      policyDecisionId,
      applicationId,
      dsgGraphId,
      baseGraphVersion,
      lifetimeMinutes = 120,
      idempotencyKey: bodyIdempotencyKey
    } = req.body;

    const headerIdempotencyKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
    const idempotencyKey = headerIdempotencyKey || bodyIdempotencyKey || null;
    const requestPayloadHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(req.body || {}))
      .digest('hex');

    const service = new ExecutionAuthorizationService({ prismaClient: req.prisma || getPrismaClient() });
    const auth = await service.requestAuthorization({
      tenantId,
      applicationId,
      policyDecisionId,
      dsgGraphId,
      baseGraphVersion,
      requestingOperator: operator,
      lifetimeMinutes: Number(lifetimeMinutes) || 120,
      idempotencyKey,
      requestPayloadHash
    });

    res.status(201).json({ status: 'success', data: auth });
  } catch (err) {
    if (err.code === 'IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH') {
      return res.status(409).json({
        status: 'error',
        code: 'IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH',
        message: err.message
      });
    }
    next(err);
  }
}

export async function approveAuthorization(req, res, next) {
  try {
    const tenantId = getTenantId(req);
    const { authorizationId } = req.params;
    const { approvalReason } = req.body;
    const approver = getOperatorInfo(req);

    const service = new ExecutionAuthorizationService({ prismaClient: req.prisma || getPrismaClient() });
    const approved = await service.approveAuthorization({
      authorizationId,
      tenantId,
      approver,
      approvalReason
    });

    res.status(200).json({ status: 'success', data: approved });
  } catch (err) {
    next(err);
  }
}

export async function denyAuthorization(req, res, next) {
  try {
    const tenantId = getTenantId(req);
    const { authorizationId } = req.params;
    const { denialReason } = req.body;
    const operator = getOperatorInfo(req);

    const service = new ExecutionAuthorizationService({ prismaClient: req.prisma || getPrismaClient() });
    const denied = await service.denyAuthorization({
      authorizationId,
      tenantId,
      operator,
      denialReason
    });

    res.status(200).json({ status: 'success', data: denied });
  } catch (err) {
    next(err);
  }
}

export async function revokeAuthorization(req, res, next) {
  try {
    const tenantId = getTenantId(req);
    const { authorizationId } = req.params;
    const { revocationReason } = req.body;
    const operator = getOperatorInfo(req);

    const service = new ExecutionAuthorizationService({ prismaClient: req.prisma || getPrismaClient() });
    const revoked = await service.revokeAuthorization({
      authorizationId,
      tenantId,
      operator,
      revocationReason
    });

    res.status(200).json({ status: 'success', data: revoked });
  } catch (err) {
    next(err);
  }
}

// -----------------------------------------------------------------------------
// Environment Registry
// -----------------------------------------------------------------------------

export async function listEnvironments(req, res, next) {
  try {
    const tenantId = getTenantId(req);
    const { page, limit } = parsePagination(req.query);
    const manager = new RuntimeEnvironmentManager({ prismaClient: req.prisma || getPrismaClient() });

    const result = await manager.listEnvironments({
      tenantId,
      applicationId: req.query.applicationId || null,
      lifecycleState: req.query.lifecycleState || null,
      page,
      limit
    });

    res.status(200).json({
      status: 'success',
      data: result.environments,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function getEnvironment(req, res, next) {
  try {
    const tenantId = getTenantId(req);
    const { environmentId } = req.params;
    const manager = new RuntimeEnvironmentManager({ prismaClient: req.prisma || getPrismaClient() });

    const env = await manager.getEnvironment({ environmentId, tenantId });
    if (!env) {
      return res.status(404).json({
        status: 'error',
        code: 'ENVIRONMENT_NOT_FOUND',
        message: `Runtime environment "${environmentId}" not found for this tenant.`
      });
    }

    res.status(200).json({ status: 'success', data: env });
  } catch (err) {
    next(err);
  }
}

export async function createEnvironment(req, res, next) {
  try {
    const tenantId = getTenantId(req);
    const operator = getOperatorInfo(req);
    const {
      authorizationId,
      environmentIdentifier,
      name,
      allocatedCpu,
      allocatedMemoryMb,
      allocatedStorageMb,
      networkIsolationMode
    } = req.body;

    const manager = new RuntimeEnvironmentManager({ prismaClient: req.prisma || getPrismaClient() });
    const environment = await manager.createEnvironmentRecord({
      tenantId,
      authorizationId,
      environmentIdentifier,
      name,
      allocatedCpu: allocatedCpu ? Number(allocatedCpu) : 0.5,
      allocatedMemoryMb: allocatedMemoryMb ? Number(allocatedMemoryMb) : 256,
      allocatedStorageMb: allocatedStorageMb ? Number(allocatedStorageMb) : 512,
      networkIsolationMode: networkIsolationMode || 'SANDBOX_ISOLATED',
      actor: operator
    });

    res.status(201).json({ status: 'success', data: environment });
  } catch (err) {
    next(err);
  }
}

export async function checkEnvironmentHealth(req, res, next) {
  try {
    const tenantId = getTenantId(req);
    const { environmentId } = req.params;
    const manager = new RuntimeEnvironmentManager({ prismaClient: req.prisma || getPrismaClient() });

    const health = await manager.checkEnvironmentHealth({ environmentId, tenantId });
    res.status(200).json({ status: 'success', data: health });
  } catch (err) {
    next(err);
  }
}

export async function terminateEnvironment(req, res, next) {
  try {
    const tenantId = getTenantId(req);
    const { environmentId } = req.params;
    const { reason } = req.body;
    const operator = getOperatorInfo(req);

    const manager = new RuntimeEnvironmentManager({ prismaClient: req.prisma || getPrismaClient() });
    const terminated = await manager.terminateEnvironment({
      environmentId,
      tenantId,
      reason,
      actor: operator
    });

    res.status(200).json({ status: 'success', data: terminated });
  } catch (err) {
    next(err);
  }
}

// -----------------------------------------------------------------------------
// Execution Events
// -----------------------------------------------------------------------------

export async function listExecutionEvents(req, res, next) {
  try {
    const tenantId = getTenantId(req);
    const { page, limit } = parsePagination(req.query);
    const recorder = new ExecutionEvidenceRecorder(req.prisma || getPrismaClient());

    const result = await recorder.listEvents({
      tenantId,
      authorizationId: req.query.authorizationId || null,
      environmentId: req.query.environmentId || null,
      eventType: req.query.eventType || null,
      page,
      limit
    });

    res.status(200).json({
      status: 'success',
      data: result.events,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total
      }
    });
  } catch (err) {
    next(err);
  }
}

// -----------------------------------------------------------------------------
// Resource Governance & Quotas
// -----------------------------------------------------------------------------

export async function getQuotas(req, res, next) {
  try {
    const tenantId = getTenantId(req);
    const applicationId = req.query.applicationId || null;
    const service = new ResourceGovernanceService(req.prisma || getPrismaClient());

    const quota = await service.getQuota({ tenantId, applicationId });
    res.status(200).json({ status: 'success', data: quota });
  } catch (err) {
    next(err);
  }
}

export async function updateQuotas(req, res, next) {
  try {
    const tenantId = getTenantId(req);
    const applicationId = req.body.applicationId || null;
    const service = new ResourceGovernanceService(req.prisma || getPrismaClient());

    const updated = await service.updateQuota({
      tenantId,
      applicationId,
      updates: req.body
    });

    res.status(200).json({ status: 'success', data: updated });
  } catch (err) {
    next(err);
  }
}
