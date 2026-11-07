# Stage 5B.4: Residual Security Risks and Mitigations

## 1. Threat Modeling and Boundary Analysis

Stage 5B.4 introduces dynamic state manipulation within running synthetic containers. Although these mutations are strictly constrained to predefined models, specific operational and security risks remain relevant to runtime stability.

---

## 2. Identified Residual Risks and Applied Controls

### Risk 1: In-Memory Snapshot Exhaustion
- **Threat:** High-frequency mutations could cause excessive memory consumption if historical snapshots grow without bounds in `SyntheticStateStore`.
- **Severity:** Medium
- **Mitigation:**
  - The snapshot store maintains a rolling window of recent snapshots (default 50 snapshots).
  - Snapshot serialization discards large transient payloads, storing only essential entity tables and configuration maps.
  - Container memory limits (cgroup 256MB) strictly prevent container memory growth from impacting host resources.

### Risk 2: Out-of-Order Worker State Replays
- **Threat:** Network delays or transient worker failures could result in delayed mutation messages being delivered after a newer version has already been applied.
- **Severity:** Low
- **Mitigation:**
  - Enforced monotonic version sequencing: `targetGraphVersion === currentGraphVersion + 1`. Any out-of-order delivery is rejected at Stage 6 with `STALE_GRAPH_VERSION` (HTTP 409).
  - Idempotency key tracking identifies replayed messages and responds with cached execution results without re-applying mutations.

### Risk 3: Container Crash During State Serialization
- **Threat:** If a synthetic container process crashes during a mutation query before saving the snapshot, the container state might not reflect the updated graph version.
- **Severity:** Medium
- **Mitigation:**
  - Two-phase mutation protocol: The mutation response is only returned if `getStateSnapshot()` confirms that the internal graph version incremented successfully.
  - Stage 12 post-flight verification: `dsgEngine` independently performs an HTTP loopback query to `/internal/state` to verify the state on the running container before updating the PostgreSQL database.
  - If post-flight verification fails, the mutation status is marked `FAILED` and graph version rollback is initiated.

### Risk 4: Gateway Routing Drift
- **Threat:** Synthetic environments evolve faster than proxy gateway route tables, potentially routing requests to uninitialized endpoints.
- **Severity:** Informational (Stage 5B.4 is execution-only; live traffic diversion is introduced in subsequent stages).
- **Mitigation:**
  - Zero live gateway traffic diversion is enabled in Stage 5B.4. Gateway routing remains isolated until full end-to-end routing validation is established.
