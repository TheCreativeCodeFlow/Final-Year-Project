/**
 * End-to-End Gateway Decision Simulator Service
 * Stage 2B.5 — AI-Enabled Adaptive Cyber Deception Gateway
 * 
 * IMPORTANT: This is a client-side deterministic simulation engine for research demonstration.
 * No real packet inspection, reverse proxy diversion, live ML inference, or honeynet container
 * execution is performed. All outputs represent simulated decision workflows.
 */

import {
  getTenants,
  getApplications,
  getDeceptionPolicies,
  getDeceptionStrategies,
  getDeceptionEnvironments,
  validateDeceptionPolicy
} from './mockData.js';

export const STORAGE_KEY_GATEWAY_SIM_HISTORY = 'cyber_deception_gateway_sim_history';

// --- 7 Standard Predefined Fictional Scenarios ---
export const DEFAULT_SIMULATOR_SCENARIOS = [
  {
    id: 'sim-scen-normal-01',
    title: 'Scenario 1: Normal-Looking Request',
    shortName: 'Normal-Looking Request',
    category: 'benign_traffic',
    description: 'Standard authenticated customer account balance inquiry presenting valid JWT session claims, standard browser headers, and typical request intervals.',
    tenantId: 'tenant-apex-9941',
    tenantName: 'Apex FinTech Cloud',
    applicationId: 'app-01',
    applicationName: 'Customer Accounts API',
    httpMethod: 'GET',
    syntheticPath: '/api/v1/accounts/summary',
    sessionIdentifier: 'sess-legit-4882-a',
    requestRate: '1 req / 5s',
    authFailureCount: 0,
    telemetryCompleteness: 'Complete (100%)',
    canaryEvidence: null,
    directlyObservedFacts: [
      {
        indicator: 'Valid Session Bearer Token',
        fact: 'Ingress GET request presented valid session cookie sess_apex_auth_v2 signed by legitimate authority.',
        source: 'Edge Reverse Proxy'
      },
      {
        indicator: 'Standard Interaction Cadence',
        fact: 'Request interval measured at 0.20 req/s, consistent with interactive customer navigation.',
        source: 'Traffic Ingress Meter'
      },
      {
        indicator: 'Verified Client Cipher Suite',
        fact: 'TLS 1.3 handshake negotiated with standard browser cipher suite (ECDHE-ECDSA-AES256-GCM-SHA384).',
        source: 'Edge TLS Terminator'
      }
    ],
    detectorDerivedInterpretations: [
      {
        interpretation: 'Anomaly Detector Output: Baseline customer session activity.',
        score: 0.02,
        detector: 'Behavioral Anomaly Classifier (Simulated Output)',
        caveat: 'Score reflects simulated statistical metric, not proof of safety.'
      },
      {
        interpretation: 'Session Consistency: User-Agent and origin IP match historical session profile.',
        score: 0.99,
        detector: 'Client Fingerprint Verifier',
        caveat: 'Fingerprint consistency does not guarantee absence of subtle compromise.'
      }
    ],
    missingEvidence: [],
    behavioralAssessment: {
      classification: 'No suspicious indicators recorded',
      rationale: 'Observed request parameters, authentication tokens, and request frequency are typical for an authorized customer session. No anomalous indicators detected.',
      confidenceNote: 'Simulated baseline assessment based on complete telemetry.'
    },
    candidatePolicyIds: ['pol-sec-01', 'pol-sec-03', 'pol-sec-07'],
    candidateStrategyIds: [],
    expectedIntendedRoute: 'Continue to protected application',
    expectedRecordedOutcome: 'Recorded: Protected Application Route',
    discrepancyDetails: null,
    targetEnvironmentId: null,
    linkedInvestigationId: null
  },
  {
    id: 'sim-scen-recon-02',
    title: 'Scenario 2: Suspicious Endpoint Reconnaissance',
    shortName: 'Suspicious Endpoint Reconnaissance',
    category: 'reconnaissance',
    description: 'Automated vulnerability scanner probing sensitive administrative and introspection endpoints across multiple paths with high burst rate.',
    tenantId: 'tenant-nexushub-3319',
    tenantName: 'NexusHub SaaS Ecosystem',
    applicationId: 'app-41',
    applicationName: 'Core Multi-Tenant GraphQL API',
    httpMethod: 'POST',
    syntheticPath: '/graphql?query=__schema{types{name,fields{name}}}',
    sessionIdentifier: 'sess-recon-9912-q',
    requestRate: '24 req / 10s',
    authFailureCount: 0,
    telemetryCompleteness: 'Complete (100%)',
    canaryEvidence: null,
    directlyObservedFacts: [
      {
        indicator: 'GraphQL Full Introspection Probe',
        fact: 'Ingress POST query explicitly requested complete __schema AST tree from untrusted origin.',
        source: 'GraphQL Gateway Filter'
      },
      {
        indicator: 'Automated Tool User-Agent Signature',
        fact: 'User-Agent header contains signature "Nuclei/v2.9.15 (ProjectDiscovery)".',
        source: 'Edge Reverse Proxy'
      },
      {
        indicator: 'High-Frequency Endpoint Burst',
        fact: '24 requests received across 10 seconds enumerating administrative schema fields.',
        source: 'Ingress Rate Monitor'
      }
    ],
    detectorDerivedInterpretations: [
      {
        interpretation: 'AST Complexity Risk: Introspection query targets internal mutations and admin schemas.',
        score: 0.89,
        detector: 'GraphQL AST Inspection Filter',
        caveat: 'High score indicates scanner pattern, not confirmed adversary identity.'
      },
      {
        interpretation: 'Reconnaissance Signature: Automated scanner signature match confirmed.',
        score: 0.98,
        detector: 'Threat Pattern Matcher',
        caveat: 'Signature matches automated tool, which could be an authorized external assessment.'
      }
    ],
    missingEvidence: [],
    behavioralAssessment: {
      classification: 'Reconnaissance-like behavior',
      rationale: 'Rapid systematic traversal of GraphQL schema elements and automated scanner tool header indicate active pre-attack reconnaissance.',
      confidenceNote: 'Simulated classification indicating automated discovery pattern.'
    },
    candidatePolicyIds: ['pol-sec-05', 'pol-sec-03'],
    candidateStrategyIds: ['strat-canary-01'],
    expectedIntendedRoute: 'Route to an approved synthetic deception environment',
    expectedRecordedOutcome: 'Recorded: Deception Route',
    discrepancyDetails: null,
    targetEnvironmentId: 'env-nexus-api-05',
    linkedInvestigationId: 'inv-805'
  },
  {
    id: 'sim-scen-auth-03',
    title: 'Scenario 3: Repeated Authentication Failures',
    shortName: 'Repeated Authentication Failures',
    category: 'credential_stuffing',
    description: 'High-frequency dictionary credential stuffing attack against the authentication endpoint presenting common administrative usernames.',
    tenantId: 'tenant-apex-9941',
    tenantName: 'Apex FinTech Cloud',
    applicationId: 'app-01',
    applicationName: 'Customer Accounts API',
    httpMethod: 'POST',
    syntheticPath: '/api/v1/auth/login',
    sessionIdentifier: 'sess-bf-7719-k',
    requestRate: '40 attempts / min',
    authFailureCount: 40,
    telemetryCompleteness: 'Complete (100%)',
    canaryEvidence: null,
    directlyObservedFacts: [
      {
        indicator: 'Rapid Authentication Failures',
        fact: '40 consecutive failed POST requests to /api/v1/auth/login within 60 seconds.',
        source: 'Authentication Service Meter'
      },
      {
        indicator: 'Dictionary Username Spray',
        fact: 'Payloads rotated across dictionary usernames: admin, root, superadmin, test_user, operator.',
        source: 'Ingress Inspection Buffer'
      },
      {
        indicator: 'Untrusted Origin IP',
        fact: 'Origin IP 198.51.100.22 has zero historical legitimate sessions on Apex FinTech Cloud.',
        source: 'IP Reputation Cache'
      }
    ],
    detectorDerivedInterpretations: [
      {
        interpretation: 'Credential Stuffing Anomaly: Burst rate exceeds threshold by 160%.',
        score: 0.96,
        detector: 'Credential Attack Detector',
        caveat: 'Score reflects volumetric burst pattern.'
      },
      {
        interpretation: 'Dictionary Variety Entropy: High diversity of administrative credentials tested.',
        score: 0.94,
        detector: 'Entropy Analysis Subsystem',
        caveat: 'High entropy indicates programmatic enumeration.'
      }
    ],
    missingEvidence: [],
    behavioralAssessment: {
      classification: 'Repeated authentication failures',
      rationale: 'Failure rate (40/min) substantially exceeds policy threshold (>= 25/min). Attack characteristics match automated dictionary credential stuffing.',
      confidenceNote: 'High confidence simulated burst pattern.'
    },
    candidatePolicyIds: ['pol-sec-01', 'pol-sec-03'],
    candidateStrategyIds: ['strat-auth-01'],
    expectedIntendedRoute: 'Route to an approved synthetic deception environment',
    expectedRecordedOutcome: 'Recorded: Deception Route',
    discrepancyDetails: null,
    targetEnvironmentId: 'env-apex-auth-01',
    linkedInvestigationId: 'inv-801'
  },
  {
    id: 'sim-scen-canary-04',
    title: 'Scenario 4: Recorded Canary-Token Interaction',
    shortName: 'Recorded Canary-Token Interaction',
    category: 'canary_tripwire',
    description: 'Inbound request presents cryptographic canary token harvested from planted synthetic documentation, triggering high-confidence tripwire.',
    tenantId: 'tenant-apex-9941',
    tenantName: 'Apex FinTech Cloud',
    applicationId: 'app-01',
    applicationName: 'Customer Accounts API',
    httpMethod: 'GET',
    syntheticPath: '/api/v1/internal/pci-spec',
    sessionIdentifier: 'sess-canary-3301-m',
    requestRate: '2 req / 10s',
    authFailureCount: 0,
    telemetryCompleteness: 'Complete (100%)',
    canaryEvidence: 'CANARY_TOKEN_HASH_#88912 (Planted in fake document ast-apex-doc-01)',
    directlyObservedFacts: [
      {
        indicator: 'Canary Token Ingress Match',
        fact: 'Authorization header contains cryptographic canary token signature CANARY_TOKEN_HASH_#88912.',
        source: 'Token Verification Service'
      },
      {
        indicator: 'Decoy Asset Association',
        fact: 'Token matches active registry record planted inside decoy specification ast-apex-doc-01.',
        source: 'Platform Canary Registry'
      },
      {
        indicator: 'Zero Legitimate Operational Use',
        fact: 'Token signature has never been issued to legitimate production identities or services.',
        source: 'Credential Authority'
      }
    ],
    detectorDerivedInterpretations: [
      {
        interpretation: 'Canary Tripwire Match: Exact match against synthetic token registry.',
        score: 1.0,
        detector: 'Deterministic Tripwire Engine',
        caveat: 'Hard positive match confirms decoy document was harvested and reused.'
      },
      {
        interpretation: 'Threat Severity Assessment: Critical risk indicating deliberate credential theft.',
        score: 0.99,
        detector: 'Threat Escalation Classifier',
        caveat: 'Analyst review is mandated by platform policy before secondary decoy mutation.'
      }
    ],
    missingEvidence: [],
    behavioralAssessment: {
      classification: 'Recorded canary-token interaction',
      rationale: 'Explicit presentation of synthetic honeytoken definitively proves adversary engagement with platform decoys. Tripwire activated.',
      confidenceNote: 'Deterministic match on recorded cryptographic canary token.'
    },
    candidatePolicyIds: ['pol-sec-07', 'pol-sec-01'],
    candidateStrategyIds: ['strat-canary-01'],
    expectedIntendedRoute: 'Require analyst review',
    expectedRecordedOutcome: 'Recorded: Deception Route',
    discrepancyDetails: null,
    targetEnvironmentId: 'env-apex-auth-01',
    linkedInvestigationId: 'inv-801'
  },
  {
    id: 'sim-scen-missing-05',
    title: 'Scenario 5: Missing or Incomplete Telemetry',
    shortName: 'Missing or Incomplete Telemetry',
    category: 'missing_telemetry',
    description: 'Request arrives through anomalous upstream proxy path with stripped TCP headers, missing client IP, and telemetry pipeline timeout.',
    tenantId: 'tenant-medsecure-1022',
    tenantName: 'MedSecure Health Net',
    applicationId: 'app-11',
    applicationName: 'Patient Records FHIR API',
    httpMethod: 'POST',
    syntheticPath: '/fhir/v4/DiagnosticReport',
    sessionIdentifier: 'Unknown / Not Recorded',
    requestRate: 'Unknown / Not Recorded',
    authFailureCount: 'Unknown / Not Recorded',
    telemetryCompleteness: 'Incomplete (Missing critical headers & behavioral vector)',
    canaryEvidence: 'Unknown / Not Recorded',
    directlyObservedFacts: [
      {
        indicator: 'Inbound Socket Connection',
        fact: 'HTTP/1.1 POST request received at /fhir/v4/DiagnosticReport with payload size 4,120 bytes.',
        source: 'Ingress Edge Socket'
      },
      {
        indicator: 'Corrupted Upstream Proxy Headers',
        fact: 'Upstream reverse proxy stripped X-Forwarded-For, Client-IP, and TLS extension metadata.',
        source: 'Protocol Gateway'
      }
    ],
    detectorDerivedInterpretations: [
      {
        interpretation: 'Detector Status: Detection pipeline timed out (ERR_TIMEOUT_TELEMETRY).',
        score: 0.0,
        detector: 'Behavioral Inspection Subsystem',
        caveat: 'Score is unavailable. Missing telemetry must NEVER be assumed benign.'
      }
    ],
    missingEvidence: [
      'Client Origin IP Address (Unknown)',
      'Behavioral Anomaly Telemetry Vector (Not Recorded)',
      'Session Fingerprint & Historical Reputation (Unknown)',
      'Client TLS Cipher Suite Extension Data (Not Recorded)'
    ],
    behavioralAssessment: {
      classification: 'Incomplete evidence',
      rationale: 'Critical behavioral telemetry could not be gathered due to upstream pipeline timeout. Traffic cannot be verified with available signals. Missing evidence is strictly preserved as Unknown / Not Recorded and never assumed safe. Missing telemetry yields zero confidence in benign classification.',
      confidenceNote: 'Fail-safe invariant: Missing evidence is strictly treated as unknown, never safe. Deception routing is prohibited when required preconditions cannot be established.'
    },
    candidatePolicyIds: ['pol-sec-03', 'pol-sec-02'],
    candidateStrategyIds: ['strat-bola-02'],
    expectedIntendedRoute: 'Block at gateway',
    expectedRecordedOutcome: 'Recorded: Blocked',
    protocolResponse: 'HTTP 400 Bad Request',
    protocolResponseExplanation: 'Conceptual response choice for this simulated scenario representing a client-side protocol error due to stripped proxy headers; not a universal fail-closed standard across all gateway endpoints.',
    discrepancyDetails: null,
    targetEnvironmentId: 'env-med-fhir-02',
    linkedInvestigationId: 'inv-806'
  },
  {
    id: 'sim-scen-isolation-06',
    title: 'Scenario 6: Isolation Constraint Triggered',
    shortName: 'Isolation Constraint Triggered',
    category: 'isolation_boundary',
    description: 'Prohibited isolation-conflicting action: Synthetic decoy container attempts outbound raw socket connection toward external C2 address, violating zero-egress platform boundary pol-sec-03 and environment isolation boundaries of pol-sec-06.',
    tenantId: 'tenant-omni-4401',
    tenantName: 'OmniLogistics Global',
    applicationId: 'app-21',
    applicationName: 'Fleet Dispatch WebSocket',
    httpMethod: 'POST',
    syntheticPath: '/ws/dispatch/stream',
    sessionIdentifier: 'sess-iso-8812-p',
    requestRate: '1 request (Socket Connect Attempt)',
    authFailureCount: 0,
    telemetryCompleteness: 'Complete (Kernel eBPF trace verified)',
    canaryEvidence: null,
    directlyObservedFacts: [
      {
        indicator: 'Outbound Socket connect() Call',
        fact: 'Process PID 41092 inside container decoy-worker-pod-89b called connect() to external IP 198.51.100.44:443.',
        source: 'Linux eBPF Kernel Probe'
      },
      {
        indicator: 'Zero-Egress Security Policy Violation',
        fact: 'Packet destination is outside the synthetic cluster network, violating platform-wide zero-egress boundary (pol-sec-03).',
        source: 'eBPF Network Monitor'
      },
      {
        indicator: 'Kernel Packet Drop Enforced',
        fact: 'Cilium container security subsystem enforced verdict DROP_DISPATCH at network layer.',
        source: 'Kernel Firewall Subsystem'
      }
    ],
    detectorDerivedInterpretations: [
      {
        interpretation: 'Boundary Invariant Violation: Outbound egress detected from synthetic asset.',
        score: 1.0,
        detector: 'Containment Boundary Monitor',
        caveat: 'Deterministic kernel event. Containment interlock engages unconditionally.'
      }
    ],
    missingEvidence: [],
    behavioralAssessment: {
      classification: 'Isolation constraint triggered',
      rationale: 'Outbound raw socket connection attempt from synthetic decoy violates platform zero-egress policy pol-sec-03 and environment isolation constraints of pol-sec-06. Strict containment interlock invoked: isolation violations must never be treated as authorization to divert or route traffic.',
      confidenceNote: 'Critical boundary containment interlock: Strategy execution prohibited.'
    },
    candidatePolicyIds: ['pol-sec-03', 'pol-sec-06'],
    candidateStrategyIds: ['strat-contain-06', 'strat-egress-03'],
    expectedIntendedRoute: 'Block at gateway',
    expectedRecordedOutcome: 'Recorded: Blocked',
    discrepancyDetails: null,
    targetEnvironmentId: 'env-omni-fleet-03',
    linkedInvestigationId: 'inv-803'
  },
  {
    id: 'sim-scen-discrepancy-07',
    title: 'Scenario 7: Policy Decision and Routing Outcome Discrepancy',
    shortName: 'Policy vs. Routing Discrepancy',
    category: 'discrepancy',
    description: 'High-assurance APT signature identified. Policy engine selected Honeynet diversion, but edge relay enforced immediate air-gap TCP Reset.',
    tenantId: 'tenant-aerodyn-8823',
    tenantName: 'AeroDynamics Defence Lab',
    applicationId: 'app-31',
    applicationName: 'Telemetry Ingestion Relay',
    httpMethod: 'POST',
    syntheticPath: '/telemetry/v1/sync',
    sessionIdentifier: 'sess-apt-993-x',
    requestRate: '48 packets / 25min',
    authFailureCount: 0,
    telemetryCompleteness: 'Complete (100%)',
    canaryEvidence: null,
    directlyObservedFacts: [
      {
        indicator: 'Nation-State Binary Threat Signature',
        fact: 'Ingress byte stream at /telemetry/v1/sync contained exact match for classified signature SIG-APT-DEF-88.',
        source: 'Ingress Packet Inspector'
      },
      {
        indicator: 'Spoofed Protocol Framing',
        fact: 'TCP packet sequence contained non-standard TCP options header with military avionics framing markers.',
        source: 'Hardware eBPF Relay'
      },
      {
        indicator: 'Edge Hardware TCP Reset Enforced',
        fact: 'Edge Ingress Relay hardware buffer terminated socket with immediate TCP Reset at 14:44:10 UTC.',
        source: 'Edge Gateway Relay Log'
      }
    ],
    detectorDerivedInterpretations: [
      {
        interpretation: 'Threat Intelligence Match: Classified nation-state probe signature confirmed.',
        score: 0.999,
        detector: 'Classified Threat Intelligence Classifier',
        caveat: 'Score reflects deterministic threat signature match from defense catalog.'
      },
      {
        interpretation: 'Sovereign Tier Risk: Air-gap containment supersedes dynamic honeynet diversion.',
        score: 1.0,
        detector: 'Air-Gap Interlock Subsystem',
        caveat: 'Air-gap protection takes immediate precedence over honeynet diversion.'
      }
    ],
    missingEvidence: [],
    behavioralAssessment: {
      classification: 'Nation-State Threat Signature Match (APT)',
      rationale: 'Binary payload matches classified sovereign defense signature. Policy rule indicates Honeynet diversion, but Edge Hardware Interlock enforced instant TCP Reset.',
      confidenceNote: 'Discrepancy scenario: Configured policy selection diverged from recorded edge outcome.'
    },
    candidatePolicyIds: ['pol-sec-04', 'pol-sec-03'],
    candidateStrategyIds: ['strat-airgap-04'],
    expectedIntendedRoute: 'Route to an approved synthetic deception environment',
    expectedRecordedOutcome: 'Recorded: Blocked',
    discrepancyDetails: 'Discrepancy Warning (Simulated): Policy Engine designated diversion to High-Interaction Honeynet container (env-aero-apt-04), but independent recorded outcome fixture indicates connection was blocked due to classified air-gap isolation trigger. Claimed Cause: Scenario-provided simulated evidence (not an independently observed live fact) indicates edge relay enforced hardware TCP Reset under sovereign containment rules before honeynet pod handoff. The simulator did not execute a real TCP reset or contact a real gateway. (Reference: Investigation inv-804)',
    targetEnvironmentId: 'env-aero-apt-04',
    linkedInvestigationId: 'inv-804'
  }
];

