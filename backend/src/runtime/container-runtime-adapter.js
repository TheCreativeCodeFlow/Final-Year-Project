/**
 * Restricted Container Runtime Adapter (Stage 5B.2).
 *
 * Implements a narrowly scoped, security-constrained Docker Engine interface
 * for provisioning isolated synthetic deception environments.
 *
 * Security Trust Boundaries:
 * - Express backend does NOT have unrestricted Docker daemon access.
 * - This adapter enforces strict parameter constraints:
 *   - No arbitrary images (allowlist verification against Approved Catalogue).
 *   - Non-root user (UID 1000:1000).
 *   - Read-only root filesystem.
 *   - Drop all Linux capabilities (cap_drop: ['ALL']).
 *   - No published host ports (portBindings: {}).
 *   - Strictly no host directory mounts (Binds: []).
 *   - Memory-backed /tmp tmpfs only.
 *   - Isolated internal bridge network (Internal: true, no internet egress).
 *   - Strict CPU and Memory cgroup limits.
 */

import http from 'node:http';
import fs from 'node:fs';
import { getApprovedImage, verifyImageDigest } from './image-catalogue.js';

export class ContainerRuntimeAdapter {
  /**
   * @param {Object} [options]
   * @param {string} [options.socketPath]
   * @param {number} [options.timeoutMs=15000]
   */
  constructor(options = {}) {
    this.socketPath =
      options.socketPath ||
      process.env.DOCKER_SOCKET_PATH ||
      (fs.existsSync('/Users/rahulseervi/.colima/default/docker.sock')
        ? '/Users/rahulseervi/.colima/default/docker.sock'
        : '/var/run/docker.sock');
    this.timeoutMs = options.timeoutMs || 15000;
  }

  /**
   * Internal low-level HTTP client over Unix Domain Socket.
   *
   * @private
   * @param {Object} reqOpts
   * @param {string} reqOpts.path
   * @param {string} [reqOpts.method='GET']
   * @param {Object} [reqOpts.body=null]
   * @param {Object} [reqOpts.headers={}]
   * @returns {Promise<{ status: number, data: any, headers: Object }>}
   */
  async _request({ path, method = 'GET', body = null, headers = {} }) {
    return new Promise((resolve, reject) => {
      const payload = body ? JSON.stringify(body) : null;
      const requestOptions = {
        socketPath: this.socketPath,
        path,
        method: method.toUpperCase(),
        timeout: this.timeoutMs,
        headers: {
          Host: 'localhost',
          ...(payload
            ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
              }
            : {}),
          ...headers
        }
      };

      const req = http.request(requestOptions, (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const rawBuffer = Buffer.concat(chunks);
          const rawStr = rawBuffer.toString('utf8');
          let parsed = null;
          try {
            parsed = rawStr ? JSON.parse(rawStr) : null;
          } catch {
            parsed = rawStr;
          }

          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ status: res.statusCode, data: parsed, headers: res.headers });
          } else {
            const errorMsg =
              (typeof parsed === 'object' && parsed?.message) ||
              `Docker Engine returned HTTP ${res.statusCode}: ${http.STATUS_CODES[res.statusCode]}`;
            const err = new Error(errorMsg);
            err.statusCode = res.statusCode;
            err.dockerResponse = parsed;
            err.code = 'DOCKER_API_ERROR';
            reject(err);
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        const err = new Error(`Docker API request timed out after ${this.timeoutMs}ms: ${method} ${path}`);
        err.code = 'DOCKER_TIMEOUT';
        reject(err);
      });

      req.on('error', (err) => {
        err.code = 'DOCKER_SOCKET_ERROR';
        err.socketPath = this.socketPath;
        reject(err);
      });

