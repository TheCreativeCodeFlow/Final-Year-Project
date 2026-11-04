# Stage 5A.1 — Policy Semantics, DSG Consistency, and Adaptive Strategy Validation

**Project:** AI-Enabled Adaptive Cyber Deception Gateway  
**Milestone:** Stage 5A.1  
**Repository:** `https://github.com/TheCreativeCodeFlow/Final-Year-Project.git`  
**Branch:** `main`  
**Evaluator Version:** `5A.1`  
**Strategy Catalogue Version:** `1.0.0`  
**Status:** Validated, Verified & Formally Tested  

---

## 1. Executive Summary

Stage 5A.1 hardens the adaptive deception policy engine, Deception State Graph (DSG) planner, and strategy selection subsystem prior to runtime execution. In Stage 5A, the foundational architecture of the policy engine, strategy selection, and graph mutation planning was established. Stage 5A.1 audits, decouples, and formally verifies the semantics of policy evaluation, guarantees topological graph consistency across multi-stage attacker progression, introduces optimistic concurrency controls, and establishes immutable decision provenance.

### Core Architectural Invariants Maintained
1. **Semantic Separation:** Policy deception disposition (`deceptionDisposition`) is strictly decoupled from origin access authorization (`originAccessDecision`). The deception policy engine never grants origin access.
2. **Fail-Secure Telemetry Degradation:** Telemetry degradation, packet drops, or missing features trigger `DEFER_WITH_UNCERTAINTY`. Degraded observations are never assumed to represent benign traffic.
3. **Graph Staleness & Concurrency Guard:** Graph mutations must reference their `baseGraphVersion`. Stale proposals are rejected with `409 Conflict / STALE_GRAPH_VERSION`, preventing silent overwrite.
4. **Synthetic State Consistency:** Multi-stage attacker progression undergoes cross-state compatibility checks (user identities, authentication tokens, API routes, database schemas, and isolation boundaries) before proposed transitions are merged.
5. **Deterministic Policy Conflict Resolution:** Conflicts between policies are resolved via a deterministic multi-key ordering rule: Scope Specificity (App-Specific > Tenant-Wide > Baseline) $\to$ Priority (ASC) $\to$ Version (DESC) $\to$ Collation on `policyIdentifier`.
6. **Execution Invariant:** Zero live containers, honeypots, or dynamic routing rules are executed. Transition status is strictly `PROPOSED` or `REJECTED` (never `EXECUTED` or `PENDING_EXECUTION`). `executionEvidenceStatus` is unconditionally `MISSING`.

---

## 2. Policy and Origin-Access Semantic Separation

### 2.1 The Semantic Coupling Hazard in Deception Systems
In naive cyber deception architectures, policy evaluation often conflates deception diversion with access control. For example, returning `ALLOW_NORMAL` when no deception policy is configured can accidentally be misinterpreted by upstream reverse proxies as an authorization bypass, overriding application-layer authentication or WAF restrictions. Conversely, when telemetry is lost or degraded, marking traffic as "non-deceptive" can lead to dangerous fail-open conditions where stealthy attackers evade inspection.

### 2.2 Decoupled Representation
Stage 5A.1 introduces two distinct, orthogonal fields on every evaluation outcome and persisted `PolicyDecision`:

$$\text{PolicyDecision} = \langle \text{deceptionDisposition}, \text{originAccessDecision}, \text{reasonCodes}, \text{decisionRationale} \rangle$$

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
                  │ • PROPOSE_DECEPTION         │ │ • PROPOSE_DIVERT_TO_DECEPTION│
                  │ • DECEPTION_NOT_PROPOSED    │ │ • DEFER_TO_GATEWAY          │
                  │ • DECEPTION_REJECTED        │ │ • DEFER_WITH_UNCERTAINTY    │
                  │                             │ │ • DENY_APPLICATION_SUSPENDED│
                  └─────────────────────────────┘ └─────────────────────────────┘
