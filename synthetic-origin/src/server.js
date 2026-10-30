/**
 * Synthetic Protected Origin Test Server.
 *
 * Implements a lightweight, isolated upstream service simulating a real protected application:
 * - Responds to standard API paths.
 * - Echoes received headers to verify header sanitization and proxy fidelity.
 * - Provides simulation hooks for latency/timeout and upstream error responses.
 * - Built using zero external dependencies (Node.js standard library only).
 */

import http from 'node:http';

const PORT = Number(process.env.PORT) || 8081;
const HOST = process.env.HOST || '0.0.0.0';

export function createSyntheticOriginServer() {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const method = req.method;

    // Collect request body
    let bodyChunks = [];
    req.on('data', (chunk) => bodyChunks.push(chunk));
    req.on('end', async () => {
      const rawBody = Buffer.concat(bodyChunks).toString();
      let parsedBody = null;
      try {
        if (rawBody && req.headers['content-type']?.includes('application/json')) {
          parsedBody = JSON.parse(rawBody);
        }
      } catch {
        parsedBody = rawBody;
      }

      // 1. Health check
      if (url.pathname === '/health' || url.pathname === '/api/v1/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(
          JSON.stringify({
            status: 'UP',
            service: 'synthetic-protected-origin',
            timestamp: new Date().toISOString()
          })
        );
      }

      // 2. Latency / Timeout simulation
      if (url.pathname.startsWith('/simulate/delay/')) {
        const delayMs = parseInt(url.pathname.split('/simulate/delay/')[1], 10) || 1000;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(
          JSON.stringify({
            message: `Response delayed by ${delayMs}ms`,
            delayMs
          })
        );
      }

      // 3. Error simulation
      if (url.pathname.startsWith('/simulate/error/')) {
        const statusCode = parseInt(url.pathname.split('/simulate/error/')[1], 10) || 500;
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        return res.end(
          JSON.stringify({
            error: 'Simulated Upstream Error',
            statusCode
          })
        );
      }

      // 4. Accounts summary endpoint (matching default application app-01)
      if (url.pathname === '/api/v1/accounts/summary') {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'X-Origin-Service': 'synthetic-accounts-backend',
          'X-Request-Correlation': req.headers['x-request-id'] || 'none'
        });
        return res.end(
          JSON.stringify({
            status: 'success',
            service: 'Customer Accounts API (Synthetic Upstream)',
            accounts: [
              { id: 'acc-10928', type: 'CHECKING', balance: 15420.5, currency: 'USD' },
              { id: 'acc-55829', type: 'INVESTMENT', balance: 98400.0, currency: 'USD' }
            ],
            receivedHeaders: req.headers,
            receivedMethod: method,
            clientIpForwarded: req.headers['x-forwarded-for'] || null
          })
        );
      }

      // 5. Default echo endpoint for any other path
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'X-Origin-Processed': 'true'
      });
      return res.end(
        JSON.stringify({
          message: 'Synthetic Protected Origin Response',
          path: url.pathname,
          method,
          query: Object.fromEntries(url.searchParams.entries()),
          headers: req.headers,
          body: parsedBody || (rawBody ? rawBody : null),
          timestamp: new Date().toISOString()
        })
      );
    });
  });

  return server;
}

// Start if executed directly
if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  const server = createSyntheticOriginServer();
  server.listen(PORT, HOST, () => {
    console.log(`[synthetic-origin] Listening on http://${HOST}:${PORT}`);
  });
}
