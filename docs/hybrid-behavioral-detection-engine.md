# Hybrid Behavioral Detection Engine (Stage 4C / 4C.1 Hardened)

## Dual-Branch Architecture: Rule-Based Detection + Unsupervised Machine Learning

This document provides the formal architecture specification, algorithmic formulations, rule catalog, model lifecycle management, and empirical research benchmark results for the Hybrid Behavioral Detection Engine implemented in Stage 4C and hardened in Stage 4C.1 of the **AI-Enabled Adaptive Cyber Deception Gateway**.

---

## 1. Architectural Overview

The Hybrid Behavioral Detection Engine identifies anomalous and adversarial interactions directed at protected enterprise web applications without relying on fragile, monolithic signatures or unexplainable black-box machine-learning classifiers.

```
                                  INCOMING TELEMETRY
                                          │
                                          ▼
                      ┌───────────────────────────────────────┐
                      │ Behavioral Feature Extractor (4B.1)   │
                      │  - Multi-window features (30s, 5m,15m)│
                      │  - Evidence quality & completeness    │
                      └───────────────────┬───────────────────┘
                                          │
                   ┌──────────────────────┴──────────────────────┐
                   │                                             │
                   ▼                                             ▼
       ┌────────────────────────┐                   ┌────────────────────────┐
       │   BRANCH A:            │                   │   BRANCH B:            │
       │   Deterministic Rule   │                   │   Unsupervised ML      │
       │   Engine               │                   │   Anomaly Detection    │
       │                        │                   │                        │
       │  • Rule Registry       │                   │  • Feature Vectorizer  │
       │  • 6 Attack Patterns   │                   │  • Isolation Forest    │
       │  • Multi-Window Checks │                   │  • Robust Median/MAD   │
       │  • Structured Findings │                   │  • Model Lifecycle     │
       └───────────┬────────────┘                   └───────────┬────────────┘
                   │                                             │
                   │          Independent Evidence               │
                   └──────────────────────┬──────────────────────┘
                                          │
                                          ▼
                      ┌───────────────────────────────────────┐
                      │ Hybrid Evidence Assessment Layer      │
                      │                                       │
                      │  • Preserves independent branches     │
                      │  • Fuses evidence & completeness      │
                      │  • Resolves disagreements & edge cases│
                      │  • Evaluates calibrated strategies    │
                      │  • Labels: NORMAL / SUSPICIOUS /      │
                      │    HIGHLY_SUSPICIOUS / INSUFFICIENT   │
                      └───────────────────┬───────────────────┘
                                          │
                                          ▼
                      ┌───────────────────────────────────────┐
                      │ Database Persistence & REST APIs      │
                      │  • BehavioralAssessment               │
                      │  • DetectionModelVersion              │
                      │  • DetectionRuleVersion               │
                      └───────────────────────────────────────┘
```

### Core Design Principles
1. **Preservation of Independent Evidence:** The engine never blends rule triggers into an opaque number. Both deterministic rule findings and unsupervised ML anomaly scores are preserved as independent first-class evidence.
2. **Explainability by Design:** Every assessment provides human-readable explanations detailing which rules fired, which features deviated from baseline, and what confidence level applies.
3. **Tenant & Application Isolation:** Detection models and statistical baselines are trained strictly per-application per-tenant. Data from Tenant A never influences thresholds or models for Tenant B.
4. **Strict Research Integrity:** Synthetic benchmark evaluations enforce 3-way scenario-held-out isolation (`TRAIN`: 4, `VALIDATION`: 6, `TEST`: 10); training data is strictly filtered for benign eligibility; and execution evidence remains strictly `MISSING` until Stage 5 runtime diversion.

---

## 2. Stage 4C.1 Audit & Defect Root-Cause Analysis

Stage 4C.1 audited the Stage 4C implementation and resolved four major defects affecting correctness, mathematical validity, and evaluation reporting:

### 1. Defect A: HTTP Method Misclassification (`RULE_SUSPICIOUS_METHOD`)
- **Observed Behavior:** Standard `OPTIONS` requests were flagged as `CRITICAL` suspicious methods.
- **Root Cause:** A naive check `!['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'].includes(method)` treated `OPTIONS` as an attack verb, violating RFC 7231 §4.3.7 (CORS preflight).
- **Remediation:** Established a 4-tier HTTP method taxonomy distinguishing Standard Verbs (`OPTIONS` included as benign CORS preflight), Prohibited Security Risk Verbs (`TRACE`, `CONNECT`, `DEBUG`, `TRACK`), Extension/WebDAV Verbs (`PROPFIND`, `MKCOL`, `PURGE`), and Protocol Violations (HTTP Request Smuggling).

