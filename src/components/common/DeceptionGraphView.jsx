import React, { useState, useMemo } from 'react';
import {
  Globe,
  Radio,
  User,
  Key,
  FileText,
  Database,
  Server,
  Zap,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Layers,
  ArrowRight
} from 'lucide-react';

// Restrained color mapping per asset/node type
const TYPE_CONFIG = {
  web_application: { color: '#38bdf8', label: 'Web App', bg: 'rgba(56, 189, 248, 0.12)' },
  api_endpoint: { color: '#3b82f6', label: 'API Endpoint', bg: 'rgba(59, 130, 246, 0.12)' },
  user_identity: { color: '#a855f7', label: 'User Account', bg: 'rgba(168, 85, 247, 0.12)' },
  synthetic_credential: { color: '#f59e0b', label: 'Credential', bg: 'rgba(245, 158, 11, 0.12)' },
  file_document: { color: '#94a3b8', label: 'Document', bg: 'rgba(148, 163, 184, 0.12)' },
  database: { color: '#10b981', label: 'Database', bg: 'rgba(16, 185, 129, 0.12)' },
  internal_service: { color: '#6366f1', label: 'Internal Service', bg: 'rgba(99, 102, 241, 0.12)' },
  canary_token: { color: '#f43f5e', label: 'Canary Token', bg: 'rgba(244, 63, 94, 0.12)' }
};

const STATE_DOTS = {
  Active: '#10b981',
  Engaged: '#8b5cf6',
  Standby: '#eab308',
  Triggered: '#ef4444',
  Quarantined: '#f97316'
};

