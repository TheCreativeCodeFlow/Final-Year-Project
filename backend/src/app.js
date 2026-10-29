import express from 'express';
import cors from 'cors';
import { env as defaultEnv } from './config/env.js';
import { logger } from './utils/logger.js';
import { securityHeadersMiddleware } from './middleware/security-headers.js';
import { requestIdMiddleware } from './middleware/request-id.js';
import { notFoundMiddleware } from './middleware/not-found.js';
import { errorHandlerMiddleware } from './middleware/error-handler.js';
import { healthRouter } from './routes/health.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { tenantRouter } from './routes/tenant.routes.js';
import { getApiInfo } from './controllers/health.controller.js';

/**
 * Creates and configures the Express application.
 * Kept separate from network socket binding so test runners can import the app directly.
 * 
 * @param {object} [options]
 * @param {object} [options.envConfig]
 * @returns {import('express').Express}
 */
export function createApp(options = {}) {
  const config = options.envConfig || defaultEnv;
  const app = express();

  // 1. Disable technology fingerprinting
  app.disable('x-powered-by');

  // 2. Security Headers Baseline
  app.use(securityHeadersMiddleware);

  // 3. Explicit Origin Allowlist CORS
  const corsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. server-to-server, curl, mobile apps)
      if (!origin) {
        return callback(null, true);
      }

      const isAllowed = config.CORS_ORIGIN.some((allowed) => {
        return allowed === origin;
      });

      if (isAllowed) {
        return callback(null, true);
      }

      return callback(new Error(`CORS policy rejection: Origin '${origin}' is not permitted.`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-CSRF-Token',
      'X-Tenant-ID',
      'X-Request-ID',
      'X-Correlation-ID',
      'Accept'
    ],
    exposedHeaders: ['X-Request-ID', 'Retry-After'],
    credentials: true,
    maxAge: 86400
  };
  app.use(cors(corsOptions));

  // 4. Request Correlation ID
  app.use(requestIdMiddleware);

  // 5. Structured HTTP Request Logging
  app.use((req, res, next) => {
    const startTime = process.hrtime.bigint();

    res.on('finish', () => {
      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1e6;

      logger.logHttpRequest({
        requestId: req.id,
        method: req.method,
        path: req.originalUrl || req.url,
        status: res.statusCode,
        durationMs,
        clientIp: req.ip || req.socket.remoteAddress
      });
    });

    next();
  });

  // 6. Request Body Parsing with conservative limit
  app.use(express.json({ limit: config.BODY_LIMIT }));

  // Prisma client injection hook (e.g. for test harnesses)
  if (options.prisma) {
    app.use((req, res, next) => {
      req.prisma = options.prisma;
      next();
    });
  }

  // 7. API Routes (Versioned: /api/v1)
  app.get('/api/v1', getApiInfo);
  app.use('/api/v1/health', healthRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/tenants/:tenantId', tenantRouter);

  // Optional route extension hook (e.g. for testing specific failure states)
  if (typeof options.setupRoutes === 'function') {
    options.setupRoutes(app);
  }

  // 8. Unmapped Routes Handler
  app.use(notFoundMiddleware);

  // 9. Centralized Error Handler
  app.use(errorHandlerMiddleware);

  return app;
}

export const app = createApp();
