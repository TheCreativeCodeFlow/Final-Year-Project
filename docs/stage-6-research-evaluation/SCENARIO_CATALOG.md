# Stage 6 — Reproducible Scenario Catalog

All 26 scenarios are defined deterministically in `backend/src/research/stage6-scenario-suite.js` with `initialEnvironmentState`, timestamped `requestSequence`, expected observations, adaptation opportunities, consistency constraints, and termination conditions.

## 1. Development Partition (`DEVELOPMENT`, 6 Scenarios — Calibration Only)

| Scenario ID | Ground Truth | Taxonomy | Requests | Client IP | Summary |
| :--- | :--- | :--- | :---: | :--- | :--- |
| `DEV-BENIGN-01` | `BENIGN` | `BENIGN_USAGE` | 6 | `198.51.100.11` | Standard account viewing at 3.5s cadence |
| `DEV-BENIGN-02` | `BENIGN` | `BENIGN_USAGE` | 6 | `198.51.100.12` | Scheduled health/resource checks (4.2s cadence) |
| `DEV-BENIGN-03` | `BENIGN` | `BENIGN_USAGE` | 6 | `198.51.100.13` | Mobile user ledger read stream (2.4s–3.5s cadence) |
| `DEV-RECON-01` | `ATTACK` | `ENDPOINT_RECONNAISSANCE` | 6 | `198.51.100.21` | Unauthenticated `.git`/config dotfile scan |
| `DEV-AUTH-01` | `ATTACK` | `AUTHENTICATION_ABUSE` | 6 | `198.51.100.22` | Rapid credential spray against `svc_deploy` |
| `DEV-AMBIG-01` | `AMBIGUOUS` | `AMBIGUOUS_INCOMPLETE_TELEMETRY` | 3 | `198.51.100.23` | Degraded telemetry stream with packet drops |

---

## 2. Validation Partition (`VALIDATION`, 6 Scenarios — Integration Parity Check)

| Scenario ID | Ground Truth | Taxonomy | Requests | Client IP | Summary |
| :--- | :--- | :--- | :---: | :--- | :--- |
| `VAL-BENIGN-01` | `BENIGN` | `BENIGN_USAGE` | 6 | `198.51.100.51` | Routine API resource/account checks |
| `VAL-REPEAT-01` | `ATTACK` | `REPEATED_RESOURCE_ACCESS` | 6 | `198.51.100.61` | Repeated 404 probes on `/api/v0/legacy/swagger` |
| `VAL-CRED-01` | `ATTACK` | `CREDENTIAL_PROBING` | 6 | `198.51.100.62` | Credential stuffing targeting `maria.santos` |
| `VAL-DATA-01` | `ATTACK` | `SENSITIVE_DATA_DISCOVERY` | 6 | `198.51.100.63` | `.aws/credentials` + schema + customer dump probes |
| `VAL-MULTI-01` | `ATTACK` | `MULTI_STAGE_PROGRESSION` | 6 | `198.51.100.64` | 3-stage `val_auditor` auth -> lookup -> `/val-audit` |
| `VAL-AMBIG-01` | `AMBIGUOUS` | `AMBIGUOUS_INCOMPLETE_TELEMETRY` | 4 | `198.51.100.65` | Telemetry drop mid-stream |

---

## 3. Held-Out Test Partition (`TEST`, 14 Scenarios — 131 Requests Total)

Covers all 10 required research taxonomies using held-out route paths, usernames, IPs, and session trajectories unseen during calibration or validation:

| Scenario ID | Ground Truth | Taxonomy | Requests | Max Stages | Client IP | Core Consistency / Research Stress Test |
| :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| `TEST-BENIGN-01` | `BENIGN` | `BENIGN_USAGE` | 8 | 0 | `203.0.113.10` | Clean banking workflow; must maintain 0 FP |
| `TEST-BENIGN-02` | `BENIGN` | `BENIGN_USAGE` | 6 | 0 | `203.0.113.11` | Compliance officer schema/role review; 0 FP |
| `TEST-BENIGN-03` | `BENIGN` | `BENIGN_USAGE` (Hard Neg.) | 10 | 0 | `203.0.113.12` | Fast (450ms) automated UI prefetch with zero 4xx |
| `TEST-RECON-01` | `ATTACK` | `ENDPOINT_RECONNAISSANCE` | 10 | 4 | `203.0.113.21` | `/.env.production` -> `/internal/treasury/vault-status` -> `/audit-logs` -> `/secrets/keys` |
| `TEST-ENUM-01` | `ATTACK` | `API_ENUMERATION` | 10 | 3 | `203.0.113.22` | User directory scanning (`sec_auditor_01`, `ops_director_02`) + org-chart |
| `TEST-CRED-01` | `ATTACK` | `CREDENTIAL_PROBING` | 8 | 3 | `203.0.113.23` | 4 `401` login probes + role verification on `alex.chen` |
| `TEST-AUTH-01` | `ATTACK` | `AUTHENTICATION_ABUSE` | 10 | 3 | `203.0.113.24` | Brute-force on unseen `treasury_ops` + pivot to `david.kim` |
| `TEST-DATA-01` | `ATTACK` | `SENSITIVE_DATA_DISCOVERY` | 9 | 3 | `203.0.113.25` | `/.env.db-backup` + `/data/schemas` + `/data/dump-all` + `/data/customers` |
| `TEST-REPEAT-01` | `ATTACK` | `REPEATED_RESOURCE_ACCESS` | 8 | 2 | `203.0.113.26` | 7x repeated probes on `/api/v1/internal/treasury/wire-export` |
| `TEST-MULTI-01` | `ATTACK` | `MULTI_STAGE_PROGRESSION` | 12 | 4 | `203.0.113.27` | 4-stage APT progression on `sec_auditor_09`: Auth -> Profile/Roles -> Audit -> Data |
| `TEST-MULTI-02` | `ATTACK` | `MULTI_STAGE_PROGRESSION` | 16 | 3 | `203.0.113.28` | High-frequency 40ms auth burst + `/internal/auth/tokens` + `/auth/session` check |
| `TEST-SHIFT-01` | `ATTACK` | `BEHAVIOR_CHANGE` | 12 | 4 | `203.0.113.29` | 4 slow (5s) normal reads -> abrupt 120ms recon/auth pivot (`pivot_svc`) -> customers |
| `TEST-AMBIG-01` | `AMBIGUOUS` | `AMBIGUOUS_INCOMPLETE_TELEMETRY` | 6 | 0 | `203.0.113.30` | Degraded/corrupt telemetry packet loss stream (`telemetryLossDetected=true`) |
| `TEST-AMBIG-02` | `AMBIGUOUS` | `AMBIGUOUS_INCOMPLETE_TELEMETRY` | 6 | 0 | `203.0.113.31` | Misconfigured WebDAV webhook client (`OPTIONS`/`HEAD`/`PROPFIND`) |
