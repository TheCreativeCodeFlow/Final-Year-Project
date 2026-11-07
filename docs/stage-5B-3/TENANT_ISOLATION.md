# Stage 5B.3 — Multi-Tenant Runtime Boundary Isolation

## 1. Overview

The AI-Enabled Adaptive Cyber Deception Gateway is a multi-tenant platform designed to serve diverse organizations with strict confidentiality and integrity isolation.

A critical vulnerability in deceptive operations would be cross-tenant data leakage—e.g., an operator in Tenant B observing Tenant A's deception environments, viewing captured attacker interactions, or tampering with Tenant A's evidence chains.

Stage 5B.3 enforces multi-tenant boundary controls across five distinct layers of the runtime observability architecture:
1. REST API Routing & Access Control
2. Database Query Boundaries
3. Worker Process IPC & Claims Verification
4. In-Memory Telemetry Ring Buffers
5. Evidence Chain Provenance & Verification

---

## 2. Multi-Layer Isolation Architecture

```
[ Tenant A Request: /api/v1/tenants/tenantA/runtime/... ]
                         |
                         v
+-------------------------------------------------------------------+
| Layer 1: Route Middleware & JWT Authorization                      |
| - Validates req.user.tenantId === req.params.tenantId             |
| - Cross-tenant requests immediately rejected with HTTP 403        |
+-------------------------------------------------------------------+
                         |
                         v
+-------------------------------------------------------------------+
| Layer 2: Service & Prisma Query Scoping                           |
| - SELECT * FROM deceptionRuntimeEnvironment                       |
|   WHERE id = :environmentId AND tenantId = :tenantId             |
| - Missing or mismatched tenantId returns HTTP 404 Not Found       |
+-------------------------------------------------------------------+
                         |
                         v
+-------------------------------------------------------------------+
| Layer 3: Worker Client IPC Authentication                         |
| - IPC Header: 'x-tenant-id: tenantA'                              |
| - Dual-custody token verification validates matching tenant claim |
+-------------------------------------------------------------------+
                         |
                         v
+-------------------------------------------------------------------+
| Layer 4: In-Memory Telemetry Buffer Partitioning                  |
| - Map Key: `${tenantId}:${environmentId}`                         |
| - Zero memory sharing across tenants                              |
+-------------------------------------------------------------------+
                         |
                         v
+-------------------------------------------------------------------+
| Layer 5: Evidence Chain Partitioning                              |
| - Evidence records tied to tenantId in database and payload       |
| - Chain verification audits only events matching tenantId         |
+-------------------------------------------------------------------+
```

---

## 3. Detailed Boundary Mechanisms

### 3.1. Route Middleware (`tenantAuth` / `requireTenant`)
All runtime endpoints are namespaced under `/api/v1/tenants/:tenantId/runtime/`:
- `requireAuth` validates the caller's JWT.
- If caller role is not `SUPER_ADMIN`, the middleware verifies that `req.user.tenantId === req.params.tenantId`.
- Any attempt by Tenant B to supply Tenant A's UUID in the path returns `403 Forbidden` and logs a security violation.

### 3.2. Database Query Scoping
All database queries executed by `RuntimeHealthMonitorService`, `RuntimeReconciliationService`, and `ExecutionEvidenceRecorderService` enforce composite tenant constraints:
```javascript
const environment = await prisma.deceptionRuntimeEnvironment.findFirst({
  where: {
    id: environmentId,
    tenantId: tenantId, // Strict tenant filter
  },
});
if (!environment) {
  throw new NotFoundError(`Runtime environment not found for tenant: ${tenantId}`);
}
```
If an attacker attempts to supply an environment ID belonging to another tenant, the query returns `null`, resulting in a clean `404 Not Found` without disclosing the existence of the foreign resource.

### 3.3. Worker IPC Verification
Requests forwarded from the backend to the isolated runtime worker child process include:
- `x-tenant-id`: Target tenant UUID.
- `Authorization`: Bearer token signed with the internal worker secret and carrying `{ tenantId, environmentId }` claims.
The worker validates that the requested container or network belongs to the specified tenant by inspecting Docker labels (`deception.tenant=<tenantId>`).

### 3.4. In-Memory Ring Buffer Isolation
In `RuntimeTelemetryService`, telemetry event buffers are isolated using compound string keys:
```javascript
const bufferKey = `${tenantId}:${environmentId}`;
if (!this.buffers.has(bufferKey)) {
  this.buffers.set(bufferKey, new BoundedRingBuffer(500));
}
```
Tenant B cannot inspect or drain Tenant A's ring buffer, even if both tenants execute concurrent deception workloads on the same physical gateway host.

### 3.5. Evidence Chain Scoping
When verifying an evidence chain:
- Queries load events filtered by `tenantId` and `environmentId`.
- Each event's hash calculation incorporates `tenantId`.
- If an event from Tenant B were injected into Tenant A's chain, the payload hash and previous hash linkage would immediately break, flagging the chain as `CORRUPTED`.

---

## 4. Verification & Adversarial Audit Results

The tenant boundary was empirically verified in `backend/tests/runtime-observability-evidence.test.js`:
- **Test 24 ("Tenant Isolation in Health, Telemetry, and Reconciliation")**:
  - Provisioned environment for `tenantA`.
  - Attempted health inspection, telemetry query, evidence verification, and mutation using `tenantB` credentials.
  - Result: All cross-tenant access attempts were blocked with HTTP 404 / 403.
  - Zero cross-tenant data leakage occurred.
