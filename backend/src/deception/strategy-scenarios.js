/**
 * Strategy Selection Benchmark Suite (Stage 5A.1).
 *
 * Defines 11 canonical evaluation scenarios covering single-vector, multi-vector,
 * ambiguous, degraded, and policy-constrained attacker behaviors.
 *
 * Scenarios:
 * 1. API Enumeration
 * 2. Credential Probing
 * 3. Sensitive Data Access
 * 4. Service Discovery
 * 5. Slow Reconnaissance
 * 6. Mixed Attack Behavior
 * 7. Multi-Stage Attacks
 * 8. Ambiguous Behavior
 * 9. Conflicting Rule Findings
 * 10. Incomplete Telemetry
 * 11. Application-Specific Strategy Incompatibility
 */

import { STRATEGY_CATEGORIES } from './strategy-catalog.js';
import { StrategySelectionService } from './strategy-selection.service.js';

export const SCENARIO_DEFINITIONS = [
  {
    scenarioId: 'SCENARIO_01_API_ENUMERATION',
    name: 'API Enumeration Probing',
    description: 'Attacker probes undocumented endpoints with non-standard HTTP methods to enumerate REST surface.',
    evidence: {
      assessmentLabel: 'ATTACK',
      confidenceScore: 0.92,
      riskScore: 0.90,
      dataQualityState: 'COMPLETE',
      telemetryLossDetected: false,
      sessionCorrelationConfidence: 0.95,
      ruleFindings: [
        { ruleId: 'RULE_SUSPICIOUS_METHOD', severity: 'HIGH', message: 'Methods PUT, PATCH, DELETE sent to read-only endpoints' },
        { ruleId: 'RULE_API_ENUMERATION', severity: 'HIGH', message: 'Sequential REST route probing across /api/v1/internal' }
      ],
      features: { distinctMethodsCount: 4, apiRouteDepthMax: 5 }
    },
    policy: {
      name: 'Default Strict Policy',
      priority: 10,
      requiredEvidenceCriteria: { minConfidence: 0.7, requireRuleCorroboration: true }
    },
    expectedCategory: STRATEGY_CATEGORIES.API_DECEPTION,
    expectedSelected: 'strat-api-shadow-facade-01'
  },
  {
    scenarioId: 'SCENARIO_02_CREDENTIAL_PROBING',
    name: 'Credential Probing & Brute Force',
    description: 'Rapid sequential authentication failures against admin login endpoint using dictionary passwords.',
    evidence: {
      assessmentLabel: 'ATTACK',
      confidenceScore: 0.95,
      riskScore: 0.95,
      dataQualityState: 'COMPLETE',
      telemetryLossDetected: false,
      sessionCorrelationConfidence: 0.90,
      ruleFindings: [
        { ruleId: 'RULE_AUTH_BRUTE_FORCE', severity: 'CRITICAL', message: '25 failed login attempts in 10 seconds' },
        { ruleId: 'RULE_CREDENTIAL_STUFFING', severity: 'HIGH', message: 'Known breached account list match' }
      ],
      features: { authFailureCount: 25, distinctUsernamesProbed: 8 }
    },
    policy: {
      name: 'Auth Shield Policy',
      priority: 5,
      requiredEvidenceCriteria: { minConfidence: 0.7, requireRuleCorroboration: true }
    },
    expectedCategory: STRATEGY_CATEGORIES.CREDENTIAL_DECEPTION,
    expectedSelected: 'strat-credential-canary-token-01'
  },
  {
    scenarioId: 'SCENARIO_03_SENSITIVE_DATA_ACCESS',
    name: 'Sensitive Data Exfiltration & SQL Probing',
    description: 'Attacker injects SQL payload and attempts bulk pagination queries against customer database.',
    evidence: {
      assessmentLabel: 'ATTACK',
      confidenceScore: 0.94,
      riskScore: 0.92,
      dataQualityState: 'COMPLETE',
      telemetryLossDetected: false,
      sessionCorrelationConfidence: 0.88,
      ruleFindings: [
        { ruleId: 'RULE_DATA_ACCESS_TAMPERING', severity: 'CRITICAL', message: 'UNION SELECT injection signature' },
        { ruleId: 'RULE_DATA_EXFILTRATION', severity: 'HIGH', message: 'Abnormal response body payload requests' }
      ],
      features: { sqlKeywordsFound: 3, bytesRequestedAnomalyScore: 4.2 }
    },
    policy: {
      name: 'Data Protection Policy',
      priority: 15,
      requiredEvidenceCriteria: { minConfidence: 0.7, requireRuleCorroboration: true }
    },
    expectedCategory: STRATEGY_CATEGORIES.DATA_ACCESS_DECEPTION,
    expectedSelected: 'strat-data-honey-records-01'
  },
  {
    scenarioId: 'SCENARIO_04_SERVICE_DISCOVERY',
    name: 'High-Frequency Service Discovery',
    description: 'Attacker bursts high-frequency connection attempts across internal microservice ports.',
    evidence: {
      assessmentLabel: 'ATTACK',
      confidenceScore: 0.89,
      riskScore: 0.86,
      dataQualityState: 'COMPLETE',
      telemetryLossDetected: false,
      sessionCorrelationConfidence: 0.85,
      ruleFindings: [
        { ruleId: 'RULE_HIGH_FREQUENCY_BURST', severity: 'HIGH', message: '120 requests/sec across 15 internal paths' },
        { ruleId: 'RULE_SERVICE_DISCOVERY', severity: 'MEDIUM', message: 'Probing internal service mesh endpoints' }
      ],
      features: { burstRps: 120, portScanCount: 6 }
    },
    policy: {
      name: 'Service Rate Policy',
      priority: 20,
      requiredEvidenceCriteria: { minConfidence: 0.7 }
    },
    expectedCategory: STRATEGY_CATEGORIES.SERVICE_INTERACTION_DECEPTION,
    expectedSelected: 'strat-service-tarpit-latency-01'
  },
  {
    scenarioId: 'SCENARIO_05_SLOW_RECONNAISSANCE',
    name: 'Slow Low-Frequency Reconnaissance',
    description: 'Attacker probes diverse endpoints slowly (1 request every 2 minutes) to evade threshold alerts.',
    evidence: {
      assessmentLabel: 'ATTACK',
      confidenceScore: 0.78,
      riskScore: 0.75,
      dataQualityState: 'COMPLETE',
      telemetryLossDetected: false,
      sessionCorrelationConfidence: 0.75,
      ruleFindings: [
        { ruleId: 'RULE_SLOW_RECON', severity: 'MEDIUM', message: 'Low-frequency dispersed probing over 30 min window' },
        { ruleId: 'RULE_REPEATED_RESOURCE_PROBING', severity: 'MEDIUM', message: '404 pattern across non-existent assets' }
      ],
      features: { requestIntervalMeanSec: 120, distinctPathsSampled: 15 }
    },
    policy: {
      name: 'Recon Shield Policy',
      priority: 25,
      requiredEvidenceCriteria: { minConfidence: 0.7, requireRuleCorroboration: true }
    },
    expectedCategory: STRATEGY_CATEGORIES.RECONNAISSANCE_DECEPTION,
    expectedSelected: 'strat-recon-honey-endpoints-01'
  },
  {
    scenarioId: 'SCENARIO_06_MIXED_ATTACK_BEHAVIOR',
    name: 'Mixed Attack (Credential Brute Force + Data Probing)',
    description: 'Simultaneous credential attack and sensitive SQL data probe. Critical severity rules must dominate ranking.',
    evidence: {
      assessmentLabel: 'ATTACK',
      confidenceScore: 0.96,
      riskScore: 0.98,
      dataQualityState: 'COMPLETE',
      telemetryLossDetected: false,
      sessionCorrelationConfidence: 0.92,
      ruleFindings: [
        { ruleId: 'RULE_AUTH_BRUTE_FORCE', severity: 'CRITICAL', message: '50 failed login attempts' },
        { ruleId: 'RULE_DATA_ACCESS_TAMPERING', severity: 'HIGH', message: 'SQL parameter tampering' }
      ],
      features: { authFailureCount: 50, sqlKeywordsFound: 1 }
    },
    policy: {
      name: 'Zero Trust Policy',
      priority: 5,
      requiredEvidenceCriteria: { minConfidence: 0.7 }
    },
    // Both Credential and Data Access match; Credential has higher severity match + targeted rule
    expectedCategory: STRATEGY_CATEGORIES.CREDENTIAL_DECEPTION,
    expectedSelected: 'strat-credential-canary-token-01'
  },
  {
    scenarioId: 'SCENARIO_07_MULTI_STAGE_ATTACK',
    name: 'Multi-Stage Attack (Recon -> Auth Probing)',
    description: 'Attacker progresses from initial recon into targeted authentication brute-forcing.',
    evidence: {
      assessmentLabel: 'ATTACK',
      confidenceScore: 0.93,
      riskScore: 0.91,
      dataQualityState: 'COMPLETE',
      telemetryLossDetected: false,
      sessionCorrelationConfidence: 0.89,
      ruleFindings: [
        { ruleId: 'RULE_REPEATED_RESOURCE_PROBING', severity: 'LOW', message: 'Initial directory scan' },
        { ruleId: 'RULE_AUTH_BRUTE_FORCE', severity: 'CRITICAL', message: 'Targeted administrative password guessing' }
      ],
      features: { attackStage: 'ACTIVE_EXPLOIT', distinctPathsSampled: 8, authFailureCount: 15 }
    },
    policy: {
      name: 'Default Policy',
      priority: 10,
      requiredEvidenceCriteria: { minConfidence: 0.7 }
    },
    expectedCategory: STRATEGY_CATEGORIES.CREDENTIAL_DECEPTION,
    expectedSelected: 'strat-credential-canary-token-01'
  },
  {
    scenarioId: 'SCENARIO_08_AMBIGUOUS_BEHAVIOR',
    name: 'Ambiguous Behavior (Low Confidence & Marginal Correlation)',
    description: 'Uncertain observation with low confidence and marginal session correlation confidence.',
    evidence: {
      assessmentLabel: 'ATTACK',
      confidenceScore: 0.62, // Below standard 0.7 threshold
      riskScore: 0.65,
      dataQualityState: 'COMPLETE',
      telemetryLossDetected: false,
      sessionCorrelationConfidence: 0.55, // Low correlation
      ruleFindings: [
        { ruleId: 'RULE_SUSPICIOUS_METHOD', severity: 'LOW', message: 'Single uncommon method header' }
      ],
      features: { anomalyScore: 0.62 }
    },
    policy: {
      name: 'Strict Policy',
      priority: 10,
      requiredEvidenceCriteria: { minConfidence: 0.7 }
    },
    expectedCategory: STRATEGY_CATEGORIES.API_DECEPTION,
    expectedSelected: null // Must be rejected due to low confidence and low correlation
  },
  {
    scenarioId: 'SCENARIO_09_CONFLICTING_RULE_FINDINGS',
    name: 'Conflicting Rule Findings (Recon vs API Method)',
    description: 'Equal severity findings for both Reconnaissance and API Method. Deterministic tie-breaker selects highest match.',
    evidence: {
      assessmentLabel: 'ATTACK',
      confidenceScore: 0.88,
      riskScore: 0.85,
      dataQualityState: 'COMPLETE',
      telemetryLossDetected: false,
      sessionCorrelationConfidence: 0.85,
      ruleFindings: [
        { ruleId: 'RULE_REPEATED_RESOURCE_PROBING', severity: 'HIGH', message: 'Probing 12 paths' },
        { ruleId: 'RULE_SUSPICIOUS_METHOD', severity: 'HIGH', message: 'Non-standard methods' }
      ],
      features: {}
    },
    policy: {
      name: 'General Security Policy',
      priority: 10,
      requiredEvidenceCriteria: { minConfidence: 0.7 }
    },
    // Both match; deterministic tie-breaker ensures consistent selection
    expectedCategory: STRATEGY_CATEGORIES.API_DECEPTION,
    expectedSelected: 'strat-api-shadow-facade-01'
  },
  {
    scenarioId: 'SCENARIO_10_INCOMPLETE_TELEMETRY',
    name: 'Incomplete Telemetry & Data Loss',
    description: 'High confidence attack signatures detected, but telemetryLossDetected is TRUE and state is DEGRADED.',
    evidence: {
      assessmentLabel: 'ATTACK',
      confidenceScore: 0.95,
      riskScore: 0.95,
      dataQualityState: 'DEGRADED',
      telemetryLossDetected: true,
      sessionCorrelationConfidence: 0.90,
      ruleFindings: [
        { ruleId: 'RULE_AUTH_BRUTE_FORCE', severity: 'CRITICAL', message: 'Brute force pattern' }
      ],
      features: { packetLossRate: 0.35 }
    },
    policy: {
      name: 'Fail-Safe Policy',
      priority: 10,
      requiredEvidenceCriteria: { minConfidence: 0.7, requiredTelemetryQuality: 'COMPLETE' }
    },
    expectedCategory: STRATEGY_CATEGORIES.CREDENTIAL_DECEPTION,
    expectedSelected: null // Must reject strategies requiring COMPLETE telemetry
  },
  {
    scenarioId: 'SCENARIO_11_APPLICATION_INCOMPATIBILITY',
    name: 'Application-Specific Strategy Incompatibility',
    description: 'Attacker probes credentials, but application policy allowlist strictly excludes CREDENTIAL_DECEPTION.',
    evidence: {
      assessmentLabel: 'ATTACK',
      confidenceScore: 0.92,
      riskScore: 0.90,
      dataQualityState: 'COMPLETE',
      telemetryLossDetected: false,
      sessionCorrelationConfidence: 0.92,
      ruleFindings: [
        { ruleId: 'RULE_AUTH_BRUTE_FORCE', severity: 'HIGH', message: 'Probing login endpoint' }
      ],
      features: { authFailureCount: 10 }
    },
    policy: {
      name: 'Restricted App Policy',
      priority: 10,
      requiredEvidenceCriteria: {
        minConfidence: 0.7,
        allowedStrategies: ['strat-recon-honey-endpoints-01', 'strat-api-shadow-facade-01'] // Excludes credential strategy
      }
    },
    expectedCategory: STRATEGY_CATEGORIES.CREDENTIAL_DECEPTION,
    expectedSelected: null // Must be rejected with POLICY_STRATEGY_NOT_PERMITTED
  }
];

