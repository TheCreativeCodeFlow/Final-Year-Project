/**
 * Stage 6 Isolated Synthetic Runtime & Protected Origin Harness.
 *
 * Hosts isolated HTTP loopback instances faithfully matching:
 *  1. `synthetic-service/server.js` (SyntheticStateStore + dynamic routes, users, schemas, credentials, rollback)
 *  2. Simulated Protected Origin Application (receives BENIGN and DEFER_WITH_UNCERTAINTY requests cleanly)
 *
 * Ensures all comparative evaluations run real TCP loopback HTTP traffic against
 * equivalent initial environments under controlled-lab isolation.
 */

import http from 'node:http';
import { INITIAL_SYNTHETIC_STATE } from './stage6-scenario-suite.js';

export class IsolatedSyntheticStateStore {
  constructor(initialState = INITIAL_SYNTHETIC_STATE) {
    this.graphVersion = initialState.graphVersion || 1;
    this.users = JSON.parse(JSON.stringify(initialState.users));
    this.accounts = JSON.parse(JSON.stringify(initialState.accounts));
    this.customers = JSON.parse(JSON.stringify(initialState.customers));
    this.schemas = JSON.parse(JSON.stringify(initialState.schemas));
    this.routes = [];
    this.credentials = [];
    this.activeServices = new Set(initialState.activeServices || ['SYNTHETIC_API', 'SYNTHETIC_AUTH', 'SYNTHETIC_DATA']);
    this.snapshots = new Map();
    this.saveSnapshot(this.graphVersion);
  }

  saveSnapshot(version) {
    this.snapshots.set(String(version), {
      graphVersion: version,
      users: JSON.parse(JSON.stringify(this.users)),
      accounts: JSON.parse(JSON.stringify(this.accounts)),
      customers: JSON.parse(JSON.stringify(this.customers)),
      schemas: JSON.parse(JSON.stringify(this.schemas)),
      routes: JSON.parse(JSON.stringify(this.routes)),
      credentials: JSON.parse(JSON.stringify(this.credentials)),
      activeServices: Array.from(this.activeServices)
    });
  }

  restoreSnapshot(version) {
    const snap = this.snapshots.get(String(version));
    if (!snap) return false;
    this.graphVersion = snap.graphVersion;
    this.users = JSON.parse(JSON.stringify(snap.users));
    this.accounts = JSON.parse(JSON.stringify(snap.accounts));
    this.customers = JSON.parse(JSON.stringify(snap.customers));
    this.schemas = JSON.parse(JSON.stringify(snap.schemas));
    this.routes = JSON.parse(JSON.stringify(snap.routes));
    this.credentials = JSON.parse(JSON.stringify(snap.credentials));
    this.activeServices = new Set(snap.activeServices);
    return true;
  }

