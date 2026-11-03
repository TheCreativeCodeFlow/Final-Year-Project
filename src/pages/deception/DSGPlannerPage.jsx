import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import apiClient from '../../services/apiClient';
import {
  Network,
  Shield,
  Layers,
  Activity,
  Zap,
  Play,
  CheckCircle,
  AlertCircle,
  Lock,
  ArrowRight,
  Database,
  Terminal,
  UserCheck,
  Info
} from 'lucide-react';
import './deception.css';

export default function DSGPlannerPage() {
  const { activeTenant } = useAuth();
  const [graphs, setGraphs] = useState([]);
  const [activeGraph, setActiveGraph] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Planning Simulator State
  const [strategies, setStrategies] = useState([]);
  const [selectedStrategyId, setSelectedStrategyId] = useState('');
  const [simulatedPlan, setSimulatedPlan] = useState(null);
  const [planningInProgress, setPlanningInProgress] = useState(false);
  const [selectedLayerFilter, setSelectedLayerFilter] = useState('ALL');

  useEffect(() => {
    async function loadData() {
      if (!activeTenant?.id) return;
      setLoading(true);
      setError(null);
      try {
        const [graphRes, stratRes] = await Promise.all([
          apiClient.getDeceptionGraphs(activeTenant.id),
          apiClient.getDeceptionStrategies(activeTenant.id)
        ]);

        const list = graphRes.data || [];
        setGraphs(list);
        setStrategies(stratRes.data || []);
        if (list.length > 0) {
          const detail = await apiClient.getDeceptionGraphById(activeTenant.id, list[0].id);
          setActiveGraph(detail.data);
        }
        if (stratRes.data && stratRes.data.length > 0) {
          setSelectedStrategyId(stratRes.data[0].strategyIdentifier);
        }
      } catch (err) {
        setError(err.message || 'Failed to load Deception State Graph');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [activeTenant?.id]);

  const handleSelectGraph = async (graphId) => {
    try {
      const res = await apiClient.getDeceptionGraphById(activeTenant.id, graphId);
      setActiveGraph(res.data);
      setSimulatedPlan(null);
    } catch (err) {
      alert(`Failed to load graph: ${err.message}`);
    }
  };

  const handleGeneratePlan = async () => {
    if (!activeGraph?.graph?.id || !selectedStrategyId) return;
    setPlanningInProgress(true);
    try {
      const res = await apiClient.planDeceptionGraphMutation(
        activeTenant.id,
        activeGraph.graph.id,
        { strategyIdentifier: selectedStrategyId }
      );
      setSimulatedPlan(res.data);
    } catch (err) {
      alert(`Planning failed: ${err.message}`);
    } finally {
      setPlanningInProgress(false);
    }
  };

  const graphData = activeGraph?.graph || {};
  const allNodes = graphData.nodes || [];
  const allEdges = graphData.edges || [];

  const filteredNodes = allNodes.filter((node) => {
    if (selectedLayerFilter === 'ALL') return true;
    return node.layerClassification === selectedLayerFilter;
  });

  return (
    <div className="deception-page p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-3">
            <Network className="w-7 h-7 text-sky-400" />
            Deception State Graph (DSG) Planner
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Topological modeling across 3 canonical state layers with deterministic mutation planning.
          </p>
        </div>

        {graphs.length > 1 && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span>Graph:</span>
            <select
              value={graphData.id || ''}
              onChange={(e) => handleSelectGraph(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200"
            >
              {graphs.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.graphIdentifier} (v{g.graphVersion})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="planning-notice-banner">
        <Info className="w-5 h-5 flex-shrink-0 text-sky-400" />
        <div>
          <span className="font-semibold text-sky-300">Stage 5A Graph Modeling Invariant: </span>
          The Deception State Graph models environment topology across 3 isolated layers. Proposed mutations have status{' '}
          <span className="font-mono font-bold text-sky-300">PROPOSED</span> and are never executed live.
        </div>
      </div>

      {/* Layer Metrics Overview */}
      <div className="deception-metric-grid">
        <div className="deception-card">
          <div className="deception-card-title">
            <span>Active Graph Nodes</span>
            <Network className="w-4 h-4 text-sky-400" />
          </div>
          <div className="deception-card-value">{allNodes.length}</div>
          <div className="deception-card-subtitle font-mono">
            {allEdges.length} connected transitions/edges
          </div>
        </div>

        <div className="deception-card">
          <div className="deception-card-title">
            <span>Layer 1: Policy Boundary</span>
            <Shield className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="deception-card-value text-indigo-400">
            {allNodes.filter((n) => n.layerClassification === 'PROTECTED_DECEPTION_POLICY').length}
          </div>
          <div className="deception-card-subtitle">
            Containment & egress rules
          </div>
        </div>

        <div className="deception-card">
          <div className="deception-card-title">
            <span>Layer 2: Dynamic Decoys</span>
            <Zap className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="deception-card-value text-cyan-400">
            {allNodes.filter((n) => n.layerClassification === 'CONTROLLED_DYNAMIC_STATE').length}
          </div>
          <div className="deception-card-subtitle">
            Synthetic endpoints & honey credentials
          </div>
        </div>

        <div className="deception-card">
          <div className="deception-card-title">
            <span>Layer 3: Attacker State</span>
            <Activity className="w-4 h-4 text-rose-400" />
          </div>
          <div className="deception-card-value text-rose-400">
            {allNodes.filter((n) => n.layerClassification === 'OBSERVATIONAL_ATTACKER_STATE').length}
          </div>
          <div className="deception-card-subtitle">
            Probe trajectories & canary sinks
          </div>
        </div>
      </div>

      {/* Planner Simulation Tool */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Play className="w-4 h-4 text-emerald-400" />
              Simulate Adaptive DSG Mutation Plan
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Select a strategy to generate a proposed state transition without modifying live infrastructure.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={selectedStrategyId}
              onChange={(e) => setSelectedStrategyId(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
            >
              {strategies.map((s) => (
                <option key={s.strategyIdentifier} value={s.strategyIdentifier}>
                  {s.strategyType.replace('_DECEPTION', '')}: {s.name}
                </option>
              ))}
            </select>

            <button
              onClick={handleGeneratePlan}
              disabled={planningInProgress}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white text-xs font-semibold rounded shadow transition flex items-center gap-1.5"
            >
              {planningInProgress ? 'Generating...' : 'Generate Proposed Plan'}
            </button>
          </div>
        </div>

        {/* Mutation Plan Output Display */}
        {simulatedPlan && (
          <div className="p-4 bg-slate-950 border border-emerald-500/30 rounded-lg space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2 font-bold text-emerald-400">
                <CheckCircle className="w-4 h-4" />
                Proposed State Mutation Plan Generated: {simulatedPlan.planId}
              </div>
              <span className="px-2 py-0.5 bg-blue-500/10 text-blue-300 border border-blue-500/20 rounded font-semibold text-[10px]">
                STATUS: {simulatedPlan.status}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
              <div className="bg-slate-900/60 p-3 rounded border border-slate-800">
                <div className="font-semibold text-slate-300 text-xs uppercase tracking-wider mb-2">
                  Previous Topology State (v{simulatedPlan.previousState.topologyVersion})
                </div>
                <div className="space-y-1 text-slate-400 text-xs font-mono">
                  <div>Active Nodes: {simulatedPlan.previousState.activeNodeCount}</div>
                  <div>Active Edges: {simulatedPlan.previousState.activeEdgeCount}</div>
                  <div>Policy Nodes: {simulatedPlan.previousState.layerBreakdown.PROTECTED_DECEPTION_POLICY}</div>
                  <div>Dynamic Nodes: {simulatedPlan.previousState.layerBreakdown.CONTROLLED_DYNAMIC_STATE}</div>
                  <div>Attacker Nodes: {simulatedPlan.previousState.layerBreakdown.OBSERVATIONAL_ATTACKER_STATE}</div>
                </div>
              </div>

              <div className="bg-slate-900/60 p-3 rounded border border-emerald-500/30">
                <div className="font-semibold text-emerald-300 text-xs uppercase tracking-wider mb-2">
                  Proposed Mutation State (v{simulatedPlan.proposedState.topologyVersion})
                </div>
                <div className="space-y-1 text-slate-300 text-xs font-mono">
                  <div>Proposed Node Count: {simulatedPlan.proposedState.proposedNodeCount} (+{simulatedPlan.nodesToAdd.length})</div>
                  <div>Proposed Edge Count: {simulatedPlan.proposedState.proposedEdgeCount} (+{simulatedPlan.edgesToAdd.length})</div>
                  <div>Target Strategy: {simulatedPlan.proposedState.strategyIdentifier}</div>
                  <div>Category: {simulatedPlan.proposedState.strategyType}</div>
                  <div>Sandbox Isolation: Strict No Egress Validated</div>
                </div>
              </div>
            </div>

            {/* Synthetic Environment Blueprint */}
            <div className="p-3 bg-slate-900/40 rounded border border-slate-800 space-y-1 text-[11px] font-sans">
              <div className="font-semibold text-slate-300 uppercase tracking-wider">
                Synthetic Assets Modeled in Proposal
              </div>
              <div className="text-slate-400">
                • Mock Users: {(simulatedPlan.syntheticEnvironmentModel.mockUsers || []).map((u) => u.username).join(', ')}
              </div>
              <div className="text-slate-400">
                • Endpoints: {(simulatedPlan.syntheticEnvironmentModel.mockEndpoints || []).map((e) => e.path).join(', ')}
              </div>
              <div className="text-slate-400">
                • Decoy Database: {simulatedPlan.syntheticEnvironmentModel.mockDatabaseRecords?.schema} ({simulatedPlan.syntheticEnvironmentModel.mockDatabaseRecords?.sampleRows} canary rows)
              </div>
            </div>

            <div className="text-[11px] text-amber-400/90 italic pt-1 font-sans">
              {simulatedPlan.nonExecutionNotice}
            </div>
          </div>
        )}
      </div>

      {/* Layer Filter Toolbar */}
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-lg p-3">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Layers className="w-4 h-4" />
          <span>Inspect Layer:</span>
          {[
            { id: 'ALL', label: 'All 3 Layers' },
            { id: 'PROTECTED_DECEPTION_POLICY', label: 'Layer 1: Policy' },
            { id: 'CONTROLLED_DYNAMIC_STATE', label: 'Layer 2: Dynamic' },
            { id: 'OBSERVATIONAL_ATTACKER_STATE', label: 'Layer 3: Attacker' }
          ].map((l) => (
            <button
              key={l.id}
              onClick={() => setSelectedLayerFilter(l.id)}
              className={`px-3 py-1 rounded text-xs font-medium transition ${
                selectedLayerFilter === l.id
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
        <div className="text-xs text-slate-500 font-mono">
          Showing {filteredNodes.length} nodes
        </div>
      </div>

      {/* 3-Layer Graph Inspection View */}
      <div className="dsg-layer-container">
        {/* Layer 1 */}
        {(selectedLayerFilter === 'ALL' || selectedLayerFilter === 'PROTECTED_DECEPTION_POLICY') && (
          <div className="dsg-layer-box layer-policy-box">
            <div className="dsg-layer-header">
              <div>
                <h4 className="text-sm font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                  <Shield className="w-4 h-4" /> Layer 1: Protected Deception Policy
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Immutable policy boundaries, sandbox limits, and network isolation constraints.
                </p>
              </div>
            </div>
            <div className="dsg-node-grid">
              {allNodes
                .filter((n) => n.layerClassification === 'PROTECTED_DECEPTION_POLICY')
                .map((node) => (
                  <div key={node.id} className="dsg-node-card">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200 font-mono">
                        {node.nodeIdentifier}
                      </span>
                      <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded text-[10px] font-mono">
                        {node.nodeType}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{node.assetDescription}</p>
                    <div className="text-[11px] font-mono text-slate-500 bg-slate-950 p-2 rounded">
                      {JSON.stringify(node.structuredAttributes || {})}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Layer 2 */}
        {(selectedLayerFilter === 'ALL' || selectedLayerFilter === 'CONTROLLED_DYNAMIC_STATE') && (
          <div className="dsg-layer-box layer-dynamic-box">
            <div className="dsg-layer-header">
              <div>
                <h4 className="text-sm font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                  <Zap className="w-4 h-4" /> Layer 2: Controlled Dynamic State
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Synthetic endpoints, canary bearer tokens, decoy databases, and simulated latency tarpits.
                </p>
              </div>
            </div>
            <div className="dsg-node-grid">
              {allNodes
                .filter((n) => n.layerClassification === 'CONTROLLED_DYNAMIC_STATE')
                .map((node) => (
                  <div key={node.id} className="dsg-node-card">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200 font-mono">
                        {node.nodeIdentifier}
                      </span>
                      <span className="px-2 py-0.5 bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 rounded text-[10px] font-mono">
                        {node.nodeType}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{node.assetDescription}</p>
                    <div className="text-[11px] font-mono text-slate-500 bg-slate-950 p-2 rounded">
                      {JSON.stringify(node.structuredAttributes || {})}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Layer 3 */}
        {(selectedLayerFilter === 'ALL' || selectedLayerFilter === 'OBSERVATIONAL_ATTACKER_STATE') && (
          <div className="dsg-layer-box layer-attacker-box">
            <div className="dsg-layer-header">
              <div>
                <h4 className="text-sm font-bold text-rose-400 uppercase tracking-wider flex items-center gap-2">
                  <Activity className="w-4 h-4" /> Layer 3: Observational Attacker State
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  External probe trajectories, session observation trackers, and canary alert sinks.
                </p>
              </div>
            </div>
            <div className="dsg-node-grid">
              {allNodes
                .filter((n) => n.layerClassification === 'OBSERVATIONAL_ATTACKER_STATE')
                .map((node) => (
                  <div key={node.id} className="dsg-node-card">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200 font-mono">
                        {node.nodeIdentifier}
                      </span>
                      <span className="px-2 py-0.5 bg-rose-500/10 text-rose-300 border border-rose-500/20 rounded text-[10px] font-mono">
                        {node.nodeType}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{node.assetDescription}</p>
                    <div className="text-[11px] font-mono text-slate-500 bg-slate-950 p-2 rounded">
                      {JSON.stringify(node.structuredAttributes || {})}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
