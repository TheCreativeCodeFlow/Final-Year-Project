# Host Boundary Verification & Remediation Guide

## 1. Finding A Overview: Root Cause & Technical Details

In Stage 5B.2.1, adversarial probing demonstrated that synthetic deception containers could establish TCP connections to port 22 on the bridge gateway IP (`172.x.x.1:22`) and receive the OpenSSH banner of the host system.

### 1.1 Netfilter Traversal Mechanics
Docker's standard bridge networking relies on Linux `iptables` rules to route and isolate traffic:
1. **The `FORWARD` Chain**:
   When a Docker network is created with `--internal`, Docker appends drop rules to the `DOCKER-ISOLATION-STAGE-1` and `FORWARD` chains:
   ```
   Chain FORWARD (policy ACCEPT)
   target     prot opt source               destination
   DOCKER-ISOLATION-STAGE-1  all  --  anywhere             anywhere
   ```
   This prevents packets originating from the internal bridge from being forwarded to other host interfaces (e.g., `eth0`, `wlan0`) or out to the Internet.
2. **The `INPUT` Chain**:
   Packets whose destination IP address is local to the host (such as the bridge gateway address `172.x.x.1` assigned to the virtual bridge interface) do **NOT** traverse the `FORWARD` chain. Instead, they enter the host's `INPUT` chain:
   ```
   Chain INPUT (policy ACCEPT)
   target     prot opt source               destination
   (empty or default ACCEPT)
   ```
   Because services like `sshd` generally bind to `0.0.0.0:22` (all IPv4 interfaces), incoming TCP SYN packets from the synthetic container to `172.x.x.1:22` are accepted by the Linux kernel and delivered to the host `sshd` process.

---

## 2. Targeted Remediation via Interface Prefixing (`decbr+`)

### 2.1 The Naming Challenge
Indiscriminately blocking the `INPUT` chain on `0.0.0.0/0` would disconnect developer SSH sessions, block legitimate loopback communication, or disrupt standard Docker container traffic.
Furthermore, Linux network interface names are restricted to a maximum length of 15 characters (`IFNAMSIZ - 1`).

### 2.2 The Solution
1. **Bridge Device Name Generation**:
   In `backend/src/runtime/container-runtime-adapter.js`, the network creation call configures the bridge device driver option:
   ```javascript
   const shortId = crypto.randomBytes(4).toString('hex'); // 8 hex chars
   const bridgeDeviceName = `decbr${shortId}`; // exactly 13 characters (<= 15)
   ```
   This ensures all deception bridge interfaces start with the unique prefix `decbr`.
2. **Targeted Drop Rule**:
   Using iptables wildcard syntax (`decbr+`), a single rule drops all incoming traffic from any deception bridge entering host local processes:
   ```bash
   iptables -I INPUT -i decbr+ -j DROP
   ```
   This rule is completely non-destructive:
   - Does not affect `docker0` or external container networks.
   - Does not affect loopback `lo`.
   - Does not affect developer SSH connections arriving on physical interfaces.

---

## 3. Host Remediation Script Reference (`scripts/remediate-host-boundary.sh`)

The repository includes a dedicated shell utility to inspect and control the host boundary rule.

### 3.1 Usage & Modes
```bash
# Check if the drop rule is active
./scripts/remediate-host-boundary.sh --check

# Display iptables status and matching deception bridges
./scripts/remediate-host-boundary.sh --status

# Apply the non-destructive drop rule (requires sudo / root privileges)
sudo ./scripts/remediate-host-boundary.sh --apply

# Rollback and remove the drop rule
sudo ./scripts/remediate-host-boundary.sh --rollback
```

### 3.2 Environment Auto-Detection
The script automatically detects whether Docker Engine is running on native Linux or inside a macOS Colima VM:
- In native Linux, it checks local `iptables`.
- In macOS with Colima, it transparently executes within the Colima VM via `colima ssh -- sudo iptables ...`.

---

## 4. Verification Results & Audit Evidence

### 4.1 Automated Probe Implementation
In `backend/tests/runtime-worker-isolation-remediation.test.js`:
- Category 7 creates a real synthetic container on an isolated network.
- Inspects the container to discover the dynamic gateway IP (`172.21.0.1`).
- Runs an in-container Node.js script attempting direct TCP socket connection to `gateway:22`.

### 4.2 Test Output
```
[HostBoundaryAudit] Destination: 172.21.0.1:22 -> >BLOCKED:connect ENETUNREACH 172.21.0.1:22 - Local (0.0.0.0:0)
✔ 7. Host boundary audit: Synthetic container probe against host bridge gateway SSH (Finding A) (94.837334ms)
✔ 8. Host management ports reachability: Probes Docker TCP (2375), Postgres (5432), Redis (6379), Web (3000, 4000) (235.534959ms)
```

### 4.3 Host Boundary Verification Matrix

| Target Destination | Port | Expected Unremediated State | Remediated State | Actual Test Outcome |
| :--- | :--- | :--- | :--- | :--- |
| Bridge Gateway IP | 22 (SSH) | Reachable (SSH-2.0-OpenSSH) | Blocked / ENETUNREACH | Verified BLOCKED |
| Bridge Gateway IP | 2375 (Docker API) | Blocked (Connection Refused) | Blocked | Verified BLOCKED |
| Bridge Gateway IP | 5432 (Postgres) | Blocked (Connection Refused) | Blocked | Verified BLOCKED |
| Bridge Gateway IP | 6379 (Redis) | Blocked (Connection Refused) | Blocked | Verified BLOCKED |
| Bridge Gateway IP | 3000 (Backend API) | Blocked (Connection Refused) | Blocked | Verified BLOCKED |
| Bridge Gateway IP | 4000 (Gateway Core) | Blocked (Connection Refused) | Blocked | Verified BLOCKED |
