/**
 * Standalone Runtime Worker Daemon (Stage 5B.2.2).
 *
 * Implements an independent operating system process dedicated to container provisioning,
 * lifecycle supervision, and evidence collection:
 * - Runs in a separate OS process space from the Express API backend.
 * - Possesses exclusive Docker socket permissions (Express backend has ZERO Docker access).
 * - Exposes an authenticated, constrained local loopback IPC interface (127.0.0.1:5055).
 * - Enforces schema validation, tenant ownership verification, and strict allowlists.
 * - Continuously drains the durable DeceptionProvisioningJob database queue.
 * - Manages container health inspection, teardown, and orphan recovery.
 */

import http from 'node:http';
import crypto from 'node:crypto';
import { getPrismaClient } from '../db/client.js';
import { ContainerRuntimeAdapter } from './container-runtime-adapter.js';
import { RuntimeWorkerService } from './runtime-worker.service.js';
import { ResourceGovernanceService } from './resource-governance.service.js';
import { ExecutionEvidenceRecorder, EXECUTION_EVENT_TYPES } from './execution-evidence-recorder.service.js';
import { RUNTIME_LIFECYCLE_STATES, LifecycleStateMachine } from './lifecycle-state-machine.js';

export class StandaloneRuntimeWorker {
  /**
   * @param {Object} [options]
   * @param {number} [options.port=5055]
   * @param {string} [options.host='127.0.0.1']
   * @param {string} [options.authToken]
   * @param {Object} [options.prismaClient]
   * @param {ContainerRuntimeAdapter} [options.adapter]
   * @param {number} [options.pollIntervalMs=1500]
   */
  constructor(options = {}) {
    this.workerId = `worker-proc-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
    this.port = Number(options.port || process.env.WORKER_PORT || 5055);
    this.host = options.host || process.env.WORKER_HOST || '127.0.0.1';
    this.authToken = options.authToken || process.env.RUNTIME_WORKER_AUTH_TOKEN || 'dev-runtime-worker-secret-token';
    this.prisma = options.prismaClient || getPrismaClient();
    this.adapter = options.adapter || new ContainerRuntimeAdapter();
    this.resourceGovernance = new ResourceGovernanceService(this.prisma);
    this.evidenceRecorder = new ExecutionEvidenceRecorder(this.prisma);
    this.workerService = new RuntimeWorkerService({
      prismaClient: this.prisma,
      adapter: this.adapter,
      resourceGovernance: this.resourceGovernance,
      evidenceRecorder: this.evidenceRecorder
    });

    this.server = null;
    this.pollIntervalMs = options.pollIntervalMs || 1500;
    this.pollTimer = null;
    this.isPolling = false;
    this.activeJobs = new Set();
    this.isShuttingDown = false;
    this.startedAt = new Date();
  }

  /**
   * Starts the worker HTTP server and background queue polling loop.
   *
   * @returns {Promise<{ host: string, port: number, pid: number }>}
   */
  async start() {
    // 1. Verify Docker connection
    const dockerPing = await this.adapter.ping();
    if (!dockerPing.ok) {
      console.warn(`[RuntimeWorker] Warning: Docker socket ping failed: ${dockerPing.error || 'unreachable'}`);
    } else {
      console.log(`[RuntimeWorker] Connected to Docker Engine (${dockerPing.version}, API ${dockerPing.apiVersion}) on socket ${this.adapter.socketPath}`);
    }

    // 2. Start HTTP server
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => this._handleRequest(req, res));
      this.server.on('error', (err) => {
        console.error(`[RuntimeWorker] HTTP Server error: ${err.message}`);
        reject(err);
      });

      this.server.listen(this.port, this.host, () => {
        console.log(`[RuntimeWorker] Worker process ${process.pid} listening on http://${this.host}:${this.port}`);
        this._startPolling();
        resolve({ host: this.host, port: this.port, pid: process.pid, workerId: this.workerId });
      });
    });
  }

  /**
   * Stops the worker process cleanly.
   *
   * @returns {Promise<void>}
   */
  async stop() {
    this.isShuttingDown = true;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    if (this.server) {
      await new Promise((resolve) => this.server.close(resolve));
      this.server = null;
    }
    console.log(`[RuntimeWorker] Worker process ${process.pid} stopped.`);
  }

  /**
   * Periodically polls database queue for QUEUED jobs.
   *
   * @private
   */
  _startPolling() {
    this.pollTimer = setInterval(async () => {
      if (this.isPolling || this.isShuttingDown) return;
      this.isPolling = true;
      try {
        await this._pollQueue();
      } catch (err) {
        console.error(`[RuntimeWorker] Error in queue polling loop: ${err.message}`);
      } finally {
        this.isPolling = false;
      }
    }, this.pollIntervalMs);
  }

  /**
   * Consumes one pending job from the database queue.
   *
   * @private
   */
  async _pollQueue() {
    const nextJob = await this.prisma.deceptionProvisioningJob.findFirst({
      where: { jobStatus: 'QUEUED' },
      orderBy: { queuedAt: 'asc' }
    });

    if (!nextJob) return;

    if (this.activeJobs.has(nextJob.id)) return;
    this.activeJobs.add(nextJob.id);

    try {
      console.log(`[RuntimeWorker] Background polling picked up job ${nextJob.id} (tenant ${nextJob.tenantId})`);
      await this.workerService.processJob(nextJob.id);
      console.log(`[RuntimeWorker] Successfully completed job ${nextJob.id}`);
    } catch (err) {
      console.error(`[RuntimeWorker] Job ${nextJob.id} execution failed: ${err.message}`);
    } finally {
      this.activeJobs.delete(nextJob.id);
    }
  }

  /**
   * Dispatches and handles HTTP requests with authentication and route matching.
   *
   * @private
   */
  async _handleRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
    const pathname = url.pathname;
    const method = req.method;

    // Helper for JSON responses
    const sendJson = (status, data) => {
      const body = JSON.stringify(data);
      res.writeHead(status, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      });
      res.end(body);
    };

    // 1. Health check endpoint (allow without token for readiness probes, but include process details)
    if (method === 'GET' && pathname === '/health') {
      const dockerPing = await this.adapter.ping();
      return sendJson(200, {
        status: dockerPing.ok ? 'UP' : 'DEGRADED',
        workerId: this.workerId,
        pid: process.pid,
        uptime: process.uptime(),
        startedAt: this.startedAt.toISOString(),
        activeJobsCount: this.activeJobs.size,
        docker: {
          connected: dockerPing.ok,
          socketPath: this.adapter.socketPath,
          version: dockerPing.version,
          apiVersion: dockerPing.apiVersion,
          error: dockerPing.error || null
        },
        memoryUsage: process.memoryUsage()
      });
    }

    // 2. Authentication check for all restricted operations
    const token = req.headers['x-worker-token'];
    if (!token || token !== this.authToken) {
      return sendJson(401, {
        status: 'error',
        code: 'UNAUTHORIZED_WORKER_REQUEST',
        message: 'Invalid or missing x-worker-token header.'
      });
    }

    // Helper to read JSON request body
    const readBody = async () => {
      return new Promise((resolve, reject) => {
        let raw = '';
        req.on('data', (c) => (raw += c));
        req.on('end', () => {
          if (!raw) return resolve({});
          try {
            resolve(JSON.parse(raw));
          } catch (e) {
            reject(new Error('Malformed JSON request body.'));
          }
        });
        req.on('error', reject);
      });
    };

    try {
      // Route 1: POST /jobs/process
      if (method === 'POST' && pathname === '/jobs/process') {
        const body = await readBody();
        const { jobId, tenantId } = body;

        if (!jobId || !tenantId) {
          return sendJson(400, {
            status: 'error',
            message: 'jobId and tenantId are required.'
          });
        }

        const job = await this.prisma.deceptionProvisioningJob.findFirst({
          where: { id: jobId, tenantId }
        });

        if (!job) {
          return sendJson(404, {
            status: 'error',
            message: `Provisioning job "${jobId}" not found for tenant "${tenantId}".`
          });
        }

        if (this.activeJobs.has(jobId)) {
          return sendJson(409, {
            status: 'error',
            message: `Job "${jobId}" is already being processed.`
          });
        }

        this.activeJobs.add(jobId);
        // Process asynchronously or await
        try {
          const outcome = await this.workerService.processJob(jobId);
          return sendJson(200, {
            status: 'success',
            message: 'Job processed successfully.',
            data: outcome
          });
        } finally {
          this.activeJobs.delete(jobId);
        }
      }

      // Route 2: POST /environments/:id/terminate
      const termMatch = pathname.match(/^\/environments\/([^/]+)\/terminate$/);
      if (method === 'POST' && termMatch) {
        const environmentId = decodeURIComponent(termMatch[1]);
        const body = await readBody();
        const { tenantId, reason, actor } = body;

        if (!tenantId) {
          return sendJson(400, { status: 'error', message: 'tenantId is required.' });
        }

        const env = await this.prisma.deceptionRuntimeEnvironment.findFirst({
          where: { id: environmentId, tenantId }
        });

        if (!env) {
          return sendJson(404, {
            status: 'error',
            message: `Environment "${environmentId}" not found for tenant "${tenantId}".`
          });
        }

        if (env.lifecycleState === RUNTIME_LIFECYCLE_STATES.TERMINATED) {
          return sendJson(200, { status: 'success', data: env, message: 'Already terminated.' });
        }

        // State machine validation
        LifecycleStateMachine.validateTransition(
          env.lifecycleState,
          RUNTIME_LIFECYCLE_STATES.TERMINATING,
          { allowSimulatedExecution: true }
        );
        LifecycleStateMachine.validateTransition(
          RUNTIME_LIFECYCLE_STATES.TERMINATING,
          RUNTIME_LIFECYCLE_STATES.TERMINATED,
          { allowSimulatedExecution: true }
        );

        // Teardown real container and isolated bridge network via Adapter
        if (env.containerId) {
          await this.adapter.stopAndRemoveContainer(env.containerId).catch((e) => {
            console.warn(`[RuntimeWorker] Warning removing container ${env.containerId}: ${e.message}`);
          });
        }
        if (env.networkId) {
          await this.adapter.removeIsolatedNetwork(env.networkId).catch((e) => {
            console.warn(`[RuntimeWorker] Warning removing network ${env.networkId}: ${e.message}`);
          });
        }

        const terminated = await this.prisma.deceptionRuntimeEnvironment.update({
          where: { id: env.id },
          data: {
            lifecycleState: RUNTIME_LIFECYCLE_STATES.TERMINATED,
            containerId: null,
            networkId: null,
            statusReason: reason || 'Operator requested termination',
            terminatedAt: new Date()
          }
        });

        // Release quota
        await this.resourceGovernance.releaseResources({
          tenantId,
          applicationId: env.applicationId,
          cpu: env.allocatedCpu,
          memoryMb: env.allocatedMemoryMb
        }).catch(() => {});

        // Record execution evidence chain event
        await this.evidenceRecorder.recordVerifiedEvidence({
          tenantId,
          authorizationId: env.authorizationId,
          environmentId: env.id,
          eventType: EXECUTION_EVENT_TYPES.ENVIRONMENT_TERMINATED,
          severity: 'INFO',
          message: `Environment "${env.environmentIdentifier}" successfully terminated and isolated resources removed.`,
          actorIdentifier: actor?.email || 'STANDALONE_RUNTIME_WORKER',
          actorRole: actor?.role || 'SYSTEM',
          evidencePayload: {
            environmentId: env.id,
            terminatedAt: new Date().toISOString(),
            reason: reason || 'Termination requested'
          }
        }).catch(() => {});

        return sendJson(200, { status: 'success', data: terminated });
      }

      // Route 3: GET /environments/:id/health
      const healthMatch = pathname.match(/^\/environments\/([^/]+)\/health$/);
      if (method === 'GET' && healthMatch) {
        const environmentId = decodeURIComponent(healthMatch[1]);
        const tenantId = url.searchParams.get('tenantId');

        if (!tenantId) {
          return sendJson(400, { status: 'error', message: 'tenantId query parameter is required.' });
        }

        const env = await this.prisma.deceptionRuntimeEnvironment.findFirst({
          where: { id: environmentId, tenantId }
        });

        if (!env) {
          return sendJson(404, {
            status: 'error',
            message: `Environment "${environmentId}" not found for tenant "${tenantId}".`
          });
        }

        if (env.containerId) {
          const probe = await this.adapter.checkContainerHealth({ containerId: env.containerId });
          return sendJson(200, {
            status: 'success',
            healthy: probe.healthy,
            environmentId: env.id,
            containerId: env.containerId,
            statusCode: probe.statusCode,
            latencyMs: probe.latencyMs,
            lifecycleState: env.lifecycleState,
            allocatedResources: {
              cpu: env.allocatedCpu,
              memoryMb: env.allocatedMemoryMb,
              storageMb: env.allocatedStorageMb
            }
          });
        }

        return sendJson(200, {
          status: 'success',
          healthy: env.lifecycleState === RUNTIME_LIFECYCLE_STATES.ACTIVE,
          environmentId: env.id,
          isSimulated: env.isSimulated,
          lifecycleState: env.lifecycleState
        });
      }

      // Route 4: POST /cleanup/orphans
      if (method === 'POST' && pathname === '/cleanup/orphans') {
        const cleaned = await this._cleanOrphans();
        return sendJson(200, {
          status: 'success',
          containersRemoved: cleaned.containersRemoved,
          networksRemoved: cleaned.networksRemoved,
          cleaned
        });
      }

      // Fallback 404
      return sendJson(404, { status: 'error', message: `Route ${method} ${pathname} not found on worker.` });
    } catch (err) {
      console.error(`[RuntimeWorker] Request processing error: ${err.message}`, err);
      return sendJson(500, { status: 'error', message: err.message });
    }
  }

  /**
   * Detects and removes orphaned deception containers that are not ACTIVE in the DB.
   *
   * @private
   * @returns {Promise<{ containersRemoved: number, networksRemoved: number }>}
   */
  async _cleanOrphans() {
    let containersRemoved = 0;
    let networksRemoved = 0;

    try {
      const activeEnvs = await this.prisma.deceptionRuntimeEnvironment.findMany({
        where: {
          lifecycleState: { in: [RUNTIME_LIFECYCLE_STATES.ACTIVE, RUNTIME_LIFECYCLE_STATES.PROVISIONING] },
          containerId: { not: null }
        },
        select: { containerId: true, networkId: true }
      });

      const activeContainerIds = new Set(activeEnvs.map((e) => e.containerId));
      const activeNetworkIds = new Set(activeEnvs.map((e) => e.networkId));

      const containers = await this.adapter.listContainers({ all: true });
      for (const c of containers) {
        const isDeception = c.Labels && c.Labels['deception.managed'] === 'true';
        if (isDeception && !activeContainerIds.has(c.Id)) {
          console.log(`[RuntimeWorker] Removing orphaned container ${c.Id.slice(0, 12)} (${c.Names?.[0]})`);
          await this.adapter.stopAndRemoveContainer(c.Id).catch(() => {});
          containersRemoved++;
        }
      }

      const networks = await this.adapter.listNetworks();
      for (const n of networks) {
        const isDeception = n.Labels && n.Labels['deception.managed'] === 'true';
        if (isDeception && !activeNetworkIds.has(n.Id)) {
          console.log(`[RuntimeWorker] Removing orphaned network ${n.Id.slice(0, 12)} (${n.Name})`);
          await this.adapter.removeIsolatedNetwork(n.Id).catch(() => {});
          networksRemoved++;
        }
      }
    } catch (err) {
      console.warn(`[RuntimeWorker] Orphan cleanup warning: ${err.message}`);
    }

    return { containersRemoved, networksRemoved };
  }
}

// When executed directly as standalone process:
if (process.argv[1] && process.argv[1].endsWith('worker-process.js')) {
  process.title = 'adaptive-deception-runtime-worker';
  const worker = new StandaloneRuntimeWorker();

  const shutdown = async (signal) => {
    console.log(`\n[RuntimeWorker] Received ${signal}. Initiating graceful shutdown...`);
    await worker.stop();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  worker.start().catch((err) => {
    console.error(`[RuntimeWorker] Fatal startup error: ${err.message}`, err);
    process.exit(1);
  });
}

export default StandaloneRuntimeWorker;
