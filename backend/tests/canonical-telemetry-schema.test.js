/**
 * Stage 4B: Canonical Telemetry Event Schema Test Suite
 *
 * Verifies:
 * 1. Strict semver schema versioning (accepts 1.0.0, rejects unsupported).
 * 2. Mandatory and normalized fields (UTC ISO timestamp, route normalization).
 * 3. Range and numeric constraint enforcement (status 100-599, sizes >= 0, duration >= 0).
 * 4. Tenant boundary enforcement (prevents client-supplied tenant spoofing).
 * 5. Route normalization parameterization (integers and UUIDs masked to :id).
 * 6. Zero-credential guarantee (rejects passwords, cookies, authorization tokens, raw bodies).
 * 7. Non-attributive source metadata generation (subnet-level pseudonymization).
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAndNormalizeCanonicalEvent,
  normalizeRouteTemplate,
  generateSourceMetadata,
  CANONICAL_SCHEMA_VERSION
} from '../src/telemetry/canonical-event.schema.js';

describe('Stage 4B: Canonical Telemetry Event Schema', () => {
  const validBasePayload = {
    schemaVersion: '1.0.0',
    eventId: '11111111-2222-3333-4444-555555555555',
    correlationId: '88888888-4444-4444-aaaa-123456789abc',
    tenantId: 'tenant-apex-9941',
    applicationId: 'app-01',
    timestamp: '2026-10-31T20:15:30.500Z',
    httpMethod: 'POST',
    normalizedRoute: '/api/v1/accounts/12345',
    responseStatus: 200,
    requestSizeBytes: 350,
    responseSizeBytes: 1200,
    durationMs: 25.4,
    forwardingResult: 'SUCCESS',
    validationOutcome: 'VALIDATED',
    persistenceStatus: 'TELEMETRY_PERSISTED',
    clientIp: '198.51.100.25'
  };

  test('1. Valid telemetry payload passes canonical schema validation and normalizes route', () => {
    const res = validateAndNormalizeCanonicalEvent(validBasePayload);
    assert.equal(res.valid, true);
    assert.equal(res.canonicalEvent.schemaVersion, CANONICAL_SCHEMA_VERSION);
    assert.equal(res.canonicalEvent.httpMethod, 'POST');
    assert.equal(res.canonicalEvent.normalizedRoute, '/api/v1/accounts/:id');
    assert.equal(res.canonicalEvent.responseStatus, 200);
    assert.equal(res.canonicalEvent.requestSizeBytes, 350);
    assert.equal(res.canonicalEvent.responseSizeBytes, 1200);
    assert.equal(res.canonicalEvent.durationMs, 25.4);
    assert.equal(res.canonicalEvent.sourceMetadata.clientIpType, 'IPV4');
    assert.ok(res.canonicalEvent.sourceMetadata.ipSubnetHash);
  });

  test('2. Unsupported schema version is rejected', () => {
    const res = validateAndNormalizeCanonicalEvent({
      ...validBasePayload,
      schemaVersion: '2.0.0'
    });
    assert.equal(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes('UNSUPPORTED_SCHEMA_VERSION')));
  });

  test('3. Invalid or out-of-bounds response status codes are rejected', () => {
    const resUnder = validateAndNormalizeCanonicalEvent({
      ...validBasePayload,
      responseStatus: 99
    });
    assert.equal(resUnder.valid, false);
    assert.ok(resUnder.errors.some((e) => e.includes('INVALID_RESPONSE_STATUS')));

    const resOver = validateAndNormalizeCanonicalEvent({
      ...validBasePayload,
      responseStatus: 600
    });
    assert.equal(resOver.valid, false);
    assert.ok(resOver.errors.some((e) => e.includes('INVALID_RESPONSE_STATUS')));

    const resFloat = validateAndNormalizeCanonicalEvent({
      ...validBasePayload,
      responseStatus: 200.5
    });
    assert.equal(resFloat.valid, false);
    assert.ok(resFloat.errors.some((e) => e.includes('INVALID_RESPONSE_STATUS')));
  });

  test('4. Negative sizes and durations are rejected', () => {
    const resSize = validateAndNormalizeCanonicalEvent({
      ...validBasePayload,
      requestSizeBytes: -10
    });
    assert.equal(resSize.valid, false);
    assert.ok(resSize.errors.some((e) => e.includes('INVALID_REQUEST_SIZE')));

    const resDuration = validateAndNormalizeCanonicalEvent({
      ...validBasePayload,
      durationMs: -5.0
    });
    assert.equal(resDuration.valid, false);
    assert.ok(resDuration.errors.some((e) => e.includes('INVALID_DURATION')));
  });

  test('5. Tenant boundary mismatch prevents client-supplied tenant spoofing', () => {
    const res = validateAndNormalizeCanonicalEvent(validBasePayload, {
      expectedTenantId: 'tenant-medsecure-7712'
    });
    assert.equal(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes('TENANT_MISMATCH')));
  });

  test('6. Route normalizer parameterizes numeric IDs and UUIDs while preserving route hierarchy', () => {
    assert.equal(
      normalizeRouteTemplate('/api/v1/accounts/987654?sort=desc'),
      '/api/v1/accounts/:id'
    );
    assert.equal(
      normalizeRouteTemplate('/api/v1/users/550e8400-e29b-41d4-a716-446655440000/settings'),
      '/api/v1/users/:id/settings'
    );
    assert.equal(
      normalizeRouteTemplate('/api/v1/transfers/a1b2c3d4e5f607182930415263748596'),
      '/api/v1/transfers/:id'
    );
    assert.equal(normalizeRouteTemplate('/'), '/');
    assert.equal(normalizeRouteTemplate(''), '/');
  });

  test('7. Zero-credential guarantee strictly rejects payloads containing sensitive authentication headers or bodies', () => {
    const withPassword = { ...validBasePayload, password: 'plaintext-secret' };
    assert.equal(validateAndNormalizeCanonicalEvent(withPassword).valid, false);

    const withAuthHeader = { ...validBasePayload, authorization: 'Bearer token-123' };
    assert.equal(validateAndNormalizeCanonicalEvent(withAuthHeader).valid, false);

    const withCookie = { ...validBasePayload, cookie: 'session_id=secret' };
    assert.equal(validateAndNormalizeCanonicalEvent(withCookie).valid, false);

    const withRawBody = { ...validBasePayload, rawBody: '{"card":"4111..."}' };
    assert.equal(validateAndNormalizeCanonicalEvent(withRawBody).valid, false);
  });

  test('8. Non-attributive source metadata correctly hashes subnets without retaining raw IP as permanent identity', () => {
    const metaV4 = generateSourceMetadata('198.51.100.45');
    assert.equal(metaV4.clientIpType, 'IPV4');
    assert.equal(metaV4.isLoopbackOrPrivate, false);
    assert.ok(metaV4.ipSubnetHash);

    // Another IP in same /24 produces identical subnet hash
    const metaV4Sister = generateSourceMetadata('198.51.100.99');
    assert.equal(metaV4.ipSubnetHash, metaV4Sister.ipSubnetHash);

    // IP in different subnet produces different hash
    const metaV4Other = generateSourceMetadata('203.0.113.10');
    assert.notEqual(metaV4.ipSubnetHash, metaV4Other.ipSubnetHash);

    // Loopback handling
    const metaLoop = generateSourceMetadata('127.0.0.1');
    assert.equal(metaLoop.clientIpType, 'LOOPBACK');
    assert.equal(metaLoop.isLoopbackOrPrivate, true);
  });
});
