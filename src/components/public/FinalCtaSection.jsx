import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, LogIn, Shield, Sparkles } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export default function FinalCtaSection() {
  const { isAuthenticated, role, ROLES } = useAuth();
  const navigate = useNavigate();

  const handleExplorePlatform = () => {
    if (!isAuthenticated) {
      navigate('/login');
    } else if (role === ROLES.ADMIN) {
      navigate('/admin/overview');
    } else {
      navigate('/owner/overview');
    }
  };

  return (
    <section className="landing-section landing-cta-section" id="final-cta">
      <div className="landing-container">
        <div className="landing-cta-box">
          <div className="landing-cta-badge">
            <Sparkles size={14} aria-hidden="true" />
            <span>INTERACTIVE RESEARCH ENVIRONMENT</span>
          </div>

          <h2 className="landing-cta-title">
            Explore adaptive cyber deception.
          </h2>

          <p className="landing-cta-text">
            Inspect the platform's investigations, policies, deception models, and decision simulator as the research implementation evolves.
          </p>

          <div className="landing-cta-actions">
            <button
              type="button"
              className="landing-btn landing-btn-primary landing-btn-lg"
              onClick={handleExplorePlatform}
              aria-label="Explore the Adaptive Deception Gateway platform"
            >
              <span>Explore the Platform</span>
              <ArrowRight size={16} aria-hidden="true" />
            </button>

            <Link
              to="/login"
              className="landing-btn landing-btn-secondary landing-btn-lg"
              aria-label="Return to Sign In page"
            >
              <LogIn size={16} aria-hidden="true" />
              <span>Return to Sign In</span>
            </Link>
          </div>

          <div className="landing-cta-meta">
            <span>Research Prototype · Role-Based Navigation · Verifiable Decision Traces</span>
          </div>
        </div>
      </div>
    </section>
  );
}
