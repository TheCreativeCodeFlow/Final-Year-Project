# Stage 5A.1 — Policy Semantics, DSG Consistency, and Adaptive Strategy Validation

**Project:** AI-Enabled Adaptive Cyber Deception Gateway  
**Repository:** `https://github.com/TheCreativeCodeFlow/Final-Year-Project.git`  
**Branch:** `main`  
**Milestone:** Stage 5A.1  
**Evaluator Version:** `5A.1`  
**Strategy Catalogue Version:** `1.0.0`  
**Execution Status:** Strictly Planning-Only (`executionEvidenceStatus = MISSING`)  

---

## 1. Stage Objective and Scope

Stage 5A.1 conducts a comprehensive audit and hardening of the Adaptive Cyber Deception Policy Engine and Deception State Graph (DSG) planning subsystem implemented in Stage 5A.

The objective is to establish:
- **Unambiguous Policy Semantics:** Complete mathematical and architectural decoupling of deception proposal disposition (`deceptionDisposition`) from origin access control (`originAccessDecision`).
- **Topological DSG Consistency:** Strict version tracking, concurrency controls, and stale-plan rejection preventing silent graph overwrite.
- **Reproducible Strategy Selection:** A 4-phase deterministic strategy selection pipeline (Generation $\to$ Filtering $\to$ Ranking $\to$ Selection) evaluated against an 11-scenario benchmark suite.
- **Dynamic Multi-Stage Reassessment:** Planning-only cross-state consistency validation across 5 synthetic environment dimensions during multi-step attack progression.
- **Frozen Decision Provenance:** Immutable snapshots of policies, strategies, and behavioral features permanently tied to policy decisions.
- **Fail-Secure Safeguards:** Telemetry loss or degradation never defaults to benign assumptions, strictly emitting `DEFER_WITH_UNCERTAINTY`.

**Strict Scope Boundary:** This milestone is strictly planning, simulation modeling, and policy validation. **No live traffic diversion, container provisioning, honeypot deployment, or DSG transition execution is implemented or authorized.**

---

## 2. Previous Architecture and Identified Weaknesses

### 2.1 The Baseline Stage 5A Implementation
Stage 5A introduced the initial `PolicyEvaluationEngine`, `DSGPlannerService`, and `DecisionRecorderService`, representing the transition from detection into policy-driven deception modeling.

### 2.2 Identified Weaknesses in Stage 5A
1. **Conflation of Deception and Origin Routing:**
   In early prototypes, returning `ALLOW_NORMAL` or `POLICY_NOT_CONFIGURED` risked being interpreted by upstream reverse proxies as authorization to bypass access controls. Conversely, rejecting deception could be misinterpreted as approving origin forwarding.
2. **Silent DSG Overwrite Vulnerability:**
   Early DSG mutations did not validate that the incoming proposal was computed against the latest topology revision. Parallel sessions could cause race conditions where proposals computed against an earlier graph revision wiped out newer nodes.
3. **Implicit Strategy Selection:**
   Strategy selection lacked a structured multi-phase pipeline and explicit scenario verification across edge cases like ambiguous scoring, conflicting findings, and degraded telemetry.
4. **Fragile Multi-Stage Strategy Shifts:**
   As an attacker progressed from reconnaissance to credential theft to data extraction, changing strategies could introduce synthetic contradictions (e.g. altering user roles or colliding route status codes) that would unmask the deception.
5. **Historical Decision Drift:**
   If a security operator modified an active policy or updated a strategy template in the database, re-inspecting historical decisions could yield inconsistent reconstructions if snapshotting was incomplete.

---

## 3. Deception Disposition versus Origin Access Semantics

To prevent authorization bypasses, Stage 5A.1 enforces a strict two-variable decision tuple on every evaluation and persisted `PolicyDecision`:

$$\text{DecisionOutcome} = \langle \text{deceptionDisposition}, \text{originAccessDecision} \rangle$$

