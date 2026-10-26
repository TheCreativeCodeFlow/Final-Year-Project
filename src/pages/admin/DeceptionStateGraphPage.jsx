import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Network,
  Layers,
  Shield,
  ArrowLeft,
  AlertTriangle,
  Server,
  Radio,
  FileText,
  Database,
  Lock,
  User,
  Zap,
  Globe,
  Activity,
  Clock,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  Info,
  RefreshCw,
  Sliders,
  Eye,
  Compass,
  CornerDownRight,
  ChevronRight,
  Filter
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingState from '../../components/common/LoadingState';
import DeceptionGraphView from '../../components/common/DeceptionGraphView';
import {
  getDeceptionEnvironments,
  getDeceptionGraph,
  getDsgTransitions,
  DEMO_DATA_DISCLAIMER
} from '../../services/mockData';

// Restrained color mapping per asset/node type
const TYPE_CONFIG = {
  web_application: { color: '#38bdf8', label: 'Web App', icon: Globe },
  api_endpoint: { color: '#3b82f6', label: 'API Endpoint', icon: Radio },
  user_identity: { color: '#a855f7', label: 'User Account', icon: User },
  synthetic_credential: { color: '#f59e0b', label: 'Credential', icon: Lock },
  file_document: { color: '#94a3b8', label: 'Document', icon: FileText },
  database: { color: '#10b981', label: 'Database', icon: Database },
  internal_service: { color: '#6366f1', label: 'Internal Service', icon: Server },
  canary_token: { color: '#f43f5e', label: 'Canary Token', icon: Zap }
};

