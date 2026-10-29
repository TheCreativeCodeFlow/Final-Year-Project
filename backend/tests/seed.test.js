/**
 * Development Seed Script Idempotency and Isolation Test.
 *
 * Verifies Requirement 12:
 * "Repeated seed execution does not duplicate records."
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { PrismaClient } from '@prisma/client';
import { getPrismaClient, connectDatabase, disconnectDatabase } from '../src/db/client.js';

const execFileAsync = promisify(execFile);
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgresql://rahulseervi@localhost:5432/adaptive_deception_test';

describe('Seed Script Idempotency and Boundaries', () => {
  let prisma;

  before(async () => {
    prisma = getPrismaClient({ databaseUrl: TEST_DATABASE_URL, forceNew: true });
    await connectDatabase(prisma);

    // Clean tables before running seed idempotency tests
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

  after(async () => {
    await disconnectDatabase(prisma);
  });

  test('Seed execution populates synthetic fixtures and repeated run produces identical counts without duplicate records', async () => {
    const runSeed = async () => {
      await execFileAsync('node', ['prisma/seed.js'], {
        cwd: process.cwd().endsWith('backend') ? process.cwd() : `${process.cwd()}/backend`,
        env: {
          ...process.env,
          NODE_ENV: 'development',
          DATABASE_URL: TEST_DATABASE_URL
        }
      });
    };

    // Run 1: First seed
    await runSeed();

    const countsRun1 = {
      tenants: await prisma.tenant.count(),
      applications: await prisma.protectedApplication.count(),
      policies: await prisma.deceptionPolicy.count(),
      strategies: await prisma.deceptionStrategy.count(),
      environments: await prisma.deceptionEnvironment.count(),
      investigations: await prisma.investigation.count(),
      attackerProfiles: await prisma.attackerProfile.count(),
      investigationProfiles: await prisma.investigationAttackerProfile.count(),
      observations: await prisma.securityObservation.count(),
      assessments: await prisma.behavioralAssessment.count(),
      policyDecisions: await prisma.policyDecision.count(),
      routingDecisions: await prisma.routingDecision.count(),
      routingOutcomes: await prisma.routingOutcome.count(),
      executionEvidences: await prisma.executionEvidence.count(),
      graphs: await prisma.deceptionGraph.count(),
      nodes: await prisma.deceptionGraphNode.count(),
      edges: await prisma.deceptionGraphEdge.count(),
      transitions: await prisma.deceptionGraphTransition.count(),
      auditEvents: await prisma.auditEvent.count()
    };

    assert.equal(countsRun1.tenants, 2, 'Must seed exactly 2 fictional tenants');
    assert.equal(countsRun1.applications, 3, 'Must seed exactly 3 protected applications');
    assert.equal(countsRun1.policies, 2, 'Must seed exactly 2 deception policies');
    assert.equal(countsRun1.strategies, 2, 'Must seed exactly 2 deception strategies');
    assert.equal(countsRun1.environments, 2, 'Must seed exactly 2 deception environments');
    assert.equal(countsRun1.investigations, 3, 'Must seed exactly 3 investigations');
    assert.equal(countsRun1.attackerProfiles, 2, 'Must seed exactly 2 attacker profiles');
    assert.equal(countsRun1.graphs, 1, 'Must seed exactly 1 DSG graph');
    assert.equal(countsRun1.nodes, 4, 'Must seed exactly 4 DSG nodes');
    assert.equal(countsRun1.edges, 1, 'Must seed exactly 1 DSG edge');

    // Run 2: Second seed to verify idempotency
    await runSeed();

    const countsRun2 = {
      tenants: await prisma.tenant.count(),
      applications: await prisma.protectedApplication.count(),
      policies: await prisma.deceptionPolicy.count(),
      strategies: await prisma.deceptionStrategy.count(),
      environments: await prisma.deceptionEnvironment.count(),
      investigations: await prisma.investigation.count(),
      attackerProfiles: await prisma.attackerProfile.count(),
      investigationProfiles: await prisma.investigationAttackerProfile.count(),
      observations: await prisma.securityObservation.count(),
      assessments: await prisma.behavioralAssessment.count(),
      policyDecisions: await prisma.policyDecision.count(),
      routingDecisions: await prisma.routingDecision.count(),
      routingOutcomes: await prisma.routingOutcome.count(),
      executionEvidences: await prisma.executionEvidence.count(),
      graphs: await prisma.deceptionGraph.count(),
      nodes: await prisma.deceptionGraphNode.count(),
      edges: await prisma.deceptionGraphEdge.count(),
      transitions: await prisma.deceptionGraphTransition.count(),
      auditEvents: await prisma.auditEvent.count()
    };

    assert.deepEqual(
      countsRun2,
      countsRun1,
      'Second seed execution must result in identical record counts without duplicates'
    );
  });

  test('Seed script refuses to execute in production environment', async () => {
    await assert.rejects(
      async () => {
        await execFileAsync('node', ['prisma/seed.js'], {
          cwd: process.cwd().endsWith('backend') ? process.cwd() : `${process.cwd()}/backend`,
          env: {
            ...process.env,
            NODE_ENV: 'production',
            DATABASE_URL: TEST_DATABASE_URL
          }
        });
      },
      (err) => err.message.includes('FATAL: Database seeding is strictly forbidden in production')
    );
  });
});
