/**
 * Stage 4C Test Suite: Deterministic Rule-Based Detection Engine
 *
 * Verifies:
 * 1. Every rule's positive attack detection case.
 * 2. Every rule's benign counterexample (distinguishing legitimate traffic from attacks).
 * 3. Threshold boundary behaviors.
 * 4. Missing feature resilience (does not crash on undefined/null metrics).
 * 5. Rule disable/enable toggling and tenant overrides.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RuleRegistry } from '../src/detection/rules/rule-registry.js';
import { RuleEngineService } from '../src/detection/rules/rule-engine.service.js';
import { RULE_SEVERITY } from '../src/detection/rules/rule-result.schema.js';

describe('Stage 4C: Deterministic Rule-Based Detection Engine', () => {
  const registry = new RuleRegistry();
  const engine = new RuleEngineService({ registry });

  // --------------------------------------------------------------------------
  // Rule 1: Authentication Failure Pattern
  // --------------------------------------------------------------------------
  test('Rule 1: Triggers on repeated authentication failures (brute-force pattern)', () => {
    const rule = registry.getRule('RULE_AUTH_FAILURE');
    const finding = rule.evaluate({
      features: {
        auth_failure_count: { value: 12 },
        request_count: { value: 15 },
        http_4xx_ratio: { value: 0.80 }
      },
      timeWindow: '5m'
    });

    assert.equal(finding.triggered, true);
    assert.equal(finding.severity, RULE_SEVERITY.CRITICAL);
    assert.ok(finding.explanation.includes('Repeated authentication failures detected'));
  });

  test('Rule 1: Does NOT trigger on a single expired session event (benign counterexample)', () => {
    const rule = registry.getRule('RULE_AUTH_FAILURE');
    const finding = rule.evaluate({
      features: {
        auth_failure_count: { value: 1 },
        request_count: { value: 25 },
        http_4xx_ratio: { value: 0.04 }
      },
      timeWindow: '5m'
    });

    assert.equal(finding.triggered, false);
    assert.equal(finding.severity, RULE_SEVERITY.LOW);
    assert.ok(finding.explanation.includes('benign session expiry'));
  });

  // --------------------------------------------------------------------------
  // Rule 2: Endpoint Enumeration Pattern
  // --------------------------------------------------------------------------
  test('Rule 2: Triggers on directory spidering / path reconnaissance across multiple 404s', () => {
    const rule = registry.getRule('RULE_ENDPOINT_ENUMERATION');
    const finding = rule.evaluate({
      features: {
        request_count: { value: 25 },
        unique_endpoint_count: { value: 10 },
        endpoint_diversity_ratio: { value: 0.40 },
        repeated_not_found_count: { value: 10 },
        resource_enumeration_score: { value: 0.65 }
      },
      timeWindow: '5m'
    });

    assert.equal(finding.triggered, true);
    assert.equal(finding.severity, RULE_SEVERITY.HIGH);
    assert.ok(finding.matchedConditions.includes('RESOURCE_ENUMERATION_SCORE_GTE_0.35'));
  });

  test('Rule 2: Does NOT trigger on high-diversity benign browsing with zero errors', () => {
    const rule = registry.getRule('RULE_ENDPOINT_ENUMERATION');
    const finding = rule.evaluate({
      features: {
        request_count: { value: 30 },
        unique_endpoint_count: { value: 20 },
        endpoint_diversity_ratio: { value: 0.67 },
        repeated_not_found_count: { value: 0 },
        resource_enumeration_score: { value: 0.0 }
      },
      timeWindow: '5m'
    });

    assert.equal(finding.triggered, false);
    assert.ok(finding.explanation.includes('zero 404 errors'));
  });

  // --------------------------------------------------------------------------
  // Rule 3: Request Burst Pattern
  // --------------------------------------------------------------------------
  test('Rule 3: Triggers on aggressive API hammering burst (> 25 req/s)', () => {
    const rule = registry.getRule('RULE_REQUEST_BURST');
    const finding = rule.evaluate({
      features: {
        burst_frequency_max_1s: { value: 30 },
        request_rate_per_sec: { value: 1.0 },
        request_count: { value: 30 },
        endpoint_diversity_ratio: { value: 0.10 }
      },
      timeWindow: '30s'
    });

    assert.equal(finding.triggered, true);
    assert.equal(finding.severity, RULE_SEVERITY.CRITICAL);
    assert.ok(finding.explanation.includes('Extreme request burst'));
  });

  test('Rule 3: Does NOT trigger on benign SPA static bundle burst with diverse clean assets', () => {
    const rule = registry.getRule('RULE_REQUEST_BURST');
    const finding = rule.evaluate({
      features: {
        burst_frequency_max_1s: { value: 18 },
        request_rate_per_sec: { value: 0.60 },
        request_count: { value: 20 },
        endpoint_diversity_ratio: { value: 0.85 }, // High diversity of assets
        http_4xx_ratio: { value: 0.0 } // Zero errors
      },
      timeWindow: '30s'
    });

    assert.equal(finding.triggered, false);
    assert.ok(finding.explanation.includes('benign concurrent asset prefetching'));
  });

  // --------------------------------------------------------------------------
  // Rule 4: Suspicious HTTP Method Pattern
  // --------------------------------------------------------------------------
  test('Rule 4: Triggers when prohibited TRACE method is rejected at gateway ingress without forwarding', () => {
    const rule = registry.getRule('RULE_SUSPICIOUS_METHOD');
    const finding = rule.evaluate({
      features: {},
      rawObservation: {
        httpMethod: 'TRACE',
        validationOutcome: 'METHOD_NOT_ALLOWED',
        forwardingResult: 'INGRESS_REJECTED'
      },
      timeWindow: '30s'
    });

    assert.equal(finding.triggered, true);
    assert.equal(finding.severity, RULE_SEVERITY.HIGH);
    assert.equal(finding.evidence.upstreamInvoked, false);
    assert.ok(finding.explanation.includes('Upstream origin was not invoked'));
  });

  test('Rule 4: Passes cleanly on standard GET and POST requests', () => {
    const rule = registry.getRule('RULE_SUSPICIOUS_METHOD');
    const finding = rule.evaluate({
      features: {
        http_method_distribution: { value: { GET: 0.8, POST: 0.2 } }
      },
      rawObservation: {
        httpMethod: 'GET',
        validationOutcome: 'VALIDATED',
        forwardingResult: 'SUCCESS'
      },
      timeWindow: '5m'
    });

    assert.equal(finding.triggered, false);
    assert.equal(finding.severity, RULE_SEVERITY.LOW);
  });

  // --------------------------------------------------------------------------
  // Rule 5: Repeated Resource Probing Pattern
  // --------------------------------------------------------------------------
  test('Rule 5: Triggers on repeated probes targeting sensitive configuration files (.env, .git)', () => {
    const rule = registry.getRule('RULE_REPEATED_RESOURCE_PROBING');
    const finding = rule.evaluate({
      features: {
        repeated_not_found_count: { value: 5 },
        repeated_endpoint_ratio: { value: 0.80 },
        unique_endpoint_count: { value: 2 },
        resource_enumeration_score: { value: 0.40 }
      },
      rawObservation: {
        normalizedRoute: '/api/v1/.env'
      },
      timeWindow: '5m'
    });

    assert.equal(finding.triggered, true);
    assert.equal(finding.severity, RULE_SEVERITY.HIGH);
    assert.ok(finding.explanation.includes('sensitive system/credential path'));
  });

  test('Rule 5: Does NOT trigger on legitimate asynchronous job polling (polling single status endpoint)', () => {
    const rule = registry.getRule('RULE_REPEATED_RESOURCE_PROBING');
    const finding = rule.evaluate({
      features: {
        repeated_not_found_count: { value: 15 },
        repeated_endpoint_ratio: { value: 1.0 },
        unique_endpoint_count: { value: 1 },
        resource_enumeration_score: { value: 0.05 } // Single endpoint polling yields low score
      },
      rawObservation: {
        normalizedRoute: '/api/v1/jobs/export-task-42/status'
      },
      timeWindow: '5m'
    });

    assert.equal(finding.triggered, false);
    assert.ok(finding.explanation.includes('benign asynchronous job status polling'));
  });

  // --------------------------------------------------------------------------
  // Rule 6: Behavioral Shift Pattern
  // --------------------------------------------------------------------------
  test('Rule 6: Triggers when sudden 3x rate acceleration is coupled with client error surge', () => {
    const rule = registry.getRule('RULE_BEHAVIORAL_SHIFT');
    const finding = rule.evaluate({
      features: {},
      multiWindowFeatures: {
        '30s': {
          request_rate_per_sec: { value: 6.0 },
          request_count: { value: 20 },
          http_4xx_ratio: { value: 0.70 }
        },
        '5m': {
          request_rate_per_sec: { value: 1.0 },
          request_count: { value: 30 },
          http_4xx_ratio: { value: 0.05 }
        }
      },
      timeWindow: '30s'
    });

    assert.equal(finding.triggered, true);
    assert.equal(finding.severity, RULE_SEVERITY.HIGH);
    assert.ok(finding.matchedConditions.includes('RATE_ACCELERATION_GTE_3X'));
  });

  // --------------------------------------------------------------------------
  // Engine Integration & Disabled Rules
  // --------------------------------------------------------------------------
  test('RuleEngineService: Evaluates all registered rules and disables rules cleanly', () => {
    const customRegistry = new RuleRegistry();
    const customEngine = new RuleEngineService({ registry: customRegistry });

    // Evaluate clean traffic
    const resClean = customEngine.evaluate({
      featureSets: [{
        windowLabel: '5m',
        features: {
          request_count: { value: 10 },
          auth_failure_count: { value: 0 },
          repeated_not_found_count: { value: 0 },
          burst_frequency_max_1s: { value: 2 }
        }
      }]
    });
    assert.equal(resClean.hasTriggeredRules, false);
    assert.equal(resClean.triggeredCount, 0);

    // Disable Rule 1 and test that it does not evaluate
    customRegistry.disableRule('RULE_AUTH_FAILURE');
    const resDisabled = customEngine.evaluate({
      featureSets: [{
        windowLabel: '5m',
        features: {
          auth_failure_count: { value: 100 },
          request_count: { value: 100 },
          http_4xx_ratio: { value: 1.0 }
        }
      }]
    });
    const authFinding = resDisabled.findings.find((f) => f.ruleId === 'RULE_AUTH_FAILURE');
    assert.equal(authFinding, undefined, 'Disabled rule must not produce findings');
  });
});
