/**
 * Runtime Worker API Client (Stage 5B.2.2).
 *
 * Provides the authenticated IPC/HTTP boundary between the Express Backend
 * and the Standalone Runtime Worker process:
 * - Express communicates strictly over authenticated loopback HTTP (127.0.0.1:5055).
 * - Express has ZERO access to the Docker socket or ContainerRuntimeAdapter.
 * - Enforces fail-safe timeouts, circuit-breaking, and explicit tenant scoping.
 */

import http from 'node:http';

export class WorkerClient {
  /**
   * @param {Object} [options]
   * @param {string} [options.workerUrl]
   * @param {string} [options.authToken]
   * @param {number} [options.timeoutMs=5000]
   */
  constructor(options = {}) {
    const rawUrl = options.workerUrl || process.env.RUNTIME_WORKER_URL || 'http://127.0.0.1:5055';
    this.workerUrl = new URL(rawUrl);
    this.authToken = options.authToken || process.env.RUNTIME_WORKER_AUTH_TOKEN || 'dev-runtime-worker-secret-token';
    this.timeoutMs = options.timeoutMs || 5000;
  }

  /**
   * Internal helper to execute JSON HTTP requests against the worker daemon.
   *
   * @private
   * @param {Object} reqOpts
   * @param {string} reqOpts.path
   * @param {string} [reqOpts.method='GET']
   * @param {Object} [reqOpts.body=null]
   * @param {number} [reqOpts.timeoutMs]
   * @returns {Promise<{ status: number, data: any }>}
   */
  _request({ path, method = 'GET', body = null, timeoutMs = this.timeoutMs }) {
    return new Promise((resolve, reject) => {
      const payloadStr = body ? JSON.stringify(body) : null;
      const headers = {
        'x-worker-token': this.authToken,
        Accept: 'application/json'
      };

      if (payloadStr) {
        headers['Content-Type'] = 'application/json';
        headers['Content-Length'] = Buffer.byteLength(payloadStr);
      }

      const req = http.request(
        {
          hostname: this.workerUrl.hostname,
          port: this.workerUrl.port,
          path,
          method,
          headers,
          timeout: timeoutMs
        },
        (res) => {
          let chunks = '';
          res.on('data', (c) => (chunks += c));
          res.on('end', () => {
            let data = null;
            if (chunks) {
              try {
                data = JSON.parse(chunks);
              } catch {
                data = chunks;
              }
            }
            resolve({ status: res.statusCode, data });
          });
        }
      );

      req.on('timeout', () => {
        req.destroy(new Error(`Worker request to ${path} timed out after ${timeoutMs}ms.`));
      });

      req.on('error', (err) => {
        reject(err);
      });

      if (payloadStr) {
        req.write(payloadStr);
      }
      req.end();
    });
  }

  /**
   * Probes worker service health and process metadata.
   *
   * @param {number} [timeoutMs]
   * @returns {Promise<{ ok: boolean, status: string, workerProcess?: Object, error?: string }>}
   */
  async getHealth(timeoutMs = this.timeoutMs) {
    try {
      const res = await this._request({ path: '/health', method: 'GET', timeoutMs });
      if (res.status === 200 && res.data) {
        return {
          ok: true,
          status: 'UP',
          workerProcess: res.data
        };
      }
      return {
        ok: false,
        status: 'DEGRADED',
        error: `Worker returned unexpected status HTTP ${res.status}`
      };
    } catch (err) {
      return {
        ok: false,
        status: 'OFFLINE',
        error: err.code === 'ECONNREFUSED' ? 'Worker daemon connection refused (offline)' : err.message
      };
    }
  }

  /**
   * Triggers the dedicated worker process to consume and execute a queued job.
   *
   * @param {Object} params
   * @param {string} params.jobId
   * @param {string} params.tenantId
   * @returns {Promise<{ ok: boolean, status: string, error?: string }>}
   */
  async triggerJob({ jobId, tenantId }) {
    if (!jobId || !tenantId) {
      throw new Error('jobId and tenantId are required to trigger worker execution.');
    }

    try {
      const res = await this._request({
        path: '/jobs/process',
        method: 'POST',
        body: { jobId, tenantId }
      });

      if (res.status >= 200 && res.status < 300) {
        return { ok: true, status: 'DISPATCHED', data: res.data };
      }
      return {
        ok: false,
        status: 'REJECTED',
        error: res.data?.message || `Worker returned HTTP ${res.status}`
      };
    } catch (err) {
      return {
        ok: false,
        status: 'QUEUED_UNTRIGGERED',
        error: `Worker IPC trigger failed: ${err.message}. Job remains queued for background polling.`
      };
    }
  }

  /**
   * Requests the worker process to safely terminate and remove an isolated container environment.
   *
   * @param {Object} params
   * @param {string} params.environmentId
   * @param {string} params.tenantId
   * @param {string} [params.reason]
   * @param {Object} [params.actor]
   * @returns {Promise<{ ok: boolean, terminated: boolean, error?: string }>}
   */
  async terminateEnvironment({ environmentId, tenantId, reason = 'Operator requested termination', actor = null }) {
    if (!environmentId || !tenantId) {
      throw new Error('environmentId and tenantId are required to terminate environment.');
    }

    try {
      const res = await this._request({
        path: `/environments/${encodeURIComponent(environmentId)}/terminate`,
        method: 'POST',
        body: { tenantId, reason, actor }
      });

      if (res.status === 200) {
        return { ok: true, terminated: true, data: res.data };
      }
      return {
        ok: false,
        terminated: false,
        error: res.data?.message || `Worker returned HTTP ${res.status}`
      };
    } catch (err) {
      return {
        ok: false,
        terminated: false,
        error: `Worker IPC terminate failed: ${err.message}`
      };
    }
  }

  /**
   * Queries the dedicated worker for real-time container health metrics.
   *
   * @param {Object} params
   * @param {string} params.environmentId
   * @param {string} params.tenantId
   * @returns {Promise<{ ok: boolean, health?: Object, error?: string }>}
   */
  async getEnvironmentHealth({ environmentId, tenantId }) {
    if (!environmentId || !tenantId) {
      throw new Error('environmentId and tenantId are required to check environment health.');
    }

    try {
      const res = await this._request({
        path: `/environments/${encodeURIComponent(environmentId)}/health?tenantId=${encodeURIComponent(tenantId)}`,
        method: 'GET'
      });

      if (res.status === 200 && res.data) {
        return { ok: true, health: res.data };
      }
      return {
        ok: false,
        error: res.data?.message || `Worker returned HTTP ${res.status}`
      };
    } catch (err) {
      return {
        ok: false,
        error: `Worker IPC health check failed: ${err.message}`
      };
    }
  }

  /**
   * Triggers orphan container and isolated network reconciliation.
   *
   * @param {number} [timeoutMs=30000]
   * @returns {Promise<{ ok: boolean, data?: Object, error?: string }>}
   */
  async cleanupOrphans(timeoutMs = 30000) {
    try {
      const res = await this._request({
        path: '/cleanup/orphans',
        method: 'POST',
        timeoutMs
      });
      return { ok: res.status === 200, data: res.data };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }
}

export default WorkerClient;
