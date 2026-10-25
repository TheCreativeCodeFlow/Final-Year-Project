import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Layers, ArrowRight, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export default function RoleSelectionPage() {
  const { login, role: currentRole, ROLES } = useAuth();
  const navigate = useNavigate();

  const handleSelectRole = (targetRole) => {
    login(targetRole);
    if (targetRole === ROLES.OWNER) {
      navigate('/owner/overview');
    } else {
      navigate('/admin/overview');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1.5rem',
      backgroundColor: 'var(--bg-canvas)'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '860px',
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem'
      }}>
        {/* Title & Introduction */}
        <div style={{ textAlign: 'center' }}>
          <div className="demo-tag" style={{ marginBottom: '0.75rem' }}>
            <Sparkles size={11} />
            <span>DEVELOPMENT SIMULATION</span>
          </div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            Select Persona to Preview Gateway Console
          </h1>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '620px', margin: '0 auto', fontSize: '0.9375rem' }}>
            Choose an actor persona to enter the respective dashboard. The cyber deception gateway
            delivers dedicated views for individual application owners and global platform administrators.
          </p>
        </div>

        {/* Persona Comparison Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '1.5rem'
        }}>
          {/* Card 1: Application Owner */}
          <div className="cyber-card" style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            border: currentRole === ROLES.OWNER ? '2px solid var(--accent-primary-light)' : '1px solid var(--border-default)'
          }}>
            {currentRole === ROLES.OWNER && (
              <span className="demo-tag" style={{ position: 'absolute', top: '16px', right: '16px', backgroundColor: 'rgba(59, 130, 246, 0.2)' }}>
                CURRENT ACTIVE
              </span>
            )}
            <div>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '8px',
                backgroundColor: 'rgba(37, 99, 235, 0.15)',
                color: '#60a5fa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem'
              }}>
                <Layers size={22} />
              </div>

              <h2 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>
                Application Owner
              </h2>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Simulated User: <strong>Alex Vance</strong> (Apex FinTech Cloud)
              </div>

              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                Organizations and development teams that route production web services through the gateway.
                Inspect threat isolation, canary tokens, and fake API response metrics.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <CheckCircle2 size={14} style={{ color: '#10b981', flexShrink: 0 }} />
                  <span>View protected applications and canary routes</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <CheckCircle2 size={14} style={{ color: '#10b981', flexShrink: 0 }} />
                  <span>Inspect traffic diverted into deception sandboxes</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <CheckCircle2 size={14} style={{ color: '#10b981', flexShrink: 0 }} />
                  <span>Monitor targeted attack vectors and threat index</span>
                </div>
              </div>
            </div>

            <button
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.75rem' }}
              onClick={() => handleSelectRole(ROLES.OWNER)}
            >
              <span>Launch Application Owner View</span>
              <ArrowRight size={16} />
            </button>
          </div>

          {/* Card 2: Gateway Administrator */}
          <div className="cyber-card" style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            border: currentRole === ROLES.ADMIN ? '2px solid #10b981' : '1px solid var(--border-default)'
          }}>
            {currentRole === ROLES.ADMIN && (
              <span className="demo-tag" style={{ position: 'absolute', top: '16px', right: '16px', backgroundColor: 'rgba(16, 185, 129, 0.2)', borderColor: '#10b981', color: '#6ee7b7' }}>
                CURRENT ACTIVE
              </span>
            )}
            <div>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '8px',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                color: '#34d399',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem'
              }}>
                <Shield size={22} />
              </div>

              <h2 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>
                Gateway Administrator
              </h2>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Simulated User: <strong>Sarah Chen</strong> (Platform Operations)
              </div>

              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                Platform operators maintaining the global reverse proxy mesh, AI anomaly detection engines,
                multi-tenant isolation, and cluster-wide deception infrastructure.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <CheckCircle2 size={14} style={{ color: '#10b981', flexShrink: 0 }} />
                  <span>Platform-wide gateway latency and node health</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <CheckCircle2 size={14} style={{ color: '#10b981', flexShrink: 0 }} />
                  <span>Deception mesh decoy pools and orchestration state</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <CheckCircle2 size={14} style={{ color: '#10b981', flexShrink: 0 }} />
                  <span>Cross-tenant threat telemetry & admin audit trails</span>
                </div>
              </div>
            </div>

            <button
              className="btn btn-secondary"
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderColor: 'rgba(16, 185, 129, 0.4)',
                color: '#6ee7b7'
              }}
              onClick={() => handleSelectRole(ROLES.ADMIN)}
            >
              <span>Launch Gateway Admin View</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>

        {/* Route Guard Disclaimer Callout */}
        <div className="demo-banner demo-banner-warning" style={{ alignItems: 'flex-start' }}>
          <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '12px', lineHeight: 1.5 }}>
            <strong>Security Scope Notice (Stage 1):</strong> Route separation in this frontend prototype
            is driven by client-side state for testing developer interactions.
            Production environments require cryptographic session verification and independent backend
            RBAC enforcement at the API gateway layer.
          </div>
        </div>
      </div>
    </div>
  );
}
