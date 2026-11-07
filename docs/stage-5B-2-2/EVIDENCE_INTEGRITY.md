# Evidence Integrity Specification and Cryptographic Chaining

## 1. Problem Statement (Finding D)

In Stage 5B.2.1, the system claimed "tamper-proof execution evidence and non-repudiation". However:
1. Records in PostgreSQL were individual standalone rows with non-cryptographic UUID primary keys.
2. An adversary with database write access could alter or delete rows without breaking any mathematical or structural relationships.
3. No cryptographic hash linked consecutive events, and no external trust anchor or timestamping authority was integrated.

Stage 5B.2.2 establishes an append-linked SHA-256 evidence chain and clarifies cryptographic trust semantics.

---

## 2. Cryptographic Hash Chaining Specification

Each execution event record (`DeceptionExecutionEvent`) incorporates cryptographic hash chaining within its tenant and environment scope:

```
[Event 0: Genesis]
  sequenceNumber: 0
  previousEventHash: "0000000000000000000000000000000000000000000000000000000000000000"
  payload: { tenantId, environmentId, eventType: "PROVISIONING_INITIATED", ... }
  eventHash = SHA256(canonicalPayload + previousEventHash)
        ^
        |
[Event 1: Starting]
  sequenceNumber: 1
  previousEventHash: <eventHash_0>
  payload: { tenantId, environmentId, eventType: "CONTAINER_STARTED", ... }
  eventHash = SHA256(canonicalPayload + previousEventHash)
        ^
        |
[Event 2: Active]
  sequenceNumber: 2
  previousEventHash: <eventHash_1>
  payload: { tenantId, environmentId, eventType: "HEALTH_VERIFIED", ... }
  eventHash = SHA256(canonicalPayload + previousEventHash)
```

### 2.1 Canonical Payload Serialization
To guarantee deterministic digest calculation regardless of JSON key ordering, keys are sorted alphabetically before stringification:
```javascript
function canonicalJsonString(obj) {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJsonString).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => `${JSON.stringify(k)}:${canonicalJsonString(obj[k])}`).join(',') + '}';
}
```

---

## 3. Evidence Chain Verification (`verifyEvidenceChain`)

The `ExecutionEvidenceRecorder` service provides an automated verification engine that scans an environment's full event log:
1. **Sequence Continuity**: Verifies that sequence numbers start at 0 and increment strictly by 1 (`seq === i`).
2. **Hash Pointer Integrity**: Verifies that each event's `previousEventHash` exactly equals the `eventHash` of the preceding event.
3. **Payload Digest Verification**: Recomputes the SHA-256 digest from the stored event fields and verifies that it matches the recorded `eventHash`.

### 3.1 Tamper Detection Scenarios
The verification engine successfully detects and reports specific corruption types:
- **`PAYLOAD_CORRUPTED`**: If an attacker alters the event type, actor, reason, or timestamp in the database.
- **`DELETED_INTERMEDIATE_EVENT`**: If an attacker deletes a record (e.g. an authorization or diversion event) to conceal their actions.
- **`BROKEN_PARENT_REFERENCE`**: If an event points to an invalid or forged predecessor hash.

---

## 4. Cryptographic Trust Semantics & Boundary Disclosures

It is vital to distinguish between **internal payload integrity** and **true legal non-repudiation**:

```
+-------------------------------------------------------------+
|                  EVIDENCE INTEGRITY STATUS                  |
|                                                             |
|  Payload Integrity:          VERIFIED (SHA-256 Hash Chain)  |
|  Sequence Order:             VERIFIED (Deterministic Seq)   |
|  Tamper Detection:           VERIFIED (Internal Checksum)   |
|                                                             |
|  Non-Repudiation:            NOT_IMPLEMENTED                |
|  Independent Trust Anchor:   NOT_IMPLEMENTED                |
+-------------------------------------------------------------+
```

### 4.1 Why Non-Repudiation is Marked NOT_IMPLEMENTED
- **Symmetric vs Asymmetric Cryptography**: The hashes are computed by the application server using standard SHA-256, not signed with asymmetric private keys held in hardware security modules (HSM) by individual operators.
- **Absence of Independent Trust Anchors**: No RFC 3161 compliant external Time-Stamping Authority (TSA) or public transparency log (e.g., Sigstore/Rekor) currently signs the chain roots.
- **Database Administrator Capability**: A malicious database superuser who modifies an event could recompute the SHA-256 hashes for all subsequent events if they possess the application code.

Therefore, the system transparently documents:
- `NON_REPUDIATION: NOT_IMPLEMENTED`
- `INDEPENDENT_TRUST_ANCHOR: NOT_IMPLEMENTED`
