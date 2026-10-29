import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Layers,
  Plus,
  Search,
  Filter,
  ArrowUpDown,
  ExternalLink,
  Shield,
  ShieldCheck,
  AlertTriangle,
  Activity,
  Edit2,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import EmptyState from '../../components/common/EmptyState';
import LoadingState from '../../components/common/LoadingState';
import { useAuth } from '../../hooks/useAuth';
import { apiClient } from '../../services/apiClient';
import { getApplications, DEMO_DATA_DISCLAIMER } from '../../services/mockData';

export default function ApplicationsListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLiveSource, setIsLiveSource] = useState(false);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [envFilter, setEnvFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name-asc');

  const fetchApps = async () => {
    setLoading(true);
    try {
      const tenantId = (user && user.tenantId) || 'tenant-apex-9941';
      const res = await apiClient.getApplications(tenantId);
      if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
        setApplications(res.data);
        setIsLiveSource(true);
        setLoading(false);
        return;
      }
    } catch {
      // Backend unavailable or unauthenticated; fall back gracefully to prototype fixtures
    }

    getApplications().then((res) => {
      setApplications(res);
      setIsLiveSource(false);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchApps();
  }, []);

  // Filtered & Sorted applications
  const filteredApps = useMemo(() => {
    let result = [...applications];

    // Search
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(
        app =>
          app.name.toLowerCase().includes(q) ||
          app.domain.toLowerCase().includes(q) ||
          app.route.toLowerCase().includes(q) ||
          app.description.toLowerCase().includes(q) ||
          (app.tags && app.tags.some(t => t.toLowerCase().includes(q)))
      );
    }

    // Environment
    if (envFilter !== 'all') {
      result = result.filter(app => app.environment === envFilter);
    }

    // Status
    if (statusFilter !== 'all') {
      result = result.filter(app => app.status === statusFilter);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
      if (sortBy === 'name-desc') return b.name.localeCompare(a.name);
      if (sortBy === 'volume-desc') return (b.requestsPerSec || 0) - (a.requestsPerSec || 0);
      if (sortBy === 'threats-desc') return (b.threatCount || 0) - (a.threatCount || 0);
      return 0;
    });

    return result;
  }, [applications, searchTerm, envFilter, statusFilter, sortBy]);

  const clearFilters = () => {
    setSearchTerm('');
    setEnvFilter('all');
    setStatusFilter('all');
    setSortBy('name-asc');
  };

  if (loading) {
    return (
      <div className="page-container">
        <LoadingState message="Loading protected applications..." />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Protected Applications"
        badge="Apex FinTech Cloud"
        description="Register and manage upstream services routed through the adaptive cyber deception gateway."
        actions={
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button className="btn btn-secondary btn-sm" onClick={fetchApps} title="Refresh application list">
              <RefreshCw size={14} />
              <span>Refresh</span>
            </button>
            <Link to="/owner/applications/new" className="btn btn-primary btn-sm">
              <Plus size={16} />
              <span>Register Application</span>
            </Link>
          </div>
        }
      />

      <div className="page-container">
        {/* Telemetry / Data Source Banner */}
        <div className="demo-banner" style={isLiveSource ? { borderColor: 'rgba(56, 189, 248, 0.4)', background: 'rgba(56, 189, 248, 0.08)' } : {}}>
          <Sparkles size={16} style={{ flexShrink: 0, color: isLiveSource ? 'var(--color-primary, #38bdf8)' : undefined }} />
          <div>
            {isLiveSource ? (
              <>
                <strong style={{ color: 'var(--color-primary, #38bdf8)' }}>Live Database-Backed Registry:</strong> Connected to PostgreSQL persistent backend under authorized tenant context.
              </>
            ) : (
              <>
                <strong>Simulated Application Registry:</strong> {DEMO_DATA_DISCLAIMER} Registered services are simulated prototypes.
              </>
            )}
          </div>
        </div>

        {/* Search, Filter & Sort Controls */}
        <div className="cyber-card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1rem',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            {/* Search Input */}
            <div style={{ position: 'relative', minWidth: '260px', flex: 1 }}>
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }}
              />
              <input
                type="text"
                className="cyber-input"
                style={{ width: '100%', paddingLeft: '32px' }}
                placeholder="Search by application, domain, route, or tag..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Filter Dropdowns */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
              <div>
                <select
                  className="cyber-select"
                  value={envFilter}
                  onChange={(e) => setEnvFilter(e.target.value)}
                  aria-label="Filter by Environment"
                >
                  <option value="all">All Environments</option>
                  <option value="production">Production</option>
                  <option value="staging">Staging</option>
                  <option value="development">Development</option>
                </select>
              </div>

              <div>
                <select
                  className="cyber-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label="Filter by Protection Status"
                >
                  <option value="all">All Statuses</option>
                  <option value="shielded">Shielded</option>
                  <option value="monitoring">Monitoring Only</option>
                  <option value="degraded">Degraded</option>
                </select>
              </div>

              <div>
                <select
                  className="cyber-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  aria-label="Sort Applications"
                >
                  <option value="name-asc">Name (A → Z)</option>
                  <option value="name-desc">Name (Z → A)</option>
                  <option value="volume-desc">Highest Traffic</option>
                  <option value="threats-desc">Most Threats</option>
                </select>
              </div>

              {(searchTerm || envFilter !== 'all' || statusFilter !== 'all') && (
                <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Applications Count Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
          <span>
            Showing <strong>{filteredApps.length}</strong> of {applications.length} registered applications
          </span>
          <span className="demo-tag">CLIENT-PERSISTED STORE</span>
        </div>

        {/* Applications List Table */}
        {filteredApps.length === 0 ? (
          <EmptyState
            title="No Matching Applications"
            description="No protected services match your search or filter settings. Clear your filters or register a new mock application."
            actionText="Clear Filters"
            onAction={clearFilters}
          />
        ) : (
          <div className="cyber-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="cyber-table-container" style={{ border: 'none' }}>
              <table className="cyber-table">
                <thead>
                  <tr>
                    <th>Application Details</th>
                    <th>Ingress Hostname / Route</th>
                    <th>Environment</th>
                    <th>Status</th>
                    <th>Throughput</th>
                    <th>Threats</th>
                    <th>Active Decoys</th>
                    <th>Last Activity</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApps.map((app) => (
                    <tr key={app.id}>
                      {/* Name & ID */}
                      <td>
                        <Link
                          to={`/owner/applications/${app.id}`}
                          style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'block' }}
                        >
                          {app.name}
                        </Link>
                        <div style={{ display: 'flex', gap: '4px', marginTop: '3px', flexWrap: 'wrap' }}>
                          <span className="mono-tag" style={{ fontSize: '10px' }}>{app.id}</span>
                          {app.tags && app.tags.slice(0, 2).map(tag => (
                            <span key={tag} style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'var(--bg-surface-elevated)', padding: '1px 5px', borderRadius: '3px' }}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Route / Domain */}
                      <td>
                        <div className="mono-tag" style={{ color: '#93c5fd' }}>{app.domain}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Path: {app.route.replace(app.domain, '') || '/'}
                        </div>
                      </td>

                      {/* Environment */}
                      <td>
                        <span
                          className="demo-tag"
                          style={{
                            textTransform: 'capitalize',
                            backgroundColor: app.environment === 'production' ? 'rgba(37, 99, 235, 0.15)' : 'rgba(234, 179, 8, 0.12)',
                            color: app.environment === 'production' ? '#60a5fa' : '#facc15',
                            borderColor: app.environment === 'production' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(234, 179, 8, 0.3)'
                          }}
                        >
                          {app.environment}
                        </span>
                      </td>

                      {/* Protection Status */}
                      <td>
                        <StatusBadge
                          status={app.status === 'shielded' ? 'operational' : app.status === 'monitoring' ? 'low' : 'medium'}
                          label={app.status}
                        />
                      </td>

                      {/* Request Volume */}
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600 }}>
                          {app.requestsPerSec} req/s
                        </span>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{app.requestVolume}</div>
                      </td>

                      {/* Threat Count */}
                      <td>
                        <span style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '12px',
                          color: app.threatCount > 500 ? 'var(--severity-high)' : 'var(--text-secondary)'
                        }}>
                          {app.threatCount} detected
                        </span>
                      </td>

                      {/* Active Decoys */}
                      <td>
                        <span className="demo-tag" style={{ backgroundColor: 'var(--accent-deception-subtle)', color: '#c084fc', borderColor: 'rgba(192, 132, 252, 0.3)' }}>
                          {app.activeDecoys} Decoys
                        </span>
                      </td>

                      {/* Last Activity */}
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {app.lastActivity}
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <Link
                            to={`/owner/applications/${app.id}`}
                            className="btn btn-secondary btn-sm"
                            title="Inspect application details and telemetry"
                          >
                            <span>Inspect</span>
                          </Link>
                          <Link
                            to={`/owner/applications/new?edit=${app.id}`}
                            className="btn btn-ghost btn-sm"
                            title="Edit mock application settings"
                          >
                            <Edit2 size={13} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
