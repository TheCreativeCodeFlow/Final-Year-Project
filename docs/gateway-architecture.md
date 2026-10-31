# Gateway Runtime Architecture, Security Hardening & Isolated Reverse Proxy Foundation
## Stages 4A & 4A.1 — Adaptive Cyber Deception Gateway

> **Research Prototype Disclaimer**
> This component is a local research gateway prototype designed to demonstrate secure reverse-proxying, application resolution, fail-closed routing, and semantic telemetry collection for adaptive cyber deception research. It is **not** an off-the-shelf enterprise edge proxy (such as Envoy, NGINX, or Traefik) and does not perform live hardware TLS acceleration or automated cluster consensus. All security controls documented herein have been implemented and verified via automated test suites.

---

## 1. Overview and System Topology

The **Gateway Runtime** operates as an independent, security-hardened ingress service responsible for receiving incoming HTTP requests in a controlled environment, validating protocol syntax and request integrity, resolving tenant and protected application bindings against the management service, and safely forwarding legitimate traffic to a designated protected test origin.

```
                                    EXTERNAL / HOST TRAFFIC
                                              │
                                              ▼
                             ┌─────────────────────────────────┐
                             │    Gateway Reverse Proxy        │
                             │        (Port :8000)             │
                             │  - Non-root (USER node)         │
                             │  - cap_drop: [ALL]              │
                             │  - no-new-privileges: true      │
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
        │  - cap_drop: [ALL]        │                 │  No Internet Egress)      │
        └─────────────┬─────────────┘                 └───────────────────────────┘
                      │
                      ▼
        ┌───────────────────────────┐
        │   PostgreSQL Database     │
        │(Bound 127.0.0.1:5432 only)│
        └───────────────────────────┘
```

---

## 2. Docker Architecture & Container Hardening (Stage 4A.1)

The multi-container architecture is configured in `docker-compose.yml` with least-privilege containerization:

| Service | Container Base | Purpose | Host Exposure | Security Controls & Isolation |
| :--- | :--- | :--- | :--- | :--- |
| **`gateway`** | `node:20-alpine` | Reverse proxy ingress & telemetry | `8000:8000` | Non-root `USER node`, `cap_drop: [ALL]`, `no-new-privileges: true` |
| **`backend`** | `node:20-alpine` | Management REST API & DB models | `4000:4000` | Non-root `USER node`, `cap_drop: [ALL]`, `no-new-privileges: true` |
| **`db`** | `postgres:16-alpine` | Persistent domain store | `127.0.0.1:5432:5432` (Loopback only) | Non-root daemon, `cap_drop: [ALL]`, `no-new-privileges: true` |
| **`synthetic-origin`** | `node:20-alpine` | Synthetic protected application | **None** (internal bridge only) | Non-root `USER node`, `cap_drop: [ALL]`, `no-new-privileges: true`, internal isolated network |

### Network Segmentation & Trust Boundaries
1. **`internal-mgmt-net`** (`bridge`): Interconnects `backend`, `db`, and `gateway`. Allows the gateway to query application resolution and stream telemetry via internal service authentication (`X-Gateway-Service-Token`).
2. **`protected-origin-net`** (`bridge`, `internal: true`): Isolated private network connecting `gateway` exclusively to `synthetic-origin`.
   - The synthetic origin has **no outbound Internet egress** and **no host port binding**.
   - The database (`db`) and management API (`backend`) are **not** attached to this network.
   - The **Gateway Runtime acts as the sole dual-homed bridge** between client ingress and the isolated origin.

---

## 3. The 8-Stage Request Lifecycle

To uphold semantic integrity and prevent collapsing intermediate states, the gateway strictly distinguishes the operational stages of every transaction:

```
[1. Request Observed]
       │ Ingress HTTP socket accepted, timestamp recorded, method/path/host parsed
       ▼
[2. Request Validated]
       │ Method allowlist checked, Host syntax sanitized, payload size limits verified
       │ Smuggling checks: TE+CL conflict, duplicate CL/Host, CL syntax verified
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
       │ Pre-flight DNS resolution & connection pinning (TOCTOU defense)
       │ Multi-tier SSRF filter (IPv4/IPv6, mapped addresses, sensitive ports)
       │ Headers sanitized (RFC 7230 hop-by-hop & client identity stripped)
       │ Stream piping with backpressure & byte accounting
       ▼
[7. Routing Outcome Recorded]
       │ Independently verified result (FORWARDED_TO_ORIGIN, TIMEOUT, CONNECTION_REFUSED)
       ▼
[8. Execution Evidence Verified]
       │ Confirmed supervisor/cryptographic receipt (remains explicitly MISSING in Stage 4A)
```

