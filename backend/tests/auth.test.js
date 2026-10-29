/**
 * Comprehensive Authentication & Tenant Authorization Test Suite (Stage 3C).
 *
 * Verifies all 18 requirements:
 * 1. Successful authentication (200, HttpOnly cookie, safe user, anti-CSRF token).
 * 2. Incorrect password returns generic 401 INVALID_CREDENTIALS.
 * 3. Unknown account returns generic 401 INVALID_CREDENTIALS.
 * 4. Disabled / suspended account returns 403 ACCOUNT_INACTIVE.
 * 5. Logout revokes session, clears cookie, emits audit event, subsequent request rejected.
 * 6. Missing or invalid session on protected endpoints returns 401 UNAUTHENTICATED or INVALID_SESSION.
 * 7. Session expiry: session past expiresAt is rejected with 401 INVALID_SESSION.
 * 8. Protected endpoint access without authentication fails with 401.
 * 9. Application owner denied administrator-only access (403 FORBIDDEN).
 * 10. Tenant A denied access to Tenant B resources (403 TENANT_ACCESS_DENIED).
 * 11. Client-supplied tenant IDs cannot bypass membership checks.
 * 12. Role or membership escalation attempts are rejected.
 * 13. CSRF protection on cookie-authenticated mutations.
 * 14. Login throttling behavior (429 TOO_MANY_REQUESTS with Retry-After).
 * 15. Authentication audit events exclude secrets and passwords.
 */

import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { getPrismaClient, connectDatabase, disconnectDatabase } from '../src/db/client.js';
import { hashPassword } from '../src/utils/passwords.js';
import { defaultLoginLimiter } from '../src/middleware/rate-limiter.js';
import { parseCookie } from 'cookie';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgresql://rahulseervi@localhost:5432/adaptive_deception_test?schema=public';

