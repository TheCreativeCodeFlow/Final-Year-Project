/**
 * Provisioning Dispatcher & Job Queue Service (Stage 5B.2).
 *
 * Implements the durable submission boundary between the Express HTTP API
 * and the Dedicated Runtime Worker:
 * - Express backend creates durable job records; it NEVER touches Docker directly.
 * - Enforces idempotency keys and payload verification.
 * - Validates authorization status (strictly APPROVED), lifetime, and image/template compatibility.
 * - Reserves quota capacity prior to queue admission.
 */

import crypto from 'node:crypto';
import { getPrismaClient } from '../db/client.js';
import { ResourceGovernanceService } from './resource-governance.service.js';
import { ExecutionEvidenceRecorder, EXECUTION_EVENT_TYPES } from './execution-evidence-recorder.service.js';
import { getApprovedImage, validateImageForServiceType } from './image-catalogue.js';
import { getSyntheticTemplate } from './synthetic-templates.js';

export const PROVISIONING_JOB_STATUSES = Object.freeze({
  QUEUED: 'QUEUED',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED'
});

export class ProvisioningDispatcher {
  /**
   * @param {Object} [options]
   * @param {Object} [options.prismaClient]
   * @param {Object} [options.runtimeWorker]
   * @param {Object} [options.resourceGovernance]
   * @param {Object} [options.evidenceRecorder]
   */
  constructor(options = {}) {
    this.prisma = options.prismaClient || null;
    this.runtimeWorker = options.runtimeWorker || null;
    this.resourceGovernance = options.resourceGovernance || new ResourceGovernanceService(this.prisma);
    this.evidenceRecorder = options.evidenceRecorder || new ExecutionEvidenceRecorder(this.prisma);
  }

  getDb() {
    return this.prisma || getPrismaClient();
  }

  /**
   * Computes deterministic SHA-256 hash of a provisioning request payload.
   *
   * @private
   */
  _computePayloadHash(payload) {
    const canonical = JSON.stringify({
      tenantId: payload.tenantId,
      authorizationId: payload.authorizationId,
      templateIdentifier: payload.templateIdentifier,
      imageIdentifier: payload.imageIdentifier
    });
    return crypto.createHash('sha256').update(canonical).digest('hex');
  }

