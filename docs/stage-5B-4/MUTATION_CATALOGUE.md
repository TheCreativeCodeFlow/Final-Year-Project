# Stage 5B.4: Deception State Graph Mutation Catalogue

## 1. Overview and Security Invariants

The Deception State Graph (DSG) Mutation Catalogue (`backend/src/deception/dsg-mutation-catalogue.js`) formalizes the strict mathematical grammar and operational boundaries for modifying synthetic deception environments.

Dynamic deception must never expose host processes or provide attackers with unintended capabilities. Consequently, the mutation engine enforces four core security invariants:
1. **Strict Allowlisting:** Only predefined mutation operations across 5 controlled dimensions are recognized and executable.
2. **Zero Arbitrary Execution:** No arbitrary shell commands, raw SQL scripts, dynamic filesystem alterations, or Docker container reconfigurations are allowed.
3. **Data Boundary Integrity:** Zero production origin data replication, zero canary token leakage into production databases, and zero credential harvesting.
4. **Hardware and Network Isolation:** Synthetic environments remain pinned to non-root UID 1000, read-only root filesystems, and internal bridge network isolation with egress quarantine.

---

## 2. Five Mutation Dimensions and Operations

### Dimension 1: Identity Mutation (`IDENTITY_MUTATION`)
Manipulates synthetic identities, roles, departments, and entity relationship mappings within the synthetic tenant directory.

| Operation | Description | Required Payload Fields | Validation Constraints |
| :--- | :--- | :--- | :--- |
| `ADD_SYNTHETIC_USER` | Injects a new synthetic persona into the directory. | `username`, `role` | `username` (alphanumeric 3-32 chars), `role` from `ALLOWED_SYNTHETIC_ROLES`. |
| `MODIFY_USER_ROLE` | Elevates or demotes a synthetic user's decoy privileges. | `username`, `role` | User must exist; target `role` must be allowlisted. |
| `LINK_USER_RELATIONSHIP`| Creates synthetic hierarchy relationships (e.g. manager, peer). | `username`, `relationships` | User must exist; relationships dictionary must be non-empty. |

**Allowlisted Synthetic Roles:**
- `ADMINISTRATOR`
- `SECURITY_AUDITOR_DECOY`
- `FINANCIAL_ANALYST`
- `COMPLIANCE_OFFICER`
- `INFRASTRUCTURE_ENGINEER`
- `READONLY_API_INTEGRATION`
- `DATABASE_ADMIN_DECOY`

### Dimension 2: API Topology Mutation (`API_TOPOLOGY_MUTATION`)
Alters the perceived HTTP routing surface, simulating shadow endpoints, delayed execution, or rate-limited responses to entice and slow down attacker reconnaissance.

| Operation | Description | Required Payload Fields | Validation Constraints |
| :--- | :--- | :--- | :--- |
| `ADD_SYNTHETIC_ROUTE` | Registers a new decoy API route with mock response schema. | `path`, `method` | Path must start with `/`, valid HTTP method (`GET`, `POST`, `PUT`, `DELETE`). |
| `MODIFY_ROUTE_BEHAVIOR`| Updates route status code (e.g., 403, 429) or latency profile. | `path` | Path must exist; `simulatedStatus` (200-599). |
| `SET_ROUTE_AVAILABILITY`| Toggles route between `ENABLED`, `DISABLED`, `RATE_LIMITED`. | `path`, `availability` | Availability must be in `ALLOWED_ROUTE_AVAILABILITIES`. |

### Dimension 3: Synthetic Data Mutation (`DATA_MUTATION`)
Injects synthetic database records and evolves decoy schemas to trap data exfiltration vectors.

| Operation | Description | Required Payload Fields | Validation Constraints |
| :--- | :--- | :--- | :--- |
| `ADD_SYNTHETIC_RECORD` | Inserts synthetic records into customer, account, or audit tables. | `type`, `record` | `type` in `CUSTOMER`, `ACCOUNT`, `TRANSACTION`, `AUDIT_LOG`. |
| `MODIFY_DECOY_ATTRIBUTES`| Mutates specific fields of existing synthetic records. | `type`, `identifier`, `updates` | Target record must exist. |
| `SCHEMA_MUTATION` | Extends table definitions with decoy canary columns. | `table`, `columns` | Valid alphanumeric table identifier; non-empty columns list. |

### Dimension 4: Service Topology Mutation (`SERVICE_TOPOLOGY_MUTATION`)
Simulates upstream microservices and dependent subsystems within the synthetic container.

| Operation | Description | Required Payload Fields | Validation Constraints |
| :--- | :--- | :--- | :--- |
| `ENABLE_SYNTHETIC_SERVICE` | Activates synthetic microservice endpoints. | `serviceType` | `serviceType` in `ALLOWED_SYNTHETIC_SERVICES`. |
| `DISABLE_SYNTHETIC_SERVICE`| Deactivates synthetic service, returning mock 503 Service Unavailable. | `serviceType` | `serviceType` must be active. |
| `UPDATE_SERVICE_CONFIG` | Adjusts synthetic service internal mock configuration. | `serviceType`, `config` | `serviceType` must be allowlisted. |

**Allowlisted Synthetic Services:**
- `SYNTHETIC_API`
- `SYNTHETIC_AUTH`
- `SYNTHETIC_DATA`
- `SYNTHETIC_PAYMENTS`
- `SYNTHETIC_AUDIT`

### Dimension 5: Credential Deception Mutation (`CREDENTIAL_MUTATION`)
Injects honey-tokens, canary API keys, and simulated OAuth access tokens into the synthetic container.

| Operation | Description | Required Payload Fields | Validation Constraints |
| :--- | :--- | :--- | :--- |
| `CREATE_DECOY_CREDENTIAL`| Creates an in-memory honey-token bound to a synthetic identity. | `username`, `tokenType` | Target user must exist; token string must be at least 8 chars. |
| `REVOKE_DECOY_CREDENTIAL`| Explicitly marks a honey-token revoked to observe attacker reuse attempts. | `token` | Token must exist in credentials store. |
| `UPDATE_AUTH_MAPPING` | Rebinds credential permissions to honeypot roles. | `token`, `role` | Role must be allowlisted. |

---

## 3. Strict Pre-Flight Validation Rules

Every mutation proposal is validated synchronously via `validateMutationSchema(mutation)`:
- Payload schema must contain only permitted properties (unexpected keys trigger schema rejections).
- Parameter types and ranges are strictly asserted.
- All operations are completely deterministic and idempotent.
