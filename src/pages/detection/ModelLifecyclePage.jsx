import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Cpu,
  Layers,
  Shield,
  ShieldAlert,
  Play,
  RefreshCw,
  Info,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Clock,
  Database,
  ArrowRight,
  Sliders
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import EmptyState from '../../components/common/EmptyState';
import { useAuth } from '../../hooks/useAuth';
import { apiClient } from '../../services/apiClient';
import './detection.css';

export default function ModelLifecyclePage() {
  const { activeTenant, user, role, ROLES } = useAuth();
  const tenantIdentifier = activeTenant?.id || activeTenant?.identifier || 'tenant-apex-9941';

  const canTriggerTraining = role === ROLES.OWNER || user?.isPlatformAdmin;

  const [models, setModels] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // Training modal / form state
  const [isTrainingOpen, setIsTrainingOpen] = useState(false);
  const [selectedAppId, setSelectedAppId] = useState('');
  const [selectedAlgorithm, setSelectedAlgorithm] = useState('ISOLATION_FOREST');
  const [minSamples, setMinSamples] = useState('200');
  const [trainingInProgress, setTrainingInProgress] = useState(false);
  const [trainingOutcome, setTrainingOutcome] = useState(null);

  const fetchModelsAndApps = useCallback(async () => {
    setLoading(true);
    setFetchError(null);

    try {
      const [modelsRes, appsRes] = await Promise.all([
        apiClient.getDetectionModels(tenantIdentifier),
        apiClient.getApplications(tenantIdentifier).catch(() => ({ success: false }))
      ]);

      if (modelsRes && modelsRes.success && modelsRes.data) {
        setModels(modelsRes.data.models || []);
      } else {
        throw new Error(modelsRes?.error?.message || 'Failed to retrieve detection models.');
      }

      if (appsRes && appsRes.success && Array.isArray(appsRes.data)) {
        setApplications(appsRes.data);
        if (appsRes.data.length > 0 && !selectedAppId) {
          setSelectedAppId(appsRes.data[0].id);
        }
      }
    } catch (err) {
      setFetchError(err.message || 'Error communicating with detection backend.');
      setModels([]);
    } finally {
      setLoading(false);
    }
  }, [tenantIdentifier, selectedAppId]);

  useEffect(() => {
    fetchModelsAndApps();
  }, [fetchModelsAndApps]);

  const handleTrainSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAppId) return;

    setTrainingInProgress(true);
    setTrainingOutcome(null);

    try {
      const res = await apiClient.triggerModelTraining(tenantIdentifier, {
        applicationId: selectedAppId,
        algorithm: selectedAlgorithm,
        minSamples: parseInt(minSamples, 10) || 200
      });

      if (res && res.success) {
        setTrainingOutcome({
          status: 'SUCCESS',
          message: 'Model trained successfully and registered as READY.',
          data: res.data
        });
        await fetchModelsAndApps();
      } else {
        setTrainingOutcome({
          status: res?.data?.status || 'FAILED',
          message: res?.data?.message || res?.error?.message || 'Model training rejected.',
          details: res?.data
        });
      }
    } catch (err) {
      // Typically returns 422 if insufficient data
      setTrainingOutcome({
        status: err.code === 'HTTP_422' || (err.details && err.details.status === 'INSUFFICIENT_TRAINING_DATA')
          ? 'INSUFFICIENT_TRAINING_DATA'
          : 'FAILED',
        message: err.message,
        details: err.details
      });
    } finally {
      setTrainingInProgress(false);
    }
  };

  return (
    <div className="detection-page">
      <PageHeader
        title="Model Lifecycle & Training Management"
        subtitle="Manage application-specific unsupervised anomaly detection models and baseline calibration"
        breadcrumbs={[
          { label: 'Detection', to: '/detection/overview' },
          { label: 'Models' }
        ]}
        actions={
          <div className="detection-header-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={fetchModelsAndApps}
              disabled={loading}
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
              <span>Refresh Models</span>
            </button>
            {canTriggerTraining && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setTrainingOutcome(null);
                  setIsTrainingOpen(true);
                }}
              >
                <Play size={14} />
                <span>Train Application Model</span>
              </button>
            )}
            <Link to="/detection/benchmark" className="btn btn-secondary btn-sm">
              <Database size={14} />
              <span>Benchmark Explorer</span>
            </Link>
          </div>
        }
      />

      {/* Model Integrity & Anti-Poisoning Notice */}
      <div className="detection-banner detection-banner-neutral">
        <Info size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <strong>Model Integrity & Baseline Calibration:</strong> Anomaly detection models are trained exclusively on verified, uncompromised baseline feature sets tagged with <code>BASELINE_ELIGIBLE</code> provenance. Contaminated, incomplete, or attack-associated sessions are strictly excluded. Models are never displayed as <strong>ACTIVE</strong> unless an eligible artifact is trained and verified.
        </div>
      </div>

      {/* Training Action Box (if open) */}
      {isTrainingOpen && (
        <div className="detection-card" style={{ borderColor: 'var(--accent-primary-light)' }}>
          <div className="detection-card-title">
            <span>Trigger Model Training Pipeline</span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setIsTrainingOpen(false)}
              style={{ fontSize: '0.75rem' }}
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleTrainSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Target Protected Application
                </label>
                <select
                  className="cyber-select"
                  style={{ width: '100%' }}
                  value={selectedAppId}
                  onChange={(e) => setSelectedAppId(e.target.value)}
                  disabled={trainingInProgress}
                  required
                >
                  {applications.map((app) => (
                    <option key={app.id} value={app.id}>
                      {app.name || app.applicationIdentifier} ({app.domain})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Anomaly Detection Algorithm
                </label>
                <select
                  className="cyber-select"
                  style={{ width: '100%' }}
                  value={selectedAlgorithm}
                  onChange={(e) => setSelectedAlgorithm(e.target.value)}
                  disabled={trainingInProgress}
                >
                  <option value="ISOLATION_FOREST">Isolation Forest (50 Trees, Sample 64)</option>
                  <option value="STATISTICAL_MAD">Robust Statistical Baseline (Modified Z-Score)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Minimum Eligible Sessions Threshold
                </label>
                <input
                  type="number"
                  className="cyber-input"
                  style={{ width: '100%' }}
                  value={minSamples}
                  onChange={(e) => setMinSamples(e.target.value)}
                  min="10"
                  max="1000"
                  disabled={trainingInProgress}
                />
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                  Production minimum: 200 sessions spanning 7 days
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={trainingInProgress || !selectedAppId}
              >
                {trainingInProgress ? (
                  <>
                    <RefreshCw size={14} className="spin" />
                    <span>Evaluating Training Data...</span>
                  </>
                ) : (
                  <>
                    <Play size={14} />
                    <span>Initiate Model Training</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Training Feedback */}
          {trainingOutcome && (
            <div style={{ marginTop: '1rem' }}>
              {trainingOutcome.status === 'SUCCESS' ? (
                <div className="detection-banner detection-banner-info">
                  <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                  <div>
                    <strong>Training Succeeded:</strong> {trainingOutcome.message}
                  </div>
                </div>
              ) : trainingOutcome.status === 'INSUFFICIENT_TRAINING_DATA' ? (
                <div className="detection-banner detection-banner-warning">
                  <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: '2px' }}>
                      Training Rejected: Insufficient Eligible Baseline Data (HTTP 422)
                    </div>
                    <div>
                      {trainingOutcome.message || 'The application database does not yet contain enough eligible uncompromised feature sets.'}
                    </div>
                    <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: 'var(--text-primary)' }}>
                      <strong>Operational Requirements:</strong> Minimum 200 independent baseline sessions over 7 operational days tagged with <code>BASELINE_ELIGIBLE</code> provenance. Contaminated, incomplete, or attack-associated sessions are excluded to prevent adversarial poisoning.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="detection-banner detection-banner-danger">
                  <XCircle size={16} style={{ flexShrink: 0 }} />
                  <div>
                    <strong>Training Error:</strong> {trainingOutcome.message}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Models List */}
      {loading ? (
        <LoadingState message="Loading detection model versions from database..." />
      ) : fetchError ? (
        <div className="detection-card">
          <EmptyState
            icon={ShieldAlert}
            title="Failed to Load Models"
            message={fetchError}
            actionLabel="Try Again"
            onAction={fetchModelsAndApps}
          />
        </div>
      ) : models.length === 0 ? (
        <div className="detection-card">
          <EmptyState
            icon={Cpu}
            title="No Detection Models Trained"
            message="No application-specific anomaly detection models have been trained yet for this tenant. Unsupervised anomaly scoring requires baseline model training once sufficient clean traffic (>= 200 sessions) is recorded."
            actionLabel={canTriggerTraining ? 'Train Model' : 'Refresh'}
            onAction={() => {
              if (canTriggerTraining) {
                setIsTrainingOpen(true);
              } else {
                fetchModelsAndApps();
              }
            }}
          />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {models.map((model) => {
            const status = (model.status || 'READY').toUpperCase();
            const isReady = status === 'READY' || status === 'ACTIVE';

            return (
              <div key={model.id} className="detection-card" style={{ gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span className={`status-badge ${isReady ? 'status-badge-active' : 'status-badge-offline'}`}>
                        {status}
                      </span>
                      <span className="provenance-tag provenance-live">
                        v{model.version}
                      </span>
                    </div>
                    <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {model.modelIdentifier || `model-${model.algorithm.toLowerCase()}-v${model.version}`}
                    </h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {model.application?.name || 'Customer Accounts API'} ({model.application?.domain || 'accounts.apexfintech.internal'})
                    </span>
                  </div>
                </div>

                <div className="feature-grid">
                  <div className="feature-box">
                    <div className="feature-label">Algorithm</div>
                    <div className="feature-val" style={{ fontSize: '0.8125rem' }}>
                      {model.algorithm}
                    </div>
                  </div>
                  <div className="feature-box">
                    <div className="feature-label">Decision Threshold</div>
                    <div className="feature-val">
                      {model.decisionThreshold ? model.decisionThreshold.toFixed(2) : '0.60'}
                    </div>
                  </div>
                  <div className="feature-box">
                    <div className="feature-label">Training Samples</div>
                    <div className="feature-val">
                      {model.trainingSampleCount || 0}
                    </div>
                  </div>
                  <div className="feature-box">
                    <div className="feature-label">Schema Version</div>
                    <div className="feature-val" style={{ fontSize: '0.8125rem' }}>
                      1.0.0
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Trained on: {model.trainedAt ? new Date(model.trainedAt).toLocaleDateString() : 'N/A'} • Scope: <code>{activeTenant?.displayName || 'Apex FinTech Cloud'}</code>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
