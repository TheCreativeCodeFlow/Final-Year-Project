# Stage 6 Completion Report — Research Evaluation, Baseline Comparison & DSG Effectiveness Validation

**Project:** AI-Enabled Adaptive Cyber Deception Gateway for Real-Time Attacker Detection  
**Stage Status:** **COMPLETE** (Controlled-lab comparative evaluation executed in isolated HTTP loopback hosts and live hardened Docker `Internal: true` containers; host firewall Finding A blocker strictly preserved with zero live production traffic diversion)

---

## 1. Executive Summary

Stage 6 established an unrigged, reproducible 3-way experimental evaluation comparing three comparable system configurations sharing identical ingress parsing, hybrid detection, synthetic runtime state mechanics (`IsolatedSyntheticStateStore` and live `deception-synthetic-service:1.0.0` containers), and client-side consistency verification:

1. **`STATIC_HONEYPOT`** — Fixed baseline synthetic environment (`0` mutations).
2. **`GENERIC_ADAPTIVE`** — Stateless category/path adaptation without attacker behavioral longitudinal history or 7-way DSG consistency validation.
3. **`ATTACKER_SPECIFIC_DSG`** — Longitudinal attacker profiling coupled with `StrategySelectionService`, `DSGPlannerService`, and pre-execution 7-way `DSGConsistencyEngine` gating prior to runtime mutation.

Across `5` independent seeds (`[101, 202, 303, 404, 505]`) over `14` held-out `TEST` scenarios covering all `10` research taxonomies (`655` total request steps per system after discarding `3` warmup scenarios, paired with `3`-container live Docker parity verification):

- **Behavioral Consistency (H1):** `ATTACKER_SPECIFIC_DSG` achieved **`0` consistency violations** and **`0` premature deception indicators**, compared with **`22` consistency violations** and **`12` premature indicators** in `GENERIC_ADAPTIVE`, and **`0` violations / `21` premature indicators** in `STATIC_HONEYPOT`. Exact Wilcoxon signed-rank testing on premature indicators vs `STATIC_HONEYPOT` reached statistical significance ($p = 0.015625$, $n = 9, m = 7$). Cross-component violations vs `GENERIC_ADAPTIVE` favored DSG (`meanDiff = -2.4444`, 95% CI `[-4.817, -0.0718]`), but with only $m = 5$ non-zero scenario pairs the two-sided exact permutation minimum is $p = 0.0625$ (`sampleInsufficientForSignificanceTest = true`).
- **Attacker Interaction Quality (H2):** `ATTACKER_SPECIFIC_DSG` produced **`36 / 41` (`87.80%`) meaningful decoy interactions** across **`16 / 29` (`55.17%`) completed attack stages** and **`31` synthetic assets explored**, outperforming `STATIC_HONEYPOT` (**`15 / 41` = `36.59%`**, `7 / 29` stages, `15` assets; $p = 0.015625$ for meaningful interactions and assets explored) and `GENERIC_ADAPTIVE` (**`12 / 41` = `29.27%`**, `7 / 29` stages, `21` assets). Notably, uncoordinated stateless adaptation in `GENERIC_ADAPTIVE` performed worse overall than the static baseline because broken auth/role/data mutations triggered early contradictions.
- **Overhead Cost (H3):** Pre-execution DSG validation added `0.1105 ms` mean adaptation decision overhead (`0.2642 ms` p95) in loopback experiments and yielded statistically indistinguishable total per-step latency (`0.9026 ms` mean vs `0.8828 ms` static; `meanDiff = +0.014 ms`, exact $p = 0.153076$). Under real Docker container execution (`docker exec` + IPC + Alpine runtime), DSG executed `3` mutations at `33.11 ms` mean latency and `30.34 ms` rollback latency while rejecting `1` inconsistent mutation at the gate with `0` violations and `2/2` identity-coherent responses (vs `1` violation and `0/2` identity coherence in `GENERIC_ADAPTIVE`).

---

## 2. Repository Integrity Audit & Root-Cause Fixes Prior to Evaluation

Before executing Stage 6 experiments, existing benchmark scripts and runtime/detection integrations were audited directly against executable code:

