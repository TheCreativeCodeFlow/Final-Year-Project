import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import apiClient from '../../services/apiClient';
import {
  ShieldAlert,
  Plus,
  ToggleLeft,
  ToggleRight,
  Filter,
  CheckCircle,
  AlertTriangle,
  Info,
  Layers,
  ArrowRight
} from 'lucide-react';
import './deception.css';

export default function PolicyManagementPage() {
  const { activeTenant } = useAuth();
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterEnabled, setFilterEnabled] = useState('ALL');

  // Form State
  const [formData, setFormData] = useState({
    policyIdentifier: '',
    name: '',
    description: '',
    priority: 100,
    minConfidence: 0.75,
    requiredTelemetryQuality: 'COMPLETE',
    minCorrelationConfidence: 0.65,
    requireRuleCorroboration: true,
    permittedActions: ['PROPOSE_DECEPTION', 'ALLOW_NORMAL'],
    prohibitedActions: ['RUN_ARBITRARY_COMMAND', 'EXFILTRATE_DATA']
  });

  const loadPolicies = async () => {
    if (!activeTenant?.id) return;
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (filterEnabled !== 'ALL') {
        params.enabled = filterEnabled === 'ENABLED';
      }
      const res = await apiClient.getDeceptionPolicies(activeTenant.id, params);
      setPolicies(res.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load deception policies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPolicies();
  }, [activeTenant?.id, filterEnabled]);

  const handleTogglePolicy = async (policy) => {
    try {
      await apiClient.updateDeceptionPolicy(activeTenant.id, policy.id, {
        enabled: !policy.enabled
      });
      loadPolicies();
    } catch (err) {
      alert(`Failed to update policy: ${err.message}`);
    }
  };

  const handleCreatePolicy = async (e) => {
    e.preventDefault();
    try {
      await apiClient.createDeceptionPolicy(activeTenant.id, {
        policyIdentifier: formData.policyIdentifier,
        name: formData.name,
        description: formData.description,
        priority: Number(formData.priority),
        requiredEvidenceCriteria: {
          minConfidence: Number(formData.minConfidence),
          requiredTelemetryQuality: formData.requiredTelemetryQuality,
          minCorrelationConfidence: Number(formData.minCorrelationConfidence),
          requireRuleCorroboration: formData.requireRuleCorroboration,
          applicableClassifications: ['ATTACK']
        },
        permittedActions: formData.permittedActions,
        prohibitedActions: formData.prohibitedActions
      });
      setShowCreateModal(false);
      setFormData({
        policyIdentifier: '',
        name: '',
        description: '',
        priority: 100,
        minConfidence: 0.75,
        requiredTelemetryQuality: 'COMPLETE',
        minCorrelationConfidence: 0.65,
        requireRuleCorroboration: true,
        permittedActions: ['PROPOSE_DECEPTION', 'ALLOW_NORMAL'],
        prohibitedActions: ['RUN_ARBITRARY_COMMAND', 'EXFILTRATE_DATA']
      });
      loadPolicies();
    } catch (err) {
      alert(`Failed to create policy: ${err.message}`);
    }
  };

  return (
    <div className="deception-page p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-3">
            <ShieldAlert className="w-7 h-7 text-sky-400" />
            Adaptive Deception Policies
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Configure tenant-scoped evidence gates, confidence thresholds, and deterministic diversion triggers.
          </p>
        </div>

        <div className="deception-header-actions">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold rounded-lg shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            Create Policy
          </button>
        </div>
      </div>

      <div className="planning-notice-banner">
        <Info className="w-5 h-5 flex-shrink-0 text-sky-400" />
        <div>
          <span className="font-semibold text-sky-300">Stage 5A Planning Safety Default: </span>
          When no policy matches or telemetry is degraded, the engine safely defaults to normal traffic routing.
          Deception proposals are strictly non-executing plans; live containers and honeypots are not provisioned.
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-lg p-3">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Filter className="w-4 h-4" />
          <span>Filter Status:</span>
          {['ALL', 'ENABLED', 'DISABLED'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterEnabled(status)}
              className={`px-3 py-1 rounded text-xs font-medium transition ${
                filterEnabled === status
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
        <div className="text-xs text-slate-500">
          Showing {policies.length} {policies.length === 1 ? 'policy' : 'policies'}
        </div>
      </div>

      {/* Policies List Table */}
      {loading ? (
        <div className="p-8 text-center text-slate-400 bg-slate-900 border border-slate-800 rounded-xl">
          Loading deception policies...
        </div>
      ) : error ? (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      ) : policies.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/50 border border-slate-800 rounded-xl">
          <ShieldAlert className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-slate-200 font-semibold mb-1">No Deception Policies Found</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-4">
            Create your first tenant-scoped deception policy to establish evidence thresholds and strategy compatibility.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold rounded-lg"
          >
            Create First Policy
          </button>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/60 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Policy</th>
                <th className="py-3 px-4">Scope</th>
                <th className="py-3 px-4">Evidence Criteria</th>
                <th className="py-3 px-4">Permitted Actions</th>
                <th className="py-3 px-4">Version</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
              {policies.map((pol) => {
                const criteria = pol.requiredEvidenceCriteria || {};
                const isPlatformBaseline = pol.tenantId === null;
                return (
                  <tr key={pol.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4 font-bold text-sky-400">
                      #{pol.priority}
                    </td>
                    <td className="py-3 px-4 font-sans">
                      <div className="font-semibold text-slate-100">{pol.name}</div>
                      <div className="text-xs text-slate-400 font-mono">{pol.policyIdentifier}</div>
                      {pol.description && (
                        <div className="text-xs text-slate-500 mt-0.5">{pol.description}</div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {isPlatformBaseline ? (
                        <span className="px-2 py-0.5 bg-purple-500/10 text-purple-300 border border-purple-500/20 rounded text-[11px] font-sans">
                          Platform Baseline
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-blue-500/10 text-blue-300 border border-blue-500/20 rounded text-[11px] font-sans">
                          Tenant Owned
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs font-sans">
                      <div className="flex flex-col gap-1">
                        <div>Min Conf: <span className="font-mono text-amber-400">{criteria.minConfidence ?? 0.7}</span></div>
                        <div>Telemetry: <span className="font-mono text-slate-300">{criteria.requiredTelemetryQuality || 'COMPLETE'}</span></div>
                        <div>Rule Corroboration: <span className="font-mono text-emerald-400">{criteria.requireRuleCorroboration ? 'Required' : 'Optional'}</span></div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {(pol.permittedActions || []).map((act, i) => (
                          <span key={i} className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px]">
                            {act}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-mono">
                      v{pol.version}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {isPlatformBaseline ? (
                        <span className="text-xs text-slate-500 italic font-sans">Immutable</span>
                      ) : (
                        <button
                          onClick={() => handleTogglePolicy(pol)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition"
                          title="Click to toggle policy state"
                        >
                          {pol.enabled ? (
                            <span className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300">
                              <ToggleRight className="w-5 h-5 text-emerald-400" /> Enabled
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-slate-500 hover:text-slate-400">
                              <ToggleLeft className="w-5 h-5 text-slate-500" /> Disabled
                            </span>
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Policy Modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-sky-400" />
                Create Deception Policy
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePolicy} className="p-5 space-y-4 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Policy Identifier *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="pol-apex-recon-01"
                    value={formData.policyIdentifier}
                    onChange={(e) => setFormData({ ...formData, policyIdentifier: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 text-sm focus:border-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Policy Priority (1 = highest) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    required
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 text-sm focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                  Policy Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Reconnaissance & Endpoint Trapping Policy"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 text-sm focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                  Description
                </label>
                <textarea
                  rows="2"
                  placeholder="Applies to external scanning attempts requiring verified rule corroboration..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 text-sm focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg space-y-3">
                <div className="font-semibold text-xs text-sky-400 uppercase tracking-wide">
                  Evidence Criteria Gates
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      Minimum Confidence (0.50 - 1.00)
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      min="0.5"
                      max="1.0"
                      value={formData.minConfidence}
                      onChange={(e) => setFormData({ ...formData, minConfidence: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-slate-200 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      Required Telemetry Quality
                    </label>
                    <select
                      value={formData.requiredTelemetryQuality}
                      onChange={(e) => setFormData({ ...formData, requiredTelemetryQuality: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-slate-200 text-xs"
                    >
                      <option value="COMPLETE">COMPLETE (Strict - No Data Loss)</option>
                      <option value="PARTIAL">PARTIAL</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="reqRuleCorrob"
                    checked={formData.requireRuleCorroboration}
                    onChange={(e) => setFormData({ ...formData, requireRuleCorroboration: e.target.checked })}
                    className="rounded bg-slate-900 border-slate-700 text-sky-600 focus:ring-0"
                  />
                  <label htmlFor="reqRuleCorrob" className="text-xs text-slate-300">
                    Require Deterministic Rule Corroboration (Blocks ML-only unverified anomalies)
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded text-sm font-semibold shadow"
                >
                  Create Policy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
