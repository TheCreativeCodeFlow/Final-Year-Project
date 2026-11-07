# Stage 5B.5 — Failure Handling, Circuit Breakers & Resilience

## 1. Fail-Safe Architectural Tenet

The gateway adheres strictly to **defense-in-depth and fail-closed security principles**:

1. **Security Failures Fail Closed:** If authentication, tenant verification, host validation, or decision controller services fail or are unavailable, traffic is blocked immediately (HTTP 400, 403, 404, or 503).
2. **Deception Failures Fail Safe to Origin:** If an attack is detected and deception is proposed, but the synthetic container runtime is unavailable, unhealthy, or blocked by safety invariants, traffic **never gets dropped or routed to an unverified target**; instead, it safely defers to the real protected application origin (or blocks if explicit policy dictates).
3. **No Information Leakage:** Error responses never disclose backend infrastructure addresses, internal Docker ports, database exceptions, or network topology.

---

## 2. Failure Scenarios and Recovery Mechanisms

```
+-----------------------------------+------------------------+-------------+-------------------------------------------------+
| Failure Condition                 | Detection Mechanism    | Status Code | Gateway Behavior & Safeguard                    |
+-----------------------------------+------------------------+-------------+-------------------------------------------------+
| Missing / Spoofed Host Header     | Header syntax check    | 400 Bad Req | Blocked before proxying; logs audit event.      |
| Unregistered / Unknown Domain     | App Resolver lookup    | 404 Not Fnd | Closed circuit; no upstream connection.         |
| Decision Controller Offline       | HTTP/IPC connection    | 503 Service | Fails closed safely if required by policy.      |
| Upstream Connection Refused       | Socket ECONNREFUSED    | 502 Bad Gtw | Generic Bad Gateway; hides port and topology.   |
| Upstream Origin Times Out         | Socket timeout timer   | 504 Timeout | Socket destroyed; controlled JSON 504 returned. |
| Deception Container Unhealthy     | Health gating check    | 200 (Origin)| Defer to real origin (RUNTIME_UNAVAILABLE).     |
| Host Boundary Invariant Missing   | Safety audit check     | 200 (Origin)| Blocks diversion (CONTROLLED_LAB_BLOCKED).      |
| Telemetry Queue Capacity Full     | Bounded buffer guard   | N/A (Async) | Drops oldest record; prevents node OOM.         |
+-----------------------------------+------------------------+-------------+-------------------------------------------------+
```

---

## 3. Deep-Dive on Core Failure Handlers

### 3.1. Decision Controller Unavailability (503 Circuit Breaker)
Implemented in `DecisionControllerClient` (`gateway/src/services/decision-controller-client.js`):
- When the management backend or decision controller is down, requests encounter a timeout or connection failure.
- If `requireController = true` (default in high-security configurations), the client returns:
  ```json
  {
    "action": "FAIL_CLOSED",
    "routingOutcome": "FAIL_CLOSED",
    "reason": "Decision controller unreachable; failing closed."
  }
  ```
- The gateway returns HTTP 503 `SECURITY_CONTROL_UNAVAILABLE` rather than blindly routing uninspected traffic.

### 3.2. Upstream Timeout Handling (504 Gateway Timeout)
Implemented in `proxyRequest` (`gateway/src/proxy/reverse-proxy.js`):
- Timeouts are enforced at the socket level (`upstreamReq.setTimeout(timeoutMs)`).
- When a protected upstream server hangs or stalls, `upstreamReq.on('timeout')` destroys the upstream socket immediately.
- If headers have not been sent, the gateway responds with HTTP 504:
  ```json
  {
    "success": false,
    "error": {
      "code": "GATEWAY_TIMEOUT",
      "message": "The protected upstream origin did not respond within the configured timeout."
    },
    "requestId": "<uuid>"
  }
  ```
- Validated via Test Category 18.

### 3.3. Runtime Unavailable Handling
- When deception disposition is `PROPOSED`, but no container is healthy or authorized, the decision controller does not terminate the user request.
- It records outcome `RUNTIME_UNAVAILABLE` and routes the request to the legitimate protected origin:
  ```json
  {
    "action": "NORMAL_ROUTING",
    "routingOutcome": "RUNTIME_UNAVAILABLE",
    "targetDestination": "http://127.0.0.1:3000",
    "reason": "Deception proposed but runtime unavailable. Safely forwarded to origin."
  }
  ```
- Validated via Test Category 19.

### 3.4. Telemetry Buffer Exhaustion Guard
Implemented in `TelemetryRecorderService` (`gateway/src/services/telemetry-recorder.service.js`):
- In high-throughput attack scenarios, telemetry persistence can experience backpressure.
- To prevent unbounded memory consumption and Node.js process crashes (OOM), the recorder uses a fixed circular buffer (maximum 10,000 events).
- If full, the oldest uncommitted telemetry record is dropped with an explicit warning log (`QUEUE_CAPACITY_EXCEEDED`).