1. **Legacy Benchmark Script Audit (Preserved Read-Only for Historical Transparency):**
   - `backend/scripts/dsg-research-evaluation.js` (Stage 5B.4) relied on synthetic modulo conflict injection (`i % 7 === 0`), `Math.random()` latency generation, and a fixed `32.5%` rejection constant.
   - `backend/scripts/gateway-routing-benchmark.js` (Stage 5B.5.1) computed deterministic step timings (`2.3 + (i % 5) * 0.12`), ground-truth-derived TP/TN classification, and counted `3 x 100` repeated requests as `240` distinct scenarios.
   - Neither script was treated as empirical evidence; Stage 6 replaced them with genuine end-to-end execution harnesses (`stage-6-research-evaluation.js` and `stage-6-live-docker-parity.js`).

2. **Sub-Millisecond Execution Evidence Hash-Chain Race Fix:**
   - **File:** `backend/src/runtime/execution-evidence-recorder.service.js`
   - **Fix:** Added per-scope serialization queues (`SCOPE_WRITE_QUEUES`), resolved chain tips over the top-10 records ordered by `sequenceNumber DESC`, and enforced strictly monotonic `recordedAtDate` progression across sub-millisecond writes.
   - **Verification:** `backend/tests/dsg-execution-engine.test.js` (`25 / 25` PASS).

3. **Stage 4C -> Stage 5A Interoperability Fixes:**
   - **Files:** `backend/src/detection/hybrid-assessment.service.js`, `backend/src/deception/policy-evaluation.service.js`
   - **Fix:** Populated canonical `ruleFindings`, top-level `dataQualityState`, and `telemetryLossDetected` in hybrid assessment output; added `assessmentSnapshot` fallback support for `qualityAssessment`, normalized benign status checks (`'BENIGN' || 'NORMAL'`), and aligned anomaly flags (`mlAnomalyResult?.anomalyDetected || mlResult?.isAnomaly`).
   - **Verification:** `deception-eligibility.test.js`, `deception-policy-engine.test.js`, `detection-hybrid-assessment.test.js` (`39 / 39` PASS) and `deception-policy-semantics-dsg.test.js` (`25 / 25` PASS cleanly after DB reseed).

---

## 3. Experimental Protocol & Dataset Architecture

| Artifact | Purpose | Details |
| :--- | :--- | :--- |
| `backend/src/research/stage6-scenario-suite.js` | Scenario definitions & leakage audit | `26` scenarios (`6 DEVELOPMENT`, `6 VALIDATION`, `14 TEST`), `10` research taxonomies, `auditScenarioPartitionLeakage()` verifies `leakFree: true` (0 IP/username/custom-route overlap). |
| `backend/src/research/stage6-synthetic-runtime-host.js` | Isolated runtime hosts | Ephemeral TCP loopback `http.createServer` instances wrapping `IsolatedSyntheticStateStore` (matching `synthetic-service/server.js` semantics) and simulated origin server. |
| `backend/src/research/stage6-evaluation-systems.js` | Three evaluation systems & oracle | `STATIC_HONEYPOT`, `GENERIC_ADAPTIVE`, `ATTACKER_SPECIFIC_DSG`, `buildCalibratedDetectorSuite` (calibrated strictly on benign `DEVELOPMENT` traffic), and deterministic client-side contradiction oracle. |
| `backend/src/research/stage6-metrics-stats.js` | Metrics & non-parametric stats | Treats independent scenario as statistical unit ($N$), exact Student-$t$ 95% CIs, exact permutation Wilcoxon signed-rank tests with $m \le 4$ power guards. |
| `backend/scripts/stage-6-research-evaluation.js` | Primary multi-seed runner | `3`-scenario JIT warmup discarded (`66.35 ms`), Validation parity run, `5` seeds (`[101, 202, 303, 404, 505]`) x `14` test scenarios (`655` steps/system, `1970.56 ms` total). |
| `backend/scripts/stage-6-live-docker-parity.js` | Live Docker parity verifier | Provisions real hardened containers (`deception-synthetic-service:1.0.0`) on `Internal: true` networks, executes cross-system mutations, checks live responses/rollbacks, cleans up cleanly. |

---

## 4. Quantitative Results

### 4.1 Held-Out `TEST` Partition System Comparison (`N = 14`, `655` Steps per System)