export class StrategyBenchmarkRunner {
  constructor(service = null) {
    this.service = service || new StrategySelectionService();
  }

  /**
   * Run all 11 scenarios and record detailed evaluation outcomes.
   * @returns {Array<Object>}
   */
  evaluateAllScenarios() {
    const results = [];

    for (const scenario of SCENARIO_DEFINITIONS) {
      const evaluation = this.service.selectStrategy({
        assessment: scenario.evidence,
        policy: scenario.policy
      });

      const selectedId = evaluation.selectedStrategy
        ? evaluation.selectedStrategy.strategyIdentifier
        : null;

      const candidatesRecord = evaluation.candidates.map((c) => ({
        strategyIdentifier: c.strategyIdentifier,
        strategyType: c.strategyType,
        score: c.score,
        eligible: c.eligible,
        reasons: c.reasons,
        scoreBreakdown: c.scoreBreakdown
      }));

      const rejectedRecord = evaluation.rejectedCandidates.map((r) => ({
        strategyIdentifier: r.strategyIdentifier,
        strategyType: r.strategyType,
        reasons: r.reasons
      }));

      const pass = selectedId === scenario.expectedSelected;

      results.push({
        scenarioId: scenario.scenarioId,
        name: scenario.name,
        pass,
        observedEvidence: {
          assessmentLabel: scenario.evidence.assessmentLabel,
          confidence: scenario.evidence.confidenceScore,
          dataQualityState: scenario.evidence.dataQualityState,
          telemetryLossDetected: scenario.evidence.telemetryLossDetected,
          sessionCorrelationConfidence: scenario.evidence.sessionCorrelationConfidence,
          ruleFindingsCount: scenario.evidence.ruleFindings.length
        },
        policyConstraints: scenario.policy.requiredEvidenceCriteria,
        targetCategoriesInferred: this.service.inferTargetCategories(scenario.evidence),
        candidateStrategies: candidatesRecord,
        rejectedStrategies: rejectedRecord,
        selectedStrategy: selectedId,
        rankingRationale: evaluation.selectionRationale,
        confidence: scenario.evidence.confidenceScore,
        uncertainty: {
          correlationConfidence: scenario.evidence.sessionCorrelationConfidence,
          dataLoss: scenario.evidence.telemetryLossDetected
        }
      });
    }

    return results;
  }
}
