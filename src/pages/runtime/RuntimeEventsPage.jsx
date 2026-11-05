import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Filter,
  Eye,
  Clock,
  Layers,
  ShieldCheck,
  User
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import EmptyState from '../../components/common/EmptyState';
import { useAuth } from '../../hooks/useAuth';
import { apiClient } from '../../services/apiClient';
import './runtime.css';

export default function RuntimeEventsPage() {
  const { activeTenant } = useAuth();
  const tenantIdentifier = activeTenant?.id || activeTenant?.identifier || 'tenant-apex-9941';

  const [events, setEvents] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [selectedEvent, setSelectedEvent] = useState(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { limit: 100 };
      if (severityFilter !== 'ALL') {
        params.severity = severityFilter;
      }
      const res = await apiClient.getRuntimeEvents(tenantIdentifier, params);
      if (res && res.success && res.data) {
        setEvents(res.data.events || []);
        setTotalCount(res.data.total || 0);
      } else {
        throw new Error(res?.error?.message || 'Failed to load execution events.');
      }
    } catch (err) {
      setError(err.message || 'Error communicating with execution recorder.');
    } finally {
      setLoading(false);
    }
  }, [tenantIdentifier, severityFilter]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const renderSeverityBadge = (severity) => {
    const s = String(severity || 'INFO').toUpperCase();
    let bg = 'rgba(59, 130, 246, 0.15)';
    let color = '#60a5fa';
    let border = 'rgba(59, 130, 246, 0.3)';

    if (s === 'WARN') {
      bg = 'rgba(245, 158, 11, 0.15)';
      color = '#fbbf24';
      border = 'rgba(245, 158, 11, 0.3)';
    } else if (s === 'ERROR' || s === 'CRITICAL') {
      bg = 'rgba(239, 68, 68, 0.15)';
      color = '#f87171';
      border = 'rgba(239, 68, 68, 0.3)';
    }

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.2rem 0.5rem',
          borderRadius: '4px',
          fontSize: '0.7rem',
          fontWeight: 700,
          background: bg,
          color,
          border: `1px solid ${border}`
        }}
      >
        {s}
      </span>
    );
  };

  return (
    <div className="runtime-page">
      <PageHeader
        title="Execution Events"
        subtitle="Chronological audit records tracking runtime authorization, lifecycle mutations, and safety events"
        actions={
          <div className="runtime-header-actions">
            <button
              className="btn btn-secondary"
              onClick={fetchEvents}
              disabled={loading}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        }
      />

      {/* Safety Notice */}
      <div className="runtime-notice-banner">
        <Activity size={18} style={{ flexShrink: 0, color: '#38bdf8' }} />
        <div>
          <strong>Execution Evidence Invariant:</strong> All runtime event records are stamped with <code>evidenceStatus: MISSING</code>. Simulated events do not create real honeypot interactions.
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Filter size={15} color="#94a3b8" />
          <span style={{ fontSize: '0.8125rem', color: '#94a3b8', fontWeight: 600 }}>Severity:</span>
          {['ALL', 'INFO', 'WARN', 'ERROR', 'CRITICAL'].map((sev) => (
            <button
              key={sev}
              className={`btn ${severityFilter === sev ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem' }}
              onClick={() => setSeverityFilter(sev)}
            >
              {sev}
            </button>
          ))}
        </div>
        <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>
          Showing <strong>{events.length}</strong> of <strong>{totalCount}</strong> events
        </div>
      </div>

      {loading && <LoadingState message="Loading execution events..." />}

      {error && (
        <div className="runtime-notice-banner warning">
          <AlertTriangle size={18} style={{ flexShrink: 0, color: '#f59e0b' }} />
          <div>
            <strong>Error:</strong> {error}
          </div>
        </div>
      )}

      {!loading && events.length === 0 && (
        <EmptyState
          icon={Activity}
          title="No execution events found"
          description="Execution events are automatically generated when authorizations are requested, evaluated, or transitioned."
        />
      )}

      {!loading && events.length > 0 && (
        <div className="runtime-table-container">
          <table className="runtime-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Event Type</th>
                <th>Severity</th>
                <th>Target Reference</th>
                <th>Evidence Status</th>
                <th>Message</th>
                <th>Operator</th>
                <th style={{ textAlign: 'right' }}>Inspect</th>
              </tr>
            </thead>
            <tbody>
              {events.map((evt) => (
                <tr key={evt.id}>
                  <td>
                    <div style={{ fontSize: '0.775rem', color: '#f8fafc', whiteSpace: 'nowrap' }}>
                      {new Date(evt.timestamp || evt.createdAt).toLocaleTimeString()}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                      {new Date(evt.timestamp || evt.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.75rem', color: '#38bdf8' }}>
                      {evt.eventType}
                    </div>
                  </td>
                  <td>{renderSeverityBadge(evt.severity)}</td>
                  <td>
                    {evt.environmentId && (
                      <div style={{ fontSize: '0.725rem', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Layers size={11} /> Env: {evt.environmentId.slice(0, 8)}...
                      </div>
                    )}
                    {evt.authorizationId && (
                      <div style={{ fontSize: '0.725rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <ShieldCheck size={11} /> Auth: {evt.authorizationId.slice(0, 8)}...
                      </div>
                    )}
                    {!evt.environmentId && !evt.authorizationId && (
                      <span style={{ color: '#64748b', fontSize: '0.75rem' }}>—</span>
                    )}
                  </td>
                  <td>
                    <span className="evidence-pill-missing">{evt.evidenceStatus}</span>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.8rem', color: '#cbd5e1', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {evt.message || '—'}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{evt.operatorEmail || 'SYSTEM'}</div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                      onClick={() => setSelectedEvent(evt)}
                      title="Inspect Event Payload"
                    >
                      <Eye size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Inspect Event Modal */}
      {selectedEvent && (
        <div className="runtime-modal-backdrop" onClick={() => setSelectedEvent(null)}>
          <div className="runtime-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="runtime-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Activity size={18} color="#38bdf8" />
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#f8fafc' }}>Execution Event Audit</h3>
              </div>
              <button className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem' }} onClick={() => setSelectedEvent(null)}>
                &times;
              </button>
            </div>
            <div className="runtime-modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.725rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Event Type</label>
                  <div style={{ fontFamily: 'monospace', color: '#38bdf8', fontWeight: 600 }}>{selectedEvent.eventType}</div>
                </div>
                <div>
                  <label style={{ fontSize: '0.725rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Severity</label>
                  <div>{renderSeverityBadge(selectedEvent.severity)}</div>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.725rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Message</label>
                <div style={{ fontSize: '0.8125rem', color: '#cbd5e1', background: '#090f1d', padding: '0.75rem', borderRadius: '6px' }}>
                  {selectedEvent.message}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.725rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Metadata &amp; Context</label>
                <pre style={{ margin: 0, padding: '0.75rem', background: '#090f1d', borderRadius: '6px', fontSize: '0.75rem', color: '#38bdf8', overflowX: 'auto', maxHeight: '180px' }}>
                  {JSON.stringify(selectedEvent.details || {}, null, 2)}
                </pre>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.725rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Evidence Status</label>
                  <div>
                    <span className="evidence-pill-missing">{selectedEvent.evidenceStatus}</span>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '0.725rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Timestamp</label>
                  <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>{new Date(selectedEvent.timestamp || selectedEvent.createdAt).toLocaleString()}</div>
                </div>
              </div>
            </div>
            <div className="runtime-modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedEvent(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
