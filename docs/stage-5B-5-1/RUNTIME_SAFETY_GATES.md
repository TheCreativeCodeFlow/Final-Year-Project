# Stage 5B.5.1 — Runtime Safety Gates & Gating Invariants

## 1. Safety Architecture Overview

The Adaptive Cyber Deception Gateway operates at the perimeter between untrusted incoming client traffic and backend application infrastructure. To prevent catastrophic misrouting, service interruption to benign users, or container-to-host lateral movement, the system enforces **eight mandatory safety invariants** implemented across the gateway proxy, policy controller, and runtime selection service.

```
Incoming Request
      │
      ▼
[ G1: Shadow / Observe Mode Invariant ] ─── Mode = SHADOW ────► Forward to Protected Origin (Synthetic = 0)
      │ Mode = CONTROLLED_LAB
      ▼
[ G2: Tenant Isolation Check ] ──────────── Tenant Mismatch ──► Terminate / Defer to Origin
      │ Matches Tenant
      ▼
[ G3: Dual-Custody Approval Check ] ─────── Unapproved Plan ──► Defer to Origin
      │ Approved & Bound
      ▼
[ G4: Runtime Health & Degraded Gate ] ──── Degraded/Unhealthy ► Reject Candidate (Strict Reason Code)
      │ Healthy / Tolerant
      ▼
[ G5: Host Boundary Safety Gate ] ───────── Finding A Active ──► CONTROLLED_LAB_BLOCKED ──► Origin Preserved
      │ Finding A Remediated
      ▼
[ G6: Cryptographic Hash Chaining ] ─────── Hash Generated
      │
      ▼
[ G7: Fail-Safe Exception Trap ] ────────── Exception Caught ─► Fallback to Origin Forwarding
      │
      ▼
[ G8: Separation of Semantics ] ─────────── Propose != Allow  ► Origin Access Explicitly Governed
```

---

## 2. The Eight Core Runtime Safety Invariants

### Invariant 1: Shadow-Mode Origin Invariant
- **Rule:** When the gateway is configured in `SHADOW` or `OBSERVE_ONLY` mode, live client traffic must forward exclusively to the real protected application.
- **Enforcement:** Enforced in `gateway/src/app.js` (Stage 6) and `gateway-decision-controller.service.js`. Even if the policy engine recommends deception, `isDeceptionRouting = false` and `targetOrigin = upstreamUrl`.
- **Accounting:** $N_{\text{synthetic}} = 0$ is guaranteed at the socket layer.

### Invariant 2: Tenant Isolation Boundary
- **Rule:** A request belonging to Tenant $A$ can never bind to, interact with, or query synthetic deception environments or DSG plans belonging to Tenant $B$.
- **Enforcement:** Enforced in `runtime-selection.service.js` via strict Prisma query predicates (`where: { tenantId }`). Any cross-tenant attempt produces immediate rejection code `TENANT_MISMATCH`.

### Invariant 3: Dual-Custody Authorization & Execution Grants
- **Rule:** No synthetic container may be provisioned or selected for traffic diversion without a valid, non-expired execution grant signed by dual-custody approval (`approvalStatus: APPROVED`).
- **Enforcement:** Checked in `runtime-selection.service.js` and `execution-authorization.service.js`. If an execution grant has expired or was revoked, rejection code `AUTHORIZATION_EXPIRED` is returned.

### Invariant 4: Strict Runtime Health & Degraded-State Gating
- **Rule:** Runtimes in state `UNHEALTHY`, `UNKNOWN`, or `TERMINATED` are disqualified unconditionally. Runtimes in state `DEGRADED` are disqualified by default (`RUNTIME_DEGRADED_DISQUALIFIED`) unless the selected deception strategy explicitly permits degraded operation.
- **Degraded-Tolerant Strategies:**
  - `strat-service-tarpit-latency-01` (Tarpit latency / artificial delays)
  - `SERVICE_INTERACTION_DECEPTION` (Slow response simulation)
