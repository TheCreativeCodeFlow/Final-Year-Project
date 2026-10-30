# Adaptive Cyber Deception Gateway

> **Research Project:** Development of an AI-Enabled Adaptive Cyber Deception Gateway for Real-Time Attacker Detection  
> **Repository:** `https://github.com/TheCreativeCodeFlow/Final-Year-Project.git`  
> **Branch:** `main`

---

## 1. Project Overview

The **Adaptive Cyber Deception Gateway (ADG)** is an intelligent reverse-proxy security platform designed to detect, mislead, isolate, and profile malicious adversaries in real time. By dynamically deploying decoy paths, canary credentials, synthetic API responses, and isolated container tarpits, the gateway converts passive server logs into active, high-fidelity threat intelligence while shielding upstream production applications.

### Development Stages Completed:
- **Stage 1**: Frontend foundation, dark cybersecurity theme, and role-based navigation.
- **Stage 2A**: Application Owner Portal (overview, protected applications, security events).
- **Stage 2B.1–2B.4**: Gateway Administrator Platform Foundation (health, audit, investigations, attacker behavior profiling, deception environments, deception state graph, policies, and strategies).
- **Stage 2B.5 & 2B.5.1**: End-to-End Gateway Decision Simulator and semantic safety audit.
- **Stage 2C.1**: Public landing page with architectural diagrams and workflow visualizations.
- **Stage 3A**: Secure Node.js backend foundation, OWASP security headers, structured logging, error handling, and test harness.
- **Stage 3B**: PostgreSQL persistence layer via Prisma ORM, versioned migrations, relational domain models, and synthetic seed data.
- **Stage 3C**: Authentication engine with Argon2id password hashing, stateful database sessions, HttpOnly cookies, anti-CSRF protection, and login throttling.
- **Stage 3D**: Secure tenant-scoped REST APIs for applications, policies, strategies, observations, and investigations.
- **Stage 3E**: Production-oriented frontend authentication and backend integration, server-validated sessions, role-based route guards, multi-tenant switching, and live database-backed application management.
- **Stage 3F (Current)**: Security Operations Frontend Integration — live database-backed deception policies, security observations with 7-stage semantic audit, threat investigations with linked dossiers, pseudonymous attacker behavior profiles, and dashboard data integrity verification.

---

## 2. Technology Stack

- **Frontend**: React 19, Vite 6, JavaScript (ES modules), React Router 7, Recharts, Lucide React, Custom CSS Design System.
- **Backend**: Node.js 24, Express, JavaScript (ES modules), Prisma ORM, Native Node.js Test Runner.
- **Database**: PostgreSQL 16 (`adaptive_deception_dev` and `adaptive_deception_test`).

---

## 3. Quick Start & Local Development

### 3.1 Prerequisites
- Node.js `>= 20.0.0`
- PostgreSQL `>= 15.0` running on `localhost:5432`

### 3.2 Database Initialization & Seeding
```bash
# Navigate to backend directory and copy environment template
cd backend
cp .env.example .env

# Generate Prisma client and apply migrations
npm run prisma:generate
npm run prisma:migrate

# Seed development database with synthetic domain fixtures
npm run prisma:seed
cd ..
```

### 3.3 Running the Application
To run both backend and frontend concurrently in development mode:

```bash
# Terminal 1: Start Backend Service (port 4000)
npm run backend:dev

# Terminal 2: Start Vite Frontend (port 3000)
npm run dev
```

Open `http://localhost:3000` in your web browser.

---

## 4. Authentication & Security Architecture

### 4.1 Zero Client-Side Secret Storage
- Passwords, bearer tokens, and session tokens are **never stored** in `localStorage` or `sessionStorage`.
- Sessions are maintained exclusively via cryptographically generated, random 32-byte tokens delivered in `HttpOnly; SameSite=Lax; Path=/` cookies (`adg_session`).
- The browser cookie is invisible to client JavaScript, mitigating Cross-Site Scripting (XSS) session theft.

### 4.2 Anti-CSRF Token Handling
- Every session generates a unique, cryptographically random `csrfToken`.
- Mutation requests (`POST`, `PUT`, `PATCH`, `DELETE`) require the `X-CSRF-Token` header.
- The centralized `apiClient` automatically attaches `X-CSRF-Token` from in-memory state.

