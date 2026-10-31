# Behavioral Telemetry Normalization and Feature Extraction Engine
## Stage 4B — Adaptive Cyber Deception Gateway

> **Research Prototype Disclaimer**
> This subsystem is a deterministic behavioral telemetry normalization, session correlation, and time-windowed feature extraction engine. It transforms raw gateway reverse proxy observations into structured, privacy-preserving behavioral feature sets for downstream machine learning consumption. It does **not** perform live ML inference, dynamic classification, or automated honeynet deployment in this stage.

---

## 1. Subsystem Architecture

The Stage 4B Behavioral Telemetry Engine operates within the backend management platform to bridge gateway runtime observations and future ML detection models:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          GATEWAY RUNTIME INGRESS                            │
│  - Observes HTTP requests & responses                                      │
│  - Bounded memory queue (max 1000 items) with explicit data-loss signaling  │
│  - Zero-credential guarantee: omits cookies, auth headers, request bodies   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP POST (Internal Service Token)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       CANONICAL EVENT NORMALIZATION                         │
│  - Semver schema enforcement ('1.0.0')                                      │
│  - UTC ISO timestamp normalization                                          │
│  - Route template normalization (parameterizes numeric IDs and UUIDs to :id)│
│  - Non-attributive source metadata (/24 or /48 subnet hashing)              │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       BEHAVIORAL SESSION CORRELATION                        │
│  - Explicit application session token handling (confidence: 1.0)            │
│  - Ephemeral pseudonymous heuristic fallback (confidence: 0.5)              │
│  - Inactivity timeout tracking (default 15m) and epoch rotation             │
│  - NAT / Shared-IP disambiguation (an IP is NEVER an attacker identity)     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                    ┌──────────────────┴──────────────────┐
                    ▼                                     ▼
┌──────────────────────────────────────┐┌──────────────────────────────────────┐
│       RAW OBSERVATION STORE          ││      BEHAVIORAL FEATURE EXTRACTOR    │
│  - SecurityObservation (PostgreSQL)  ││  - Multi-window sliding evaluation   │
│  - Append-only provenance recording  ││    (30s, 5m, 15m windows)            │
│  - Idempotent on correlation ID      ││  - 20+ request, endpoint & failure   │
│  - Never overwritten with features   ││    behavioral metrics                │
└──────────────────────────────────────┘└──────────────────┬───────────────────┘
                                                           │
                                                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FEATURE STORE & BASELINES                            │
│  - BehavioralFeatureSet: Idempotent compound key:                           │
│    (tenantId, applicationId, sessionRef, windowLabel, windowEnd)            │
│  - BehavioralBaseline: Clean calibration (min 50 observations, no 4xx/5xx)  │
│  - Tenant-isolated REST APIs: GET /features, GET /baselines, POST /calibrate│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Canonical Telemetry Event Schema (`v1.0.0`)

All ingress gateway telemetry is validated and transformed into the strict, immutable Canonical Telemetry Event format defined in `backend/src/telemetry/canonical-event.schema.js`:

