import React from 'react';
import { 
  ArrowRight, 
  ShieldCheck, 
  AlertTriangle, 
  Cpu, 
  Sliders, 
  Network, 
  Server, 
  Database,
  Lock,
  CornerDownRight,
  Sparkles,
  CheckCircle2
} from 'lucide-react';

export default function HeroVisualization() {
  return (
    <div className="hero-vis-container" aria-label="Conceptual diagram of the Adaptive Deception Gateway architecture">
      {/* Top Header Tag */}
      <div className="hero-vis-header">
        <div className="hero-vis-badge">
          <span className="hero-vis-pulse-dot" aria-hidden="true"></span>
          <span>CONCEPTUAL GATEWAY LIFECYCLE</span>
        </div>
        <span className="hero-vis-sim-tag">Simulated Model</span>
      </div>

      <div className="hero-vis-body">
        {/* Step 1: Ingress Traffic Request */}
        <div className="hero-vis-step hero-vis-ingress">
          <div className="hero-vis-step-label">
            <span className="hero-vis-step-num">01</span>
            <span>INCOMING REQUEST (SIMULATED)</span>
          </div>
          <div className="hero-vis-card">
            <div className="hero-vis-http-line">
              <span className="hero-vis-method">POST</span>
              <span className="hero-vis-path">/api/v1/auth/tokens</span>
            </div>
            <div className="hero-vis-meta-tags">
              <span className="hero-vis-tag">Origin: 198.51.100.74</span>
              <span className="hero-vis-tag">Burst: 24 req/sec</span>
              <span className="hero-vis-tag hero-vis-tag-warn">Malformed UA</span>
            </div>
          </div>
        </div>

        {/* Connector Line */}
        <div className="hero-vis-flow-arrow" aria-hidden="true">
          <svg width="24" height="28" viewBox="0 0 24 28" fill="none">
            <path d="M12 0V22M12 22L6 16M12 22L18 16" stroke="var(--border-strong)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* Step 2: Gateway Assessment & Policy Evaluation Core */}
        <div className="hero-vis-step hero-vis-engine">
          <div className="hero-vis-step-label">
            <span className="hero-vis-step-num">02</span>
            <span>BEHAVIORAL ASSESSMENT & POLICY EVALUATION</span>
          </div>
          <div className="hero-vis-engine-box">
            <div className="hero-vis-engine-col">
              <div className="hero-vis-subhead">
                <Cpu size={14} className="hero-vis-icon-cyan" aria-hidden="true" />
                <span>Detector Interpretation</span>
              </div>
              <div className="hero-vis-metric-row">
                <span className="hero-vis-metric-name">Credential Stuffing</span>
                <span className="hero-vis-badge-warn">Score: 0.91</span>
              </div>
              <div className="hero-vis-metric-row">
                <span className="hero-vis-metric-name">Behavioral Pattern</span>
                <span className="hero-vis-badge-muted">Synthetic Probe</span>
              </div>
            </div>

            <div className="hero-vis-divider-vert" aria-hidden="true"></div>

            <div className="hero-vis-engine-col">
              <div className="hero-vis-subhead">
                <Sliders size={14} className="hero-vis-icon-purple" aria-hidden="true" />
                <span>Policy & Strategy Safety</span>
              </div>
              <div className="hero-vis-metric-row">
                <span className="hero-vis-metric-name">Governing Policy</span>
                <span className="hero-vis-badge-green">pol-sec-01: Valid</span>
              </div>
              <div className="hero-vis-metric-row">
                <span className="hero-vis-metric-name">Isolation Guard</span>
                <span className="hero-vis-badge-blue">Zero Egress Enforced</span>
              </div>
            </div>
          </div>
        </div>

        {/* Connector Line with Fork */}
        <div className="hero-vis-flow-arrow" aria-hidden="true">
          <svg width="24" height="28" viewBox="0 0 24 28" fill="none">
            <path d="M12 0V22M12 22L6 16M12 22L18 16" stroke="var(--border-strong)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* Step 3: Bifurcated Intended Routing Destination */}
        <div className="hero-vis-step hero-vis-destinations">
          <div className="hero-vis-step-label">
            <span className="hero-vis-step-num">03</span>
            <span>INTENDED ROUTING DECISION</span>
          </div>

          <div className="hero-vis-dest-grid">
            {/* Real Application - Protected & Shielded */}
            <div className="hero-vis-dest-card hero-vis-dest-real">
              <div className="hero-vis-dest-header">
                <div className="hero-vis-dest-icon">
                  <Lock size={15} className="hero-vis-icon-green" aria-hidden="true" />
                </div>
                <div>
                  <div className="hero-vis-dest-title">Protected Application</div>
                  <div className="hero-vis-dest-sub">Production Core API</div>
                </div>
              </div>
              <div className="hero-vis-dest-status">
                <CheckCircle2 size={13} className="hero-vis-icon-green" aria-hidden="true" />
                <span>Shielded · Traffic Diverted</span>
              </div>
            </div>

            {/* Synthetic Deception Sink - Isolated Container */}
            <div className="hero-vis-dest-card hero-vis-dest-deception">
              <div className="hero-vis-dest-header">
                <div className="hero-vis-dest-icon">
                  <Network size={15} className="hero-vis-icon-purple" aria-hidden="true" />
                </div>
                <div>
                  <div className="hero-vis-dest-title">Synthetic Deception Sink</div>
                  <div className="hero-vis-dest-sub">env-apex-auth-01 (Isolated)</div>
                </div>
              </div>
              <div className="hero-vis-dest-status hero-vis-dest-status-active">
                <CornerDownRight size={13} className="hero-vis-icon-purple" aria-hidden="true" />
                <span>Intended Route: Deception Diversion</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Callout */}
      <div className="hero-vis-footer">
        <span className="hero-vis-footer-text">
          <strong>Notice:</strong> Conceptual research architecture. Demonstrates intended policy routing and isolation boundaries; no live network connections or autonomous honeynet deployments are active.
        </span>
      </div>
    </div>
  );
}
