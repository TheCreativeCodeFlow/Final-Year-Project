/**
 * Synthetic Deception Service Daemon (Stage 5B.2).
 *
 * Implements lightweight, non-privileged synthetic services for deception laboratory environments:
 * - Synthetic API Service (simulated REST resources)
 * - Synthetic Authentication Service (simulated identity verification & tokens)
 * - Synthetic Data Service (simulated customer & administrative data records)
 *
 * Invariants:
 * - Runs as unprivileged user (node / 1000:1000).
 * - Read-only root filesystem compatible (no disk writes).
 * - Absolutely zero connection to production databases or customer data.
 * - All responses clearly stamped with X-Synthetic-Deception headers.
 */

import http from 'node:http';
import url from 'node:url';

const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = process.env.HOST || '0.0.0.0';
const SERVICE_TYPE = (process.env.SYNTHETIC_SERVICE_TYPE || 'SYNTHETIC_API').toUpperCase();
const ENVIRONMENT_ID = process.env.DECEPTION_ENVIRONMENT_ID || 'env-synthetic-default';
const TENANT_ID = process.env.DECEPTION_TENANT_ID || 'tenant-default';

// -----------------------------------------------------------------------------
// Controlled Synthetic Laboratory Datasets (No Real Information)
// -----------------------------------------------------------------------------

const SYNTHETIC_USERS = [
  { id: 'usr-syn-101', username: 'alex.chen', name: 'Alex Chen', role: 'FINANCIAL_ANALYST', department: 'Treasury', synthetic: true },
  { id: 'usr-syn-102', username: 'maria.santos', name: 'Maria Santos', role: 'COMPLIANCE_OFFICER', department: 'Legal', synthetic: true },
  { id: 'usr-syn-103', username: 'david.kim', name: 'David Kim', role: 'INFRASTRUCTURE_ENGINEER', department: 'DevOps', synthetic: true }
];

const SYNTHETIC_ACCOUNTS = [
  { accountNumber: 'ACC-SYN-98214', routingNumber: '021000021', balance: 142500.00, currency: 'USD', status: 'ACTIVE', synthetic: true },
  { accountNumber: 'ACC-SYN-44129', routingNumber: '021000021', balance: 89320.50, currency: 'USD', status: 'ACTIVE', synthetic: true },
  { accountNumber: 'ACC-SYN-71003', routingNumber: '121000358', balance: 512000.00, currency: 'USD', status: 'RESTRICTED', synthetic: true }
];

const SYNTHETIC_CUSTOMERS = [
  { customerId: 'CUST-SYN-001', company: 'Apex Global Logistics', tier: 'ENTERPRISE', region: 'NA-EAST', synthetic: true },
  { customerId: 'CUST-SYN-002', company: 'Solstice Health Sciences', tier: 'HEALTHCARE', region: 'EU-WEST', synthetic: true },
  { customerId: 'CUST-SYN-003', company: 'Helios Semiconductor', tier: 'ENTERPRISE', region: 'APAC', synthetic: true }
];

const SYNTHETIC_SCHEMAS = [
  { table: 'synthetic_audit_log', columns: ['event_id', 'timestamp', 'actor', 'action', 'status'], synthetic: true },
  { table: 'synthetic_ledger', columns: ['entry_id', 'account_id', 'amount', 'currency', 'clearing_status'], synthetic: true },
  { table: 'synthetic_identity_vault', columns: ['token_id', 'subject', 'role', 'expires_at'], synthetic: true }
];

