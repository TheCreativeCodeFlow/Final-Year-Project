# Adaptive Deception Gateway — Backend Service

This service forms the security-conscious backend foundation, persistent domain data layer, and secure authentication/tenant authorization engine for the **Adaptive Deception Gateway**, developed as part of the research initiative: *Development of an AI-Enabled Adaptive Cyber Deception Gateway for Real-Time Attacker Detection*.

- **Stage 3A**: Established the secure HTTP server, environment validation, logging, request correlation, error handling, health checks, and test infrastructure.
- **Stage 3B**: Established PostgreSQL persistence, Prisma ORM schema, versioned migrations, relational tenant isolation, synthetic development seed data, and domain integrity test suites.
- **Stage 3C**: Establishes secure user identity, Argon2id credential hashing, stateful server-side sessions, anti-CSRF protections, login rate limiting, and strict tenant membership authorization.

---

## 1. Prerequisites

- **Node.js**: `>= 20.0.0` (Verified on Node.js `v24.16.0`)
- **npm**: `>= 10.0.0` (Verified on npm `11.13.0`)
- **PostgreSQL**: `>= 15.0` (Verified on PostgreSQL `16.14` via Homebrew)
- **Operating System**: macOS (Apple Silicon arm64 / Intel x64), Linux, or Windows (WSL2)

---

## 2. Directory Structure

```
backend/
├── prisma/
│   ├── schema.prisma                   # Relational domain schema with Users, Memberships & Sessions
│   ├── seed.js                         # Idempotent development seed script (refuses in production)
│   └── migrations/
│       ├── 20261029144928_init_domain_models/
│       │   └── migration.sql           # Versioned initial PostgreSQL domain models
│       └── 20261029154841_add_auth_and_membership/
│           └── migration.sql           # Users, TenantMemberships, and Sessions migration
├── src/
│   ├── app.js                          # Express application assembly & middleware pipeline
│   ├── server.js                       # Server entrypoint & graceful shutdown handlers
│   ├── config/
│   │   └── env.js                      # Fail-fast environment & database validation
│   ├── db/
│   │   └── client.js                   # Controlled Prisma client, lazy connect & transactions
│   ├── controllers/
│   │   ├── auth.controller.js          # Authentication, logout, identity & tenant introspection
│   │   └── health.controller.js        # Liveness, readiness, and API descriptor controllers
│   ├── routes/
│   │   ├── auth.routes.js              # /api/v1/auth route declarations
│   │   └── health.routes.js            # /api/v1/health probe route definitions
│   ├── middleware/
│   │   ├── auth.js                     # Session authentication, CSRF, role & tenant authorization
│   │   ├── rate-limiter.js             # Sliding-window login attempt throttling
│   │   ├── request-id.js               # Bounded request correlation ID assignment
│   │   ├── security-headers.js         # OWASP defensive headers & fingerprint removal
│   │   ├── not-found.js                # Centralized 404 JSON error response handler
│   │   └── error-handler.js            # Predictable error masking & exception handler
│   ├── services/
│   │   └── session.service.js          # Cryptographic session token generation & revocation
│   └── utils/
│       ├── auth-audit.js               # Sanitized authentication audit event persistence
│       ├── logger.js                   # Structured JSON logger with credential redaction
│       └── passwords.js                # Argon2id hashing & length validation [10, 128]
├── tests/
│   ├── auth.test.js                    # Comprehensive Stage 3C authentication & tenant test suite
│   ├── config.test.js                  # Environment schema & port validation tests
│   ├── cors.test.js                    # CORS origin allowlist & preflight tests
│   ├── database-integrity.test.js      # Relational integrity, FK constraints, and tenant isolation
│   ├── error-handler.test.js           # 404, 400 (bad JSON), 413, and 500 error tests
│   ├── health.test.js                  # Liveness, readiness, and identity endpoint tests
│   ├── logger.test.js                  # Log redaction, query string omission, CRLF tests
│   ├── request-id.test.js              # ID sanitization, validation, and propagation tests
│   ├── seed.test.js                    # Seed idempotency, duplication safety, and prod lockout
│   └── shutdown.test.js                # Server lifecycle, socket drain & DB disconnect tests
├── .env.example                        # Safe environment template with documentation
├── package.json                        # Scripts & dependencies
└── README.md                           # Service architecture & documentation
```

