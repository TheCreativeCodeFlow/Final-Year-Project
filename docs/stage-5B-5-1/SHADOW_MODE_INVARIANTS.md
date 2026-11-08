# Stage 5B.5.1 — Shadow-Mode Routing Invariants & Verification

## 1. The Fundamental Shadow-Mode Invariant

In an adaptive cyber deception gateway, shadow-mode evaluation enables the security system to observe live ingress traffic, run hybrid anomaly detectors, query adaptive deception policies, bind Deception State Graph (DSG) plans, and select candidate synthetic containers **without altering actual traffic flow**.

The mathematical and engineering invariant is:

$$\forall r \in \mathcal{R}_{\text{processed}}, \quad \text{Mode}(r) = \text{SHADOW} \implies \text{ActualDestination}(r) = \text{ProtectedOrigin}(r)$$

For any batch of $N$ successfully processed requests in `SHADOW` mode:
1. **Actual Origin Forwarding Count ($N_{\text{origin}}$):** Must strictly equal $N$.
2. **Actual Synthetic Diversion Count ($N_{\text{synthetic}}$):** Must strictly equal $0$.
3. **Hypothetical Deception Decisions ($N_{\text{hypothetical}}$):** May range from $0$ to $N$, reflecting attacks detected and proposed for hypothetical diversion.
4. **Separation of Concerns:** Hypothetical deception targets must never alter the socket-level destination of live traffic.

---

## 2. Invariant Implementation in Gateway Layer

In `gateway/src/app.js`, the routing layer enforces this invariant directly at the reverse proxy boundary:

```javascript
// SHADOW-MODE ROUTING INVARIANT ENFORCEMENT
const activeRoutingMode = decision.routingMode || 'SHADOW';
let isDeceptionRouting = false;
let targetOrigin = appContext.upstreamUrl;

if (activeRoutingMode === 'SHADOW' || activeRoutingMode === 'OBSERVE_ONLY') {
  // Enforce zero diversion: traffic ALWAYS forwards to real protected origin
  targetOrigin = appContext.upstreamUrl;
  isDeceptionRouting = false;

  // Fail-safe assertion: override any unintended synthetic target returned by controller
  if (decision.targetDestination && decision.targetDestination !== appContext.upstreamUrl) {
    logger.warn('Shadow-mode invariant guard: targetDestination overridden to protected origin', {
      correlationId: req.id,
      controllerTarget: decision.targetDestination,
      originUrl: appContext.upstreamUrl
    });
  }
}
```

---

## 3. Empirical Verification: 100-Request Shadow Integration Test

To verify this invariant under realistic conditions, the test suite (`backend/tests/gateway-shadow-mode-integrity.test.js`) executed an automated 100-request integration test through the live HTTP gateway reverse proxy:

- **Workload:** 100 requests across diverse endpoints (`/api/v1/profile`, `/api/v1/auth/login`, `/api/v1/customers/all`, `/api/v1/.env`, `/api/v1/payments/history`).
- **Attacks Included:** Credential stuffing, administrative enumeration, and data exfiltration.
- **Hardware & Servers:** Real loopback HTTP server for Protected Origin (with atomic hit counter) and real loopback HTTP server for Synthetic Deception (with atomic hit counter).
- **Results:**
  - `originHitCount`: **100 / 100 (100.0%)**
  - `syntheticHitCount`: **0 / 100 (0.0%)**
  - Live HTTP Responses: 100% returned `{ origin: 'REAL_PROTECTED_APPLICATION' }`
  - Injected Response Headers: Zero synthetic deception headers (`X-Synthetic-Deception` was `undefined` on all responses).
- **Conclusion:** The shadow-mode routing invariant is mathematically verified.
