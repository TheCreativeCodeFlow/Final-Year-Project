/**
 * Gateway Runtime Server Entrypoint.
 *
 * Starts the isolated reverse proxy HTTP listener and registers graceful shutdown handlers.
 */

import { gatewayConfig } from './config/env.js';
import { createGatewayApp } from './app.js';
import { logger } from './utils/logger.js';

let serverInstance = null;

export function setupGatewayGracefulShutdown(server) {
  let isShuttingDown = false;

  const shutdown = (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info(`Received ${signal}. Gracefully stopping Gateway Runtime HTTP listener...`);

    const forceTimer = setTimeout(() => {
      logger.error('Gateway shutdown timeout exceeded (5000ms). Forcing exit.');
      process.exit(1);
    }, 5000);
    forceTimer.unref();

    server.close((err) => {
      clearTimeout(forceTimer);
      if (err) {
        logger.error('Error during Gateway socket closure', { error: err.message });
        process.exit(1);
      }
      logger.info('Gateway HTTP listener closed cleanly. Exiting process.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception in Gateway Runtime', {
      error: err.message,
      stack: err.stack
    });
    shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection in Gateway Runtime', { reason: String(reason) });
    shutdown('unhandledRejection');
  });
}

export function startGatewayServer() {
  logger.setLogLevel(gatewayConfig.LOG_LEVEL);
  logger.info('Initializing Adaptive Deception Gateway Runtime...', {
    port: gatewayConfig.PORT,
    host: gatewayConfig.HOST,
    managementApiUrl: gatewayConfig.MANAGEMENT_API_URL,
    configuredOrigins: Object.keys(gatewayConfig.TRUSTED_ORIGIN_MAP),
    timeoutMs: gatewayConfig.UPSTREAM_TIMEOUT_MS,
    maxBodyBytes: gatewayConfig.MAX_REQUEST_SIZE_BYTES
  });

  const app = createGatewayApp();

  serverInstance = app.listen(gatewayConfig.PORT, gatewayConfig.HOST, () => {
    logger.info(
      `Gateway Reverse Proxy operational at http://${gatewayConfig.HOST}:${gatewayConfig.PORT}`
    );
    logger.info(
      `Health endpoint: http://${gatewayConfig.HOST}:${gatewayConfig.PORT}/health/live`
    );
  });

  // Client-level HTTP parse error handler (malformed chunks, smuggling attempts)
  serverInstance.on('clientError', (err, socket) => {
    logger.warn('Client HTTP protocol error detected', {
      error: err.message,
      code: err.code
    });
    if (socket.writable) {
      socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Type: text/plain\r\n\r\nBad Request\r\n');
    }
  });

  setupGatewayGracefulShutdown(serverInstance);
  return serverInstance;
}

// Start if executed directly
if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  startGatewayServer();
}
