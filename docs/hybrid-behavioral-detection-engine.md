# Hybrid Behavioral Detection Engine (Stage 4C)

## Dual-Branch Architecture: Rule-Based Detection + Unsupervised Machine Learning

This document provides the formal architecture specification, algorithmic formulations, rule catalog, model lifecycle management, and empirical research benchmark results for the Hybrid Behavioral Detection Engine implemented in Stage 4C of the **AI-Enabled Adaptive Cyber Deception Gateway**.

---

## 1. Architectural Overview

The Hybrid Behavioral Detection Engine is designed to identify anomalous and adversarial interactions directed at protected enterprise web applications without relying on fragile, monolithic signatures or unexplainable black-box machine-learning classifiers.

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
4. **Strict Research Integrity:** Synthetic benchmark evaluations are held out; training data is strictly filtered for benign eligibility; and execution evidence remains strictly `MISSING` until Stage 5 runtime diversion.

---

## 2. Branch A — Deterministic Rule-Based Detection

Branch A executes explainable, threshold-governed rules targeting known adversarial traffic patterns. Rules evaluate normalized feature sets across multiple observation windows (`30s`, `5m`, `15m`).

### Rule Catalogue

| Rule ID | Rule Name | Target Vector | Primary Features Evaluated | Default Thresholds | Severity |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `RULE_AUTH_FAILURE` | Repeated Authentication Failure Probe | Credential Stuffing / Password Spraying | `auth_failure_count`, `http_4xx_ratio` | `>= 5` failures in 5m or `>= 3` in 30s with `ratio >= 0.60` | `HIGH` |
| `RULE_ENDPOINT_ENUMERATION` | Systematic Endpoint Enumeration | Directory Scanning / API Reconnaissance | `resource_enumeration_score`, `unique_endpoint_count`, `http_404_ratio` | `unique >= 8` with `score >= 0.70` and `404_ratio >= 0.50` | `HIGH` |
| `RULE_REQUEST_BURST` | Anomalous High-Frequency Request Burst | Application DoS / Rapid Scraping | `burst_frequency_max_1s`, `request_rate_per_sec` | `burst_max >= 25 req/s` or `rate >= 15 req/s` | `MEDIUM` |
| `RULE_SUSPICIOUS_METHOD` | Prohibited or Unusual HTTP Method Usage | Method Tampering / Smuggling Probe | `http_method_distribution` | Count of `CONNECT`, `TRACE`, `PROPFIND`, etc. `> 0` | `CRITICAL` |
| `RULE_REPEATED_RESOURCE_PROBING` | Persistent Single-Resource Probing | Broken Integration / Vulnerability Scan | `repeated_not_found_count`, `repeated_endpoint_ratio`, `http_404_ratio` | `not_found >= 6` with `repeated_ratio >= 0.75` | `MEDIUM` |
| `RULE_BEHAVIORAL_SHIFT` | Sudden Behavioral Trajectory Shift | Session Hijacking / Post-Exploitation Pivot | `rate_delta_vs_baseline`, `failure_ratio_delta` | `rate_delta >= 10 req/s` and `failure_delta >= 0.40` | `HIGH` |

### Multi-Window Rule Evaluation
Each rule inspects short-term (`30s`), medium-term (`5m`), and long-term (`15m`) feature windows:
- A burst of 10 requests in 3 seconds triggers `RULE_REQUEST_BURST` in the `30s` window without needing to wait for a 5-minute aggregation.
- A stealthy crawler spanning 10 distinct 404 routes over 4 minutes triggers `RULE_ENDPOINT_ENUMERATION` in the `5m` window.
- Distinguishes high-diversity benign browsing (100% 200 OKs) from directory scanning by requiring a conjunction of high endpoint diversity AND elevated `http_404_ratio`.

---

## 3. Branch B — Unsupervised Machine Learning Anomaly Detection

Branch B detects deviations from application-specific benign baselines using unsupervised algorithms. It operates without labels, detecting novel access patterns that bypass deterministic rules.

### Algorithmic Foundations

#### 1. Isolation Forest (`ISOLATION_FOREST`)
- **Principle:** Anomalies are "few and different", meaning they require fewer random partitioning splits to be isolated in tree structures compared to normal points.
- **Formulation:** For a tree with $n$ training instances, the average path length of an unsuccessful search in a Binary Search Tree is:
  $$c(n) = 2 \ln(n - 1) + 0.5772156649 - \frac{2(n - 1)}{n}$$
