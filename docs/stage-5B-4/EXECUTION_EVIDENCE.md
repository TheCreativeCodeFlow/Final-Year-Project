# Stage 5B.4: Cryptographic Execution Evidence and Audit Trail

## 1. SHA-256 Append-Linked Evidence Chain

Every action within the Dynamic Deception State Graph Execution Engine generates immutable, append-linked cryptographic evidence recorded in PostgreSQL table `DeceptionExecutionEvent`.

Each event record computes a SHA-256 hash over its canonical payload concatenated with the preceding event's `eventHash`:

$$\text{eventHash}_n = \text{SHA-256}(\text{eventHash}_{n-1} \mathbin{\Vert} \text{tenantId} \mathbin{\Vert} \text{eventType} \mathbin{\Vert} \text{recordedAt} \mathbin{\Vert} \text{payloadJSON})$$

This creates a tamper-evident audit log providing mathematical proof that:
1. No events were deleted, inserted, or reordered.
2. The exact operational sequence from initial mutation request to container verification is verifiable.
3. Multi-tenant boundary isolation is maintained.

---

## 2. The 12 Mutation Lifecycle Statuses and Events

```
REQUESTED ──> VALIDATED ──> AUTHORIZED ──> DISPATCHED ──> ACCEPTED ──> EXECUTED
                                                                         │
                                                                         ▼
ROLLED_BACK <── ROLLBACK_VERIFIED <── VERIFIED <── INSPECTED <───────────┘
```

The execution evidence engine records standard lifecycle events across both normal progression and failure modes:

| Event Type | Lifecycle Stage | Description |
| :--- | :--- | :--- |
| `MUTATION_REQUESTED` | Stage 1 | Initial mutation proposal received by engine. |
| `MUTATION_VALIDATED` | Stage 6 | Mutation passed 7-way consistency checks. |
| `MUTATION_REJECTED` | Stage 6 | Mutation rejected due to schema or consistency violations. |
| `MUTATION_AUTHORIZED` | Stage 7 | Dual-custody authorization and token validity verified. |
| `MUTATION_DISPATCHED` | Stage 9 | Mutation dispatched across authenticated worker IPC. |
| `MUTATION_ACCEPTED` | Stage 10 | Worker accepted mutation for container execution. |
| `MUTATION_EXECUTED` | Stage 10 | In-memory synthetic state updated in container. |
| `MUTATION_INSPECTED` | Stage 12 | Live container query confirmed updated graph version. |
| `MUTATION_VERIFIED` | Stage 13 | End-to-end mutation verified; environment version bumped. |
| `MUTATION_FAILED` | Any | Execution failure or communication timeout. |
| `MUTATION_ROLLBACK_REQUESTED`| Rollback | Rollback requested by operator or automated trigger. |
| `MUTATION_ROLLBACK_EXECUTED` | Rollback | Container loopback reverted state to previous snapshot. |
| `MUTATION_ROLLBACK_VERIFIED` | Rollback | Environment graph version and container state confirmed reverted. |

---

## 3. Evidence Chain Verification (`verifyEvidenceChain`)

The service function `verifyEvidenceChain({ tenantId, environmentId, prismaClient })` independently verifies the entire hash chain for an environment:
1. Loads all events ordered by `recordedAt ASC`.
2. Re-computes each `eventHash` using the canonical payload and the previous event's hash.
3. Detects any hash mismatches, broken sequence links, or missing parent pointers.
4. Returns `{ valid: boolean, chainLength: number, violations: string[] }`.

This verification can be queried programmatically via API or rendered in real time on the Operations Dashboard.