| Field | Type | Required | Constraints / Validation | Description |
| :--- | :--- | :--- | :--- | :--- |
| `eventId` | UUID v4 | Yes | Valid UUID string | Unique identifier for the canonical telemetry event. |
| `schemaVersion` | String | Yes | Strictly `'1.0.0'` | Semver version; unsupported versions are rejected. |
| `correlationId` | String | Yes | 8 to 64 chars (`[a-zA-Z0-9_\-.]`) | Cross-system correlation identifier (propagated downstream). |
| `tenantId` | UUID / String | Yes | Non-empty string | Target tenant boundary; verified against application mapping. |
| `applicationId` | UUID / String | No | Null or valid UUID | Protected application ID (null for unmapped gateway ingress). |
| `timestamp` | ISO-8601 UTC | Yes | Parseable Date string | Immutable event timestamp normalized to UTC format (`...Z`). |
| `httpMethod` | String | Yes | `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS` | Standard HTTP method allowlist. |
| `normalizedRoute` | String | Yes | Normalized route template | Query strings stripped, dynamic IDs parameterized to `:id`. |
| `responseStatus` | Integer | Yes | `100 <= status <= 599` | Downstream HTTP response code returned by proxy. |
| `requestSizeBytes` | Integer | Yes | `>= 0` | Ingress request payload length in bytes. |
| `responseSizeBytes`| Integer | Yes | `>= 0` | Upstream response payload length in bytes. |
| `durationMs` | Float | Yes | `>= 0.0` | Round-trip request processing duration in milliseconds. |
| `forwardingResult` | Enum | Yes | `SUCCESS`, `TIMEOUT`, `CONNECTION_REFUSED`, `SSRF_BLOCKED`, etc. | Upstream transport outcome. |
| `validationOutcome`| Enum | Yes | `VALIDATED`, `UNKNOWN_HOST`, `REQUEST_SMUGGLING_DETECTED`, etc. | Gateway ingress security check result. |
| `sessionReference` | String | No | String or null | Explicit application session reference or pseudonymous key. |
| `sourceMetadata` | Object | Yes | `{ clientIpType, ipSubnetHash, isLoopbackOrPrivate }` | Non-attributive subnet hash (no raw IP storage). |
| `provenance` | Object | Yes | `{ subsystem, ingressNode, normalizedAt }` | Recording subsystem metadata. |
| `persistenceStatus`| Enum | Yes | `TELEMETRY_PERSISTED`, `TELEMETRY_PENDING`, `TELEMETRY_PERSISTENCE_FAILED`, `NOT_RECORDED` | Status of telemetry persistence. |

### Privacy & Zero-Credential Enforcement
The canonical validator executes recursive key inspections. If any forbidden credential key (`password`, `authorization`, `cookie`, `set-cookie`, `token`, `apiKey`, `rawBody`) is present in the payload, the event is immediately rejected with `CREDENTIAL_LEAK_PREVENTED`.

---

## 3. Behavioral Session Correlation Strategy

Because reverse proxy traffic often lacks explicit application-level session tokens, Stage 4B implements a dual-mode correlation engine:

```
                              INCOMING CANONICAL EVENT
                                         │
                        Is explicit sessionReference provided?
                                       ┌─┴─┐
                                  YES ┌┘   └┐ NO
                                      ▼     ▼
                        [EXPLICIT SESSION]  [PSEUDONYMOUS HEURISTIC]
                        Confidence: 1.0     Confidence: 0.5
                        No caveats          Caveats:
                                            - SHARED_NAT_COLLISION_POSSIBLE
                                            - EPHEMERAL_WINDOW_BOUNDED
                                            - NOT_PERMANENT_INDIVIDUAL_IDENTITY
                                      │     │
                                      ▼     ▼
                        Check Session Inactivity Timeout (15 min)
                                       ┌─┴─┐
                       Within 15 min  ┌┘   └┐ Exceeded 15 min
                                      ▼     ▼
                          [ACCUMULATE EVENT]  [ADVANCE EPOCH & ROTATE]
                          Increment count     Generate new epoch key
                          Update lastActive   Link predecessor sessionRef
```

### NAT / Shared-IP Disambiguation Principles
1. **Never Attribute IP to an Attacker:** In modern enterprise environments, mobile carrier networks, and cloud proxies, hundreds of distinct client devices share an identical public IP via Carrier-Grade NAT (CGNAT) or corporate egress gateways. Treating an IP address as a persistent attacker profile causes catastrophic false-positive correlation.
2. **Distinct Architectural Entities:**
   - **`clientSessionRef`**: Ephemeral tracking handle for a cohesive sequence of requests.
   - **`networkSource`**: Classification of subnet type (`IPV4`, `IPV6`, `LOOPBACK`) and subnet hash.
   - **`investigation`**: Analyst-managed operational dossier.
   - **`attackerProfile`**: Abstract behavioral cluster (never mapped 1:1 to a physical person or IP).