```

### 2.3 Semantic Mapping Matrix

| Scenario / Observation | Detection State | `deceptionDisposition` | `originAccessDecision` | Deterministic Reason Codes | Safety Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Missing Policy** | Any | `DECEPTION_NOT_PROPOSED` | `DEFER_TO_GATEWAY` | `POLICY_DISABLED_OR_MISSING`, `DECEPTION_POLICY_NOT_CONFIGURED_DEFER_GATEWAY` | Gateway's independent firewall/WAF/auth rules govern origin access; deception is not proposed. |
| **Suspended App** | Any | `DECEPTION_NOT_PROPOSED` | `DENY_APPLICATION_SUSPENDED` | `APPLICATION_SUSPENDED`, `APPLICATION_SUSPENDED_ACCESS_DENIED` | Administrative lock blocks all origin traffic. |
| **Degraded Telemetry** | `DEGRADED` / `Loss` | `DECEPTION_REJECTED` | `DEFER_WITH_UNCERTAINTY` | `TELEMETRY_LOSS_DEGRADATION`, `DEGRADED_TELEMETRY_NO_ASSUMPTION_OF_BENIGN` | **Fail-Secure:** Incomplete data is rejected for deception and flagged as uncertain. Never treated as benign. |
| **Benign Traffic** | Baseline normal | `DECEPTION_NOT_PROPOSED` | `DEFER_TO_GATEWAY` | `ASSESSMENT_BENIGN`, `BENIGN_TRAFFIC_DECEPTION_NOT_PROPOSED` | Legitimate user traffic flows normally through gateway. |
| **ML-Only Anomaly** | Anomaly w/o rule | `DECEPTION_REJECTED` | `DEFER_WITH_UNCERTAINTY` | `ML_ONLY_UNVERIFIED_ANOMALY`, `DECEPTION_REJECTED_UNVERIFIED_ML_ANOMALY` | Unsupervised anomaly without deterministic rule corroboration is rejected for deception to avoid collision. |
| **Low Confidence** | Score $< \text{threshold}$ | `DECEPTION_REJECTED` | `DEFER_WITH_UNCERTAINTY` | `CONFIDENCE_BELOW_POLICY_MINIMUM`, `DECEPTION_REJECTED_LOW_CONFIDENCE` | High uncertainty prevents deception diversion. |
| **Corroborated Attack** | Eligible & Corroborated | `PROPOSE_DECEPTION` | `PROPOSE_DIVERT_TO_DECEPTION` | `ELIGIBILITY_CHECK_PASSED`, `CONFIDENCE_THRESHOLD_MET`, `RULE_CORROBORATED`, `STRATEGY_SELECTED`, `DSG_PLAN_GENERATED`, `DECEPTION_PROPOSED_AWAITING_ROUTING_AUTH` | Deception proposed with simulation plan. Origin diversion requires subsequent routing authorization. |

---

## 3. Deception State Graph (DSG) Versioning & Concurrency Controls

### 3.1 Topology Concurrency Model
The Deception State Graph topology models synthetic deception environments across three strict layers:
1. `PROTECTED_DECEPTION_POLICY`
2. `CONTROLLED_DYNAMIC_STATE`
3. `OBSERVATIONAL_ATTACKER_STATE`

In high-throughput environments with concurrent attacker sessions or parallel policy evaluations, multiple proposals might target the same graph. Without concurrency control, a proposal computed against an older graph version could silently overwrite newer nodes and edges.

### 3.2 Optimistic Version Gating
Every graph entity maintains a monotonic version counter `graphVersion` and an updated `revisionId`.
When generating a proposed transition:
- The planner requires `baseGraphVersion` (the version of the topology that was inspected during feature extraction and evaluation).
- If $\text{baseGraphVersion} \neq \text{currentGraph.graphVersion}$, the proposal is rejected immediately:
  $$\text{PlanStatus} = \text{REJECTED}, \quad \text{rejectionReason} = \text{"STALE\_GRAPH\_VERSION: ... "}$$
- In the REST API, this emits an HTTP `409 Conflict` with code `MUTATION_PLAN_REJECTED`.

### 3.3 Idempotency Key Generation
To prevent proposal drift from duplicate retries or parallel webhook emissions, the planner generates a SHA-256 deterministic idempotency key:
$$\text{idempotencyKey} = \text{SHA-256}(\text{graphId} \parallel \text{baseGraphVersion} \parallel \text{strategyIdentifier} \parallel \text{policyId})$$
Duplicate evaluations produce identical plan fingerprints, guaranteeing deterministic replayability.

### 3.4 Non-Execution Transition Status
Transitions in `deception_graph_transitions` use only valid non-execution states:
- `PROPOSED`: Mathematically planned mutation ready for simulation review.
- `VALIDATED`: Proposal verified against synthetic state consistency checks.
- `REJECTED`: Proposal rejected due to version staleness, layer violations, or synthetic state conflict.
*Note: `PENDING_EXECUTION` is prohibited until a live execution queue subsystem is provisioned in future milestones.*

---

## 4. Deterministic Strategy Selection Methodology

### 4.1 Multi-Factor Deterministic Ranking
Strategy selection maps behavioral assessments to the 5 canonical deception categories without arbitrary heuristics:
1. `RECONNAISSANCE_DECEPTION`: Scanners, directory traversals, 404 path probing.
2. `CREDENTIAL_DECEPTION`: Brute-force authentication, credential stuffing, password guessing.
3. `API_DECEPTION`: Non-standard HTTP methods, GraphQL introspection, verb tampering.
4. `DATA_ACCESS_DECEPTION`: SQL injection signatures, abnormal bulk data exfiltration.
5. `SERVICE_INTERACTION_DECEPTION`: Connection bursts, service discovery, tarpit delays.

Candidate evaluation scores each strategy via a deterministic multi-factor model:

$$\text{Score} = S_{\text{category}} + S_{\text{rule}} + S_{\text{severity}} + S_{\text{confidence}} - P_{\text{uncertainty}}$$

Where:
- $S_{\text{category}} = 50$ if strategy category matches inferred target categories.
- $S_{\text{rule}} = 25 \times N_{\text{matched}}$, where $N_{\text{matched}}$ is the number of targeted rules corroborated by active findings (using word-set equivalence matching).
- $S_{\text{severity}} = \sum \text{weight}(\text{severity})$ for findings matching this candidate ($\text{CRITICAL} = 25, \text{HIGH} = 15, \text{MEDIUM} = 8$).
- $S_{\text{confidence}} = \text{round}(\text{confidenceScore} \times 20)$.
- $P_{\text{uncertainty}} = \text{round}((0.8 - \text{correlationConfidence}) \times 25)$ if correlation confidence $< 0.8$.
- **Tie-Breaker:** Strict alphabetical collation on `strategyIdentifier.localeCompare(...)`.

### 4.2 Benchmark Evaluation Results (11 Canonical Scenarios)

The test suite executes `StrategyBenchmarkRunner` across 11 canonical evaluation scenarios:

| # | Scenario Identifier | Attack Profile | Corroborating Findings | Target Category | Selected Strategy | Conformance |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: |
| **01** | `SCENARIO_01_API_ENUMERATION` | REST verb & route discovery | `RULE_SUSPICIOUS_METHOD`, `RULE_API_ENUMERATION` | `API_DECEPTION` | `strat-api-shadow-facade-01` | **PASS (100%)** |
| **02** | `SCENARIO_02_CREDENTIAL_PROBING` | Rapid password brute force | `RULE_AUTH_BRUTE_FORCE`, `RULE_CREDENTIAL_STUFFING` | `CREDENTIAL_DECEPTION` | `strat-credential-canary-token-01` | **PASS (100%)** |
| **03** | `SCENARIO_03_SENSITIVE_DATA_ACCESS` | SQL injection & bulk exfil | `RULE_DATA_ACCESS_TAMPERING`, `RULE_DATA_EXFILTRATION` | `DATA_ACCESS_DECEPTION` | `strat-data-honey-records-01` | **PASS (100%)** |
| **04** | `SCENARIO_04_SERVICE_DISCOVERY` | High-frequency port scan | `RULE_HIGH_FREQUENCY_BURST`, `RULE_SERVICE_DISCOVERY` | `SERVICE_INTERACTION_DECEPTION` | `strat-service-tarpit-latency-01` | **PASS (100%)** |
| **05** | `SCENARIO_05_SLOW_RECONNAISSANCE` | Dispersed low-rate scan | `RULE_SLOW_RECON`, `RULE_REPEATED_RESOURCE_PROBING` | `RECONNAISSANCE_DECEPTION` | `strat-recon-honey-endpoints-01` | **PASS (100%)** |
| **06** | `SCENARIO_06_MIXED_ATTACK_BEHAVIOR` | Brute force + SQL tampering | `RULE_AUTH_BRUTE_FORCE` (CRIT), `RULE_DATA_ACCESS` (HIGH) | `CREDENTIAL_DECEPTION` | `strat-credential-canary-token-01` | **PASS (100%)** |
| **07** | `SCENARIO_07_MULTI_STAGE_ATTACK` | Recon progressing to Auth | `RULE_REPEATED_RESOURCE_PROBING`, `RULE_AUTH_BRUTE_FORCE` | `CREDENTIAL_DECEPTION` | `strat-credential-canary-token-01` | **PASS (100%)** |
| **08** | `SCENARIO_08_AMBIGUOUS_BEHAVIOR` | Confidence 0.62, Correlation 0.55 | `RULE_SUSPICIOUS_METHOD` (LOW) | `API_DECEPTION` | `NONE` (Safely Rejected) | **PASS (100%)** |
| **09** | `SCENARIO_09_CONFLICTING_RULE_FINDINGS` | Equal Recon & Method findings | `RULE_REPEATED_RESOURCE_PROBING`, `RULE_SUSPICIOUS_METHOD` | `API_DECEPTION` | `strat-api-shadow-facade-01` | **PASS (100%)** |
| **10** | `SCENARIO_10_INCOMPLETE_TELEMETRY` | Telemetry degraded / lost | `RULE_AUTH_BRUTE_FORCE` (CRIT) | `CREDENTIAL_DECEPTION` | `NONE` (Safely Rejected) | **PASS (100%)** |
| **11** | `SCENARIO_11_APPLICATION_INCOMPATIBILITY` | Credential attack on restricted app | `RULE_AUTH_BRUTE_FORCE` (HIGH) | `CREDENTIAL_DECEPTION` | `NONE` (Policy Filtered) | **PASS (100%)** |

---

## 5. Multi-Stage Strategy Reassessment & Graph Consistency

### 5.1 Dynamic Attacker Trajectories
Attackers rarely maintain a single tactic throughout an intrusion lifecycle. A typical progression moves from Reconnaissance $\to$ Credential Probing $\to$ Sensitive Resource Enumeration.
When new observations arrive, the system reassesses the strategy. However, mutating the synthetic deception environment dynamically can introduce contradictions that unmask the deception (e.g. invalidating previously issued credentials or altering existing mock route behaviors).

### 5.2 Five-Dimensional Consistency Validation
The `reassessStrategy` service validates five dimensions of synthetic environment invariants:

```
                          ┌──────────────────────────────────────┐
                          │     Multi-Stage Reassessment        │
                          └──────────────────┬───────────────────┘
                                             │
             ┌───────────────────────────────┼───────────────────────────────┐
             │                               │                               │
             ▼                               ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐     ┌─────────────────────────┐