| Metric | `STATIC_HONEYPOT` | `GENERIC_ADAPTIVE` | `ATTACKER_SPECIFIC_DSG` |
| :--- | :---: | :---: | :---: |
| Precision / Recall / F1 | `1.0000` / `0.7778` / `0.8750` | `1.0000` / `0.7778` / `0.8750` | `1.0000` / `0.7778` / `0.8750` |
| False Positive Rate / False Negative Rate | `0.0000` / `0.2222` | `0.0000` / `0.2222` | `0.0000` / `0.2222` |
| Insufficient Evidence Rate (`TEST-AMBIG-01/02`) | `0.1429` (`2/14`, `0` diverted) | `0.1429` (`2/14`, `0` diverted) | `0.1429` (`2/14`, `0` diverted) |
| Meaningful Decoy Interactions (`41` total decoy reqs) | **`15`** (`36.59%`, mean `1.667`) | **`12`** (`29.27%`, mean `1.333`) | **`36`** (`87.80%`, mean `4.000`) |
| Attack Stages Completed (`29` total stages) | `7` (`24.14%`) | `7` (`24.14%`) | **`16`** (`55.17%`) |
| Synthetic Assets Explored | `15` | `21` | **`31`** |
| **Consistency Violations** | `0` | **`22`** | **`0`** |
| **Premature Indicators** | **`21`** | **`12`** | **`0`** |
| Transitions (Proposed / Validated / Executed / Rejected) | `0 / 0 / 0 / 0` | `37 / 15 / 37 / 0` (`40.54%` valid) | `29 / 24 / 24 / 5` (`82.76%` valid) |
| Step Latency Mean / Median (ms) | `0.8828` / `0.8614` | `0.9095` / `0.8774` | `0.9026` / `0.8745` |
| Step Latency p95 / p99 / StdDev (ms) | `0.9663` / `1.0599` / `0.1588` | `1.0766` / `1.2490` / `0.0922` | `1.0823` / `1.2116` / `0.0856` |
| Adaptation Decision Overhead Mean / p95 (ms) | `0` / `0` | `0.1191` / `0.2230` | `0.1105` / `0.2642` |
| Provenance Verification Mean Latency (ms) | `0.0347` | `0.0355` | `0.0342` |
| Process CPU User / System (ms) | `585.36` / `12.521` | `628.513` / `15.391` | `613.527` / `14.479` |

*Note on Detection Honesty:* Both `TEST-CRED-01` (`4` failures < `5m` window threshold of `5` in `RuleEngineService`) and `TEST-REPEAT-01` (single `MEDIUM` severity Rule 5 finding suppressed by `deceptionEligible` gate) produced authentic False Negatives (`FNR = 0.2222`). `TEST-BENIGN-03` triggered ML outlier scoring during rapid 450ms pagination but was safely held back as `INSUFFICIENT_EVIDENCE` (`FPR = 0.0000`) by Policy Guard 5. On the tuning `VALIDATION` partition (`N=6`), detection recorded Precision `1.0000`, Recall `0.2500`, F1 `0.4000`, FPR `0.0000`, FNR `0.7500`, and Insufficient Evidence Rate `0.1667`.

### 4.2 Exact Paired Statistical Comparisons (Scenario Level)

| Hypothesis Comparison | `n` | `m` (non-zero pairs) | Mean Diff (`DSG - Baseline`) | 95% Student-$t$ CI | Wilcoxon $W_+ / W_-$ | Exact $p$ | Statistically Significant ($\alpha = 0.05$) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `H1_consistencyViolations_DSG_vs_Generic` | `9` | `5` | `-2.4444` | `[-4.8170, -0.0718]` | `0 / 15` | `0.0625` | No (`m=5` below exact threshold `m >= 6`) |
| `H1_prematureIndicators_DSG_vs_Static` | `9` | `7` | `-1.7778` | `[-3.2044, -0.3512]` | `0 / 28` | **`0.015625`** | **Yes** |
| `H1_prematureIndicators_DSG_vs_Generic` | `9` | `3` | `-0.7778` | `[-1.7017, +0.1461]` | `0 / 6` | `0.25` | No (`sampleInsufficient`) |
| `H2_meaningfulInteractions_DSG_vs_Static` | `9` | `7` | **`+1.7778`** | `[+0.3512, +3.2044]` | `28 / 0` | **`0.015625`** | **Yes** |
| `H2_meaningfulInteractions_DSG_vs_Generic` | `9` | `4` | `+2.1111` | `[-0.3027, +4.5249]` | `10 / 0` | `0.125` | No (`sampleInsufficient`) |
| `H2_attackStagesCompleted_DSG_vs_Static` | `9` | `4` | `+0.7778` | `[-0.0623, +1.6179]` | `10 / 0` | `0.125` | No (`sampleInsufficient`) |
| `H2_syntheticAssetsExplored_DSG_vs_Static` | `9` | `7` | **`+1.3333`** | `[+0.4739, +2.1927]` | `28 / 0` | **`0.015625`** | **Yes** |
| `H3_stepLatencyMs_DSG_vs_Static` | `14` | `14` | `+0.0140 ms` | `[-0.0303, +0.0583]` | `76 / 29` | `0.153076` | No (negligible overhead) |

