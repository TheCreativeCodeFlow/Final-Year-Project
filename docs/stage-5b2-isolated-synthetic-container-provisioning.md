# Stage 5B.2 — Isolated Synthetic Container Provisioning

**Project:** AI-Enabled Adaptive Cyber Deception Gateway  
**Repository:** `https://github.com/TheCreativeCodeFlow/Final-Year-Project.git`  
**Branch:** `main`  
**Milestone:** Stage 5B.2  
**Evaluator Version:** `5B.2`  
**Runtime Architecture Status:** `STAGE_5B2_PROVISIONING_ACTIVE`  
**Execution Evidence Status:** `VERIFIED`  
**Docker Engine Socket:** `/Users/rahulseervi/.colima/default/docker.sock`  
**Standard Synthetic Image:** `deception-synthetic-service:1.0.0` (`sha256:5e6dcf93ac4d11b70fb663b5a0a6e39b75bff656dee257b789edd0a0a1b8cb29`)  

---

## 1. Executive Summary & Production Status

Stage 5B.2 transitions the Adaptive Cyber Deception Gateway from the architectural and execution-safety foundations established in Stage 5B.1 into **first real container provisioning capability**.

Prior to Stage 5B.2:
- Stage 5B.1 established dual-custody authorization gating, a 12-state linear lifecycle machine, quota management, and separation of duties under a strict zero-container invariant.
- All runtime environments were simulated with `isSimulated = true`, and execution evidence was strictly marked as `MISSING`.

In Stage 5B.2:
- The system activates real container provisioning using local Docker engine over a Unix domain socket.
- Provisions isolated synthetic deception containers with hardened Linux container boundaries (non-root UID `1000:1000`, read-only root filesystems, dropped capabilities `ALL`, `no-new-privileges`, zero host port bindings).
- Enforces strict network isolation via dedicated internal Docker bridge networks (`Internal: true`), completely blocking default gateway routing and internet egress.
- Verifies negative egress quarantine through active packet drop tests (`8.8.8.8:53` unreachable).
- Collects and records real cryptographic execution evidence (`CONTAINER_CREATED`, `IMAGE_VERIFIED`, `SECURITY_CONFIG_APPLIED`, `NETWORK_ISOLATION_VERIFIED`, `HEALTH_CHECK_PASSED`, `EGRESS_QUARANTINE_VERIFIED`, `CONTAINER_TERMINATED`, `CLEANUP_COMPLETED`).
- **Research Boundary Invariant:** Live gateway traffic is **never diverted** to deception containers in this milestone; deception targets have **zero external or internet exposure**, and **no connection** to production applications or databases.

---

## 2. Architecture Topology & Docker Boundary

The container provisioning architecture separates HTTP request handling from container management operations:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Express Web API Boundary                        │
│   (controllers/runtime.controller.js & routes/runtime.routes.js)       │
│                                                                        │
│   - Multi-tenant RBAC & Separation of Duties                           │
│   - Anti-CSRF Token Validation                                         │
│   - Express API layer NEVER connects directly to Docker socket         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Submit Provisioning Job
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               Provisioning Dispatcher & Job Queue Boundary             │
│                 (backend/src/runtime/provisioning-dispatcher.js)       │
│                                                                        │
│   - Idempotency Key De-duplication (SHA-256 payload matching)          │
│   - Dual-Custody Approval Verification (APPROVED & NOT EXPIRED/REVOKED)│
│   - Optimistic Concurrency Check (Graph version immutability)          │
│   - Quota Pre-Reservation (CPU, Memory, Concurrent Containers)         │
│   - Persists DeceptionProvisioningJob (QUEUED)                         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Asynchronous Job Processing
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 Dedicated Runtime Worker Service Boundary              │
│                (backend/src/runtime/runtime-worker.service.js)         │
│                                                                        │
│   - Dedicated worker orchestrating real container lifecycles           │
│   - State Transitions: AUTHORIZED -> PROVISIONING -> ACTIVE            │
│   - Real Execution Evidence Collection & Recording                     │
│   - Automatic rollback & orphan teardown on provisioning errors        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Unix Domain Socket
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Restricted Container Runtime Adapter                 │
│              (backend/src/runtime/container-runtime-adapter.js)        │
│                                                                        │
│   - Native node:http Unix Socket Client (/.../docker.sock)             │
│   - Pinned Image Digest Verification (sha256 digest lookup)            │
│   - Internal Bridge Network Creation (Internal: true)                  │
│   - Hardened Container Configuration (readOnly, non-root, cap_drop)    │
│   - Negative Egress Verification (8.8.8.8:53 timeout / socket drop)   │
│   - HTTP Synthetic Health Probe (/health/live)                         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                           Docker Engine                                │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ Network: dec-net-<envId> (driver: bridge, Internal: true)      │   │
│   │                                                                │   │
│   │   ┌────────────────────────────────────────────────────────┐   │   │
│   │   │ Container: dec-synth-<envId>                           │   │   │
│   │   │ Image: deception-synthetic-service:1.0.0               │   │   │
│   │   │ Digest: sha256:5e6dcf93ac4d11b70...                    │   │   │
│   │   │ UID: 1000:1000 | Read-only rootfs | No Privileges     │   │   │
│   │   │ CapDrop: ALL | Memory: 128MB | CPU: 0.25               │   │   │
│   │   │ Zero Published Host Ports                              │   │   │
│   │   │ Negative Egress Verified (Internet Access: BLOCKED)    │   │   │
│   │   └────────────────────────────────────────────────────────┘   │   │
│   └────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Dedicated Runtime Worker Isolation

