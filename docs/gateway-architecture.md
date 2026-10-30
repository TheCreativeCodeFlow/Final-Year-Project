# Gateway Runtime Architecture & Isolated Reverse Proxy Foundation
## Stage 4A — Adaptive Cyber Deception Gateway

> **Research Prototype Disclaimer**
> This component is a local research gateway prototype designed to demonstrate secure reverse-proxying, application resolution, fail-closed routing, and semantic telemetry collection for adaptive cyber deception research. It is **not** a hardened production-grade enterprise reverse proxy (such as Envoy, NGINX, or Traefik) and does not yet perform live packet inspection, hardware TLS acceleration, or real-time ML-driven traffic classification.

---

## 1. Overview and System Topology

The **Gateway Runtime** operates as an independent ingress service responsible for receiving incoming HTTP requests in a controlled local test environment, validating request integrity, resolving the associated tenant and protected application against the management service, and safely forwarding legitimate traffic to a designated protected test origin.

```
                                    EXTERNAL / HOST TRAFFIC
                                              │
                                              ▼
                             ┌─────────────────────────────────┐
                             │    Gateway Reverse Proxy        │
                             │        (Port :8000)             │
                             └───────────────┬─────────────────┘
                                             │
                      ┌──────────────────────┴──────────────────────┐
                      │                                             │
      Internal Management Service Network               Isolated Protected Origin Network
              (internal-mgmt-net)                              (protected-origin-net)
                      │                                             │
                      ▼                                             ▼
        ┌───────────────────────────┐                 ┌───────────────────────────┐
        │  Backend Management API   │                 │ Synthetic Protected Origin│
        │       (Port :4000)        │                 │ (Port :8081 - No Host Port│
        └─────────────┬─────────────┘                 └───────────────────────────┘
                      │
                      ▼
        ┌───────────────────────────┐
        │   PostgreSQL Database     │
        │       (Port :5432)        │
        └───────────────────────────┘
```

---

## 2. Docker Architecture & Isolated Networking

The multi-container architecture is defined in `docker-compose.yml`:

| Service | Container Base | Purpose | Network Exposure | Access Permissions |
| :--- | :--- | :--- | :--- | :--- |
| **`gateway`** | `node:20-alpine` | Reverse proxy ingress & telemetry | `8000:8000` (Host) | Non-root `USER node` |
| **`backend`** | `node:20-alpine` | Management REST API & DB models | `4000:4000` (Host) | Non-root `USER node` |
| **`db`** | `postgres:16-alpine` | Persistent domain store | `5432:5432` (Host) | Standard PostgreSQL user |
| **`synthetic-origin`** | `node:20-alpine` | Synthetic protected application | `8081` internal only | Non-root `USER node`, no host port |

### Network Segmentation
1. **`internal-mgmt-net`** (`bridge`): Interconnects `backend`, `db`, and `gateway`. Allows the gateway to query application resolution and stream telemetry via internal service authentication (`X-Gateway-Service-Token`).
2. **`protected-origin-net`** (`bridge`, `internal: true`): Isolated private network connecting `gateway` to `synthetic-origin`.
   - The synthetic origin has **no outbound Internet egress** and **no host port binding**.
   - The database (`db`) and management API (`backend`) are **not** attached to this network.

---

## 3. The 8-Stage Request Lifecycle

To uphold semantic integrity, the gateway strictly distinguishes the operational stages of every transaction:

```
[1. Request Observed]
       │ Ingress HTTP socket accepted, timestamp recorded, method/path/host parsed
       ▼
[2. Request Validated]
       │ Method allowlist checked, Host syntax sanitized, payload size limits verified
       │ Application and tenant resolved via server-side config & Management API
       ▼
[3. Security Assessment Performed]
       │ Deterministic anomaly heuristics & baseline validation
       ▼
[4. Policy Evaluated]
       │ Matched against tenant/application routing rules
       ▼
[5. Routing Decision Made]
       │ Intended route determined (NORMAL_ROUTING, BLOCK, PROPOSE_DECEPTION)
       ▼
[6. Upstream Forwarding Attempted]
       │ SSRF destination verified, headers sanitized, connection initiated to target origin
       ▼
[7. Routing Outcome Recorded]
       │ Independently verified result (FORWARDED_TO_ORIGIN, TIMEOUT, CONNECTION_REFUSED)
       ▼
[8. Execution Evidence Verified]
       │ Confirmed supervisor/cryptographic receipt (remains explicitly MISSING in Stage 4A)
```

