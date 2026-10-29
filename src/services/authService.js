/**
 * Centralized Authentication Service for Adaptive Deception Gateway.
 *
 * Implements Stage 3E frontend authentication connecting to Stage 3C backend endpoints:
 * - Directs authentication through apiClient using HttpOnly cookie sessions.
 * - ZERO storage of passwords, bearer tokens, or session tokens in localStorage/sessionStorage.
 * - Single in-flight session restoration promise to prevent race conditions on page refresh.
 * - Enforces server-authoritative role and tenant resolution.
 * - Handles expired, revoked, inactive, or suspended account responses gracefully.
 */

import { apiClient, setCsrfToken, ApiError } from './apiClient.js';

export const ROLES = {
  ADMIN: 'admin',
  OWNER: 'owner',
  ANALYST: 'analyst'
};

export const ROLE_LABELS = {
  [ROLES.ADMIN]: 'Platform Administrator',
  [ROLES.OWNER]: 'Application Owner',
  [ROLES.ANALYST]: 'Security Analyst'
};

/**
 * Derives primary platform/tenant role from verified backend identity and memberships.
 * The backend is the sole authority; roles are NEVER inferred from email or client state.
 *
 * @param {Object|null} user - Safe user object from server
 * @param {Array} memberships - Tenant memberships from server
 * @returns {string|null} - 'admin', 'owner', 'analyst', or null
 */
export function deriveRole(user, memberships = []) {
  if (!user) return null;

  // 1. Platform administrator has global operational scope
  if (user.isPlatformAdmin === true) {
    return ROLES.ADMIN;
  }

  // 2. Tenant memberships determine scoped roles
  const roles = (memberships || []).map((m) => m.role);
  if (roles.includes('APPLICATION_OWNER')) {
    return ROLES.OWNER;
  }
  if (roles.includes('SECURITY_ANALYST')) {
    return ROLES.ANALYST;
  }

  return null;
}

// In-flight singleton promise to prevent duplicate session restoration calls
let sessionRestorePromise = null;

export const authService = {
  /**
   * Authenticates user against backend POST /api/v1/auth/login.
   *
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{ user: Object, memberships: Array, session: Object, csrfToken: string, role: string }>}
   */
  login: async (email, password) => {
    if (!email || !password) {
      throw new ApiError('Email and password are required.', 400, 'INVALID_INPUT');
    }

    const trimmedEmail = email.trim().toLowerCase();
    const response = await apiClient.login(trimmedEmail, password);

    if (!response || !response.success || !response.data) {
      throw new ApiError('Unexpected login response from authentication service.', 500, 'AUTH_ERROR');
    }

    const { user, memberships = [], session, csrfToken } = response.data;
    const role = deriveRole(user, memberships);

    return {
      user,
      memberships,
      session,
      csrfToken,
      role
    };
  },

  /**
   * Restores session state from backend GET /api/v1/auth/me using HttpOnly cookie.
   * Deduplicates concurrent calls so only one request hits the network on load.
   *
   * @returns {Promise<{ user: Object, memberships: Array, session: Object, csrfToken: string, role: string }|null>}
   */
  restoreSession: async () => {
    if (sessionRestorePromise) {
      return sessionRestorePromise;
    }

    sessionRestorePromise = (async () => {
      try {
        const response = await apiClient.getCurrentUser();
        if (response && response.success && response.data && response.data.user) {
          const { user, memberships = [], session, csrfToken } = response.data;
          const role = deriveRole(user, memberships);
          return {
            user,
            memberships,
            session,
            csrfToken,
            role
          };
        }
        return null;
      } catch (err) {
        // If 401 UNAUTHENTICATED or INVALID_SESSION, user is not logged in
        if (err.status === 401) {
          setCsrfToken(null);
          return null;
        }
        // Network error or server 500: rethrow so consumer can report network failure
        throw err;
      } finally {
        sessionRestorePromise = null;
      }
    })();

    return sessionRestorePromise;
  },

  /**
   * Retrieves user's authorized tenants from GET /api/v1/auth/tenants.
   *
   * @returns {Promise<{ accessScope: string, tenants: Array }>}
   */
  getAuthorizedTenants: async () => {
    const res = await apiClient.getAuthorizedTenants();
    return res && res.data ? res.data : { accessScope: 'NONE', tenants: [] };
  },

  /**
   * Logs out user through backend POST /api/v1/auth/logout.
   * Revokes database session, clears cookie, and invalidates in-memory anti-CSRF token.
   * Guarantees client state clearing even if the server call fails.
   *
   * @returns {Promise<{ success: boolean, serverRevoked: boolean, error?: string }>}
   */
  logout: async () => {
    let serverRevoked = false;
    let error = null;

    try {
      const res = await apiClient.logout();
      serverRevoked = Boolean(res && res.success);
    } catch (err) {
      // Backend may return 401 if session is already expired or missing; that's acceptable on logout
      error = err.message || 'Logout call failed on backend.';
    } finally {
      // Always clear client-side anti-CSRF token
      setCsrfToken(null);
    }

    return {
      success: true,
      serverRevoked,
      error
    };
  }
};

export default authService;
