# Behavioral Telemetry Normalization, Integrity, and Feature Extraction Engine
## Stage 4B & 4B.1 — Adaptive Cyber Deception Gateway

> **Research Prototype & Integrity Disclaimer**
> This subsystem is a deterministic behavioral telemetry normalization, session correlation, baseline calibration, and time-windowed feature extraction engine. It transforms raw gateway reverse-proxy observations into mathematically reproducible, privacy-preserving behavioral feature sets for downstream machine learning research.
>
> **Strict Research Boundaries:**
> - **No Live ML Classification:** This engine performs feature engineering and statistical calibration only. It does not perform live ML inference, dynamic attacker classification, anomaly scoring, or automated honeynet deployment.
> - **No IP-to-Attacker Attribution:** IP addresses represent network transit points (often shared via CGNAT, cloud proxies, or corporate egress). An IP address is never treated as an individual attacker identity.
> - **Execution Evidence Remains `MISSING`:** As established in Gateway Stage 4A/4A.1, execution evidence regarding decoy responses or attacker entrapment remains strictly `MISSING` until the deception execution runtime is built in Stage 5.
> - **No Guaranteed Delivery Claims:** Telemetry reliability is explicitly bounded; process failures, queue saturations, and network partitions trigger observable data-loss events rather than theoretical zero-loss guarantees.

---

## 1. Subsystem Architecture & Ingress Flow

The Stage 4B/4B.1 telemetry engine bridges the gateway reverse-proxy runtime and future machine learning models:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          GATEWAY RUNTIME INGRESS                            │
│  - Receives HTTP requests before proxy routing                              │
│  - Ingress Validation: checks method, headers, smuggling, payload size      │
│  - REJECTED-REQUEST TELEMETRY: If invalid (e.g. TRACE, smuggling, bad host), │
│    records safe security observation IMMEDIATELY before closing socket.     │
│    Upstream origin is NEVER invoked for rejected requests.                  │
│  - Zero-Credential Guarantee: Cookies, Auth headers, and bodies are STRIPPED │
│  - Bounded memory queue (max 1000 items) + Durable Loss Persistence File    │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP POST (Internal Gateway Service Token)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       CANONICAL EVENT NORMALIZATION                         │
│  - Semver schema enforcement ('1.0.0')                                      │
│  - UTC ISO timestamp normalization                                          │
│  - Route template normalization (parameterizes numeric IDs and UUIDs to :id)│
│  - Flexible HTTP method token validation (accepts TRACE, CONNECT, etc.)     │
│  - Non-attributive source metadata (/24 IPv4 or /48 IPv6 subnet hashing)    │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       BEHAVIORAL SESSION CORRELATION                        │
│  - Keyed HMAC-SHA256 pseudonymization with tenant-isolated secret keys      │
│  - Raw credential & auth header protection (never hashed or leaked)         │
│  - Demotion of unverified client headers to UNTRUSTED_CLIENT_SESSION_METADATA│
│    (confidence 0.4, caveats attached, high collision risk)                  │
│  - Inactivity timeout tracking (15m sliding window) and epoch rotation      │
│  - Explicit collision risk metadata (LOW, MEDIUM, HIGH)                     │
│  - Non-attributive guarantee (isAttackerIdentity: false)                    │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                    ┌──────────────────┴──────────────────┐
                    ▼                                     ▼
┌──────────────────────────────────────┐┌──────────────────────────────────────┐
│       RAW OBSERVATION STORE          ││      BEHAVIORAL FEATURE EXTRACTOR    │
│  - SecurityObservation (PostgreSQL)  ││  - Multi-window sliding evaluation   │
│  - Append-only provenance recording  ││    (30s, 5m, 15m windows)            │
│  - Idempotent on correlation ID      ││  - Out-of-order sorting & Δt=0 guard │
│  - Rejected-request telemetry status ││  - Robust resource enumeration score │
│  - Collision risk & caveats persisted││  - Telemetry loss propagation        │
└──────────────────────────────────────┘└──────────────────┬───────────────────┘
                                                           │
                                                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FEATURE STORE & BASELINES                            │
