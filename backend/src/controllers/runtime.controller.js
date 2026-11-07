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
import { listApprovedImages, getApprovedImage } from '../runtime/image-catalogue.js';
import { listSyntheticTemplates, getSyntheticTemplate } from '../runtime/synthetic-templates.js';
import { ProvisioningDispatcher } from '../runtime/provisioning-dispatcher.js';
import { WorkerClient } from '../runtime/worker-client.js';
import { RuntimeWorkerService } from '../runtime/runtime-worker.service.js';
import { ContainerRuntimeAdapter } from '../runtime/container-runtime-adapter.js';
import { RuntimeHealthMonitorService } from '../runtime/runtime-health-monitor.service.js';
import { RuntimeReconciliationService } from '../runtime/runtime-reconciliation.service.js';
import { defaultRuntimeTelemetry } from '../runtime/runtime-telemetry.service.js';
import { verifyEvidenceChain, verifyEvidenceCompleteness } from '../runtime/execution-evidence-recorder.service.js';
import { DSGConsistencyEngine } from '../deception/dsg-consistency-engine.service.js';
import { DSGExecutionEngine } from '../deception/dsg-execution-engine.service.js';
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

// -----------------------------------------------------------------------------
// Approved Image Catalogue & Templates (Stage 5B.2)
// -----------------------------------------------------------------------------

export async function getApprovedImagesHandler(req, res, next) {
  try {
    const images = listApprovedImages();
    res.status(200).json({ status: 'success', data: images });
  } catch (err) {
    next(err);
  }
}

export async function getServiceTemplatesHandler(req, res, next) {
  try {
    const templates = listSyntheticTemplates();
    res.status(200).json({ status: 'success', data: templates });
  } catch (err) {
    next(err);
  }
}

// -----------------------------------------------------------------------------
// Provisioning Dispatcher & Jobs (Stage 5B.2)
// -----------------------------------------------------------------------------

export async function submitProvisioningJob(req, res, next) {
  try {
    const tenantId = getTenantId(req);
    const operator = getOperatorInfo(req);
    const {
      authorizationId,
      templateIdentifier,
      templateId,
      imageIdentifier,
      imageId,
      idempotencyKey,
      extraEnv,
      processSync = true
    } = req.body;

    if (!authorizationId) {
      return res.status(400).json({
        status: 'error',
        message: 'authorizationId is required to submit a provisioning job.'
      });
    }

    const prisma = req.prisma || getPrismaClient();
    const dispatcher = new ProvisioningDispatcher({
      prismaClient: prisma
    });

    const job = await dispatcher.submitProvisioningJob({
      tenantId,
      authorizationId,
      templateIdentifier: templateIdentifier || templateId || 'tpl-synthetic-api-01',
      imageIdentifier: imageIdentifier || imageId || null,
      operator,
      idempotencyKey: idempotencyKey || req.headers['x-idempotency-key'] || null,
      extraEnv: extraEnv || {},
      processSync: false
    });

    // Dispatch execution to dedicated standalone runtime worker daemon
    const workerClient = new WorkerClient();
    if (processSync !== false) {
      const triggerRes = await workerClient.triggerJob({ jobId: job.id, tenantId }).catch(() => ({ ok: false }));
      let workerResult = null;
      if (!triggerRes?.ok) {
        // Fallback when standalone worker daemon is not running (e.g. legacy test suites)
        try {
          const adapter = new ContainerRuntimeAdapter();
          const localWorker = new RuntimeWorkerService({ prismaClient: prisma, adapter });
          workerResult = await localWorker.processJob(job.id);
        } catch (_) {}
      }
      const updatedJob = await prisma.deceptionProvisioningJob.findUnique({
        where: { id: job.id },
        include: { environment: true }
      });
      const responseData = updatedJob
        ? {
            ...updatedJob,
            workerResult: workerResult || {
              containerId: updatedJob.environment?.containerId || updatedJob.resultEvidence?.containerId,
              networkId: updatedJob.environment?.networkId || updatedJob.resultEvidence?.networkId,
              environmentId: updatedJob.environment?.id || updatedJob.environmentId
            }
          }
        : job;
      return res.status(201).json({ status: 'success', data: responseData });
    } else {
      workerClient.triggerJob({ jobId: job.id, tenantId }).catch(() => {});
      return res.status(201).json({ status: 'success', data: job });
    }
  } catch (err) {
    next(err);
  }
}