  /**
   * Submits an authorized provisioning job to the durable queue.
   *
   * @param {Object} params
   * @param {string} params.tenantId
   * @param {string} params.authorizationId
   * @param {string} [params.templateIdentifier='tpl-synthetic-api-01']
   * @param {string} [params.imageIdentifier]
   * @param {Object} [params.operator]
   * @param {string} [params.idempotencyKey]
   * @param {Object} [params.extraEnv={}]
   * @param {boolean} [params.processSync=true] - If true, immediately triggers worker execution
   * @returns {Promise<Object>}
   */
  async submitProvisioningJob({
    tenantId,
    authorizationId,
    templateIdentifier = 'tpl-synthetic-api-01',
    imageIdentifier = null,
    operator = null,
    idempotencyKey = null,
    extraEnv = {},
    processSync = true
  }) {
    const prisma = this.getDb();
    const effectiveHash = this._computePayloadHash({
      tenantId,
      authorizationId,
      templateIdentifier,
      imageIdentifier
    });

    // 1. Idempotency Check
    if (idempotencyKey) {
      const existing = await prisma.deceptionProvisioningJob.findFirst({
        where: { tenantId, idempotencyKey },
        include: { environment: true }
      });

      if (existing) {
        if (existing.resultEvidence?.payloadHash && existing.resultEvidence?.payloadHash !== effectiveHash) {
          const err = new Error('Idempotency key reuse with different parameters or mismatched provisioning payload.');
          err.code = 'IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH';
          err.statusCode = 409;
          throw err;
        }
        return { ...existing, idempotentReplay: true };
      }
    }

    // 2. Resolve and Validate Authorization
    const auth = await prisma.deceptionExecutionAuthorization.findFirst({
      where: { id: authorizationId, tenantId },
      include: {
        policyDecision: { include: { policy: true } },
        graph: true
      }
    });

    if (!auth) {
      const err = new Error(`Execution authorization "${authorizationId}" not found for this tenant.`);
      err.code = 'AUTHORIZATION_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    if (auth.authorizationStatus !== 'APPROVED') {
      const err = new Error(
        `Cannot provision container: Authorization status is "${auth.authorizationStatus}". Must be "APPROVED".`
      );
      err.code = 'AUTHORIZATION_NOT_APPROVED';
      err.statusCode = 409;
      throw err;
    }

    const now = new Date();
    if (new Date(auth.expiresAt) <= now) {
      const err = new Error('Execution authorization has expired. Re-authorization required.');
      err.code = 'AUTHORIZATION_EXPIRED';
      err.statusCode = 409;
      throw err;
    }

    if (auth.revokedAt) {
      const err = new Error('Execution authorization was revoked. Provisioning rejected.');
      err.code = 'AUTHORIZATION_REVOKED';
      err.statusCode = 409;
      throw err;
    }

    // Separation of duties invariant
    if (
      auth.requestingOperatorEmail &&
      auth.approvingOperatorEmail &&
      auth.requestingOperatorEmail === auth.approvingOperatorEmail
    ) {
      const err = new Error(
        'Dual-custody violation: Requester and approver cannot be the same operator. Provisioning rejected.'
      );
      err.code = 'DUAL_CUSTODY_VIOLATION';
      err.statusCode = 409;
      throw err;
    }

    // Optimistic DSG graph version check
    if (auth.graph && auth.graph.graphVersion !== auth.dsgGraphVersion) {
      const err = new Error(
        `Stale DSG Graph: Graph was mutated to version ${auth.graph.graphVersion} (job based on v${auth.dsgGraphVersion}). Provisioning rejected.`
      );
      err.code = 'STALE_GRAPH_VERSION';
      err.statusCode = 409;
      throw err;
    }

    // 3. Resolve and Validate Template & Image
    const template = getSyntheticTemplate(templateIdentifier);
    if (!template) {
      const err = new Error(`Unknown synthetic service template "${templateIdentifier}".`);
      err.code = 'UNKNOWN_SYNTHETIC_TEMPLATE';
      err.statusCode = 400;
      throw err;
    }

    const effectiveImageId = imageIdentifier || template.defaultImageIdentifier;
    const imageConfig = getApprovedImage(effectiveImageId);
    if (!imageConfig) {
      const err = new Error(`Image "${effectiveImageId}" is not present in Approved Synthetic Image Catalogue.`);
      err.code = 'UNAPPROVED_IMAGE_REFERENCE';
      err.statusCode = 400;
      throw err;
    }

    const compatibility = validateImageForServiceType(effectiveImageId, template.serviceType);
    if (!compatibility.valid) {
      const err = new Error(compatibility.reason);
      err.code = 'INCOMPATIBLE_IMAGE_FOR_TEMPLATE';
      err.statusCode = 400;
      throw err;
    }

    // 4. Validate Resource Quota Admission
    const requestedCpu = template.resourceDefaults.allocatedCpu;
    const requestedMemoryMb = template.resourceDefaults.allocatedMemoryMb;

    const admission = await this.resourceGovernance.validateResourceAdmission({
      tenantId,
      applicationId: auth.applicationId,
      requestedCpu,
      requestedMemoryMb
    });

    if (!admission.eligible) {
      const err = new Error(`Resource admission rejected: ${admission.violations.join('; ')}`);
      err.code = 'RESOURCE_QUOTA_EXCEEDED';
      err.statusCode = 422;
      err.violations = admission.violations;
      throw err;
    }

    // Reserve resources in database
    await this.resourceGovernance.reserveResources({
      tenantId,
      applicationId: auth.applicationId,
      cpu: requestedCpu,
      memoryMb: requestedMemoryMb
    });

    // 5. Persist Durable Provisioning Job
    const job = await prisma.deceptionProvisioningJob.create({
      data: {
        tenantId,
        applicationId: auth.applicationId,
        authorizationId: auth.id,
        policyDecisionId: auth.policyDecisionId,
        dsgGraphId: auth.dsgGraphId,
        dsgGraphVersion: auth.dsgGraphVersion,
        policyVersion: auth.policyDecision?.policyVersion || 1,
        selectedStrategyId: auth.selectedStrategyId,
        templateIdentifier: template.templateIdentifier,
        imageIdentifier: imageConfig.imageIdentifier,
        imageDigest: imageConfig.immutableDigest,
        resourceReservation: {
          allocatedCpu: requestedCpu,
          allocatedMemoryMb: requestedMemoryMb,
          allocatedStorageMb: template.resourceDefaults.allocatedStorageMb,
          isolationMode: template.isolationMode
        },
        requestingOperatorId: operator?.id || auth.requestingOperatorId,
        requestingOperatorEmail: operator?.email || auth.requestingOperatorEmail,
        approvingOperatorId: auth.approvingOperatorId,
        approvingOperatorEmail: auth.approvingOperatorEmail,
        authorizationExpiresAt: auth.expiresAt,
        idempotencyKey,
        jobStatus: PROVISIONING_JOB_STATUSES.QUEUED,
        queuedAt: now,
        resultEvidence: {
          payloadHash: effectiveHash,
          extraEnv
        }
      }
    });

    // Record Event
    await this.evidenceRecorder.recordEvent({
      tenantId,
      authorizationId: auth.id,
      eventType: EXECUTION_EVENT_TYPES.PROVISIONING_REQUESTED,
      severity: 'INFO',
      message: `Provisioning job ${job.id} queued for template "${template.name}" using image "${imageConfig.name}".`,
      actorIdentifier: operator?.email || auth.requestingOperatorEmail,
      actorRole: operator?.role || 'OPERATOR',
      outcomeStatus: 'RECORDED',
      eventPayload: {
        jobId: job.id,
        templateIdentifier: template.templateIdentifier,
        imageIdentifier: imageConfig.imageIdentifier,
        idempotencyKey
      }
    });

    // 6. Trigger Worker Execution if configured
    if (processSync && this.runtimeWorker) {
      try {
        const workerResult = await this.runtimeWorker.processJob(job.id);
        return { ...job, workerResult, jobStatus: PROVISIONING_JOB_STATUSES.COMPLETED };
      } catch (workerErr) {
        // Return job with error details
        return {
          ...job,
          jobStatus: PROVISIONING_JOB_STATUSES.FAILED,
          error: workerErr.message
        };
      }
    }

    return job;
  }

