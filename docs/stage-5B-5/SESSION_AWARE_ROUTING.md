# Stage 5B.5 — Session-Aware Routing & Longitudinal Attacker Correlation

## 1. Overview

Effective cyber deception requires maintaining continuity across multi-step attacker campaigns. If an attacker discovers decoy endpoints or receives synthetic canary tokens in request $N$, subsequent requests $N+1$ from the same attacker must interact with the same synthetic deception state rather than oscillating back to real systems.

Stage 5B.5 implements **Session-Aware Routing** via `BehavioralSessionCorrelator` and `GatewayDecisionControllerService`.

---

## 2. Pseudonymous Session Identification

To prevent storing raw Personal Identifiable Information (PII) while preserving tracking fidelity, the system constructs a cryptographic session reference:

$$\text{SessionSeed} = \text{ClientIP} \parallel \text{UserAgent} \parallel \text{JA3/TLS Fingerprint} \parallel \text{TenantID}$$

$$\text{SessionRef} = \text{"sess-"} \parallel \text{Hex}(\text{MD5}(\text{SessionSeed}))_{[0:12]}$$

### Characteristics:
- **Stateless Reproducibility:** Repeated requests with identical client characteristics generate the identical `sessionRef` deterministically.
- **Privacy-Preserving:** Client IP and raw identity tokens are never exposed in log outputs or database indexes.
- **Tenant-Isolated:** Identical client IPs across different tenants resolve to distinct session handles, preventing cross-tenant tracking or collusion.

---

## 3. Session Continuity in Routing Decisions

```
Request 1 (IP: 198.51.100.99) ----> Gateway ----> Session Correlator ----> SessionRef: sess-a4f912c03b12
                                                        |
                                                        v
                                                 Assessment: ATTACK (Recon)
                                                        |
                                                        v
                                                 Routing: SHADOW (Target: env-rt-5b5-01)

Request 2 (IP: 198.51.100.99) ----> Gateway ----> Session Correlator ----> SessionRef: sess-a4f912c03b12 (MATCH)
                                                        |
                                                        v
                                                 Assessment: ATTACK (Exploit)
                                                        |
                                                        v
                                                 Routing: SHADOW (Maintains continuity with env-rt-5b5-01)
```

1. **First Contact:**
   - Client sends initial probe (`/api/v1/auth/login`).
   - Session correlator registers session profile and baseline anomaly score.
   - Initial routing decision records the selected environment and binds the session handle.

2. **Subsequent Probes:**
   - Client sends follow-up probe (`/api/v1/customers/all`).
   - Gateway resolves matching `sessionRef`.
   - Decision controller evaluates accumulated behavioral risk.
   - If deception was previously active for this session, the decision controller prioritizes the same synthetic environment ID, preserving deceptive narrative consistency.

---

## 4. Duplicate Request Idempotency

Network retries or replayed attacks must not create conflicting state mutations or corrupt the evidence chain.

- Incoming requests provide or receive an `X-Request-ID` UUID.
- If an identical `correlationId` is received within the cache window, `GatewayDecisionControllerService` processes the request deterministically, maintaining identical routing outcomes and actions without creating duplicate assessment entities.
- Validated via Test Category 22 (`Duplicate request handling: replaying identical correlation ID is handled deterministically`).
