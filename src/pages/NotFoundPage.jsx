import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Home, UserCheck } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function NotFoundPage() {
  const { role, ROLES } = useAuth();

  const defaultDestination = role === ROLES.ADMIN ? '/admin/overview' : '/owner/overview';

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--bg-canvas)',
      padding: '2rem'
    }}>
      <div className="cyber-card" style={{ maxWidth: '500px', width: '100%', textAlign: 'center', padding: '3rem 2rem' }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: 'rgba(239, 68, 68, 0.12)',
          color: 'var(--severity-critical)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1.25rem'
        }}>
          <ShieldAlert size={32} />
        </div>

        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>404: Endpoint Not Found</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
          The requested route is not registered on this gateway console. In future stages, additional endpoint management and policy routing views will be enabled.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <Link to={defaultDestination} className="btn btn-primary" style={{ padding: '0.75rem' }}>
            <Home size={16} />
            <span>Return to Current Dashboard</span>
          </Link>

          <Link to="/select-role" className="btn btn-secondary" style={{ padding: '0.75rem' }}>
            <UserCheck size={16} />
            <span>Go to Development Role Selector</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
