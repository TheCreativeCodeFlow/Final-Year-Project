import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

describe('Health and API Identity Endpoints', () => {
  let app;
  let server;
  let baseUrl;

  before(async () => {
    // 1. App initialization without binding to a fixed network port
    app = createApp();
    assert.ok(app, 'Application instance created successfully without socket binding');

    // Bind to ephemeral port for HTTP assertions
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('GET /api/v1/health/live returns successful liveness response', async () => {
    const res = await fetch(`${baseUrl}/api/v1/health/live`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'alive');
    assert.ok(typeof body.data.timestamp === 'string');
    assert.ok(typeof body.data.uptimeSeconds === 'number');
    assert.ok(body.requestId, 'requestId must be present in response');
  });

  test('GET /api/v1/health/ready reports accurate readiness without nonexistent dependencies', async () => {
    const res = await fetch(`${baseUrl}/api/v1/health/ready`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'ready');
    assert.equal(body.data.components.httpServer, 'ready');
    assert.equal(body.data.components.runtime, 'ready');

    // Must NOT claim that database or ML models are ready
    assert.equal(body.data.components.database, undefined);
    assert.equal(body.data.components.detectionEngine, undefined);
    assert.equal(body.data.components.reverseProxy, undefined);

    // Explicitly states baseline scope notice
    assert.ok(body.data.notice.includes('Stage 3A baseline'));
    assert.ok(body.requestId);
  });

  test('GET /api/v1 returns public API identity and version without disclosing environment secrets', async () => {
    const res = await fetch(`${baseUrl}/api/v1`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.name, 'Adaptive Deception Gateway API');
    assert.equal(body.data.version, '1.0.0');
    assert.equal(body.data.stage, '3A');
    assert.equal(body.data.status, 'operational');

    // Disclosing sensitive environment variables is strictly prohibited
    assert.equal(body.data.env, undefined);
    assert.equal(body.data.process, undefined);
    assert.equal(body.data.secrets, undefined);
    assert.ok(body.requestId);
  });
});
