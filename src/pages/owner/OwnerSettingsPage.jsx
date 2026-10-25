import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Save,
  Check,
  AlertCircle,
  Users,
  Bell,
  Building,
  Monitor,
  Sparkles,
  RotateCcw,
  UserPlus
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingState from '../../components/common/LoadingState';
import {
  getOwnerSettings,
  updateOwnerSettings,
  DEFAULT_OWNER_SETTINGS,
  DEMO_DATA_DISCLAIMER
} from '../../services/mockData';

export default function OwnerSettingsPage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form local state
  const [tenantName, setTenantName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [timezone, setTimezone] = useState('');
  const [defaultTimeRange, setDefaultTimeRange] = useState('24h');
  const [rowDensity, setRowDensity] = useState('compact');
  const [emailAlertsCritical, setEmailAlertsCritical] = useState(true);
  const [emailAlertsHigh, setEmailAlertsHigh] = useState(true);
  const [honeynetTriggerDigest, setHoneynetTriggerDigest] = useState(true);
  const [webhookAlertsEnabled, setWebhookAlertsEnabled] = useState(false);
  const [webhookEndpoint, setWebhookEndpoint] = useState('');

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    getOwnerSettings().then((s) => {
      if (isMounted) {
        setSettings(s);
        setTenantName(s.organization.tenantName);
        setContactEmail(s.organization.contactEmail);
        setTimezone(s.organization.timezone);
        setDefaultTimeRange(s.displayPreferences.defaultTimeRange);
        setRowDensity(s.displayPreferences.rowDensity);
        setEmailAlertsCritical(s.notificationPreferences.emailAlertsCritical);
        setEmailAlertsHigh(s.notificationPreferences.emailAlertsHigh);
        setHoneynetTriggerDigest(s.notificationPreferences.honeynetTriggerDigest);
        setWebhookAlertsEnabled(s.notificationPreferences.webhookAlertsEnabled);
        setWebhookEndpoint(s.notificationPreferences.webhookEndpoint);
        setLoading(false);
      }
    });

    return () => { isMounted = false; };
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    const patch = {
      organization: {
        tenantName,
        contactEmail,
        timezone
      },
      displayPreferences: {
        defaultTimeRange,
        rowDensity
      },
      notificationPreferences: {
        emailAlertsCritical,
        emailAlertsHigh,
        honeynetTriggerDigest,
        webhookAlertsEnabled,
        webhookEndpoint
      }
    };

    const updated = await updateOwnerSettings(patch);
    setSettings(updated);
    setIsSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleResetDefaults = async () => {
    const updated = await updateOwnerSettings(DEFAULT_OWNER_SETTINGS);
    setSettings(updated);
    setTenantName(updated.organization.tenantName);
    setContactEmail(updated.organization.contactEmail);
    setTimezone(updated.organization.timezone);
    setDefaultTimeRange(updated.displayPreferences.defaultTimeRange);
    setRowDensity(updated.displayPreferences.rowDensity);
    setEmailAlertsCritical(updated.notificationPreferences.emailAlertsCritical);
    setEmailAlertsHigh(updated.notificationPreferences.emailAlertsHigh);
    setHoneynetTriggerDigest(updated.notificationPreferences.honeynetTriggerDigest);
    setWebhookAlertsEnabled(updated.notificationPreferences.webhookAlertsEnabled);
    setWebhookEndpoint(updated.notificationPreferences.webhookEndpoint);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  if (loading || !settings) {
    return (
      <div className="page-container">
        <LoadingState message="Loading tenant configuration and preferences..." />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Owner Portal Settings"
        badge="Apex FinTech Cloud"
        description="Manage organization metadata, display parameters, and threat alerting preferences."
        actions={
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button className="btn btn-secondary btn-sm" onClick={handleResetDefaults} type="button">
              <RotateCcw size={14} />
              <span>Reset Defaults</span>
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={isSaving} type="button">
              <Save size={14} />
              <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
            </button>
          </div>
        }
      />

      <div className="page-container" style={{ maxWidth: '960px', margin: '0 auto', width: '100%' }}>
        {/* Simulation Scope Notice */}
        <div className="demo-banner">
          <Sparkles size={16} style={{ flexShrink: 0 }} />
          <div>
            <strong>Client-Side Storage:</strong> {DEMO_DATA_DISCLAIMER} Preferences are saved in your local browser session.
          </div>
        </div>

        {/* Save Success Notice */}
        {saveSuccess && (
          <div className="demo-banner" style={{ background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.4)', color: '#6ee7b7' }}>
            <Check size={16} style={{ flexShrink: 0 }} />
            <div>Settings successfully saved to local mock storage!</div>
          </div>
        )}

        {/* Section 1: Organization Profile */}
        <div className="cyber-card">
          <div className="cyber-card-header">
            <div className="cyber-card-title">
              <Building size={18} style={{ color: 'var(--accent-primary-light)' }} />
              <span>Organization & Tenant Profile</span>
            </div>
            <span className="demo-tag">{settings.organization.tenantId}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Tenant Organization Name
              </label>
              <input
                type="text"
                className="cyber-input"
                style={{ width: '100%' }}
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Primary Security Contact
              </label>
              <input
                type="email"
                className="cyber-input"
                style={{ width: '100%' }}
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Reporting Timezone
              </label>
              <select
                className="cyber-select"
                style={{ width: '100%' }}
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              >
                <option value="UTC (Coordinated Universal Time)">UTC (Coordinated Universal Time)</option>
                <option value="America/New_York (EST / EDT)">America/New_York (EST / EDT)</option>
                <option value="Europe/London (GMT / BST)">Europe/London (GMT / BST)</option>
                <option value="Asia/Singapore (SGT)">Asia/Singapore (SGT)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Enrolled Security Tier
              </label>
              <input
                type="text"
                className="cyber-input"
                style={{ width: '100%', opacity: 0.7 }}
                value={settings.organization.environmentTier}
                disabled
              />
            </div>
          </div>
        </div>

        {/* Section 2: Display & Telemetry Preferences */}
        <div className="cyber-card">
          <div className="cyber-card-header">
            <div className="cyber-card-title">
              <Monitor size={18} style={{ color: '#38bdf8' }} />
              <span>Display & Telemetry Preferences</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Default Dashboard Time Window
              </label>
              <select
                className="cyber-select"
                style={{ width: '100%' }}
                value={defaultTimeRange}
                onChange={(e) => setDefaultTimeRange(e.target.value)}
              >
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Table Data Density
              </label>
              <select
                className="cyber-select"
                style={{ width: '100%' }}
                value={rowDensity}
                onChange={(e) => setRowDensity(e.target.value)}
              >
                <option value="compact">Compact (Enterprise SaaS standard)</option>
                <option value="comfortable">Comfortable (Expanded row spacing)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: Notification Preferences */}
        <div className="cyber-card">
          <div className="cyber-card-header">
            <div className="cyber-card-title">
              <Bell size={18} style={{ color: 'var(--severity-high)' }} />
              <span>Threat Alerts & Honeynet Notifications</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={emailAlertsCritical}
                onChange={(e) => setEmailAlertsCritical(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--accent-primary)' }}
              />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>Critical Severity Incident Alerts</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Send simulated instant alerts when a critical threat is diverted into deception sandboxes.</div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={emailAlertsHigh}
                onChange={(e) => setEmailAlertsHigh(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--accent-primary)' }}
              />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>High Severity Anomaly Alerts</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Alert security staff for SQLi probes, SSRF attempts, and brute force sequences.</div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={honeynetTriggerDigest}
                onChange={(e) => setHoneynetTriggerDigest(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--accent-primary)' }}
              />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>Daily Honeynet Engagement Digest</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Receive an aggregated executive summary of attacker dwell times and decoy efficacy.</div>
              </div>
            </label>

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Simulated SIEM Webhook Destination (Optional)
              </label>
              <input
                type="text"
                className="cyber-input"
                style={{ width: '100%' }}
                placeholder="https://siem.apexfintech.internal/webhooks/deception-events"
                value={webhookEndpoint}
                onChange={(e) => setWebhookEndpoint(e.target.value)}
              />
              <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Requires backend webhook dispatcher; preserved as mock configuration parameter.
              </span>
            </div>
          </div>
        </div>

        {/* Section 4: Team-Member Demonstration List */}
        <div className="cyber-card">
          <div className="cyber-card-header">
            <div>
              <div className="cyber-card-title">
                <Users size={18} style={{ color: 'var(--status-success)' }} />
                <span>Authorized Team Members (Demonstration List)</span>
              </div>
              <div className="cyber-card-subtitle">
                Staff members authorized to view tenant telemetry and manage canary routes
              </div>
            </div>

            <button
              className="btn btn-secondary btn-sm"
              type="button"
              onClick={() => alert("Simulated action: User invitation and RBAC provisioning will be implemented on the backend in subsequent stages.")}
            >
              <UserPlus size={14} />
              <span>Invite Member (Simulated)</span>
            </button>
          </div>

          <div className="cyber-table-container">
            <table className="cyber-table">
              <thead>
                <tr>
                  <th>Member Name</th>
                  <th>Email Address</th>
                  <th>Assigned Role</th>
                  <th>Account Status</th>
                  <th>Last Session</th>
                </tr>
              </thead>
              <tbody>
                {settings.teamMembers.map((m) => (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {m.name}
                    </td>
                    <td>
                      <span className="mono-tag">{m.email}</span>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {m.role}
                    </td>
                    <td>
                      <StatusBadge status={m.status === 'Active' ? 'operational' : 'offline'} label={m.status} />
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {m.lastLogin}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
