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
  GitBranch,
  Compass,
  PlayCircle,
  Building2,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export default function Sidebar({ isOpen, onClose }) {
  const { role, user, logout, activeTenant, authorizedTenants, switchTenant, ROLES } = useAuth();
  const navigate = useNavigate();

  const isOwner = role === ROLES.OWNER || user?.isPlatformAdmin;
  const isAdmin = role === ROLES.ADMIN || user?.isPlatformAdmin;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleTenantChange = (e) => {
    const tenantIdentifier = e.target.value;
    switchTenant(tenantIdentifier);
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
                {user?.isPlatformAdmin ? 'Platform Operations' : (activeTenant?.displayName || 'Tenant Console')}
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
            <div style={{ marginTop: isOwner ? '1.5rem' : '0' }}>
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
                  <NavLink
                    to="/admin/deception-environments"
                    className={({ isActive }) => `nav-item-link ${isActive ? 'active' : ''}`}
                    onClick={onClose}
                  >
                    <Network size={18} />
                    <span>Deception Environments</span>
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/admin/deception-state-graph"
                    className={({ isActive }) => `nav-item-link ${isActive ? 'active' : ''}`}
                    onClick={onClose}
                  >
                    <GitBranch size={18} />
                    <span>Deception State Graph</span>
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/admin/deception-policies"
                    className={({ isActive }) => `nav-item-link ${isActive ? 'active' : ''}`}
                    onClick={onClose}
                  >
                    <Sliders size={18} />
                    <span>Deception Policies</span>
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/admin/deception-strategies"
                    className={({ isActive }) => `nav-item-link ${isActive ? 'active' : ''}`}
                    onClick={onClose}
                  >
                    <Compass size={18} />
                    <span>Strategy Management</span>
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/admin/gateway-simulator"
                    className={({ isActive }) => `nav-item-link ${isActive ? 'active' : ''}`}
                    onClick={onClose}
                  >
                    <PlayCircle size={18} />
                    <span>Gateway Simulator</span>
                  </NavLink>
                </li>
              </ul>
            </div>
          )}

          {/* Tenant Switcher & Session Info in Sidebar */}
          <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
            <div className="role-switch-box">
              <div className="role-switch-header">
                <span>ACTIVE TENANT CONTEXT</span>
                <span className="demo-tag" style={{ borderColor: '#10b981', color: '#6ee7b7' }}>
                  POSTGRES
                </span>
              </div>

              {authorizedTenants && authorizedTenants.length > 1 ? (
                <div style={{ marginBottom: '0.65rem' }}>
                  <label style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)', marginBottom: '3px' }}>
                    Switch Authorized Tenant
                  </label>
                  <select
                    className="cyber-select"
                    style={{ width: '100%', fontSize: '11px', padding: '0.35rem 0.5rem' }}
                    value={activeTenant?.identifier || activeTenant?.id || ''}
                    onChange={handleTenantChange}
                  >
                    {authorizedTenants.map((item) => {
                      const t = item.tenant || item;
                      return (
                        <option key={t.identifier || t.id} value={t.identifier || t.id}>
                          {t.displayName || t.identifier}
                        </option>
                      );
                    })}
                  </select>
                </div>
              ) : (
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                  Tenant: <strong>{activeTenant?.displayName || 'Apex FinTech Cloud'}</strong>
                </p>
              )}

              <div style={{ fontSize: '11px', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.5rem' }}>
                Signed in as: <strong style={{ color: 'var(--text-primary)' }}>{user?.name || 'Guest'}</strong>
                <div style={{ fontSize: '10px', color: 'var(--accent-primary-light)' }}>
                  {user?.roleTitle}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="sidebar-footer">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--severity-critical)' }}
            onClick={handleLogout}
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