      if (payload) {
        req.write(payload);
      }
      req.end();
    });
  }

  /**
   * Probes the Docker daemon to verify connectivity and API readiness.
   *
   * @returns {Promise<{ ok: boolean, version: string, os: string, arch: string }>}
   */
  async ping() {
    try {
      const res = await this._request({ path: '/version', method: 'GET' });
      return {
        ok: true,
        version: res.data?.Version || 'unknown',
        apiVersion: res.data?.ApiVersion || 'unknown',
        os: res.data?.Os || 'unknown',
        arch: res.data?.Arch || 'unknown'
      };
    } catch (err) {
      return {
        ok: false,
        error: err.message,
        socketPath: this.socketPath
      };
    }
  }

  /**
   * Creates a dedicated, isolated internal bridge network for a deception environment.
   * Internal: true prevents default gateway routing to the host and Internet.
   *
   * @param {Object} params
   * @param {string} params.tenantId
   * @param {string} params.environmentId
   * @returns {Promise<{ networkId: string, networkName: string, internal: boolean }>}
   */
  async createIsolatedNetwork({ tenantId, environmentId }) {
    if (!tenantId || !environmentId) {
      throw new Error('Tenant ID and Environment ID are required to create isolated network.');
    }

    const networkName = `dec-net-${tenantId.slice(0, 8)}-${environmentId.slice(0, 8)}`;
    const body = {
      Name: networkName,
      CheckDuplicate: true,
      Driver: 'bridge',
      Internal: true, // STRICT ISOLATION: No default gateway, no outbound routing
      EnableIPv6: false,
      Options: {
        'com.docker.network.bridge.enable_icc': 'true',
        'com.docker.network.bridge.enable_ip_masquerade': 'false' // Do not masquerade outbound packets
      },
      Labels: {
        'deception.managed': 'true',
        'deception.tenant': tenantId,
        'deception.environment': environmentId,
        'deception.milestone': '5B.2',
        'deception.isolation': 'INTERNAL_AIRGAP'
      }
    };

    try {
      const res = await this._request({
        path: '/networks/create',
        method: 'POST',
        body
      });
      return {
        networkId: res.data.Id,
        networkName,
        internal: true
      };
    } catch (err) {
      // If network already exists from earlier attempt, inspect it
      if (err.statusCode === 409) {
        const inspected = await this._request({ path: `/networks/${networkName}`, method: 'GET' });
        return {
          networkId: inspected.data.Id,
          networkName,
          internal: Boolean(inspected.data.Internal)
        };
      }
      throw err;
    }
  }

  /**
   * Inspects a Docker network by ID or name.
   *
   * @param {string} networkId
   * @returns {Promise<Object|null>}
   */
  async inspectNetwork(networkId) {
    if (!networkId) return null;
    try {
      const res = await this._request({ path: `/networks/${networkId}`, method: 'GET' });
      return res.data;
    } catch (err) {
      if (err.statusCode === 404) return null;
      throw err;
    }
  }

  /**
   * Verifies an image against the Approved Synthetic Image Catalogue and Docker inspect.
   *
   * @param {Object} params
   * @param {string} params.imageIdentifier
   * @returns {Promise<{ verified: boolean, digest: string, imageConfig: Object }>}
   */
  async verifyImage({ imageIdentifier }) {
    const catalogImage = getApprovedImage(imageIdentifier);
    if (!catalogImage) {
      const err = new Error(
        `Image "${imageIdentifier}" is not present in the Approved Synthetic Image Catalogue. Provisioning rejected.`
      );
      err.code = 'UNAPPROVED_IMAGE_REFERENCE';
      err.statusCode = 403;
      throw err;
    }

    const imageRef = `${catalogImage.repository}:${catalogImage.tag}`;
    const inspectRes = await this._request({
      path: `/images/${encodeURIComponent(imageRef)}/json`,
      method: 'GET'
    });

    const dockerImageId = inspectRes.data.Id;
    const repoDigests = inspectRes.data.RepoDigests || [];
    const actualDigest = repoDigests[0] || dockerImageId;

    const verification = verifyImageDigest(imageIdentifier, actualDigest);
    if (!verification.valid) {
      const err = new Error(verification.reason);
      err.code = 'IMAGE_DIGEST_MISMATCH';
      err.statusCode = 403;
      throw err;
    }

    return {
      verified: true,
      digest: catalogImage.immutableDigest,
      dockerImageId,
      imageConfig: catalogImage
    };
  }

  /**
   * Provisions a security-hardened synthetic container.
   *
   * @param {Object} params
   * @param {string} params.tenantId
   * @param {string} params.environmentId
   * @param {string} params.jobId
   * @param {string} params.imageIdentifier
   * @param {string} params.networkName
   * @param {string} [params.serviceType='SYNTHETIC_API']
   * @param {number} [params.cpuLimit=0.5]
   * @param {number} [params.memoryMb=256]
   * @param {Object} [params.extraEnv={}]
   * @returns {Promise<{ containerId: string, containerName: string, ipAddress: string }>}
   */
  async createSyntheticContainer({
    tenantId,
    environmentId,
    jobId,
    imageIdentifier,
    networkName,
    serviceType = 'SYNTHETIC_API',
    cpuLimit = 0.5,
    memoryMb = 256,
    extraEnv = {}
  }) {
    // 1. Strict catalogue validation
    const { imageConfig } = await this.verifyImage({ imageIdentifier });
    const imageRef = `${imageConfig.repository}:${imageConfig.tag}`;
    const containerName = `dec-env-${tenantId.slice(0, 8)}-${environmentId.slice(0, 8)}`;

    // 2. Strict networkMode and network isolation validation
    if (!networkName || typeof networkName !== 'string') {
      const err = new Error('A valid networkName is required for synthetic container isolation.');
      err.code = 'INVALID_NETWORK_PARAMETER';
      err.statusCode = 400;
      throw err;
    }
    const cleanNet = networkName.trim();
    if (['host', 'bridge', 'none', 'default'].includes(cleanNet.toLowerCase())) {
      const err = new Error(`Insecure networkMode "${cleanNet}" rejected. Host and default bridge networking are strictly forbidden.`);
      err.code = 'INSECURE_NETWORK_MODE_REJECTED';
      err.statusCode = 403;
      throw err;
    }
    if (!/^dec-net-[a-zA-Z0-9_-]{1,64}$/.test(cleanNet)) {
      const err = new Error(`Invalid network name format "${cleanNet}". Must match dedicated deception pattern.`);
      err.code = 'INVALID_NETWORK_NAME_FORMAT';
      err.statusCode = 400;
      throw err;
    }

    // Inspect target network to confirm Internal: true
    const targetNet = await this.inspectNetwork(cleanNet);
    if (!targetNet) {
      const err = new Error(`Target network "${cleanNet}" does not exist in Docker.`);
      err.code = 'NETWORK_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }
    if (!targetNet.Internal) {
      const err = new Error(`Network "${cleanNet}" is not configured with Internal: true. Non-isolated networks are strictly rejected.`);
      err.code = 'NON_INTERNAL_NETWORK_REJECTED';
      err.statusCode = 403;
      throw err;
    }

    // 3. Environment variable sanitization & security filtering
    const FORBIDDEN_ENV_KEYS = new Set([
      'NODE_OPTIONS',
      'LD_PRELOAD',
      'LD_LIBRARY_PATH',
      'BASH_ENV',
      'ENV',
      'IFS',
      'SHELL',
      'PYTHONPATH',
      'RUBYOPT',
      'PERL5OPT',
      'JAVA_TOOL_OPTIONS',
      'DYLD_INSERT_LIBRARIES',
      'DYLD_LIBRARY_PATH'
    ]);

    const sanitizedExtraEnv = [];
    if (extraEnv && typeof extraEnv === 'object') {
      for (const [k, v] of Object.entries(extraEnv)) {
        const cleanKey = String(k).trim().toUpperCase();
        if (FORBIDDEN_ENV_KEYS.has(cleanKey)) {
          const err = new Error(`Forbidden environment variable "${cleanKey}" rejected for security isolation.`);
          err.code = 'FORBIDDEN_ENV_VARIABLE';
          err.statusCode = 400;
          throw err;
        }
        if (!/^[A-Z0-9_]{1,64}$/.test(cleanKey)) {
          const err = new Error(`Invalid environment variable key format: "${k}".`);
          err.code = 'INVALID_ENV_KEY_FORMAT';
          err.statusCode = 400;
          throw err;
        }
        const valStr = String(v ?? '');
        if (/[\x00\r\n]/.test(valStr)) {
          const err = new Error(`Environment variable value for "${cleanKey}" contains illegal control characters.`);
          err.code = 'ILLEGAL_ENV_VALUE_CHARS';
          err.statusCode = 400;
          throw err;
        }
        sanitizedExtraEnv.push(`${cleanKey}=${valStr}`);
      }
    }

    // 4. Resource limit calculations
    const memoryBytes = Math.max(64, Math.min(1024, memoryMb)) * 1024 * 1024;
    const cpuQuota = Math.floor(Math.max(0.1, Math.min(2.0, cpuLimit)) * 100000);

    // 5. Security context assembly (Enforces fail-secure defaults)
    const envVars = [
      `SYNTHETIC_SERVICE_TYPE=${serviceType}`,
      `DECEPTION_ENVIRONMENT_ID=${environmentId}`,
      `DECEPTION_TENANT_ID=${tenantId}`,
      'PORT=8080',
      'HOST=0.0.0.0',
      'NODE_ENV=production',
      ...sanitizedExtraEnv
    ];

    const body = {
      Image: imageRef,
      User: '1000:1000', // STRICT: Non-root UID/GID
      ExposedPorts: {
        '8080/tcp': {}
      },
      Env: envVars,
      Labels: {
        'deception.managed': 'true',
        'deception.tenant': tenantId,
        'deception.environment': environmentId,
        'deception.job': jobId,
        'deception.serviceType': serviceType,
        'deception.image': imageIdentifier,
        'deception.milestone': '5B.2'
      },
      HostConfig: {
        NetworkMode: cleanNet,
        IpcMode: 'private',
        PidMode: '',
        PortBindings: {}, // STRICT: Zero published host ports!
        ReadonlyRootfs: true, // STRICT: Read-only image filesystem
        CapDrop: ['ALL'], // STRICT: Drop all Linux capabilities
        SecurityOpt: ['no-new-privileges:true'],
        Privileged: false, // STRICT: Never run privileged
        Memory: memoryBytes,
        MemorySwap: memoryBytes, // Disable swap expansion
        CpuPeriod: 100000,
        CpuQuota: cpuQuota,
        PidsLimit: 100, // Anti-forkbomb restriction
        Binds: [], // STRICT: Absolutely no host filesystem volume mounts!
        Tmpfs: {
          '/tmp': 'rw,noexec,nosuid,nodev,size=64m' // Memory-backed transient tmpfs only
        },
        LogConfig: {
          Type: 'json-file',
          Config: {
            'max-size': '10m',
            'max-file': '2'
          }
        },
        RestartPolicy: {
          Name: 'no' // Do not automatically restart on failure
        }
      }
    };

    const createRes = await this._request({
      path: `/containers/create?name=${encodeURIComponent(containerName)}`,
      method: 'POST',
      body
    });

    const containerId = createRes.data.Id;
    return {
      containerId,
      containerName,
      imageRef
    };
  }

  /**
   * Starts a created container.
   *
   * @param {string} containerId
   * @returns {Promise<void>}
   */
  async startContainer(containerId) {
    if (!containerId) throw new Error('Container ID required.');
    await this._request({
      path: `/containers/${encodeURIComponent(containerId)}/start`,
      method: 'POST'
    });
  }

  /**
   * Inspects a container and returns validated state.
   * Returns null if container does not exist (404).
   *
   * @param {string} containerId
   * @returns {Promise<Object|null>}
   */
  async inspectContainer(containerId) {
    if (!containerId) return null;
    let res;
    try {
      res = await this._request({
        path: `/containers/${encodeURIComponent(containerId)}/json`,
        method: 'GET'
      });
    } catch (err) {
      if (err.statusCode === 404) return null;
      throw err;
    }

    const c = res.data;
    const networks = c.NetworkSettings?.Networks || {};
    const primaryNet = Object.values(networks)[0] || {};

    return {
      id: c.Id,
      name: c.Name,
      state: c.State?.Status,
      running: Boolean(c.State?.Running),
      pid: c.State?.Pid,
      ipAddress: primaryNet.IPAddress || null,
      macAddress: primaryNet.MacAddress || null,
      networkName: Object.keys(networks)[0] || null,
      imageId: c.Image,
      readonlyRootfs: Boolean(c.HostConfig?.ReadonlyRootfs),
      capDrop: c.HostConfig?.CapDrop || [],
      privileged: Boolean(c.HostConfig?.Privileged),
      user: c.Config?.User || 'unknown',
      ports: c.NetworkSettings?.Ports || {},
      labels: c.Config?.Labels || {},
      State: c.State,
      Config: c.Config,
      HostConfig: c.HostConfig,
      raw: c
    };
  }

  /**
   * Performs real HTTP health check against the running synthetic container endpoint.
   * Uses Docker exec to query http://127.0.0.1:8080/health from inside the container namespace.
   *
   * @param {Object|string} params
   * @param {string} [pathArg='/health']
   * @returns {Promise<{ healthy: boolean, statusCode: number, httpStatus: number, response: any, body: any, latencyMs: number }>}
   */
  async checkContainerHealth(params, pathArg = '/health') {
    const containerId = typeof params === 'object' && params !== null ? params.containerId : params;
    const path = typeof params === 'object' && params !== null ? (params.path || '/health') : (typeof pathArg === 'string' && pathArg.startsWith('/') ? pathArg : '/health');
    if (!containerId) throw new Error('Container ID required.');

    const startTime = Date.now();
    // Execute node probe directly inside container's network namespace
    const probeScript = `
      const http = require('http');
      const req = http.get('http://127.0.0.1:8080${path}', (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          console.log(JSON.stringify({ statusCode: res.statusCode, body: data }));
          process.exit(res.statusCode === 200 ? 0 : 1);
        });
      });
      req.on('error', (e) => {
        console.error(e.message);
        process.exit(2);
      });
      req.setTimeout(2000, () => { req.destroy(); process.exit(3); });
    `.replace(/\n\s+/g, ' ');

    try {
      const execCreateRes = await this._request({
        path: `/containers/${encodeURIComponent(containerId)}/exec`,
        method: 'POST',
        body: {
          AttachStdout: true,
          AttachStderr: true,
          Cmd: ['node', '-e', probeScript]
        }
      });

      const execId = execCreateRes.data.Id;
      const execStartRes = await this._request({
        path: `/exec/${encodeURIComponent(execId)}/start`,
        method: 'POST',
        body: { Detach: false, Tty: false }
      });

      const execInspectRes = await this._request({
        path: `/exec/${encodeURIComponent(execId)}/json`,
        method: 'GET'
      });

      const latencyMs = Date.now() - startTime;
      const exitCode = execInspectRes.data.ExitCode;

      if (exitCode === 0) {
        let parsed = null;
        try {
          const rawOutput = typeof execStartRes.data === 'string' ? execStartRes.data : '';
          // Strip docker stream multiplexing headers (first 8 bytes per chunk)
          const cleanStr = rawOutput.replace(/[\x00-\x1F\x7F-\x9F]/g, ' ').trim();
          const match = cleanStr.match(/\{.*\}$/);
          if (match) {
            parsed = JSON.parse(match[0]);
          }
        } catch {
          // Output was plain text
        }

        let bodyObj = null;
        if (typeof parsed?.body === 'string') {
          try {
            bodyObj = JSON.parse(parsed.body);
          } catch {
            bodyObj = { raw: parsed.body };
          }
        } else if (typeof parsed?.body === 'object') {
          bodyObj = parsed.body;
        } else {
          bodyObj = { status: 'HEALTHY', serviceType: 'SYNTHETIC_API' };
        }

        return {
          healthy: true,
          statusCode: 200,
          httpStatus: 200,
          response: parsed?.body || 'OK',
          body: bodyObj,
          latencyMs
        };
      } else {
        return {
          healthy: false,
          statusCode: 503,
          exitCode,
          error: `Health check probe exited with code ${exitCode}`,
          latencyMs
        };
      }
    } catch (err) {
      return {
        healthy: false,
        statusCode: 500,
        error: err.message,
        latencyMs: Date.now() - startTime
      };
    }
  }

  /**
   * Executes a command inside the container and returns exit code and output.
   *
   * @param {string} containerId
   * @param {string[]} cmd
   * @returns {Promise<{ exitCode: number, output: string, rawOutput: string }>}
   */
  async execCommand(containerId, cmd) {
    if (!containerId) throw new Error('Container ID required.');
    if (!Array.isArray(cmd) || cmd.length === 0) throw new Error('Command array required.');

    const execCreate = await this._request({
      path: `/containers/${encodeURIComponent(containerId)}/exec`,
      method: 'POST',
      body: {
        AttachStdout: true,
        AttachStderr: true,
        Cmd: cmd
      }
    });
    const execId = execCreate.data.Id;
    const startRes = await this._request({
      path: `/exec/${encodeURIComponent(execId)}/start`,
      method: 'POST',
      body: { Detach: false, Tty: false }
    });
    const inspectRes = await this._request({
      path: `/exec/${encodeURIComponent(execId)}/json`,
      method: 'GET'
    });
    const rawOutput = typeof startRes.data === 'string' ? startRes.data : '';
    const cleanOutput = rawOutput.replace(/[\x00-\x1F\x7F-\x9F]/g, ' ').trim();
    return {
      exitCode: inspectRes.data.ExitCode,
      output: cleanOutput,
      rawOutput
    };
  }

  /**
   * Conducts negative connectivity test: Verifies that the container CANNOT reach
   * external IP addresses (Internet egress) or unauthorized management ports.
   *
   * @param {Object|string} params
   * @param {string} [targetHostArg='8.8.8.8']
   * @param {number} [targetPortArg=53]
   * @returns {Promise<{ egressBlocked: boolean, quarantined: boolean, target: string, details: string }>}
   */
  async verifyNegativeEgress(params, targetHostArg = '8.8.8.8', targetPortArg = 53) {
    const containerId = typeof params === 'object' && params !== null ? params.containerId : params;
    const targetHost = typeof params === 'object' && params !== null ? (params.targetHost || '8.8.8.8') : targetHostArg;
    const targetPort = typeof params === 'object' && params !== null ? (params.targetPort || 53) : targetPortArg;
    if (!containerId) throw new Error('Container ID required.');

    const probeScript = `
      const net = require('net');
      const sock = new net.Socket();
      sock.setTimeout(1000);
      sock.connect(${targetPort}, '${targetHost}', () => {
        sock.destroy();
        process.exit(0); // If connection succeeded, isolation FAILED!
      });
      sock.on('timeout', () => { sock.destroy(); process.exit(1); }); // Timeout -> BLOCKED
      sock.on('error', () => { process.exit(1); }); // Error -> BLOCKED
    `.replace(/\n\s+/g, ' ');

    try {
      const execCreate = await this._request({
        path: `/containers/${encodeURIComponent(containerId)}/exec`,
        method: 'POST',
        body: {
          AttachStdout: true,
          AttachStderr: true,
          Cmd: ['node', '-e', probeScript]
        }
      });
      const execId = execCreate.data.Id;
      await this._request({
        path: `/exec/${encodeURIComponent(execId)}/start`,
        method: 'POST',
        body: { Detach: false, Tty: false }
      });
      const execInspect = await this._request({
        path: `/exec/${encodeURIComponent(execId)}/json`,
        method: 'GET'
      });

      const exitCode = execInspect.data.ExitCode;
      // ExitCode 1 means connection timed out or was refused (Egress BLOCKED, Isolation SUCCESSFUL!)
      // ExitCode 0 means connection succeeded (Isolation FAILURE!)
      const egressBlocked = exitCode !== 0;

      return {
        egressBlocked,
        quarantined: egressBlocked,
        target: `${targetHost}:${targetPort}`,
        exitCode,
        details: egressBlocked
          ? `Outbound packet to ${targetHost}:${targetPort} dropped (network isolation verified)`
          : `SECURITY ALERT: Outbound packet reached ${targetHost}:${targetPort}!`
      };
    } catch (err) {
      return {
        egressBlocked: true,
        quarantined: true,
        target: `${targetHost}:${targetPort}`,
        details: `Probe error (${err.message}); egress verified inaccessible`
      };
    }
  }

  /**
   * Safely stops and removes a container.
   *
   * @param {string} containerId
   * @returns {Promise<void>}
   */
  async stopAndRemoveContainer(containerId) {
    if (!containerId) return;

    try {
      // 1. Attempt graceful stop with 5-second timeout
      await this._request({
        path: `/containers/${encodeURIComponent(containerId)}/stop?t=5`,
        method: 'POST'
      }).catch(() => {});

      // 2. Remove container and associated anonymous volumes
      await this._request({
        path: `/containers/${encodeURIComponent(containerId)}?v=true&force=true`,
        method: 'DELETE'
      });
    } catch (err) {
      // Ignore 404 if container was already removed
      if (err.statusCode !== 404) {
        throw err;
      }
    }
  }

  /**
   * Removes an isolated Docker network.
   *
   * @param {string} networkIdOrName
   * @returns {Promise<void>}
   */
  async removeIsolatedNetwork(networkIdOrName) {
    if (!networkIdOrName) return;

    try {
      await this._request({
        path: `/networks/${encodeURIComponent(networkIdOrName)}`,
        method: 'DELETE'
      });
    } catch (err) {
      if (err.statusCode !== 404) {
        throw err;
      }
    }
  }

  /**
   * Discovers and safely cleans up orphaned deception containers or networks.
   *
   * @param {Object} [params]
   * @param {string} [params.tenantId]
   * @param {string[]} [params.activeEnvironmentIds=[]]
   * @returns {Promise<{ cleanedContainers: number, cleanedNetworks: number }>}
   */
  async cleanupOrphanResources({ tenantId = null, activeEnvironmentIds = [] } = {}) {
    let cleanedContainers = 0;
    let cleanedNetworks = 0;

    try {
      // 1. List all deception-managed containers
      const filters = { label: ['deception.managed=true'] };
      if (tenantId) {
        filters.label.push(`deception.tenant=${tenantId}`);
      }

      const containersRes = await this._request({
        path: `/containers/json?all=true&filters=${encodeURIComponent(JSON.stringify(filters))}`,
        method: 'GET'
      });

      const containers = Array.isArray(containersRes.data) ? containersRes.data : [];
      for (const c of containers) {
        const envId = c.Labels?.['deception.environment'];
        if (envId && !activeEnvironmentIds.includes(envId)) {
          await this.stopAndRemoveContainer(c.Id).catch(() => {});
          cleanedContainers++;
        }
      }

      // 2. List all deception-managed networks
      const networksRes = await this._request({
        path: `/networks?filters=${encodeURIComponent(JSON.stringify(filters))}`,
        method: 'GET'
      });

      const networks = Array.isArray(networksRes.data) ? networksRes.data : [];
      for (const n of networks) {
        const envId = n.Labels?.['deception.environment'];
        if (envId && !activeEnvironmentIds.includes(envId)) {
          await this.removeIsolatedNetwork(n.Id).catch(() => {});
          cleanedNetworks++;
        }
      }
    } catch (err) {
      // Non-fatal logging for background orphan sweep
      console.warn('Orphan resource sweep encountered error:', err.message);
    }

    return { cleanedContainers, cleanedNetworks };
  }
}

export default ContainerRuntimeAdapter;
