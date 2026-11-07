# Stage 5B.4: 7-Way Consistency Engine Specification

## 1. Role in Dynamic Deception

In an adaptive deception architecture, synthetic environments evolve over time. However, unconstrained mutations risk creating logical contradictions (e.g. an API route requiring a synthetic user role that does not exist, or a credential mapping to a deleted synthetic persona). Such contradictions would immediately alert a sophisticated attacker that they are interacting with a synthetic honeypot.

The **7-Way Consistency Engine** (`backend/src/deception/dsg-consistency-engine.service.js`) performs rigorous formal verification across 7 distinct operational dimensions before any state mutation can be authorized or dispatched.

---

## 2. The 7 Verification Dimensions

```
+-------------------------------------------------------------------------+
|                        7-WAY CONSISTENCY MATRIX                         |
+-------------------+-----------------------------------------------------+
| Dimension         | Invariant Verified                                  |
+-------------------+-----------------------------------------------------+
| 1. Identity       | Role assignments, non-conflicting usernames         |
| 2. Authentication | Credential bindings map to valid personas           |
| 3. API Route      | Routing namespaces and status codes non-colliding   |
| 4. Database Schema| Canary tables and columns syntactically sound       |
| 5. Service Dep    | Dependent services exist and are active             |
| 6. Network Isolat | Zero egress drift, loopback IPC preserved           |
| 7. Historical     | Monotonic version progression (target = base + 1)   |
+-------------------+-----------------------------------------------------+
```

### Dimension 1: Synthetic Identity Consistency
- Ensures all new usernames do not collide with existing synthetic or protected identities.
- Verifies that any assigned role belongs strictly to `ALLOWED_SYNTHETIC_ROLES`.
- Validates that entity relationships (manager, team) reference valid synthetic user IDs.

### Dimension 2: Authentication & Credential Consistency
- Validates that every honey-token or decoy API key is mapped to an existing synthetic user.
- Asserts that token privileges do not exceed the mapped synthetic role.
- Prohibits duplicate active tokens with identical token strings.

### Dimension 3: API Route & Topology Consistency
- Ensures newly added API routes do not conflict with core gateway health endpoints (`/healthz`, `/metrics`, `/internal/*`).
- Verifies HTTP methods are valid standard methods (`GET`, `POST`, `PUT`, `DELETE`).
- Asserts that route availability adheres to `ALLOWED_ROUTE_AVAILABILITIES`.

### Dimension 4: Synthetic Database Schema Consistency
- Verifies table names and column identifiers follow standard alphanumeric syntax (`^[a-z0-9_]+$`).
- Prohibits dropping essential canary tracking columns.
- Prevents schema mutations from duplicating existing table definitions inconsistently.

### Dimension 5: Service Dependency Consistency
- Validates that enabled synthetic microservices belong to `ALLOWED_SYNTHETIC_SERVICES`.
- Ensures services required by specific decoy routes are currently active or provisioned concurrently.

### Dimension 6: Network Isolation Consistency
- Verifies that mutations do not attempt to establish outbound network listeners, proxy tunnels, or bridge routes.
- Confirms execution preserves loopback IPC on `127.0.0.1:8080` without exposing host ports.

### Dimension 7: Historical State & Version Monotonicity
- Enforces strict monotonic version sequencing: `targetGraphVersion === currentGraphVersion + 1`.
- Prevents stale mutations, replay attacks, or race conditions caused by concurrent workers.
- Rejects any mutation proposing version skipping or version decrementing.

---

## 3. Consistency Matrix Output Format

The engine returns an immutable evaluation record:

```json
{
  "consistent": true,
  "currentGraphVersion": 12,
  "targetGraphVersion": 13,
  "violations": [],
  "dimensionResults": {
    "identity": { "passed": true, "consistent": true, "details": "Identity references and roles consistent." },
    "authentication": { "passed": true, "consistent": true, "details": "Authentication credentials map to valid identities." },
    "apiRoute": { "passed": true, "consistent": true, "details": "API route namespaces and status codes non-colliding." },
    "databaseSchema": { "passed": true, "consistent": true, "details": "Synthetic data schema and canary columns valid." },
    "serviceDependency": { "passed": true, "consistent": true, "details": "Service dependencies satisfied." },
    "networkIsolation": { "passed": true, "consistent": true, "details": "Strict internal network quarantine preserved." },
    "historicalState": { "passed": true, "consistent": true, "details": "Target version 13 strictly advances current version 12." }
  }
}
```

If any dimension evaluates to `false`, the entire mutation plan is aborted immediately, recording a `MUTATION_REJECTED` event in the execution evidence chain with full diagnostic reasoning.
