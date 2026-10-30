import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Activity,
  Search,
  Filter,
  ArrowUpDown,
  ExternalLink,
  ShieldAlert,
  AlertTriangle,
  Shuffle,
  Clock,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  RefreshCw,
  Database,
  Layers,
  CheckCircle2
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import EmptyState from '../../components/common/EmptyState';
import LoadingState from '../../components/common/LoadingState';
import { useAuth } from '../../hooks/useAuth';
import { apiClient } from '../../services/apiClient';
import {
  getSecurityEvents as getMockSecurityEvents,
  getApplications,
  DEMO_DATA_DISCLAIMER
} from '../../services/mockData';

const PAGE_SIZE = 8;

export default function SecurityEventsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlAppId = searchParams.get('appId') || 'all';
  const urlSeverity = searchParams.get('severity') || 'all';

  const { activeTenant } = useAuth();
  const tenantIdentifier = activeTenant?.identifier || activeTenant?.id || 'tenant-apex-9941';

  const [events, setEvents] = useState([]);
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState('live');
  const [fetchError, setFetchError] = useState(null);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedApp, setSelectedApp] = useState(urlAppId);
  const [selectedSeverity, setSelectedSeverity] = useState(urlSeverity);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  const fetchLiveEvents = useCallback(async () => {
    setLoading(true);
    setFetchError(null);

    try {
      const [eventsRes, appsRes] = await Promise.all([
        apiClient.getSecurityEvents(tenantIdentifier),
        apiClient.getApplications(tenantIdentifier).catch(() => ({ success: false }))
      ]);

      if (eventsRes && eventsRes.success && Array.isArray(eventsRes.data)) {
        const mapped = eventsRes.data.map((obs) => {
          const firstAssessment = obs.assessments && obs.assessments[0];
          const risk = firstAssessment ? firstAssessment.riskScore : 0.5;
          const severity = risk >= 0.8 ? 'critical' : risk >= 0.5 ? 'high' : 'medium';
          const vector = firstAssessment?.classification || obs.observationType || 'ANOMALOUS_PROBE';

          return {
            id: obs.observationIdentifier || obs.id,
            databaseId: obs.id,
            observationIdentifier: obs.observationIdentifier || obs.id,
            observationType: obs.observationType,
            timestamp: obs.observedAt ? new Date(obs.observedAt).toLocaleString() : 'Not Recorded',
            application: obs.application?.name || 'Customer Accounts API',
            applicationId: obs.application?.applicationIdentifier || obs.applicationId,
            vector: vector.replace(/_/g, ' '),
            severity,
            category: obs.observationType.toLowerCase().replace(/_/g, ' '),
            sourceIp: obs.sanitizedStructuredEvidence?.clientIp || '198.51.100.44',
            evidenceProvenance: obs.evidenceProvenance,
            evidenceStatus: obs.evidenceStatus,
            details: `Observed security event (${obs.observationType}) captured via ${obs.evidenceProvenance}.`
          };
        });

        setEvents(mapped);
        if (appsRes && appsRes.success && Array.isArray(appsRes.data)) {
          setApps(appsRes.data);
        }
        setDataSource('live');
        setLoading(false);
        return;
      }

      throw new Error(eventsRes?.error?.message || 'Failed to fetch security events.');
    } catch (err) {
      setFetchError(err.message || 'Error connecting to security events API.');
      // Attempt fallback to mock
      try {
        const [mockEvents, mockApps] = await Promise.all([
          getMockSecurityEvents(),
          getApplications().catch(() => [])
        ]);
        setEvents(mockEvents);
        setApps(mockApps);
        setDataSource('demo');
      } catch {
        setEvents([]);
      }
      setLoading(false);
    }
  }, [tenantIdentifier]);

  useEffect(() => {
    fetchLiveEvents();
  }, [fetchLiveEvents]);

  // Update filter if search param changes
  useEffect(() => {
    if (urlAppId) setSelectedApp(urlAppId);
    if (urlSeverity) setSelectedSeverity(urlSeverity);
  }, [urlAppId, urlSeverity]);

  // Categories list derived from events
  const categories = useMemo(() => {
    const set = new Set(events.map(e => e.category).filter(Boolean));
    return Array.from(set);
  }, [events]);

  // Filtering
  const filteredEvents = useMemo(() => {
    let list = [...events];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(e =>
        (e.id && e.id.toLowerCase().includes(q)) ||
        (e.sourceIp && e.sourceIp.toLowerCase().includes(q)) ||
        (e.vector && e.vector.toLowerCase().includes(q)) ||
        (e.application && e.application.toLowerCase().includes(q)) ||
        (e.details && e.details.toLowerCase().includes(q))
      );
    }

    if (selectedApp !== 'all') {
      list = list.filter(e => e.applicationId === selectedApp);
    }

    if (selectedSeverity !== 'all') {
      list = list.filter(e => e.severity === selectedSeverity);
    }

    if (selectedCategory !== 'all') {
      list = list.filter(e => e.category === selectedCategory);
    }

    return list;
  }, [events, searchTerm, selectedApp, selectedSeverity, selectedCategory]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedApp, selectedSeverity, selectedCategory]);

  // Pagination
  const totalPages = Math.ceil(filteredEvents.length / PAGE_SIZE) || 1;
  const paginatedEvents = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredEvents.slice(start, start + PAGE_SIZE);
  }, [filteredEvents, currentPage]);

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedApp('all');
    setSelectedSeverity('all');
    setSelectedCategory('all');
    setSearchParams({});
  };

  if (loading) {
    return (
      <div className="page-container">
        <LoadingState message="Loading recorded security observations from database..." />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Security Events Explorer"
        badge={dataSource === 'live' ? 'PostgreSQL Active' : 'Prototype Simulator'}
        description="Inspect recorded ingress probes, detector anomaly classifications, and honeynet decision telemetry."
        actions={
          <button
            onClick={fetchLiveEvents}
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={13} />
            <span>Refresh Events</span>
          </button>
        }
      />

      <div className="page-container">
        {/* Data Source & Semantic Notice */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            background: dataSource === 'live' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(59, 130, 246, 0.08)',
            border: `1px solid ${dataSource === 'live' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(59, 130, 246, 0.25)'}`,
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            marginBottom: '20px',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-secondary)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {dataSource === 'live' ? (
              <Database size={16} style={{ color: '#10b981', flexShrink: 0 }} />
            ) : (
              <Sparkles size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
            )}
            <div>
              <span style={{ fontWeight: 700, color: dataSource === 'live' ? '#34d399' : '#93c5fd', marginRight: '6px' }}>
                {dataSource === 'live' ? 'LIVE DATABASE-BACKED (PostgreSQL via REST API):' : 'SIMULATION MODE:'}
              </span>
              <span>
                Observations are recorded telemetry entities.
                <strong style={{ color: '#fff', marginLeft: '4px' }}>
                  Observed evidence, detector assessments, policy proposals, and confirmed execution are independently recorded.
                </strong>
              </span>
            </div>
          </div>
          <div>
            {dataSource === 'live' ? (
              <button
                onClick={() => {
                  getMockSecurityEvents().then(m => {
                    setEvents(m);
                    setDataSource('demo');
                  });
                }}
                className="btn btn-ghost btn-xs"
                style={{ fontSize: '11px', color: 'var(--text-muted)' }}
              >
                Switch to Offline Mode
              </button>
            ) : (
              <button
                onClick={fetchLiveEvents}
                className="btn btn-ghost btn-xs"
                style={{ fontSize: '11px', color: '#60a5fa' }}
              >
                Connect Live Database
              </button>
            )}
          </div>
        </div>

        {fetchError && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px',
              marginBottom: '20px',
              fontSize: 'var(--text-xs)',
              color: '#fca5a5'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={16} />
              <span>{fetchError} (Showing offline cached fixtures)</span>
            </div>
          </div>
        )}

        {/* Filter Controls Bar */}
        <div className="filter-bar">
          <div className="filter-group-stretch">
            <div style={{ position: 'relative', flex: 1 }}>
              <Search
                size={16}
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
              />
              <input
                type="text"
                className="cyber-input"
                style={{ paddingLeft: '36px', width: '100%' }}
                placeholder="Search by ID, IP address, attack vector, or application..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <select
              className="cyber-select"
              value={selectedApp}
              onChange={(e) => setSelectedApp(e.target.value)}
            >
              <option value="all">All Protected Apps</option>
              {apps.map(a => (
                <option key={a.id} value={a.applicationIdentifier || a.id}>
                  {a.name}
                </option>
              ))}
            </select>

            <select
              className="cyber-select"
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <button
              className="btn btn-ghost btn-sm"
              onClick={handleClearFilters}
              title="Reset all search criteria"
            >
              <RotateCcw size={14} />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Security Events Table */}
        {filteredEvents.length === 0 ? (
          <EmptyState
            title="No Security Events Found"
            description="No recorded ingress observations match the current filter criteria."
            actionText="Clear Filters"
            onAction={handleClearFilters}
          />
        ) : (
          <div className="cyber-table-container">
            <table className="cyber-table">
              <thead>
                <tr>
                  <th>Event Identifier</th>
                  <th>Observed Timestamp</th>
                  <th>Target Application</th>
                  <th>Anomaly Vector</th>
                  <th>Severity</th>
                  <th>Provenance</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Forensic Detail</th>
                </tr>
              </thead>
              <tbody>
                {paginatedEvents.map((evt) => (
                  <tr key={evt.id}>
                    <td>
                      <span className="mono-tag" style={{ color: 'var(--accent-primary-light)', fontWeight: 600 }}>
                        {evt.id}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {evt.timestamp}
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, fontSize: '13px' }}>{evt.application}</span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 500 }}>{evt.vector}</span>
                    </td>
                    <td>
                      <StatusBadge status={evt.severity} />
                    </td>
                    <td style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      <code style={{ fontSize: '10px' }}>{evt.evidenceProvenance || 'EDGE_GATEWAY'}</code>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: 'rgba(52, 211, 153, 0.12)',
                          color: '#34d399',
                          border: '1px solid rgba(52, 211, 153, 0.25)'
                        }}
                      >
                        {evt.evidenceStatus || 'RECORDED'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link
                        to={`/owner/events/${evt.id}`}
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: '12px' }}
                      >
                        <span>Analyze Details →</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderTop: '1px solid var(--border-default)',
                  background: 'var(--bg-surface)'
                }}
              >
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <ChevronLeft size={14} /> Previous
                </button>

                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
