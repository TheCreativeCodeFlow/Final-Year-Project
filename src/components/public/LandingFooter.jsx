import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, ExternalLink, Code2 } from 'lucide-react';

export default function LandingFooter() {
  const handleScrollToSection = (e, sectionId) => {
    e.preventDefault();
    const element = document.getElementById(sectionId);
    if (element) {
      const navOffset = 76;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - navOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  return (
    <footer className="landing-footer" role="contentinfo">
      <div className="landing-container">
        <div className="landing-footer-grid">
          {/* Brand & Project Info */}
          <div className="landing-footer-brand-col">
            <div className="landing-brand">
              <div className="landing-brand-icon">
                <Shield size={18} aria-hidden="true" />
              </div>
              <span className="landing-brand-title">Adaptive Deception Gateway</span>
            </div>
            <p className="landing-footer-desc">
              Development of an AI-Enabled Adaptive Cyber Deception Gateway for Real-Time Attacker Detection. 
              An academic research initiative investigating policy-constrained deception routing and multi-layer state graphs.
            </p>
            <div className="landing-footer-prototype-tag">
              <span className="landing-prototype-dot" aria-hidden="true"></span>
              <span>Research Prototype</span>
            </div>
          </div>

          {/* Quick Links Column 1: Navigation */}
          <div className="landing-footer-links-col">
            <h4 className="landing-footer-heading">Platform Navigation</h4>
            <ul className="landing-footer-list">
              <li>
                <a href="#overview" onClick={(e) => handleScrollToSection(e, 'overview')}>
                  Overview
                </a>
              </li>
              <li>
                <a href="#how-it-works" onClick={(e) => handleScrollToSection(e, 'how-it-works')}>
                  How It Works
                </a>
              </li>
              <li>
                <a href="#adaptive-deception" onClick={(e) => handleScrollToSection(e, 'adaptive-deception')}>
                  Adaptive Deception & DSG
                </a>
              </li>
              <li>
                <a href="#platform" onClick={(e) => handleScrollToSection(e, 'platform')}>
                  Platform Capabilities
                </a>
              </li>
              <li>
                <a href="#research" onClick={(e) => handleScrollToSection(e, 'research')}>
                  Research & Methodology
                </a>
              </li>
            </ul>
          </div>

          {/* Quick Links Column 2: Access & Console */}
          <div className="landing-footer-links-col">
            <h4 className="landing-footer-heading">Console Access</h4>
            <ul className="landing-footer-list">
              <li>
                <Link to="/login">
                  Sign In
                </Link>
              </li>
              <li>
                <Link to="/select-role">
                  Development Role Selector
                </Link>
              </li>
              <li>
                <a href="#simulator-preview" onClick={(e) => handleScrollToSection(e, 'simulator-preview')}>
                  Simulator Preview
                </a>
              </li>
              <li>
                <a href="#trust" onClick={(e) => handleScrollToSection(e, 'trust')}>
                  Governance & Safety
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Disclaimer & Copyright */}
        <div className="landing-footer-bottom">
          <p className="landing-footer-disclaimer">
            <strong>Demonstration Notice:</strong> All metrics, telemetry indicators, attacker profiles, 
            and gateway routing traces presented in this web application are simulated representations 
            designed for research demonstration and system design evaluation.
          </p>
          <div className="landing-footer-copy">
            <span>© 2026 Adaptive Deception Gateway · Academic Research Project</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
