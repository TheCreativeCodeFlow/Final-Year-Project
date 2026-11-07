# Stage 5B.5 — Runtime Selection & Health Gating Architecture

## 1. Overview

The `RuntimeSelectionService` (`backend/src/deception/runtime-selection.service.js`) is responsible for querying, evaluating, and selecting eligible synthetic runtime environments (`DeceptionRuntimeEnvironment`) for live or shadow deception.

The selection engine is designed around strict defensive engineering: it treats candidate containers as untrusted until all eight safety invariants are verified.

---

## 2. The Eight Candidate Safety Invariants

```
                                    Candidate Environment Evaluation
                                                  |
           +--------------------------------------+--------------------------------------+
           |                                      |                                      |
     1. Tenant ID Check                     2. App ID Check                        3. Strategy Match
     (env.tenantId === req.tenantId)        (env.appId === req.appId)              (strategy compatibility)
           |                                      |                                      |
           v                                      v                                      v
     4. Health Gating                       5. Authorization Check                 6. DSG Version Check
     (HEALTHY / DEGRADED only)              (APPROVED & !EXPIRED & !REVOKED)       (env.version === baseVersion)
           |                                      |                                      |
           v                                      v                                      v
     7. Network Isolation                   8. Host Boundary Gating
     (SANDBOX_ISOLATED mode)                (Host INPUT firewall drop rule)
```

### Invariant 1: Tenant Ownership Verification
- Cross-tenant access is strictly prohibited at the database query level and in memory.
- If an environment belongs to Tenant A, it can never be considered for a request targeting Tenant B.

### Invariant 2: Application Boundary Verification
- The container must be assigned to the requested application or marked as a general-purpose pool container for that tenant.

### Invariant 3: Strategy Compatibility
- If a strategy is specified (e.g., `strat-credential-canary-token-01`), the candidate's strategy identifier must match, ensuring that the container contains the appropriate decoy payloads.

### Invariant 4: Runtime Health Gating
- Candidates in status `UNHEALTHY`, `TERMINATED`, or `UNKNOWN` are immediately disqualified.
- Optional live health checks can be invoked via `HealthMonitorService`.

### Invariant 5: Cryptographic Authorization Verification
- Candidate must reference a valid `DeceptionExecutionAuthorization`.
- The authorization status must be `APPROVED` (not `PENDING`, `REJECTED`, or `REVOKED`).
- The current wall-clock timestamp must be prior to `authorization.expiresAt`.

### Invariant 6: DSG Graph Version Binding
- The candidate container's active graph version ($V_{\text{env}}$) must match the requested base version ($V_{\text{base}}$).
- If $V_{\text{env}} < V_{\text{base}}$, the environment is rejected as `STALE_GRAPH_VERSION`.

### Invariant 7: Network Sandbox Isolation
- Verifies that the container's network isolation mode is set to `SANDBOX_ISOLATED` or `STRICT_AIRGAP`. Containers in bridge mode with unrestricted WAN access are disqualified.

### Invariant 8: Host Boundary Remediation Verification
- In `CONTROLLED_LAB` mode, verifies that `runtimeEvidence.firewallDropRuleApplied === true` and no host boundary vulnerabilities exist.

---

## 3. Rejection Reason Codes

When runtime selection fails to find an eligible container, it returns a structured rejection object containing one of the following canonical reason codes:

| Reason Code | Meaning |
| :--- | :--- |
| `NO_RUNTIME_CONFIGURED` | No runtime environments are provisioned for this tenant. |
| `CROSS_TENANT_MISMATCH` | Environment candidate does not belong to the requesting tenant. |
| `NO_COMPATIBLE_RUNTIME` | Candidates exist, but none match the required strategy or application. |
| `RUNTIME_UNHEALTHY` | Candidate environment health status is `UNHEALTHY`. |
| `RUNTIME_TERMINATED` | Candidate environment has been stopped or destroyed. |
| `RUNTIME_UNKNOWN_HEALTH` | Health status has not been confirmed. |
| `AUTHORIZATION_NOT_FOUND` | No execution authorization is attached to the candidate. |
| `AUTHORIZATION_REVOKED` | Dual-custody authorization was revoked by an operator. |
| `AUTHORIZATION_EXPIRED` | Authorization validity window has lapsed. |
| `AUTHORIZATION_NOT_APPROVED` | Authorization remains in pending or drafted state. |
| `STALE_GRAPH_VERSION` | Container is running an outdated DSG version. |
| `NETWORK_ISOLATION_INCOMPLETE` | Container network lacks strict isolation guarantees. |
| `HOST_BOUNDARY_UNVERIFIED` | Host boundary firewall drop rule is missing (`CONTROLLED_LAB_BLOCKED`). |
| `ROLLBACK_NOT_READY` | Container lacks a verified state snapshot for rollback. |

---

## 4. Controlled Lab Readiness Checklist

Before any live traffic diversion can occur in `CONTROLLED_LAB` mode, `checkControlledLabReadiness(environmentId, tenantId)` executes an explicit readiness audit:

```json
{
  "isReady": false,
  "status": "CONTROLLED_LAB_BLOCKED",
  "blockers": [
    "CONTROLLED_LAB_BLOCKED: Unresolved host INPUT firewall finding (Finding A) is a hard activation blocker."
  ],
  "checklist": {
    "tenantIsolationVerified": true,
    "environmentHealthVerified": true,
    "runtimeAuthorizationVerified": true,
    "networkIsolationVerified": true,
    "hostBoundaryIsolationVerified": false,
    "rollbackReadinessVerified": true
  }
}
```
