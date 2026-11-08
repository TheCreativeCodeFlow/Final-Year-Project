# Stage 5B.5.1 — Routing Decision & Outcome Semantics

## 1. Field Separation & Anti-Conflation Architecture

In previous prototype iterations, hypothetical deception proposals could potentially be confused with actual traffic diversions in aggregated reporting. Stage 5B.5.1 establishes an unambiguous database schema and semantic separation between:
1. **Intended Action & Routing Mode** (what the system evaluated),
2. **Actual Upstream Target** (where the socket actually connected), and
3. **Hypothetical Deception Target** (where the request *would* have gone if live diversion were active).

---

## 2. Structured Schema Specification

Every routing transaction records structured fields in PostgreSQL via `RoutingDecision` and `RoutingOutcome`:

```
+--------------------------------------------------------------------------------------------------+
| RoutingDecision Entity                                                                           |
|   id:                   UUID (Primary Key)                                                       |
|   tenantId:             UUID (Tenant Isolation Key)                                              |
|   correlationId:        UUID (Propagated Request Handle)                                         |
|   intendedAction:       "NORMAL_ROUTING" | "BLOCK" | "PROPOSE_DECEPTION"                        |
|   decisionStatus:       "DECIDED" | "SUPERSEDED"                                                 |
|   targetApplicationId:  UUID (Protected Application)                                             |
|   targetEnvironmentId:  null (Strictly null in SHADOW mode)                                      |
+--------------------------------------------------------------------------------------------------+
                                                 | 1:1
                                                 v
+--------------------------------------------------------------------------------------------------+
| RoutingOutcome Entity                                                                            |
|   id:                   UUID (Primary Key)                                                       |
|   routingDecisionId:    UUID (Foreign Key)                                                       |
|   outcomeStatus:        "SHADOW_DECEPTION" | "NORMAL_FORWARD" | "DEFER_TO_ORIGIN"                |
|   outcomeSource:        "GATEWAY_DECISION_CONTROLLER"                                            |
|   failureOrDiscrepancyDetails: (JSON)                                                            |
|     - routingMode:                  "SHADOW" | "OBSERVE_ONLY" | "CONTROLLED_LAB"                 |
|     - intendedAction:               "NORMAL_ROUTING" | "PROPOSE_DECEPTION"                       |
|     - actualUpstreamDestination:    "http://127.0.0.1:3000" (REAL ORIGIN)                        |
|     - actualForwardingResult:       "FORWARDED_TO_ORIGIN" | "SUCCESS"                            |
|     - hypotheticalDeceptionTarget:  "http://127.0.0.1:8081" (SYNTHETIC TARGET)                   |
|     - hypotheticalEnvironmentId:    "env-rt-5b51-live-..."                                       |
|     - actualDiversionStatus:        "NO_DIVERSION_ORIGIN_PRESERVED"                              |
|     - isActualDiversion:            false (Strictly false in SHADOW mode)                        |
|     - isHypotheticalDeception:      true                                                         |
|     - correlationId:                UUID                                                         |
|     - decisionReason:               Detailed textual explanation                                 |
+--------------------------------------------------------------------------------------------------+
```

---

## 3. Strict State Mapping Matrix

| Operational State | `intendedAction` | `outcomeStatus` | `actualUpstreamDestination` | `hypotheticalDeceptionTarget` | `actualDiversionStatus` | `isActualDiversion` |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **Normal Benign Request** | `NORMAL_ROUTING` | `NORMAL_FORWARD` | Real Protected Origin | `null` | `NO_DIVERSION_ORIGIN_PRESERVED` | `false` |
| **Shadow Mode Attack** | `NORMAL_ROUTING` | `SHADOW_DECEPTION` | **Real Protected Origin** | **Synthetic Container URL** | **`NO_DIVERSION_ORIGIN_PRESERVED`** | **`false`** |
| **Shadow Mode Missing Runtime**| `NORMAL_ROUTING` | `RUNTIME_UNAVAILABLE` | Real Protected Origin | `null` | `NO_DIVERSION_ORIGIN_PRESERVED` | `false` |
| **Ambiguous / Insufficient Telemetry** | `NORMAL_ROUTING` | `DEFER_WITH_UNCERTAINTY`| Real Protected Origin | `null` | `NO_DIVERSION_ORIGIN_PRESERVED` | `false` |
| **Controlled Lab Blocked (Finding A)** | `NORMAL_ROUTING` | `DEFER_TO_ORIGIN` | Real Protected Origin | `null` (Diversion blocked) | `NO_DIVERSION_ORIGIN_PRESERVED` | `false` |
| **Policy Block (Denylist)** | `BLOCK` | `BLOCK_REQUEST` | `null` (HTTP 403 returned) | `null` | `BLOCKED_AT_INGRESS` | `false` |

---

## 4. Execution Invariants

1. **A shadow decision never creates a successful synthetic routing outcome:**
   Under `SHADOW` mode, `outcomeStatus = 'SHADOW_DECEPTION'` indicates that the decision pipeline recommended deception, but the gateway proxy forwarded the request to `actualUpstreamDestination = Real Origin`.
2. **Actual Diversion Accountability:**
   `isActualDiversion` can only be `true` if and only if:
   $$\text{Mode} = \text{CONTROLLED\_LAB} \land \text{ReadinessVerified} = \text{true} \land \text{SocketConnected} = \text{SyntheticPort}$$
   Because `CONTROLLED_LAB` is currently blocked by Finding A, `isActualDiversion` is **strictly false** for all requests across the entire system.