export default function DeceptionStateGraphPage() {
  const { environmentId } = useParams();
  const navigate = useNavigate();

  const [allEnvironments, setAllEnvironments] = useState([]);
  const [currentEnvId, setCurrentEnvId] = useState(environmentId || '');
  const [graphData, setGraphData] = useState(null);
  const [transitions, setTransitions] = useState([]);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [activeLayerFilter, setActiveLayerFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Load environments list on mount
  useEffect(() => {
    getDeceptionEnvironments().then(envs => {
      setAllEnvironments(envs);
      if (!environmentId && envs.length > 0) {
        // Default to flagship environment (env-apex-auth-01) or first available
        const defaultEnv = envs.find(e => e.id === 'env-apex-auth-01') || envs[0];
        setCurrentEnvId(defaultEnv.id);
      } else if (environmentId) {
        setCurrentEnvId(environmentId);
      }
    });
  }, [environmentId]);

  // Load graph and transitions whenever currentEnvId changes
  useEffect(() => {
    if (!currentEnvId) return;

    setLoading(true);
    setNotFound(false);

    Promise.all([
      getDeceptionGraph(currentEnvId),
      getDsgTransitions(currentEnvId)
    ]).then(([graph, transList]) => {
      if (!graph || !graph.environment) {
        setNotFound(true);
        setGraphData(null);
        setTransitions([]);
      } else {
        setGraphData(graph);
        setTransitions(transList);
        // Default select the first node or keep selection if still valid
        if (graph.nodes.length > 0) {
          const exists = graph.nodes.some(n => n.id === selectedNodeId);
          if (!exists) {
            setSelectedNodeId(graph.nodes[0].id);
          }
        } else {
          setSelectedNodeId(null);
        }
      }
      setLoading(false);
    });
  }, [currentEnvId]);

  // Handler when user switches environment via dropdown
  const handleEnvironmentChange = (e) => {
    const newId = e.target.value;
    setCurrentEnvId(newId);
    navigate(`/admin/deception-state-graph/${newId}`);
  };

  // Find currently selected node object
  const selectedNode = useMemo(() => {
    if (!graphData || !selectedNodeId) return null;
    return graphData.nodes.find(n => n.id === selectedNodeId) || null;
  }, [graphData, selectedNodeId]);

  // Incoming and outgoing relationships for the selected node
  const incomingEdges = useMemo(() => {
    if (!graphData || !selectedNodeId) return [];
    return graphData.edges.filter(e => e.target === selectedNodeId);
  }, [graphData, selectedNodeId]);

  const outgoingEdges = useMemo(() => {
    if (!graphData || !selectedNodeId) return [];
    return graphData.edges.filter(e => e.source === selectedNodeId);
  }, [graphData, selectedNodeId]);

  // Map nodes by ID for fast lookup of source/target names in relationship panels
  const nodeMap = useMemo(() => {
    if (!graphData) return new Map();
    const map = new Map();
    graphData.nodes.forEach(n => map.set(n.id, n));
    return map;
  }, [graphData]);

  if (loading && !graphData && !notFound) {
    return <LoadingState message="Loading Deception State Graph topology and multi-layered decoy state..." />;
  }

  // Not Found fallback
  if (notFound) {
    return (
      <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto' }}>
        <div style={{ marginBottom: '16px' }}>
          <Link
            to="/admin/deception-environments"
            className="btn btn-ghost btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <ArrowLeft size={16} /> Back to Deception Environments
          </Link>
        </div>

        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)',
            padding: '48px 24px',
            textAlign: 'center',
            maxWidth: '640px',
            margin: '40px auto'
          }}
        >
          <AlertTriangle size={48} style={{ color: 'var(--warning-text)', marginBottom: '16px' }} />
          <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, marginBottom: '8px' }}>
            Deception Environment Not Found
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginBottom: '24px' }}>
            The requested environment identifier <code style={{ color: 'var(--accent-primary)' }}>{currentEnvId}</code> does not exist or has been removed from the platform registry.
          </p>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <Link to="/admin/deception-environments" className="btn btn-secondary">
              View All Environments
            </Link>
            {allEnvironments.length > 0 && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const first = allEnvironments[0].id;
                  setCurrentEnvId(first);
                  navigate(`/admin/deception-state-graph/${first}`);
                }}
              >
                Load Default Environment ({allEnvironments[0].id})
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const env = graphData?.environment;
  const nodes = graphData?.nodes || [];
  const edges = graphData?.edges || [];
  const layers = graphData?.layers || { immutable_policy: [], controlled_dynamic: [], observational_attacker: [] };

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Page Header */}
      <PageHeader
        title="Deception State Graph Explorer"
        description="Interactive 2D topological mapping of synthetic assets, multi-layered deception states, and observed honeynet transitions."
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Link
              to="/admin/deception-environments"
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Network size={14} /> All Environments
            </Link>
            {env && (
              <Link
                to={`/admin/deception-environments/${env.id}`}
                className="btn btn-ghost btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <ExternalLink size={14} /> Environment Details
              </Link>
            )}
          </div>
        }
      />

      {/* Fictional Demonstration Alert Banner */}
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
          <strong style={{ color: '#fff' }}>Demonstration Deception State Graph (DSG):</strong>{' '}
          {DEMO_DATA_DISCLAIMER} Topological nodes, relationships, and state adaptation transitions represent simulated gateway deception models for research demonstration.
        </div>
      </div>

      {/* Top Controls Bar: Environment Selector & Summary Pills */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px'
        }}
      >
        {/* Environment Picker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '320px' }}>
          <label htmlFor="env-select" style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Target Environment:
          </label>
          <select
            id="env-select"
            value={currentEnvId}
            onChange={handleEnvironmentChange}
            style={{
              flex: 1,
              background: 'var(--bg-canvas)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              padding: '6px 12px',
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            {allEnvironments.map(e => (
              <option key={e.id} value={e.id}>
                {e.id} — {e.name} ({e.tenantName})
              </option>
            ))}
          </select>
        </div>

        {/* Environment Meta Badges */}
        {env && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontSize: 'var(--text-xs)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Tenant:</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{env.tenantName}</span>
            </div>

            <div style={{ width: '1px', height: '14px', background: 'var(--border-subtle)' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Topology:</span>
              <span style={{ color: 'var(--accent-primary)', fontWeight: 500 }}>{env.topologyType}</span>
            </div>

            <div style={{ width: '1px', height: '14px', background: 'var(--border-subtle)' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Strategy:</span>
              <span style={{ color: '#a855f7', fontWeight: 500 }}>{env.deceptionStrategy}</span>
            </div>

            <div style={{ width: '1px', height: '14px', background: 'var(--border-subtle)' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Status:</span>
              <StatusBadge
                status={env.status === 'Active' ? 'operational' : env.status === 'Review Required' ? 'warning' : 'neutral'}
                label={`${env.status} (Simulated)`}
                size="sm"
              />
            </div>
          </div>
        )}
      </div>

      {/* Main Workspace: Graph Canvas (Left) + Node Detail Inspector (Right) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.8fr) minmax(360px, 1.2fr)',
          gap: '20px',
          marginBottom: '24px',
          alignItems: 'start'
        }}
      >
        {/* Left Column: Graph Canvas & Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Layer Filter Bar */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Filter size={14} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Filter by Layer:
              </span>
            </div>

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setActiveLayerFilter('all')}
                style={{
                  background: activeLayerFilter === 'all' ? 'var(--accent-primary)' : 'var(--bg-canvas)',
                  color: activeLayerFilter === 'all' ? '#fff' : 'var(--text-secondary)',
                  border: `1px solid ${activeLayerFilter === 'all' ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                  borderRadius: 'var(--radius-sm)',
                  padding: '4px 10px',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                All Layers ({nodes.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveLayerFilter('immutable_policy')}
                style={{
                  background: activeLayerFilter === 'immutable_policy' ? '#3b82f6' : 'var(--bg-canvas)',
                  color: activeLayerFilter === 'immutable_policy' ? '#fff' : 'var(--text-secondary)',
                  border: `1px solid ${activeLayerFilter === 'immutable_policy' ? '#3b82f6' : 'var(--border-default)'}`,
                  borderRadius: 'var(--radius-sm)',
                  padding: '4px 10px',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                L1: Policy Invariants ({layers.immutable_policy.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveLayerFilter('controlled_dynamic')}
                style={{
                  background: activeLayerFilter === 'controlled_dynamic' ? '#a855f7' : 'var(--bg-canvas)',
                  color: activeLayerFilter === 'controlled_dynamic' ? '#fff' : 'var(--text-secondary)',
                  border: `1px solid ${activeLayerFilter === 'controlled_dynamic' ? '#a855f7' : 'var(--border-default)'}`,
                  borderRadius: 'var(--radius-sm)',
                  padding: '4px 10px',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                L2: Controlled Dynamic ({layers.controlled_dynamic.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveLayerFilter('observational_attacker')}
                style={{
                  background: activeLayerFilter === 'observational_attacker' ? '#f59e0b' : 'var(--bg-canvas)',
                  color: activeLayerFilter === 'observational_attacker' ? '#fff' : 'var(--text-secondary)',
                  border: `1px solid ${activeLayerFilter === 'observational_attacker' ? '#f59e0b' : 'var(--border-default)'}`,
                  borderRadius: 'var(--radius-sm)',
                  padding: '4px 10px',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                L3: Observational State ({layers.observational_attacker.length})
              </button>
            </div>
          </div>

          {/* SVG Graph View Canvas */}
          <DeceptionGraphView
            nodes={nodes}
            edges={edges}
            selectedNodeId={selectedNodeId}
            onSelectNode={(val) => setSelectedNodeId(typeof val === 'object' && val ? val.id : val)}
            activeLayerFilter={activeLayerFilter}
          />

          {/* Quick Node Switcher Bar */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Synthetic Assets on Canvas ({nodes.length} nodes, {edges.length} relationships):
              </span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                Click any chip to focus
              </span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {nodes.map(n => {
                const isSelected = n.id === selectedNodeId;
                const conf = TYPE_CONFIG[n.type] || { color: '#94a3b8', label: n.type };
                const nodeLabel = n.name || n.displayName || n.id;
                return (
                  <button
                    key={n.id}
                    type="button"
                    data-chip-id={n.id}
                    onClick={() => setSelectedNodeId(n.id)}
                    style={{
                      background: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'var(--bg-canvas)',
                      border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                      borderRadius: 'var(--radius-sm)',
                      padding: '4px 8px',
                      fontSize: '11px',
                      color: isSelected ? '#38bdf8' : 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      cursor: 'pointer',
                      fontWeight: isSelected ? 600 : 400
                    }}
                  >
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: conf.color
                      }}
                    />
                    {nodeLabel}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Node Detail Inspector */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px'
          }}
        >
          {selectedNode ? (
            <>
              {/* Node Inspector Header */}
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: 'var(--radius-md)',
                        background: TYPE_CONFIG[selectedNode.type]?.color ? `${TYPE_CONFIG[selectedNode.type].color}18` : 'rgba(56, 189, 248, 0.1)',
                        border: `1px solid ${TYPE_CONFIG[selectedNode.type]?.color || 'var(--accent-primary)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: TYPE_CONFIG[selectedNode.type]?.color || 'var(--accent-primary)'
                      }}
                    >
                      {(() => {
                        const Icon = TYPE_CONFIG[selectedNode.type]?.icon || Layers;
                        return <Icon size={18} />;
                      })()}
                    </div>
                    <div>
                      <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {selectedNode.name || selectedNode.displayName || selectedNode.id}
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                        ID: <code style={{ color: 'var(--accent-primary)' }}>{selectedNode.id}</code>
                      </div>
                    </div>
                  </div>

                  <StatusBadge
                    status={
                      (selectedNode.simulatedState === 'Active' || selectedNode.status === 'Active')
                        ? 'operational'
                        : (selectedNode.simulatedState === 'Engaged' || selectedNode.status === 'Engaged')
                        ? 'high'
                        : (selectedNode.simulatedState === 'Triggered' || selectedNode.status === 'Triggered')
                        ? 'critical'
                        : 'neutral'
                    }
                    label={`${selectedNode.simulatedState || selectedNode.status || 'Active'} (Simulated)`}
                    size="sm"
                  />
                </div>

                {/* Layer Badge & Type */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background:
                        selectedNode.dsgLayer === 'immutable_policy'
                          ? 'rgba(59, 130, 246, 0.15)'
                          : selectedNode.dsgLayer === 'controlled_dynamic'
                          ? 'rgba(168, 85, 247, 0.15)'
                          : 'rgba(245, 158, 11, 0.15)',
                      color:
                        selectedNode.dsgLayer === 'immutable_policy'
                          ? '#60a5fa'
                          : selectedNode.dsgLayer === 'controlled_dynamic'
                          ? '#c084fc'
                          : '#fbbf24',
                      border: `1px solid ${
                        selectedNode.dsgLayer === 'immutable_policy'
                          ? 'rgba(59, 130, 246, 0.3)'
                          : selectedNode.dsgLayer === 'controlled_dynamic'
                          ? 'rgba(168, 85, 247, 0.3)'
                          : 'rgba(245, 158, 11, 0.3)'
                      }`
                    }}
                  >
                    {selectedNode.dsgLayer === 'immutable_policy'
                      ? 'L1: IMMUTABLE POLICY'
                      : selectedNode.dsgLayer === 'controlled_dynamic'
                      ? 'L2: CONTROLLED DYNAMIC'
                      : 'L3: OBSERVATIONAL ATTACKER'}
                  </span>

                  <span
                    style={{
                      fontSize: '10px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: 'var(--bg-canvas)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    {TYPE_CONFIG[selectedNode.type]?.label || selectedNode.type}
                  </span>
                </div>
              </div>

              {/* Node Overview / Description */}
              <div
                style={{
                  background: 'var(--bg-canvas)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 12px',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5
                }}
              >
                {selectedNode.description}
              </div>

              {/* Exposure Endpoint / Canary Token */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Decoy Exposure & Signaling
                </div>

                <div
                  style={{
                    background: 'var(--bg-canvas)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 12px',
                    fontSize: 'var(--text-xs)'
                  }}
                >
                  <div style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>Ingress Route / Endpoint:</div>
                  <code style={{ color: '#38bdf8', wordBreak: 'break-all' }}>
                    {selectedNode.exposureEndpoint || selectedNode.fictionalDetails?.url || selectedNode.fictionalDetails?.path || selectedNode.fictionalDetails?.internalHost || 'Internal Asset (No Direct Public Ingress)'}
                  </code>
                </div>

                {(() => {
                  const token = selectedNode.canaryToken || selectedNode.fictionalDetails?.tokenValue || (selectedNode.type === 'canary_token' ? selectedNode.fictionalDetails?.tokenSignature || selectedNode.name : null);
                  if (!token) return null;
                  return (
                    <div
                      style={{
                        background: 'rgba(244, 63, 94, 0.08)',
                        border: '1px solid rgba(244, 63, 94, 0.25)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '8px 12px',
                        fontSize: 'var(--text-xs)'
                      }}
                    >
                      <div style={{ color: '#f43f5e', fontWeight: 600, marginBottom: '2px' }}>
                        Canary Token Signature:
                      </div>
                      <code style={{ color: '#fca5a5', wordBreak: 'break-all' }}>
                        {token}
                      </code>
                    </div>
                  );
                })()}
              </div>

              {/* Technical Decoy Configuration Parameters */}
              {(() => {
                const params = selectedNode.fictionalDetails || selectedNode.technicalDecoyParameters || {};
                const entries = Object.entries(params);
                if (entries.length === 0) return null;
                return (
                  <div>
                    <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Simulated Configuration Parameters
                    </div>
                    <div
                      style={{
                        background: 'var(--bg-canvas)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '8px 12px',
                        fontSize: '11px',
                        fontFamily: 'monospace'
                      }}
                    >
                      {entries.map(([key, val]) => (
                        <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                          <span style={{ color: 'var(--text-muted)' }}>{key}:</span>
                          <span style={{ color: 'var(--text-primary)' }}>{String(val)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Relationship Inspector: Incoming & Outgoing Edges */}
              <div>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Topological Relationships ({incomingEdges.length} In, {outgoingEdges.length} Out)
                </div>

                {/* Outgoing Edges */}
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
                    Outgoing Links (Originates from this node):
                  </div>
                  {outgoingEdges.length === 0 ? (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', paddingLeft: '4px' }}>
                      No outgoing edges (terminal node)
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {outgoingEdges.map(e => {
                        const targetNode = nodeMap.get(e.target);
                        return (
                          <div
                            key={e.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              background: 'var(--bg-canvas)',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '6px 10px',
                              fontSize: '11px'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                                {e.label || e.type}
                              </span>
                              <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />
                              <span style={{ color: 'var(--text-primary)' }}>
                                {targetNode?.displayName || e.target}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedNodeId(e.target)}
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '2px 6px', height: '22px', fontSize: '10px' }}
                            >
                              Jump
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Incoming Edges */}
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
                    Incoming Links (Points to this node):
                  </div>
                  {incomingEdges.length === 0 ? (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', paddingLeft: '4px' }}>
                      No incoming edges (root ingress node)
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {incomingEdges.map(e => {
                        const sourceNode = nodeMap.get(e.source);
                        return (
                          <div
                            key={e.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              background: 'var(--bg-canvas)',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '6px 10px',
                              fontSize: '11px'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ color: 'var(--text-primary)' }}>
                                {sourceNode?.displayName || e.source}
                              </span>
                              <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />
                              <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                                {e.label || e.type}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedNodeId(e.source)}
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '2px 6px', height: '22px', fontSize: '10px' }}
                            >
                              Jump
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Jump to Environment Details */}
              <div style={{ paddingTop: '8px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: '8px' }}>
                <Link
                  to={`/admin/deception-environments/${env?.id}`}
                  className="btn btn-secondary btn-sm"
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  View in Environment Details
                </Link>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setSelectedNodeId(null)}
                >
                  Clear Selection
                </button>
              </div>
            </>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '48px 16px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                minHeight: '360px'
              }}
            >
              <Layers size={36} style={{ marginBottom: '12px', opacity: 0.5 }} />
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                No Node Selected
              </div>
              <div style={{ fontSize: 'var(--text-xs)', maxWidth: '280px', lineHeight: 1.5, marginBottom: '16px' }}>
                Click on any node in the graph canvas to inspect its configuration parameters, ingress endpoints, and multi-hop relationships.
              </div>
              {nodes.length > 0 && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setSelectedNodeId(nodes[0].id)}
                >
                  Select First Node ({nodes[0].name || nodes[0].displayName || nodes[0].id})
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* State Layers Information Panel */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          padding: '24px',
          marginBottom: '24px'
        }}
      >
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} style={{ color: 'var(--accent-primary)' }} />
            Conceptual Deception State Graph Layers
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
            The AI-Enabled Cyber Deception Gateway organizes synthetic topologies into three distinct functional layers. This layered model guarantees that core security invariants and containment tripwires remain immutable, while deceptive surfaces dynamically adapt to observed attacker behaviors.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          {/* Layer 1: Immutable / Protected Deception Policy */}
          <div
            style={{
              background: 'var(--bg-canvas)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shield size={16} style={{ color: '#3b82f6' }} />
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: '#60a5fa' }}>
                  Layer 1: Immutable Policy
                </span>
              </div>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '10px',
                  background: 'rgba(59, 130, 246, 0.15)',
                  color: '#60a5fa'
                }}
              >
                {layers.immutable_policy.length} Nodes
              </span>
            </div>

            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Core invariants, containment boundaries, and tripwire egress rules. These nodes define non-negotiable gateway defenses that cannot be altered or bypassed by simulated adaptive actions.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: 'auto' }}>
              {layers.immutable_policy.map(n => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setSelectedNodeId(n.id)}
                  style={{
                    background: selectedNodeId === n.id ? 'rgba(59, 130, 246, 0.3)' : 'var(--bg-card)',
                    border: `1px solid ${selectedNodeId === n.id ? '#3b82f6' : 'var(--border-subtle)'}`,
                    borderRadius: 'var(--radius-sm)',
                    padding: '3px 8px',
                    fontSize: '11px',
                    color: '#93c5fd',
                    cursor: 'pointer'
                  }}
                >
                  {n.name || n.displayName || n.id}
                </button>
              ))}
            </div>
          </div>

          {/* Layer 2: Controlled Dynamic State */}
          <div
            style={{
              background: 'var(--bg-canvas)',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sliders size={16} style={{ color: '#a855f7' }} />
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: '#c084fc' }}>
                  Layer 2: Controlled Dynamic
                </span>
              </div>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '10px',
                  background: 'rgba(168, 85, 247, 0.15)',
                  color: '#c084fc'
                }}
              >
                {layers.controlled_dynamic.length} Nodes
              </span>
            </div>

            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Adaptable decoy applications, synthetic APIs, mock identity stores, and honeynet services. These nodes shift parameters, inject synthetic delays, or alter simulated error responses based on detected attacker tactics.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: 'auto' }}>
              {layers.controlled_dynamic.map(n => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setSelectedNodeId(n.id)}
                  style={{
                    background: selectedNodeId === n.id ? 'rgba(168, 85, 247, 0.3)' : 'var(--bg-card)',
                    border: `1px solid ${selectedNodeId === n.id ? '#a855f7' : 'var(--border-subtle)'}`,
                    borderRadius: 'var(--radius-sm)',
                    padding: '3px 8px',
                    fontSize: '11px',
                    color: '#d8b4fe',
                    cursor: 'pointer'
                  }}
                >
                  {n.name || n.displayName || n.id}
                </button>
              ))}
            </div>
          </div>

          {/* Layer 3: Observational Attacker State */}
          <div
            style={{
              background: 'var(--bg-canvas)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Eye size={16} style={{ color: '#f59e0b' }} />
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: '#fbbf24' }}>
                  Layer 3: Observational Attacker
                </span>
              </div>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '10px',
                  background: 'rgba(245, 158, 11, 0.15)',
                  color: '#fbbf24'
                }}
              >
                {layers.observational_attacker.length} Nodes
              </span>
            </div>

            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Tainted documents, decoy session cookies, canary files, and honeynet tokens. These assets track attacker persistence, exfiltration attempts, and lateral movement across synthetic terrain without exposing real infrastructure.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: 'auto' }}>
              {layers.observational_attacker.map(n => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setSelectedNodeId(n.id)}
                  style={{
                    background: selectedNodeId === n.id ? 'rgba(245, 158, 11, 0.3)' : 'var(--bg-card)',
                    border: `1px solid ${selectedNodeId === n.id ? '#f59e0b' : 'var(--border-subtle)'}`,
                    borderRadius: 'var(--radius-sm)',
                    padding: '3px 8px',
                    fontSize: '11px',
                    color: '#fde68a',
                    cursor: 'pointer'
                  }}
                >
                  {n.name || n.displayName || n.id}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Simulated Adaptation History Timeline / Event Stream */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          padding: '24px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={18} style={{ color: 'var(--accent-primary)' }} />
              Simulated Graph Adaptation History & Transition Stream
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
              Chronological log of simulated graph adaptations triggered by observed attacker behaviors and policy decisions.
            </p>
          </div>

          <span
            style={{
              fontSize: 'var(--text-xs)',
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(59, 130, 246, 0.1)',
              color: '#60a5fa',
              border: '1px solid rgba(59, 130, 246, 0.2)'
            }}
          >
            {transitions.length} Recorded Transitions
          </span>
        </div>

        {transitions.length === 0 ? (
          <div
            style={{
              padding: '32px 16px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: 'var(--text-xs)',
              background: 'var(--bg-canvas)',
              borderRadius: 'var(--radius-sm)',
              border: '1px dashed var(--border-default)'
            }}
          >
            No simulated adaptations recorded for this environment yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {transitions.map((tr) => (
              <div
                key={tr.id}
                style={{
                  background: 'var(--bg-canvas)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                {/* Transition Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <code style={{ fontSize: '11px', color: 'var(--accent-primary)', fontWeight: 600 }}>{tr.id}</code>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>•</span>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{tr.timestamp}</span>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>•</span>
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background:
                          tr.dsgLayerAffected === 'immutable_policy'
                            ? 'rgba(59, 130, 246, 0.15)'
                            : tr.dsgLayerAffected === 'controlled_dynamic'
                            ? 'rgba(168, 85, 247, 0.15)'
                            : 'rgba(245, 158, 11, 0.15)',
                        color:
                          tr.dsgLayerAffected === 'immutable_policy'
                            ? '#60a5fa'
                            : tr.dsgLayerAffected === 'controlled_dynamic'
                            ? '#c084fc'
                            : '#fbbf24'
                      }}
                    >
                      {tr.dsgLayerAffected === 'immutable_policy'
                        ? 'L1: Policy'
                        : tr.dsgLayerAffected === 'controlled_dynamic'
                        ? 'L2: Dynamic'
                        : 'L3: Attacker'}
                    </span>
                  </div>

                  <span
                    style={{
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      fontStyle: 'italic'
                    }}
                  >
                    Evidence: <code style={{ color: 'var(--accent-primary)' }}>{tr.evidenceReference}</code>
                  </span>
                </div>

                {/* State Change Badge Flow */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--text-xs)', flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--text-muted)' }}>State Transition:</span>
                  <span
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    {tr.previousState}
                  </span>
                  <ArrowRight size={14} style={{ color: 'var(--accent-primary)' }} />
                  <span
                    style={{
                      background: 'rgba(56, 189, 248, 0.12)',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-sm)',
                      color: '#38bdf8',
                      fontWeight: 600
                    }}
                  >
                    {tr.newState}
                  </span>
                </div>

                {/* Trigger Condition */}
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Trigger:</strong> {tr.trigger}
                </div>

                {/* Strategic Rationale & Adaptation Action */}
                <div
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-muted)',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 12px',
                    lineHeight: 1.5
                  }}
                >
                  <strong style={{ color: 'var(--accent-primary)' }}>AI Adaptation Rationale:</strong>{' '}
                  {tr.adaptationAction}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