Direct access to the Docker daemon from incoming API requests poses serious denial-of-service, latency, and privilege escalation risks. The architecture enforces complete worker isolation:

1. **Decoupled API Subsystem:** The Express route handler `/environments/provision` accepts requests, validates schema, verifies tenancy, checks authorization, and submits jobs to the `ProvisioningDispatcher`.
2. **Deterministic Idempotency:** The dispatcher generates SHA-256 digests of the request parameters. Submitting identical idempotency keys returns existing job records without re-triggering container provisioning. Submitting the same key with differing parameters returns `409 Conflict`.
3. **Execution Safety Preconditions:** The dispatcher verifies that:
   - The associated `DeceptionExecutionAuthorization` is in state `APPROVED`.
   - The authorization has not passed `expiresAt`.
   - The authorization has not been `REVOKED`.
   - Separation of duties is preserved (`approvedByUserId !== requestedByUserId`).
   - The Deception State Graph version matches `expectedGraphVersion`.
   - Resource quota admission succeeds.
4. **Execution Worker:** The `RuntimeWorkerService` executes the end-to-end container provisioning pipeline, recording atomic execution steps and handling failures gracefully.

---

## 4. Approved Synthetic Image Catalogue

To prevent arbitrary image execution, supply-chain tampering, or host compromise, all images must be registered in the **Approved Synthetic Image Catalogue** (`backend/src/runtime/image-catalogue.js`):

| Property | Value |
|---|---|
| **Image Identifier** | `deception-synthetic-service:1.0.0` |
| **Repository Tag** | `deception-synthetic-service:1.0.0` |
| **Pinned SHA-256 Digest** | `sha256:5e6dcf93ac4d11b70fb663b5a0a6e39b75bff656dee257b789edd0a0a1b8cb29` |
| **Architecture** | `linux/amd64` / `linux/arm64` |
| **Base Distribution** | Alpine Linux 3.20 (Minimal node:20-alpine runtime) |
| **Allocated CPU / Memory** | 0.25 Cores / 128 MB |
| **Execution User** | `1000:1000` (non-root `node`) |
| **Root Filesystem** | `readOnly: true` |
| **Security Drops** | `cap_drop: ["ALL"]`, `security_opt: ["no-new-privileges:true"]` |
| **Allowed Service Types** | `SYNTHETIC_API`, `SYNTHETIC_AUTH`, `SYNTHETIC_DATA` |

Any provisioning request specifying an unrecognized image identifier or an image whose cryptographic digest does not match the pinned catalogue digest is immediately rejected.

---

## 5. Synthetic Service Templates

Templates specify synthetic operational parameters without altering underlying container security boundaries:

