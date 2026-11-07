# Stage 5B.4: Authorization and Execution Safety Specification

## 1. Zero Arbitrary Command Policy

The Adaptive Deception Gateway adheres to a strict Zero Arbitrary Command Policy. Under no circumstances are arbitrary shell scripts (`/bin/sh`, `/bin/bash`), dynamic Docker CLI executions, raw SQL commands, or host filesystem writes permitted.

### How Mutations Are Dispatched Safely
All synthetic environment modifications take place within isolated containers via **non-arbitrary loopback IPC queries**:
1. Container runtime executes a fixed node script via Docker Exec API:
   `node -e 'const http = require("http"); const req = http.request({ host: "127.0.0.1", port: 8080, path: "/internal/mutate", method: "POST", headers: { "Content-Type": "application/json" } }, (res) => { ... }); req.write(payload); req.end();'`
2. The synthetic application's internal HTTP server (`synthetic-service/server.js`) parses the strongly-typed JSON mutation payload and applies it exclusively to its in-memory `SyntheticStateStore`.
3. The container's network namespace remains quarantined on an internal Docker bridge with zero host port bindings and zero external egress.

---

## 2. Multi-Stage Authorization Pipeline

Every mutation request must satisfy multi-tier cryptographic and organizational checks before being accepted for processing:

```
+-------------------------------------------------------------------------+
|                      MUTATION AUTHORIZATION GATES                       |
+-------------------------------------------------------------------------+
| Gate 1: Dual-Custody Approval                                           |
|         - Requesting Operator != Approving Operator                     |
|         - Status must be 'APPROVED'                                     |
| Gate 2: Expiration and Lifetime Verification                            |
|         - now() < authorization.expiresAt (no expired tokens)           |
| Gate 3: Tenant Boundary Scoping                                         |
|         - authorization.tenantId === request.tenantId                   |
| Gate 4: DSG Graph Version Binding                                       |
|         - authorization.dsgGraphId === environment.dsgGraphId           |
| Gate 5: Pre-Flight Health Gating                                        |
|         - container.healthState in ['HEALTHY', 'DEGRADED']              |
|         - UNHEALTHY / TERMINATED environments explicitly rejected       |
+-------------------------------------------------------------------------+
```

### Dual-Custody Verification
Under Stage 5B.1 governance, execution authorizations require dual-custody approval. An operator proposing a deception strategy cannot self-approve it for execution. The `DeceptionExecutionAuthorization` record must feature distinct `requestingOperatorId` and `approvingOperatorId` identifiers.

### Expiration Enforcement
Every authorization is bounded by a strict TTL (typically 1 hour). If `new Date() > authorization.expiresAt`, the pipeline throws an `AUTHORIZATION_EXPIRED` (HTTP 403) error and logs an alert.

### Tenant Scoping and RBAC
The runtime router rejects cross-tenant requests with HTTP 404/403. Tenant operators can only view and mutate environments belonging strictly to their authenticated tenant identifier (`req.tenant.id`).

---

## 3. Pre-Flight Health Gating

Before initiating state mutations, the engine performs active container inspection via `RuntimeHealthMonitorService.inspectEnvironmentHealth(...)`.
- If the environment container is `UNHEALTHY`, `UNKNOWN`, or `TERMINATED`, the pipeline immediately aborts with `RUNTIME_HEALTH_GATED` (HTTP 422).
- This guarantees that mutations are never dispatched to crashing, unresponsive, or terminating workloads, preventing orphaned state and unrecoverable drifts.

---

## 4. Quota and Concurrency Governance

- **Resource Governance Integration:** `ResourceGovernanceService.enforceQuota` verifies active container and mutation limits per tenant before state creation.
- **Idempotency Safeguard:** Idempotency keys (`idempotencyKey`) prevent duplicate execution of replayed requests, returning the original mutation record with `{ idempotentReplay: true }`.
- **Atomic Optimistic Concurrency:** Graph version locking prevents race conditions between competing worker threads.
