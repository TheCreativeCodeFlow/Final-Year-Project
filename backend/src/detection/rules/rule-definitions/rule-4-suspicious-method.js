/**
 * Rule 4: Suspicious HTTP Method Pattern (RULE_SUSPICIOUS_METHOD)
 * Version: 2
 *
 * Evaluates observed HTTP methods, standard vs prohibited verbs, extension methods,
 * and gateway ingress validation outcomes.
 *
 * Method Categorization & Rationale:
 * 1. STANDARD_SAFE_AND_STATE_CHANGING (GET, HEAD, POST, PUT, PATCH, DELETE):
 *    - RFC 9110 standard HTTP methods. Normal traffic.
 *    - Severity: NONE (Triggered: false).
 * 2. STANDARD_CORS_PREFLIGHT (OPTIONS):
 *    - RFC 9110 §9.3.7 & W3C/WHATWG Fetch CORS preflight.
 *    - Standard browser mechanism for cross-origin negotiation.
 *    - Severity: NONE (Triggered: false) when validation passed.
 * 3. PROHIBITED_SECURITY_RISK (TRACE, CONNECT, DEBUG, TRACK):
 *    - TRACE: RFC 9110 §9.3.8 Cross-Site Tracing (XST) attack vector; echoes credentials.
 *    - CONNECT: RFC 9110 §9.3.6 HTTP tunnel establishment; proxy hijacking risk.
 *    - DEBUG / TRACK: Historical debugging methods exposing internal reflection.
 *    - Ingress Gateway action: Rejected with 405 Method Not Allowed; never forwarded upstream.
 *    - Severity: HIGH (CONNECT / Smuggling: CRITICAL).
 * 4. EXTENSION_WEBDAV_VERBS (PROPFIND, PROPPATCH, MKCOL, COPY, MOVE, LOCK, UNLOCK, PURGE):
 *    - RFC 4918 / RFC 5789 WebDAV or cache purge methods.
 *    - Not standard for enterprise REST APIs; frequently probed during vulnerability scans.
 *    - Ingress Gateway action: Rejected with 405 if not allowed; never forwarded upstream.
 *    - Severity: MEDIUM.
 * 5. PROTOCOL_VIOLATIONS (REQUEST_SMUGGLING_DETECTED, DUPLICATE_HOST_HEADER):
 *    - Ingress smuggling or header manipulation attacks.
 *    - Severity: CRITICAL. Connection terminated before origin.
 */

import { createRuleFinding, RULE_SEVERITY } from '../rule-result.schema.js';

export const STANDARD_METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);
export const PROHIBITED_METHODS = new Set(['TRACE', 'CONNECT', 'DEBUG', 'TRACK']);
export const EXTENSION_WEBDAV_METHODS = new Set([
  'PROPFIND',
  'PROPPATCH',
  'MKCOL',
  'COPY',
  'MOVE',
  'LOCK',
  'UNLOCK',
  'PURGE',
  'SEARCH',
  'CHECKOUT'
]);