│  - Multi-Dimensional Calibration Quality (count >= 50, duration >= 3600s,   │
│    trusted provenance, complete telemetry, freshness check)                 │
│  - Error Separation: Legitimate 404/401 errors INCLUDED in normal baseline; │
│    only validation failures and security probes EXCLUDED                    │
│  - Baseline Lifecycle: CALIBRATING -> ESTABLISHED -> STALE / INVALID        │
│  - Delta Protection: Non-ESTABLISHED baselines return null deltas           │
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
| `httpMethod` | String | Yes | Regex `^[A-Z]{3,16}$` | Valid HTTP method token (supports standard verbs and observed rejected methods like `TRACE`, `CONNECT`). |
| `normalizedRoute` | String | Yes | Normalized route template | Query strings stripped, dynamic IDs parameterized to `:id`. |
| `responseStatus` | Integer | Yes | `100 <= status <= 599` | Downstream HTTP response code returned by proxy or gateway. |
| `requestSizeBytes` | Integer | Yes | `>= 0` | Ingress request payload length in bytes. |
| `responseSizeBytes`| Integer | Yes | `>= 0` | Upstream or gateway response payload length in bytes. |
| `durationMs` | Float | Yes | `>= 0.0` | Round-trip request processing duration in milliseconds. |
| `forwardingResult` | Enum | Yes | `SUCCESS`, `TIMEOUT`, `CONNECTION_REFUSED`, `SSRF_BLOCKED`, `INGRESS_REJECTED`, etc. | Transport or proxy outcome. |
| `validationOutcome`| Enum | Yes | `VALIDATED`, `UNKNOWN_HOST`, `REQUEST_SMUGGLING_DETECTED`, `METHOD_NOT_ALLOWED`, `INVALID_HEADERS`, etc. | Gateway ingress security check result. |
| `sessionReference` | String | No | String or null | Explicit application session reference or pseudonymous key. |
| `sourceMetadata` | Object | Yes | `{ clientIpType, ipSubnetHash, isLoopbackOrPrivate }` | Non-attributive subnet hash (no raw IP storage). |
| `provenance` | Object | Yes | `{ subsystem, ingressNode, normalizedAt }` | Recording subsystem metadata. |
| `persistenceStatus`| Enum | Yes | `TELEMETRY_PERSISTED`, `TELEMETRY_PENDING`, `TELEMETRY_PERSISTENCE_FAILED`, `NOT_RECORDED` | Status of telemetry persistence. |

### Privacy & Zero-Credential Enforcement
The canonical validator executes recursive key inspections. If any forbidden credential key (`password`, `authorization`, `cookie`, `set-cookie`, `token`, `apiKey`, `rawBody`) is present in the payload, the event is immediately rejected with `CREDENTIAL_LEAK_PREVENTED`.

---

## 3. Hardened Behavioral Session Correlation Model

Because reverse proxy traffic frequently lacks verified application-level session tokens, Stage 4B.1 implements a multi-tier, privacy-preserving session correlation engine:

```
                              INCOMING CANONICAL EVENT
                                         │
                        Is verified session token available?
                                       ┌─┴─┐
                       VERIFIED TOKEN ┌┘   └┐ NO VERIFIED TOKEN
                                      ▼     ▼
                        [EXPLICIT SESSION]  Is unverified client header present?
                        Confidence: 0.95    (e.g., X-Session-ID, custom header)
                        Collision: LOW                 ┌─┴─┐
                                                  YES ┌┘   └┐ NO
                                                      ▼     ▼
                                   [UNTRUSTED CLIENT HEADER] [PSEUDONYMOUS HEURISTIC]
                                   Confidence: 0.40          Confidence: 0.45
                                   Collision: HIGH           Collision: MEDIUM
                                   Caveat: CLIENT_CONTROLLED Caveat: SHARED_NAT_COLLISION
                                                      │     │
                                                      └─────┤
                                                            ▼
                                              Check 15-Minute Inactivity Window
                                                             ┌─┴─┐
                                             Within 15 min  ┌┘   └┐ Exceeded 15 min
                                                            ▼     ▼
                                                [ACCUMULATE EVENT]  [ADVANCE EPOCH & ROTATE]
                                                Increment count     Generate new epoch key
                                                Update lastActive   Link predecessor sessionRef
```

### Key Hardening Properties