---

## 4. Feature Dictionary

Every computed behavioral feature conforms to a structured schema:

```json
{
  "name": "request_rate_per_sec",
  "value": 0.1667,
  "type": "RATE",
  "unit": "req/s",
  "timeWindow": "30s",
  "observationCount": 5,
  "provenance": "computed_from_canonical_observations",
  "missingDataStatus": "COMPLETE"
}
```

### Complete Feature Dictionary Table

| Feature Name | Type | Unit | Default Windows | Mathematical Formula / Definition | Interpretation Limits & Caveats |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`request_count`** | `COUNTER` | `count` | 30s, 5m, 15m | \( N \) (total observations in window) | Pure volume metric; high values can represent legitimate asset prefetching or polling. |
| **`request_rate_per_sec`** | `RATE` | `req/s` | 30s, 5m, 15m | \( \frac{N}{\Delta t_{\text{window}}} \) | Pacing metric; legitimate bursts occur during page initialization. |
| **`burst_frequency_max_1s`**| `COUNTER` | `req/s_peak` | 30s, 5m, 15m | \( \max_{t \in \text{window}} (\text{count in } [t, t+1s]) \) | Peak burstiness; scripts and crawlers often exceed 20 req/s. |
| **`inter_request_interval_mean_ms`** | `DURATION_MS`| `ms` | 30s, 5m, 15m | \( \frac{1}{N-1} \sum_{i=1}^{N-1} (t_{i+1} - t_i) \) | Average pause between requests; null if \( N \le 1 \). |
| **`inter_request_interval_variance_ms`** | `STATISTIC` | `ms^2` | 30s, 5m, 15m | \( \frac{1}{N-1} \sum ( (t_{i+1} - t_i) - \bar{\Delta t} )^2 \) | Variance in pacing; near-zero variance indicates automated scripting without human jitter. |
| **`http_method_distribution`** | `DISTRIBUTION` | `ratio_map`| 30s, 5m, 15m | \( \{ m: \frac{\text{count}(m)}{N} \} \) | Method breakdown; excessive non-GET/POST methods indicates scanning. |
| **`response_status_distribution`** | `DISTRIBUTION` | `ratio_map`| 30s, 5m, 15m | \( \{ \text{class}: \frac{\text{count}(\text{class})}{N} \} \) | Status class ratios (`2xx`, `3xx`, `4xx`, `5xx`). |
| **`unique_endpoint_count`** | `COUNTER` | `count` | 30s, 5m, 15m | \( \| \{ \text{normalizedRoute}_i \} \| \) | Breadth of traversal across route templates. |
| **`endpoint_diversity_ratio`** | `RATIO` | `ratio [0-1]` | 30s, 5m, 15m | \( \frac{\text{unique\_endpoints}}{N} \) | Close to 1.0 indicates crawling; close to 0.0 indicates hammering a single route. |
| **`repeated_endpoint_ratio`** | `RATIO` | `ratio [0-1]` | 30s, 5m, 15m | \( \frac{\max_{\text{route}} \text{count}(\text{route})}{N} \) | Route concentration; high values signify focused brute-force or hammering. |
| **`unusual_route_ratio`** | `RATIO` | `ratio [0-1]` | 30s, 5m, 15m | \( \frac{\text{count}(status = 404)}{N} \) | Ratio of nonexistent endpoints accessed. |
| **`resource_enumeration_score`** | `SCORE` | `score [0-1]` | 30s, 5m, 15m | \( \min(1.0, \frac{\text{unique}}{5}) \cdot 0.5 + \text{unusual\_ratio} \cdot 0.5 \) | Composite heuristic for directory spidering; measurement only, not a verdict. |
| **`http_4xx_ratio`** | `RATIO` | `ratio [0-1]` | 30s, 5m, 15m | \( \frac{\text{count}(400 \le status < 500)}{N} \) | Overall client error frequency. |
| **`http_5xx_ratio`** | `RATIO` | `ratio [0-1]` | 30s, 5m, 15m | \( \frac{\text{count}(500 \le status < 600)}{N} \) | Server/upstream error frequency. |
| **`client_error_count`** | `COUNTER` | `count` | 30s, 5m, 15m | \( \text{count}(400 \le status < 500) \) | Absolute number of client errors in window. |
| **`repeated_not_found_count`**| `COUNTER` | `count` | 30s, 5m, 15m | \( \text{count}(status = 404) \) | Raw count of 404 responses. |
| **`auth_failure_count`** | `COUNTER` | `count` | 30s, 5m, 15m | \( \text{count}(status \in \{401, 403\}) \) | Authentication and permission rejections. |
| **`upstream_failure_count`** | `COUNTER` | `count` | 30s, 5m, 15m | \( \text{count}(status \in \{502, 503, 504\}) \) | Gateway proxy upstream connectivity failures. |
| **`rate_delta_vs_baseline`** | `DELTA` | `req/s` | 30s, 5m, 15m | \( \text{rate}_{\text{window}} - \text{rate}_{\text{baseline}} \) | Pacing deviation from normal baseline; `null` if no established baseline. |
| **`endpoint_diversity_delta`** | `DELTA` | `ratio` | 30s, 5m, 15m | \( \text{div}_{\text{window}} - \text{div}_{\text{baseline}} \) | Route diversity shift vs normal baseline. |
| **`failure_ratio_delta`** | `DELTA` | `ratio` | 30s, 5m, 15m | \( \text{ratio4xx}_{\text{window}} - \text{ratio4xx}_{\text{baseline}} \) | Error rate deviation vs normal baseline. |

