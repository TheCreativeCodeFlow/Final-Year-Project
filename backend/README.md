# Adaptive Deception Gateway — Backend Service

This service forms the security-conscious backend foundation and persistent domain data layer for the **Adaptive Deception Gateway**, developed as part of the research initiative: *Development of an AI-Enabled Adaptive Cyber Deception Gateway for Real-Time Attacker Detection*.

- **Stage 3A**: Established the secure HTTP server, environment validation, logging, request correlation, error handling, health checks, and test infrastructure.
- **Stage 3B**: Establishes PostgreSQL persistence, Prisma ORM schema, versioned migrations, relational tenant isolation, synthetic development seed data, and domain integrity test suites.

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
│   ├── schema.prisma                   # Complete relational domain schema with composite tenant keys
│   ├── seed.js                         # Idempotent development seed script (refuses in production)
│   └── migrations/
│       └── 20261029144928_init_domain_models/
│           └── migration.sql           # Versioned initial PostgreSQL migration
├── src/
│   ├── app.js                          # Express application assembly & middleware pipeline
│   ├── server.js                       # Server entrypoint & graceful shutdown handlers
│   ├── config/
│   │   └── env.js                      # Fail-fast environment & database validation
│   ├── db/
│   │   └── client.js                   # Controlled Prisma client, lazy connect & transactions
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

## 3. Database Architecture & Domain Models

The relational schema implements 11 core domain entity groups designed with defense-in-depth isolation:

```mermaid
erDiagram
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

### Core Domain Entities

1. **`Tenant`**: Root boundary for all tenant-scoped data. Contains `id`, `identifier` (e.g. `tenant-apex-9941`), `displayName`, `status`, and timestamps.
2. **`ProtectedApplication`**: Target applications protected by the gateway. Keyed by `(id, tenantId)` and `(tenantId, applicationIdentifier)`.
3. **`DeceptionPolicy`**: Rules defining triggers, permitted actions, prohibited actions (e.g. arbitrary command execution), and isolation constraints.
4. **`DeceptionStrategy`**: Active mitigation templates (containment, tarpit, honeypot diversion) with structured prerequisites.
5. **`DeceptionEnvironment`**: Isolated sandbox namespaces with strict CPU/memory quotas and egress restrictions.
6. **`Investigation` & `AttackerProfile`**: Differentiates observed security incidents from behavioral attacker profiles. Linked via `InvestigationAttackerProfile` which guarantees both records belong to the same tenant.
7. **Gateway Decision Lifecycle (Strict Semantic Separation)**:
   - **`SecurityObservation`**: Raw sanitized facts observed at ingress/proxy.
   - **`BehavioralAssessment`**: AI/heuristic risk and confidence scores (explicitly documented: not proof of malice).
   - **`PolicyDecision`**: Policy evaluation outcome (`PERMIT_DIVERSION`, `BLOCK`, `ALLOW_NORMAL`).
   - **`RoutingDecision`**: Intended gateway action (`PROPOSED_DECEPTION_DIVERSION`).
   - **`RoutingOutcome`**: Independently recorded outcome (`DIVERTED_TO_SANDBOX` or `BLOCKED_AT_INGRESS` if overridden).
   - **`ExecutionEvidence`**: Confirmed execution telemetry from honeypots/taps, or explicitly `MISSING`.
8. **Deception State Graph (DSG)**:
   - **`DeceptionGraph`**: Tenant-scoped topology associated with a deception environment.
   - **`DeceptionGraphNode`**: Synthetic nodes categorized into 3 conceptual layers:
     - `PROTECTED_DECEPTION_POLICY` (immutable baseline rules)
     - `CONTROLLED_DYNAMIC_STATE` (mutable synthetic assets)
     - `OBSERVATIONAL_ATTACKER_STATE` (external probe tracking)
   - **`DeceptionGraphEdge`**: Directed relationships between nodes. Foreign keys enforce `(id, graphId)` so edges can never link across graph boundaries.
   - **`DeceptionGraphTransition`**: State change proposal. Distinguished as `PROPOSED`, `APPROVED`, or `EXECUTED`. Never automatically executed upon proposal.
9. **`AuditEvent`**: Append-only log recording actor, action, target entity, tenant scope, and correlation ID.

---

## 4. Tenant Isolation Design

Tenant isolation is enforced **relational-first** at the PostgreSQL constraint level:

- **Composite Primary/Unique Keys**: Every tenant-owned model enforces `@@unique([id, tenantId])`.
- **Composite Foreign Keys**: Relationships between tenant-owned entities (such as an investigation referencing an application) use composite foreign keys:
  ```prisma
  application ProtectedApplication? @relation(fields: [applicationId, tenantId], references: [id, tenantId])
  ```
- **PostgreSQL Enforcement**: If Tenant A attempts to link an application belonging to Tenant B, PostgreSQL rejects the insert with constraint error `P2003` (`foreign key violation`), because `(app_id_B, tenant_id_A)` does not exist in `protected_applications`.
- **Cross-Graph Protection**: DSG edges reference `(sourceNodeId, graphId)` and `(targetNodeId, graphId)`, preventing nodes from different graphs being connected.

> **Note on Row-Level Security (RLS)**: PostgreSQL RLS policies can be layered on top of this composite relational foundation in future stages when database-level session contexts (e.g. `SET LOCAL app.current_tenant_id`) are introduced.

---

## 5. Unknown & Missing Evidence Semantics

To prevent false claims in security forensics:
- An intended routing decision does not guarantee execution.
- If a routing outcome is not yet received, `RoutingDecision.outcome` remains `null`.
- If execution evidence cannot be verified by decoy telemetry, `ExecutionEvidence` is created with:
  - `evidenceStatus = "MISSING"`
  - `evidenceSource = null`
  - `evidenceData = null`
  - `recordedAt = null`
- Missing evidence is **never** defaulted to benign behavior, success, or safety.

---

## 6. Audit Event Semantics & Limitations

- **Append-Only**: Audit records are write-once records tracking operational actions (`SEED_INITIALIZATION`, `POLICY_CREATED`, etc.).
- **Correlation**: Captures the request correlation identifier (`correlationId`) for end-to-end tracing.
- **Actor Provenance**: Records actor labels (`analyst-simulated-01`, `dev-seed-runner`) without inventing unauthorized sessions.
- **Known Limitation**: In Stage 3B, audit events are stored in standard PostgreSQL tables and do not constitute a cryptographically tamper-proof or blockchain-verified ledger. Hardware security module (HSM) signing and write-once-read-many (WORM) storage remain deferred.

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
The seed script:
- Seeds fictional tenants (`tenant-apex-9941`, `tenant-medsecure-7712`), protected applications, deception policies, strategies, environments, investigations, profiles, and DSG graphs.
- Is **strictly development-only** (aborts if `NODE_ENV === 'production'`).
- Is **idempotent**: safe to run repeatedly without creating duplicate rows.

---

## 8. Running Automated Tests

The test suite runs on Node's native test runner (`node:test`) and executes tests sequentially (`--test-concurrency=1`) to prevent database test collisions:

```bash
# Run all backend tests (from repository root):
npm run backend:test

