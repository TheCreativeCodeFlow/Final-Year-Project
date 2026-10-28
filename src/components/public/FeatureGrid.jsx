import React from 'react';
import { 
  ShieldAlert, 
  UserCheck, 
  Sliders, 
  Server, 
  Network, 
  PlayCircle,
  ArrowUpRight
} from 'lucide-react';

export default function FeatureGrid() {
  const features = [
    {
      title: 'Threat Investigations',
      icon: ShieldAlert,
      iconColor: '#f87171',
      desc: 'Review scenario evidence, decision timelines, directly observed facts, detector interpretations, and analyst investigation notes.',
      badge: 'Admin Console'
    },
    {
      title: 'Attacker Behavior Profiles',
      icon: UserCheck,
      iconColor: '#34d399',
      desc: 'Explore recorded indicators, linked investigations, session fingerprints, decoy interaction histories, and risk metrics.',
      badge: 'Admin Console'
    },
    {
      title: 'Policy & Strategy Management',
      icon: Sliders,
      iconColor: '#60a5fa',
      desc: 'Configure simulated policies, inspect safety preconditions, review real-time validation checks, and manage deception strategy definitions.',
      badge: 'Control Plane'
    },
    {
      title: 'Deception Environments',
      icon: Server,
      iconColor: '#c084fc',
      desc: 'Explore synthetic decoy environments, inspect synthetic container assets, and verify multi-tenant isolation boundaries.',
      badge: 'Decoy Mesh'
    },
    {
      title: 'Deception State Graph',
      icon: Network,
      iconColor: '#38bdf8',
      desc: 'Inspect conceptual DSG nodes, topological relationships, and simulated three-layer adaptation history through the interactive canvas.',
      badge: 'Graph Explorer'
    },
    {
      title: 'Gateway Decision Simulator',
      icon: PlayCircle,
      iconColor: '#fbbf24',
      desc: 'Run predefined scenarios through the 8-stage decision lifecycle, comparing intended policy routes against recorded scenario fixtures.',
      badge: 'Simulation Core'
    }
  ];

  return (
    <section className="landing-section landing-features-section" id="platform">
      <div className="landing-container">
        {/* Section Header */}
        <div className="landing-section-header">
          <div className="landing-eyebrow">CONSOLE ARCHITECTURE</div>
          <h2 className="landing-section-title">
            A unified workspace for deception research and security operations.
          </h2>
          <p className="landing-section-lead">
            Explore the specialized interfaces built for security operators and deception researchers. 
            Each module is fully interactive in the current frontend prototype, powered by structured 
            mock services and verifiable simulation scenarios.
          </p>
        </div>

        {/* 6 Features Grid */}
        <div className="landing-grid-3">
          {features.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <div key={idx} className="landing-feature-card">
                <div className="landing-feature-top">
                  <div className="landing-feature-icon" style={{ color: feat.iconColor }}>
                    <Icon size={22} aria-hidden="true" />
                  </div>
                  <span className="landing-feature-badge">{feat.badge}</span>
                </div>
                <h3 className="landing-feature-title">{feat.title}</h3>
                <p className="landing-feature-desc">{feat.desc}</p>
                <div className="landing-feature-tag">
                  <span>Interactive in current prototype</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Disclaimer Callout */}
        <div className="landing-disclaimer-card" style={{ marginTop: '2rem' }}>
          <div className="landing-disclaimer-text" style={{ fontSize: '12px' }}>
            <strong>Implementation Scope:</strong> These six modules reflect the operational views implemented across 
            Stages 2B.1 through 2B.5. They interface with client-side state, mock datasets, and simulated evaluation engines. 
            They demonstrate the frontend workflows of the proposed platform prior to backend proxy integration.
          </div>
        </div>
      </div>
    </section>
  );
}