- **Prerequisites:** Even for degraded-tolerant strategies, the runtime candidate must pass `degradedPrerequisitesMet === true` (e.g. basic TCP listener responsive). Otherwise, the runtime is strictly rejected.

### Invariant 5: Host-Boundary Safety Gate (Finding A Blocker)
- **Rule:** Live traffic diversion into Docker synthetic containers requires verified host netfilter `INPUT` quarantine (remediating Stage 5B.2.1 Finding A). If the host boundary firewall is unverified, live diversion is locked out.
- **Enforcement:** `checkControlledLabReadiness` in `runtime-selection.service.js` checks the active security profile. Because host `INPUT` rules cannot be guaranteed on all development/container runtimes, the gate fails safe:
  ```javascript
  return {
    ready: false,
    reason: 'CONTROLLED_LAB_BLOCKED: Unresolved host INPUT firewall rule (Finding A) is a hard activation blocker.'
  };
  ```
  All requests fall back to protected origin forwarding (`CONTROLLED_LAB_BLOCKED`).

### Invariant 6: Cryptographic Evidence Hash Chaining
- **Rule:** Every routing decision and runtime execution event must generate a deterministic, tamper-evident SHA-256 hash chained to the predecessor event's hash (`previousEventHash`).
- **Enforcement:** Computed via `crypto.createHash('sha256')` over normalized JSON representations. Verified in `gateway-shadow-mode-integrity.test.js` Category 18.

### Invariant 7: Fail-Closed Origin Preservation (Fail-Safe Default)
- **Rule:** Any unexpected runtime exception, database timeout, network partition, or unhandled error inside the decision pipeline must automatically fail safe to normal protected application forwarding.
- **Enforcement:** Outer `try...catch` blocks in both `gateway/src/app.js` and `gateway-decision-controller.service.js` catch errors, log high-priority alerts, and return `outcomeStatus: FAIL_SAFE_ORIGIN` with `actualUpstreamDestination = originUrl`. Ingress traffic is never dropped or blackholed.

### Invariant 8: Disentangled Deception Disposition vs. Origin Access
- **Rule:** A deception disposition of `PROPOSE_DECEPTION` does not automatically revoke or grant origin access. Origin access decisions (`ALLOW_ORIGIN`, `BLOCK_ORIGIN`, `DEFER_WITH_UNCERTAINTY`) are tracked as distinct, independent fields.
- **Enforcement:** Database models `PolicyDecision` and `RoutingOutcome` store `deceptionDispo` independently from `originAccessDecision`.

---

## 3. Disqualification Reason Codes Reference

The runtime selection engine (`backend/src/deception/runtime-selection.service.js`) provides explicit, auditable rejection reasons when a container cannot be bound:

| Reason Code | Trigger Condition | Fallback Action |
| :--- | :--- | :--- |
| `NO_RUNTIMES_PROVISIONED` | Zero containers exist for the tenant in the database | Log warning, forward to protected origin |
| `NO_RUNTIMES_MATCH_STRATEGY` | Active containers do not support the requested strategy | Log warning, forward to protected origin |
| `ALL_RUNTIMES_AT_CAPACITY` | All candidate containers have reached max concurrent sessions | Log warning, forward to protected origin |
| `ALL_RUNTIMES_UNHEALTHY` | Candidate containers failed liveness/readiness probes | Emit alert, forward to protected origin |
| `RUNTIME_DEGRADED_DISQUALIFIED` | Container is in `DEGRADED` state and strategy is not degraded-tolerant | Log gate activation, forward to protected origin |
| `TENANT_MISMATCH` | Ingress request tenantId does not match container tenantId | Security alert, forward to protected origin |
| `DSG_VERSION_MISMATCH` | Container running older incompatible graph schema version | Defer execution, forward to protected origin |
| `AUTHORIZATION_EXPIRED` | Execution grant timestamp has elapsed dual-custody TTL | Defer execution, forward to protected origin |
| `CONTROLLED_LAB_BLOCKED` | Host boundary netfilter firewall rule unverified (Finding A) | Hard safety gate, forward to protected origin |