```
                              ┌─────────────────────────────┐
                              │    Behavioral Assessment    │
                              └──────────────┬──────────────┘
                                             │
                                             ▼
                              ┌─────────────────────────────┐
                              │   Policy Evaluation Engine  │
                              └──────┬───────────────┬──────┘
                                     │               │
              ┌──────────────────────┴──────┐ ┌──────┴──────────────────────┐
              │    deceptionDisposition     │ │     originAccessDecision     │
              ├─────────────────────────────┤ ├─────────────────────────────┤
              │ • PROPOSED                  │ │ • PROPOSE_DIVERT_TO_DECEPTION│
              │ • NOT_PROPOSED              │ │ • DEFER_TO_GATEWAY          │
              │ • REJECTED                  │ │ • DEFER_WITH_UNCERTAINTY    │
              │                             │ │ • DENY_APPLICATION_SUSPENDED│
              └─────────────────────────────┘ └─────────────────────────────┘
```

### 3.1 Field Specifications
1. **`deceptionDisposition`:** Represents purely whether the deception engine proposes an active deceptive response:
   - `PROPOSED`: Assessment meets all criteria; a validated deception strategy and DSG mutation plan have been generated.
   - `NOT_PROPOSED`: Traffic is benign, or policy is disabled/missing, or application actions disallow deception.
   - `REJECTED`: Assessment failed eligibility, telemetry quality was degraded, confidence was insufficient, or no compatible strategy was found.
2. **`originAccessDecision`:** Represents routing guidance aligned with independent gateway access controls:
   - `DEFER_TO_GATEWAY`: Origin access is deferred to the gateway's independent firewall, WAF, and authentication layers.
   - `PROPOSE_DIVERT_TO_DECEPTION`: Gateway is advised to route traffic into a deceptive environment (subject to gateway diversion authorization).
   - `DEFER_WITH_UNCERTAINTY`: Inconclusive or degraded telemetry; traffic must NOT be assumed benign. Gateway must apply conservative fail-secure scrutiny.
   - `DENY_APPLICATION_SUSPENDED`: Application is administratively locked; all origin access is denied.

### 3.2 Canonical Decision Mapping Matrix

| Scenario / Observation | Detection State | `deceptionDisposition` | `originAccessDecision` | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| **Missing Policy** | Any | `NOT_PROPOSED` | `DEFER_TO_GATEWAY` | Gateway independent policy controls origin; deception engine does not authorize traffic. |
| **Suspended App** | Any | `NOT_PROPOSED` | `DENY_APPLICATION_SUSPENDED` | Origin access blocked due to administrative lock. |
| **Degraded Telemetry** | `DEGRADED` / Loss | `REJECTED` | `DEFER_WITH_UNCERTAINTY` | **Fail-Secure:** Incomplete data is never assumed benign. |
| **Benign Traffic** | Baseline normal | `NOT_PROPOSED` | `DEFER_TO_GATEWAY` | Standard traffic flows through regular gateway channels. |
| **ML-Only Anomaly** | Anomaly w/o rule | `REJECTED` | `DEFER_WITH_UNCERTAINTY` | Uncorroborated anomaly rejected for deception; origin access deferred with uncertainty. |
| **Low Confidence** | Score $< \text{threshold}$ | `REJECTED` | `DEFER_WITH_UNCERTAINTY` | Insufficient confidence rejects deception diversion. |
| **Corroborated Attack** | Eligible & Corroborated | `PROPOSED` | `PROPOSE_DIVERT_TO_DECEPTION` | Validated attack generates deception proposal awaiting routing execution. |

---

## 4. Reason-Code Definitions

Stage 5A.1 standardizes explicit programmatic reason codes emitted on every decision:

