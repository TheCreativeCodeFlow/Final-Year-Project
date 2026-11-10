# Stage 6 — Baseline Implementation & Experimental System Configurations

## 1. Shared Experimental Parity Conditions

All three systems (`backend/src/research/stage6-evaluation-systems.js`) operate under identical baseline conditions:
- **Initial Runtime State (`INITIAL_SYNTHETIC_STATE`):** 3 initial synthetic identities (`alex.chen` `FINANCIAL_ANALYST`, `maria.santos` `COMPLIANCE_OFFICER`, `david.kim` `INFRASTRUCTURE_ENGINEER`), 3 accounts, 3 customers, 3 baseline database schemas, 17 baseline API routes, and 3 active services (`SYNTHETIC_API`, `SYNTHETIC_AUTH`, `SYNTHETIC_DATA`).
- **Identical Detection & Policy Stack:** Every incoming scenario step flows sequentially through:
  1. `validateAndNormalizeCanonicalEvent`
  2. `BehavioralSessionCorrelator`
  3. `BehavioralFeatureExtractor`
  4. `RuleEngineService` (6 unmodified rules) + `IsolationForest` (calibrated solely on `DEVELOPMENT` benign vectors)
  5. `HybridAssessmentService` (`FUSION_STRATEGIES.DATA_QUALITY_AWARE`)
  6. `PolicyEvaluationEngine` (requiring rule corroboration, `minConfidence >= 0.70`, `COMPLETE` telemetry quality)
- **Identical HTTP Loopback Isolation:** Each scenario run instantiates fresh isolated TCP loopback HTTP servers: a simulated Protected Origin (receiving benign & `INSUFFICIENT_EVIDENCE` steps) and an isolated Synthetic Service Host (faithful implementation of `synthetic-service/server.js`, receiving steps proposed for deception).

---

## 2. System A — Static Honeypot Baseline (`STATIC_HONEYPOT`)

- **Behavior:** Fixed synthetic environment; executes `0` state mutations (`transitionsProposed = 0`, `transitionsExecuted = 0`).
- **Execution Mechanism:** Forwards deception-eligible requests straight to the immutable initial synthetic server.
- **Honest Baseline Strength:** Baseline endpoints (`/api/v1/users`, `/api/v1/accounts`, `/api/v1/data/customers`, `/api/v1/data/schemas`) return clean HTTP `200` responses without extra adaptation latency or consistency violations (`0` violations).
- **Natural Limitation:** Unadapted dynamic endpoints (`/api/v1/internal/*`, `/api/v1/data/dump-all`) return HTTP `404 SYNTHETIC_ENDPOINT_NOT_FOUND`, and probes for newly coined users fall back silently in `synthetic-service` to `alex.chen` (`stateStore.users[0]`).

---

## 3. System B — Generic Adaptive Deception Baseline (`GENERIC_ADAPTIVE`)

- **Behavior:** Deterministic stateless single-step category/path rules triggered strictly by the immediate request's rule findings and path, **without** longitudinal attacker behavioral memory and **without** pre-execution 7-way `DSGConsistencyEngine` gating.
- **Exact Implemented Deterministic Rules (`deriveGenericStatelessMutations`):**
  1. **Credential / Auth Trigger (`ruleIds` containing `AUTH` or `CREDENTIAL`):** Issues `CREATE_DECOY_CREDENTIAL` for `body.username || 'alex.chen'` with fixed `role: 'ADMINISTRATOR'` (stateless elevated bait) without querying whether that username exists in `users` or holds another role.
  2. **API / Recon Path Trigger (`path.startsWith('/api/')` and non-baseline):** Issues `ADD_SYNTHETIC_ROUTE` (`simulatedStatus: 200`, `availability: 'ENABLED'`) exposing a generic adaptive response body. *(Note: On pure API topology scans like `TEST-RECON-01`, this behaves cleanly with zero violations — proving Baseline B is not artificially weakened!)*
  3. **Sensitive Data Schema Trigger (`/data/schemas`, `/data/customers`, `/data/dump`):** Issues `SCHEMA_MUTATION` on `synthetic_customers` with standard columns `['customer_id', 'company', 'tier', 'billing_iban']` without tracking canary column policy invariants.
  4. **Burst Flood Trigger (`RULE_REQUEST_BURST` on `/api/v1/auth/*`):** Sheds load via `DISABLE_SYNTHETIC_SERVICE` (`SYNTHETIC_AUTH`) without checking active `/api/v1/auth` route dependencies.
- **Execution Mechanism:** Dispatches each generated mutation directly to live HTTP `POST /internal/mutate` on the isolated synthetic server. Afterward, an independent audit invokes `DSGConsistencyEngine.validateConsistency()` post-hoc to record any live state violations created.

---

## 4. System C — Proposed Attacker-Specific DSG (`ATTACKER_SPECIFIC_DSG`)

- **Behavior:** Maintains a longitudinal `attackerProfile` per session tracking discovered usernames, roles, enumerated routes, and staged targets across preceding requests, paired with `StrategySelectionService`, `DSGPlannerService`, and pre-execution 7-way validation (`DSGConsistencyEngine`).
- **Coordinated Adaptation Mechanism (`deriveAttackerSpecificDsgMutations`):**
  1. **Identity-First Coordination:** Whenever an unseen username is targeted across login probes or user lookups, schedules `ADD_SYNTHETIC_USER` first before linking credentials or querying `/api/v1/users/:username`, avoiding route-shadowing overrides on `/api/v1/users/:id`.
  2. **Role-Aligned Credential Binding:** Queries current `stateStore.users` so any `CREATE_DECOY_CREDENTIAL` matches the target user's assigned role (`SECURITY_AUDITOR_DECOY`, `FINANCIAL_ANALYST`, or `INFRASTRUCTURE_ENGINEER`), preventing auth-profile contradictions.
  3. **Canary-Preserving Schema & Customer Seeding:** Retains mandatory canary tracking columns (`canary_seed`, `exfil_marker`) in schema mutations and binds canary customer identifiers.
  4. **Dependency-Safe Service Adaptation:** On auth bursts, avoids disabling `SYNTHETIC_AUTH` while active `/api/v1/auth/*` endpoints exist.
- **Mandatory 7-Way Consistency Gate Before Execution:** Every candidate transition is checked against `DSGConsistencyEngine.validateConsistency(rollingState, candidate, v, v+1)`. Any non-compliant candidate (e.g., recon targeting non-`/api/` paths like `/.env.production` or conflicting roles) is **rejected at the gate** (`transitionsRejected++`) before `/internal/mutate` is called, keeping live state consistency violations at `0`.
