import React from 'react';
import { Navigate, Link } from 'react-router-dom';
import { ShieldAlert, ArrowRight, UserCheck, Lock } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export default function RoleGuard({ requiredRole, children }) {
  const { isAuthenticated, role, user, switchRole, ROLES } = useAuth();

  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If user role matches required role, grant access
  if (role === requiredRole) {
    return children;
  }

  // Role Mismatch: Client-side guard prevents cross-persona viewing without explicit switch
  const isRequiredOwner = requiredRole === ROLES.OWNER;
  const targetTitle = isRequiredOwner ? 'Application Owner' : 'Gateway Administrator';
  const currentTitle = role === ROLES.OWNER ? 'Application Owner' : 'Gateway Administrator';
  const fallbackDashboard = role === ROLES.OWNER ? '/owner/overview' : '/admin/overview';

  return (
    <div style={{
      minHeight: '80vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem'
    }}>
      <div className="cyber-card" style={{ maxWidth: '520px', width: '100%', textAlign: 'center', padding: '2.5rem 2rem' }}>
        <div style={{
          width: '52px',
          height: '52px',
          borderRadius: '12px',
          backgroundColor: 'rgba(239, 68, 68, 0.12)',
          color: 'var(--severity-critical)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1.25rem'
        }}>
          <Lock size={26} />
        </div>

        <div className="demo-tag" style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#fca5a5', marginBottom: '0.75rem' }}>
          ROLE SEPARATION GUARD
        </div>

        <h2 style={{ fontSize: '1.35rem', marginBottom: '0.5rem' }}>
          Access Restricted: Persona Mismatch
        </h2>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
          This console section requires the <strong>{targetTitle}</strong> role.
          You are currently operating as <strong>{currentTitle}</strong> ({user?.name}).
        </p>

        <div className="demo-banner demo-banner-warning" style={{ textAlign: 'left', marginBottom: '1.5rem', fontSize: '11px' }}>
          <ShieldAlert size={16} style={{ flexShrink: 0 }} />
          <div>
            <strong>Frontend Simulation Notice:</strong> This client-side guard prevents cross-persona viewing in development. Real backend authorization will be enforced at the gateway API layer.
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button
            className="btn btn-primary"
            style={{ padding: '0.75rem' }}
            onClick={() => switchRole(requiredRole)}
          >
            <span>Switch Role to {targetTitle} & Proceed</span>
            <ArrowRight size={16} />
          </button>

          <Link to={fallbackDashboard} className="btn btn-secondary" style={{ padding: '0.75rem' }}>
            <span>Return to {currentTitle} Dashboard</span>
          </Link>

          <Link to="/select-role" className="btn btn-ghost btn-sm" style={{ color: 'var(--text-muted)' }}>
            <UserCheck size={14} />
            <span>Go to Development Role Selector</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