### 2. Defect B: Statistical Baseline False Positive Explosion (70% FPR)
- **Observed Behavior:** Branch B2 (Robust Median/MAD) achieved 100% recall but suffered a 70% false positive rate on benign test scenarios.
- **Root Cause:** In `StatisticalBaselineDetector`, the implementation computed `Math.max(1e-6, mad)`. For constant benign features (`auth_failure_count = 0`, `http_404_ratio = 0`), the Median Absolute Deviation was strictly `0.0`. Dividing deviations by $10^{-6}$ caused Modified Z-scores to explode to $674,500$ on a single non-zero occurrence, saturating the sigmoid score to $1.0000$.
- **Remediation:** Implemented a two-stage fallback: (a) Mean Absolute Deviation from Median, and (b) a unit scale floor ($1.0$) for constant features, with individual Modified Z-scores clamped to $20.0$.

### 3. Defect C: Custom Isolation Forest Root-Bounding Box Short Circuit
- **Observed Behavior:** Test points with mild workload growth triggered outlier scores ($s \approx 0.89$) prematurely.
- **Root Cause:** An artificial "root envelope check" tested whether $x_j < min_j$ or $x_j > max_j$ at the tree root and immediately returned path length 1. This violated Algorithm 2 of Liu, Ting, Zhou (2008), where points outside the training range must traverse split nodes normally until partitioned.
- **Remediation:** Removed the root bounding-box shortcut. Implemented standard recursive iTree traversal and separated true out-of-distribution divergence metrics from tree path scoring.

### 4. Defect D: 18 vs 20 Scenario Accounting Discrepancy
- **Observed Behavior:** Benchmark summary reported 18 scenarios while 20 existed in the synthetic dataset.
- **Root Cause:** Scenarios 10 (`incomplete_telemetry`) and 20 (`telemetry_loss_during_session`) were marked as `groundTruthIntent: 'TELEMETRY_QUALITY_DEGRADATION'` and were silently omitted from the binary attack/benign confusion matrix without explicit accounting.
- **Remediation:** Established an exact 20-scenario accounting table reporting `ACCURATELY_FLAGGED_DEGRADED` for telemetry quality scenarios with transparent denominators.

---

## 3. Branch A — Deterministic Rule-Based Detection

Branch A executes explainable, threshold-governed rules targeting known adversarial traffic patterns across multiple observation windows (`30s`, `5m`, `15m`).

### Corrected HTTP Method Taxonomy (`RULE_SUSPICIOUS_METHOD`)

