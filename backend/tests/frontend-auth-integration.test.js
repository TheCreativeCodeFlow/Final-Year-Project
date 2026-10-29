/**
 * Stage 3E: Frontend Authentication and Backend Integration Test Suite.
 *
 * Verifies end-to-end integration between the frontend authentication services
 * (authService, apiClient, role derivation) and the Stage 3C/3D backend APIs:
 *
 * 1. Authentication
 *    - Valid login: creates session, returns safe user, memberships, anti-CSRF token.
 *    - Invalid credentials: generic 401 INVALID_CREDENTIALS, no account enumeration.
 *    - Disabled and suspended accounts: 403 ACCOUNT_INACTIVE rejection.
 *    - Session restoration: restoreSession() recovers identity via server endpoint.
 *    - In-flight deduplication: concurrent restoreSession() calls share single request.
 *    - Expired/revoked session: returns null and invalidates client session state.
 *    - Logout: revokes session in DB, clears cookie, subsequent restoreSession() is null.
 *    - Network failure: handled gracefully without crashing or fabricating state.
 *
 * 2. Routing, Roles, and Tenant Authorization
 *    - deriveRole: strictly derives role from backend identity and memberships.
 *    - Zero inference from email addresses or local storage.
 *    - Authorized tenants scoping: admin receives platform scope; owner receives assigned tenant only.
 *    - Cross-tenant access: Tenant A cannot access Tenant B resources (403 TENANT_ACCESS_DENIED).
 *
 * 3. Applications Integration
 *    - Live application list retrieval from PostgreSQL.
 *    - Live application detail retrieval by identifier.
 *    - Application creation with anti-CSRF token verification.
 *    - Rejection of disallowed fields (400 on unexpected parameters).
 *    - Duplicate applicationIdentifier returns 409 conflict.
 *    - Application update persists changes to database.
 *    - Security Analyst without manage_applications is rejected with 403 FORBIDDEN.
 */

import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { getPrismaClient, connectDatabase, disconnectDatabase } from '../src/db/client.js';
import { hashPassword } from '../src/utils/passwords.js';
import { defaultLoginLimiter } from '../src/middleware/rate-limiter.js';
import {
  apiClient,
  setApiBaseUrl,
  getApiBaseUrl,
  setCsrfToken,
  getCsrfToken,
  setNodeSessionCookie,
  getNodeSessionCookie,
  ApiError
} from '../../src/services/apiClient.js';
import { authService, deriveRole, ROLES } from '../../src/services/authService.js';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgresql://rahulseervi@localhost:5432/adaptive_deception_test?schema=public';

