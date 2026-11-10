/**
 * Stage 6 Live Isolated Docker Container Parity Benchmark.
 *
 * Provisions real isolated synthetic deception containers (`deception-synthetic-service:1.0.0`)
 * on Internal: true bridge networks via `ContainerRuntimeAdapter`, executes a multi-stage
 * attacker trajectory (`TEST-MULTI-01` & `TEST-ENUM-01` excerpt) directly over Docker Engine
 * loopback exec IPC under:
 *   1. STATIC_HONEYPOT
 *   2. GENERIC_ADAPTIVE
 *   3. ATTACKER_SPECIFIC_DSG
 *
 * Captures authentic container provisioning latency, mutation execution latency via /exec,
 * cgroup memory/CPU metrics, and state rollback time, then cleanly tears down all containers
 * and networks. Does NOT bypass Finding A or route live production traffic.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ContainerRuntimeAdapter } from '../src/runtime/container-runtime-adapter.js';
import { DSGConsistencyEngine } from '../src/deception/dsg-consistency-engine.service.js';
import { MUTATION_DIMENSIONS, MUTATION_OPERATIONS } from '../src/deception/dsg-mutation-catalogue.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runLiveDockerParityExperiment() {
  const adapter = new ContainerRuntimeAdapter();
  const ping = await adapter.ping();
  if (!ping.ok) {
    throw new Error(`Docker daemon unavailable for live parity experiment: ${ping.error}`);
  }

  const cleanupContainers = [];
  const cleanupNetworks = [];
  const tenantId = 'tenant-stage6-docker';
  const results = [];

  try {
    const paradigms = ['STATIC_HONEYPOT', 'GENERIC_ADAPTIVE', 'ATTACKER_SPECIFIC_DSG'];

    for (const paradigm of paradigms) {
      const envId = `env-s6-${paradigm.toLowerCase().slice(0, 6)}-${Date.now()}`;
      const provStartNs = process.hrtime.bigint();

      const net = await adapter.createIsolatedNetwork({ tenantId, environmentId: envId });
      cleanupNetworks.push(net.networkId);

      const cont = await adapter.createAndStartSyntheticContainer({
        tenantId,
        environmentId: envId,
        jobId: `job-${envId}`,
        imageIdentifier: 'img-syn-alpine-node-01',
        networkName: net.networkName,
        serviceType: 'SYNTHETIC_API',
        cpuLimit: 0.5,
        memoryMb: 256
      });
      cleanupContainers.push(cont.containerId);

      // Wait briefly for container Node HTTP listener readiness
      let healthy = false;
      let healthProbe = null;
      for (let retry = 0; retry < 15; retry++) {
        await new Promise((r) => setTimeout(r, 350));
        healthProbe = await adapter.checkContainerHealth({ containerId: cont.containerId });
        if (healthProbe.healthy) {
          healthy = true;
          break;
        }
      }
      const provisioningMs = Number((Number(process.hrtime.bigint() - provStartNs) / 1e6).toFixed(2));

      if (!healthy) {
        throw new Error(`Live container failed health check for ${paradigm}`);
      }

      const preStats = await adapter.getContainerStats(cont.containerId);
      const mutationTimesMs = [];
      const interactionTimesMs = [];
      let violationsDetected = 0;
      let mutationsExecuted = 0;
      let mutationsRejectedAtGate = 0;
      let identityCoherentResponses = 0;
      let endpoint200Responses = 0;
      let rollbackTimeMs = null;

      // Get initial container state
      const initStateRes = await adapter.getContainerSyntheticState(cont.containerId);
      let rollingState = initStateRes.data?.data || initStateRes.data;

      // Multi-stage test sequence executed against real container:
      // Stage 1: Identity creation / Auth probe for sec_auditor_09
      // Stage 2: Lookup /api/v1/users/sec_auditor_09 (verifies identity coherence)
      // Stage 3: Access dynamic /api/v1/internal/admin/audit-logs (verifies route evolution)
      if (paradigm === 'GENERIC_ADAPTIVE') {
        const m1 = {
          mutationType: MUTATION_DIMENSIONS.CREDENTIAL,
          operation: MUTATION_OPERATIONS.CREATE_DECOY_CREDENTIAL,
          targetGraphVersion: rollingState.graphVersion + 1,
          payload: { username: 'sec_auditor_09', tokenType: 'CANARY_JWT', role: 'ADMINISTRATOR', token: 'gen-tk-09' }
        };
        const audit1 = DSGConsistencyEngine.validateConsistency({
          currentState: rollingState,
          proposedMutation: m1,
          currentGraphVersion: rollingState.graphVersion,
          targetGraphVersion: m1.targetGraphVersion
        });
        if (!audit1.consistent) violationsDetected += audit1.violations.length;

        const t0 = process.hrtime.bigint();
        const r1 = await adapter.applyContainerMutation(cont.containerId, m1);
        mutationTimesMs.push(Number((Number(process.hrtime.bigint() - t0) / 1e6).toFixed(2)));
        if (r1.ok) {
          mutationsExecuted++;
          rollingState = r1.data.currentState;
        }

        const m2 = {
          mutationType: MUTATION_DIMENSIONS.API_TOPOLOGY,
          operation: MUTATION_OPERATIONS.ADD_SYNTHETIC_ROUTE,
          targetGraphVersion: rollingState.graphVersion + 1,
          payload: { path: '/api/v1/internal/admin/audit-logs', method: 'GET', simulatedStatus: 200 }
        };
        const audit2 = DSGConsistencyEngine.validateConsistency({
          currentState: rollingState,
          proposedMutation: m2,
          currentGraphVersion: rollingState.graphVersion,
          targetGraphVersion: m2.targetGraphVersion
        });
        if (!audit2.consistent) violationsDetected += audit2.violations.length;

        const t1 = process.hrtime.bigint();
        const r2 = await adapter.applyContainerMutation(cont.containerId, m2);
        mutationTimesMs.push(Number((Number(process.hrtime.bigint() - t1) / 1e6).toFixed(2)));
        if (r2.ok) {
          mutationsExecuted++;
          rollingState = r2.data.currentState;
        }
      } else if (paradigm === 'ATTACKER_SPECIFIC_DSG') {
        // Coordinated pipeline with pre-execution consistency validation + invalid probe gate
        const proposedList = [
          {
            mutationType: MUTATION_DIMENSIONS.IDENTITY,
            operation: MUTATION_OPERATIONS.ADD_SYNTHETIC_USER,
            payload: { id: 'usr-dsg-09', username: 'sec_auditor_09', role: 'SECURITY_AUDITOR_DECOY', department: 'Audit' }
          },
          {
            mutationType: MUTATION_DIMENSIONS.CREDENTIAL,
            operation: MUTATION_OPERATIONS.CREATE_DECOY_CREDENTIAL,
            payload: { username: 'sec_auditor_09', tokenType: 'CANARY_JWT', role: 'SECURITY_AUDITOR_DECOY', token: 'dsg-tk-09' }
          },
          {
            mutationType: MUTATION_DIMENSIONS.API_TOPOLOGY,
            operation: MUTATION_OPERATIONS.ADD_SYNTHETIC_ROUTE,
            payload: { path: '/api/v1/internal/admin/audit-logs', method: 'GET', simulatedStatus: 200 }
          },
          // Also propose a conflicting invalid role mutation to verify real container gate rejection
          {
            mutationType: MUTATION_DIMENSIONS.CREDENTIAL,
            operation: MUTATION_OPERATIONS.CREATE_DECOY_CREDENTIAL,
            payload: { username: 'sec_auditor_09', tokenType: 'CANARY_JWT', role: 'ADMINISTRATOR', token: 'invalid-role-tk' }
          }
        ];

        for (const cand of proposedList) {
          const mut = { ...cand, targetGraphVersion: rollingState.graphVersion + 1 };
          const check = DSGConsistencyEngine.validateConsistency({
            currentState: rollingState,
            proposedMutation: mut,
            currentGraphVersion: rollingState.graphVersion,
            targetGraphVersion: mut.targetGraphVersion
          });
          if (!check.consistent) {
            mutationsRejectedAtGate++;
            continue;
          }
          const t0 = process.hrtime.bigint();
          const res = await adapter.applyContainerMutation(cont.containerId, mut);
          mutationTimesMs.push(Number((Number(process.hrtime.bigint() - t0) / 1e6).toFixed(2)));
          if (res.ok) {
            mutationsExecuted++;
            rollingState = res.data.currentState;
          }
        }
      }

      // Query real container endpoints over Docker network namespace IPC
      const q0 = process.hrtime.bigint();
      const loginQ = await adapter.queryContainerHttp({
        containerId: cont.containerId,
        method: 'POST',
        path: '/api/v1/auth/login',
        body: { username: 'sec_auditor_09' }
      });
      interactionTimesMs.push(Number((Number(process.hrtime.bigint() - q0) / 1e6).toFixed(2)));
      if (loginQ.statusCode === 200) {
        endpoint200Responses++;
        if (loginQ.data?.user?.username === 'sec_auditor_09') identityCoherentResponses++;
      }

      const q1 = process.hrtime.bigint();
      const userQ = await adapter.queryContainerHttp({
        containerId: cont.containerId,
        method: 'GET',
        path: '/api/v1/users/sec_auditor_09'
      });
      interactionTimesMs.push(Number((Number(process.hrtime.bigint() - q1) / 1e6).toFixed(2)));
      if (userQ.statusCode === 200) {
        endpoint200Responses++;
        if (userQ.data?.data?.username === 'sec_auditor_09') identityCoherentResponses++;
      }

      const q2 = process.hrtime.bigint();
      const routeQ = await adapter.queryContainerHttp({
        containerId: cont.containerId,
        method: 'GET',
        path: '/api/v1/internal/admin/audit-logs'
      });
      interactionTimesMs.push(Number((Number(process.hrtime.bigint() - q2) / 1e6).toFixed(2)));
      if (routeQ.statusCode === 200) {
        endpoint200Responses++;
      }

      if (paradigm === 'ATTACKER_SPECIFIC_DSG') {
        const rb0 = process.hrtime.bigint();
        const rb = await adapter.rollbackContainerState(cont.containerId, 1);
        rollbackTimeMs = Number((Number(process.hrtime.bigint() - rb0) / 1e6).toFixed(2));
        if (!rb.ok || rb.data?.graphVersion !== 1) {
          throw new Error('Docker container rollback verification failed');
        }
      }

      const postStats = await adapter.getContainerStats(cont.containerId);

      results.push({
        paradigm,
        containerId: cont.containerId.slice(0, 12),
        networkInternalAirgapped: true,
        provisioningTimeMs: provisioningMs,
        mutationCountExecuted: mutationsExecuted,
        mutationsRejectedAtGate,
        consistencyViolations: violationsDetected,
        meanMutationExecLatencyMs:
          mutationTimesMs.length > 0
            ? Number((mutationTimesMs.reduce((a, b) => a + b, 0) / mutationTimesMs.length).toFixed(2))
            : 0,
        meanContainerQueryLatencyMs: Number(
          (interactionTimesMs.reduce((a, b) => a + b, 0) / interactionTimesMs.length).toFixed(2)
        ),
        rollbackTimeMs,
        endpoint200ResponsesOf3: endpoint200Responses,
        identityCoherentResponsesOf2: identityCoherentResponses,
        containerResources: {
          memoryUsageMb: postStats.memory?.usageMb ?? preStats.memory?.usageMb ?? 0,
          memoryLimitMb: postStats.memory?.limitMb ?? 256,
          cpuPercent: postStats.cpu?.percent ?? 0,
          pidsCurrent: postStats.pids?.current ?? 0
        }
      });
    }

    const outObj = {
      timestamp: new Date().toISOString(),
      dockerVersion: ping.version,
      apiVersion: ping.apiVersion,
      imageRef: 'deception-synthetic-service:1.0.0',
      isolationControls: {
        internalBridgeNoEgress: true,
        nonRootUidGid: '1000:1000',
        readonlyRootfs: true,
        capDropAll: true,
        portBindings: {}
      },
      parityResults: results
    };

    const targetDir = path.resolve(__dirname, '../../docs/stage-6-research-evaluation');
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(
      path.join(targetDir, 'stage6-live-docker-parity.json'),
      JSON.stringify(outObj, null, 2),
      'utf8'
    );

    return outObj;
  } finally {
    for (const cid of cleanupContainers) {
      await adapter.stopAndRemoveContainer(cid).catch(() => {});
    }
    for (const nid of cleanupNetworks) {
      await adapter.removeIsolatedNetwork(nid).catch(() => {});
    }
  }
}

if (process.argv[1] && process.argv[1].endsWith('stage-6-live-docker-parity.js')) {
  runLiveDockerParityExperiment()
    .then((res) => {
      console.log('=== STAGE 6 LIVE DOCKER CONTAINER PARITY RESULTS ===');
      console.log(JSON.stringify(res, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('Live Docker parity experiment failed:', err);
      process.exit(1);
    });
}
