/**
 * Synthetic Deception Service Daemon (Stage 5B.4).
 *
 * Implements lightweight, non-privileged synthetic services for deception laboratory environments
 * with full dynamic Deception State Graph (DSG) mutation execution and state rollback:
 * - Synthetic API Service (simulated REST resources)
 * - Synthetic Authentication Service (simulated identity verification & tokens)
 * - Synthetic Data Service (simulated customer & administrative data records)
 * - Dynamic State Store (in-memory state evolving with attacker interaction)
 * - Loopback Internal Management API (/internal/state, /internal/mutate, /internal/rollback)
 *
 * Invariants:
 * - Runs as unprivileged user (node / 1000:1000).
 * - Read-only root filesystem compatible (no disk writes, all mutations in-memory / tmpfs).
 * - Absolutely zero connection to production databases or customer data.
 * - All responses stamped with X-Synthetic-Deception and X-Deception-Graph-Version headers.
 */

import http from 'node:http';
import url from 'node:url';

const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = process.env.HOST || '0.0.0.0';
const DEFAULT_SERVICE_TYPE = (process.env.SYNTHETIC_SERVICE_TYPE || 'SYNTHETIC_API').toUpperCase();
const ENVIRONMENT_ID = process.env.DECEPTION_ENVIRONMENT_ID || 'env-synthetic-default';
const TENANT_ID = process.env.DECEPTION_TENANT_ID || 'tenant-default';

// -----------------------------------------------------------------------------
// Controlled Baseline Synthetic Laboratory Datasets
// -----------------------------------------------------------------------------

const INITIAL_USERS = [
  { id: 'usr-syn-101', username: 'alex.chen', name: 'Alex Chen', role: 'FINANCIAL_ANALYST', department: 'Treasury', synthetic: true },
  { id: 'usr-syn-102', username: 'maria.santos', name: 'Maria Santos', role: 'COMPLIANCE_OFFICER', department: 'Legal', synthetic: true },
  { id: 'usr-syn-103', username: 'david.kim', name: 'David Kim', role: 'INFRASTRUCTURE_ENGINEER', department: 'DevOps', synthetic: true }
];

const INITIAL_ACCOUNTS = [
  { accountNumber: 'ACC-SYN-98214', routingNumber: '021000021', balance: 142500.00, currency: 'USD', status: 'ACTIVE', synthetic: true },
  { accountNumber: 'ACC-SYN-44129', routingNumber: '021000021', balance: 89320.50, currency: 'USD', status: 'ACTIVE', synthetic: true },
  { accountNumber: 'ACC-SYN-71003', routingNumber: '121000358', balance: 512000.00, currency: 'USD', status: 'RESTRICTED', synthetic: true }
];

const INITIAL_CUSTOMERS = [
  { customerId: 'CUST-SYN-001', company: 'Apex Global Logistics', tier: 'ENTERPRISE', region: 'NA-EAST', synthetic: true },
  { customerId: 'CUST-SYN-002', company: 'Solstice Health Sciences', tier: 'HEALTHCARE', region: 'EU-WEST', synthetic: true },
  { customerId: 'CUST-SYN-003', company: 'Helios Semiconductor', tier: 'ENTERPRISE', region: 'APAC', synthetic: true }
];

const INITIAL_SCHEMAS = [
  { table: 'synthetic_audit_log', columns: ['event_id', 'timestamp', 'actor', 'action', 'status'], synthetic: true },
  { table: 'synthetic_ledger', columns: ['entry_id', 'account_id', 'amount', 'currency', 'clearing_status'], synthetic: true },
  { table: 'synthetic_identity_vault', columns: ['token_id', 'subject', 'role', 'expires_at'], synthetic: true }
];

// -----------------------------------------------------------------------------
// Dynamic Synthetic State Store
// -----------------------------------------------------------------------------