1. **Keyed HMAC-SHA256 Pseudonymization with Tenant Isolation:**
   - Session handles are generated via HMAC-SHA256:
     $$\text{pseudonym} = \text{HMAC-SHA256}(K_{\text{tenant}}, \text{tenantId} \parallel \text{clientEntropy} \parallel \text{epoch})$$
   - Tenant secret keys ($K_{\text{tenant}}$) are derived independently using HKDF / PBKDF2 with tenant-isolated salts.
   - Cross-tenant linkability is mathematically prevented: identical client entropy across different tenants yields completely orthogonal pseudonyms.

2. **Raw Credential & Authorization Header Protection:**
   - Client headers containing raw authorization credentials (such as `Bearer` tokens, basic auth, or cookie strings) are strictly prohibited from being used as correlation entropy.
   - Raw credentials are never hashed directly, stored in memory tables, or persisted in session metadata.

3. **Unverified Client Header Demotion:**
   - If an event supplies an unverified client-provided header (e.g. `X-Session-ID`, `X-Client-Trace`), it is classified as `UNTRUSTED_CLIENT_SESSION_METADATA`.
   - Confidence is demoted to $0.40$, collision risk is flagged as `HIGH`, and caveats explicitly note `UNVERIFIED_CLIENT_CONTROLLED_METADATA`.

4. **Inactivity Timeout & Epoch Rotation:**
   - Inactivity timeout: 15 minutes (900 seconds) sliding window.
   - If no request arrives within 15 minutes, the active session expires, and subsequent requests advance the epoch ($e \leftarrow e + 1$), generating a new distinct session handle.

5. **Collision Risk Metadata & Non-Attribution Guarantee:**
   - Every correlation result emits an explicit `collisionRisk` rating:
     - `LOW`: Strong, cryptographically verified session token.
     - `MEDIUM`: Multi-factor heuristic (subnet hash + user-agent hash + epoch).
     - `HIGH`: Coarse subnet or unverified client-controlled header.
   - Every session object explicitly sets `isAttackerIdentity: false`, enforcing the principle that network session handles represent observed traffic conduits, not individual human or legal entities.

---

## 4. Complete Mathematical Feature Specification

Every computed behavioral feature conforms to a structured schema:

```json
{
  "name": "resource_enumeration_score",
  "value": 0.4500,
  "type": "SCORE",
  "unit": "score [0-1]",
  "timeWindow": "5m",
  "observationCount": 20,
  "provenance": "computed_from_canonical_observations",
  "missingDataStatus": "COMPLETE"
}
```

### Mathematical Definitions, Units, and Valid Ranges

