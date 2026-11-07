# Stage 5B.3 — Residual Security Risks & Limitations

## 1. Overview

In adherence to the platform's cybersecurity research principles, this document transparently records all known limitations, operational constraints, and carried-forward residual risks in the Stage 5B.3 implementation.

These risks must be explicitly accounted for before introducing live gateway traffic diversion in Stage 5B.4.

---

## 2. Carried-Forward & Identified Residual Risks

### Risk 1: Host Boundary Quarantine Requires Root/Host Sudo
- **Severity**: MEDIUM-HIGH
- **Description**: The iptables host boundary isolation script (`quarantine-host-boundary.sh`) configured in Stage 5B.2.2 requires `root` / `sudo` capabilities on the Docker host OS to install `INPUT` chain drop rules.
- **Current State**: In standard non-root development deployments or container-in-VM setups (e.g., macOS with Colima / Docker Desktop), this host boundary script cannot be executed automatically by an unprivileged backend service.
- **Mitigation in 5B.3**: Network isolation is enforced via Docker's internal bridge mode (`Internal: true`), which prevents default gateway routing and DNS resolution. However, direct host-loopback filtering remains dependent on host-level deployment scripts.

### Risk 2: Worker Process Retains Docker Daemon Access
- **Severity**: HIGH
- **Description**: The standalone runtime worker (`worker-process.js`) communicates directly with the Docker daemon socket (`/var/run/docker.sock`). In Unix environments, write access to `/var/run/docker.sock` is equivalent to root access on the host.
- **Current State**: The backend main process does not have access to the Docker socket; it communicates with the worker exclusively via authenticated IPC. However, if the worker process itself were compromised, the Docker daemon interface could be abused.
- **Planned Mitigation (Future)**: Rootless Docker daemon or a dedicated, sandboxed gRPC micro-proxy with strict command whitelisting.

### Risk 3: Non-Repudiation Is Not Implemented (`NON_REPUDIATION: NOT_IMPLEMENTED`)
- **Severity**: MEDIUM
- **Description**: The execution evidence chain employs cryptographic SHA-256 hash linking and HMAC signatures computed within the backend application layer.
- **Current State**:
  - Individual human operators and administrators do not sign execution milestones with personal asymmetric private keys (e.g., Ed25519 / WebAuthn tokens).
  - The system provides high-assurance internal auditability and tamper-detection, but does not provide legal non-repudiation against a fully compromised database administrator.
- **Explicit Invariant**: Documented and flagged as `NON_REPUDIATION: NOT_IMPLEMENTED`.

### Risk 4: Independent Trust Anchor Is Not Implemented (`INDEPENDENT_TRUST_ANCHOR: NOT_IMPLEMENTED`)
- **Severity**: MEDIUM
- **Description**: The evidence chain relies on server wall-clock timestamps and internal sequential ordering.
- **Current State**:
  - No external RFC 3161 Timestamping Authority (TSA) or public append-only ledger (e.g., Rekor, Sigstore, Certificate Transparency) is integrated.
  - A malicious actor with access to the host machine could theoretically manipulate the host system clock.
- **Explicit Invariant**: Documented and flagged as `INDEPENDENT_TRUST_ANCHOR: NOT_IMPLEMENTED`.

### Risk 5: Storage Quota Enforcement Is Accounting-Only
- **Severity**: LOW-MEDIUM
- **Description**: The deception resource governor tracks and enforces container storage quotas (`diskQuotaMb`) in metadata before provisioning.
- **Current State**:
  - The Docker runtime adapter does not enforce kernel-level disk quota limits (e.g., `--storage-opt size=...`) because standard overlay2 filesystems on macOS/ext4 require underlying mount flags (`pquota` / `prjquota`).
  - An adversary with code execution in a synthetic container could fill the local host storage if write boundaries were not restricted.
- **Mitigation in 5B.3**: Containers are provisioned with `--read-only` root filesystems, restricting writes strictly to bounded tmpfs mounts.

### Risk 6: Volatile In-Memory Telemetry Buffers
- **Severity**: LOW
- **Description**: High-frequency synthetic telemetry events are captured in bounded in-memory circular ring buffers (500 events per environment) to avoid excessive database I/O.
- **Current State**:
  - While critical lifecycle milestones, anomalies, and mutations are permanently committed to PostgreSQL and the SHA-256 evidence chain, raw HTTP telemetry events are volatile.
  - An unexpected crash or restart of the backend service flushes the uncommitted in-memory ring buffer.

### Risk 7: Gateway Traffic Diversion Not Yet Active
- **Severity**: INFORMATIONAL / NON-GOAL
- **Description**: In accordance with Stage 5B.3 strict non-goals, the gateway reverse proxy does not yet redirect live attacker HTTP traffic to synthetic deception containers.
- **Current State**: All runtime testing and verification are performed using synthetic probes and test workloads. Production traffic routing is deferred to Stage 5B.4.