# Or directly within backend/:
npm test
```

### Test Suite Summary (49 Tests across 9 Suites)
- `tests/config.test.js`: Environment defaults, port limits, invalid modes, log levels, wildcard CORS rejection.
- `tests/cors.test.js`: Origin allowlists, comma-separated lists, preflight OPTIONS, 403 denial.
- `tests/database-integrity.test.js`:
  1. Validates PostgreSQL connection URL format and configuration helper.
  2. Confirms migration applied all 19 relational tables to PostgreSQL.
  3. Enforces unique constraints on tenant identifier and composite application identifier.
  4. Enforces foreign-key integrity (rejects orphaned records).
  5. Enforces tenant isolation (Tenant A cannot link Tenant B application).
  6. Enforces tenant isolation in investigation/profile many-to-many join.
  7. Enforces DSG graph boundary integrity (edges cannot connect cross-graph nodes).
  8. Enforces proposed vs executed DSG transition semantic separation.
  9. Enforces missing routing outcomes remain absent/null (never defaulted to success).
  10. Enforces execution evidence cannot be inferred from policy decisions.
  11. Confirms audit events capture actor, action, tenant scope, and correlation ID.
  12. Confirms database transactions roll back atomically on write failure.
  13. Confirms the 3 DSG layers remain strictly distinguishable.
- `tests/seed.test.js`:
  - Confirms repeated seed runs produce identical counts without record duplication.
  - Confirms seed script refuses execution in production environments.
- `tests/health.test.js`: Liveness and readiness endpoints (verifying truthful reporting).
- `tests/logger.test.js`: Sensitive field redaction, safe path extraction, CRLF neutralization.
- `tests/request-id.test.js`: Request correlation ID boundaries, regex validation, UUID fallback.
- `tests/error-handler.test.js`: 404, 400 (bad JSON), 413, and 500 error masking.
- `tests/shutdown.test.js`: Server lifecycle, socket draining, and clean database disconnection.

---

## 9. Current Non-Goals (Stage 3B Scope Boundaries)

To maintain architectural focus, Stage 3B explicitly omits:
- **User Authentication & Accounts**: No JWTs, session cookies, passwords, or login endpoints are created.
- **Full REST CRUD APIs**: The database access layer and domain models are established and tested before exposing public API routes.
- **ML Threat Detection**: Model training, live scoring, and inference engines remain deferred to future stages.
- **Reverse Proxy & Traffic Redirection**: Live packet routing, Envoy filters, and honeynet container supervisor daemons are non-goals for this stage.
- **Live Honeypot Deployment**: No actual containers or decoy services are provisioned at runtime.