```javascript
{
  "tpl-synthetic-api-01": {
    "templateIdentifier": "tpl-synthetic-api-01",
    "name": "Synthetic Banking API Deception Target",
    "serviceType": "SYNTHETIC_API",
    "imageIdentifier": "deception-synthetic-service:1.0.0",
    "defaultEnvironmentVariables": {
      "SERVICE_TYPE": "SYNTHETIC_API",
      "SERVICE_PORT": 8080,
      "SYNTHETIC_PERSONA": "banking-core-api",
      "LOG_LEVEL": "info",
      "CANARY_TOKEN_PREFIX": "CANARY_APEX_"
    },
    "healthCheckConfig": {
      "path": "/health/live",
      "port": 8080,
      "expectedStatus": 200,
      "timeoutMs": 3000
    }
  },
  "tpl-synthetic-auth-01": {
    "templateIdentifier": "tpl-synthetic-auth-01",
    "name": "Synthetic OAuth2/OIDC Auth Server Target",
    "serviceType": "SYNTHETIC_AUTH",
    "imageIdentifier": "deception-synthetic-service:1.0.0",
    "defaultEnvironmentVariables": {
      "SERVICE_TYPE": "SYNTHETIC_AUTH",
      "SERVICE_PORT": 8080,
      "SYNTHETIC_PERSONA": "oauth2-oidc-provider",
      "CANARY_TOKEN_PREFIX": "CANARY_AUTH_"
    }
  },
  "tpl-synthetic-data-01": {
    "templateIdentifier": "tpl-synthetic-data-01",
    "name": "Synthetic Customer Data Store Target",
    "serviceType": "SYNTHETIC_DATA",
    "imageIdentifier": "deception-synthetic-service:1.0.0",
    "defaultEnvironmentVariables": {
      "SERVICE_TYPE": "SYNTHETIC_DATA",
      "SERVICE_PORT": 8080,
      "SYNTHETIC_PERSONA": "records-query-store",
      "CANARY_TOKEN_PREFIX": "CANARY_DATA_"
    }
  }
}
```

---

## 6. Container Security Hardening

Containers are provisioned under defense-in-depth isolation parameters:

1. **Non-Root Execution:** Containers run strictly under UID `1000` and GID `1000`. Root execution (`UID 0`) is prohibited.
2. **Read-Only Root Filesystem:** Root filesystem is mounted read-only (`ReadonlyRootfs: true`). In-memory temporary file access is restricted to a memory-backed tmpfs mount at `/tmp` (`Tmpfs: { '/tmp': 'rw,noexec,nosuid,size=16m' }`).
3. **Capability Stripping:** All Linux capabilities are dropped (`CapDrop: ['ALL']`).
4. **No Privilege Escalation:** `no-new-privileges:true` is set, blocking `setuid` and `setgid` binaries.
5. **Resource Ceilings:** Strictly limited to `Memory: 134217728` (128 MB), `NanoCpus: 250000000` (0.25 CPU cores), and `PidsLimit: 64`.
6. **Zero Published Ports:** `PortBindings: {}` and `PublishAllPorts: false`. Containers are accessible **only** within their isolated bridge network by authorized worker probes; no host interface ports are opened.

---

## 7. Network Isolation & Egress Quarantine

Every synthetic container is attached to an isolated Docker bridge network created with `Internal: true`:

```javascript
await adapter.createIsolatedNetwork({
  networkName: `dec-net-${environmentId}`,
  labels: {
    'ai.deception.managed': 'true',
    'ai.deception.environmentId': environmentId
  }
});
```

### 7.1 Negative Egress Quarantine Verification
To prove complete egress quarantine, the `RuntimeWorkerService` executes an active negative egress probe inside the running container before marking it `ACTIVE`:
- Executes a raw socket connection attempt to `8.8.8.8:53` with a strict 1000ms timeout.
- Because `Internal: true` blocks the default gateway, outgoing packets are dropped.
- The command times out / fails, returning a non-zero exit code:
  ```bash
  node -e "const s = require('net').createConnection(53, '8.8.8.8'); s.setTimeout(1000); s.on('connect', () => process.exit(0)); s.on('timeout', () => { s.destroy(); process.exit(1); }); s.on('error', () => process.exit(1));"
  ```
- Any unexpected external connection triggers an immediate emergency teardown and marks the environment `FAILED`.

---

