/**
 * Stage 6 Research Scenario Suite & Strict Partitioning Specification.
 *
 * Implements 26 reproducible, non-overlapping scenarios partitioned across:
 *   - DEVELOPMENT (6 scenarios): Used ONLY to calibrate baseline preprocessor,
 *     IsolationForest, and StatisticalBaselineDetector.
 *   - VALIDATION  (6 scenarios): Used to verify rule/ML/policy integration parity.
 *   - TEST       (14 scenarios): Strictly held out for final comparative evaluation.
 *
 * All 10 required research categories are covered in the held-out TEST partition
 * with distinct usernames, route templates, client IPs, and session trajectories
 * to eliminate scenario-template leakage between partitions.
 *
 * Ground-truth metadata is kept strictly separated from telemetry inputs passed
 * to detection, policy, strategy, or DSG modules.
 */

export const STAGE6_PARTITIONS = Object.freeze({
  DEVELOPMENT: 'DEVELOPMENT',
  VALIDATION: 'VALIDATION',
  TEST: 'TEST'
});

export const INITIAL_SYNTHETIC_STATE = Object.freeze({
  graphVersion: 1,
  users: [
    { id: 'usr-syn-101', username: 'alex.chen', name: 'Alex Chen', role: 'FINANCIAL_ANALYST', department: 'Treasury', synthetic: true },
    { id: 'usr-syn-102', username: 'maria.santos', name: 'Maria Santos', role: 'COMPLIANCE_OFFICER', department: 'Legal', synthetic: true },
    { id: 'usr-syn-103', username: 'david.kim', name: 'David Kim', role: 'INFRASTRUCTURE_ENGINEER', department: 'DevOps', synthetic: true }
  ],
  accounts: [
    { accountNumber: 'ACC-SYN-98214', routingNumber: '021000021', balance: 142500.0, currency: 'USD', status: 'ACTIVE', synthetic: true },
    { accountNumber: 'ACC-SYN-44129', routingNumber: '021000021', balance: 89320.5, currency: 'USD', status: 'ACTIVE', synthetic: true },
    { accountNumber: 'ACC-SYN-71003', routingNumber: '121000358', balance: 512000.0, currency: 'USD', status: 'RESTRICTED', synthetic: true }
  ],
  customers: [
    { customerId: 'CUST-SYN-001', company: 'Apex Global Logistics', tier: 'ENTERPRISE', region: 'NA-EAST', synthetic: true },
    { customerId: 'CUST-SYN-002', company: 'Solstice Health Sciences', tier: 'HEALTHCARE', region: 'EU-WEST', synthetic: true },
    { customerId: 'CUST-SYN-003', company: 'Helios Semiconductor', tier: 'ENTERPRISE', region: 'APAC', synthetic: true }
  ],
  schemas: [
    { table: 'synthetic_audit_log', columns: ['event_id', 'timestamp', 'actor', 'action', 'status'], synthetic: true },
    { table: 'synthetic_ledger', columns: ['entry_id', 'account_id', 'amount', 'currency', 'clearing_status'], synthetic: true },
    { table: 'synthetic_identity_vault', columns: ['token_id', 'subject', 'role', 'expires_at'], synthetic: true }
  ],
  baselineRoutes: [
    '/health',
    '/api/v1/health',
    '/api/v1/users',
    '/api/v1/users/usr-syn-101',
    '/api/v1/users/usr-syn-102',
    '/api/v1/users/usr-syn-103',
    '/api/v1/users/alex.chen',
    '/api/v1/users/maria.santos',
    '/api/v1/users/david.kim',
    '/api/v1/accounts',
    '/api/v1/resources',
    '/api/v1/auth/login',
    '/api/v1/auth/session',
    '/api/v1/auth/roles',
    '/api/v1/data/customers',
    '/api/v1/data/schemas',
    '/api/v1/data/records'
  ],
  activeServices: ['SYNTHETIC_API', 'SYNTHETIC_AUTH', 'SYNTHETIC_DATA']
});

function buildReq({
  stepIndex,
  offsetMs,
  method = 'GET',
  path,
  body = null,
  headers = {},
  originStatus = 200,
  stageNumber = 1,
  objective = 'BASELINE_ACCESS',
  targetEntity = null,
  expectedRuleSignal = null,
  telemetryQuality = { telemetryLossDetected: false, completenessStatus: 'COMPLETE', corruptFields: [] }
}) {
  return {
    stepIndex,
    offsetMs,
    method,
    path,
    body,
    headers,
    originStatus,
    stageNumber,
    objective,
    targetEntity,
    expectedRuleSignal,
    telemetryQuality
  };
}

function makeSequence(baseOffsetStart, stepIntervalMs, items) {
  let cursor = baseOffsetStart;
  return items.map((item, idx) => {
    const req = buildReq({
      stepIndex: idx + 1,
      offsetMs: cursor,
      ...item
    });
    cursor += item.deltaMs ?? stepIntervalMs;
    return req;
  });
}

