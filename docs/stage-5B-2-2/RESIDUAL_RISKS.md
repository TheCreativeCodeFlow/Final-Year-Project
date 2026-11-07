# Stage 5B.2.2 Residual Risks & Security Disclosures

## 1. Overview

While Stage 5B.2.2 eliminates critical vulnerabilities identified in Stage 5B.2.1 (namely monolithic Docker socket exposure, unmanaged resource discrepancies, and unverified audit logs), several residual risks remain. These risks are documented below with their architectural contexts and future mitigation roadmaps.

---

## 2. Residual Risk Analysis

### 2.1 Host Bridge Gateway SSH Exposure in Environments Without Host Firewall Rules
- **Risk Severity**: Medium
- **Description**: In Docker environments where the host root firewall drop rule (`iptables -I INPUT -i decbr+ -j DROP`) has not been applied (or cannot be applied without root/sudo credentials), synthetic containers can connect to the bridge gateway IP on port 22 (`172.x.x.1:22`).
- **Context**: While `scripts/remediate-host-boundary.sh` provides automated remediation, applying host iptables rules requires elevated administrative permissions (`sudo` or VM-level root). In CI/CD pipelines or containerized environments lacking CAP_NET_ADMIN privileges, this rule cannot be applied automatically at runtime.
- **Residual Impact**: An attacker achieving RCE inside the container can discover the bridge gateway and attempt SSH authentication against the host. However, the host SSH configuration still requires strong credentials/keys, and all other host management ports (2375, 5432, 6379, etc.) are closed or non-listening on that interface.
- **Future Roadmap (Stage 5C)**: Implement network namespaces or user-mode TCP proxies (e.g., Slirp4netns) to prevent synthetic containers from sharing the host bridge gateway address space altogether.

---

### 2.2 Unanchored Hash Chain & Lack of Legal Non-Repudiation
- **Risk Severity**: Low / Informational
- **Description**: The append-linked SHA-256 evidence chain provides mathematical verification that records have not been altered or deleted in place without detection. However, it relies on symmetric hashing without asymmetric digital signatures from hardware security modules (HSM) or third-party cryptographic timestamping authorities (RFC 3161).
- **Residual Impact**: An internal attacker with direct write access to the PostgreSQL database and application code could potentially rewrite an entire chain from a historical point forward and recompute all downstream hashes.
- **Status**: Formally acknowledged and classified as `NON_REPUDIATION: NOT_IMPLEMENTED` and `INDEPENDENT_TRUST_ANCHOR: NOT_IMPLEMENTED` across all documentation and frontend interfaces.
- **Future Roadmap (Stage 6)**: Integrate RFC 3161 Time-Stamping Authorities or an append-only transparency log (e.g., Sigstore Rekor) to anchor chain roots externally.

---

### 2.3 Worker Process Trust Boundary & Docker Daemon Privileges
- **Risk Severity**: Medium
- **Description**: The dedicated worker daemon process (`worker-process.js`) connects directly to the Docker Engine socket (`docker.sock`).
- **Residual Impact**: Although the Express web backend has zero Docker access and only communicates via authenticated loopback IPC (`127.0.0.1:5055`), the worker daemon itself runs with sufficient privileges to interact with the host Docker daemon. A zero-day vulnerability in the worker daemon or its dependencies could compromise the container runtime.
- **Mitigation in Place**:
  - Worker accepts only pre-approved service template identifiers (`tpl-synthetic-api-01`, etc.).
  - Worker enforces immutable SHA-256 image digests from the Approved Catalogue.
  - Hardened container parameters (`ReadonlyRootfs: true`, `CapDrop: ['ALL']`, `no-new-privileges: true`, `PidsLimit: 100`, zero volume mounts) are strictly enforced in code before the container creation request is sent.
- **Future Roadmap (Stage 5C)**: Migrate from Docker daemon socket to Rootless Docker or Kata Containers (microVMs) for hardware-isolated virtualization.

---

### 2.4 Lack of Live Gateway Traffic Diversion
- **Risk Severity**: Non-Goal / Research Boundary
- **Description**: The gateway reverse-proxy does not yet route live attacker traffic to synthetic deception containers.
- **Context**: Stage 5B.2.2 is strictly an execution architecture and isolation stage. Container provisioning is triggered only by dual-custody approved authorizations and test harness executions. Live production traffic continues to route to real origins or fail closed.
- **Future Roadmap (Stage 5B.3)**: Implement secure dynamic SNI / HTTP path diversion within the gateway reverse-proxy based on policy decisions.
