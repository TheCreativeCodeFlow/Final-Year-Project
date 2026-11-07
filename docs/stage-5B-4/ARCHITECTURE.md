# Stage 5B.4 — Dynamic Deception State Graph (DSG) Architecture

## 1. System Overview

The **Stage 5B.4 Dynamic Deception State Graph (DSG) Execution Engine** bridges high-level cyber deception policy planning (Stage 5A/5A.1) and low-level isolated container runtime management (Stage 5B.1–5B.3).

In previous milestones, the deception gateway could provision isolated, unexposed synthetic container environments running non-root Node.js services inside dedicated Docker bridge networks (`Internal: true`), monitor container health, and collect append-linked SHA-256 execution evidence. However, the runtime state within those environments remained static or simulated.

Stage 5B.4 introduces the **dynamic execution pipeline** that converts approved Deception State Graph mutation specifications into controlled, observable, and reversible state changes inside live synthetic containers without sacrificing container isolation or security boundaries.

```
+-----------------------------------------------------------------------------------+
|                        Stage 5B.4 Runtime Architecture                            |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|   Attacker Session (Gateway Telemetry & Behavioral Profiling)                     |
|                                |                                                  |
|                                v                                                  |
|   [Stage 4C Hybrid Behavioral Detection Engine]                                   |
|        - Anomaly Scoring & Rule Findings                                          |
|        - Risk Tier & Detected Threat Category                                     |
|                                |                                                  |
|                                v                                                  |
|   [Stage 5A.1 Deception Policy Evaluator]                                         |
|        - Dual-Custody Approval Check                                              |
|        - Deception Disposition & Strategy Selection                               |
|                                |                                                  |
|                                v                                                  |
|   [Stage 5B.4 DSG Execution Engine (14 Stages)]                                   |
|        - Adaptive Mutation Derivation (5 Dimensions)                              |
|        - 7-Way Consistency Engine Pre-Flight Verification                         |
|        - Optimistic Concurrency & Health Gating                                   |
|        - Idempotency Ledger                                                       |
|                                |                                                  |
|             Authenticated IPC Loopback (127.0.0.1:5055)                           |
|                                v                                                  |
|   [Standalone Runtime Worker Daemon]                                              |
|        - Zero Express Socket Access                                               |
|        - Pre-Mutation Health Verification (checkContainerHealth)                  |
|                                |                                                  |
|             Docker Engine Socket Exec API (Node Loopback Probe)                   |
|                                v                                                  |
|   [Isolated Synthetic Deception Container]                                        |
|        - Non-Root Execution (UID 1000)                                            |
|        - Read-Only Root Filesystem                                                |
|        - Zero Host Port Mappings                                                  |
|        - Isolated Bridge Network (Internal: true, Egress Quarantined)             |
|        - Dynamic In-Memory SyntheticStateStore (/internal/state, /internal/mutate) |
|        - Atomic Snapshot Stack & Rollback (/internal/rollback)                    |
|                                |                                                  |
|                                v                                                  |
|   [Append-Linked SHA-256 Execution Evidence Chain]                                |
|        - MUTATION_REQUESTED -> MUTATION_DISPATCHED -> MUTATION_EXECUTED           |
|        - MUTATION_INSPECTED -> MUTATION_VERIFIED                                  |
|        - Tamper-Evident Audit Ledger                                              |
+-----------------------------------------------------------------------------------+
```

---

## 2. Process Separation & Trust Boundaries

The runtime architecture maintains strict process separation across three distinct security domains:

### Domain 1: Express REST API Backend
- Handles tenant operator requests, UI dashboards, and authorization flows.
- **Docker Access:** Strictly **ZERO** access to the Docker daemon socket (`/var/run/docker.sock`).
- Interacts with container infrastructure exclusively via the `WorkerClient` over an authenticated, loopback-only HTTP IPC interface (`127.0.0.1:5055`).

### Domain 2: Standalone Runtime Worker Process
- Operates as a distinct operating system process with exclusive Docker socket access.
- Validates job authenticity, authorization tokens, tenant scoping, and environment lifecycle states.
- Performs non-arbitrary container loopback probes using the Docker Exec API running `node -e` scripts in the container network namespace.

### Domain 3: Isolated Synthetic Container
- Runs the minimal Alpine Node.js synthetic service (`deception-synthetic-service:1.0.0`).
- Bound to an isolated internal Docker bridge with `Internal: true` and negative egress quarantine.
- Features a read-only root filesystem, dropped Linux capabilities (`ALL` dropped, minimal retained), `pids_limit: 100`, `cpu_quota: 50,000 / 100,000`, and `memory: 256MB`.
- Maintains an in-memory `SyntheticStateStore` maintaining synthetic identities, routes, decoy records, credentials, and state snapshots.

---

## 3. Communication Pathways

1. **API to Worker:** Authenticated loopback HTTP POST requests containing JSON mutation payloads signed with the worker token header (`x-worker-token`).
2. **Worker to Container:** The worker sends container management commands via Docker's `/containers/{id}/exec` API. A lightweight Node.js probe script runs inside the container's network namespace and issues a local HTTP loopback request to `127.0.0.1:8080/internal/mutate` or `/internal/rollback`.
3. **Container State Storage:** The container holds all state in memory. No persistent storage or database connections exist inside the container, ensuring rapid execution and leak-proof teardown.