## 8. Health Verification & Synthetic State

Once provisioned and egress-verified, the worker performs an in-network HTTP probe against `http://<containerIp>:8080/health/live`:
- Verifies HTTP 200 response with payload `{ status: 'UP', service: 'deception-synthetic-service', ... }`.
- Measures round-trip latency (typically < 35ms).
- Updates environment `healthStatus = 'HEALTHY'` and records `healthCheckDetails`.

---

## 9. Execution Evidence Recording

Unlike Stage 5B.1 where evidence was strictly `MISSING`, Stage 5B.2 generates verified cryptographic audit records:

| Evidence Type | Description |
|---|---|
| `CONTAINER_CREATED` | Records Docker container ID, name, image digest, creation timestamp |
| `IMAGE_VERIFIED` | Records verified pinned SHA-256 image digest against catalogue |
| `SECURITY_CONFIG_APPLIED` | Confirms non-root execution, read-only rootfs, dropped capabilities |
| `NETWORK_ISOLATION_VERIFIED` | Confirms creation of `Internal: true` bridge network |
| `EGRESS_QUARANTINE_VERIFIED` | Proves outbound packets to internet (`8.8.8.8:53`) are dropped |
| `HEALTH_CHECK_PASSED` | Confirms container responds to `/health/live` probe |
| `CONTAINER_TERMINATED` | Records graceful container termination (`SIGTERM` followed by `SIGKILL`) |
| `CLEANUP_COMPLETED` | Confirms container and network removal with zero orphan host artifacts |

Each evidence entry includes an SHA-256 payload digest and cryptographic hash chaining.

---

## 10. Resource Governance & Quota Enforcement

Resource Governance limits prevent runaway resource consumption:

- **Global Research Safety Caps:** Default tenant limit of 2 concurrent environments, 2.0 CPUs, 2048 MB RAM.
- **Atomic Quota Reservation:** When a job is submitted, capacity is checked and pre-reserved (`currentAllocatedContainers += 1`, `currentAllocatedCpu += 0.25`, `currentAllocatedMemoryMb += 128`).
- **Quota Release:** When an environment transitions to `TERMINATED` or `FAILED`, reserved resources are atomically released.

---

## 11. Lifecycle State Machine Transitions

Stage 5B.2 extends the 12-state linear machine to permit controlled transitions to `PROVISIONING` and `ACTIVE` when authorized:

```
  DRAFT
    │
    ▼
VALIDATING
    │
    ▼
PROPOSED
    │
    ▼
AUTHORIZED ──(Runtime Worker Execution)──▶ PROVISIONING ──(Verified)──▶ ACTIVE
                                                │                         │
                                                ▼ (Error)                 ▼ (Teardown)
                                              FAILED                  TERMINATING
                                                                          │
                                                                          ▼
                                                                      TERMINATED
```

Transitions to `PROVISIONING` and `ACTIVE` are only permitted when `context.allowExecution = true` is supplied by the verified `RuntimeWorkerService`.

---

## 12. Authorization & Separation of Duties

The dual-custody approval invariant is strictly enforced:
- **Analyst Role (`SECURITY_ANALYST`):** Can trigger deception policies and submit execution authorization requests (`POST /runtime/authorizations`). Cannot approve requests.
- **Application Owner Role (`APPLICATION_OWNER`):** Can review and approve authorization requests (`POST /runtime/authorizations/:id/approve`). Cannot approve requests created by themselves.
- **Cross-Tenant Access:** Forbidden (`403 Forbidden`).

---

## 13. State Management & Relational Mapping

The database schema maps all provisioning relationships:

```
DeceptionExecutionAuthorization
               │
               ▼
    DeceptionProvisioningJob
               │
               ▼
  DeceptionRuntimeEnvironment ──▶ DeceptionExecutionEvent (Evidence log)
               │
               ▼
    DeceptionResourceQuota
```

The `DeceptionProvisioningJob` model tracks:
- `jobIdentifier`, `idempotencyKey`, `jobStatus` (`QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`).
- `containerId`, `networkId`, `provisioningLogs`.
- `executionEvidence` JSON array.

---

## 14. Failure Modes & Automatic Teardown