| Reason Code | Category | Operational Meaning |
| :--- | :--- | :--- |
| `POLICY_DISABLED_OR_MISSING` | Policy State | No active deception policy is bound to the tenant or target application. |
| `DECEPTION_POLICY_NOT_CONFIGURED_DEFER_GATEWAY` | Policy State | Gateway origin access rules apply because no deception policy exists. |
| `APPLICATION_SUSPENDED` | Administrative | Target application status is SUSPENDED. |
| `APPLICATION_SUSPENDED_ACCESS_DENIED` | Administrative | Access denied; application locked administratively. |
| `TELEMETRY_LOSS_DEGRADATION` | Quality Guard | Packet loss or pipeline degradation detected. |
| `DEGRADED_TELEMETRY_NO_ASSUMPTION_OF_BENIGN` | Quality Guard | **Fail-Secure:** Degraded telemetry is explicitly not assumed to be benign. |
| `ASSESSMENT_BENIGN` | Classification | Classifier identified traffic as normal benign behavior. |
| `BENIGN_TRAFFIC_DECEPTION_NOT_PROPOSED` | Routing | Benign requests proceed through gateway without deception. |
| `ML_ONLY_UNVERIFIED_ANOMALY` | Corroboration | Unsupervised anomaly detected without deterministic rule corroboration. |
| `DECEPTION_REJECTED_UNVERIFIED_ML_ANOMALY` | Corroboration | Deception rejected to avoid potential false-positive user disruption. |
| `CONFIDENCE_BELOW_POLICY_MINIMUM` | Confidence | Assessment confidence is below policy `minConfidence`. |
| `DECEPTION_REJECTED_LOW_CONFIDENCE` | Confidence | High uncertainty rejects deception proposal. |
| `COLLISION_RISK_INELIGIBLE` | Eligibility | Attacker session attribution unverified or collision risk flagged. |
| `ACTION_NOT_PERMITTED_BY_POLICY` | Permissions | Policy does not include `PROPOSE_DECEPTION` in `permittedActions`. |
| `NO_ELIGIBLE_STRATEGY_DECEPTION_REJECTED` | Strategy | All candidate strategies were rejected during constraint filtering. |
| `ELIGIBILITY_CHECK_PASSED` | Success | All eligibility and corroboration prerequisites satisfied. |
| `CONFIDENCE_THRESHOLD_MET` | Success | Assessment confidence meets or exceeds policy minimum. |
| `RULE_CORROBORATED` | Success | Deterministic security rule findings confirmed the attack. |
| `STRATEGY_SELECTED` | Success | Deterministic ranking selected the optimal candidate strategy. |
| `DSG_PLAN_GENERATED` | Success | Proposed Deception State Graph mutation blueprint generated. |
| `DECEPTION_PROPOSED_AWAITING_ROUTING_AUTH` | Success | Deception proposal recorded, awaiting downstream routing authorization. |

---

## 5. DSG Versioning and Revision Lifecycle

Every `DeceptionGraph` maintains a strict revision lifecycle:
1. `graphVersion`: Monotonically increasing integer incremented with every accepted topology mutation.
2. `revisionId`: Cryptographic revision UUID updated on every state alteration.
3. `status`: Graph operational status (`ACTIVE`, `INACTIVE`, `ARCHIVED`).

### Transition Lifecycle:
Proposals exist in one of three conceptual states:
- `PROPOSED`: Generated simulation plan with computed node and edge diffs.
- `VALIDATED`: Verified against multi-stage synthetic consistency checks.
- `REJECTED`: Rejected due to version staleness, layer violations, or synthetic state conflict.

> [!IMPORTANT]
> The status `PENDING_EXECUTION` is strictly prohibited because no live execution queue exists in this milestone.

---

## 6. Concurrency and Transaction Strategy

To prevent race conditions and silent overwrites:
1. **Optimistic Version Gating:**
   When a client or automated evaluator requests a DSG mutation, it must submit `baseGraphVersion`.
   The planner validates:
   $$\text{baseGraphVersion} = \text{currentGraph.graphVersion}$$
   If mismatched, the plan is rejected with status `REJECTED` and reason:
   `STALE_GRAPH_VERSION: Proposal was based on graph version X, but current graph is version Y.`
   The REST endpoint returns an HTTP `409 Conflict` with error code `MUTATION_PLAN_REJECTED`.
2. **Atomic Persistence:**
   `DecisionRecorderService` executes within a PostgreSQL transaction (`prisma.$transaction`). It atomically:
   - Verifies target graph version.
   - Verifies DB entity existence (preventing FK violations).
   - Inserts the immutable `PolicyDecision`.
   - Inserts the `DeceptionGraphTransition` record with base/target version numbers.
   - Emits a `POLICY_DECISION_RECORDED` security audit log.

---

## 7. Idempotency Design

