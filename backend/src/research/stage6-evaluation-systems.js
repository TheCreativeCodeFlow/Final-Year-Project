/**
 * Stage 6 Comparative Deception Evaluation Systems.
 *
 * Implements three comparable experimental systems using identical inputs,
 * equivalent initial environments, shared ingress detection/policy engines,
 * and isolated HTTP synthetic runtime hosts:
 *
 *   A. STATIC_HONEYPOT        - Fixed synthetic environment, 0 mutations.
 *   B. GENERIC_ADAPTIVE       - Deterministic single-step category/risk adaptation
 *                               without longitudinal behavioral history or 7-way
 *                               DSG cross-component consistency validation.
 *   C. ATTACKER_SPECIFIC_DSG  - Full longitudinal behavioral profile + DSGPlannerService
 *                               + StrategySelectionService + 7-way DSGConsistencyEngine
 *                               prior to executing coordinated runtime mutations.
 *
 * Zero fabricated latencies or expected-output metrics: all latencies are measured
 * around real execution via process.hrtime.bigint() and metrics computed solely from
 * observed runtime state, HTTP responses, and consistency audits.
 */

import crypto from 'node:crypto';
import { validateAndNormalizeCanonicalEvent } from '../telemetry/canonical-event.schema.js';
import { BehavioralSessionCorrelator } from '../services/behavioral-session-correlator.service.js';
import { BehavioralFeatureExtractor } from '../services/behavioral-feature-extractor.service.js';
import { RuleEngineService } from '../detection/rules/rule-engine.service.js';
import { FeaturePreprocessor, NUMERICAL_FEATURE_KEYS } from '../detection/ml/feature-preprocessor.js';
import { IsolationForest } from '../detection/ml/isolation-forest.js';
import { StatisticalBaselineDetector } from '../detection/ml/statistical-baseline.js';
import { HybridAssessmentService, ASSESSMENT_LABELS, FUSION_STRATEGIES } from '../detection/hybrid-assessment.service.js';
import { PolicyEvaluationEngine, DECISION_RESULTS } from '../deception/policy-evaluation.service.js';
import { StrategySelectionService } from '../deception/strategy-selection.service.js';
import { DSGPlannerService } from '../deception/dsg-planner.service.js';
import { DSGConsistencyEngine } from '../deception/dsg-consistency-engine.service.js';
import { BASELINE_STRATEGIES } from '../deception/strategy-catalog.js';
import { MUTATION_DIMENSIONS, MUTATION_OPERATIONS } from '../deception/dsg-mutation-catalogue.js';
import { STAGE6_PARTITIONS, getScenariosByPartition, INITIAL_SYNTHETIC_STATE } from './stage6-scenario-suite.js';
import { startIsolatedSyntheticHost, startSimulatedOriginHost, httpRequestJson } from './stage6-synthetic-runtime-host.js';

export const EXPERIMENTAL_PARADIGMS = Object.freeze({
  STATIC_HONEYPOT: 'STATIC_HONEYPOT',
  GENERIC_ADAPTIVE: 'GENERIC_ADAPTIVE',
  ATTACKER_SPECIFIC_DSG: 'ATTACKER_SPECIFIC_DSG'
});

const CANARY_COLUMN_NAMES = new Set(['canary_seed', 'exfil_marker', 'audit_beacon', 'synthetic_tag']);
const SENSITIVE_CANARY_TABLES = new Set(['synthetic_customers', 'decoy_transactions', 'synthetic_ledger']);

function createBaselinePolicy() {
  return {
    id: 'pol-stage6-eval-01',
    policyIdentifier: 'pol-sec-eval-01',
    name: 'Stage 6 Comparative Evaluation Policy',
    enabled: true,
    priority: 10,
    version: 1,
    triggerConditions: { severityAtLeast: 'HIGH' },
    requiredEvidenceCriteria: {
      minConfidence: 0.70,
      requireRuleCorroboration: true,
      allowedStrategies: BASELINE_STRATEGIES.map((s) => s.strategyIdentifier)
    },
    permittedActions: ['PROPOSE_DECEPTION', 'ALLOW_NORMAL'],
    prohibitedActions: ['RUN_ARBITRARY_COMMAND'],
    protectedIsolationConstraints: {
      strictNamespaceIsolation: true,
      noOutboundEgress: true
    }
  };
}

/**
 * Calibrates anomaly detectors ONLY on the benign DEVELOPMENT partition
 * using the supplied deterministic random seed. Zero validation or test leakage.
 */
