# Stage 5B.2.2 Architecture: Runtime Worker Process Isolation and Host Boundary Security

## 1. Executive Summary

Stage 5B.2.2 establishes an architectural boundary separation for the AI-Enabled Adaptive Cyber Deception Gateway. Previously, container provisioning logic, Docker Engine socket access, and web API handling resided in a unified Express backend process. While effective for initial prototyping, this created an excessive blast radius: any potential vulnerability in web routes, JSON parsers, or tenant middleware could expose the privileged Docker Engine Unix socket. Furthermore, synthetic deception containers retained reachability to the host bridge gateway port 22 (`sshd`) due to default Linux `INPUT` chain netfilter behavior.

Stage 5B.2.2 decouples the runtime execution tier into two strictly separated operating system processes:
1. **Express Management & Operations Backend** (Web tier, zero Docker socket access).
2. **Dedicated Runtime Worker Daemon** (`worker-process.js`, exclusive Docker socket access).

Additionally, Stage 5B.2.2 addresses host boundary exposure via network interface prefixing (`decbr+`) and non-destructive host firewall automation (`scripts/remediate-host-boundary.sh`), reconciles multi-tier resource limits, and implements cryptographic SHA-256 append-linked evidence chaining.

---

## 2. Process Separation Architecture

```
+-----------------------------------------------------------------------------------+
|                              HOST ENVIRONMENT                                     |
|                                                                                   |
|  +------------------------------------+       +--------------------------------+  |
|  |     Express Management Backend     |       |   Dedicated Runtime Worker     |  |
|  |     (PID: 86420, Port: 3000/4000)  |       |   (PID: 86421, Port: 5055)     |  |
|  |                                    |       |                                |  |
|  |  * Tenant Auth & Authorization     |       |  * Exclusive Docker Socket     |  |
|  |  * Policy Evaluation Engine        |       |  * Template & Image Allowlist  |  |
|  |  * DSG Graph Planning              |       |  * Cgroup Resource Enforcer    |  |
|  |  * Provisioning Dispatcher (Queue) |       |  * Container Lifecycle Engine  |  |
|  |  * Zero Docker Socket Access       |       |  * Orphan Sweep & Reconciler   |  |
|  +-----------------+------------------+       +---------------+----------------+  |
|                    |                                          |                   |
|                    | Loopback HTTP (127.0.0.1:5055)          | Docker Engine     |
|                    | Header: x-worker-token                   | Unix Socket       |
|                    v                                          v                   |
|  +------------------------------------+       +--------------------------------+  |
|  |          PostgreSQL DB             |       |       Docker Daemon            |  |
|  |  * DeceptionExecutionAuthorization |       |  * decbr+ Isolated Bridges     |  |
|  |  * DeceptionProvisioningJob (State)|       |  * Cgroup Memory (256MB)       |  |
|  |  * DeceptionRuntimeEnvironment     |       |  * Cgroup CPU Quota (50000)    |  |
|  |  * Append-Linked Evidence Chain    |       |  * Read-Only Rootfs            |  |
|  +------------------------------------+       +--------------------------------+  |
+-----------------------------------------------------------------------------------+
```

### 2.1 Express Backend Decoupling
The Express backend (`backend/src/app.js`, `runtime.controller.js`, and `runtime-environment-manager.service.js`) was audited and completely stripped of all Docker API dependencies:
- Zero references to `/var/run/docker.sock` or `docker.sock`.
- Zero imports of `ContainerRuntimeAdapter` across Express controllers and route handlers.
- Container operations are mediated via `WorkerClient`, which communicates over loopback HTTP (`http://127.0.0.1:5055`) with mandatory pre-shared secret token verification (`x-worker-token`).
- Provisioning requests are enqueued in PostgreSQL as durable jobs (`DeceptionProvisioningJob`) in `PENDING` state before notifying the worker.

