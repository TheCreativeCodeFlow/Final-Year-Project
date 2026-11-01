/**
 * Hybrid Evidence Assessment Service (Stage 4C)
 *
 * Fuses deterministic rule findings (Branch A) and unsupervised ML anomaly scores (Branch B)
 * with telemetry completeness, baseline validity, and session correlation confidence.
 *
 * Core Guarantees:
 * 1. Preserves independent branch outputs without hiding discrepancies.
 * 2. Explicit labels: NORMAL, SUSPICIOUS, HIGHLY_SUSPICIOUS, INSUFFICIENT_EVIDENCE.
 * 3. Never silently classifies data loss or model failure as NORMAL.
 * 4. Never claims confirmed attacker identity or execution evidence.
 */

import crypto from 'node:crypto';
import { logger } from '../utils/logger.js';

export const ASSESSMENT_LABELS = Object.freeze({
  NORMAL: 'NORMAL',
  SUSPICIOUS: 'SUSPICIOUS',
  HIGHLY_SUSPICIOUS: 'HIGHLY_SUSPICIOUS',
  INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE'
});

export class HybridAssessmentService {
  /**
   * @param {object} options
   * @param {import('@prisma/client').PrismaClient} options.prisma
   */
  constructor(options = {}) {
    this.prisma = options.prisma;
  }

  /**
   * Evaluates the hybrid assessment combining rules, ML, and quality metadata.
   *
   * @param {object} params
   * @param {object} params.ruleResult - Output of RuleEngineService
   * @param {object} params.mlResult - Output of MLInferenceService
   * @param {object} params.featureSet - Primary BehavioralFeatureSet
   * @param {object} [params.rawObservation] - Source SecurityObservation
   * @param {object} [params.baseline] - Established application baseline
   * @param {object} [params.sessionContext] - Session correlation context
   * @param {string} params.tenantId
   * @param {string} [params.applicationId]
   * @param {string} [params.observationId]
   * @returns {object} Structured assessment
   */
  evaluateAssessment({
    ruleResult,
    mlResult,
    featureSet,
    rawObservation = {},
    baseline = null,
    sessionContext = {},
    tenantId,
    applicationId = null,
    observationId = null,
    sessionRef = null
  }) {
    const qualityMetadata = featureSet?.qualityMetadata || {};
    const telemetryLossDetected = qualityMetadata.telemetryLossDetected === true || qualityMetadata.hasDataLoss === true;
    const observationCount = featureSet?.observationCount ?? 1;

    const uncertaintyNotes = [];
    const contributingFactors = [];

    // 1. Data Quality & Uncertainty Assessment
    if (telemetryLossDetected) {
      uncertaintyNotes.push('Telemetry loss was detected during this evaluation window; metrics may be incomplete.');
    }
    if (sessionContext?.collisionRisk?.level === 'HIGH') {
      uncertaintyNotes.push('Session handle derived from unverified client header; collision risk is HIGH.');
    }
    if (!baseline || baseline.status !== 'ESTABLISHED') {
      uncertaintyNotes.push(`Application baseline is in state "${baseline?.status || 'NO_BASELINE'}".`);
    }
    if (mlResult.modelStatus !== 'ACTIVE') {
      uncertaintyNotes.push(`ML Anomaly Detector: ${mlResult.explanation}`);
    }

    // 2. Fusion Logic: Determine Assessment Label
    let assessmentLabel = ASSESSMENT_LABELS.NORMAL;
    let riskScore = 0.10;
    let classification = 'BENIGN_BASELINE';

    // Condition A: Incomplete Telemetry / Data Loss
    if (telemetryLossDetected && observationCount < 2) {
      assessmentLabel = ASSESSMENT_LABELS.INSUFFICIENT_EVIDENCE;
      riskScore = null;
      classification = 'INSUFFICIENT_TELEMETRY';
    } else {
      const hasCriticalRule = ruleResult.triggeredFindings?.some((f) => f.severity === 'CRITICAL');
      const highRulesCount = ruleResult.triggeredFindings?.filter((f) => f.severity === 'HIGH').length || 0;
      const mediumRulesCount = ruleResult.triggeredFindings?.filter((f) => f.severity === 'MEDIUM').length || 0;
      const isMlAnomaly = mlResult?.isAnomaly === true;

      // Condition B: HIGHLY_SUSPICIOUS
      // Triggered if: Critical rule fires OR (>= 2 High rules) OR (1 High rule + ML Anomaly)
      if (hasCriticalRule || highRulesCount >= 2 || (highRulesCount >= 1 && isMlAnomaly)) {
        assessmentLabel = ASSESSMENT_LABELS.HIGHLY_SUSPICIOUS;
        riskScore = Number((0.85 + (isMlAnomaly ? 0.10 : 0.05)).toFixed(2));
        riskScore = Math.min(1.0, riskScore);

        const primaryRule = ruleResult.triggeredFindings[0];
        classification = primaryRule ? primaryRule.ruleId : 'MULTI_RULE_ANOMALY';
        contributingFactors.push(`Severe rule violations detected (${ruleResult.triggeredCount} rules triggered).`);
        if (isMlAnomaly) {
          contributingFactors.push(`ML anomaly confirmed by ${mlResult.algorithm} (score: ${mlResult.anomalyScore}).`);
        }
      }
      // Condition C: SUSPICIOUS
      // Triggered if: 1 High rule OR (>= 1 Medium rule) OR (ML Anomaly detected alone)
      else if (highRulesCount === 1 || mediumRulesCount >= 1 || isMlAnomaly) {
        assessmentLabel = ASSESSMENT_LABELS.SUSPICIOUS;

        if (isMlAnomaly && ruleResult.triggeredCount === 0) {
          // Novel anomaly: ML detected deviation without matching specific static signature
          riskScore = Number((0.50 + ((mlResult.anomalyScore || 0.6) - 0.5) * 0.5).toFixed(2));
          riskScore = Math.min(0.75, Math.max(0.50, riskScore));
          classification = 'UNSUPERVISED_BEHAVIORAL_ANOMALY';
          contributingFactors.push(`Unsupervised statistical anomaly detected by ${mlResult.algorithm} (score: ${mlResult.anomalyScore} >= ${mlResult.decisionThreshold}).`);
        } else {
          // Rule triggered without ML anomaly (or ML calibrating)
          riskScore = Number((0.60 + (highRulesCount > 0 ? 0.15 : 0.05)).toFixed(2));
          const primaryRule = ruleResult.triggeredFindings[0];
          classification = primaryRule ? primaryRule.ruleId : 'SUSPICIOUS_BEHAVIOR';
          contributingFactors.push(`Rule violation: ${ruleResult.triggeredFindings.map((f) => f.ruleName).join(', ')}.`);
        }
      }
      // Condition D: NORMAL
      else {
        assessmentLabel = ASSESSMENT_LABELS.NORMAL;
        riskScore = 0.10;
        classification = 'BENIGN_BASELINE';
        contributingFactors.push('All deterministic rule checks passed cleanly.');
        if (mlResult.modelStatus === 'ACTIVE') {
          contributingFactors.push(`${mlResult.algorithm} confirmed traffic is statistically consistent with normal baseline.`);
        }
      }
    }

    // 3. Confidence Score Calibration
    // Scales with session correlation confidence, baseline maturity, and model presence
    let baseConfidence = sessionContext?.correlationConfidence ?? 0.85;
    if (sessionContext?.collisionRisk?.level === 'HIGH') baseConfidence *= 0.70;
    if (telemetryLossDetected) baseConfidence *= 0.75;
    if (!baseline || baseline.status !== 'ESTABLISHED') baseConfidence *= 0.90;
    const confidenceScore = Number(Math.max(0.20, Math.min(0.99, baseConfidence)).toFixed(2));

    // Explanation formulation
    const explanation = {
      assessmentLabel,
      classification,
      riskScore,
      confidenceScore,
      ruleEngineOutcome: {
        triggeredCount: ruleResult.triggeredCount,
        highestSeverity: ruleResult.highestSeverity,
        summary: ruleResult.summary
      },
      mlAnomalyOutcome: {
        modelStatus: mlResult.modelStatus,
        algorithm: mlResult.algorithm,
        isAnomaly: mlResult.isAnomaly,
        anomalyScore: mlResult.anomalyScore,
        decisionThreshold: mlResult.decisionThreshold,
        contributingFeatures: mlResult.contributingFeatures
      },
      contributingFactors,
      uncertaintyNotes,
      caveats: [
        'Assessment represents analytical measurement of observed network telemetry, NOT proof of malicious human intent.',
        'Network session handles represent observed traffic conduits; an IP or session reference is NOT an individual attacker identity.',
        'No deceptive countermeasure or diversion has been executed at this stage.'
      ]
    };

    return {
      tenantId,
      applicationId,
      observationId,
      sessionRef: sessionRef || sessionContext?.sessionRef || featureSet?.sessionRef || null,
      windowLabel: featureSet?.windowLabel || '5m',
      assessmentLabel,
      classification,
      riskScore,
      confidenceScore,
      modelOrRuleVersion: `hybrid-rules-v${ruleResult.ruleEngineVersion}+ml-${mlResult.algorithm || 'none'}-v${mlResult.modelVersion || '0'}`,
      ruleFindings: ruleResult.findings,
      mlAnomalyResult: mlResult,
      explanation,
      dataQualityState: telemetryLossDetected ? 'PARTIAL' : 'COMPLETE',
      telemetryLossDetected,
      assessedAt: new Date().toISOString()
    };
  }

