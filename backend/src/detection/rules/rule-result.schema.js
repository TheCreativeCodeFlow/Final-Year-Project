/**
 * Rule Evaluation Result Schema and Types (Stage 4C)
 *
 * Defines standardized, explainable finding structures emitted by deterministic rules.
 */

export const RULE_SEVERITY = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
});

/**
 * Creates a structured rule evaluation finding.
 *
 * @param {object} params
 * @param {string} params.ruleId
 * @param {string} params.ruleName
 * @param {number} [params.version=1]
 * @param {boolean} params.triggered
 * @param {string} [params.severity='MEDIUM']
 * @param {number} [params.confidence=0.8]
 * @param {string} params.timeWindow
 * @param {string[]} [params.matchedConditions=[]]
 * @param {object} [params.evidence={}]
 * @param {string[]} [params.uncertaintyNotes=[]]
 * @param {string} params.explanation
 * @returns {object}
 */
export function createRuleFinding({
  ruleId,
  ruleName,
  version = 1,
  triggered = false,
  severity = RULE_SEVERITY.MEDIUM,
  confidence = 0.8,
  timeWindow = '5m',
  matchedConditions = [],
  evidence = {},
  uncertaintyNotes = [],
  explanation = ''
}) {
  return Object.freeze({
    ruleId,
    ruleName,
    version,
    triggered: Boolean(triggered),
    severity: triggered ? severity : RULE_SEVERITY.LOW,
    confidence: Number(Math.max(0.0, Math.min(1.0, confidence)).toFixed(2)),
    timeWindow,
    matchedConditions: Array.isArray(matchedConditions) ? matchedConditions : [],
    evidence: evidence && typeof evidence === 'object' ? evidence : {},
    uncertaintyNotes: Array.isArray(uncertaintyNotes) ? uncertaintyNotes : [],
    explanation: String(explanation || ''),
    evaluatedAt: new Date().toISOString()
  });
}