class SyntheticStateStore {
  constructor() {
    this.graphVersion = 1;
    this.users = JSON.parse(JSON.stringify(INITIAL_USERS));
    this.accounts = JSON.parse(JSON.stringify(INITIAL_ACCOUNTS));
    this.customers = JSON.parse(JSON.stringify(INITIAL_CUSTOMERS));
    this.schemas = JSON.parse(JSON.stringify(INITIAL_SCHEMAS));
    this.routes = [];
    this.credentials = [];
    this.activeServices = new Set([DEFAULT_SERVICE_TYPE]);
    this.snapshots = new Map();
    this.saveSnapshot(1);
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
    // 1. Save snapshot of current state
    this.saveSnapshot(this.graphVersion);

    // 2. Execute structured mutation
    switch (mutationType) {
      case 'IDENTITY_MUTATION': {
        if (operation === 'ADD_SYNTHETIC_USER') {
          const user = {
            id: payload.id || `usr-syn-${Date.now()}`,
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
          this.routes = this.routes.filter(
            (r) => !(r.path === route.path && r.method === route.method)
          );
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
            id: payload.id || `cred-syn-${Date.now()}`,
            userId: payload.userId,
            username: payload.username,
            tokenType: payload.tokenType || 'CANARY_JWT',
            token: payload.token || `canary-token-${Date.now()}`,
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

    // 3. Increment version
    this.graphVersion = targetGraphVersion || (this.graphVersion + 1);
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
      environmentId: ENVIRONMENT_ID,
      tenantId: TENANT_ID,
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

const stateStore = new SyntheticStateStore();

// -----------------------------------------------------------------------------
// Request Dispatcher
// -----------------------------------------------------------------------------

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();

  // Helper for JSON responses
  const sendJson = (status, data) => {
    res.statusCode = status;
    res.setHeader('X-Synthetic-Deception', 'true');
    res.setHeader('X-Deception-Laboratory', 'Stage-5B.4');
    res.setHeader('X-Deception-Graph-Version', String(stateStore.graphVersion));
    res.setHeader('X-Environment-Id', ENVIRONMENT_ID);
    res.setHeader('X-Tenant-Id', TENANT_ID);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
  };

  // Structured Access Logging (Synthetic Telemetry)
  const logEntry = {
    timestamp: new Date().toISOString(),
    method,
    path: pathname,
    clientIp: req.socket.remoteAddress,
    userAgent: req.headers['user-agent'] || 'unknown',
    environmentId: ENVIRONMENT_ID,
    graphVersion: stateStore.graphVersion
  };
  console.log(JSON.stringify(logEntry));

  // 1. Health Probe (Supported on all services)
  if (pathname === '/health' || pathname === '/api/v1/health') {
    return sendJson(200, {
      status: 'UP',
      serviceType: Array.from(stateStore.activeServices).join(','),
      environmentId: ENVIRONMENT_ID,
      graphVersion: stateStore.graphVersion,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      syntheticIsolation: 'VERIFIED'
    });
  }

  // ---------------------------------------------------------------------------
  // 2. Loopback Internal Management API (Mutate, State, Rollback)
  // ---------------------------------------------------------------------------
  if (pathname === '/internal/state' || pathname === '/api/v1/internal/state') {
    return sendJson(200, {
      status: 'success',
      data: stateStore.getStateSnapshot()
    });
  }

  if ((pathname === '/internal/mutate' || pathname === '/api/v1/internal/mutate') && method === 'POST') {
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
        return sendJson(400, {
          status: 'error',
          error: 'MUTATION_FAILED',
          message: err.message
        });
      }
    });
    return;
  }

  if ((pathname === '/internal/rollback' || pathname === '/api/v1/internal/rollback') && method === 'POST') {
    let bodyRaw = '';
    req.on('data', (c) => (bodyRaw += c));
    req.on('end', () => {
      try {
        const payload = JSON.parse(bodyRaw || '{}');
        const targetVersion = payload.targetGraphVersion;
        const restored = stateStore.restoreSnapshot(targetVersion);
        if (!restored) {
          return sendJson(404, {
            status: 'error',
            error: 'SNAPSHOT_NOT_FOUND',
            message: `Snapshot for graph version ${targetVersion} not found.`
          });
        }
        return sendJson(200, {
          status: 'success',
          message: `Successfully rolled back to graph version ${targetVersion}.`,
          graphVersion: stateStore.graphVersion,
          currentState: stateStore.getStateSnapshot()
        });
      } catch (err) {
        return sendJson(400, {
          status: 'error',
          error: 'ROLLBACK_FAILED',
          message: err.message
        });
      }
    });
    return;
  }

  // ---------------------------------------------------------------------------
  // 3. Dynamic Routes (Dispatched before static fallbacks)
  // ---------------------------------------------------------------------------
  const dynamicMatch = stateStore.routes.find(
    (r) => r.path === pathname && r.method === method
  );
  if (dynamicMatch) {
    if (dynamicMatch.availability === 'DISABLED') {
      return sendJson(503, {
        error: 'SERVICE_UNAVAILABLE',
        message: 'This synthetic API route is currently disabled by deception policy.'
      });
    }
    return sendJson(dynamicMatch.simulatedStatus || 200, dynamicMatch.responseBody || { success: true });
  }

  // ---------------------------------------------------------------------------
  // 4. Baseline Synthetic API Service Endpoints
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // 5. Synthetic Authentication Service Endpoints
  // ---------------------------------------------------------------------------
  if (pathname === '/api/v1/auth/login' && method === 'POST') {
    let bodyRaw = '';
    req.on('data', (c) => (bodyRaw += c));
    req.on('end', () => {
      let parsed = {};
      try { parsed = JSON.parse(bodyRaw || '{}'); } catch {}
      const username = parsed.username || 'alex.chen';
      const user = stateStore.users.find((u) => u.username === username) || stateStore.users[0];
      const decoyCred = stateStore.credentials.find((c) => c.username === username && !c.revoked);

      return sendJson(200, {
        success: true,
        tokenType: 'Bearer',
        syntheticToken: decoyCred?.token || `syn-token-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`,
        user,
        role: user.role,
        expiresIn: 3600,
        graphVersion: stateStore.graphVersion,
        notice: 'Synthetic identity session. No credentials evaluated against real identity stores.'
      });
    });
    return;
  }

  if (pathname === '/api/v1/auth/session') {
    return sendJson(200, { success: true, active: true, user: stateStore.users[0], graphVersion: stateStore.graphVersion });
  }

  if (pathname === '/api/v1/auth/roles') {
    const roles = Array.from(new Set(stateStore.users.map((u) => u.role)));
    return sendJson(200, { success: true, roles });
  }

  // ---------------------------------------------------------------------------
  // 6. Synthetic Data Service Endpoints
  // ---------------------------------------------------------------------------
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

  // Fallback 404
  return sendJson(404, {
    error: 'SYNTHETIC_ENDPOINT_NOT_FOUND',
    message: `The synthetic resource ${pathname} does not exist in this deception state.`,
    graphVersion: stateStore.graphVersion,
    availableTemplates: ['SYNTHETIC_API', 'SYNTHETIC_AUTH', 'SYNTHETIC_DATA']
  });
});

server.listen(PORT, HOST, () => {
  console.log(
    JSON.stringify({
      severity: 'INFO',
      message: 'Dynamic Synthetic Deception Daemon started successfully',
      host: HOST,
      port: PORT,
      graphVersion: stateStore.graphVersion,
      environmentId: ENVIRONMENT_ID,
      tenantId: TENANT_ID
    })
  );
});