export const STAGE6_SCENARIOS = Object.freeze([
  // ===========================================================================
  // PARTITION 1: DEVELOPMENT (6 Scenarios — Calibration Only)
  // ===========================================================================
  {
    scenarioId: 'DEV-BENIGN-01',
    partition: STAGE6_PARTITIONS.DEVELOPMENT,
    groundTruthCategory: 'BENIGN',
    taxonomy: 'BENIGN_USAGE',
    name: 'Dev Calibration: Standard Account Viewing',
    clientIp: '198.51.100.11',
    sessionId: 'sess-dev-benign-01',
    initialEnvironmentState: INITIAL_SYNTHETIC_STATE,
    requestSequence: makeSequence(0, 3500, [
      { path: '/api/v1/accounts', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ' },
      { path: '/api/v1/resources', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ' },
      { path: '/api/v1/data/records', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ' },
      { path: '/api/v1/accounts', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ' },
      { path: '/api/v1/auth/session', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ' },
      { path: '/api/v1/data/records', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ' }
    ]),
    expectedBehavioralObservations: { expectedLabel: 'NORMAL', deceptionExpected: false },
    expectedAdaptationOpportunities: [],
    expectedConsistencyConstraints: ['No state mutations triggered'],
    terminationCondition: 'End of 6-request calibration workflow'
  },
  {
    scenarioId: 'DEV-BENIGN-02',
    partition: STAGE6_PARTITIONS.DEVELOPMENT,
    groundTruthCategory: 'BENIGN',
    taxonomy: 'BENIGN_USAGE',
    name: 'Dev Calibration: Scheduled Health & Resource Check',
    clientIp: '198.51.100.12',
    sessionId: 'sess-dev-benign-02',
    initialEnvironmentState: INITIAL_SYNTHETIC_STATE,
    requestSequence: makeSequence(0, 4200, [
      { path: '/health', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ' },
      { path: '/api/v1/health', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ' },
      { path: '/api/v1/resources', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ' },
      { path: '/health', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ' },
      { path: '/api/v1/accounts', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ' },
      { path: '/health', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ' }
    ]),
    expectedBehavioralObservations: { expectedLabel: 'NORMAL', deceptionExpected: false },
    expectedAdaptationOpportunities: [],
    expectedConsistencyConstraints: ['No false deception proposals'],
    terminationCondition: 'End of 6-request health polling loop'
  },
  {
    scenarioId: 'DEV-BENIGN-03',
    partition: STAGE6_PARTITIONS.DEVELOPMENT,
    groundTruthCategory: 'BENIGN',
    taxonomy: 'BENIGN_USAGE',
    name: 'Dev Calibration: Mobile Client Account Read Sequence',
    clientIp: '198.51.100.13',
    sessionId: 'sess-dev-benign-03',
    initialEnvironmentState: INITIAL_SYNTHETIC_STATE,
    requestSequence: makeSequence(0, 2800, [
      { path: '/api/v1/users/usr-syn-101', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ', deltaMs: 2400 },
      { path: '/api/v1/accounts', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ', deltaMs: 3100 },
      { path: '/api/v1/data/records', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ', deltaMs: 2600 },
      { path: '/api/v1/data/customers', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ', deltaMs: 3500 },
      { path: '/api/v1/accounts', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ', deltaMs: 2900 },
      { path: '/api/v1/auth/session', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ' }
    ]),
    expectedBehavioralObservations: { expectedLabel: 'NORMAL', deceptionExpected: false },
    expectedAdaptationOpportunities: [],
    expectedConsistencyConstraints: ['Origin access preserved'],
    terminationCondition: 'End of 6-request mobile sequence'
  },
  {
    scenarioId: 'DEV-RECON-01',
    partition: STAGE6_PARTITIONS.DEVELOPMENT,
    groundTruthCategory: 'ATTACK',
    taxonomy: 'ENDPOINT_RECONNAISSANCE',
    name: 'Dev Calibration: Dev Dotfile & Config Scan',
    clientIp: '198.51.100.21',
    sessionId: 'sess-dev-recon-01',
    initialEnvironmentState: INITIAL_SYNTHETIC_STATE,
    requestSequence: makeSequence(0, 600, [
      { path: '/.git/HEAD', originStatus: 404, stageNumber: 1, objective: 'RECON_ENDPOINT' },
      { path: '/config.json', originStatus: 404, stageNumber: 1, objective: 'RECON_ENDPOINT' },
      { path: '/backup.sql', originStatus: 404, stageNumber: 1, objective: 'RECON_ENDPOINT' },
      { path: '/wp-admin', originStatus: 404, stageNumber: 1, objective: 'RECON_ENDPOINT' },
      { path: '/phpmyadmin', originStatus: 404, stageNumber: 1, objective: 'RECON_ENDPOINT' },
      { path: '/api/v1/dev/metrics', originStatus: 404, stageNumber: 2, objective: 'RECON_ENDPOINT', targetEntity: 'route:/api/v1/dev/metrics' }
    ]),
    expectedBehavioralObservations: { expectedLabel: 'SUSPICIOUS_OR_HIGH', deceptionExpected: true },
    expectedAdaptationOpportunities: ['Expand synthetic route topology cleanly'],
    expectedConsistencyConstraints: ['Routes start with /api/, no collision'],
    terminationCondition: '6 recon probes completed'
  },
  {
    scenarioId: 'DEV-AUTH-01',
    partition: STAGE6_PARTITIONS.DEVELOPMENT,
    groundTruthCategory: 'ATTACK',
    taxonomy: 'AUTHENTICATION_ABUSE',
    name: 'Dev Calibration: Basic Login Spray (svc_deploy)',
    clientIp: '198.51.100.22',
    sessionId: 'sess-dev-auth-01',
    initialEnvironmentState: INITIAL_SYNTHETIC_STATE,
    requestSequence: makeSequence(0, 450, [
      { method: 'POST', path: '/api/v1/auth/login', body: { username: 'svc_deploy' }, originStatus: 401, stageNumber: 1, objective: 'CREDENTIAL_PROBE', targetEntity: 'user:svc_deploy' },
      { method: 'POST', path: '/api/v1/auth/login', body: { username: 'svc_deploy' }, originStatus: 401, stageNumber: 1, objective: 'CREDENTIAL_PROBE', targetEntity: 'user:svc_deploy' },
      { method: 'POST', path: '/api/v1/auth/login', body: { username: 'svc_deploy' }, originStatus: 401, stageNumber: 1, objective: 'CREDENTIAL_PROBE', targetEntity: 'user:svc_deploy' },
      { method: 'POST', path: '/api/v1/auth/login', body: { username: 'svc_deploy' }, originStatus: 401, stageNumber: 1, objective: 'CREDENTIAL_PROBE', targetEntity: 'user:svc_deploy' },
      { method: 'POST', path: '/api/v1/auth/login', body: { username: 'svc_deploy' }, originStatus: 401, stageNumber: 1, objective: 'CREDENTIAL_PROBE', targetEntity: 'user:svc_deploy' },
      { path: '/api/v1/auth/roles', originStatus: 200, stageNumber: 2, objective: 'ROLE_VERIFY', targetEntity: 'user:svc_deploy' }
    ]),
    expectedBehavioralObservations: { expectedLabel: 'SUSPICIOUS_OR_HIGH', deceptionExpected: true },
    expectedAdaptationOpportunities: ['Add synthetic identity svc_deploy before credential issue'],
    expectedConsistencyConstraints: ['Credential user must exist'],
    terminationCondition: 'Auth spray completes'
  },
  {
    scenarioId: 'DEV-AMBIG-01',
    partition: STAGE6_PARTITIONS.DEVELOPMENT,
    groundTruthCategory: 'AMBIGUOUS',
    taxonomy: 'AMBIGUOUS_INCOMPLETE_TELEMETRY',
    name: 'Dev Calibration: Truncated Stream With Missing Status',
    clientIp: '198.51.100.23',
    sessionId: 'sess-dev-ambig-01',
    initialEnvironmentState: INITIAL_SYNTHETIC_STATE,
    requestSequence: makeSequence(0, 1200, [
      { path: '/api/v1/accounts', originStatus: 200, stageNumber: 0, objective: 'AMBIGUOUS_PROBE', telemetryQuality: { telemetryLossDetected: true, completenessStatus: 'PARTIAL', corruptFields: ['httpMethod'] } },
      { path: '/api/v1/users', originStatus: 200, stageNumber: 0, objective: 'AMBIGUOUS_PROBE', telemetryQuality: { telemetryLossDetected: true, completenessStatus: 'PARTIAL', corruptFields: ['responseStatus'] } },
      { path: '/api/v1/resources', originStatus: 200, stageNumber: 0, objective: 'AMBIGUOUS_PROBE', telemetryQuality: { telemetryLossDetected: true, completenessStatus: 'DEGRADED', corruptFields: ['clientIp'] } }
    ]),
    expectedBehavioralObservations: { expectedLabel: 'INSUFFICIENT_EVIDENCE', deceptionExpected: false },
    expectedAdaptationOpportunities: [],
    expectedConsistencyConstraints: ['Zero deception proposals under degraded telemetry'],
    terminationCondition: 'End of degraded stream'
  },

  // ===========================================================================
  // PARTITION 2: VALIDATION (6 Scenarios — Pipeline Parity Verification Only)
  // ===========================================================================
  {
    scenarioId: 'VAL-BENIGN-01',
    partition: STAGE6_PARTITIONS.VALIDATION,
    groundTruthCategory: 'BENIGN',
    taxonomy: 'BENIGN_USAGE',
    name: 'Val Parity: Routine API Resource Verification',
    clientIp: '198.51.100.51',
    sessionId: 'sess-val-benign-01',
    initialEnvironmentState: INITIAL_SYNTHETIC_STATE,
    requestSequence: makeSequence(0, 3200, [
      { path: '/api/v1/resources', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ' },
      { path: '/api/v1/accounts', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ' },
      { path: '/api/v1/users/usr-syn-102', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ' },
      { path: '/api/v1/data/records', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ' },
      { path: '/api/v1/auth/session', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ' },
      { path: '/health', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ' }
    ]),
    expectedBehavioralObservations: { expectedLabel: 'NORMAL', deceptionExpected: false },
    expectedAdaptationOpportunities: [],
    expectedConsistencyConstraints: ['Origin forwarding preserved'],
    terminationCondition: '6 benign calls completed'
  },
  {
    scenarioId: 'VAL-REPEAT-01',
    partition: STAGE6_PARTITIONS.VALIDATION,
    groundTruthCategory: 'ATTACK',
    taxonomy: 'REPEATED_RESOURCE_ACCESS',
    name: 'Val Parity: Repeated Legacy Asset Probing (/api/v0/legacy/swagger)',
    clientIp: '198.51.100.61',
    sessionId: 'sess-val-repeat-01',
    initialEnvironmentState: INITIAL_SYNTHETIC_STATE,
    requestSequence: makeSequence(0, 500, [
      { path: '/api/v0/legacy/swagger', originStatus: 404, stageNumber: 1, objective: 'RECON_ENDPOINT', targetEntity: 'route:/api/v0/legacy/swagger' },
      { path: '/api/v0/legacy/swagger', originStatus: 404, stageNumber: 1, objective: 'RECON_ENDPOINT', targetEntity: 'route:/api/v0/legacy/swagger' },
      { path: '/api/v0/legacy/swagger', originStatus: 404, stageNumber: 1, objective: 'RECON_ENDPOINT', targetEntity: 'route:/api/v0/legacy/swagger' },
      { path: '/api/v0/legacy/swagger', originStatus: 404, stageNumber: 1, objective: 'RECON_ENDPOINT', targetEntity: 'route:/api/v0/legacy/swagger' },
      { path: '/api/v0/legacy/swagger', originStatus: 404, stageNumber: 1, objective: 'RECON_ENDPOINT', targetEntity: 'route:/api/v0/legacy/swagger' },
      { path: '/api/v0/legacy/swagger', originStatus: 404, stageNumber: 2, objective: 'RECON_ENDPOINT', targetEntity: 'route:/api/v0/legacy/swagger' }
    ]),
    expectedBehavioralObservations: { expectedLabel: 'SUSPICIOUS', deceptionExpected: false }, // Note: solitary medium rule may NOT meet CRITICAL/HIGH deception threshold! Test honestly!
    expectedAdaptationOpportunities: ['Route decoy provisioning if threshold met'],
    expectedConsistencyConstraints: ['No conflicting route definitions'],
    terminationCondition: 'Repeated route probing ends'
  },
  {
    scenarioId: 'VAL-CRED-01',
    partition: STAGE6_PARTITIONS.VALIDATION,
    groundTruthCategory: 'ATTACK',
    taxonomy: 'CREDENTIAL_PROBING',
    name: 'Val Parity: Credential Stuffing Targeting maria.santos',
    clientIp: '198.51.100.62',
    sessionId: 'sess-val-cred-01',
    initialEnvironmentState: INITIAL_SYNTHETIC_STATE,
    requestSequence: makeSequence(0, 400, [
      { method: 'POST', path: '/api/v1/auth/login', body: { username: 'maria.santos' }, originStatus: 401, stageNumber: 1, objective: 'CREDENTIAL_PROBE', targetEntity: 'user:maria.santos' },
      { method: 'POST', path: '/api/v1/auth/login', body: { username: 'maria.santos' }, originStatus: 401, stageNumber: 1, objective: 'CREDENTIAL_PROBE', targetEntity: 'user:maria.santos' },
      { method: 'POST', path: '/api/v1/auth/login', body: { username: 'maria.santos' }, originStatus: 401, stageNumber: 1, objective: 'CREDENTIAL_PROBE', targetEntity: 'user:maria.santos' },
      { method: 'POST', path: '/api/v1/auth/login', body: { username: 'maria.santos' }, originStatus: 401, stageNumber: 1, objective: 'CREDENTIAL_PROBE', targetEntity: 'user:maria.santos' },
      { method: 'POST', path: '/api/v1/auth/login', body: { username: 'maria.santos' }, originStatus: 200, stageNumber: 2, objective: 'CREDENTIAL_USE', targetEntity: 'user:maria.santos' },
      { path: '/api/v1/auth/roles', originStatus: 200, stageNumber: 2, objective: 'ROLE_VERIFY', targetEntity: 'user:maria.santos' }
    ]),
    expectedBehavioralObservations: { expectedLabel: 'HIGHLY_SUSPICIOUS', deceptionExpected: true },
    expectedAdaptationOpportunities: ['Issue canary JWT aligned with maria.santos role (COMPLIANCE_OFFICER)'],
    expectedConsistencyConstraints: ['Credential role MUST match existing user COMPLIANCE_OFFICER'],
    terminationCondition: '6 auth steps completed'
  },
  {
    scenarioId: 'VAL-DATA-01',
    partition: STAGE6_PARTITIONS.VALIDATION,
    groundTruthCategory: 'ATTACK',
    taxonomy: 'SENSITIVE_DATA_DISCOVERY',
    name: 'Val Parity: Secret & Schema Discovery',
    clientIp: '198.51.100.63',
    sessionId: 'sess-val-data-01',
    initialEnvironmentState: INITIAL_SYNTHETIC_STATE,
    requestSequence: makeSequence(0, 500, [
      { path: '/.aws/credentials', originStatus: 404, stageNumber: 1, objective: 'RECON_ENDPOINT' },
      { path: '/api/v1/data/schemas', originStatus: 200, stageNumber: 1, objective: 'DATA_DISCOVERY', targetEntity: 'schema:synthetic_customers' },
      { path: '/api/v1/data/customers', originStatus: 200, stageNumber: 2, objective: 'DATA_DISCOVERY', targetEntity: 'customer:CUST-SYN-001' },
      { path: '/api/v1/data/exports/bulk.csv', originStatus: 404, stageNumber: 2, objective: 'DATA_DISCOVERY', targetEntity: 'route:/api/v1/data/exports/bulk.csv' },
      { path: '/api/v1/data/records', originStatus: 200, stageNumber: 3, objective: 'DATA_DISCOVERY', targetEntity: 'schema:synthetic_audit_log' },
      { path: '/api/v1/data/customers', originStatus: 200, stageNumber: 3, objective: 'DATA_DISCOVERY', targetEntity: 'customer:CUST-DEC-VAL' }
    ]),
    expectedBehavioralObservations: { expectedLabel: 'SUSPICIOUS_OR_HIGH', deceptionExpected: true },
    expectedAdaptationOpportunities: ['Canary table & synthetic customer injection'],
    expectedConsistencyConstraints: ['Canary column present on sensitive decoy schema'],
    terminationCondition: '6 data probes completed'
  },
  {
    scenarioId: 'VAL-MULTI-01',
    partition: STAGE6_PARTITIONS.VALIDATION,
    groundTruthCategory: 'ATTACK',
    taxonomy: 'MULTI_STAGE_PROGRESSION',
    name: 'Val Parity: User Discovery -> Auth Probe -> Admin Endpoint',
    clientIp: '198.51.100.64',
    sessionId: 'sess-val-multi-01',
    initialEnvironmentState: INITIAL_SYNTHETIC_STATE,
    requestSequence: makeSequence(0, 500, [
      { method: 'POST', path: '/api/v1/auth/login', body: { username: 'val_auditor' }, originStatus: 401, stageNumber: 1, objective: 'CREDENTIAL_PROBE', targetEntity: 'user:val_auditor' },
      { method: 'POST', path: '/api/v1/auth/login', body: { username: 'val_auditor' }, originStatus: 401, stageNumber: 1, objective: 'CREDENTIAL_PROBE', targetEntity: 'user:val_auditor' },
      { method: 'POST', path: '/api/v1/auth/login', body: { username: 'val_auditor' }, originStatus: 401, stageNumber: 1, objective: 'CREDENTIAL_PROBE', targetEntity: 'user:val_auditor' },
      { method: 'POST', path: '/api/v1/auth/login', body: { username: 'val_auditor' }, originStatus: 401, stageNumber: 1, objective: 'CREDENTIAL_PROBE', targetEntity: 'user:val_auditor' },
      { path: '/api/v1/users/val_auditor', originStatus: 404, stageNumber: 2, objective: 'USER_LOOKUP', targetEntity: 'user:val_auditor' },
      { path: '/api/v1/internal/val-audit', originStatus: 404, stageNumber: 3, objective: 'AUDIT_ACCESS', targetEntity: 'route:/api/v1/internal/val-audit' }
    ]),
    expectedBehavioralObservations: { expectedLabel: 'HIGHLY_SUSPICIOUS', deceptionExpected: true },
    expectedAdaptationOpportunities: ['Create val_auditor user before credential & /users/val_auditor route'],
    expectedConsistencyConstraints: ['Route /api/v1/users/val_auditor requires user val_auditor'],
    terminationCondition: '3 stages attempted'
  },
  {
    scenarioId: 'VAL-AMBIG-01',
    partition: STAGE6_PARTITIONS.VALIDATION,
    groundTruthCategory: 'AMBIGUOUS',
    taxonomy: 'AMBIGUOUS_INCOMPLETE_TELEMETRY',
    name: 'Val Parity: Dropped Telemetry Middle Window',
    clientIp: '198.51.100.65',
    sessionId: 'sess-val-ambig-01',
    initialEnvironmentState: INITIAL_SYNTHETIC_STATE,
    requestSequence: makeSequence(0, 1000, [
      { path: '/api/v1/accounts', originStatus: 200, stageNumber: 0, objective: 'AMBIGUOUS_PROBE' },
      { path: '/api/v1/resources', originStatus: 200, stageNumber: 0, objective: 'AMBIGUOUS_PROBE', telemetryQuality: { telemetryLossDetected: true, completenessStatus: 'PARTIAL', corruptFields: ['responseStatus'] } },
      { path: '/api/v1/unknown-val', originStatus: 404, stageNumber: 0, objective: 'AMBIGUOUS_PROBE', telemetryQuality: { telemetryLossDetected: true, completenessStatus: 'DEGRADED', corruptFields: ['requestSizeBytes'] } },
      { path: '/api/v1/accounts', originStatus: 200, stageNumber: 0, objective: 'AMBIGUOUS_PROBE', telemetryQuality: { telemetryLossDetected: true, completenessStatus: 'PARTIAL', corruptFields: ['durationMs'] } }
    ]),
    expectedBehavioralObservations: { expectedLabel: 'INSUFFICIENT_EVIDENCE', deceptionExpected: false },
    expectedAdaptationOpportunities: [],
    expectedConsistencyConstraints: ['Degraded window produces INSUFFICIENT_EVIDENCE'],
    terminationCondition: '4-step degraded stream complete'
  },

  // ===========================================================================
  // PARTITION 3: HELD-OUT TEST (14 Scenarios — Strict Held-Out Evaluation)
  // Distinct routes, identities, client IPs, and trajectories from DEV & VAL!
  // ===========================================================================
  {
    scenarioId: 'TEST-BENIGN-01',
    partition: STAGE6_PARTITIONS.TEST,
    groundTruthCategory: 'BENIGN',
    taxonomy: 'BENIGN_USAGE',
    name: 'Benign Retail Customer Session',
    clientIp: '203.0.113.10',
    sessionId: 'sess-test-benign-01',
    initialEnvironmentState: INITIAL_SYNTHETIC_STATE,
    requestSequence: makeSequence(0, 3400, [
      { path: '/api/v1/accounts', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ', deltaMs: 2800 },
      { path: '/api/v1/users/usr-syn-101', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ', deltaMs: 4100 },
      { path: '/api/v1/data/records', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ', deltaMs: 3200 },
      { path: '/api/v1/auth/session', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ', deltaMs: 3800 },
      { path: '/api/v1/accounts', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ', deltaMs: 2500 },
      { path: '/api/v1/resources', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ', deltaMs: 3300 },
      { path: '/api/v1/data/records', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ', deltaMs: 3600 },
      { path: '/health', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ' }
    ]),
    expectedBehavioralObservations: { expectedLabel: 'NORMAL', deceptionExpected: false },
    expectedAdaptationOpportunities: [],
    expectedConsistencyConstraints: ['Zero false alarms', 'Origin preserved'],
    terminationCondition: '8 benign interactions completed'
  },
  {
    scenarioId: 'TEST-BENIGN-02',
    partition: STAGE6_PARTITIONS.TEST,
    groundTruthCategory: 'BENIGN',
    taxonomy: 'BENIGN_USAGE',
    name: 'Benign Compliance Audit Review',
    clientIp: '203.0.113.11',
    sessionId: 'sess-test-benign-02',
    initialEnvironmentState: INITIAL_SYNTHETIC_STATE,
    requestSequence: makeSequence(0, 4500, [
      { path: '/api/v1/users/usr-syn-102', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ', deltaMs: 4200 },
      { path: '/api/v1/data/customers', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ', deltaMs: 5100 },
      { path: '/api/v1/data/schemas', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ', deltaMs: 3900 },
      { path: '/api/v1/auth/roles', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ', deltaMs: 4400 },
      { path: '/api/v1/data/records', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ', deltaMs: 4800 },
      { path: '/api/v1/accounts', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ' }
    ]),
    expectedBehavioralObservations: { expectedLabel: 'NORMAL', deceptionExpected: false },
    expectedAdaptationOpportunities: [],
    expectedConsistencyConstraints: ['Zero false positives on compliance read pattern'],
    terminationCondition: '6 compliance audit reads completed'
  },
  {
    scenarioId: 'TEST-BENIGN-03',
    partition: STAGE6_PARTITIONS.TEST,
    groundTruthCategory: 'BENIGN',
    taxonomy: 'BENIGN_USAGE',
    name: 'Benign High-Diversity Automated UI Prefetch (Hard Negative)',
    clientIp: '203.0.113.12',
    sessionId: 'sess-test-benign-03',
    initialEnvironmentState: INITIAL_SYNTHETIC_STATE,
    requestSequence: makeSequence(0, 450, [
      { path: '/api/v1/resources', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ' },
      { path: '/api/v1/users/usr-syn-101', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ' },
      { path: '/api/v1/users/usr-syn-102', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ' },
      { path: '/api/v1/users/usr-syn-103', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ' },
      { path: '/api/v1/accounts', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ' },
      { path: '/api/v1/data/customers', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ' },
      { path: '/api/v1/data/schemas', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ' },
      { path: '/api/v1/data/records', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ' },
      { path: '/api/v1/auth/session', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ' },
      { path: '/api/v1/auth/roles', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ' }
    ]),
    expectedBehavioralObservations: { expectedLabel: 'NORMAL', deceptionExpected: false },
    expectedAdaptationOpportunities: [],
    expectedConsistencyConstraints: ['Rapid 200 OK prefetch with zero 4xx must NOT trigger deception'],
    terminationCondition: '10 benign fast calls completed'
  },
  {
    scenarioId: 'TEST-RECON-01',
    partition: STAGE6_PARTITIONS.TEST,
    groundTruthCategory: 'ATTACK',
    taxonomy: 'ENDPOINT_RECONNAISSANCE',
    name: 'Secret & Hidden Environment Endpoint Reconnaissance',
    clientIp: '203.0.113.21',
    sessionId: 'sess-test-recon-01',
    initialEnvironmentState: INITIAL_SYNTHETIC_STATE,
    requestSequence: makeSequence(0, 400, [
      { path: '/.env.production', originStatus: 404, stageNumber: 1, objective: 'RECON_ENDPOINT' },
      { path: '/.ssh/id_rsa', originStatus: 404, stageNumber: 1, objective: 'RECON_ENDPOINT' },
      { path: '/actuator/env', originStatus: 404, stageNumber: 1, objective: 'RECON_ENDPOINT' },
      { path: '/web.config', originStatus: 404, stageNumber: 1, objective: 'RECON_ENDPOINT' },
      { path: '/api/v1/internal/treasury/vault-status', originStatus: 404, stageNumber: 2, objective: 'RECON_ENDPOINT', targetEntity: 'route:/api/v1/internal/treasury/vault-status' },
      { path: '/api/v1/internal/treasury/vault-status', originStatus: 404, stageNumber: 2, objective: 'RECON_ENDPOINT', targetEntity: 'route:/api/v1/internal/treasury/vault-status' },
      { path: '/api/v1/internal/admin/audit-logs', originStatus: 404, stageNumber: 3, objective: 'AUDIT_ACCESS', targetEntity: 'route:/api/v1/internal/admin/audit-logs' },
      { path: '/api/v1/internal/admin/audit-logs', originStatus: 404, stageNumber: 3, objective: 'AUDIT_ACCESS', targetEntity: 'route:/api/v1/internal/admin/audit-logs' },
      { path: '/api/v1/internal/secrets/keys', originStatus: 404, stageNumber: 4, objective: 'RECON_ENDPOINT', targetEntity: 'route:/api/v1/internal/secrets/keys' },
      { path: '/api/v1/internal/secrets/keys', originStatus: 404, stageNumber: 4, objective: 'RECON_ENDPOINT', targetEntity: 'route:/api/v1/internal/secrets/keys' }
    ]),
    expectedBehavioralObservations: { expectedLabel: 'HIGHLY_SUSPICIOUS', deceptionExpected: true },
    expectedAdaptationOpportunities: ['Dynamically provision plausible synthetic /api/v1/internal/* endpoints'],
    expectedConsistencyConstraints: ['Routes start with /api/', 'No colliding contradictory route statuses'],
    terminationCondition: 'All 4 recon stages probed'
  },
  {
    scenarioId: 'TEST-ENUM-01',
    partition: STAGE6_PARTITIONS.TEST,
    groundTruthCategory: 'ATTACK',
    taxonomy: 'API_ENUMERATION',
    name: 'Systematic Identity & API Directory Enumeration',
    clientIp: '203.0.113.22',
    sessionId: 'sess-test-enum-01',
    initialEnvironmentState: INITIAL_SYNTHETIC_STATE,
    requestSequence: makeSequence(0, 450, [
      { path: '/api/v1/resources', originStatus: 200, stageNumber: 1, objective: 'USER_ENUM' },
      { path: '/api/v1/users/nonexistent_alpha', originStatus: 404, stageNumber: 1, objective: 'USER_ENUM', targetEntity: 'user:nonexistent_alpha' },
      { path: '/api/v1/users/nonexistent_beta', originStatus: 404, stageNumber: 1, objective: 'USER_ENUM', targetEntity: 'user:nonexistent_beta' },
      { path: '/api/v1/users/sec_auditor_01', originStatus: 404, stageNumber: 1, objective: 'USER_ENUM', targetEntity: 'user:sec_auditor_01' },
      { path: '/api/v1/users/ops_director_02', originStatus: 404, stageNumber: 1, objective: 'USER_ENUM', targetEntity: 'user:ops_director_02' },
      { path: '/api/v1/users/ops_director_02', originStatus: 404, stageNumber: 2, objective: 'USER_ENUM', targetEntity: 'user:ops_director_02' },
      { path: '/api/v1/users/sec_auditor_01', originStatus: 404, stageNumber: 2, objective: 'USER_ENUM', targetEntity: 'user:sec_auditor_01' },
      { path: '/api/v1/internal/directory/org-chart', originStatus: 404, stageNumber: 3, objective: 'RECON_ENDPOINT', targetEntity: 'route:/api/v1/internal/directory/org-chart' },
      { path: '/api/v1/internal/directory/org-chart', originStatus: 404, stageNumber: 3, objective: 'RECON_ENDPOINT', targetEntity: 'route:/api/v1/internal/directory/org-chart' },
      { path: '/api/v1/auth/roles', originStatus: 200, stageNumber: 3, objective: 'ROLE_VERIFY' }
    ]),
    expectedBehavioralObservations: { expectedLabel: 'HIGHLY_SUSPICIOUS', deceptionExpected: true },
    expectedAdaptationOpportunities: ['Create matching user entity BEFORE exposing /api/v1/users/:id dynamic route'],
    expectedConsistencyConstraints: ['DSG Check 3b: /api/v1/users/:id must match existing user in store'],
    terminationCondition: '3 enumeration stages attempted'
  },
  {
    scenarioId: 'TEST-CRED-01',
    partition: STAGE6_PARTITIONS.TEST,
    groundTruthCategory: 'ATTACK',
    taxonomy: 'CREDENTIAL_PROBING',
    name: 'Targeted Credential Probing on Valid User alex.chen',
    clientIp: '203.0.113.23',
    sessionId: 'sess-test-cred-01',
    initialEnvironmentState: INITIAL_SYNTHETIC_STATE,
    requestSequence: makeSequence(0, 400, [
      { path: '/api/v1/users/alex.chen', originStatus: 200, stageNumber: 1, objective: 'USER_LOOKUP', targetEntity: 'user:alex.chen' },
      { method: 'POST', path: '/api/v1/auth/login', body: { username: 'alex.chen', roleHint: 'ADMINISTRATOR' }, originStatus: 401, stageNumber: 1, objective: 'CREDENTIAL_PROBE', targetEntity: 'user:alex.chen' },
      { method: 'POST', path: '/api/v1/auth/login', body: { username: 'alex.chen', roleHint: 'ADMINISTRATOR' }, originStatus: 401, stageNumber: 1, objective: 'CREDENTIAL_PROBE', targetEntity: 'user:alex.chen' },
      { method: 'POST', path: '/api/v1/auth/login', body: { username: 'alex.chen', roleHint: 'ADMINISTRATOR' }, originStatus: 401, stageNumber: 1, objective: 'CREDENTIAL_PROBE', targetEntity: 'user:alex.chen' },
      { method: 'POST', path: '/api/v1/auth/login', body: { username: 'alex.chen' }, originStatus: 401, stageNumber: 2, objective: 'CREDENTIAL_USE', targetEntity: 'user:alex.chen' },
      { path: '/api/v1/auth/roles', originStatus: 200, stageNumber: 2, objective: 'ROLE_VERIFY', targetEntity: 'user:alex.chen' },
      { method: 'POST', path: '/api/v1/auth/login', body: { username: 'alex.chen' }, originStatus: 200, stageNumber: 3, objective: 'CREDENTIAL_USE', targetEntity: 'user:alex.chen' },
      { path: '/api/v1/auth/session', originStatus: 200, stageNumber: 3, objective: 'ROLE_VERIFY', targetEntity: 'user:alex.chen' }
    ]),
    expectedBehavioralObservations: { expectedLabel: 'HIGHLY_SUSPICIOUS', deceptionExpected: true },
    expectedAdaptationOpportunities: ['Deploy decoy credential aligned strictly to alex.chen role (FINANCIAL_ANALYST)'],
    expectedConsistencyConstraints: ['DSG Check 2b: credential.role must equal user.role'],
    terminationCondition: 'Credential probe + role verification complete'
  },
  {
    scenarioId: 'TEST-AUTH-01',
    partition: STAGE6_PARTITIONS.TEST,
    groundTruthCategory: 'ATTACK',
    taxonomy: 'AUTHENTICATION_ABUSE',
    name: 'Authentication Brute-Force & Unseen Identity Spray (treasury_ops)',
    clientIp: '203.0.113.24',
    sessionId: 'sess-test-auth-01',
    initialEnvironmentState: INITIAL_SYNTHETIC_STATE,
    requestSequence: makeSequence(0, 350, [
      { method: 'POST', path: '/api/v1/auth/login', body: { username: 'treasury_ops' }, originStatus: 401, stageNumber: 1, objective: 'CREDENTIAL_PROBE', targetEntity: 'user:treasury_ops' },
      { method: 'POST', path: '/api/v1/auth/login', body: { username: 'treasury_ops' }, originStatus: 401, stageNumber: 1, objective: 'CREDENTIAL_PROBE', targetEntity: 'user:treasury_ops' },
      { method: 'POST', path: '/api/v1/auth/login', body: { username: 'treasury_ops' }, originStatus: 401, stageNumber: 1, objective: 'CREDENTIAL_PROBE', targetEntity: 'user:treasury_ops' },
      { method: 'POST', path: '/api/v1/auth/login', body: { username: 'treasury_ops' }, originStatus: 401, stageNumber: 1, objective: 'CREDENTIAL_PROBE', targetEntity: 'user:treasury_ops' },
      { method: 'POST', path: '/api/v1/auth/login', body: { username: 'treasury_ops' }, originStatus: 401, stageNumber: 2, objective: 'CREDENTIAL_USE', targetEntity: 'user:treasury_ops' },
      { path: '/api/v1/users/treasury_ops', originStatus: 404, stageNumber: 2, objective: 'USER_LOOKUP', targetEntity: 'user:treasury_ops' },
      { path: '/api/v1/auth/roles', originStatus: 200, stageNumber: 3, objective: 'ROLE_VERIFY', targetEntity: 'user:treasury_ops' },
      { method: 'POST', path: '/api/v1/auth/login', body: { username: 'david.kim' }, originStatus: 401, stageNumber: 3, objective: 'CREDENTIAL_USE', targetEntity: 'user:david.kim' },
      { path: '/api/v1/users/david.kim', originStatus: 200, stageNumber: 3, objective: 'USER_LOOKUP', targetEntity: 'user:david.kim' },
      { path: '/api/v1/auth/session', originStatus: 200, stageNumber: 3, objective: 'ROLE_VERIFY', targetEntity: 'user:david.kim' }
    ]),
    expectedBehavioralObservations: { expectedLabel: 'HIGHLY_SUSPICIOUS', deceptionExpected: true },
    expectedAdaptationOpportunities: ['Provision user treasury_ops BEFORE credential & route binding'],
    expectedConsistencyConstraints: ['DSG Check 2a: credential created only for existing synthetic user'],
    terminationCondition: '10-step auth abuse completed'
  },
  {
    scenarioId: 'TEST-DATA-01',
    partition: STAGE6_PARTITIONS.TEST,
    groundTruthCategory: 'ATTACK',
    taxonomy: 'SENSITIVE_DATA_DISCOVERY',
    name: 'Database Schema & Canary Record Exfiltration Probe',
    clientIp: '203.0.113.25',
    sessionId: 'sess-test-data-01',
    initialEnvironmentState: INITIAL_SYNTHETIC_STATE,
    requestSequence: makeSequence(0, 450, [
      { path: '/.env.db-backup', originStatus: 404, stageNumber: 1, objective: 'RECON_ENDPOINT' },
      { path: '/secrets/db-creds.yml', originStatus: 404, stageNumber: 1, objective: 'RECON_ENDPOINT' },
      { path: '/api/v1/data/schemas', originStatus: 200, stageNumber: 1, objective: 'DATA_DISCOVERY', targetEntity: 'schema:synthetic_customers' },
      { path: '/api/v1/data/dump-all', originStatus: 404, stageNumber: 2, objective: 'DATA_DISCOVERY', targetEntity: 'route:/api/v1/data/dump-all' },
      { path: '/api/v1/data/customers', originStatus: 200, stageNumber: 2, objective: 'DATA_DISCOVERY', targetEntity: 'customer:CUST-DEC-EXF1' },
      { path: '/api/v1/data/schemas', originStatus: 200, stageNumber: 3, objective: 'DATA_DISCOVERY', targetEntity: 'schema:synthetic_customers' },
      { path: '/api/v1/data/dump-all', originStatus: 404, stageNumber: 3, objective: 'DATA_DISCOVERY', targetEntity: 'route:/api/v1/data/dump-all' },
      { path: '/api/v1/data/customers', originStatus: 200, stageNumber: 3, objective: 'DATA_DISCOVERY', targetEntity: 'customer:CUST-DEC-EXF2' },
      { path: '/api/v1/accounts', originStatus: 200, stageNumber: 3, objective: 'DATA_DISCOVERY' }
    ]),
    expectedBehavioralObservations: { expectedLabel: 'HIGHLY_SUSPICIOUS', deceptionExpected: true },
    expectedAdaptationOpportunities: ['Inject synthetic customer record & canary column schema safely'],
    expectedConsistencyConstraints: ['DSG Check 4: decoy table synthetic_customers must retain canary_seed/exfil_marker column'],
    terminationCondition: 'All 3 exfiltration stages completed'
  },
  {
    scenarioId: 'TEST-REPEAT-01',
    partition: STAGE6_PARTITIONS.TEST,
    groundTruthCategory: 'ATTACK',
    taxonomy: 'REPEATED_RESOURCE_ACCESS',
    name: 'Persistent Probing of High-Value Treasury Wire Endpoint',
    clientIp: '203.0.113.26',
    sessionId: 'sess-test-repeat-01',
    initialEnvironmentState: INITIAL_SYNTHETIC_STATE,
    requestSequence: makeSequence(0, 350, [
      { path: '/api/v1/internal/treasury/wire-export', originStatus: 404, stageNumber: 1, objective: 'RECON_ENDPOINT', targetEntity: 'route:/api/v1/internal/treasury/wire-export' },
      { path: '/api/v1/internal/treasury/wire-export', originStatus: 404, stageNumber: 1, objective: 'RECON_ENDPOINT', targetEntity: 'route:/api/v1/internal/treasury/wire-export' },
      { path: '/api/v1/internal/treasury/wire-export', originStatus: 404, stageNumber: 1, objective: 'RECON_ENDPOINT', targetEntity: 'route:/api/v1/internal/treasury/wire-export' },
      { path: '/api/v1/internal/treasury/wire-export', originStatus: 404, stageNumber: 1, objective: 'RECON_ENDPOINT', targetEntity: 'route:/api/v1/internal/treasury/wire-export' },
      { path: '/api/v1/internal/treasury/wire-export', originStatus: 404, stageNumber: 1, objective: 'RECON_ENDPOINT', targetEntity: 'route:/api/v1/internal/treasury/wire-export' },
      { path: '/api/v1/internal/treasury/wire-export', originStatus: 404, stageNumber: 2, objective: 'RECON_ENDPOINT', targetEntity: 'route:/api/v1/internal/treasury/wire-export' },
      { path: '/api/v1/internal/treasury/wire-export', originStatus: 404, stageNumber: 2, objective: 'RECON_ENDPOINT', targetEntity: 'route:/api/v1/internal/treasury/wire-export' },
      { path: '/api/v1/accounts', originStatus: 200, stageNumber: 2, objective: 'DATA_DISCOVERY' }
    ]),
    expectedBehavioralObservations: { expectedLabel: 'SUSPICIOUS_OR_MEDIUM', deceptionExpected: false }, // Wait: let's see honestly whether solitary MEDIUM rule passes Stage 4C gate!
    expectedAdaptationOpportunities: ['Expose decoy wire-export endpoint if policy permits medium probing'],
    expectedConsistencyConstraints: ['Preserve consistent 200 or rate-limited state across repeated calls'],
    terminationCondition: '8 repeated access probes completed'
  },
  {
    scenarioId: 'TEST-MULTI-01',
    partition: STAGE6_PARTITIONS.TEST,
    groundTruthCategory: 'ATTACK',
    taxonomy: 'MULTI_STAGE_PROGRESSION',
    name: 'Four-Stage Kill Chain: Auth -> User Creation -> Route Pivot -> Canary Data',
    clientIp: '203.0.113.27',
    sessionId: 'sess-test-multi-01',
    initialEnvironmentState: INITIAL_SYNTHETIC_STATE,
    requestSequence: makeSequence(0, 450, [
      // Stage 1: Auth brute-force on new identity sec_auditor_09
      { method: 'POST', path: '/api/v1/auth/login', body: { username: 'sec_auditor_09' }, originStatus: 401, stageNumber: 1, objective: 'CREDENTIAL_PROBE', targetEntity: 'user:sec_auditor_09' },
      { method: 'POST', path: '/api/v1/auth/login', body: { username: 'sec_auditor_09' }, originStatus: 401, stageNumber: 1, objective: 'CREDENTIAL_PROBE', targetEntity: 'user:sec_auditor_09' },
      { method: 'POST', path: '/api/v1/auth/login', body: { username: 'sec_auditor_09' }, originStatus: 401, stageNumber: 1, objective: 'CREDENTIAL_PROBE', targetEntity: 'user:sec_auditor_09' },
      { method: 'POST', path: '/api/v1/auth/login', body: { username: 'sec_auditor_09' }, originStatus: 401, stageNumber: 1, objective: 'CREDENTIAL_PROBE', targetEntity: 'user:sec_auditor_09' },
      // Stage 2: Attacker looks up sec_auditor_09 profile + roles (cross-component identity consistency test!)
      { path: '/api/v1/users/sec_auditor_09', originStatus: 404, stageNumber: 2, objective: 'USER_LOOKUP', targetEntity: 'user:sec_auditor_09' },
      { path: '/api/v1/auth/roles', originStatus: 200, stageNumber: 2, objective: 'ROLE_VERIFY', targetEntity: 'user:sec_auditor_09' },
      // Stage 3: Attacker pivots to internal audit log endpoint
      { path: '/api/v1/internal/admin/audit-logs', originStatus: 404, stageNumber: 3, objective: 'AUDIT_ACCESS', targetEntity: 'route:/api/v1/internal/admin/audit-logs' },
      { path: '/api/v1/internal/admin/audit-logs', originStatus: 404, stageNumber: 3, objective: 'AUDIT_ACCESS', targetEntity: 'route:/api/v1/internal/admin/audit-logs' },
      { path: '/api/v1/internal/compliance/dossier', originStatus: 404, stageNumber: 3, objective: 'AUDIT_ACCESS', targetEntity: 'route:/api/v1/internal/compliance/dossier' },
      // Stage 4: Attacker pivots to sensitive data tables
      { path: '/api/v1/data/schemas', originStatus: 200, stageNumber: 4, objective: 'DATA_DISCOVERY', targetEntity: 'schema:synthetic_customers' },
      { path: '/api/v1/data/customers', originStatus: 200, stageNumber: 4, objective: 'DATA_DISCOVERY', targetEntity: 'customer:CUST-DEC-M1' },
      { path: '/api/v1/users/sec_auditor_09', originStatus: 404, stageNumber: 4, objective: 'USER_LOOKUP', targetEntity: 'user:sec_auditor_09' }
    ]),
    expectedBehavioralObservations: { expectedLabel: 'HIGHLY_SUSPICIOUS', deceptionExpected: true },
    expectedAdaptationOpportunities: ['Coordinate Identity -> Credential -> Dynamic Route -> Canary Schema sequentially'],
    expectedConsistencyConstraints: [
      'sec_auditor_09 exists in users before credential or /users/sec_auditor_09 route',
      'Role in auth response matches users table',
      'Canary schema includes tracking column'
    ],
    terminationCondition: 'All 4 APT kill-chain stages executed'
  },
  {
    scenarioId: 'TEST-MULTI-02',
    partition: STAGE6_PARTITIONS.TEST,
    groundTruthCategory: 'ATTACK',
    taxonomy: 'MULTI_STAGE_PROGRESSION',
    name: 'Cross-Service Auth Burst & Route Availability Dependency Chain',
    clientIp: '203.0.113.28',
    sessionId: 'sess-test-multi-02',
    initialEnvironmentState: INITIAL_SYNTHETIC_STATE,
    requestSequence: makeSequence(0, 40, [
      // 16 rapid calls within 1 second -> triggers RULE_REQUEST_BURST + auth probes -> tests SERVICE_DEPENDENCY consistency!
      { method: 'POST', path: '/api/v1/auth/login', body: { username: 'alex.chen' }, originStatus: 401, stageNumber: 1, objective: 'SERVICE_BURST', targetEntity: 'service:SYNTHETIC_AUTH' },
      { method: 'POST', path: '/api/v1/auth/login', body: { username: 'alex.chen' }, originStatus: 401, stageNumber: 1, objective: 'SERVICE_BURST', targetEntity: 'service:SYNTHETIC_AUTH' },
      { method: 'POST', path: '/api/v1/auth/login', body: { username: 'alex.chen' }, originStatus: 401, stageNumber: 1, objective: 'SERVICE_BURST', targetEntity: 'service:SYNTHETIC_AUTH' },
      { method: 'POST', path: '/api/v1/auth/login', body: { username: 'alex.chen' }, originStatus: 401, stageNumber: 1, objective: 'SERVICE_BURST', targetEntity: 'service:SYNTHETIC_AUTH' },
      { method: 'POST', path: '/api/v1/auth/login', body: { username: 'alex.chen' }, originStatus: 401, stageNumber: 1, objective: 'SERVICE_BURST', targetEntity: 'service:SYNTHETIC_AUTH' },
      { method: 'POST', path: '/api/v1/auth/login', body: { username: 'alex.chen' }, originStatus: 401, stageNumber: 1, objective: 'SERVICE_BURST', targetEntity: 'service:SYNTHETIC_AUTH' },
      { path: '/api/v1/internal/auth/tokens', originStatus: 404, stageNumber: 2, objective: 'RECON_ENDPOINT', targetEntity: 'route:/api/v1/internal/auth/tokens' },
      { path: '/api/v1/auth/session', originStatus: 200, stageNumber: 2, objective: 'SERVICE_PROBE', targetEntity: 'service:SYNTHETIC_AUTH' },
      { path: '/api/v1/auth/roles', originStatus: 200, stageNumber: 2, objective: 'SERVICE_PROBE', targetEntity: 'service:SYNTHETIC_AUTH' },
      { path: '/api/v1/internal/auth/tokens', originStatus: 404, stageNumber: 3, objective: 'RECON_ENDPOINT', targetEntity: 'route:/api/v1/internal/auth/tokens' },
      { path: '/api/v1/auth/session', originStatus: 200, stageNumber: 3, objective: 'SERVICE_PROBE', targetEntity: 'service:SYNTHETIC_AUTH' },
      { path: '/api/v1/users/alex.chen', originStatus: 200, stageNumber: 3, objective: 'USER_LOOKUP', targetEntity: 'user:alex.chen' },
      { path: '/api/v1/accounts', originStatus: 200, stageNumber: 3, objective: 'DATA_DISCOVERY' },
      { path: '/api/v1/data/records', originStatus: 200, stageNumber: 3, objective: 'DATA_DISCOVERY' },
      { path: '/api/v1/auth/roles', originStatus: 200, stageNumber: 3, objective: 'ROLE_VERIFY', targetEntity: 'user:alex.chen' },
      { path: '/api/v1/auth/session', originStatus: 200, stageNumber: 3, objective: 'SERVICE_PROBE', targetEntity: 'service:SYNTHETIC_AUTH' }
    ]),
    expectedBehavioralObservations: { expectedLabel: 'HIGHLY_SUSPICIOUS', deceptionExpected: true },
    expectedAdaptationOpportunities: ['Tarpit / rate-limit specific route without breaking SYNTHETIC_AUTH while /auth routes active'],
    expectedConsistencyConstraints: ['DSG Check 5: must NOT disable SYNTHETIC_AUTH while active /api/v1/auth routes exist'],
    terminationCondition: '16-request burst & service probe completed'
  },
  {
    scenarioId: 'TEST-SHIFT-01',
    partition: STAGE6_PARTITIONS.TEST,
    groundTruthCategory: 'ATTACK',
    taxonomy: 'BEHAVIOR_CHANGE',
    name: 'Stealth Normal Baseline Shifting Mid-Session to Rapid Recon & Auth Pivot',
    clientIp: '203.0.113.29',
    sessionId: 'sess-test-shift-01',
    initialEnvironmentState: INITIAL_SYNTHETIC_STATE,
    requestSequence: makeSequence(0, 5000, [
      // Slow benign phase (20s across 4 calls)
      { path: '/api/v1/accounts', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ', deltaMs: 5000 },
      { path: '/api/v1/resources', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ', deltaMs: 5000 },
      { path: '/api/v1/data/records', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ', deltaMs: 5000 },
      { path: '/api/v1/users/usr-syn-101', originStatus: 200, stageNumber: 0, objective: 'BENIGN_READ', deltaMs: 25000 },
      // Sudden pivot: rapid acceleration (<300ms apart) + 404/401 storm!
      { path: '/api/v1/internal/k8s/pods', originStatus: 404, stageNumber: 1, objective: 'RECON_ENDPOINT', targetEntity: 'route:/api/v1/internal/k8s/pods', deltaMs: 120 },
      { path: '/api/v1/internal/vault/keys', originStatus: 404, stageNumber: 1, objective: 'RECON_ENDPOINT', targetEntity: 'route:/api/v1/internal/vault/keys', deltaMs: 120 },
      { path: '/api/v1/internal/ci/tokens', originStatus: 404, stageNumber: 1, objective: 'RECON_ENDPOINT', targetEntity: 'route:/api/v1/internal/ci/tokens', deltaMs: 120 },
      { path: '/api/v1/internal/admin/flags', originStatus: 404, stageNumber: 2, objective: 'RECON_ENDPOINT', targetEntity: 'route:/api/v1/internal/admin/flags', deltaMs: 120 },
      { method: 'POST', path: '/api/v1/auth/login', body: { username: 'pivot_svc' }, originStatus: 401, stageNumber: 2, objective: 'CREDENTIAL_PROBE', targetEntity: 'user:pivot_svc', deltaMs: 120 },
      { method: 'POST', path: '/api/v1/auth/login', body: { username: 'pivot_svc' }, originStatus: 401, stageNumber: 3, objective: 'CREDENTIAL_USE', targetEntity: 'user:pivot_svc', deltaMs: 120 },
      { path: '/api/v1/users/pivot_svc', originStatus: 404, stageNumber: 3, objective: 'USER_LOOKUP', targetEntity: 'user:pivot_svc', deltaMs: 120 },
      { path: '/api/v1/data/customers', originStatus: 200, stageNumber: 4, objective: 'DATA_DISCOVERY', targetEntity: 'customer:CUST-DEC-S1' }
    ]),
    expectedBehavioralObservations: { expectedLabel: 'SUSPICIOUS_OR_HIGH', deceptionExpected: true },
    expectedAdaptationOpportunities: ['Detect behavioral acceleration & pivot -> adapt routes, identity pivot_svc, and data'],
    expectedConsistencyConstraints: ['Maintain identity-route consistency across sudden behavioral shift'],
    terminationCondition: '12-request stealth-to-attack shift complete'
  },
  {
    scenarioId: 'TEST-AMBIG-01',
    partition: STAGE6_PARTITIONS.TEST,
    groundTruthCategory: 'AMBIGUOUS',
    taxonomy: 'AMBIGUOUS_INCOMPLETE_TELEMETRY',
    name: 'Ambiguous Dropped Telemetry & Unreliable Correlation Stream',
    clientIp: '203.0.113.30',
    sessionId: 'sess-test-ambig-01',
    initialEnvironmentState: INITIAL_SYNTHETIC_STATE,
    requestSequence: makeSequence(0, 1100, [
      { path: '/api/v1/accounts', originStatus: 200, stageNumber: 0, objective: 'AMBIGUOUS_PROBE', telemetryQuality: { telemetryLossDetected: true, completenessStatus: 'PARTIAL', corruptFields: ['durationMs'] } },
      { path: '/api/v1/unknown-edge-1', originStatus: 404, stageNumber: 0, objective: 'AMBIGUOUS_PROBE', telemetryQuality: { telemetryLossDetected: true, completenessStatus: 'DEGRADED', corruptFields: ['responseStatus', 'httpMethod'] } },
      { path: '/api/v1/auth/login', method: 'POST', body: { username: 'alex.chen' }, originStatus: 401, stageNumber: 0, objective: 'AMBIGUOUS_PROBE', telemetryQuality: { telemetryLossDetected: true, completenessStatus: 'DEGRADED', corruptFields: ['requestSizeBytes'] } },
      { path: '/api/v1/accounts', originStatus: 200, stageNumber: 0, objective: 'AMBIGUOUS_PROBE', telemetryQuality: { telemetryLossDetected: true, completenessStatus: 'PARTIAL', corruptFields: ['clientIp'] } },
      { path: '/api/v1/resources', originStatus: 200, stageNumber: 0, objective: 'AMBIGUOUS_PROBE', telemetryQuality: { telemetryLossDetected: true, completenessStatus: 'DEGRADED', corruptFields: ['timestamp'] } },
      { path: '/api/v1/unknown-edge-2', originStatus: 404, stageNumber: 0, objective: 'AMBIGUOUS_PROBE', telemetryQuality: { telemetryLossDetected: true, completenessStatus: 'DEGRADED', corruptFields: ['httpMethod'] } }
    ]),
    expectedBehavioralObservations: { expectedLabel: 'INSUFFICIENT_EVIDENCE', deceptionExpected: false },
    expectedAdaptationOpportunities: [],
    expectedConsistencyConstraints: ['Strictly refuse deception proposal when telemetryLossDetected is true'],
    terminationCondition: '6 incomplete events evaluated'
  },
  {
    scenarioId: 'TEST-AMBIG-02',
    partition: STAGE6_PARTITIONS.TEST,
    groundTruthCategory: 'AMBIGUOUS',
    taxonomy: 'AMBIGUOUS_INCOMPLETE_TELEMETRY',
    name: 'Ambiguous Misconfigured Third-Party Webhook Client (High Collision / Mixed Methods)',
    clientIp: '203.0.113.31',
    sessionId: 'sess-test-ambig-02',
    initialEnvironmentState: INITIAL_SYNTHETIC_STATE,
    requestSequence: makeSequence(0, 1500, [
      { method: 'OPTIONS', path: '/api/v1/accounts', originStatus: 200, stageNumber: 0, objective: 'AMBIGUOUS_PROBE' },
      { method: 'HEAD', path: '/api/v1/resources', originStatus: 200, stageNumber: 0, objective: 'AMBIGUOUS_PROBE' },
      { method: 'PROPFIND', path: '/api/v1/data/records', originStatus: 405, stageNumber: 0, objective: 'AMBIGUOUS_PROBE' }, // WebDAV verb from broken WebDAV/Sync tool vs scanner!
      { method: 'OPTIONS', path: '/api/v1/accounts', originStatus: 200, stageNumber: 0, objective: 'AMBIGUOUS_PROBE' },
      { method: 'GET', path: '/api/v1/accounts', originStatus: 200, stageNumber: 0, objective: 'AMBIGUOUS_PROBE' },
      { method: 'GET', path: '/api/v1/resources', originStatus: 200, stageNumber: 0, objective: 'AMBIGUOUS_PROBE' }
    ]),
    expectedBehavioralObservations: { expectedLabel: 'AMBIGUOUS_UNCERTAIN', deceptionExpected: false },
    expectedAdaptationOpportunities: [],
    expectedConsistencyConstraints: ['Test whether unverified medium-severity WebDAV call triggers false deception'],
    terminationCondition: '6 mixed webhook requests evaluated'
  }
]);

export function getScenariosByPartition(partition = null) {
  if (!partition) return [...STAGE6_SCENARIOS];
  return STAGE6_SCENARIOS.filter((s) => s.partition === partition);
}

/**
 * Automated leakage verification across DEVELOPMENT, VALIDATION, and TEST partitions.
 * Ensures zero duplicate scenario IDs, distinct client IPs, distinct attack target usernames,
 * and distinct scenario-specific internal routes across partitions.
 */
export function auditScenarioPartitionLeakage() {
  const byPartition = {
    DEVELOPMENT: getScenariosByPartition(STAGE6_PARTITIONS.DEVELOPMENT),
    VALIDATION: getScenariosByPartition(STAGE6_PARTITIONS.VALIDATION),
    TEST: getScenariosByPartition(STAGE6_PARTITIONS.TEST)
  };

  const baselinePathSet = new Set(INITIAL_SYNTHETIC_STATE.baselineRoutes);
  const seenIds = new Set();
  const duplicateIds = [];
  const ipByPartition = { DEVELOPMENT: new Set(), VALIDATION: new Set(), TEST: new Set() };
  const attackRoutesByPartition = { DEVELOPMENT: new Set(), VALIDATION: new Set(), TEST: new Set() };
  const dynamicUsernamesByPartition = { DEVELOPMENT: new Set(), VALIDATION: new Set(), TEST: new Set() };

  for (const [partName, scenarios] of Object.entries(byPartition)) {
    for (const s of scenarios) {
      if (seenIds.has(s.scenarioId)) duplicateIds.push(s.scenarioId);
      seenIds.add(s.scenarioId);
      ipByPartition[partName].add(s.clientIp);

      for (const req of s.requestSequence) {
        if (!baselinePathSet.has(req.path) && s.groundTruthCategory === 'ATTACK') {
          attackRoutesByPartition[partName].add(req.path);
        }
        if (req.body?.username && !INITIAL_SYNTHETIC_STATE.users.some((u) => u.username === req.body.username)) {
          dynamicUsernamesByPartition[partName].add(req.body.username);
        }
      }
    }
  }

  const intersect = (a, b) => [...a].filter((x) => b.has(x));

  const devTestIpOverlap = intersect(ipByPartition.DEVELOPMENT, ipByPartition.TEST);
  const valTestIpOverlap = intersect(ipByPartition.VALIDATION, ipByPartition.TEST);
  const devTestRouteOverlap = intersect(attackRoutesByPartition.DEVELOPMENT, attackRoutesByPartition.TEST);
  const valTestRouteOverlap = intersect(attackRoutesByPartition.VALIDATION, attackRoutesByPartition.TEST);
  const devTestUserOverlap = intersect(dynamicUsernamesByPartition.DEVELOPMENT, dynamicUsernamesByPartition.TEST);
  const valTestUserOverlap = intersect(dynamicUsernamesByPartition.VALIDATION, dynamicUsernamesByPartition.TEST);

  const leakCount =
    duplicateIds.length +
    devTestIpOverlap.length +
    valTestIpOverlap.length +
    devTestRouteOverlap.length +
    valTestRouteOverlap.length +
    devTestUserOverlap.length +
    valTestUserOverlap.length;

  return {
    leakFree: leakCount === 0,
    leakCount,
    partitionCounts: {
      DEVELOPMENT: byPartition.DEVELOPMENT.length,
      VALIDATION: byPartition.VALIDATION.length,
      TEST: byPartition.TEST.length,
      TOTAL: STAGE6_SCENARIOS.length
    },
    checks: {
      duplicateIds,
      devTestIpOverlap,
      valTestIpOverlap,
      devTestRouteOverlap,
      valTestRouteOverlap,
      devTestUserOverlap,
      valTestUserOverlap
    }
  };
}
