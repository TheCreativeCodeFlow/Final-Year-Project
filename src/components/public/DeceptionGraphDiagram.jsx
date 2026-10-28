import React from 'react';
import { 
  ShieldAlert, 
  Layers, 
  Eye, 
  Lock, 
  Sliders, 
  Network, 
  CheckCircle2, 
  XCircle, 
  ArrowDown, 
  ArrowUp,
  Info
} from 'lucide-react';

export default function DeceptionGraphDiagram() {
  return (
    <section className="landing-section landing-dsg-section" id="adaptive-deception">
      <div className="landing-container">
        {/* Section Header */}
        <div className="landing-section-header">
          <div className="landing-eyebrow">RESEARCH ARCHITECTURE</div>
          <h2 className="landing-section-title">
            A deception environment that can adapt—within defined boundaries.
          </h2>
          <p className="landing-section-lead">
            The core theoretical contribution of this research is the <strong>Deception State Graph (DSG)</strong>. 
            Rather than relying on unconstrained generative agents or brittle static decoys, the DSG partitions 
            the deception space into three distinct conceptual layers to ensure absolute security containment.
          </p>
        </div>

        {/* Three-Layer Diagram Container */}
        <div className="dsg-diagram-wrapper">
          <div className="dsg-layers-container">
            {/* Layer 1: Protected Deception Policy */}
            <div className="dsg-layer-card dsg-layer-policy">
              <div className="dsg-layer-header">
                <div className="dsg-layer-badge dsg-badge-red">
                  <Lock size={14} aria-hidden="true" />
                  <span>LAYER 1: IMMUTABLE GOVERNANCE</span>
                </div>
                <span className="dsg-layer-title">Protected Deception Policy</span>
              </div>
              <p className="dsg-layer-desc">
                Defines mandatory multi-tenant isolation, egress prohibitions, air-gap thresholds, and banned actions. 
                This layer represents non-negotiable enterprise boundaries: <strong>dynamic adaptations cannot override, 
                relax, or circumvent policy rules under any circumstances.</strong>
              </p>
              <div className="dsg-layer-pills">
                <span className="dsg-pill dsg-pill-strict"><XCircle size={12} aria-hidden="true" /> Zero Raw Socket Egress</span>
                <span className="dsg-pill dsg-pill-strict"><XCircle size={12} aria-hidden="true" /> No Internal VPC Traversal</span>
                <span className="dsg-pill dsg-pill-strict"><CheckCircle2 size={12} aria-hidden="true" /> Fail-Closed Quarantine</span>
              </div>
            </div>

            {/* Inter-layer Constraint Flow */}
            <div className="dsg-flow-connector" aria-label="Policy constrains dynamic adaptations">
              <div className="dsg-flow-line">
                <span className="dsg-flow-text">Strict Policy Guardrails Enforce Boundaries ↓</span>
              </div>
            </div>

            {/* Layer 2: Controlled Dynamic State */}
            <div className="dsg-layer-card dsg-layer-dynamic">
              <div className="dsg-layer-header">
                <div className="dsg-layer-badge dsg-badge-purple">
                  <Sliders size={14} aria-hidden="true" />
                  <span>LAYER 2: SYNTHETIC ASSETS</span>
                </div>
                <span className="dsg-layer-title">Controlled Dynamic State</span>
              </div>
              <p className="dsg-layer-desc">
                Represents the synthetic topology available to the adversary: simulated container sinks, mocked database 
                schemas, fake JWT signing keys, decoy endpoints, and dynamic tarpit response latencies. State changes 
                are evaluated as proposed mutations subject to policy validation.
              </p>
              <div className="dsg-layer-pills">
                <span className="dsg-pill dsg-pill-dynamic"><Network size={12} aria-hidden="true" /> Synthetic JWT Endpoints</span>
                <span className="dsg-pill dsg-pill-dynamic"><Network size={12} aria-hidden="true" /> Decoy Auth DB Schema</span>
                <span className="dsg-pill dsg-pill-dynamic"><Network size={12} aria-hidden="true" /> Adaptive Tarpit Delay (850ms)</span>
              </div>
            </div>

            {/* Inter-layer Observational Feedback Flow */}
            <div className="dsg-flow-connector" aria-label="Observations inform synthetic state mutations">
              <div className="dsg-flow-line">
                <span className="dsg-flow-text">↑ Observed Adversary Behaviors Inform Candidate Mutations</span>
              </div>
            </div>

            {/* Layer 3: Observational Attacker State */}
            <div className="dsg-layer-card dsg-layer-observational">
              <div className="dsg-layer-header">
                <div className="dsg-layer-badge dsg-badge-cyan">
                  <Eye size={14} aria-hidden="true" />
                  <span>LAYER 3: TELEMETRY</span>
                </div>
                <span className="dsg-layer-title">Observational Attacker State</span>
              </div>
              <p className="dsg-layer-desc">
                Tracks recorded session telemetry, payload fingerprints, command sequences, and anomaly scores. 
                Crucially, this layer captures observed behavioral facts without claiming unverified real-world identity 
                or attribution unless independently established by external intelligence.
              </p>
              <div className="dsg-layer-pills">
                <span className="dsg-pill dsg-pill-obs">Observed Commands: 42</span>
                <span className="dsg-pill dsg-pill-obs">Canary Token Triggered: usr_canary_89</span>
                <span className="dsg-pill dsg-pill-obs">Identity Status: Unverified / Inferred</span>
              </div>
            </div>
          </div>

          {/* Central Safe-Guards Quotation & Axiom */}
          <div className="dsg-quote-box">
            <ShieldAlert size={22} className="dsg-quote-icon" aria-hidden="true" />
            <blockquote className="dsg-quote-text">
              “Adaptive changes are proposed only within defined safeguards. Unknown evidence, 
              failed isolation checks, and prohibited actions must not be treated as permission to proceed.”
            </blockquote>
          </div>
        </div>

        {/* Prototype Scope Note */}
        <div className="landing-disclaimer-card" style={{ marginTop: '2rem' }}>
          <Info size={18} className="landing-disclaimer-icon" aria-hidden="true" />
          <div className="landing-disclaimer-text">
            <strong>Theoretical Model vs. Frontend Prototype:</strong> The Deception State Graph architecture 
            defines the formal graph schema and containment theorems of this research project. In the current 
            frontend, this is visualized through the interactive Deception State Graph Explorer, where simulated nodes, 
            relationships, and adaptation events can be inspected without live honeynet infrastructure.
          </div>
        </div>
      </div>
    </section>
  );
}
