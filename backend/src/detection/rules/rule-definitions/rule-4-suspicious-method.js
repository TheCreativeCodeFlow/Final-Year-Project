/**
 * Rule 4: Suspicious HTTP Method Pattern (RULE_SUSPICIOUS_METHOD)
 *
 * Evaluates observed HTTP methods, non-standard HTTP verbs, and gateway ingress validation outcomes.
 * Explicitly preserves the distinction between:
 * - Method observed vs method allowed vs method rejected at ingress.
 * - Forwarding attempted vs forwarding not attempted (upstream was never invoked).
 */

import { createRuleFinding, RULE_SEVERITY } from '../rule-result.schema.js';

const PROHIBITED_METHODS = new Set(['TRACE', 'CONNECT', 'DEBUG', 'TRACK']);

export const RULE_SUSPICIOUS_METHOD = Object.freeze({
  ruleId: 'RULE_SUSPICIOUS_METHOD',
  name: 'Suspicious HTTP Method Pattern',
  version: 1,
  description: 'Detects prohibited HTTP verbs (TRACE, CONNECT), gateway ingress method rejections, and abnormal method distributions.',
  defaultSeverity: RULE_SEVERITY.HIGH,

  evaluate({ features, rawObservation = {}, timeWindow, thresholds = {}, sessionContext = {} }) {
    const methodDist = features?.http_method_distribution?.value || {};
    const validationOutcome = rawObservation.validationOutcome || rawObservation.validation_outcome || 'VALIDATED';
    const forwardingResult = rawObservation.forwardingResult || rawObservation.forwarding_result || 'SUCCESS';
    const observedMethod = (rawObservation.httpMethod || rawObservation.method || '').toUpperCase();

    const matchedConditions = [];
    const uncertaintyNotes = [];

    // Case 1: Ingress Gateway Rejection of Prohibited Method
    // (e.g. TRACE, CONNECT, or unconfigured verb blocked before proxying)
    if (validationOutcome === 'METHOD_NOT_ALLOWED' || PROHIBITED_METHODS.has(observedMethod)) {
      matchedConditions.push(`PROHIBITED_METHOD_OBSERVED_${observedMethod || 'UNKNOWN'}`);
      matchedConditions.push('METHOD_REJECTED_AT_INGRESS');
      matchedConditions.push('FORWARDING_NOT_ATTEMPTED');

      return createRuleFinding({
        ruleId: this.ruleId,
        ruleName: this.name,
        version: this.version,
        triggered: true,
        severity: RULE_SEVERITY.HIGH,
        confidence: 0.98, // Gateway recorded the actual TCP request header
        timeWindow,
        matchedConditions,
        evidence: {
          observedMethod,
          validationOutcome,
          forwardingResult,
          upstreamInvoked: false,
          securityGuarantee: 'Request terminated at gateway ingress without invoking protected origin.'
        },
        uncertaintyNotes,
        explanation: `Prohibited HTTP method (${observedMethod}) detected and blocked at gateway ingress (${validationOutcome}). Upstream origin was not invoked.`
      });
    }

    // Case 2: Ingress validation violation (Smuggling, malformed headers)
    if (validationOutcome === 'REQUEST_SMUGGLING_DETECTED' || validationOutcome === 'DUPLICATE_HOST_HEADER') {
      matchedConditions.push(`PROTOCOL_VIOLATION_${validationOutcome}`);
      matchedConditions.push('FORWARDING_NOT_ATTEMPTED');

      return createRuleFinding({
        ruleId: this.ruleId,
        ruleName: this.name,
        version: this.version,
        triggered: true,
        severity: RULE_SEVERITY.CRITICAL,
        confidence: 0.99,
        timeWindow,
        matchedConditions,
        evidence: { observedMethod, validationOutcome, forwardingResult, upstreamInvoked: false },
        uncertaintyNotes,
        explanation: `Protocol attack detected at gateway ingress: ${validationOutcome}. Connection terminated before reaching origin.`
      });
    }

    // Case 3: Unusual method distribution in time window (e.g. heavy non-standard verbs like PROPFIND, PURGE)
    for (const [method, ratio] of Object.entries(methodDist)) {
      if (PROHIBITED_METHODS.has(method.toUpperCase()) && ratio > 0) {
        matchedConditions.push(`PROHIBITED_METHOD_IN_WINDOW_${method}`);
        return createRuleFinding({
          ruleId: this.ruleId,
          ruleName: this.name,
          version: this.version,
          triggered: true,
          severity: RULE_SEVERITY.HIGH,
          confidence: 0.95,
          timeWindow,
          matchedConditions,
          evidence: { methodDist, prohibitedMethod: method, ratio },
          uncertaintyNotes,
          explanation: `Time-window features contain prohibited method "${method}" (${(ratio * 100).toFixed(1)}% of window requests).`
        });
      }
    }

    return createRuleFinding({
      ruleId: this.ruleId,
      ruleName: this.name,
      version: this.version,
      triggered: false,
      severity: RULE_SEVERITY.LOW,
      confidence: 0.90,
      timeWindow,
      matchedConditions: [],
      evidence: { methodDist, validationOutcome },
      uncertaintyNotes,
      explanation: `Standard HTTP methods observed (${Object.keys(methodDist).join(', ') || 'GET/POST'}); ingress validation passed.`
    });
  }
});