If any step of the provisioning workflow fails:
1. Container creation error $\to$ Worker cleans up created network and marks job `FAILED`.
2. Negative egress test fails (unexpected internet route) $\to$ Worker immediately stops container, removes container and network, marks environment `FAILED`.
3. Health check timeout $\to$ Worker halts, captures container logs, tears down resources, releases quota.
4. Host reboot / orphan detection $\to$ `cleanupOrphanResources()` scans for containers labeled `ai.deception.managed: true` without active database records and removes them.

---

## 15. REST API Reference

| Endpoint | Method | Role | Description |
|---|---|---|---|
| `/tenants/:id/runtime/images` | `GET` | Analyst, Owner | List approved images and pinned digests |
| `/tenants/:id/runtime/templates` | `GET` | Analyst, Owner | List synthetic service templates |
| `/tenants/:id/runtime/environments/provision` | `POST` | Owner | Submit a container provisioning job |
| `/tenants/:id/runtime/jobs` | `GET` | Analyst, Owner | List provisioning jobs for tenant |
| `/tenants/:id/runtime/jobs/:jobId` | `GET` | Analyst, Owner | Retrieve provisioning job status and logs |
| `/tenants/:id/runtime/environments/:envId/evidence` | `GET` | Analyst, Owner | Retrieve verified cryptographic execution evidence |
| `/tenants/:id/runtime/environments/:envId/terminate` | `POST` | Owner | Terminate container, remove network, release quota |

---

## 16. Frontend Runtime Operations Console

The React frontend (`src/pages/runtime/`) reflects live container capabilities:

1. **`RuntimeOverviewPage.jsx`:** Displays `STAGE_5B2_PROVISIONING_ACTIVE` badge, live container count, approved image digest, and isolation security banner.
2. **`ExecutionAuthorizationsPage.jsx`:** Approved authorizations include a **Provision Container** button opening the Stage 5B.2 provisioning modal, selecting template, idempotency token, and displaying job logs.
3. **`EnvironmentRegistryPage.jsx`:** Shows live container ID, internal network ID, health status (`HEALTHY`), and action to inspect verified evidence and trigger safe termination.

---

## 17. Verification Matrix & Test Evidence

### Automated Test Coverage
- **Stage 5B.2 Dedicated Suite (`isolated-synthetic-container-provisioning.test.js`):** 26 tests, 100% pass rate.
- **Stage 5B.1 Architecture Safety Suite (`runtime-architecture-safety.test.js`):** 25 tests, 100% pass rate.
- **Total Backend Test Suite:** 398 tests, 54 suites, 100% pass rate (0 failures).
- **Gateway Reverse Proxy Suite:** 37 tests, 2 suites, 100% pass rate.
- **Frontend Production Build:** Vite build succeeds cleanly with 0 errors.

### Real Container Test Results
```
✔ Stage 5B.2: Isolated Synthetic Container Provisioning Suite
  ✔ Approved Image Catalogue (4 tests pass)
  ✔ Synthetic Service Templates (3 tests pass)
  ✔ Container Runtime Adapter (3 tests pass)
  ✔ Provisioning Dispatcher & Safety Preconditions (7 tests pass)
  ✔ Real Container Provisioning & Security Hardening (5 tests pass)
  ✔ Runtime REST APIs (4 tests pass)
Total: 26 passed, 0 failed, duration: ~13.4s
```

---

## 18. Research Boundaries & Future Milestones

| Capability | Stage 5B.2 Status | Planned Milestone |
|---|---|---|
| Isolated Synthetic Container Provisioning | **ACTIVE & VERIFIED** | Stage 5B.2 |
| Immutable Pinned Image Catalogue | **ACTIVE & VERIFIED** | Stage 5B.2 |
| Negative Egress Isolation Verification | **ACTIVE & VERIFIED** | Stage 5B.2 |
| Cryptographic Execution Evidence | **ACTIVE & VERIFIED** | Stage 5B.2 |
| Autonomous Gateway Traffic Diversion | **DISABLED (Fail Closed)** | Stage 5C |
| Dynamic Payload-Adaptive Decoy Synthesis | **SIMULATED** | Stage 5C.1 |
| Honeynet Mesh Inter-Service Routing | **DISABLED** | Stage 6A |
