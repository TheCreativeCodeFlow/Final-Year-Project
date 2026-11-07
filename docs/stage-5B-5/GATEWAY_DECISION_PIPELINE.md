# Stage 5B.5 — 14-Stage Gateway Decision Pipeline

## 1. Overview

Every incoming request passing through the Adaptive Cyber Deception Gateway is evaluated through a deterministic **14-Stage Decision Pipeline**. This pipeline bridges raw HTTP protocol ingress with high-order threat detection, dynamic policy reasoning, and isolated container execution.

The pipeline is implemented in `GatewayDecisionControllerService.evaluateGatewayRequest()` in `backend/src/deception/gateway-decision-controller.service.js`.

---

## 2. Comprehensive Pipeline Specification

```
   [Stage 1: App/Tenant Resolution]
                 |
                 v
   [Stage 2: Config Validation] -----------------> [Fail Closed if Invalid]
                 |
                 v
   [Stage 3: Observation Recording] -------------> [SecurityObservation Created]
                 |
                 v
   [Stage 4: Telemetry Normalization]
                 |
                 v
   [Stage 5: Session Correlation] ---------------> [Pseudonymous Session Reference]
                 |
                 v
   [Stage 6: Hybrid Detection] ------------------> [BehavioralAssessment Created]
                 |
                 v
   [Stage 7: Policy Evaluation] -----------------> [PolicyDecision Created]
                 |
                 v
   [Stage 8: Strategy Selection] ----------------> [Deception Strategy Matched]
                 |
                 v
   [Stage 9: DSG Plan Lookup] -------------------> [DSG Version Binding]
                 |
                 v
   [Stage 10: Runtime Selection] ----------------> [Health & Invariant Gating]
                 |
                 v
   [Stage 11: Authorization Check] --------------> [Dual-Custody Status Check]
                 |
                 v
   [Stage 12: Routing Decision] -----------------> [Mode Decision: OBSERVE/SHADOW/LAB]
                 |
                 v
   [Stage 13: Persistence & Evidence] -----------> [RoutingDecision + Evidence Event Chain]
                 |
                 v
   [Stage 14: Response Formulation] -------------> [Return Gateway Directives]
```

---

## 3. Detailed Stage Breakdown

### Stage 1: Application and Tenant Resolution
- **Input:** Request domain, Host header, or pre-resolved `appContext`.
- **Mechanism:** Resolves the canonical tenant and protected application from the database.
- **Fail-Safe:** If the host is unrecognized or unmapped, the pipeline terminates immediately with `FAIL_CLOSED` and outcome `BLOCK_REQUEST` (HTTP 404).

### Stage 2: Application Configuration and Status Validation
- **Input:** `appContext.status`, allowed HTTP methods, size constraints.
- **Mechanism:** Validates that the application is in `PROTECTED` status.
- **Fail-Safe:** If status is `DEGRADED`, `ARCHIVED`, or `SUSPENDED`, routing is denied immediately with `FAIL_CLOSED` (HTTP 403).

### Stage 3: Gateway Request Observation Recording
- **Input:** Client IP, method, normalized path, sanitized headers.
- **Mechanism:** Persists an immutable `SecurityObservation` in PostgreSQL (`evidenceProvenance = 'GATEWAY_RUNTIME'`, `evidenceStatus = 'OBSERVED'`). Emits `GATEWAY_REQUEST_OBSERVED` event.

### Stage 4: Behavioral Telemetry Normalization
- **Input:** Raw HTTP attributes.
- **Mechanism:** Standardizes protocol semantics, categorizes route patterns, and extracts numerical feature sets (payload length, header entropy, method risk).

### Stage 5: Session Profile Correlation
- **Input:** Client IP, User-Agent, cookie fragments, TLS fingerprint.
- **Mechanism:** Correlates the request with an ongoing pseudonymous session via `BehavioralSessionCorrelator`. Generates a deterministic `sessionRef` for longitudinal tracking.

### Stage 6: Hybrid Detection Assessment
- **Input:** Normalized telemetry, feature sets, session history.
- **Mechanism:** Runs deterministic security rules in parallel with the Isolation Forest ML anomaly detector. Computes `riskScore`, `confidenceScore`, `classification` (`BENIGN` vs `ATTACK`), and `threatCategory`.
- **Database Output:** Persists a `BehavioralAssessment` record.

### Stage 7: Adaptive Deception Policy Evaluation
- **Input:** Assessment, active tenant `DeceptionPolicy`, DSG graph state.
- **Mechanism:** Evaluates policy conditions, evidence requirements, and permitted action matrices. Produces `deceptionDisposition` (`PROPOSED`, `NOT_PROPOSED`, `REJECTED`) and `originAccessDecision`.
- **Database Output:** Persists a `PolicyDecision` record. Emits `POLICY_EVALUATED` event.

### Stage 8: Strategy Selection Integration
- **Input:** Threat category, policy constraints, available strategy catalog.
- **Mechanism:** Selects the optimal decoy strategy (e.g., `strat-credential-canary-token-01`, `strat-api-shadow-facade-01`, `strat-data-honey-records-01`).
- **Audit Output:** Emits `DECEPTION_STRATEGY_SELECTED` event.

### Stage 9: Deception State Graph (DSG) Version Binding
- **Input:** Target application DSG graph, current graph version.
- **Mechanism:** Binds the current base graph version ($V$) and identifies any proposed mutation targets ($V+1$). Ensures that the gateway only routes to containers compatible with $V$.

### Stage 10: Candidate Runtime Selection and Health Gating
- **Input:** Tenant ID, Application ID, Strategy ID, Graph Version.
- **Mechanism:** Evaluates candidate `DeceptionRuntimeEnvironment` records using `RuntimeSelectionService`. Rejects candidates that are `UNHEALTHY`, `TERMINATED`, cross-tenant, or version-mismatched.
- **Audit Output:** Emits `RUNTIME_SELECTED` event.

### Stage 11: Routing Authorization Verification
- **Input:** Selected runtime's bound `DeceptionExecutionAuthorization`.
- **Mechanism:** Confirms the authorization is `APPROVED`, non-expired, and non-revoked.
- **Audit Output:** Emits `ROUTING_AUTHORIZATION_CHECKED` event.

### Stage 12: Routing Decision and Outcome Determination
- **Input:** Active `routingMode` (`OBSERVE_ONLY`, `SHADOW`, or `CONTROLLED_LAB`), runtime selection results.
- **Outcome Logic:**
  - `OBSERVE_ONLY`: Outcome `NORMAL_FORWARD`. Target is real origin.
  - `SHADOW`: Outcome `SHADOW_DECEPTION` (or `RUNTIME_UNAVAILABLE`). Target is real origin; hypothetical deception target recorded. Emits `SHADOW_DECISION` and `HYPOTHETICAL_OUTCOME` events.
  - `CONTROLLED_LAB`: Evaluates readiness checklist. If blocked (Finding A), safely falls back to origin with `DEFER_TO_ORIGIN`. If verified, sets `action = PROPOSE_DECEPTION` and target is synthetic container.

### Stage 13: Decision Record Persistence and Evidence Chaining
- **Input:** Final routing outcome and metadata.
- **Mechanism:** Persists `RoutingDecision` and `RoutingOutcome` records in PostgreSQL. Emits `ROUTING_DECISION_CREATED` into the cryptographic SHA-256 evidence chain.

### Stage 14: Directives Formulation and Response
- **Output:** Returns actionable routing instruction to the gateway reverse proxy (`action`, `targetDestination`, `routingOutcome`, `sessionRef`, `pipelineDurationMs`).
