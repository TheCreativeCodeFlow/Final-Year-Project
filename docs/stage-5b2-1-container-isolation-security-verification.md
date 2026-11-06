# Stage 5B.2.1 — Container Isolation, Runtime Security & Evidence Verification

**Project:** AI-Enabled Adaptive Cyber Deception Gateway  
**Repository:** `https://github.com/TheCreativeCodeFlow/Final-Year-Project.git`  
**Branch:** `main`  
**Milestone:** Stage 5B.2.1 (Adversarial Security Audit)  
**Evaluator Version:** `5B.2.1`  
**Docker Engine Socket:** `/Users/rahulseervi/.colima/default/docker.sock`  
**Audit Target:** Real Docker Runtime & Isolated Synthetic Containers  
**Verification Verdict:** **COMPLETE**

---

## 1. Executive Summary & Audit Overview

Stage 5B.2.1 conducts an empirical, adversarial security audit of the container provisioning capability implemented in Stage 5B.2. Rather than relying on configuration objects submitted to the Docker API, this milestone independently executed low-level probes inside actual running Linux containers to verify:
1. Container security context, non-root execution, Linux capabilities, and kernel cgroup constraints.
2. Internal bridge network isolation, external egress quarantine, and cross-tenant network boundaries.
3. Host-to-container and container-to-host reachability.
4. Docker trust boundary and parameter sanitization at the API/Worker boundary.
5. Image supply-chain integrity and immutable digest enforcement.
6. Execution evidence ledger cryptographic hashing and canonical serialization.
7. Runtime worker failure injection, orphan resource cleanup, and concurrency race resilience.

### Verification Matrix Summary

| Security Domain | Evaluated Property | Empirical Result | Status |
|---|---|---|---|
| **Egress Quarantine** | Outbound TCP to public Internet (`8.8.8.8:53`) | `ENETUNREACH` (No default route) | **VERIFIED** |
| **Egress Quarantine** | Outbound UDP to public Internet (`8.8.8.8:53`) | `ENETUNREACH` (Packet dropped) | **VERIFIED** |
| **DNS Isolation** | Public DNS lookup (`google.com`) | `EAI_AGAIN` (Nameserver unreachable) | **VERIFIED** |
| **Cross-Tenant Network** | Tenant A container to Tenant B container | `ENETUNREACH` (Distinct bridges unrouted) | **VERIFIED** |
| **Host Service Access** | Host PostgreSQL (`bridge_ip:5432`) | `ECONNREFUSED` / unreachable | **VERIFIED** |
| **Host Service Access** | Host Redis (`bridge_ip:6379`) | `ECONNREFUSED` / unreachable | **VERIFIED** |
| **Host Service Access** | Host Backend API (`bridge_ip:4000`) | `ECONNREFUSED` / timeout | **VERIFIED** |
| **Host Service Access** | Host SSH daemon (`bridge_ip:22`) | `CONNECTED` (OpenSSH banner received) | **DOCUMENTED BOUNDARY** |
| **Docker Socket** | `/var/run/docker.sock` inside container | `false` (Not mounted) | **VERIFIED** |
| **Docker Daemon Port** | Docker TCP (`bridge_ip:2375/2376`) | `ECONNREFUSED` | **VERIFIED** |
| **Non-Root Execution** | Process UID and GID | `UID: 1000`, `GID: 1000` | **VERIFIED** |
| **Capabilities** | Effective Linux capabilities (`CapEff`) | `0000000000000000` (All dropped) | **VERIFIED** |
| **Privilege Escalation** | `no-new-privileges` flag | `NoNewPrivs: 1` in `/proc/1/status` | **VERIFIED** |
| **Root Filesystem** | Read-only image mount | `EROFS` on root `/` write | **VERIFIED** |
| **Kernel Parameters** | `/proc/sys` write protection | `EROFS` on `/proc/sys/kernel/hostname` | **VERIFIED** |
| **Tmpfs Storage** | `/tmp` execution restriction | `tmpfs (rw,nosuid,nodev,noexec)` | **VERIFIED** |
| **Anti-Forkbomb** | cgroup v2 PID limits | `pids.max: 100` (`EAGAIN` at 100) | **VERIFIED** |
| **Memory Limit** | cgroup v2 memory constraint | `memory.max: 268435456` (256 MB) | **VERIFIED** |
| **CPU Limit** | cgroup v2 CFS quota | `cpu.max: 50000 100000` (0.5 Cores) | **VERIFIED** |
| **Zero Host Ports** | Port publishing to host interface | `PortBindings: {}`, `ports: null` | **VERIFIED** |
| **Image Provenance** | Pinned immutable SHA-256 digest | Verified catalogue digest match | **VERIFIED** |
| **Evidence Ledger** | Canonical payload SHA-256 verification | Deterministic sorted key hashing | **VERIFIED** |

