import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  Layers,
  ArrowLeft,
  Check,
  AlertCircle,
  ShieldCheck,
  Save,
  RefreshCw,
  Server,
  Lock,
  Sparkles
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import { useAuth } from '../../hooks/useAuth';
import { apiClient } from '../../services/apiClient';

// Basic domain/hostname regex (e.g. api.apexfintech.io, without http://)
const HOSTNAME_REGEX = /^(?!:\/\/)([a-zA-Z0-9-_]+\.)+[a-zA-Z]{2,}$/;
const IDENTIFIER_REGEX = /^[a-zA-Z0-9-_]{3,50}$/;

export default function ApplicationFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const isEditMode = Boolean(editId);

  const { activeTenant, user } = useAuth();
  const tenantIdentifier = activeTenant?.identifier || activeTenant?.id || 'tenant-apex-9941';

  // Form fields
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [applicationIdentifier, setApplicationIdentifier] = useState('');
  const [status, setStatus] = useState('PROTECTED');

  // Form State
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [initialLoading, setInitialLoading] = useState(isEditMode);

  // Load existing application if edit mode
  useEffect(() => {
    if (isEditMode) {
      setInitialLoading(true);
      setErrors({});

      apiClient
        .getApplicationById(tenantIdentifier, editId)
        .then((res) => {
          if (res && res.success && res.data) {
            const app = res.data;
            setName(app.name || '');
            setDomain(app.domain || '');
            setApplicationIdentifier(app.applicationIdentifier || '');
            setStatus(app.status || 'PROTECTED');
          } else {
            setErrors({ global: `Application "${editId}" could not be retrieved from the database.` });
          }
        })
        .catch((err) => {
          setErrors({
            global: err.message || `Failed to load application "${editId}" from backend.`
          });
        })
        .finally(() => {
          setInitialLoading(false);
        });
    }
  }, [editId, isEditMode, tenantIdentifier]);

  // Validation function
  const validate = () => {
    const newErrors = {};

    if (!name.trim()) {
      newErrors.name = 'Application name is required.';
    } else if (name.trim().length < 3) {
      newErrors.name = 'Name must be at least 3 characters.';
    } else if (name.trim().length > 100) {
      newErrors.name = 'Name cannot exceed 100 characters.';
    }

    if (!domain.trim()) {
      newErrors.domain = 'Domain or hostname is required.';
    } else {
      const cleanDomain = domain.trim().toLowerCase();
      if (cleanDomain.startsWith('http://') || cleanDomain.startsWith('https://')) {
        newErrors.domain = 'Do not include http:// or https://. Provide only the hostname (e.g. api.apexfintech.io).';
      } else if (cleanDomain.includes('/') || cleanDomain.includes(':')) {
        newErrors.domain = 'Domain must not contain URL paths or port numbers.';
      } else if (!HOSTNAME_REGEX.test(cleanDomain) && cleanDomain !== 'localhost') {
        newErrors.domain = 'Please enter a valid hostname format (e.g. api.apexfintech.io or accounts.internal.net).';
      }
    }

    if (applicationIdentifier.trim()) {
      if (!IDENTIFIER_REGEX.test(applicationIdentifier.trim())) {
        newErrors.applicationIdentifier =
          'Identifier must be 3-50 alphanumeric characters or hyphens (e.g. app-01, accounts-api).';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      if (isEditMode) {
        // Backend update only accepts name, domain, status
        const updatePayload = {
          name: name.trim(),
          domain: domain.trim().toLowerCase(),
          status
        };

        const res = await apiClient.updateApplication(tenantIdentifier, editId, updatePayload);
        if (res && res.success) {
          setSuccessMessage(`Application "${name.trim()}" successfully updated in PostgreSQL!`);
          setTimeout(() => {
            navigate('/owner/applications');
          }, 800);
        }
      } else {
        // Backend create accepts name, domain, status, and optional applicationIdentifier
        const createPayload = {
          name: name.trim(),
          domain: domain.trim().toLowerCase(),
          status
        };

        if (applicationIdentifier.trim()) {
          createPayload.applicationIdentifier = applicationIdentifier.trim();
        }

        const res = await apiClient.createApplication(tenantIdentifier, createPayload);
        if (res && res.success) {
          const createdApp = res.data;
          setSuccessMessage(`Application "${name.trim()}" registered in database!`);
          setTimeout(() => {
            const targetId = createdApp.applicationIdentifier || createdApp.id;
            navigate(`/owner/applications/${targetId}`);
          }, 800);
        }
      }
    } catch (err) {
      setIsSubmitting(false);

      if (err.status === 403) {
        setErrors({
          global:
            'Permission Denied: Your account does not possess the "manage_applications" permission in this tenant.'
        });
      } else if (err.status === 409) {
        setErrors({
          global:
            err.message ||
            `An application with identifier "${applicationIdentifier.trim()}" already exists in tenant "${tenantIdentifier}".`
        });
      } else if (err.status === 400) {
        const details = Array.isArray(err.details) ? err.details.join(' ') : err.message;
        setErrors({ global: `Validation Error: ${details}` });
      } else {
        setErrors({
          global: err.message || 'Failed to submit application to backend.'
        });
      }
    }
  };

  if (initialLoading) {
    return (
      <div className="page-container">
        <div className="cyber-card" style={{ padding: '2rem', textAlign: 'center' }}>
          <RefreshCw size={24} className="spinner" style={{ margin: '0 auto 1rem', color: 'var(--accent-primary)' }} />
          <p>Loading application record from database...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={isEditMode ? `Edit Application: ${name || editId}` : 'Register New Application'}
        badge={activeTenant?.displayName || 'Gateway Ingress Route'}
        description="Configure an upstream service to receive adaptive cyber deception and canary injection."
        actions={
          <Link to="/owner/applications" className="btn btn-secondary btn-sm">
            <ArrowLeft size={15} />
            <span>Back to Applications</span>
          </Link>
        }
      />

      <div className="page-container" style={{ maxWidth: '820px', margin: '0 auto', width: '100%' }}>
        {/* Persistence Notice */}
        <div className="demo-banner" style={{ borderColor: 'rgba(16, 185, 129, 0.4)', background: 'rgba(16, 185, 129, 0.08)' }}>
          <Server size={16} style={{ flexShrink: 0, color: '#10b981' }} />
          <div>
            <strong style={{ color: '#10b981' }}>Database-Backed Persistence:</strong> Mutations are executed
            against PostgreSQL under tenant boundary <code>{tenantIdentifier}</code> with anti-CSRF token verification and audit logging.
          </div>
        </div>

        {/* Global Error Banner */}
        {errors.global && (
          <div
            className="demo-banner demo-banner-warning"
            style={{ color: 'var(--severity-critical)', borderColor: 'rgba(239, 68, 68, 0.4)' }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <div>{errors.global}</div>
          </div>
        )}

        {/* Success Feedback Banner */}
        {successMessage && (
          <div
            className="demo-banner"
            style={{
              background: 'rgba(16, 185, 129, 0.1)',
              borderColor: 'rgba(16, 185, 129, 0.4)',
              color: '#6ee7b7'
            }}
          >
            <Check size={16} style={{ flexShrink: 0 }} />
            <div>{successMessage} Redirecting...</div>
          </div>
        )}

        {/* Form Container */}
        <form
          onSubmit={handleSubmit}
          className="cyber-card"
          style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '2rem' }}
        >
          <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.125rem', marginBottom: '0.25rem' }}>
              Service Identity & Ingress Route
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Specify the registered upstream domain and protection status for this service.
            </p>
          </div>

          {/* Application Name */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                marginBottom: '6px',
                color: 'var(--text-primary)'
              }}
            >
              Application Name <span style={{ color: 'var(--severity-critical)' }}>*</span>
            </label>
            <input
              type="text"
              className="cyber-input"
              style={{ width: '100%', borderColor: errors.name ? 'var(--severity-critical)' : undefined }}
              placeholder="e.g., Customer Accounts API"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
            />
            {errors.name && (
              <span
                style={{
                  display: 'block',
                  fontSize: '12px',
                  color: 'var(--severity-critical)',
                  marginTop: '4px'
                }}
              >
                {errors.name}
              </span>
            )}
            <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Human-readable title used across tenant dashboards and security investigation logs.
            </span>
          </div>

          {/* Domain Hostname */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                marginBottom: '6px',
                color: 'var(--text-primary)'
              }}
            >
              Domain / Ingress Hostname <span style={{ color: 'var(--severity-critical)' }}>*</span>
            </label>
            <input
              type="text"
              className="cyber-input"
              style={{ width: '100%', borderColor: errors.domain ? 'var(--severity-critical)' : undefined }}
              placeholder="e.g., accounts.apexfintech.internal"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              disabled={isSubmitting}
            />
            {errors.domain && (
              <span
                style={{
                  display: 'block',
                  fontSize: '12px',
                  color: 'var(--severity-critical)',
                  marginTop: '4px'
                }}
              >
                {errors.domain}
              </span>
            )}
            <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Hostname routed through the gateway (omit protocol scheme and port numbers).
            </span>
          </div>

          {/* Application Identifier */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                marginBottom: '6px',
                color: 'var(--text-primary)'
              }}
            >
              Application Identifier {isEditMode && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>(Immutable)</span>}
            </label>
            <input
              type="text"
              className="cyber-input"
              style={{
                width: '100%',
                borderColor: errors.applicationIdentifier ? 'var(--severity-critical)' : undefined,
                backgroundColor: isEditMode ? 'rgba(255, 255, 255, 0.03)' : undefined
              }}
              placeholder="e.g., app-01 or accounts-api (optional, auto-generated if omitted)"
              value={applicationIdentifier}
              onChange={(e) => setApplicationIdentifier(e.target.value)}
              disabled={isEditMode || isSubmitting}
            />
            {errors.applicationIdentifier && (
              <span
                style={{
                  display: 'block',
                  fontSize: '12px',
                  color: 'var(--severity-critical)',
                  marginTop: '4px'
                }}
              >
                {errors.applicationIdentifier}
              </span>
            )}
            <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Unique alphanumeric slug within this tenant scope used in REST routes.
            </span>
          </div>

          {/* Status Selection */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                marginBottom: '6px',
                color: 'var(--text-primary)'
              }}
            >
              Protection Supervision Mode
            </label>
            <select
              className="cyber-select"
              style={{ width: '100%' }}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={isSubmitting}
            >
              <option value="PROTECTED">PROTECTED (Active Deception & Canary Tokens)</option>
              <option value="DEGRADED">DEGRADED (Reduced Decoy Mesh Capacity)</option>
              <option value="BYPASS">BYPASS (Direct Pass-Through Routing)</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div
            style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'flex-end',
              paddingTop: '1.25rem',
              borderTop: '1px solid var(--border-subtle)'
            }}
          >
            <Link to="/owner/applications" className="btn btn-secondary">
              <span>Cancel</span>
            </Link>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
              style={{ minWidth: '160px', justifyContent: 'center' }}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={15} className="spinner" />
                  <span>Persisting to DB...</span>
                </>
              ) : (
                <>
                  <Save size={15} />
                  <span>{isEditMode ? 'Update Application' : 'Register Service'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
