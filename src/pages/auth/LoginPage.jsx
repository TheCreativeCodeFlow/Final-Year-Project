import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Shield,
  Lock,
  User,
  ArrowRight,
  AlertTriangle,
  Info,
  CheckCircle2,
  RefreshCw,
  KeyRound,
  ShieldAlert,
  Server
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Pre-seeded synthetic test accounts from backend/prisma/seed.js
const SYNTHETIC_ACCOUNTS = [
  {
    roleLabel: 'Platform Admin',
    name: 'Sarah Chen',
    email: 'admin@gateway.internal',
    password: 'DevAdmin12345!',
    scope: 'Platform Operations & Deception Mesh',
    badgeColor: '#10b981'
  },
  {
    roleLabel: 'Application Owner',
    name: 'Alex Vance',
    email: 'owner@apexfintech.io',
    password: 'DevOwner12345!',
    scope: 'Apex FinTech Cloud (Tenant Member)',
    badgeColor: '#3b82f6'
  },
  {
    roleLabel: 'Security Analyst',
    name: 'Elena Rostova',
    email: 'analyst@medsecure.io',
    password: 'DevAnalyst12345!',
    scope: 'MedSecure Systems (Read-Only Events)',
    badgeColor: '#8b5cf6'
  },
  {
    roleLabel: 'Disabled Account',
    name: 'Test Inactive',
    email: 'disabled@example.com',
    password: 'DevDisabled12345!',
    scope: 'Negative Auth Test Fixture',
    badgeColor: '#ef4444'
  }
];

