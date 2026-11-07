# Stage 5B.3 — Runtime Failure Analysis & Recovery Protocols

## 1. Overview

Synthetic deception environments operate in high-risk zones, subjected to adversary reconnaissance, exploitation attempts, resource consumption attacks, and unexpected crashes.

This document formalizes the seven primary failure modes identified in Stage 5B.3, their automated detection triggers, evidence recording requirements, reconciliation classifications, operator alerting rules, and safe containment protocols.

---

## 2. Failure Modes & Recovery Matrix

| Failure Mode | Detection Mechanism | Evidence Event Emitted | Reconciliation Code | Operator Alert Level | Containment & Recovery Action |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Container Crash / Abnormal Exit** | Docker state inspection: `State.Running === false` while DB is `ACTIVE`. | `RUNTIME_DEGRADED`, `ANOMALY_DETECTED` | `DATABASE_RUNTIME_MISMATCH` | **HIGH** | Mark environment `UNHEALTHY`. Quarantine network. Do NOT auto-restart indefinitely (avoids crash loops). Await operator review. |
| **2. Health Probe Failure / Timeout** | Internal HTTP probe to port 8080 exceeds 2000ms or returns 5xx. | `RUNTIME_DEGRADED` | `CONSISTENT` (state-level) / Health = `UNHEALTHY` | **MEDIUM** | Mark environment `UNHEALTHY`. Telemetry engine records probe timeout. If unrecovered after 3 retries, propose safe teardown. |
| **3. Worker Process Crash / Restart** | IPC socket connection refused or ping timeout. | `ANOMALY_DETECTED` | `UNKNOWN` | **CRITICAL** | Backend marks worker status as disconnected. Worker auto-reconnects, reads DB state, syncs in-memory registries from Docker inspection (`snapshot`). |
| **4. Corrupt / Missing Docker Network** | Network inspection fails or network lacks `Internal: true`. | `ANOMALY_DETECTED` | `NETWORK_MISMATCH` | **CRITICAL** | If network is missing or not internal, stop container immediately to prevent non-quarantined egress leaks. |
| **5. Telemetry Queue Overflow** | Telemetry ring buffer exceeds 500 events. | `TELEMETRY_DATA_LOSS` | `CONSISTENT` | **LOW** | Drop oldest events via FIFO. Emit `TELEMETRY_DATA_LOSS` marker with dropped count. Alert operator to potential log flood attack. |
| **6. Expired / Revoked Auth Token** | Dual-custody JWT verification fails or token expired during operation. | `AUTHORIZATION_REVOKED` | `RESOURCE_MISMATCH` | **HIGH** | Reject subsequent runtime mutations. Prevent environment lifecycle expansion. Record unauthorized mutation attempt. |
| **7. DSG Version Drift / Stale Binding** | Graph planner releases DSG v2 while environment bound to v1. | `ANOMALY_DETECTED` | `RESOURCE_MISMATCH` | **MEDIUM** | Prevent runtime topology expansion until operator issues formal migration token with dual custody. |

---

## 3. Deep-Dive Failure Protocols

### 3.1. Container Crash & Crash-Loop Prevention
When an attacker triggers a kernel fault, memory exhaustion (OOM), or process segmentation fault inside a synthetic container:
1. Docker daemon sets `State.Running: false` and `State.OOMKilled: true` or non-zero `ExitCode`.
2. `RuntimeHealthMonitorService` inspects the container, detects the crash, and sets health status to `UNHEALTHY`.
3. An `ANOMALY_DETECTED` evidence event is recorded.
4. **Crash-Loop Prevention Guardrail**:
   - The platform strictly **DOES NOT** employ Docker `restart: always` or uncontrolled automated restart loops.
   - Automatically restarting a compromised or crashing synthetic container destroys volatile memory forensics, resets attacker state, and risks masking persistent escape vectors.
   - The container remains in its crashed state until an authorized operator issues a formal teardown or replacement command.

### 3.2. Worker Process Crash & State Reconstruction
If the standalone Node.js runtime worker (`worker-process.js`) terminates unexpectedly:
1. The backend `WorkerClient` detects socket disconnection and rejects new incoming execution requests with `WORKER_UNAVAILABLE` (HTTP 503).
2. The operating system process supervisor (or backend child process monitor) restarts the worker.
3. Upon restart, the worker queries Docker daemon using label filters (`deception.managed=true`) to discover existing live containers and networks.
4. The worker reconstructs its internal `managedEnvironments` and `managedNetworks` state tables from actual Docker inspections before accepting IPC commands.
5. The backend triggers a tenant-wide reconciliation scan to confirm state parity across database, worker memory, and Docker daemon.

### 3.3. Egress Quarantine Verification Failure (`NETWORK_MISMATCH`)
If a container's isolated bridge network is deleted externally or recreated without the `Internal: true` flag:
1. The reconciliation engine inspects the network configuration via Docker API (`/networks/{id}`).
2. If `network.Internal !== true`, an emergency egress violation hazard is flagged.
3. The reconciler assigns status `NETWORK_MISMATCH`.
4. The backend immediately instructs the worker to stop the container (`stopContainer`) to halt all outbound packet transmissions.
5. An audit event is sealed into the evidence chain.

### 3.4. Telemetry Flood & Memory Defense
If an attacker inside a synthetic container executes an infinite loop generating millions of HTTP requests or syslog lines:
1. The telemetry ingestion engine places events into a fixed-size ring buffer (capacity: 500).
2. When the buffer reaches capacity, incoming events displace the oldest events.
3. Memory consumption remains strictly bounded (less than 2MB per environment).
4. For every batch of dropped events, an explicit `TELEMETRY_DATA_LOSS` event is generated with the exact drop count.
5. Deception operators are notified of high-frequency adversarial activity without crashing backend services.
