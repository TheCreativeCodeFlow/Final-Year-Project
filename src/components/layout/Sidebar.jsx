import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Shield,
  LayoutDashboard,
  Layers,
  Activity,
  Network,
  Sliders,
  FileText,
  Radio,
  Shuffle,
  Users,
  LogOut,
  X,
  Server,
  ShieldAlert,
  GitBranch
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export default function Sidebar({ isOpen, onClose }) {
  const { role, user, switchRole, logout, ROLES } = useAuth();
  const navigate = useNavigate();

  const isOwner = role === ROLES.OWNER;
  const isAdmin = role === ROLES.ADMIN;

  const handleRoleToggle = (targetRole) => {
    switchRole(targetRole);
    if (targetRole === ROLES.OWNER) {
      navigate('/owner/overview');
    } else {
      navigate('/admin/overview');
    }
    if (onClose) onClose();
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      {isOpen && <div className="sidebar-backdrop" onClick={onClose} />}
      <aside className={`app-sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="brand-badge">
            <div className="brand-icon-wrapper">
              <Shield size={20} />
            </div>
            <div className="brand-info">
              <span className="brand-title">DeceptionGateway</span>
              <span className="brand-subtitle">
                {isOwner ? 'Tenant Console' : 'Platform Ops'}
              </span>
            </div>
          </div>
          {onClose && (
            <button className="menu-toggle-btn" onClick={onClose} aria-label="Close sidebar">
              <X size={18} />
            </button>
          )}
        </div>

        <div className="sidebar-content">
          {/* Owner Navigation */}
          {isOwner && (
            <div>
              <div className="nav-section-title">Application Owner</div>
              <ul className="nav-list">
                <li>
                  <NavLink
                    to="/owner/overview"
                    className={({ isActive }) => `nav-item-link ${isActive ? 'active' : ''}`}
                    onClick={onClose}
                  >
                    <LayoutDashboard size={18} />
                    <span>Overview</span>
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/owner/applications"
                    className={({ isActive }) => `nav-item-link ${isActive ? 'active' : ''}`}
                    onClick={onClose}
                  >
                    <Layers size={18} />
                    <span>Applications</span>
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/owner/events"
                    className={({ isActive }) => `nav-item-link ${isActive ? 'active' : ''}`}
                    onClick={onClose}
                  >
                    <Activity size={18} />
                    <span>Security Events</span>
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/owner/integrations"
                    className={({ isActive }) => `nav-item-link ${isActive ? 'active' : ''}`}
                    onClick={onClose}
                  >
                    <Network size={18} />
                    <span>Integrations</span>
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/owner/settings"
                    className={({ isActive }) => `nav-item-link ${isActive ? 'active' : ''}`}
                    onClick={onClose}
                  >
                    <Sliders size={18} />
                    <span>Settings</span>
                  </NavLink>
                </li>
              </ul>
            </div>
          )}

          {/* Admin Navigation */}
          {isAdmin && (
            <div>
              <div className="nav-section-title">Platform Administration</div>
              <ul className="nav-list">
                <li>
                  <NavLink
                    to="/admin/overview"
                    className={({ isActive }) => `nav-item-link ${isActive ? 'active' : ''}`}
                    onClick={onClose}
                  >
                    <LayoutDashboard size={18} />
                    <span>Platform Overview</span>
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/admin/tenants"
                    className={({ isActive }) => `nav-item-link ${isActive ? 'active' : ''}`}
                    onClick={onClose}
                  >
                    <Users size={18} />
                    <span>Tenants</span>
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/admin/health"
                    className={({ isActive }) => `nav-item-link ${isActive ? 'active' : ''}`}
                    onClick={onClose}
                  >
                    <Server size={18} />
                    <span>Gateway Health</span>
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/admin/audit-logs"
                    className={({ isActive }) => `nav-item-link ${isActive ? 'active' : ''}`}
                    onClick={onClose}
                  >
                    <FileText size={18} />
                    <span>Audit Logs</span>
                  </NavLink>
                </li>
              </ul>

              <div className="nav-section-title" style={{ marginTop: '1.25rem' }}>
                Advanced Operations
              </div>
              <ul className="nav-list">
                <li>
                  <NavLink
                    to="/admin/investigations"
                    className={({ isActive }) => `nav-item-link ${isActive ? 'active' : ''}`}
                    onClick={onClose}
                  >
                    <Radio size={18} />
                    <span>Threat Investigations</span>
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/admin/attacker-profiles"
                    className={({ isActive }) => `nav-item-link ${isActive ? 'active' : ''}`}
                    onClick={onClose}
                  >
                    <ShieldAlert size={18} />
                    <span>Attacker Profiles</span>
                  </NavLink>
                </li>
                <li>
                  <span className="nav-item-link" style={{ opacity: 0.45, cursor: 'not-allowed' }}>
                    <Network size={18} />
                    <span>Deception Environments</span>
                    <span className="nav-item-badge">Planned</span>
                  </span>
                </li>
                <li>
                  <span className="nav-item-link" style={{ opacity: 0.45, cursor: 'not-allowed' }}>
                    <GitBranch size={18} />
                    <span>Deception State Graph</span>
                    <span className="nav-item-badge">Planned</span>
                  </span>
                </li>
                <li>
                  <span className="nav-item-link" style={{ opacity: 0.45, cursor: 'not-allowed' }}>
                    <Sliders size={18} />
                    <span>Policies & Strategies</span>
                    <span className="nav-item-badge">Stage 2C</span>
                  </span>
                </li>
              </ul>
            </div>
          )}

          {/* Simulation Helper Box in Sidebar */}
          <div style={{ marginTop: 'auto' }}>
            <div className="role-switch-box">
              <div className="role-switch-header">
                <span>SIMULATION PERSONA</span>
                <span className="demo-tag">DEV MODE</span>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                Currently acting as <strong>{user?.roleTitle || 'Guest'}</strong> ({user?.tenant}).
              </p>
              <div style={{ display: 'flex', gap: '4px', flexDirection: 'column' }}>
                <button
                  type="button"
                  className={`btn btn-sm ${isOwner ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ width: '100%', justifyContent: 'flex-start' }}
                  onClick={() => handleRoleToggle(ROLES.OWNER)}
                >
                  <Layers size={14} />
                  <span>Switch to App Owner</span>
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${isAdmin ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ width: '100%', justifyContent: 'flex-start' }}
                  onClick={() => handleRoleToggle(ROLES.ADMIN)}
                >
                  <Shield size={14} />
                  <span>Switch to Gateway Admin</span>
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--text-muted)' }}
                  onClick={() => {
                    navigate('/select-role');
                    if (onClose) onClose();
                  }}
                >
                  <span>Open Role Selector View</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="sidebar-footer">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--text-muted)' }}
            onClick={handleLogout}
          >
            <LogOut size={16} />
            <span>Sign Out (Simulation)</span>
          </button>
        </div>
      </aside>
    </>
  );
}
