# Adaptive Deception Gateway — Backend Service

This service forms the security-conscious backend foundation, persistent domain data layer, authentication/authorization engine, and secure tenant-scoped REST API for the **Adaptive Deception Gateway**, developed as part of the research initiative: *Development of an AI-Enabled Adaptive Cyber Deception Gateway for Real-Time Attacker Detection*.

- **Stage 3A**: Established the secure HTTP server, environment validation, logging, request correlation, error handling, health checks, and test infrastructure.
- **Stage 3B**: Established PostgreSQL persistence, Prisma ORM schema, versioned migrations, relational tenant isolation, synthetic development seed data, and domain integrity test suites.
- **Stage 3C**: Established secure user identity, Argon2id credential hashing, stateful server-side sessions, anti-CSRF protections, login rate limiting, and strict tenant membership authorization.
- **Stage 3D**: Established database-backed, tenant-scoped REST APIs connecting persistent PostgreSQL domain models to client workflows for protected applications, deception policies, strategies, security observations, and investigations.
- **Stage 3E**: Integrates the React/Vite frontend with Stage 3C authentication and Stage 3D tenant-scoped APIs, establishing server-authoritative sessions, anti-CSRF token handling, role-guarded routing, tenant switching, and database-backed application management.
- **Stage 3F (Current)**: Connects Security Operations frontend to backend APIs — live deception policies, security observations with 7-stage semantic cards, threat investigations with linked dossiers, pseudonymous attacker behavior profiles, and dashboard data integrity verification.

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
│   │   ├── applications.controller.js  # Tenant-scoped Protected Applications CRUD
│   │   ├── attacker-profiles.controller.js # Tenant-scoped Attacker Behavior Profiles
│   │   ├── auth.controller.js          # Authentication, logout, identity & tenant introspection
│   │   ├── health.controller.js        # Liveness, readiness, and API descriptor controllers
│   │   ├── policies.controller.js      # Tenant-scoped Deception Policies CRUD
│   │   ├── security-events.controller.js # Security Observations & Investigations readers
│   │   └── strategies.controller.js    # Tenant-safe Deception Strategies reader
│   ├── routes/
│   │   ├── applications.routes.js      # /tenants/:tenantId/applications routes
│   │   ├── attacker-profiles.routes.js # /tenants/:tenantId/attacker-profiles routes
│   │   ├── auth.routes.js              # /api/v1/auth routes
│   │   ├── health.routes.js            # /api/v1/health probe routes
│   │   ├── policies.routes.js          # /tenants/:tenantId/policies routes
│   │   ├── security-events.routes.js   # /tenants/:tenantId/security-events & /investigations routes
│   │   ├── strategies.routes.js        # /tenants/:tenantId/strategies routes
│   │   └── tenant.routes.js            # /api/v1/tenants/:tenantId router hub
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
│       ├── audit.js                    # Sanitized security & operational audit event logging
│       ├── auth-audit.js               # Authentication audit logging helper
│       ├── logger.js                   # Structured JSON logger with credential redaction
│       ├── passwords.js                # Argon2id hashing & length validation [10, 128]
│       └── validators.js               # Input validation, domain regex, and pagination helpers
├── tests/
│   ├── auth.test.js                    # Stage 3C authentication & tenant authorization tests
│   ├── config.test.js                  # Environment schema & port validation tests
│   ├── cors.test.js                    # CORS origin allowlist & preflight tests
│   ├── database-integrity.test.js      # Relational integrity, FK constraints, and tenant isolation
│   ├── error-handler.test.js           # 404, 400 (bad JSON), 413, and 500 error tests
│   ├── health.test.js                  # Liveness, readiness, and identity endpoint tests
│   ├── logger.test.js                  # Log redaction, query string omission, CRLF tests
│   ├── request-id.test.js              # ID sanitization, validation, and propagation tests
│   ├── security-operations.test.js     # Stage 3F security operations & semantic integrity tests
│   ├── seed.test.js                    # Seed idempotency, duplication safety, and prod lockout
│   ├── shutdown.test.js                # Server lifecycle, socket drain & DB disconnect tests
│   └── tenant-api.test.js              # Stage 3D comprehensive tenant-scoped REST API tests
├── .env.example                        # Safe environment template with documentation
├── package.json                        # Scripts & dependencies
└── README.md                           # Service architecture & documentation
```

---

## 3. Architecture & Security Controls

### 3.1 Strict Tenant Boundary Isolation & Insecure Direct Object Reference (IDOR) Defense
- All tenant routes are anchored under `/api/v1/tenants/:tenantId`.
- The `requireTenantAccess()` middleware derives authorization directly from the authenticated session and active `tenant_memberships` in PostgreSQL.
- Database queries across all entities (`protected_applications`, `deception_policies`, `security_observations`, `investigations`) strictly enforce `where: { tenantId: req.authorizedTenant.id }`.
- Substituting another tenant's entity ID returns HTTP `404 Not Found` (never leaking resource existence or metadata across tenant boundaries).
- Supplying a `tenantId` field inside a `POST` or `PATCH` request body is strictly rejected with HTTP `400 Bad Request` to prevent unauthorized tenant reassignment.
- Platform Administrators (`isPlatformAdmin: true`) possess platform-wide administrative privileges and can manage any tenant under explicit platform policy.

### 3.2 Granular Role-Based Mutation Permissions
- Mutations are protected by `requirePermission(permission)`:
  - `manage_applications`: Required for `POST` and `PATCH` on `/tenants/:tenantId/applications`. Application Owners have this permission; Security Analysts do not.
  - `configure_policies`: Required for `POST` and `PATCH` on `/tenants/:tenantId/policies`.
- Unauthorized roles attempting restricted mutations receive HTTP `403 Forbidden` (`code: FORBIDDEN`).

### 3.3 Anti-CSRF Defense
- Any state-changing HTTP mutation (`POST`, `PATCH`, `PUT`, `DELETE`) authenticated via ambient browser cookies is validated by `csrfProtection` to require a matching `X-CSRF-Token` header.
- Programmatic requests authenticated via `Authorization: Bearer <token>` are exempt from CSRF checks.

### 3.4 Strict Semantic Transparency for Decisions, Outcomes, and Evidence
- The API maintains a clear, non-negotiable distinction between observed events, behavioral assessments, policy decisions, routing decisions, routing outcomes, and execution evidence.
- Strategy eligibility is explicitly documented as **not** constituting proof of execution.
- If a routing outcome has not been recorded by an ingress proxy or container supervisor, the response explicitly reports `outcomeStatus: "NOT_RECORDED"` and `recorded: false`.
- If cryptographic or telemetry execution evidence is missing, the response explicitly reports `evidenceStatus: "MISSING"` and `verified: false`.
- Outcomes and evidence are **never** inferred from policy decisions or defaulted to success.

---

## 4. API Endpoints Reference

All endpoints are versioned under `/api/v1`.

### Public Health & Diagnostic Probes
| Method | Path | Description | Access Control |
|---|---|---|---|
| `GET` | `/api/v1` | Public API metadata, version, and status | None |
| `GET` | `/api/v1/health/live` | Liveness probe for container orchestrators | None |
| `GET` | `/api/v1/health/ready` | Truthful readiness probe reporting actual components | None |

### Authentication & Tenant Authorization (`/api/v1/auth`)
| Method | Path | Description | Access Control |
|---|---|---|---|
| `POST` | `/api/v1/auth/login` | Authenticate with email/password; returns user profile, session, and anti-CSRF token; sets HttpOnly cookie | Public (Throttled: 5 attempts/15m) |
| `POST` | `/api/v1/auth/logout` | Revokes server session, clears cookie, emits audit log | Authenticated + Anti-CSRF |
| `GET` | `/api/v1/auth/me` | Returns current identity, safe profile, tenant memberships, and anti-CSRF token | Authenticated (Cookie or Bearer) |
| `GET` | `/api/v1/auth/tenants` | Lists authorized tenants and tenant-scoped permissions | Authenticated (Cookie or Bearer) |

### Protected Applications (`/api/v1/tenants/:tenantId/applications`)
| Method | Path | Description | Access Control |
|---|---|---|---|
| `GET` | `/api/v1/tenants/:tenantId/applications` | List applications belonging to authorized tenant with pagination, filtering, and sorting | Authenticated + Tenant Member |
| `POST` | `/api/v1/tenants/:tenantId/applications` | Register new application under tenant; validates domain format and uniqueness | `manage_applications` + Anti-CSRF |
| `GET` | `/api/v1/tenants/:tenantId/applications/:applicationId` | Retrieve single application detail by UUID or applicationIdentifier | Authenticated + Tenant Member |
| `PATCH` | `/api/v1/tenants/:tenantId/applications/:applicationId` | Update application name, domain, or status; records security audit event | `manage_applications` + Anti-CSRF |

### Deception Policies (`/api/v1/tenants/:tenantId/policies`)
| Method | Path | Description | Access Control |
|---|---|---|---|
| `GET` | `/api/v1/tenants/:tenantId/policies` | List tenant-owned policies and platform-wide baseline policies | Authenticated + Tenant Member |
| `POST` | `/api/v1/tenants/:tenantId/policies` | Create tenant-scoped deception policy; validates actions, priority, and conditions | `configure_policies` + Anti-CSRF |
| `GET` | `/api/v1/tenants/:tenantId/policies/:policyId` | Retrieve policy detail by UUID or policyIdentifier | Authenticated + Tenant Member |
| `PATCH` | `/api/v1/tenants/:tenantId/policies/:policyId` | Update policy; global baselines require Platform Administrator | `configure_policies` + Anti-CSRF |

### Deception Strategies (`/api/v1/tenants/:tenantId/strategies`)
| Method | Path | Description | Access Control |
|---|---|---|---|
| `GET` | `/api/v1/tenants/:tenantId/strategies` | List deception strategy definitions; returns explicit non-execution notice | Authenticated + Tenant Member |
| `GET` | `/api/v1/tenants/:tenantId/strategies/:strategyId` | Retrieve strategy definition metadata | Authenticated + Tenant Member |

### Security Events & Investigations (`/api/v1/tenants/:tenantId/...`)
| Method | Path | Description | Access Control |
|---|---|---|---|
| `GET` | `/api/v1/tenants/:tenantId/security-events` | List security observations with pagination and filters | Authenticated + Tenant Member |
| `GET` | `/api/v1/tenants/:tenantId/security-events/:eventId` | Retrieve observation detail with linked assessments, decisions, outcomes, and evidence | Authenticated + Tenant Member |
| `GET` | `/api/v1/tenants/:tenantId/investigations` | List investigations belonging to authorized tenant | Authenticated + Tenant Member |
| `GET` | `/api/v1/tenants/:tenantId/investigations/:investigationId` | Retrieve investigation detail with linked application, attacker profiles, and observations | Authenticated + Tenant Member |

---

## 5. Development Synthetic Accounts

Populated idempotently by `backend/prisma/seed.js` (with strict production lockout guard):

| Role | Email | Synthetic Password | Permissions | Tenant Scope |
|---|---|---|---|---|
| **Platform Administrator** | `admin@gateway.internal` | `DevAdmin12345!` | `*` (Platform-wide) | Platform-wide oversight (`isPlatformAdmin: true`) |
| **Application Owner** | `owner@apexfintech.io` | `DevOwner12345!` | `manage_applications`, `view_security_events`, `configure_policies` | Member of `tenant-apex-9941` |
| **Security Analyst** | `analyst@medsecure.io` | `DevAnalyst12345!` | `view_security_events`, `investigate_threats` | Member of `tenant-medsecure-7712` |
| **Disabled Account** | `disabled@example.com` | `DevDisabled12345!` | None | Blocked (`status: DISABLED`, login returns 403) |
| **Suspended Account** | `suspended@example.com` | `DevSuspended12345!` | None | Blocked (`status: SUSPENDED`, login returns 403) |

---

## 6. Verification and Automated Test Results

The test suite runs on Node's native test runner (`node:test`) and executes sequentially (`--test-concurrency=1`):

```bash
# Run all backend tests (from repository root):
npm run backend:test

