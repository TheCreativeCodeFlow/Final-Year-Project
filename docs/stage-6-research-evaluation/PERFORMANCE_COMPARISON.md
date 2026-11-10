# Stage 6 — System Performance & Resource Overhead Comparison

## 1. Loopback HTTP Evaluation Harness Latency ($N = 655$ Steps / Paradigm)

Measured with monotonic nanosecond clocks (`process.hrtime.bigint()`) across 5 independent deterministic seeds after a 3-scenario JIT warmup (`66.35 ms` discarded) with counterbalanced paradigm order:

| Performance Metric | `STATIC_HONEYPOT` | `GENERIC_ADAPTIVE` | `ATTACKER_SPECIFIC_DSG` | DSG vs Static Delta |
| :--- | :---: | :---: | :---: | :---: |
| **Step Mean Latency** | `0.8828 ms` | `0.9095 ms` | `0.9026 ms` | `+0.0198 ms` (`+2.2%`) |
| **Step Median ($p_{50}$) Latency** | `0.8614 ms` | `0.8774 ms` | `0.8745 ms` | `+0.0131 ms` (`+1.5%`) |
| **Step 95th Percentile ($p_{95}$)** | `0.9663 ms` | `1.0766 ms` | `1.0823 ms` | `+0.1160 ms` (`+12.0%`) |
| **Step 99th Percentile ($p_{99}$)** | `1.0599 ms` | `1.2490 ms` | `1.2116 ms` | `+0.1517 ms` (`+14.3%`) |
| **Step Std Dev ($\sigma$)** | `0.1588 ms` | `0.0922 ms` | `0.0856 ms` | — |
| **Adaptation-Only Mean Latency** | `0.0000 ms` | `0.1191 ms` | `0.1105 ms` | `+0.1105 ms` |
| **Adaptation-Only p95 Latency** | `0.0000 ms` | `0.2230 ms` | `0.2642 ms` | `+0.2642 ms` |
| **Total User CPU Time (655 steps)**| `585.36 ms` | `628.51 ms` | `613.53 ms` | `+28.17 ms` (`+4.8%`) |
| **Total System CPU Time** | `12.52 ms` | `15.39 ms` | `14.48 ms` | `+1.96 ms` (`+15.7%`) |
| **Loopback Server Provisioning** | `0.0347 ms` | `0.0355 ms` | `0.0342 ms` | Negligible (~34 µs) |
| **Mean Heap Delta (Process)** | `+0.3086 MB` | `-0.0652 MB` | `-0.2394 MB` | Within V8 GC noise |
| **Failed Requests** | `0` | `0` | `0` | `0` |

*Note on Heap Delta:* Negative mean heap delta in Node.js process metrics reflects minor V8 mark-sweep GC cycles running between scenario allocations; dedicated container RAM is captured directly via Docker cgroups below.

---

## 2. Live Docker Container Infrastructure Overhead (`stage6-live-docker-parity.json`)

Real Docker runtime costs differ substantially from in-process memory/loopback simulations because provisioning allocates an `Internal: true` bridge network, validates SHA-256 image digests (`deception-synthetic-service:1.0.0`), starts a non-root hardened container (`UID 1000:1000`), and executes container IPC via Docker Engine `/exec`:

| Container Infrastructure Metric | `STATIC_HONEYPOT` | `GENERIC_ADAPTIVE` | `ATTACKER_SPECIFIC_DSG` |
| :--- | :---: | :---: | :---: |
| **Network + Container + Health Readiness Provisioning** | `475.16 ms` | `464.24 ms` | `472.04 ms` |
| **Live Cgroup Memory Usage (vs 256 MB Limit)** | `9.43 MB` (`3.68%`) | `9.59 MB` (`3.75%`) | `9.39 MB` (`3.67%`) |
| **Active PIDs (vs 100 Limit)** | `11` | `11` | `11` |
| **Docker Exec Mutation Latency (`/internal/mutate`)** | `N/A (0)` | `33.22 ms` | `33.11 ms` |
| **Docker Exec Query Latency (`/api/v1/*`)** | `29.13 ms` | `42.13 ms` | `45.49 ms` |
| **Verified Container State Rollback (`v->1`)** | `N/A` | `N/A` | `30.34 ms` |

### Architectural Performance Trade-Off Conclusion
- Pre-warming an environment pool absorbs the `~472 ms` container cold-start cost off the critical request path.
- Synchronous `docker exec` mutation (`~33.11 ms` via Engine API) and PostgreSQL audit persistence (`~5–7 ms` from Stage 5B.5.1) confirm **H3**: DSG coherence is NOT free—high-throughput environments must either pre-warm containers and communicate directly over internal sandboxed bridge HTTP sockets inside the isolated runtime worker rather than spawning `node -e` via Docker `/exec` per mutation.
