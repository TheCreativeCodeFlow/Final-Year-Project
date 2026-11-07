# Stage 5B.5 — Routing Security & Isolation Safeguards

## 1. Overview

The integration of live network routing with dynamic containerized environments introduces severe adversarial threat vectors:
- **Server-Side Request Forgery (SSRF):** Attackers craft input causing the gateway to connect to internal cloud metadata or sensitive network interfaces.
- **DNS Rebinding Attacks:** Attackers use dynamic DNS entries to bypass IP validation via Time-of-Check to Time-of-Use (TOCTOU) race conditions.
- **Credential Reflection / Exfiltration:** Legitimate user cookies, Authorization tokens, or API keys are leaked into untrusted synthetic honeypots.
- **Synthetic Management Exposure:** Attackers attempt to reach container management or state-mutation endpoints (`/internal/*`).
- **Host Boundary Escape:** Containers escape or attack host daemon interfaces over docker0 bridge gateways.

Stage 5B.5 implements rigorous defensive controls addressing every one of these attack vectors.

---

## 2. Server-Side Request Forgery (SSRF) Defense

Implemented in `resolveAndPinUpstreamDestination` (`gateway/src/proxy/ssrf-guard.js`):

### 2.1. Cloud Metadata Address Rejection
- Explicitly blocks IPv4 link-local metadata endpoints: `169.254.169.254`.
- Explicitly blocks AWS IPv6 metadata endpoints: `fd00:ec2::254`.
- Blocks IPv4-mapped IPv6 addresses attempting to obfuscate metadata IPs: `::ffff:169.254.169.254`.

### 2.2. Address Family and Protocol Restrictions
- Restricts protocols strictly to `http:` and `https:`. Non-HTTP protocols (`file:`, `ftp:`, `gopher:`, `dict:`) are rejected immediately.
- Rejects non-routable, broadcast, and multicast IP ranges:
  - `0.0.0.0/8` (Current network)
  - `224.0.0.0/4` (Multicast)
  - `240.0.0.0/4` (Reserved)
  - `255.255.255.255` (Broadcast)

### 2.3. Sensitive Port Blocking
- Prohibits proxying to sensitive administrative or local infrastructure ports:
  - SSH (22)
  - Telnet (23)
  - SMTP (25)
  - DNS (53)
  - Docker daemon (2375, 2376)
  - Kubernetes API (6443)
  - Database ports (5432, 3306, 27017, 6379)

---

## 3. DNS Rebinding and TOCTOU Defense

Conventional proxies validate a hostname's IP, then pass the hostname to an HTTP client that performs a *second* DNS lookup. Attackers exploit this window by returning a safe public IP on the first lookup and `127.0.0.1` on the second lookup.

### Connection Pinning Architecture:
1. `resolveAndPinUpstreamDestination()` resolves all `A` and `AAAA` records for the hostname using `node:dns/promises`.
2. Every returned IP address is checked against the SSRF safety filters. If *any* IP is prohibited, the entire request is rejected.
3. The gateway **pins** the first validated IP address.
4. When establishing the TCP socket, the gateway connects **directly to the pinned IP address**, while setting the HTTP `Host` header to the canonical domain name.
5. This completely eliminates the secondary DNS resolution, rendering DNS rebinding attacks impossible.

---

## 4. Header Sanitization & Credential Protection

Implemented in `sanitizeDeceptionForwardedHeaders` (`gateway/src/proxy/header-sanitizer.js`):

### 4.1. Stripped Request Headers
When forwarding requests to synthetic deception targets, the gateway strips all sensitive credential headers:
- `authorization` (Bearer tokens, Basic auth)
- `cookie` (Session cookies, auth tokens)
- `x-api-key` (API secret keys)
- `x-csrf-token`
- `proxy-authorization`

### 4.2. Injected Synthetic Tracking Headers
The gateway injects controlled tracking headers for runtime provenance:
- `x-deception-synthetic: true` (Informs the synthetic container of its role)
- `x-correlation-id: <uuid>` (Propagates the audit correlation handle)
- `x-deception-environment: <id>` (Identifies the target environment)

### 4.3. Response Header Sanitization
Responses returned from upstreams are stripped of fingerprinting headers:
- `server` (e.g., Apache/2.4.41, nginx/1.18.0)
- `x-powered-by` (e.g., Express, PHP/7.4.3)
- `x-aspnet-version`

---

## 5. Synthetic Management Endpoint Protection

Synthetic deception containers maintain internal management endpoints (`/internal/status`, `/internal/mutate`, `/internal/snapshot`) for orchestration.

- The gateway reverse proxy inspects `req.url`.
- If `isDeceptionRouting === true` and the request path starts with `/internal/` or equals `/internal`, the gateway blocks the request with HTTP 403 `PROHIBITED_ENDPOINT`:
  ```json
  {
    "success": false,
    "error": {
      "code": "PROHIBITED_ENDPOINT",
      "message": "Direct access to synthetic runtime management endpoints is prohibited."
    }
  }
  ```
- Validated via unit and regression tests.

---

## 6. Host Boundary Activation Blocker

As established in Stage 5B.2.1 / 5B.2.2 (Finding A), synthetic containers on a Docker bridge network could probe host ports (e.g., port 22) if host iptables rules are incomplete.

- `RuntimeSelectionService.checkControlledLabReadiness()` performs a mandatory check for the host `INPUT` drop rule.
- If the drop rule is unverified or the finding is open, the service returns `isReady = false` with code `CONTROLLED_LAB_BLOCKED`.
- In `GatewayDecisionControllerService`, this condition triggers safe origin fallback:
  - `action = NORMAL_ROUTING`
  - `routingOutcome = DEFER_TO_ORIGIN`
  - `decisionReason = CONTROLLED_LAB_BLOCKED: host INPUT firewall finding open. Fallback to origin.`
- This guarantees that no live traffic is diverted into a container that could attack the host.