To prevent proposal drift and duplicate records from network retries or concurrent webhook delivery:
1. **Deterministic Idempotency Key:**
   The client may provide an `Idempotency-Key` header, or the system derives a deterministic SHA-256 key:
   $$\text{idempotencyKey} = \text{SHA-256}(\text{graphId} \parallel \text{baseGraphVersion} \parallel \text{strategyIdentifier} \parallel \text{policyId})$$
2. **Payload Hash Mismatch Protection:**
   The SHA-256 hash of the complete incoming request payload is stored as `requestPayloadHash`.
3. **Idempotent Replay vs Collision:**
   - **Identical Replay:** If an existing transition or decision with the same `idempotencyKey` and identical `requestPayloadHash` exists, the previously generated record is returned (`idempotentReplay: true`), without creating duplicate database entries.
   - **Conflicting Reuse:** If the same `idempotencyKey` is reused with a *different* request payload, the system rejects the request with HTTP `409 Conflict` and code `IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH`.

---

## 8. Strategy-Selection Methodology

Strategy selection maps behavioral assessments across the 5 canonical deception categories:
1. `RECONNAISSANCE_DECEPTION`: Scanners, directory traversal, 404 path probing.
2. `CREDENTIAL_DECEPTION`: Brute-force auth, credential stuffing, password spray.
3. `API_DECEPTION`: Non-standard HTTP methods, GraphQL introspection, verb tampering.
4. `DATA_ACCESS_DECEPTION`: SQL injection signatures, abnormal bulk exfiltration.
5. `SERVICE_INTERACTION_DECEPTION`: Connection bursts, service discovery, tarpit delays.

### The 4-Phase Strategy Selection Pipeline
```
[Assessment + Policy]
        │
        ▼
┌─────────────────────────────────┐
│ Phase 1: Candidate Generation   │  Evaluates all strategies in pool, computes raw score & breakdown.
└───────────────┬─────────────────┘
                │
                ▼
┌─────────────────────────────────┐
│ Phase 2: Constraint Filtering   │  Partitions into eligibleCandidates vs rejectedCandidates
└───────────────┬─────────────────┘  (category match, minConfidence, quality, isolation).
                │
                ▼
┌─────────────────────────────────┐
│ Phase 3: Deterministic Ranking  │  Sorts eligible candidates by score DESC,
└───────────────┬─────────────────┘  then collation on strategyIdentifier ASC.
                │
                ▼
┌─────────────────────────────────┐
│ Phase 4: Final Selection        │  Returns top candidate, candidates pool, rejected pool,
└─────────────────────────────────┘  selection rationale, and ranking method metadata.
```

### Multi-Factor Deterministic Scoring Formula
$$\text{Score} = S_{\text{category}} + S_{\text{rule}} + S_{\text{severity}} + S_{\text{confidence}} - P_{\text{uncertainty}}$$

Where:
- $S_{\text{category}} = 50$ (if category matches inferred targets).
- $S_{\text{rule}} = 25 \times N_{\text{matched}}$ (corroborated targeted rules).
- $S_{\text{severity}} = \sum \text{weight}(\text{severity})$ ($\text{CRITICAL} = 25, \text{HIGH} = 15, \text{MEDIUM} = 8$).
- $S_{\text{confidence}} = \text{round}(\text{confidenceScore} \times 20)$.
- $P_{\text{uncertainty}} = \text{round}((0.8 - \text{correlationConfidence}) \times 25)$ if correlation $< 0.8$.
- **Tie-Breaker:** Strict alphabetical collation on `strategyIdentifier.localeCompare(...)`.

---

## 9. Scenario Validation Results (11 Canonical Scenarios)

The test suite executes `StrategyBenchmarkRunner` across 11 canonical benchmark scenarios:

