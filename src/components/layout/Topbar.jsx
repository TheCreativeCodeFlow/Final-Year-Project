import React from 'react';
import { Menu, ShieldAlert, Sparkles, UserCheck } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Link } from 'react-router-dom';

export default function Topbar({ onToggleSidebar }) {
  const { user, role, ROLES } = useAuth();

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

        <span className="demo-tag" title="Simulated environment for frontend demonstration">
          <Sparkles size={11} />
          <span>DEMO TELEMETRY</span>
        </span>
      </div>

      <div className="topbar-right">
        {/* Switch Persona Quick Link */}
        <Link
          to="/select-role"
          className="btn btn-secondary btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <UserCheck size={14} />
          <span>Switch Persona</span>
        </Link>

        {/* Current user badge */}
        {user && (
          <div className="user-profile-badge">
            <div className="user-avatar">{user.avatarInitials}</div>
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