export default function LoginPage() {
  const { login, ROLES, backendAvailable, isAuthenticated, role, user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [globalError, setGlobalError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRegistrationNotice, setShowRegistrationNotice] = useState(false);

  // If already authenticated and session is valid, redirect directly to dashboard
  React.useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      const from = location.state?.from?.pathname;
      const safeFrom = from && from.startsWith('/') && !from.startsWith('/login') ? from : null;
      if (safeFrom) {
        navigate(safeFrom, { replace: true });
      } else if (user.isPlatformAdmin || role === ROLES.ADMIN) {
        navigate('/admin/overview', { replace: true });
      } else {
        navigate('/owner/overview', { replace: true });
      }
    }
  }, [isLoading, isAuthenticated, user, role, ROLES, navigate, location]);

  // Validate form before submission
  const validate = () => {
    const errors = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      errors.email = 'Email address is required.';
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      errors.email = 'Please provide a valid email format (e.g. name@domain.com).';
    }

    if (!password) {
      errors.password = 'Password is required.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGlobalError('');

    if (!validate()) return;

    setIsSubmitting(true);

    try {
      const result = await login(email.trim(), password);

      // Resolve intended redirect path safely
      const from = location.state?.from?.pathname;
      const safeFrom = from && from.startsWith('/') && !from.startsWith('/login') ? from : null;

      if (safeFrom) {
        navigate(safeFrom, { replace: true });
      } else if (result.role === ROLES.ADMIN || result.user?.isPlatformAdmin) {
        navigate('/admin/overview', { replace: true });
      } else {
        navigate('/owner/overview', { replace: true });
      }
    } catch (err) {
      setIsSubmitting(false);

      if (err.status === 401) {
        setGlobalError('Invalid email or password. Please verify your credentials.');
      } else if (err.status === 403) {
        setGlobalError('Account is inactive, suspended, or disabled. Contact system administrator.');
      } else if (err.status === 429) {
        setGlobalError('Too many failed attempts. Login throttled by rate limiter.');
      } else if (err.code === 'NETWORK_ERROR' || err.status === 0) {
        setGlobalError('Cannot connect to gateway backend server on port 4000. Is the backend service active?');
      } else {
        setGlobalError(err.message || 'Authentication failed. Please try again.');
      }
    }
  };

  const handleFillSynthetic = (account) => {
    setEmail(account.email);
    setPassword(account.password);
    setFieldErrors({});
    setGlobalError('');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2.5rem 1rem',
        backgroundColor: 'var(--bg-canvas)'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem'
        }}
      >
        {/* Header Branding */}
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, var(--accent-primary), #1e3a8a)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              marginBottom: '1rem',
              boxShadow: '0 0 24px var(--accent-glow)'
            }}
          >
            <Shield size={30} />
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.25rem' }}>
            Adaptive Cyber Deception Gateway
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Real-Time Attacker Detection & Adaptive Decoy Mesh
          </p>
        </div>

        {/* Backend Connectivity Status Pill */}
        {!backendAvailable && (
          <div className="demo-banner demo-banner-warning" style={{ fontSize: '12px' }}>
            <Server size={16} style={{ flexShrink: 0 }} />
            <div>
              <strong>Backend Disconnected:</strong> Cannot reach <code>http://localhost:4000/api/v1</code>.
              Run <code>npm run backend:dev</code> to start the Node.js server.
            </div>
          </div>
        )}

        {/* Global Error Banner */}
        {globalError && (
          <div
            style={{
              padding: '0.85rem 1rem',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              color: '#fca5a5',
              fontSize: '13px'
            }}
          >
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>{globalError}</div>
          </div>
        )}

        {/* Login Form Container */}
        <div className="cyber-card" style={{ padding: '2rem' }}>
          <div style={{ marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '0.25rem' }}>
              Sign In to Management Console
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Server-authenticated session with HttpOnly credentials & anti-CSRF protection.
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            {/* Email Field */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 500,
                  marginBottom: '4px',
                  color: 'var(--text-secondary)'
                }}
              >
                Work Email Address
              </label>
              <input
                type="email"
                className="cyber-input"
                style={{
                  width: '100%',
                  borderColor: fieldErrors.email ? 'var(--severity-critical)' : undefined
                }}
                placeholder="name@organization.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: null });
                }}
                disabled={isSubmitting}
                autoComplete="email"
              />
              {fieldErrors.email && (
                <span style={{ fontSize: '11px', color: 'var(--severity-critical)', marginTop: '4px', display: 'block' }}>
                  {fieldErrors.email}
                </span>
              )}
            </div>

            {/* Password Field */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label
                  style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color: 'var(--text-secondary)'
                  }}
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowRegistrationNotice(!showRegistrationNotice)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    fontSize: '11px',
                    color: 'var(--accent-primary-light)',
                    cursor: 'pointer'
                  }}
                >
                  Need an account?
                </button>
              </div>
              <input
                type="password"
                className="cyber-input"
                style={{
                  width: '100%',
                  borderColor: fieldErrors.password ? 'var(--severity-critical)' : undefined
                }}
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: null });
                }}
                disabled={isSubmitting}
                autoComplete="current-password"
              />
              {fieldErrors.password && (
                <span style={{ fontSize: '11px', color: 'var(--severity-critical)', marginTop: '4px', display: 'block' }}>
                  {fieldErrors.password}
                </span>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
              style={{
                width: '100%',
                marginTop: '0.5rem',
                padding: '0.75rem',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={16} className="spinner" />
                  <span>Authenticating Identity...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Gateway</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Registration Notice Box */}
          {showRegistrationNotice && (
            <div
              style={{
                marginTop: '1.25rem',
                padding: '0.85rem',
                backgroundColor: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                borderRadius: '8px',
                fontSize: '12px',
                color: 'var(--text-secondary)',
                lineHeight: 1.5
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#93c5fd', fontWeight: 600, marginBottom: '4px' }}>
                <Info size={14} />
                <span>Enterprise Access Provisioning</span>
              </div>
              Public self-registration is disabled for enterprise gateway security. User accounts, roles, and tenant scopes are provisioned directly by Platform Administrators or mapped via enterprise SAML/OIDC federations.
            </div>
          )}

          {/* Synthetic Development Credentials Helper */}
          <div
            style={{
              marginTop: '1.5rem',
              paddingTop: '1.25rem',
              borderTop: '1px solid var(--border-subtle)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--text-muted)'
                }}
              >
                Synthetic Dev Fixtures (PostgreSQL Seeded)
              </span>
              <span
                className="demo-tag"
                style={{ fontSize: '10px', padding: '1px 6px' }}
                title="Synthetic credentials from backend/prisma/seed.js"
              >
                DEV ONLY
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              {SYNTHETIC_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    padding: '0.65rem 0.6rem',
                    textAlign: 'left'
                  }}
                  onClick={() => handleFillSynthetic(acc)}
                  disabled={isSubmitting}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', width: '100%' }}>
                    <span
                      style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        backgroundColor: acc.badgeColor,
                        display: 'inline-block'
                      }}
                    />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {acc.roleLabel}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '10px',
                      color: 'var(--text-muted)',
                      marginTop: '2px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '100%'
                    }}
                  >
                    {acc.email}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Persona Comparison Link */}
          <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
            <Link to="/select-role" style={{ fontSize: '12px', color: 'var(--accent-primary-light)' }}>
              Inspect Role Permissions & Tenant Architecture Boundary →
            </Link>
          </div>
        </div>

        {/* Footer Security Notice */}
        <div
          style={{
            textAlign: 'center',
            fontSize: '11px',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          <Lock size={12} style={{ color: 'var(--accent-primary)' }} />
          <span>Stage 3E Production Integration: Authenticated via Argon2id & PostgreSQL Sessions.</span>
        </div>
      </div>
    </div>
  );
}
