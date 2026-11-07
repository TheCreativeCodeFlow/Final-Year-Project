# Stage 5B.2.2 Adversarial Test Results

## 1. Test Suite Overview

- **Test Suite**: `backend/tests/runtime-worker-isolation-remediation.test.js`
- **Execution Date**: 2026-11-07
- **Test Runner**: Node.js v24.16.0 Native Test Runner (`node --test`)
- **Total Test Categories**: 23
- **Passed**: 23
- **Failed**: 0
- **Execution Duration**: 21.66s

---

## 2. Test Execution Matrix

| # | Test Category | Target / Component | Input / Condition | Expected Outcome | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | Process Separation | Worker Daemon | `GET /health` | Distinct PID, independent uptime, title set | Worker PID 87375 reported; distinct from runner | **PASS** (4.49ms) |
| **2** | Backend Socket Rejection | Express Backend | Inspect `RuntimeEnvironmentManager` & `ProvisioningDispatcher` | Undefined `this.adapter`; zero Docker socket access | Verified no adapter on backend objects | **PASS** (0.12ms) |
| **3** | Worker Socket Verification | Worker Daemon | `adapter.ping()` & `/health` | Docker Engine reached; version reported | Connected to Docker 29.5.2 (API 1.54) | **PASS** (4.18ms) |
| **4** | Template Validation | Dispatcher | Unregistered template `tpl-arbitrary-shell` | Rejection with 400 `UNKNOWN_TEMPLATE` | Rejected with `Unknown synthetic service template` | **PASS** (3.07ms) |
| **5** | Image Validation | Adapter | Unpinned image or unapproved tag `malicious:latest` | Rejection with 403 `UNAPPROVED_IMAGE_IDENTIFIER` | Rejected; unapproved image blocked | **PASS** (0.93ms) |
| **6** | Config Hardening | Adapter | Dangerous env vars (`NODE_OPTIONS`), host mounts | Immediate 400 validation error | `FORBIDDEN_ENV_VARIABLE` rejected | **PASS** (17.09ms) |
| **7** | Host Boundary Audit (Finding A) | Synthetic Container | TCP connect to `gateway:22` | Deterministic reachability accounting | Probe blocked via netfilter drop rule (`BLOCKED:ENETUNREACH`) | **PASS** (94.84ms) |
| **8** | Host Management Ports Probe | Synthetic Container | Probes to host ports 2375, 5432, 6379, 3000, 4000 | Blocked / unreachable | All 5 management ports returned BLOCKED | **PASS** (235.53ms) |
| **9** | Cross-Tenant Isolation | Synthetic Containers | Tenant A container probes Tenant B IP | Connection refused or unreachable | Cross-tenant probe blocked (`BLOCKED:TIMEOUT`) | **PASS** (145.86ms) |
| **10** | Outbound Egress Quarantine | Synthetic Container | Probes to `8.8.8.8` & DNS `google.com` | `ENETUNREACH` and `DNS_BLOCKED` | Both TCP and DNS egress quarantined | **PASS** (118.83ms) |
| **11** | Internal Loopback Reachability | Synthetic Container | Probes internal `127.0.0.1:8080/health` | HTTP 200 `UP` | Synthetic mock service responds 200 | **PASS** (148.29ms) |
| **12** | Container Health via IPC | Worker IPC | `GET /environments/:id/health` | HTTP 200 with container metrics | Returned live health status via WorkerClient | **PASS** (1471.79ms) |
| **13** | Resource Limit Reconciliation | Docker Cgroup | Inspect container `HostConfig` | Memory 256MB, CPU 50000, Pids 100, zero ports | Exact match with approved quotas | **PASS** (66.94ms) |
| **14** | Quota Rollback on Failure | Resource Governor | Submit job with expired authorization | Quota reserved then cleanly rolled back | Reserved CPU rolled back to baseline | **PASS** (1119.23ms) |
| **15** | Quota Release on Termination | Resource Governor | Terminate running environment | Reserved CPU & Memory decremented | Quota released; active environments decremented | **PASS** (2472.16ms) |
| **16** | Idempotency | Dispatcher | Submit duplicate job with identical idempotency key | Existing job returned without double-reserving | Idempotent replay verified; quota unchanged | **PASS** (4.39ms) |
| **17** | Worker Timeout Handling | WorkerClient | Client request with 1ms timeout | Clean client timeout rejection; no hung Express thread | Clean rejection without process crash | **PASS** (2.55ms) |
| **18** | Worker Restart Recovery | Worker Daemon | Kill worker with pending jobs; start new worker | Queued job picked up by polling loop and completed | Job processed to completion after restart | **PASS** (2007.38ms) |
| **19** | Orphan Resource Cleanup | Worker Daemon | Orphan container with `deception.managed: true` | Scanned, stopped, and removed from Docker | Orphan container and network removed | **PASS** (12453.17ms) |
| **20** | Evidence Chain Verification | Evidence Recorder | Inspect valid sequential event log | `valid: true`, unbroken hash pointers | Hash chain verified without breaks | **PASS** (4.89ms) |
| **21** | Evidence Tamper Detection | Evidence Recorder | Mutate payload, delete intermediate event | `valid: false` with specific violation codes | `PAYLOAD_CORRUPTED` and `DELETED_EVENT` detected | **PASS** (3.11ms) |
| **22** | Revocation Enforcement | Worker Daemon | Revoke authorization before worker processing | Immediate rejection; provisioning blocked | `AUTHORIZATION_REVOKED` triggered | **PASS** (2.27ms) |
| **23** | Stale DSG Version Rejection | Dispatcher & Worker | Mutate DSG version from 1 to 2 | Optimistic concurrency rejection | `STALE_GRAPH_VERSION` triggered | **PASS** (2.95ms) |
