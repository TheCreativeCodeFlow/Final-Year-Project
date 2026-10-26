import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Shield,
  Layers,
  Info,
  XCircle,
  HelpCircle,
  AlertCircle
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import {
  getDeceptionPolicyById,
  saveDeceptionPolicy,
  getTenants,
  getDeceptionEnvironments,
  validateDeceptionPolicy,
  DEMO_DATA_DISCLAIMER
} from '../../services/mockData';

const CATEGORY_OPTIONS = [
  { value: 'suspicious_activity_handling', label: 'Suspicious Activity Handling' },
  { value: 'deception_routing_eligibility', label: 'Deception Routing Eligibility' },
  { value: 'synthetic_asset_modification', label: 'Synthetic Asset Modification' },
  { value: 'canary_token_response', label: 'Canary-Token Response' },
  { value: 'isolation_egress_restrictions', label: 'Isolation & Egress Restrictions' },
  { value: 'session_termination', label: 'Session Termination' },
  { value: 'fail_safe_handling', label: 'Fail-Safe Handling' }
];

export default function DeceptionPolicyFormPage() {
  const { policyId } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(policyId);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tenants, setTenants] = useState([]);
  const [allEnvironments, setAllEnvironments] = useState([]);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [serverError, setServerError] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    scope: 'environment', // 'platform' | 'tenant' | 'environment'
    tenantId: '',
    tenantName: '',
    environmentId: '',
    environmentName: '',
    category: 'suspicious_activity_handling',
    priority: 25,
    status: 'Draft', // 'Draft' | 'Enabled (Simulated)' | 'Review Required' | 'Disabled'
    humanReviewRequired: false,
    owner: 'Sarah Chen (Platform Ops)',
    triggerConditionsText: '',
    requiredEvidenceText: '',
    permittedActionsText: '',
    prohibitedActionsText: '',
    safetyConstraintsText: ''
  });

  // Load existing policy if editing, plus tenants & environments
  useEffect(() => {
    setLoading(true);
    Promise.all([
      getTenants(),
      getDeceptionEnvironments(),
      isEditing ? getDeceptionPolicyById(policyId) : Promise.resolve(null)
    ]).then(([tenList, envList, existingPolicy]) => {
      setTenants(tenList);
      setAllEnvironments(envList);

      if (isEditing) {
        if (!existingPolicy) {
          setServerError(`Deception policy with ID "${policyId}" was not found.`);
          setLoading(false);
          return;
        }

        setFormData({
          name: existingPolicy.name || '',
          description: existingPolicy.description || '',
          scope: existingPolicy.scope || 'environment',
          tenantId: existingPolicy.tenantId || '',
          tenantName: existingPolicy.tenantName || '',
          environmentId: existingPolicy.environmentId || '',
          environmentName: existingPolicy.environmentName || '',
          category: existingPolicy.category || 'suspicious_activity_handling',
          priority: existingPolicy.priority ?? 25,
          status: existingPolicy.status || 'Draft',
          humanReviewRequired: Boolean(existingPolicy.humanReviewRequired),
          owner: existingPolicy.owner || 'Sarah Chen (Platform Ops)',
          triggerConditionsText: (existingPolicy.triggerConditions || []).join('\n'),
          requiredEvidenceText: (existingPolicy.requiredEvidence || []).join('\n'),
          permittedActionsText: (existingPolicy.permittedActions || []).join('\n'),
          prohibitedActionsText: (existingPolicy.prohibitedActions || []).join('\n'),
          safetyConstraintsText: (existingPolicy.safetyConstraints || []).join('\n')
        });
      } else {
        // Set default tenant and environment for new policy
        if (tenList.length > 0) {
          const firstTen = tenList[0];
          const matchedEnvs = envList.filter(e => e.tenantId === firstTen.id);
          setFormData(prev => ({
            ...prev,
            tenantId: firstTen.id,
            tenantName: firstTen.name,
            environmentId: matchedEnvs.length > 0 ? matchedEnvs[0].id : '',
            environmentName: matchedEnvs.length > 0 ? matchedEnvs[0].name : '',
            triggerConditionsText: 'Repeated authentication failures >= 25 within 60s\nAnomaly confidence score >= 0.85 from behavioral detector',
            requiredEvidenceText: 'Structured HTTP request log with client IP\nAnomaly score vector from detection engine',
            permittedActionsText: 'Divert session into dedicated synthetic sandbox container\nInject simulated exponential tarpit response delay',
            prohibitedActionsText: 'Modify real production applications or databases\nExpose real production credentials or API keys\nPermit outbound egress traffic from honeynet container',
            safetyConstraintsText: 'Tenant Isolation: Strict container namespace containment\nZero Egress: Default-deny all outbound network packets'
          }));
        }
      }

      setLoading(false);
    });
  }, [policyId, isEditing]);

  // Available environments across platform for scoping selection
  const availableEnvironments = useMemo(() => {
    return allEnvironments;
  }, [allEnvironments]);

  // Construct policy object for validation
  const currentPolicyObject = useMemo(() => {
    const parseLines = (text) =>
      text
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean);

    return {
      id: policyId || 'pol-draft',
      name: formData.name,
      description: formData.description,
      scope: formData.scope,
      tenantId: formData.scope === 'platform' ? null : formData.tenantId || null,
      tenantName: formData.scope === 'platform' ? 'Platform-Wide' : formData.tenantName,
      environmentId: formData.scope === 'environment' ? formData.environmentId || null : null,
      environmentName: formData.scope === 'environment' ? formData.environmentName : null,
      category: formData.category,
      priority: Number(formData.priority),
      status: formData.status,
      humanReviewRequired: formData.humanReviewRequired,
      owner: formData.owner,
      triggerConditions: parseLines(formData.triggerConditionsText),
      requiredEvidence: parseLines(formData.requiredEvidenceText),
      permittedActions: parseLines(formData.permittedActionsText),
      prohibitedActions: parseLines(formData.prohibitedActionsText),
      safetyConstraints: parseLines(formData.safetyConstraintsText)
    };
  }, [formData, policyId]);

  // Real-time validation computation
  const validationResult = useMemo(() => {
    return validateDeceptionPolicy(currentPolicyObject);
  }, [currentPolicyObject]);

  // Handlers
  const handleTenantChange = (e) => {
    const tId = e.target.value;
    const matchedTen = tenants.find(t => t.id === tId);
    const envsForTen = allEnvironments.filter(env => env.tenantId === tId);

    setFormData(prev => ({
      ...prev,
      tenantId: tId,
      tenantName: matchedTen ? matchedTen.name : '',
      environmentId: envsForTen.length > 0 ? envsForTen[0].id : '',
      environmentName: envsForTen.length > 0 ? envsForTen[0].name : ''
    }));
  };

  const handleEnvironmentChange = (e) => {
    const envId = e.target.value;
    const matchedEnv = allEnvironments.find(env => env.id === envId);

    setFormData(prev => ({
      ...prev,
      environmentId: envId,
      environmentName: matchedEnv ? matchedEnv.name : ''
    }));
  };

  const handleScopeChange = (e) => {
    const newScope = e.target.value;
    setFormData(prev => {
      let updated = { ...prev, scope: newScope };
      if (newScope === 'platform') {
        updated.tenantId = '';
        updated.tenantName = '';
        updated.environmentId = '';
        updated.environmentName = '';
      } else if (newScope === 'tenant') {
        if (!updated.tenantId && tenants.length > 0) {
          updated.tenantId = tenants[0].id;
          updated.tenantName = tenants[0].name;
        }
        updated.environmentId = '';
        updated.environmentName = '';
      } else if (newScope === 'environment') {
        if (!updated.tenantId && tenants.length > 0) {
          updated.tenantId = tenants[0].id;
          updated.tenantName = tenants[0].name;
        }
        const envs = allEnvironments.filter(env => env.tenantId === (updated.tenantId || tenants[0]?.id));
        if (envs.length > 0) {
          updated.environmentId = envs[0].id;
          updated.environmentName = envs[0].name;
        }
      }
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitAttempted(true);

    if (!validationResult.isValid) {
      return;
    }

    setSaving(true);
    try {
      const saved = await saveDeceptionPolicy({
        ...currentPolicyObject,
        id: isEditing ? policyId : undefined
      });
      navigate(`/admin/deception-policies/${saved.id}`);
    } catch (err) {
      console.error('Failed to save deception policy:', err);
      setServerError('An unexpected error occurred while saving the policy. Please try again.');
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading policy form configuration..." />;
  }

  if (serverError && !formData.name) {
    return (
      <div style={{ padding: '24px', maxWidth: '800px', margin: '40px auto', textAlign: 'center' }}>
        <XCircle size={48} style={{ color: 'var(--severity-critical)', marginBottom: '16px' }} />
        <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: '8px' }}>Policy Not Found</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>{serverError}</p>
        <Link to="/admin/deception-policies" className="btn btn-secondary">
          Back to Deception Policies
        </Link>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1080px', margin: '0 auto' }}>
      {/* Back Link */}
      <div style={{ marginBottom: '16px' }}>
        <Link
          to={isEditing ? `/admin/deception-policies/${policyId}` : '/admin/deception-policies'}
          className="btn btn-ghost btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <ArrowLeft size={16} /> Back to {isEditing ? 'Policy Details' : 'Policies Directory'}
        </Link>
      </div>

      {/* Page Header */}
      <PageHeader
        title={isEditing ? `Edit Deception Policy: ${formData.name || policyId}` : 'Create Deception Policy'}
        description="Define permitted synthetic actions, trigger conditions, and non-negotiable safety boundaries for gateway diversion."
      />

      {/* Demonstration Alert Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 16px',
          marginBottom: '20px',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-secondary)'
        }}
      >
        <Info size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <strong style={{ color: '#fff' }}>Simulated Policy Authoring:</strong>{' '}
          {DEMO_DATA_DISCLAIMER} Saving this policy stores it within local prototype storage. It does not reconfigure live firewall rules or activate production kernel routing.
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Section 1: Core Policy Identity */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            padding: '20px'
          }}
        >
          <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sliders size={18} style={{ color: 'var(--accent-primary)' }} />
            Core Policy Identity & Classification
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {/* Policy Name */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="policy-name" style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                Policy Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                id="policy-name"
                type="text"
                placeholder="e.g. Apex Retail Banking Authentication Tarpit & Tripwire Policy"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                style={{
                  width: '100%',
                  background: 'var(--bg-canvas)',
                  border: `1px solid ${submitAttempted && !formData.name.trim() ? '#ef4444' : 'var(--border-default)'}`,
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 12px',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--text-sm)'
                }}
              />
              {submitAttempted && !formData.name.trim() && (
                <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px' }}>
                  Policy name is required.
                </div>
              )}
            </div>

            {/* Description */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="policy-desc" style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                Description & Tactical Rationale
              </label>
              <textarea
                id="policy-desc"
                rows={3}
                placeholder="Explain what threat pattern this policy addresses and why synthetic diversion is authorized..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                style={{
                  width: '100%',
                  background: 'var(--bg-canvas)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 12px',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--text-sm)',
                  resize: 'vertical'
                }}
              />
            </div>

            {/* Scope Selection */}
            <div>
              <label htmlFor="policy-scope" style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                Enforcement Scope <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                id="policy-scope"
                value={formData.scope}
                onChange={handleScopeChange}
                style={{
                  width: '100%',
                  background: 'var(--bg-canvas)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 12px',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--text-sm)'
                }}
              >
                <option value="environment">Environment-Scoped (Single Deception Environment)</option>
                <option value="tenant">Tenant-Scoped (All Environments for Tenant)</option>
                <option value="platform">Platform-Wide (Global Gateway Infrastructure)</option>
              </select>
            </div>

            {/* Category */}
            <div>
              <label htmlFor="policy-category" style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                Policy Category <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                id="policy-category"
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                style={{
                  width: '100%',
                  background: 'var(--bg-canvas)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 12px',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--text-sm)'
                }}
              >
                {CATEGORY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Tenant Selection (if not platform-wide) */}
            {formData.scope !== 'platform' && (
              <div>
                <label htmlFor="policy-tenant" style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                  Target Tenant Organization <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  id="policy-tenant"
                  value={formData.tenantId}
                  onChange={handleTenantChange}
                  style={{
                    width: '100%',
                    background: 'var(--bg-canvas)',
                    border: `1px solid ${submitAttempted && !formData.tenantId ? '#ef4444' : 'var(--border-default)'}`,
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 12px',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--text-sm)'
                  }}
                >
                  <option value="">Select Tenant Organization...</option>
                  {tenants.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.id})
                    </option>
                  ))}
                </select>
                {submitAttempted && !formData.tenantId && (
                  <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px' }}>
                    Tenant selection is required for scoped policies.
                  </div>
                )}
              </div>
            )}

            {/* Environment Selection (if environment-scoped) */}
            {formData.scope === 'environment' && (
              <div>
                <label htmlFor="policy-env" style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                  Target Deception Environment <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  id="policy-env"
                  value={formData.environmentId}
                  onChange={handleEnvironmentChange}
                  style={{
                    width: '100%',
                    background: 'var(--bg-canvas)',
                    border: `1px solid ${submitAttempted && !formData.environmentId ? '#ef4444' : 'var(--border-default)'}`,
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 12px',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--text-sm)'
                  }}
                >
                  <option value="">Select Deception Environment...</option>
                  {availableEnvironments.map(env => (
                    <option key={env.id} value={env.id}>
                      {env.name} ({env.id}) — {env.tenantName || env.tenantId}
                    </option>
                  ))}
                </select>
                {submitAttempted && !formData.environmentId && (
                  <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px' }}>
                    Environment selection is required for environment-scoped policies.
                  </div>
                )}
                {availableEnvironments.length === 0 && formData.tenantId && (
                  <div style={{ color: '#eab308', fontSize: '11px', marginTop: '4px' }}>
                    No deception environments registered for this tenant.
                  </div>
                )}
              </div>
            )}

            {/* Priority */}
            <div>
              <label htmlFor="policy-priority" style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                Evaluation Priority (1 - 100) <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                id="policy-priority"
                type="number"
                min={1}
                max={100}
                value={formData.priority}
                onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value, 10) || '' }))}
                style={{
                  width: '100%',
                  background: 'var(--bg-canvas)',
                  border: `1px solid ${submitAttempted && (formData.priority < 1 || formData.priority > 100) ? '#ef4444' : 'var(--border-default)'}`,
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 12px',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--text-sm)'
                }}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Lower numbers have higher evaluation precedence (1 = critical interlock).
              </span>
            </div>

            {/* Status */}
            <div>
              <label htmlFor="policy-status" style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                Simulated Policy Status <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                id="policy-status"
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                style={{
                  width: '100%',
                  background: 'var(--bg-canvas)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 12px',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--text-sm)'
                }}
              >
                <option value="Draft">Draft (Authoring Mode)</option>
                <option value="Enabled (Simulated)">Enabled (Simulated - Decision Candidate)</option>
                <option value="Review Required">Review Required (Operator Sign-off Pending)</option>
                <option value="Disabled">Disabled (Inactive)</option>
              </select>
            </div>

            {/* Policy Owner / Team */}
            <div>
              <label htmlFor="policy-owner" style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                Responsible Owner / Team
              </label>
              <input
                id="policy-owner"
                type="text"
                placeholder="e.g. Sarah Chen (Platform Ops)"
                value={formData.owner}
                onChange={(e) => setFormData(prev => ({ ...prev, owner: e.target.value }))}
                style={{
                  width: '100%',
                  background: 'var(--bg-canvas)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 12px',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--text-sm)'
                }}
              />
            </div>

            {/* Human Review Checkbox */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '24px' }}>
              <input
                id="policy-human-review"
                type="checkbox"
                checked={formData.humanReviewRequired}
                onChange={(e) => setFormData(prev => ({ ...prev, humanReviewRequired: e.target.checked }))}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <label htmlFor="policy-human-review" style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--text-primary)', cursor: 'pointer' }}>
                Require manual analyst sign-off before synthetic diversion execution
              </label>
            </div>
          </div>
        </div>

        {/* Section 2: Trigger Conditions & Evidence */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            padding: '20px'
          }}
        >
          <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} style={{ color: 'var(--accent-primary)' }} />
            Trigger Conditions & Required Evidence
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            {/* Trigger Conditions */}
            <div>
              <label htmlFor="trigger-conditions" style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                Configured Trigger Conditions (One condition per line)
              </label>
              <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Thresholds and criteria that make this policy eligible for evaluation.
              </span>
              <textarea
                id="trigger-conditions"
                rows={5}
                placeholder="Repeated authentication failures >= 25 within 60s&#10;Anomaly score >= 0.85 from behavioral detector&#10;Target URI matches /manage/v1/auth/*"
                value={formData.triggerConditionsText}
                onChange={(e) => setFormData(prev => ({ ...prev, triggerConditionsText: e.target.value }))}
                style={{
                  width: '100%',
                  background: 'var(--bg-canvas)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 12px',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--text-xs)',
                  fontFamily: 'monospace',
                  lineHeight: 1.5
                }}
              />
            </div>

            {/* Required Evidence */}
            <div>
              <label htmlFor="required-evidence" style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                Required Behavioral Evidence (One requirement per line)
              </label>
              <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Telemetry data points that must be verified before synthetic strategy selection.
              </span>
              <textarea
                id="required-evidence"
                rows={5}
                placeholder="Structured HTTP request log with client IP&#10;Behavioral anomaly vector scoring burst frequency&#10;Verified session fingerprint from reverse proxy"
                value={formData.requiredEvidenceText}
                onChange={(e) => setFormData(prev => ({ ...prev, requiredEvidenceText: e.target.value }))}
                style={{
                  width: '100%',
                  background: 'var(--bg-canvas)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 12px',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--text-xs)',
                  fontFamily: 'monospace',
                  lineHeight: 1.5
                }}
              />
            </div>
          </div>
        </div>

        {/* Section 3: Permitted vs Prohibited Synthetic Actions */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            padding: '20px'
          }}
        >
          <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={18} style={{ color: 'var(--accent-primary)' }} />
            Permitted vs. Prohibited Synthetic Actions
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            {/* Permitted Actions */}
            <div>
              <label htmlFor="permitted-actions" style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, marginBottom: '4px', color: '#60a5fa' }}>
                Permitted Synthetic Actions (One per line)
              </label>
              <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Actions allowed to be proposed within the synthetic honeynet scope.
              </span>
              <textarea
                id="permitted-actions"
                rows={5}
                placeholder="Divert session into dedicated synthetic auth sandbox&#10;Inject simulated exponential tarpit response delay&#10;Present synthetic superadmin persona ast-apex-user-01"
                value={formData.permittedActionsText}
                onChange={(e) => setFormData(prev => ({ ...prev, permittedActionsText: e.target.value }))}
                style={{
                  width: '100%',
                  background: 'var(--bg-canvas)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 12px',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--text-xs)',
                  fontFamily: 'monospace',
                  lineHeight: 1.5
                }}
              />
            </div>

            {/* Prohibited Actions */}
            <div>
              <label htmlFor="prohibited-actions" style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, marginBottom: '4px', color: '#f87171' }}>
                Prohibited Synthetic Actions (One per line)
              </label>
              <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Actions strictly forbidden. Contradictions with permitted actions will invalidate policy.
              </span>
              <textarea
                id="prohibited-actions"
                rows={5}
                placeholder="Modify real production applications or databases&#10;Expose real production credentials or API keys&#10;Permit outbound egress traffic from honeynet container"
                value={formData.prohibitedActionsText}
                onChange={(e) => setFormData(prev => ({ ...prev, prohibitedActionsText: e.target.value }))}
                style={{
                  width: '100%',
                  background: 'var(--bg-canvas)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 12px',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--text-xs)',
                  fontFamily: 'monospace',
                  lineHeight: 1.5
                }}
              />
            </div>

            {/* Safety Constraints */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="safety-constraints" style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, marginBottom: '4px', color: '#fbbf24' }}>
                Mandatory Safety Constraints & Boundary Invariants (One per line)
              </label>
              <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Tenant boundary isolation, egress locks, and fail-safe handling requirements.
              </span>
              <textarea
                id="safety-constraints"
                rows={3}
                placeholder="Tenant Isolation: Strict container namespace containment&#10;Zero Egress: Default-deny all outbound network packets&#10;Missing Evidence Guard: Unrecorded telemetry shall never be treated as verified safe"
                value={formData.safetyConstraintsText}
                onChange={(e) => setFormData(prev => ({ ...prev, safetyConstraintsText: e.target.value }))}
                style={{
                  width: '100%',
                  background: 'var(--bg-canvas)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 12px',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--text-xs)',
                  fontFamily: 'monospace',
                  lineHeight: 1.5
                }}
              />
            </div>
          </div>
        </div>

        {/* Real-time Validation Status Card */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: `1px solid ${
              validationResult.status === 'Valid'
                ? 'rgba(16, 185, 129, 0.3)'
                : validationResult.status === 'Warnings'
                ? 'rgba(234, 179, 8, 0.3)'
                : 'rgba(239, 68, 68, 0.3)'
            }`,
            borderRadius: 'var(--radius-md)',
            padding: '16px 20px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {validationResult.status === 'Valid' ? (
                <CheckCircle2 size={18} style={{ color: '#10b981' }} />
              ) : validationResult.status === 'Warnings' ? (
                <AlertTriangle size={18} style={{ color: '#eab308' }} />
              ) : (
                <XCircle size={18} style={{ color: '#ef4444' }} />
              )}
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                Live Policy Validation Status: {validationResult.status}
              </span>
            </div>

            <span
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '4px',
                background:
                  validationResult.status === 'Valid'
                    ? 'rgba(16, 185, 129, 0.15)'
                    : validationResult.status === 'Warnings'
                    ? 'rgba(234, 179, 8, 0.15)'
                    : 'rgba(239, 68, 68, 0.15)',
                color:
                  validationResult.status === 'Valid'
                    ? '#10b981'
                    : validationResult.status === 'Warnings'
                    ? '#eab308'
                    : '#ef4444'
              }}
            >
              {validationResult.issues.length} {validationResult.issues.length === 1 ? 'Finding' : 'Findings'}
            </span>
          </div>

          {validationResult.issues.length === 0 ? (
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>
              All deterministic validation checks passed. Scope, category, priority, and safety invariants are fully compliant.
            </p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: 'var(--text-xs)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {validationResult.issues.map((issue, idx) => (
                <li
                  key={idx}
                  style={{
                    color: issue.type === 'error' ? '#fca5a5' : '#fde68a',
                    lineHeight: 1.4
                  }}
                >
                  <strong>{issue.type === 'error' ? 'Validation Error:' : 'Warning:'}</strong> {issue.message}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Submit Actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', paddingTop: '8px' }}>
          <Link
            to={isEditing ? `/admin/deception-policies/${policyId}` : '/admin/deception-policies'}
            className="btn btn-secondary"
            disabled={saving}
          >
            Cancel
          </Link>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving || (submitAttempted && !validationResult.isValid)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <Save size={16} />
            {saving ? 'Saving Policy...' : isEditing ? 'Save Policy Changes' : 'Save Policy'}
          </button>
        </div>
      </form>
    </div>
  );
}