### 4.3 Server-Authoritative Roles & Tenant Scoping
- The frontend **never infers roles** from email domains, query parameters, or client storage.
- Identity and permissions are derived strictly from `GET /api/v1/auth/me` and PostgreSQL `tenant_memberships`.
- All tenant routes are anchored under `/api/v1/tenants/:tenantId/*`.
- Substituting another tenant's identifier returns HTTP `403 TENANT_ACCESS_DENIED` or `404 APPLICATION_NOT_FOUND`.

---

## 5. Synthetic Development Accounts (Seed Fixtures)

The development database (`backend/prisma/seed.js`) provides pre-seeded accounts for testing each role and authorization scenario:

| Role | Name | Email | Password | Scope / Permissions |
|---|---|---|---|---|
| **Platform Administrator** | Sarah Chen | `admin@gateway.internal` | `DevAdmin12345!` | Global platform operations (`/admin/*`), all tenants |
| **Application Owner** | Alex Vance | `owner@apexfintech.io` | `DevOwner12345!` | Member of `tenant-apex-9941`, manage applications, view events |
| **Security Analyst** | Elena Rostova | `analyst@medsecure.io` | `DevAnalyst12345!` | Member of `tenant-medsecure-7712`, read-only events & investigations |
| **Disabled Account** | Test Inactive | `disabled@example.com` | `DevDisabled12345!` | Negative test: rejected with `403 ACCOUNT_INACTIVE` |
| **Suspended Account** | Test Inactive | `suspended@example.com` | `DevSuspended12345!` | Negative test: rejected with `403 ACCOUNT_INACTIVE` |

> **Notice:** These accounts are strictly development-only fixtures seeded into local PostgreSQL. Do not deploy these credentials to production environments.

---

## 6. Public Self-Registration Notice

Enterprise deception gateways require verified corporate identities. **Public self-service user registration is intentionally disabled**. User identities and tenant memberships are provisioned directly by Platform Administrators or federated via SAML/OIDC enterprise Single Sign-On (SSO).

---

## 7. Data Source & Dashboard Integrity Matrix

In accordance with scientific research integrity, all UI views explicitly report their data source:

| Console View | Data Source Status | Description |
|---|---|---|
| **Authentication & Session** | **LIVE: PostgreSQL** | Real sessions validated via Argon2id, cookie, and `/auth/me` |
| **Owner Applications List** | **LIVE: PostgreSQL** | Real applications persisted under authorized tenant in database |
| **Owner Application Detail** | **LIVE: PostgreSQL** | Real application metadata from database; traffic chart is prototype preview |
| **Owner Security Events** | **LIVE: PostgreSQL** | Live security observations with 7-stage semantic cards and explicit absence states |
| **Admin Deception Policies** | **LIVE: PostgreSQL** | Live tenant policies & global baselines with baseline modification protection |
| **Admin Threat Investigations** | **LIVE: PostgreSQL** | Real investigations dossiers with linked profiles and discrepancy flags |
| **Admin Attacker Profiles** | **LIVE: PostgreSQL** | Heuristic anomaly profiles with explicit attribution & identity disclaimers |
| **Admin Deception Strategies** | **LIVE: PostgreSQL** | Strategy blueprints with explicit non-execution definition disclaimers |
| **Owner & Admin Overviews** | **Hybrid Verified** | Real database entity counts labeled `LIVE: PostgreSQL`; timeseries labeled `PROTOTYPE` |
| **Gateway Simulator** | **Simulated Rule Engine** | 8 multi-stage decision scenarios with semantic safety verification |
| **Deception State Graph** | **Prototype Visualization**| Relational models seeded; live graph transitions remain deferred |

---

## 8. Automated Testing & Verification

The project includes **141 automated integration tests** covering the complete backend API, domain integrity, authentication flow, security operations, and the Stage 4A gateway reverse proxy runtime:

```bash
# Run all 141 integration tests (backend + gateway runtime)
npm test

# Run backend management tests specifically (119 tests)
npm run backend:test

# Run gateway reverse proxy runtime tests specifically (22 tests)
npm run gateway:test

# Run frontend production build
npm run build
```

### Test Suite Summary:
- **`gateway/tests/gateway-runtime.test.js`** (22 tests): End-to-end reverse proxying to synthetic test origin, method allowlist (`GET`, `POST`, etc.), 405 TRACE rejection, Host header syntax validation, SSRF protection against cloud metadata (AWS/GCP), link-local and multicast ranges, RFC 7230 hop-by-hop header stripping, client-injected proxy identity stripping, 504 timeout, 502 connection refused without port leak, decision controller fail-closed enforcement (503), no silent fallback on deception target unavailability, and sensitive credential redaction.
- **`backend/tests/gateway-internal-api.test.js`** (8 tests): Internal service token authentication (`X-Gateway-Service-Token`), domain-based application and tenant resolution against PostgreSQL, tenant status gating, 404 on unregistered domains, and telemetry/observation persistence.
- **`backend/tests/security-operations.test.js`** (11 tests): Attacker profiles tenant scoping, attribution disclaimers, baseline policy protection (403 for owners, allowed for admins), explicit `NOT_RECORDED` outcome and `MISSING` execution evidence reporting, strategy metadata notice, and investigation dossiers.
- **`backend/tests/frontend-auth-integration.test.js`** (18 tests): Frontend authentication flow, session recovery, deduplication, role derivation, logout, and applications CRUD.
- **`backend/tests/tenant-api.test.js`** (17 tests): Tenant isolation, IDOR defense, CSRF, and permissions.
- **`backend/tests/auth.test.js`** (16 tests): Argon2id hashing, sessions, cookie serialization, rate limiting.
- **`backend/tests/database-integrity.test.js`** (13 tests): PostgreSQL constraints, foreign keys, cascade rules.
- **`backend/tests/config.test.js`** (9 tests): Environment validation.
- **`backend/tests/request-id.test.js`** (7 tests): Correlation IDs.
- **`backend/tests/logger.test.js`** (5 tests): Structured logging and secret redaction.
- **`backend/tests/cors.test.js`** (4 tests): CORS allowlist and preflight.
- **`backend/tests/error-handler.test.js`** (4 tests): Error masking and envelopes.
- **`backend/tests/health.test.js`** (3 tests): Liveness and readiness probes.
- **`backend/tests/seed.test.js`** (2 tests): Seed idempotency and production lockout.
- **`backend/tests/shutdown.test.js`** (2 tests): Graceful shutdown and database disconnect.

---

## 9. Gateway Runtime Architecture (Stage 4A)

Stage 4A introduces the isolated Gateway Reverse Proxy Runtime and multi-container Docker Compose infrastructure. Detailed architectural design, networking topologies, and 8-stage lifecycle definitions are documented in:
👉 [Gateway Architecture Documentation](docs/gateway-architecture.md)

### Key Architecture Highlights:
- **Separated Gateway Process**: Runs independently on port `8000`, communicating with the backend management API via internal service tokens (`X-Gateway-Service-Token`).
- **Isolated Synthetic Origin**: Runs on internal network `protected-origin-net` without host port exposure or external egress.
- **SSRF & Rebinding Defense**: Blocks cloud metadata (`169.254.169.254`), link-local IPs, multicast ranges, and dangerous ports.
- **Fail-Closed Semantics**: Rejects unknown domains (404), inactive tenants (403), controller failures (503), and prohibits silent fallback to real origin if deception is unavailable.
- **8-Stage Evidence Semantics**: Explicitly distinguishes between request observation, validation, assessment, policy evaluation, routing decision, forwarding attempt, routing outcome, and execution evidence.

---

## 10. Current Limitations & Scope Boundaries

Stage 4A establishes the operational gateway reverse-proxy foundation. The following components remain deferred to subsequent stages:
- **ML Detection Runtime**: Online feature extraction, statistical anomaly scoring, and model inference.
- **Dynamic Honeynet Spawning**: Automated Docker/Kubernetes container decoy cluster orchestration.
- **External DNS Challenges**: Automatic ACME / DNS record verification.