  /**
   * Retrieves a provisioning job by ID.
   *
   * @param {string} tenantId
   * @param {string} jobId
   * @returns {Promise<Object>}
   */
  async getJob(tenantId, jobId) {
    const prisma = this.getDb();
    const job = await prisma.deceptionProvisioningJob.findFirst({
      where: { id: jobId, tenantId },
      include: {
        authorization: true,
        environment: true
      }
    });

    if (!job) {
      const err = new Error(`Provisioning job "${jobId}" not found for this tenant.`);
      err.code = 'JOB_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    return job;
  }

  /**
   * Lists provisioning jobs for a tenant.
   *
   * @param {string} tenantId
   * @param {Object} [filters]
   * @returns {Promise<{ total: number, jobs: Object[] }>}
   */
  async listJobs(tenantId, filters = {}) {
    const prisma = this.getDb();
    const where = { tenantId };

    if (filters.status) {
      where.jobStatus = filters.status;
    }
    if (filters.authorizationId) {
      where.authorizationId = filters.authorizationId;
    }

    const [total, jobs] = await Promise.all([
      prisma.deceptionProvisioningJob.count({ where }),
      prisma.deceptionProvisioningJob.findMany({
        where,
        include: { environment: true },
        orderBy: { queuedAt: 'desc' },
        take: filters.limit || 50
      })
    ]);

    return { total, jobs };
  }
}

export default ProvisioningDispatcher;