export async function listProvisioningJobs(req, res, next) {
  try {
    const tenantId = getTenantId(req);
    const { status, authorizationId, limit } = req.query;
    const prisma = req.prisma || getPrismaClient();
    const dispatcher = new ProvisioningDispatcher({ prismaClient: prisma });

    const result = await dispatcher.listJobs(tenantId, {
      status,
      authorizationId,
      limit: limit ? parseInt(limit, 10) : 50
    });

    res.status(200).json({
      status: 'success',
      data: result.jobs,
      meta: { total: result.total }
    });
  } catch (err) {
    next(err);
  }
}

export async function getProvisioningJob(req, res, next) {
  try {
    const tenantId = getTenantId(req);
    const { jobId } = req.params;
    const prisma = req.prisma || getPrismaClient();
    const dispatcher = new ProvisioningDispatcher({ prismaClient: prisma });

    const job = await dispatcher.getJob(tenantId, jobId);
    res.status(200).json({ status: 'success', data: job });
  } catch (err) {
    next(err);
  }
}

export async function getEnvironmentEvidence(req, res, next) {
  try {
    const tenantId = getTenantId(req);
    const { environmentId } = req.params;
    const prisma = req.prisma || getPrismaClient();

    const env = await prisma.deceptionRuntimeEnvironment.findFirst({
      where: { id: environmentId, tenantId },
      include: {
        authorization: true,
        events: {
          orderBy: { recordedAt: 'asc' }
        }
      }
    });

    if (!env) {
      return res.status(404).json({
        status: 'error',
        message: `Environment "${environmentId}" not found for this tenant.`
      });
    }

    const evidenceData = {
      environmentId: env.id,
      containerId: env.containerId,
      containerName: env.containerName,
      networkId: env.networkId,
      networkName: env.networkName,
      imageIdentifier: env.imageIdentifier,
      imageDigest: env.imageDigest,
      templateIdentifier: env.templateIdentifier,
      healthStatus: env.healthStatus,
      healthCheckedAt: env.healthCheckedAt,
      healthCheckDetails: env.healthCheckDetails,
      actualMeasuredUsage: env.actualMeasuredUsage,
      runtimeEvidence: env.runtimeEvidence,
      events: env.events
    };

    res.status(200).json({ status: 'success', data: evidenceData });
  } catch (err) {
    next(err);
  }
}

// -----------------------------------------------------------------------------
// Runtime Health Monitoring (Stage 5B.3)
// -----------------------------------------------------------------------------

export async function getRuntimeHealthOverviewHandler(req, res, next) {
  try {
    const tenantId = getTenantId(req);
    const prisma = req.prisma || getPrismaClient();
    const monitor = new RuntimeHealthMonitorService({ prismaClient: prisma });

    const overview = await monitor.getTenantHealthOverview({ tenantId });
    res.status(200).json({ status: 'success', data: overview });
  } catch (err) {
    next(err);
  }
}

export async function getEnvironmentHealthDetailsHandler(req, res, next) {
  try {
    const tenantId = getTenantId(req);
    const { environmentId } = req.params;
    const forceLive = req.query.live === 'true';
    const prisma = req.prisma || getPrismaClient();
    const monitor = new RuntimeHealthMonitorService({ prismaClient: prisma });

    const health = await monitor.inspectEnvironmentHealth({
      tenantId,
      environmentId,
      forceLive
    });

    res.status(200).json({ status: 'success', data: health });
  } catch (err) {
    next(err);
  }
}

// -----------------------------------------------------------------------------
// Runtime Telemetry (Stage 5B.3)
// -----------------------------------------------------------------------------

export async function getRuntimeTelemetrySummaryHandler(req, res, next) {
  try {
    const tenantId = getTenantId(req);
    const environmentId = req.query.environmentId || null;

    const summary = defaultRuntimeTelemetry.getTelemetrySummary({
      tenantId,
      environmentId
    });

    res.status(200).json({ status: 'success', data: summary });
  } catch (err) {
    next(err);
  }
}

