import React, { useState, useEffect, useMemo } from 'react';
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
  RotateCcw
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import EmptyState from '../../components/common/EmptyState';
import LoadingState from '../../components/common/LoadingState';
import {
  getSecurityEvents,
  getApplications,
  DEMO_DATA_DISCLAIMER
} from '../../services/mockData';

const PAGE_SIZE = 6;

export default function SecurityEventsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlAppId = searchParams.get('appId') || 'all';
  const urlSeverity = searchParams.get('severity') || 'all';

  const [events, setEvents] = useState([]);
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedApp, setSelectedApp] = useState(urlAppId);
  const [selectedSeverity, setSelectedSeverity] = useState(urlSeverity);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedOutcome, setSelectedOutcome] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    Promise.all([
      getSecurityEvents(),
      getApplications()
    ]).then(([eventsList, appsList]) => {
      if (isMounted) {
        setEvents(eventsList);
        setApps(appsList);
        setLoading(false);
      }
    });

    return () => { isMounted = false; };
  }, []);

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
        e.id.toLowerCase().includes(q) ||
        e.sourceIp.toLowerCase().includes(q) ||
        e.vector.toLowerCase().includes(q) ||
        e.application.toLowerCase().includes(q) ||
        e.details.toLowerCase().includes(q)
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

    if (selectedOutcome !== 'all') {
      list = list.filter(e => e.routingOutcome === selectedOutcome);
    }

    return list;
  }, [events, searchTerm, selectedApp, selectedSeverity, selectedCategory, selectedOutcome]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedApp, selectedSeverity, selectedCategory, selectedOutcome]);

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
    setSelectedOutcome('all');
    setSearchParams({});
  };

  const getOutcomeBadge = (outcome, actionLabel) => {
    switch (outcome) {
      case 'routed_to_deception':
        return <StatusBadge status="diverted" label={actionLabel || 'Routed to Deception'} />;
      case 'blocked':
        return <StatusBadge status="critical" label={actionLabel || 'Blocked'} />;
      case 'quarantined':
        return <StatusBadge status="high" label={actionLabel || 'Quarantined'} />;
      case 'allowed':
        return <StatusBadge status="active" label={actionLabel || 'Allowed'} />;
      default:
        return <StatusBadge status="offline" label={actionLabel || 'Unknown'} />;
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <LoadingState message="Loading honeynet security events..." />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Security Events Explorer"
        badge="Live Honeynet Telemetry"
        description="Investigate suspicious requests, canary token triggers, and real-time deceptive attacker diversions."
      />

      <div className="page-container">
        {/* Prototype Scope Banner */}
        <div className="demo-banner">
          <Sparkles size={16} style={{ flexShrink: 0 }} />
          <div>
            <strong>Simulated Security Telemetry:</strong> {DEMO_DATA_DISCLAIMER} Attack signatures and payloads are simulated demonstration scenarios.
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="cyber-card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Top row: search + reset */}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
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
                  placeholder="Search by IP address (e.g. 198.51.100.44), event ID, vector, or keyword..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {(searchTerm || selectedApp !== 'all' || selectedSeverity !== 'all' || selectedCategory !== 'all' || selectedOutcome !== 'all') && (
                <button className="btn btn-secondary btn-sm" onClick={handleClearFilters}>
                  <RotateCcw size={13} />
                  <span>Reset Filters</span>
                </button>
              )}
            </div>

            {/* Bottom row: multi-filter dropdowns */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
              {/* Application Filter */}
              <div>
                <select
                  className="cyber-select"
                  value={selectedApp}
                  onChange={(e) => {
                    setSelectedApp(e.target.value);
                    setSearchParams(prev => {
                      const next = new URLSearchParams(prev);
                      if (e.target.value === 'all') next.delete('appId');
                      else next.set('appId', e.target.value);
                      return next;
                    });
                  }}
                  aria-label="Filter by Application"
                >
                  <option value="all">All Applications</option>
                  {apps.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              {/* Severity Filter */}
              <div>
                <select
                  className="cyber-select"
                  value={selectedSeverity}
                  onChange={(e) => {
                    setSelectedSeverity(e.target.value);
                    setSearchParams(prev => {
                      const next = new URLSearchParams(prev);
                      if (e.target.value === 'all') next.delete('severity');
                      else next.set('severity', e.target.value);
                      return next;
                    });
                  }}
                  aria-label="Filter by Severity"
                >
                  <option value="all">All Severities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              {/* Category Filter */}
              <div>
                <select
                  className="cyber-select"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  aria-label="Filter by Attack Category"
                >
                  <option value="all">All Categories</option>
                  {categories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Action Outcome Filter */}
              <div>
                <select
                  className="cyber-select"
                  value={selectedOutcome}
                  onChange={(e) => setSelectedOutcome(e.target.value)}
                  aria-label="Filter by Gateway Action"
                >
                  <option value="all">All Routing Outcomes</option>
                  <option value="routed_to_deception">Routed to Deception</option>
                  <option value="blocked">Blocked</option>
                  <option value="quarantined">Quarantined / Throttled</option>
                  <option value="allowed">Allowed under Observation</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Counter & Status Summary */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
          <span>
            Displaying <strong>{filteredEvents.length}</strong> matching events
            {selectedApp !== 'all' && ` for ${apps.find(a => a.id === selectedApp)?.name || selectedApp}`}
          </span>
          <span className="demo-tag">SIMULATED HONEYNET SINK</span>
        </div>

        {/* Events Table or Empty State */}
        {filteredEvents.length === 0 ? (
          <EmptyState
            title="No Security Events Found"
            description="No threat events match the specified filters. Try adjusting your query or resetting all filter parameters."
            actionText="Reset All Filters"
            onAction={handleClearFilters}
          />
        ) : (
          <div className="cyber-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="cyber-table-container" style={{ border: 'none' }}>
              <table className="cyber-table">
                <thead>
                  <tr>
                    <th>Event ID</th>
                    <th>Timestamp</th>
                    <th>Target Application</th>
                    <th>Attacker IP</th>
                    <th>Attack Vector & Category</th>
                    <th>Severity</th>
                    <th>Detection Trigger</th>
                    <th>Gateway Outcome</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedEvents.map((evt) => (
                    <tr key={evt.id}>
                      {/* Event ID */}
                      <td>
                        <Link to={`/owner/events/${evt.id}`} className="mono-tag" style={{ color: '#60a5fa', fontWeight: 600 }}>
                          {evt.id}
                        </Link>
                      </td>

                      {/* Timestamp */}
                      <td style={{ whiteSpace: 'nowrap', fontSize: '12px', color: 'var(--text-muted)' }}>
                        {evt.timestamp}
                      </td>

                      {/* Application */}
                      <td>
                        <Link
                          to={`/owner/applications/${evt.applicationId}`}
                          style={{ fontWeight: 500, color: 'var(--text-primary)' }}
                        >
                          {evt.application}
                        </Link>
                      </td>

                      {/* Source IP */}
                      <td>
                        <span className="mono-tag">{evt.sourceIp}</span>
                        {evt.originCountry && (
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {evt.originCountry}
                          </div>
                        )}
                      </td>

                      {/* Vector & Category */}
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{evt.vector}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{evt.category}</div>
                      </td>

                      {/* Severity */}
                      <td>
                        <StatusBadge status={evt.severity} />
                      </td>

                      {/* Detection Trigger */}
                      <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {evt.detectionOutcome}
                      </td>

                      {/* Gateway Outcome */}
                      <td>
                        {getOutcomeBadge(evt.routingOutcome, evt.gatewayAction)}
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <Link to={`/owner/events/${evt.id}`} className="btn btn-secondary btn-sm">
                          <span>Inspect →</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1.25rem',
              borderTop: '1px solid var(--border-subtle)',
              background: 'var(--bg-surface-elevated)'
            }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> ({filteredEvents.length} total events)
              </span>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={14} />
                  <span>Prev</span>
                </button>

                <button
                  className="btn btn-secondary btn-sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  aria-label="Next page"
                >
                  <span>Next</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