| Feature Name | Type | Unit | Range | Mathematical Formula / Definition | Edge Case & Zero Handling |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`request_count`** | `COUNTER` | `count` | $[0, \infty)$ | $N = \sum_{i=1}^{M} 1$ for observations within window $[W_{\text{start}}, W_{\text{end}}]$. | $N = 0$ returns 0. |
| **`request_rate_per_sec`** | `RATE` | `req/s` | $[0, \infty)$ | $\text{Rate} = \frac{N}{\Delta t_{\text{window}}}$ where $\Delta t_{\text{window}} \in \{30, 300, 900\}$. | Window duration is fixed; if $N = 0$, rate is 0.0. |
| **`burst_frequency_max_1s`** | `COUNTER` | `req/1s` | $[0, \infty)$ | $\max_{t \in [W_{\text{start}}, W_{\text{end}}]} \sum_{i} \mathbf{1}_{t_i \in [t, t + 1000\text{ms}]}$. | $N = 0$ returns 0. |
| **`inter_request_interval_mean_ms`** | `DURATION_MS` | `ms` | $[0, \infty)$ | $\bar{\Delta t} = \frac{1}{N - 1} \sum_{i=1}^{N-1} (t_{i+1} - t_i)$ after sorting by timestamp ascending. | If $N < 2$, returns `null`. Duplicate timestamps yield $t_{i+1} - t_i = 0$. |
| **`inter_request_interval_variance_ms`** | `STATISTIC` | `ms^2` | $[0, \infty)$ | $s^2 = \frac{1}{N - 1} \sum_{i=1}^{N-1} ((t_{i+1} - t_i) - \bar{\Delta t})^2$. | If $N < 2$, returns `null`. Sample variance denominator is $N - 1$. |
| **`http_method_distribution`** | `DISTRIBUTION` | `ratio_map` | $[0, 1]$ per verb | $\{ m: \frac{\text{count}(m)}{N} \}$. | If $N = 0$, returns empty mapping `{}`. |
| **`response_status_distribution`** | `DISTRIBUTION` | `ratio_map` | $[0, 1]$ per class | $\{ c: \frac{\text{count}(c)}{N} \}$ for $c \in \{\text{'2xx'}, \text{'3xx'}, \text{'4xx'}, \text{'5xx'}\}$. | If $N = 0$, returns `{ '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 }`. |
| **`unique_endpoint_count`** | `COUNTER` | `count` | $[0, \infty)$ | $U = |\bigcup_{i=1}^N \{ \text{normalizedRoute}_i \}|$. | If $N = 0$, returns 0. |
| **`endpoint_diversity_ratio`** | `RATIO` | `ratio [0-1]` | $[0, 1]$ | $\text{EDR} = \frac{U}{N}$. | If $N = 0$, returns 0.0. |
| **`repeated_endpoint_ratio`** | `RATIO` | `ratio [0-1]` | $[0, 1]$ | $\text{RER} = \frac{\max_{r} \text{count}(r)}{N}$. | If $N = 0$, returns 0.0. |
| **`unusual_route_ratio`** | `RATIO` | `ratio [0-1]` | $[0, 1]$ | $\text{URR} = \frac{\sum_{i=1}^N \mathbf{1}_{\text{status}_i = 404}}{N}$. | If $N = 0$, returns 0.0. |
| **`resource_enumeration_score`** | `SCORE` | `score [0-1]` | $[0, 1]$ | See Detailed Section below. Composite of route breadth and 404 diversity. | Returns 0.0 if $N = 0$ or $U = 0$. Immune to single-endpoint polling and pagination. |
| **`http_4xx_ratio`** | `RATIO` | `ratio [0-1]` | $[0, 1]$ | $\frac{\sum_{i=1}^N \mathbf{1}_{400 \le \text{status}_i < 500}}{N}$. | If $N = 0$, returns 0.0. |
| **`http_5xx_ratio`** | `RATIO` | `ratio [0-1]` | $[0, 1]$ | $\frac{\sum_{i=1}^N \mathbf{1}_{500 \le \text{status}_i < 600}}{N}$. | If $N = 0$, returns 0.0. |
| **`client_error_count`** | `COUNTER` | `count` | $[0, \infty)$ | $\sum_{i=1}^N \mathbf{1}_{400 \le \text{status}_i < 500}$. | If $N = 0$, returns 0. |
| **`repeated_not_found_count`** | `COUNTER` | `count` | $[0, \infty)$ | $\sum_{i=1}^N \mathbf{1}_{\text{status}_i = 404}$. | If $N = 0$, returns 0. |
| **`auth_failure_count`** | `COUNTER` | `count` | $[0, \infty)$ | $\sum_{i=1}^N \mathbf{1}_{\text{status}_i \in \{401, 403\}}$. | If $N = 0$, returns 0. |
| **`upstream_failure_count`** | `COUNTER` | `count` | $[0, \infty)$ | $\sum_{i=1}^N \mathbf{1}_{\text{status}_i \in \{502, 503, 504\}}$. | If $N = 0$, returns 0. |
| **`rate_delta_vs_baseline`** | `DELTA` | `req/s` | $(-\infty, \infty)$ | $\text{Rate}_{\text{window}} - \text{Rate}_{\text{baseline}}$. | Returns `null` if baseline is not `ESTABLISHED`. |
| **`endpoint_diversity_delta`** | `DELTA` | `ratio` | $[-1, 1]$ | $\text{EDR}_{\text{window}} - \text{EDR}_{\text{baseline}}$. | Returns `null` if baseline is not `ESTABLISHED`. |
| **`failure_ratio_delta`** | `DELTA` | `ratio` | $[-1, 1]$ | $\text{Ratio4xx}_{\text{window}} - \text{Ratio4xx}_{\text{baseline}}$. | Returns `null` if baseline is not `ESTABLISHED`. |