---

## 5. Time-Window Selection Rationale

Three distinct evaluation windows are extracted concurrently:
1. **`30s` (Immediate Probe / Burst Window):**
   - Captures high-frequency automated scraping, brute-force bursts, and credential stuffing.
   - Rapidly reflects changes in request rate before a session can rotate.
2. **`5m` (Session Interaction Window):**
   - Captures human browsing workflows, typical single-task durations, and directory enumeration spidering patterns.
   - Provides statistical stability for method and status distributions.
3. **`15m` (Session Lifecycle Window):**
   - Matches the standard session inactivity timeout.
   - Detects low-and-slow reconnaissance, slowloris scans, and stealthy crawling across a full interaction.

---

## 6. Baseline Computation Methodology

To calculate valid deltas, the system establishes statistical baselines per tenant and application:

### Contamination Defense Rules
To prevent an active attacker from poisoning the baseline:
1. **Eligibility Filter:** Only observations meeting all criteria are included:
   - `validationOutcome === 'VALIDATED'`
   - `responseStatus < 400` (zero 4xx or 5xx errors)
   - `forwardingResult === 'SUCCESS'`
2. **Minimum Observation Threshold:** Minimum **50 clean observations** required.
   - If clean count < 50: Baseline is marked `CALIBRATING` and deltas report `NO_BASELINE`.
   - If clean count >= 50: Baseline transitions to `ESTABLISHED`.
3. **Deterministic Rebuilding:** Re-running calibration over the same historical observations yields identical baseline metrics.

---

## 7. Telemetry Reliability, Bounded Queueing & Explicit Data Loss

### Gateway In-Memory Queue Hardening
In `gateway/src/services/telemetry-recorder.service.js`:
- Queue capacity is strictly bounded (`MAX_QUEUE_SIZE = 1000`).
- If backend connectivity is lost, events are queued in memory.
- If queue reaches 1000 items, the oldest event is dropped, and an **explicit telemetry-loss signal** is logged:
  ```json
  {
    "severity": "WARN",
    "message": "TELEMETRY_DATA_LOSS: Queue capacity exceeded; dropping oldest record to prevent memory exhaustion",
    "droppedCorrelationId": "corr-1234",
    "tenantId": "tenant-apex",
    "queueDepth": 1000,
    "maxQueueSize": 1000,
    "reason": "QUEUE_CAPACITY_EXCEEDED"
  }
  ```
