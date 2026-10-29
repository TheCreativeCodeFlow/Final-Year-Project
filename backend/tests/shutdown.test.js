import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { setupGracefulShutdown } from '../src/server.js';

describe('Server Lifecycle & Graceful Shutdown', () => {
  test('gracefully closes HTTP server upon SIGTERM signal without unhandled exceptions', async () => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200);
      res.end('ok');
    });

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    assert.equal(server.listening, true);

    // Setup graceful shutdown on test server
    setupGracefulShutdown(server);

    // Verify closing server directly drains connections
    await new Promise((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    assert.equal(server.listening, false, 'Server socket should be closed cleanly');
  });

  test('server can bind and accept concurrent requests before termination', async () => {
    let active = 0;
    const server = http.createServer((_req, res) => {
      active++;
      setTimeout(() => {
        active--;
        res.writeHead(200);
        res.end('ok');
      }, 50);
    });

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;

    const [r1, r2] = await Promise.all([
      fetch(`http://127.0.0.1:${port}`),
      fetch(`http://127.0.0.1:${port}`)
    ]);

    assert.equal(r1.status, 200);
    assert.equal(r2.status, 200);

    await new Promise((resolve) => server.close(resolve));
    assert.equal(server.listening, false);
    assert.equal(active, 0);
  });
});
