/**
 * Reusable Centralized HTTP API Client for Adaptive Deception Gateway.
 *
 * Implements security-conscious communication with the Stage 3 backend:
 * - Centralizes API base URL configuration (VITE_API_URL or defaults to http://localhost:4000/api/v1).
 * - Enforces credentials: 'include' for secure HttpOnly cookie session handling.
 * - Manages and automatically attaches anti-CSRF tokens (X-CSRF-Token) on mutation requests.
 * - Standardizes error handling and response unwrapping.
 * - Provides tenant-scoped API methods connecting to the Stage 3D REST API.
 */

let configuredApiBaseUrl =
  (typeof import.meta !== 'undefined' &&
    import.meta.env &&
    import.meta.env.VITE_API_URL) ||
  'http://localhost:4000/api/v1';

let currentCsrfToken = null;
let nodeSessionCookie = null;

export class ApiError extends Error {
  constructor(message, status, code, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Updates base URL for API client (useful for test harnesses or dynamic config).
 * @param {string} url
 */
export function setApiBaseUrl(url) {
  configuredApiBaseUrl = url;
}

/**
 * Returns current API base URL.
 * @returns {string}
 */
export function getApiBaseUrl() {
  return configuredApiBaseUrl;
}

/**
 * Updates stored anti-CSRF token in memory.
 * @param {string|null} token
 */
export function setCsrfToken(token) {
  currentCsrfToken = token;
}

/**
 * Returns currently active anti-CSRF token.
 * @returns {string|null}
 */
export function getCsrfToken() {
  return currentCsrfToken;
}

/**
 * Stores or clears Node.js emulation session cookie.
 * @param {string|null} cookie
 */
export function setNodeSessionCookie(cookie) {
  nodeSessionCookie = cookie;
}

/**
 * Returns currently stored Node session cookie.
 * @returns {string|null}
 */
export function getNodeSessionCookie() {
  return nodeSessionCookie;
}

/**
 * Low-level HTTP fetch wrapper with security baseline headers.
 * @param {string} endpoint - Relative path (e.g. /auth/me or /tenants/tenant-apex-9941/applications)
 * @param {RequestInit} [options]
 * @returns {Promise<any>}
 */
async function request(endpoint, options = {}) {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers = {
    Accept: 'application/json',
    ...options.headers
  };

  if (options.body && typeof options.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }

  // Attach anti-CSRF token on mutations
  const method = (options.method || 'GET').toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && currentCsrfToken) {
    headers['X-CSRF-Token'] = currentCsrfToken;
  }

  // In non-browser environments (e.g. Node test runners), emulate HttpOnly cookie jar
  if (typeof window === 'undefined' && nodeSessionCookie && !headers.Cookie && !headers.cookie) {
    headers.Cookie = nodeSessionCookie;
  }

  const fetchOptions = {
    ...options,
    headers,
    credentials: options.credentials || 'include' // Ensures HttpOnly cookie transmission in browser
  };

  let res;
  try {
    res = await fetch(url, fetchOptions);
  } catch (netErr) {
    throw new ApiError(
      `Network connection to gateway backend failed (${netErr.message}). Is the backend server running on port 4000?`,
      0,
      'NETWORK_ERROR'
    );
  }

  // In non-browser environments, track Set-Cookie from response
  if (typeof window === 'undefined') {
    const rawSetCookie = res.headers.get('set-cookie');
    if (rawSetCookie) {
      const match = rawSetCookie.match(/([^;]+)/);
      if (match) {
        nodeSessionCookie = match[1].trim();
      }
    }
  }

  let body;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const errorInfo = (body && body.error) || {};
    const message = errorInfo.message || `API request failed with status ${res.status}.`;
    const code = errorInfo.code || `HTTP_${res.status}`;
    const details = errorInfo.details || null;
    throw new ApiError(message, res.status, code, details);
  }

  // If response returns csrfToken, remember it
  if (body && body.data && body.data.csrfToken) {
    setCsrfToken(body.data.csrfToken);
  }

  return body;
}

// ------------------------------------------------------------------------------
// Generic HTTP Method Helpers
// ------------------------------------------------------------------------------

