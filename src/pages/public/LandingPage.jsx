import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronDown, Shield, Sparkles } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

// Components
import LandingNavbar from '../../components/public/LandingNavbar';
import HeroVisualization from '../../components/public/HeroVisualization';
import ProblemStatementSection from '../../components/public/ProblemStatementSection';
import WorkflowSection from '../../components/public/WorkflowSection';
import DeceptionGraphDiagram from '../../components/public/DeceptionGraphDiagram';
import FeatureGrid from '../../components/public/FeatureGrid';
import SimulatorPreviewSection from '../../components/public/SimulatorPreviewSection';
import ResearchSection from '../../components/public/ResearchSection';
import TrustSafetySection from '../../components/public/TrustSafetySection';
import FinalCtaSection from '../../components/public/FinalCtaSection';
import LandingFooter from '../../components/public/LandingFooter';

// Styles
import './LandingPage.css';

export default function LandingPage() {
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

  const handleScrollToHowItWorks = (e) => {
    e.preventDefault();
    const element = document.getElementById('how-it-works');
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
    <div className="landing-page-root">
      {/* Section A: Navigation */}
      <LandingNavbar />

      <main id="main-content">
        {/* Section B: Hero */}
        <section className="landing-hero-section" id="overview">
          <div className="landing-container landing-hero-container">
            {/* Left Column: Text & CTAs */}
            <div className="landing-hero-content">
              <div className="landing-hero-eyebrow">
                <span className="landing-pulse-dot" aria-hidden="true"></span>
                <span>ADAPTIVE CYBER DECEPTION</span>
              </div>

              <h1 className="landing-hero-headline">
                Detect the Threat. Deceive the Intruder. Protect the Real System.
              </h1>

              <p className="landing-hero-copy">
                Adaptive Deception Gateway is a research-driven security platform designed to explore 
                behavioral threat assessment, policy-guided deception, and dynamically adapted synthetic 
                environments—while keeping security constraints at the center of every decision.
              </p>

              <div className="landing-hero-ctas">
                <button
                  type="button"
                  className="landing-btn landing-btn-primary landing-btn-lg"
                  onClick={handleExplorePlatform}
                  aria-label="Explore the Adaptive Deception Gateway platform"
                >
                  <span>Explore the Platform</span>
                  <ArrowRight size={16} aria-hidden="true" />
                </button>

                <a
                  href="#how-it-works"
                  className="landing-btn landing-btn-secondary landing-btn-lg"
                  onClick={handleScrollToHowItWorks}
                  aria-label="Learn how the gateway decision lifecycle works"
                >
                  <span>How It Works</span>
                  <ChevronDown size={16} aria-hidden="true" />
                </a>
              </div>

              <div className="landing-hero-statement">
                <span>Behavior-aware assessment · Policy-guided decisions · Auditable deception workflows</span>
              </div>
            </div>

            {/* Right Column: Architectural Hero Visualization */}
            <div className="landing-hero-visual-wrapper">
              <HeroVisualization />
            </div>
          </div>
        </section>

        {/* Section C: Problem Statement */}
        <ProblemStatementSection />

        {/* Section D: How It Works */}
        <WorkflowSection />

        {/* Section E: Adaptive Deception and the Deception State Graph */}
        <DeceptionGraphDiagram />

        {/* Section F: Platform Capabilities */}
        <FeatureGrid />

        {/* Section G: Gateway Decision Simulator Preview */}
        <SimulatorPreviewSection />

        {/* Section H: Research and Evaluation */}
        <ResearchSection />

        {/* Section I: Trust, Safety, and Transparency */}
        <TrustSafetySection />

        {/* Section J: Final Call to Action */}
        <FinalCtaSection />
      </main>

      {/* Section K: Footer */}
      <LandingFooter />
    </div>
  );
}
