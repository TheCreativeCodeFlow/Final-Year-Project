/**
 * Centralized Authentication & Tenant Authorization Middleware.
 *
 * Implements defense-in-depth access controls:
 * 1. authenticate: Validates server-side session token via HttpOnly cookie or Bearer header.
 * 2. requirePlatformAdmin: Enforces explicit platform-wide administrator role.
 * 3. requireRole: Restricts access to specified roles.
 * 4. requireTenantAccess: Resolves tenant context and strictly checks membership;
 *    rejects client-supplied tenant IDs if user is not an authorized member.
 * 5. csrfProtection: Enforces anti-CSRF token verification on state-changing requests.
 */

import { parseCookie } from 'cookie';
import { env } from '../config/env.js';
import { validateSession } from '../services/session.service.js';
import { getPrismaClient } from '../db/client.js';

/**
 * Extracts session token from Cookie header or Authorization Bearer header.
 * @param {import('express').Request} req
 * @returns {string|null}
 */
export function extractSessionToken(req) {
  // 1. Check Bearer Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && typeof authHeader === 'string') {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      return parts[1].trim();
    }
  }

  // 2. Check HttpOnly Cookie
  const cookieHeader = req.headers.cookie;
  if (cookieHeader && typeof cookieHeader === 'string') {
    try {
      const cookies = parseCookie(cookieHeader);
      const cookieName = env.COOKIE_NAME || 'adg_session';
      if (cookies[cookieName]) {
        return cookies[cookieName].trim();
      }
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Authentication middleware: ensures the incoming request presents a valid,
 * non-expired, non-revoked session for an active user.
 */
export async function authenticate(req, res, next) {
  try {
    const token = extractSessionToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required. No valid session token was provided.',
          requestId: req.id || null,
          timestamp: new Date().toISOString()
        }
      });
    }

    const sessionData = await validateSession(token, req.prisma || getPrismaClient());

    if (!sessionData) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_SESSION',
          message: 'The provided session is invalid, expired, or has been revoked.',
          requestId: req.id || null,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Attach validated identity to request context
    req.session = sessionData.session;
    req.user = sessionData.user;
    req.memberships = sessionData.memberships;
    req.isAuthViaCookie = Boolean(req.headers.cookie && !req.headers.authorization);

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Anti-CSRF verification middleware for state-changing HTTP requests.
 * Evaluates cookie-authenticated mutation requests.
 */
export function csrfProtection(req, res, next) {
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase());

  // Only enforce CSRF validation on mutations authenticated via browser cookies
  if (isMutation && req.isAuthViaCookie) {
    const clientCsrfToken =
      req.headers['x-csrf-token'] ||
      (req.body && req.body._csrf);

    if (!clientCsrfToken || clientCsrfToken !== req.session.csrfToken) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'CSRF_TOKEN_INVALID',
          message: 'Invalid or missing anti-CSRF token.',
          requestId: req.id || null,
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  next();
}

/**
 * Authorization middleware: restricts route to Platform Administrators.
 */
export function requirePlatformAdmin(req, res, next) {
  if (!req.user || !req.user.isPlatformAdmin) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Access denied: Requires Platform Administrator privilege.',
        requestId: req.id || null,
        timestamp: new Date().toISOString()
      }
    });
  }

  next();
}

/**
 * Authorization middleware: restricts route to users with at least one matching role.
 * Platform administrators always satisfy role requirements.
 *
 * @param {string[]} allowedRoles
 */
export function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required.',
          requestId: req.id || null,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Platform administrator bypasses role checks by explicit policy
    if (req.user.isPlatformAdmin) {
      return next();
    }

    const userRoles = (req.memberships || []).map((m) => m.role);
    const hasRole = allowedRoles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied: User does not possess the required role.',
          requiredRoles: allowedRoles,
          requestId: req.id || null,
          timestamp: new Date().toISOString()
        }
      });
    }

    next();
  };
}

/**
 * Tenant Scoping Middleware:
 * Resolves the target tenant identifier from URL params, headers, or query string.
 * Strictly verifies that the authenticated user has an active membership in that tenant.
 * Prevents client-supplied tenant IDs from accessing unauthorized tenant boundaries.
 *
 * @param {Object} [options]
 * @param {boolean} [options.optional=false] - If true, does not reject requests that omit a tenant ID.
 */
export function requireTenantAccess(options = {}) {
  const { optional = false } = options;

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required before resolving tenant context.',
          requestId: req.id || null,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Extract target tenant from params, headers, query, or body
    const targetTenantId =
      (req.params && (req.params.tenantId || req.params.tenantIdentifier)) ||
      req.headers['x-tenant-id'] ||
      (req.query && req.query.tenantId) ||
      (req.body && req.body.tenantId);

    if (!targetTenantId) {
      if (optional) {
        return next();
      }
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_TENANT_CONTEXT',
          message: 'A target tenant identifier must be specified.',
          requestId: req.id || null,
          timestamp: new Date().toISOString()
        }
      });
    }

    const cleanTargetId = String(targetTenantId).trim();

    // 1. Platform administrator access via explicit platform policy
    if (req.user.isPlatformAdmin) {
      req.authorizedTenant = {
        identifier: cleanTargetId,
        accessScope: 'PLATFORM_ADMIN_POLICY'
      };
      return next();
    }

    // 2. Tenant membership verification for application owners & analysts
    const matchingMembership = (req.memberships || []).find((m) => {
      return (
        m.tenantId === cleanTargetId ||
        (m.tenant && m.tenant.identifier === cleanTargetId) ||
        (m.tenant && m.tenant.id === cleanTargetId)
      );
    });

    if (!matchingMembership) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'TENANT_ACCESS_DENIED',
          message: 'Access denied: You are not an authorized member of the requested tenant.',
          targetTenant: cleanTargetId,
          requestId: req.id || null,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Attach resolved tenant and authorization details to request
    req.authorizedTenant = matchingMembership.tenant;
    req.tenantMembership = matchingMembership;
    req.tenantRole = matchingMembership.role;
    req.tenantPermissions = matchingMembership.permissions;

    next();
  };
}