// -----------------------------------------------------------------------------
// Request Dispatcher
// -----------------------------------------------------------------------------

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();

  // Standard Deception Response Headers
  res.setHeader('X-Synthetic-Deception', 'true');
  res.setHeader('X-Deception-Laboratory', 'Stage-5B.2');
  res.setHeader('X-Environment-Id', ENVIRONMENT_ID);
  res.setHeader('X-Tenant-Id', TENANT_ID);
  res.setHeader('Content-Type', 'application/json');

  // Structured Access Logging (Synthetic Telemetry)
  const logEntry = {
    timestamp: new Date().toISOString(),
    method,
    path: pathname,
    clientIp: req.socket.remoteAddress,
    userAgent: req.headers['user-agent'] || 'unknown',
    serviceType: SERVICE_TYPE,
    environmentId: ENVIRONMENT_ID
  };
  console.log(JSON.stringify(logEntry));

  // 1. Health Probe (Supported on all services)
  if (pathname === '/health' || pathname === '/api/v1/health') {
    res.statusCode = 200;
    return res.end(
      JSON.stringify({
        status: 'UP',
        serviceType: SERVICE_TYPE,
        environmentId: ENVIRONMENT_ID,
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        syntheticIsolation: 'VERIFIED'
      })
    );
  }

  // 2. Synthetic API Service Endpoints
  if (SERVICE_TYPE === 'SYNTHETIC_API' || pathname.startsWith('/api/v1/api')) {
    if (pathname === '/api/v1/users') {
      res.statusCode = 200;
      return res.end(JSON.stringify({ success: true, count: SYNTHETIC_USERS.length, data: SYNTHETIC_USERS }));
    }
    if (pathname.startsWith('/api/v1/users/')) {
      const userId = pathname.replace('/api/v1/users/', '');
      const user = SYNTHETIC_USERS.find((u) => u.id === userId) || SYNTHETIC_USERS[0];
      res.statusCode = 200;
      return res.end(JSON.stringify({ success: true, data: user }));
    }
    if (pathname === '/api/v1/accounts') {
      res.statusCode = 200;
      return res.end(JSON.stringify({ success: true, count: SYNTHETIC_ACCOUNTS.length, data: SYNTHETIC_ACCOUNTS }));
    }
    if (pathname === '/api/v1/resources') {
      res.statusCode = 200;
      return res.end(JSON.stringify({ success: true, resources: ['users', 'accounts', 'ledgers', 'audit'] }));
    }
  }

  // 3. Synthetic Authentication Service Endpoints
  if (SERVICE_TYPE === 'SYNTHETIC_AUTH' || pathname.startsWith('/api/v1/auth')) {
    if (pathname === '/api/v1/auth/login' && method === 'POST') {
      res.statusCode = 200;
      return res.end(
        JSON.stringify({
          success: true,
          tokenType: 'Bearer',
          syntheticToken: `syn-token-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`,
          user: SYNTHETIC_USERS[0],
          expiresIn: 3600,
          notice: 'Synthetic identity session. No credentials evaluated against real identity stores.'
        })
      );
    }
    if (pathname === '/api/v1/auth/session') {
      res.statusCode = 200;
      return res.end(JSON.stringify({ success: true, active: true, user: SYNTHETIC_USERS[0] }));
    }
    if (pathname === '/api/v1/auth/roles') {
      res.statusCode = 200;
      return res.end(JSON.stringify({ success: true, roles: ['FINANCIAL_ANALYST', 'COMPLIANCE_OFFICER', 'INFRASTRUCTURE_ENGINEER'] }));
    }
  }

  // 4. Synthetic Data Service Endpoints
  if (SERVICE_TYPE === 'SYNTHETIC_DATA' || pathname.startsWith('/api/v1/data')) {
    if (pathname === '/api/v1/data/customers') {
      res.statusCode = 200;
      return res.end(JSON.stringify({ success: true, count: SYNTHETIC_CUSTOMERS.length, data: SYNTHETIC_CUSTOMERS }));
    }
    if (pathname === '/api/v1/data/schemas') {
      res.statusCode = 200;
      return res.end(JSON.stringify({ success: true, count: SYNTHETIC_SCHEMAS.length, data: SYNTHETIC_SCHEMAS }));
    }
    if (pathname === '/api/v1/data/records') {
      res.statusCode = 200;
      return res.end(
        JSON.stringify({
          success: true,
          records: [
            { id: 'rec-001', type: 'AUDIT', hash: 'sha256-syn-a81f', status: 'VALIDATED' },
            { id: 'rec-002', type: 'TRANSACTION', hash: 'sha256-syn-f02c', status: 'POSTED' }
          ]
        })
      );
    }
  }

  // Fallback 404
  res.statusCode = 404;
  return res.end(
    JSON.stringify({
      error: 'SYNTHETIC_ENDPOINT_NOT_FOUND',
      message: `The synthetic resource ${pathname} does not exist in this deception state.`,
      availableTemplates: ['SYNTHETIC_API', 'SYNTHETIC_AUTH', 'SYNTHETIC_DATA']
    })
  );
});

server.listen(PORT, HOST, () => {
  console.log(
    JSON.stringify({
      severity: 'INFO',
      message: 'Synthetic Deception Daemon started successfully',
      host: HOST,
      port: PORT,
      serviceType: SERVICE_TYPE,
      environmentId: ENVIRONMENT_ID,
      tenantId: TENANT_ID
    })
  );
});