export const apiClient = {
  get: (endpoint, options) => request(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, data, options) =>
    request(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data)
    }),
  patch: (endpoint, data, options) =>
    request(endpoint, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(data)
    }),
  put: (endpoint, data, options) =>
    request(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  delete: (endpoint, options) => request(endpoint, { ...options, method: 'DELETE' }),

  // ----------------------------------------------------------------------------
  // Authentication & Identity
  // ----------------------------------------------------------------------------
  login: async (email, password) => {
    const res = await apiClient.post('/auth/login', { email, password });
    if (res.data && res.data.csrfToken) {
      setCsrfToken(res.data.csrfToken);
    }
    return res;
  },

  logout: async () => {
    try {
      return await apiClient.post('/auth/logout', {});
    } finally {
      setCsrfToken(null);
      if (typeof window === 'undefined') {
        nodeSessionCookie = null;
      }
    }
  },

  getCurrentUser: async () => {
    const res = await apiClient.get('/auth/me');
    if (res.data && res.data.csrfToken) {
      setCsrfToken(res.data.csrfToken);
    }
    return res;
  },

  getAuthorizedTenants: async () => {
    return apiClient.get('/auth/tenants');
  },

  // ----------------------------------------------------------------------------
  // Stage 3D: Protected Applications
  // ----------------------------------------------------------------------------
  getApplications: async (tenantId, params = {}) => {
    const query = new URLSearchParams(params).toString();
    const qs = query ? `?${query}` : '';
    return apiClient.get(`/tenants/${tenantId}/applications${qs}`);
  },

  getApplicationById: async (tenantId, applicationId) => {
    return apiClient.get(`/tenants/${tenantId}/applications/${applicationId}`);
  },

  createApplication: async (tenantId, payload) => {
    return apiClient.post(`/tenants/${tenantId}/applications`, payload);
  },

  updateApplication: async (tenantId, applicationId, payload) => {
    return apiClient.patch(`/tenants/${tenantId}/applications/${applicationId}`, payload);
  },

  // ----------------------------------------------------------------------------
  // Stage 3D: Deception Policies
  // ----------------------------------------------------------------------------
  getPolicies: async (tenantId, params = {}) => {
    const query = new URLSearchParams(params).toString();
    const qs = query ? `?${query}` : '';
    return apiClient.get(`/tenants/${tenantId}/policies${qs}`);
  },

  getPolicyById: async (tenantId, policyId) => {
    return apiClient.get(`/tenants/${tenantId}/policies/${policyId}`);
  },

  createPolicy: async (tenantId, payload) => {
    return apiClient.post(`/tenants/${tenantId}/policies`, payload);
  },

  updatePolicy: async (tenantId, policyId, payload) => {
    return apiClient.patch(`/tenants/${tenantId}/policies/${policyId}`, payload);
  },

  // ----------------------------------------------------------------------------
  // Stage 3D: Deception Strategies
  // ----------------------------------------------------------------------------
  getStrategies: async (tenantId, params = {}) => {
    const query = new URLSearchParams(params).toString();
    const qs = query ? `?${query}` : '';
    return apiClient.get(`/tenants/${tenantId}/strategies${qs}`);
  },

  getStrategyById: async (tenantId, strategyId) => {
    return apiClient.get(`/tenants/${tenantId}/strategies/${strategyId}`);
  },

  // ----------------------------------------------------------------------------
  // Stage 3D: Security Events (Observations) & Investigations
  // ----------------------------------------------------------------------------
  getSecurityEvents: async (tenantId, params = {}) => {
    const query = new URLSearchParams(params).toString();
    const qs = query ? `?${query}` : '';
    return apiClient.get(`/tenants/${tenantId}/security-events${qs}`);
  },

  getSecurityEventById: async (tenantId, eventId) => {
    return apiClient.get(`/tenants/${tenantId}/security-events/${eventId}`);
  },

  getInvestigations: async (tenantId, params = {}) => {
    const query = new URLSearchParams(params).toString();
    const qs = query ? `?${query}` : '';
    return apiClient.get(`/tenants/${tenantId}/investigations${qs}`);
  },

  getInvestigationById: async (tenantId, investigationId) => {
    return apiClient.get(`/tenants/${tenantId}/investigations/${investigationId}`);
  },

  // ----------------------------------------------------------------------------
  // Stage 3F: Attacker Behavior Profiles
  // ----------------------------------------------------------------------------
  getAttackerProfiles: async (tenantId, params = {}) => {
    const query = new URLSearchParams(params).toString();
    const qs = query ? `?${query}` : '';
    return apiClient.get(`/tenants/${tenantId}/attacker-profiles${qs}`);
  },

  getAttackerProfileById: async (tenantId, profileId) => {
    return apiClient.get(`/tenants/${tenantId}/attacker-profiles/${profileId}`);
  }
};

export default apiClient;