---

## 3. Authentication & Authorization Architecture

### 3.1 Security Principles & Cryptographic Standards

1. **Argon2id Password Hashing**:
   - Credentials are validated to require between 10 and 128 characters.
   - Hashed using **Argon2id** (`argon2.argon2id`) with memory cost = 64 MiB (`65536` KiB), iterations = `3`, parallelism = `4`.
   - Native verification uses timing-safe constant execution to defeat cache-timing attacks.
   - Passwords and hashes are strictly excluded from API outputs, database audit payloads, and structured application logs.

2. **Server-Side Session Management**:
   - High-entropy cryptographic tokens (256 bits / 32 bytes raw entropy formatted as 64 hex characters) generated via `node:crypto`.
   - Persisted in the PostgreSQL `sessions` table linked by foreign key to `users.id`.
   - Stateful server-side tracking supports immediate revocation, expiration, and sliding activity tracking (`lastActiveAt`).
   - Delivered via **HttpOnly**, **SameSite=Lax**, **Path=/** cookies, or standard `Authorization: Bearer <token>` headers for programmatic API consumers.

3. **Anti-CSRF Protection**:
   - A unique 128-bit anti-CSRF token is generated and paired with each session.
   - For state-changing HTTP mutation requests (`POST`, `PUT`, `PATCH`, `DELETE`) authenticated via ambient browser cookies, the `csrfProtection` middleware requires a matching `X-CSRF-Token` header.
   - API requests authenticated via `Authorization: Bearer` headers are naturally exempt from CSRF checks.

4. **Brute-Force & Credential Stuffing Throttling**:
   - In-memory sliding window rate limiter (`LoginRateLimiter`) tracks failed attempts per IP address and per target email account.
   - Threshold: Maximum 5 failed attempts within a 15-minute sliding window.
   - Upon exceeding limits, the gateway returns HTTP `429 Too Many Requests` with a compliant `Retry-After` header.

5. **Tenant Scoping & Membership Enforcement**:
   - Platform Administrators (`isPlatformAdmin === true`) have platform-wide oversight.
   - Tenant-scoped users (Application Owners, Security Analysts) are restricted to tenants where they possess an explicit `TenantMembership`.
   - The `requireTenantAccess` middleware intercepts target tenant identifiers (from route params, `X-Tenant-ID` headers, or query parameters) and validates them against the user's active memberships. Unauthorized cross-tenant access attempts return HTTP `403 TENANT_ACCESS_DENIED`.

---

## 4. Database Domain Models & Relational ERD

```mermaid
erDiagram
    User ||--o{ Session : maintains
    User ||--o{ TenantMembership : belongs_to
    Tenant ||--o{ TenantMembership : includes

    Tenant ||--o{ ProtectedApplication : owns
    Tenant ||--o{ DeceptionPolicy : configures
    Tenant ||--o{ DeceptionStrategy : deploys
    Tenant ||--o{ DeceptionEnvironment : provisions
    Tenant ||--o{ Investigation : investigates
    Tenant ||--o{ AttackerProfile : profiles
    Tenant ||--o{ SecurityObservation : observes
    Tenant ||--o{ BehavioralAssessment : assesses
    Tenant ||--o{ PolicyDecision : decides
    Tenant ||--o{ RoutingDecision : directs
    Tenant ||--o{ DeceptionGraph : manages
    Tenant ||--o{ AuditEvent : records

    Investigation ||--o{ InvestigationAttackerProfile : links
    AttackerProfile ||--o{ InvestigationAttackerProfile : links

    SecurityObservation ||--o{ BehavioralAssessment : informs
    BehavioralAssessment ||--o{ PolicyDecision : evaluates
    PolicyDecision ||--o{ RoutingDecision : authorizes
    RoutingDecision ||--o| RoutingOutcome : records
    RoutingDecision ||--o| ExecutionEvidence : verifies

    DeceptionEnvironment ||--o{ DeceptionGraph : hosts
    DeceptionGraph ||--o{ DeceptionGraphNode : contains
    DeceptionGraphNode ||--o{ DeceptionGraphEdge : connects
    DeceptionGraph ||--o{ DeceptionGraphTransition : mutates
```

### Identity Models

- **`User`**: Core user record containing `id`, unique `email`, display `name`, Argon2id `passwordHash`, account `status` (`ACTIVE`, `SUSPENDED`, `DISABLED`), `isPlatformAdmin` boolean flag, `failedLoginAttempts`, `lockoutUntil`, `lastLoginAt`, and timestamps.
- **`TenantMembership`**: Join record between `User` and `Tenant` establishing tenant-scoped access. Contains `id`, `userId`, `tenantId`, `role` (`APPLICATION_OWNER`, `SECURITY_ANALYST`), `permissions` JSON array, and a unique composite constraint `@@unique([userId, tenantId])`.
- **`Session`**: Persistent server-side session tracking containing `id`, unique `sessionToken`, `csrfToken`, `userId`, `expiresAt`, `lastActiveAt`, optional `revokedAt`, `userAgent`, and `ipAddress`.

---

## 5. API Endpoints Reference

All endpoints are versioned under `/api/v1`.

### Public Health & Diagnostic Probes
| Method | Path | Description | Authentication |
|---|---|---|---|
| `GET` | `/api/v1` | Public API metadata, version, and status | None |
| `GET` | `/api/v1/health/live` | Liveness probe for orchestrators | None |
| `GET` | `/api/v1/health/ready` | Truthful readiness probe reporting actual components | None |

### Authentication & Tenant Authorization (`/api/v1/auth`)
| Method | Path | Description | Access Control |
|---|---|---|---|
| `POST` | `/api/v1/auth/login` | Authenticate with email/password; returns user profile, session, and anti-CSRF token; sets HttpOnly cookie | Public (Throttled: 5 attempts/15m) |
| `POST` | `/api/v1/auth/logout` | Revokes server-side session, clears cookie, emits audit log | Authenticated + Anti-CSRF |
| `GET` | `/api/v1/auth/me` | Returns current identity, safe profile, and tenant memberships | Authenticated (Cookie or Bearer) |
| `GET` | `/api/v1/auth/tenants` | Lists authorized tenants and tenant-scoped permissions | Authenticated (Cookie or Bearer) |
| `GET` | `/api/v1/auth/protected-test`| Demonstration route verifying tenant isolation and role checks | Authenticated + `requireTenantAccess` |
| `GET` | `/api/v1/auth/admin-test`| Demonstration route verifying platform administrator enforcement | Authenticated + `requirePlatformAdmin` |

---

## 6. Development Synthetic Accounts

In development environments (`NODE_ENV === 'development'`), the seed script populates deterministic test accounts:

| Role | Email | Synthetic Dev Password | Tenant Boundary |
|---|---|---|---|
| **Platform Administrator** | `admin@gateway.internal` | `DevAdmin12345!` | Platform-wide oversight (`isPlatformAdmin: true`) |
| **Application Owner** | `owner@apexfintech.io` | `DevOwner12345!` | `tenant-apex-9941` (`role: APPLICATION_OWNER`) |
| **Security Analyst** | `analyst@medsecure.io` | `DevAnalyst12345!` | `tenant-medsecure-7712` (`role: SECURITY_ANALYST`) |
| **Disabled Account** | `disabled@example.com` | `DevDisabled12345!` | Blocked (`status: DISABLED`) |
| **Suspended Account** | `suspended@example.com` | `DevSuspended12345!` | Blocked (`status: SUSPENDED`) |

> [!WARNING]
> These credentials are exclusively synthetic development fixtures. The seed script strictly refuses to run if `NODE_ENV === 'production'`.

---

## 7. Installation & Database Setup

### 1. Copy Environment Template
```bash
cd backend
cp .env.example .env
```
Ensure `DATABASE_URL` points to your PostgreSQL instance:
```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/adaptive_deception_dev?schema=public"
```

### 2. Generate Prisma Client
```bash
npm run prisma:generate
```

### 3. Run Migrations
```bash
# Development (creates new migrations if schema changed):
npm run prisma:migrate

# Production / CI deployment (applies existing migrations):
npm run prisma:deploy
```

### 4. Seed Development Fixtures
```bash
npm run prisma:seed
```

---

## 8. Running Automated Tests

The test suite runs on Node's native test runner (`node:test`) and executes sequentially (`--test-concurrency=1`):

```bash
# Run all backend tests (from repository root):
npm run backend:test

# Or directly within backend/:
npm test
```

### Test Suite Summary (65 Tests across 10 Suites)
- **`tests/auth.test.js`** (16 Tests):
  1. Successful authentication (200, HttpOnly cookie, safe user, anti-CSRF token).
  2. Incorrect password returns generic 401 `INVALID_CREDENTIALS`.
  3. Unknown account returns generic 401 `INVALID_CREDENTIALS` (timing-safe, no user enumeration).
  4. Disabled / suspended accounts return 403 `ACCOUNT_INACTIVE`.
  5. Current identity and memberships inspection via `/me`.
  6. Tenant listing strictly scoped by membership via `/tenants`.
  7. Logout revokes session, clears cookie, emits audit event, subsequent requests fail.
  8. Missing or invalid session on protected endpoints returns 401.
  9. Expired session rejected with 401 `INVALID_SESSION`.
  10. Application owner denied administrator-only endpoints (403 `FORBIDDEN`).
  11. Tenant A denied access to Tenant B resources (403 `TENANT_ACCESS_DENIED`).
  12. Client-supplied tenant IDs cannot bypass membership checks.
  13. Anti-CSRF token verification on cookie-authenticated mutations.
  14. Bearer-authenticated API requests bypass ambient cookie CSRF checks.
  15. Login throttling triggers HTTP 429 `TOO_MANY_REQUESTS` with `Retry-After`.
  16. Authentication audit records exclude passwords, hashes, and secrets.
- **`tests/database-integrity.test.js`** (13 Tests): Relational integrity, foreign keys, tenant cross-reference prevention, DSG layer boundaries, and transactions.
- **`tests/seed.test.js`** (2 Tests): Seed idempotency and production lockout guard.
- **`tests/config.test.js`** (9 Tests): Environment variable schema and validation.
- **`tests/cors.test.js`** (4 Tests): Origin allowlisting, preflight handling, and rejection.
- **`tests/health.test.js`** (3 Tests): Liveness, readiness, and API descriptor probes.
- **`tests/logger.test.js`** (5 Tests): Redaction, query string stripping, and CRLF protection.
- **`tests/request-id.test.js`** (7 Tests): Correlation ID sanitization and propagation.
- **`tests/error-handler.test.js`** (4 Tests): Exception masking and standard JSON error envelopes.
- **`tests/shutdown.test.js`** (2 Tests): Server lifecycle and graceful database disconnection.

---

## 9. Frontend Migration Roadmap

The React/Vite frontend currently utilizes simulated role switching and mock data services (`src/data/mockData.js`). The transition to live backend authentication will follow:

1. **Authentication Provider Transition**:
   - Update `useAuth` hook to call `POST /api/v1/auth/login` and populate identity from `GET /api/v1/auth/me`.
   - Store the anti-CSRF token in memory/state and attach `X-CSRF-Token` to mutating API requests.
2. **Tenant Scoping Context**:
   - Replace local tenant selection state with tenants fetched from `GET /api/v1/auth/tenants`.
   - Forward `X-Tenant-ID` header with verified tenant identifier for tenant-specific pages.
3. **Session Heartbeat**:
   - Call `GET /api/v1/auth/me` periodically to refresh `lastActiveAt` and detect expired sessions.

---

## 10. Current Non-Goals (Stage 3C Scope Boundaries)

To preserve system stability and modularity, Stage 3C explicitly omits:
- **Full Protected Application / Tenant CRUD APIs**: Public resource management routes will be introduced in subsequent stages.
- **ML Threat Detection**: ML model inference engines, feature extractors, and live scoring remain deferred.
- **Reverse Proxy & Traffic Redirection**: Live packet routing, Envoy filters, and honeynet container supervisor daemons are non-goals for this stage.
- **Live Honeypot Deployment**: No runtime decoy containers or honeynet networks are spawned.