export default function DeceptionGraphView({
  nodes = [],
  edges = [],
  selectedNodeId,
  onSelectNode,
  activeLayerFilter = 'all'
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hoveredNodeId, setHoveredNodeId] = useState(null);

  // Map nodes by ID for fast lookup
  const nodeMap = useMemo(() => {
    const map = new Map();
    nodes.forEach(n => map.set(n.id, n));
    return map;
  }, [nodes]);

  // Filter nodes & edges by layer if specified
  const filteredNodes = useMemo(() => {
    if (activeLayerFilter === 'all') return nodes;
    return nodes.filter(n => n.dsgLayer === activeLayerFilter);
  }, [nodes, activeLayerFilter]);

  const filteredEdges = useMemo(() => {
    const activeNodeIds = new Set(filteredNodes.map(n => n.id));
    return edges.filter(e => activeNodeIds.has(e.source) && activeNodeIds.has(e.target));
  }, [edges, filteredNodes]);

  const handleZoomIn = () => setZoom(z => Math.min(1.6, z + 0.15));
  const handleZoomOut = () => setZoom(z => Math.max(0.65, z - 0.15));
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Node dimension constants
  const NODE_WIDTH = 154;
  const NODE_HEIGHT = 46;

  if (nodes.length === 0) {
    return (
      <div
        style={{
          height: '420px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-canvas)',
          border: '1px dashed var(--border-default)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-muted)'
        }}
      >
        <Layers size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>No Graph Nodes Available</div>
        <div style={{ fontSize: 'var(--text-xs)' }}>This environment currently has no synthetic assets mapped.</div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'relative',
        background: '#090d16',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden'
      }}
    >
      {/* Controls Bar */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          display: 'flex',
          gap: '4px',
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(8px)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          padding: '4px',
          zIndex: 10
        }}
      >
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={handleZoomIn}
          title="Zoom In"
          style={{ padding: '4px 6px', height: '28px' }}
        >
          <ZoomIn size={14} />
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={handleZoomOut}
          title="Zoom Out"
          style={{ padding: '4px 6px', height: '28px' }}
        >
          <ZoomOut size={14} />
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={handleResetZoom}
          title="Reset View"
          style={{ padding: '4px 6px', height: '28px' }}
        >
          <RotateCcw size={14} />
        </button>
      </div>

      {/* SVG Canvas */}
      <svg
        viewBox="0 0 820 480"
        style={{
          width: '100%',
          height: '460px',
          display: 'block',
          userSelect: 'none'
        }}
      >
        <defs>
          {/* Subtle Grid Background Pattern */}
          <pattern id="dsgGrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="20" cy="20" r="1" fill="rgba(148, 163, 184, 0.12)" />
          </pattern>

          {/* Directed Edge Marker Arrows */}
          <marker
            id="dsgArrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill="#3b82f6" opacity="0.8" />
          </marker>

          <marker
            id="dsgArrowHighlighted"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="8"
            markerHeight="8"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill="#8b5cf6" />
          </marker>

          <marker
            id="dsgArrowCanary"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill="#f43f5e" opacity="0.9" />
          </marker>
        </defs>

        {/* Background Grid */}
        <rect width="100%" height="100%" fill="url(#dsgGrid)" />

        {/* Transform Group for Zoom & Pan */}
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* EDGES: Rendered STRICTLY BEHIND nodes */}
          <g className="dsg-edges-group">
            {filteredEdges.map((edge) => {
              const src = nodeMap.get(edge.source);
              const tgt = nodeMap.get(edge.target);
              if (!src || !tgt) return null;

              // Center coordinates
              const x1 = src.x + NODE_WIDTH / 2;
              const y1 = src.y + NODE_HEIGHT / 2;
              const x2 = tgt.x + NODE_WIDTH / 2;
              const y2 = tgt.y + NODE_HEIGHT / 2;

              // Calculate edge intersection offset so arrow doesn't hide behind node
              const dx = x2 - x1;
              const dy = y2 - y1;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;

              // Stop edge slightly outside target node box
              const targetOffsetX = (dx / dist) * (NODE_WIDTH / 2 + 6);
              const targetOffsetY = (dy / dist) * (NODE_HEIGHT / 2 + 6);
              const endX = x2 - targetOffsetX;
              const endY = y2 - targetOffsetY;

              // Edge Midpoint for label
              const midX = (x1 + endX) / 2;
              const midY = (y1 + endY) / 2;

              const isHighlighted =
                hoveredNodeId === edge.source ||
                hoveredNodeId === edge.target ||
                selectedNodeId === edge.source ||
                selectedNodeId === edge.target;

              const isCanary = edge.type === 'MONITORS';

              const strokeColor = isHighlighted
                ? '#8b5cf6'
                : isCanary
                ? 'rgba(244, 63, 94, 0.65)'
                : 'rgba(59, 130, 246, 0.45)';

              const markerId = isHighlighted
                ? 'url(#dsgArrowHighlighted)'
                : isCanary
                ? 'url(#dsgArrowCanary)'
                : 'url(#dsgArrow)';

              return (
                <g key={edge.id} style={{ transition: 'opacity 0.2s' }}>
                  {/* Directed Edge Line */}
                  <line
                    x1={x1}
                    y1={y1}
                    x2={endX}
                    y2={endY}
                    stroke={strokeColor}
                    strokeWidth={isHighlighted ? 2.2 : 1.5}
                    strokeDasharray={edge.dsgLayer === 'observational_attacker' ? '4 3' : 'none'}
                    markerEnd={markerId}
                  />

                  {/* Relationship Label Pill */}
                  <g transform={`translate(${midX}, ${midY})`}>
                    <rect
                      x="-38"
                      y="-9"
                      width="76"
                      height="18"
                      rx="4"
                      fill="#0b1120"
                      stroke={isHighlighted ? '#8b5cf6' : 'rgba(51, 65, 85, 0.8)'}
                      strokeWidth="1"
                    />
                    <text
                      textAnchor="middle"
                      y="3.5"
                      fill={isHighlighted ? '#f8fafc' : '#94a3b8'}
                      fontSize="9"
                      fontFamily="var(--font-mono)"
                      fontWeight="500"
                    >
                      {edge.type}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>

          {/* NODES: Rendered in front of edges */}
          <g className="dsg-nodes-group">
            {filteredNodes.map((node) => {
              const cfg = TYPE_CONFIG[node.type] || { color: '#3b82f6', label: node.type, bg: 'rgba(59, 130, 246, 0.1)' };
              const isSelected = selectedNodeId === node.id;
              const isHovered = hoveredNodeId === node.id;
              const statusDotColor = STATE_DOTS[node.simulatedState] || '#64748b';

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  onClick={() => onSelectNode && onSelectNode(node.id, node)}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  style={{ cursor: 'pointer' }}
                  data-node-id={node.id}
                >
                  {/* Selection Glow / Ring */}
                  {isSelected && (
                    <rect
                      x="-4"
                      y="-4"
                      width={NODE_WIDTH + 8}
                      height={NODE_HEIGHT + 8}
                      rx="10"
                      fill="none"
                      stroke="#8b5cf6"
                      strokeWidth="2.5"
                      opacity="0.9"
                    />
                  )}

                  {/* Node Box */}
                  <rect
                    width={NODE_WIDTH}
                    height={NODE_HEIGHT}
                    rx="6"
                    fill="#0f172a"
                    stroke={isSelected ? '#8b5cf6' : isHovered ? cfg.color : 'rgba(36, 53, 83, 0.95)'}
                    strokeWidth={isSelected || isHovered ? 1.8 : 1.2}
                  />

                  {/* Left Accent Color Strip */}
                  <rect
                    width="4"
                    height={NODE_HEIGHT}
                    rx="2"
                    fill={cfg.color}
                  />

                  {/* State Pulse Dot */}
                  <circle
                    cx="16"
                    cy="16"
                    r="4"
                    fill={statusDotColor}
                  />

                  {/* Node Title (Truncated if needed) */}
                  <text
                    x="26"
                    y="19"
                    fill="#f8fafc"
                    fontSize="11"
                    fontWeight="600"
                    fontFamily="var(--font-sans)"
                  >
                    {node.name.length > 15 ? `${node.name.slice(0, 14)}…` : node.name}
                  </text>

                  {/* Type Badge Tag */}
                  <rect
                    x="25"
                    y="27"
                    width="70"
                    height="13"
                    rx="3"
                    fill={cfg.bg}
                  />
                  <text
                    x="28"
                    y="36"
                    fill={cfg.color}
                    fontSize="8.5"
                    fontFamily="var(--font-mono)"
                    fontWeight="600"
                  >
                    {cfg.label.toUpperCase()}
                  </text>

                  {/* Layer Icon Indicator on Right */}
                  <text
                    x={NODE_WIDTH - 8}
                    y="36"
                    textAnchor="end"
                    fill="#64748b"
                    fontSize="8"
                    fontFamily="var(--font-mono)"
                  >
                    {node.dsgLayer === 'immutable_policy'
                      ? 'L1:POLICY'
                      : node.dsgLayer === 'controlled_dynamic'
                      ? 'L2:DYNAMIC'
                      : 'L3:ATTACKER'}
                  </text>
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      {/* Graph Legend */}
      <div
        style={{
          borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface-elevated)',
          padding: '0.625rem 1rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1.25rem',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: 'var(--text-secondary)'
        }}
      >
        {/* Node Types Legend */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Node Types:</span>
          {Object.entries(TYPE_CONFIG).slice(0, 5).map(([typeKey, cfg]) => (
            <div key={typeKey} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: cfg.color }} />
              <span>{cfg.label}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f43f5e' }} />
            <span>Canary</span>
          </div>
        </div>

        {/* Edge Types Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Relationships:</span>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-primary-light)' }}>
            EXPOSES • AUTHENTICATES • ACCESSES • CONNECTS • MONITORS
          </span>
        </div>
      </div>
    </div>
  );
}