| # | Scenario Identifier | Attack Profile | Corroborating Findings | Target Category | Selected Strategy | Conformance |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: |
| **01** | `SCENARIO_01_API_ENUMERATION` | REST verb & route discovery | `RULE_SUSPICIOUS_METHOD`, `RULE_API_ENUMERATION` | `API_DECEPTION` | `strat-api-shadow-facade-01` | **PASS (100%)** |
| **02** | `SCENARIO_02_CREDENTIAL_PROBING` | Rapid password brute force | `RULE_AUTH_BRUTE_FORCE`, `RULE_CREDENTIAL_STUFFING` | `CREDENTIAL_DECEPTION` | `strat-credential-canary-token-01` | **PASS (100%)** |
| **03** | `SCENARIO_03_SENSITIVE_DATA_ACCESS` | SQL injection & bulk exfil | `RULE_DATA_ACCESS_TAMPERING`, `RULE_DATA_EXFILTRATION` | `DATA_ACCESS_DECEPTION` | `strat-data-honey-records-01` | **PASS (100%)** |
| **04** | `SCENARIO_04_SERVICE_DISCOVERY` | High-frequency port scan | `RULE_HIGH_FREQUENCY_BURST`, `RULE_SERVICE_DISCOVERY` | `SERVICE_INTERACTION_DECEPTION` | `strat-service-tarpit-latency-01` | **PASS (100%)** |
| **05** | `SCENARIO_05_SLOW_RECONNAISSANCE` | Dispersed low-rate scan | `RULE_SLOW_RECON`, `RULE_REPEATED_RESOURCE_PROBING` | `RECONNAISSANCE_DECEPTION` | `strat-recon-honey-endpoints-01` | **PASS (100%)** |
| **06** | `SCENARIO_06_MIXED_ATTACK_BEHAVIOR` | Brute force + SQL tampering | `RULE_AUTH_BRUTE_FORCE` (CRIT), `RULE_DATA_ACCESS` (HIGH) | `CREDENTIAL_DECEPTION` | `strat-credential-canary-token-01` | **PASS (100%)** |
| **07** | `SCENARIO_07_MULTI_STAGE_ATTACK` | Recon progressing to Auth | `RULE_REPEATED_RESOURCE_PROBING`, `RULE_AUTH_BRUTE_FORCE` | `CREDENTIAL_DECEPTION` | `strat-credential-canary-token-01` | **PASS (100%)** |
| **08** | `SCENARIO_08_AMBIGUOUS_BEHAVIOR` | Low confidence (0.62) & correlation (0.55) | `RULE_SUSPICIOUS_METHOD` (LOW) | `API_DECEPTION` | `NONE` (Safely Rejected) | **PASS (100%)** |
| **09** | `SCENARIO_09_CONFLICTING_RULE_FINDINGS` | Equal Recon & Method findings | `RULE_REPEATED_RESOURCE_PROBING`, `RULE_SUSPICIOUS_METHOD` | `API_DECEPTION` | `strat-api-shadow-facade-01` | **PASS (100%)** |
| **10** | `SCENARIO_10_INCOMPLETE_TELEMETRY` | Telemetry degraded / lost | `RULE_AUTH_BRUTE_FORCE` (CRIT) | `CREDENTIAL_DECEPTION` | `NONE` (Safely Rejected) | **PASS (100%)** |
| **11** | `SCENARIO_11_APPLICATION_INCOMPATIBILITY` | Credential attack on restricted app | `RULE_AUTH_BRUTE_FORCE` (HIGH) | `CREDENTIAL_DECEPTION` | `NONE` (Policy Filtered) | **PASS (100%)** |

---

## 10. Multi-Stage Strategy Reassessment

Attackers execute progressive kill-chains:
$$\text{Reconnaissance} \longrightarrow \text{Credential Probing} \longrightarrow \text{Sensitive Data Access}$$

When new telemetry triggers a new assessment during an active attack track, `reassessStrategy` evaluates whether a new strategy proposal can be merged into the existing proposed DSG state without unmasking the deception.

- **Initial State:** Observation 1 proposes `API_DECEPTION` (`strat-api-shadow-facade-01`).
- **Stage 2 Progression:** Observation 2 detects credential brute force. The system evaluates `strat-credential-canary-token-01` against the active proposal. Because credentials and routes are compatible, the mutations merge cleanly (`COMPATIBLE_MUTATION`).
- **Stage 3 Progression:** Observation 3 detects database enumeration. The system evaluates `strat-data-honey-records-01`. Schemas and tables merge cleanly with the prior proposal.
- **Stage 4 Incompatible Mutation:** If a candidate introduces conflicting route handlers, contradictory simulated status codes (e.g. 500 on an active route), or violates isolation (`noOutboundEgress: false`), it is rejected with status `INCONSISTENT_SYNTHETIC_STATE`, preserving the previous valid plan completely intact.