// --- Deterministic Simulation Engine ---

/**
 * Runs a simulated gateway decision lifecycle on a fictional scenario.
 * 
 * @param {string} scenarioId 
 * @param {object} [options]
 * @returns {Promise<object>} Structured simulation run result
 */
export async function runGatewaySimulation(scenarioId, options = {}) {
  const scenario = DEFAULT_SIMULATOR_SCENARIOS.find(s => s.id === scenarioId) || DEFAULT_SIMULATOR_SCENARIOS[0];

  // Resolve platform data
  const [tenants, applications, policies, strategies, environments] = await Promise.all([
    getTenants(),
    getApplications(),
    getDeceptionPolicies(),
    getDeceptionStrategies(),
    getDeceptionEnvironments()
  ]);

  const matchedTenant = tenants.find(t => t.id === scenario.tenantId) || {
    id: scenario.tenantId,
    name: scenario.tenantName
  };

  const matchedApplication = applications.find(a => a.id === scenario.applicationId) || {
    id: scenario.applicationId,
    name: scenario.applicationName,
    tenantId: scenario.tenantId
  };

  const targetEnvironment = scenario.targetEnvironmentId
    ? environments.find(e => e.id === scenario.targetEnvironmentId) || null
    : null;

  // --- 1. Policy Evaluation Stage ---
  // Filter candidate policies strictly respecting scope and tenant consistency:
  const candidatePolicies = policies.filter(p => {
    // Platform-wide policies apply to all tenants
    if (p.scope === 'platform') return true;
    // Tenant or environment policies MUST match tenant
    if (p.tenantId === scenario.tenantId) {
      if (p.scope === 'environment') {
        // Must match targeted environment if specified
        return !p.environmentId || p.environmentId === scenario.targetEnvironmentId;
      }
      return true;
    }
    return false;
  });

  // Evaluate candidate policies deterministically
  const evaluatedPolicies = candidatePolicies.map(policy => {
    const validation = validateDeceptionPolicy(policy);
    const isApplicable = scenario.candidatePolicyIds.includes(policy.id);

    let matchStatus = 'Not Applicable';
    let applicabilityReason = 'Trigger conditions do not match current scenario indicators.';

    if (isApplicable) {
      if (validation.status === 'Invalid') {
        matchStatus = 'Invalid Policy';
        applicabilityReason = 'Policy matches scenario trigger but fails deterministic safety validation.';
      } else {
        matchStatus = 'Applicable';
        applicabilityReason = `Trigger conditions satisfied by scenario evidence (Priority: ${policy.priority}).`;
      }
    }

    return {
      policy,
      validation,
      matchStatus,
      applicabilityReason,
      isApplicable
    };
  });

  // Select the highest priority applicable valid policy
  const applicablePolicies = evaluatedPolicies.filter(ep => ep.matchStatus === 'Applicable');
  applicablePolicies.sort((a, b) => a.policy.priority - b.policy.priority);
  const selectedPolicyEntry = applicablePolicies.length > 0 ? applicablePolicies[0] : null;
  const selectedPolicy = selectedPolicyEntry ? selectedPolicyEntry.policy : null;

  // --- 2. Strategy Eligibility Stage ---
  const candidateStrategies = strategies.filter(s => scenario.candidateStrategyIds.includes(s.id));
  let evaluatedStrategyResult = null;

  if (candidateStrategies.length > 0) {
    const strat = candidateStrategies[0];

    let stratStatus = 'Eligible (Simulated)';
    let stratReason = `Preconditions verified under policy ${selectedPolicy ? selectedPolicy.id : 'N/A'}. Strategy is eligible for simulated execution.`;
    let satisfiedConds = [...strat.requiredEvidence];
    let unmetConds = [];
    let unknownConds = [];

    // Enforce strict safety invariants:
    if (scenario.id === 'sim-scen-missing-05') {
      stratStatus = 'Ineligible (Fail-Closed)';
      stratReason = 'Mandatory Safety Invariant: Missing or incomplete telemetry must NEVER be treated as safe or normal traffic. Strategy evaluation is prohibited when required behavioral evidence is unknown or unverified. Deception routing cannot be authorized.';
      satisfiedConds = [];
      unmetConds = ['Required behavioral telemetry vector missing'];
      unknownConds = [...scenario.missingEvidence];
    } else if (scenario.id === 'sim-scen-isolation-06') {
      stratStatus = 'Ineligible (Fail-Closed)';
      stratReason = 'Strict Containment Interlock: Outbound raw socket egress attempt violates platform zero-egress policy pol-sec-03 and environment isolation boundaries of pol-sec-06. Strategy execution is prohibited; container must be quarantined immediately. Isolation violations must never be treated as authorization to divert or route traffic.';
      satisfiedConds = ['Container PID verified in sandbox'];
      unmetConds = ['Zero-egress boundary violated by outbound socket connect()'];
    } else if (scenario.id === 'sim-scen-canary-04') {
      stratStatus = 'Requires Review';
      stratReason = `${strat.name} requires human analyst authorization before secondary decoy mutation under policy pol-sec-07.`;
    }

    const rawAction = strat.intendedSyntheticStateChanges ? strat.intendedSyntheticStateChanges[0] : 'None registered';
    const formattedProposedAction = scenario.id === 'sim-scen-missing-05'
      ? 'Proposed Action — Not Executed: Fail closed (Reject with conceptual HTTP 400 Bad Request; unverified traffic dropped before origin)'
      : scenario.id === 'sim-scen-isolation-06'
      ? 'Proposed Action — Not Executed: Fail-closed container quarantine and socket termination'
      : rawAction.startsWith('Proposed Action') ? rawAction : `Proposed Action — Not Executed: ${rawAction}`;

    evaluatedStrategyResult = {
      strategy: strat,
      status: stratStatus,
      reason: stratReason,
      satisfiedConditions: satisfiedConds,
      unmetConditions: unmetConds,
      unknownConditions: unknownConds,
      proposedSyntheticAction: formattedProposedAction,
      compatiblePolicyIds: strat.compatiblePolicyIds || [],
      isolationAnalysis: {
        isIsolationPermitted: scenario.id !== 'sim-scen-isolation-06',
        scopeNote: scenario.id === 'sim-scen-isolation-06'
          ? 'Prohibited: Outbound egress violates platform boundary pol-sec-03 and tenant pool isolation of pol-sec-06.'
          : 'Isolation constraints verified: Destination sandbox strictly isolated to tenant scope.'
      }
    };
  } else if (scenario.id === 'sim-scen-normal-01') {
    evaluatedStrategyResult = {
      strategy: null,
      status: 'Not Evaluated',
      reason: 'Standard customer traffic with zero threat indicators; deception strategy selection was not invoked.',
      satisfiedConditions: [],
      unmetConditions: [],
      unknownConditions: [],
      proposedSyntheticAction: 'Proposed Action — Not Executed: None (Forward to production service)',
      compatiblePolicyIds: [],
      isolationAnalysis: {
        isIsolationPermitted: true,
        scopeNote: 'Not Applicable (Benign customer traffic directed to production origin).'
      }
    };
  }

  // --- 3. Intended Routing Decision Stage ---
  let intendedDecision = scenario.expectedIntendedRoute;
  let intendedRationale = '';
  let protocolResponse = null;
  let protocolResponseExplanation = null;

  switch (scenario.id) {
    case 'sim-scen-normal-01':
      intendedRationale = 'Zero threat indicators observed; telemetry is complete and session token is valid. Traffic continues to protected production application.';
      protocolResponse = 'HTTP 200 OK (Proxied to Origin)';
      protocolResponseExplanation = 'Standard HTTP reverse proxy passthrough to protected production upstream service.';
      break;
    case 'sim-scen-recon-02':
      intendedRationale = `Automated GraphQL schema enumeration matches policy ${selectedPolicy?.id || 'pol-sec-05'}. Inbound request diverted to synthetic API sandbox ${targetEnvironment?.name || 'env-nexus-api-05'}.`;
      protocolResponse = 'HTTP 200 OK (Synthetic Decoy Schema Response)';
      protocolResponseExplanation = 'Gateway proxies request to synthetic API mock containing restricted decoy introspection schema.';
      break;
    case 'sim-scen-auth-03':
      intendedRationale = `Dictionary attack burst (40/min) exceeds policy threshold. Session diverted to progressive tarpit honeynet ${targetEnvironment?.name || 'env-apex-auth-01'}.`;
      protocolResponse = 'HTTP 401 Unauthorized (Synthetic Decoy with Tarpit Delay)';
      protocolResponseExplanation = 'Gateway injects artificial progressive latency and serves synthetic auth failure prompts.';
      break;
    case 'sim-scen-canary-04':
      intendedRationale = 'Cryptographic canary token tripwire activated. Session quarantined in isolated sandbox namespace pending mandatory Tier-2 SecOps analyst sign-off.';
      protocolResponse = 'HTTP 200 OK (Isolated Sandbox Namespace)';
      protocolResponseExplanation = 'Decoy response served from isolated ephemeral container namespace while incident investigation is opened.';
      break;
    case 'sim-scen-missing-05':
      intendedRationale = 'Critical client origin and behavioral telemetry vector is missing. Mandatory fail-safe invariant enforces connection drop (conceptual HTTP 400). Unverified traffic is never forwarded to protected origin or deception environments.';
      protocolResponse = 'HTTP 400 Bad Request (Conceptual Simulated Response Choice)';
      protocolResponseExplanation = 'Conceptual response choice for this simulated scenario representing a client-side protocol error due to stripped proxy headers; not a universal fail-closed standard across all gateway endpoints.';
      break;
    case 'sim-scen-isolation-06':
      intendedRationale = 'Synthetic container initiated unsolicited outbound connection to external IP. Kernel eBPF interlock enforces immediate socket drop and container quarantine. Isolation breaches never authorize traffic diversion.';
      protocolResponse = 'TCP RST / Kernel Packet Drop (DROP_DISPATCH)';
      protocolResponseExplanation = 'Network layer hardware/eBPF boundary drop; connection closed without application layer HTTP response dispatch.';
      break;
    case 'sim-scen-discrepancy-07':
      intendedRationale = 'Policy Engine selected High-Interaction Honeynet container diversion under policy pol-sec-04 for behavioral observation.';
      protocolResponse = 'HTTP Diversion (Intended Policy) vs. TCP RST (Recorded Edge Outcome)';
      protocolResponseExplanation = 'Discrepancy scenario: Intended policy proposed container handoff, while recorded outcome fixture logged hardware socket termination.';
      break;
    default:
      intendedRationale = 'Evaluated under default simulated gateway decision heuristics.';
      protocolResponse = 'HTTP 200 OK';
      protocolResponseExplanation = 'Default simulated response.';
  }

  // --- 4. Recorded Routing Outcome Stage (Independent from Intended Decision!) ---
  const recordedOutcome = scenario.expectedRecordedOutcome;
  const hasDiscrepancy = Boolean(scenario.discrepancyDetails);

  // --- 5. Chronological Decision Trace ---
  const traceTimestamp = new Date().toISOString();
  const decisionTrace = [
    {
      stepNumber: 1,
      stageName: 'Scenario Selected',
      result: `${scenario.shortName} (${scenario.id})`,
      explanation: `Fictional HTTP ${scenario.httpMethod} ${scenario.syntheticPath} ingested for tenant ${scenario.tenantName}.`,
      simulatedStatus: 'Input Ingested',
      evidenceReference: `Target: ${scenario.applicationName}`
    },
    {
      stepNumber: 2,
      stageName: 'Simulated Evidence Assessed',
      result: `${scenario.directlyObservedFacts.length} Facts, ${scenario.detectorDerivedInterpretations.length} Classifier Outputs`,
      explanation: scenario.missingEvidence.length > 0
        ? `Incomplete evidence: ${scenario.missingEvidence.length} missing telemetry signal(s) labeled Unknown / Not Recorded.`
        : 'Telemetry complete. Directly observed facts separated from detector-derived classifier scores.',
      simulatedStatus: 'Simulated Evidence',
      evidenceReference: scenario.telemetryCompleteness
    },
    {
      stepNumber: 3,
      stageName: 'Behavioral Assessment Produced',
      result: scenario.behavioralAssessment.classification,
      explanation: scenario.behavioralAssessment.rationale,
      simulatedStatus: 'Detector Interpretation (Simulated)',
      evidenceReference: scenario.behavioralAssessment.confidenceNote
    },
    {
      stepNumber: 4,
      stageName: 'Applicable Policies Evaluated',
      result: selectedPolicy ? `${selectedPolicy.name} (${selectedPolicy.id})` : 'No Applicable Policy Selected',
      explanation: selectedPolicy
        ? `Policy ${selectedPolicy.id} selected based on priority precedence (${selectedPolicy.priority}) and tenant scope.`
        : 'No policy trigger conditions matched scenario evidence.',
      simulatedStatus: 'Policy Decision (Simulated)',
      evidenceReference: `Candidate Policies: ${candidatePolicies.length}`
    },
    {
      stepNumber: 5,
      stageName: 'Strategy Eligibility Determined',
      result: evaluatedStrategyResult?.status || 'Not Evaluated',
      explanation: evaluatedStrategyResult?.reason || 'No candidate strategies evaluated.',
      simulatedStatus: 'Strategy Eligibility (Simulated)',
      evidenceReference: evaluatedStrategyResult?.strategy ? evaluatedStrategyResult.strategy.name : 'N/A'
    },
    {
      stepNumber: 6,
      stageName: 'Intended Route Selected',
      result: intendedDecision,
      explanation: intendedRationale,
      simulatedStatus: 'Intended Route',
      evidenceReference: targetEnvironment ? `Destination: ${targetEnvironment.name}` : 'N/A'
    },
    {
      stepNumber: 7,
      stageName: 'Outcome Recorded',
      result: recordedOutcome,
      explanation: hasDiscrepancy
        ? `DISCREPANCY DETECTED (Simulated): Policy engine designated diversion to synthetic honeynet (${scenario.targetEnvironmentId || 'env-aero-apt-04'}), but independent recorded outcome fixture indicates connection was blocked. Claimed Cause: Scenario-provided simulated evidence (not an independently observed live fact) indicates edge relay enforced hardware TCP Reset under sovereign containment rules before container handoff. The simulator did not execute a real TCP reset or contact a real gateway.`
        : `Simulated edge outcome confirmed as "${recordedOutcome}". Intended decision and recorded outcome match.`,
      simulatedStatus: 'Recorded Outcome (Scenario Fixture)',
      evidenceReference: scenario.linkedInvestigationId ? `Investigation ${scenario.linkedInvestigationId}` : 'N/A'
    },
    {
      stepNumber: 8,
      stageName: 'Simulation Completed',
      result: 'Deterministic Run Finalized',
      explanation: 'End-to-end gateway decision trace completed without live network mutation or honeynet deployment. No live socket manipulation performed.',
      simulatedStatus: 'Execution Evidence: Not Available',
      evidenceReference: `Local Simulation Run: ${scenario.id}`
    }
  ];

  // Construct structured result
  const localRunId = `sim-run-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

  const simulationResult = {
    runId: localRunId,
    scenarioId: scenario.id,
    scenario,
    tenant: matchedTenant,
    application: matchedApplication,
    targetEnvironment,
    observedEvidence: {
      directlyObservedFacts: scenario.directlyObservedFacts,
      detectorDerivedInterpretations: scenario.detectorDerivedInterpretations,
      missingEvidence: scenario.missingEvidence,
      stageLabel: 'Simulated Evidence'
    },
    behavioralAssessment: {
      ...scenario.behavioralAssessment,
      stageLabel: 'Behavioral Assessment (Simulated)'
    },
    policyEvaluation: {
      candidatePolicies,
      evaluatedPolicies,
      selectedPolicy,
      decision: selectedPolicy
        ? `Policy ${selectedPolicy.id} authorizes ${selectedPolicy.category}`
        : 'Default Gateway Route',
      stageLabel: 'Policy Decision (Simulated)'
    },
    strategyEligibility: evaluatedStrategyResult ? {
      ...evaluatedStrategyResult,
      stageLabel: 'Strategy Eligibility (Simulated)'
    } : null,
    intendedRoutingDecision: {
      decision: intendedDecision,
      rationale: intendedRationale,
      targetEnvironment,
      protocolResponse,
      protocolResponseExplanation,
      executionStatus: 'Simulated Decision — No Network Execution Performed',
      stageLabel: 'Intended Route'
    },
    routingOutcome: {
      status: recordedOutcome,
      isSimulated: true,
      stageLabel: 'Recorded Outcome (Scenario Fixture)',
      executionStatus: 'Simulated Fixture — No Live Transmission',
      executionEvidence: 'Not Available',
      details: hasDiscrepancy
        ? scenario.discrepancyDetails
        : `Simulated execution outcome matches intended decision "${intendedDecision}".`
    },
    executionEvidence: {
      status: 'Not Available',
      stageLabel: 'Execution Evidence: Not Available',
      details: 'No live packet inspection, socket execution, reverse proxy routing, or honeynet container manipulation was performed. All outcomes are simulated fixtures.'
    },
    discrepancy: {
      hasDiscrepancy,
      intendedRoute: intendedDecision,
      recordedOutcome: recordedOutcome,
      details: scenario.discrepancyDetails,
      causeType: hasDiscrepancy ? 'Scenario-provided simulated evidence' : 'N/A'
    },
    decisionTrace,
    warnings: [
      ...(hasDiscrepancy ? [scenario.discrepancyDetails] : []),
      ...(scenario.missingEvidence.length > 0
        ? ['Missing critical telemetry must never be treated as safe or normal traffic.']
        : [])
    ],
    timestamp: traceTimestamp,
    isSimulated: true
  };

  return simulationResult;
}

/**
 * Semantic evaluator explicitly modeling both permitted and prohibited isolation cases.
 * Used for semantic audit verification and testing.
 * 
 * @param {object} [options]
 * @returns {Promise<{ permittedCase: object, prohibitedCase: object }>}
 */
export async function evaluateIsolationSemantics(options = {}) {
  const [tenants, applications, policies, strategies, environments] = await Promise.all([
    getTenants(),
    getApplications(),
    getDeceptionPolicies(),
    getDeceptionStrategies(),
    getDeceptionEnvironments()
  ]);

  const omniTenant = tenants.find(t => t.id === 'tenant-omni-4401');
  const omniApp = applications.find(a => a.id === 'app-21');
  const omniPolicy = policies.find(p => p.id === 'pol-sec-06');
  const globalEgressPolicy = policies.find(p => p.id === 'pol-sec-03');
  const containStrategy = strategies.find(s => s.id === 'strat-contain-06');
  const egressStrategy = strategies.find(s => s.id === 'strat-egress-03');
  const omniEnv = environments.find(e => e.id === 'env-omni-fleet-03');

  // Case 1: Prohibited isolation-conflicting action (Scenario 6)
  // An outbound socket connect() attempt breaches zero-egress boundary (pol-sec-03).
  // Strategy is ineligible (fail-closed) and traffic diversion is PROHIBITED.
  const prohibitedCase = {
    caseType: 'Prohibited Isolation-Conflicting Action',
    scenarioId: 'sim-scen-isolation-06',
    tenant: omniTenant,
    application: omniApp,
    governingPolicy: globalEgressPolicy,
    candidateStrategy: containStrategy || egressStrategy,
    targetEnvironment: omniEnv,
    isIsolationBreached: true,
    strategyEligibilityStatus: 'Ineligible (Fail-Closed)',
    intendedDecision: 'Block at gateway',
    recordedOutcome: 'Recorded: Blocked',
    hasDiscrepancy: false,
    auditFinding: 'Outbound raw socket connection attempt violates platform zero-egress policy pol-sec-03 and isolation constraints of pol-sec-06. The conflicting strategy is marked Ineligible (Fail-Closed). An isolation breach is never treated as permission to divert traffic.',
    scopeVerification: {
      tenantScope: 'tenant-omni-4401',
      environmentScope: 'env-omni-fleet-03',
      isolationEnforced: true,
      allowedDestination: false
    }
  };

  // Case 2: Permitted isolated-deception destination
  // Inbound WebSocket protocol anomalies arriving at app-21 under pol-sec-06.
  // Diverting to env-omni-fleet-03 IS permitted because env-omni-fleet-03 is explicitly
  // isolated to tenant-omni-4401 container pool with zero internal traversal.
  const permittedCase = {
    caseType: 'Permitted Isolated-Deception Destination',
    scenarioId: 'sim-scen-permitted-isolation',
    tenant: omniTenant,
    application: omniApp,
    governingPolicy: omniPolicy,
    candidateStrategy: containStrategy,
    targetEnvironment: omniEnv,
    isIsolationBreached: false,
    strategyEligibilityStatus: 'Eligible (Simulated)',
    intendedDecision: 'Route to an approved synthetic deception environment',
    recordedOutcome: 'Recorded: Synthetic Deception Diversion',
    hasDiscrepancy: false,
    auditFinding: 'Inbound WebSocket framing anomaly satisfies pol-sec-06 trigger conditions. Destination env-omni-fleet-03 is explicitly permitted by policy safety constraints because it is a dedicated container sink isolated strictly to tenant-omni-4401 with zero traversal into production dispatch microservices.',
    scopeVerification: {
      tenantScope: 'tenant-omni-4401',
      environmentScope: 'env-omni-fleet-03',
      isolationEnforced: true,
      allowedDestination: true
    }
  };

  return {
    prohibitedCase,
    permittedCase
  };
}

// --- Local Simulation History Management ---

export function getStoredSimulationHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_GATEWAY_SIM_HISTORY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Could not read stored simulation history', e);
  }
  return [];
}

export function saveSimulationRun(runResult) {
  try {
    const history = getStoredSimulationHistory();
    // Prepend new run to history
    history.unshift(runResult);
    // Keep last 25 simulation runs
    const trimmed = history.slice(0, 25);
    localStorage.setItem(STORAGE_KEY_GATEWAY_SIM_HISTORY, JSON.stringify(trimmed));
    return trimmed;
  } catch (e) {
    console.warn('Could not persist simulation run', e);
    return [];
  }
}

export function getSimulationRunById(runId) {
  const history = getStoredSimulationHistory();
  return history.find(r => r.runId === runId) || null;
}

export function clearSimulationHistory() {
  try {
    localStorage.removeItem(STORAGE_KEY_GATEWAY_SIM_HISTORY);
  } catch (e) {
    console.warn('Could not clear simulation history', e);
  }
  return [];
}
