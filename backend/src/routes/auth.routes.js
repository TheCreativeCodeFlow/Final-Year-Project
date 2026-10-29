/**
 * Authentication and Authorization Routes.
 * Mount path: /api/v1/auth
 */

import { Router } from 'express';
import {
  login,
  logout,
  getCurrentUser,
  getAuthorizedTenants,
  protectedTestEndpoint
} from '../controllers/auth.controller.js';
import {
  authenticate,
  csrfProtection,
  requireTenantAccess,
  requirePlatformAdmin
} from '../middleware/auth.js';
import { createLoginThrottleMiddleware } from '../middleware/rate-limiter.js';

export const authRouter = Router();

/**
 * POST /api/v1/auth/login
 * Public authentication endpoint with brute-force throttling.
 */
authRouter.post('/login', createLoginThrottleMiddleware(), login);

/**
 * POST /api/v1/auth/logout
 * Terminates session, revokes token in database, and clears cookie.
 */
authRouter.post('/logout', authenticate, csrfProtection, logout);

/**
 * GET /api/v1/auth/me
 * Returns current authenticated identity, safe profile, and active memberships.
 */
authRouter.get('/me', authenticate, getCurrentUser);

/**
 * GET /api/v1/auth/tenants
 * Lists tenants that the authenticated user is authorized to access.
 */
authRouter.get('/tenants', authenticate, getAuthorizedTenants);

/**
 * GET /api/v1/auth/protected-test
 * Verifies authentication and optional tenant membership resolution.
 */
authRouter.get(
  '/protected-test',
  authenticate,
  requireTenantAccess({ optional: true }),
  protectedTestEndpoint
);

/**
 * GET /api/v1/auth/admin-test
 * Verifies explicit Platform Administrator role enforcement.
 */
authRouter.get(
  '/admin-test',
  authenticate,
  requirePlatformAdmin,
  (req, res) => {
    res.status(200).json({
      success: true,
      data: {
        message: 'Platform administrator access verified.',
        user: req.user
      },
      requestId: req.id || null
    });
  }
);