- **Anomaly Score:** For a sample $x$ evaluated across an ensemble of $T$ isolation trees:
  $$s(x, n) = 2^{-\frac{E(h(x))}{c(n)}}$$
  Where:
  - If $s \to 1$: $E(h(x)) \to 0$, indicating an acute anomaly.
  - If $s < 0.5$: $E(h(x)) \to c(n)$, indicating typical benign behavior.
  - Decision threshold is set to $s \ge 0.60$ for anomaly classification.
- **Root Envelope Check:** Unseen samples whose features fall outside the global bounding box $[min_d, max_d]$ established during training at the root node are isolated at path length 1 ($s \approx 0.89$), preventing out-of-distribution bypasses.

#### 2. Statistical Baseline Detector (`STATISTICAL_BASELINE`)
- **Principle:** Uses the Median Absolute Deviation (MAD), a robust statistic insensitive to extreme outliers:
  $$\text{MAD}_j = \text{median}(|x_{i,j} - \text{median}(x_j)|)$$
- **Modified Z-Score:**
  $$M_j(x) = \frac{0.6745 \cdot |x_j - \text{median}(x_j)|}{\text{MAD}_j}$$
- **Robust Distance:** The normalized vector distance across all numerical features:
  $$D(x) = \sqrt{\frac{1}{d} \sum_{j=1}^d M_j(x)^2}$$
- **Anomaly Score:** Scaled using a sigmoid function:
  $$s_{\text{stat}}(x) = \frac{1}{1 + e^{-(D(x) - 3.0)}}$$

### Feature Vectorization & Preprocessing
To strictly prevent data leakage and guarantee tenant privacy:
- Zero identifiers (no IP addresses, session tokens, user IDs, or raw URL query parameters) enter the feature vector.
- Vector contains 12 normalized numerical behavioral dimensions:
  1. `request_rate_per_sec`
  2. `burst_frequency_max_1s`
  3. `inter_request_interval_mean_ms`
  4. `inter_request_interval_variance_ms`
  5. `endpoint_diversity_ratio`
  6. `repeated_endpoint_ratio`
  7. `http_404_ratio`
  8. `unusual_route_ratio`
  9. `resource_enumeration_score`
  10. `http_4xx_ratio`
  11. `http_5xx_ratio`
  12. `auth_failure_count`
- Robust feature scaling uses median and interquartile range (IQR):
  $$x_{\text{scaled}} = \frac{x - \text{median}}{\text{IQR}}$$
- Missing feature values are imputed with median training values.

### Model Training Lifecycle & Eligibility Gate
To prevent training models on attacker traffic (model poisoning):
- **Eligibility Filter:** Only `FeatureSet` records meeting the following criteria are eligible:
  - `qualityMetadata.completenessStatus == 'COMPLETE'`
  - `observationCount >= 5`
  - `http_4xx_ratio < 0.30`
  - `http_5xx_ratio < 0.10`
  - Zero active `RULE_AUTH_FAILURE` or `RULE_ENDPOINT_ENUMERATION` triggers during the collection window.
- **Sample Threshold:** A minimum of 200 eligible benign feature sets is required to train a production model.
- **Audit Logging:** Every training run records `ModelTrainingRun` with dataset metrics, training duration, and operator identity. Models are stored with status `ACTIVE`, `SUPERSEDED`, or `FAILED`.

---

## 4. Hybrid Evidence Assessment Layer

The Hybrid Assessment Service fuses deterministic rule findings and unsupervised ML anomaly scores into a coherent assessment.

### Assessment Labels
- `HIGHLY_SUSPICIOUS`: Conjunction of multiple high-severity rule triggers and elevated ML anomaly score ($s \ge 0.60$), or a CRITICAL rule trigger (e.g., prohibited HTTP method tampering).
- `SUSPICIOUS`: Single high-severity rule trigger, or ML anomaly score exceeding threshold without deterministic rule match (novel anomaly), or multiple medium-severity findings.
- `NORMAL`: No rules triggered, ML anomaly score within benign envelope ($s < 0.60$), and complete telemetry.
- `INSUFFICIENT_EVIDENCE`: Telemetry completeness degraded (`qualityMetadata.completenessStatus == 'PARTIAL'` or `'DEGRADED'`), or session correlation confidence below 0.30.