  applyMutation({ mutationType, operation, payload = {}, targetGraphVersion }) {
    this.saveSnapshot(this.graphVersion);

    switch (mutationType) {
      case 'IDENTITY_MUTATION': {
        if (operation === 'ADD_SYNTHETIC_USER') {
          const user = {
            id: payload.id || `usr-syn-${this.users.length + 101}`,
            username: payload.username,
            name: payload.name || payload.username,
            role: payload.role || 'FINANCIAL_ANALYST',
            department: payload.department || 'Operations',
            relationships: payload.relationships || {},
            synthetic: true
          };
          this.users = this.users.filter((u) => u.username !== user.username);
          this.users.push(user);
        } else if (operation === 'MODIFY_USER_ROLE') {
          const target = this.users.find((u) => u.username === payload.username || u.id === payload.id);
          if (target) {
            target.role = payload.role;
            if (payload.department) target.department = payload.department;
          }
        } else if (operation === 'LINK_USER_RELATIONSHIP') {
          const target = this.users.find((u) => u.username === payload.username || u.id === payload.id);
          if (target) {
            target.relationships = { ...(target.relationships || {}), ...(payload.relationships || {}) };
          }
        }
        break;
      }

      case 'API_TOPOLOGY_MUTATION': {
        if (operation === 'ADD_SYNTHETIC_ROUTE') {
          const route = {
            path: payload.path,
            method: (payload.method || 'GET').toUpperCase(),
            simulatedStatus: payload.simulatedStatus || 200,
            responseBody: payload.responseBody || { success: true },
            requiredRole: payload.requiredRole || null,
            availability: payload.availability || 'ENABLED'
          };
          this.routes = this.routes.filter((r) => !(r.path === route.path && r.method === route.method));
          this.routes.push(route);
        } else if (operation === 'MODIFY_ROUTE_BEHAVIOR') {
          const route = this.routes.find(
            (r) => r.path === payload.path && r.method === (payload.method || 'GET').toUpperCase()
          );
          if (route) {
            if (payload.simulatedStatus) route.simulatedStatus = payload.simulatedStatus;
            if (payload.responseBody) route.responseBody = payload.responseBody;
            if (payload.availability) route.availability = payload.availability;
          }
        } else if (operation === 'SET_ROUTE_AVAILABILITY') {
          const route = this.routes.find(
            (r) => r.path === payload.path && r.method === (payload.method || 'GET').toUpperCase()
          );
          if (route) {
            route.availability = payload.availability;
          }
        }
        break;
      }

      case 'DATA_MUTATION': {
        if (operation === 'ADD_SYNTHETIC_RECORD') {
          if (payload.type === 'CUSTOMER') {
            this.customers.push({ ...payload.record, synthetic: true });
          } else if (payload.type === 'ACCOUNT') {
            this.accounts.push({ ...payload.record, synthetic: true });
          }
        } else if (operation === 'MODIFY_DECOY_ATTRIBUTES') {
          if (payload.type === 'CUSTOMER') {
            const c = this.customers.find((cust) => cust.customerId === payload.id);
            if (c) Object.assign(c, payload.attributes);
          } else if (payload.type === 'ACCOUNT') {
            const a = this.accounts.find((acc) => acc.accountNumber === payload.id);
            if (a) Object.assign(a, payload.attributes);
          }
        } else if (operation === 'SCHEMA_MUTATION') {
          if (payload.table && payload.columns) {
            this.schemas = this.schemas.filter((s) => s.table !== payload.table);
            this.schemas.push({ table: payload.table, columns: payload.columns, synthetic: true });
          }
        }
        break;
      }

      case 'SERVICE_TOPOLOGY_MUTATION': {
        if (operation === 'ENABLE_SYNTHETIC_SERVICE') {
          this.activeServices.add(String(payload.serviceType || '').toUpperCase());
        } else if (operation === 'DISABLE_SYNTHETIC_SERVICE') {
          this.activeServices.delete(String(payload.serviceType || '').toUpperCase());
        }
        break;
      }

      case 'CREDENTIAL_MUTATION': {
        if (operation === 'CREATE_DECOY_CREDENTIAL') {
          this.credentials.push({
            id: payload.id || `cred-syn-${this.credentials.length + 1}`,
            userId: payload.userId,
            username: payload.username,
            tokenType: payload.tokenType || 'CANARY_JWT',
            token: payload.token || `canary-token-${this.credentials.length + 1}`,
            role: payload.role || 'FINANCIAL_ANALYST',
            revoked: false,
            createdAt: new Date().toISOString()
          });
        } else if (operation === 'REVOKE_DECOY_CREDENTIAL') {
          const cred = this.credentials.find((c) => c.id === payload.id || c.token === payload.token);
          if (cred) cred.revoked = true;
        }
        break;
      }

      default:
        break;
    }

    this.graphVersion = targetGraphVersion || this.graphVersion + 1;
    this.saveSnapshot(this.graphVersion);
    return {
      success: true,
      graphVersion: this.graphVersion,
      mutationType,
      operation
    };
  }

  getStateSnapshot() {
    return {
      graphVersion: this.graphVersion,
      activeServices: Array.from(this.activeServices),
      usersCount: this.users.length,
      users: this.users,
      routesCount: this.routes.length,
      routes: this.routes,
      accountsCount: this.accounts.length,
      accounts: this.accounts,
      customersCount: this.customers.length,
      customers: this.customers,
      schemasCount: this.schemas.length,
      schemas: this.schemas,
      credentialsCount: this.credentials.length,
      credentials: this.credentials,
      snapshotsCount: this.snapshots.size
    };
  }
}