### 4.3 Live Docker Container Parity (`stage6-live-docker-parity.json`)

Executed against Docker `29.5.2` (API `1.54`, image `deception-synthetic-service:1.0.0`) with `internalBridgeNoEgress: true`, UID/GID `1000:1000`, `readonlyRootfs: true`, `capDropAll: true`, `portBindings: {}`, and `256 MB` memory limit:

| System | Provision Time (ms) | Mem / PIDs | Mutations Executed / Rejected | Violations | Mean Exec / Query Latency (ms) | HTTP `200` (`of 3`) | Identity Coherent (`of 2`) | Rollback (ms) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `STATIC_HONEYPOT` | `475.16` | `9.43 MB / 11` | `0 / 0` | `0` | `0 / 29.13` | `2 / 3` | `0 / 2` | `N/A` |
| `GENERIC_ADAPTIVE` | `464.24` | `9.59 MB / 11` | `2 / 0` | `1` | `33.22 / 42.13` | `3 / 3` | `0 / 2` | `N/A` |
| `ATTACKER_SPECIFIC_DSG` | `472.04` | `9.39 MB / 11` | `3 / 1` | `0` | `33.11 / 45.49` | `3 / 3` | `2 / 2` | `30.34` |

---

## 5. Verification Summary & Residual Safety Constraints

- **Stage 6 Unit & Reproducibility Tests (`backend/tests/stage-6-research-evaluation.test.js`) + Stage 5A Semantics (`deception-policy-semantics-dsg.test.js`):** **`37 / 37` PASS** (live PostgreSQL + deterministic multi-seed runs).
- **Stage 5B.4 DSG Execution Engine (`backend/tests/dsg-execution-engine.test.js`):** **`25 / 25` PASS** (live Docker runtime execution after evidence fix).
- **Gateway Test Suite (`gateway`):** **`37 / 37` PASS**.
- **Frontend Production Build (`npm run build`):** **PASS** (Vite v6.4.5, `2656` modules).
- **Known Unrelated Pre-Existing Legacy Test Issues (Preserved / Reported Honestly):**
  - `backend/tests/runtime-adversarial-isolation.test.js:708` (`1` failure out of `143` across Stage 5B.1–5B.3 runtime suites) still asserts the older Stage 5B.2 image digest (`sha256:5e6dcf93...`) instead of the Stage 5B.4 image catalog digest (`sha256:a9e6316b...`).
  - `backend/tests/gateway-internal-api.test.js:188` Test 8 (`1` failure out of `283` when batched right after `gateway-adaptive-routing.test.js` without resetting the test DB) receives HTTP `200` idempotent replay for leftover static `correlationId = 'test-corr-gw-01'`.
- **Controlled-Lab Residual Risk (Finding A):** `RuntimeSelectionService.checkControlledLabReadiness()` remains enforced at runtime; live production gateway diversion must remain disabled until host `INPUT` firewall rules isolate `127.0.0.1` management ports from synthetic container bridge ranges. See `RESIDUAL_SECURITY_RISKS.md`.

---

## 6. Complete Stage 6 Deliverable Index (`docs/stage-6-research-evaluation/`)

1. `RESEARCH_EVALUATION_PROTOCOL.md`
2. `BASELINE_IMPLEMENTATION.md`
3. `SCENARIO_CATALOG.md`
4. `DATASET_PARTITIONING.md`
5. `METRIC_DEFINITIONS.md`
6. `EXPERIMENTAL_RESULTS.md`
7. `DSG_EFFECTIVENESS_ANALYSIS.md`
8. `PERFORMANCE_COMPARISON.md`
9. `STATISTICAL_ANALYSIS.md`
10. `LIMITATIONS_AND_THREATS_TO_VALIDITY.md`
11. `REPRODUCIBILITY_GUIDE.md`
12. `RESIDUAL_SECURITY_RISKS.md`
13. `STAGE_COMPLETION_REPORT.md`
14. Machine-readable outputs: `stage6-research-results.json`, `stage6-scenario-comparison.csv`, `stage6-system-comparison.csv`, `stage6-live-docker-parity.json`
