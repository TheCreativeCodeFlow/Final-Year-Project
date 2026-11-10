# Stage 6 — Experimental Reproducibility Guide

## 1. Prerequisites

- **Node.js:** `v20.0.0+` (evaluated on `v24.16.0`)
- **PostgreSQL 16** (for runtime/backend integration suites)
- **Docker Engine** (e.g., Colima or Linux Docker daemon with `deception-synthetic-service:1.0.0` built from `synthetic-service/Dockerfile`, required only for live container parity experiments)
- **Database Initialization (for full backend DB tests):** Ensure test DB schema is migrated and seeded via:
  ```bash
  cd backend
  npm run prisma:seed
  ```

---

## 2. Reproduce Three-Way Comparative Evaluation (Loopback HTTP Harness)

Runs leakage audit, 3-scenario JIT warmup, Validation partition parity, and all 5 independent seeded repetitions (`[101, 202, 303, 404, 505]`) across all 14 held-out scenarios:

```bash
node backend/scripts/stage-6-research-evaluation.js
```

**Expected Exports:**
- `docs/stage-6-research-evaluation/stage6-research-results.json`
- `docs/stage-6-research-evaluation/stage6-scenario-comparison.csv`
- `docs/stage-6-research-evaluation/stage6-system-comparison.csv`

---

## 3. Reproduce Live Isolated Docker Container Parity Run

Starts 3 live isolated synthetic containers (`deception-synthetic-service:1.0.0`) attached to dedicated `Internal: true` bridge networks (`No Egress`, `UID 1000:1000`, `ReadonlyRootfs: true`, `CapDrop: ALL`), executes multi-stage mutations + health/cgroup stats + rollback, and cleans up all Docker artifacts:

```bash
# Ensure Docker daemon / Colima is running
node backend/scripts/stage-6-live-docker-parity.js
```

**Expected Export:**
- `docs/stage-6-research-evaluation/stage6-live-docker-parity.json`

---

## 4. Reproduce All Automated Test Suites

```bash
# 1. Stage 6 Verification Suite (12 test categories)
cd backend && node --test tests/stage-6-research-evaluation.test.js

# 2. Gateway Reverse Proxy Suite (37 tests)
cd gateway && npm test

# 3. DSG Execution Engine (Live Docker + PostgreSQL, 25 tests)
cd backend && node --test tests/dsg-execution-engine.test.js

# 4. Gateway Shadow-Mode & Adaptive Routing Suites
cd backend && node --test tests/gateway-adaptive-routing.test.js
cd backend && node --test tests/gateway-shadow-mode-integrity.test.js

# 5. Frontend Production Bundle Check
npm run build
```
