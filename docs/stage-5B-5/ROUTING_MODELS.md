# Stage 5B.5 — Routing Models & Execution Modes

## 1. Overview

The Adaptive Cyber Deception Gateway supports three operational routing modes, configured at the tenant or application level:

1. **`OBSERVE_ONLY`**: Zero intervention / Passive Telemetry.
2. **`SHADOW`** (Default): Non-Interfering Adaptive Shadowing / Hypothetical Deception.
3. **`CONTROLLED_LAB`**: Gated Live Traffic Diversion to Isolated Deception Environments.

---

## 2. Comparative Matrix

| Feature / Guarantee | `OBSERVE_ONLY` | `SHADOW` (Default) | `CONTROLLED_LAB` |
| :--- | :--- | :--- | :--- |
| **Primary Objective** | Baseline telemetry & rule auditing | Counterfactual evaluation without production risk | Live attacker diversion & interactive containment |
| **Live Traffic Target** | Real Protected Origin | Real Protected Origin | Synthetic Container (if verified) or Real Origin |
| **Detection Engine** | Active (Logs alerts) | Active (Generates assessments) | Active (Generates assessments) |
| **Policy Evaluation** | Active (Records proposals) | Active (Produces hypothetical decisions) | Active (Produces binding decisions) |
| **DSG Planning** | Inactive | Active (Plans hypothetical mutations) | Active (Executes approved mutations) |
| **Synthetic Containers** | Idle / None | Evaluated hypothetically for readiness | Serves live diverted HTTP traffic |
| **Credential Stripping** | N/A (Origin receives raw) | N/A (Origin receives raw) | Strict (Auth & cookies stripped) |
| **Host Boundary Check** | Ignored | Evaluated hypothetically | **Hard Blocker** (`CONTROLLED_LAB_BLOCKED`) |
| **Fail-Safe Fallback** | Forward to origin | Forward to origin | Forward to origin with audit flag |

---

## 3. Operational Mode Detailed Specifications

### 3.1. Mode A: `OBSERVE_ONLY`
- **Behavior:** The gateway functions purely as a telemetry probe. It extracts features, correlates sessions, and runs the hybrid detector, but it **never proposes or selects deception environments**.
- **Action:** `NORMAL_ROUTING`.
- **Routing Outcome:** `NORMAL_FORWARD`.
- **Use Case:** Initial tenant onboarding, baseline statistical model training, zero-impact traffic profiling.

### 3.2. Mode B: `SHADOW` (Default Production Mode)
- **Design Philosophy:** Evaluates end-to-end adaptive deception decisions, tests candidate container readiness, and records hypothetical divergence without altering production user experience.
- **Behavior:**
  - Evaluates hybrid detection and matches tenant policies.
  - Generates full DSG plans and selects eligible candidate containers.
  - Formulates hypothetical synthetic ingress URLs (e.g., `http://127.0.0.1:8081`).
  - Emits `SHADOW_DECISION` and `HYPOTHETICAL_OUTCOME` audit events.
  - **Unconditionally routes the live HTTP request to the real protected application origin.**
- **Action:** `NORMAL_ROUTING`.
- **Routing Outcome:** `SHADOW_DECEPTION` (or `RUNTIME_UNAVAILABLE` if no suitable container exists).
- **Safety Guarantee:** Attacker or benign user traffic is never prematurely exposed to synthetic deception artifacts. Zero latency or functional risk to legitimate transactions.

### 3.3. Mode C: `CONTROLLED_LAB`
- **Design Philosophy:** Permitted live traffic diversion in controlled experimental or dedicated lab configurations where all safety invariants are mathematically proven.
- **Pre-Activation Checklist (Hard Invariants):**
  1. `tenantOwnershipVerified === true`: Synthetic environment belongs to the same tenant.
  2. `applicationVerified === true`: Synthetic environment is mapped to the requested application.
  3. `runtimeHealthVerified === true`: Health status is strictly `HEALTHY` or `DEGRADED` (not `UNHEALTHY` or `TERMINATED`).
  4. `authorizationVerified === true`: Dual-custody authorization is `APPROVED` and within expiration bounds.
  5. `networkIsolationVerified === true`: Container network is `SANDBOX_ISOLATED` or `STRICT_AIRGAP`.
  6. `rollbackReadinessVerified === true`: Synthetic state snapshot or version rollback point exists.
  7. **`hostBoundaryVerified === true`**: The host `INPUT` drop rule is verified.
- **The Host Boundary Blocker:**
  - In Stage 5B.2.1 / 5B.2.2, Finding A identified that container bridge gateways can reach host port 22 without explicit host iptables drop rules.
  - Until this finding is remediated with host iptables rules, `CONTROLLED_LAB` is **strictly blocked** (`CONTROLLED_LAB_BLOCKED`).
  - When blocked, the gateway **safely falls back** to the real origin with outcome `DEFER_TO_ORIGIN`. Live traffic is never diverted insecurely.
