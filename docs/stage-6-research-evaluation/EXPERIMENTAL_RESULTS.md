# Stage 6 — Experimental Results (Three-Way Comparative Benchmark)

## 1. Concise Three-Way Comparison Table (Held-Out TEST Partition)

Evaluated across **14 independent held-out scenarios** (`131` steps per repetition × `5` deterministic seeds `[101, 202, 303, 404, 505]` = `655` steps per system, `1,965` total loopback HTTP evaluations; $N_{\text{attack}} = 9$, $N_{\text{benign}} = 3$, $N_{\text{ambiguous}} = 2$).

| Dimension / Metric | Baseline A: `STATIC_HONEYPOT` | Baseline B: `GENERIC_ADAPTIVE` | Proposed C: `ATTACKER_SPECIFIC_DSG` |
| :--- | :---: | :---: | :---: |
| **Detection Parity (Scenario Level, $N=12$ unambiguous)** | | | |
| True Positives / False Negatives (`TP / FN`) | `7 / 2` | `7 / 2` | `7 / 2` |
| True Negatives / False Positives (`TN / FP`) | `3 / 0` | `3 / 0` | `3 / 0` |
| Precision / Recall / F1-Score | `1.000 / 0.778 / 0.875` | `1.000 / 0.778 / 0.875` | `1.000 / 0.778 / 0.875` |
| False Positive Rate (`FPR`) / False Negative Rate (`FNR`) | `0.000 / 0.222` | `0.000 / 0.222` | `0.000 / 0.222` |
| Insufficient-Evidence Rate ($N_{\text{ambig}}=2$ / $14$) | `0.1429` (`2/2` clean defer) | `0.1429` (`2/2` clean defer) | `0.1429` (`2/2` clean defer) |
| **Deception Effectiveness (Across 9 Attack Scenarios / Seed)** | | | |
| Decoy Interactions Total (`Mean per Attack Scenario`) | `41` (`4.556`) | `41` (`4.556`) | `41` (`4.556`) |
| **Meaningful Attacker Interactions (`Meaningful %`)** | **`15` (`36.59%`)** | **`12` (`29.27%`)** | **`36` (`87.80%`)** |
| Mean Meaningful Interactions / Attack Scenario | `1.667` | `1.333` | **`4.000`** |
| Simulated Attacker Engagement Duration (Mean ms / Scenario) | `896.67 ms` | `694.44 ms` | **`1296.67 ms`** |
| **Attack Stages Completed (`of 29 Expected`)** | `7` (`24.14%`) | `7` (`24.14%`) | **`16` (`55.17%`)** |
| **Unique Synthetic Assets Explored** | `15` | `21` | **`31`** |
| **Runtime Consistency Violations** | `0` (Static) | **`22`** | **`0`** |
| **Premature Recognition Indicators** | `21` | `12` | **`0`** |
| **Adaptation Quality (Per Seed)** | | | |
| Transitions Proposed / Validated / Executed / Rejected | `0 / 0 / 0 / 0` | `37 / 15 / 37 / 0` | **`29 / 24 / 24 / 5`** |
| Transition Rejection Rate / Validation Pass Rate | `0.0% / N/A` | `0.0% / 40.54%` | **`17.24% / 82.76%`** |
| Mean Adaptation Latency (In-Process Loopback HTTP) | `0.0000 ms` | `0.1191 ms` | `0.1105 ms` |
| Cross-Seed Stability Rate (5 Seeds) | `100.0%` | `100.0%` | `100.0%` |
| **Routing Safety & System Performance** | | | |
| Actual Origin / Synthetic / Failed (All 5 Seeds) | `450 / 205 / 0` | `450 / 205 / 0` | `450 / 205 / 0` |
| Benign & Ambiguous Diverted to Synthetic Host | **`0`** | **`0`** | **`0`** |
| Mean / Median / p95 / p99 Step Latency (ms) | `0.883 / 0.861 / 0.966 / 1.060` | `0.910 / 0.877 / 1.077 / 1.249` | `0.903 / 0.875 / 1.082 / 1.212` |
| Total CPU User + System (ms across 655 steps) | `597.88 ms` | `643.90 ms` | `628.01 ms` |

---

## 2. Per-Scenario Breakdown (Held-Out TEST Partition)

