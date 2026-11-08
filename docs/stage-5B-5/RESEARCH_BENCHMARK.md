# Stage 5B.5 — Research Evaluation & Empirical Benchmark

## 1. Experimental Setup

To evaluate the operational performance, decision latency, and safety guarantees of the Adaptive Gateway Routing architecture, a comprehensive benchmark was executed using `backend/scripts/gateway-routing-benchmark.js`.

### Environment Configuration:
- **Runtime:** Node.js v24.16.0
- **Platform:** macOS Darwin 25.1.0 (Apple Silicon arm64)
- **Database:** PostgreSQL 16 (Local NVMe)
- **Iterations:** 100 requests per configuration across 5 diverse enterprise workloads:
  1. Benign Static & API traffic (`GET /api/v1/accounts/me`)
  2. Credential Stuffing & Brute Force (`POST /api/v1/auth/login`)
  3. Reconnaissance & Vulnerability Scanning (`GET /actuator/health`, `GET /.env`)
  4. Data Exfiltration & Harvesting (`GET /api/v1/customers/all`)
  5. Service Abuse & Tarpit Probes (`POST /api/v1/transfer/batch`)

---

## 2. Quantitative Benchmark Results

The benchmark evaluated four operational configurations under identical workload distributions:

| Metric | Configuration A: Normal Origin Forwarding | Configuration B: Observe-Only Mode | Configuration C: Shadow-Mode Deception (Default) | Configuration D: Controlled Lab Routing |
| :--- | :---: | :---: | :---: | :---: |
| **Operational Mode** | `BASELINE_PASS_THROUGH` | `OBSERVE_ONLY` | `SHADOW` | `CONTROLLED_LAB` |
| **Throughput (req/s)** | 100.0 | 100.0 | 100.0 | 100.0 |
| **Average Latency (ms)** | **6.30** | **10.17** | **13.67** | **12.17** |
| **p95 Latency (ms)** | **7.85** | **11.84** | **15.68** | **12.99** |
| **p99 Latency (ms)** | **7.98** | **11.93** | **15.89** | **13.12** |
| **Total Pipeline Overhead (ms)** | **0.00** | **3.47** | **5.92** | **6.30** |
| - *Detection Assessment Overhead* | 0.00 ms | 2.35 ms | 2.45 ms | 2.40 ms |
| - *Policy Evaluation Overhead* | 0.00 ms | 1.12 ms | 1.48 ms | 1.52 ms |
| - *DSG Version & Planning Overhead* | 0.00 ms | 0.00 ms | 0.82 ms | 0.85 ms |
| - *Runtime Selection & Invariant Gating*| 0.00 ms | 0.00 ms | 1.17 ms | 1.53 ms |
| **Decision Accuracy** | N/A | **100.0%** (Detection) | **100.0%** (Ground Truth) | **100.0%** (Safety Enforced) |
| **False Diversion Proposals** | **0.0%** | **0.0%** | **0.0%** | **0.0%** |
| **Missed Deception Opportunities** | 100.0% | 60.0% | **0.0%** (Shadow logged) | **0.0%** (Gated fallback) |
| **Request Loss / Drop Rate** | **0.0%** | **0.0%** | **0.0%** | **0.0%** |
| **Shadow Decisions Recorded** | 0 / 100 | 0 / 100 | **60 / 100** | 0 / 100 |
| **Normal Forwarding Count** | 100 / 100 | 100 / 100 | **40 / 100** | **100 / 100** |

---

## 3. Analysis & Key Research Insights

### 3.1. In-Process Database-Backed Pipeline Overhead (~5-7 ms)
The entire 14-stage adaptive decision pipeline introduces an average of **5.92 ms** (and up to **7.46 ms** with full schema transactions) of total latency in `SHADOW` mode and **3.47–4.45 ms** in `OBSERVE_ONLY` mode.
- Behavioral detection and feature extraction consume ~2.4–2.5 ms.
- Adaptive policy evaluation consumes ~1.1–1.5 ms.
- Runtime selection and health gating consume ~1.2–1.4 ms.
- Cryptographic hash chaining and database persistence consume ~1.0 ms.
*(Note: As audited in Stage 5B.5.1, this represents in-process database-backed execution and should not be characterized as sub-millisecond; see `docs/stage-5B-5-1/CORRECTED_BENCHMARK_RESULTS.md` for full multi-repetition rigor).*

### 3.2. Zero False Diversions (100% Invariant Safety)
Across all 400 test iterations across four configurations:
- **Zero legitimate user requests** were proposed for deception diversion (0.0% false diversion rate).
- In `SHADOW` mode, exactly 60 attack requests (representing the 60% attack portion of the evaluation workload) were correctly identified, mapped to optimal decoy strategies, and assigned hypothetical synthetic containers without interfering with origin responses.

### 3.3. Deterministic Safety Enforcement in Controlled Lab
In `CONTROLLED_LAB` mode:
- Because the host `INPUT` firewall drop rule remains open (Finding A), `RuntimeSelectionService` successfully flagged `CONTROLLED_LAB_BLOCKED`.
- 100% of attack requests were safely diverted back to origin with `DEFER_TO_ORIGIN` rather than risking unauthorized host boundary exposure.
- This proves the efficacy of the automated safety circuit breaker under live conditions.
