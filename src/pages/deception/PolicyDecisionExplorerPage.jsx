import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import apiClient from '../../services/apiClient';
import {
  FileText,
  Filter,
  CheckCircle,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Eye,
  Layers,
  ArrowRight,
  Shield,
  Activity,
  Info
} from 'lucide-react';
import './deception.css';

export default function PolicyDecisionExplorerPage() {
  const { activeTenant } = useAuth();
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedResult, setSelectedResult] = useState('ALL');
  const [selectedDecision, setSelectedDecision] = useState(null);

  const loadDecisions = async () => {
    if (!activeTenant?.id) return;
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (selectedResult !== 'ALL') {
        params.decisionResult = selectedResult;
      }
      const res = await apiClient.getDeceptionDecisions(activeTenant.id, params);
      setDecisions(res.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load policy decisions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDecisions();
  }, [activeTenant?.id, selectedResult]);

  const getDecisionBadge = (result) => {
    switch (result) {
      case 'PROPOSE_DECEPTION':
        return (
          <span className="decision-badge decision-propose">
            <CheckCircle className="w-3.5 h-3.5" /> Propose Deception
          </span>
        );
      case 'ALLOW_NORMAL':
        return (
          <span className="decision-badge decision-allow">
            <CheckCircle className="w-3.5 h-3.5" /> Allow Normal
          </span>
        );
      case 'BLOCK_POLICY':
        return (
          <span className="decision-badge decision-block">
            <XCircle className="w-3.5 h-3.5" /> Block Policy
          </span>
        );
      case 'INSUFFICIENT_EVIDENCE':
        return (
          <span className="decision-badge decision-insufficient">
            <AlertTriangle className="w-3.5 h-3.5" /> Insufficient Evidence
          </span>
        );
      case 'NO_ELIGIBLE_STRATEGY':
        return (
          <span className="decision-badge decision-nostrategy">
            <HelpCircle className="w-3.5 h-3.5" /> No Strategy Match
          </span>
        );
      default:
        return (
          <span className="decision-badge decision-nostrategy">
            {result || 'UNKNOWN'}
          </span>
        );
    }
  };

  return (
    <div className="deception-page p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-3">
            <FileText className="w-7 h-7 text-sky-400" />
            Policy Decision Provenance Explorer
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Immutable audit record of evaluated detection assessments, policy constraints, and generated DSG plans.
          </p>
        </div>
      </div>

      <div className="planning-notice-banner">
        <Info className="w-5 h-5 flex-shrink-0 text-sky-400" />
        <div>
          <span className="font-semibold text-sky-300">Stage 5A Provenance Guarantee: </span>
          Decisions capture mathematical confidence, rule corroboration, strategy selection rationale, and proposed DSG mutations.
          All records report <span className="font-mono font-bold text-amber-300">executionEvidenceStatus: MISSING</span> to guarantee pure planning integrity.
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-lg p-3">
        <div className="flex items-center gap-2 flex-wrap text-sm text-slate-400">
          <Filter className="w-4 h-4" />
          <span>Result Filter:</span>
          {[
            { id: 'ALL', label: 'All Results' },
            { id: 'PROPOSE_DECEPTION', label: 'Propose Deception' },
            { id: 'ALLOW_NORMAL', label: 'Allow Normal' },
            { id: 'INSUFFICIENT_EVIDENCE', label: 'Insufficient Evidence' },
            { id: 'NO_ELIGIBLE_STRATEGY', label: 'No Strategy' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedResult(item.id)}
              className={`px-3 py-1 rounded text-xs font-medium transition ${
                selectedResult === item.id
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="text-xs text-slate-500">
          Showing {decisions.length} decisions
        </div>
      </div>

      {/* Decisions Table */}
      {loading ? (
        <div className="p-8 text-center text-slate-400 bg-slate-900 border border-slate-800 rounded-xl">
          Loading policy decisions...
        </div>
      ) : error ? (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      ) : decisions.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/50 border border-slate-800 rounded-xl">
          <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-slate-200 font-semibold mb-1">No Policy Decisions Found</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Decisions are automatically recorded when detection assessments are evaluated against active deception policies.
          </p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/60 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Decided At</th>
                <th className="py-3 px-4">Result</th>
                <th className="py-3 px-4">Policy</th>
                <th className="py-3 px-4">Selected Strategy</th>
                <th className="py-3 px-4">Reason Codes</th>
                <th className="py-3 px-4">Evidence Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
              {decisions.map((dec) => {
                const reasons = dec.reasonCodes || [];
                return (
                  <tr key={dec.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4 text-slate-400">
                      {new Date(dec.decidedAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-sans">
                      {getDecisionBadge(dec.decisionResult)}
                    </td>
                    <td className="py-3 px-4 font-sans">
                      <div className="font-semibold text-slate-200">
                        {dec.policy?.name || 'Platform Baseline'}
                      </div>
                      <div className="text-xs font-mono text-slate-500">
                        v{dec.policyVersion || 1}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-sans">
                      {dec.selectedStrategy ? (
                        <div>
                          <div className="font-semibold text-sky-300">
                            {dec.selectedStrategy.name}
                          </div>
                          <div className="text-xs font-mono text-slate-400">
                            {dec.selectedStrategy.strategyType}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">None</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {reasons.slice(0, 3).map((r, i) => (
                          <span key={i} className="reason-pill">
                            {r}
                          </span>
                        ))}
                        {reasons.length > 3 && (
                          <span className="text-[10px] text-slate-500">
                            +{reasons.length - 3} more
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-sans">
                      <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded text-[10px] font-semibold">
                        MISSING
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-sans">
                      <button
                        onClick={() => setSelectedDecision(dec)}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium transition"
                      >
                        <Eye className="w-3.5 h-3.5" /> Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Decision Detail Drawer */}
      {selectedDecision && (
        <div className="decision-drawer-overlay" onClick={() => setSelectedDecision(null)}>
          <div className="decision-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-sky-400" />
                  Policy Decision Detail
                </h3>
                <div className="text-xs font-mono text-slate-500 mt-0.5">
                  ID: {selectedDecision.id}
                </div>
              </div>
              <button
                onClick={() => setSelectedDecision(null)}
                className="text-slate-400 hover:text-slate-200 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="drawer-body">
              {/* Result & Evaluation Summary */}
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Decision Outcome
                </div>
                <div>{getDecisionBadge(selectedDecision.decisionResult)}</div>
                <p className="text-xs text-slate-300 font-sans leading-relaxed pt-1">
                  {selectedDecision.decisionRationale}
                </p>
              </div>

              {/* Reason Codes */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Deterministic Reason Codes
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(selectedDecision.reasonCodes || []).map((code, idx) => (
                    <span key={idx} className="reason-pill text-xs px-2 py-1">
                      {code}
                    </span>
                  ))}
                </div>
              </div>

              {/* Evidence References */}
              {selectedDecision.evidenceReferences && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Evidence References & Ground Truth
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-slate-950 p-3 rounded-lg border border-slate-800 text-slate-300">
                    <div>
                      Assessment ID:{' '}
                      <span className="text-slate-400">
                        {selectedDecision.evidenceReferences.assessmentId || 'N/A'}
                      </span>
                    </div>
                    <div>
                      Confidence:{' '}
                      <span className="text-amber-400 font-bold">
                        {selectedDecision.evidenceReferences.confidence ?? 'N/A'}
                      </span>
                    </div>
                    <div>
                      Telemetry Quality:{' '}
                      <span className="text-emerald-400">
                        {selectedDecision.evidenceReferences.dataQualityState || 'COMPLETE'}
                      </span>
                    </div>
                    <div>
                      Data Loss Detected:{' '}
                      <span className="text-sky-300">
                        {selectedDecision.evidenceReferences.telemetryLossDetected ? 'YES' : 'NO'}
                      </span>
                    </div>
                    <div>
                      Execution Status:{' '}
                      <span className="text-slate-400">NOT_EXECUTED</span>
                    </div>
                    <div>
                      Execution Evidence:{' '}
                      <span className="text-amber-400 font-bold">MISSING</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Selected Strategy & Candidate Pool */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Strategy Selection Provenance
                </div>
                {selectedDecision.selectedStrategy ? (
                  <div className="p-3 bg-slate-900 border border-sky-500/30 rounded-lg text-xs space-y-1">
                    <div className="font-semibold text-sky-300">
                      {selectedDecision.selectedStrategy.name}
                    </div>
                    <div className="font-mono text-slate-400">
                      {selectedDecision.selectedStrategy.strategyIdentifier} (v{selectedDecision.selectedStrategyVersion || 1})
                    </div>
                    <div className="text-slate-400 font-sans">
                      Category: {selectedDecision.selectedStrategy.strategyType}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-500 italic">
                    No strategy was selected or eligible for this evaluation.
                  </div>
                )}
              </div>

              {/* Proposed DSG Mutations */}
              {selectedDecision.proposedMutations && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Proposed DSG State Mutation Plan</span>
                    <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded text-[10px] font-mono">
                      {selectedDecision.proposedMutations.status || 'PROPOSED'}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono space-y-2">
                    <div className="text-slate-400">
                      Plan ID: {selectedDecision.proposedMutations.planId}
                    </div>
                    <div className="text-slate-300">
                      Nodes to Add: {(selectedDecision.proposedMutations.nodesToAdd || []).length}
                    </div>
                    <div className="text-slate-300">
                      Edges to Add: {(selectedDecision.proposedMutations.edgesToAdd || []).length}
                    </div>
                    <div className="text-[11px] text-amber-400/90 font-sans italic pt-1 border-t border-slate-800">
                      {selectedDecision.proposedMutations.nonExecutionNotice}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
