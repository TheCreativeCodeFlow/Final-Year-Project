/**
 * Server-Side Session Service for Adaptive Deception Gateway.
 *
 * Implements cryptographically secure, database-persisted session management:
 * - 256-bit random entropy per session token.
 * - Explicit expiration timestamp and server-side revocation tracking.
 * - Anti-CSRF token generation paired with the session.
 * - Activity timestamp updates (sliding session support).
 */

import crypto from 'node:crypto';
import { getPrismaClient } from '../db/client.js';

/**
 * Generates a high-entropy cryptographically random session token (64 hex chars).
 * @returns {string}
 */
export function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generates an anti-CSRF token paired to the session.
 * @returns {string}
 */
export function generateCsrfToken() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Creates and persists a new server-side session for an authenticated user.
 *
 * @param {string} userId
 * @param {Object} [options]
 * @param {string} [options.userAgent]
 * @param {string} [options.ipAddress]
 * @param {number} [options.ttlHours=24]
 * @param {import('@prisma/client').PrismaClient} [prisma]
 * @returns {Promise<{ sessionToken: string, csrfToken: string, expiresAt: Date, id: string }>}
 */
export async function createSession(userId, options = {}, prisma = getPrismaClient()) {
  const { userAgent = null, ipAddress = null, ttlHours = 24 } = options;

  const sessionToken = generateSessionToken();
  const csrfToken = generateCsrfToken();
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

  const session = await prisma.session.create({
    data: {
      userId,
      sessionToken,
      csrfToken,
      expiresAt,
      userAgent,
      ipAddress
    }
  });

  return {
    id: session.id,
    sessionToken: session.sessionToken,
    csrfToken: session.csrfToken,
    expiresAt: session.expiresAt
  };
}

/**
 * Validates an active session token, verifying revocation, expiry, and active account status.
 * Updates lastActiveAt timestamp if valid.
 *
 * @param {string} sessionToken
 * @param {import('@prisma/client').PrismaClient} [prisma]
 * @returns {Promise<{ session: object, user: object, memberships: Array } | null>}
 */
export async function validateSession(sessionToken, prisma = getPrismaClient()) {
  if (!sessionToken || typeof sessionToken !== 'string' || sessionToken.length !== 64) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { sessionToken },
    include: {
      user: {
        include: {
          memberships: {
            include: {
              tenant: {
                select: {
                  id: true,
                  identifier: true,
                  displayName: true,
                  status: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!session) {
    return null;
  }

  // 1. Check if session was revoked
  if (session.revokedAt) {
    return null;
  }

  // 2. Check if session expired
  if (new Date() > new Date(session.expiresAt)) {
    return null;
  }

  // 3. Check if user account is disabled or suspended
  if (!session.user || session.user.status !== 'ACTIVE') {
    return null;
  }

  // 4. Update lastActiveAt in background (debounced check if last activity was > 1 min ago)
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
  if (new Date(session.lastActiveAt) < oneMinuteAgo) {
    prisma.session
      .update({
        where: { id: session.id },
        data: { lastActiveAt: new Date() }
      })
      .catch(() => {});
  }

  const { memberships, ...userWithoutMemberships } = session.user;
  // Exclude passwordHash from user object
  const { passwordHash, ...safeUser } = userWithoutMemberships;

  return {
    session: {
      id: session.id,
      sessionToken: session.sessionToken,
      csrfToken: session.csrfToken,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt
    },
    user: safeUser,
    memberships
  };
}

/**
 * Revokes an existing session by setting revokedAt to current timestamp.
 * @param {string} sessionToken
 * @param {import('@prisma/client').PrismaClient} [prisma]
 * @returns {Promise<boolean>}
 */
export async function revokeSession(sessionToken, prisma = getPrismaClient()) {
  if (!sessionToken) return false;

  try {
    await prisma.session.updateMany({
      where: { sessionToken, revokedAt: null },
      data: { revokedAt: new Date() }
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Revokes all active sessions for a given user (e.g. upon password change or account compromise).
 * @param {string} userId
 * @param {import('@prisma/client').PrismaClient} [prisma]
 * @returns {Promise<number>}
 */
export async function revokeAllUserSessions(userId, prisma = getPrismaClient()) {
  if (!userId) return 0;

  const result = await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() }
  });

  return result.count;
}