---

## 2. Docker Trust Boundary Analysis

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Express Web API Boundary                        │
│   (controllers/runtime.controller.js & routes/runtime.routes.js)       │
│                                                                        │
│   - Multi-tenant RBAC & Anti-CSRF verification                         │
│   - Receives client parameters (templateIdentifier, extraEnv)          │
│   - Trust Boundary: Cannot call Docker API directly                   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ submitProvisioningJob()
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               Provisioning Dispatcher & Job Queue Boundary             │
│                 (backend/src/runtime/provisioning-dispatcher.js)       │
│                                                                        │
│   - Enforces SHA-256 idempotency deduplication                         │
│   - Re-checks Dual-Custody Approval (Separation of Duties)             │
│   - Validates DSG Graph and Policy optimistic concurrency              │
│   - Pre-reserves Quota in PostgreSQL                                   │
│   - Concurrency Race Protection: Atomic rollback on P2002 collision    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ processJob()
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 Dedicated Runtime Worker Service Boundary              │
│                (backend/src/runtime/runtime-worker.service.js)         │
│                                                                        │
│   - Independent pre-flight re-validation                               │
│   - Drives the Container Runtime Adapter                               │
│   - Orchestrates lifecycle transitions: AUTHORIZED -> PROV -> ACTIVE   │
│   - Reconciles orphaned resources on crash/restart                     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Narrowly scoped API calls
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Restricted Container Runtime Adapter                 │
│              (backend/src/runtime/container-runtime-adapter.js)        │
│                                                                        │
│   - Parameter Sanitization:                                            │
│     * networkName regex: /^dec-net-[a-zA-Z0-9_-]{1,64}$/               │
│     * Forbids 'host', 'bridge', 'none', 'default'                      │
│     * Verifies target network has Internal: true                       │
│     * Filters extraEnv: forbids NODE_OPTIONS, LD_PRELOAD, BASH_ENV     │
│     * Enforces PortBindings: {}, Binds: [], CapDrop: ['ALL']           │
│   - Native node:http Unix domain socket client                         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ /Users/rahulseervi/.colima/default/docker.sock
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                           Docker Engine                                │
└────────────────────────────────────────────────────────────────────────┘
```

### Trust Boundary Evaluation Findings

1. **Process Socket Access:**  
   Currently, the `ContainerRuntimeAdapter` accesses `/Users/rahulseervi/.colima/default/docker.sock` via Node.js native `http` over Unix socket. In the development architecture, the Express backend and Runtime Worker execute within the same Node.js runtime process space. If the backend process were compromised, raw access to the socket path is possible.
2. **Arbitrary Docker API Operations:**  
   The Docker socket does not enforce RBAC or path-based access control. Any process with read/write access to the socket file can issue any Docker Engine API call.
3. **Parameter Injection Hardening (Stage 5B.2.1 Improvement):**  
   To prevent malicious job payloads from subverting container isolation, the `ContainerRuntimeAdapter` was hardened with:
   - **Network Name Sanitization:** Rejects `host`, `bridge`, `none`, or arbitrary formats.
   - **Internal Network Pre-Check:** Inquires Docker Engine before container creation; if `network.Internal !== true`, creation is aborted.
   - **Environment Variable Denylist:** Prohibits injection of execution hijackers (`NODE_OPTIONS`, `LD_PRELOAD`, `LD_LIBRARY_PATH`, `BASH_ENV`, `ENV`, `IFS`, `SHELL`, `PYTHONPATH`, etc.).
   - **Strict Hardcoded Security Context:** Host volume binds (`Binds: []`), host ports (`PortBindings: {}`), and privileged mode (`Privileged: false`) are hardcoded at the adapter layer and cannot be overridden by job data.

---

## 3. Container Privilege & Kernel Sandbox Analysis

Direct kernel state was inspected inside actual running synthetic containers via `/proc/1/status`, `/proc/1/ns/`, `/proc/mounts`, and cgroup v2 control files:

```
Process UID/GID:        1000 : 1000 (node:node)
CapInh (Inherited):     0000000000000000
CapPrm (Permitted):     0000000000000000
CapEff (Effective):     0000000000000000
CapBnd (Bounding):      0000000000000000
CapAmb (Ambient):       0000000000000000
NoNewPrivs:             1
Seccomp:                2 (SECCOMP_MODE_FILTER enabled)
Seccomp_filters:        1
Root Mount:             overlay on / type overlay (ro,relatime,...)
Tmpfs Mount:            tmpfs on /tmp type tmpfs (rw,nosuid,nodev,noexec,size=65536k)
PID Limit:              pids.max = 100
Memory Limit:           memory.max = 268435456 (256 MB)
CPU CFS Quota:          cpu.max = 50000 100000 (0.5 CPU cores)
Host Port Bindings:     None (PortBindings = {}, exposed ports = null)
```

### Empirical Penetration Tests

1. **Root Filesystem Write Attempt:**
   - Command: `fs.writeFileSync('/test.txt', 'malicious')`
   - Kernel Result: `EROFS: read-only file system, open '/test.txt'`
   - Verdict: **VERIFIED**
2. **Kernel Parameter Modification Attempt:**
   - Command: `fs.writeFileSync('/proc/sys/kernel/hostname', 'hacked')`
   - Kernel Result: `EROFS: read-only file system`
   - Verdict: **VERIFIED**
3. **Device Node Creation (`mknod`):**
   - Command: `mknod /tmp/sda b 8 0`
   - Kernel Result: `mknod: /tmp/sda: Operation not permitted` (Capability `CAP_MKNOD` is dropped and `/tmp` is `nodev`).
   - Verdict: **VERIFIED**
4. **Binary Execution in Transient Storage (`/tmp`):**
   - Command: `cp.execFileSync('/tmp/test.sh')`
   - Kernel Result: Executing from `/tmp` fails immediately due to `noexec` mount option.
   - Verdict: **VERIFIED**
5. **Anti-Forkbomb Verification:**
   - Command: Repeatedly spawned child processes in a tight loop.
   - Kernel Result: `EAGAIN` thrown precisely when `pids.current` reached `100`.
   - Verdict: **VERIFIED**

---

## 4. Adversarial Network Isolation Test Matrix

Adversarial probes were executed from inside a running container (`/dec-env-aacf59eb-cce8e796`, IP `172.21.0.2` on internal bridge `dec-net-aacf59eb-cce8e796`):

| Target Destination | Protocol | Target Port | Raw Kernel / Probe Result | Detailed Security Classification |
|---|---|---|---|---|
| Public Internet (`8.8.8.8`) | TCP | 53 | `ERR: ENETUNREACH` | **Firewall / Route Quarantine:** No default gateway configured in routing table (`172.21.0.0/16 dev eth0`). Packets dropped at kernel boundary. |
| Public Internet (`8.8.8.8`) | UDP | 53 | `ERR: ENETUNREACH` | **Firewall / Route Quarantine:** Outbound UDP datagram dropped. |
| Public Internet (`1.1.1.1`) | TCP | 80 | `ERR: ENETUNREACH` | **Firewall / Route Quarantine:** External IPv4 routing completely absent. |
| Public Internet (`2001:4860:...`) | TCP | 53 | `ERR: ENETUNREACH` | **Firewall / Route Quarantine:** External IPv6 unroutable. |
| Public DNS (`google.com`) | UDP/TCP | 53 | `ERR: EAI_AGAIN` | **DNS Failure:** System nameserver is unreachable; name resolution fails cleanly. |
| Host Bridge IP (`172.21.0.1`) | TCP | 5432 | `ERR: ECONNREFUSED` | **Connection Refused:** PostgreSQL is not listening on the bridge interface. |
| Host Bridge IP (`172.21.0.1`) | TCP | 6379 | `ERR: ECONNREFUSED` | **Connection Refused:** Redis is not listening on the bridge interface. |
| Host Bridge IP (`172.21.0.1`) | TCP | 4000 | `TIMEOUT_4000` | **Connection Timed Out:** Backend API port not routed / blocked. |
| Host Bridge IP (`172.21.0.1`) | TCP | 3000 | `TIMEOUT_3000` | **Connection Timed Out:** Frontend port not routed / blocked. |
| Host Bridge IP (`172.21.0.1`) | TCP | 2375/2376 | `ERR: ECONNREFUSED` | **Connection Refused:** Docker daemon TCP API is not listening on bridge IP. |
| Host Bridge IP (`172.21.0.1`) | TCP | 22 | `CONNECTED_22` (`SSH-2.0-OpenSSH_9.6p1`) | **Successful Connection:** Host OpenSSH daemon listens on `0.0.0.0:22` in the VM. See Section 5. |
| Tenant B Container (`172.22.0.2`) | TCP | 8080 | `ERR: ENETUNREACH` | **Cross-Tenant Isolation:** Distinct bridge networks have no routing table entries. Cross-tenant traffic is dropped. |
| Docker Socket (`/var/run/docker.sock`) | IPC | N/A | `SOCK_EXISTS: false` | **Filesystem Isolation:** Unix socket is not mounted into container namespace. |

---

## 5. Host-to-Container and Container-to-Host Reachability Analysis

### 5.1 Host-to-Container Reachability
- The container runs inside an internal bridge network (`Internal: true`) with `PortBindings: {}`.
- External hosts, LAN devices, and the host Mac **cannot connect directly** to the container's IP (`172.21.0.2:8080`). Direct curl from host Mac returned `(28) Failed to connect to 172.21.0.2 port 8080: Timeout was reached`.
- Worker health checks do not traverse an external IP network; they execute in-namespace HTTP probes via `docker exec`.

### 5.2 Container-to-Host Reachability & The SSH Daemon Finding
During adversarial port scanning against the bridge interface (`172.21.0.1`), port 22 connected and returned `SSH-2.0-OpenSSH_9.6p1 Ubuntu-3ubuntu13.16`:

```
Why this occurs:
1. Docker's Internal: true network configuration adds iptables rules to the FORWARD chain,
   dropping packets forwarded across interfaces (preventing internet egress and cross-bridge routing).