### 2.2 Dedicated Runtime Worker Daemon
The worker process (`backend/src/runtime/worker-process.js`):
- Runs as an independent OS process with its own PID, memory space, and process title (`adaptive-deception-runtime-worker`).
- Possesses exclusive access to the Docker Engine socket (auto-detecting Colima or standard Linux socket paths).
- Listens strictly on `127.0.0.1:5055` (never binding to `0.0.0.0`).
- Validates all incoming IPC calls with timing-safe token comparison.
- Operates a dual-dispatch model:
  1. **Immediate Execution**: Triggered via `POST /jobs/process` for real-time responsiveness.
  2. **Background Polling Loop**: Periodically polls PostgreSQL for orphaned or unprocessed `PENDING` jobs, guaranteeing crash-recovery and fault tolerance.

---

## 3. Host Boundary Remediation (Finding A)

### 3.1 Root Cause Analysis
Docker networks created with `--internal` prevent traffic from forwarding to external network interfaces by installing drop rules in the Linux `FORWARD` iptables chain. However, traffic from a container destined for the bridge gateway IP (`172.x.x.1`) enters the `INPUT` chain of the host network stack.
Because SSH (`sshd`) on host systems (including Colima Linux VM) binds to `0.0.0.0:22`, and default firewall configurations leave the `INPUT` chain in `ACCEPT` policy, synthetic containers could connect directly to port 22 and receive the host OpenSSH daemon banner.

### 3.2 Targeted Remediation (`decbr+`)
Hardcoding bridge interface names or executing global `INPUT` drops risks breaking external container networks or host connectivity. Stage 5B.2.2 establishes:
1. **Bridge Device Naming Convention**: Isolated networks are created with `com.docker.network.bridge.name: decbr...` (limited to 13 characters to comply with the Linux kernel's 15-character `IFNAMSIZ` limit).
2. **Wildcard Interface Firewall Rule**:
   ```bash
   iptables -I INPUT -i decbr+ -j DROP
   ```
   This rule specifically blocks traffic entering the host from any deception bridge without impacting `docker0`, `eth0`, or non-deception containers.
3. **Automated Control Script**: `scripts/remediate-host-boundary.sh` provides `--check`, `--apply`, `--rollback`, and `--status` modes, with automatic Colima VM environment detection.

---

## 4. Resource Governance & Limit Reconciliation (Finding C)

To eliminate discrepancies between requested templates, policy limits, reserved quotas, and cgroup enforcement, Stage 5B.2.2 establishes an authoritative reconciliation model:

| Layer | CPU Allocation | Memory Limit | PIDs Limit | Storage |
| :--- | :--- | :--- | :--- | :--- |
| **1. Template Requested** | 0.5 CPU | 256 MB | 100 PIDs | 512 MB (Accounting Quota) |
| **2. Policy Approved** | 1.0 CPU Max | 512 MB Max | 100 PIDs | 1024 MB Max |
| **3. Reserved Quota** | 0.5 CPU | 256 MB | - | - |
| **4. Docker Cgroup** | `CpuQuota: 50000` (`CpuPeriod: 100000`) | `Memory: 268435456` bytes (256 MB) | `PidsLimit: 100` | Read-only Rootfs + 64 MB tmpfs |

### Storage Clarification
Storage is strictly an **accounting quota**. In reality, synthetic deception containers are launched with `ReadonlyRootfs: true`. No persistent host volume binds exist (`Binds: []`), and transient scratch write access is limited to a memory-backed tmpfs (`/tmp: size=64m`).

---

## 5. Append-Linked Evidence Chaining (Finding D)

Stage 5B.2.2 hardens the execution audit log into a cryptographic SHA-256 append-linked chain:
$$E_i = \text{SHA256}(\text{CanonicalJSON}(P_i) \parallel H_{i-1})$$

Where:
- $P_i$ is the event payload containing tenant ID, environment ID, sequence number, event type, actor, and timestamp.
- $H_{i-1}$ is the SHA-256 digest of the immediately preceding event in that environment's chain ($H_0 = \text{"0"}^{64}$).
- Verification verifies sequence continuity, previous hash references, and recomputes payload digests.
- **Cryptographic Trust Disclosure**: While providing tamper-evident internal payload integrity, this chain lacks external PKI timestamping. It is explicitly labeled:
  - `NON_REPUDIATION: NOT_IMPLEMENTED`
  - `INDEPENDENT_TRUST_ANCHOR: NOT_IMPLEMENTED`
