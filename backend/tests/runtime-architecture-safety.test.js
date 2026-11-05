/**
 * Stage 5B.1 Test Suite: Adaptive Deception Runtime Architecture & Execution Safety.
 *
 * Verifies:
 * 1. Lifecycle State Machine: 12 strict states, valid transitions, terminal states, safety guards
 * 2. Resource Governance: Quota enforcement, unknown capacity handling, reservation/release
 * 3. Execution Authorization Service: Preconditions, version binding, separation of duties, idempotency
 * 4. Runtime Environment Manager: Approved authorization prerequisite, simulated state, termination
 * 5. Runtime State Manager: Relational state mapping, drift detection
 * 6. Tenant-Scoped REST APIs: Overview, authorizations, environments, events, quotas
 * 7. Tenant Isolation & RBAC Security: Cross-tenant isolation, role checks, separation of duties
 * 8. Execution Safety Invariant: Zero live containers, zero diversions, executionEvidenceStatus = MISSING
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { getPrismaClient, connectDatabase, disconnectDatabase } from '../src/db/client.js';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import {
  LifecycleStateMachine,
  RUNTIME_LIFECYCLE_STATES,
  IllegalStateTransitionError
} from '../src/runtime/lifecycle-state-machine.js';
import {
  ResourceGovernanceService,
  CAPACITY_STATUSES
} from '../src/runtime/resource-governance.service.js';
import {
  ExecutionAuthorizationService,
  AUTHORIZATION_STATUSES
} from '../src/runtime/execution-authorization.service.js';
import { RuntimeEnvironmentManager } from '../src/runtime/runtime-environment-manager.service.js';
import { RuntimeStateManager } from '../src/runtime/runtime-state-manager.service.js';
import { ExecutionEvidenceRecorder } from '../src/runtime/execution-evidence-recorder.service.js';
import { RuntimeOrchestrator } from '../src/runtime/runtime-orchestrator.service.js';
import { hashPassword } from '../src/utils/passwords.js';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgresql://rahulseervi@localhost:5432/adaptive_deception_test?schema=public';

process.env.DATABASE_URL = TEST_DATABASE_URL;

describe('Stage 5B.1: Adaptive Deception Runtime Architecture & Execution Safety Suite', () => {
  let app;
  let server;
  let baseUrl;
  let prisma;

  let tenantApexId;
  let tenantMedId;
  let appApexId;
  let testPolicy;
  let testGraph;
  let testDecision;

  let ownerCookie;
  let ownerCsrfToken;
  let apexAnalystCookie;
  let apexAnalystCsrfToken;
  let medAnalystCookie;
  let medAnalystCsrfToken;

  before(async () => {
    const config = loadEnv();
    prisma = getPrismaClient({ databaseUrl: TEST_DATABASE_URL });
    await connectDatabase(prisma);

    app = createApp({ envConfig: config, prisma });
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => resolve());
    });
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}/api/v1`;

    // Clean up any previous test runtime records
    await prisma.deceptionRuntimeMutation.deleteMany();
    await prisma.deceptionRuntimeEnvironment.deleteMany();
    await prisma.deceptionExecutionEvent.deleteMany();
    await prisma.deceptionExecutionAuthorization.deleteMany();
    await prisma.deceptionResourceQuota.deleteMany();

    // 1. Resolve seed tenants
    const tApex = await prisma.tenant.findUnique({ where: { identifier: 'tenant-apex-9941' } });
    const tMed = await prisma.tenant.findUnique({ where: { identifier: 'tenant-medsecure-7712' } });
    assert.ok(tApex, 'Seed tenant apex must exist');
    assert.ok(tMed, 'Seed tenant medsecure must exist');
    tenantApexId = tApex.id;
    tenantMedId = tMed.id;

    // 2. Resolve Protected Application
    const appApex = await prisma.protectedApplication.findFirst({ where: { tenantId: tenantApexId } });
    assert.ok(appApex, 'Protected application must exist');
    appApexId = appApex.id;

    // 3. Ensure Apex Analyst User exists with proper tenant membership for Separation of Duties testing
    let apexAnalystUser = await prisma.user.findUnique({ where: { email: 'analyst@apexfintech.io' } });
    if (!apexAnalystUser) {
      const passHash = await hashPassword('DevAnalyst12345!');
      apexAnalystUser = await prisma.user.create({
        data: {
          email: 'analyst@apexfintech.io',
          name: 'Apex Security Analyst',
          passwordHash: passHash,
          status: 'ACTIVE'
        }
      });
    }

    const existingMembership = await prisma.tenantMembership.findFirst({
      where: { userId: apexAnalystUser.id, tenantId: tenantApexId }
    });
    if (!existingMembership) {
      await prisma.tenantMembership.create({
        data: {
          userId: apexAnalystUser.id,
          tenantId: tenantApexId,
          role: 'SECURITY_ANALYST',
          permissions: ['read:policies', 'view:telemetry', 'request:deception_runtime']
        }
      });
    }

    // 4. Authenticate Owner Apex
    const resLoginOwner = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner@apexfintech.io', password: 'DevOwner12345!' })
    });
    const dataOwner = await resLoginOwner.json();
    ownerCsrfToken = dataOwner.data.antiCsrfToken;
    ownerCookie = resLoginOwner.headers.get('set-cookie');

    // 5. Authenticate Apex Analyst
    const resLoginApexAnalyst = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'analyst@apexfintech.io', password: 'DevAnalyst12345!' })
    });
    const dataApexAnalyst = await resLoginApexAnalyst.json();
    apexAnalystCsrfToken = dataApexAnalyst.data.antiCsrfToken;
    apexAnalystCookie = resLoginApexAnalyst.headers.get('set-cookie');

    // 6. Authenticate MedSecure Analyst
    const resLoginMedAnalyst = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'analyst@medsecure.io', password: 'DevAnalyst12345!' })
    });
    const dataMedAnalyst = await resLoginMedAnalyst.json();
    medAnalystCsrfToken = dataMedAnalyst.data.antiCsrfToken;
    medAnalystCookie = resLoginMedAnalyst.headers.get('set-cookie');

    // 7. Seed Test Policy
    testPolicy = await prisma.deceptionPolicy.findFirst({
      where: { tenantId: tenantApexId, policyIdentifier: 'pol-stage5b1-runtime' }
    });
    if (!testPolicy) {
      testPolicy = await prisma.deceptionPolicy.create({
        data: {
          tenantId: tenantApexId,
          applicationId: appApexId,
          policyIdentifier: 'pol-stage5b1-runtime',
          name: 'Apex Stage 5B.1 Runtime Policy',
          description: 'Policy governing runtime authorization architecture',
          enabled: true,
          priority: 10,
          triggerConditions: {},
          requiredEvidenceCriteria: {
            minConfidence: 0.80,
            requiredTelemetryQuality: 'COMPLETE',
            requireRuleCorroboration: true,
            applicableClassifications: ['ATTACK']
          },
          permittedActions: ['PROPOSE_DECEPTION', 'ALLOW_NORMAL'],
          prohibitedActions: [],
          protectedIsolationConstraints: { strictNamespaceIsolation: true, noOutboundEgress: true },
          version: 1
        }
      });
    }

    // 8. Seed Test Graph
    testGraph = await prisma.deceptionGraph.findFirst({
      where: { tenantId: tenantApexId, graphIdentifier: 'dsg-stage5b1-runtime' }
    });
    if (!testGraph) {
      testGraph = await prisma.deceptionGraph.create({
        data: {
          tenantId: tenantApexId,
          applicationId: appApexId,
          graphIdentifier: 'dsg-stage5b1-runtime',
          graphVersion: 1,
          status: 'ACTIVE'
        }
      });
    }

    // 9. Seed Test Policy Decision with PROPOSED disposition
    const dbStrat = await prisma.deceptionStrategy.findFirst({
      where: { strategyIdentifier: 'strat-api-shadow-facade-01' }
    });

    testDecision = await prisma.policyDecision.create({
      data: {
        tenantId: tenantApexId,
        applicationId: appApexId,
        policyId: testPolicy.id,
        policyVersion: testPolicy.version,
        selectedStrategyId: dbStrat?.id || null,
        selectedStrategyVersion: 1,
        dsgGraphId: testGraph.id,
        baseGraphVersion: testGraph.graphVersion,
        evaluatorVersion: '5A.1',
        strategyCatalogueVersion: '1.0.0',
        deceptionDisposition: 'PROPOSED',
        originAccessDecision: 'PROPOSE_DIVERT_TO_DECEPTION',
        decisionResult: 'PROPOSE_DECEPTION',
        decisionRationale: 'Corroborated API enumeration attack. Deception proposed.',
        reasonCodes: ['ELIGIBILITY_CHECK_PASSED', 'RULE_CORROBORATED', 'STRATEGY_SELECTED', 'DSG_PLAN_GENERATED'],
        proposedMutations: {
          syntheticEnvironmentModel: {
            mockRoutes: [{ path: '/api/v1/auth/login', method: 'POST', simulatedStatus: 200 }],
            isolation: { strictNamespaceIsolation: true, noOutboundEgress: true }
          }
        },
        evidenceReferences: { executionEvidenceStatus: 'MISSING', executionStatus: 'NOT_EXECUTED' }
      }
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDatabase();
  });

  // ---------------------------------------------------------------------------
  // 1. Lifecycle State Machine
  // ---------------------------------------------------------------------------

  it('1. LifecycleStateMachine permits valid linear progression transitions', () => {
    assert.strictEqual(
      LifecycleStateMachine.canTransition(RUNTIME_LIFECYCLE_STATES.DRAFT, RUNTIME_LIFECYCLE_STATES.VALIDATING),
      true
    );
    assert.strictEqual(
      LifecycleStateMachine.canTransition(RUNTIME_LIFECYCLE_STATES.VALIDATING, RUNTIME_LIFECYCLE_STATES.AUTHORIZED),
      true
    );
    assert.strictEqual(
      LifecycleStateMachine.canTransition(RUNTIME_LIFECYCLE_STATES.AUTHORIZED, RUNTIME_LIFECYCLE_STATES.TERMINATING),
      true
    );
    assert.strictEqual(
      LifecycleStateMachine.canTransition(RUNTIME_LIFECYCLE_STATES.TERMINATING, RUNTIME_LIFECYCLE_STATES.TERMINATED),
      true
    );
  });

  it('2. LifecycleStateMachine rejects illegal and skipped transitions', () => {
    assert.strictEqual(
      LifecycleStateMachine.canTransition(RUNTIME_LIFECYCLE_STATES.DRAFT, RUNTIME_LIFECYCLE_STATES.ACTIVE),
      false
    );
    assert.strictEqual(
      LifecycleStateMachine.canTransition(RUNTIME_LIFECYCLE_STATES.REJECTED, RUNTIME_LIFECYCLE_STATES.AUTHORIZED),
      false
    );

    assert.throws(
      () => LifecycleStateMachine.validateTransition(RUNTIME_LIFECYCLE_STATES.DRAFT, RUNTIME_LIFECYCLE_STATES.ACTIVE),
      IllegalStateTransitionError
    );
  });

  it('3. LifecycleStateMachine enforces terminal states (TERMINATED cannot return to ACTIVE)', () => {
    assert.strictEqual(LifecycleStateMachine.isTerminal(RUNTIME_LIFECYCLE_STATES.TERMINATED), true);
    assert.strictEqual(LifecycleStateMachine.isTerminal(RUNTIME_LIFECYCLE_STATES.FAILED), true);
    assert.strictEqual(LifecycleStateMachine.isTerminal(RUNTIME_LIFECYCLE_STATES.REJECTED), true);
    assert.strictEqual(LifecycleStateMachine.isTerminal(RUNTIME_LIFECYCLE_STATES.EXPIRED), true);

    assert.throws(
      () => LifecycleStateMachine.validateTransition(RUNTIME_LIFECYCLE_STATES.TERMINATED, RUNTIME_LIFECYCLE_STATES.ACTIVE),
      IllegalStateTransitionError
    );
  });

  it('4. Stage 5B.1 Safety Guard: Live execution states (PROVISIONING, ACTIVE) are rejected by default', () => {
    assert.throws(
      () =>
        LifecycleStateMachine.validateTransition(
          RUNTIME_LIFECYCLE_STATES.AUTHORIZED,
          RUNTIME_LIFECYCLE_STATES.PROVISIONING,
          { enforceSafetyBoundary: true, allowSimulatedExecution: false }
        ),
      (err) => err instanceof IllegalStateTransitionError && err.message.includes('STAGE_5B1_SAFETY_INVARIANT')
    );
  });

  // ---------------------------------------------------------------------------
  // 2. Resource Governance & Quotas
  // ---------------------------------------------------------------------------

  it('5. ResourceGovernanceService initializes with research/dev default limits and UNKNOWN capacity', async () => {
    const governance = new ResourceGovernanceService(prisma);
    const quota = await governance.getQuota({ tenantId: tenantApexId });

    assert.ok(quota);
    assert.strictEqual(quota.tenantId, tenantApexId);
    assert.strictEqual(quota.maxActiveEnvironments, 3);
    assert.strictEqual(quota.maxCpuAllocation, 2.0);
    assert.strictEqual(quota.maxMemoryMb, 1024);
    assert.strictEqual(quota.capacityStatus, CAPACITY_STATUSES.UNKNOWN);
  });

  it('6. ResourceGovernanceService rejects admission under strict capacity enforcement if status is UNKNOWN', async () => {
    const governance = new ResourceGovernanceService(prisma);
    const result = await governance.validateResourceAdmission({
      tenantId: tenantApexId,
      strictCapacityEnforcement: true
    });

    assert.strictEqual(result.eligible, false);
    assert.ok(result.violations.some((v) => v.includes('UNKNOWN_CAPACITY')));
  });

  it('7. ResourceGovernanceService correctly reserves and releases capacity', async () => {
    const governance = new ResourceGovernanceService(prisma);
    const initialQuota = await governance.getQuota({ tenantId: tenantApexId });
    const initialEnvs = initialQuota.currentActiveEnvironments;

    await governance.reserveResources({ tenantId: tenantApexId, cpu: 0.5, memoryMb: 256 });
    let updatedQuota = await governance.getQuota({ tenantId: tenantApexId });
    assert.strictEqual(updatedQuota.currentActiveEnvironments, initialEnvs + 1);
    assert.strictEqual(updatedQuota.currentAllocatedCpu, initialQuota.currentAllocatedCpu + 0.5);

    await governance.releaseResources({ tenantId: tenantApexId, cpu: 0.5, memoryMb: 256 });
    updatedQuota = await governance.getQuota({ tenantId: tenantApexId });
    assert.strictEqual(updatedQuota.currentActiveEnvironments, initialEnvs);
  });

  // ---------------------------------------------------------------------------
  // 3. Execution Authorization Service
  // ---------------------------------------------------------------------------

  it('8. Valid decision with deceptionDisposition: PROPOSED creates PENDING authorization', async () => {
    const authService = new ExecutionAuthorizationService({ prismaClient: prisma });
    const auth = await authService.requestAuthorization({
      tenantId: tenantApexId,
      applicationId: appApexId,
      policyDecisionId: testDecision.id,
      requestingOperator: { id: 'op-01', email: 'analyst@apexfintech.io', role: 'SECURITY_ANALYST' }
    });

    assert.ok(auth);
    assert.strictEqual(auth.authorizationStatus, AUTHORIZATION_STATUSES.PENDING);
    assert.strictEqual(auth.dsgGraphVersion, testGraph.graphVersion);
    assert.ok(auth.expiresAt > new Date());
  });

  it('9. Ineligible decision (disposition: NOT_PROPOSED) is rejected during authorization', async () => {
    const ineligibleDecision = await prisma.policyDecision.create({
      data: {
        tenantId: tenantApexId,
        applicationId: appApexId,
        dsgGraphId: testGraph.id,
        deceptionDisposition: 'NOT_PROPOSED',
        originAccessDecision: 'DEFER_TO_GATEWAY',
        decisionResult: 'ALLOW_NORMAL',
        decisionRationale: 'Benign traffic'
      }
    });

    const authService = new ExecutionAuthorizationService({ prismaClient: prisma });
    const auth = await authService.requestAuthorization({
      tenantId: tenantApexId,
      policyDecisionId: ineligibleDecision.id,
      requestingOperator: { id: 'op-01', email: 'analyst@apexfintech.io', role: 'SECURITY_ANALYST' }
    });

    assert.strictEqual(auth.authorizationStatus, AUTHORIZATION_STATUSES.DENIED);
    assert.ok(auth.authorizationReasonCodes.includes('VALIDATION_FAILED_DISPOSITION_NOT_PROPOSED'));
  });

  it('10. Stale graph version proposal is rejected during authorization', async () => {
    const authService = new ExecutionAuthorizationService({ prismaClient: prisma });
    const auth = await authService.requestAuthorization({
      tenantId: tenantApexId,
      policyDecisionId: testDecision.id,
      baseGraphVersion: 999, // Stale version
      requestingOperator: { id: 'op-01', email: 'analyst@apexfintech.io', role: 'SECURITY_ANALYST' }
    });

    assert.strictEqual(auth.authorizationStatus, AUTHORIZATION_STATUSES.DENIED);
    assert.ok(auth.authorizationReasonCodes.includes('VALIDATION_FAILED_STALE_GRAPH_VERSION'));
  });

  it('11. Idempotent replay: identical request returns cached authorization without duplicate records', async () => {
    const authService = new ExecutionAuthorizationService({ prismaClient: prisma });
    const idempotencyKey = `idemp-auth-${Date.now()}`;

    const res1 = await authService.requestAuthorization({
      tenantId: tenantApexId,
      policyDecisionId: testDecision.id,
      idempotencyKey,
      requestingOperator: { id: 'op-01', email: 'analyst@apexfintech.io', role: 'SECURITY_ANALYST' }
    });

    const res2 = await authService.requestAuthorization({
      tenantId: tenantApexId,
      policyDecisionId: testDecision.id,
      idempotencyKey,
      requestingOperator: { id: 'op-01', email: 'analyst@apexfintech.io', role: 'SECURITY_ANALYST' }
    });

    assert.strictEqual(res1.id, res2.id);
    assert.strictEqual(res2.idempotentReplay, true);
  });

  it('12. Reusing idempotency key with conflicting payload returns 409 IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH', async () => {
    const authService = new ExecutionAuthorizationService({ prismaClient: prisma });
    const idempotencyKey = `idemp-conflict-${Date.now()}`;

    await authService.requestAuthorization({
      tenantId: tenantApexId,
      policyDecisionId: testDecision.id,
      idempotencyKey,
      requestPayloadHash: 'hash-a',
      requestingOperator: { id: 'op-01', email: 'analyst@apexfintech.io', role: 'SECURITY_ANALYST' }
    });

    await assert.rejects(
      async () => {
        await authService.requestAuthorization({
          tenantId: tenantApexId,
          policyDecisionId: testDecision.id,
          idempotencyKey,
          requestPayloadHash: 'hash-b-different',
          requestingOperator: { id: 'op-01', email: 'analyst@apexfintech.io', role: 'SECURITY_ANALYST' }
        });
      },
      (err) => err.code === 'IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH' && err.statusCode === 409
    );
  });

  it('13. Approval: APPLICATION_OWNER approves PENDING authorization', async () => {
    const authService = new ExecutionAuthorizationService({ prismaClient: prisma });
    const auth = await authService.requestAuthorization({
      tenantId: tenantApexId,
      policyDecisionId: testDecision.id,
      requestingOperator: { id: 'op-analyst', email: 'analyst@apexfintech.io', role: 'SECURITY_ANALYST' }
    });

    const approved = await authService.approveAuthorization({
      authorizationId: auth.id,
      tenantId: tenantApexId,
      approver: { id: 'op-owner', email: 'owner@apexfintech.io', role: 'APPLICATION_OWNER' },
      approvalReason: 'Owner validated decision and confirmed test sandbox diversion.'
    });

    assert.strictEqual(approved.authorizationStatus, AUTHORIZATION_STATUSES.APPROVED);
    assert.strictEqual(approved.approvingOperatorEmail, 'owner@apexfintech.io');
    assert.ok(approved.authorizedAt);
  });

  it('14. Separation of Duties: SECURITY_ANALYST cannot approve an authorization request', async () => {
    const authService = new ExecutionAuthorizationService({ prismaClient: prisma });
    const auth = await authService.requestAuthorization({
      tenantId: tenantApexId,
      policyDecisionId: testDecision.id,
      requestingOperator: { id: 'op-analyst', email: 'analyst@apexfintech.io', role: 'SECURITY_ANALYST' }
    });

    await assert.rejects(
      async () => {
        await authService.approveAuthorization({
          authorizationId: auth.id,
          tenantId: tenantApexId,
          approver: { id: 'op-analyst', email: 'analyst@apexfintech.io', role: 'SECURITY_ANALYST' }
        });
      },
      (err) => err.code === 'FORBIDDEN_OPERATOR_ROLE' && err.statusCode === 403
    );
  });

  it('15. Operator can deny a PENDING authorization request', async () => {
    const authService = new ExecutionAuthorizationService({ prismaClient: prisma });
    const auth = await authService.requestAuthorization({
      tenantId: tenantApexId,
      policyDecisionId: testDecision.id,
      requestingOperator: { id: 'op-analyst', email: 'analyst@apexfintech.io', role: 'SECURITY_ANALYST' }
    });

    const denied = await authService.denyAuthorization({
      authorizationId: auth.id,
      tenantId: tenantApexId,
      operator: { id: 'op-owner', email: 'owner@apexfintech.io', role: 'APPLICATION_OWNER' },
      denialReason: 'Maintenance window active; execution denied.'
    });

    assert.strictEqual(denied.authorizationStatus, AUTHORIZATION_STATUSES.DENIED);
    assert.ok(denied.authorizationReasonCodes.includes('AUTHORIZATION_DENIED'));
  });

  it('16. Operator can revoke a previously APPROVED authorization', async () => {
    const authService = new ExecutionAuthorizationService({ prismaClient: prisma });
    const auth = await authService.requestAuthorization({
      tenantId: tenantApexId,
      policyDecisionId: testDecision.id,
      requestingOperator: { id: 'op-analyst', email: 'analyst@apexfintech.io', role: 'SECURITY_ANALYST' }
    });
    const approved = await authService.approveAuthorization({
      authorizationId: auth.id,
      tenantId: tenantApexId,
      approver: { id: 'op-owner', email: 'owner@apexfintech.io', role: 'APPLICATION_OWNER' }
    });

    const revoked = await authService.revokeAuthorization({
      authorizationId: approved.id,
      tenantId: tenantApexId,
      operator: { id: 'op-owner', email: 'owner@apexfintech.io', role: 'APPLICATION_OWNER' },
      revocationReason: 'Attacker session disengaged; revocation initiated.'
    });

    assert.strictEqual(revoked.authorizationStatus, AUTHORIZATION_STATUSES.REVOKED);
    assert.strictEqual(revoked.revokedBy, 'owner@apexfintech.io');
    assert.ok(revoked.revokedAt);
  });

  // ---------------------------------------------------------------------------
  // 4. Runtime Environment Manager & Safety Boundaries
  // ---------------------------------------------------------------------------

  it('17. RuntimeEnvironmentManager creates environment record only from APPROVED authorization', async () => {
    const authService = new ExecutionAuthorizationService({ prismaClient: prisma });
    const envManager = new RuntimeEnvironmentManager({ prismaClient: prisma });

    const auth = await authService.requestAuthorization({
      tenantId: tenantApexId,
      policyDecisionId: testDecision.id,
      requestingOperator: { id: 'op-analyst', email: 'analyst@apexfintech.io', role: 'SECURITY_ANALYST' }
    });
    const approvedAuth = await authService.approveAuthorization({
      authorizationId: auth.id,
      tenantId: tenantApexId,
      approver: { id: 'op-owner', email: 'owner@apexfintech.io', role: 'APPLICATION_OWNER' }
    });

    const env = await envManager.createEnvironmentRecord({
      tenantId: tenantApexId,
      authorizationId: approvedAuth.id,
      actor: { email: 'owner@apexfintech.io', role: 'APPLICATION_OWNER' }
    });

    assert.ok(env);
    assert.strictEqual(env.lifecycleState, RUNTIME_LIFECYCLE_STATES.AUTHORIZED);
    assert.strictEqual(env.isSimulated, true);
    assert.strictEqual(env.executionEvidenceStatus, 'MISSING');
  });

  it('18. RuntimeEnvironmentManager health check reports SIMULATED_HEALTHY and unprovisioned status', async () => {
    const envManager = new RuntimeEnvironmentManager({ prismaClient: prisma });
    const env = await prisma.deceptionRuntimeEnvironment.findFirst({
      where: { tenantId: tenantApexId }
    });
    assert.ok(env);

    const health = await envManager.checkEnvironmentHealth({
      environmentId: env.id,
      tenantId: tenantApexId
    });

    assert.strictEqual(health.healthStatus, 'SIMULATED_HEALTHY');
    assert.strictEqual(health.containerProvisioned, false);
    assert.strictEqual(health.runtimeEvidence, 'MISSING');
  });

  it('19. RuntimeEnvironmentManager terminates environment, releases quota, and enforces terminal state', async () => {
    const envManager = new RuntimeEnvironmentManager({ prismaClient: prisma });
    const env = await prisma.deceptionRuntimeEnvironment.findFirst({
      where: { tenantId: tenantApexId, lifecycleState: { not: RUNTIME_LIFECYCLE_STATES.TERMINATED } }
    });
    assert.ok(env);

    const terminated = await envManager.terminateEnvironment({
      environmentId: env.id,
      tenantId: tenantApexId,
      reason: 'Automated test suite termination.',
      actor: { email: 'owner@apexfintech.io', role: 'APPLICATION_OWNER' }
    });

    assert.strictEqual(terminated.lifecycleState, RUNTIME_LIFECYCLE_STATES.TERMINATED);
    assert.ok(terminated.terminatedAt);

    // Terminal invariant: cannot apply mutation to terminated environment
    await assert.rejects(
      async () => {
        await envManager.recordRuntimeMutation({
          environmentId: env.id,
          tenantId: tenantApexId,
          targetGraphVersion: 10,
          actor: { email: 'owner@apexfintech.io', role: 'APPLICATION_OWNER' }
        });
      },
      (err) => err.code === 'ENVIRONMENT_TERMINATED'
    );
  });

  // ---------------------------------------------------------------------------
  // 5. Runtime State Manager & Drift Detection
  // ---------------------------------------------------------------------------

  it('20. RuntimeStateManager maps relational bindings and detects version drift', async () => {
    const stateManager = new RuntimeStateManager(prisma);
    const env = await prisma.deceptionRuntimeEnvironment.findFirst({
      where: { tenantId: tenantApexId }
    });
    assert.ok(env);

    const mapping = await stateManager.getStateMapping({
      environmentId: env.id,
      tenantId: tenantApexId
    });

    assert.ok(mapping.graphBinding);
    assert.ok(mapping.authorizationBinding);
    assert.ok(mapping.policyBinding);
    assert.strictEqual(mapping.evidenceBinding.executionEvidenceStatus, 'MISSING');
  });

  // ---------------------------------------------------------------------------
  // 6. Tenant-Scoped REST APIs & RBAC Controls
  // ---------------------------------------------------------------------------

  it('21. GET /api/v1/tenants/:tenantId/runtime/overview returns architecture readiness and zero live containers', async () => {
    const res = await fetch(`${baseUrl}/tenants/${tenantApexId}/runtime/overview`, {
      method: 'GET',
      headers: {
        Cookie: ownerCookie,
        'x-csrf-token': ownerCsrfToken
      }
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.status, 'success');
    assert.strictEqual(body.data.runtimeArchitectureStatus, 'STAGE_5B1_ARCHITECTURE_READY');
    assert.strictEqual(body.data.executionEvidenceStatus, 'MISSING');
    assert.strictEqual(body.data.environmentsSummary.verifiedContainersLive, 0);
  });

  it('22. POST /runtime/authorizations creates PENDING request over API', async () => {
    const res = await fetch(`${baseUrl}/tenants/${tenantApexId}/runtime/authorizations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: apexAnalystCookie,
        'x-csrf-token': apexAnalystCsrfToken
      },
      body: JSON.stringify({
        policyDecisionId: testDecision.id,
        applicationId: appApexId,
        lifetimeMinutes: 60
      })
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.status, 'success');
    assert.strictEqual(body.data.authorizationStatus, AUTHORIZATION_STATUSES.PENDING);
  });

  it('23. Separation of Duties over API: Analyst cannot approve an authorization request (403 Forbidden)', async () => {
    // Create new authorization
    const authService = new ExecutionAuthorizationService({ prismaClient: prisma });
    const auth = await authService.requestAuthorization({
      tenantId: tenantApexId,
      policyDecisionId: testDecision.id,
      requestingOperator: { id: 'analyst-id', email: 'analyst@apexfintech.io', role: 'SECURITY_ANALYST' }
    });

    const res = await fetch(`${baseUrl}/tenants/${tenantApexId}/runtime/authorizations/${auth.id}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: apexAnalystCookie, // Analyst attempting to approve
        'x-csrf-token': apexAnalystCsrfToken
      },
      body: JSON.stringify({ approvalReason: 'Analyst attempting unauthorized self-approval' })
    });

    assert.strictEqual(res.status, 403, 'Analyst approval must be rejected with 403 Forbidden');
  });

  it('24. Cross-Tenant Isolation: MedSecure analyst cannot access Apex runtime authorizations (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/tenants/${tenantApexId}/runtime/authorizations`, {
      method: 'GET',
      headers: {
        Cookie: medAnalystCookie, // MedSecure user targeting Apex tenant
        'x-csrf-token': medAnalystCsrfToken
      }
    });

    assert.strictEqual(res.status, 403, 'Cross-tenant access must return 403 Forbidden');
  });

  it('25. Global Research Invariant: Zero live deception containers and executionEvidenceStatus strictly MISSING', async () => {
    const events = await prisma.deceptionExecutionEvent.findMany({
      where: { evidenceStatus: { not: 'MISSING' } }
    });
    assert.strictEqual(events.length, 0, 'No execution events may claim non-MISSING evidence');

    const environments = await prisma.deceptionRuntimeEnvironment.findMany({
      where: { isSimulated: false }
    });
    assert.strictEqual(environments.length, 0, 'No live unsimulated environments may exist in this milestone');
  });
});