export function buildCalibratedDetectorSuite({ seed = 42 } = {}) {
  const featureExtractor = new BehavioralFeatureExtractor();
  const preprocessor = new FeaturePreprocessor({ featureKeys: NUMERICAL_FEATURE_KEYS });
  const devScenarios = getScenariosByPartition(STAGE6_PARTITIONS.DEVELOPMENT).filter(
    (s) => s.groundTruthCategory === 'BENIGN'
  );

  const baseMs = Date.UTC(2026, 10, 10, 12, 0, 0);
  const rawVectors = [];

  for (const scenario of devScenarios) {
    const events = scenario.requestSequence.map((step) => {
      const res = validateAndNormalizeCanonicalEvent({
        schemaVersion: '1.0.0',
        eventId: crypto.createHash('sha256').update(`${scenario.scenarioId}:${step.stepIndex}`).digest('hex').slice(0, 32),
        correlationId: crypto.createHash('sha256').update(`corr:${scenario.scenarioId}:${step.stepIndex}`).digest('hex').slice(0, 32),
        tenantId: 'tenant-stage6',
        applicationId: 'app-stage6',
        timestamp: new Date(baseMs + step.offsetMs).toISOString(),
        httpMethod: step.method,
        normalizedRoute: step.path,
        responseStatus: step.originStatus,
        requestSizeBytes: step.body ? JSON.stringify(step.body).length : 240,
        responseSizeBytes: 980,
        durationMs: 12.5,
        forwardingResult: 'SUCCESS',
        validationOutcome: 'VALIDATED',
        sessionReference: scenario.sessionId,
        clientIp: scenario.clientIp,
        persistenceStatus: 'TELEMETRY_PERSISTED'
      });
      return res.canonicalEvent;
    });

    const lastEv = events[events.length - 1];
    const fSets = featureExtractor.extractFeatures({
      canonicalEvents: events,
      tenantId: 'tenant-stage6',
      applicationId: 'app-stage6',
      sessionRef: scenario.sessionId,
      referenceTimestamp: lastEv.timestamp,
      baseline: null
    });
    for (const fs of fSets) {
      const { vector } = preprocessor.extractVector(fs.features, fs.schemaVersion);
      rawVectors.push(vector);
    }
  }

  // Deterministic calibration sample buffer (size 64) derived solely from DEV benign vectors
  const expanded = [];
  let idx = 0;
  while (expanded.length < 64) {
    const src = rawVectors[idx % rawVectors.length];
    const jitter = ((idx + seed) % 5) * 0.0005;
    expanded.push(src.map((v) => (typeof v === 'number' ? v + jitter : v)));
    idx++;
  }

  preprocessor.fit(expanded);
  const scaledVectors = expanded.map((v) => preprocessor.transform(v));

  const iforest = new IsolationForest({
    numTrees: 50,
    sampleSize: 64,
    decisionThreshold: 0.60,
    seed
  });
  iforest.fit(scaledVectors);

  const statDetector = new StatisticalBaselineDetector({ decisionThreshold: 0.60 });
  statDetector.fit(scaledVectors);

  return {
    preprocessor,
    iforest,
    statDetector,
    featureExtractor,
    calibrationVectorCount: expanded.length,
    seed
  };
}

/**
 * Generates deterministic single-step reactive mutations for the GENERIC_ADAPTIVE baseline.
 * Adapts using only the immediate detected category/path without longitudinal behavioral
 * history or 7-way DSG consistency validation.
 */
function deriveGenericStatelessMutations({ assessment, step }) {
  const findings = Array.isArray(assessment.ruleFindings) ? assessment.ruleFindings : [];
  const ruleIds = findings.map((f) => String(f.ruleId || '').toUpperCase());
  const mutations = [];

  if (ruleIds.some((r) => r.includes('AUTH') || r.includes('CREDENTIAL'))) {
    const targetUsername = step.body?.username || 'alex.chen';
    mutations.push({
      mutationType: MUTATION_DIMENSIONS.CREDENTIAL,
      operation: MUTATION_OPERATIONS.CREATE_DECOY_CREDENTIAL,
      payload: {
        username: targetUsername,
        tokenType: 'CANARY_JWT',
        role: 'ADMINISTRATOR',
        token: `gen-canary-${targetUsername}-${step.stepIndex}`
      }
    });
  }

  if (
    step.path.startsWith('/api/') &&
    !INITIAL_SYNTHETIC_STATE.baselineRoutes.includes(step.path)
  ) {
    mutations.push({
      mutationType: MUTATION_DIMENSIONS.API_TOPOLOGY,
      operation: MUTATION_OPERATIONS.ADD_SYNTHETIC_ROUTE,
      payload: {
        path: step.path,
        method: step.method,
        simulatedStatus: 200,
        availability: 'ENABLED',
        responseBody: {
          success: true,
          genericAdaptive: true,
          path: step.path
        }
      }
    });
  }

  if (
    step.path.includes('/data/schemas') ||
    step.path.includes('/data/customers') ||
    step.path.includes('/data/dump')
  ) {
    mutations.push({
      mutationType: MUTATION_DIMENSIONS.DATA,
      operation: MUTATION_OPERATIONS.SCHEMA_MUTATION,
      payload: {
        table: 'synthetic_customers',
        columns: ['customer_id', 'company', 'tier', 'billing_iban']
      }
    });
  }

  if (ruleIds.some((r) => r.includes('BURST')) && step.path.startsWith('/api/v1/auth')) {
    mutations.push({
      mutationType: MUTATION_DIMENSIONS.SERVICE_TOPOLOGY,
      operation: MUTATION_OPERATIONS.DISABLE_SYNTHETIC_SERVICE,
      payload: { serviceType: 'SYNTHETIC_AUTH' }
    });
  }

  return mutations;
}

