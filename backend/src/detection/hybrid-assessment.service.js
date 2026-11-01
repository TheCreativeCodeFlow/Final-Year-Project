/**
 * Hybrid Evidence Assessment Service (Stage 4C / 4C.1 Hardened)
 *
 * Fuses deterministic rule findings (Branch A) and unsupervised ML anomaly scores (Branch B)
 * with telemetry completeness, baseline validity, and session correlation confidence.
 *
 * Supports 4 Evaluated Fusion Strategies:
 * - Strategy A (EXISTING): Baseline disjunctive fusion.
 * - Strategy B (CONSERVATIVE): Requires multi-branch corroboration before escalation.
 * - Strategy C (RULE_PRIORITY): Rule-priority with explicit novel-anomaly path.
 * - Strategy D (DATA_QUALITY_AWARE): Data-quality gate + context filter (timing/NAT jitter filtering).
 *
 * Core Guarantees:
 * 1. Preserves independent branch outputs without hiding discrepancies.
 * 2. Explicit labels: NORMAL, SUSPICIOUS, HIGHLY_SUSPICIOUS, INSUFFICIENT_EVIDENCE.
 * 3. Never silently classifies data loss or model failure as NORMAL.
 * 4. Never claims confirmed human attacker identity or execution evidence.
 */

import crypto from 'node:crypto';
import { logger } from '../utils/logger.js';

export const ASSESSMENT_LABELS = Object.freeze({
  NORMAL: 'NORMAL',
  SUSPICIOUS: 'SUSPICIOUS',
  HIGHLY_SUSPICIOUS: 'HIGHLY_SUSPICIOUS',
  INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE'
});

export const FUSION_STRATEGIES = Object.freeze({
  EXISTING: 'EXISTING',
  CONSERVATIVE: 'CONSERVATIVE',
  RULE_PRIORITY: 'RULE_PRIORITY',
  DATA_QUALITY_AWARE: 'DATA_QUALITY_AWARE'
});

