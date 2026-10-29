import React from 'react';
import { Menu, ShieldAlert, Sparkles, Building2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Link } from 'react-router-dom';

export default function Topbar({ onToggleSidebar }) {
  const { user, activeTenant } = useAuth();

  return (
    <header className="app-topbar">
      <div className="topbar-left">
        <button
          className="menu-toggle-btn"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation menu"
        >
          <Menu size={18} />
        </button>

        <div className="gateway-status-pill">
          <span className="status-pulse-dot" />
          <span>Gateway: Shield Active</span>
        </div>

        {activeTenant && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: 'var(--text-secondary)',
              padding: '0.25rem 0.65rem',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              borderRadius: '20px',
              border: '1px solid var(--border-subtle)'
            }}
          >
            <Building2 size={13} style={{ color: 'var(--accent-primary-light)' }} />
            <span>{activeTenant.displayName}</span>
          </div>
        )}
      </div>

      <div className="topbar-right">
        {/* Clearance Scope Link */}
        <Link
          to="/select-role"
          className="btn btn-secondary btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <ShieldCheck size={14} style={{ color: '#10b981' }} />
          <span>Security Clearance</span>
        </Link>

        {/* Current user badge */}
        {user && (
          <div className="user-profile-badge">
            <div className="user-avatar">{user.initials}</div>
            <div className="user-details">
              <span className="user-name">{user.name}</span>
              <span className="user-role-label">{user.roleTitle}</span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