### Detailed Formulation: `resource_enumeration_score`

A naive resource enumeration metric that merely computes $\frac{\text{count}(404)}{N}$ produces catastrophic false-positive spikes during benign user polling (e.g., polling a single job status URL before it is ready) or paginated table browsing.

To solve this, Stage 4B.1 defines the mathematical formula:

$$\text{enumerationBreadth} = \min\left(1.0, \frac{U}{10}\right)$$

$$\text{notFoundDiversityRatio} = \begin{cases} 
0.0 & \text{if } U = 0 \\
\frac{U_{404}}{U} & \text{otherwise}
\end{cases}$$

$$\text{resource\_enumeration\_score} = \text{round}(\text{enumerationBreadth} \times \text{notFoundDiversityRatio}, 4)$$

Where:
- $U = |\bigcup_{i=1}^N \{ \text{normalizedRoute}_i \}|$ is the total count of distinct normalized route templates in the window.
- $U_{404} = |\bigcup_{i=1, \text{status}_i = 404}^N \{ \text{normalizedRoute}_i \}|$ is the count of distinct normalized routes that produced a 404 response.

**Why this prevents false positives:**
1. **Single-Endpoint Polling:** A client polling `/api/jobs/123` 50 times receiving 404s has $U = 1$ and $U_{404} = 1$. Its breadth is $\min(1.0, 0.1) = 0.1$, and score is $0.1 \times 1.0 = 0.10$ (low), rather than $1.0$.
2. **Paginated Browsing:** A client browsing 10 paginated routes (`/api/items?page=1..10`) where all routes succeed has $U = 1$ (due to route normalization) and $U_{404} = 0$, yielding score $0.0$.
3. **Automated Directory Spidering:** An attacker scanning `/.env`, `/.git`, `/admin`, `/backup.zip`, `/api/v2`, `/phpmyadmin` produces $U = 6$ and $U_{404} = 6$. Its breadth is $\min(1.0, 0.6) = 0.6$, and score is $0.6 \times 1.0 = 0.60$ (elevated).

### Mathematical Invariants & Edge Cases

1. **Out-of-Order Telemetry Sorting:** Ingress timestamps may arrive slightly out of sequence due to concurrent worker threads. The feature extractor guarantees determinism by sorting observations by `Date(timestamp).getTime()` ascending before calculating interval metrics.
2. **Duplicate Timestamps ($\Delta t = 0$):** High-frequency bursts can result in identical millisecond timestamps ($t_{i+1} = t_i$). The inter-request interval calculation treats this as $\Delta t = 0\text{ ms}$, ensuring sample count and variance computations remain stable without division by zero.
3. **Empty Window Handling:** When $N = 0$, counter metrics return 0, ratio metrics return 0.0, and interval statistics return `null`.

---

## 5. Baseline Calibration Quality & Lifecycle States

### Multi-Dimensional Calibration Quality Criteria
To prevent unrepresentative or polluted traffic from corrupting normal baselines, Stage 4B.1 evaluates baseline quality across five dimensions:

1. **Sample Count:** Minimum clean observations $N_{\text{clean}} \ge 50$ (configurable via `minObservations`).
2. **Calibration Duration:** Observations must span at least 1 hour (3600 seconds) between the earliest and latest observation ($t_{\text{latest}} - t_{\text{earliest}} \ge \text{minCalibrationDurationSeconds}$).
3. **Observation Provenance:** Telemetry must originate from trusted gateway runtime nodes (`provenance.subsystem === 'gateway-reverse-proxy'`).
4. **Telemetry Completeness:** Observations must have zero reported data loss (`hasDataLoss !== true` and `persistenceStatus === 'TELEMETRY_PERSISTED'`).
5. **Freshness Tracking:** Baselines older than 7 days (168 hours) since calibration are classified as `STALE`.

### Error Separation: Legitimate Errors vs. Contamination Exclusion
A critical flaw in naive security baselining is assuming that all HTTP errors represent security attacks. Real-world web applications experience legitimate 404s (broken bookmarks, expired links), legitimate 401s (expired sessions), and legitimate 503s (transient service restarts). 