describe('Stage 3C: Secure Authentication and Tenant Authorization', () => {
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

  before(async () => {
    // 1. Database setup
    prisma = getPrismaClient({ databaseUrl: TEST_DATABASE_URL, forceNew: true });
    await connectDatabase(prisma);

    // 2. Clean up test users / sessions
    await prisma.session.deleteMany({});
    await prisma.tenantMembership.deleteMany({});
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            'admin@gateway.internal',
            'owner@apexfintech.io',
            'analyst@medsecure.io',
            'disabled@example.com',
            'suspended@example.com',
            'throttletest@example.com'
          ]
        }
      }
    });

    // 3. Ensure test tenants exist
    tenantApex = await prisma.tenant.upsert({
      where: { identifier: 'tenant-apex-9941' },
      update: { displayName: 'Apex FinTech Cloud', status: 'ACTIVE' },
      create: {
        identifier: 'tenant-apex-9941',
        displayName: 'Apex FinTech Cloud',
        status: 'ACTIVE'
      }
    });

    tenantMed = await prisma.tenant.upsert({
      where: { identifier: 'tenant-medsecure-7712' },
      update: { displayName: 'MedSecure Healthcare Systems', status: 'ACTIVE' },
      create: {
        identifier: 'tenant-medsecure-7712',
        displayName: 'MedSecure Healthcare Systems',
        status: 'ACTIVE'
      }
    });

    // 4. Seed test accounts with Argon2id
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
        isPlatformAdmin: false,
        memberships: {
          create: {
            tenantId: tenantApex.id,
            role: 'APPLICATION_OWNER',
            permissions: ['manage_applications', 'view_security_events']
          }
        }
      }
    });

    userAnalyst = await prisma.user.create({
      data: {
        email: 'analyst@medsecure.io',
        name: 'Elena Rostova',
        passwordHash: analystHash,
        status: 'ACTIVE',
        isPlatformAdmin: false,
        memberships: {
          create: {
            tenantId: tenantMed.id,
            role: 'SECURITY_ANALYST',
            permissions: ['view_security_events', 'investigate_threats']
          }
        }
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

    // 5. Initialize application with injected test database client
    app = createApp({ prisma });
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (prisma) {
      await disconnectDatabase(prisma);
    }
  });

  beforeEach(() => {
    defaultLoginLimiter.reset();
  });

  // Helper function to extract session cookie from response
  function extractCookie(res, cookieName = 'adg_session') {
    const rawCookie = res.headers.get('set-cookie');
    if (!rawCookie) return null;
    const parsed = parseCookie(rawCookie);
    return {
      name: cookieName,
      value: parsed[cookieName],
      raw: rawCookie
    };
  }

  test('1. Successful authentication returns 200, sets HttpOnly cookie, and returns safe user object with anti-CSRF token', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@gateway.internal',
        password: 'DevAdmin12345!'
      })
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.user);
    assert.equal(body.data.user.email, 'admin@gateway.internal');
    assert.equal(body.data.user.name, 'Sarah Chen');
    assert.equal(body.data.user.isPlatformAdmin, true);
    // CRITICAL: passwordHash must NEVER be exposed
    assert.equal(body.data.user.passwordHash, undefined);

    // Anti-CSRF token returned
    assert.ok(typeof body.data.csrfToken === 'string');
    assert.equal(body.data.csrfToken.length, 32);

    // Session metadata returned
    assert.ok(body.data.session.id);
    assert.ok(body.data.session.expiresAt);

    // Verify Set-Cookie header contains HttpOnly, SameSite=Lax, Path=/
    const cookie = extractCookie(res);
    assert.ok(cookie);
    assert.ok(cookie.value);
    assert.ok(cookie.raw.includes('HttpOnly'));
    assert.ok(cookie.raw.includes('SameSite=Lax') || cookie.raw.includes('samesite=lax'));
    assert.ok(cookie.raw.includes('Path=/') || cookie.raw.includes('path=/'));
  });

  test('2. Incorrect password returns generic 401 INVALID_CREDENTIALS', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@gateway.internal',
        password: 'WrongPassword999!'
      })
    });

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'INVALID_CREDENTIALS');
    assert.equal(body.error.message, 'Invalid email or password.');

    // No session cookie should be issued
    const cookie = extractCookie(res);
    assert.equal(cookie, null);
  });

  test('3. Unknown account returns generic 401 INVALID_CREDENTIALS (no user enumeration)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nonexistent.user@randomdomain.test',
        password: 'SomePassword12345!'
      })
    });

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'INVALID_CREDENTIALS');
    assert.equal(body.error.message, 'Invalid email or password.');
  });

  test('4. Disabled and suspended accounts return 403 ACCOUNT_INACTIVE', async () => {
    // Disabled account
    const resDisabled = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'disabled@example.com',
        password: 'DevDisabled12345!'
      })
    });
    assert.equal(resDisabled.status, 403);
    const bodyDisabled = await resDisabled.json();
    assert.equal(bodyDisabled.error.code, 'ACCOUNT_INACTIVE');
    assert.equal(bodyDisabled.error.accountStatus, 'DISABLED');

    // Suspended account
    const resSuspended = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'suspended@example.com',
        password: 'DevSuspended12345!'
      })
    });
    assert.equal(resSuspended.status, 403);
    const bodySuspended = await resSuspended.json();
    assert.equal(bodySuspended.error.code, 'ACCOUNT_INACTIVE');
    assert.equal(bodySuspended.error.accountStatus, 'SUSPENDED');
  });

  test('5. GET /api/v1/auth/me returns current identity, memberships, and session info', async () => {
    // Log in as Alex Vance (Application Owner)
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'owner@apexfintech.io',
        password: 'DevOwner12345!'
      })
    });
    assert.equal(loginRes.status, 200);
    const loginData = await loginRes.json();
    const cookie = extractCookie(loginRes);

    // Call /me with cookie
    const meRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: {
        Cookie: `adg_session=${cookie.value}`
      }
    });

    assert.equal(meRes.status, 200);
    const meBody = await meRes.json();
    assert.equal(meBody.success, true);
    assert.equal(meBody.data.user.email, 'owner@apexfintech.io');
    assert.equal(meBody.data.user.isPlatformAdmin, false);
    assert.equal(meBody.data.user.passwordHash, undefined);
    assert.equal(meBody.data.memberships.length, 1);
    assert.equal(meBody.data.memberships[0].role, 'APPLICATION_OWNER');
    assert.equal(meBody.data.memberships[0].tenant.identifier, 'tenant-apex-9941');

    // Also verify Bearer token authentication
    const bearerRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: {
        Authorization: `Bearer ${cookie.value}`
      }
    });
    assert.equal(bearerRes.status, 200);
    const bearerBody = await bearerRes.json();
    assert.equal(bearerBody.data.user.email, 'owner@apexfintech.io');
  });

  test('6. GET /api/v1/auth/tenants scopes tenant list strictly by membership', async () => {
    // Owner login
    const ownerLogin = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'owner@apexfintech.io',
        password: 'DevOwner12345!'
      })
    });
    const ownerCookie = extractCookie(ownerLogin);

    const ownerTenantsRes = await fetch(`${baseUrl}/api/v1/auth/tenants`, {
      headers: { Cookie: `adg_session=${ownerCookie.value}` }
    });
    assert.equal(ownerTenantsRes.status, 200);
    const ownerTenants = await ownerTenantsRes.json();
    assert.equal(ownerTenants.data.accessScope, 'TENANT_MEMBER');
    assert.equal(ownerTenants.data.tenants.length, 1);
    assert.equal(ownerTenants.data.tenants[0].tenant.identifier, 'tenant-apex-9941');
    assert.equal(ownerTenants.data.tenants[0].role, 'APPLICATION_OWNER');

    // Admin login
    const adminLogin = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@gateway.internal',
        password: 'DevAdmin12345!'
      })
    });
    const adminCookie = extractCookie(adminLogin);

    const adminTenantsRes = await fetch(`${baseUrl}/api/v1/auth/tenants`, {
      headers: { Cookie: `adg_session=${adminCookie.value}` }
    });
    assert.equal(adminTenantsRes.status, 200);
    const adminTenants = await adminTenantsRes.json();
    assert.equal(adminTenants.data.accessScope, 'PLATFORM_ADMIN');
    // Admin sees all platform tenants
    assert.ok(adminTenants.data.tenants.length >= 2);
  });

  test('7. Logout revokes session, clears cookie, and invalidates future requests', async () => {
    // 1. Log in
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@gateway.internal',
        password: 'DevAdmin12345!'
      })
    });
    const loginBody = await loginRes.json();
    const cookie = extractCookie(loginRes);
    const csrfToken = loginBody.data.csrfToken;

    // 2. Perform logout (with cookie and X-CSRF-Token)
    const logoutRes = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: 'POST',
      headers: {
        Cookie: `adg_session=${cookie.value}`,
        'X-CSRF-Token': csrfToken
      }
    });
    assert.equal(logoutRes.status, 200);
    const logoutCookie = extractCookie(logoutRes);
    assert.ok(logoutCookie.raw.includes('Max-Age=0'));

    // 3. Verify session is marked revoked in database
    const dbSession = await prisma.session.findUnique({
      where: { sessionToken: cookie.value }
    });
    assert.ok(dbSession.revokedAt !== null, 'Session revokedAt must be populated in database');

    // 4. Subsequent request with the revoked token must fail
    const followUpRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Cookie: `adg_session=${cookie.value}` }
    });
    assert.equal(followUpRes.status, 401);
    const followUpBody = await followUpRes.json();
    assert.equal(followUpBody.error.code, 'INVALID_SESSION');
  });

  test('8. Missing or invalid session on protected endpoints returns 401', async () => {
    // No auth header or cookie
    const noAuthRes = await fetch(`${baseUrl}/api/v1/auth/me`);
    assert.equal(noAuthRes.status, 401);
    const noAuthBody = await noAuthRes.json();
    assert.equal(noAuthBody.error.code, 'UNAUTHENTICATED');

    // Invalid session token format
    const invalidTokenRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: 'Bearer short-invalid-token' }
    });
    assert.equal(invalidTokenRes.status, 401);
    const invalidBody = await invalidTokenRes.json();
    assert.equal(invalidBody.error.code, 'INVALID_SESSION');

    // Nonexistent session token
    const fakeToken = 'a'.repeat(64);
    const nonexistentRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${fakeToken}` }
    });
    assert.equal(nonexistentRes.status, 401);
    assert.equal((await nonexistentRes.json()).error.code, 'INVALID_SESSION');
  });

  test('9. Expired session is rejected with 401 INVALID_SESSION', async () => {
    // Create an expired session directly in DB
    const expiredToken = 'e'.repeat(64);
    await prisma.session.create({
      data: {
        userId: userAdmin.id,
        sessionToken: expiredToken,
        csrfToken: 'c'.repeat(32),
        expiresAt: new Date(Date.now() - 3600 * 1000) // 1 hour ago
      }
    });

    const res = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${expiredToken}` }
    });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error.code, 'INVALID_SESSION');
  });

  test('10. Application Owner is denied access to Platform Administrator endpoints', async () => {
    // Owner login
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'owner@apexfintech.io',
        password: 'DevOwner12345!'
      })
    });
    const cookie = extractCookie(loginRes);

    // Call administrator-only route
    const adminTestRes = await fetch(`${baseUrl}/api/v1/auth/admin-test`, {
      headers: { Cookie: `adg_session=${cookie.value}` }
    });
    assert.equal(adminTestRes.status, 403);
    const body = await adminTestRes.json();
    assert.equal(body.error.code, 'FORBIDDEN');
    assert.ok(body.error.message.includes('Platform Administrator privilege'));
  });

  test('11. Tenant A user is strictly denied access to Tenant B resources', async () => {
    // Owner login (Apex FinTech member only)
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'owner@apexfintech.io',
        password: 'DevOwner12345!'
      })
    });
    const cookie = extractCookie(loginRes);

    // Attempt to access MedSecure tenant context via query parameter
    const crossTenantRes = await fetch(
      `${baseUrl}/api/v1/auth/protected-test?tenantId=tenant-medsecure-7712`,
      {
        headers: { Cookie: `adg_session=${cookie.value}` }
      }
    );
    assert.equal(crossTenantRes.status, 403);
    const body = await crossTenantRes.json();
    assert.equal(body.error.code, 'TENANT_ACCESS_DENIED');
    assert.ok(body.error.message.includes('not an authorized member'));
  });

  test('12. Client-supplied tenant IDs in headers cannot bypass tenant authorization checks', async () => {
    // Owner login
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'owner@apexfintech.io',
        password: 'DevOwner12345!'
      })
    });
    const cookie = extractCookie(loginRes);

    // Attempt access via X-Tenant-ID header spoofing
    const headerSpoofRes = await fetch(`${baseUrl}/api/v1/auth/protected-test`, {
      headers: {
        Cookie: `adg_session=${cookie.value}`,
        'X-Tenant-ID': 'tenant-medsecure-7712'
      }
    });
    assert.equal(headerSpoofRes.status, 403);
    const body = await headerSpoofRes.json();
    assert.equal(body.error.code, 'TENANT_ACCESS_DENIED');

    // Accessing own tenant succeeds
    const legitimateRes = await fetch(`${baseUrl}/api/v1/auth/protected-test`, {
      headers: {
        Cookie: `adg_session=${cookie.value}`,
        'X-Tenant-ID': 'tenant-apex-9941'
      }
    });
    assert.equal(legitimateRes.status, 200);
    const legBody = await legitimateRes.json();
    assert.equal(legBody.data.authorizedTenantContext.identifier, 'tenant-apex-9941');
    assert.equal(legBody.data.tenantRole, 'APPLICATION_OWNER');
  });

  test('13. Anti-CSRF token verification on cookie-authenticated mutation requests', async () => {
    // Log in
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@gateway.internal',
        password: 'DevAdmin12345!'
      })
    });
    const loginBody = await loginRes.json();
    const cookie = extractCookie(loginRes);
    const validCsrfToken = loginBody.data.csrfToken;

    // Mutation with cookie but missing X-CSRF-Token header
    const noCsrfRes = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: 'POST',
      headers: { Cookie: `adg_session=${cookie.value}` }
    });
    assert.equal(noCsrfRes.status, 403);
    const noCsrfBody = await noCsrfRes.json();
    assert.equal(noCsrfBody.error.code, 'CSRF_TOKEN_INVALID');

    // Mutation with cookie and invalid X-CSRF-Token
    const badCsrfRes = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: 'POST',
      headers: {
        Cookie: `adg_session=${cookie.value}`,
        'X-CSRF-Token': 'invalid-csrf-token-12345'
      }
    });
    assert.equal(badCsrfRes.status, 403);
    const badCsrfBody = await badCsrfRes.json();
    assert.equal(badCsrfBody.error.code, 'CSRF_TOKEN_INVALID');

    // Mutation with valid X-CSRF-Token header succeeds
    const goodCsrfRes = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: 'POST',
      headers: {
        Cookie: `adg_session=${cookie.value}`,
        'X-CSRF-Token': validCsrfToken
      }
    });
    assert.equal(goodCsrfRes.status, 200);
  });

  test('14. API requests authenticated via Authorization Bearer bypass CSRF check', async () => {
    // Log in
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@gateway.internal',
        password: 'DevAdmin12345!'
      })
    });
    const cookie = extractCookie(loginRes);

    // Call logout using Bearer header without CSRF token
    const bearerLogoutRes = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cookie.value}`
      }
    });
    assert.equal(bearerLogoutRes.status, 200);
  });

  test('15. Login throttling triggers HTTP 429 TOO_MANY_REQUESTS with Retry-After header', async () => {
    const targetEmail = 'throttletest@example.com';

    // 5 failed login attempts
    for (let i = 0; i < 5; i++) {
      const failRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, password: 'WrongPassword123!' })
      });
      assert.equal(failRes.status, 401);
    }

    // 6th attempt should be blocked by rate limiter
    const blockedRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: targetEmail, password: 'WrongPassword123!' })
    });

    assert.equal(blockedRes.status, 429);
    const blockedBody = await blockedRes.json();
    assert.equal(blockedBody.error.code, 'TOO_MANY_REQUESTS');
    assert.ok(blockedRes.headers.get('retry-after'));
    assert.ok(blockedBody.error.retryAfterSeconds > 0);
  });

  test('16. Authentication audit events exclude passwords, hashes, and secrets', async () => {
    // Perform a login and check audit log record
    await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@gateway.internal',
        password: 'DevAdmin12345!'
      })
    });

    // Fetch the latest audit record for AUTH_LOGIN_SUCCESS
    const auditRecord = await prisma.auditEvent.findFirst({
      where: { action: 'AUTH_LOGIN_SUCCESS' },
      orderBy: { timestamp: 'desc' }
    });

    assert.ok(auditRecord);
    assert.equal(auditRecord.actorIdentifier, 'admin@gateway.internal');
    const metadataStr = JSON.stringify(auditRecord.structuredMetadata);

    // Verify zero occurrences of password plaintext, hash, or secret tokens
    assert.ok(!metadataStr.includes('DevAdmin12345!'));
    assert.ok(!metadataStr.includes('$argon2id$'));
    assert.ok(!metadataStr.includes('password'));
  });
});
