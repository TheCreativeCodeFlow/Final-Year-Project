/**
 * Rule Registry Service (Stage 4C)
 *
 * Maintains the catalogue of deterministic detection rules, versioning,
 * default thresholds, and tenant/application overrides.
 */

import { RULE_AUTH_FAILURE } from './rule-definitions/rule-1-auth-failure.js';
import { RULE_ENDPOINT_ENUMERATION } from './rule-definitions/rule-2-endpoint-enumeration.js';
import { RULE_REQUEST_BURST } from './rule-definitions/rule-3-request-burst.js';
import { RULE_SUSPICIOUS_METHOD } from './rule-definitions/rule-4-suspicious-method.js';
import { RULE_REPEATED_RESOURCE_PROBING } from './rule-definitions/rule-5-repeated-resource-probing.js';
import { RULE_BEHAVIORAL_SHIFT } from './rule-definitions/rule-6-behavioral-shift.js';

export class RuleRegistry {
  constructor() {
    this.rules = new Map();
    this.disabledRules = new Set();
    this.thresholdOverrides = new Map(); // key: `${tenantId || 'global'}:${ruleId}`

    // Register 6 default core rules
    this.registerRule(RULE_AUTH_FAILURE);
    this.registerRule(RULE_ENDPOINT_ENUMERATION);
    this.registerRule(RULE_REQUEST_BURST);
    this.registerRule(RULE_SUSPICIOUS_METHOD);
    this.registerRule(RULE_REPEATED_RESOURCE_PROBING);
    this.registerRule(RULE_BEHAVIORAL_SHIFT);
  }

  /**
   * Registers a rule definition.
   * @param {object} ruleDefinition
   */
  registerRule(ruleDefinition) {
    if (!ruleDefinition || !ruleDefinition.ruleId) {
      throw new Error('Invalid rule definition: ruleId is required.');
    }
    this.rules.set(ruleDefinition.ruleId, ruleDefinition);
  }

  /**
   * Retrieves a rule definition by ID.
   * @param {string} ruleId
   * @returns {object|null}
   */
  getRule(ruleId) {
    return this.rules.get(ruleId) || null;
  }

  /**
   * Returns all registered rules with active status and configuration.
   * @param {string} [tenantId]
   * @returns {Array<object>}
   */
  listRules(tenantId = null) {
    return Array.from(this.rules.values()).map((rule) => {
      const isEnabled = !this.disabledRules.has(rule.ruleId);
      const overrideKey = `${tenantId || 'global'}:${rule.ruleId}`;
      const overrides = this.thresholdOverrides.get(overrideKey) || {};
      const effectiveThresholds = { ...(rule.defaultThresholds || {}), ...overrides };

      return {
        ruleId: rule.ruleId,
        name: rule.name,
        version: rule.version,
        description: rule.description,
        defaultSeverity: rule.defaultSeverity,
        enabled: isEnabled,
        thresholds: effectiveThresholds
      };
    });
  }

  /**
   * Disables a specific rule.
   * @param {string} ruleId
   */
  disableRule(ruleId) {
    this.disabledRules.add(ruleId);
  }

  /**
   * Enables a specific rule.
   * @param {string} ruleId
   */
  enableRule(ruleId) {
    this.disabledRules.delete(ruleId);
  }

  /**
   * Configures custom threshold overrides for a tenant/app.
   * @param {string} ruleId
   * @param {object} thresholds
   * @param {string} [tenantId='global']
   */
  setThresholdOverrides(ruleId, thresholds, tenantId = 'global') {
    const key = `${tenantId}:${ruleId}`;
    this.thresholdOverrides.set(key, thresholds);
  }

  /**
   * Resolves effective thresholds for a rule under a tenant context.
   * @param {string} ruleId
   * @param {string} [tenantId]
   * @returns {object}
   */
  getEffectiveThresholds(ruleId, tenantId = null) {
    const rule = this.rules.get(ruleId);
    if (!rule) return {};
    const globalOverride = this.thresholdOverrides.get(`global:${ruleId}`) || {};
    const tenantOverride = tenantId ? (this.thresholdOverrides.get(`${tenantId}:${ruleId}`) || {}) : {};
    return { ...(rule.defaultThresholds || {}), ...globalOverride, ...tenantOverride };
  }
}
