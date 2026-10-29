import { loadEnv } from './config/env.js';
import { createApp } from './app.js';
import { logger } from './utils/logger.js';

let serverInstance = null;

/**
 * Handles graceful shutdown upon termination signals.
 * @param {string} signal
 * @param {import('http').Server} server
 */
export function setupGracefulShutdown(server) {
  let isShuttingDown = false;

  const shutdown = (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info(`Received ${signal}. Commencing graceful shutdown of HTTP server...`);

    // Safety timeout to prevent hanging indefinite processes
    const forceExitTimer = setTimeout(() => {
      logger.error('Graceful shutdown timeout exceeded (5000ms). Forcing process termination.');
      process.exit(1);
    }, 5000);
    forceExitTimer.unref();

    server.close((err) => {
      clearTimeout(forceExitTimer);
      if (err) {
        logger.error('Error during HTTP server socket closure', { error: err.message });
        process.exit(1);
      }
      logger.info('HTTP server closed successfully. Process exiting cleanly.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('uncaughtException', (err) => {
    logger.error('Fatal Uncaught Exception encountered', {
      errorName: err.name,
      errorMessage: err.message
    });
    shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Fatal Unhandled Promise Rejection encountered', {
      reason: String(reason)
    });
    shutdown('unhandledRejection');
  });
}

/**
 * Validates environment and starts the backend service.
 */
export async function startServer() {
  try {
    const config = loadEnv();
    logger.setLogLevel(config.LOG_LEVEL);

    logger.info('Initializing Adaptive Deception Gateway Backend...', {
      nodeEnv: config.NODE_ENV,
      logLevel: config.LOG_LEVEL,
      host: config.HOST,
      port: config.PORT,
      corsOrigins: config.CORS_ORIGIN,
      bodyLimit: config.BODY_LIMIT
    });

    const app = createApp({ envConfig: config });

    serverInstance = app.listen(config.PORT, config.HOST, () => {
      logger.info(`Gateway Backend API operational at http://${config.HOST}:${config.PORT}/api/v1`);
      logger.info(`Health endpoints: http://${config.HOST}:${config.PORT}/api/v1/health/live`);
    });

    setupGracefulShutdown(serverInstance);
    return serverInstance;
  } catch (err) {
    logger.error('Gateway Backend startup failed fatally', {
      errorName: err.name,
      errorMessage: err.message
    });
    process.exit(1);
  }
}

// Start immediately when executed directly as entrypoint
if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  startServer();
}