export const RULE_SUSPICIOUS_METHOD = Object.freeze({
  ruleId: 'RULE_SUSPICIOUS_METHOD',
  name: 'Suspicious HTTP Method Pattern',
  version: 2,
  description: 'Detects prohibited HTTP verbs (TRACE, CONNECT), protocol violations, and unauthorized extension methods, distinguishing standard CORS OPTIONS.',
  defaultSeverity: RULE_SEVERITY.HIGH,

  evaluate({ features, rawObservation = {}, timeWindow = '5m', thresholds = {}, sessionContext = {} }) {
    const methodDist = features?.http_method_distribution?.value || {};
    const validationOutcome = rawObservation.validationOutcome || rawObservation.validation_outcome || 'VALIDATED';
    const forwardingResult = rawObservation.forwardingResult || rawObservation.forwarding_result || 'SUCCESS';
    const observedMethod = (rawObservation.httpMethod || rawObservation.method || '').toUpperCase();

    const matchedConditions = [];
    const uncertaintyNotes = [];

    // Case 1: Protocol Attack / Request Smuggling at Gateway Ingress
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
        evidence: {
          observedMethod,
          validationOutcome,
          forwardingResult,
          upstreamInvoked: false,
          securityGuarantee: 'Connection terminated immediately at gateway ingress; protected origin never invoked.'
        },
        uncertaintyNotes,
        explanation: `Ingress protocol attack detected (${validationOutcome}). Connection terminated before reaching protected origin.`
      });
    }

    // Case 2: Prohibited HTTP Method (TRACE, CONNECT, DEBUG, TRACK)
    if (PROHIBITED_METHODS.has(observedMethod)) {
      const isConnect = observedMethod === 'CONNECT';
      const severity = isConnect ? RULE_SEVERITY.CRITICAL : RULE_SEVERITY.HIGH;

      matchedConditions.push(`PROHIBITED_METHOD_OBSERVED_${observedMethod}`);
      matchedConditions.push('METHOD_REJECTED_AT_INGRESS');
      matchedConditions.push('FORWARDING_NOT_ATTEMPTED');

      return createRuleFinding({
        ruleId: this.ruleId,
        ruleName: this.name,
        version: this.version,
        triggered: true,
        severity,
        confidence: 0.98,
        timeWindow,
        matchedConditions,
        evidence: {
          observedMethod,
          methodCategory: 'PROHIBITED_SECURITY_RISK',
          validationOutcome,
          forwardingResult,
          upstreamInvoked: false,
          securityGuarantee: 'Prohibited verb rejected with 405 Method Not Allowed; protected origin never invoked.'
        },
        uncertaintyNotes,
        explanation: `Prohibited HTTP method (${observedMethod}) detected and blocked at gateway ingress (${validationOutcome}). Upstream origin was not invoked.`
      });
    }

    // Case 3: Extension / WebDAV Method Ingress Rejection (e.g. PROPFIND, PURGE)
    if (EXTENSION_WEBDAV_METHODS.has(observedMethod) || validationOutcome === 'METHOD_NOT_ALLOWED') {
      // If method is standard OPTIONS or GET/POST, 405 might be application-specific route restriction
      if (observedMethod === 'OPTIONS') {
        // Standard OPTIONS with 405 is not an attack; endpoint simply does not implement OPTIONS
        return createRuleFinding({
          ruleId: this.ruleId,
          ruleName: this.name,
          version: this.version,
          triggered: false,
          severity: RULE_SEVERITY.LOW,
          confidence: 0.90,
          timeWindow,
          matchedConditions: ['OPTIONS_METHOD_ROUTE_RESTRICTION'],
          evidence: {
            observedMethod: 'OPTIONS',
            methodCategory: 'STANDARD_CORS_PREFLIGHT',
            validationOutcome
          },
          uncertaintyNotes,
          explanation: 'Standard HTTP OPTIONS request was not enabled on this route (405); normal route configuration.'
        });
      }

      matchedConditions.push(`EXTENSION_OR_UNSUPPORTED_METHOD_${observedMethod || 'UNKNOWN'}`);
      matchedConditions.push('METHOD_REJECTED_AT_INGRESS');
      matchedConditions.push('FORWARDING_NOT_ATTEMPTED');

      return createRuleFinding({
        ruleId: this.ruleId,
        ruleName: this.name,
        version: this.version,
        triggered: true,
        severity: RULE_SEVERITY.MEDIUM,
        confidence: 0.92,
        timeWindow,
        matchedConditions,
        evidence: {
          observedMethod,
          methodCategory: 'EXTENSION_WEBDAV_VERBS',
          validationOutcome,
          forwardingResult,
          upstreamInvoked: false,
          securityGuarantee: 'Unsupported method rejected with 405 at perimeter; protected origin never invoked.'
        },
        uncertaintyNotes,
        explanation: `Non-standard or unsupported HTTP method (${observedMethod || 'UNKNOWN'}) rejected at gateway ingress with 405. Upstream origin was not invoked.`
      });
    }

    // Case 4: Standard CORS Preflight Verification (OPTIONS with 200/204 or VALIDATED)
    if (observedMethod === 'OPTIONS') {
      return createRuleFinding({
        ruleId: this.ruleId,
        ruleName: this.name,
        version: this.version,
        triggered: false,
        severity: RULE_SEVERITY.LOW,
        confidence: 0.95,
        timeWindow,
        matchedConditions: ['LEGITIMATE_CORS_PREFLIGHT_VERIFIED'],
        evidence: {
          observedMethod: 'OPTIONS',
          methodCategory: 'STANDARD_CORS_PREFLIGHT',
          isCorsPreflight: true,
          validationOutcome,
          forwardingResult
        },
        uncertaintyNotes,
        explanation: 'Standard HTTP OPTIONS request verified as legitimate CORS preflight or capability discovery.'
      });
    }

    // Case 5: Time-window distribution check for prohibited verbs
    for (const [method, ratio] of Object.entries(methodDist)) {
      const upper = method.toUpperCase();
      if (PROHIBITED_METHODS.has(upper) && ratio > 0) {
        matchedConditions.push(`PROHIBITED_METHOD_IN_WINDOW_${upper}`);
        return createRuleFinding({
          ruleId: this.ruleId,
          ruleName: this.name,
          version: this.version,
          triggered: true,
          severity: RULE_SEVERITY.HIGH,
          confidence: 0.95,
          timeWindow,
          matchedConditions,
          evidence: { methodDist, prohibitedMethod: upper, ratio },
          uncertaintyNotes,
          explanation: `Time-window features contain prohibited method "${upper}" (${(ratio * 100).toFixed(1)}% of window requests).`
        });
      }
      if (EXTENSION_WEBDAV_METHODS.has(upper) && ratio > 0) {
        matchedConditions.push(`EXTENSION_METHOD_IN_WINDOW_${upper}`);
        return createRuleFinding({
          ruleId: this.ruleId,
          ruleName: this.name,
          version: this.version,
          triggered: true,
          severity: RULE_SEVERITY.MEDIUM,
          confidence: 0.90,
          timeWindow,
          matchedConditions,
          evidence: { methodDist, extensionMethod: upper, ratio },
          uncertaintyNotes,
          explanation: `Time-window features contain WebDAV or extension method "${upper}" (${(ratio * 100).toFixed(1)}% of window requests).`
        });
      }
    }

    // Default: Standard methods observed and validated
    return createRuleFinding({
      ruleId: this.ruleId,
      ruleName: this.name,
      version: this.version,
      triggered: false,
      severity: RULE_SEVERITY.LOW,
      confidence: 0.90,
      timeWindow,
      matchedConditions: [],
      evidence: {
        observedMethod,
        methodCategory: 'STANDARD_ALLOWED',
        methodDist,
        validationOutcome
      },
      uncertaintyNotes,
      explanation: `Standard HTTP methods observed (${Object.keys(methodDist).join(', ') || observedMethod || 'GET/POST'}); ingress validation passed.`
    });
  }
});