Stage 4B.1 strictly separates **observation trustworthiness** from **HTTP response status**:
- **Legitimate Application Errors are INCLUDED:** Normal 404, 401, 403, and 503 responses from an application that passed ingress validation are included in the baseline to model real-world error tolerances.
- **Contamination Exclusions:** Observations are excluded from calibration only if they failed ingress validation or exhibited protocol-level attacks:
  - `validationOutcome !== 'VALIDATED'` (e.g. `METHOD_NOT_ALLOWED`, `REQUEST_SMUGGLING_DETECTED`, `UNKNOWN_HOST`).
  - Security-blocked proxy outcomes (`SSRF_BLOCKED`, `INGRESS_REJECTED`).
  - Flagged data-loss or persistence-failed observations.

### Baseline Lifecycle State Machine

```
               [NEW OBSERVATIONS]
                       │
             Meets all 5 criteria?
                    ┌──┴──┐
                NO ┌┘     └┐ YES
                   ▼       ▼
             [CALIBRATING] [ESTABLISHED]
                   │               │
                   │               ├─────────────────────────┐
                   │               │ Exceeds 168h freshness? │ New calibration run
                   │               ▼                         ▼
                   │            [STALE]                 [SUPERSEDED]
                   │               │
                   └───────┬───────┘
                           │ Data loss or corruption detected
                           ▼
                       [INVALID]
```

### Delta Guard Policy
If a baseline is in any state other than `ESTABLISHED` (such as `CALIBRATING`, `STALE`, or `INVALID`), all baseline delta metrics (`rate_delta_vs_baseline`, `endpoint_diversity_delta`, `failure_ratio_delta`) return `null`. Downstream consumers receive explicit `qualityMetadata` noting why deltas are unavailable, preventing misleading calculations based on partial or uncalibrated data.

---

## 6. Rejected-Request Telemetry Architecture

Prior to Stage 4B.1, requests that failed gateway ingress validation (e.g., prohibited HTTP methods like `TRACE`, request smuggling attempts, malformed headers, or host mismatches) were terminated at the gateway without emitting telemetry. This created a major research blind spot: the most aggressive security probes were invisible to the behavioral telemetry pipeline.

### Gateway Ingress Observation Guarantee
In `gateway/src/middleware/request-validator.js`:
1. **Pre-Validation Hook:** Telemetry context (`req.telemetryRecorder`, `req.appResolver`, and `req.startTime`) is attached to the request object prior to running ingress validation checks.
2. **Local App Resolution:** On ingress failure, `appResolver.resolveTrustedOriginLocal(rawHost)` performs synchronous resolution to bind the observation to the correct tenant and application ID if registered.
3. **Safe Ingress Telemetry Recording:** Before terminating the socket with HTTP 400 or 405, the gateway invokes `recordRejectionTelemetry()`:
   ```javascript
   req.telemetryRecorder.record({
     tenantId: matchedTenantId || 'unknown-tenant',
     applicationId: matchedAppId || null,
     httpMethod: req.method,
     normalizedRoute: sanitizeRoute(req.url),
     responseStatus: statusCode,
     forwardingResult: 'INGRESS_REJECTED',
     validationOutcome: errorCode, // e.g. 'METHOD_NOT_ALLOWED', 'REQUEST_SMUGGLING_DETECTED'
     sourceMetadata: extractSourceMetadata(req),
     // Zero-credential guarantee preserved
   });
   ```
4. **Absolute Upstream Protection:** The upstream origin server is **NEVER** invoked for rejected requests. The connection is severed immediately after sending the error response.
5. **Canonical Schema Support:** `backend/src/telemetry/canonical-event.schema.js` accepts observed HTTP methods via `^[A-Z]{3,16}$` token validation, allowing methods such as `TRACE`, `CONNECT`, and `PROPFIND` to be recorded as valid canonical events.

---

## 7. Telemetry Reliability & Durable Loss Persistence

