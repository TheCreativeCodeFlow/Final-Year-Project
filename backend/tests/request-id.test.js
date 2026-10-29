import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { isValidRequestId } from '../src/middleware/request-id.js';

describe('Request ID & Correlation Middleware', () => {
  let server;
  let baseUrl;

  before(async () => {
    const app = createApp();
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('generates a fresh UUID when no X-Request-ID header is provided', async () => {
    const res = await fetch(`${baseUrl}/api/v1`);
    assert.equal(res.status, 200);

    const headerId = res.headers.get('x-request-id');
    assert.ok(headerId, 'X-Request-ID response header must be set');
    assert.ok(isValidRequestId(headerId));

    const body = await res.json();
    assert.equal(body.requestId, headerId, 'Response body requestId must match header');
  });

  test('accepts and echoes safe, valid client-provided X-Request-ID', async () => {
    const customId = 'req-client-audit_test-001';
    const res = await fetch(`${baseUrl}/api/v1`, {
      headers: { 'X-Request-ID': customId }
    });

    assert.equal(res.status, 200);
    const headerId = res.headers.get('x-request-id');
    assert.equal(headerId, customId);

    const body = await res.json();
    assert.equal(body.requestId, customId);
  });

  test('rejects request IDs containing newlines or control characters', () => {
    // Attack vector: CRLF log injection verification
    assert.equal(isValidRequestId('valid-part\r\nINJECTED-LOG-RECORD'), false);
    assert.equal(isValidRequestId('newline\nattack'), false);
    assert.equal(isValidRequestId('carriage\rreturn'), false);
    assert.equal(isValidRequestId('\x00null-byte'), false);
  });

  test('replaces client-provided X-Request-ID containing invalid characters or symbols over HTTP', async () => {
    const invalidId = 'req;injection=true&hack=1';
    const res = await fetch(`${baseUrl}/api/v1`, {
      headers: { 'X-Request-ID': invalidId }
    });

    assert.equal(res.status, 200);
    const headerId = res.headers.get('x-request-id');
    assert.notEqual(headerId, invalidId);
    assert.ok(isValidRequestId(headerId), 'Must replace with a validated RFC4122 identifier');
  });

  test('replaces client-provided X-Request-ID with invalid characters or HTML', async () => {
    const htmlAttackId = 'req-<script>alert(1)</script>';
    const res = await fetch(`${baseUrl}/api/v1`, {
      headers: { 'X-Request-ID': htmlAttackId }
    });

    assert.equal(res.status, 200);
    const headerId = res.headers.get('x-request-id');
    assert.notEqual(headerId, htmlAttackId);
    assert.ok(isValidRequestId(headerId));
  });

  test('replaces excessively long client-provided X-Request-ID (>64 chars)', async () => {
    const longId = 'a'.repeat(65);
    const res = await fetch(`${baseUrl}/api/v1`, {
      headers: { 'X-Request-ID': longId }
    });

    assert.equal(res.status, 200);
    const headerId = res.headers.get('x-request-id');
    assert.notEqual(headerId, longId);
    assert.ok(headerId.length <= 64);
  });

  test('accepts X-Correlation-ID as fallback header if X-Request-ID is absent', async () => {
    const correlationId = 'corr-audit-992';
    const res = await fetch(`${baseUrl}/api/v1`, {
      headers: { 'X-Correlation-ID': correlationId }
    });

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-request-id'), correlationId);
    const body = await res.json();
    assert.equal(body.requestId, correlationId);
  });
});
