import React from 'react';
import { ShieldX, RefreshCw, LockKeyhole, AlertCircle, Info } from 'lucide-react';

export default function ProblemStatementSection() {
  return (
    <section className="landing-section landing-problem-section" id="problem">
      <div className="landing-container">
        {/* Section Header */}
        <div className="landing-section-header">
          <div className="landing-eyebrow">THE DEFENSIVE CHALLENGE</div>
          <h2 className="landing-section-title">
            Static defenses cannot tell the whole story.
          </h2>
          <p className="landing-section-lead">
            Traditional perimeter architectures prioritize immediate binary filtering—allowing legitimate users 
            or dropping malicious connections. While indispensable, binary blocking discards the opportunity to observe 
            tactics, techniques, and procedures (TTPs), while traditional static honeypots quickly become fingerprinted 
            and bypassed by determined adversaries.
          </p>
        </div>

        {/* Three Cards Grid */}
        <div className="landing-grid-3">
          {/* Card 1: Limited behavioral context */}
          <div className="landing-card">
            <div className="landing-card-icon landing-icon-amber">
              <ShieldX size={22} aria-hidden="true" />
            </div>
            <h3 className="landing-card-title">Limited Behavioral Context</h3>
            <p className="landing-card-text">
              Conventional edge firewalls and web application filters terminate suspicious sessions immediately. 
              While this protects the immediate endpoint, it deprives security operations of vital context regarding 
              attacker tooling, target objectives, credential wordlists, and reconnaissance persistence.
            </p>
            <div className="landing-card-footnote">
              Immediate blocking severs the connection before intent is revealed.
            </div>
          </div>

          {/* Card 2: Static deception surfaces */}
          <div className="landing-card">
            <div className="landing-card-icon landing-icon-cyan">
              <RefreshCw size={22} aria-hidden="true" />
            </div>
            <h3 className="landing-card-title">Static Deception Surfaces</h3>
            <p className="landing-card-text">
              Traditional honeypots offer fixed decoy services and static synthetic responses. Because their behaviors, 
              port distributions, and error schemas never adapt to adversary probes, experienced penetration testers 
              and automated reconnaissance scripts reliably detect and circumvent them.
            </p>
            <div className="landing-card-footnote">
              Static honeypots remain useful, but require experimental augmentation.
            </div>
          </div>

          {/* Card 3: Need for policy-constrained adaptation */}
          <div className="landing-card">
            <div className="landing-card-icon landing-icon-purple">
              <LockKeyhole size={22} aria-hidden="true" />
            </div>
            <h3 className="landing-card-title">Need for Policy-Constrained Adaptation</h3>
            <p className="landing-card-text">
              Adaptive deception research investigates dynamically mutating decoy environments based on observed behavior. 
              Crucially, dynamic adaptation cannot be unconstrained: synthetic changes must operate strictly within 
              verifiable isolation boundaries and immutable security policies to eliminate lateral breakout risks.
            </p>
            <div className="landing-card-footnote">
              Dynamic behavior must always remain bounded by fail-closed safety policy.
            </div>
          </div>
        </div>

        {/* Responsible Research Context Note */}
        <div className="landing-disclaimer-card">
          <Info size={18} className="landing-disclaimer-icon" aria-hidden="true" />
          <div className="landing-disclaimer-text">
            <strong>Empirical Research Perspective:</strong> Adaptive cyber deception is an evolving research direction, 
            not an instant replacement for established defense-in-depth controls. Conventional firewalls, rate limiters, 
            and static honeypots remain foundational security controls; this project investigates whether policy-guided 
            adaptation can measurably extend threat detection and intelligence gathering.
          </div>
        </div>
      </div>
    </section>
  );
}