/**
 * Generates coordinated, attacker-profile-aware DSG transitions for ATTACKER_SPECIFIC_DSG.
 * Uses longitudinal session memory (discovered users, roles, routes, data targets) and
 * resolves cross-component dependencies prior to 7-way DSGConsistencyEngine validation.
 */
function deriveAttackerSpecificDsgMutations({
  assessment,
  step,
  attackerProfile,
  currentState,
  strategy,
  dsgPlanner,
  policy
}) {
  const candidates = [];

  // Plan base DSG transition for auditability
  const plan = dsgPlanner.planMutation({
    currentGraph: { id: 'dsg-stage6', graphVersion: currentState.graphVersion, nodes: [], edges: [] },
    strategy: strategy || BASELINE_STRATEGIES[0],
    assessment,
    policy,
    tenantId: 'tenant-stage6'
  });

  // Track probed entities in attacker profile
  let probedUsername = null;
  if (step.body?.username) {
    probedUsername = step.body.username;
  } else if (step.path.startsWith('/api/v1/users/')) {
    probedUsername = step.path.replace('/api/v1/users/', '');
  }
  if (probedUsername) {
    attackerProfile.probedUsernames.add(probedUsername);
  }

  const users = currentState.users || [];
  const routes = currentState.routes || [];
  const findings = Array.isArray(assessment.ruleFindings) ? assessment.ruleFindings : [];
  const ruleIds = findings.map((f) => String(f.ruleId || '').toUpperCase());

  // 1. Identity & Credential Coordination across attacker's historical trajectory
  for (const targetUser of attackerProfile.probedUsernames) {
    let existingUser = users.find((u) => u.username === targetUser || u.id === targetUser);
    if (!existingUser) {
      const assignedRole = 'SECURITY_AUDITOR_DECOY';
      candidates.push({
        mutationType: MUTATION_DIMENSIONS.IDENTITY,
        operation: MUTATION_OPERATIONS.ADD_SYNTHETIC_USER,
        payload: {
          id: `usr-dsg-${targetUser}`,
          username: targetUser,
          name: `Synthetic ${targetUser}`,
          role: assignedRole,
          department: 'Internal Audit'
        },
        adaptiveRationale: `Provision attacker-targeted identity "${targetUser}" cleanly before route/credential linkage.`
      });
      existingUser = { username: targetUser, role: assignedRole };
    }

    const hasCred = (currentState.credentials || []).some(
      (c) => c.username === existingUser.username && !c.revoked
    );
    if (!hasCred && (ruleIds.some((r) => r.includes('AUTH') || r.includes('CRED')) || step.path.includes('/auth/'))) {
      candidates.push({
        mutationType: MUTATION_DIMENSIONS.CREDENTIAL,
        operation: MUTATION_OPERATIONS.CREATE_DECOY_CREDENTIAL,
        payload: {
          username: existingUser.username,
          tokenType: 'CANARY_JWT',
          role: existingUser.role,
          token: `dsg-canary-${existingUser.username}-v${currentState.graphVersion}`
        },
        adaptiveRationale: `Issue canary credential aligned strictly to "${existingUser.username}" role (${existingUser.role}).`
      });
    }
  }

  // 2. API Topology Expansion (only valid non-parameterized /api/ routes; /api/v1/users/:id is served dynamically from stateStore.users)
  if (!INITIAL_SYNTHETIC_STATE.baselineRoutes.includes(step.path) && !step.path.startsWith('/api/v1/users/')) {
    if (step.path.startsWith('/api/')) {
      const exists = routes.some((r) => r.path === step.path && r.method === step.method);
      if (!exists) {
        candidates.push({
          mutationType: MUTATION_DIMENSIONS.API_TOPOLOGY,
          operation: MUTATION_OPERATIONS.ADD_SYNTHETIC_ROUTE,
          payload: {
            path: step.path,
            method: step.method,
            simulatedStatus: 200,
            availability: 'ENABLED',
            responseBody: {
              success: true,
              dsgAdapted: true,
              path: step.path,
              trackedIdentities: Array.from(attackerProfile.probedUsernames),
              data: { decoyFeed: true, stage: step.stageNumber }
            }
          },
          adaptiveRationale: `Expand decoy API endpoint ${step.method} ${step.path} anchored to session profile.`
        });
      }
    } else {
      // Non-/api/ path proposed for topology expansion is tested directly against DSG schema/consistency gate
      // (will be validly REJECTED by DSGConsistencyEngine rather than corrupting state)
      candidates.push({
        mutationType: MUTATION_DIMENSIONS.API_TOPOLOGY,
        operation: MUTATION_OPERATIONS.ADD_SYNTHETIC_ROUTE,
        payload: {
          path: step.path,
          method: step.method,
          simulatedStatus: 200,
          availability: 'ENABLED'
        },
        adaptiveRationale: `Validate non-API recon route ${step.path} against DSG namespace boundary.`
      });
    }
  }

  // 3. Synthetic Data & Canary Schema Enrichment
  if (
    step.path.includes('/data/schemas') ||
    step.path.includes('/data/customers') ||
    step.path.includes('/data/dump')
  ) {
    const schemaHasCanary = (currentState.schemas || []).some(
      (s) => s.table === 'synthetic_customers' && s.columns?.some((c) => CANARY_COLUMN_NAMES.has(c))
    );
    if (!schemaHasCanary) {
      candidates.push({
        mutationType: MUTATION_DIMENSIONS.DATA,
        operation: MUTATION_OPERATIONS.SCHEMA_MUTATION,
        payload: {
          table: 'synthetic_customers',
          columns: ['customer_id', 'company', 'tier', 'canary_seed', 'exfil_marker']
        },
        adaptiveRationale: 'Deploy synthetic_customers table schema with mandatory canary tracking columns.'
      });
    }

    if (step.path.includes('/data/customers') && !attackerProfile.injectedCustomerMarkers.has(step.stepIndex)) {
      attackerProfile.injectedCustomerMarkers.add(step.stepIndex);
      candidates.push({
        mutationType: MUTATION_DIMENSIONS.DATA,
        operation: MUTATION_OPERATIONS.ADD_SYNTHETIC_RECORD,
        payload: {
          type: 'CUSTOMER',
          record: {
            customerId: `CUST-DSG-${step.stepIndex}`,
            company: `Apex Decoy Holdings ${step.stepIndex}`,
            tier: 'RESTRICTED_TREASURY',
            region: 'NA-EAST',
            canary_seed: `dsg-canary-cust-${step.stepIndex}`
          }
        },
        adaptiveRationale: 'Seed attacker-specific canary customer record.'
      });
    }
  }

  // 4. Service Dependency Safe Containment (never break SYNTHETIC_AUTH while auth routes active)
  if (ruleIds.some((r) => r.includes('BURST')) && step.path.startsWith('/api/v1/auth')) {
    const hasCustomAuthRoute = routes.some((r) => r.path === '/api/v1/internal/auth/tokens');
    if (hasCustomAuthRoute) {
      candidates.push({
        mutationType: MUTATION_DIMENSIONS.API_TOPOLOGY,
        operation: MUTATION_OPERATIONS.SET_ROUTE_AVAILABILITY,
        payload: {
          path: '/api/v1/internal/auth/tokens',
          method: 'GET',
          availability: 'ENABLED'
        },
        adaptiveRationale: 'Preserve SYNTHETIC_AUTH and active auth routes per DSG service dependency check.'
      });
    }
  }

  return { plan, candidates };
}

