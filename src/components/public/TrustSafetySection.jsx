import React from 'react';
import { 
  FileCheck2, 
  ShieldAlert, 
  GitFork, 
  HelpCircle, 
  AlertOctagon,
  Scale
} from 'lucide-react';

export default function TrustSafetySection() {
  const principles = [
    {
      num: '01',
      title: 'Evidence Before Interpretation',
      icon: FileCheck2,
      iconColor: '#38bdf8',
      desc: 'Separates immutable, directly recorded telemetry (request bytes, packet origin, arrival timestamps) from probabilistic detector models or analytical risk scores.'
    },
    {
      num: '02',
      title: 'Policy Before Adaptation',
      icon: ShieldAlert,
      iconColor: '#ef4444',
      desc: 'Dynamic decoy mutations and state transformations are strictly subservient to enterprise security policies. Automated systems can never relax containment rules.'
    },
    {
      num: '03',
      title: 'Intent Is Not Outcome',
      icon: GitFork,
      iconColor: '#fbbf24',
      desc: 'A policy decision to divert traffic or drop a connection is an intended route, not proof of execution. Actual edge proxy status must be tracked independently.'
    },
    {
      num: '04',
      title: 'Unknown Is Not Safe',
      icon: HelpCircle,
      iconColor: '#a855f7',
      desc: 'Missing telemetry, stripped headers, and incomplete behavioral evidence are explicitly labeled Unknown / Not Recorded. Telemetry absence never implies benign intent.'
    }
  ];

  return (
    <section className="landing-section landing-trust-section" id="trust">
      <div className="landing-container">
        {/* Section Header */}
        <div className="landing-section-header">
          <div className="landing-eyebrow">ETHICAL & OPERATIONAL GOVERNANCE</div>
          <h2 className="landing-section-title">
            Security decisions need evidence and enforceable boundaries.
          </h2>
          <p className="landing-section-lead">
            Autonomous or adaptive defensive systems introduce severe operational risks if allowed to operate 
            as unverified black boxes. The Adaptive Deception Gateway is built upon four non-negotiable architectural axioms.
          </p>
        </div>

        {/* Four Principles Grid */}
        <div className="landing-grid-4">
          {principles.map((p, idx) => {
            const Icon = p.icon;
            return (
              <div key={idx} className="landing-trust-card">
                <div className="landing-trust-top">
                  <span className="landing-trust-num">{p.num}</span>
                  <div className="landing-trust-icon" style={{ color: p.iconColor }}>
                    <Icon size={20} aria-hidden="true" />
                  </div>
                </div>
                <h3 className="landing-trust-title">{p.title}</h3>
                <p className="landing-trust-desc">{p.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Prominent Transparency Notice Card */}
        <div className="transparency-notice-box" role="note" aria-label="Platform Transparency Notice">
          <div className="transparency-notice-header">
            <AlertOctagon size={20} className="transparency-notice-icon" aria-hidden="true" />
            <h4 className="transparency-notice-title">Platform Transparency & Scope Statement</h4>
          </div>
          <p className="transparency-notice-content">
            The current application includes simulated workflows and predefined scenario fixtures. 
            Live request inspection, production traffic routing, autonomous deception execution, 
            and real-world detection performance are not established by the frontend alone.
          </p>
          <div className="transparency-notice-footer">
            All console views, threat profiles, and simulation runs operate within a controlled client-side research environment.
          </div>
        </div>
      </div>
    </section>
  );
}
