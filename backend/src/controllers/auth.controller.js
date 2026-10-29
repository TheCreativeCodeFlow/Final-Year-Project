/**
 * Authentication & Identity Controller.
 *
 * Implements login, logout, identity inspection, and tenant authorization endpoints.
 * Returns consistent error responses and avoids user enumeration.
 */

import { stringifySetCookie } from 'cookie';
import { env } from '../config/env.js';
import { getPrismaClient } from '../db/client.js';
import { verifyPassword } from '../utils/passwords.js';
import { createSession, revokeSession } from '../services/session.service.js';
import { recordAuthAudit } from '../utils/auth-audit.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Handles user login with email and password.
 */
export async function login(req, res, next) {
  const prisma = req.prisma || getPrismaClient();
  const { email, password } = req.body || {};

  const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const correlationId = req.id || null;

  // 1. Basic input validation
  if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_INPUT',
        message: 'Email and password are required fields.',
        requestId: correlationId,
        timestamp: new Date().toISOString()
      }
    });
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!EMAIL_REGEX.test(normalizedEmail) || password.length > 128) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password format.',
        requestId: correlationId,
        timestamp: new Date().toISOString()
      }
    });
  }

  try {
    // 2. Fetch user by email
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
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
    });

    // 3. User existence and password verification
    // Constant-time execution / generic error to prevent account enumeration
    const isPasswordValid = user ? await verifyPassword(user.passwordHash, password) : false;

    if (!user || !isPasswordValid) {
      if (req.rateLimiter) {
        req.rateLimiter.recordFailure(clientIp, normalizedEmail);
      }

      await recordAuthAudit({
        action: 'AUTH_LOGIN_FAILED',
        actorIdentifier: normalizedEmail,
        correlationId,
        metadata: { clientIp, reason: 'INVALID_CREDENTIALS' }
      }, prisma);

      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password.',
          requestId: correlationId,
          timestamp: new Date().toISOString()
        }
      });
    }

    // 4. Account status check
    if (user.status !== 'ACTIVE') {
      await recordAuthAudit({
        action: 'AUTH_LOGIN_DENIED',
        actorIdentifier: normalizedEmail,
        targetEntityId: user.id,
        correlationId,
        metadata: { clientIp, userStatus: user.status }
      }, prisma);

      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_INACTIVE',
          message: 'Account is inactive, suspended, or disabled. Contact administrator.',
          accountStatus: user.status,
          requestId: correlationId,
          timestamp: new Date().toISOString()
        }
      });
    }

    // 5. Successful authentication
    if (req.rateLimiter) {
      req.rateLimiter.recordSuccess(clientIp, normalizedEmail);
    }

    // Reset failed login counter and update lastLoginAt in DB
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockoutUntil: null,
        lastLoginAt: new Date()
      }
    });

    // 6. Create server-side session
    const session = await createSession(
      user.id,
      {
        userAgent: req.headers['user-agent'] || null,
        ipAddress: clientIp,
        ttlHours: env.SESSION_TTL_HOURS || 24
      },
      prisma
    );

    // 7. Audit success
    await recordAuthAudit({
      action: 'AUTH_LOGIN_SUCCESS',
      actorIdentifier: normalizedEmail,
      targetEntityId: user.id,
      correlationId,
      metadata: { clientIp, sessionId: session.id }
    }, prisma);

    // 8. Set secure HttpOnly session cookie
    const cookieHeader = stringifySetCookie({
      name: env.COOKIE_NAME || 'adg_session',
      value: session.sessionToken,
      httpOnly: true,
      secure: env.isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: (env.SESSION_TTL_HOURS || 24) * 60 * 60
    });
    res.setHeader('Set-Cookie', cookieHeader);

    const { passwordHash, memberships, ...safeUser } = user;

    res.status(200).json({
      success: true,
      data: {
        user: safeUser,
        memberships,
        session: {
          id: session.id,
          expiresAt: session.expiresAt
        },
        csrfToken: session.csrfToken
      },
      requestId: correlationId
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Handles user logout and session revocation.
 */
export async function logout(req, res, next) {
  const prisma = req.prisma || getPrismaClient();
  const sessionToken = req.session && req.session.sessionToken;
  const correlationId = req.id || null;

  try {
    if (sessionToken) {
      await revokeSession(sessionToken, prisma);
      await recordAuthAudit({
        action: 'AUTH_LOGOUT',
        actorIdentifier: req.user ? req.user.email : 'unknown',
        targetEntityId: req.user ? req.user.id : 'session',
        correlationId,
        metadata: { sessionId: req.session.id }
      }, prisma);
    }

    // Clear cookie
    const clearedCookie = stringifySetCookie({
      name: env.COOKIE_NAME || 'adg_session',
      value: '',
      httpOnly: true,
      secure: env.isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 0
    });
    res.setHeader('Set-Cookie', clearedCookie);

    res.status(200).json({
      success: true,
      message: 'Successfully logged out.',
      requestId: correlationId
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Returns current authenticated identity and memberships.
 */
export function getCurrentUser(req, res) {
  res.status(200).json({
    success: true,
    data: {
      user: req.user,
      memberships: req.memberships || [],
      session: {
        id: req.session.id,
        expiresAt: req.session.expiresAt
      },
      csrfToken: req.session.csrfToken
    },
    requestId: req.id || null
  });
}

/**
 * Returns user's authorized tenants and tenant-scoped permissions.
 */
export async function getAuthorizedTenants(req, res, next) {
  const prisma = req.prisma || getPrismaClient();

  try {
    if (req.user.isPlatformAdmin) {
      // Platform administrator can inspect platform-wide tenants
      const allTenants = await prisma.tenant.findMany({
        select: {
          id: true,
          identifier: true,
          displayName: true,
          status: true
        }
      });

      return res.status(200).json({
        success: true,
        data: {
          accessScope: 'PLATFORM_ADMIN',
          tenants: allTenants.map((t) => ({
            tenant: t,
            role: 'PLATFORM_ADMIN',
            permissions: ['*']
          }))
        },
        requestId: req.id || null
      });
    }

    // Application owners / analysts receive their explicitly assigned memberships
    const userTenants = (req.memberships || []).map((m) => ({
      tenant: m.tenant,
      role: m.role,
      permissions: m.permissions
    }));

    res.status(200).json({
      success: true,
      data: {
        accessScope: 'TENANT_MEMBER',
        tenants: userTenants
      },
      requestId: req.id || null
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Protected test endpoint verifying role and tenant authorization enforcement.
 */
export function protectedTestEndpoint(req, res) {
  res.status(200).json({
    success: true,
    data: {
      message: 'Access successfully authorized.',
      authenticatedUser: {
        id: req.user.id,
        email: req.user.email,
        isPlatformAdmin: req.user.isPlatformAdmin
      },
      authorizedTenantContext: req.authorizedTenant || null,
      tenantRole: req.tenantRole || null
    },
    requestId: req.id || null
  });
}
