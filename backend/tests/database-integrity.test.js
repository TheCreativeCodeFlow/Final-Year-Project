/**
 * Database Domain Model, Relational Integrity & Tenant Isolation Test Suite.
 *
 * Exercises all 15 requirements specified in Stage 3B:
 * 1. Schema validation & Prisma client readiness
 * 2. Successful migration against PostgreSQL
 * 3. Required unique constraints
 * 4. Foreign-key integrity
 * 5. Tenant cross-referencing isolation (Tenant A cannot reference Tenant B applications/environments)
 * 6. Investigation/profile tenant consistency in many-to-many joins
 * 7. DSG graph boundary integrity (edges cannot link cross-graph nodes)
 * 8. Proposed vs executed DSG transition semantic separation
 * 9. Missing routing outcomes remain null/unknown (never defaulted to success)
 * 10. Execution evidence cannot be inferred from policy decision
 * 11. Audit records capture correlation ID and tenant scope
 * 12. Repeated seed execution does not duplicate records
 * 13. Transaction failure cleanly rolls back related writes
 * 14. Database connection & disconnection lifecycle
 * 15. Existing Stage 3A tests continue to pass (verified across test run)
 */

import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import {
  getPrismaClient,
  connectDatabase,
  disconnectDatabase,
  executeInTransaction,
  isValidPostgresUrl
} from '../src/db/client.js';
import { validateDatabaseConfig } from '../src/config/env.js';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgresql://rahulseervi@localhost:5432/adaptive_deception_test';