| Scenario | Ground Truth | Verdict | Static (`Mean / Stg / Prem`) | Generic (`Mean / Viol / Prem`) | DSG (`Mean / Stg / Rej / Viol / Prem`) |
| :--- | :--- | :--- | :---: | :---: | :---: |
| `TEST-BENIGN-01` | `BENIGN` | `BENIGN` (`TN`) | `0 / 0 / 0` | `0 / 0 / 0` | `0 / 0 / 0 / 0 / 0` |
| `TEST-BENIGN-02` | `BENIGN` | `BENIGN` (`TN`) | `0 / 0 / 0` | `0 / 0 / 0` | `0 / 0 / 0 / 0 / 0` |
| `TEST-BENIGN-03` | `BENIGN` (Hard Neg.) | `INSUFFICIENT` (`TN` deferred) | `0 / 0 / 0` | `0 / 0 / 0` | `0 / 0 / 0 / 0 / 0` |
| `TEST-RECON-01` | `ATTACK` | `ATTACK` (`TP`) | `0 / 0 / 6` | **`6 / 0 / 0`** | **`6 / 3 / 3 / 0 / 0`** |
| `TEST-ENUM-01` | `ATTACK` | `ATTACK` (`TP`) | `1 / 1 / 5` | `3 / 3 / 3` | **`6 / 3 / 0 / 0 / 0`** |
| `TEST-CRED-01` | `ATTACK` | `INSUFFICIENT` (`FN`) | `0 / 0 / 0` | `0 / 0 / 0` | `0 / 0 / 0 / 0 / 0` |
| `TEST-AUTH-01` | `ATTACK` | `ATTACK` (`TP`) | `4 / 1 / 2` | `0 / 7 / 3` | **`6 / 2 / 0 / 0 / 0`** |
| `TEST-DATA-01` | `ATTACK` | `ATTACK` (`TP`) | `1 / 1 / 1` | `0 / 2 / 0` | **`2 / 1 / 2 / 0 / 0`** |
| `TEST-REPEAT-01` | `ATTACK` | `INSUFFICIENT` (`FN`) | `0 / 0 / 0` | `0 / 0 / 0` | `0 / 0 / 0 / 0 / 0` |
| `TEST-MULTI-01` | `ATTACK` | `ATTACK` (`TP`) | `0 / 0 / 1` | **`1 / 0 / 0`** | **`1 / 1 / 0 / 0 / 0`** |
| `TEST-MULTI-02` | `ATTACK` | `ATTACK` (`TP`) | `8 / 3 / 2` | `1 / 8 / 3` | **`10 / 3 / 0 / 0 / 0`** |
| `TEST-SHIFT-01` | `ATTACK` | `ATTACK` (`TP`) | `1 / 1 / 4` | `1 / 2 / 3` | **`5 / 3 / 0 / 0 / 0`** |
| `TEST-AMBIG-01` | `AMBIGUOUS` | `INSUFFICIENT` (Clean defer) | `0 / 0 / 0` | `0 / 0 / 0` | `0 / 0 / 0 / 0 / 0` |
| `TEST-AMBIG-02` | `AMBIGUOUS` | `INSUFFICIENT` (Clean defer) | `0 / 0 / 0` | `0 / 0 / 0` | `0 / 0 / 0 / 0 / 0` |

*Legend: `Mean` = Meaningful Interactions; `Stg` = Stages Completed; `Viol` = Runtime Consistency Violations; `Rej` = DSG Gate Rejections; `Prem` = Structural Premature Recognition Indicators.*

---

## 3. Live Isolated Docker Container Parity Run (`stage6-live-docker-parity.json`)

To verify that HTTP loopback behavior reflects real Docker container behavior (`deception-synthetic-service:1.0.0`, Engine `29.5.2`, `Internal: true` bridge, `UID 1000:1000`, `ReadonlyRootfs: true`, `CapDrop: ['ALL']`, zero published ports), a live 3-container sequence was executed over `docker exec`:

| System | Provisioning Time | Container RAM | Mutations Executed | Rejected at Gate | Violations | Endpoint 200/3 | Coherent Identity Responses/2 | Rollback Time |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `STATIC_HONEYPOT` | `475.16 ms` | `9.43 MB` | `0` | `0` | `0` | `2 / 3` | `0 / 2` | N/A |
| `GENERIC_ADAPTIVE` | `464.24 ms` | `9.59 MB` | `2` (`33.22 ms` ea) | `0` | **`1`** | `3 / 3` | `0 / 2` | N/A |
| `ATTACKER_SPECIFIC_DSG` | `472.04 ms` | `9.39 MB` | **`3` (`33.11 ms` ea)** | **`1`** | **`0`** | **`3 / 3`** | **`2 / 2`** | **`30.34 ms` (v->1)** |

---

## 4. Honest Reporting of Negative Results & Conservative Gates

1. **Detection False Negatives (`FNR = 0.2222`, `2/9` attacks missed on `TEST`, `3/4` on `VALIDATION`):**
   - `TEST-CRED-01` failed `RULE_AUTH_FAILURE` (`4` failures < `minFailures5m: 5`) because `RuleEngineService` selects `5m` as the primary window and ignores `30s` rapid burst thresholds (`minFailures30s: 3`) when `5m` features exist.
   - `TEST-REPEAT-01` triggered solitary `MEDIUM`-severity `RULE_REPEATED_RESOURCE_PROBING`, which the unmodified Stage 4C.3 safety gate withholds from autonomous deception (`deceptionEligible: false`).
   - Similarly in `VALIDATION` (`VAL-REPEAT-01`, `VAL-CRED-01`, `VAL-DATA-01` had `<5` auth failures or medium severity), recall was `0.25` while precision remained `1.0`. These negative results were preserved faithfully without altering rule thresholds.
2. **Hard Negative Behavioral Guard (`TEST-BENIGN-03`):**
   - Rapid valid API pagination (`450 ms`) scored high statistical deviation in `IsolationForest` because calibration traffic had slower cadence (`2.4–4.2 s`). The `Rule Corroboration Required` policy guard held it back (`INSUFFICIENT_EVIDENCE` -> routed cleanly to Protected Origin), resulting in **0.0% false positives** across all benign scenarios.