│ 1. Synthetic Identity   │     │ 2. Auth State           │     │ 3. API Resource Non-    │
│    Consistency          │     │    Compatibility        │     │    Collision            │
│ No role or status       │     │ Compatible token types  │     │ No conflicting status   │
│ contradictions          │     │ and signing algorithms  │     │ codes on same route     │
└─────────────────────────┘     └─────────────────────────┘     └─────────────────────────┘
             │                               │
             ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│ 4. Database Schema      │     │ 5. Isolation Boundary   │
│    Invariants           │     │    Preservation         │
│ No conflicting tables or│     │ Strict noOutboundEgress │
│ schema overwrites       │     │ across all merged nodes │
└─────────────────────────┘     └─────────────────────────┘
```

1. **Synthetic User Identity Consistency:** Verifies that synthetic users created in prior steps retain compatible roles, privileges, and decoy statuses.
2. **Authentication State Compatibility:** Ensures token templates (e.g. `CANARY_JWT`) and signing keys do not conflict with active sessions.
3. **API Route Namespace Non-Collision:** Verifies that routes in the new strategy do not collide with existing mock endpoints with conflicting HTTP status codes or contradictory handler logic.
4. **Database Schema Invariants:** Guarantees synthetic tables and canary columns do not collide with existing mock databases or drop previously simulated tables.
5. **Isolation Boundary Preservation:** Enforces that `noOutboundEgress: true` and sandbox constraints remain strictly valid across all merged nodes.

### 5.3 Outcome Handling
- **Consistent Reassessment:** Merges nodes, edges, mock routes, and databases, incrementing topology version with status `PROPOSED`.
- **Inconsistent Reassessment:** Rejects mutation with status `REJECTED`, emits `INCONSISTENT_SYNTHETIC_STATE`, records the specific violation, and **preserves prior graph state completely unchanged**.

---

## 6. Immutable Decision Provenance

Every policy decision persists a comprehensive audit snapshot into the PostgreSQL `policy_decisions` table:

```json
{
  "id": "c85d7b2a-...",
  "tenantId": "43ae01a2-...",
  "applicationId": "ac73b182-...",
  "deceptionDisposition": "PROPOSE_DECEPTION",
  "originAccessDecision": "PROPOSE_DIVERT_TO_DECEPTION",
  "decisionResult": "PROPOSE_DECEPTION",
  "evaluatorVersion": "5A.1",
  "strategyCatalogueVersion": "1.0.0",
  "baseGraphVersion": 2,
  "policyVersion": 1,
  "selectedStrategyId": "strat-credential-canary-token-01",
  "selectedStrategyVersion": 1,
  "candidateStrategyIds": ["strat-credential-canary-token-01", "strat-recon-honey-endpoints-01"],
  "reasonCodes": [
    "ELIGIBILITY_CHECK_PASSED",
    "CONFIDENCE_THRESHOLD_MET",
    "RULE_CORROBORATED",
    "STRATEGY_SELECTED",
    "DSG_PLAN_GENERATED",
    "DECEPTION_PROPOSED_AWAITING_ROUTING_AUTH"
  ],
  "evidenceReferences": {
    "assessmentId": "...",
    "confidence": 0.94,
    "dataQualityState": "COMPLETE",
    "telemetryLossDetected": false,
    "deceptionEligible": true,
    "policySnapshot": { "id": "...", "version": 1, "priority": 10 },
    "selectedStrategySnapshot": { "strategyIdentifier": "strat-credential-canary-token-01", "version": 1 },
    "assessmentSnapshot": { "ruleFindingCount": 2, "mlAnomalyDetected": false },
    "executionEvidenceStatus": "MISSING",
    "executionStatus": "NOT_EXECUTED",
    "provenanceNotice": "STAGE_5A_DECISION_PROVENANCE: Full snapshot preserved at decision timestamp. Cryptographic non-repudiation is not claimed."
  }
}
```

### 6.1 Historical Immutability Guarantee
Modifying a policy or updating a strategy in the database after the original evaluation has occurred **never alters the historical decision record**. The decision stores frozen snapshots of the policy criteria, strategy parameters, and feature evidence, guaranteeing reproducible post-incident auditability.

---

## 7. Deterministic Policy Conflict Resolution

When multiple policies are configured within a tenant, the engine resolves conflicts via a deterministic four-key priority algorithm:

1. **Scope Specificity:**
   - Tier 1: Application-Specific policy (`applicationId !== null` matching target app)
   - Tier 2: Tenant-Wide policy (`applicationId === null` scoped to tenant)
   - Tier 3: Platform Baseline policy (`tenantId === null`)
   *Application-specific policies strictly take precedence over tenant-wide policies.*
2. **Priority Ordering:**
   - Lower numeric value takes precedence ($1 = \text{highest}, 1000 = \text{lowest}$). Priority 10 beats Priority 50.
3. **Version Ordering:**
   - If priority is equal, higher version (`version DESC`) takes precedence.
4. **Deterministic Collation:**
   - If scope, priority, and version are identical, alphabetical collation on `policyIdentifier.localeCompare(...)` provides a strict, platform-independent tie-breaker.
5. **Active Gating:**
   - Disabled policies (`enabled: false`) are ignored during resolution.
6. **Conflict Provenance:**
   - Resolution metadata is attached in `_conflictResolution` recording all candidate policies considered, the winning policy, and the exact explanation.

---

## 8. Verification & Test Summary

| Test Suite | Purpose | Tests | Result | Duration |
| :--- | :--- | :---: | :---: | :---: |
| [`deception-policy-semantics-dsg.test.js`](file:///Users/rahulseervi/Documents/GitHub/Final-Year-Project/backend/tests/deception-policy-semantics-dsg.test.js) | Stage 5A.1 Semantics, Versioning, Concurrency, Reassessment & Scenarios | **21 / 21** | **PASS** | 200 ms |
| [`deception-policy-engine.test.js`](file:///Users/rahulseervi/Documents/GitHub/Final-Year-Project/backend/tests/deception-policy-engine.test.js) | Stage 5A Baseline Policy Engine & DSG Planning Suite | **21 / 21** | **PASS** | 170 ms |
| **All Backend Suites** | Complete backend test suite (46 suites) | **343 / 343** | **PASS** | 9.8 s |
| **Gateway Runtime Suites** | Gateway reverse proxy, SSRF, header sanitization, telemetry | **37 / 37** | **PASS** | 2.7 s |
| **Frontend Production Build** | Vite v6.4.5 React Production Bundle | **2,649 modules** | **SUCCESS** | 1.57 s |

---

## 9. Current Limitations & Next Milestone Boundaries

1. **Simulation-Only Planning:** The policy engine and DSG planner produce simulation blueprints and validated state mutation proposals. No live Docker containers, decoy network interfaces, or virtual honeypot routing rules are executed.
2. **Execution Evidence Remains Missing:** All decisions and transitions strictly enforce `executionEvidenceStatus: MISSING` and `executionStatus: NOT_EXECUTED`.
3. **No Cryptographic Signatures:** Audit logs and decision records use structural snapshots and SHA-256 idempotency hashing for provenance, but do not employ asymmetric cryptographic digital signatures or hardware-security modules (HSMs).
4. **Next Milestone (Stage 5B):** Runtime Deception Execution Controller, Synthetic Environment Provisioning, and Gateway Sandboxed Traffic Diversion.
