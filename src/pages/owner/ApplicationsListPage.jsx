import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Layers,
  Plus,
  Search,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  Server,
  ShieldCheck,
  Edit2,
  CheckCircle2,
  ExternalLink,
  Shield
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import EmptyState from '../../components/common/EmptyState';
import LoadingState from '../../components/common/LoadingState';
import { useAuth } from '../../hooks/useAuth';
import { apiClient } from '../../services/apiClient';
import { getApplications as getMockApplications, DEMO_DATA_DISCLAIMER } from '../../services/mockData';

export default function ApplicationsListPage() {
  const navigate = useNavigate();
  const { user, activeTenant } = useAuth();

  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState('live'); // 'live' | 'demo'
  const [fetchError, setFetchError] = useState(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name-asc');

  const tenantIdentifier = activeTenant?.identifier || activeTenant?.id || 'tenant-apex-9941';

  const fetchLiveApplications = useCallback(async () => {
    setLoading(true);
    setFetchError(null);

    try {
      const res = await apiClient.getApplications(tenantIdentifier);
      if (res && res.success) {
        setApplications(res.data || []);
        setDataSource('live');
        setLoading(false);
        return;
      }
      throw new Error((res && res.error && res.error.message) || 'Unknown response from backend.');
    } catch (err) {
      setFetchError(err.message || 'Failed to retrieve applications from backend.');
      setLoading(false);
    }
  }, [tenantIdentifier]);

  const loadOfflineDemoData = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const mockList = await getMockApplications();
      setApplications(mockList);
      setDataSource('demo');
    } catch {
      setFetchError('Failed to load demo fixtures.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLiveApplications();
  }, [fetchLiveApplications]);

  // Filtered & Sorted applications
  const filteredApps = useMemo(() => {
    let result = [...applications];

    // Search
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter((app) => {
        const nameMatch = app.name && app.name.toLowerCase().includes(q);
        const domainMatch = app.domain && app.domain.toLowerCase().includes(q);
        const idMatch = (app.applicationIdentifier || app.id || '').toLowerCase().includes(q);
        return nameMatch || domainMatch || idMatch;
      });
    }

    // Status Filter
    if (statusFilter !== 'all') {
      result = result.filter((app) => {
        const appStatus = (app.status || '').toUpperCase();
        return appStatus === statusFilter.toUpperCase();
      });
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'name-asc') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'name-desc') return (b.name || '').localeCompare(a.name || '');
      if (sortBy === 'date-desc') {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      }
      return 0;
    });

    return result;
  }, [applications, searchTerm, statusFilter, sortBy]);

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setSortBy('name-asc');
  };

  if (loading) {
    return (
      <div className="page-container">
        <LoadingState message={`Retrieving protected applications for tenant "${activeTenant?.displayName || tenantIdentifier}"...`} />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Protected Applications"
        badge={activeTenant?.displayName || 'Apex FinTech Cloud'}
        description="Register and manage upstream services routed through the adaptive cyber deception gateway."
        actions={
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={fetchLiveApplications}
              title="Refresh application list from database"
            >
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
        {/* Connection Failure Error Banner */}
        {fetchError && (
          <div
            style={{
              padding: '1.25rem',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              marginBottom: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#fca5a5' }}>
              <AlertTriangle size={20} style={{ flexShrink: 0 }} />
              <strong style={{ fontSize: '14px' }}>Backend API Connection Error:</strong>
              <span>{fetchError}</span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
              The application could not retrieve live records for tenant <code>{tenantIdentifier}</code> from the Stage 3D REST API.
              Verify that the backend is running on port 4000 and that you are signed in with an authorized account.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
              <button className="btn btn-primary btn-sm" onClick={fetchLiveApplications}>
                <RefreshCw size={14} />
                <span>Retry Backend Connection</span>
              </button>
              <button className="btn btn-secondary btn-sm" onClick={loadOfflineDemoData}>
                <Sparkles size={14} />
                <span>Load Offline Prototype Demo Data</span>
              </button>
            </div>
          </div>
        )}

        {/* Data Source Indicator Banner */}
        {!fetchError && (
          <div
            className="demo-banner"
            style={
              dataSource === 'live'
                ? {
                    borderColor: 'rgba(16, 185, 129, 0.4)',
                    background: 'rgba(16, 185, 129, 0.08)'
                  }
                : {
                    borderColor: 'rgba(234, 179, 8, 0.4)',
                    background: 'rgba(234, 179, 8, 0.08)'
                  }
            }
          >
            {dataSource === 'live' ? (
              <>
                <CheckCircle2 size={16} style={{ flexShrink: 0, color: '#10b981' }} />
                <div>
                  <strong style={{ color: '#10b981' }}>DATA SOURCE: LIVE DATABASE-BACKED (PostgreSQL)</strong>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Retrieved via authenticated REST API <code>/api/v1/tenants/{tenantIdentifier}/applications</code>.
                    Scoped to authorized tenant boundary.
                  </div>
                </div>
              </>
            ) : (
              <>
                <Sparkles size={16} style={{ flexShrink: 0, color: '#facc15' }} />
                <div>
                  <strong style={{ color: '#facc15' }}>DATA SOURCE: OFFLINE PROTOTYPE FIXTURES (DEMO)</strong>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {DEMO_DATA_DISCLAIMER} Switch to live database using the refresh action above.
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Search, Filter & Sort Controls */}
        <div className="cyber-card" style={{ padding: '1rem 1.25rem' }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '1rem',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
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
                placeholder="Search by application name, domain, or identifier..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Filter Dropdowns */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
              <div>
                <select
                  className="cyber-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label="Filter by Protection Status"
                >
                  <option value="all">All Statuses</option>
                  <option value="PROTECTED">Protected / Shielded</option>
                  <option value="DEGRADED">Degraded</option>
                  <option value="BYPASS">Bypass</option>
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
                  <option value="date-desc">Newest First</option>
                </select>
              </div>

              {(searchTerm || statusFilter !== 'all') && (
                <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Applications Count Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12px',
            color: 'var(--text-muted)'
          }}
        >
          <span>
            Showing <strong>{filteredApps.length}</strong> of {applications.length} registered applications
          </span>
          <span
            className="demo-tag"
            style={{
              borderColor: dataSource === 'live' ? 'rgba(16, 185, 129, 0.4)' : undefined,
              color: dataSource === 'live' ? '#6ee7b7' : undefined
            }}
          >
            {dataSource === 'live' ? 'POSTGRESQL PERSISTENCE' : 'LOCAL MOCK DATA'}
          </span>
        </div>

        {/* Applications List Table */}
        {filteredApps.length === 0 ? (
          <EmptyState
            title={applications.length === 0 ? 'No Protected Applications' : 'No Matching Applications'}
            description={
              applications.length === 0
                ? `No upstream services have been registered for tenant "${activeTenant?.displayName || tenantIdentifier}". Click Register Application to add an ingress route.`
                : 'No services match your active search or filter criteria. Clear your filters to view all registered applications.'
            }
            actionText={applications.length === 0 ? 'Register Application' : 'Clear Filters'}
            onAction={applications.length === 0 ? () => navigate('/owner/applications/new') : clearFilters}
          />
        ) : (
          <div className="cyber-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="cyber-table-container" style={{ border: 'none' }}>
              <table className="cyber-table">
                <thead>
                  <tr>
                    <th>Application Details</th>
                    <th>Ingress Hostname</th>
                    <th>Protection Status</th>
                    <th>Identifier</th>
                    <th>Registered At</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApps.map((app) => {
                    const identifier = app.applicationIdentifier || app.id;
                    const statusStr = (app.status || 'PROTECTED').toUpperCase();
                    const statusType =
                      statusStr === 'PROTECTED' || statusStr === 'SHIELDED'
                        ? 'operational'
                        : statusStr === 'DEGRADED'
                        ? 'medium'
                        : 'low';

                    return (
                      <tr key={app.id}>
                        {/* Name & ID */}
                        <td>
                          <Link
                            to={`/owner/applications/${identifier}`}
                            style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'block' }}
                          >
                            {app.name}
                          </Link>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {app.description || 'Ingress service under adaptive deception supervision.'}
                          </div>
                        </td>

                        {/* Domain */}
                        <td>
                          <div className="mono-tag" style={{ color: '#93c5fd' }}>
                            {app.domain}
                          </div>
                        </td>

                        {/* Protection Status */}
                        <td>
                          <StatusBadge status={statusType} label={statusStr} />
                        </td>

                        {/* Identifier */}
                        <td>
                          <span className="mono-tag" style={{ fontSize: '11px' }}>
                            {identifier}
                          </span>
                        </td>

                        {/* Date */}
                        <td style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {app.createdAt ? new Date(app.createdAt).toLocaleDateString() : 'Active'}
                        </td>

                        {/* Actions */}
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <Link
                              to={`/owner/applications/${identifier}`}
                              className="btn btn-secondary btn-sm"
                              title="Inspect application details"
                            >
                              <span>Inspect</span>
                            </Link>
                            <Link
                              to={`/owner/applications/new?edit=${identifier}`}
                              className="btn btn-ghost btn-sm"
                              title="Edit application configuration"
                            >
                              <Edit2 size={13} />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
