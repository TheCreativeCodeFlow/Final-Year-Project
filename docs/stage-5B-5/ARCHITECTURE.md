# Stage 5B.5 — System Architecture & Adaptive Gateway Integration

## 1. Executive Summary

Stage 5B.5 represents the milestone where all prior modular capabilities—reverse-proxy gateway, behavioral telemetry normalization, hybrid anomaly detection, adaptive policy evaluation, Deception State Graph (DSG) planning, container isolation, and execution evidence recording—are synthesized into an end-to-end adaptive cyber deception runtime platform.

The system introduces a **14-stage decision pipeline** running at the gateway boundary, backed by strict routing modes (`OBSERVE_ONLY`, `SHADOW`, and `CONTROLLED_LAB`), health-gated runtime selection, and multi-tenant isolation. Under default operation (`SHADOW`), live traffic is safely mirrored against the deception decision engine without any live traffic diversion, recording counterfactual execution evidence and comparing hypothetical synthetic states against actual origin outcomes.

---

## 2. Global System Topology

```
                                      +---------------------------------------------+
                                      |         External Ingress Traffic            |
                                      +---------------------------------------------+
                                                             |
                                                             v
+--------------------------------------------------------------------------------------------------------------------+
|                                         ADAPTIVE GATEWAY RUNTIME (Node.js)                                         |
|                                                                                                                    |
|   +-----------------------+     +-------------------------------+     +----------------------------------------+   |
|   | 1. Ingress Validation | --> | 2. Application/Tenant Lookup | --> | 3. Decision Controller IPC Client      |   |
|   |    - Host header      |     |    - Domain-to-Origin map    |     |    - Fail-closed circuit breaker       |   |
|   |    - Method & length  |     |    - Protected status check   |     |    - Strict timeout management         |   |
|   +-----------------------+     +-------------------------------+     +----------------------------------------+   |
|                                                                                            |                       |
+--------------------------------------------------------------------------------------------|-----------------------+
                                                                                             | (Authenticated IPC)
                                                                                             v
+--------------------------------------------------------------------------------------------------------------------+
|                                    MANAGEMENT BACKEND / DECISION CONTROLLER                                        |
|                                                                                                                    |
|  +---------------------------------------------------------------------------------------------------------------+ |
|  | 14-Stage Gateway Decision Controller Service:                                                                | |
|  |   [1] Application/Tenant Resolution          [8]  Strategy Selection Integration                              | |
|  |   [2] Configuration & Status Validation       [9]  DSG Plan Lookup / Target Version Binding                    | |
|  |   [3] Gateway Request Observation Recording   [10] Candidate Runtime Selection & Health Gating                 | |
|  |   [4] Telemetry Normalization                 [11] Routing Authorization Check                                 | |
|  |   [5] Session Profile Correlation             [12] Routing Decision & Outcome Determination                    | |
|  |   [6] Hybrid Detection Assessment             [13] Routing Decision Persistence & Evidence Logging             | |
|  |   [7] Adaptive Policy Evaluation              [14] Decision Response Formulation                               | |
|  +---------------------------------------------------------------------------------------------------------------+ |
|                                |                                           |                                       |
|                                v                                           v                                       |
|               +---------------------------------+         +---------------------------------+                      |
|               |  PostgreSQL Database (Prisma)   |         | Execution Evidence Recorder     |                      |
|               |  - PolicyDecisions              |         | - SHA-256 Chained Hash Chain    |                      |
|               |  - RoutingDecisions             |         | - Immutable Event Audit Log     |                      |
|               |  - BehavioralAssessments        |         | - Nonce & Signature Validation  |                      |
|               +---------------------------------+         +---------------------------------+                      |
+--------------------------------------------------------------------------------------------------------------------+
                                                             |
                                  +--------------------------+--------------------------+
                                  |                                                     |
                     [Normal / Shadow Routing]                            [Controlled Lab Diverted Routing]
                                  |                                                     |
                                  v                                                     v
          +-----------------------------------------------+     +-----------------------------------------------+
          |          REAL PROTECTED ORIGIN                |     |     ISOLATED SYNTHETIC DECEPTION WORKER       |
          |  (e.g., https://accounts.apexfintech.internal)|     |  - Hardened Docker Container (seccomp, drop)  |
          |  - Unmodified application responses           |     |  - Host Boundary Gating (Finding A Check)     |
          |  - User session credentials preserved         |     |  - Sanitized Headers (Auth/Cookie Stripped)   |
          +-----------------------------------------------+     +-----------------------------------------------+
```

---

## 3. Core Architectural Subsystems

### 3.1. Gateway Reverse Proxy (`gateway/src/app.js`, `gateway/src/proxy/reverse-proxy.js`)
- Runs as a lightweight edge proxy handling client ingress.
- Performs strict Host header validation, RFC 7230 sanitization, and request sizing (1MB max).
- Delegates routing decisions to the `DecisionControllerClient`.
- In `SHADOW` mode, unconditionally forwards the request to the real origin while logging hypothetical deception targets.
- Implements SSRF and DNS rebinding protection via `resolveAndPinUpstreamDestination`.
- Enforces strict socket timeouts (504 Gateway Timeout) and handles upstream connection errors (502 Bad Gateway) without exposing internal infrastructure topology.

### 3.2. Gateway Decision Controller Service (`backend/src/deception/gateway-decision-controller.service.js`)
- Acts as the central brain orchestrating detection, policy, strategy, graph versioning, and runtime selection.
- Operates statelessly with respect to the client connection but queries and persists relational context in PostgreSQL via Prisma.
- Adheres to an efficient in-process execution budget (average pipeline latency ~5-7 ms).
- Emits chronological execution events via `ExecutionEvidenceRecorder` with cryptographic SHA-256 hash chaining.

### 3.3. Runtime Selection Service (`backend/src/deception/runtime-selection.service.js`)
- Evaluates candidate container runtime environments (`DeceptionRuntimeEnvironment`) against eight distinct safety invariants:
  1. Multi-tenant boundary verification.
  2. Protected application ownership.
  3. Strategy compatibility.
  4. Runtime health status (`HEALTHY` vs `UNHEALTHY`/`TERMINATED`).
  5. Cryptographic authorization verification (Dual-custody, non-expired, non-revoked).
  6. DSG graph version compatibility (prevents stale environments from serving newer mutation versions).
  7. Network sandbox isolation mode (`SANDBOX_ISOLATED` / `STRICT_AIRGAP`).
  8. Host-boundary firewall enforcement (blocks activation if host `INPUT` drop rule is missing).

### 3.4. Header Sanitization Engine (`gateway/src/proxy/header-sanitizer.js`)
- Eliminates credential leakage before traffic enters synthetic deception environments.
- Strips `authorization`, `cookie`, `x-api-key`, `x-csrf-token`, `proxy-authorization`.
- Injects non-spoofable synthetic tracking headers:
  - `x-deception-synthetic: true`
  - `x-correlation-id: <uuid>`
  - `x-deception-environment: <env-id>`
- Prohibits external client access to internal container management endpoints (`/internal/*`).

### 3.5. Evidence and Provenance Chain (`backend/src/runtime/execution-evidence-recorder.service.js`)
- Enforces sequential, append-only logging of every observation, assessment, policy outcome, runtime selection, and routing event.
- Calculates recursive hash chaining:
  $$H_i = \text{SHA256}(H_{i-1} \parallel \text{eventPayload} \parallel \text{recordedAt} \parallel \text{eventType})$$
- Ensures forensic reproducibility and compliance auditing for enterprise security operations.
