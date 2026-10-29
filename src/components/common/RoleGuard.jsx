import React from 'react';
import { Navigate, Link, useLocation } from 'react-router-dom';
import { ShieldAlert, ArrowRight, Lock, LogIn, RefreshCw } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import LoadingState from './LoadingState';

export default function RoleGuard({ requiredRole, children }) {
  const { isAuthenticated, isLoading, role, user, ROLES } = useAuth();
  const location = useLocation();

  // 1. While restoring session from server, show clear loading state
  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '80vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem'
        }}
      >
        <LoadingState message="Verifying session and security clearance..." />
      </div>
    );
  }

  // 2. If not authenticated, redirect to login preserving intended target
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. Platform administrators have global authority across all routes
  if (user?.isPlatformAdmin === true) {
    return children;
  }

  // 4. Role Match check
  const isMatch = role === requiredRole;
  if (isMatch) {
    return children;
  }

  // 5. Access Restricted
  const isRequiredAdmin = requiredRole === ROLES.ADMIN;
  const targetTitle = isRequiredAdmin ? 'Platform Administrator' : 'Application Owner';
  const currentTitle = user?.roleTitle || (role === ROLES.OWNER ? 'Application Owner' : 'Tenant Member');
  const fallbackDashboard = '/owner/overview';

  return (
    <div
      style={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem'
      }}
    >
      <div
        className="cyber-card"
        style={{
          maxWidth: '520px',
          width: '100%',
          textAlign: 'center',
          padding: '2.5rem 2rem'
        }}
      >
        <div
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '12px',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            color: 'var(--severity-critical)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1.25rem'
          }}
        >
          <Lock size={26} />
        </div>

        <div
          className="demo-tag"
          style={{
            borderColor: 'rgba(239, 68, 68, 0.4)',
            color: '#fca5a5',
            marginBottom: '0.75rem'
          }}
        >
          SECURITY CLEARANCE RESTRICTION
        </div>

        <h2 style={{ fontSize: '1.35rem', marginBottom: '0.5rem' }}>
          Access Denied: Insufficient Clearance
        </h2>

        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: '0.875rem',
            marginBottom: '1.25rem',
            lineHeight: 1.5
          }}
        >
          This console view requires <strong>{targetTitle}</strong> clearance.
          You are authenticated as <strong>{user?.name}</strong> with current role{' '}
          <strong>{currentTitle}</strong>.
        </p>

        <div
          className="demo-banner demo-banner-warning"
          style={{ textAlign: 'left', marginBottom: '1.5rem', fontSize: '11px' }}
        >
          <ShieldAlert size={16} style={{ flexShrink: 0 }} />
          <div>
            <strong>Stage 3E Authorization Policy:</strong> Access permissions are verified directly against
            the PostgreSQL identity database. Self-elevation is prohibited.
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <Link
            to={fallbackDashboard}
            className="btn btn-primary"
            style={{ padding: '0.75rem', justifyContent: 'center' }}
          >
            <span>Return to Authorized Tenant Dashboard</span>
            <ArrowRight size={16} />
          </Link>

          <Link
            to="/login"
            className="btn btn-secondary"
            style={{ padding: '0.75rem', justifyContent: 'center' }}
          >
            <LogIn size={15} />
            <span>Switch Account / Sign In with Admin Credentials</span>
          </Link>

          <Link
            to="/select-role"
            className="btn btn-ghost btn-sm"
            style={{ color: 'var(--text-muted)', justifyContent: 'center' }}
          >
            <span>Inspect Role Permissions</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