---

## 11. Synthetic State Consistency Invariants

The 5 dimensions checked during strategy reassessment:
1. **Synthetic User Identity Consistency:** Decoy users must retain consistent roles and statuses across transitions.
2. **Authentication State Compatibility:** Token types (e.g. `CANARY_JWT`) and key algorithms must not contradict active sessions.
3. **API Route Namespace Non-Collision:** New mock routes cannot collide with existing routes if their simulated status codes or handlers conflict.
4. **Database Schema Invariants:** Synthetic tables, column structures, and canary columns must not overwrite or conflict with previously modeled mock tables.
5. **Isolation Boundary Preservation:** Strict sandbox isolation (`strictNamespaceIsolation: true`, `noOutboundEgress: true`) must remain inviolate across all merged nodes.

---

## 12. Decision Provenance and Immutability

Historical decisions in `policy_decisions` are permanently frozen:
- **Immutable Snapshots:** Stores full JSON snapshots of `policySnapshot`, `selectedStrategySnapshot`, and `assessmentSnapshot` at the moment of evaluation.
- **Version Pinning:** Persists exact `policyVersion`, `evaluatorVersion` (`5A.1`), `strategyCatalogueVersion` (`1.0.0`), and `baseGraphVersion`.
- **Reason Codes:** Complete list of machine-readable reason codes explaining why each outcome occurred.
- **Audit Logging:** Every recorded decision emits a tamper-evident audit event inside the same database transaction.
- **Guarantee:** Later edits to policies or strategies in PostgreSQL **never modify historical decision records**.

> [!NOTE]
> Cryptographic non-repudiation (e.g., PKI digital signatures or HSM sealing) is not claimed. Structural snapshot immutability and SHA-256 payload hashing provide reproducibility.

---

## 13. Policy Priority and Conflict Resolution

When multiple policies match a request, `PolicyService.resolveApplicablePolicy` deterministically selects the winning policy via a 4-tier hierarchy:
1. **Scope Specificity:**
   - Tier 1: Application-Specific policy (`applicationId !== null` matching application).
   - Tier 2: Tenant-Wide policy (`applicationId === null` scoped to tenant).
   - Tier 3: Platform Baseline policy (`tenantId === null`).
   *Application-specific policies strictly override tenant-wide policies.*
2. **Priority Ordering:**
   - Lower numeric value takes precedence ($1 = \text{highest}, 1000 = \text{lowest}$). Priority 10 beats Priority 50.
3. **Version Ordering:**
   - If scope and priority are equal, higher version (`version DESC`) takes precedence.
4. **Deterministic Collation:**
   - If scope, priority, and version are identical, alphabetical collation on `policyIdentifier.localeCompare(...)` breaks ties deterministically.
5. **Active Gating:**
   - Disabled policies (`enabled: false`) are skipped.

---

## 14. Tenant Isolation and Authorization

All Stage 5A.1 APIs enforce tenant boundary controls:
- **Tenant Scope Enforcement:** Policy evaluations, decisions, and DSG graphs are strictly scoped by `tenantId`.
- **Cross-Tenant Blocking:** A tenant owner or analyst from Tenant A attempting to access or mutate Tenant B resources is rejected with HTTP `403 Forbidden` or `404 Not Found`.
- **RBAC Enforced:** `ANALYST` roles have read-only access to policies, strategies, benchmark explorer, and decisions; only `OWNER` roles may create or update policies and plan mutations.

---

## 15. Testing Methodology and Results

Testing was conducted across four distinct layers without mocking live databases or disabling security guards:

### Summary of Test Execution:
- **Stage 5A.1 Semantics & DSG Test Suite:** 25 / 25 passing (0 failures).
- **Stage 5A Baseline Policy Test Suite:** 21 / 21 passing (0 failures).
- **Complete Backend Test Suite:** 347 / 347 passing across 46 suites (0 failures).
- **Gateway Runtime Reverse Proxy Suite:** 37 / 37 passing across 2 suites (0 failures).
- **Frontend Production Build:** Vite v6.4.5 built 2,649 modules successfully in 1.51s.