### Multi-Layer Reliability Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       GATEWAY IN-MEMORY TELEMETRY QUEUE                     │
│  - Max capacity: 1000 events                                                │
│  - Background flush timer: 500ms intervals                                  │
│  - On capacity overflow: oldest record dropped, explicit loss logged        │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Synchronized on Drop / Flush
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DURABLE LOSS SUMMARY DISK PERSISTENCE                    │
│  - Path: gateway/data/.telemetry-loss-summary.json                           │
│  - Survives gateway process restarts and crashes                            │
│  - Persists: totalIngested, totalPersisted, droppedEventCount, hasDataLoss  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Telemetry Lifecycle States
The telemetry pipeline distinguishes six explicit persistence states:
1. **`ACCEPTED`**: Received at gateway ingress; queued for normalization and transmission.
2. **`PENDING`**: Transmitted to backend; awaiting database transaction confirmation.
3. **`PERSISTED`** (`TELEMETRY_PERSISTED`): Successfully written to PostgreSQL `SecurityObservation` table.
4. **`REJECTED`**: Dropped during canonical validation due to schema violations or credential leak attempts.
5. **`DUPLICATE`**: Identical `correlationId` previously persisted; dropped idempotently without double-counting.
6. **`DROPPED`**: Discarded due to queue capacity overflow; triggers durable loss state.

### Explicit Data Loss Propagation
When queue drops or persistence failures occur:
- `hasDataLoss` is set to `true` in durable storage.
- Extracted feature sets flag `qualityMetadata.telemetryLossDetected = true` and demote `windowCompleteness` from `'COMPLETE'` to `'PARTIAL'`.
- Baseline calibration refuses to transition to `ESTABLISHED` if the training sample contains data loss.

---

## 8. Expanded Synthetic Research Evaluation Dataset (20 Scenarios)

The synthetic benchmark in `backend/src/telemetry/synthetic-evaluation-dataset.js` provides 20 reproducible research scenarios:

### Core Baseline Scenarios (1–10)
1. **`scenario-01-normal-browsing`**: 30 requests over 5m, human jitter (2s–6s), 200 OKs, multi-endpoint traversal.
2. **`scenario-02-repeated-login-failures`**: 15 requests in 45s to `/api/v1/auth/login`, 100% 401s, fixed 2.5s pacing.
3. **`scenario-03-endpoint-enumeration`**: 25 requests in 10s hitting sensitive routes (`/.env`, `/.git`, `/admin`), 100% 404s.
4. **`scenario-04-high-frequency-burst`**: 50 requests in 2s, burst frequency > 25 req/s.
5. **`scenario-05-repeated-not-found`**: 20 requests targeting identical dead link (`/export-dead-link`), 100% 404s.
6. **`scenario-06-unusual-method-distribution`**: 24 requests with heavy DELETE, PATCH, and HEAD verbs.
7. **`scenario-07-slow-irregular-probing`**: 10 requests spaced 60s to 180s apart (covert low-and-slow reconnaissance).
8. **`scenario-08-sudden-behavioral-change`**: 10 normal browsing requests suddenly pivoting into 15 rapid scanning requests.
9. **`scenario-09-shared-ip-distinct-sessions`**: 3 distinct sessions (`user-alpha`, `user-beta`, `user-gamma`) sharing IP `203.0.113.50`.
10. **`scenario-10-incomplete-telemetry`**: Observations with missing optional fields to verify pipeline resilience.