---

## 4. Supported HTTP Methods and Request Controls

### Allowed Methods
The gateway explicitly supports the following standard methods:
- `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`

### Prohibited Methods
- `TRACE` is strictly rejected with `405 Method Not Allowed` (mitigating Cross-Site Tracing / XST attacks).
- `CONNECT`, `TRACK`, and arbitrary custom verbs are rejected with `405 Method Not Allowed` and an explicit `Allow` header.

### Request Body & Connection Limits
- **Max Request Size:** Configurable via `MAX_REQUEST_SIZE_BYTES` (default: 1,048,576 bytes / 1 MB). Requests with `Content-Length` exceeding this limit are immediately rejected with `413 Payload Too Large`.
- **Upstream Connection & Read Timeout:** Configurable via `UPSTREAM_TIMEOUT_MS` (default: 5,000 ms). Timeouts cleanly return `504 Gateway Timeout` and close the socket.

---

## 5. Security Controls & SSRF Mitigation

1. **Server-Side Trusted Origin Resolution:**
   - The upstream destination is **never** accepted from query parameters (`?dest=...`), path parameters, or client headers (`X-Forward-To`).
   - The gateway resolves the upstream origin strictly through the server-side `TRUSTED_ORIGIN_MAP` and cross-verifies with the database via the management API.
2. **SSRF Guard:**
   - Upstream URLs must use `http:` or `https:`. Non-HTTP schemes (`file:`, `ftp:`, `gopher:`, `data:`) are rejected.
   - Forbidden metadata addresses are blocked:
     - `169.254.169.254` (AWS, GCP, Azure, OpenStack instance metadata)
     - `metadata.google.internal` (GCP metadata service)
     - `100.100.100.200` (Alibaba Cloud metadata)
     - Link-local ranges (`169.254.0.0/16`, `fe80::/10`)
     - Multicast address ranges (`224.0.0.0/4`)
   - Dangerous infrastructure ports (`2375`, `2376`, `6443`, `10250`) are rejected.
3. **DNS Rebinding & Host Validation:**
   - Host headers are validated against RFC-compliant domain regex (`^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$`).
   - Slashes, null bytes, spaces, and userinfo delimiters (`user@host`) trigger an immediate `400 Bad Request`.
4. **Header Sanitization & Spoofing Defense:**
   - Client-injected identity headers are stripped: `X-Gateway-Service-Token`, `X-Gateway-Identity`, `X-Internal-Service`, `X-Tenant-ID`, `X-Application-ID`, `X-User-ID`, `X-Role`, `X-Is-Platform-Admin`.
   - RFC 7230 hop-by-hop headers (`Connection`, `Keep-Alive`, `Proxy-Authenticate`, `TE`, `Transfer-Encoding`, etc.) are stripped.
   - Standard reverse-proxy headers are safely appended: `X-Forwarded-For`, `X-Forwarded-Proto`, `X-Forwarded-Host`, `X-Request-ID`.
   - Response headers (`Server`, `X-Powered-By`) are stripped to prevent upstream fingerprinting.
5. **No Automatic Redirect Following:**
   - The reverse proxy does not follow upstream 3xx redirects (`redirect: 'manual'`), eliminating open redirect and redirect-loop SSRF vulnerabilities.

---

## 6. Fail-Closed Routing Semantics

The gateway enforces fail-closed operations at every decision boundary:

| Condition | Gateway Behavior | Status Code |
| :--- | :--- | :--- |
| **Missing Host Header** | Reject immediately | `400 MISSING_HOST_HEADER` |
| **Invalid Host Syntax** | Reject immediately | `400 INVALID_HOST_HEADER` |
| **Unknown Host / Domain** | Deny routing | `404 UNKNOWN_HOST` |
| **Unregistered Application** | Deny routing | `404 UNREGISTERED_APPLICATION` |
| **Tenant Suspended** | Deny routing | `403 TENANT_INACTIVE` |
| **Application Degraded / Bypass** | Deny routing | `403 APPLICATION_NOT_PROTECTED` |
| **Cross-Tenant Conflict** | Deny routing | `403 CROSS_TENANT_CONFLICT` |
| **Management API Down** | Fail closed | `503 MANAGEMENT_SERVICE_UNAVAILABLE` |
| **Decision Controller Down** | Fail closed | `503 SECURITY_CONTROL_UNAVAILABLE` |
| **Deception Target Unavailable** | **Never fall back to real origin** | `503 DECEPTION_TARGET_UNAVAILABLE` |
| **Upstream Socket Timeout** | Controlled error | `504 GATEWAY_TIMEOUT` |
| **Upstream Connection Refused** | Controlled error (no internal port leak) | `502 BAD_GATEWAY` |

---

## 7. Telemetry & Evidence Fields

The telemetry recorder captures operational and security metadata without logging sensitive credentials:

| Field | Type | Description |
| :--- | :--- | :--- |
| `correlationId` | UUID string | Request tracking identifier (propagated as `X-Request-ID`) |
| `tenantId` | UUID string | PostgreSQL tenant identifier |
| `applicationId` | UUID string | Target protected application ID |
| `method` | String | HTTP method (`GET`, `POST`, etc.) |
| `normalizedRoute` | String | Path and query without sensitive parameters |
| `responseStatus` | Integer | HTTP response status returned to downstream client |
| `durationMs` | Float | Request duration in milliseconds |
| `requestSizeBytes` | Integer | Bytes received from client |
| `responseSizeBytes`| Integer | Bytes streamed from upstream |
| `clientIp` | String | Downstream IP address |
| `validationOutcome`| String | `VALIDATED`, `UNKNOWN_HOST`, `REJECTED_METHOD`, etc. |
| `forwardingResult` | String | `SUCCESS`, `TIMEOUT`, `CONNECTION_REFUSED`, `NOT_ATTEMPTED` |
| `routingDecision` | Object | `{ intendedAction, outcomeStatus, failureDetails }` |

> **Privacy Guarantee:** `Authorization`, `Cookie`, `Set-Cookie`, `X-API-Key`, passwords, and request bodies are **never** logged or persisted in telemetry records.

---

## 8. Environment Variables Reference

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `PORT` | `8000` | Ingress HTTP listener port |
| `HOST` | `0.0.0.0` | Ingress network bind address |
| `MANAGEMENT_API_URL` | `http://127.0.0.1:4000/api/v1` | URL of backend management API |
| `GATEWAY_INTERNAL_TOKEN` | (required in prod) | Shared internal service secret (min 32 chars) |
| `GATEWAY_ORIGIN_MAP` | (default local JSON) | JSON mapping of domains to upstream origin configs |
| `UPSTREAM_TIMEOUT_MS` | `5000` | Socket read/response timeout in ms |
| `MAX_REQUEST_SIZE_BYTES` | `1048576` (1 MB) | Maximum permitted request body size in bytes |
| `LOG_LEVEL` | `info` | Logging verbosity (`debug`, `info`, `warn`, `error`) |
| `DECISION_CONTROLLER_URL`| `null` | URL of future AI Decision Controller |

---

## 9. Known Limitations (Stage 4A)

1. **No Live ML Classification:** Real-time machine learning inference for dynamic threat scoring is not included in Stage 4A.
2. **No Dynamic Honeynet Execution:** No honeypot containers are spawned; deception diversions are represented by simulation and configuration.
3. **Local HTTP/HTTPS Focus:** Designed for local development and research test harness environments. TLS termination, OCSP stapling, and HTTP/2/3 multiplexing are delegated to future edge terminators.
4. **Single-Node Ingress:** The gateway runtime currently operates as an independent Node.js process without distributed cluster consensus.