### Exact Test Breakdown for Stage 5A.1 (`backend/tests/deception-policy-semantics-dsg.test.js`):
1. Missing policy separates `deceptionDisposition` (`NOT_PROPOSED`) from `originAccessDecision` (`DEFER_TO_GATEWAY`).
2. Degraded telemetry rejects deception (`REJECTED`) and defers with uncertainty (`DEFER_WITH_UNCERTAINTY`).
3. Benign traffic sets `deceptionDisposition: NOT_PROPOSED` and `originAccessDecision: DEFER_TO_GATEWAY`.
4. Suspended application denies origin access (`DENY_APPLICATION_SUSPENDED`) without deception.
5. Corroborated attack proposes deception (`PROPOSED`) and diversion (`PROPOSE_DIVERT_TO_DECEPTION`).
6. DSG Planner accepts proposal when `baseGraphVersion` matches `currentGraph.graphVersion`.
7. DSG Planner rejects stale plan when `baseGraphVersion` mismatches `currentGraph.graphVersion`.
8. Planning generates deterministic idempotency keys for duplicate requests.
9. Strategy Benchmark Suite executes and validates all 11 canonical scenarios with 100% conformance.
10. Multi-stage strategy reassessment merges compatible mutations across attack progression.
11. Strategy reassessment rejects incompatible synthetic state mutations and preserves prior state.
12. Recorded decision captures immutable snapshots of policy, strategy, and evidence.
13. Conflict resolution: Application-specific policy strictly beats tenant-wide policy.
14. Conflict resolution: Lower priority number takes precedence within same scope.
15. Conflict resolution: Disabled higher-priority policies are skipped.
16. Conflict resolution: Equal priority tie-breaker uses version DESC then alphabetical collation.
17. `GET /strategies/benchmark` returns complete 11-scenario benchmark evaluation.
18. `POST /graphs/:graphId/reassess` tests multi-stage strategy transition over API.
19. `POST /graphs/:graphId/plan` rejects stale `baseGraphVersion` over API with 409 conflict.
20. Cross-tenant isolation: MedSecure analyst cannot trigger graph planning on Apex graph (403 Forbidden).
21. Global Research Invariant: Zero executed transitions and `executionEvidenceStatus` strictly `MISSING`.
22. Four-stage strategy selection pipeline: `generateCandidates`, `filterCandidates`, `rankCandidates`, `selectStrategy`.
23. Idempotent replay of identical plan request returns cached proposal without duplicate records.
24. Reusing idempotency key with conflicting payload returns 409 `IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH`.
25. Multi-stage attack progression (Recon $\to$ Auth $\to$ Data Exfil) and rejection of conflicting 4th stage.

---

## 16. Known Limitations

1. **Simulation-Only Planning:** The policy engine and DSG planner produce simulation blueprints and validated state mutation proposals. No live Docker containers, decoy network interfaces, or virtual honeypot routing rules are executed.
2. **Missing Execution Evidence:** All decisions and transitions strictly enforce `executionEvidenceStatus: MISSING` and `executionStatus: NOT_EXECUTED`.
3. **No Cryptographic Signatures:** Audit logs and decision records use structural snapshots and SHA-256 idempotency hashing for provenance, but do not employ asymmetric cryptographic digital signatures.
4. **Synthetic Strategy Benchmark:** The 11 benchmark scenarios test deterministic strategy selection against synthetic behavioral profiles. Operational validation against live adversary telemetry is part of future testing.

---

## 17. Explicit Statement That Live Deception Execution Is Not Implemented

> [!CAUTION]
> **MANDATORY SECURITY INVARIANT:**  
> Live cyber deception execution, autonomous network redirection, containerized honeypot deployment, and runtime state mutation execution are **STRICTLY NOT IMPLEMENTED** in this milestone.
> 
> All proposed mutations in the Deception State Graph have transition status `PROPOSED`, `VALIDATED`, or `REJECTED`. The transition status `EXECUTED` does not exist in this codebase.
> 
> Across all persisted policy decisions and graph records:
> ```javascript
> executionEvidenceStatus: 'MISSING'
> executionStatus: 'NOT_EXECUTED'
> ```
> Upstream gateway routing continues to be governed by independent gateway security policies. No live deception environment is provisioned.
