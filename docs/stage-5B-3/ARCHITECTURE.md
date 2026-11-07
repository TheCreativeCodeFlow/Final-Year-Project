# Stage 5B.3 — Runtime Observability, Health, and Execution Evidence Architecture

## 1. Executive Summary

Stage 5B.3 establishes an authoritative runtime observability, health monitoring, telemetry ingestion, lifecycle reconciliation, and execution evidence verification layer for the AI-Enabled Adaptive Cyber Deception Gateway.

Prior to this milestone, synthetic deception containers could be provisioned and isolated within an internal network bridge, but the system lacked deterministic runtime health inspection, bounded synthetic telemetry collection, multi-tier state reconciliation, and cryptographic completeness checking for the execution evidence chain.

This architecture decouples operational state from assumed state:
- A container being provisioned does not imply it is running.
- A running container does not imply it is healthy.
- A healthy container does not imply its execution evidence chain is complete and untampered.

---

## 2. Architecture Overview and Component Topology

The Stage 5B.3 architecture consists of five core backend services, an isolated runtime worker communicating over authenticated Unix-domain IPC, Docker container runtime adapters, and an enhanced frontend operations dashboard.

```
+-----------------------------------------------------------------------------------+
|                              API / Dashboard Layer                                |
|  - Runtime Overview (Health stats, Alerts, Reconciliation scan, Telemetry rate)  |
|  - Tenant-Scoped REST Endpoints (/api/v1/tenants/:tenantId/runtime/*)             |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                         Backend Core Services (PostgreSQL)                        |
|                                                                                   |
|  +------------------------------+       +--------------------------------------+  |
|  | RuntimeHealthMonitorService  |       | RuntimeReconciliationService         |  |
|  | - Periodic / on-demand probe |       | - 5-way state consistency validator  |  |
|  | - Cgroup stats & probe cache |       | - Discrepancy detector               |  |
|  +------------------------------+       +--------------------------------------+  |
|                                                                                   |
|  +------------------------------+       +--------------------------------------+  |
|  | RuntimeTelemetryService      |       | ExecutionEvidenceRecorderService     |  |
|  | - Bounded ring-buffer (500)  |       | - Append-only SHA-256 evidence chain |  |
|  | - Sanitizer & Pseudonymizer  |       | - Completeness & anomaly verification|  |
|  +------------------------------+       +--------------------------------------+  |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  | RuntimeEnvironmentManagerService                                            |  |
|  | - Dual-custody token validation, DSG binding, safe mutation proposals       |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
                                          |
                        WorkerClient (Shared Secret + JWT)
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                        Isolated Runtime Worker (Child Process)                    |
|  - Unix Socket IPC (/tmp/runtime-worker.sock or TCP localhost:5055)               |
|  - Managed Environments & Networks in-memory registry                             |
|  - GET /environments/:id/health-details (probe + stats + cgroups + net inspect)   |
|  - GET /reconciliation/snapshot (reconciliation baseline)                         |
+-----------------------------------------------------------------------------------+
                                          |
                              ContainerRuntimeAdapter
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                         Docker Engine / Synthetic Subsystem                       |
|  - Dedicated Internal Bridge Network (`bridge`, `Internal: true`)                 |
|  - Synthetic Container (Alpine/Echo, dropped caps, read-only root, 128MB limit)   |
|  - Internal Service Probe (`GET http://<ip>:8080/health`, timeout 2000ms)         |
|  - Direct Stats Engine (`/containers/:id/stats?stream=false`)                     |
+-----------------------------------------------------------------------------------+
```

---

## 3. Subsystem Breakdown

### 3.1. Runtime Health Monitor (`runtime-health-monitor.service.js`)
- Inspects real Docker container state, cgroups memory consumption, CPU usage, process count (PIDs), and internal application-level HTTP reachability.
- Employs an in-memory observation cache with configurable TTL (default 10 seconds) to prevent Docker daemon exhaustion, bypassable via `forceLive: true`.
- Evaluates composite health into five deterministic states:
  - `HEALTHY`: Container running, CPU/Memory within threshold (<90%), HTTP probe responding 200 OK.
  - `DEGRADED`: Container running, but resource consumption exceeds 90% or cgroup threshold breached.
  - `UNHEALTHY`: Container exited unexpectedly, dead, HTTP probe failed/timed out, or internal service crashed.
  - `UNKNOWN`: Docker daemon unreachable, worker offline, or telemetry absent (never defaults to `HEALTHY`).
  - `TERMINATED`: Container successfully shut down and confirmed in terminal lifecycle state.

### 3.2. Lifecycle Reconciliation Engine (`runtime-reconciliation.service.js`)
- Continuously reconciles state across five distinct layers:
  1. Database state (`DeceptionRuntimeEnvironment`).
  2. Worker memory state (`managedEnvironments`, `managedNetworks`).
  3. Docker daemon container state (running, exited, memory limits).
  4. Docker daemon network state (`net.Internal`, subnet attachment).
  5. Cryptographic evidence chain (hash linkage, terminal events).
- Categorizes inconsistencies into deterministic classification codes:
  - `CONSISTENT`: All five layers align perfectly.
  - `DATABASE_RUNTIME_MISMATCH`: Database indicates active, but worker or container reports stopped/dead.
  - `RUNTIME_MISSING`: Container deleted externally from Docker daemon without database termination.
  - `ORPHAN_RUNTIME`: Container running under system labels without a corresponding active database record.
  - `RESOURCE_MISMATCH`: Container cgroups limits do not match the authorized quota in database.
  - `NETWORK_MISMATCH`: Synthetic network deleted or lacks `Internal: true` egress quarantine.
  - `EVIDENCE_MISMATCH`: Evidence chain broken, missing genesis, or corrupted.
  - `UNKNOWN`: Reconciliation inspection failed due to communication error.
- Adheres to non-destructive reconciliation: never deletes or terminates runtimes silently; emits structured discrepancy records and operator alerts.

### 3.3. Runtime Telemetry Ingestion (`runtime-telemetry.service.js`)
- Collects bounded event streams per deception environment.
- Enforces an in-memory circular ring-buffer (capacity: 500 events) per environment to guarantee zero memory exhaustion under high adversary traffic.
- Transparently records `droppedEventsCount` and generates explicit `TELEMETRY_DATA_LOSS` events when buffer overflow forces FIFO eviction.
- Enforces strict data sanitization:
  - Redacts sensitive credentials (`password`, `token`, `secret`, `authorization`, `cookie`, `apiKey`, `bearer`).
  - Pseudonymizes session IDs using SHA-256 truncation (`sess-anon-***`).

### 3.4. Execution Evidence Chain (`execution-evidence-recorder.service.js`)
- Maintains an append-only SHA-256 linked evidence chain across 15+ granular lifecycle events:
  - Provisioning: `RUNTIME_PROVISION_REQUESTED`, `AUTHORIZATION_VERIFIED`, `CONTAINER_CREATED`, `CONTAINER_STARTED`, `NETWORK_ISOLATED`.
  - Observability & Operations: `HEALTH_CHECK_EXECUTED`, `TELEMETRY_INGESTED`, `MUTATION_REQUESTED`, `MUTATION_EXECUTED`, `RUNTIME_DEGRADED`, `RUNTIME_RECOVERED`.
  - Auditing & Reconciliation: `ANOMALY_DETECTED`, `RECONCILIATION_COMPLETED`.
  - Termination: `TERMINATION_REQUESTED`, `CONTAINER_STOPPED`, `NETWORK_REMOVED`, `EVIDENCE_SEALED`.
- Provides an automated verification engine that evaluates chain continuity, hash matches, timestamp monotonicity, sequence ordering, and milestone completeness (`COMPLETE`, `PARTIAL`, `INCOMPLETE`, `CORRUPTED`).

### 3.5. Runtime Mutation Governance (`runtime-environment-manager.service.js`)
- Enforces strict separation between mutation requests and executions.
- Supports only safe, bounded mutation types: `TOPOLOGY_EXPANSION`, `CREDENTIAL_MUTATION`, `SCHEMA_MUTATION`, `ISOLATION_UPDATE`.
- Rejects arbitrary shell execution or untrusted image alterations with `MUTATION_NOT_SUPPORTED` (HTTP 422).
- Logs mutation proposals as `MUTATION_REQUESTED` with status `PROPOSED_NOT_EXECUTED` until verified by dual-custody authorization.

---

## 4. Tenant Isolation Invariants

Every observability service strictly enforces tenant isolation:
- Database lookups filter on compound indexes containing `{ tenantId, environmentId }`.
- Inter-process communication carries mandatory `x-tenant-id` headers and verified dual-custody JWT claims.
- Telemetry ring buffers are scoped by composite key `${tenantId}:${environmentId}`.
- Cross-tenant queries are blocked at the route, service, and database levels, returning HTTP 404/403 and logging security audit events.

---

## 5. Architectural Invariants and Safeguards

1. **Deterministic Absence**: Missing observations always yield `UNKNOWN`, never `HEALTHY`.
2. **Explicit Telemetry Loss**: Unrecorded or dropped telemetry is reported as `TELEMETRY_DATA_LOSS`, never disguised as lack of activity.
3. **Immutability of Evidence**: Hash chains are strictly append-only; tampering with past events invalidates subsequent hashes and flags `CORRUPTED`.
4. **Non-Destructive Reconciliation**: Reconcilers report anomalies and inconsistencies without executing unilateral destructive terminations.
5. **Separation of Gateway Routing**: No live gateway traffic routing or production traffic diversion is implemented in this stage.
