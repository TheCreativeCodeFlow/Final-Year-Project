import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';

describe('Error Handling Middleware', () => {
  let server;
  let baseUrl;

  before(async () => {
    const config = loadEnv({
      BODY_LIMIT: '10kb' // Set small limit to easily test body overflow
    });

    const app = createApp({
      envConfig: config,
      setupRoutes: (testApp) => {
        testApp.post('/api/v1/test-json-echo', (req, res) => {
          res.json({ success: true, data: req.body, requestId: req.id });
        });

        testApp.get('/api/v1/test-unhandled-crash', () => {
          // Intentionally throw unexpected internal error with sensitive stack trace
          const err = new Error('Database disk storage failure at /var/data/db.sqlite3');
          err.stack = 'SecretInternalStackDump: at /Users/admin/private/db.js:14:2';
          throw err;
        });
      }
    });

    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('unknown route returns controlled JSON 404', async () => {
    const res = await fetch(`${baseUrl}/api/v1/unknown-endpoint-404`);
    assert.equal(res.status, 404);

    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'NOT_FOUND');
    assert.ok(body.error.message.includes('/api/v1/unknown-endpoint-404'));
    assert.ok(body.requestId);
  });

  test('malformed JSON payload returns controlled 400 with INVALID_JSON code', async () => {
    const res = await fetch(`${baseUrl}/api/v1/test-json-echo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: '{"malformed": "json missing brace'
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'INVALID_JSON');
    assert.ok(body.error.message.includes('valid JSON'));
    assert.ok(body.requestId);
  });

  test('oversized request body exceeding BODY_LIMIT returns controlled 413', async () => {
    // Generate payload > 10kb
    const oversizedString = 'x'.repeat(15 * 1024);
    const res = await fetch(`${baseUrl}/api/v1/test-json-echo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ data: oversizedString })
    });

    assert.equal(res.status, 413);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'PAYLOAD_TOO_LARGE');
    assert.ok(body.error.message.includes('maximum allowed size limit'));
    assert.ok(body.requestId);
  });

  test('unexpected internal error returns 500 without leaking stack traces or internal paths', async () => {
    const res = await fetch(`${baseUrl}/api/v1/test-unhandled-crash`);
    assert.equal(res.status, 500);

    const rawText = await res.text();
    // Verify stack traces and filesystem paths are NEVER sent to clients
    assert.equal(rawText.includes('/var/data/db.sqlite3'), false, 'Internal path must not be leaked');
    assert.equal(rawText.includes('SecretInternalStackDump'), false, 'Stack trace must not be leaked');
    assert.equal(rawText.includes('/Users/admin'), false, 'User filesystem path must not be leaked');

    const body = JSON.parse(rawText);
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'INTERNAL_SERVER_ERROR');
    assert.equal(
      body.error.message,
      'An unexpected internal error occurred. Please contact the gateway administrator.'
    );
    assert.ok(body.requestId);
  });
});