### Difficult Counterexample Scenarios (11–20)
11. **`scenario-11-polling-client-occasional-404`**: Benign client polling job status (`/api/v1/jobs/export-99`) receiving 404s before completion. Demonstrates that naive 404 ratios cause false positives, whereas `resource_enumeration_score` remains low (0.10) due to single-endpoint breadth.
12. **`scenario-12-single-page-app-asset-burst`**: Legitimate browser loading an SPA dashboard issuing 35 concurrent requests in 800ms for static JS/CSS bundles. Distinguishes legitimate asset burstiness from brute-force hammering based on endpoint diversity.
13. **`scenario-13-multi-user-office-nat`**: Corporate egress NAT where 5 distinct client sessions generate concurrent traffic across different endpoints. Validates that keyed HMAC session handles cleanly separate users without IP collision.
14. **`scenario-14-slow-stealthy-scanner`**: Advanced persistent threat (APT) reconnaissance sending 1 probe every 12 minutes over 6 hours. Demonstrates that short 30s windows miss the scan entirely, while the 15m window and multi-window correlation capture the persistent anomaly.
15. **`scenario-15-transient-upstream-outage`**: Benign users encountering 500/503 errors during an upstream microservice restart. Demonstrates error separation: upstream failures do not inflate client enumeration or malicious scoring metrics.
16. **`scenario-16-automated-test-runner`**: Legitimate CI/CD integration runner issuing predictable, low-variance requests to known test routes. Tests detector capability to differentiate automated testing from unauthorized crawling.
17. **`scenario-17-out-of-order-telemetry-stream`**: Concurrent gateway worker nodes transmitting observations with minor network reordering. Demonstrates that timestamp sorting ensures deterministic interval calculation.
18. **`scenario-18-intermittent-telemetry-loss`**: Network partition during peak traffic causing queue overflow and dropped telemetry. Demonstrates that feature extraction flags `telemetryLossDetected` and sets `windowCompleteness: 'PARTIAL'`.
19. **`scenario-19-ingress-rejected-probe`**: External scanner sending `TRACE` requests and smuggling payloads. Validates that the gateway captures rejected-request telemetry with `INGRESS_REJECTED` and `METHOD_NOT_ALLOWED` without forwarding to upstream.
20. **`scenario-20-benign-web-crawler`**: Standard search engine bot crawling public routes (`/`, `/about`, `/docs`) with respectful pacing (2 req/s) and valid headers. Serves as a counterexample against flagging high endpoint diversity as malicious.

---

## 9. Verification & Automated Test Coverage

The subsystem is validated across 192 backend tests and 37 gateway tests (229 tests total):

| Test Suite | File | Tests | Coverage Scope |
| :--- | :--- | :--- | :--- |
| **Stage 4B.1 Integrity & Ingress** | `backend/tests/stage-4b1-integrity.test.js` | 8 | Ingress rejected telemetry (TRACE, duplicate headers), out-of-order sorting, robust enumeration scoring, baseline error separation, durable loss persistence. |
| **Session Correlation** | `backend/tests/behavioral-session-correlator.test.js` | 9 | Keyed HMAC pseudonymization, tenant-isolated key derivation, unverified header demotion, inactivity timeout, epoch rotation, anti-attribution. |
| **Baseline Calibration** | `backend/tests/behavioral-baseline.test.js` | 10 | Multi-dimensional quality (count, duration, provenance, loss), error separation (404/401 included), lifecycle states, delta guards. |
| **Feature Extraction** | `backend/tests/behavioral-feature-extractor.test.js` | 13 | 30s/5m/15m windows, rate, burst, interval mean/variance, out-of-order sorting, duplicate timestamps ($\Delta t=0$), robust enumeration formula. |
| **Reliability & Data Loss** | `backend/tests/telemetry-reliability-and-loss.test.js` | 4 | Bounded queue, durable disk persistence, explicit loss emission, missingness propagation. |
| **Synthetic Dataset** | `backend/tests/synthetic-evaluation-dataset.test.js` | 15 | Ground-truth separation, scenario validity, coverage across all 20 benchmark scenarios. |
| **REST APIs** | `backend/tests/behavioral-features-api.test.js` | 6 | Authenticated tenant-scoped feature queries, baseline inspection, deterministic calibration trigger. |
| **Gateway Proxy Core** | `gateway/tests/reverse-proxy.test.js` | 37 | Ingress validation, header sanitation, reverse-proxy routing, timeout handling, rejected request telemetry. |

---

## 10. Research Boundaries, Limitations & Next Steps

1. **No Live ML Classification:** This engine is strictly a telemetry normalization, session correlation, and feature extraction pipeline. It provides clean, mathematically reproducible feature vectors. All classifications and threat scores in this stage are heuristic measurements, not automated verdicts.
2. **Execution Evidence Strictly `MISSING`:** Because dynamic honeynet deployment and decoy response injection are planned for Stage 5, all execution evidence fields in security observations remain explicitly `MISSING`.
3. **No Attacker Identity Claims:** An IP address, subnet hash, or pseudonymous session handle is never conflated with an individual human attacker.
4. **Single-Node In-Memory Correlation:** Active session tracking currently runs on an in-memory LRU map. High-availability Redis clustering for distributed multi-gateway deployments is an operational extension planned for production scale.