/**
 * Evaluates a single scenario completely under one experimental paradigm
 * with real loopback HTTP execution and strict step-by-step instrumentation.
 */
export async function runScenarioUnderParadigm({
  scenario,
  paradigm,
  calibratedSuite,
  warmUpOnly = false
}) {
  const synthHost = await startIsolatedSyntheticHost({
    environmentId: `env-${paradigm.toLowerCase()}-${scenario.scenarioId}`,
    tenantId: 'tenant-stage6'
  });
  const originHost = await startSimulatedOriginHost();

  const sessionCorrelator = new BehavioralSessionCorrelator();
  const ruleEngine = new RuleEngineService();
  const hybridService = new HybridAssessmentService({ prisma: null });
  const policyEngine = new PolicyEvaluationEngine();
  const strategySelector = new StrategySelectionService();
  const dsgPlanner = new DSGPlannerService();
  const policy = createBaselinePolicy();

  const { preprocessor, iforest, statDetector, featureExtractor } = calibratedSuite;

  const baseTimestampMs = Date.UTC(2026, 10, 10, 14, 0, 0);
  const canonicalEvents = [];
  const stepResults = [];
  const attackerProfile = {
    probedUsernames: new Set(),
    injectedCustomerMarkers: new Set(),
    observedUserRoles: new Map()
  };

  let transitionsProposed = 0;
  let transitionsValidated = 0;
  let transitionsExecuted = 0;
  let transitionsRejected = 0;
  let consistencyViolations = 0;
  const consistencyViolationDetails = [];
  const adaptationLatenciesMs = [];
  const requestLatenciesMs = [];
  let failedRequests = 0;
  let insufficientEvidenceSteps = 0;
  let attackFlaggedSteps = 0;
  let degradedSteps = 0;

  let actualOriginRequests = 0;
  let actualSyntheticRequests = 0;
  let decoyInteractions = 0;
  let meaningfulInteractions = 0;
  let prematureRecognitionIndicators = 0;
  const prematureRecognitionDetails = [];
  const completedStages = new Set();
  const syntheticAssetsExplored = new Set();
  let firstAttackerTimestampMs = null;
  let lastMeaningfulTimestampMs = null;

  const cpuStart = process.cpuUsage();
  const heapStartBytes = process.memoryUsage().heapUsed;

  try {
    for (const step of scenario.requestSequence) {
      const stepStartNs = process.hrtime.bigint();
      const eventTimestampMs = baseTimestampMs + step.offsetMs;
      const eventTimestampIso = new Date(eventTimestampMs).toISOString();

      // Build canonical event reflecting actual network observation quality
      const isDegraded = Boolean(step.telemetryQuality?.telemetryLossDetected);
      const rawCan = {
        schemaVersion: '1.0.0',
        eventId: crypto.createHash('sha256').update(`${paradigm}:${scenario.scenarioId}:${step.stepIndex}`).digest('hex').slice(0, 32),
        correlationId: crypto.createHash('sha256').update(`c:${paradigm}:${scenario.scenarioId}:${step.stepIndex}`).digest('hex').slice(0, 32),
        tenantId: 'tenant-stage6',
        applicationId: 'app-stage6',
        timestamp: eventTimestampIso,
        httpMethod: step.method,
        normalizedRoute: step.path,
        responseStatus: step.originStatus,
        requestSizeBytes: step.body ? JSON.stringify(step.body).length : 256,
        responseSizeBytes: step.originStatus >= 400 ? 180 : 1024,
        durationMs: 14.0,
        forwardingResult: 'SUCCESS',
        validationOutcome: 'VALIDATED',
        sessionReference: scenario.sessionId,
        clientIp: scenario.clientIp,
        persistenceStatus: isDegraded ? 'TELEMETRY_PERSISTENCE_FAILED' : 'TELEMETRY_PERSISTED'
      };
      const normRes = validateAndNormalizeCanonicalEvent(rawCan);
      if (!normRes.valid) {
        throw new Error(`Canonical event normalization failed for ${scenario.scenarioId} step ${step.stepIndex}: ${normRes.errors.join('; ')}`);
      }
      canonicalEvents.push(normRes.canonicalEvent);

      // 1. Session Correlation & Multi-Window Feature Extraction
      const sessCtx = sessionCorrelator.correlateEvent(normRes.canonicalEvent);
      const featureSets = featureExtractor.extractFeatures({
        canonicalEvents,
        tenantId: 'tenant-stage6',
        applicationId: 'app-stage6',
        sessionRef: sessCtx.sessionRef || scenario.sessionId,
        referenceTimestamp: eventTimestampIso,
        baseline: null
      });

      const primaryFeatureSet = featureSets.find((f) => f.windowLabel === '5m') || featureSets[0] || {};
      if (isDegraded) {
        primaryFeatureSet.qualityMetadata = {
          ...(primaryFeatureSet.qualityMetadata || {}),
          telemetryLossDetected: true,
          hasDataLoss: true,
          completenessStatus: step.telemetryQuality.completenessStatus || 'DEGRADED'
        };
      }

      // 2. Hybrid Detection (Branch A Rules + Branch B1 IForest)
      const ruleResult = ruleEngine.evaluate({
        featureSets,
        rawObservation: {
          normalizedRoute: step.path,
          responseStatus: step.originStatus,
          httpMethod: step.method,
          ...normRes.canonicalEvent
        },
        baseline: null,
        sessionContext: {
          collisionRisk: sessCtx.collisionRisk || { level: 'LOW' },
          correlationConfidence: sessCtx.correlationConfidence ?? 0.90,
          sessionRef: sessCtx.sessionRef || scenario.sessionId
        },
        tenantId: 'tenant-stage6',
        applicationId: 'app-stage6'
      });

      const { vector } = preprocessor.extractVector(primaryFeatureSet.features || {}, primaryFeatureSet.schemaVersion || '1.0.0');
      const scaledVector = preprocessor.transform(vector);
      const ifPred = iforest.predict(scaledVector);

      const assessment = hybridService.evaluateAssessment({
        ruleResult,
        mlResult: {
          modelStatus: 'ACTIVE',
          algorithm: 'ISOLATION_FOREST',
          isAnomaly: ifPred.isAnomaly,
          anomalyScore: ifPred.anomalyScore,
          decisionThreshold: 0.60,
          distributionShift: ifPred.distributionShift
        },
        featureSet: primaryFeatureSet,
        rawObservation: normRes.canonicalEvent,
        baseline: null,
        sessionContext: {
          collisionRisk: sessCtx.collisionRisk || { level: 'LOW' },
          correlationConfidence: sessCtx.correlationConfidence ?? 0.90,
          sessionRef: sessCtx.sessionRef || scenario.sessionId
        },
        fusionStrategy: FUSION_STRATEGIES.DATA_QUALITY_AWARE,
        tenantId: 'tenant-stage6',
        applicationId: 'app-stage6'
      });

      // 3. Policy Evaluation
      const policyDecision = policyEngine.evaluate({
        assessment,
        policy,
        application: { id: 'app-stage6', status: 'PROTECTED' },
        currentGraph: { id: 'dsg-stage6', graphVersion: synthHost.stateStore.graphVersion, nodes: [], edges: [] },
        tenantId: 'tenant-stage6'
      });

      const isInsufficient =
        assessment.assessmentLabel === ASSESSMENT_LABELS.INSUFFICIENT_EVIDENCE ||
        policyDecision.decisionResult === DECISION_RESULTS.INSUFFICIENT_EVIDENCE;
      const isDeceptionProposed = policyDecision.decisionResult === DECISION_RESULTS.PROPOSE_DECEPTION;

      if (isInsufficient) {
        insufficientEvidenceSteps++;
        degradedSteps++;
      }
      if (isDeceptionProposed) {
        attackFlaggedSteps++;
        if (firstAttackerTimestampMs === null && step.stageNumber > 0) {
          firstAttackerTimestampMs = eventTimestampMs;
        }
      }

      // 4. Paradigm Adaptation + HTTP Forwarding Inside Isolated Harness
      let httpResponse = null;
      let stepViolationCount = 0;

      if (isDeceptionProposed) {
        const adaptStartNs = process.hrtime.bigint();

        if (paradigm === EXPERIMENTAL_PARADIGMS.STATIC_HONEYPOT) {
          // Zero mutations proposed or executed
        } else if (paradigm === EXPERIMENTAL_PARADIGMS.GENERIC_ADAPTIVE) {
          const preState = JSON.parse(JSON.stringify(synthHost.stateStore.getStateSnapshot()));
          const genericMutations = deriveGenericStatelessMutations({ assessment, step });

          let rollingState = preState;
          for (const mut of genericMutations) {
            transitionsProposed++;
            const nextVer = rollingState.graphVersion + 1;
            const proposedWithVer = { ...mut, targetGraphVersion: nextVer };

            // Audit consistency post-hoc without blocking (baseline lacks 7-way DSG gate)
            const auditRes = DSGConsistencyEngine.validateConsistency({
              currentState: rollingState,
              proposedMutation: proposedWithVer,
              currentGraphVersion: rollingState.graphVersion,
              targetGraphVersion: nextVer
            });

            // Execute mutation over live HTTP /internal/mutate
            const mutRes = await httpRequestJson(synthHost.port, {
              method: 'POST',
              path: '/internal/mutate',
              body: proposedWithVer
            });

            if (mutRes.statusCode === 200) {
              transitionsExecuted++;
              rollingState = mutRes.data.currentState;
            } else {
              transitionsRejected++;
            }

            if (auditRes.consistent) {
              transitionsValidated++;
            } else {
              stepViolationCount += auditRes.violations.length;
              consistencyViolations += auditRes.violations.length;
              consistencyViolationDetails.push({
                stepIndex: step.stepIndex,
                operation: mut.operation,
                violations: auditRes.violations
              });
            }
          }
          const adaptMs = Number(process.hrtime.bigint() - adaptStartNs) / 1e6;
          adaptationLatenciesMs.push(adaptMs);
        } else if (paradigm === EXPERIMENTAL_PARADIGMS.ATTACKER_SPECIFIC_DSG) {
          const preState = JSON.parse(JSON.stringify(synthHost.stateStore.getStateSnapshot()));
          const sel = strategySelector.selectStrategy({ assessment, policy });
          const { candidates } = deriveAttackerSpecificDsgMutations({
            assessment,
            step,
            attackerProfile,
            currentState: preState,
            strategy: sel.selectedStrategy || policyDecision.selectedStrategy,
            dsgPlanner,
            policy
          });

          let rollingState = preState;
          for (const mut of candidates) {
            transitionsProposed++;
            const nextVer = rollingState.graphVersion + 1;
            const proposedWithVer = { ...mut, targetGraphVersion: nextVer };

            // Mandatory 7-way consistency gate BEFORE mutating live container state!
            const validation = DSGConsistencyEngine.validateConsistency({
              currentState: rollingState,
              proposedMutation: proposedWithVer,
              currentGraphVersion: rollingState.graphVersion,
              targetGraphVersion: nextVer
            });

            if (!validation.consistent) {
              transitionsRejected++;
              consistencyViolationDetails.push({
                stepIndex: step.stepIndex,
                operation: mut.operation,
                blockedAtGate: true,
                violations: validation.violations
              });
              continue; // Safely rejected prior to execution -> 0 runtime violations!
            }

            transitionsValidated++;
            const mutRes = await httpRequestJson(synthHost.port, {
              method: 'POST',
              path: '/internal/mutate',
              body: proposedWithVer
            });

            if (mutRes.statusCode === 200) {
              transitionsExecuted++;
              rollingState = mutRes.data.currentState;
            } else {
              transitionsRejected++;
            }
          }
          const adaptMs = Number(process.hrtime.bigint() - adaptStartNs) / 1e6;
          adaptationLatenciesMs.push(adaptMs);
        }

        // Dispatch attacker request to isolated synthetic HTTP server
        try {
          httpResponse = await httpRequestJson(synthHost.port, {
            method: step.method,
            path: step.path,
            body: step.body,
            headers: step.headers
          });
          actualSyntheticRequests++;
          decoyInteractions++;
        } catch {
          failedRequests++;
        }
      } else {
        // Benign or Insufficient Evidence -> Safely forwarded to Protected Origin!
        try {
          httpResponse = await httpRequestJson(originHost.port, {
            method: step.method,
            path: step.path,
            body: step.body,
            headers: step.headers
          });
          actualOriginRequests++;
        } catch {
          failedRequests++;
        }
      }

      // 5. Client-Visible Coherence & Deception Effectiveness Audit (for synthetic responses)
      if (isDeceptionProposed && httpResponse) {
        const resData = httpResponse.data || {};
        const stepIndicators = [];
        const liveState = synthHost.stateStore.getStateSnapshot();

        // Check if synthetic server fell back to wrong identity on /api/v1/users/:id
        if (step.path.startsWith('/api/v1/users/') && httpResponse.statusCode === 200) {
          const requestedUser = step.path.replace('/api/v1/users/', '');
          const returnedUsername = resData.data?.username;
          const returnedId = resData.data?.id;
          if (returnedUsername !== requestedUser && returnedId !== requestedUser) {
            stepIndicators.push(`IDENTITY_FALLBACK_CONTRADICTION: Requested "${requestedUser}", received "${returnedUsername}"`);
          } else if (resData.data?.role) {
            attackerProfile.observedUserRoles.set(returnedUsername, resData.data.role);
            syntheticAssetsExplored.add(`user:${returnedUsername}`);
          }
        }

        // Check /api/v1/auth/login response identity and role consistency
        if (step.path === '/api/v1/auth/login' && step.method === 'POST' && httpResponse.statusCode === 200) {
          const reqUser = step.body?.username || 'alex.chen';
          if (resData.user?.username !== reqUser) {
            stepIndicators.push(`AUTH_IDENTITY_MISMATCH: Logged in as "${reqUser}", response returned user "${resData.user?.username}"`);
          } else {
            const knownUser = liveState.users.find((u) => u.username === reqUser);
            const observedPriorRole = attackerProfile.observedUserRoles.get(reqUser) || knownUser?.role;
            if (observedPriorRole && resData.role && resData.role !== observedPriorRole) {
              stepIndicators.push(`AUTH_ROLE_CONTRADICTION: Login role "${resData.role}" conflicts with profile role "${observedPriorRole}"`);
            } else {
              syntheticAssetsExplored.add(`cred:${reqUser}`);
              if (resData.user?.role) attackerProfile.observedUserRoles.set(reqUser, resData.user.role);
            }
          }
        }

        // Check /api/v1/auth/session active service consistency
        if (step.path === '/api/v1/auth/session' && httpResponse.statusCode === 200) {
          if (resData.active === false) {
            stepIndicators.push('SERVICE_DEPENDENCY_BROKEN: SYNTHETIC_AUTH reported inactive while auth session route responded');
          } else {
            syntheticAssetsExplored.add('service:SYNTHETIC_AUTH');
          }
        }

        // Check /api/v1/auth/roles coherence
        if (step.path === '/api/v1/auth/roles' && httpResponse.statusCode === 200) {
          const rolesList = resData.roles || [];
          for (const [u, role] of attackerProfile.observedUserRoles.entries()) {
            if (!rolesList.includes(role)) {
              stepIndicators.push(`ROLE_LIST_OMISSION: Role "${role}" for "${u}" missing from /auth/roles`);
            }
          }
          if (stepIndicators.length === 0) syntheticAssetsExplored.add('auth:roles');
        }

        // Check sensitive data schema canary integrity
        if (step.path.includes('/data/schemas') && httpResponse.statusCode === 200) {
          const custTable = (resData.data || []).find((s) => SENSITIVE_CANARY_TABLES.has(s.table) && s.table === 'synthetic_customers');
          if (custTable && !custTable.columns?.some((c) => CANARY_COLUMN_NAMES.has(c))) {
            stepIndicators.push('SCHEMA_CANARY_MISSING: synthetic_customers schema lacks tracking canary column');
          } else {
            syntheticAssetsExplored.add('schema:synthetic_customers');
          }
        }

        if (step.path.includes('/data/customers') && httpResponse.statusCode === 200) {
          for (const c of (resData.data || [])) {
            syntheticAssetsExplored.add(`customer:${c.customerId}`);
          }
        }

        // Dynamic /api/v1/internal/* or custom endpoint discovery check
        if (
          step.path.startsWith('/api/') &&
          !INITIAL_SYNTHETIC_STATE.baselineRoutes.includes(step.path) &&
          !step.path.startsWith('/api/v1/users/')
        ) {
          if (httpResponse.statusCode === 404) {
            stepIndicators.push(`ENDPOINT_DEAD_END_404: Target route "${step.path}" unadapted (404)`);
          } else if (httpResponse.statusCode >= 500) {
            stepIndicators.push(`ENDPOINT_SERVICE_FAILURE_${httpResponse.statusCode}: "${step.path}" unavailable`);
          } else if (httpResponse.statusCode === 200) {
            syntheticAssetsExplored.add(`route:${step.path}`);
          }
        }

        if (stepIndicators.length > 0) {
          prematureRecognitionIndicators += stepIndicators.length;
          prematureRecognitionDetails.push({ stepIndex: step.stepIndex, indicators: stepIndicators });
        }

        const isMeaningful =
          httpResponse.statusCode === 200 &&
          stepIndicators.length === 0 &&
          stepViolationCount === 0;

        if (isMeaningful) {
          meaningfulInteractions++;
          if (step.stageNumber > 0) {
            completedStages.add(step.stageNumber);
          }
          lastMeaningfulTimestampMs = eventTimestampMs;
        }
      }

      const stepElapsedMs = Number(process.hrtime.bigint() - stepStartNs) / 1e6;
      requestLatenciesMs.push(stepElapsedMs);

      stepResults.push({
        stepIndex: step.stepIndex,
        path: step.path,
        assessmentLabel: assessment.assessmentLabel,
        deceptionProposed: isDeceptionProposed,
        routedTo: isDeceptionProposed ? 'SYNTHETIC_HOST' : 'PROTECTED_ORIGIN',
        httpStatus: httpResponse?.statusCode || null,
        stepLatencyMs: Number(stepElapsedMs.toFixed(4))
      });
    }

    const cpuDiff = process.cpuUsage(cpuStart);
    const heapDeltaMb = Number(((process.memoryUsage().heapUsed - heapStartBytes) / (1024 * 1024)).toFixed(4));

    const simulatedEngagementDurationMs =
      firstAttackerTimestampMs !== null && lastMeaningfulTimestampMs !== null && lastMeaningfulTimestampMs >= firstAttackerTimestampMs
        ? lastMeaningfulTimestampMs - firstAttackerTimestampMs
        : 0;

    // Scenario-level verdict computed strictly from observed step decisions
    let observedScenarioVerdict = 'BENIGN';
    if (attackFlaggedSteps > 0) {
      observedScenarioVerdict = 'ATTACK_PROPOSED';
    } else if (insufficientEvidenceSteps > 0) {
      observedScenarioVerdict = 'INSUFFICIENT_EVIDENCE';
    }

    const finalSnapshot = synthHost.stateStore.getStateSnapshot();

    return {
      scenarioId: scenario.scenarioId,
      partition: scenario.partition,
      taxonomy: scenario.taxonomy,
      groundTruthCategory: scenario.groundTruthCategory,
      paradigm,
      warmUpOnly,
      observedScenarioVerdict,
      detectionBreakdown: {
        totalSteps: scenario.requestSequence.length,
        attackFlaggedSteps,
        insufficientEvidenceSteps,
        benignSteps: scenario.requestSequence.length - attackFlaggedSteps - insufficientEvidenceSteps,
        degradedSteps
      },
      deceptionEffectiveness: {
        decoyInteractions,
        meaningfulInteractions,
        simulatedEngagementDurationMs,
        attackStagesCompleted: completedStages.size,
        expectedStagesMax: Math.max(0, ...scenario.requestSequence.map((s) => s.stageNumber)),
        syntheticAssetsExplored: syntheticAssetsExplored.size,
        consistencyViolations,
        prematureRecognitionIndicators,
        prematureRecognitionDetails
      },
      adaptationQuality: {
        transitionsProposed,
        transitionsValidated,
        transitionsExecuted,
        transitionsRejected,
        finalGraphVersion: finalSnapshot.graphVersion,
        meanAdaptationLatencyMs:
          adaptationLatenciesMs.length > 0
            ? Number((adaptationLatenciesMs.reduce((a, b) => a + b, 0) / adaptationLatenciesMs.length).toFixed(4))
            : 0,
        consistencyViolationDetails
      },
      routingSafety: {
        actualOriginRequests,
        actualSyntheticRequests,
        failedRequests
      },
      performance: {
        requestLatenciesMs,
        runtimeProvisioningTimeMs: Number(synthHost.provisioningMs.toFixed(4)),
        cpuUserMs: Number((cpuDiff.user / 1000).toFixed(4)),
        cpuSystemMs: Number((cpuDiff.system / 1000).toFixed(4)),
        heapDeltaMb
      },
      stepResults
    };
  } finally {
    await synthHost.close();
    await originHost.close();
  }
}
