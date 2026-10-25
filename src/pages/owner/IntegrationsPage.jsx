import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Network,
  Copy,
  Check,
  Server,
  Code,
  ShieldCheck,
  Sparkles,
  ExternalLink,
  Terminal,
  Cpu,
  Layers,
  ArrowRight
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import { DEMO_DATA_DISCLAIMER } from '../../services/mockData';

export default function IntegrationsPage() {
  const [copiedKey, setCopiedKey] = useState(null);
  const [activeTab, setActiveTab] = useState('dns');

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const SNIPPET_DNS = `# DNS Provider Configuration (Cloudflare, Route 53, or CoreDNS)
# Point your application subdomain to the Deception Gateway Ingress Cluster:

Type: CNAME
Name: api.apexfintech.io
Target: cname.gateway.apexfintech.internal
TTL: 300 (5 minutes)
Proxy Status: DNS Only / Passthrough to Gateway`;

  const SNIPPET_NGINX = `# Nginx Ingress Configuration with Canary Header Passthrough
server {
    listen 443 ssl http2;
    server_name api.apexfintech.io;

    ssl_certificate     /etc/ssl/certs/gateway-cert.pem;
    ssl_certificate_key /etc/ssl/private/gateway-key.pem;

    location / {
        # Forward traffic to the AI Deception Gateway Engine
        proxy_pass http://deception-gateway-mesh.internal:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Gateway-Tenant-ID "tenant-apex-9941";

        # Canary tracking headers
        proxy_set_header X-Canary-Session $http_x_canary_session;
    }
}`;

  const SNIPPET_K8S = `# Kubernetes Ingress with Cyber Deception Gateway Annotations
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: apex-accounts-deception-ingress
  namespace: production
  annotations:
    kubernetes.io/ingress.class: "cyber-deception-gateway"
    gateway.deception.ai/tenant-id: "tenant-apex-9941"
    gateway.deception.ai/protection-profile: "synthetic-sql-decoys"
    gateway.deception.ai/decoy-containers: "4"
spec:
  rules:
  - host: api.apexfintech.io
    http:
      paths:
      - path: /v2/accounts
        pathType: Prefix
        backend:
          service:
            name: accounts-upstream-service
            port:
              number: 8080`;

  const SNIPPET_COMPOSE = `# Local Developer Sandbox: Docker Compose with Mock Gateway
version: '3.8'

services:
  deception-gateway:
    image: ghcr.io/adaptive-cyber-deception/gateway:stage-preview
    ports:
      - "8080:8080"
    environment:
      - GATEWAY_MODE=simulation
      - TENANT_ID=tenant-apex-9941
      - DECEPTION_SURFACES=api,auth,sql
    volumes:
      - ./gateway-rules.json:/etc/gateway/rules.json:ro

  my-app:
    image: node:20-alpine
    command: npm start
    ports:
      - "3000:3000"`;

  return (
    <>
      <PageHeader
        title="Gateway Integrations"
        badge="Edge Reverse Proxy Setup"
        description="Connect your upstream web applications and microservices to the adaptive deception gateway."
      />

      <div className="page-container" style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
        {/* Simulation Banner */}
        <div className="demo-banner">
          <Sparkles size={16} style={{ flexShrink: 0 }} />
          <div>
            <strong>Integration Sandbox:</strong> {DEMO_DATA_DISCLAIMER} The hostnames, CNAME targets, and code snippets below are safe configuration blueprints.
          </div>
        </div>

        {/* Integration Status Panel */}
        <div className="cyber-card">
          <div className="cyber-card-header">
            <div className="cyber-card-title">
              <ShieldCheck size={18} style={{ color: 'var(--status-success)' }} />
              <span>Simulated Ingress Health & Connector Status</span>
            </div>
            <StatusBadge status="operational" label="Gateway Edge Active" />
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '1rem'
          }}>
            <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>PRIMARY CNAME ROUTE</div>
              <div className="mono-tag" style={{ color: '#60a5fa', margin: '4px 0 6px', display: 'inline-block' }}>
                cname.gateway.apexfintech.internal
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--status-success)' }}>
                <Check size={14} />
                <span>DNS Delegation Verified</span>
              </div>
            </div>

            <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>INGRESS EDGE NODE</div>
              <div style={{ fontWeight: 600, margin: '4px 0 6px', fontSize: '13px' }}>
                Cluster US-East-1A
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--status-success)' }}>
                <Check size={14} />
                <span>Active Reverse Proxy (0.8ms)</span>
              </div>
            </div>

            <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>DECOY MESH CONNECTOR</div>
              <div style={{ fontWeight: 600, margin: '4px 0 6px', fontSize: '13px' }}>
                23 Decoy Pods Ready
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--status-success)' }}>
                <Check size={14} />
                <span>Canary Injector Armed</span>
              </div>
            </div>

            <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>TENANT CLUSTER ID</div>
              <div className="mono-tag" style={{ margin: '4px 0 6px', display: 'inline-block' }}>
                tenant-apex-9941
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <span>Standard Isolation Policy</span>
              </div>
            </div>
          </div>
        </div>

        {/* Integration Architecture Overview */}
        <div className="cyber-card">
          <div className="cyber-card-header">
            <div className="cyber-card-title">
              <Network size={18} style={{ color: 'var(--accent-primary-light)' }} />
              <span>How the Deception Gateway Protects Your Services</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', fontSize: '13px' }}>
            <div style={{ borderLeft: '2px solid var(--accent-primary)', paddingLeft: '0.75rem' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                1. DNS / Ingress Delegation
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.5 }}>
                Direct incoming client requests to the gateway edge reverse proxy via CNAME or cloud load balancer.
              </p>
            </div>

            <div style={{ borderLeft: '2px solid #38bdf8', paddingLeft: '0.75rem' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                2. Real-Time Inspection
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.5 }}>
                The AI behavioral model classifies request anomalies, scanner user-agents, and injection attempts under 2ms.
              </p>
            </div>

            <div style={{ borderLeft: '2px solid var(--accent-diverted)', paddingLeft: '0.75rem' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                3. Adaptive Deceptive Diversion
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.5 }}>
                Malicious actors are redirected into synthetic decoys while authentic customer requests pass directly to your upstream service.
              </p>
            </div>

            <div style={{ borderLeft: '2px solid var(--status-success)', paddingLeft: '0.75rem' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                4. Forensic Containment
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.5 }}>
                Every action the attacker takes inside the decoy sandbox is captured and displayed in your Security Events Explorer.
              </p>
            </div>
          </div>
        </div>

        {/* Configuration Blueprints / Code Tabs */}
        <div className="cyber-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface-elevated)'
          }}>
            <button
              className={`btn btn-ghost ${activeTab === 'dns' ? 'active' : ''}`}
              style={{
                borderRadius: 0,
                borderBottom: activeTab === 'dns' ? '2px solid var(--accent-primary-light)' : '2px solid transparent',
                color: activeTab === 'dns' ? '#60a5fa' : 'var(--text-secondary)'
              }}
              onClick={() => setActiveTab('dns')}
            >
              <span>DNS CNAME Routing</span>
            </button>

            <button
              className={`btn btn-ghost ${activeTab === 'nginx' ? 'active' : ''}`}
              style={{
                borderRadius: 0,
                borderBottom: activeTab === 'nginx' ? '2px solid var(--accent-primary-light)' : '2px solid transparent',
                color: activeTab === 'nginx' ? '#60a5fa' : 'var(--text-secondary)'
              }}
              onClick={() => setActiveTab('nginx')}
            >
              <span>Nginx Proxy Snippet</span>
            </button>

            <button
              className={`btn btn-ghost ${activeTab === 'k8s' ? 'active' : ''}`}
              style={{
                borderRadius: 0,
                borderBottom: activeTab === 'k8s' ? '2px solid var(--accent-primary-light)' : '2px solid transparent',
                color: activeTab === 'k8s' ? '#60a5fa' : 'var(--text-secondary)'
              }}
              onClick={() => setActiveTab('k8s')}
            >
              <span>Kubernetes Ingress</span>
            </button>

            <button
              className={`btn btn-ghost ${activeTab === 'compose' ? 'active' : ''}`}
              style={{
                borderRadius: 0,
                borderBottom: activeTab === 'compose' ? '2px solid var(--accent-primary-light)' : '2px solid transparent',
                color: activeTab === 'compose' ? '#60a5fa' : 'var(--text-secondary)'
              }}
              onClick={() => setActiveTab('compose')}
            >
              <span>Docker Compose</span>
            </button>
          </div>

          <div style={{ padding: '1.25rem', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {activeTab === 'dns' && 'Standard DNS CNAME record for custom domain'}
                {activeTab === 'nginx' && 'Nginx reverse proxy with tenant identification header'}
                {activeTab === 'k8s' && 'Kubernetes custom ingress controller annotations'}
                {activeTab === 'compose' && 'Local sandbox mock service definition'}
              </span>

              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  const text = activeTab === 'dns' ? SNIPPET_DNS : activeTab === 'nginx' ? SNIPPET_NGINX : activeTab === 'k8s' ? SNIPPET_K8S : SNIPPET_COMPOSE;
                  handleCopy(text, activeTab);
                }}
              >
                {copiedKey === activeTab ? (
                  <>
                    <Check size={14} style={{ color: 'var(--status-success)' }} />
                    <span style={{ color: 'var(--status-success)' }}>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>Copy Config</span>
                  </>
                )}
              </button>
            </div>

            <pre style={{
              background: 'var(--bg-canvas)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              overflowX: 'auto',
              color: '#e2e8f0',
              lineHeight: 1.6
            }}>
              <code>
                {activeTab === 'dns' && SNIPPET_DNS}
                {activeTab === 'nginx' && SNIPPET_NGINX}
                {activeTab === 'k8s' && SNIPPET_K8S}
                {activeTab === 'compose' && SNIPPET_COMPOSE}
              </code>
            </pre>
          </div>
        </div>

        {/* 4-Step Verification Checklist */}
        <div className="cyber-card">
          <div className="cyber-card-header">
            <div className="cyber-card-title">
              <Check size={18} style={{ color: 'var(--status-success)' }} />
              <span>Integration Verification Checklist</span>
            </div>
            <span className="demo-tag">OPERATIONAL GUIDE</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '13px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>1</span>
              <div>
                <strong>Point CNAME to Gateway Edge:</strong> Update your DNS registrar to direct public traffic to the gateway target.
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>2</span>
              <div>
                <strong>Configure Ingress Route:</strong> Register the upstream path in <Link to="/owner/applications/new" style={{ color: '#60a5fa' }}>Register Application</Link>.
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>3</span>
              <div>
                <strong>Test Honeynet Traps:</strong> Issue a simulated probe to verify diversion into the decoy container without touching your backend database.
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>4</span>
              <div>
                <strong>Inspect Live Telemetry:</strong> Observe captured attacker interactions in <Link to="/owner/events" style={{ color: '#60a5fa' }}>Security Events Explorer</Link>.
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