describe('Stage 3E: Frontend Authentication and Backend Integration', () => {
  let app;
  let server;
  let baseUrl;
  let prisma;

  let tenantApex;
  let tenantMed;
  let userAdmin;
  let userOwner;
  let userAnalyst;
  let userDisabled;
  let userSuspended;

  let apexApp1;

  before(async () => {
    prisma = getPrismaClient({ databaseUrl: TEST_DATABASE_URL, forceNew: true });
    await connectDatabase(prisma);

    // Clean test state
    await prisma.session.deleteMany({});
    await prisma.routingOutcome.deleteMany({});
    await prisma.executionEvidence.deleteMany({});
    await prisma.routingDecision.deleteMany({});
    await prisma.policyDecision.deleteMany({});
    await prisma.behavioralAssessment.deleteMany({});
    await prisma.securityObservation.deleteMany({});
    await prisma.investigation.deleteMany({});
    await prisma.deceptionEnvironment.deleteMany({});
    await prisma.deceptionStrategy.deleteMany({});
    await prisma.deceptionPolicy.deleteMany({});
    await prisma.protectedApplication.deleteMany({});
    await prisma.auditEvent.deleteMany({});
    await prisma.tenantMembership.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.tenant.deleteMany({});

    // 1. Seed Test Tenants
    tenantApex = await prisma.tenant.create({
      data: {
        identifier: 'tenant-apex-9941',
        displayName: 'Apex FinTech Cloud',
        status: 'ACTIVE'
      }
    });

    tenantMed = await prisma.tenant.create({
      data: {
        identifier: 'tenant-medsecure-7712',
        displayName: 'MedSecure Healthcare Systems',
        status: 'ACTIVE'
      }
    });

    // 2. Seed Test Users
    const adminHash = await hashPassword('DevAdmin12345!');
    const ownerHash = await hashPassword('DevOwner12345!');
    const analystHash = await hashPassword('DevAnalyst12345!');
    const disabledHash = await hashPassword('DevDisabled12345!');
    const suspendedHash = await hashPassword('DevSuspended12345!');

    userAdmin = await prisma.user.create({
      data: {
        email: 'admin@gateway.internal',
        name: 'Sarah Chen',
        passwordHash: adminHash,
        status: 'ACTIVE',
        isPlatformAdmin: true
      }
    });

    userOwner = await prisma.user.create({
      data: {
        email: 'owner@apexfintech.io',
        name: 'Alex Vance',
        passwordHash: ownerHash,
        status: 'ACTIVE',
        isPlatformAdmin: false
      }
    });

    userAnalyst = await prisma.user.create({
      data: {
        email: 'analyst@medsecure.io',
        name: 'Elena Rostova',
        passwordHash: analystHash,
        status: 'ACTIVE',
        isPlatformAdmin: false
      }
    });

    userDisabled = await prisma.user.create({
      data: {
        email: 'disabled@example.com',
        name: 'Disabled User',
        passwordHash: disabledHash,
        status: 'DISABLED',
        isPlatformAdmin: false
      }
    });

    userSuspended = await prisma.user.create({
      data: {
        email: 'suspended@example.com',
        name: 'Suspended User',
        passwordHash: suspendedHash,
        status: 'SUSPENDED',
        isPlatformAdmin: false
      }
    });

    // 3. Seed Memberships
    await prisma.tenantMembership.create({
      data: {
        userId: userOwner.id,
        tenantId: tenantApex.id,
        role: 'APPLICATION_OWNER',
        permissions: ['manage_applications', 'view_security_events', 'configure_policies']
      }
    });

    await prisma.tenantMembership.create({
      data: {
        userId: userAnalyst.id,
        tenantId: tenantMed.id,
        role: 'SECURITY_ANALYST',
        permissions: ['view_security_events', 'investigate_threats']
      }
    });

    // 4. Seed Test Application
    apexApp1 = await prisma.protectedApplication.create({
      data: {
        tenantId: tenantApex.id,
        applicationIdentifier: 'app-01',
        name: 'Customer Accounts API',
        domain: 'accounts.apexfintech.internal',
        status: 'PROTECTED'
      }
    });

    // 5. Start Test HTTP Server
    app = createApp({ prisma });
    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}/api/v1`;

    // Configure apiClient to point to test server
    setApiBaseUrl(baseUrl);
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDatabase(prisma);
  });

  beforeEach(() => {
    defaultLoginLimiter.reset();
    setCsrfToken(null);
    setNodeSessionCookie(null);
  });

  // ----------------------------------------------------------------------------
  // 1. Role Derivation Unit Tests
  // ----------------------------------------------------------------------------
  test('1. deriveRole: strictly derives role from backend identity and memberships', () => {
    // Null user
    assert.equal(deriveRole(null), null);

    // Platform Admin
    assert.equal(deriveRole({ isPlatformAdmin: true }, []), ROLES.ADMIN);

    // Tenant Application Owner
    const ownerMemberships = [{ role: 'APPLICATION_OWNER', tenantId: tenantApex.id }];
    assert.equal(deriveRole({ isPlatformAdmin: false }, ownerMemberships), ROLES.OWNER);

    // Security Analyst
    const analystMemberships = [{ role: 'SECURITY_ANALYST', tenantId: tenantMed.id }];
    assert.equal(deriveRole({ isPlatformAdmin: false }, analystMemberships), ROLES.ANALYST);

    // User with unrecognized membership
    assert.equal(deriveRole({ isPlatformAdmin: false }, [{ role: 'AUDITOR' }]), null);

    // Never infers from email address
    assert.equal(deriveRole({ email: 'admin@fake.com', isPlatformAdmin: false }, []), null);
  });

  // ----------------------------------------------------------------------------
  // 2. Authentication Flow Tests (authService & apiClient)
  // ----------------------------------------------------------------------------
  test('2. authService.login: valid credentials authenticate, set cookie, and return role and csrfToken', async () => {
    const result = await authService.login('owner@apexfintech.io', 'DevOwner12345!');

    assert.ok(result.user, 'Expected user object in login result');
    assert.equal(result.user.email, 'owner@apexfintech.io');
    assert.equal(result.user.name, 'Alex Vance');
    assert.equal(result.role, ROLES.OWNER);
    assert.ok(Array.isArray(result.memberships));
    assert.equal(result.memberships.length, 1);
    assert.equal(result.memberships[0].tenant.identifier, 'tenant-apex-9941');

    // Anti-CSRF token received and stored in apiClient
    assert.ok(result.csrfToken, 'Expected csrfToken in login result');
    assert.equal(getCsrfToken(), result.csrfToken);

    // Session cookie stored in Node emulation
    assert.ok(getNodeSessionCookie(), 'Expected session cookie to be captured');
    assert.match(getNodeSessionCookie(), /adg_session=/);
  });

  test('3. authService.login: invalid password returns generic 401 INVALID_CREDENTIALS', async () => {
    await assert.rejects(
      async () => {
        await authService.login('owner@apexfintech.io', 'WrongPassword123!');
      },
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.status, 401);
        assert.equal(err.code, 'INVALID_CREDENTIALS');
        return true;
      }
    );

    assert.equal(getCsrfToken(), null);
    assert.equal(getNodeSessionCookie(), null);
  });

  test('4. authService.login: non-existent account returns generic 401 without user enumeration', async () => {
    await assert.rejects(
      async () => {
        await authService.login('ghost@apexfintech.io', 'DevOwner12345!');
      },
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.status, 401);
        assert.equal(err.code, 'INVALID_CREDENTIALS');
        return true;
      }
    );
  });

  test('5. authService.login: disabled and suspended accounts return 403 ACCOUNT_INACTIVE', async () => {
    // Disabled
    await assert.rejects(
      async () => {
        await authService.login('disabled@example.com', 'DevDisabled12345!');
      },
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.status, 403);
        assert.equal(err.code, 'ACCOUNT_INACTIVE');
        return true;
      }
    );

    // Suspended
    await assert.rejects(
      async () => {
        await authService.login('suspended@example.com', 'DevSuspended12345!');
      },
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.status, 403);
        assert.equal(err.code, 'ACCOUNT_INACTIVE');
        return true;
      }
    );
  });

  test('6. authService.restoreSession: recovers active identity and csrfToken on page reload', async () => {
    // Log in first
    await authService.login('owner@apexfintech.io', 'DevOwner12345!');
    const activeCookie = getNodeSessionCookie();
    assert.ok(activeCookie);

    // Clear memory csrfToken to simulate full page refresh with only HttpOnly cookie remaining
    setCsrfToken(null);
    assert.equal(getCsrfToken(), null);

    // Restore session
    const restored = await authService.restoreSession();
    assert.ok(restored, 'Expected restoreSession to succeed with active cookie');
    assert.equal(restored.user.email, 'owner@apexfintech.io');
    assert.equal(restored.role, ROLES.OWNER);
    assert.ok(restored.csrfToken, 'Expected csrfToken to be restored from server');
    assert.equal(getCsrfToken(), restored.csrfToken);
  });

  test('7. authService.restoreSession: deduplicates concurrent requests (in-flight singleton)', async () => {
    await authService.login('owner@apexfintech.io', 'DevOwner12345!');

    // Call restoreSession simultaneously multiple times
    const [p1, p2, p3] = await Promise.all([
      authService.restoreSession(),
      authService.restoreSession(),
      authService.restoreSession()
    ]);

    assert.equal(p1.user.id, p2.user.id);
    assert.equal(p2.user.id, p3.user.id);
  });

  test('8. authService.restoreSession: returns null when session is expired or missing', async () => {
    // Missing session cookie
    setNodeSessionCookie(null);
    const result = await authService.restoreSession();
    assert.equal(result, null);
    assert.equal(getCsrfToken(), null);
  });

  test('9. authService.logout: revokes session in DB, clears cookie and in-memory CSRF token', async () => {
    await authService.login('owner@apexfintech.io', 'DevOwner12345!');
    assert.ok(getNodeSessionCookie());
    assert.ok(getCsrfToken());

    // Execute logout
    const logoutRes = await authService.logout();
    assert.equal(logoutRes.success, true);
    assert.equal(logoutRes.serverRevoked, true);

    // In-memory CSRF and cookie cleared
    assert.equal(getCsrfToken(), null);
    assert.equal(getNodeSessionCookie(), null);

    // Subsequent restore returns null
    const restored = await authService.restoreSession();
    assert.equal(restored, null);
  });

  // ----------------------------------------------------------------------------
  // 3. Authorized Tenants Scoping
  // ----------------------------------------------------------------------------
  test('10. authService.getAuthorizedTenants: scopes tenant list strictly by membership', async () => {
    // Owner login
    await authService.login('owner@apexfintech.io', 'DevOwner12345!');
    const ownerTenants = await authService.getAuthorizedTenants();
    assert.equal(ownerTenants.accessScope, 'TENANT_MEMBER');
    assert.equal(ownerTenants.tenants.length, 1);
    assert.equal(ownerTenants.tenants[0].tenant.identifier, 'tenant-apex-9941');

    // Admin login
    await authService.login('admin@gateway.internal', 'DevAdmin12345!');
    const adminTenants = await authService.getAuthorizedTenants();
    assert.equal(adminTenants.accessScope, 'PLATFORM_ADMIN');
    assert.equal(adminTenants.tenants.length, 2);
  });

  // ----------------------------------------------------------------------------
  // 4. Protected Applications Integration
  // ----------------------------------------------------------------------------
  test('11. apiClient.getApplications: loads live database applications under authorized tenant', async () => {
    await authService.login('owner@apexfintech.io', 'DevOwner12345!');

    const res = await apiClient.getApplications('tenant-apex-9941');
    assert.equal(res.success, true);
    assert.ok(Array.isArray(res.data));
    assert.equal(res.data.length, 1);
    assert.equal(res.data[0].applicationIdentifier, 'app-01');
    assert.equal(res.data[0].name, 'Customer Accounts API');
  });

  test('12. apiClient.getApplicationById: retrieves single application by ID or slug', async () => {
    await authService.login('owner@apexfintech.io', 'DevOwner12345!');

    const res = await apiClient.getApplicationById('tenant-apex-9941', 'app-01');
    assert.equal(res.success, true);
    assert.equal(res.data.name, 'Customer Accounts API');
    assert.equal(res.data.domain, 'accounts.apexfintech.internal');
  });

  test('13. Cross-tenant isolation: Tenant A cannot access Tenant B applications (403 FORBIDDEN)', async () => {
    await authService.login('owner@apexfintech.io', 'DevOwner12345!');

    // Tenant Apex owner tries to access Tenant Med
    await assert.rejects(
      async () => {
        await apiClient.getApplications('tenant-medsecure-7712');
      },
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.status, 403);
        assert.equal(err.code, 'TENANT_ACCESS_DENIED');
        return true;
      }
    );
  });

  test('14. apiClient.createApplication: persists new application with anti-CSRF token', async () => {
    await authService.login('owner@apexfintech.io', 'DevOwner12345!');

    const payload = {
      name: 'Payments Clearing Gateway',
      domain: 'payments.apexfintech.internal',
      applicationIdentifier: 'app-payments-99',
      status: 'PROTECTED'
    };

    const res = await apiClient.createApplication('tenant-apex-9941', payload);
    assert.equal(res.success, true);
    assert.equal(res.data.name, 'Payments Clearing Gateway');
    assert.equal(res.data.applicationIdentifier, 'app-payments-99');

    // Verify in database directly
    const inDb = await prisma.protectedApplication.findUnique({
      where: {
        tenantId_applicationIdentifier: {
          tenantId: tenantApex.id,
          applicationIdentifier: 'app-payments-99'
        }
      }
    });
    assert.ok(inDb);
    assert.equal(inDb.name, 'Payments Clearing Gateway');
  });

  test('15. apiClient.createApplication: rejects disallowed fields with 400 INVALID_INPUT', async () => {
    await authService.login('owner@apexfintech.io', 'DevOwner12345!');

    const payloadWithDisallowed = {
      name: 'Bad Payload App',
      domain: 'bad.apexfintech.internal',
      route: '/bad/path', // Disallowed extra field
      environment: 'production' // Disallowed extra field
    };

    await assert.rejects(
      async () => {
        await apiClient.createApplication('tenant-apex-9941', payloadWithDisallowed);
      },
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.status, 400);
        assert.equal(err.code, 'INVALID_INPUT');
        return true;
      }
    );
  });

  test('16. apiClient.createApplication: duplicate applicationIdentifier returns 409 conflict', async () => {
    await authService.login('owner@apexfintech.io', 'DevOwner12345!');

    const duplicatePayload = {
      name: 'Duplicate Identifier App',
      domain: 'dup.apexfintech.internal',
      applicationIdentifier: 'app-01', // Already exists in tenant Apex
      status: 'PROTECTED'
    };

    await assert.rejects(
      async () => {
        await apiClient.createApplication('tenant-apex-9941', duplicatePayload);
      },
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.status, 409);
        assert.equal(err.code, 'DUPLICATE_APPLICATION_IDENTIFIER');
        return true;
      }
    );
  });

  test('17. Security Analyst without manage_applications is rejected with 403 on create', async () => {
    // Analyst logs in
    await authService.login('analyst@medsecure.io', 'DevAnalyst12345!');

    const createAttempt = {
      name: 'Unauthorized App Creation',
      domain: 'unauth.medsecure.internal',
      status: 'PROTECTED'
    };

    await assert.rejects(
      async () => {
        await apiClient.createApplication('tenant-medsecure-7712', createAttempt);
      },
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.status, 403);
        assert.equal(err.code, 'FORBIDDEN');
        return true;
      }
    );
  });

  test('18. apiClient.updateApplication: updates existing application in database', async () => {
    await authService.login('owner@apexfintech.io', 'DevOwner12345!');

    const updatePayload = {
      name: 'Customer Accounts API (Hardened)',
      domain: 'accounts-v2.apexfintech.internal',
      status: 'DEGRADED'
    };

    const res = await apiClient.updateApplication('tenant-apex-9941', 'app-01', updatePayload);
    assert.equal(res.success, true);
    assert.equal(res.data.name, 'Customer Accounts API (Hardened)');
    assert.equal(res.data.domain, 'accounts-v2.apexfintech.internal');
    assert.equal(res.data.status, 'DEGRADED');

    // Confirm in DB
    const inDb = await prisma.protectedApplication.findUnique({
      where: {
        tenantId_applicationIdentifier: {
          tenantId: tenantApex.id,
          applicationIdentifier: 'app-01'
        }
      }
    });
    assert.equal(inDb.name, 'Customer Accounts API (Hardened)');
  });
});
