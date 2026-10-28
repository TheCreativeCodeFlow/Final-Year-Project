import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Menu, X, ArrowRight, Play, UserCheck, LogIn } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export default function LandingNavbar() {
  const { isAuthenticated, role, ROLES } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle escape key to close mobile menu
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  const handleScrollToSection = (e, sectionId) => {
    e.preventDefault();
    setMobileMenuOpen(false);
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

  const handleExploreDemo = () => {
    setMobileMenuOpen(false);
    // Role-aware navigation:
    // If authenticated as Admin, open simulator
    // If authenticated as Owner, route through role-selection
    // If unauthenticated, route to login
    if (!isAuthenticated) {
      navigate('/login');
    } else if (role === ROLES.ADMIN) {
      navigate('/admin/gateway-simulator');
    } else {
      navigate('/select-role');
    }
  };

  return (
    <header
      className={`landing-navbar ${scrolled ? 'landing-navbar-scrolled' : ''}`}
      role="banner"
    >
      <div className="landing-nav-container">
        {/* Brand */}
        <a
          href="#overview"
          className="landing-brand"
          onClick={(e) => handleScrollToSection(e, 'overview')}
          aria-label="Adaptive Deception Gateway - Home"
        >
          <div className="landing-brand-icon">
            <Shield size={20} aria-hidden="true" />
          </div>
          <div className="landing-brand-text">
            <span className="landing-brand-title">Adaptive Deception Gateway</span>
            <span className="landing-brand-tag">Adaptive Cyber Deception Platform</span>
          </div>
        </a>

        {/* Desktop Navigation Links */}
        <nav className="landing-nav-links" aria-label="Main Navigation">
          <a
            href="#overview"
            className="landing-nav-link"
            onClick={(e) => handleScrollToSection(e, 'overview')}
          >
            Overview
          </a>
          <a
            href="#how-it-works"
            className="landing-nav-link"
            onClick={(e) => handleScrollToSection(e, 'how-it-works')}
          >
            How It Works
          </a>
          <a
            href="#adaptive-deception"
            className="landing-nav-link"
            onClick={(e) => handleScrollToSection(e, 'adaptive-deception')}
          >
            Adaptive Deception
          </a>
          <a
            href="#platform"
            className="landing-nav-link"
            onClick={(e) => handleScrollToSection(e, 'platform')}
          >
            Platform
          </a>
          <a
            href="#research"
            className="landing-nav-link"
            onClick={(e) => handleScrollToSection(e, 'research')}
          >
            Research
          </a>
        </nav>

        {/* Desktop Action Buttons */}
        <div className="landing-nav-actions">
          <button
            type="button"
            className="landing-btn landing-btn-primary"
            onClick={handleExploreDemo}
            aria-label="Explore the interactive gateway simulation demo"
          >
            <Play size={14} aria-hidden="true" />
            <span>Explore Demo</span>
          </button>

          <Link
            to="/login"
            className="landing-btn landing-btn-secondary"
            aria-label="Sign in to the gateway console"
          >
            <LogIn size={14} aria-hidden="true" />
            <span>Sign In</span>
          </Link>
        </div>

        {/* Mobile Hamburger Toggle */}
        <button
          type="button"
          className="landing-mobile-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={mobileMenuOpen}
          aria-controls="landing-mobile-menu"
        >
          {mobileMenuOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
        </button>
      </div>

      {/* Mobile Drawer Dropdown */}
      <div
        id="landing-mobile-menu"
        className={`landing-mobile-menu ${mobileMenuOpen ? 'landing-mobile-menu-open' : ''}`}
        aria-hidden={!mobileMenuOpen}
      >
        <nav className="landing-mobile-nav" aria-label="Mobile Navigation">
          <a
            href="#overview"
            className="landing-mobile-link"
            onClick={(e) => handleScrollToSection(e, 'overview')}
          >
            Overview
          </a>
          <a
            href="#how-it-works"
            className="landing-mobile-link"
            onClick={(e) => handleScrollToSection(e, 'how-it-works')}
          >
            How It Works
          </a>
          <a
            href="#adaptive-deception"
            className="landing-mobile-link"
            onClick={(e) => handleScrollToSection(e, 'adaptive-deception')}
          >
            Adaptive Deception
          </a>
          <a
            href="#platform"
            className="landing-mobile-link"
            onClick={(e) => handleScrollToSection(e, 'platform')}
          >
            Platform
          </a>
          <a
            href="#research"
            className="landing-mobile-link"
            onClick={(e) => handleScrollToSection(e, 'research')}
          >
            Research
          </a>

          <div className="landing-mobile-actions">
            <button
              type="button"
              className="landing-btn landing-btn-primary landing-btn-full"
              onClick={handleExploreDemo}
            >
              <Play size={15} aria-hidden="true" />
              <span>Explore Demo</span>
            </button>

            <Link
              to="/login"
              className="landing-btn landing-btn-secondary landing-btn-full"
              onClick={() => setMobileMenuOpen(false)}
            >
              <LogIn size={15} aria-hidden="true" />
              <span>Sign In</span>
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
