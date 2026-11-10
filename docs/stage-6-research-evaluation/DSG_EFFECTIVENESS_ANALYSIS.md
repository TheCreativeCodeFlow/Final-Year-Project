# Stage 6 — DSG Effectiveness & Hypothesis Analysis

## 1. Hypothesis H1: Multi-Stage Behavioral Consistency

**Hypothesis:** *Attacker-specific DSG adaptation maintains greater behavioral consistency across multi-stage interactions than static honeypots and generic adaptive deception.*

- **Measurable Outcomes:** (1) Runtime consistency violations flagged by 7-way `DSGConsistencyEngine`; (2) Client-visible premature recognition indicators (identity fallbacks, role contradictions, broken auth services, 404 dead-ends).
- **Observed Evidence:**
  - `ATTACKER_SPECIFIC_DSG`: **`0` runtime consistency violations** across `29` proposed transitions per seed (`5` invalid proposals rejected cleanly before execution; rejection rate `17.24%`), and **`0` structural premature recognition indicators** (`36/41 = 87.80%` meaningful ratio).
  - `GENERIC_ADAPTIVE`: Executed `37` unvalidated mutations resulting in **`22` live runtime consistency violations** (`validation pass rate = 40.54%`) and **`12` premature recognition indicators**.
  - `STATIC_HONEYPOT`: `0` mutation violations (stasis), but **`21` premature recognition indicators** caused by unadapted `404` endpoints and silent identity fallback to `alex.chen`.
- **Root-Cause Failure Mode of Stateless Adaptation:** In `TEST-AUTH-01`, `TEST-ENUM-01`, `TEST-MULTI-02`, and `TEST-SHIFT-01`, stateless category adaptation broke cross-component invariants—issuing `ADMINISTRATOR` credentials for a `FINANCIAL_ANALYST`, creating credentials/routes before identities existed (`sec_auditor_01`, `treasury_ops`, `pivot_svc`), stripping `canary_seed` columns from `synthetic_customers`, or disabling `SYNTHETIC_AUTH` while auth endpoints remained active (`TEST-MULTI-02`: `8` violations). **Crucially, naive stateless adaptation performed worse than a static honeypot (`12` vs `15` meaningful interactions).**
- **H1 Verdict:** **`SUPPORTED_ON_SYNTHETIC_BENCHMARK`** (Statistically significant vs Static premature indicators at $p = 0.015625$; lower violations than Generic in `5/5` non-zero pairs, limited by small $m=5$ pairs for permutation significance at $p=0.0625$).

---

## 2. Hypothesis H2: Meaningful Synthetic Interactions & Engagement Depth

**Hypothesis:** *Attacker-specific DSG adaptation produces more meaningful synthetic interactions than the static baseline under equivalent simulated attack scenarios.*

- **Measurable Outcomes:** Meaningful attacker interactions (strictly HTTP `200` + valid domain asset + zero contradictions), attack stages completed (`max=29` across 9 held-out attacks), unique synthetic assets explored, and simulated engagement duration (`ms`).
- **Observed Evidence:**
  - `ATTACKER_SPECIFIC_DSG` achieved **`36` meaningful interactions (`4.000` / attack scenario)** vs **`15` (`1.667`)** for `STATIC_HONEYPOT` and **`12` (`1.333`)** for `GENERIC_ADAPTIVE`.
  - Attack stages completed doubled from **`7 / 29` (`24.14%`)** in Static/Generic to **`16 / 29` (`55.17%`)** under DSG (`TEST-ENUM-01`: `1 -> 3`, `TEST-AUTH-01`: `1 -> 2`, `TEST-SHIFT-01`: `1 -> 3`, `TEST-RECON-01`: `0 -> 3`).
  - Unique synthetic assets explored increased from **`15` (Static)** and **`21` (Generic)** to **`31` (DSG)**, while simulated scenario engagement duration rose from **`896.67 ms` (Static)** and **`694.44 ms` (Generic)** to **`1296.67 ms` (DSG)**.
  - Where simple single-vector API scanning occurred (`TEST-RECON-01`), both `GENERIC_ADAPTIVE` and `ATTACKER_SPECIFIC_DSG` achieved identical meaningful counts (`6 / 6`), demonstrating fair baseline parity without crippling Generic Adaptive.
- **H2 Verdict:** **`SUPPORTED_ON_SYNTHETIC_BENCHMARK`** (DSG vs Static: mean paired gain `+1.7778` meaningful interactions/scenario, 95% CI `[+0.3512, +3.2044]`, exact Wilcoxon $p = 0.015625 < 0.05$).

---

## 3. Hypothesis H3: Processing & Runtime Adaptation Overhead

**Hypothesis:** *DSG adaptation introduces measurable processing and runtime overhead that must be quantified against its effectiveness benefits.*

- **Observed Evidence Across Execution Tiers:**
  1. **In-Process Loopback Harness (`655` steps/paradigm across 5 seeds):**
     - DSG adaptation loop (`DSGPlannerService` + 7-way `DSGConsistencyEngine` + HTTP `POST /internal/mutate`) adds **`0.1105 ms`** (`p95: 0.2642 ms`) per adaptation event vs `0.0000 ms` for Static.
     - Step latency shifts slightly: Static median `0.8614 ms` (`p95: 0.9663 ms`) vs DSG median `0.8745 ms` (`+0.0131 ms`, `p95: 1.0823 ms`, `+0.1160 ms` / `+12.0%`). Total CPU user+system over 655 steps rose by `+5.0%` (`628.01 ms` vs `597.88 ms`). Note Generic Adaptive consumed *more* total CPU (`643.90 ms`) because it executed all `37` blind mutations whereas DSG pruned `5` invalid ones before network dispatch.
  2. **Live Isolated Docker Runtime Parity (`deception-synthetic-service:1.0.0`):**
     - Isolated container provisioning (`Internal: true` bridge + image digest check + `UID 1000:1000` startup + health probe) takes **`472.04 ms`** and uses **`9.39 MB`** RAM (under `256 MB` limit).
     - Each live Docker `exec` mutation costs **`33.11 ms`**, and verified state rollback takes **`30.34 ms`**.
  3. **Production Database-Backed Gateway Path (from Stage 5B.5.1):** Synchronous PostgreSQL persistence and SHA-256 hash chaining add ~**`5–7 ms`** per request (`~0.82 ms` DSG planning + `~1.0–2.35 ms` DB/evidence).
- **H3 Verdict:** **`SUPPORTED`** across execution tiers: lightweight in-memory coordination cost (`~0.11 ms`), moderate DB/hashing cost (`~5–7 ms`), and significant container IPC/provisioning cost (`~33 ms/mutation`, `~472 ms` cold start).
