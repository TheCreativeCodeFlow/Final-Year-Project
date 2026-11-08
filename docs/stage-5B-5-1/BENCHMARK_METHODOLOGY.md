# Stage 5B.5.1 — Scientific Benchmark Methodology

## 1. Experimental Overview & Corrections

In Stage 5B.5, the initial benchmark script utilized an estimated latency simulation that did not explicitly track socket destinations or separate offered load from achieved throughput. 

In Stage 5B.5.1, the benchmark methodology was completely rebuilt (`backend/scripts/gateway-routing-benchmark.js`) to adhere to rigorous empirical standards:
- **Warm-Up Phase:** 20 pre-benchmark requests are executed and discarded to warm the Node.js V8 JIT compiler, establish TCP connection pools, and pre-load database schema metadata.
- **Multiple Repetitions:** Each configuration is executed across 3 independent repetitions of 100 requests (300 total offered requests per configuration, 1,200 total evaluated across the suite).
- **High-Resolution Timers:** All stage-by-stage timings and end-to-end latencies are recorded using `process.hrtime.bigint()` (nanosecond precision, converted to floating-point milliseconds).
- **Traffic Accounting Invariants:** Explicit tracking of `offeredRequests`, `completedRequests`, `originRequests`, `syntheticRequests`, `failedRequests`, and `timedOutRequests`.

---

## 2. Experimental Environment & Hardware Specifications

| Parameter | Specification | Notes |
| :--- | :--- | :--- |
| **Hardware Platform** | Apple Silicon (arm64) | 10 Cores, 24 GB Unified Memory |
| **Operating System** | macOS Darwin 25.1.0 | Local loopback `127.0.0.1` |
| **Runtime Environment**| Node.js v24.16.0 | Native `node:http` & `node:crypto` |
| **Database Engine** | PostgreSQL 16 (Local NVMe) | Prisma ORM 5.x connection pool |
| **Concurrency Model** | Sequential Repeatable Burst | Concurrency = 1 (determines pure processing overhead) |
| **Network Conditions** | Loopback Unix Domain Sockets / Local TCP | Zero wide-area network jitter (< 0.1ms wire latency) |

---

## 3. Workload Distribution

The evaluation suite evaluates 10 representative scenarios across three distinct classes:

### Class 1: Benign Application Traffic (40% of standard workload)
- `WL-01-BENIGN-PROFILE`: `GET /api/v1/profile`
- `WL-02-BENIGN-PAYMENTS`: `GET /api/v1/payments/history`
- `WL-03-BENIGN-HEALTH`: `GET /health/live`
- `WL-04-BENIGN-CONFIG`: `GET /api/v1/config/public`

### Class 2: Attacker Campaigns & Exploits (40% of standard workload)
- `WL-05-ATTACK-CRED-STUFF`: `POST /api/v1/auth/login` (Credential Stuffing pattern)
- `WL-06-ATTACK-API-SCAN`: `GET /api/v1/.env` (Admin & Environment Reconnaissance)
- `WL-07-ATTACK-DATA-EXFIL`: `GET /api/v1/customers/all` (Mass Data Harvesting)
- `WL-08-ATTACK-TARPIT-PROBE`: `POST /api/v1/transfer/batch` (Batch API Abuse)

### Class 3: Ambiguous & Telemetry-Degraded Traffic (20% of standard workload)
- `WL-09-AMBIGUOUS-TRUNCATED`: Truncated headers and missing payload attributes.
- `WL-10-AMBIGUOUS-OPTIONS`: CORS preflight and unrecognized verbs.

---

## 4. Distinct Throughput vs. Offered Load Accounting

The methodology strictly separates **offered load** from **achieved throughput**:
- **Offered Load ($L_{\text{offered}}$):** The number of requests generated and submitted to the gateway per second.
- **Completed Requests ($N_{\text{completed}}$):** Requests that received a complete HTTP response from either origin, synthetic sandbox, or fail-closed gate.
- **Achieved Throughput ($T_{\text{achieved}}$):**
  $$T_{\text{achieved}} = \frac{N_{\text{completed}}}{\Delta t_{\text{wall\_clock}}}$$
- **Request Conservation Invariant:**
  $$N_{\text{offered}} = N_{\text{completed}} + N_{\text{failed}} + N_{\text{timed\_out}}$$
  $$N_{\text{completed}} = N_{\text{origin}} + N_{\text{synthetic}}$$
