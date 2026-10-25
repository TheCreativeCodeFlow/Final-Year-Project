import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, Lock, User, ArrowRight, AlertTriangle, Sparkles } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export default function LoginPage() {
  const { login, ROLES } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState(ROLES.OWNER);

  const handleSimulatedSubmit = (e) => {
    e.preventDefault();
    login(selectedRole);
    if (selectedRole === ROLES.OWNER) {
      navigate('/owner/overview');
    } else {
      navigate('/admin/overview');
    }
  };

  const handleQuickLogin = (role) => {
    login(role);
    if (role === ROLES.OWNER) {
      navigate('/owner/overview');
    } else {
      navigate('/admin/overview');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem',
      backgroundColor: 'var(--bg-canvas)'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '460px',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem'
      }}>
        {/* Header Branding */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, var(--accent-primary), #1e3a8a)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            marginBottom: '1rem',
            boxShadow: '0 0 20px var(--accent-glow)'
          }}>
            <Shield size={28} />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>
            Adaptive Cyber Deception Gateway
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Real-Time Attacker Detection & Adaptive Decoy Mesh
          </p>
        </div>

        {/* Prototype Warning Banner */}
        <div className="demo-banner">
          <Sparkles size={16} style={{ flexShrink: 0 }} />
          <div>
            <strong>Development Prototype:</strong> This interface uses simulated authentication.
            Select a persona below to enter the dashboard.
          </div>
        </div>

        {/* Login Form Container */}
        <div className="cyber-card" style={{ padding: '2rem' }}>
          {/* Quick Persona Launch Buttons */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--text-muted)',
              marginBottom: '0.75rem'
            }}>
              Quick Launch Simulated Personas
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  flexDirection: 'column',
                  padding: '0.85rem 0.5rem',
                  alignItems: 'flex-start',
                  textAlign: 'left'
                }}
                onClick={() => handleQuickLogin(ROLES.OWNER)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#60a5fa', fontWeight: 600, fontSize: '13px' }}>
                  <User size={14} />
                  <span>App Owner</span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Apex FinTech Cloud
                </span>
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  flexDirection: 'column',
                  padding: '0.85rem 0.5rem',
                  alignItems: 'flex-start',
                  textAlign: 'left'
                }}
                onClick={() => handleQuickLogin(ROLES.ADMIN)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#34d399', fontWeight: 600, fontSize: '13px' }}>
                  <Shield size={14} />
                  <span>Gateway Admin</span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Platform Operations
                </span>
              </button>
            </div>
          </div>

          <div style={{
            position: 'relative',
            textAlign: 'center',
            margin: '1.5rem 0',
            borderTop: '1px solid var(--border-subtle)'
          }}>
            <span style={{
              position: 'relative',
              top: '-10px',
              background: 'var(--bg-surface-card)',
              padding: '0 10px',
              fontSize: '11px',
              color: 'var(--text-muted)',
              textTransform: 'uppercase'
            }}>
              Or Standard Simulation Login
            </span>
          </div>

          {/* Standard Form */}
          <form onSubmit={handleSimulatedSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                Target Role
              </label>
              <select
                className="cyber-select"
                style={{ width: '100%' }}
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
              >
                <option value={ROLES.OWNER}>Application Owner (Apex FinTech)</option>
                <option value={ROLES.ADMIN}>Gateway Administrator (Platform Ops)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                Email Address (Simulated)
              </label>
              <input
                type="email"
                className="cyber-input"
                style={{ width: '100%' }}
                placeholder={selectedRole === ROLES.OWNER ? 'alex.vance@apexfintech.io' : 'sarah.chen@gateway-admin.internal'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                Password (Simulated)
              </label>
              <input
                type="password"
                className="cyber-input"
                style={{ width: '100%' }}
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '0.5rem', padding: '0.75rem' }}
            >
              <span>Enter Gateway Console</span>
              <ArrowRight size={16} />
            </button>
          </form>

          <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
            <Link
              to="/select-role"
              style={{ fontSize: '12px', color: 'var(--accent-primary-light)' }}
            >
              Compare Persona Permissions & Architectural Scope →
            </Link>
          </div>
        </div>

        {/* Footer Security Notice */}
        <div style={{
          textAlign: 'center',
          fontSize: '11px',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px'
        }}>
          <AlertTriangle size={13} style={{ color: 'var(--severity-medium)' }} />
          <span>Stage 1 Frontend Sandbox. Real backend auth enforced in future stages.</span>
        </div>
      </div>
    </div>
  );
}
