/**
 * Stage 4C Test Suite: Tenant-Scoped Detection REST APIs
 *
 * Verifies:
 * 1. Authentication and RBAC enforcement on detection endpoints.
 * 2. Listing and detail queries for BehavioralAssessments.
 * 3. Model listing and authorized training triggers.
 * 4. Detection rules catalogue endpoint.
 * 5. Research evaluation benchmark execution endpoint.
 * 6. Cross-tenant isolation (Tenant A cannot access Tenant B's assessments or models).
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import { getPrismaClient, disconnectDatabase } from '../src/db/client.js';

describe('Stage 4C: Tenant-Scoped Detection REST APIs', () => {
  let app;
  let server;
  let baseUrl;
  let prisma;
  let ownerApexCookie;
  let ownerApexCsrf;
  let analystMedCookie;
  let analystMedCsrf;
  let tenantApexId;
  let tenantMedId;
  let appApexId;
  let testAssessmentId;

  before(async () => {
    const config = loadEnv();
    app = createApp({ envConfig: config });
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => resolve());
    });
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}/api/v1`;
    prisma = getPrismaClient();

    // Resolve tenant IDs
    const tApex = await prisma.tenant.findUnique({ where: { identifier: 'tenant-apex-9941' } });
    const tMed = await prisma.tenant.findUnique({ where: { identifier: 'tenant-medsecure-7712' } });
    tenantApexId = tApex.id;
    tenantMedId = tMed.id;

    const appApex = await prisma.protectedApplication.findFirst({ where: { tenantId: tenantApexId } });
    appApexId = appApex.id;

    // Login Owner Apex
    const resLoginApex = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner@apexfintech.io', password: 'DevOwner12345!' })
    });
    const apexCookies = resLoginApex.headers.get('set-cookie');
    ownerApexCookie = apexCookies ? apexCookies.split(';')[0] : '';
    const apexBody = await resLoginApex.json();
    ownerApexCsrf = apexBody.data.csrfToken;

    // Login Analyst MedSecure
    const resLoginMed = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'analyst@medsecure.io', password: 'DevAnalyst12345!' })
    });
    const medCookies = resLoginMed.headers.get('set-cookie');
    analystMedCookie = medCookies ? medCookies.split(';')[0] : '';
    const medBody = await resLoginMed.json();
    analystMedCsrf = medBody.data.csrfToken;

    // Seed a test assessment for Apex
    const testAssessment = await prisma.behavioralAssessment.create({
      data: {
        tenantId: tenantApexId,
        applicationId: appApexId,
        sessionRef: 'sess-api-test-01',
        windowLabel: '5m',
        assessmentLabel: 'SUSPICIOUS',
        classification: 'RULE_AUTH_FAILURE',
        riskScore: 0.65,
        confidenceScore: 0.88,
        modelOrRuleVersion: 'hybrid-rules-v1+ml-none',
        ruleFindings: [{ ruleId: 'RULE_AUTH_FAILURE', triggered: true }],
        mlAnomalyResult: { modelStatus: 'NO_MODEL_AVAILABLE' },
        explanation: { summary: 'API test assessment' }
      }
    });
    testAssessmentId = testAssessment.id;
  });

  after(async () => {
    if (testAssessmentId) {
      await prisma.behavioralAssessment.deleteMany({ where: { id: testAssessmentId } });
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDatabase();
  });

  // --------------------------------------------------------------------------
  // 1. Unauthenticated & Authorization Guards
  // --------------------------------------------------------------------------
  test('1. Unauthenticated request to detection assessments returns 401', async () => {
    const res = await fetch(`${baseUrl}/tenants/${tenantApexId}/detection/assessments`);
    assert.equal(res.status, 401);
  });

  test('2. Cross-tenant access denied: Analyst MedSecure cannot access Apex assessments (403)', async () => {
    const res = await fetch(`${baseUrl}/tenants/${tenantApexId}/detection/assessments`, {
      headers: { Cookie: analystMedCookie }
    });
    assert.equal(res.status, 403);
  });

  // --------------------------------------------------------------------------
  // 2. Listing & Retrieving Assessments
  // --------------------------------------------------------------------------
  test('3. GET /detection/assessments lists tenant-scoped assessments', async () => {
    const res = await fetch(`${baseUrl}/tenants/${tenantApexId}/detection/assessments`, {
      headers: { Cookie: ownerApexCookie }
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.data.total >= 1);
    assert.ok(Array.isArray(json.data.assessments));
  });

  test('4. GET /detection/assessments/:id retrieves detailed assessment with findings and ML results', async () => {
    const res = await fetch(`${baseUrl}/tenants/${tenantApexId}/detection/assessments/${testAssessmentId}`, {
      headers: { Cookie: ownerApexCookie }
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.id, testAssessmentId);
    assert.equal(json.data.assessmentLabel, 'SUSPICIOUS');
    assert.equal(json.data.classification, 'RULE_AUTH_FAILURE');
    assert.ok(json.data.ruleFindings);
  });

  // --------------------------------------------------------------------------
  // 3. Models & Training Endpoints
  // --------------------------------------------------------------------------
  test('5. GET /detection/models lists application models for tenant', async () => {
    const res = await fetch(`${baseUrl}/tenants/${tenantApexId}/detection/models`, {
      headers: { Cookie: ownerApexCookie }
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(Array.isArray(json.data.models));
  });

  test('6. POST /detection/models/train triggers model training with RBAC enforcement', async () => {
    const res = await fetch(`${baseUrl}/tenants/${tenantApexId}/detection/models/train`, {
      method: 'POST',
      headers: {
        Cookie: ownerApexCookie,
        'Content-Type': 'application/json',
        'X-CSRF-Token': ownerApexCsrf
      },
      body: JSON.stringify({
        applicationId: appApexId,
        algorithm: 'ISOLATION_FOREST',
        minSamples: 200
      })
    });

    // Dev DB has fewer than 200 samples, so it cleanly returns 422 INSUFFICIENT_TRAINING_DATA
    assert.equal(res.status, 422);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.data.status, 'INSUFFICIENT_TRAINING_DATA');
  });

  // --------------------------------------------------------------------------
  // 4. Rules & Evaluation Endpoints
  // --------------------------------------------------------------------------
  test('7. GET /detection/rules lists registered rule catalogue with effective thresholds', async () => {
    const res = await fetch(`${baseUrl}/tenants/${tenantApexId}/detection/rules`, {
      headers: { Cookie: ownerApexCookie }
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.data.rules.length >= 6);
    assert.ok(json.data.rules.some((r) => r.ruleId === 'RULE_AUTH_FAILURE'));
  });

  test('8. GET /detection/evaluation executes research benchmark and returns comparative metrics', async () => {
    const res = await fetch(`${baseUrl}/tenants/${tenantApexId}/detection/evaluation`, {
      headers: { Cookie: ownerApexCookie }
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.totalScenarios, 24);
    assert.ok(json.data.comparison.ruleOnly);
    assert.ok(json.data.comparison.iforestOnly);
    assert.ok(json.data.comparison.statisticalBaselineOnly);
    assert.ok(json.data.comparison.hybridAssessment);
    assert.ok(Array.isArray(json.data.perScenarioResults));
    assert.ok(Array.isArray(json.data.disclaimers));
  });
});
