# Stage 6 — Independent Research Metric Definitions

Stage 6 maintains strict separation across five orthogonal evaluation dimensions so that no dimension conceals regressions or missing evidence in another.

---

## 1. Detection Metrics (Scenario-Level Classification)

Evaluated strictly on unique held-out scenarios (`TEST`, $N = 14$):
- **True Positive (TP):** Unambiguous `ATTACK` scenario where $\ge 1$ telemetry step receives `DECISION_RESULTS.PROPOSE_DECEPTION`.
- **False Negative (FN):** Unambiguous `ATTACK` scenario where zero steps propose deception (`BENIGN` or `INSUFFICIENT_EVIDENCE` withheld).
- **False Positive (FP):** Unambiguous `BENIGN` scenario where $\ge 1$ benign step triggers deception diversion.
- **True Negative (TN):** Unambiguous `BENIGN` scenario with zero deception diversion proposals (`ALLOW_NORMAL` or conservative origin deferral `INSUFFICIENT_EVIDENCE`).
- **Ambiguous Scenarios (`AMBIGUOUS`, $N_{\text{ambig}} = 2$):** Strictly excluded from Precision/Recall/F1 denominators and tracked via **`Insufficient-Evidence Rate`** ($\frac{\text{Ambiguous Count}}{N_{\text{total}}}$) alongside clean deferral vs false diversion counts.
- **Formulas:**
  - $\text{Precision} = \frac{TP}{TP + FP}$, $\quad \text{Recall} = \frac{TP}{TP + FN}$, $\quad F_1 = \frac{2 \cdot \text{Precision} \cdot \text{Recall}}{\text{Precision} + \text{Recall}}$
  - $\text{FPR} = \frac{FP}{FP + TN}$, $\quad \text{FNR} = \frac{FN}{FN + TP}$

---

## 2. Deception Effectiveness Metrics (Attacker-Facing Coherence)

Measured exclusively from actual synthetic HTTP responses and the State Consistency Oracle across attack trajectories (never conflating packet delivery with successful deception):
- **Decoy Interactions:** Count of attack steps handled by the isolated synthetic runtime host.
- **Meaningful Attacker Interactions:** Strict subset of decoy interactions returning HTTP `200` with coherent synthetic assets **AND zero structural consistency violations or premature recognition contradictions on that step**.
- **Simulated Attacker Engagement Duration (`simulatedEngagementDurationMs`):** Scenario timestamp delta `(lastMeaningfulTimestampMs - firstAttackerFlaggedTimestampMs)` measured strictly in scenario simulated clock time (*never* real human attacker dwell time).
- **Attack Stages Completed (`attackStagesCompleted`):** Count of unique scenario stage milestones (`stageNumber > 0`) satisfied coherently inside the synthetic environment without 404/503 failures or contradictions.
- **Synthetic Assets Explored:** Distinct verified entity identifiers (`user:*`, `cred:*`, `route:*`, `customer:*`, `schema:*`, `service:*`) returned in valid HTTP `200` payloads.
- **Consistency Violations:** Count of structural contradictions audited by 7-way `DSGConsistencyEngine` across every executed state mutation (dangling user credentials, role mismatches, route entity omissions, canary schema omissions, active auth service disablement, colliding route statuses).
- **Premature Environment-Recognition Indicators:** Client-observable anomalies exposed by HTTP responses (`IDENTITY_FALLBACK_CONTRADICTION`, `AUTH_IDENTITY_MISMATCH`, `AUTH_ROLE_CONTRADICTION`, `ENDPOINT_DEAD_END_404`, `SERVICE_DEPENDENCY_BROKEN`, `SCHEMA_CANARY_MISSING`). *(Lab response traceability headers such as `X-Synthetic-Deception` are tracked uniformly across all three systems as a baseline lab instrumentation limitation).*

---

## 3. Adaptation Quality Metrics

- **Transitions Proposed / Validated / Executed / Rejected:** Tracked cleanly as distinct counters (`Proposed = Validated + Rejected` under DSG). Note Generic Adaptive records `Executed = 37` despite only `Validated = 15` because it lacks pre-execution validation.
- **Transition Rejection Rate:** $\frac{\text{Rejected}}{\text{Proposed}}$ (DSG rejects invalid proposals before modifying runtime state).
- **Graph Consistency Validation Rate:** $\frac{\text{Validated}}{\text{Proposed}}$.
- **Adaptation Latency (`adaptationLatencyMs`):** High-resolution monotonic wall time covering transition derivation, 7-way validation (if used), and HTTP `POST /internal/mutate` execution.
- **Repeated Adaptation Stability:** Cross-seed agreement rate across all 5 seeds `[101, 202, 303, 404, 505]`.

---

## 4. Routing Safety & Conservation Accounting

- **Actual Origin Requests vs Actual Synthetic Requests vs Failed Requests:** Strictly satisfies `Offered == ActualOrigin + ActualSynthetic + Failed` across every seed and paradigm. Zero benign or ambiguous requests may touch synthetic hosts.

---

## 5. System Performance Metrics

- **Step Latency (`mean`, `median`, `p95`, `p99`, `stdDev`):** High-resolution `process.hrtime.bigint()` latency around each full request-evaluation + HTTP forwarding + adaptation cycle (`N = 655` steps per paradigm across 5 seeds).
- **Runtime Provisioning Time:** Measured both for ephemeral HTTP loopback host startup (`ms`) AND real Docker container provisioning (`deception-synthetic-service:1.0.0` + `Internal: true` bridge + `/health` check).
- **CPU & Memory Usage:** `process.cpuUsage()` user/system ms and heap delta (loopback suite) alongside Docker cgroup stats (`memoryUsageMb`, `cpuPercent`, `pidsCurrent`).
