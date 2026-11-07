# Stage 5B.4 — The 14-Stage DSG Execution Pipeline

## 1. Overview

The core invariant of the Adaptive Deception Gateway is **zero unverified execution claims**. A mutation is never assumed to have succeeded simply because an instruction was dispatched. Every state transition follows a deterministic 14-stage lifecycle pipeline:

```
Stage 1:  Observation Received
   │
Stage 2:  Assessment Retrieved
   │
Stage 3:  Current DSG State Loaded
   │
Stage 4:  Adaptive Strategy Selected
   │
Stage 5:  Mutation Plan Generated
   │
Stage 6:  7-Way Consistency Engine Pre-Flight Verification
   │
Stage 7:  Dual-Custody Authorization Checked
   │
Stage 8:  Versions & Runtime Health Revalidated
   │
Stage 9:  Mutation Dispatched to Worker IPC
   │
Stage 10: Synthetic Environment State Mutated
   │
Stage 11: Post-Mutation Runtime Health Verified
   │
Stage 12: Resulting DSG State & Snapshot Persisted
   │
Stage 13: Append-Linked Execution Evidence Generated
   │
Stage 14: Mutation Sealed as VERIFIED (or FAILED/UNKNOWN)
```

---

## 2. Pipeline Stages in Detail

### Stage 1 — Observation Received
The pipeline ingests incoming behavioral telemetry and session identifiers from gateway observation feeds.

### Stage 2 — Assessment Retrieved
Retrieves the authoritative `BehavioralAssessment` record emitted by the Stage 4C hybrid detector, including anomaly scores, rule findings, detected threat category, and risk tier.

### Stage 3 — Current DSG State Loaded
Loads the target environment's active deception state model and current graph version ($v_N$) from database records and queries live container synthetic state via worker IPC.

### Stage 4 — Adaptive Strategy Selected
Maps the attacker's observed threat category to an adaptive deception operational strategy:
- `CREDENTIAL_STUFFING` / `BRUTE_FORCE` $\rightarrow$ `CREATE_DECOY_CREDENTIAL`
- `API_RECONNAISSANCE` / `FUZZING` $\rightarrow$ `ADD_SYNTHETIC_ROUTE`
- `DATA_EXFILTRATION` / `INJECTION` $\rightarrow$ `ADD_SYNTHETIC_RECORD`
- `LATERAL_MOVEMENT` / `ENUMERATION` $\rightarrow$ `ADD_SYNTHETIC_USER`

### Stage 5 — Mutation Plan Generated
Calculates target graph version ($v_{N+1}$) and structures the canonical mutation specification (dimension, operation, payload, and adaptive rationale). Checks idempotency ledger.

### Stage 6 — 7-Way Consistency Engine Pre-Flight Verification
Validates the proposed mutation across all seven consistency dimensions (Identity, Authentication, API Route, Database Schema, Service Dependency, Network Isolation, and Historical State). Contradictory mutations are rejected immediately with `MUTATION_CONSISTENCY_VIOLATION` (HTTP 422).

### Stage 7 — Dual-Custody Authorization Checked
Verifies that an `APPROVED` execution authorization exists for the tenant and environment. Rejects expired, revoked, or non-approved authorizations (HTTP 403).

### Stage 8 — Versions and Runtime Health Revalidated
Enforces optimistic concurrency by verifying that `freshEnv.dsgGraphVersion === currentGraphVersion`. Verifies that the container's health state is `HEALTHY` or `DEGRADED`; rejects with `RUNTIME_HEALTH_GATED` (HTTP 422) if `UNHEALTHY`, `UNKNOWN`, or `TERMINATED`.

### Stage 9 — Mutation Dispatched to Worker IPC
Dispatches mutation request to standalone runtime worker over authenticated loopback IPC (`127.0.0.1:5055/environments/:id/mutate`). Generates `MUTATION_DISPATCHED` execution evidence.

### Stage 10 — Synthetic Environment State Mutated
The worker executes an internal loopback query to the synthetic container (`POST /internal/mutate`). The in-memory `SyntheticStateStore` applies the change, captures a pre-mutation snapshot, and advances the local graph version.

### Stage 11 — Post-Mutation Runtime Health Verified
Inspects the container immediately after mutation via `checkContainerHealth` to confirm the internal HTTP service remains nominal (HTTP 200) and no crash or cgroup fault occurred.

### Stage 12 — Resulting DSG State Recorded
Atomically updates the database records in PostgreSQL via transaction:
- `DeceptionRuntimeMutation`: marked `VERIFIED`, `appliedAt` recorded.
- `DeceptionRuntimeEnvironment`: `dsgGraphVersion` bumped to $v_{N+1}$.
- `DeceptionGraph`: `graphVersion` bumped to $v_{N+1}$.

### Stage 13 — Execution Evidence Generated
Generates append-linked SHA-256 evidence chain milestones:
- `MUTATION_EXECUTED`
- `MUTATION_INSPECTED`
- `MUTATION_VERIFIED`

### Stage 14 — Status Sealed
The mutation lifecycle terminates in a canonical terminal status: `VERIFIED`, `FAILED`, or `UNKNOWN`.