# Or directly within backend/:
npm test
```

### Full Backend Test Suite Summary (119 Tests across 19 Suites — 100% Pass)
- **`tests/gateway-internal-api.test.js`** (8 Tests — Stage 4A):
  1. Subsystem health endpoint responds 200 without authentication.
  2. Missing X-Gateway-Service-Token returns 401 MISSING_SERVICE_TOKEN.
  3. Invalid X-Gateway-Service-Token returns 403 INVALID_SERVICE_TOKEN.
  4. Missing domain parameter returns 400 MISSING_DOMAIN_PARAMETER.
  5. Valid registered domain resolves application and active tenant metadata.
  6. Unregistered domain returns 404 APPLICATION_NOT_FOUND.
  7. Application under SUSPENDED tenant returns 403 TENANT_INACTIVE.
  8. Telemetry ingestion persists SecurityObservation and RoutingOutcome to PostgreSQL.
- **`tests/security-operations.test.js`** (11 Tests — Stage 3F):
  1. Attacker profiles list strictly scoped to tenant.
  2. Pseudonymous heuristic notice returned with attacker profiles.
  3. Attacker profile details retrieval with investigations.
  4. Global baseline policy protected against non-platform admin update (403).
  5. Platform admin can update global baseline policy (200).
  6. Non-execution notice returned with strategies endpoints.
  7. Unrecorded routing outcome reported truthfully as NOT_RECORDED.
  8. Missing execution evidence reported truthfully as MISSING.
  9. Investigation dossier with linked profiles and observations.
  10. Cross-tenant investigation access denied (404/403).
  11. Cross-tenant profile access denied (404/403).
- **`tests/frontend-auth-integration.test.js`** (18 Tests — Stage 3E):
  1. `deriveRole`: strictly derives role from backend identity and memberships (no email inference).
  2. `authService.login`: valid credentials authenticate, set cookie, and return role and csrfToken.
  3. `authService.login`: invalid password returns generic 401 INVALID_CREDENTIALS.
  4. `authService.login`: non-existent account returns generic 401 without user enumeration.
  5. `authService.login`: disabled and suspended accounts return 403 ACCOUNT_INACTIVE.
  6. `authService.restoreSession`: recovers active identity and csrfToken on page reload.
  7. `authService.restoreSession`: deduplicates concurrent requests (in-flight singleton).
  8. `authService.restoreSession`: returns null when session is expired or missing.
  9. `authService.logout`: revokes session in DB, clears cookie and in-memory CSRF token.
  10. `authService.getAuthorizedTenants`: scopes tenant list strictly by membership.
  11. `apiClient.getApplications`: loads live database applications under authorized tenant.
  12. `apiClient.getApplicationById`: retrieves single application by ID or slug.
  13. Cross-tenant isolation: Tenant A cannot access Tenant B applications (403 FORBIDDEN).
  14. `apiClient.createApplication`: persists new application with anti-CSRF token.
  15. `apiClient.createApplication`: rejects disallowed fields with 400 INVALID_INPUT.
  16. `apiClient.createApplication`: duplicate applicationIdentifier returns 409 conflict.
  17. Security Analyst without manage_applications is rejected with 403 on create.
  18. `apiClient.updateApplication`: updates existing application in database.
- **`tests/tenant-api.test.js`** (17 Tests — Stage 3D):
  1. Unauthenticated request to tenant endpoints returns 401 UNAUTHENTICATED.
  2. Expired session token is rejected with 401 INVALID_SESSION.
  3. Tenant A cannot list Tenant B applications (returns 403 TENANT_ACCESS_DENIED).
  4. Tenant A cannot retrieve Tenant B application by substituting ID (returns 404 APPLICATION_NOT_FOUND).
  5. Tenant A cannot update Tenant B application (returns 404 APPLICATION_NOT_FOUND).
  6. User cannot change application tenantId via request body (returns 400 INVALID_INPUT).
  7. Platform Administrator can access any tenant applications via explicit policy.
  8. Role without manage_applications permission cannot create or update applications (returns 403 FORBIDDEN).
  9. Cookie-authenticated mutation without CSRF token returns 403 CSRF_TOKEN_INVALID.
  10. Invalid, malformed or unexpected fields in application creation are rejected with 400.
  11. Duplicate applicationIdentifier within the same tenant returns 409 conflict.
  12. Successful application creation and update persist to PostgreSQL and emit audit events.
  13. Policies list includes both tenant-owned policies and platform-wide baselines.
  14. Regular tenant owner cannot update platform-wide baseline policy (returns 403 FORBIDDEN).
  15. Strategies endpoints return valid metadata and explicit non-execution notice.
  16. Security observation detail explicitly reports missing outcome and missing execution evidence.
  17. Tenant A cannot view Tenant B investigations or observations.
- **`tests/auth.test.js`** (16 Tests — Stage 3C): Session creation, revocation, Argon2id, lockout, CSRF, cookie parsing.
- **`tests/database-integrity.test.js`** (13 Tests — Stage 3B): Relational integrity, foreign keys, tenant isolation, DSG boundaries, and transactions.
- **`tests/config.test.js`** (9 Tests — Stage 3A): Environment variable schema and validation.
- **`tests/request-id.test.js`** (7 Tests — Stage 3A): Correlation ID sanitization, bounding, and propagation.
- **`tests/logger.test.js`** (5 Tests — Stage 3A): Structured JSON logs, secret redaction, and CRLF protection.
- **`tests/cors.test.js`** (4 Tests — Stage 3A): Origin allowlisting, preflight handling, and rejection.
- **`tests/error-handler.test.js`** (4 Tests — Stage 3A): Exception masking and standard JSON error envelopes.
- **`tests/health.test.js`** (3 Tests — Stage 3A): Liveness, readiness, and API descriptor probes.
- **`tests/seed.test.js`** (2 Tests — Stage 3B): Seed idempotency and production lockout guard.
- **`tests/shutdown.test.js`** (2 Tests — Stage 3A): Server lifecycle and graceful database disconnection.

---

## 7. Current Feature State Matrix

| Component | Status | Data Source |
|---|---|---|
| **Authentication & Sessions** | Real & Complete | PostgreSQL (`users`, `sessions`, `tenant_memberships`) via Argon2id & cookies |
| **Protected Applications API** | Real & Complete | PostgreSQL (`protected_applications`, `audit_events`) |
| **Protected Applications Frontend** | Real / Hybrid | Database-backed when authenticated; prototype fallback in demo mode |
| **Deception Policies API** | Real & Complete | PostgreSQL (`deception_policies`, `audit_events`) |
| **Deception Strategies API** | Real & Complete | PostgreSQL (`deception_strategies`) with execution disclaimer |
| **Security Observations API** | Real & Complete | PostgreSQL (`security_observations`, `behavioral_assessments`, `policy_decisions`) |
| **Investigations API** | Real & Complete | PostgreSQL (`investigations`, `attacker_profiles`, `security_observations`) |
| **Decision Simulator** | Simulated | Client-side rule evaluator based on synthetic test scenarios |
| **Deception State Graph (DSG)** | Simulated / Prototype | Relational models created; live graph mutations remain deferred |
| **Machine Learning Detection** | Non-Goal (Deferred) | Model weights, feature extraction, and online inference engine deferred |
| **Gateway Reverse Proxy Runtime** | Operational Foundation (Stage 4A) | Express/HTTP runtime on port 8000, SSRF guard, Docker isolation |
| **Synthetic Test Origin** | Operational Foundation (Stage 4A) | Isolated Node.js service on port 8081 (protected-origin-net) |
| **Dynamic Honeynet Pods** | Non-Goal (Deferred) | Dynamic decoy container orchestration deferred |

---

## 8. Current Non-Goals (Stage 4A Scope Boundaries)

To preserve system safety, modularity, and evidence integrity, Stage 4A explicitly omits:
- **ML Threat Detection**: Model training, live scoring, and online ML inference engines remain deferred to future stages.
- **Dynamic Honeypot Deployment**: No live decoy containers or honeynet networks are spawned dynamically.
- **DNS / Domain Verification**: No live DNS challenge or external domain verification probe is executed.
