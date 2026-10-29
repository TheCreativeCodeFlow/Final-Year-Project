# Adaptive Deception Gateway — Backend Service (Stage 3A)

This service forms the security-conscious backend foundation for the **Adaptive Deception Gateway**, developed as part of the research initiative: *Development of an AI-Enabled Adaptive Cyber Deception Gateway for Real-Time Attacker Detection*.

Stage 3A establishes the core HTTP server, environment validation, logging, request correlation, error handling, health checks, and test infrastructure.

---

## 1. Prerequisites

- **Node.js**: `>= 20.0.0` (Verified on Node.js `v24.16.0`)
- **npm**: `>= 10.0.0` (Verified on npm `11.13.0`)
- **Operating System**: macOS, Linux, or Windows (WSL recommended)

---

## 2. Directory Structure

```
backend/
├── src/
│   ├── app.js                          # Express application assembly & middleware pipeline
│   ├── server.js                       # Server entrypoint & graceful shutdown handlers
│   ├── config/
│   │   └── env.js                      # Fail-fast environment validation & defaults
│   ├── controllers/
│   │   └── health.controller.js        # Liveness, readiness, and API descriptor controllers
│   ├── routes/
│   │   └── health.routes.js            # /api/v1/health probe route definitions
│   ├── middleware/
│   │   ├── request-id.js               # Bounded request correlation ID assignment
│   │   ├── security-headers.js         # OWASP defensive headers & fingerprint removal
│   │   ├── not-found.js                # Centralized 404 JSON error response handler
│   │   └── error-handler.js            # Predictable error masking & exception handler
│   └── utils/
│       └── logger.js                   # Structured JSON logger with credential redaction
├── tests/
│   ├── config.test.js                  # Environment schema & port validation tests
│   ├── cors.test.js                    # CORS origin allowlist & preflight tests
│   ├── error-handler.test.js           # 404, 400 (bad JSON), 413, and 500 error tests
│   ├── health.test.js                  # Liveness, readiness, and identity endpoint tests
│   ├── logger.test.js                  # Log redaction, query string omission, CRLF tests
│   ├── request-id.test.js              # ID sanitization, validation, and propagation tests
│   └── shutdown.test.js                # Server lifecycle & socket drain tests
├── .env.example                        # Safe environment template with documentation
├── package.json                        # Scripts & dependencies
└── README.md                           # Service architecture & documentation
```

---

## 3. Installation & Setup

Navigate into the backend directory and copy the environment configuration template:

```bash
cd backend
cp .env.example .env
```

Install backend dependencies:

```bash
npm install
```

> **Security Note:** Never commit a real `.env` file containing production secrets to Git.

---

## 4. Environment Configuration

All environment variables are validated at startup via `src/config/env.js`. If mandatory configuration is missing or malformed, the server exits immediately with a descriptive error.

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | `string` | `development` | Runtime mode: `development`, `production`, or `test`. |
| `HOST` | `string` | `127.0.0.1` | Network interface IP address to bind listening sockets. |
| `PORT` | `number` | `4000` | TCP port number (`1` – `65535`). Malformed ports cause startup failure. |
| `LOG_LEVEL` | `string` | `info` | Minimum severity logged: `debug`, `info`, `warn`, or `error`. |
| `CORS_ORIGIN` | `string` | `http://localhost:3000` | Comma-separated list of approved frontend origins. Wildcard `*` is rejected. |
| `BODY_LIMIT` | `string` | `100kb` | Maximum allowed request body size for JSON payloads. |

---

## 5. Running the Service

### Development Mode (with file watcher)

```bash
cd backend
npm run dev
```

### Production Mode

```bash
cd backend
npm start
```

---

## 6. Running Automated Tests

The test suite runs on Node's native test runner (`node:test`) and exercises HTTP behavior using ephemeral sockets:

```bash
cd backend
npm test
```

