import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Play, 
  AlertTriangle, 
  ArrowRight, 
  CheckCircle2, 
  XCircle, 
  HelpCircle,
  ShieldAlert,
  Terminal,
  Activity,
  FileCheck
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export default function SimulatorPreviewSection() {
  const { isAuthenticated, role, ROLES } = useAuth();
  const navigate = useNavigate();

  const handleLaunchSimulator = () => {
    // Role-aware navigation:
    // If authenticated as Admin, go straight to simulator
    // If authenticated as Owner, go to role-selection (or let RoleGuard handle switch)
    // If unauthenticated, go to login
    if (!isAuthenticated) {
      navigate('/login');
    } else if (role === ROLES.ADMIN) {
      navigate('/admin/gateway-simulator');
    } else {
      navigate('/select-role');
    }
  };

  return (
    <section className="landing-section landing-simulator-preview-section" id="simulator-preview">
      <div className="landing-container">
        {/* Section Header */}
        <div className="landing-section-header">
          <div className="landing-eyebrow">DECISION ENGINE VERIFICATION</div>
          <h2 className="landing-section-title">
            Understand the decision—not just the verdict.
          </h2>
          <p className="landing-section-lead">
            Traditional proxies log a binary action. The Adaptive Deception Gateway decomposes every request 
            into an auditable 8-stage lifecycle—decoupling what the policy intended from what edge network 
            infrastructure recorded.
          </p>
        </div>

        {/* Interactive Scenario Fixture Preview Card */}
        <div className="sim-preview-box">
          {/* Header Bar */}
          <div className="sim-preview-bar">
            <div className="sim-preview-bar-left">
              <Terminal size={16} className="sim-preview-icon" aria-hidden="true" />
              <span className="sim-preview-title">
                Scenario Fixture: <code>sim-scen-discrepancy-07</code> (Intended Policy vs. Recorded Discrepancy)
              </span>
            </div>
            <span className="sim-preview-tag">Simulated Fixture Data</span>
          </div>

          {/* Discrepancy Banner Callout */}
          <div className="sim-preview-discrepancy-alert">
            <AlertTriangle size={18} className="sim-alert-icon" aria-hidden="true" />
            <div className="sim-alert-content">
              <div className="sim-alert-title">
                Simulated Discrepancy Detected Between Intended Policy and Recorded Outcome
              </div>
              <p className="sim-alert-text">
                The governing policy proposed <strong>Synthetic Deception Diversion</strong> to isolate the session. 
                However, recorded scenario fixture evidence indicates <strong>Edge Block (TCP Reset)</strong>.
              </p>
              <div className="sim-alert-footer">
                Claimed Cause: <span className="sim-alert-cause">Scenario-provided simulated evidence (not an independently observed fact)</span>
              </div>
            </div>
          </div>

          {/* 8-Stage Audit Lifecycle Grid */}
          <div className="sim-preview-grid">
            {/* Stage 1: Simulated Evidence */}
            <div className="sim-preview-card">
              <span className="sim-stage-badge">01. SIMULATED EVIDENCE</span>
              <div className="sim-card-title">Directly Observed Facts</div>
              <ul className="sim-card-list">
                <li><code>POST /api/v1/auth/tokens</code></li>
                <li>Client Origin IP: <code>198.51.100.89</code></li>
                <li>User-Agent: <code>python-requests/2.31</code></li>
              </ul>
            </div>

            {/* Stage 2: Detector Interpretation */}
            <div className="sim-preview-card">
              <span className="sim-stage-badge">02. DETECTOR INTERPRETATION</span>
              <div className="sim-card-title">Detector Interpretation (Simulated)</div>
              <ul className="sim-card-list">
                <li>Credential Stuffing (Score: 0.94)</li>
                <li>Confidence Level: High</li>
                <li>Analytical assessment, not proven intent</li>
              </ul>
            </div>

            {/* Stage 3: Policy Decision */}
            <div className="sim-preview-card">
              <span className="sim-stage-badge">03. POLICY DECISION</span>
              <div className="sim-card-title">Policy Decision (Simulated)</div>
              <ul className="sim-card-list">
                <li>Governing Policy: <code>pol-sec-01</code></li>
                <li>Evaluation: Passed all safety checks</li>
                <li>Action Permitted: Synthetic Diversion</li>
              </ul>
            </div>

            {/* Stage 4: Strategy Eligibility */}
            <div className="sim-preview-card">
              <span className="sim-stage-badge">04. STRATEGY ELIGIBILITY</span>
              <div className="sim-card-title">Strategy Eligibility (Simulated)</div>
              <ul className="sim-card-list">
                <li>Strategy: <code>strat-auth-01</code></li>
                <li>Status: <strong>Eligible (Simulated)</strong></li>
                <li>Target: <code>env-apex-auth-01</code></li>
              </ul>
            </div>

            {/* Stage 5: Proposed Action */}
            <div className="sim-preview-card">
              <span className="sim-stage-badge">05. PROPOSED ACTION</span>
              <div className="sim-card-title">Proposed Action — Not Executed</div>
              <ul className="sim-card-list">
                <li>Allocate mock token verification sink</li>
                <li>Inject dynamic response delay (650ms)</li>
                <li>Synthesize fake MFA challenge</li>
              </ul>
            </div>

            {/* Stage 6: Intended Route */}
            <div className="sim-preview-card sim-card-highlight">
              <span className="sim-stage-badge">06. INTENDED ROUTE</span>
              <div className="sim-card-title">Intended Route (Simulated)</div>
              <div className="sim-route-value sim-route-deception">
                Synthetic Deception Diversion
              </div>
              <div className="sim-route-sub">
                Target: Container decoy sink pool
              </div>
            </div>

            {/* Stage 7: Recorded Outcome */}
            <div className="sim-preview-card sim-card-warn">
              <span className="sim-stage-badge">07. RECORDED OUTCOME</span>
              <div className="sim-card-title">Recorded Outcome (Scenario Fixture)</div>
              <div className="sim-route-value sim-route-blocked">
                Recorded: Blocked
              </div>
              <div className="sim-route-sub">
                Fixture Source: Air-gap network disconnect
              </div>
            </div>

            {/* Stage 8: Execution Evidence */}
            <div className="sim-preview-card sim-card-disabled">
              <span className="sim-stage-badge">08. EXECUTION EVIDENCE</span>
              <div className="sim-card-title">Execution Evidence</div>
              <div className="sim-route-value sim-route-unavailable">
                Not Available
              </div>
              <div className="sim-route-sub">
                No live edge socket manipulation
              </div>
            </div>
          </div>

          {/* Explanation Footer */}
          <div className="sim-preview-footer">
            <div className="sim-preview-footer-left">
              <HelpCircle size={15} className="sim-footer-icon" aria-hidden="true" />
              <span>
                <strong>Why Discrepancies Matter:</strong> In production systems, edge proxies or network ACLs may 
                drop packets or fail to route as intended. Tracking intended decisions and recorded outcomes as 
                independent fields guarantees that operational failures cannot silently masquerade as successful defense.
              </span>
            </div>

            <button
              type="button"
              className="landing-btn landing-btn-primary"
              onClick={handleLaunchSimulator}
              aria-label="Explore the Gateway Simulator in the Administrator Console"
            >
              <span>Explore the Gateway Simulator</span>
              <ArrowRight size={15} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
