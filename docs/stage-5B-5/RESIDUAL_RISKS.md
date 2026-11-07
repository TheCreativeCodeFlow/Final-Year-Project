# Stage 5B.5 — Residual Security Risks & Hardening Backlog

## 1. Overview

While Stage 5B.5 successfully delivers complete adaptive gateway decisioning, shadow evaluation, and safe controlled routing, several residual security and operational risks remain identified in the system backlog.

---

## 2. Residual Risk Analysis

### Risk 1: Unresolved Host Boundary Exposure (Finding A)
- **Status:** **BLOCKED BY SAFEGUARD** (Risk Managed).
- **Description:** Synthetic deception containers running on Docker bridge networks (`172.x.x.x`) can theoretically communicate with the host daemon via the bridge gateway IP (e.g., port 22/SSH or port 5432/PostgreSQL) if host-level packet filtering is missing.
- **Current Safeguard:** `RuntimeSelectionService` strictly enforces `CONTROLLED_LAB_BLOCKED`. Live traffic is never diverted into synthetic containers while this finding is open; traffic safely falls back to origin with `DEFER_TO_ORIGIN`.
- **Permanent Remediation Required:**
  On Linux production hosts, install a persistent host-level `iptables` drop rule in the `INPUT` chain:
  ```bash
  sudo iptables -I INPUT -i br-+ -m comment --comment "Block synthetic container access to host" -j DROP
  sudo iptables -I INPUT -i docker0 -m comment --comment "Block docker0 access to host" -j DROP
  ```
  Once verified in container runtime evidence, `hostBoundaryVerified` will evaluate to `true`.

### Risk 2: OS-Level Kernel Network Differences (macOS / Colima vs. Linux)
- **Status:** **INFORMATIONAL**.
- **Description:** Development and testing on macOS utilizes Colima (a lightweight Linux VM running containerd/Docker). The host bridge network behavior differs slightly from native bare-metal Linux with direct eBPF and netfilter capabilities.
- **Impact:** Production deployment on native Linux Kubernetes/Docker hosts requires validating iptables chains directly against host network interfaces.

### Risk 3: In-Memory Routing Mode Registry
- **Status:** **OPERATIONAL**.
- **Description:** Application and tenant routing modes (`OBSERVE_ONLY`, `SHADOW`, `CONTROLLED_LAB`) are stored in an in-memory registry within `RuntimeSelectionService` to avoid database schema churn during Stage 5B.5.
- **Impact:** Gateway worker restarts will revert to the default mode (`SHADOW`).
- **Remediation:** In Stage 5B.6, persist `routingMode` directly to the `ProtectedApplication` table with Prisma migrations.

### Risk 4: Dual-Custody Approval Expiration Handling
- **Status:** **RESOLVED BY DESIGN**.
- **Description:** If an approved execution authorization expires while a container is serving live traffic, immediate mid-session disruption could alert sophisticated attackers.
- **Mitigation:** The gateway checks authorization validity on every new session ingress. If an authorization expires, existing sessions are allowed to finish their current request, but new sessions reject the container and defer to origin.
