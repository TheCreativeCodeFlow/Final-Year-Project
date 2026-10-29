import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';

describe('CORS Allowlist Policy Enforcement', () => {
  let server;
  let baseUrl;

  before(async () => {
    const config = loadEnv({
      CORS_ORIGIN: 'http://localhost:3000,https://admin.gateway.internal'
    });

    const app = createApp({ envConfig: config });
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('allows requests originating from configured allowlist origin', async () => {
    const res = await fetch(`${baseUrl}/api/v1`, {
      headers: {
        Origin: 'http://localhost:3000'
      }
    });

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:3000');
    assert.equal(res.headers.get('access-control-allow-credentials'), 'true');
  });

  test('allows secondary configured origin from comma-separated allowlist', async () => {
    const res = await fetch(`${baseUrl}/api/v1`, {
      headers: {
        Origin: 'https://admin.gateway.internal'
      }
    });

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('access-control-allow-origin'), 'https://admin.gateway.internal');
  });

  test('rejects unapproved browser origins with 403 CORS error', async () => {
    const res = await fetch(`${baseUrl}/api/v1`, {
      headers: {
        Origin: 'http://unauthorized-attacker.site'
      }
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'CORS_ORIGIN_DENIED');
    assert.ok(body.error.message.includes('not permitted by gateway CORS policy'));
  });

  test('handles CORS preflight OPTIONS requests for approved origin', async () => {
    const res = await fetch(`${baseUrl}/api/v1`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3000',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'X-Request-ID'
      }
    });

    assert.ok([200, 204].includes(res.status));
    assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:3000');
    assert.ok(res.headers.get('access-control-allow-methods'));
  });
});
