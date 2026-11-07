# Stage 5B.3 — Runtime Health Model & Inspection Engine

## 1. Overview

The Adaptive Cyber Deception Gateway distinguishes between four fundamentally different states of a deception environment:
1. **Provisioned**: Allocated in the database and metadata records.
2. **Running**: Container process active according to Docker daemon inspection.
3. **Healthy**: Container actively responding to application probes within operational thresholds.
4. **Verified**: Execution evidence chain cryptographically intact and validated.

This document defines the deterministic health model, inspection protocols, state transitions, threshold criteria, and caching semantics implemented in Stage 5B.3.

---

## 2. Health Metrics Collected

For every active synthetic deception environment, the health monitoring engine inspects:

| Metric | Source | Description |
| :--- | :--- | :--- |
| **Container Existence** | Docker Daemon `/containers/{id}/json` | Confirms container exists in Docker engine. |
| **Running State** | Docker State `State.Running` | Boolean indicator of container process lifecycle. |
| **Health Status** | Docker State `State.Health.Status` | Docker engine built-in health check result (if configured). |
| **Process Availability** | Docker Stats `/containers/{id}/stats` | Number of active PIDs (`pids_stats.current`). |
| **Internal Service Probe**| HTTP `GET http://<ip>:8080/health` | Application-level synthetic HTTP endpoint response (timeout 2000ms). |
| **Worker Connectivity** | IPC Socket / HTTP Ping | Status of authenticated worker IPC channel. |
| **Docker Connectivity** | Worker Docker Client Ping | Ability of the worker to communicate with `/var/run/docker.sock`. |
| **Memory Utilization** | Docker Stats / Cgroups | Current memory consumption in bytes/MB and percentage of limit. |
| **CPU Utilization** | Docker Stats delta calculations | Percentage of CPU consumed across container vCPUs. |
| **PID Consumption** | Docker Stats | Active process count against container PID limit (max 64). |
| **Restart Count** | Docker State `RestartCount` | Number of times container restarted unexpectedly. |
| **Runtime Age** | DB `createdAt` vs Current Time | Time elapsed since initial environment provisioning. |
| **Last Health Check** | DB / Cache `lastHealthCheckedAt` | Timestamp of most recent health evaluation. |
| **Last Telemetry Event**| Telemetry Ring Buffer | Timestamp of most recent telemetry event emitted. |

---

## 3. Deterministic Health States

The runtime health monitor maps real-world observations into five mutually exclusive states:

```
              +----------------------------------------------+
              |                   UNKNOWN                    |
              |  (Worker offline / Docker error / No probe)  |
              +----------------------------------------------+
                                     ^
                                     |
               +---------------------+---------------------+
               |                     |                     |
               v                     v                     v
        +-------------+       +--------------+      +-------------+
        |   HEALTHY   | ----> |   DEGRADED   | ---> |  UNHEALTHY  |
        +-------------+       +--------------+      +-------------+
               |                     |                     |
               +---------------------+---------------------+
                                     |
                                     v
                             +---------------+
                             |  TERMINATED   |
                             +---------------+
```

### 3.1. `HEALTHY`
- **Definition**: Container is running, within all resource limits, and actively passing internal service HTTP health probes.
- **Criteria**:
  - `container.running === true`
  - `container.exitCode === 0` (or running)
  - `memoryUsagePercent < 90%`
  - `cgroupBreach === false`
  - Internal HTTP probe returns HTTP status `200 OK` within 2000ms.
  - Worker and Docker daemon report normal operations.

### 3.2. `DEGRADED`
- **Definition**: Container is running and responding, but operational metrics indicate abnormal stress or near-exhaustion.
- **Criteria**:
  - `container.running === true`
  - `memoryUsagePercent >= 90%` (or memory usage approaches the 128MB limit)
  - PID count approaches max threshold (>80% of PID quota)
  - Probe response latency exceeds warning threshold (>1500ms but <2000ms)
  - Network throughput or drop rate abnormally elevated.

### 3.3. `UNHEALTHY`
- **Definition**: Container is broken, crashed, dead, or failing application-level probes.
- **Criteria**:
  - `container.running === false` while DB lifecycle is `ACTIVE`
  - Container exited with non-zero code or state is `Dead` or `OOMKilled`
  - Internal HTTP probe returns HTTP 5xx, connection refused, or timed out (>2000ms)
  - Container process disappeared or restarted repeatedly (`restartCount > 3`).

### 3.4. `UNKNOWN`
- **Definition**: The health status cannot be verified due to lack of observation, worker offline, or daemon failure.
- **Critical Invariant**:
  - **MISSING OBSERVATIONS MUST NEVER DEFAULT TO `HEALTHY`.**
  - If the worker process is unreachable, Docker daemon is offline, or container inspection fails with an unhandled network error, the state is strictly evaluated as `UNKNOWN`.

### 3.5. `TERMINATED`
- **Definition**: The environment was deliberately stopped or torn down.
- **Criteria**:
  - DB lifecycle status is `TERMINATED` or `STOPPED`.
  - Container is stopped or removed from the Docker daemon.

---

## 4. Health Decision Matrix

| Running | HTTP Probe (8080) | Memory Usage | Cgroup Within Limits | Daemon/Worker Reachable | Lifecycle Status | Resulting Health State |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Yes** | 200 OK (<1500ms) | < 90% | Yes | Yes | ACTIVE | **`HEALTHY`** |
| **Yes** | 200 OK | >= 90% | Yes | Yes | ACTIVE | **`DEGRADED`** |
| **Yes** | 200 OK | Any | No (Breach) | Yes | ACTIVE | **`DEGRADED`** |
| **Yes** | Fails / Timeout | Any | Any | Yes | ACTIVE | **`UNHEALTHY`** |
| **No** | N/A | N/A | N/A | Yes | ACTIVE | **`UNHEALTHY`** |
| **Any** | Any | Any | Any | **No (Offline)** | Any | **`UNKNOWN`** |
| **No** | N/A | N/A | N/A | Yes | TERMINATED | **`TERMINATED`** |

---

## 5. Inspection Engine Implementation & Caching Semantics

### 5.1. Caching Strategy
To prevent high-frequency health queries from overwhelming the Docker daemon socket or introducing excessive latency, `RuntimeHealthMonitorService` implements an in-memory observation cache:
- **Default TTL**: 10,000 milliseconds (10 seconds).
- **Key**: `${tenantId}:${environmentId}`.
- **Cached Fields**: Evaluated health state, raw container stats, probe results, and timestamp.
- **Cache Invalidation / Bypass**:
  - On-demand inspection accepts `{ forceLive: true }` which bypasses the cache and queries the worker and Docker daemon immediately.
  - State mutations (start, stop, terminate) automatically invalidate cached entries.

### 5.2. Evidence Generation on Health Transitions
Whenever a health check triggers a state transition (e.g., `HEALTHY` -> `DEGRADED` or `DEGRADED` -> `HEALTHY`), the health monitor records an event to the append-only evidence chain:
- `HEALTH_CHECK_EXECUTED`: Routine periodic check.
- `RUNTIME_DEGRADED`: Recorded when entering `DEGRADED` or `UNHEALTHY`.
- `RUNTIME_RECOVERED`: Recorded when an unhealthy/degraded runtime returns to `HEALTHY`.

All evidence events include the previous state, new state, observation payload, and timestamp.
