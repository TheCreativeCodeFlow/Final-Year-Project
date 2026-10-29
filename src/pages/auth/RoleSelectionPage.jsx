import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Shield,
  Layers,
  ArrowRight,
  CheckCircle2,
  Lock,
  UserCheck,
  AlertCircle,
  Sparkles,
  LogIn,
  KeyRound
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export default function RoleSelectionPage() {
  const { user, role, isAuthenticated, ROLES, ROLE_LABELS } = useAuth();
  const navigate = useNavigate();

  const isPlatformAdmin = user?.isPlatformAdmin === true;
  const isOwner = role === ROLES.OWNER || isPlatformAdmin;

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2.5rem 1.5rem',
        backgroundColor: 'var(--bg-canvas)'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '880px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2rem'
        }}
      >
        {/* Title & Introduction */}
        <div style={{ textAlign: 'center' }}>
          <div className="demo-tag" style={{ marginBottom: '0.75rem' }}>
            <Sparkles size={11} />
            <span>ROLE SEPARATION & ACCESS BOUNDARIES</span>
          </div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            Architectural Roles & Access Scopes
          </h1>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '640px', margin: '0 auto', fontSize: '0.9375rem' }}>
            The Adaptive Deception Gateway enforces cryptographic session verification and independent role-based access control.
            Examine your authenticated security clearance and authorized console portals below.
          </p>
        </div>

        {/* Current Authenticated Identity Banner */}
        {isAuthenticated && user ? (
          <div
            className="cyber-card"
            style={{
              padding: '1rem 1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
              borderColor: 'var(--accent-primary-light)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, var(--accent-primary), #1e3a8a)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 700
                }}
              >
                {user.initials}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '14px' }}>{user.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {user.email} &bull; Clearance: <strong style={{ color: 'var(--accent-primary-light)' }}>{user.roleTitle}</strong>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <span className="demo-tag" style={{ borderColor: '#10b981', color: '#6ee7b7' }}>
                <CheckCircle2 size={11} />
                <span>SERVER VALIDATED SESSION</span>
              </span>
            </div>
          </div>
        ) : (
          <div
            className="demo-banner demo-banner-warning"
            style={{ justifyContent: 'space-between', alignItems: 'center' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Lock size={18} style={{ flexShrink: 0 }} />
              <div>
                <strong>Unauthenticated Guest:</strong> You are currently not signed in to a gateway session.
                Sign in with an authorized account to launch protected consoles.
              </div>
            </div>
            <Link to="/login" className="btn btn-primary btn-sm" style={{ whiteSpace: 'nowrap' }}>
              <LogIn size={14} />
              <span>Sign In</span>
            </Link>
          </div>
        )}

        {/* Persona Comparison Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '1.5rem'
          }}
        >
          {/* Card 1: Application Owner */}
          <div
            className="cyber-card"
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              border: isOwner ? '2px solid var(--accent-primary-light)' : '1px solid var(--border-default)'
            }}
          >
            {isOwner && (
              <span
                className="demo-tag"
                style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  backgroundColor: 'rgba(59, 130, 246, 0.2)'
                }}
              >
                AUTHORIZED PORTAL
              </span>
            )}

            <div>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(37, 99, 235, 0.15)',
                  color: '#60a5fa',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1rem'
                }}
              >
                <Layers size={22} />
              </div>

              <h2 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>
                Application Owner Console
              </h2>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Tenant Scope: <strong>Apex FinTech Cloud</strong> & Associated Services
              </div>

              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                Organizations and development teams routing upstream services through the deception gateway.
                Register ingress domains, monitor decoy routes, and inspect diverted threat events.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <CheckCircle2 size={14} style={{ color: '#10b981', flexShrink: 0 }} />
                  <span>Register and manage protected applications in PostgreSQL</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <CheckCircle2 size={14} style={{ color: '#10b981', flexShrink: 0 }} />
                  <span>Inspect canary token hits and tenant security observations</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <CheckCircle2 size={14} style={{ color: '#10b981', flexShrink: 0 }} />
                  <span>Enforce tenant-isolated deception boundaries</span>
                </div>
              </div>
            </div>

            {isOwner ? (
              <button
                className="btn btn-primary"
                style={{ width: '100%', padding: '0.75rem', justifyContent: 'center' }}
                onClick={() => navigate('/owner/overview')}
              >
                <span>Launch Application Owner View</span>
                <ArrowRight size={16} />
              </button>
            ) : (
              <div
                style={{
                  padding: '0.75rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  color: 'var(--text-muted)'
                }}
              >
                <Lock size={14} />
                <span>Requires Application Owner tenant membership.</span>
              </div>
            )}
          </div>

          {/* Card 2: Gateway Administrator */}
          <div
            className="cyber-card"
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              border: isPlatformAdmin ? '2px solid #10b981' : '1px solid var(--border-default)'
            }}
          >
            {isPlatformAdmin && (
              <span
                className="demo-tag"
                style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  backgroundColor: 'rgba(16, 185, 129, 0.2)',
                  borderColor: '#10b981',
                  color: '#6ee7b7'
                }}
              >
                AUTHORIZED PORTAL
              </span>
            )}

            <div>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  color: '#34d399',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1rem'
                }}
              >
                <Shield size={22} />
              </div>

              <h2 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>
                Gateway Administrator Console
              </h2>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Platform Scope: <strong>Global Gateway Infrastructure</strong>
              </div>

              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                Platform operators maintaining multi-tenant isolation, deception environments, strategy management,
                and the end-to-end gateway decision simulator.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <CheckCircle2 size={14} style={{ color: '#10b981', flexShrink: 0 }} />
                  <span>Platform-wide gateway latency and node health</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <CheckCircle2 size={14} style={{ color: '#10b981', flexShrink: 0 }} />
                  <span>Deception mesh decoy pools and orchestration state</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <CheckCircle2 size={14} style={{ color: '#10b981', flexShrink: 0 }} />
                  <span>Cross-tenant threat telemetry & admin audit trails</span>
                </div>
              </div>
            </div>

            {isPlatformAdmin ? (
              <button
                className="btn btn-secondary"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  borderColor: 'rgba(16, 185, 129, 0.4)',
                  color: '#6ee7b7',
                  justifyContent: 'center'
                }}
                onClick={() => navigate('/admin/overview')}
              >
                <span>Launch Gateway Admin View</span>
                <ArrowRight size={16} />
              </button>
            ) : (
              <div
                style={{
                  padding: '0.75rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  color: 'var(--text-muted)'
                }}
              >
                <Lock size={14} />
                <span>Requires Platform Administrator security clearance.</span>
              </div>
            )}
          </div>
        </div>

        {/* Security Scope Notice */}
        <div className="demo-banner" style={{ alignItems: 'flex-start' }}>
          <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '12px', lineHeight: 1.5 }}>
            <strong>Stage 3E Authorization Policy:</strong> Role elevation cannot be self-assigned on the frontend.
            All permissions and access rights are enforced by the Node.js backend using server-side session tokens,
            Argon2id password hashes, and PostgreSQL tenant membership records.
          </div>
        </div>
      </div>
    </div>
  );
}