2. Packets sent to 172.21.0.1 (the local IP of the bridge interface on the host) hit the INPUT chain,
   not the FORWARD chain.
3. In standard Linux / VM environments (like Colima / Ubuntu), the SSH daemon binds to 0.0.0.0:22,
   making it accessible on all local interfaces, including bridge interfaces.
```

#### Defensive Impact & Risk Assessment
- **Authentication Required:** The SSH daemon requires key-based or password authentication; the unprivileged synthetic container possesses no SSH keys or host credentials.
- **Remediation Recommended for Production:** Host daemons should bind exclusively to loopback (`127.0.0.1`) or management interfaces, or host firewall rules must drop INPUT packets from bridge interfaces:
  ```bash
  iptables -I INPUT -i dec-net-+ -p tcp --dport 22 -j DROP
  ```

---

## 6. Image Supply-Chain Verification & Provenance

```javascript
{
  "imageIdentifier": "img-syn-alpine-node-01",
  "repository": "deception-synthetic-service",
  "tag": "1.0.0",
  "immutableDigest": "sha256:5e6dcf93ac4d11b70fb663b5a0a6e39b75bff656dee257b789edd0a0a1b8cb29",
  "approvalStatus": "APPROVED",
  "supportedServiceTypes": ["SYNTHETIC_API", "SYNTHETIC_AUTH", "SYNTHETIC_DATA"],
  "securityConfiguration": {
    "runAsUser": "1000:1000",
    "readOnlyRootfs": true,
    "capDrop": ["ALL"],
    "noNewPrivileges": true
  }
}
```

### Verification Findings
1. **Immutable Digest Pinning:** Before provisioning, the adapter calls `GET /images/<ref>/json` on the Docker Engine, retrieves `RepoDigests` and `Id`, and verifies that it strictly matches `immutableDigest`.
2. **Tag Mutability Resistance:** If a tag (`deception-synthetic-service:1.0.0`) is updated to point to a different image ID, `verifyImageDigest()` fails and rejects container creation.
3. **Image Signature Status:** Digital signature verification (e.g. Cosign / Notary v2) is **NOT IMPLEMENTED**; verification relies on local pinned SHA-256 digest matching against the certified catalogue.

---

## 7. Runtime Worker Failure Injection & Self-Healing

The test suite subjected the worker subsystem to adversarial failure modes:

| Failure Injection Scenario | Worker Response & System State | Verdict |
|---|---|---|
| **Health Check Failure** | Worker catches probe timeout / non-200, stops container, removes container and network, releases reserved quota, transitions job to `FAILED`. | **VERIFIED** |
| **Worker Crash with Orphan Network** | `cleanupOrphanResources()` scans Docker networks labeled `deception.managed: true` against active DB environment IDs and removes untracked networks. | **VERIFIED** |
| **Worker Crash with Orphan Container** | `cleanupOrphanResources()` stops and removes untracked containers. | **VERIFIED** |
| **Concurrent Duplicate Job Submission** | Idempotency race condition handled: catching Prisma unique constraint `P2002`, releasing speculative quota, and returning original winning job. | **VERIFIED** |
| **TTL Expiration Sweep** | `sweepExpiredEnvironmentsAndOrphans()` finds environments past `expiresAt`, terminates containers, releases quota, and sets state `TERMINATED`. | **VERIFIED** |

---

## 8. Execution Evidence Integrity & Cryptographic Ledger

Stage 5B.2.1 hardened the evidence recording pipeline with **deterministic canonical JSON serialization**:

```javascript
export function canonicalJsonStringify(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return `[${obj.map(canonicalJsonStringify).join(',')}]`;
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys.map(k => `${JSON.stringify(k)}:${canonicalJsonStringify(obj[k])}`);
  return `{${pairs.join(',')}}`;
}
```

### Cryptographic Evidence Integrity vs. Non-Repudiation

| Property | Current System Status | Technical Implementation |
|---|---|---|
| **Evidence Payload Integrity** | **VERIFIED** | SHA-256 computed on canonically sorted JSON payload. |
| **Tamper Detection** | **VERIFIED** | Altering any field (e.g. `networkId`, `quarantineVerified`) results in SHA-256 divergence detected by `verifyEvidenceIntegrity()`. |
| **Relational Binding** | **VERIFIED** | Bound to `tenantId`, `environmentId`, `jobId`, and `authorizationId`. |
| **Cryptographic Non-Repudiation** | **NOT IMPLEMENTED** | Records are stored in relational PostgreSQL rows without asymmetric digital signatures (Ed25519) or an append-only transparency log. A database administrator could modify rows directly. |

---

## 9. Remaining Vulnerabilities & Remediation Plan

| Vulnerability / Weakness | Severity | Description | Remediation Plan (Stage 5C / Production) |
|---|---|---|---|
| **Host Bridge Gateway Port 22 Accessible** | Medium | SSH daemon on host VM listens on `0.0.0.0:22` and accepts TCP connections from bridge IP `172.21.0.1`. | Bind host SSH daemon strictly to host physical interface or add iptables rule dropping INPUT packets from `dec-net-+`. |
| **In-Process Docker Socket Access** | Medium | Express backend shares process space with `ContainerRuntimeAdapter`. | Decouple runtime worker into an isolated operating system service communicating over gRPC / message queue with mutual TLS. |
| **Lack of Asymmetric Evidence Signatures** | Low | Execution evidence relies on SHA-256 hashes without PKI signatures. | Introduce worker private key signing (Ed25519) for evidence payloads to achieve non-repudiation. |
| **Image Cosign Signatures Not Checked** | Low | Images verified by pinned SHA-256 digest rather than cryptographic Cosign / Sigstore signature. | Add Cosign signature verification in CI/CD pipeline prior to image catalogue admission. |

---

## 10. Verification Verdict

**Verdict:** **COMPLETE**

All 44 automated tests in [`backend/tests/runtime-adversarial-isolation.test.js`](file:///Users/rahulseervi/Documents/GitHub/Final-Year-Project/backend/tests/runtime-adversarial-isolation.test.js) passed with 100% success against the live Docker daemon. All 442 backend tests, 37 gateway tests, and frontend build passed cleanly.