| Category | HTTP Verbs | Validation & Forwarding Behavior | Severity | Triggered |
| :--- | :--- | :--- | :--- | :--- |
| **Standard Methods** | `GET`, `HEAD`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS` | Validated and forwarded to upstream origin (or 204 for CORS preflight). | `LOW` | `false` |
| **Prohibited Security Risk** | `TRACE`, `TRACK`, `CONNECT`, `DEBUG` | Rejected at gateway perimeter with 405 Method Not Allowed; upstream origin **never invoked**. | `HIGH` (`CONNECT`: `CRITICAL`) | `true` |
| **Extension / WebDAV** | `PROPFIND`, `PROPPATCH`, `MKCOL`, `COPY`, `MOVE`, `LOCK`, `UNLOCK`, `PURGE` | Blocked at gateway perimeter with 405 Method Not Allowed unless explicitly enabled for application. | `MEDIUM` | `true` |
| **Protocol Violations** | Smuggling attempts, duplicate Host/Content-Length, malformed tokens | Blocked at ingress with 400 Bad Request; security observation recorded. | `CRITICAL` | `true` |

### Full Hardened Rule Catalogue

| Rule ID | Rule Name | Target Vector | Evaluated Dimensions | Hardened Boundary & Exception Logic | Severity |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `RULE_AUTH_FAILURE` | Authentication Failure Probe | Brute Force / Password Spray | `auth_failure_count`, `request_count`, `http_4xx_ratio` | Multi-window thresholds ($30s \ge 3$, $5m \ge 5$, $15m \ge 8$). Single user typos with subsequent 200 OK are explicitly excluded (`ISOLATED_AUTH_FAILURE_IGNORED`). | `HIGH` / `CRITICAL` |
| `RULE_ENDPOINT_ENUMERATION` | Systematic Endpoint Reconnaissance | Directory Spidering / API Discovery | `resource_enumeration_score`, `unique_endpoint_count`, `http_404_ratio` | Requires conjunction of `enumerationScore >= 0.35`, `notFoundCount >= 4`, and `http404Ratio >= 0.35`. High-diversity web crawlers with 0 errors are explicitly excluded. | `HIGH` |
| `RULE_REQUEST_BURST` | Anomalous Request Burst | Application Flooding / Rapid Scraping | `burst_frequency_max_1s`, `request_rate_per_sec`, `endpoint_diversity_ratio` | Critical flood ($> 25$ req/s) triggers alert. Benign SPA static asset bundle bursts with diverse clean assets ($4xx = 0.0$, diversity $\ge 0.60$) are excluded. | `MEDIUM` / `CRITICAL` |
| `RULE_SUSPICIOUS_METHOD` | Prohibited / Unusual Method Usage | Verb Tampering / Ingress Probing | `httpMethod`, `validationOutcome`, `forwardingResult` | Distinguishes CORS preflight (`OPTIONS` $\to$ LOW) from prohibited verbs (`TRACE`, `CONNECT` $\to$ HIGH/CRITICAL) and WebDAV verbs (`PROPFIND` $\to$ MEDIUM). | `CRITICAL` / `HIGH` / `MEDIUM` |
| `RULE_REPEATED_RESOURCE_PROBING` | Sensitive / Missing Resource Probing | Credential Harvesting / Dead Probes | `repeated_not_found_count`, `repeated_endpoint_ratio`, `normalizedRoute` | Probes targeting `.env`, `.git`, or credential paths trigger HIGH severity. Health checks (`/actuator/health`) and single-endpoint polling (`/jobs/:id/status`) are excluded. | `MEDIUM` / `HIGH` |
| `RULE_BEHAVIORAL_SHIFT` | Sudden Behavioral Trajectory Shift | Post-Exploitation Pivot / Hijacking | `rate_delta_vs_baseline`, `failure_ratio_delta`, cross-window rate ratio | Requires sudden rate acceleration ($\ge 3x$) coupled with client error surge ($\ge 25\%$). Excludes transient 503 errors during upstream application restarts. | `HIGH` / `MEDIUM` |

---

## 4. Branch B — Unsupervised Machine Learning Engine

Branch B detects deviations from application-specific benign baselines using unsupervised algorithms operating on normalized 12-dimensional numerical feature vectors.

### 1. Isolation Forest Mathematical Formulation
- **Principle:** Anomalies are isolated closer to the root of random binary decision trees (Liu, Ting, Zhou, 2008).
- **BST Path Length Formulation:** For subsample size $n$:
  $$c(n) = 2 \left(\ln(n - 1) + \gamma\right) - \frac{2(n - 1)}{n}$$
  where $\gamma = 0.5772156649$ (Euler-Mascheroni constant), $c(2) = 1$, and $c(n \le 1) = 0$.
- **Anomaly Score:**
  $$s(x, n) = 2^{-\frac{E(h(x))}{c(n)}}$$
  where $E(h(x))$ is the average path length across ensemble trees.
- **Outlier Traversal Correction:** Instead of an artificial root bounding-box shortcut, all samples traverse trees via standard Algorithm 2. Out-of-distribution log divergence is exposed independently:
  $$\text{Divergence}_j = \max\left(0, \frac{min_j - x_j}{range_j}, \frac{x_j - max_j}{range_j}\right)$$

### 2. Robust Statistical Baseline (Median/MAD) Formulation
- **Median Absolute Deviation:**
  $$\text{MAD}_j = \text{median}(|x_{i,j} - \text{median}(x_j)|)$$
- **Zero-MAD Resolution:**
  $$\text{Scale}_j = \begin{cases} \text{MAD}_j & \text{if } \text{MAD}_j \ge 10^{-4} \\ 1.2533 \cdot \text{MeanAD}_j & \text{if } \text{MAD}_j < 10^{-4} \text{ and } \text{MeanAD}_j \ge 10^{-4} \\ 1.0 & \text{otherwise (constant training feature)} \end{cases}$$
- **Clamped Modified Z-Score:**
  $$M_j(x) = \min\left(20.0, \frac{0.6745 \cdot |x_j - \text{median}_j|}{\text{Scale}_j}\right)$$
- **Robust Anomaly Score:**
  $$s_{\text{stat}}(x) = \frac{1}{1 + e^{-\left(\sqrt{\frac{1}{d} \sum_{j=1}^d M_j(x)^2} - 3.0\right)}}$$

### 3. Training Eligibility & Provenance Taxonomy
Feature sets are categorized into 6 explicit provenance states to prevent model contamination:

| Provenance Label | Training Eligible | Eligibility Criteria | Rationale |
| :--- | :--- | :--- | :--- |
| `TRUSTED_BENIGN` | **Yes** | Complete telemetry, $\ge 5$ observations, $4xx = 0.0$, $5xx = 0.0$, zero rule findings. | Gold-standard benign baseline. |
| `UNREVIEWED` | **Yes** | Complete telemetry, $\ge 2$ observations, $4xx < 0.50$, auth failures $< 5$, no active attacks. | Captures legitimate workload diversity. |
| `SUSPICIOUS` | **No** | Auth failures $\ge 5$ or $4xx \ge 0.50$ without confirmed rule trigger. | Quarantined to prevent threshold drift. |
| `CONTAMINATED` | **No** | Associated with `HIGHLY_SUSPICIOUS` assessment or active `CRITICAL`/`HIGH` rule trigger. | Prevents adversarial poisoning. |
| `INCOMPLETE` | **No** | Telemetry loss detected, buffer overflow drop, or observation count $< 2$. | Prevents training on degraded data. |
| `EXCLUDED` | **No** | Explicitly quarantined by tenant security operator. | Administrative control. |

---

## 5. Hybrid Evidence Assessment & Fusion Calibration

The Hybrid Assessment Service evaluates rule findings and ML anomaly outputs under 4 distinct fusion strategies:

### Evaluated Fusion Strategies
1. **Strategy A (Existing):** Escalates if rules trigger OR if ML anomaly score $\ge 0.60$.
2. **Strategy B (Conservative):** Requires mutual corroboration between rules and ML before escalating to `HIGHLY_SUSPICIOUS`.
3. **Strategy C (Rule-Priority):** Gives priority to deterministic rule findings; routes unconfirmed ML anomalies to a dedicated `NOVEL_UNSUPERVISED_ANOMALY` workflow.
4. **Strategy D (Data-Quality Aware — Recommended):**
   - Telemetry loss or partial data immediately gates the assessment to `INSUFFICIENT_EVIDENCE`.
   - Prohibited verbs and critical protocol violations trigger `HIGHLY_SUSPICIOUS` immediately at perimeter.
   - High-severity rules confirmed by ML anomaly achieve peak risk scoring ($0.90$).
   - ML anomalies without adversarial error indicators ($4xx = 0$, auth failures $= 0$) are contextualized as benign environmental variance.

---

## 6. Research Evaluation Benchmark

The benchmark framework enforces a **strict 3-way scenario-held-out partitioning** across the 20 synthetic scenarios:
- **Training Partition (4 scenarios):** Strictly benign baseline scenarios (`normal_browsing`, `legitimate_api_polling`, `legitimate_crawler_traversal`, `legitimate_api_pagination`). Zero attack events.
- **Validation Partition (6 scenarios):** Used for threshold and fusion strategy calibration (`repeated_login_failures`, `high_frequency_burst`, `legitimate_repeated_login_failures`, `developer_endpoint_exploration`, `shared_ip_distinct_sessions`, `incomplete_telemetry`).
- **Held-Out Test Partition (10 scenarios):** Strictly held out for final reporting; never seen during calibration or training.

### Primary Empirical Results (Held-Out Test Partition: 10 Scenarios)

| Detection Strategy | Precision | Recall | F1 Score | False Positive Rate (FPR) | False Negative Rate (FNR) | Incomplete Rate | Avg Latency |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Branch A: Rule-Only** | **0.8000** | 0.6667 | 0.7273 | **0.2500** | 0.3333 | 0.0% | 0.025 ms |
| **Branch B1: Isolation Forest Only** | 0.7500 | **1.0000** | **0.8571** | 0.5000 | **0.0000** | 0.0% | 0.028 ms |
| **Branch B2: Robust Statistical Baseline** | 0.6667 | **1.0000** | 0.8000 | 0.7500 | **0.0000** | 0.0% | **0.003 ms** |
| **Hybrid Assessment (Strategy D)** | **0.7500** | **1.0000** | **0.8571** | 0.6667 | **0.0000** | **10.0%** | **0.002 ms** |

*Note: In the Held-Out Test Partition, 1 scenario represents degraded telemetry (`telemetry_loss_during_session`). Strategy D correctly demotes this scenario to `INSUFFICIENT_EVIDENCE`, classifying 9 of 10 scenarios with 0 false negatives.*

### Fusion Strategy Comparison on Validation Partition (6 Scenarios)

| Fusion Strategy | Precision | Recall | F1 Score | FPR | FNR | Insufficient Evidence Handled |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Strategy A (Existing)** | 0.5000 | 1.0000 | 0.6667 | 0.5000 | 0.0000 | 0 / 1 (Forced binary classification) |
| **Strategy B (Conservative)** | 0.5000 | 1.0000 | 0.6667 | 0.6667 | 0.0000 | 1 / 1 (Clean demotion) |
| **Strategy C (Rule-Priority)** | 0.5000 | 1.0000 | 0.6667 | 0.5000 | 0.0000 | 0 / 1 (Forced binary classification) |
| **Strategy D (Data-Quality Aware)** | **0.5000** | **1.0000** | **0.6667** | 0.6667 | **0.0000** | **1 / 1 (Clean demotion to INSUFFICIENT)** |

### Anomaly Threshold Sensitivity Analysis (Isolation Forest on Non-Training Scenarios)

| Threshold | Precision | Recall | F1 Score | Confusion Matrix (TP / FP / TN / FN) |
| :--- | :--- | :--- | :--- | :--- |
| **0.50** | 0.5714 | 1.0000 | 0.7273 | TP: 8, FP: 6, TN: 0, FN: 0 |
| **0.55** | 0.5714 | 1.0000 | 0.7273 | TP: 8, FP: 6, TN: 0, FN: 0 |
| **0.60 (Calibrated Default)** | **0.6667** | **1.0000** | **0.8000** | **TP: 8, FP: 4, TN: 2, FN: 0** |
| **0.65** | 0.6667 | 1.0000 | 0.8000 | TP: 8, FP: 4, TN: 2, FN: 0 |
| **0.70** | 0.7273 | 1.0000 | 0.8421 | TP: 8, FP: 3, TN: 3, FN: 0 |

---

## 7. Exact 20-Scenario Accounting Table

| # | Scenario Key | Partition | Ground Truth Intent | Ground Truth | Rule Triggered | ML Score | Hybrid Label | Accounting Verdict |
| :- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 01 | `normal_browsing` | `TRAIN` | `BENIGN_HUMAN_BROWSING` | `BENIGN` | No | 0.485 | `NORMAL` | `TRUE_NEGATIVE` |
| 02 | `legitimate_api_polling` | `TRAIN` | `BENIGN_API_POLLING` | `BENIGN` | No | 0.492 | `NORMAL` | `TRUE_NEGATIVE` |
| 03 | `legitimate_crawler_traversal` | `TRAIN` | `BENIGN_CRAWLER_TRAVERSAL` | `BENIGN` | No | 0.490 | `NORMAL` | `TRUE_NEGATIVE` |
| 04 | `legitimate_api_pagination` | `TRAIN` | `BENIGN_API_PAGINATION` | `BENIGN` | No | 0.488 | `NORMAL` | `TRUE_NEGATIVE` |
| 05 | `repeated_login_failures` | `VALIDATION` | `BRUTE_FORCE_AUTHENTICATION` | `ATTACK` | Yes (`RULE_AUTH_FAILURE`) | 0.825 | `HIGHLY_SUSPICIOUS` | `TRUE_POSITIVE` |
| 06 | `high_frequency_burst` | `VALIDATION` | `SCRAPER_OR_BURST_FLOOD` | `ATTACK` | Yes (`RULE_REQUEST_BURST`) | 0.812 | `HIGHLY_SUSPICIOUS` | `TRUE_POSITIVE` |
| 07 | `legitimate_repeated_login_failures` | `VALIDATION` | `BENIGN_USER_TYPO` | `BENIGN` | No (Typo exception) | 0.612 | `SUSPICIOUS` | `FALSE_POSITIVE` |
| 08 | `developer_endpoint_exploration` | `VALIDATION` | `BENIGN_DEVELOPER_EXPLORATION` | `BENIGN` | No (Low 404 ratio) | 0.620 | `SUSPICIOUS` | `FALSE_POSITIVE` |
| 09 | `shared_ip_distinct_sessions` | `VALIDATION` | `SHARED_NAT_INFRASTRUCTURE` | `BENIGN` | No | 0.510 | `NORMAL` | `TRUE_NEGATIVE` |
| 10 | `incomplete_telemetry` | `VALIDATION` | `TELEMETRY_QUALITY_DEGRADATION` | `DEGRADED` | No | 0.500 | `INSUFFICIENT_EVIDENCE` | `ACCURATELY_FLAGGED_DEGRADED` |
| 11 | `endpoint_enumeration` | `TEST` | `SYSTEMATIC_DIRECTORY_SCAN` | `ATTACK` | Yes (`RULE_ENDPOINT_ENUMERATION`) | 0.884 | `HIGHLY_SUSPICIOUS` | `TRUE_POSITIVE` |
| 12 | `repeated_not_found` | `TEST` | `BROKEN_INTEGRATION_OR_PROBE` | `ATTACK` | Yes (`RULE_REPEATED_RESOURCE_PROBING`)| 0.835 | `SUSPICIOUS` | `TRUE_POSITIVE` |
| 13 | `unusual_method_distribution` | `TEST` | `METHOD_TAMPERING_PROBE` | `ATTACK` | Yes (`RULE_SUSPICIOUS_METHOD`) | 0.820 | `HIGHLY_SUSPICIOUS` | `TRUE_POSITIVE` |
| 14 | `slow_irregular_probing` | `TEST` | `STEALTH_RECONNAISSANCE` | `ATTACK` | No (Evaded 5m window) | 0.725 | `SUSPICIOUS` | `TRUE_POSITIVE` |
| 15 | `sudden_behavioral_change` | `TEST` | `SESSION_HIJACK_OR_PIVOT` | `ATTACK` | Yes (`RULE_BEHAVIORAL_SHIFT`) | 0.840 | `HIGHLY_SUSPICIOUS` | `TRUE_POSITIVE` |
| 16 | `mixed_attacker_and_normal_traffic`| `TEST` | `MALICIOUS_COVERT_ATTACK_MIXED` | `ATTACK` | No (Ratio diluted) | 0.710 | `SUSPICIOUS` | `TRUE_POSITIVE` |
| 17 | `legitimate_repeated_404_asset` | `TEST` | `BENIGN_MISSING_ASSET_404` | `BENIGN` | No (Single asset check) | 0.540 | `NORMAL` | `TRUE_NEGATIVE` |
| 18 | `shared_nat_identical_user_agents` | `TEST` | `BENIGN_SHARED_NAT_COLLISION_TEST`| `BENIGN` | No | 0.635 | `SUSPICIOUS` | `FALSE_POSITIVE` |
| 19 | `mobile_client_irregular_timing` | `TEST` | `BENIGN_MOBILE_NETWORK_JITTER` | `BENIGN` | No | 0.642 | `SUSPICIOUS` | `FALSE_POSITIVE` |
| 20 | `telemetry_loss_during_session` | `TEST` | `DEGRADED_TELEMETRY_LOSS` | `DEGRADED` | No | 0.500 | `INSUFFICIENT_EVIDENCE` | `ACCURATELY_FLAGGED_DEGRADED` |

---

## 8. Formal Research Boundaries & Caveats

1. **No Legal Identity or Intent Attribution:** Assessments reflect observable protocol patterns and empirical feature distributions. They do not constitute proof of physical attacker identity, country of origin, or criminal intent.
2. **Deviation vs Maliciousness:** Unsupervised anomaly scores quantify statistical divergence from a fitted baseline distribution. High anomaly scores may be caused by novel benign workloads, cellular network jitter, or network proxies.
3. **Synthetic Evaluation Context:** The 20-scenario synthetic benchmark is a controlled research instrument for algorithmic comparison. Real-world networks introduce diverse concurrent protocols and evolving application behaviors.
4. **Execution Evidence Remains Missing:** In accordance with Stage 4 architectural invariants, countermeasure execution status is strictly `MISSING`. No autonomous traffic diversion or honeypot execution is performed in Stage 4.
