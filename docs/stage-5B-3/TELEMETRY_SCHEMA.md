# Stage 5B.3 — Synthetic Runtime Telemetry Schema & Sanitization

## 1. Overview

The Runtime Telemetry subsystem (`RuntimeTelemetryService`) provides real-time event streaming and observational data collection from synthetic deception containers while preventing memory exhaustion and sensitive data exposure.

Because deception environments deliberately engage with suspicious and adversarial actors, the telemetry collection system enforces:
- Strict payload sanitization (credential and token stripping).
- Pseudonymization of user and session identifiers.
- Fixed-capacity circular ring buffers (500 events per environment).
- Explicit accounting for dropped events via `TELEMETRY_DATA_LOSS` markers.

---

## 2. Telemetry Event Schema

Every ingested runtime telemetry event adheres to the following JSON schema:

```json
{
  "sequence": 42,
  "timestamp": "2026-11-07T14:32:00.123Z",
  "environmentId": "env_a1b2c3d4",
  "tenantId": "tenant_prod_01",
  "eventType": "HTTP_REQUEST_OBSERVED",
  "source": "HTTP",
  "severity": "INFO",
  "payload": {
    "method": "POST",
    "path": "/api/v1/auth/login",
    "clientIp": "192.168.1.100",
    "headers": {
      "authorization": "[REDACTED]",
      "host": "synthetic-api.internal"
    },
    "body": {
      "username": "admin",
      "password": "[REDACTED]"
    },
    "sessionId": "sess-anon-a1f94bc3e820"
  }
}
```

### 2.1. Field Definitions

| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `sequence` | Integer | Yes | Monotonically increasing sequence number within the environment stream. |
| `timestamp` | String (ISO 8601) | Yes | Wall-clock time when the telemetry event was captured. |
| `environmentId` | String (UUID) | Yes | Unique identifier of the originating deception environment. |
| `tenantId` | String (UUID) | Yes | Tenant owning the deception environment. |
| `eventType` | String | Yes | Classification of event (e.g., `HTTP_REQUEST_OBSERVED`, `PROCESS_SPAWNED`). |
| `source` | Enum | Yes | Origin subsystem: `HTTP`, `SYSTEM`, `GATEWAY`, `DOCKER`. |
| `severity` | Enum | Yes | Severity level: `INFO`, `WARN`, `CRITICAL`. |
| `payload` | Object | Yes | Sanitized contextual event details. |

---

## 3. Data Sanitization and Redaction Rules

To prevent sensitive credentials, secret tokens, or customer data from lingering in telemetry logs, `RuntimeTelemetryService.sanitizeTelemetryPayload()` executes recursive payload normalization:

### 3.1. Credential Stripping
Any field whose key contains or matches the following case-insensitive substrings is replaced with `[REDACTED]`:
- `password`, `passwd`, `pwd`
- `token`, `secret`, `apikey`, `api_key`
- `authorization`, `auth`, `bearer`
- `cookie`, `set-cookie`
- `privatekey`, `private_key`

### 3.2. Session Pseudonymization
To allow behavioral clustering without tracking real session credentials or user IDs:
- Plaintext session tokens (`sessionId`, `session_token`, `cookie_id`) are transformed using one-way SHA-256 hashing.
- Output format: `sess-anon-<hash_prefix_12>`, e.g., `sess-anon-a1f94bc3e820`.

---

## 4. Bounded Ring Buffer & Drop Accounting

To protect the gateway and backend processes against deliberate Denial of Service (DoS) through flood telemetry:
- Each environment maintains an in-memory bounded ring-buffer with a default capacity of **500 events**.
- When the buffer reaches 500 events and a new event arrives, the oldest event is dropped (FIFO eviction).
- The service tracks an internal `droppedEventsCount` counter for each environment.

```
       [Event 1] -> [Event 2] -> ... -> [Event 500]
                                             |
                         [Event 501 arrives] v
       [DROPPED] <- [Event 2] -> ... -> [Event 501]
           |
           v
  droppedEventsCount++
           |
  Record TELEMETRY_DATA_LOSS Event
```

### 4.1. Explicit Telemetry Loss Semantics
- **Rule**: Missing or dropped telemetry is **NEVER** treated as lack of activity or benign state.
- When drops occur, `RuntimeTelemetryService` emits a synthetic `TELEMETRY_DATA_LOSS` event:
  ```json
  {
    "eventType": "TELEMETRY_DATA_LOSS",
    "source": "SYSTEM",
    "severity": "WARN",
    "payload": {
      "reason": "RING_BUFFER_OVERFLOW",
      "droppedEventsCount": 14,
      "bufferCapacity": 500
    }
  }
  ```
- This ensures downstream anomaly detectors and operators are aware that an event burst or blind spot occurred.