export async function getEnvironmentTelemetryEventsHandler(req, res, next) {
  try {
    const tenantId = getTenantId(req);
    const { environmentId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;
    const eventType = req.query.eventType || null;

    const eventsData = defaultRuntimeTelemetry.getTelemetryEvents({
      tenantId,
      environmentId,
      limit,
      offset,
      eventType
    });

    res.status(200).json({ status: 'success', data: eventsData });
  } catch (err) {
    next(err);
  }
}

// -----------------------------------------------------------------------------
// Runtime Reconciliation (Stage 5B.3)
// -----------------------------------------------------------------------------

export async function getRuntimeReconciliationHandler(req, res, next) {
  try {
    const tenantId = getTenantId(req);
    const prisma = req.prisma || getPrismaClient();
    const reconciler = new RuntimeReconciliationService({ prismaClient: prisma });

    const results = await reconciler.reconcileTenant({ tenantId });
    res.status(200).json({ status: 'success', data: results });
  } catch (err) {
    next(err);
  }
}

export async function runRuntimeReconciliationHandler(req, res, next) {
  try {
    const tenantId = getTenantId(req);
    const environmentId = req.body?.environmentId || null;
    const prisma = req.prisma || getPrismaClient();
    const reconciler = new RuntimeReconciliationService({ prismaClient: prisma });

    let results;
    if (environmentId) {
      results = await reconciler.reconcileEnvironment({ tenantId, environmentId });
    } else {
      results = await reconciler.reconcileTenant({ tenantId });
    }

    res.status(200).json({ status: 'success', data: results });
  } catch (err) {
    next(err);
  }
}

// -----------------------------------------------------------------------------
// Execution Evidence Verification & Completeness (Stage 5B.3)
// -----------------------------------------------------------------------------

export async function verifyEnvironmentEvidenceHandler(req, res, next) {
  try {
    const tenantId = getTenantId(req);
    const { environmentId } = req.params;
    const prisma = req.prisma || getPrismaClient();

    const verification = await verifyEvidenceChain({
      tenantId,
      environmentId,
      prismaClient: prisma
    });

    res.status(200).json({ status: 'success', data: verification });
  } catch (err) {
    next(err);
  }
}

export async function getEvidenceCompletenessHandler(req, res, next) {
  try {
    const tenantId = getTenantId(req);
    const { environmentId } = req.params;
    const prisma = req.prisma || getPrismaClient();

    const completeness = await verifyEvidenceCompleteness({
      tenantId,
      environmentId,
      prismaClient: prisma
    });

    res.status(200).json({ status: 'success', data: completeness });
  } catch (err) {
    next(err);
  }
}

// -----------------------------------------------------------------------------
// Runtime Mutation History & Proposal (Stage 5B.3)
// -----------------------------------------------------------------------------

export async function listRuntimeMutationsHandler(req, res, next) {
  try {
    const tenantId = getTenantId(req);
    const { environmentId } = req.query;
    const prisma = req.prisma || getPrismaClient();

    const where = { tenantId };
    if (environmentId) {
      where.environmentId = environmentId;
    }

    const mutations = await prisma.deceptionRuntimeMutation.findMany({
      where,
      orderBy: { proposedAt: 'desc' },
      take: 50
    });

    res.status(200).json({ status: 'success', success: true, data: mutations });
  } catch (err) {
    next(err);
  }
}

export async function proposeRuntimeMutationHandler(req, res, next) {
  try {
    const tenantId = getTenantId(req);
    const actor = getOperatorInfo(req);
    const prisma = req.prisma || getPrismaClient();
    const envManager = new RuntimeEnvironmentManager({ prismaClient: prisma });

    const {
      environmentId,
      mutationType,
      targetGraphVersion,
      syntheticDiff
    } = req.body || {};

    if (!environmentId || !mutationType || typeof targetGraphVersion !== 'number') {
      return res.status(400).json({
        status: 'error',
        message: 'environmentId, mutationType, and targetGraphVersion are required.'
      });
    }

    const mutation = await envManager.proposeRuntimeMutation({
      tenantId,
      environmentId,
      mutationType,
      targetGraphVersion,
      syntheticDiff: syntheticDiff || {},
      actor
    });

    res.status(201).json({ status: 'success', data: mutation });
  } catch (err) {
    next(err);
  }
}

// -----------------------------------------------------------------------------
// Stage 5B.4: Dynamic DSG Execution Engine & Rollback Handlers
// -----------------------------------------------------------------------------

export async function generateDsgPlanHandler(req, res, next) {
  try {
    const tenantId = getTenantId(req);
    const { environmentId, assessmentId, observationId } = req.body || {};
    const prisma = req.prisma || getPrismaClient();
    const engine = new DSGExecutionEngine({ prismaClient: prisma });

    const env = await prisma.deceptionRuntimeEnvironment.findFirst({
      where: { id: environmentId, tenantId }
    });

    if (!env) {
      return res.status(404).json({
        status: 'error',
        message: `Environment "${environmentId}" not found for this tenant.`
      });
    }

    let assessment = null;
    if (assessmentId) {
      assessment = await prisma.behavioralAssessment.findUnique({ where: { id: assessmentId } });
    } else if (observationId) {
      assessment = await prisma.behavioralAssessment.findFirst({ where: { observationId } });
    }

    const plan = engine.deriveAdaptiveMutation({
      assessment: assessment || {},
      currentState: {},
      currentVersion: env.dsgGraphVersion || 1
    });

    res.status(200).json({ status: 'success', data: plan });
  } catch (err) {
    next(err);
  }
}

export async function validateDsgMutationHandler(req, res, next) {
  try {
    const { currentState, proposedMutation, currentGraphVersion, targetGraphVersion } = req.body || {};
    const result = DSGConsistencyEngine.validateConsistency({
      currentState: currentState || {},
      proposedMutation: proposedMutation || {},
      currentGraphVersion: currentGraphVersion || 1,
      targetGraphVersion: targetGraphVersion || 2
    });

    res.status(200).json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
}

export async function executeDsgMutationHandler(req, res, next) {
  try {
    const tenantId = getTenantId(req);
    const operator = getOperatorInfo(req);
    const prisma = req.prisma || getPrismaClient();
    const engine = new DSGExecutionEngine({ prismaClient: prisma });

    const {
      environmentId,
      authorizationId,
      observationId,
      assessmentId,
      proposedMutation,
      idempotencyKey,
      forceLive
    } = req.body || {};

    if (!environmentId) {
      return res.status(400).json({
        status: 'error',
        message: 'environmentId is required to execute a DSG mutation.'
      });
    }

    const result = await engine.executePipeline({
      tenantId,
      environmentId,
      authorizationId,
      observationId,
      assessmentId,
      proposedMutation,
      operator,
      idempotencyKey,
      forceLive: Boolean(forceLive)
    });

    res.status(201).json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
}

export async function getDsgMutationStatusHandler(req, res, next) {
  try {
    const tenantId = getTenantId(req);
    const { mutationId } = req.params;
    const prisma = req.prisma || getPrismaClient();

    const mutation = await prisma.deceptionRuntimeMutation.findFirst({
      where: { id: mutationId, tenantId },
      include: { environment: true, graph: true }
    });

    if (!mutation) {
      return res.status(404).json({
        status: 'error',
        message: `Mutation "${mutationId}" not found for this tenant.`
      });
    }

    res.status(200).json({ status: 'success', data: mutation });
  } catch (err) {
    next(err);
  }
}

export async function rollbackDsgMutationHandler(req, res, next) {
  try {
    const tenantId = getTenantId(req);
    const operator = getOperatorInfo(req);
    const { mutationId } = req.params;
    const { reason } = req.body || {};
    const prisma = req.prisma || getPrismaClient();
    const engine = new DSGExecutionEngine({ prismaClient: prisma });

    const result = await engine.rollbackMutation({
      tenantId,
      mutationId,
      operator,
      reason: reason || 'Operator initiated state rollback.'
    });

    res.status(200).json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
}

export async function getDsgVersionHistoryHandler(req, res, next) {
  try {
    const tenantId = getTenantId(req);
    const { environmentId, graphId } = req.query;
    const prisma = req.prisma || getPrismaClient();

    const where = { tenantId };
    if (environmentId) where.environmentId = environmentId;
    if (graphId) where.dsgGraphId = graphId;

    const mutations = await prisma.deceptionRuntimeMutation.findMany({
      where,
      orderBy: { targetGraphVersion: 'desc' },
      take: 100
    });

    res.status(200).json({ status: 'success', success: true, data: mutations });
  } catch (err) {
    next(err);
  }
}

export async function getEnvironmentDsgLiveStateHandler(req, res, next) {
  try {
    const tenantId = getTenantId(req);
    const { environmentId } = req.params;
    const workerClient = new WorkerClient();

    const result = await workerClient.getEnvironmentDsgState({
      environmentId,
      tenantId
    });

    if (!result.ok) {
      return res.status(502).json({
        status: 'error',
        message: result.error || 'Failed to retrieve live DSG state from runtime worker.'
      });
    }

    res.status(200).json({ status: 'success', data: result.data });
  } catch (err) {
    next(err);
  }
}