### Test Coverage Highlights
* **Config Validation**: Tests default fallbacks, custom port bounds, invalid `NODE_ENV`, invalid `LOG_LEVEL`, and rejects wildcard CORS.
* **Health Probes**: Tests process liveness and component readiness (verifying no fake database/ML claims are made).
* **Request Correlation**: Validates RFC 4122 UUID generation and sanitization against CRLF / HTML injection attempts.
* **Error Handling**: Verifies 404 not found, 400 invalid JSON, 413 payload too large, and 500 internal error masking (verifying stack traces and internal paths are never sent to clients).
* **CORS Policy**: Verifies explicit allowlist acceptance, preflight handling, and rejection of unapproved browser origins.
* **Security Logging**: Verifies credential redaction (`[REDACTED]`), query parameter omission, and log-injection prevention.
* **Graceful Shutdown**: Tests `SIGTERM`/`SIGINT` socket draining and timeout handling.

---

## 7. API Endpoints

All endpoints are versioned under the `/api/v1` namespace.

### `GET /api/v1/health/live`
Confirms the Node.js process and HTTP router can process events.
```json
{
  "success": true,
  "data": {
    "status": "alive",
    "timestamp": "2026-10-29T14:15:00.000Z",
    "uptimeSeconds": 14.28
  },
  "requestId": "4d399632-0b09-4f9b-8566-a13ab79d330f"
}
```

### `GET /api/v1/health/ready`
Confirms currently implemented Stage 3A backend components are initialized. Accurately reports existing components without claiming nonexistent DB or ML dependencies.
```json
{
  "success": true,
  "data": {
    "status": "ready",
    "components": {
      "httpServer": "ready",
      "runtime": "ready"
    },
    "notice": "Stage 3A baseline: database persistence, ML detection engine, and reverse-proxy services are scheduled for subsequent stages and are not currently active."
  },
  "requestId": "99aa0644-d91d-48b9-a9e3-ff0368cb97d6"
}
```

### `GET /api/v1`
Provides public API metadata and version descriptors.
```json
{
  "success": true,
  "data": {
    "name": "Adaptive Deception Gateway API",
    "version": "1.0.0",
    "stage": "3A",
    "status": "operational"
  },
  "requestId": "51465c77-b0fa-443f-ba61-ab4b01349981"
}
```

### Standard Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "INVALID_JSON",
    "message": "The request body could not be parsed as valid JSON."
  },
  "requestId": "73f48d13-9e35-4e6e-b1df-0978189f61cb"
}
```

---

## 8. Security Controls & Defensive Baseline

1. **Fingerprint Removal:** `X-Powered-By` header is disabled at both the framework level and response level.
2. **Defensive Headers:** Enforces `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security`, `X-DNS-Prefetch-Control: off`, and strict API `Content-Security-Policy`.
3. **Bounded Request Correlation:** Validates `X-Request-ID` against `/^[a-zA-Z0-9_-]{1,64}$/`. Any value with control characters, newlines, HTML, or length > 64 is replaced with a freshly generated UUIDv4.
4. **Structured Logging & Redaction:** HTTP request logs exclude query parameters (preventing accidental logging of tokens in URLs) and recursively redact authorization headers, tokens, passwords, cookies, and secrets.
5. **Payload Limits:** Request bodies parsed by `express.json` enforce a conservative `100kb` threshold (`BODY_LIMIT`) to prevent denial-of-service via memory exhaustion.
6. **Error Masking:** Unexpected 500 exceptions log detailed errors internally while returning generic, safe client messages with zero stack traces or internal filesystem disclosures.
7. **CORS Allowlist:** Configurable origin allowlist (`CORS_ORIGIN`). Wildcards are prohibited. Browser requests from unauthorized origins receive a controlled `403 CORS_ORIGIN_DENIED`.

---

## 9. Current Non-Goals (Stage 3A Scope Boundaries)

To maintain architectural integrity, Stage 3A explicitly omits:
- **Authentication / JWT Verification:** No mock secrets or pseudo-auth mechanisms are present.
- **Database Persistence:** No SQL/NoSQL databases or ORMs are connected in this stage.
- **ML Threat Detection:** Real-time behavioral inference engines will be added in Stage 3B+.
- **Reverse-Proxy Routing & Deception Runtime:** Packet interception, TCP resets, honeynet container pools, and live traffic diversion are scheduled for subsequent stages.

---

## 10. Frontend Integration Roadmap

In subsequent stages, the React frontend will interface with the backend via the environment variable:

```bash
VITE_API_BASE_URL=http://localhost:4000/api/v1
```

Currently, the frontend's mock services and simulator remain completely independent and fully functional, ensuring no breaking changes to existing owner or admin dashboards.
