import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { authService, ROLES, ROLE_LABELS } from '../services/authService';

const AuthContext = createContext(null);
const ACTIVE_TENANT_PREF_KEY = 'adg_active_tenant_id';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [authorizedTenants, setAuthorizedTenants] = useState([]);
  const [activeTenant, setActiveTenant] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [backendAvailable, setBackendAvailable] = useState(true);

  /**
   * Helper to resolve active tenant from authorized list and user preferences.
   */
  const resolveActiveTenant = useCallback((tenantsList, defaultTenant) => {
    if (!tenantsList || tenantsList.length === 0) {
      return defaultTenant || null;
    }

    try {
      const preferredId = sessionStorage.getItem(ACTIVE_TENANT_PREF_KEY);
      if (preferredId) {
        const found = tenantsList.find(
          (t) =>
            (t.tenant && (t.tenant.identifier === preferredId || t.tenant.id === preferredId)) ||
            t.identifier === preferredId ||
            t.id === preferredId
        );
        if (found) {
          return found.tenant || found;
        }
      }
    } catch {
      // Ignore sessionStorage errors
    }

    // Default to the first available authorized tenant
    const first = tenantsList[0];
    return first.tenant || first;
  }, []);

  /**
   * Loads authorized tenants and sets active tenant context.
   */
  const loadAuthorizedTenants = useCallback(async (membershipsList, fallbackTenant) => {
    try {
      const tenantData = await authService.getAuthorizedTenants();
      const list = tenantData.tenants || [];
      setAuthorizedTenants(list);
      const chosen = resolveActiveTenant(list, fallbackTenant);
      setActiveTenant(chosen);
      return list;
    } catch {
      // Fallback to memberships if /auth/tenants endpoint fails
      const fallbackList = (membershipsList || []).map((m) => ({
        tenant: m.tenant,
        role: m.role,
        permissions: m.permissions
      }));
      setAuthorizedTenants(fallbackList);
      const chosen = resolveActiveTenant(fallbackList, fallbackTenant);
      setActiveTenant(chosen);
      return fallbackList;
    }
  }, [resolveActiveTenant]);

  /**
   * Restores session on initial application mount.
   */
  useEffect(() => {
    let isMounted = true;

    async function initSession() {
      setIsLoading(true);
      setAuthError(null);

      try {
        const sessionData = await authService.restoreSession();

        if (!isMounted) return;

        if (sessionData && sessionData.user) {
          setUser(sessionData.user);
          setRole(sessionData.role);
          setMemberships(sessionData.memberships || []);

          const defaultTenant = sessionData.memberships?.[0]?.tenant || null;
          await loadAuthorizedTenants(sessionData.memberships, defaultTenant);
          setBackendAvailable(true);
        } else {
          // No active session
          setUser(null);
          setRole(null);
          setMemberships([]);
          setAuthorizedTenants([]);
          setActiveTenant(null);
        }
      } catch (err) {
        if (!isMounted) return;
        if (err.code === 'NETWORK_ERROR' || err.status === 0) {
          setBackendAvailable(false);
          setAuthError('Unable to connect to gateway backend server. Is the backend running on port 4000?');
        } else {
          setAuthError(err.message || 'Failed to validate server session.');
        }
        setUser(null);
        setRole(null);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initSession();

    return () => {
      isMounted = false;
    };
  }, [loadAuthorizedTenants]);

  /**
   * Authenticates user against backend POST /api/v1/auth/login.
   */
  const login = useCallback(async (email, password) => {
    setIsLoading(true);
    setAuthError(null);

    try {
      const result = await authService.login(email, password);
      setUser(result.user);
      setRole(result.role);
      setMemberships(result.memberships || []);
      setBackendAvailable(true);

      const defaultTenant = result.memberships?.[0]?.tenant || null;
      await loadAuthorizedTenants(result.memberships, defaultTenant);

      return result;
    } catch (err) {
      if (err.code === 'NETWORK_ERROR' || err.status === 0) {
        setBackendAvailable(false);
      }
      setAuthError(err.message || 'Authentication failed.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [loadAuthorizedTenants]);

  /**
   * Logs out user through backend POST /api/v1/auth/logout.
   */
  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await authService.logout();
    } finally {
      setUser(null);
      setRole(null);
      setMemberships([]);
      setAuthorizedTenants([]);
      setActiveTenant(null);
      setAuthError(null);
      setIsLoading(false);
      try {
        sessionStorage.removeItem(ACTIVE_TENANT_PREF_KEY);
      } catch {
        // Ignore storage errors
      }
    }
  }, []);

  /**
   * Switches active tenant to one of the authorized tenants.
   */
  const switchTenant = useCallback((tenantIdentifierOrId) => {
    if (!tenantIdentifierOrId) return false;

    const target = authorizedTenants.find(
      (item) =>
        (item.tenant && (item.tenant.identifier === tenantIdentifierOrId || item.tenant.id === tenantIdentifierOrId)) ||
        item.identifier === tenantIdentifierOrId ||
        item.id === tenantIdentifierOrId
    );

    if (target) {
      const selected = target.tenant || target;
      setActiveTenant(selected);
      try {
        sessionStorage.setItem(ACTIVE_TENANT_PREF_KEY, selected.identifier || selected.id);
      } catch {
        // Ignore storage errors
      }
      return true;
    }

    return false;
  }, [authorizedTenants]);

  /**
   * Refreshes active session identity and memberships from server.
   */
  const refreshSession = useCallback(async () => {
    try {
      const sessionData = await authService.restoreSession();
      if (sessionData && sessionData.user) {
        setUser(sessionData.user);
        setRole(sessionData.role);
        setMemberships(sessionData.memberships || []);
        await loadAuthorizedTenants(sessionData.memberships, activeTenant);
      }
    } catch {
      // Non-fatal on background refresh
    }
  }, [activeTenant, loadAuthorizedTenants]);

  // Derived user display details
  const userProfile = useMemo(() => {
    if (!user) return null;

    const initials = (user.name || user.email || 'U')
      .split(' ')
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    const roleTitle = role ? ROLE_LABELS[role] : (user.isPlatformAdmin ? 'Platform Administrator' : 'Tenant Member');

    return {
      ...user,
      initials,
      roleTitle,
      tenantDisplayName: activeTenant?.displayName || 'Global Operations'
    };
  }, [user, role, activeTenant]);

  const value = {
    user: userProfile,
    rawUser: user,
    role,
    memberships,
    authorizedTenants,
    activeTenant,
    isAuthenticated: Boolean(user),
    isLoading,
    authError,
    backendAvailable,
    login,
    logout,
    switchTenant,
    refreshSession,
    ROLES,
    ROLE_LABELS
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
