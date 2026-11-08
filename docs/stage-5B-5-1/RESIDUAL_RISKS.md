# Stage 5B.5.1 — Residual Risks & Operational Boundaries

## 1. Scope & Adversarial Risk Posture

Stage 5B.5.1 audited and hardened the Adaptive Cyber Deception Gateway against traffic misrouting, false-positive synthetic diversion, and conflated reporting. While the system mathematically preserves origin forwarding in `SHADOW` mode and safely blocks live diversion in `CONTROLLED_LAB` mode, several residual risks and operational boundaries remain.

These residual risks must be resolved before the research prototype can be transitioned to active production traffic diversion.

---

## 2. Analysis of Residual Risks

### Risk 1: Host Boundary Quarantine (Stage 5B.2.1 Finding A)
- **Vulnerability Description:** In Stage 5B.2.1, adversarial probing demonstrated that synthetic deception containers running on Docker bridge networks could potentially attempt TCP connections to services listening on the host machine if host netfilter `INPUT` rules are not explicitly configured to reject traffic from Docker bridge interfaces.
- **Current Status:** **BLOCKED BY ARCHITECTURAL GATE.** Live traffic diversion into synthetic containers is locked out via `checkControlledLabReadiness` in `runtime-selection.service.js`. Every request in `CONTROLLED_LAB` mode is intercepted and safely forwarded to the real application (`CONTROLLED_LAB_BLOCKED`).
- **Required Remediation:** Implementation and automated kernel-level verification of host `iptables -I INPUT -i br-+ -j DROP` (or equivalent `nftables` chain) on the target Linux production host before removing the safety blocker.

### Risk 2: Containerization Environment Differences (Colima vs. Native Linux)
- **Description:** Development and continuous verification on macOS utilize Colima (a virtualized QEMU/Alpine Linux environment) to host the Docker Engine daemon. While network namespaces and bridge filtering behave identically within the VM kernel, host-to-VM port forwarding semantics differ from native bare-metal Linux.
- **Impact:** Firewall rules that succeed within the Colima VM cannot be assumed to provide identical host-level protection on native bare-metal production distributions (e.g., Ubuntu 24.04, RHEL 9) without dedicated bare-metal validation.
- **Mitigation Strategy:** Establish a bare-metal CI/CD runner executing native Linux kernel netfilter verification before enabling live diversion.

### Risk 3: Synchronous Database Latency & Ingress Bottlenecks
- **Description:** The current Gateway Decision Controller synchronously queries PostgreSQL (via Prisma ORM) and performs SHA-256 evidence hash chaining on the critical request path. This introduces an average of 7.46 ms added processing latency per request.
- **Impact:** Under high-volume burst traffic (> 2,500 concurrent requests/second), PostgreSQL connection pool saturation could introduce queueing delays or trigger fail-safe fallbacks.
- **Mitigation Strategy:** 
  1. The built-in fail-safe trap (`outcomeStatus: FAIL_SAFE_ORIGIN`) ensures that database latency spikes will never blackhole client traffic; requests will simply pass through to the origin.
  2. Future production hardening requires offloading non-critical audit log persistence to an asynchronous queue (e.g., Redis Streams or Kafka).

### Risk 4: Attacker Timing Fingerprinting (Side-Channel Latency Delta)
- **Description:** The baseline application origin responds in ~5.87 ms, whereas deep deception inspection in `SHADOW` mode takes ~13.33 ms. A sophisticated adversary measuring high-resolution TCP round-trip times (RTT) across repeated requests might infer that certain endpoints or payloads trigger deep security inspection.
- **Impact:** Potential side-channel awareness by human adversaries conducting reconnaissance against the gateway.
- **Mitigation Strategy:** Implement artificial jitter injection or uniform latency padding (tarpit-style response shaping) across all ingress endpoints in future releases.

### Risk 5: Generalizability Limitation of Preliminary Synthetic Evaluation
- **Description:** The 100% precision and recall metrics reported in Stage 5B.5.1 were derived from a curated 10-scenario synthetic benchmark workload executed under controlled laboratory conditions.
- **Impact:** In an open-world production deployment with uncurated user traffic, legitimate API integrations with non-standard HTTP clients or novel zero-day attacks may produce false positives or false negatives.
- **Mitigation Strategy:** Deception evaluation must remain strictly in `SHADOW` mode during initial deployment to collect real-world false-positive rates before any live diversion is considered.
