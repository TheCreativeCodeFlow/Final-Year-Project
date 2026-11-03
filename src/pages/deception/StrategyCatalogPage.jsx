import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import apiClient from '../../services/apiClient';
import {
  Layers,
  Search,
  Filter,
  ShieldAlert,
  Sliders,
  CheckCircle,
  Lock,
  Zap,
  Key,
  Database,
  Terminal,
  Activity,
  Info
} from 'lucide-react';
import './deception.css';

export default function StrategyCatalogPage() {
  const { activeTenant } = useAuth();
  const [strategies, setStrategies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function loadStrategies() {
      if (!activeTenant?.id) return;
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.getDeceptionStrategies(activeTenant.id);
        setStrategies(res.data || []);
      } catch (err) {
        setError(err.message || 'Failed to load strategy catalogue');
      } finally {
        setLoading(false);
      }
    }
    loadStrategies();
  }, [activeTenant?.id]);

  const categoryIcons = {
    RECONNAISSANCE_DECEPTION: <Search className="w-4 h-4 text-sky-400" />,
    CREDENTIAL_DECEPTION: <Key className="w-4 h-4 text-amber-400" />,
    API_DECEPTION: <Terminal className="w-4 h-4 text-purple-400" />,
    DATA_ACCESS_DECEPTION: <Database className="w-4 h-4 text-red-400" />,
    SERVICE_INTERACTION_DECEPTION: <Activity className="w-4 h-4 text-emerald-400" />
  };

  const categoryBadgeClass = {
    RECONNAISSANCE_DECEPTION: 'cat-recon',
    CREDENTIAL_DECEPTION: 'cat-credential',
    API_DECEPTION: 'cat-api',
    DATA_ACCESS_DECEPTION: 'cat-data',
    SERVICE_INTERACTION_DECEPTION: 'cat-service'
  };

  const filteredStrategies = strategies.filter((strat) => {
    const matchesCategory =
      selectedCategory === 'ALL' || strat.strategyType === selectedCategory;
    const matchesSearch =
      searchQuery === '' ||
      strat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      strat.strategyIdentifier.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (strat.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="deception-page p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-3">
            <Layers className="w-7 h-7 text-sky-400" />
            Deception Strategy Catalogue
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Five categorized simulation strategies providing deterministic state-change proposals and DSG blueprints.
          </p>
        </div>
      </div>

      <div className="planning-notice-banner">
        <Info className="w-5 h-5 flex-shrink-0 text-sky-400" />
        <div>
          <span className="font-semibold text-sky-300">Stage 5A Planning Only: </span>
          Strategies define deterministic simulation blueprints and state graph proposals. No live honeypot containers or dynamic sandbox routing are provisioned in this milestone.
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-lg p-3">
        <div className="flex items-center gap-2 flex-wrap text-sm text-slate-400">
          <Filter className="w-4 h-4" />
          <span>Category:</span>
          {[
            { id: 'ALL', label: 'All 5 Categories' },
            { id: 'RECONNAISSANCE_DECEPTION', label: 'Reconnaissance' },
            { id: 'CREDENTIAL_DECEPTION', label: 'Credentials' },
            { id: 'API_DECEPTION', label: 'API / Facade' },
            { id: 'DATA_ACCESS_DECEPTION', label: 'Data Access' },
            { id: 'SERVICE_INTERACTION_DECEPTION', label: 'Service / Tarpit' }
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1 rounded text-xs font-medium transition ${
                selectedCategory === cat.id
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <input
            type="text"
            placeholder="Search strategies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full md:w-60 bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Strategy Grid */}
      {loading ? (
        <div className="p-8 text-center text-slate-400 bg-slate-900 border border-slate-800 rounded-xl">
          Loading strategy catalogue...
        </div>
      ) : error ? (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      ) : (
        <div className="strategy-card-grid">
          {filteredStrategies.map((strat) => {
            const prereqs = strat.prerequisites || {};
            const isolation = strat.isolationRequirements || {};
            const proposal = strat.permittedStateChangeProposal || {};
            const blueprint = strat.dsgBlueprint || {};

            return (
              <div key={strat.strategyIdentifier} className="strategy-card">
                <div className="strategy-card-header">
                  <div>
                    <span
                      className={`strategy-category-badge ${
                        categoryBadgeClass[strat.strategyType] || 'cat-recon'
                      }`}
                    >
                      {categoryIcons[strat.strategyType]}
                      {strat.strategyType.replace('_DECEPTION', '')}
                    </span>
                    <h3 className="text-base font-bold text-slate-100 mt-2">
                      {strat.name}
                    </h3>
                    <div className="text-xs font-mono text-slate-400">
                      {strat.strategyIdentifier} • v{strat.version || 1}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-[10px] font-semibold">
                    ACTIVE
                  </span>
                </div>

                <p className="text-xs text-slate-400 line-clamp-2">
                  {strat.description}
                </p>

                {/* Prerequisites Box */}
                <div className="bg-slate-950/60 border border-slate-800/80 rounded p-2.5 space-y-1.5 text-xs">
                  <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Sliders className="w-3 h-3 text-sky-400" />
                    Prerequisites & Eligibility
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-slate-400">
                    <div>
                      Min Confidence: <span className="text-amber-400 font-mono font-semibold">{prereqs.minConfidence ?? 0.7}</span>
                    </div>
                    <div>
                      Telemetry: <span className="text-slate-200 font-mono font-semibold">{prereqs.requiredTelemetryQuality || 'COMPLETE'}</span>
                    </div>
                    <div>
                      Rule Corroboration: <span className="text-emerald-400 font-mono font-semibold">{prereqs.requireRuleCorroboration ? 'Yes' : 'Optional'}</span>
                    </div>
                    <div>
                      Max Collision Risk: <span className="text-sky-300 font-mono font-semibold">{prereqs.maxCollisionRisk || 'LOW'}</span>
                    </div>
                  </div>
                  {prereqs.targetedRules && (
                    <div className="pt-1 flex flex-wrap gap-1">
                      {prereqs.targetedRules.map((rule, idx) => (
                        <span key={idx} className="reason-pill">
                          {rule}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Isolation & Sandboxing Box */}
                <div className="bg-slate-950/60 border border-slate-800/80 rounded p-2.5 text-xs space-y-1">
                  <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Lock className="w-3 h-3 text-purple-400" />
                    Sandbox Isolation Constraints
                  </div>
                  <div className="text-slate-400">
                    Engine: <span className="text-slate-200 font-mono">{isolation.executionEngine || 'SANDBOX_CONTAINER'}</span>
                  </div>
                  <div className="text-slate-400">
                    Egress Policy: <span className="text-emerald-400 font-mono font-semibold">{isolation.noOutboundEgress ? 'STRICT_NO_EGRESS' : 'RESTRICTED'}</span>
                  </div>
                </div>

                {/* State Proposal & DSG Blueprint Summary */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <span className="font-mono text-slate-300">
                    Action: {proposal.actionType || proposal.action || 'SIMULATE_DECOY'}
                  </span>
                  <span className="text-sky-400 font-mono text-[11px]">
                    {(blueprint.nodes || []).length} Blueprint Nodes
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
