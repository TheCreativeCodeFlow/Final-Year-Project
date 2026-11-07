# Stage 5B.2.2 Threat Model: Host Boundary Exposure and Worker Privilege Separation

## 1. Scope & System Description

This threat model analyzes the execution tier of the AI-Enabled Adaptive Cyber Deception Gateway following the Stage 5B.2.2 refactoring.
The system provisions isolated synthetic services (e.g., mock banking APIs, SSH honeypots) to engage attackers detected by hybrid behavioral rules and Isolation Forest models.

The primary assets under protection are:
1. **The Host Operating System and Kernel**: Preventing container breakout, host port reconnaissance, and lateral movement.
2. **The Docker Engine Daemon**: Preventing unauthorized container execution, host volume mounting, or privilege escalation.
3. **The Multi-Tenant Core (PostgreSQL & Express Backend)**: Preventing cross-tenant data leakage or tampering with detection models and execution authorizations.
4. **The Execution Evidence Audit Log**: Ensuring forensic records cannot be silently rewritten or forged.

---

## 2. Threat Actors & Capabilities

| Threat Actor | Initial Access / Capabilities | Objective |
| :--- | :--- | :--- |
| **Attacker in Synthetic Container (Compromised Container)** | Remote Code Execution (RCE) inside a synthetic container via simulated vulnerability exploitation. | Break out of container sandbox, access host files, reach host SSH daemon, or probe other internal services. |
| **Malicious Tenant Operator** | Valid tenant account with ANALYST or APPLICATION_OWNER credentials. | Escalate privileges to PLATFORM_ADMIN, bypass dual-custody approval, allocate arbitrary CPU/memory, or compromise other tenants. |
| **Compromised Web Backend (Express Tier)** | Attacker achieves RCE or SQL injection within the Express backend process. | Gain root control over host system by issuing commands to the Docker Engine daemon. |
| **Malicious Insider / Rogue Database Admin** | Read/write access to PostgreSQL database. | Forge execution evidence, alter forensic audit records, or cover tracks of malicious diversion. |

---

## 3. Analysis of Vulnerability Findings

### 3.1 Finding A: Host Boundary Exposure via Linux INPUT Netfilter Chain
- **Vulnerability**: Docker internal networks (`--internal`) only insert drop rules into the `FORWARD` iptables chain. They do not restrict traffic destined for the host's own IP addresses on that bridge network (the bridge gateway IP, e.g., `172.21.0.1`).
- **Impact**: Attackers gaining code execution inside the container could probe the bridge gateway on port 22 (`sshd`), port 2375 (Docker TCP), or other host management services. In default configurations, this exposes the host OpenSSH daemon banner and allows SSH brute-force or credential guessing directly against the host.
- **Mitigation in Stage 5B.2.2**:
  - Docker bridge devices are assigned names matching `decbr[a-f0-9]{8}`.
  - A non-destructive iptables drop rule is applied to the host `INPUT` chain:
    `iptables -I INPUT -i decbr+ -j DROP`
  - Automated detection and remediation script (`scripts/remediate-host-boundary.sh`) allows checking and enforcing this rule across host and Colima VM environments.

### 3.2 Finding B: Monolithic Express Backend Holding Docker Socket Access
- **Vulnerability**: In Stage 5B.2, Express controllers and runtime managers directly imported `ContainerRuntimeAdapter` and communicated with `/var/run/docker.sock`.
- **Impact**: Any vulnerability in an Express route, JSON parsing library, or third-party npm package could allow an attacker to make unauthenticated requests to the Docker Engine API, escaping all platform tenancy controls, mounting the host root filesystem (`/`), and achieving full host compromise.
- **Mitigation in Stage 5B.2.2**:
  - All Docker socket connectivity is completely removed from the Express backend codebase.
  - Runtime execution is delegated to an isolated OS process (`worker-process.js`).
  - IPC between backend and worker occurs strictly over loopback HTTP (`127.0.0.1:5055`) with pre-shared bearer token validation (`x-worker-token`).
  - Even if the Express backend is compromised, the attacker cannot execute arbitrary Docker commands; they can only enqueue predefined template provisioning jobs subject to dual-custody checks and strict allowlisting enforced by the worker daemon.

### 3.3 Finding C: Resource Limit Semantic Mismatch
- **Vulnerability**: Divergence between requested template limits (0.5 CPU / 256 MB), policy limits (1.0 CPU / 512 MB), quota reservations, and cgroup kernel parameters could cause resource starvation or evasion.
- **Mitigation in Stage 5B.2.2**:
  - Explicit 4-tier reconciliation table implemented and validated.
  - Cgroup parameters are locked: `Memory: 268435456` bytes, `CpuPeriod: 100000`, `CpuQuota: 50000`, `PidsLimit: 100`.
  - Storage is documented as accounting-only, enforced by `ReadonlyRootfs: true` and 64 MB tmpfs.

### 3.4 Finding D: Audit Log Non-Repudiation Overclaim
- **Vulnerability**: Previous milestone claimed tamper-proof non-repudiation for database audit logs without cryptographic chaining or external trust anchors.
- **Mitigation in Stage 5B.2.2**:
  - Implemented SHA-256 append-linked hash chaining: $H_i = \text{SHA256}(P_i \parallel H_{i-1})$.
  - Introduced `verifyEvidenceChain()` to detect record modifications, intermediate deletions, and broken references.
  - Transparently marked non-repudiation and independent trust anchoring as `NOT_IMPLEMENTED` to avoid security overclaims.

---

## 4. Threat Matrix and Remediation Status

| Threat ID | Threat Description | Severity | Remediation Mechanism | Status |
| :--- | :--- | :--- | :--- | :--- |
| **THREAT-01** | Container-to-Host SSH reachability (`172.x.x.1:22`) | High | `decbr+` interface wildcard drop rule in host `INPUT` chain | Remediated in code; requires host rule application |
| **THREAT-02** | Express process compromise leads to Docker daemon root access | Critical | Complete extraction of Docker socket into isolated worker process | Fully Remediated |
| **THREAT-03** | Arbitrary container image execution or supply-chain attack | High | Worker-enforced Approved Image Catalogue with pinned SHA-256 digests | Fully Remediated |
| **THREAT-04** | Fork bomb or resource exhaustion inside container | Medium | Kernel cgroup enforcement: `pids.max=100`, `memory.max=256MB`, `cpu.max=50000` | Fully Remediated |
| **THREAT-05** | Host filesystem modification via container bind mount | Critical | `ReadonlyRootfs: true`, `Binds: []`, memory-backed 64MB tmpfs only | Fully Remediated |
| **THREAT-06** | Cross-tenant network sniffing or inter-container attack | High | Dedicated isolated bridge networks per environment; cross-tenant communication blocked | Fully Remediated |
| **THREAT-07** | Attacker tampers with execution evidence in database | Medium | Append-linked SHA-256 hash chaining with automated verification and tamper detection | Fully Remediated |