export class HybridAssessmentService {
  /**
   * @param {object} options
   * @param {import('@prisma/client').PrismaClient} options.prisma
   * @param {string} [options.defaultStrategy='DATA_QUALITY_AWARE']
   */
  constructor(options = {}) {
    this.prisma = options.prisma;
    this.defaultStrategy = options.defaultStrategy || FUSION_STRATEGIES.DATA_QUALITY_AWARE;
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
   * @param {string} [params.fusionStrategy] - One of FUSION_STRATEGIES
   * @param {string} params.tenantId
   * @param {string} [params.applicationId]
   * @param {string} [params.observationId]
   * @param {string} [params.sessionRef]
   * @returns {object} Structured assessment
   */
  evaluateAssessment({
    ruleResult,
    mlResult = {},
    featureSet = {},
    rawObservation = {},
    baseline = null,
    sessionContext = {},
    fusionStrategy = this.defaultStrategy,
    tenantId,
    applicationId = null,
    observationId = null,
    sessionRef = null
  }) {
    const qualityMetadata = featureSet?.qualityMetadata || {};
    const telemetryLossDetected =
      qualityMetadata.telemetryLossDetected === true ||
      qualityMetadata.hasDataLoss === true ||
      qualityMetadata.completenessStatus === 'PARTIAL' ||
      qualityMetadata.completenessStatus === 'DEGRADED';
    const observationCount = featureSet?.observationCount ?? 1;

    const uncertaintyNotes = [];
    const contributingFactors = [];
    let confidenceScore = 0.85;

    // 1. Data Quality & Uncertainty Logging
    if (telemetryLossDetected) {
      uncertaintyNotes.push('Telemetry loss was detected during this evaluation window; observations may be incomplete.');
    }
    if (sessionContext?.collisionRisk?.level === 'HIGH') {
      uncertaintyNotes.push('Session handle derived from unverified client header; collision risk is HIGH.');
      confidenceScore = Math.min(confidenceScore, 0.50);
    }
    if (!baseline || baseline.status !== 'ESTABLISHED') {
      uncertaintyNotes.push(`Application baseline is in state "${baseline?.status || 'NO_BASELINE'}".`);
    }
    if (mlResult?.modelStatus && mlResult.modelStatus !== 'ACTIVE') {
      uncertaintyNotes.push(`ML Anomaly Detector: ${mlResult.explanation || 'Inactive'}`);
    }

    const hasCriticalRule = ruleResult?.triggeredFindings?.some((f) => f.severity === 'CRITICAL') || false;
    const highRulesCount = ruleResult?.triggeredFindings?.filter((f) => f.severity === 'HIGH').length || 0;
    const mediumRulesCount = ruleResult?.triggeredFindings?.filter((f) => f.severity === 'MEDIUM').length || 0;
    const isMlAnomaly = mlResult?.isAnomaly === true;
    const mlScore = mlResult?.anomalyScore ?? 0.50;

    let assessmentLabel = ASSESSMENT_LABELS.NORMAL;
    let riskScore = 0.10;
    let classification = 'BENIGN_BASELINE';

    // =========================================================================
    // Strategy A: Baseline Existing Fusion Logic
    // =========================================================================
    if (fusionStrategy === FUSION_STRATEGIES.EXISTING) {
      if (telemetryLossDetected && observationCount < 2) {
        assessmentLabel = ASSESSMENT_LABELS.INSUFFICIENT_EVIDENCE;
        riskScore = null;
        classification = 'INSUFFICIENT_TELEMETRY';
      } else if (hasCriticalRule || highRulesCount >= 2 || (highRulesCount >= 1 && isMlAnomaly)) {
        assessmentLabel = ASSESSMENT_LABELS.HIGHLY_SUSPICIOUS;
        riskScore = Number((0.85 + (isMlAnomaly ? 0.10 : 0.05)).toFixed(2));
        classification = ruleResult.triggeredFindings[0]?.ruleId || 'MULTI_RULE_ANOMALY';
      } else if (highRulesCount === 1 || mediumRulesCount >= 1 || isMlAnomaly) {
        assessmentLabel = ASSESSMENT_LABELS.SUSPICIOUS;
        riskScore = isMlAnomaly && (ruleResult.triggeredCount || 0) === 0 ? 0.65 : 0.70;
        classification = ruleResult.triggeredCount > 0 ? ruleResult.triggeredFindings[0]?.ruleId : 'UNSUPERVISED_BEHAVIORAL_ANOMALY';
      }
    }

    // =========================================================================
    // Strategy B: Conservative Fusion (Requires Corroboration for Escalation)
    // =========================================================================
    else if (fusionStrategy === FUSION_STRATEGIES.CONSERVATIVE) {
      if (telemetryLossDetected) {
        assessmentLabel = ASSESSMENT_LABELS.INSUFFICIENT_EVIDENCE;
        riskScore = null;
        classification = 'INSUFFICIENT_TELEMETRY';
      } else if (hasCriticalRule || (highRulesCount >= 1 && isMlAnomaly && mlScore >= 0.70)) {
        assessmentLabel = ASSESSMENT_LABELS.HIGHLY_SUSPICIOUS;
        riskScore = 0.90;
        classification = ruleResult.triggeredFindings[0]?.ruleId || 'CORROBORATED_CRITICAL_ANOMALY';
      } else if (highRulesCount >= 1 || mediumRulesCount >= 2 || (isMlAnomaly && mlScore >= 0.70)) {
        assessmentLabel = ASSESSMENT_LABELS.SUSPICIOUS;
        riskScore = 0.65;
        classification = ruleResult.triggeredCount > 0 ? ruleResult.triggeredFindings[0]?.ruleId : 'HIGH_DISTANCE_NOVEL_ANOMALY';
      } else {
        assessmentLabel = ASSESSMENT_LABELS.NORMAL;
        riskScore = 0.15;
        classification = 'BENIGN_BASELINE';
      }
    }

    // =========================================================================
    // Strategy C: Rule-Priority with Explicit Novel-Anomaly Path
    // =========================================================================
    else if (fusionStrategy === FUSION_STRATEGIES.RULE_PRIORITY) {
      if (telemetryLossDetected && observationCount < 2) {
        assessmentLabel = ASSESSMENT_LABELS.INSUFFICIENT_EVIDENCE;
        riskScore = null;
        classification = 'INSUFFICIENT_TELEMETRY';
      } else if (hasCriticalRule || highRulesCount >= 2) {
        assessmentLabel = ASSESSMENT_LABELS.HIGHLY_SUSPICIOUS;
        riskScore = 0.90;
        classification = ruleResult.triggeredFindings[0]?.ruleId || 'CONFIRMED_RULE_ATTACK';
      } else if (highRulesCount === 1 || mediumRulesCount >= 1) {
        assessmentLabel = isMlAnomaly ? ASSESSMENT_LABELS.HIGHLY_SUSPICIOUS : ASSESSMENT_LABELS.SUSPICIOUS;
        riskScore = isMlAnomaly ? 0.85 : 0.70;
        classification = ruleResult.triggeredFindings[0]?.ruleId;
      } else if (isMlAnomaly) {
        // Novel anomaly path without matching known static signature
        assessmentLabel = ASSESSMENT_LABELS.SUSPICIOUS;
        riskScore = Number((0.50 + Math.max(0, mlScore - 0.60) * 0.5).toFixed(2));
        classification = 'NOVEL_UNSUPERVISED_ANOMALY_UNVERIFIED';
        contributingFactors.push(`Unsupervised ML flagged statistical deviation (score: ${mlScore.toFixed(3)}) without known rule match.`);
      } else {
        assessmentLabel = ASSESSMENT_LABELS.NORMAL;
        riskScore = 0.10;
        classification = 'BENIGN_BASELINE';
      }
    }

    // =========================================================================
    // Strategy D: Data-Quality & Context-Aware Fusion (Recommended)
    // =========================================================================
    else {
      // Step 1: Telemetry Data-Quality Gate
      if (telemetryLossDetected) {
        assessmentLabel = ASSESSMENT_LABELS.INSUFFICIENT_EVIDENCE;
        riskScore = null;
        confidenceScore = 0.35;
        classification = 'INSUFFICIENT_TELEMETRY';
        contributingFactors.push('Telemetry loss detected; assessment inconclusive due to degraded evidence stream.');
      }
      // Step 2: Critical Protocol Violation
      else if (hasCriticalRule) {
        assessmentLabel = ASSESSMENT_LABELS.HIGHLY_SUSPICIOUS;
        riskScore = 0.98;
        confidenceScore = 0.98;
        classification = ruleResult.triggeredFindings.find((f) => f.severity === 'CRITICAL')?.ruleId || 'PROTOCOL_ATTACK';
        contributingFactors.push('Critical protocol violation or prohibited verb detected at gateway ingress.');
      }
      // Step 3: High Rules Triggered
      else if (highRulesCount >= 1) {
        const isCorroborated = isMlAnomaly && mlScore >= 0.58;
        assessmentLabel = isCorroborated || highRulesCount >= 2 ? ASSESSMENT_LABELS.HIGHLY_SUSPICIOUS : ASSESSMENT_LABELS.SUSPICIOUS;
        riskScore = isCorroborated ? 0.90 : 0.75;
        confidenceScore = 0.92;
        classification = ruleResult.triggeredFindings[0]?.ruleId || 'HIGH_SEVERITY_ATTACK_PATTERN';
        contributingFactors.push(`High-severity rule triggered (${ruleResult.triggeredFindings[0]?.ruleName}).`);
        if (isCorroborated) {
          contributingFactors.push(`ML anomaly confirmed by ${mlResult.algorithm || 'ML detector'} (score: ${mlScore.toFixed(3)}).`);
        }
      }
      // Step 4: Medium Rules Triggered (e.g. repeated resource probing, moderate burst)
      else if (mediumRulesCount >= 1) {
        assessmentLabel = ASSESSMENT_LABELS.SUSPICIOUS;
        riskScore = isMlAnomaly ? 0.72 : 0.55;
        confidenceScore = 0.85;
        classification = ruleResult.triggeredFindings[0]?.ruleId || 'MEDIUM_SEVERITY_PATTERN';
        contributingFactors.push(`Medium-severity rule triggered (${ruleResult.triggeredFindings[0]?.ruleName}).`);
      }
      // Step 5: Unsupervised ML Anomaly Alone (Context Filter)
      else if (isMlAnomaly) {
        const features = featureSet?.features || {};
        const http4xx = features.http_4xx_ratio?.value ?? 0.0;
        const authFailures = features.auth_failure_count?.value ?? 0;
        const enumerationScore = features.resource_enumeration_score?.value ?? 0.0;

        // Context Filter: If client error ratios and auth failures are ZERO, check if ML anomaly
        // is due to cellular network jitter or corporate NAT session multiplexing
        const hasAdversarialIndicators = http4xx > 0.15 || authFailures > 0 || enumerationScore > 0.20;

        if (!hasAdversarialIndicators && mlScore < 0.68) {
          // Benign environmental variance (mobile network jitter, corporate proxy, or benign crawler)
          assessmentLabel = ASSESSMENT_LABELS.NORMAL;
          riskScore = 0.25;
          confidenceScore = 0.80;
          classification = 'BENIGN_ENVIRONMENTAL_VARIANCE';
          uncertaintyNotes.push(`Slight statistical deviation (${mlScore.toFixed(3)}) on benign traffic without error surges or reconnaissance indicators.`);
        } else {
          // Genuine novel behavioral anomaly (Unverified statistical deviation)
          assessmentLabel = ASSESSMENT_LABELS.SUSPICIOUS;
          riskScore = Number((0.55 + Math.min(0.15, (mlScore - 0.60) * 0.4)).toFixed(2));
          confidenceScore = Math.min(0.60, 0.50 + (mlScore - 0.60) * 0.3); // Discounted confidence <= 0.60 per safety audit
          classification = 'UNSUPERVISED_BEHAVIORAL_ANOMALY';
          contributingFactors.push(`Unsupervised statistical anomaly confirmed by ML detector (score: ${mlScore.toFixed(3)}).`);
          uncertaintyNotes.push('Statistical deviation flagged without matching deterministic rule findings; non-actionable for autonomous deception diversion.');
        }
      }
      // Step 6: Default Normal
      else {
        assessmentLabel = ASSESSMENT_LABELS.NORMAL;
        riskScore = 0.08;
        confidenceScore = 0.95;
        classification = 'BENIGN_BASELINE';
      }
    }

    // Apply correlation confidence discount
    if (sessionContext?.correlationConfidence !== undefined && sessionContext.correlationConfidence < 0.70) {
      confidenceScore = Math.min(confidenceScore, sessionContext.correlationConfidence);
      uncertaintyNotes.push(`Low session correlation confidence (${sessionContext.correlationConfidence}); deception diversion suppressed.`);
    }

    // Apply rule missing-data discount
    if (ruleResult?.hasMissingTelemetry === true) {
      uncertaintyNotes.push('Telemetry fields were missing during rule evaluation; findings are qualified with reduced confidence.');
      confidenceScore = Math.min(confidenceScore, 0.65);
    }

    // Apply collision risk discount to final confidence score
    if (sessionContext?.collisionRisk?.level === 'HIGH') {
      uncertaintyNotes.push('Session handle derived from unverified client header; collision risk is HIGH. Autonomous deception diversion prohibited.');
      confidenceScore = Math.min(confidenceScore, 0.50);
    }

    // Decision-Safety Gate: Determine deception diversion eligibility
    // In accordance with Stage 4C.3 Decision Safety:
    // - Unsupervised ML anomaly alone is NEVER eligible for deception diversion
    // - High collision risk (NAT/proxy) suppresses deception to protect co-located benign users
    // - Degraded telemetry / INSUFFICIENT_EVIDENCE suppresses deception
    // - NORMAL traffic is never eligible
    // - Low correlation confidence (< 0.70) suppresses deception
    // - Ground truth / pattern ambiguity suppresses deception
    // - Solitary MEDIUM rules (e.g. repeated 404 dead link probe) do not authorize deception
    const hasHighOrCriticalRule = hasCriticalRule || highRulesCount >= 1;
    const isCorroboratedAdversarial = (
      (assessmentLabel === ASSESSMENT_LABELS.HIGHLY_SUSPICIOUS ||
       (assessmentLabel === ASSESSMENT_LABELS.SUSPICIOUS && hasHighOrCriticalRule)) &&
      (ruleResult?.triggeredCount || 0) > 0 &&
      classification !== 'UNSUPERVISED_BEHAVIORAL_ANOMALY' &&
      !classification.includes('UNVERIFIED') &&
      !classification.includes('ENVIRONMENTAL')
    );

    const deceptionEligible = Boolean(
      isCorroboratedAdversarial &&
      !telemetryLossDetected &&
      assessmentLabel !== ASSESSMENT_LABELS.INSUFFICIENT_EVIDENCE &&
      sessionContext?.collisionRisk?.level !== 'HIGH' &&
      (sessionContext?.correlationConfidence === undefined || sessionContext.correlationConfidence >= 0.70) &&
      confidenceScore >= 0.70
    );

    const explanationText = `${assessmentLabel}: ${classification} (Risk: ${riskScore !== null ? (riskScore * 100).toFixed(0) + '%' : 'N/A'}, Strategy: ${fusionStrategy}).`;
    const explanation = {
      text: explanationText,
      uncertaintyNotes,
      contributingFactors,
      toString() { return explanationText; },
      includes(str) { return explanationText.includes(str); }
    };

    return {
      id: crypto.randomUUID(),
      tenantId,
      applicationId,
      observationId,
      sessionRef: sessionRef || sessionContext?.sessionRef || featureSet?.sessionRef || null,
      assessmentLabel,
      classification,
      riskScore,
      confidenceScore,
      fusionStrategy,
      deceptionEligible,
      evaluatedAt: new Date().toISOString(),
      ruleFindings: ruleResult?.allFindings || [],
      triggeredRulesCount: ruleResult?.triggeredCount || 0,
      mlResult: {
        modelStatus: mlResult?.modelStatus || 'ACTIVE',
        algorithm: mlResult?.algorithm || 'ISOLATION_FOREST',
        anomalyScore: mlResult?.anomalyScore !== undefined ? mlResult.anomalyScore : null,
        decisionThreshold: mlResult?.decisionThreshold ?? 0.60,
        isAnomaly: isMlAnomaly,
        contributingFeatures: mlResult?.contributingFeatures || [],
        distributionShift: mlResult?.distributionShift || null
      },
      qualityAssessment: {
        completenessStatus: qualityMetadata.completenessStatus || 'COMPLETE',
        telemetryLossDetected,
        observationCount
      },
      uncertaintyNotes,
      contributingFactors,
      executionEvidenceStatus: 'MISSING', // Stage 4C invariant: countermeasure execution is never claimed
      explanation
    };
  }

  /**
   * Persists the evaluated assessment to PostgreSQL if Prisma is available.
   */
  async createAndPersistAssessment(params) {
    const assessment = this.evaluateAssessment(params);

    if (this.prisma && params.tenantId) {
      try {
        const created = await this.prisma.behavioralAssessment.create({
          data: {
            id: assessment.id,
            tenantId: params.tenantId,
            applicationId: params.applicationId,
            sessionRef: assessment.sessionRef,
            observationId: params.observationId,
            assessmentLabel: assessment.assessmentLabel,
            classification: assessment.classification,
            riskScore: assessment.riskScore !== null ? assessment.riskScore : 0.0,
            confidenceScore: assessment.confidenceScore,
            modelOrRuleVersion: `hybrid-${assessment.fusionStrategy.toLowerCase()}`,
            ruleFindings: assessment.ruleFindings,
            mlAnomalyResult: assessment.mlResult,
            explanation: {
              text: typeof assessment.explanation === 'string' ? assessment.explanation : assessment.explanation.text,
              uncertaintyNotes: assessment.uncertaintyNotes,
              contributingFactors: assessment.contributingFactors
            },
            dataQualityState: assessment.qualityAssessment.completenessStatus,
            telemetryLossDetected: assessment.qualityAssessment.telemetryLossDetected,
            assessedAt: new Date(),
            windowLabel: params.featureSet?.windowLabel || '5m'
          }
        });
        return created;
      } catch (dbErr) {
        logger.error('Failed to persist behavioral assessment to database', { error: dbErr.message, stack: dbErr.stack });
        throw dbErr;
      }
    }

    return assessment;
  }
}