- Diagnostic metrics tracked: `totalIngested`, `totalPersisted`, `persistenceFailures`, `droppedEventCount`, `duplicateEventCount`, `retryCount`, `hasDataLoss`.

---

## 8. Synthetic Research Evaluation Dataset (10 Scenarios)

Created in `backend/src/telemetry/synthetic-evaluation-dataset.js`:

1. **`normal_browsing`**: 30 requests over 5m, human jitter (2s–6s intervals), 200 OKs, multi-endpoint traversal.
2. **`repeated_login_failures`**: 15 requests in 45s to `/api/v1/auth/login`, 100% 401s, fixed 2.5s pacing.
3. **`endpoint_enumeration`**: 25 requests in 10s hitting sensitive routes (`/.env`, `/.git`, `/admin`), 100% 404s.
4. **`high_frequency_burst`**: 50 requests in 2 seconds, burst frequency > 25 req/s.
5. **`repeated_not_found`**: 20 requests targeting identical dead link (`/export-dead-link`), 100% 404s.
6. **`unusual_method_distribution`**: 24 requests with heavy DELETE, PATCH, and HEAD verbs.
7. **`slow_irregular_probing`**: 10 requests spaced 60s to 180s apart (covert low-and-slow reconnaissance).
8. **`sudden_behavioral_change`**: 10 normal browsing requests suddenly pivoting into 15 rapid scanning requests.
9. **`shared_ip_distinct_sessions`**: 3 distinct sessions (`user-alpha`, `user-beta`, `user-gamma`) sharing IP `203.0.113.50`.
10. **`incomplete_telemetry`**: Observations with missing optional fields to verify pipeline resilience.

---

## 9. Verification & Automated Test Coverage

Verified via automated test suites:

| Test Suite | File | Tests | Coverage Scope |
| :--- | :--- | :--- | :--- |
| **Canonical Schema** | `backend/tests/canonical-telemetry-schema.test.js` | 8 | Semver validation, route normalization, range checks, zero credentials, PII omission. |
| **Session Correlation** | `backend/tests/behavioral-session-correlator.test.js`| 6 | Explicit tokens, pseudonymous fallback, inactivity timeout, epoch rotation, NAT disambiguation. |
| **Feature Extraction** | `backend/tests/behavioral-feature-extractor.test.js` | 7 | 30s/5m/15m windows, rate, burst, interval mean/variance, diversity, enumeration, baseline deltas. |
| **Baseline Service** | `backend/tests/behavioral-baseline.test.js` | 4 | Threshold calibration, contamination defense, deterministic rebuilding. |
| **Reliability & Data Loss** | `backend/tests/telemetry-reliability-and-loss.test.js`| 3 | Queue overflow, explicit loss signals, diagnostic metrics, deduplication. |
| **Synthetic Dataset** | `backend/tests/synthetic-evaluation-dataset.test.js` | 9 | Ground-truth separation, all 10 scenario pipeline executions. |
| **REST APIs** | `backend/tests/behavioral-features-api.test.js` | 6 | Authenticated tenant-scoped query endpoints, pagination, cross-tenant isolation, calibration. |

---

## 10. Known Limitations & Roadmap to Stage 5

1. **No Live ML Classification:** Stage 4B provides data normalization and feature engineering. Statistical metrics and heuristic scores are measurements, not automated classification decisions.
2. **No Honeynet Provisioning:** Deception diversion outcomes remain simulated; container decoying is deferred to Stage 5.
3. **In-Memory Active Correlation:** Session correlation tracking uses a bounded in-memory LRU map. High-availability Redis clustering for multi-node deployments is a future production enhancement.