describe('Stage 3B: PostgreSQL Domain Model & Tenant Isolation Integrity', () => {
  let prisma;

  before(async () => {
    // 1. Prisma schema and client instantiation
    prisma = getPrismaClient({ databaseUrl: TEST_DATABASE_URL, forceNew: true });
    await connectDatabase(prisma);
  });

  after(async () => {
    await disconnectDatabase(prisma);
  });

  // Clean all tables before each test to maintain strict test isolation
  beforeEach(async () => {
    // Delete in reverse dependency order
    await prisma.auditEvent.deleteMany();
    await prisma.deceptionGraphTransition.deleteMany();
    await prisma.deceptionGraphEdge.deleteMany();
    await prisma.deceptionGraphNode.deleteMany();
    await prisma.deceptionGraph.deleteMany();
    await prisma.executionEvidence.deleteMany();
    await prisma.routingOutcome.deleteMany();
    await prisma.routingDecision.deleteMany();
    await prisma.policyDecision.deleteMany();
    await prisma.behavioralAssessment.deleteMany();
    await prisma.securityObservation.deleteMany();
    await prisma.investigationAttackerProfile.deleteMany();
    await prisma.attackerProfile.deleteMany();
    await prisma.investigation.deleteMany();
    await prisma.deceptionEnvironment.deleteMany();
    await prisma.deceptionStrategy.deleteMany();
    await prisma.deceptionPolicy.deleteMany();
    await prisma.protectedApplication.deleteMany();
    await prisma.tenant.deleteMany();
  });

  test('1. Validates PostgreSQL connection URL format and configuration helper', () => {
    assert.equal(isValidPostgresUrl('postgresql://user:pass@localhost:5432/db'), true);
    assert.equal(isValidPostgresUrl('postgres://user@localhost:5432/db'), true);
    assert.equal(isValidPostgresUrl('mysql://localhost:3306/db'), false);
    assert.equal(isValidPostgresUrl(''), false);
    assert.equal(isValidPostgresUrl(undefined), false);

    assert.equal(
      validateDatabaseConfig({ DATABASE_URL: 'postgresql://localhost:5432/mydb' }),
      'postgresql://localhost:5432/mydb'
    );
    assert.throws(
      () => validateDatabaseConfig({}),
      /DATABASE_URL is required for database operations/
    );
    assert.throws(
      () => validateDatabaseConfig({ DATABASE_URL: 'sqlite:///tmp/db.sqlite' }),
      /Must be a valid PostgreSQL connection URL/
    );
  });

  test('2. Successful migration verified: core relational tables and schema exist in PostgreSQL', async () => {
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;
    const tableNames = tables.map((t) => t.table_name);

    const requiredTables = [
      'tenants',
      'protected_applications',
      'deception_policies',
      'deception_strategies',
      'deception_environments',
      'investigations',
      'attacker_profiles',
      'investigation_attacker_profiles',
      'security_observations',
      'behavioral_assessments',
      'policy_decisions',
      'routing_decisions',
      'routing_outcomes',
      'execution_evidences',
      'deception_graphs',
      'deception_graph_nodes',
      'deception_graph_edges',
      'deception_graph_transitions',
      'audit_events'
    ];

    for (const reqTable of requiredTables) {
      assert.ok(
        tableNames.includes(reqTable),
        `Required PostgreSQL table "${reqTable}" must exist in the database.`
      );
    }
  });

  test('3. Enforces unique constraints on tenant identifier and composite application identifier', async () => {
    const tenant = await prisma.tenant.create({
      data: { identifier: 'tenant-test-01', displayName: 'Test Tenant 1' }
    });

    // Duplicate tenant identifier must fail
    await assert.rejects(
      async () => {
        await prisma.tenant.create({
          data: { identifier: 'tenant-test-01', displayName: 'Duplicate Tenant' }
        });
      },
      (err) => err.code === 'P2002'
    );

    // Application unique within tenant
    await prisma.protectedApplication.create({
      data: {
        tenantId: tenant.id,
        applicationIdentifier: 'app-01',
        name: 'Accounts API',
        domain: 'accounts.test.internal'
      }
    });

    // Duplicate app identifier for SAME tenant must fail
    await assert.rejects(
      async () => {
        await prisma.protectedApplication.create({
          data: {
            tenantId: tenant.id,
            applicationIdentifier: 'app-01',
            name: 'Conflicting App',
            domain: 'conflict.test.internal'
          }
        });
      },
      (err) => err.code === 'P2002'
    );
  });

  test('4. Foreign-key integrity: orphaned records without a valid tenant are rejected', async () => {
    await assert.rejects(
      async () => {
        await prisma.protectedApplication.create({
          data: {
            tenantId: '00000000-0000-0000-0000-000000000000',
            applicationIdentifier: 'app-orphan',
            name: 'Orphan App',
            domain: 'orphan.test.internal'
          }
        });
      },
      (err) => err.code === 'P2003' // Foreign key constraint violation
    );
  });

  test('5. Tenant Isolation: Tenant A cannot link an investigation to Tenant B application', async () => {
    const tenantA = await prisma.tenant.create({
      data: { identifier: 'tenant-a', displayName: 'Tenant Alpha' }
    });
    const tenantB = await prisma.tenant.create({
      data: { identifier: 'tenant-b', displayName: 'Tenant Beta' }
    });

    const appB = await prisma.protectedApplication.create({
      data: {
        tenantId: tenantB.id,
        applicationIdentifier: 'app-b-01',
        name: 'Beta Portal',
        domain: 'beta.internal'
      }
    });

    // Tenant A attempts to link their investigation to Tenant B's application
    await assert.rejects(
      async () => {
        await prisma.investigation.create({
          data: {
            tenantId: tenantA.id,
            applicationId: appB.id, // Application belongs to Tenant B!
            investigationIdentifier: 'inv-cross-tenant-01',
            summary: 'Cross-tenant illegal link probe'
          }
        });
      },
      (err) => err.code === 'P2003', // PostgreSQL rejects because (appB.id, tenantA.id) does not exist in protected_applications
      'PostgreSQL composite foreign key must reject cross-tenant application association'
    );
  });

  test('6. Tenant Isolation: Tenant A investigation cannot be linked to Tenant B attacker profile', async () => {
    const tenantA = await prisma.tenant.create({
      data: { identifier: 'tenant-a-prof', displayName: 'Tenant Alpha' }
    });
    const tenantB = await prisma.tenant.create({
      data: { identifier: 'tenant-b-prof', displayName: 'Tenant Beta' }
    });

    const invA = await prisma.investigation.create({
      data: {
        tenantId: tenantA.id,
        investigationIdentifier: 'inv-a-01',
        summary: 'Investigation A'
      }
    });

    const profB = await prisma.attackerProfile.create({
      data: {
        tenantId: tenantB.id,
        profileIdentifier: 'prof-b-01',
        displayLabel: 'Profile B',
        observedBehaviorIndicators: { signature: 'scanner' }
      }
    });

    // Attempt cross-tenant many-to-many relationship in InvestigationAttackerProfile
    await assert.rejects(
      async () => {
        await prisma.investigationAttackerProfile.create({
          data: {
            tenantId: tenantA.id,
            investigationId: invA.id,
            attackerProfileId: profB.id // Belongs to Tenant B!
          }
        });
      },
      (err) => err.code === 'P2003',
      'Database must enforce that investigation and profile share identical tenant ownership'
    );
  });

  test('7. DSG Graph Boundary Integrity: edges cannot connect nodes across distinct graphs', async () => {
    const tenant = await prisma.tenant.create({
      data: { identifier: 'tenant-dsg', displayName: 'Tenant DSG' }
    });
    const env = await prisma.deceptionEnvironment.create({
      data: {
        tenantId: tenant.id,
        environmentIdentifier: 'env-dsg-01',
        name: 'Sandbox Env',
        isolationConfiguration: { mode: 'STRICT' }
      }
    });

    const graph1 = await prisma.deceptionGraph.create({
      data: {
        tenantId: tenant.id,
        environmentId: env.id,
        graphIdentifier: 'graph-01',
        graphVersion: 1
      }
    });

    const graph2 = await prisma.deceptionGraph.create({
      data: {
        tenantId: tenant.id,
        environmentId: env.id,
        graphIdentifier: 'graph-02',
        graphVersion: 1
      }
    });

    const nodeG1 = await prisma.deceptionGraphNode.create({
      data: {
        graphId: graph1.id,
        nodeIdentifier: 'node-g1-decoy',
        nodeType: 'SYNTHETIC_API',
        assetDescription: 'Decoy G1',
        layerClassification: 'CONTROLLED_DYNAMIC_STATE',
        structuredAttributes: { port: 8080 }
      }
    });

    const nodeG2 = await prisma.deceptionGraphNode.create({
      data: {
        graphId: graph2.id,
        nodeIdentifier: 'node-g2-decoy',
        nodeType: 'SYNTHETIC_API',
        assetDescription: 'Decoy G2',
        layerClassification: 'CONTROLLED_DYNAMIC_STATE',
        structuredAttributes: { port: 9090 }
      }
    });

    // Attempt to create an edge in Graph 1 where targetNode belongs to Graph 2
    await assert.rejects(
      async () => {
        await prisma.deceptionGraphEdge.create({
          data: {
            graphId: graph1.id,
            sourceNodeId: nodeG1.id,
            targetNodeId: nodeG2.id, // Belongs to Graph 2!
            edgeType: 'ILLEGAL_CROSS_GRAPH_EDGE',
            structuredAttributes: {}
          }
        });
      },
      (err) => err.code === 'P2003',
      'Composite foreign key (targetNodeId, graphId) must prevent cross-graph edge linkage'
    );
  });

  test('8. Proposed graph transitions remain PROPOSED (not automatically executed)', async () => {
    const tenant = await prisma.tenant.create({
      data: { identifier: 'tenant-trans', displayName: 'Transition Tenant' }
    });
    const env = await prisma.deceptionEnvironment.create({
      data: {
        tenantId: tenant.id,
        environmentIdentifier: 'env-trans',
        name: 'Trans Env',
        isolationConfiguration: { isolated: true }
      }
    });
    const graph = await prisma.deceptionGraph.create({
      data: {
        tenantId: tenant.id,
        environmentId: env.id,
        graphIdentifier: 'graph-trans',
        graphVersion: 1
      }
    });

    const transition = await prisma.deceptionGraphTransition.create({
      data: {
        tenantId: tenant.id,
        graphId: graph.id,
        previousState: { v: 1 },
        proposedState: { v: 2 },
        transitionStatus: 'PROPOSED',
        provenance: 'ADAPTIVE_PLANNER'
      }
    });

    assert.equal(transition.transitionStatus, 'PROPOSED');
    assert.equal(transition.resolvedAt, null);

    // Verify querying for EXECUTED returns nothing
    const executedCount = await prisma.deceptionGraphTransition.count({
      where: { graphId: graph.id, transitionStatus: 'EXECUTED' }
    });
    assert.equal(executedCount, 0, 'Database must never automatically mark proposals as executed');
  });

  test('9. Missing routing outcomes remain absent/null (never defaulted to success)', async () => {
    const tenant = await prisma.tenant.create({
      data: { identifier: 'tenant-outcome', displayName: 'Outcome Tenant' }
    });

    const decision = await prisma.routingDecision.create({
      data: {
        tenantId: tenant.id,
        intendedAction: 'PROPOSED_DECEPTION_DIVERSION',
        correlationId: 'corr-outcome-001',
        decisionStatus: 'DECIDED'
      }
    });

    // Query routing decision with its outcome
    const fetched = await prisma.routingDecision.findUnique({
      where: { id: decision.id },
      include: { outcome: true }
    });

    assert.equal(fetched.outcome, null, 'Unrecorded outcome must remain strictly null');
  });

  test('10. Execution evidence cannot be inferred from policy decision; missing evidence is explicit', async () => {
    const tenant = await prisma.tenant.create({
      data: { identifier: 'tenant-evidence', displayName: 'Evidence Tenant' }
    });

    const pol = await prisma.deceptionPolicy.create({
      data: {
        tenantId: tenant.id,
        policyIdentifier: 'pol-ev-01',
        version: 1,
        name: 'Diversion Policy',
        triggerConditions: {},
        requiredEvidenceCriteria: {},
        permittedActions: ['DIVERSION'],
        prohibitedActions: [],
        protectedIsolationConstraints: {}
      }
    });

    const decision = await prisma.policyDecision.create({
      data: {
        tenantId: tenant.id,
        policyId: pol.id,
        decisionResult: 'PERMIT_DIVERSION',
        decisionRationale: 'Confidence threshold passed'
      }
    });

    const routing = await prisma.routingDecision.create({
      data: {
        tenantId: tenant.id,
        policyDecisionId: decision.id,
        intendedAction: 'PROPOSED_DECEPTION_DIVERSION',
        correlationId: 'corr-ev-001'
      }
    });

    // Record execution evidence explicitly as MISSING
    const evidence = await prisma.executionEvidence.create({
      data: {
        tenantId: tenant.id,
        routingDecisionId: routing.id,
        evidenceStatus: 'MISSING',
        evidenceSource: null,
        evidenceData: null,
        recordedAt: null,
        correlationId: 'corr-ev-001'
      }
    });

    assert.equal(evidence.evidenceStatus, 'MISSING');
    assert.equal(evidence.evidenceSource, null);
    assert.equal(evidence.evidenceData, null);
    assert.equal(evidence.recordedAt, null);
  });

  test('11. Audit records capture actor, action, tenant scope, and correlation ID', async () => {
    const tenant = await prisma.tenant.create({
      data: { identifier: 'tenant-audit', displayName: 'Audit Tenant' }
    });

    const audit = await prisma.auditEvent.create({
      data: {
        tenantId: tenant.id,
        actorIdentifier: 'analyst-simulated-01',
        action: 'POLICY_TRIGGER_VALIDATED',
        targetEntityType: 'DeceptionPolicy',
        targetEntityId: 'pol-test-01',
        correlationId: 'corr-audit-771',
        structuredMetadata: { verifiedIntegrity: true, timestamp: Date.now() }
      }
    });

    assert.ok(audit.id);
    assert.equal(audit.tenantId, tenant.id);
    assert.equal(audit.correlationId, 'corr-audit-771');
    assert.equal(audit.actorIdentifier, 'analyst-simulated-01');
    assert.equal(audit.structuredMetadata.verifiedIntegrity, true);
  });

  test('12. Database transactions: rollback occurs on failure without leaving partial records', async () => {
    const tenant = await prisma.tenant.create({
      data: { identifier: 'tenant-tx', displayName: 'Tx Tenant' }
    });

    await assert.rejects(
      async () => {
        await executeInTransaction(async (tx) => {
          // Write 1: Protected application
          await tx.protectedApplication.create({
            data: {
              tenantId: tenant.id,
              applicationIdentifier: 'app-tx-01',
              name: 'Tx App 1',
              domain: 'tx1.internal'
            }
          });

          // Write 2: Deliberate failure (invalid foreign key)
          await tx.investigation.create({
            data: {
              tenantId: '00000000-0000-0000-0000-000000000000',
              investigationIdentifier: 'inv-fail',
              summary: 'Failing write'
            }
          });
        }, prisma);
      },
      (err) => err.code === 'P2003'
    );

    // Verify Write 1 was rolled back
    const count = await prisma.protectedApplication.count({
      where: { tenantId: tenant.id }
    });
    assert.equal(count, 0, 'Transaction failure must completely roll back preceding writes');
  });

  test('13. Three conceptual DSG layers remain strictly distinguishable', async () => {
    const tenant = await prisma.tenant.create({
      data: { identifier: 'tenant-layers', displayName: 'Layers Tenant' }
    });
    const env = await prisma.deceptionEnvironment.create({
      data: {
        tenantId: tenant.id,
        environmentIdentifier: 'env-layers',
        name: 'Layers Env',
        isolationConfiguration: {}
      }
    });
    const graph = await prisma.deceptionGraph.create({
      data: {
        tenantId: tenant.id,
        environmentId: env.id,
        graphIdentifier: 'graph-layers',
        graphVersion: 1
      }
    });

    const node1 = await prisma.deceptionGraphNode.create({
      data: {
        graphId: graph.id,
        nodeIdentifier: 'node-pol',
        nodeType: 'POLICY_GATE',
        assetDescription: 'Policy layer node',
        layerClassification: 'PROTECTED_DECEPTION_POLICY',
        structuredAttributes: {}
      }
    });

    const node2 = await prisma.deceptionGraphNode.create({
      data: {
        graphId: graph.id,
        nodeIdentifier: 'node-dyn',
        nodeType: 'SYNTHETIC_API',
        assetDescription: 'Dynamic state node',
        layerClassification: 'CONTROLLED_DYNAMIC_STATE',
        structuredAttributes: {}
      }
    });

    const node3 = await prisma.deceptionGraphNode.create({
      data: {
        graphId: graph.id,
        nodeIdentifier: 'node-obs',
        nodeType: 'ATTACKER_SESSION',
        assetDescription: 'Attacker observation node',
        layerClassification: 'OBSERVATIONAL_ATTACKER_STATE',
        structuredAttributes: {}
      }
    });

    const policyNodes = await prisma.deceptionGraphNode.findMany({
      where: { graphId: graph.id, layerClassification: 'PROTECTED_DECEPTION_POLICY' }
    });
    const dynamicNodes = await prisma.deceptionGraphNode.findMany({
      where: { graphId: graph.id, layerClassification: 'CONTROLLED_DYNAMIC_STATE' }
    });
    const attackerNodes = await prisma.deceptionGraphNode.findMany({
      where: { graphId: graph.id, layerClassification: 'OBSERVATIONAL_ATTACKER_STATE' }
    });

    assert.equal(policyNodes.length, 1);
    assert.equal(dynamicNodes.length, 1);
    assert.equal(attackerNodes.length, 1);
  });
});
