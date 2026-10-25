/**
 * Simulated Authentication Service for Development Prototyping
 * 
 * IMPORTANT: This is a client-side development mock for role switching and 
 * dashboard preview. It provides NO real authentication or security guarantees.
 * Real authentication, token validation, and authorization must be implemented 
 * on the backend in subsequent stages.
 */

const STORAGE_KEY = 'cyber_deception_simulated_auth';

export const ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin'
};

export const MOCK_USERS = {
  [ROLES.OWNER]: {
    id: 'usr-owner-01',
    name: 'Alex Vance',
    email: 'alex.vance@apexfintech.io',
    role: ROLES.OWNER,
    roleTitle: 'Application Owner',
    tenant: 'Apex FinTech Cloud',
    avatarInitials: 'AV',
    permissions: ['view:own_applications', 'manage:own_decoys', 'view:own_telemetry']
  },
  [ROLES.ADMIN]: {
    id: 'usr-admin-01',
    name: 'Sarah Chen',
    email: 'sarah.chen@gateway-admin.internal',
    role: ROLES.ADMIN,
    roleTitle: 'Gateway Administrator',
    tenant: 'Global Gateway Operations',
    avatarInitials: 'SC',
    permissions: ['manage:tenants', 'manage:gateway_cluster', 'manage:deception_runtime', 'view:global_siem']
  }
};

/**
 * Get current authenticated mock user
 * Returns null if not logged in
 */
export const getCurrentUser = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const data = JSON.parse(stored);
    if (data && data.role && MOCK_USERS[data.role]) {
      return MOCK_USERS[data.role];
    }
    return null;
  } catch (err) {
    console.warn('Could not read mock auth session:', err);
    return null;
  }
};

/**
 * Simulate login with a specific persona/role
 */
export const login = (role) => {
  const user = MOCK_USERS[role];
  if (!user) {
    throw new Error(`Invalid mock role: ${role}`);
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ role, loggedInAt: new Date().toISOString() }));
  } catch (err) {
    console.warn('Could not persist mock auth session:', err);
  }
  return user;
};

/**
 * Simulate logout
 */
export const logout = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('Could not clear mock auth session:', err);
  }
};

/**
 * Switch role directly (for development convenience)
 */
export const switchRole = (newRole) => {
  return login(newRole);
};
