/**
 * Synthetic Development Seed Script for Adaptive Deception Gateway.
 *
 * Requirements:
 * 1. Strictly development-only execution (aborts in production).
 * 2. Deterministic, idempotent upsert operations (safe to run repeatedly).
 * 3. Aligns with frontend mock concepts without fabricating real attacker identities or credentials.
 * 4. Preserves semantic boundaries:
 *    - Observations vs Assessments vs Decisions vs Outcomes vs Evidence.
 *    - Discrepancy between intended routing and recorded outcome is faithfully modeled.
 *    - Missing execution evidence remains explicitly null/missing.
 *    - Proposed graph transitions remain PROPOSED (not executed).
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: Database seeding is strictly forbidden in production environments.');
  }

  console.log('Seeding development database with synthetic domain fixtures...');

  // 1. Tenants
  const tenantApex = await prisma.tenant.upsert({
    where: { identifier: 'tenant-apex-9941' },
    update: { displayName: 'Apex FinTech Cloud', status: 'ACTIVE' },
    create: {
      identifier: 'tenant-apex-9941',
      displayName: 'Apex FinTech Cloud',
      status: 'ACTIVE'
    }
  });

  const tenantMed = await prisma.tenant.upsert({
    where: { identifier: 'tenant-medsecure-7712' },
    update: { displayName: 'MedSecure Healthcare Systems', status: 'ACTIVE' },
    create: {
      identifier: 'tenant-medsecure-7712',
      displayName: 'MedSecure Healthcare Systems',
      status: 'ACTIVE'
    }
  });

  // 2. Protected Applications
  const appApex01 = await prisma.protectedApplication.upsert({
    where: {
      tenantId_applicationIdentifier: {
        tenantId: tenantApex.id,
        applicationIdentifier: 'app-01'
      }
    },
    update: { name: 'Customer Accounts API', domain: 'accounts.apexfintech.internal', status: 'PROTECTED' },
    create: {
      tenantId: tenantApex.id,
      applicationIdentifier: 'app-01',
      name: 'Customer Accounts API',
      domain: 'accounts.apexfintech.internal',
      status: 'PROTECTED'
    }
  });

  const appApex14 = await prisma.protectedApplication.upsert({
    where: {
      tenantId_applicationIdentifier: {
        tenantId: tenantApex.id,
        applicationIdentifier: 'app-14'
      }
    },
    update: { name: 'Identity Federation Gateway', domain: 'idp.apexfintech.internal', status: 'PROTECTED' },
    create: {
      tenantId: tenantApex.id,
      applicationIdentifier: 'app-14',
      name: 'Identity Federation Gateway',
      domain: 'idp.apexfintech.internal',
      status: 'PROTECTED'
    }
  });

  const appMed01 = await prisma.protectedApplication.upsert({
    where: {
      tenantId_applicationIdentifier: {
        tenantId: tenantMed.id,
        applicationIdentifier: 'app-med-01'
      }
    },
    update: { name: 'Patient EHR Portal', domain: 'ehr.medsecure.internal', status: 'PROTECTED' },
    create: {
      tenantId: tenantMed.id,
      applicationIdentifier: 'app-med-01',
      name: 'Patient EHR Portal',
      domain: 'ehr.medsecure.internal',
      status: 'PROTECTED'
    }
  });

  // 3. Deception Policies
  const polSec01 = await prisma.deceptionPolicy.upsert({
    where: {
      policyIdentifier_version: {
        policyIdentifier: 'pol-sec-01',
        version: 1
      }
    },
    update: { name: 'Default Baseline Decoy Redirection', enabled: true, priority: 100 },
    create: {
      policyIdentifier: 'pol-sec-01',
      version: 1,
      tenantId: tenantApex.id,
      name: 'Default Baseline Decoy Redirection',
      description: 'Diverts anomalous authentication probes to synthetic decoy endpoints.',
      enabled: true,
      priority: 100,
      triggerConditions: { pathPrefix: '/api/v1/auth', method: 'POST' },
      requiredEvidenceCriteria: { minConfidenceScore: 0.8, requireCanaryHit: false },
      permittedActions: ['DIVERSION', 'DELAY', 'SYNTHETIC_CHALLENGE'],
      prohibitedActions: ['EXECUTE_SHELL_COMMAND', 'MODIFY_PRODUCTION_DATA'],
      protectedIsolationConstraints: { containerNamespace: 'apex-decoy-ns', egressBlocked: true }
    }
  });

  const polSec06 = await prisma.deceptionPolicy.upsert({
    where: {
      policyIdentifier_version: {
        policyIdentifier: 'pol-sec-06',
        version: 1
      }
    },
    update: { name: 'Containment Isolation Enforced Diversion', enabled: true, priority: 10 },
    create: {
      policyIdentifier: 'pol-sec-06',
      version: 1,
      tenantId: tenantApex.id,
      name: 'Containment Isolation Enforced Diversion',
      description: 'Enforces strict isolated container sandbox diversion upon credential stuffing.',
      enabled: true,
      priority: 10,
      triggerConditions: { anomalyType: 'CREDENTIAL_STUFFING', rateLimitExceeded: true },
      requiredEvidenceCriteria: { minConfidenceScore: 0.85, multiIpCorrelation: true },
      permittedActions: ['CONTAINMENT', 'ISOLATED_SANDBOX_DIVERSION'],
      prohibitedActions: ['RUN_HOST_COMMAND', 'ALLOW_CROSS_TENANT_ACCESS'],
      protectedIsolationConstraints: { networkIsolation: 'STRICT', allowHostAccess: false }
    }
  });

  // 4. Deception Strategies
  const stratContain06 = await prisma.deceptionStrategy.upsert({
    where: { strategyIdentifier: 'strat-contain-06' },
    update: { name: 'Dynamic Sandbox Containment', enabled: true },
    create: {
      strategyIdentifier: 'strat-contain-06',
      tenantId: tenantApex.id,
      name: 'Dynamic Sandbox Containment',
      description: 'Traps attacker sessions in an isolated container decoy with synthetic fake responses.',
      strategyType: 'CONTAINMENT',
      enabled: true,
      prerequisites: { requireActiveInvestigation: true, minEvidenceCount: 3 },
      permittedStateChangeProposal: {
        action: 'DEPLOY_SYNTHETIC_CONTAINER',
        template: 'vault-decoy-v2',
        dwellTimeSeconds: 300
      },
      isolationRequirements: { memoryLimitMb: 256, cpuQuota: 0.5, noExternalEgress: true }
    }
  });

  const stratTarpit02 = await prisma.deceptionStrategy.upsert({
    where: { strategyIdentifier: 'strat-tarpit-02' },
    update: { name: 'Adaptive Latency Tarpit', enabled: true },
    create: {
      strategyIdentifier: 'strat-tarpit-02',
      tenantId: null, // Platform-wide strategy
      name: 'Adaptive Latency Tarpit',
      description: 'Progressively slows response socket transfer to deplete attacker automated tooling.',
      strategyType: 'TARPIT',
      enabled: true,
      prerequisites: { probeFrequencyPerMinute: 60 },
      permittedStateChangeProposal: {
        action: 'INJECT_LATENCY',
        initialDelayMs: 500,
        incrementalStepMs: 200,
        maxDelayMs: 8000
      },
      isolationRequirements: { socketTimeoutMs: 10000 }
    }
  });

  // 5. Deception Environments
  const envApex = await prisma.deceptionEnvironment.upsert({
    where: {
      tenantId_environmentIdentifier: {
        tenantId: tenantApex.id,
        environmentIdentifier: 'env-apex-sandbox-01'
      }
    },
    update: { name: 'Apex FinTech Synthetic Vault', lifecycleState: 'ACTIVE' },
    create: {
      tenantId: tenantApex.id,
      environmentIdentifier: 'env-apex-sandbox-01',
      name: 'Apex FinTech Synthetic Vault',
      description: 'Isolated synthetic microservices mimicking customer banking account databases.',
      lifecycleState: 'ACTIVE',
      isolationConfiguration: {
        namespace: 'apex-vault-sandbox',
        egressPolicy: 'DROP_ALL',
        cpuShares: 512,
        memoryLimitMb: 1024
      },
      metadata: { blueprints: ['accounts-mock-v1', 'auth-mock-v1'], clusterRegion: 'us-east-1' }
    }
  });

  const envMed = await prisma.deceptionEnvironment.upsert({
    where: {
      tenantId_environmentIdentifier: {
        tenantId: tenantMed.id,
        environmentIdentifier: 'env-medsecure-tarpit'
      }
    },
    update: { name: 'MedSecure EHR Decoy Cluster', lifecycleState: 'ACTIVE' },
    create: {
      tenantId: tenantMed.id,
      environmentIdentifier: 'env-medsecure-tarpit',
      name: 'MedSecure EHR Decoy Cluster',
      description: 'Synthetic medical record decoy endpoints to trace hospital network recon.',
      lifecycleState: 'ACTIVE',
      isolationConfiguration: {
        namespace: 'medsecure-tarpit',
        egressPolicy: 'DROP_ALL',
        cpuShares: 256,
        memoryLimitMb: 512
      },
      metadata: { blueprints: ['patient-ehr-mock-v2'] }
    }
  });

  // 6. Investigations
  const inv801 = await prisma.investigation.upsert({
    where: {
      tenantId_investigationIdentifier: {
        tenantId: tenantApex.id,
        investigationIdentifier: 'inv-801'
      }
    },
    update: { status: 'OPEN', severity: 'HIGH' },
    create: {
      tenantId: tenantApex.id,
      applicationId: appApex01.id,
      investigationIdentifier: 'inv-801',
      status: 'OPEN',
      severity: 'HIGH',
      summary: 'Automated credential stuffing detected against Customer Accounts API login route.',
      evidenceReferences: {
        targetRoute: '/api/v1/auth/login',
        uniqueIpCount: 42,
        canaryTriggered: true
      }
    }
  });

  const inv804 = await prisma.investigation.upsert({
    where: {
      tenantId_investigationIdentifier: {
        tenantId: tenantApex.id,
        investigationIdentifier: 'inv-804'
      }
    },
    update: { status: 'DISCREPANCY_FLAGGED', severity: 'MEDIUM' },
    create: {
      tenantId: tenantApex.id,
      applicationId: appApex01.id,
      investigationIdentifier: 'inv-804',
      status: 'DISCREPANCY_FLAGGED',
      severity: 'MEDIUM',
      summary: 'Discrepancy detected: Intended diversion to sandbox was blocked by upstream edge firewall.',
      evidenceReferences: {
        intendedAction: 'PROPOSED_DECEPTION_DIVERSION',
        actualRecordedOutcome: 'BLOCKED_AT_INGRESS',
        discrepancyNoted: true
      }
    }
  });

  const inv806 = await prisma.investigation.upsert({
    where: {
      tenantId_investigationIdentifier: {
        tenantId: tenantApex.id,
        investigationIdentifier: 'inv-806'
      }
    },
    update: { status: 'OPEN', severity: 'LOW' },
    create: {
      tenantId: tenantApex.id,
      applicationId: appApex14.id,
      investigationIdentifier: 'inv-806',
      status: 'OPEN',
      severity: 'LOW',
      summary: 'Probe with missing execution telemetry; status unconfirmed.',
      evidenceReferences: {
        executionConfirmed: false,
        telemetryLost: true
      }
    }
  });

  // 7. Attacker Profiles (Pseudonymous heuristic labels, NOT verified human identity)
  const prof701 = await prisma.attackerProfile.upsert({
    where: {
      tenantId_profileIdentifier: {
        tenantId: tenantApex.id,
        profileIdentifier: 'prof-701'
      }
    },
    update: { displayLabel: 'SUSPECT-CRED-STUFFER-701 (Heuristic Profile)' },
    create: {
      tenantId: tenantApex.id,
      profileIdentifier: 'prof-701',
      displayLabel: 'SUSPECT-CRED-STUFFER-701 (Heuristic Profile)',
      observedBehaviorIndicators: {
        userAgentSignatures: ['Go-http-client/1.1', 'Python-urllib/3.10'],
        probeVelocityPerSec: 15.4,
        targetedPaths: ['/api/v1/auth/login', '/api/v1/users/me']
      },
      firstSeenAt: new Date(Date.now() - 3600000 * 24),
      lastSeenAt: new Date()
    }
  });

  const prof704 = await prisma.attackerProfile.upsert({
    where: {
      tenantId_profileIdentifier: {
        tenantId: tenantApex.id,
        profileIdentifier: 'prof-704'
      }
    },
    update: { displayLabel: 'APT-RECON-704 (Zero Decoy Interaction)' },
    create: {
      tenantId: tenantApex.id,
      profileIdentifier: 'prof-704',
      displayLabel: 'APT-RECON-704 (Zero Decoy Interaction)',
      observedBehaviorIndicators: {
        probePattern: 'SLOW_PORT_SWEEP',
        decoyInteractionsRecorded: 0
      },
      firstSeenAt: new Date(Date.now() - 3600000 * 48),
      lastSeenAt: new Date(Date.now() - 3600000 * 12)
    }
  });

  // 8. Investigation <-> Profile Many-to-Many Link
  await prisma.investigationAttackerProfile.upsert({
    where: {
      investigationId_attackerProfileId: {
        investigationId: inv801.id,
        attackerProfileId: prof701.id
      }
    },
    update: {},
    create: {
      tenantId: tenantApex.id,
      investigationId: inv801.id,
      attackerProfileId: prof701.id
    }
  });

  // 9. Observations, Assessments, and Policy Decisions
  const obs901 = await prisma.securityObservation.upsert({
    where: { observationIdentifier: 'obs-901' },
    update: { evidenceStatus: 'OBSERVED' },
    create: {
      tenantId: tenantApex.id,
      applicationId: appApex01.id,
      investigationId: inv801.id,
      observationIdentifier: 'obs-901',
      observationType: 'CANARY_TOKEN_TRIGGER',
      sanitizedStructuredEvidence: {
        path: '/admin/keys/vault.json',
        method: 'GET',
        sanitizedHeaders: { host: 'accounts.apexfintech.internal', accept: 'application/json' },
        canaryId: 'canary-apex-vault-token-99'
      },
      evidenceProvenance: 'EDGE_CANARY_INTERCEPTOR',
      correlationId: 'req-corr-apex-901',
      evidenceStatus: 'OBSERVED'
    }
  });

  let assessment901 = await prisma.behavioralAssessment.findFirst({
    where: { observationId: obs901.id }
  });
  if (!assessment901) {
    assessment901 = await prisma.behavioralAssessment.create({
      data: {
        tenantId: tenantApex.id,
        observationId: obs901.id,
        investigationId: inv801.id,
        classification: 'CREDENTIAL_STUFFING',
        riskScore: 0.88,
        confidenceScore: 0.92, // Heuristic probability score; NOT proof of malicious intent
        modelOrRuleVersion: 'statistical-detector-v2.1',
        explanation: {
          rationale: 'Observed access to known honeypot path with high request velocity.',
          uncertaintyFactors: ['Single egress IP could represent shared corporate NAT']
        }
      }
    });
  }

  let policyDec901 = await prisma.policyDecision.findFirst({
    where: { observationId: obs901.id }
  });
  if (!policyDec901) {
    policyDec901 = await prisma.policyDecision.create({
      data: {
        tenantId: tenantApex.id,
        observationId: obs901.id,
        assessmentId: assessment901.id,
        policyId: polSec06.id,
        policyVersion: 1,
        decisionResult: 'PERMIT_DIVERSION',
        decisionRationale: 'Confidence score (0.92) exceeds policy threshold (0.85); container isolation satisfied.',
        evidenceReferences: { observationId: obs901.id, assessmentId: assessment901.id }
      }
    });
  }

  // 10. Routing Decisions, Outcomes, and Execution Evidence
  // Scenario 1: Successful Sandbox Diversion
  let routingDec901 = await prisma.routingDecision.findFirst({
    where: { correlationId: 'req-corr-apex-901' }
  });
  if (!routingDec901) {
    routingDec901 = await prisma.routingDecision.create({
      data: {
        tenantId: tenantApex.id,
        policyDecisionId: policyDec901.id,
        intendedAction: 'PROPOSED_DECEPTION_DIVERSION',
        targetApplicationId: appApex01.id,
        targetEnvironmentId: envApex.id,
        correlationId: 'req-corr-apex-901',
        decisionStatus: 'DECIDED'
      }
    });
  }

  await prisma.routingOutcome.upsert({
    where: { routingDecisionId: routingDec901.id },
    update: { outcomeStatus: 'DIVERTED_TO_SANDBOX' },
    create: {
      tenantId: tenantApex.id,
      routingDecisionId: routingDec901.id,
      outcomeStatus: 'DIVERTED_TO_SANDBOX',
      outcomeSource: 'EDGE_ENVOY_ROUTING_SUPERVISOR',
      failureOrDiscrepancyDetails: null
    }
  });

  await prisma.executionEvidence.upsert({
    where: { routingDecisionId: routingDec901.id },
    update: { evidenceStatus: 'CONFIRMED_EXECUTION' },
    create: {
      tenantId: tenantApex.id,
      routingDecisionId: routingDec901.id,
      evidenceStatus: 'CONFIRMED_EXECUTION',
      evidenceSource: 'CONTAINER_DOCKER_TAP',
      evidenceData: { containerId: 'apex-vault-sandbox-01', httpStatusCode: 200, dwellMs: 420 },
      recordedAt: new Date(),
      correlationId: 'req-corr-apex-901'
    }
  });

  // Scenario 2: Policy/Routing Discrepancy (inv-804)
  let routingDec804 = await prisma.routingDecision.findFirst({
    where: { correlationId: 'req-corr-apex-804' }
  });
  if (!routingDec804) {
    routingDec804 = await prisma.routingDecision.create({
      data: {
        tenantId: tenantApex.id,
        intendedAction: 'PROPOSED_DECEPTION_DIVERSION',
        targetApplicationId: appApex01.id,
        targetEnvironmentId: envApex.id,
        correlationId: 'req-corr-apex-804',
        decisionStatus: 'DECIDED'
      }
    });
  }

  await prisma.routingOutcome.upsert({
    where: { routingDecisionId: routingDec804.id },
    update: { outcomeStatus: 'BLOCKED_AT_INGRESS' },
    create: {
      tenantId: tenantApex.id,
      routingDecisionId: routingDec804.id,
      outcomeStatus: 'BLOCKED_AT_INGRESS', // Explicit discrepancy!
      outcomeSource: 'EDGE_WAF_OVERRIDE',
      failureOrDiscrepancyDetails: {
        intended: 'PROPOSED_DECEPTION_DIVERSION',
        recorded: 'BLOCKED_AT_INGRESS',
        discrepancyReason: 'Upstream edge WAF rule overrode gateway diversion before sandbox handshake.'
      }
    }
  });

  // Scenario 3: Missing / Unconfirmed Execution Evidence (inv-806)
  let routingDec806 = await prisma.routingDecision.findFirst({
    where: { correlationId: 'req-corr-apex-806' }
  });
  if (!routingDec806) {
    routingDec806 = await prisma.routingDecision.create({
      data: {
        tenantId: tenantApex.id,
        intendedAction: 'PROPOSED_DECEPTION_DIVERSION',
        targetApplicationId: appApex14.id,
        targetEnvironmentId: envApex.id,
        correlationId: 'req-corr-apex-806',
        decisionStatus: 'DECIDED'
      }
    });
  }

  await prisma.executionEvidence.upsert({
    where: { routingDecisionId: routingDec806.id },
    update: { evidenceStatus: 'MISSING' },
    create: {
      tenantId: tenantApex.id,
      routingDecisionId: routingDec806.id,
      evidenceStatus: 'MISSING', // Missing evidence is preserved as MISSING, not fabricated as SUCCESS
      evidenceSource: null,
      evidenceData: null,
      recordedAt: null,
      correlationId: 'req-corr-apex-806'
    }
  });

  // 11. Deception State Graph (DSG)
  const dsgApex = await prisma.deceptionGraph.upsert({
    where: {
      tenantId_graphIdentifier_graphVersion: {
        tenantId: tenantApex.id,
        graphIdentifier: 'dsg-apex-01',
        graphVersion: 1
      }
    },
    update: { status: 'ACTIVE' },
    create: {
      tenantId: tenantApex.id,
      environmentId: envApex.id,
      graphIdentifier: 'dsg-apex-01',
      graphVersion: 1,
      status: 'ACTIVE'
    }
  });

  // DSG Nodes across the 3 conceptual layers
  const nodePolicyGuard = await prisma.deceptionGraphNode.upsert({
    where: {
      graphId_nodeIdentifier: {
        graphId: dsgApex.id,
        nodeIdentifier: 'node-policy-guard'
      }
    },
    update: {},
    create: {
      graphId: dsgApex.id,
      nodeIdentifier: 'node-policy-guard',
      nodeType: 'POLICY_RULE',
      assetDescription: 'Immutable isolation and containment policy boundary',
      layerClassification: 'PROTECTED_DECEPTION_POLICY',
      structuredAttributes: { isolationTier: 'STRICT', enforceNoEgress: true }
    }
  });

  const nodeAuthDecoy = await prisma.deceptionGraphNode.upsert({
    where: {
      graphId_nodeIdentifier: {
        graphId: dsgApex.id,
        nodeIdentifier: 'node-auth-decoy'
      }
    },
    update: {},
    create: {
      graphId: dsgApex.id,
      nodeIdentifier: 'node-auth-decoy',
      nodeType: 'SYNTHETIC_API',
      assetDescription: 'Synthetic OAuth2 Token Issuance Decoy Endpoint',
      layerClassification: 'CONTROLLED_DYNAMIC_STATE',
      structuredAttributes: { port: 8443, path: '/auth/v2/token', simulatedLatencyMs: 80 }
    }
  });

  const nodeVaultDb = await prisma.deceptionGraphNode.upsert({
    where: {
      graphId_nodeIdentifier: {
        graphId: dsgApex.id,
        nodeIdentifier: 'node-vault-db'
      }
    },
    update: {},
    create: {
      graphId: dsgApex.id,
      nodeIdentifier: 'node-vault-db',
      nodeType: 'SANDBOX_DATABASE',
      assetDescription: 'Synthetic Customer Balances SQL Decoy Store',
      layerClassification: 'CONTROLLED_DYNAMIC_STATE',
      structuredAttributes: { schema: 'synthetic_customers', tableCount: 4 }
    }
  });

  const nodeAttackerRecon = await prisma.deceptionGraphNode.upsert({
    where: {
      graphId_nodeIdentifier: {
        graphId: dsgApex.id,
        nodeIdentifier: 'node-attacker-probe'
      }
    },
    update: {},
    create: {
      graphId: dsgApex.id,
      nodeIdentifier: 'node-attacker-probe',
      nodeType: 'RECON_SESSION',
      assetDescription: 'Observational node tracking external probe trajectory',
      layerClassification: 'OBSERVATIONAL_ATTACKER_STATE',
      structuredAttributes: { sourceIpSubnet: '198.51.100.0/24', sessionConfidence: 0.9 }
    }
  });

  // DSG Edge within graph boundaries
  await prisma.deceptionGraphEdge.upsert({
    where: {
      graphId_sourceNodeId_targetNodeId_edgeType: {
        graphId: dsgApex.id,
        sourceNodeId: nodeAuthDecoy.id,
        targetNodeId: nodeVaultDb.id,
        edgeType: 'LATERAL_MOVEMENT_TRAP'
      }
    },
    update: {},
    create: {
      graphId: dsgApex.id,
      sourceNodeId: nodeAuthDecoy.id,
      targetNodeId: nodeVaultDb.id,
      edgeType: 'LATERAL_MOVEMENT_TRAP',
      structuredAttributes: { trapTrigger: 'DB_CONNECTION_ATTEMPT', alertSeverity: 'CRITICAL' }
    }
  });

  // Proposed DSG Transition (distinct from executed!)
  const existingTransition = await prisma.deceptionGraphTransition.findFirst({
    where: { graphId: dsgApex.id, transitionStatus: 'PROPOSED' }
  });
  if (!existingTransition) {
    await prisma.deceptionGraphTransition.create({
      data: {
        tenantId: tenantApex.id,
        graphId: dsgApex.id,
        previousState: { activeNodeCount: 4, topologyVersion: 1 },
        proposedState: { activeNodeCount: 5, topologyVersion: 2, proposedNode: 'node-shadow-api' },
        transitionStatus: 'PROPOSED', // Clearly distinct from APPROVED or EXECUTED
        triggeringObservationId: obs901.id,
        provenance: 'ADAPTIVE_PLANNER_SIMULATION',
        proposedAt: new Date()
      }
    });
  }

  // 12. Audit Event (append-only)
  const existingAudit = await prisma.auditEvent.findFirst({
    where: { correlationId: 'corr-seed-init-001' }
  });
  if (!existingAudit) {
    await prisma.auditEvent.create({
      data: {
        tenantId: tenantApex.id,
        actorIdentifier: 'dev-seed-runner',
        action: 'SEED_INITIALIZATION',
        targetEntityType: 'PlatformDatabase',
        targetEntityId: 'adaptive_deception_dev',
        correlationId: 'corr-seed-init-001',
        structuredMetadata: {
          tenantsCreated: 2,
          applicationsCreated: 3,
          policiesCreated: 2,
          strategiesCreated: 2,
          environmentsCreated: 2,
          investigationsCreated: 3,
          graphsCreated: 1,
          notice: 'Synthetic development fixtures seeded successfully with strict tenant isolation.'
        }
      }
    });
  }

  console.log('Development database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Database seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