---

## 4. HTTP Protocol Hardening & Smuggling Defenses (Stage 4A.1)

In compliance with **RFC 7230 §3.3.3** and **RFC 9112 §6.1**, the gateway implements multi-layer HTTP request smuggling defenses:

1. **Conflicting Transfer-Encoding & Content-Length:**
   - Any request presenting both `Transfer-Encoding` and `Content-Length` is immediately rejected with `400 Bad Request` (`REQUEST_SMUGGLING_DETECTED`) and `Connection: close`.
2. **Duplicate Content-Length Headers:**
   - Raw headers (`req.rawHeaders`) are inspected. Multiple occurrences of `Content-Length` (even if identical) are rejected with `400 Bad Request` (`DUPLICATE_CONTENT_LENGTH`) and `Connection: close`.
3. **Content-Length Syntax Verification:**
   - `Content-Length` must be a strictly non-negative decimal integer (`^\d+$`). Hexadecimal, negative values, and trailing garbage are rejected with `400 Bad Request` (`INVALID_CONTENT_LENGTH`).
4. **Duplicate Host Header Rejection:**
   - Ingress requests with multiple `Host` headers are rejected with `400 Bad Request` (`DUPLICATE_HOST_HEADER`).
5. **Host Header Syntax Validation:**
   - Evaluated against `HOSTNAME_SYNTAX_REGEX`. Directory traversal (`/`, `\`), null bytes (`\0`), userinfo delimiters (`@`), and spaces are rejected with `400 Bad Request` (`INVALID_HOST_HEADER`).
6. **Socket-Level Protocol Error Handling:**
   - The underlying Node HTTP server listens on `'clientError'`. Malformed chunks or low-level protocol violations return a controlled `400 Bad Request` with `Connection: close` rather than abruptly terminating sockets without diagnostic information.

---

## 5. SSRF Defense & DNS Connection Pinning (Stage 4A.1)

### Multi-Tier SSRF Filter
Upstream destinations undergo strict destination validation:
- **Protocol Enforcement:** Only `http:` and `https:` schemes are permitted. Schemes like `file:`, `ftp:`, `gopher:`, `data:`, and `dict:` are rejected.
- **Embedded Credentials:** URLs containing userinfo (`http://user:pass@host/`) are rejected.
- **Forbidden Cloud Instance Metadata:**
  - `169.254.169.254` (AWS, GCP, Azure, OpenStack IMDS)
  - `100.100.100.200` (Alibaba Cloud metadata)
  - `fd00:ec2::254` (AWS IMDSv2 IPv6 metadata)
  - `metadata.google.internal`, `metadata.local`, `instance-data`
- **IPv4-Mapped IPv6 Bypasses:**
  - Addresses in the `::ffff:0:0/96` format (e.g. `[::ffff:169.254.169.254]` or `[::ffff:a9fe:a9fe]`) are extracted via `extractIpv4FromIpv6()` and evaluated against IPv4 metadata and private network rules.
- **Subnet Bitmask Filtering:**
  - `127.0.0.0/8` (Loopback) — rejected unless explicitly authorized in test configuration.
  - `169.254.0.0/16` & `fe80::/10` (Link-local) — unconditionally prohibited.
  - `224.0.0.0/4` & `ff00::/8` (Multicast) — unconditionally prohibited.
  - `0.0.0.0/8` & `::` (Unspecified) — unconditionally prohibited.
  - `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `fc00::/7` (Private / ULA) — blocked unless explicitly allowed for origin networks.
  - `100.64.0.0/10` (Carrier-Grade NAT / Shared Address Space) — blocked.
  - Documentation subnets (`192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`, `2001:db8::/32`) — blocked.
- **Prohibited Infrastructure Ports:**
  - Forwarding to ports `22` (SSH), `2375`/`2376` (Docker), `3306` (MySQL), `5432` (PostgreSQL), `6379` (Redis), `6443` (k8s API), `8500` (Consul), `9200` (Elasticsearch), `10250`/`10255` (Kubelet), `11211` (Memcached), and `27017` (MongoDB) is strictly blocked regardless of target IP.

### DNS Pre-Resolution & Connection Pinning (TOCTOU Defense)
To prevent Time-of-Check to Time-of-Use (TOCTOU) DNS rebinding attacks:
1. `resolveAndPinUpstreamDestination()` pre-resolves all `A` and `AAAA` records for the target upstream host using `dns.promises.lookup({ all: true })`.
2. Every returned IP record is validated against SSRF rules. If **any** returned record points to a prohibited IP, the destination fails closed.
3. The first validated record is selected as `pinnedIp`.
4. In `reverse-proxy.js`, a custom `lookup` resolver is passed into Node's HTTP/HTTPS agent options:
   ```javascript
   lookup: (hostname, opts, cb) => {
     if (opts && opts.all) {
       cb(null, [{ address: pinnedIp, family }]);
     } else {
       cb(null, pinnedIp, family);
     }
   }
   ```
5. **SNI and TLS Verification:** For HTTPS connections, `requestOptions.servername = upstreamUrl.hostname` is preserved, ensuring that TLS certificate verification and SNI negotiation succeed against the genuine hostname while the socket connects exclusively to the pre-validated `pinnedIp`.

---

## 6. Header Sanitization & Hop-by-Hop Stripping

1. **Client Identity Stripping:**
   - Downstream clients cannot inject privileged gateway context. The following headers are stripped:
     - `X-Gateway-Service-Token`, `X-Gateway-Identity`, `X-Internal-Service`, `X-Tenant-ID`, `X-Application-ID`, `X-User-ID`, `X-Role`, `X-Is-Platform-Admin`.
2. **RFC 7230 Hop-by-Hop Removal:**
   - Standard hop-by-hop headers (`Connection`, `Keep-Alive`, `Proxy-Authenticate`, `Proxy-Authorization`, `TE`, `Trailers`, `Transfer-Encoding`, `Upgrade`) are removed.
   - Any custom headers enumerated in the incoming `Connection` header token list are dynamically stripped.
3. **Reverse Proxy Context Injection:**
   - Standard proxy headers are safely formatted: `X-Forwarded-For`, `X-Forwarded-Proto`, `X-Forwarded-Host`, `X-Request-ID`.
4. **Response Sanitization:**
   - Upstream response headers `Server` and `X-Powered-By` are stripped before responding downstream, preventing backend software and topology leakage.
   - Downstream client receives `X-Request-ID` for end-to-end tracing.

---

## 7. Telemetry & Evidence Recording Architecture (Stage 4A.1)

Telemetry recording is strictly decoupled from forwarding results:

### Persistence States
The telemetry recorder reports explicit status values (`TELEMETRY_OUTCOMES`):
- **`TELEMETRY_PERSISTED`**: Telemetry was successfully received and committed to PostgreSQL by the Management API.
- **`TELEMETRY_PERSISTENCE_FAILED`**: Management API was unreachable or rejected ingestion. Telemetry was buffered in the bounded queue.
- **`TELEMETRY_PENDING`**: Telemetry is buffered in memory awaiting background flush.
- **`NOT_RECORDED`**: Request was unmapped (e.g. invalid host without tenant context) and logged only locally.

### Bounded Memory Queue
- To prevent Out-Of-Memory (OOM) conditions during extended backend outages, `TelemetryRecorderService` enforces a strict bounded queue (`MAX_QUEUE_SIZE = 1000`).
- If the queue reaches capacity, the oldest record is dropped with an explicit warning log (`dropping oldest record to prevent memory exhaustion`).

### Management API Deduplication
- In `backend/src/controllers/gateway-internal.controller.js`, telemetry ingestion uses `correlationId` deduplication. If a record with the same `(tenantId, correlationId)` was already persisted, the controller returns `200 OK` with `persistenceStatus: 'TELEMETRY_PERSISTED'` and skips redundant database writes.

### Evidence Integrity Guarantee
- `executionEvidence` remains strictly `MISSING` in Stages 4A and 4A.1.
- Telemetry never fabricates cryptographic proofs or execution receipts.

---

## 8. Fail-Closed Routing Semantics

The gateway enforces fail-closed operations across all boundaries:

| Failure Mode | Gateway Behavior | Status Code | Error Code |
| :--- | :--- | :--- | :--- |
| **Missing Host Header** | Reject at ingress | `400` | `MISSING_HOST_HEADER` |
| **Invalid Host Syntax / Traversal** | Reject at ingress | `400` | `INVALID_HOST_HEADER` |
| **Conflicting TE & CL** | Reject at ingress | `400` | `REQUEST_SMUGGLING_DETECTED` |
| **Duplicate Host / CL** | Reject at ingress | `400` | `DUPLICATE_HOST_HEADER` / `DUPLICATE_CONTENT_LENGTH` |
| **Unknown Host / Domain** | Deny routing | `404` | `UNKNOWN_HOST` |
| **Unregistered Application** | Deny routing | `404` | `UNREGISTERED_APPLICATION` |
| **Tenant Suspended** | Deny routing | `403` | `TENANT_INACTIVE` |
| **Application Degraded / Bypass** | Deny routing | `403` | `APPLICATION_NOT_PROTECTED` |
| **Cross-Tenant Conflict** | Deny routing | `403` | `CROSS_TENANT_CONFLICT` |
| **Prohibited SSRF Destination** | Block connection | `502` | `PROHIBITED_UPSTREAM_DESTINATION` |
| **Management API Down** | Fail closed | `503` | `MANAGEMENT_SERVICE_UNAVAILABLE` |
| **Decision Controller Down** | Fail closed | `503` | `SECURITY_CONTROL_UNAVAILABLE` |
| **Deception Target Unavailable** | **Never fall back to origin** | `503` | `DECEPTION_TARGET_UNAVAILABLE` |
| **Upstream Socket Timeout** | Controlled timeout | `504` | `GATEWAY_TIMEOUT` |
| **Upstream Connection Refused** | Controlled bad gateway (no port leak) | `502` | `BAD_GATEWAY` |

---

## 9. Verification & Automated Test Coverage

The gateway runtime foundation is validated by three automated test suites:

1. **`gateway/tests/gateway-runtime.test.js`** (22 tests):
   - Health probes, request forwarding, UUID preservation, streaming POST, fail-closed host checks, method enforcement (TRACE rejection), payload size limits, SSRF basics, identity stripping, hop-by-hop sanitization, response fingerprint removal, upstream timeout, connection refused, deception target failure isolation.
2. **`gateway/tests/security-hardening.test.js`** (15 tests):
   - Conflicting TE+CL rejection, duplicate Host/CL rejection, invalid CL rejection, traversal Host rejection, IPv4-mapped IPv6 extraction and metadata blocking, AWS IPv6 metadata (`fd00:ec2::254`), link-local/doc IPv6, sensitive infrastructure ports, DNS rebinding TOCTOU defense, mixed DNS record failure, HEAD request body suppression, bounded telemetry queue enforcement.
3. **`backend/tests/gateway-internal-api.test.js`** (8 tests):
   - Internal service token authentication, domain-to-application resolution, tenant status enforcement, telemetry ingestion, PostgreSQL persistence, and correlationId deduplication.
4. **`scripts/demonstrate-gateway.sh`**:
   - End-to-end executable demonstration verifying health, traffic forwarding, header sanitization, smuggling defense, SSRF blocks, and fail-closed routing.

---

## 10. Known Limitations & Future Work (Stage 5 Roadmap)

1. **No Live Machine Learning Inference:** Dynamic anomaly scoring and classification models are scheduled for subsequent stages.
2. **No Dynamic Honeynet Spawning:** Honeynet containers are not dynamically created at runtime in this stage.
3. **Single-Node Ingress:** Ingress clustering, consensus, and distributed telemetry streaming are future enhancements.
4. **Execution Evidence:** Real cryptographic execution evidence (e.g. signed supervisor receipts) will be established in Stage 5. Currently reported as `MISSING`.