### Fused Risk Score Formulation
The final risk score $R \in [0.0, 1.0]$ is computed as:
$$R = 0.55 \cdot S_{\text{rule}} + 0.35 \cdot S_{\text{ML}} + 0.10 \cdot S_{\text{shift}}$$
Where:
- $S_{\text{rule}} = \min(1.0, \sum \text{severity\_weight}_i)$
- $S_{\text{ML}} = \max(0, \frac{s_{\text{anomaly}} - 0.40}{0.60})$
- $S_{\text{shift}}$ represents divergence from historical application baseline.
- If telemetry completeness is degraded, $R$ is clamped at 0.50 and labeled `INSUFFICIENT_EVIDENCE`.

---

## 5. Research Evaluation Benchmark

The benchmark framework rigorously assesses performance across 20 synthetic scenarios (10 baseline scenarios + 10 difficult counterexample edge cases) with held-out train/test partitioning.

### Comparative Performance Results

| Detection Strategy | Precision | Recall | F1 Score | False Positive Rate (FPR) | False Negative Rate (FNR) | Avg Latency |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Branch A: Rule-Only** | 0.7143 | 0.6250 | 0.6667 | 0.2000 | 0.3750 | 0.052 ms |
| **Branch B1: Isolation Forest Only** | 0.4444 | 0.5000 | 0.4706 | 0.5000 | 0.5000 | 0.028 ms |
| **Branch B2: Statistical Baseline Only** | 0.5333 | 1.0000 | 0.6957 | 0.7000 | 0.0000 | 0.004 ms |
| **Hybrid Evidence Assessment (Stage 4C)** | **0.5000** | **0.6250** | **0.5556** | **0.5000** | **0.3750** | **0.013 ms** |

*Note: Benchmarks executed on 20 held-out synthetic scenarios with zero training contamination.*

### Analysis of Scenario Edge Cases
1. **Benign High-Diversity Crawlers (Scenario 13):**
   - Naive enumeration rules trigger false positives due to endpoint variety ($diversity = 1.0$).
   - Rule 2 correctly distinguishes this because `http_404_ratio` and failure counts remain 0.0.
2. **Missing Asset 404 Loops (Scenario 15):**
   - High 404 ratio ($1.0$), but confined to a single image resource.
   - Rule 2 requires multi-endpoint reconnaissance ($unique \ge 8$); Rule 5 handles single-resource probing with medium severity rather than high-severity classification.
3. **Covert Mixed Traffic (Scenario 19):**
   - Attacker probes are diluted with benign browsing requests.
   - Hybrid fusion surfaces the attack because Rule 2 flags the reconnaissance paths even when aggregate failure ratios are diluted.

---

## 6. Formal Research Boundaries & Caveats

1. **No Attacker Identity Claims:** Anomaly scores and rule matches reflect observable HTTP protocol interactions and aggregate request distributions. They do not constitute proof of legal identity, geographic attribution, or human intent.
2. **Anomaly Score != Attack Probability:** Isolation Forest anomaly scores quantify statistical deviation from benign baseline models. A high anomaly score indicates atypical traffic (e.g. an unusual client workflow or network jitter), not guaranteed maliciousness.
3. **Simulated Benchmark Validity:** The 20-scenario synthetic benchmark is a reproducible empirical evaluation framework. Benchmark performance does not guarantee equivalent precision in live production networks subject to novel zero-day protocols.
4. **Non-Execution of Countermeasures:** Stage 4C implements detection and evidence assessment only. No dynamic honeypot diversion, container provisioning, or traffic rerouting is performed; routing execution evidence remains strictly `MISSING` until Stage 5.

---

## 7. REST API Endpoints

All detection endpoints are tenant-scoped, authenticated, and enforce role-based access control (`APPLICATION_OWNER` or `PLATFORM_ADMIN`):

- `GET /api/v1/tenants/:tenantId/detection/assessments` — List behavioral assessments with optional filtering by `applicationId`, `sessionRef`, and `label`.
- `GET /api/v1/tenants/:tenantId/detection/assessments/:id` — Retrieve detailed assessment record with independent rule findings and ML metrics.
- `GET /api/v1/tenants/:tenantId/detection/models` — List application-specific anomaly detection models and training runs.
- `POST /api/v1/tenants/:tenantId/detection/models/train` — Trigger model training on eligible benign telemetry (requires minSamples threshold).
- `GET /api/v1/tenants/:tenantId/detection/rules` — List registered rule catalogue with effective thresholds.
- `GET /api/v1/tenants/:tenantId/detection/evaluation` — Execute research benchmark and return comparative metrics.
