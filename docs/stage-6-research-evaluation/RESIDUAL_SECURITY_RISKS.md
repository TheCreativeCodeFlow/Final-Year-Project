# Stage 6 — Residual Security Risks & Controlled-Lab Boundaries

## 1. Controlled-Lab Readiness Blocker (`Finding A`)

- **Vulnerability Description:** As established in Stage 5B.2.1/5B.2.2, without verified Linux host `INPUT` netfilter rules rejecting ingress packets originating from Docker bridge interfaces (`br-+`), an isolated container on a bridge network could attempt loopback/gateway connections against host services (e.g., SSH port 22).
- **Mandatory Safety Gate:** Live production traffic diversion via `ROUTING_MODES.CONTROLLED_LAB` remains strictly blocked by `RuntimeSelectionService.checkControlledLabReadiness()` (`CONTROLLED_LAB_BLOCKED: Unresolved host INPUT firewall finding (Stage 5B.2.2 Finding A)`).
- **Stage 6 Verification:** Confirmed programmatically (`stage-6-research-evaluation.test.js` Test 10) that `checkControlledLabReadiness` blocks activation when `firewallDropRuleApplied !== true`, while comparative experiments ran solely inside isolated synthetic test harnesses without altering host firewall rules or bypassing readiness gates.

---

## 2. Privileged Docker Worker Trust Boundary

- **Boundary Design:** The Express control-plane backend holds zero direct Docker socket privileges (`RuntimeEnvironmentManager` and `ProvisioningDispatcher` contain no `ContainerRuntimeAdapter`). Container lifecycle operations (`ContainerRuntimeAdapter`) are isolated inside a dedicated `StandaloneRuntimeWorker` process authenticated via HMAC/bearer IPC tokens (`worker-client.js`).
- **Residual Exposure:** The `StandaloneRuntimeWorker` itself retains read/write access to the Docker daemon socket (`docker.sock`), which is root-equivalent on the host/VM kernel if the worker process is ever compromised via arbitrary code execution. Worker inputs are constrained to strictly allowlisted templates, SHA-256 pinned images (`img-syn-alpine-node-01`), non-root container UIDs (`1000:1000`), `CapDrop: ['ALL']`, `ReadonlyRootfs: true`, `Binds: []`, and `Internal: true` bridge networks—completely banning arbitrary image names, host port bindings, or shell exec payloads.

---

## 3. Virtualized VM vs. Bare-Metal Netfilter Semantics

- Verification executed on macOS uses Colima (`QEMU/VZ` Alpine Linux guest VM), meaning bridge interface isolation and container stats reside inside the guest Linux kernel rather than bare-metal enterprise Linux (`iptables`/`nftables` chains on Ubuntu/RHEL). Kernel-level netfilter rules must be re-validated on bare-metal deployment hosts prior to removing the `Finding A` activation blocker.

---

## 4. Cryptographic Evidence Non-Repudiation & External Trust Anchors

- `ExecutionEvidenceRecorder` computes append-linked canonical SHA-256 chains (`eventHash = SHA256(canonicalPayload + previousEventHash)`) serialized per scope (`_recordEventSerialized`) to guarantee tamper detection against unchained DB mutations or row deletions.
- **Explicit Scope Boundary:** As documented in `execution-evidence-recorder.service.js`, **asymmetric non-repudiation** and **independent external trust anchors** (e.g., HSM signatures or RFC 3161 TSA) remain `NOT_IMPLEMENTED`. If an attacker gains privileged write access to PostgreSQL AND application secrets simultaneously, historical chains could be recomputed offline.

---

## 5. Response Header Watermarks & Timing Side Channels

- Synthetic lab containers emit `X-Synthetic-Deception: true` headers and plaintext mock session notices for laboratory auditability, which `sanitizeResponseHeaders()` currently does not strip.
- Live Docker container `/exec` mutations add ~33 ms vs loopback origin latency (~0.9–6 ms), creating a measurable TCP timing differential if exposed directly to unthrottled adversaries without uniform latency padding.
