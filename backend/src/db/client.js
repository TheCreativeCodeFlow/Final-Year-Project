/**
 * PostgreSQL Database Access Module via Prisma ORM.
 *
 * Provides controlled client instantiation, lazy connection, transaction helpers,
 * and error masking so Prisma internals and connection secrets are never leaked.
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';

let defaultClient = null;

/**
 * Validates whether the given string is a valid PostgreSQL URL format.
 * @param {string|undefined} url
 * @returns {boolean}
 */
export function isValidPostgresUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return false;
  return /^postgres(ql)?:\/\/[^:]+(:[^@]*)?@[^:]+:\d+\/[^\s?#]+(\?.*)?$/i.test(url.trim()) ||
         /^postgres(ql)?:\/\/[^@\s/]+@[^:]+:\d+\/[^\s?#]+(\?.*)?$/i.test(url.trim()) ||
         /^postgres(ql)?:\/\/localhost:\d+\/[^\s?#]+(\?.*)?$/i.test(url.trim());
}

/**
 * Returns a configured PrismaClient singleton or creates an injected test client.
 * Does NOT open a connection on invocation (lazy connection).
 *
 * @param {Object} [options]
 * @param {string} [options.databaseUrl] - Optional override connection URL.
 * @param {boolean} [options.forceNew] - Force instantiation of a distinct client (useful for isolation tests).
 * @returns {PrismaClient}
 */
export function getPrismaClient(options = {}) {
  const { databaseUrl, forceNew = false } = options;

  if (forceNew) {
    const customUrl = databaseUrl || process.env.DATABASE_URL;
    return new PrismaClient({
      datasources: customUrl ? { db: { url: customUrl } } : undefined,
      log: process.env.LOG_LEVEL === 'debug' ? ['query', 'error', 'warn'] : ['error']
    });
  }

  if (!defaultClient) {
    const url = databaseUrl || process.env.DATABASE_URL;
    defaultClient = new PrismaClient({
      datasources: url ? { db: { url } } : undefined,
      log: process.env.LOG_LEVEL === 'debug' ? ['query', 'error', 'warn'] : ['error']
    });
  }

  return defaultClient;
}

/**
 * Verifies and establishes an active database socket connection.
 * @param {PrismaClient} [client]
 * @returns {Promise<boolean>}
 */
export async function connectDatabase(client = getPrismaClient()) {
  try {
    await client.$connect();
    await client.$queryRaw`SELECT 1`;
    logger.info('Database connection established successfully with PostgreSQL');
    return true;
  } catch (err) {
    logger.error('Failed to establish connection to PostgreSQL', {
      errorName: err.name,
      errorMessage: err.message
    });
    throw err;
  }
}

/**
 * Gracefully disconnects Prisma client and frees database connection pool.
 * @param {PrismaClient} [client]
 * @returns {Promise<void>}
 */
export async function disconnectDatabase(client = defaultClient) {
  if (client) {
    try {
      await client.$disconnect();
      if (client === defaultClient) {
        defaultClient = null;
      }
      logger.info('Database client disconnected cleanly.');
    } catch (err) {
      logger.error('Error during database disconnection', {
        errorName: err.name,
        errorMessage: err.message
      });
    }
  }
}

/**
 * Executes a callback within an interactive Prisma transaction.
 * Automatically rolls back writes if any step fails.
 *
 * @template T
 * @param {(tx: import('@prisma/client').Prisma.TransactionClient) => Promise<T>} transactionFn
 * @param {PrismaClient} [client]
 * @returns {Promise<T>}
 */
export async function executeInTransaction(transactionFn, client = getPrismaClient()) {
  return client.$transaction(async (tx) => {
    return transactionFn(tx);
  });
}

/**
 * Checks whether the DATABASE_URL environment variable is set.
 * @returns {boolean}
 */
export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim());
}
