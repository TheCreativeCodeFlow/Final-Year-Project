import React from 'react';
import { 
  Inbox, 
  Activity, 
  ShieldCheck, 
  CheckSquare, 
  Split, 
  FileText,
  AlertCircle
} from 'lucide-react';

export default function WorkflowSection() {
  const stages = [
    {
      num: '01',
      title: 'Request Intake',
      icon: Inbox,
      iconColor: 'var(--accent-diverted)',
      summary: 'Captures incoming request metadata, client IP attributes, request headers, and payload structures.',
      boundary: 'Conceptual representation: does not ingest live production traffic in this prototype.'
    },
    {
      num: '02',
      title: 'Behavioral Assessment',
      icon: Activity,
      iconColor: '#a855f7',
      summary: 'Inspects behavioral indicators such as brute-force intervals, endpoint fuzzing sequences, and token canary hits.',
      boundary: 'Detector interpretation is an analytical hypothesis, not cryptographic proof of malicious intent.'
    },
    {
      num: '03',
      title: 'Policy Evaluation',
      icon: ShieldCheck,
      iconColor: '#38bdf8',
      summary: 'Evaluates governing tenant rules, application isolation tiers, permitted egress scopes, and safety constraints.',
      boundary: 'Validated through the platform’s rule verification engine to guarantee containment boundaries.'
    },
    {
      num: '04',
      title: 'Strategy Eligibility',
      icon: CheckSquare,
      iconColor: '#fbbf24',
      summary: 'Determines whether candidate deception strategies (e.g., auth tarpit, synthetic schema diversion) satisfy preconditions.',
      boundary: 'Eligibility confirms structural safety criteria; it does not constitute runtime socket execution.'
    },
    {
      num: '05',
      title: 'Routing Decision',
      icon: Split,
      iconColor: '#34d399',
      summary: 'Formulates the intended routing decision: allow forward to real application, drop/block, or divert to synthetic environment.',
      boundary: 'The intended routing plan and recorded edge execution outcome are tracked as distinct data fields.'
    },
    {
      num: '06',
      title: 'Audit & Investigation',
      icon: FileText,
      iconColor: '#818cf8',
      summary: 'Preserves the immutable 8-stage decision trace, observed facts, detector scores, and recorded outcomes for security analyst review.',
      boundary: 'Feeds structured audit events directly into threat investigations and attacker behavior profiling.'
    }
  ];

  return (
    <section className="landing-section landing-workflow-section" id="how-it-works">
      <div className="landing-container">
        {/* Section Header */}
        <div className="landing-section-header">
          <div className="landing-eyebrow">DECISION LIFECYCLE</div>
          <h2 className="landing-section-title">
            From incoming request to an auditable decision.
          </h2>
          <p className="landing-section-lead">
            The gateway enforces a structured six-stage evaluation model. Every routing determination—from 
            benign forwarding to synthetic deception diversion—is governed by strict policy boundaries and 
            preserved for independent retrospective audit.
          </p>

          <div className="landing-concept-badge">
            <span className="landing-pulse-dot" aria-hidden="true"></span>
            <span>Conceptual Gateway Workflow — Architectural Lifecycle Specification</span>
          </div>
        </div>

        {/* Six Stages Workflow Grid */}
        <div className="landing-workflow-grid">
          {stages.map((stage, idx) => {
            const Icon = stage.icon;
            return (
              <div key={idx} className="landing-workflow-card">
                <div className="landing-workflow-card-top">
                  <span className="landing-workflow-num">{stage.num}</span>
                  <div className="landing-workflow-icon" style={{ color: stage.iconColor }}>
                    <Icon size={20} aria-hidden="true" />
                  </div>
                </div>

                <h3 className="landing-workflow-card-title">{stage.title}</h3>
                <p className="landing-workflow-card-summary">{stage.summary}</p>

                <div className="landing-workflow-card-boundary">
                  <span className="landing-boundary-label">Scope Boundary:</span> {stage.boundary}
                </div>

                {idx < stages.length - 1 && (
                  <div className="landing-workflow-connector" aria-hidden="true">
                    <span>→</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Operational Clarification Callout */}
        <div className="landing-workflow-notice">
          <AlertCircle size={16} className="landing-workflow-notice-icon" aria-hidden="true" />
          <p className="landing-workflow-notice-text">
            <strong>Lifecycle Governance:</strong> In this research prototype, these six stages are modeled and verified 
            through the interactive Gateway Decision Simulator and policy management interfaces. Live multi-tenant kernel 
            packet filtering and live socket proxying represent future backend milestones.
          </p>
        </div>
      </div>
    </section>
  );
}