export async function startIsolatedSyntheticHost({ environmentId = 'env-stage6', tenantId = 'tenant-stage6' } = {}) {
  const startNs = process.hrtime.bigint();
  const stateStore = new IsolatedSyntheticStateStore();

  const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, 'http://127.0.0.1');
    const pathname = parsedUrl.pathname;
    const method = req.method.toUpperCase();

    const sendJson = (status, data) => {
      res.statusCode = status;
      res.setHeader('X-Synthetic-Deception', 'true');
      res.setHeader('X-Deception-Graph-Version', String(stateStore.graphVersion));
      res.setHeader('X-Environment-Id', environmentId);
      res.setHeader('X-Tenant-Id', tenantId);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
    };

    if (pathname === '/health' || pathname === '/api/v1/health') {
      return sendJson(200, {
        status: 'UP',
        serviceType: Array.from(stateStore.activeServices).join(','),
        environmentId,
        graphVersion: stateStore.graphVersion
      });
    }

    if (pathname === '/internal/state') {
      return sendJson(200, { status: 'success', data: stateStore.getStateSnapshot() });
    }

    if (pathname === '/internal/mutate' && method === 'POST') {
      let bodyRaw = '';
      req.on('data', (c) => (bodyRaw += c));
      req.on('end', () => {
        try {
          const payload = JSON.parse(bodyRaw || '{}');
          const result = stateStore.applyMutation(payload);
          return sendJson(200, {
            status: 'success',
            data: result,
            currentState: stateStore.getStateSnapshot()
          });
        } catch (err) {
          return sendJson(400, { status: 'error', error: 'MUTATION_FAILED', message: err.message });
        }
      });
      return;
    }

    if (pathname === '/internal/rollback' && method === 'POST') {
      let bodyRaw = '';
      req.on('data', (c) => (bodyRaw += c));
      req.on('end', () => {
        try {
          const payload = JSON.parse(bodyRaw || '{}');
          const restored = stateStore.restoreSnapshot(payload.targetGraphVersion);
          if (!restored) {
            return sendJson(404, { status: 'error', error: 'SNAPSHOT_NOT_FOUND' });
          }
          return sendJson(200, {
            status: 'success',
            graphVersion: stateStore.graphVersion,
            currentState: stateStore.getStateSnapshot()
          });
        } catch (err) {
          return sendJson(400, { status: 'error', error: 'ROLLBACK_FAILED', message: err.message });
        }
      });
      return;
    }

    // Dynamic routes dispatched before static fallbacks (matches synthetic-service/server.js)
    const dynamicMatch = stateStore.routes.find((r) => r.path === pathname && r.method === method);
    if (dynamicMatch) {
      if (dynamicMatch.availability === 'DISABLED') {
        return sendJson(503, { error: 'SERVICE_UNAVAILABLE', message: 'Synthetic route disabled.' });
      }
      if (dynamicMatch.availability === 'RATE_LIMITED' || dynamicMatch.availability === 'TARPIT') {
        return sendJson(dynamicMatch.simulatedStatus || 429, dynamicMatch.responseBody || { rateLimited: true });
      }
      return sendJson(dynamicMatch.simulatedStatus || 200, dynamicMatch.responseBody || { success: true });
    }

    // Baseline Synthetic Endpoints (identical logic to synthetic-service/server.js)
    if (pathname === '/api/v1/users') {
      return sendJson(200, { success: true, count: stateStore.users.length, data: stateStore.users });
    }

    if (pathname.startsWith('/api/v1/users/')) {
      const userId = pathname.replace('/api/v1/users/', '');
      const user = stateStore.users.find((u) => u.id === userId || u.username === userId) || stateStore.users[0];
      return sendJson(200, { success: true, data: user });
    }

    if (pathname === '/api/v1/accounts') {
      return sendJson(200, { success: true, count: stateStore.accounts.length, data: stateStore.accounts });
    }

    if (pathname === '/api/v1/resources') {
      return sendJson(200, {
        success: true,
        resources: ['users', 'accounts', 'ledgers', 'audit', 'customers', 'schemas'],
        routes: stateStore.routes.map((r) => `${r.method} ${r.path}`)
      });
    }

    if (pathname === '/api/v1/auth/login' && method === 'POST') {
      let bodyRaw = '';
      req.on('data', (c) => (bodyRaw += c));
      req.on('end', () => {
        let parsed = {};
        try {
          parsed = JSON.parse(bodyRaw || '{}');
        } catch {}
        const username = parsed.username || 'alex.chen';
        const user = stateStore.users.find((u) => u.username === username) || stateStore.users[0];
        const decoyCred = stateStore.credentials.find((c) => c.username === username && !c.revoked);

        return sendJson(200, {
          success: true,
          tokenType: 'Bearer',
          syntheticToken: decoyCred?.token || `syn-token-fallback-${user.username}`,
          user,
          role: decoyCred?.role || user.role,
          expiresIn: 3600,
          graphVersion: stateStore.graphVersion,
          notice: 'Synthetic identity session. No credentials evaluated against real identity stores.'
        });
      });
      return;
    }

    if (pathname === '/api/v1/auth/session') {
      return sendJson(200, {
        success: true,
        active: stateStore.activeServices.has('SYNTHETIC_AUTH'),
        user: stateStore.users[0],
        graphVersion: stateStore.graphVersion
      });
    }

    if (pathname === '/api/v1/auth/roles') {
      const roles = Array.from(new Set(stateStore.users.map((u) => u.role)));
      return sendJson(200, { success: true, roles });
    }

    if (pathname === '/api/v1/data/customers') {
      return sendJson(200, { success: true, count: stateStore.customers.length, data: stateStore.customers });
    }

    if (pathname === '/api/v1/data/schemas') {
      return sendJson(200, { success: true, count: stateStore.schemas.length, data: stateStore.schemas });
    }

    if (pathname === '/api/v1/data/records') {
      return sendJson(200, {
        success: true,
        records: [
          { id: 'rec-001', type: 'AUDIT', hash: 'sha256-syn-a81f', status: 'VALIDATED' },
          { id: 'rec-002', type: 'TRANSACTION', hash: 'sha256-syn-f02c', status: 'POSTED' }
        ]
      });
    }

    return sendJson(404, {
      error: 'SYNTHETIC_ENDPOINT_NOT_FOUND',
      message: `The synthetic resource ${pathname} does not exist in this deception state.`,
      graphVersion: stateStore.graphVersion,
      availableTemplates: ['SYNTHETIC_API', 'SYNTHETIC_AUTH', 'SYNTHETIC_DATA']
    });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const provisioningMs = Number(process.hrtime.bigint() - startNs) / 1e6;

  return {
    port,
    provisioningMs,
    stateStore,
    async close() {
      await new Promise((resolve) => server.close(resolve));
    }
  };
}

export async function startSimulatedOriginHost() {
  let originRequestCount = 0;
  const server = http.createServer((req, res) => {
    originRequestCount++;
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'X-Origin-Type': 'PROTECTED_ORIGIN_SIMULATED'
    });
    res.end(
      JSON.stringify({
        origin: 'PROTECTED_ORIGIN',
        method: req.method,
        path: req.url
      })
    );
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    port: server.address().port,
    getRequestCount: () => originRequestCount,
    async close() {
      await new Promise((resolve) => server.close(resolve));
    }
  };
}

export function httpRequestJson(port, { method = 'GET', path = '/', body = null, headers = {} }) {
  return new Promise((resolve, reject) => {
    const payloadStr = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method: method.toUpperCase(),
        headers: {
          ...(payloadStr
            ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payloadStr)
              }
            : {}),
          ...headers
        }
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = raw ? JSON.parse(raw) : null;
          } catch {}
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: json,
            raw
          });
        });
      }
    );
    req.on('error', reject);
    if (payloadStr) req.write(payloadStr);
    req.end();
  });
}
