# Stage 5B.4: State Rollback and Disaster Recovery

## 1. Overview

In dynamic deception, an adaptive strategy might be invalidated if:
1. An attacker's tactics shift, rendering the active honeypot ineffective.
2. A post-mutation inspection detects anomalous container behavior or latency degradation.
3. A security operator explicitly triggers an emergency rollback from the Operations Dashboard.

The DSG Execution Engine provides **atomic state rollback and recovery** (`rollbackMutation`), ensuring synthetic environments can revert cleanly to any prior verified version snapshot without data corruption or container recreation.

---

## 2. In-Memory Snapshot Architecture

Within the synthetic container (`synthetic-service/server.js`), the `SyntheticStateStore` maintains an immutable snapshot cache indexed by `graphVersion`:

```javascript
saveSnapshot(version) {
  this.snapshots.set(version, {
    graphVersion: version,
    users: JSON.parse(JSON.stringify(this.users)),
    routes: JSON.parse(JSON.stringify(this.routes)),
    customers: JSON.parse(JSON.stringify(this.customers)),
    accounts: JSON.parse(JSON.stringify(this.accounts)),
    credentials: JSON.parse(JSON.stringify(this.credentials)),
    schemas: JSON.parse(JSON.stringify(this.schemas)),
    activeServices: Array.from(this.activeServices),
    snapshotAt: new Date().toISOString()
  });
}
```

When a rollback request is dispatched:
1. The rollback endpoint (`POST /internal/rollback`) locates the snapshot corresponding to `targetGraphVersion`.
2. The current active state arrays and sets are atomically replaced with deep clones of the snapshot.
3. The container's active `graphVersion` is restored.

---

## 3. Rollback Pipeline Sequence

```
Operator / Automated Trigger
       |
       v
1. Validate Rollback Target
   - Mutation status must be VERIFIED
   - Environment must belong to tenant
       |
       v
2. Health Verification
   - Container health revalidated
       |
       v
3. Record Evidence
   - Emit MUTATION_ROLLBACK_REQUESTED
       |
       v
4. Dispatch Rollback to Worker IPC
   - POST /environments/:id/rollback
   - Worker queries container loopback /internal/rollback
       |
       v
5. Verify Container State
   - Inspect container synthetic state matches restored version
       |
       v
6. Update Database Environment & Mutation
   - Environment dsgGraphVersion restored to baseGraphVersion
   - Target mutation status updated to ROLLED_BACK
       |
       v
7. Record Verified Rollback Evidence
   - Emit MUTATION_ROLLBACK_VERIFIED with SHA-256 chain continuity
```

---

## 4. Rollback Failure Handling

The engine strictly rejects invalid rollback operations:
- **Already Rolled Back:** Calling rollback on a mutation already marked `ROLLED_BACK` triggers `INVALID_ROLLBACK_STATE` (HTTP 422).
- **Unverified Mutation:** Calling rollback on a mutation that `FAILED` or is still `REQUESTED` is rejected.
- **Missing Snapshot:** If the container was restarted and lacks historical in-memory snapshots, the engine safely fails the rollback without corrupting current state and alerts the operator.
