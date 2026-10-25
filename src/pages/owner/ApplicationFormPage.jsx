import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  Layers,
  ArrowLeft,
  Check,
  AlertCircle,
  ShieldCheck,
  Sparkles,
  Save,
  X
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import {
  getApplicationById,
  createApplication,
  updateApplication,
  DEMO_DATA_DISCLAIMER
} from '../../services/mockData';

// Basic domain/hostname regex (e.g. api.domain.io or domain.com, without http://)
const HOSTNAME_REGEX = /^(?!:\/\/)([a-zA-Z0-9-_]+\.)+[a-zA-Z]{2,}$/;

export default function ApplicationFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const isEditMode = Boolean(editId);

  // Form fields
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [routePath, setRoutePath] = useState('/');
  const [environment, setEnvironment] = useState('production');
  const [protectionMode, setProtectionMode] = useState('Synthetic SQL & API Decoys');
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  // Form State
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [initialLoading, setInitialLoading] = useState(isEditMode);

  // Load existing application if edit mode
  useEffect(() => {
    if (isEditMode) {
      getApplicationById(editId).then((app) => {
        if (app) {
          setName(app.name || '');
          setDomain(app.domain || '');
          const pathOnly = app.route ? app.route.replace(app.domain || '', '') : '/';
          setRoutePath(pathOnly || '/');
          setEnvironment(app.environment || 'production');
          setProtectionMode(app.protectionMode || 'Synthetic SQL & API Decoys');
          setDescription(app.description || '');
          setTagsInput(app.tags ? app.tags.join(', ') : '');
        } else {
          setErrors({ global: `Application with ID "${editId}" could not be found.` });
        }
        setInitialLoading(false);
      });
    }
  }, [editId, isEditMode]);

  // Validation function
  const validate = () => {
    const newErrors = {};

    if (!name.trim()) {
      newErrors.name = 'Application name is required.';
    } else if (name.trim().length < 3) {
      newErrors.name = 'Name must be at least 3 characters.';
    }

    if (!domain.trim()) {
      newErrors.domain = 'Hostname or domain is required.';
    } else {
      const cleanDomain = domain.trim().toLowerCase();
      if (cleanDomain.startsWith('http://') || cleanDomain.startsWith('https://')) {
        newErrors.domain = 'Do not include http:// or https://. Provide only the hostname (e.g. api.example.com).';
      } else if (!HOSTNAME_REGEX.test(cleanDomain)) {
        newErrors.domain = 'Please enter a valid domain format (e.g., api.apexfintech.io or service.internal.net).';
      }
    }

    if (!description.trim()) {
      newErrors.description = 'A short service description is required.';
    }

    if (!routePath.trim() || !routePath.startsWith('/')) {
      newErrors.routePath = 'Route path must start with a leading slash (e.g. / or /v1/api).';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setErrors({});

    const formattedTags = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    const payload = {
      name: name.trim(),
      domain: domain.trim().toLowerCase(),
      route: `${domain.trim().toLowerCase()}${routePath.trim() === '/' ? '' : routePath.trim()}`,
      environment,
      protectionMode,
      description: description.trim(),
      tags: formattedTags
    };

    try {
      let savedApp;
      if (isEditMode) {
        savedApp = await updateApplication(editId, payload);
        setSuccessMessage(`Application "${savedApp.name}" updated successfully in mock registry!`);
      } else {
        savedApp = await createApplication(payload);
        setSuccessMessage(`Application "${savedApp.name}" registered with simulated gateway!`);
      }

      // Short delay then navigate to application detail
      setTimeout(() => {
        navigate(`/owner/applications/${savedApp.id}`);
      }, 700);
    } catch (err) {
      setErrors({ global: err.message || 'Failed to save application.' });
      setIsSubmitting(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="page-container">
        <div className="cyber-card" style={{ padding: '2rem', textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem' }} />
          <p>Loading application configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={isEditMode ? `Edit Application: ${name || editId}` : 'Register New Application'}
        badge="Gateway Ingress Route"
        description="Configure an upstream service to receive adaptive cyber deception and canary injection."
        actions={
          <Link to="/owner/applications" className="btn btn-secondary btn-sm">
            <ArrowLeft size={15} />
            <span>Back to Applications</span>
          </Link>
        }
      />

      <div className="page-container" style={{ maxWidth: '860px', margin: '0 auto', width: '100%' }}>
        {/* Prototype Scope Banner */}
        <div className="demo-banner">
          <Sparkles size={16} style={{ flexShrink: 0 }} />
          <div>
            <strong>Configuration Simulation:</strong> {DEMO_DATA_DISCLAIMER} No real gateway routing or DNS record changes occur.
          </div>
        </div>

        {/* Global Error Banner */}
        {errors.global && (
          <div className="demo-banner demo-banner-warning" style={{ color: 'var(--severity-critical)', borderColor: 'rgba(239, 68, 68, 0.4)' }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <div>{errors.global}</div>
          </div>
        )}

        {/* Success Feedback Banner */}
        {successMessage && (
          <div className="demo-banner" style={{ background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.4)', color: '#6ee7b7' }}>
            <Check size={16} style={{ flexShrink: 0 }} />
            <div>{successMessage} Redirecting...</div>
          </div>
        )}

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="cyber-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '2rem' }}>
          <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.125rem', marginBottom: '0.25rem' }}>
              Service Identity & Routing
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Specify the public domain name and endpoint path that client traffic will route through.
            </p>
          </div>

          {/* Application Name */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
              Application Name <span style={{ color: 'var(--severity-critical)' }}>*</span>
            </label>
            <input
              type="text"
              className="cyber-input"
              style={{ width: '100%', borderColor: errors.name ? 'var(--severity-critical)' : undefined }}
              placeholder="e.g., Customer Accounts API"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {errors.name && (
              <span style={{ display: 'block', fontSize: '12px', color: 'var(--severity-critical)', marginTop: '4px' }}>
                {errors.name}
              </span>
            )}
            <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Human-readable title used across telemetry dashboards and investigation logs.
            </span>
          </div>

          {/* Domain & Route Path */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
                Domain / Hostname <span style={{ color: 'var(--severity-critical)' }}>*</span>
              </label>
              <input
                type="text"
                className="cyber-input"
                style={{ width: '100%', borderColor: errors.domain ? 'var(--severity-critical)' : undefined }}
                placeholder="api.apexfintech.io"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
              />
              {errors.domain && (
                <span style={{ display: 'block', fontSize: '12px', color: 'var(--severity-critical)', marginTop: '4px' }}>
                  {errors.domain}
                </span>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
                Ingress Path Prefix
              </label>
              <input
                type="text"
                className="cyber-input"
                style={{ width: '100%', borderColor: errors.routePath ? 'var(--severity-critical)' : undefined }}
                placeholder="/v2/accounts"
                value={routePath}
                onChange={(e) => setRoutePath(e.target.value)}
              />
              {errors.routePath && (
                <span style={{ display: 'block', fontSize: '12px', color: 'var(--severity-critical)', marginTop: '4px' }}>
                  {errors.routePath}
                </span>
              )}
            </div>
          </div>

          {/* Environment & Protection Mode */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
                Deployment Environment
              </label>
              <select
                className="cyber-select"
                style={{ width: '100%' }}
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
              >
                <option value="production">Production</option>
                <option value="staging">Staging</option>
                <option value="development">Development</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
                Deception Protection Profile
              </label>
              <select
                className="cyber-select"
                style={{ width: '100%' }}
                value={protectionMode}
                onChange={(e) => setProtectionMode(e.target.value)}
              >
                <option value="Synthetic SQL & API Decoys">Synthetic SQL & API Decoys</option>
                <option value="Canary Credentials & Honey-routes">Canary Credentials & Honey-routes</option>
                <option value="Adaptive Emulation Sandbox">Adaptive Emulation Sandbox</option>
                <option value="Schema Poisoning Decoys">Schema Poisoning Decoys</option>
                <option value="Monitoring Only">Monitoring Only (Passive)</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
              Service Description <span style={{ color: 'var(--severity-critical)' }}>*</span>
            </label>
            <textarea
              className="cyber-input"
              rows={3}
              style={{ width: '100%', resize: 'vertical', borderColor: errors.description ? 'var(--severity-critical)' : undefined }}
              placeholder="Describe the service role, sensitivity of data handled, and expected traffic patterns..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            {errors.description && (
              <span style={{ display: 'block', fontSize: '12px', color: 'var(--severity-critical)', marginTop: '4px' }}>
                {errors.description}
              </span>
            )}
          </div>

          {/* Tags */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
              Tags (Optional)
            </label>
            <input
              type="text"
              className="cyber-input"
              style={{ width: '100%' }}
              placeholder="e.g., Banking, PCI-DSS, GraphQL, External (comma separated)"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
            />
            <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Separate multiple tags with commas for categorization and search.
            </span>
          </div>

          {/* Form Actions */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '1rem',
            paddingTop: '1rem',
            borderTop: '1px solid var(--border-subtle)',
            marginTop: '0.5rem'
          }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate('/owner/applications')}
              disabled={isSubmitting}
            >
              <X size={15} />
              <span>Cancel</span>
            </button>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
              style={{ minWidth: '150px' }}
            >
              {isSubmitting ? (
                <span>Saving...</span>
              ) : (
                <>
                  <Save size={15} />
                  <span>{isEditMode ? 'Save Changes' : 'Register Service'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