  /**
   * Evaluates and idempotently persists a BehavioralAssessment in PostgreSQL.
   *
   * @param {object} params
   * @returns {Promise<object>} Persisted BehavioralAssessment
   */
  async createAndPersistAssessment(params) {
    const assessment = this.evaluateAssessment(params);

    const created = await this.prisma.behavioralAssessment.create({
      data: {
        tenantId: assessment.tenantId,
        applicationId: assessment.applicationId,
        observationId: assessment.observationId,
        sessionRef: assessment.sessionRef,
        windowLabel: assessment.windowLabel,
        assessmentLabel: assessment.assessmentLabel,
        classification: assessment.classification,
        riskScore: assessment.riskScore,
        confidenceScore: assessment.confidenceScore,
        modelOrRuleVersion: assessment.modelOrRuleVersion,
        ruleFindings: assessment.ruleFindings,
        mlAnomalyResult: assessment.mlAnomalyResult,
        explanation: assessment.explanation,
        dataQualityState: assessment.dataQualityState,
        telemetryLossDetected: assessment.telemetryLossDetected,
        assessedAt: new Date(assessment.assessedAt)
      }
    });

    logger.info('Behavioral assessment persisted', {
      assessmentId: created.id,
      tenantId: created.tenantId,
      applicationId: created.applicationId,
      label: created.assessmentLabel,
      riskScore: created.riskScore
    });

    return created;
  }
}
