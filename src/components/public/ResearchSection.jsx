import React from 'react';
import { 
  FlaskConical, 
  GitCompare, 
  Scale, 
  LineChart, 
  CheckCircle, 
  AlertCircle,
  HelpCircle
} from 'lucide-react';

export default function ResearchSection() {
  const conditions = [
    {
      code: 'Condition A',
      name: 'Baseline A: No Deception',
      desc: 'Conventional gateway topology with standard reverse proxy, rate limiting, and binary packet drop. Zero decoy traps or synthetic responses.',
      role: 'Baseline Control'
    },
    {
      code: 'Condition B',
      name: 'Baseline B: Static Honeypot',
      desc: 'Fixed decoy endpoints and static synthetic microservices. Traps remain constant across all probes without state mutation or adaptive latency.',
      role: 'Traditional Deception Control'
    },
    {
      code: 'Condition C',
      name: 'Baseline C: Rule-Based Adaptive Deception',
      desc: 'Deterministic if-then rules triggering predefined decoy redirects once explicit request thresholds (e.g., failed attempts > 5) are crossed.',
      role: 'Heuristic Adaptive Control'
    },
    {
      code: 'Condition D',
      name: 'Proposed Approach D: AI-Guided DSG Adaptation',
      desc: 'Multi-layer dynamic deception governed by the Deception State Graph. Behavioral signals inform synthetic asset mutations within immutable policy boundaries.',
      role: 'Experimental Research Target'
    }
  ];

  const metrics = [
    {
      title: 'Detection Accuracy',
      desc: 'False-positive and false-negative rates across synthetic and benign traffic distributions.'
    },
    {
      title: 'Routing Correctness',
      desc: 'Consistency of intended gateway routing decisions under complex multi-tenant policies.'
    },
    {
      title: 'Discrepancy Frequency',
      desc: 'Divergence rates between intended policy determinations and recorded edge execution outcomes.'
    },
    {
      title: 'Isolation Containment',
      desc: 'Verification of zero-egress enforcement and absence of lateral breakout attempts from decoy containers.'
    },
    {
      title: 'Interaction Depth',
      desc: 'Attacker dwell time, probe step count, and payload richness gathered prior to adversary disengagement.'
    },
    {
      title: 'Gateway Overhead',
      desc: 'Inspection latency added to benign flows, CPU utilization, and container orchestration footprint.'
    }
  ];

  return (
    <section className="landing-section landing-research-section" id="research">
      <div className="landing-container">
        {/* Section Header */}
        <div className="landing-section-header">
          <div className="landing-eyebrow">EMPIRICAL METHODOLOGY</div>
          <h2 className="landing-section-title">
            Built around measurable security questions.
          </h2>
          <p className="landing-section-lead">
            Cyber deception is not a panacea. Its defensive efficacy must be demonstrated empirically against 
            reproducible benchmarks. This research formalizes a rigorous comparative framework to measure whether 
            adaptive deception offers measurable intelligence benefits over conventional static controls.
          </p>
        </div>

        {/* Research Purpose Statement Block */}
        <div className="research-purpose-quote">
          <div className="research-purpose-badge">
            <FlaskConical size={16} aria-hidden="true" />
            <span>PRIMARY RESEARCH OBJECTIVE</span>
          </div>
          <blockquote className="research-purpose-text">
            “The goal is to investigate whether behavior-aware, policy-constrained adaptation can improve deception 
            effectiveness without compromising isolation or the protected application.”
          </blockquote>
        </div>

        {/* 4 Experimental Comparison Conditions */}
        <div className="research-conditions-header">
          <GitCompare size={18} className="research-subhead-icon" aria-hidden="true" />
          <h3 className="research-subhead-title">Experimental Comparison Conditions</h3>
        </div>

        <div className="research-conditions-grid">
          {conditions.map((cond, idx) => (
            <div key={idx} className="research-condition-card">
              <div className="research-condition-top">
                <span className="research-condition-code">{cond.code}</span>
                <span className="research-condition-role">{cond.role}</span>
              </div>
              <h4 className="research-condition-name">{cond.name}</h4>
              <p className="research-condition-desc">{cond.desc}</p>
            </div>
          ))}
        </div>

        {/* Proposed Evaluation Metrics */}
        <div className="research-metrics-wrapper">
          <div className="research-conditions-header">
            <LineChart size={18} className="research-subhead-icon" aria-hidden="true" />
            <h3 className="research-subhead-title">Proposed Evaluation Measures</h3>
          </div>

          <div className="landing-grid-3">
            {metrics.map((m, idx) => (
              <div key={idx} className="research-metric-card">
                <div className="research-metric-bullet" aria-hidden="true"></div>
                <div>
                  <h4 className="research-metric-title">{m.title}</h4>
                  <p className="research-metric-desc">{m.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Academic Integrity Notice */}
        <div className="landing-disclaimer-card" style={{ marginTop: '2.5rem' }}>
          <AlertCircle size={18} className="landing-disclaimer-icon" aria-hidden="true" />
          <div className="landing-disclaimer-text">
            <strong>Experimental Verification Scope:</strong> These evaluation measures define the planned empirical 
            testing methodology. In accordance with academic integrity, no premature numerical benchmarks, fabricated 
            accuracy percentages, or unverified performance claims are presented. Quantitative metrics will be published 
            upon controlled testbed execution.
          </div>
        </div>
      </div>
    </section>
  );
}
