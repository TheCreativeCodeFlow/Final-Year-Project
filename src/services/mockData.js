/**
 * Mock Data Service for Cyber Deception Gateway
 * All data in this file is strictly simulated for demonstration and prototyping purposes.
 * It is NOT live security telemetry.
 */

export const IS_DEMO_DATA = true;
export const DEMO_DATA_DISCLAIMER = "DEMO DATA: Simulated telemetry for prototype evaluation only.";

const STORAGE_KEY_APPS = 'cyber_deception_apps_v2';
const STORAGE_KEY_SETTINGS = 'cyber_deception_settings_v2';
const STORAGE_KEY_TENANTS = 'cyber_deception_tenants_v1';
const STORAGE_KEY_INVESTIGATIONS = 'cyber_deception_investigations_v1';
const STORAGE_KEY_PROFILES = 'cyber_deception_profiles_v1';

// --- Default Tenants Seed Data ---
export const DEFAULT_TENANTS = [
  {
    id: "tenant-apex-9941",
    name: "Apex FinTech Cloud",
    tier: "Enterprise Shield Tier",
    contactEmail: "security-ops@apexfintech.io",
    status: "active",
    environmentTier: "Production Tier 1",
    region: "US-East & US-West Multi-Region",
    applicationCount: 6,
    shieldedAppCount: 5,
    monitoringAppCount: 1,
    requestVolume: "2,975,900 reqs/day",
    threatCount: 2288,
    activeDecoys: 24,
    lastActivity: "1 min ago",
    createdAt: "2026-06-12T08:00:00Z",
    assignedIngressCluster: "Edge-Cluster-US-East",
    isolationProfile: "High Isolation (Dedicated VPC Sink)",
    description: "Multi-regional retail banking and financial settlement platform with strict PCI-DSS boundary controls."
  },
  {
    id: "tenant-medsecure-1022",
    name: "MedSecure Health Net",
    tier: "Healthcare Dedicated Tier",
    contactEmail: "ciso@medsecurehealth.net",
    status: "active",
    environmentTier: "HIPAA Compliant",
    region: "US-Central & US-East",
    applicationCount: 2,
    shieldedAppCount: 2,
    monitoringAppCount: 0,
    requestVolume: "1,420,000 reqs/day",
    threatCount: 501,
    activeDecoys: 12,
    lastActivity: "18 mins ago",
    createdAt: "2026-07-04T10:30:00Z",
    assignedIngressCluster: "Edge-Cluster-US-Central",
    isolationProfile: "HIPAA Zero-Trust Sandbox",
    description: "Federated hospital management and electronic health records (EHR) gateway with synthetic patient traps."
  },
  {
    id: "tenant-omni-4401",
    name: "OmniLogistics Global",
    tier: "Standard Cloud Tier",
    contactEmail: "cloud-admin@omnilogistics.io",
    status: "active",
    environmentTier: "Commercial Enterprise",
    region: "EU-West (Frankfurt/London)",
    applicationCount: 2,
    shieldedAppCount: 2,
    monitoringAppCount: 0,
    requestVolume: "1,880,000 reqs/day",
    threatCount: 399,
    activeDecoys: 8,
    lastActivity: "42 mins ago",
    createdAt: "2026-07-28T14:15:00Z",
    assignedIngressCluster: "Edge-Cluster-EU-West",
    isolationProfile: "Container Namespace Isolation",
    description: "Worldwide supply chain telemetry and cross-docking dispatch system with automated decoy tracking."
  },
  {
    id: "tenant-aerodyn-8823",
    name: "AeroDynamics Defence Lab",
    tier: "Government Dedicated Tier",
    contactEmail: "sec-clearance@aerodynlab.internal",
    status: "active",
    environmentTier: "Classified Sandbox",
    region: "US-Gov-East Isolated",
    applicationCount: 1,
    shieldedAppCount: 1,
    monitoringAppCount: 0,
    requestVolume: "2,450,000 reqs/day",
    threatCount: 840,
    activeDecoys: 16,
    lastActivity: "1 hour ago",
    createdAt: "2026-05-18T09:00:00Z",
    assignedIngressCluster: "Edge-Cluster-Gov-Isolated",
    isolationProfile: "Air-Gapped Decoy Network",
    description: "Avionics telemetry and propulsion simulation network under persistent advanced-threat monitoring."
  },
  {
    id: "tenant-nexushub-3319",
    name: "NexusHub SaaS Ecosystem",
    tier: "Standard Cloud Tier",
    contactEmail: "infra@nexushub.cloud",
    status: "active",
    environmentTier: "Multi-Tenant Standard",
    region: "US-West (Oregon)",
    applicationCount: 2,
    shieldedAppCount: 1,
    monitoringAppCount: 1,
    requestVolume: "980,000 reqs/day",
    threatCount: 234,
    activeDecoys: 6,
    lastActivity: "2 hours ago",
    createdAt: "2026-08-22T11:45:00Z",
    assignedIngressCluster: "Edge-Cluster-US-West",
    isolationProfile: "Standard Shared Worker Pool",
    description: "Collaborative developer API ecosystem with schema poisoning decoys on public GraphQL endpoints."
  },
  {
    id: "tenant-quant-7712",
    name: "QuantEdge Capital",
    tier: "Ultra-Low Latency Tier",
    contactEmail: "hft-devops@quantedge.internal",
    status: "provisioning",
    environmentTier: "Bare Metal Ingress",
    region: "US-East (New Jersey Equinix)",
    applicationCount: 1,
    shieldedAppCount: 1,
    monitoringAppCount: 0,
    requestVolume: "4,120,000 reqs/day",
    threatCount: 62,
    activeDecoys: 4,
    lastActivity: "3 hours ago",
    createdAt: "2026-10-15T16:00:00Z",
    assignedIngressCluster: "Edge-Cluster-US-Equinix",
    isolationProfile: "Hardware Accelerated eBPF Bypass",
    description: "Algorithmic execution desk utilizing synthetic order routing traps for market manipulation detection."
  }
];

// --- Default Applications Seed Data (Unified Across Tenants) ---
export const DEFAULT_APPLICATIONS = [
  // Apex FinTech Cloud (tenant-apex-9941)
  {
    id: "app-01",
    tenantId: "tenant-apex-9941",
    tenantName: "Apex FinTech Cloud",
    name: "Customer Accounts API",
    domain: "api.apexfintech.io",
    route: "api.apexfintech.io/v2/accounts",
    environment: "production",
    status: "shielded",
    protectionMode: "Synthetic SQL & API Decoys",
    description: "Core RESTful accounts microservice serving authenticated retail banking customers.",
    tags: ["Banking", "Accounts", "PCI-DSS", "REST"],
    requestsPerSec: 420,
    requestVolume: "1,240,500 reqs/day",
    threatCount: 384,
    threatIndex: "Low",
    activeDecoys: 4,
    lastActivity: "1 min ago",
    createdAt: "2026-08-15T10:00:00Z",
    updatedAt: "2026-10-24T14:30:00Z",
    cnameTarget: "cname.gateway.apexfintech.internal",
    upstreamUrl: "https://internal-k8s.apexfintech.io/accounts"
  },
  {
    id: "app-02",
    tenantId: "tenant-apex-9941",
    tenantName: "Apex FinTech Cloud",
    name: "Payment Settlement Core",
    domain: "payments.apexfintech.io",
    route: "payments.apexfintech.io/checkout",
    environment: "production",
    status: "shielded",
    protectionMode: "Adaptive Emulation Sandbox",
    description: "High-volume card processing and instant settlement execution pipeline.",
    tags: ["Payments", "Settlement", "High-Value", "Zero-Trust"],
    requestsPerSec: 285,
    requestVolume: "840,000 reqs/day",
    threatCount: 512,
    threatIndex: "Medium",
    activeDecoys: 6,
    lastActivity: "4 mins ago",
    createdAt: "2026-08-20T11:30:00Z",
    updatedAt: "2026-10-25T08:15:00Z",
    cnameTarget: "cname.gateway.apexfintech.internal",
    upstreamUrl: "https://internal-k8s.apexfintech.io/payments"
  },
  {
    id: "app-03",
    tenantId: "tenant-apex-9941",
    tenantName: "Apex FinTech Cloud",
    name: "Enterprise Admin Portal",
    domain: "admin.apexfintech.io",
    route: "admin.apexfintech.io/manage",
    environment: "production",
    status: "shielded",
    protectionMode: "Canary Credentials & Honey-routes",
    description: "Privileged administration console for operations staff, compliance officers, and tenant supervisors.",
    tags: ["Internal", "Admin", "RBAC", "Canary-Guarded"],
    requestsPerSec: 45,
    requestVolume: "128,400 reqs/day",
    threatCount: 920,
    threatIndex: "Elevated",
    activeDecoys: 8,
    lastActivity: "Just now",
    createdAt: "2026-07-10T09:00:00Z",
    updatedAt: "2026-10-25T11:00:00Z",
    cnameTarget: "cname.gateway.apexfintech.internal",
    upstreamUrl: "https://internal-admin.apexfintech.io"
  },
  {
    id: "app-04",
    tenantId: "tenant-apex-9941",
    tenantName: "Apex FinTech Cloud",
    name: "Mobile Banking Gateway",
    domain: "mobile-gw.apexfintech.io",
    route: "mobile-gw.apexfintech.io/graphql",
    environment: "production",
    status: "shielded",
    protectionMode: "Schema Poisoning Decoys",
    description: "Aggregated GraphQL BFF (Backend for Frontend) powering iOS and Android native apps.",
    tags: ["Mobile", "GraphQL", "BFF", "Public-Facing"],
    requestsPerSec: 180,
    requestVolume: "540,000 reqs/day",
    threatCount: 248,
    threatIndex: "Low",
    activeDecoys: 3,
    lastActivity: "12 mins ago",
    createdAt: "2026-09-01T14:00:00Z",
    updatedAt: "2026-10-22T16:45:00Z",
    cnameTarget: "cname.gateway.apexfintech.internal",
    upstreamUrl: "https://internal-graphql.apexfintech.io"
  },
  {
    id: "app-05",
    tenantId: "tenant-apex-9941",
    tenantName: "Apex FinTech Cloud",
    name: "Partner B2B Webhook Ingress",
    domain: "hooks.apexfintech.io",
    route: "hooks.apexfintech.io/v1/incoming",
    environment: "staging",
    status: "shielded",
    protectionMode: "Shadow API Shadowing",
    description: "External partner webhook receiver for ACH notifications, payment callbacks, and KYC webhooks.",
    tags: ["Partner", "Webhooks", "Staging", "External-Ingress"],
    requestsPerSec: 62,
    requestVolume: "185,000 reqs/day",
    threatCount: 165,
    threatIndex: "Low",
    activeDecoys: 2,
    lastActivity: "25 mins ago",
    createdAt: "2026-09-15T08:30:00Z",
    updatedAt: "2026-10-23T10:10:00Z",
    cnameTarget: "cname-staging.gateway.apexfintech.internal",
    upstreamUrl: "https://staging-hooks.apexfintech.io"
  },
  {
    id: "app-06",
    tenantId: "tenant-apex-9941",
    tenantName: "Apex FinTech Cloud",
    name: "Wealth Management Microservice",
    domain: "invest.apexfintech.io",
    route: "invest.apexfintech.io/api/portfolio",
    environment: "development",
    status: "monitoring",
    protectionMode: "Monitoring Only",
    description: "Development sandbox for automated trading algorithm evaluation and portfolio optimization.",
    tags: ["Investments", "Sandbox", "Dev", "Experimental"],
    requestsPerSec: 18,
    requestVolume: "42,000 reqs/day",
    threatCount: 42,
    threatIndex: "Low",
    activeDecoys: 1,
    lastActivity: "1 hour ago",
    createdAt: "2026-10-01T15:00:00Z",
    updatedAt: "2026-10-24T18:20:00Z",
    cnameTarget: "cname-dev.gateway.apexfintech.internal",
    upstreamUrl: "https://dev-invest.apexfintech.io"
  },

  // MedSecure Health Net (tenant-medsecure-1022)
  {
    id: "app-11",
    tenantId: "tenant-medsecure-1022",
    tenantName: "MedSecure Health Net",
    name: "Patient Records FHIR API",
    domain: "fhir.medsecurehealth.net",
    route: "fhir.medsecurehealth.net/api/v4/Patient",
    environment: "production",
    status: "shielded",
    protectionMode: "Synthetic Patient Data Decoys",
    description: "FHIR standard electronic patient records integration gateway for hospital federations.",
    tags: ["Healthcare", "FHIR", "HIPAA", "High-Sensitivity"],
    requestsPerSec: 310,
    requestVolume: "920,000 reqs/day",
    threatCount: 412,
    threatIndex: "Elevated",
    activeDecoys: 8,
    lastActivity: "19 mins ago",
    createdAt: "2026-07-15T09:00:00Z",
    updatedAt: "2026-10-25T14:00:00Z",
    cnameTarget: "cname.gateway.medsecure.internal",
    upstreamUrl: "https://fhir-internal.medsecurehealth.net"
  },
  {
    id: "app-12",
    tenantId: "tenant-medsecure-1022",
    tenantName: "MedSecure Health Net",
    name: "Telehealth Clinical Gateway",
    domain: "telehealth.medsecurehealth.net",
    route: "telehealth.medsecurehealth.net/webrtc",
    environment: "production",
    status: "shielded",
    protectionMode: "Adaptive Emulation Sandbox",
    description: "Real-time clinical consultation video session broker and patient intake gateway.",
    tags: ["Telehealth", "WebRTC", "Clinical"],
    requestsPerSec: 120,
    requestVolume: "500,000 reqs/day",
    threatCount: 89,
    threatIndex: "Low",
    activeDecoys: 4,
    lastActivity: "28 mins ago",
    createdAt: "2026-08-01T12:00:00Z",
    updatedAt: "2026-10-24T16:00:00Z",
    cnameTarget: "cname.gateway.medsecure.internal",
    upstreamUrl: "https://telehealth-internal.medsecurehealth.net"
  },

  // OmniLogistics Global (tenant-omni-4401)
  {
    id: "app-21",
    tenantId: "tenant-omni-4401",
    tenantName: "OmniLogistics Global",
    name: "Fleet Dispatch WebSocket",
    domain: "fleet-ws.omnilogistics.io",
    route: "fleet-ws.omnilogistics.io/v1/telemetry",
    environment: "production",
    status: "shielded",
    protectionMode: "Protocol Smuggling Decoys",
    description: "High-frequency GPS and vehicle sensor telemetry streaming endpoint.",
    tags: ["Logistics", "WebSocket", "Fleet"],
    requestsPerSec: 540,
    requestVolume: "1,520,000 reqs/day",
    threatCount: 284,
    threatIndex: "Medium",
    activeDecoys: 5,
    lastActivity: "45 mins ago",
    createdAt: "2026-08-10T11:00:00Z",
    updatedAt: "2026-10-25T11:20:00Z",
    cnameTarget: "cname.gateway.omnilogistics.internal",
    upstreamUrl: "https://internal-fleet.omnilogistics.io"
  },
  {
    id: "app-22",
    tenantId: "tenant-omni-4401",
    tenantName: "OmniLogistics Global",
    name: "Supply Chain Partner Portal",
    domain: "partners.omnilogistics.io",
    route: "partners.omnilogistics.io/portal",
    environment: "production",
    status: "shielded",
    protectionMode: "Canary Credentials & Honey-routes",
    description: "Vendor cross-dock scheduling and customs clearance documentation portal.",
    tags: ["B2B", "Vendor", "Logistics"],
    requestsPerSec: 95,
    requestVolume: "360,000 reqs/day",
    threatCount: 115,
    threatIndex: "Low",
    activeDecoys: 3,
    lastActivity: "1 hour ago",
    createdAt: "2026-08-15T14:30:00Z",
    updatedAt: "2026-10-23T18:00:00Z",
    cnameTarget: "cname.gateway.omnilogistics.internal",
    upstreamUrl: "https://internal-portal.omnilogistics.io"
  },

  // AeroDynamics Defence Lab (tenant-aerodyn-8823)
  {
    id: "app-31",
    tenantId: "tenant-aerodyn-8823",
    tenantName: "AeroDynamics Defence Lab",
    name: "Telemetry Ingestion Relay",
    domain: "sensor-relay.aerodynlab.internal",
    route: "sensor-relay.aerodynlab.internal/telemetry",
    environment: "production",
    status: "shielded",
    protectionMode: "APT Deception Honey-Mesh",
    description: "Classified avionics test rig ingestion stream equipped with advanced nation-state decoy profiles.",
    tags: ["Defence", "Sensors", "APT-Defense", "Classified"],
    requestsPerSec: 720,
    requestVolume: "2,450,000 reqs/day",
    threatCount: 840,
    threatIndex: "Critical",
    activeDecoys: 16,
    lastActivity: "1 hr ago",
    createdAt: "2026-06-01T08:00:00Z",
    updatedAt: "2026-10-25T15:10:00Z",
    cnameTarget: "cname-gov.gateway.aerodynlab.internal",
    upstreamUrl: "https://classified-sensor-rig.aerodynlab.internal"
  },

  // NexusHub SaaS Ecosystem (tenant-nexushub-3319)
  {
    id: "app-41",
    tenantId: "tenant-nexushub-3319",
    tenantName: "NexusHub SaaS Ecosystem",
    name: "Core Multi-Tenant GraphQL API",
    domain: "api.nexushub.cloud",
    route: "api.nexushub.cloud/graphql",
    environment: "production",
    status: "shielded",
    protectionMode: "Schema Poisoning Decoys",
    description: "Public GraphQL developer gateway for workspace collaboration and webhooks.",
    tags: ["SaaS", "GraphQL", "Public-API"],
    requestsPerSec: 610,
    requestVolume: "780,000 reqs/day",
    threatCount: 190,
    threatIndex: "Low",
    activeDecoys: 4,
    lastActivity: "2 hours ago",
    createdAt: "2026-08-30T10:00:00Z",
    updatedAt: "2026-10-24T12:00:00Z",
    cnameTarget: "cname.gateway.nexushub.internal",
    upstreamUrl: "https://internal-graphql.nexushub.cloud"
  },

  // QuantEdge Capital (tenant-quant-7712)
  {
    id: "app-51",
    tenantId: "tenant-quant-7712",
    tenantName: "QuantEdge Capital",
    name: "High-Frequency FIX Gateway",
    domain: "fix-gw.quantedge.internal",
    route: "fix-gw.quantedge.internal/marketdata",
    environment: "production",
    status: "shielded",
    protectionMode: "Tarpit Delay & Simulated Order Sink",
    description: "Ultra-low latency FIX financial exchange ingress endpoint with canary order flow traps.",
    tags: ["HFT", "FIX-Protocol", "Equinix"],
    requestsPerSec: 1840,
    requestVolume: "4,120,000 reqs/day",
    threatCount: 62,
    threatIndex: "Low",
    activeDecoys: 4,
    lastActivity: "3 hours ago",
    createdAt: "2026-10-18T09:30:00Z",
    updatedAt: "2026-10-25T11:45:00Z",
    cnameTarget: "cname.gateway.quantedge.internal",
    upstreamUrl: "https://hft-fix-internal.quantedge.internal"
  }
];

// --- Comprehensive Security Events Seed Data ---
export const DEFAULT_SECURITY_EVENTS = [
  {
    id: "evt-901",
    timestamp: "2 mins ago",
    isoTimestamp: "2026-10-25T15:42:00Z",
    tenantId: "tenant-apex-9941",
    tenantName: "Apex FinTech Cloud",
    applicationId: "app-03",
    application: "Enterprise Admin Portal",
    sourceIp: "198.51.100.44",
    originCountry: "DE (Frankfurt)",
    asn: "AS24940 (Hetzner Online)",
    vector: "Credential Stuffing & Auth Bypass",
    category: "Authentication & Brute Force",
    severity: "critical",
    detectionOutcome: "Canary Token Triggered",
    routingOutcome: "routed_to_deception",
    gatewayAction: "Diverted to Fake Auth Shadow",
    details: "140 invalid tokens passed; attacker isolated in canary container with simulated JWT secrets.",
    simulatedRationale: "Heuristic Anomaly Detector scored 0.985 confidence. IP triggered Canary Credential Trap '/manage/login-canary'.",
    requestMetadata: {
      method: "POST",
      path: "/manage/v1/auth/token",
      userAgent: "python-requests/2.31.0 (Automated Tooling)",
      flaggedPayload: "username=superadmin&pass=******** (140 dictionary variations)",
      canaryHit: "CANARY_TOKEN_HASH_#88912"
    },
    deceptionInteraction: {
      containerId: "decoy-worker-pod-89b",
      decoyType: "Fake Admin Auth API",
      dwellTime: "3m 42s",
      attackerActionsLogged: 14,
      fakeResponseStatus: "200 OK (Fabricated Session Key Returned)"
    },
    policyDecision: "Active Diversion: Policy SEC-AUTH-09 executed."
  },
  {
    id: "evt-902",
    timestamp: "14 mins ago",
    isoTimestamp: "2026-10-25T15:30:00Z",
    tenantId: "tenant-apex-9941",
    tenantName: "Apex FinTech Cloud",
    applicationId: "app-01",
    application: "Customer Accounts API",
    sourceIp: "203.0.113.89",
    originCountry: "NL (Amsterdam)",
    asn: "AS16509 (Amazon Datacenter)",
    vector: "SQLi Injection Probe (/v2/users?id=1' OR)",
    category: "Injection Attacks",
    severity: "high",
    detectionOutcome: "Signature Match",
    routingOutcome: "routed_to_deception",
    gatewayAction: "Served Simulated DB Delay & Error",
    details: "Fingerprinting attempt delayed and logged in deception sandbox with synthetic database error schema.",
    simulatedRationale: "Query parameter parsing detected classic tautology SQL injection payload pattern.",
    requestMetadata: {
      method: "GET",
      path: "/v2/users?id=1'%20OR%20'1'='1'--",
      userAgent: "sqlmap/1.7.2#stable",
      flaggedPayload: "id=1' OR '1'='1'--",
      canaryHit: "None (Pattern match)"
    },
    deceptionInteraction: {
      containerId: "decoy-db-shadow-42",
      decoyType: "Synthetic PostgreSQL 14 Trap",
      dwellTime: "1m 18s",
      attackerActionsLogged: 6,
      fakeResponseStatus: "500 Internal Error (Fake PG Stack Trace)"
    },
    policyDecision: "Deceptive Delay: Latency injection + Synthetic Error."
  },
  {
    id: "evt-903",
    timestamp: "32 mins ago",
    isoTimestamp: "2026-10-25T15:12:00Z",
    tenantId: "tenant-apex-9941",
    tenantName: "Apex FinTech Cloud",
    applicationId: "app-02",
    application: "Payment Settlement Core",
    sourceIp: "192.0.2.112",
    originCountry: "US (Virginia)",
    asn: "AS14618 (Cloud Cluster)",
    vector: "SSRF Parameter Tampering",
    category: "SSRF & Cloud Metadata",
    severity: "high",
    detectionOutcome: "Threat Detected",
    routingOutcome: "routed_to_deception",
    gatewayAction: "Rerouted to Honey-Metadata Service",
    details: "Targeted AWS metadata endpoint (169.254.169.254); simulated IAM credentials dispatched.",
    simulatedRationale: "Outbound callback parameter contained link-local IPv4 cloud metadata address.",
    requestMetadata: {
      method: "POST",
      path: "/checkout/webhook?callback=http://169.254.169.254/latest/meta-data/",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      flaggedPayload: "callback=http://169.254.169.254/latest/meta-data/iam/security-credentials/",
      canaryHit: "CANARY_IAM_ROLE_FAKE_ADMIN"
    },
    deceptionInteraction: {
      containerId: "decoy-imds-sink-07",
      decoyType: "Synthetic AWS IMDSv2 Decoy",
      dwellTime: "5m 02s",
      attackerActionsLogged: 9,
      fakeResponseStatus: "200 OK (Dispatched Canary AWS Access Keys)"
    },
    policyDecision: "Redirect to Canary Sink: Capture key usage downstream."
  },
  {
    id: "adm-evt-101",
    timestamp: "4 mins ago",
    isoTimestamp: "2026-10-25T15:40:00Z",
    tenantId: "tenant-apex-9941",
    tenantName: "Apex FinTech Cloud",
    applicationId: "app-03",
    application: "Enterprise Admin Portal",
    sourceIp: "198.51.100.44",
    originCountry: "DE (Frankfurt)",
    asn: "AS24940 (Hetzner Online)",
    vector: "Distributed Credential Stuffing & Session Hijack",
    category: "Authentication & Brute Force",
    severity: "critical",
    detectionOutcome: "Canary Token Triggered",
    routingOutcome: "routed_to_deception",
    gatewayAction: "Active in Sandboxed Honeynet",
    details: "High-volume distributed credential rotation detected targeting administrative token endpoint.",
    simulatedRationale: "Burst rate of 280 failed authentications per minute matched botnet credential spray pattern.",
    requestMetadata: {
      method: "POST",
      path: "/manage/login",
      userAgent: "curl/8.1.2",
      flaggedPayload: "Authorization: Bearer canary_expired_token_09",
      canaryHit: "CANARY_JWT_SIG_FAIL"
    },
    deceptionInteraction: {
      containerId: "decoy-auth-sandbox-01",
      decoyType: "Synthetic Auth Service",
      dwellTime: "7m 14s",
      attackerActionsLogged: 32,
      fakeResponseStatus: "200 OK (Dummy Profile)"
    },
    policyDecision: "Active Honeynet Containment"
  },
  {
    id: "adm-evt-102",
    timestamp: "19 mins ago",
    isoTimestamp: "2026-10-25T15:25:00Z",
    tenantId: "tenant-medsecure-1022",
    tenantName: "MedSecure Health Net",
    applicationId: "app-11",
    application: "Patient Records FHIR API",
    sourceIp: "203.0.113.12",
    originCountry: "UA (Kyiv)",
    asn: "AS15895 (Hostpro)",
    vector: "Mass BOLA / IDOR Traversal Probe",
    category: "API & Schema Abuse",
    severity: "critical",
    detectionOutcome: "Heuristic Anomaly Flagged",
    routingOutcome: "routed_to_deception",
    gatewayAction: "Rerouted to Synthetic Patient Database",
    details: "Iterative identifier probe across sequential patient record IDs (/Patient?_id=1001-1050).",
    simulatedRationale: "Rapid enumeration of private resource IDs flagged as BOLA horizontal privilege escalation.",
    requestMetadata: {
      method: "GET",
      path: "/api/v4/Patient?_id=1042",
      userAgent: "python-urllib3/2.0.4",
      flaggedPayload: "Sequential integer traversal",
      canaryHit: "CANARY_PATIENT_1042"
    },
    deceptionInteraction: {
      containerId: "decoy-patient-ehr-sink",
      decoyType: "Synthetic FHIR Decoy",
      dwellTime: "9m 40s",
      attackerActionsLogged: 45,
      fakeResponseStatus: "200 OK (Generated Synthetic Records)"
    },
    policyDecision: "Deceptive Patient Record Emulation"
  },
  {
    id: "adm-evt-103",
    timestamp: "45 mins ago",
    isoTimestamp: "2026-10-25T14:59:00Z",
    tenantId: "tenant-omni-4401",
    tenantName: "OmniLogistics Global",
    applicationId: "app-21",
    application: "Fleet Dispatch WebSocket",
    sourceIp: "192.0.2.78",
    originCountry: "RO (Bucharest)",
    asn: "AS8708 (RCS & RDS)",
    vector: "Protocol Smuggling & Command Injection",
    category: "Injection Attacks",
    severity: "high",
    detectionOutcome: "Signature Match",
    routingOutcome: "routed_to_deception",
    gatewayAction: "Isolated in Containerized Shadow Sink",
    details: "Malformed HTTP upgrade packet with embedded newline injection attempting socket takeover.",
    simulatedRationale: "HTTP header parser detected CRLF smuggling attempt in Upgrade request.",
    requestMetadata: {
      method: "GET",
      path: "/v1/telemetry/ws\r\nHost: evil.com",
      userAgent: "Custom-WS-Client",
      flaggedPayload: "CRLF injection header string",
      canaryHit: "None"
    },
    deceptionInteraction: {
      containerId: "decoy-ws-sink-04",
      decoyType: "Mock WebSocket Echo Server",
      dwellTime: "4m 10s",
      attackerActionsLogged: 12,
      fakeResponseStatus: "101 Switching Protocols (Isolated Decoy)"
    },
    policyDecision: "Shadow Sink Isolation"
  },
  {
    id: "adm-evt-104",
    timestamp: "1 hr ago",
    isoTimestamp: "2026-10-25T14:44:00Z",
    tenantId: "tenant-aerodyn-8823",
    tenantName: "AeroDynamics Defence Lab",
    applicationId: "app-31",
    application: "Telemetry Ingestion Relay",
    sourceIp: "198.51.100.198",
    originCountry: "CN (Beijing)",
    asn: "AS4134 (Chinanet)",
    vector: "Known Nation-State Scanning Signature (APT Probe)",
    category: "Reconnaissance & Scanning",
    severity: "critical",
    detectionOutcome: "Canary Token Triggered",
    routingOutcome: "routed_to_deception",
    gatewayAction: "Honey-token Fingerprint Dispatched",
    details: "Targeted reconnaissance scanning against defense sensor stream using zero-day fingerprint probes.",
    simulatedRationale: "Byte sequence matched classified threat intelligence signature for APT-41 tooling.",
    requestMetadata: {
      method: "POST",
      path: "/telemetry/v1/sync",
      userAgent: "Mozilla/5.0 (APT Probe Simulator)",
      flaggedPayload: "Binary payload matching SIG-APT-DEF-88",
      canaryHit: "CANARY_DEFENCE_BEACON_ALPHA"
    },
    deceptionInteraction: {
      containerId: "decoy-apt-honeynet-prime",
      decoyType: "High-Interaction Telemetry Sandbox",
      dwellTime: "14m 50s",
      attackerActionsLogged: 68,
      fakeResponseStatus: "200 OK (Fabricated Sensor Acknowledgement)"
    },
    policyDecision: "High-Interaction Sandbox Diversion"
  }
];

// --- Gateway Component Health Data (7 Subsystems) ---
export const DEFAULT_COMPONENT_HEALTH = [
  {
    id: "comp-reverse-proxy",
    name: "L7 Reverse Proxy & Ingress Filter",
    subsystem: "Reverse Proxy",
    category: "Ingress",
    status: "healthy",
    lastHealthCheck: "14 seconds ago",
    latency: "0.8ms",
    errorCount24h: 0,
    uptime: "99.99%",
    cluster: "Edge-Cluster-US-East",
    summary: "Active Envoy ingress mesh terminating client TLS and inspecting protocol headers without delay."
  },
  {
    id: "comp-behavioral-detector",
    name: "AI Behavioral Anomaly Classifier",
    subsystem: "Behavioral Detection Service",
    category: "Inference Engine",
    status: "healthy",
    lastHealthCheck: "8 seconds ago",
    latency: "3.2ms",
    errorCount24h: 2,
    uptime: "99.95%",
    cluster: "Inference-Worker-Pool-1",
    summary: "Transformer-based sequence classification model scoring incoming token distributions against baseline."
  },
  {
    id: "comp-policy-engine",
    name: "Tenant Isolation & Policy Engine",
    subsystem: "Policy Engine",
    category: "Policy & Routing",
    status: "healthy",
    lastHealthCheck: "22 seconds ago",
    latency: "0.4ms",
    errorCount24h: 0,
    uptime: "100.00%",
    cluster: "Core-Policy-Matrix",
    summary: "Zero-trust routing matrix verifying tenant isolation boundaries and diversion threshold rules."
  },
  {
    id: "comp-deception-orchestrator",
    name: "Dynamic Deception Orchestrator",
    subsystem: "Deception Orchestrator",
    category: "Deception Mesh",
    status: "healthy",
    lastHealthCheck: "18 seconds ago",
    latency: "2.1ms",
    errorCount24h: 0,
    uptime: "100.00%",
    cluster: "Decoy-Runtime-Vanguard",
    summary: "Autonomous honeynet scheduler routing flagged attacker sessions to synthetic shadow pods."
  },
  {
    id: "comp-synthetic-runtime",
    name: "Synthetic Environment Decoy Pods",
    subsystem: "Synthetic Environment Runtime",
    category: "Decoy Containers",
    status: "healthy",
    lastHealthCheck: "30 seconds ago",
    latency: "1.6ms",
    errorCount24h: 1,
    uptime: "99.98%",
    cluster: "K8s-Decoy-Namespace-Isolated",
    summary: "Sandboxed container execution nodes serving fabricated APIs, database traps, and honeypot routes."
  },
  {
    id: "comp-event-pipeline",
    name: "Threat Telemetry & Event Collection",
    subsystem: "Event Collection Pipeline",
    category: "Telemetry Ingest",
    status: "healthy",
    lastHealthCheck: "5 seconds ago",
    latency: "1.2ms",
    errorCount24h: 0,
    uptime: "99.98%",
    cluster: "Kafka-Ingest-Broker-A",
    summary: "Distributed event stream broker aggregating forensic telemetry and canary token hit logs."
  },
  {
    id: "comp-persistence-layer",
    name: "State Matrix & Audit Persistence",
    subsystem: "Persistence Layer",
    category: "Data Store",
    status: "healthy",
    lastHealthCheck: "45 seconds ago",
    latency: "0.9ms",
    errorCount24h: 0,
    uptime: "99.99%",
    cluster: "Distributed-Postgres-Primary",
    summary: "Append-only operational audit store and tenant configuration matrix."
  }
];

// --- Platform-wide Administrative Audit Logs ---
export const DEFAULT_AUDIT_LOGS = [
  {
    id: "aud-501",
    timestamp: "12 mins ago",
    isoTimestamp: "2026-10-25T15:32:00Z",
    actor: "sarah.chen@gateway-admin.internal",
    actorRole: "Principal Gateway Operator",
    action: "POLICY_UPDATE",
    category: "Policy",
    target: "Tenant: Apex FinTech Cloud - Stricter SQLi Diversion Threshold",
    tenantId: "tenant-apex-9941",
    tenantName: "Apex FinTech Cloud",
    result: "Success",
    ip: "10.14.0.52",
    details: "Adjusted tautology SQL injection heuristic sensitivity from 0.85 to 0.75 for /v2/accounts route."
  },
  {
    id: "aud-502",
    timestamp: "38 mins ago",
    isoTimestamp: "2026-10-25T15:06:00Z",
    actor: "system-orchestrator",
    actorRole: "Autonomous Scheduler",
    action: "DECOY_POOL_SCALED",
    category: "Decoy Scaling",
    target: "Decoy-Cluster-US-East: Scaled from 30 to 45 containers",
    tenantId: "tenant-apex-9941",
    tenantName: "Apex FinTech Cloud",
    result: "Success",
    ip: "10.14.0.1",
    details: "Automated scale-up triggered by elevated brute force sessions targeting auth sandboxes."
  },
  {
    id: "aud-503",
    timestamp: "1 hr ago",
    isoTimestamp: "2026-10-25T14:44:00Z",
    actor: "marcus.vance@gateway-admin.internal",
    actorRole: "Security Operations Analyst",
    action: "QUARANTINE_IP_RANGE",
    category: "Security & Quarantines",
    target: "Range 198.51.100.0/24 placed into Persistent Honeynet diversion",
    tenantId: "tenant-aerodyn-8823",
    tenantName: "AeroDynamics Defence Lab",
    result: "Success",
    ip: "10.14.0.88",
    details: "Threat intelligence feed flagged IP CIDR as active scanner origin; automated tarpit enforced."
  },
  {
    id: "aud-504",
    timestamp: "2 hrs ago",
    isoTimestamp: "2026-10-25T13:44:00Z",
    actor: "sarah.chen@gateway-admin.internal",
    actorRole: "Principal Gateway Operator",
    action: "CANARY_TOKEN_ROTATION",
    category: "Canary Secrets",
    target: "Global JWT Secret Canary Keys Rotated",
    tenantId: "all",
    tenantName: "All Platform Tenants",
    result: "Success",
    ip: "10.14.0.52",
    details: "Routine 30-day cryptographic canary key rotation completed across all ingress proxy edge pods."
  },
  {
    id: "aud-505",
    timestamp: "3 hrs ago",
    isoTimestamp: "2026-10-25T12:44:00Z",
    actor: "alex.kumar@gateway-admin.internal",
    actorRole: "Platform SRE",
    action: "TENANT_PROVISION_UPDATE",
    category: "Tenant Config",
    target: "Tenant: QuantEdge Capital (tenant-quant-7712) Ingress Verified",
    tenantId: "tenant-quant-7712",
    tenantName: "QuantEdge Capital",
    result: "Success",
    ip: "10.14.0.31",
    details: "Verified dedicated Equinix NY4 10Gbps cross-connect ingress link for ultra-low latency FIX service."
  },
  {
    id: "aud-506",
    timestamp: "4 hrs ago",
    isoTimestamp: "2026-10-25T11:44:00Z",
    actor: "sarah.chen@gateway-admin.internal",
    actorRole: "Principal Gateway Operator",
    action: "RATE_LIMIT_ADJUSTED",
    category: "Policy",
    target: "Tenant: OmniLogistics Global - WebSocket Handshake Rate Ceiling",
    tenantId: "tenant-omni-4401",
    tenantName: "OmniLogistics Global",
    result: "Success",
    ip: "10.14.0.52",
    details: "Increased allowed concurrent connection upgrade bursts from 600 to 1200 conn/sec."
  },
  {
    id: "aud-507",
    timestamp: "6 hrs ago",
    isoTimestamp: "2026-10-25T09:44:00Z",
    actor: "marcus.vance@gateway-admin.internal",
    actorRole: "Security Operations Analyst",
    action: "DECOY_TEMPLATE_IMPORT",
    category: "Decoy Scaling",
    target: "FHIR Diagnostic Decoy Profile v2.4 Loaded",
    tenantId: "tenant-medsecure-1022",
    tenantName: "MedSecure Health Net",
    result: "Success",
    ip: "10.14.0.88",
    details: "Imported synthetic HL7 FHIR v4 resource models for enhanced medical API honeypot authenticity."
  },
  {
    id: "aud-508",
    timestamp: "8 hrs ago",
    isoTimestamp: "2026-10-25T07:44:00Z",
    actor: "unauthorized-api-client",
    actorRole: "External Ingress Request",
    action: "ADMIN_POLICY_MUTATION_ATTEMPT",
    category: "Security & Quarantines",
    target: "Cluster Ingress Configuration API (/v1/admin/cluster)",
    tenantId: "all",
    tenantName: "Global Control Plane",
    result: "Denied",
    ip: "203.0.113.199",
    details: "Rejected unauthenticated PUT request attempting to disable deception orchestrator."
  }
];

// --- Threat Investigations Seed Data (Stage 2B.2) ---
export const DEFAULT_INVESTIGATIONS = [
  {
    id: "inv-801",
    tenantId: "tenant-apex-9941",
    tenantName: "Apex FinTech Cloud",
    applicationIds: ["app-03"],
    applicationNames: ["Enterprise Admin Portal"],
    eventIds: ["evt-901", "adm-evt-101"],
    sessionIdentifier: "sess-88f1c-d7",
    profileId: "prof-701",
    firstSeen: "12 mins ago",
    firstSeenIso: "2026-10-25T15:35:00Z",
    lastSeen: "2 mins ago",
    lastSeenIso: "2026-10-25T15:45:00Z",
    severity: "critical",
    status: "Open",
    attackCategory: "Credential Stuffing & Auth Spray",
    observedBehaviorSummary: "High-volume distributed credential rotation targeting administrative token endpoints. Attacker triggered canary credential trap and was isolated inside synthetic auth shadow.",
    assignedAnalyst: "Sarah Chen (Simulated)",
    policyDecision: "Route to Deception Sandbox",
    recordedRoutingOutcome: "Routed to Deception Sandbox",
    policyDiscrepancy: false,
    discrepancyDetails: null,
    behavioralEvidence: [
      {
        id: "ev-801-1",
        indicator: "Burst Authentication Failures",
        observedFact: "140 HTTP POST requests to /manage/v1/auth/token within 60s with dictionary password payloads from IP 198.51.100.44.",
        detectorInterpretation: "Heuristic classifier scored 0.985 confidence: Botnet-driven automated credential rotation.",
        source: "L7 Reverse Proxy Ingress Log",
        count: 140,
        timeRange: "15:40:00 - 15:42:00 UTC"
      },
      {
        id: "ev-801-2",
        indicator: "Canary Credential Interaction",
        observedFact: "Attacker payload included canary token 'CANARY_TOKEN_HASH_#88912' planted in public fake documentation.",
        detectorInterpretation: "Canary Trap Manager confirmed high-interaction tripwire activation.",
        source: "Canary Trap Manager Subsystem",
        count: 1,
        timeRange: "15:41:15 UTC"
      },
      {
        id: "ev-801-3",
        indicator: "Synthetic Decoy Dwell Time",
        observedFact: "Actor maintained active TCP connection with decoy container 'decoy-worker-pod-89b' for 7m 14s.",
        detectorInterpretation: "Deception Orchestrator confirmed active engagement with fabricated JWT secrets.",
        source: "Decoy Runtime Vanguard",
        count: 32,
        timeRange: "15:42:00 - 15:45:00 UTC"
      },
      {
        id: "ev-801-4",
        indicator: "Unusual User-Agent Fingerprint",
        observedFact: "Client submitted header 'python-requests/2.31.0' alternating with raw 'curl/8.1.2'.",
        detectorInterpretation: "Protocol Inspector classified client as scripted automation rather than standard browser.",
        source: "Protocol Inspection Engine",
        count: 140,
        timeRange: "15:40:00 - 15:44:00 UTC"
      }
    ],
    timelineEvents: [
      {
        id: "tl-801-1",
        timestamp: "2026-10-25 15:35:10 UTC",
        eventType: "Reconnaissance Ingress",
        observedBehavior: "GET request to /manage/login checking HTTP status code and response headers.",
        detectionEvidence: "Normal status probe; baseline anomaly score 0.05.",
        policyDecision: "Passthrough (Normal Ingress)",
        routingOutcome: "Routed to Production Origin",
        discrepancyNote: null
      },
      {
        id: "tl-801-2",
        timestamp: "2026-10-25 15:40:02 UTC",
        eventType: "Authentication Spray Burst",
        observedBehavior: "Rapid burst of 140 POST requests with distinct dictionary credentials within 60 seconds.",
        detectionEvidence: "Anomaly Classifier flagged confidence 0.985 (Threshold 0.80).",
        policyDecision: "Route to Deception Sandbox (SEC-AUTH-09)",
        routingOutcome: "Routed to Deception Sandbox",
        discrepancyNote: null
      },
      {
        id: "tl-801-3",
        timestamp: "2026-10-25 15:41:15 UTC",
        eventType: "Canary Token Triggered",
        observedBehavior: "Request body presented CANARY_TOKEN_HASH_#88912 targeting canary endpoint.",
        detectionEvidence: "Deterministic tripwire triggered; 100% confidence malicious reconnaissance.",
        policyDecision: "Lock Session to Sandbox",
        routingOutcome: "Routed to Deception Sandbox",
        discrepancyNote: null
      },
      {
        id: "tl-801-4",
        timestamp: "2026-10-25 15:42:00 UTC",
        eventType: "Synthetic Response Dispatched",
        observedBehavior: "Decoy container served simulated 200 OK with fabricated JWT session key.",
        detectionEvidence: "Attacker accepted token and initiated 32 API queries against synthetic admin routes.",
        policyDecision: "Maintain Sandbox Session",
        routingOutcome: "Routed to Deception Sandbox",
        discrepancyNote: null
      }
    ],
    notes: [
      {
        id: "note-801-1",
        author: "Sarah Chen (Simulated)",
        timestamp: "2026-10-25 15:43:30 UTC",
        content: "Attacker session isolated in canary auth sandbox pod. Decoy JWT keys are actively monitored for downstream usage."
      }
    ]
  },
  {
    id: "inv-802",
    tenantId: "tenant-medsecure-1022",
    tenantName: "MedSecure Health Net",
    applicationIds: ["app-11"],
    applicationNames: ["Patient Records FHIR API"],
    eventIds: ["adm-evt-102"],
    sessionIdentifier: "sess-med-419b-01",
    profileId: "prof-702",
    firstSeen: "32 mins ago",
    firstSeenIso: "2026-10-25T15:15:00Z",
    lastSeen: "19 mins ago",
    lastSeenIso: "2026-10-25T15:28:00Z",
    severity: "critical",
    status: "In Review",
    attackCategory: "BOLA / Horizontal Privilege Escalation",
    observedBehaviorSummary: "Iterative identifier enumeration probing private patient IDs across FHIR resource endpoints. Actor redirected into synthetic patient records database.",
    assignedAnalyst: "Marcus Vance (Simulated)",
    policyDecision: "Route to Synthetic Patient Decoy",
    recordedRoutingOutcome: "Routed to Synthetic Patient Decoy",
    policyDiscrepancy: false,
    discrepancyDetails: null,
    behavioralEvidence: [
      {
        id: "ev-802-1",
        indicator: "Sequential ID Enumeration",
        observedFact: "Client submitted 45 sequential requests from /Patient?_id=1001 to /Patient?_id=1050 in 3 minutes.",
        detectorInterpretation: "API Behavioral Detector scored 0.94 confidence for horizontal Broken Object Level Authorization (BOLA).",
        source: "AI Behavioral Anomaly Classifier",
        count: 45,
        timeRange: "15:20:00 - 15:25:00 UTC"
      },
      {
        id: "ev-802-2",
        indicator: "Synthetic FHIR Decoy Hit",
        observedFact: "Request query string accessed CANARY_PATIENT_1042 synthetic decoy record.",
        detectorInterpretation: "Tripwire activated; confirms systemic enumeration across non-owned healthcare entities.",
        source: "HIPAA Zero-Trust Sandbox Sink",
        count: 1,
        timeRange: "15:25:12 UTC"
      },
      {
        id: "ev-802-3",
        indicator: "Automated Tooling Headers",
        observedFact: "User-Agent header identified as python-urllib3/2.0.4 lacking expected EHR client TLS cert.",
        detectorInterpretation: "Client classified as headless script scraping health records.",
        source: "L7 Reverse Proxy Ingress Filter",
        count: 45,
        timeRange: "15:20:00 - 15:28:00 UTC"
      }
    ],
    timelineEvents: [
      {
        id: "tl-802-1",
        timestamp: "2026-10-25 15:15:00 UTC",
        eventType: "Initial FHIR Query",
        observedBehavior: "GET /api/v4/Patient?_id=1001 with valid test session cookie.",
        detectionEvidence: "Normal single record query; benign classification.",
        policyDecision: "Passthrough",
        routingOutcome: "Routed to Production Origin",
        discrepancyNote: null
      },
      {
        id: "tl-802-2",
        timestamp: "2026-10-25 15:22:10 UTC",
        eventType: "BOLA Traversal Escalation",
        observedBehavior: "Sequential stepping across consecutive integer IDs (1002, 1003, ...).",
        detectionEvidence: "Behavioral classifier detected automated enumeration pattern (Confidence 0.94).",
        policyDecision: "Route to Synthetic Patient Decoy (HIPAA-SEC-04)",
        routingOutcome: "Routed to Synthetic Patient Decoy",
        discrepancyNote: null
      },
      {
        id: "tl-802-3",
        timestamp: "2026-10-25 15:25:00 UTC",
        eventType: "Canary Patient Access",
        observedBehavior: "Targeted synthetic canary patient ID 1042.",
        detectionEvidence: "Canary hit confirmed. High-interaction synthetic FHIR response dispatched.",
        policyDecision: "Contain in Decoy Sandbox",
        routingOutcome: "Routed to Synthetic Patient Decoy",
        discrepancyNote: null
      }
    ],
    notes: [
      {
        id: "note-802-1",
        author: "Marcus Vance (Simulated)",
        timestamp: "2026-10-25 15:27:00 UTC",
        content: "Attacker has scraped 45 synthetic FHIR patient records containing fabricated medical diagnostics. Real patient database untouched."
      }
    ]
  },
  {
    id: "inv-803",
    tenantId: "tenant-omni-4401",
    tenantName: "OmniLogistics Global",
    applicationIds: ["app-21"],
    applicationNames: ["Fleet Dispatch WebSocket"],
    eventIds: ["adm-evt-103"],
    sessionIdentifier: "sess-ws-omni-77a",
    profileId: "prof-703",
    firstSeen: "1 hr ago",
    firstSeenIso: "2026-10-25T14:40:00Z",
    lastSeen: "48 mins ago",
    lastSeenIso: "2026-10-25T14:59:00Z",
    severity: "high",
    status: "Mitigated",
    attackCategory: "Protocol Smuggling & Command Injection",
    observedBehaviorSummary: "Malformed HTTP upgrade packet with embedded CRLF sequences attempting socket pipe takeover on fleet telemetry channel.",
    assignedAnalyst: "Alex Kumar (Simulated)",
    policyDecision: "Route to Deception Sandbox",
    recordedRoutingOutcome: "Routed to Deception Sandbox",
    policyDiscrepancy: false,
    discrepancyDetails: null,
    behavioralEvidence: [
      {
        id: "ev-803-1",
        indicator: "CRLF Header Smuggling",
        observedFact: "HTTP Upgrade request included embedded carriage return / line feed bytes followed by arbitrary host header.",
        detectorInterpretation: "L7 Reverse Proxy parser detected HTTP request smuggling attempt (Confidence 0.92).",
        source: "L7 Reverse Proxy Ingress Filter",
        count: 12,
        timeRange: "14:55:00 - 14:59:00 UTC"
      },
      {
        id: "ev-803-2",
        indicator: "Custom Client Handshake",
        observedFact: "Client User-Agent header was set to 'Custom-WS-Client' and skipped Sec-WebSocket-Key RFC validation.",
        detectorInterpretation: "Protocol Inspector classified handshake as custom exploit tooling.",
        source: "Protocol Inspection Engine",
        count: 12,
        timeRange: "14:56:00 - 14:59:00 UTC"
      }
    ],
    timelineEvents: [
      {
        id: "tl-803-1",
        timestamp: "2026-10-25 14:40:15 UTC",
        eventType: "Initial Fleet Telemetry Handshake",
        observedBehavior: "Standard WebSocket connection request to /v1/telemetry.",
        detectionEvidence: "Valid header format; connection accepted.",
        policyDecision: "Passthrough",
        routingOutcome: "Routed to Production Origin",
        discrepancyNote: null
      },
      {
        id: "tl-803-2",
        timestamp: "2026-10-25 14:55:00 UTC",
        eventType: "CRLF Protocol Smuggling Injection",
        observedBehavior: "Injected newline headers into Upgrade payload targeting socket proxy pipe.",
        detectionEvidence: "Proxy protocol filter flagged invalid header byte sequence.",
        policyDecision: "Route to Deception Sandbox (OMNI-WS-02)",
        routingOutcome: "Routed to Deception Sandbox",
        discrepancyNote: null
      },
      {
        id: "tl-803-3",
        timestamp: "2026-10-25 14:59:00 UTC",
        eventType: "Decoy Echo Session Established",
        observedBehavior: "Client isolated in decoy-ws-sink-04 container; synthetic 101 Switching Protocols returned.",
        detectionEvidence: "Attacker transmitted 12 telemetry control commands into isolated sink without backend effect.",
        policyDecision: "Maintain Sandbox Session",
        routingOutcome: "Routed to Deception Sandbox",
        discrepancyNote: null
      }
    ],
    notes: [
      {
        id: "note-803-1",
        author: "Alex Kumar (Simulated)",
        timestamp: "2026-10-25 15:02:00 UTC",
        content: "Decoy WebSocket container terminated after attacker went silent. Extracted injection signatures added to edge WAF rule set."
      }
    ]
  },
  {
    id: "inv-804",
    tenantId: "tenant-aerodyn-8823",
    tenantName: "AeroDynamics Defence Lab",
    applicationIds: ["app-31"],
    applicationNames: ["Telemetry Ingestion Relay"],
    eventIds: ["adm-evt-104"],
    sessionIdentifier: "sess-apt-993-x",
    profileId: "prof-704",
    firstSeen: "1.5 hrs ago",
    firstSeenIso: "2026-10-25T14:20:00Z",
    lastSeen: "1 hr ago",
    lastSeenIso: "2026-10-25T14:45:00Z",
    severity: "critical",
    status: "In Review",
    attackCategory: "Classified APT Reconnaissance",
    observedBehaviorSummary: "Binary byte sequence probe matching nation-state threat signature SIG-APT-DEF-88 against defense sensor stream. Policy selected honeynet diversion, but edge relay enforced immediate air-gap block.",
    assignedAnalyst: "Sarah Chen (Simulated)",
    policyDecision: "Route to High-Interaction Deception Mesh",
    recordedRoutingOutcome: "Blocked at Gateway Edge",
    policyDiscrepancy: true,
    discrepancyDetails: "Policy Engine selected diversion to High-Interaction Honeynet container, but Edge Ingress Relay enforced immediate TCP Reset (Block) due to classified air-gap isolation trigger before honeynet pod handoff.",
    behavioralEvidence: [
      {
        id: "ev-804-1",
        indicator: "Nation-State Threat Signature Match",
        observedFact: "Ingress byte stream at /telemetry/v1/sync contained exact match for binary signature SIG-APT-DEF-88.",
        detectorInterpretation: "Classified Threat Intelligence Classifier scored 0.999 confidence: APT nation-state probe.",
        source: "Classified Threat Intelligence DB",
        count: 1,
        timeRange: "14:44:10 UTC"
      },
      {
        id: "ev-804-2",
        indicator: "Spoofed Protocol Framing",
        observedFact: "TCP packet sequence contained non-standard TCP options header with military avionics framing markers.",
        detectorInterpretation: "Hardware eBPF filter flagged proprietary telemetry emulation attempt.",
        source: "Hardware Accelerated eBPF Filter",
        count: 48,
        timeRange: "14:20:00 - 14:45:00 UTC"
      }
    ],
    timelineEvents: [
      {
        id: "tl-804-1",
        timestamp: "2026-10-25 14:20:00 UTC",
        eventType: "Initial Ingress Sync Probe",
        observedBehavior: "SYN packet with experimental TCP option headers targeting port 443.",
        detectionEvidence: "Protocol irregularity detected; placed in observation queue.",
        policyDecision: "Monitor Only",
        routingOutcome: "Routed to Production Origin",
        discrepancyNote: null
      },
      {
        id: "tl-804-2",
        timestamp: "2026-10-25 14:44:10 UTC",
        eventType: "Binary Signature Match (APT)",
        observedBehavior: "POST /telemetry/v1/sync delivering binary payload matching SIG-APT-DEF-88.",
        detectionEvidence: "Deterministic match with nation-state signature (Confidence 0.999).",
        policyDecision: "Route to High-Interaction Deception Mesh (DEF-APT-01)",
        routingOutcome: "Blocked at Gateway Edge",
        discrepancyNote: "Discrepancy: Policy designated Honeynet routing, but Edge Ingress Relay triggered immediate TCP Reset (Air-Gap Protection Protocol)."
      }
    ],
    notes: [
      {
        id: "note-804-1",
        author: "Sarah Chen (Simulated)",
        timestamp: "2026-10-25 14:48:00 UTC",
        content: "Air-gap safety interlock engaged. Edge relay dropped connection rather than forwarding to honeynet pod because sovereign isolation tier mandates fail-closed on SIG-APT-DEF signatures."
      }
    ]
  },
  {
    id: "inv-805",
    tenantId: "tenant-apex-9941",
    tenantName: "Apex FinTech Cloud",
    applicationIds: ["app-01", "app-02"],
    applicationNames: ["Customer Accounts API", "Payment Settlement Core"],
    eventIds: ["evt-902", "evt-903"],
    sessionIdentifier: "sess-sql-281-a",
    profileId: "prof-705",
    firstSeen: "42 mins ago",
    firstSeenIso: "2026-10-25T15:05:00Z",
    lastSeen: "17 mins ago",
    lastSeenIso: "2026-10-25T15:30:00Z",
    severity: "medium",
    status: "Open",
    attackCategory: "SQL Injection & SSRF Probing",
    observedBehaviorSummary: "Multi-endpoint reconnaissance probing query parameters for SQL tautology syntax and AWS metadata IP callback addresses across accounts and payment endpoints.",
    assignedAnalyst: "Unassigned",
    policyDecision: "Deceptive Delay & Canary Injection",
    recordedRoutingOutcome: "Routed to Deception Sandbox",
    policyDiscrepancy: false,
    discrepancyDetails: null,
    behavioralEvidence: [
      {
        id: "ev-805-1",
        indicator: "SQL Tautology Payload",
        observedFact: "Query parameter 'id=1%20OR%201=1--' passed to /v2/users from IP 203.0.113.89.",
        detectorInterpretation: "Signature match with known sqlmap automated injection tool syntax.",
        source: "AI Behavioral Anomaly Classifier",
        count: 6,
        timeRange: "15:28:00 - 15:30:00 UTC"
      },
      {
        id: "ev-805-2",
        indicator: "SSRF Link-Local Callback",
        observedFact: "POST webhook parameter contained link-local IP 169.254.169.254 targeting cloud IAM credentials.",
        detectorInterpretation: "Cloud metadata exfiltration signature confirmed (Confidence 0.96).",
        source: "L7 Reverse Proxy Ingress Filter",
        count: 2,
        timeRange: "15:10:00 - 15:12:00 UTC"
      }
    ],
    timelineEvents: [
      {
        id: "tl-805-1",
        timestamp: "2026-10-25 15:10:00 UTC",
        eventType: "SSRF Parameter Injected",
        observedBehavior: "Callback parameter directed to 169.254.169.254/latest/meta-data/.",
        detectionEvidence: "Cloud metadata probe detected.",
        policyDecision: "Redirect to Canary Sink (SEC-SSRF-01)",
        routingOutcome: "Routed to Deception Sandbox",
        discrepancyNote: null
      },
      {
        id: "tl-805-2",
        timestamp: "2026-10-25 15:30:00 UTC",
        eventType: "SQL Injection Probe",
        observedBehavior: "Tautology query parameter passed to Customer Accounts API.",
        detectionEvidence: "Sqlmap pattern match; synthetic DB error returned with 1200ms delay.",
        policyDecision: "Deceptive Delay & Canary Injection",
        routingOutcome: "Routed to Deception Sandbox",
        discrepancyNote: null
      }
    ],
    notes: [
      {
        id: "note-805-1",
        author: "Alex Kumar (Simulated)",
        timestamp: "2026-10-25 15:32:00 UTC",
        content: "Attacker probing multiple Apex FinTech endpoints in sequence. Deceptive latency injection successfully slowed automated scanner throughput by 84%."
      }
    ]
  },
  {
    id: "inv-806",
    tenantId: "tenant-nexushub-3319",
    tenantName: "NexusHub SaaS Ecosystem",
    applicationIds: ["app-41"],
    applicationNames: ["Developer API Mesh"],
    eventIds: [],
    sessionIdentifier: "sess-scan-pub-09",
    profileId: "prof-706",
    firstSeen: "3 hrs ago",
    firstSeenIso: "2026-10-25T13:00:00Z",
    lastSeen: "2.7 hrs ago",
    lastSeenIso: "2026-10-25T13:15:00Z",
    severity: "low",
    status: "Closed",
    attackCategory: "Automated Vulnerability Scanner Probe",
    observedBehaviorSummary: "High-frequency public crawler probing GraphQL introspection endpoints without valid tenant API credentials.",
    assignedAnalyst: "Automated Gateway Bot",
    policyDecision: "Rate Limit Only",
    recordedRoutingOutcome: "Not Recorded",
    policyDiscrepancy: false,
    discrepancyDetails: "Ingress proxy ephemeral buffer was flushed before routing confirmation packet was written to long-term storage.",
    behavioralEvidence: [
      {
        id: "ev-806-1",
        indicator: "Schema Introspection Probe",
        observedFact: "High-frequency POST queries requesting __schema and __type definitions.",
        detectorInterpretation: "Standard automated reconnaissance; benign crawler or unauthenticated scanner.",
        source: "GraphQL Schema Filter",
        count: 310,
        timeRange: "13:00:00 - 13:15:00 UTC"
      }
    ],
    timelineEvents: [
      {
        id: "tl-806-1",
        timestamp: "2026-10-25 13:00:00 UTC",
        eventType: "Schema Introspection Attempt",
        observedBehavior: "POST /graphql with __schema query.",
        detectionEvidence: "Public schema probe; rate limit threshold approaching.",
        policyDecision: "Rate Limit Only",
        routingOutcome: "Not Recorded",
        discrepancyNote: null
      }
    ],
    notes: [
      {
        id: "note-806-1",
        author: "Automated Gateway Bot",
        timestamp: "2026-10-25 13:16:00 UTC",
        content: "Automated crawler ceased requests following 429 Too Many Requests response. Incident closed automatically."
      }
    ]
  }
];

// --- Attacker Behavior Profiles Seed Data (Stage 2B.2) ---
export const DEFAULT_ATTACKER_PROFILES = [
  {
    id: "prof-701",
    sessionIdentifiers: ["sess-88f1c-d7", "sess-88f1c-e2"],
    tenantId: "tenant-apex-9941",
    tenantName: "Apex FinTech Cloud",
    applicationIds: ["app-03", "app-01"],
    applicationNames: ["Enterprise Admin Portal", "Customer Accounts API"],
    firstSeen: "45 mins ago",
    firstSeenIso: "2026-10-25T15:00:00Z",
    lastSeen: "2 mins ago",
    lastSeenIso: "2026-10-25T15:45:00Z",
    observedRequestCount: 342,
    observedAuthFailures: 140,
    distinctEndpointCount: 5,
    associatedEventCount: 2,
    decoyInteractionCount: 14,
    behavioralClassification: "Decoy interaction observed",
    behavioralIndicators: [
      {
        indicator: "High-frequency dictionary credential spray",
        supportingObservations: "Submitted 140 password variants to administrative auth endpoint in 60s.",
        observationCount: 140,
        timeRange: "15:40:00 - 15:42:00 UTC"
      },
      {
        indicator: "Canary credential trigger",
        supportingObservations: "Presented canary JWT hash CANARY_TOKEN_HASH_#88912 harvested from decoy documentation.",
        observationCount: 1,
        timeRange: "15:41:15 UTC"
      },
      {
        indicator: "Decoy container engagement",
        supportingObservations: "Maintained active session with decoy-worker-pod-89b for 7m 14s.",
        observationCount: 32,
        timeRange: "15:42:00 - 15:45:00 UTC"
      }
    ],
    linkedInvestigationIds: ["inv-801"],
    associatedEventIds: ["evt-901", "adm-evt-101"],
    behaviorHistory: [
      {
        timestamp: "2026-10-25 15:00:00 UTC",
        phase: "Initial Endpoint Discovery",
        observation: "Crawled public login pages and HTTP headers with python-requests tool."
      },
      {
        timestamp: "2026-10-25 15:40:00 UTC",
        phase: "Automated Credential Spray",
        observation: "Shifted to dictionary attack against administrative token endpoint."
      },
      {
        timestamp: "2026-10-25 15:42:00 UTC",
        phase: "Synthetic Decoy Containment",
        observation: "Rerouted to fake auth shadow container; engaged with fabricated credentials."
      }
    ],
    deceptionInteractions: [
      {
        timestamp: "2026-10-25 15:42:00 UTC",
        decoyType: "Fake Admin Auth API Sandbox",
        targetEndpoint: "/manage/v1/auth/token",
        canaryHit: "CANARY_TOKEN_HASH_#88912",
        dwellTime: "7m 14s",
        actionsLogged: 32,
        fakeResponseStatus: "200 OK (Fabricated Session Key Returned)"
      },
      {
        timestamp: "2026-10-25 15:43:45 UTC",
        decoyType: "Simulated Tenant Management Microservice",
        targetEndpoint: "/manage/v1/tenants/list",
        canaryHit: "None (Internal Decoy Route)",
        dwellTime: "2m 10s",
        actionsLogged: 8,
        fakeResponseStatus: "200 OK (Synthetic Tenant Schemas)"
      }
    ]
  },
  {
    id: "prof-702",
    sessionIdentifiers: ["sess-med-419b-01"],
    tenantId: "tenant-medsecure-1022",
    tenantName: "MedSecure Health Net",
    applicationIds: ["app-11"],
    applicationNames: ["Patient Records FHIR API"],
    firstSeen: "35 mins ago",
    firstSeenIso: "2026-10-25T15:10:00Z",
    lastSeen: "19 mins ago",
    lastSeenIso: "2026-10-25T15:28:00Z",
    observedRequestCount: 184,
    observedAuthFailures: 38,
    distinctEndpointCount: 12,
    associatedEventCount: 1,
    decoyInteractionCount: 8,
    behavioralClassification: "Repeated authentication failures",
    behavioralIndicators: [
      {
        indicator: "Sequential BOLA patient ID scraping",
        supportingObservations: "45 sequential integer queries from /Patient?_id=1001 to 1050.",
        observationCount: 45,
        timeRange: "15:20:00 - 15:25:00 UTC"
      },
      {
        indicator: "Expired token reuse",
        supportingObservations: "38 requests presented expired test bearer tokens attempting replay attacks.",
        observationCount: 38,
        timeRange: "15:12:00 - 15:18:00 UTC"
      }
    ],
    linkedInvestigationIds: ["inv-802"],
    associatedEventIds: ["adm-evt-102"],
    behaviorHistory: [
      {
        timestamp: "2026-10-25 15:10:00 UTC",
        phase: "Token Replay Probing",
        observation: "Attempted replay of expired authentication headers across EHR routes."
      },
      {
        timestamp: "2026-10-25 15:20:00 UTC",
        phase: "Horizontal Object ID Traversal",
        observation: "Systematic enumeration of sequential patient record identifiers."
      }
    ],
    deceptionInteractions: [
      {
        timestamp: "2026-10-25 15:25:00 UTC",
        decoyType: "Synthetic FHIR Decoy Sandbox",
        targetEndpoint: "/api/v4/Patient?_id=1042",
        canaryHit: "CANARY_PATIENT_1042",
        dwellTime: "9m 40s",
        actionsLogged: 45,
        fakeResponseStatus: "200 OK (Generated Synthetic Records)"
      }
    ]
  },
  {
    id: "prof-703",
    sessionIdentifiers: ["sess-ws-omni-77a"],
    tenantId: "tenant-omni-4401",
    tenantName: "OmniLogistics Global",
    applicationIds: ["app-21"],
    applicationNames: ["Fleet Dispatch WebSocket"],
    firstSeen: "1.2 hrs ago",
    firstSeenIso: "2026-10-25T14:30:00Z",
    lastSeen: "48 mins ago",
    lastSeenIso: "2026-10-25T14:59:00Z",
    observedRequestCount: 96,
    observedAuthFailures: 0,
    distinctEndpointCount: 3,
    associatedEventCount: 1,
    decoyInteractionCount: 4,
    behavioralClassification: "Multiple suspicious indicators",
    behavioralIndicators: [
      {
        indicator: "HTTP CRLF header smuggling",
        supportingObservations: "Injected carriage-return and line-feed bytes into WebSocket Upgrade header.",
        observationCount: 12,
        timeRange: "14:55:00 - 14:59:00 UTC"
      },
      {
        indicator: "Non-standard WebSocket client headers",
        supportingObservations: "Custom-WS-Client omitted RFC required Sec-WebSocket-Key headers.",
        observationCount: 12,
        timeRange: "14:56:00 - 14:59:00 UTC"
      }
    ],
    linkedInvestigationIds: ["inv-803"],
    associatedEventIds: ["adm-evt-103"],
    behaviorHistory: [
      {
        timestamp: "2026-10-25 14:30:00 UTC",
        phase: "Normal Telemetry Stream",
        observation: "Clean telemetry frames submitted via standard client connection."
      },
      {
        timestamp: "2026-10-25 14:55:00 UTC",
        phase: "Protocol Smuggling Attempt",
        observation: "Injected malformed CRLF sequences to bypass proxy validation."
      }
    ],
    deceptionInteractions: [
      {
        timestamp: "2026-10-25 14:59:00 UTC",
        decoyType: "Mock WebSocket Echo Server",
        targetEndpoint: "/v1/telemetry/ws",
        canaryHit: "None (Protocol Signature)",
        dwellTime: "4m 10s",
        actionsLogged: 12,
        fakeResponseStatus: "101 Switching Protocols (Isolated Decoy)"
      }
    ]
  },
  {
    id: "prof-704",
    sessionIdentifiers: ["sess-apt-993-x"],
    tenantId: "tenant-aerodyn-8823",
    tenantName: "AeroDynamics Defence Lab",
    applicationIds: ["app-31"],
    applicationNames: ["Telemetry Ingestion Relay"],
    firstSeen: "1.5 hrs ago",
    firstSeenIso: "2026-10-25T14:20:00Z",
    lastSeen: "1 hr ago",
    lastSeenIso: "2026-10-25T14:45:00Z",
    observedRequestCount: 48,
    observedAuthFailures: 0,
    distinctEndpointCount: 2,
    associatedEventCount: 1,
    decoyInteractionCount: 0,
    behavioralClassification: "Reconnaissance-like behavior",
    behavioralIndicators: [
      {
        indicator: "Classified binary signature match",
        supportingObservations: "Payload matched classified nation-state scanning pattern SIG-APT-DEF-88.",
        observationCount: 1,
        timeRange: "14:44:10 UTC"
      },
      {
        indicator: "Non-standard TCP options framing",
        supportingObservations: "Raw TCP SYN packets contained non-standard TCP option bytes.",
        observationCount: 48,
        timeRange: "14:20:00 - 14:45:00 UTC"
      }
    ],
    linkedInvestigationIds: ["inv-804"],
    associatedEventIds: ["adm-evt-104"],
    behaviorHistory: [
      {
        timestamp: "2026-10-25 14:20:00 UTC",
        phase: "Stealth SYN Fingerprinting",
        observation: "Probed edge ingress ports with non-standard TCP options."
      },
      {
        timestamp: "2026-10-25 14:44:00 UTC",
        phase: "Targeted Payload Delivery",
        observation: "Delivered binary probe; connection immediately reset by air-gap fail-safe."
      }
    ],
    deceptionInteractions: []
  },
  {
    id: "prof-705",
    sessionIdentifiers: ["sess-sql-281-a"],
    tenantId: "tenant-apex-9941",
    tenantName: "Apex FinTech Cloud",
    applicationIds: ["app-01", "app-02"],
    applicationNames: ["Customer Accounts API", "Payment Settlement Core"],
    firstSeen: "45 mins ago",
    firstSeenIso: "2026-10-25T15:00:00Z",
    lastSeen: "17 mins ago",
    lastSeenIso: "2026-10-25T15:30:00Z",
    observedRequestCount: 125,
    observedAuthFailures: 4,
    distinctEndpointCount: 7,
    associatedEventCount: 2,
    decoyInteractionCount: 6,
    behavioralClassification: "Multiple suspicious indicators",
    behavioralIndicators: [
      {
        indicator: "Automated SQL injection scanning",
        supportingObservations: "Sqlmap signature detected probing tautology conditions on /v2/users.",
        observationCount: 6,
        timeRange: "15:28:00 - 15:30:00 UTC"
      },
      {
        indicator: "SSRF cloud metadata callback",
        supportingObservations: "Attempted callback to 169.254.169.254 AWS metadata address.",
        observationCount: 2,
        timeRange: "15:10:00 - 15:12:00 UTC"
      }
    ],
    linkedInvestigationIds: ["inv-805"],
    associatedEventIds: ["evt-902", "evt-903"],
    behaviorHistory: [
      {
        timestamp: "2026-10-25 15:00:00 UTC",
        phase: "Broad Ingress Crawling",
        observation: "Scanned checkout and accounts endpoints looking for webhook callback parameters."
      },
      {
        timestamp: "2026-10-25 15:28:00 UTC",
        phase: "SQL Injection Probing",
        observation: "Injected tautology queries; slowed by synthetic latency sandbox."
      }
    ],
    deceptionInteractions: [
      {
        timestamp: "2026-10-25 15:12:00 UTC",
        decoyType: "Synthetic AWS IMDSv2 Decoy",
        targetEndpoint: "/checkout/webhook",
        canaryHit: "CANARY_IAM_ROLE_FAKE_ADMIN",
        dwellTime: "5m 02s",
        actionsLogged: 9,
        fakeResponseStatus: "200 OK (Dispatched Canary AWS Access Keys)"
      },
      {
        timestamp: "2026-10-25 15:30:00 UTC",
        decoyType: "Synthetic PostgreSQL 14 Trap",
        targetEndpoint: "/v2/users",
        canaryHit: "None (Pattern Match)",
        dwellTime: "1m 18s",
        actionsLogged: 6,
        fakeResponseStatus: "500 Internal Error (Fake PG Stack Trace)"
      }
    ]
  },
  {
    id: "prof-706",
    sessionIdentifiers: ["sess-scan-pub-09"],
    tenantId: "tenant-nexushub-3319",
    tenantName: "NexusHub SaaS Ecosystem",
    applicationIds: ["app-41"],
    applicationNames: ["Developer API Mesh"],
    firstSeen: "3 hrs ago",
    firstSeenIso: "2026-10-25T13:00:00Z",
    lastSeen: "2.7 hrs ago",
    lastSeenIso: "2026-10-25T13:15:00Z",
    observedRequestCount: 310,
    observedAuthFailures: 0,
    distinctEndpointCount: 18,
    associatedEventCount: 0,
    decoyInteractionCount: 0,
    behavioralClassification: "Unclassified",
    behavioralIndicators: [
      {
        indicator: "Broad-spectrum public endpoint spidering",
        supportingObservations: "Crawled 18 distinct public API routes requesting GraphQL schema definitions.",
        observationCount: 310,
        timeRange: "13:00:00 - 13:15:00 UTC"
      }
    ],
    linkedInvestigationIds: ["inv-806"],
    associatedEventIds: [],
    behaviorHistory: [
      {
        timestamp: "2026-10-25 13:00:00 UTC",
        phase: "Automated Crawling",
        observation: "High-frequency unauthenticated spider probing GraphQL schemas."
      }
    ],
    deceptionInteractions: []
  }
];

// --- Storage Accessors & Local Persistence Layer ---

function getStoredApps() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_APPS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn("Could not read stored applications, using defaults", e);
  }
  return DEFAULT_APPLICATIONS;
}

function setStoredApps(apps) {
  try {
    localStorage.setItem(STORAGE_KEY_APPS, JSON.stringify(apps));
  } catch (e) {
    console.warn("Could not persist applications", e);
  }
}

function getStoredTenants() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TENANTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn("Could not read stored tenants, using defaults", e);
  }
  return DEFAULT_TENANTS;
}

function getStoredInvestigations() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_INVESTIGATIONS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn("Could not read stored investigations, using defaults", e);
  }
  return DEFAULT_INVESTIGATIONS;
}

function setStoredInvestigations(investigations) {
  try {
    localStorage.setItem(STORAGE_KEY_INVESTIGATIONS, JSON.stringify(investigations));
  } catch (e) {
    console.warn("Could not persist investigations", e);
  }
}

function getStoredProfiles() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROFILES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn("Could not read stored attacker profiles, using defaults", e);
  }
  return DEFAULT_ATTACKER_PROFILES;
}

function setStoredProfiles(profiles) {
  try {
    localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(profiles));
  } catch (e) {
    console.warn("Could not persist attacker profiles", e);
  }
}

// --- Public Service Methods for Tenants (Stage 2B.1) ---

export const getTenants = async (filters = {}) => {
  let list = [...getStoredTenants()];

  if (filters.search) {
    const q = filters.search.toLowerCase().trim();
    list = list.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q) ||
      t.tier.toLowerCase().includes(q) ||
      t.contactEmail.toLowerCase().includes(q) ||
      (t.description && t.description.toLowerCase().includes(q))
    );
  }

  if (filters.status && filters.status !== 'all') {
    list = list.filter(t => t.status === filters.status);
  }

  if (filters.tier && filters.tier !== 'all') {
    list = list.filter(t => t.tier === filters.tier);
  }

  return list;
};

export const getTenantById = async (id) => {
  const tenants = getStoredTenants();
  return tenants.find(t => t.id === id) || null;
};

export const getTenantApplications = async (tenantId) => {
  const apps = getStoredApps();
  return apps.filter(a => a.tenantId === tenantId);
};

export const getTenantEvents = async (tenantId) => {
  return DEFAULT_SECURITY_EVENTS.filter(e => e.tenantId === tenantId);
};

export const getTenantAuditEvents = async (tenantId) => {
  return DEFAULT_AUDIT_LOGS.filter(a => a.tenantId === tenantId || a.tenantId === 'all');
};

// --- Public Service Methods for Health & Audit Logs (Stage 2B.1) ---

export const getGatewayHealthComponents = async () => {
  return [...DEFAULT_COMPONENT_HEALTH];
};

export const getPlatformAuditLogs = async (filters = {}) => {
  let list = [...DEFAULT_AUDIT_LOGS];

  if (filters.search) {
    const q = filters.search.toLowerCase().trim();
    list = list.filter(a =>
      a.id.toLowerCase().includes(q) ||
      a.actor.toLowerCase().includes(q) ||
      a.action.toLowerCase().includes(q) ||
      a.target.toLowerCase().includes(q) ||
      a.tenantName.toLowerCase().includes(q) ||
      a.details.toLowerCase().includes(q)
    );
  }

  if (filters.category && filters.category !== 'all') {
    list = list.filter(a => a.category === filters.category);
  }

  if (filters.result && filters.result !== 'all') {
    list = list.filter(a => a.result === filters.result);
  }

  if (filters.tenantId && filters.tenantId !== 'all') {
    list = list.filter(a => a.tenantId === filters.tenantId || a.tenantId === 'all');
  }

  return list;
};

// --- Public Service Methods for Threat Investigations (Stage 2B.2) ---

export const getInvestigations = async (filters = {}) => {
  let list = [...getStoredInvestigations()];

  if (filters.search) {
    const q = filters.search.toLowerCase().trim();
    list = list.filter(inv =>
      inv.id.toLowerCase().includes(q) ||
      inv.tenantName.toLowerCase().includes(q) ||
      inv.sessionIdentifier.toLowerCase().includes(q) ||
      inv.attackCategory.toLowerCase().includes(q) ||
      (inv.applicationNames && inv.applicationNames.some(name => name.toLowerCase().includes(q))) ||
      inv.observedBehaviorSummary.toLowerCase().includes(q)
    );
  }

  if (filters.severity && filters.severity !== 'all') {
    list = list.filter(inv => inv.severity === filters.severity);
  }

  if (filters.status && filters.status !== 'all') {
    list = list.filter(inv => inv.status === filters.status);
  }

  if (filters.tenantId && filters.tenantId !== 'all') {
    list = list.filter(inv => inv.tenantId === filters.tenantId);
  }

  // Sorting
  const sortBy = filters.sortBy || 'activity-desc';
  const severityRank = { critical: 4, high: 3, medium: 2, low: 1 };
  list.sort((a, b) => {
    if (sortBy === 'severity-desc') {
      const diff = (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0);
      if (diff !== 0) return diff;
      return new Date(b.lastSeenIso) - new Date(a.lastSeenIso);
    }
    if (sortBy === 'activity-desc') {
      return new Date(b.lastSeenIso) - new Date(a.lastSeenIso);
    }
    if (sortBy === 'firstseen-asc') {
      return new Date(a.firstSeenIso) - new Date(b.firstSeenIso);
    }
    if (sortBy === 'firstseen-desc') {
      return new Date(b.firstSeenIso) - new Date(a.firstSeenIso);
    }
    return 0;
  });

  return list;
};

export const getInvestigationById = async (id) => {
  const list = getStoredInvestigations();
  return list.find(inv => inv.id === id) || null;
};

export const addInvestigationNote = async (investigationId, noteData) => {
  const list = getStoredInvestigations();
  const index = list.findIndex(inv => inv.id === investigationId);
  if (index === -1) {
    throw new Error(`Investigation ${investigationId} not found`);
  }

  const existingNotes = list[index].notes || [];
  const newNote = {
    id: `note-${Date.now()}`,
    author: noteData.author || "Security Analyst (Simulated)",
    timestamp: new Date().toISOString(),
    content: noteData.content.trim()
  };

  const updatedInv = {
    ...list[index],
    notes: [newNote, ...existingNotes]
  };

  list[index] = updatedInv;
  setStoredInvestigations(list);
  return updatedInv;
};

// --- Public Service Methods for Attacker Behavior Profiles (Stage 2B.2) ---

export const getAttackerProfiles = async (filters = {}) => {
  let list = [...getStoredProfiles()];

  if (filters.search) {
    const q = filters.search.toLowerCase().trim();
    list = list.filter(p =>
      p.id.toLowerCase().includes(q) ||
      (p.sessionIdentifiers && p.sessionIdentifiers.some(s => s.toLowerCase().includes(q))) ||
      p.tenantName.toLowerCase().includes(q) ||
      p.behavioralClassification.toLowerCase().includes(q) ||
      (p.applicationNames && p.applicationNames.some(name => name.toLowerCase().includes(q)))
    );
  }

  if (filters.tenantId && filters.tenantId !== 'all') {
    list = list.filter(p => p.tenantId === filters.tenantId);
  }

  if (filters.classification && filters.classification !== 'all') {
    list = list.filter(p => p.behavioralClassification === filters.classification);
  }

  const sortBy = filters.sortBy || 'activity-desc';
  list.sort((a, b) => {
    if (sortBy === 'activity-desc') {
      return new Date(b.lastSeenIso) - new Date(a.lastSeenIso);
    }
    if (sortBy === 'events-desc') {
      return (b.associatedEventCount || 0) - (a.associatedEventCount || 0);
    }
    if (sortBy === 'requests-desc') {
      return (b.observedRequestCount || 0) - (a.observedRequestCount || 0);
    }
    if (sortBy === 'decoys-desc') {
      return (b.decoyInteractionCount || 0) - (a.decoyInteractionCount || 0);
    }
    return 0;
  });

  return list;
};

export const getAttackerProfileById = async (id) => {
  const list = getStoredProfiles();
  return list.find(p => p.id === id) || null;
};

// --- Public Service Methods for Applications (Owner Portal) ---

export const getApplications = async () => {
  return [...getStoredApps()];
};

export const getApplicationById = async (id) => {
  const apps = getStoredApps();
  return apps.find(a => a.id === id) || null;
};

export const createApplication = async (newAppData) => {
  const apps = getStoredApps();
  const nextNumber = apps.length + 1;
  const newApp = {
    ...newAppData,
    id: `app-${String(nextNumber).padStart(2, '0')}`,
    tenantId: newAppData.tenantId || "tenant-apex-9941",
    tenantName: newAppData.tenantName || "Apex FinTech Cloud",
    status: newAppData.status || "shielded",
    requestsPerSec: 0,
    requestVolume: "0 reqs/day",
    threatCount: 0,
    threatIndex: "Low",
    activeDecoys: newAppData.protectionMode === "Monitoring Only" ? 0 : 2,
    lastActivity: "Just registered",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    cnameTarget: "cname.gateway.apexfintech.internal",
    upstreamUrl: `https://${newAppData.domain}`
  };
  const updated = [newApp, ...apps];
  setStoredApps(updated);
  return newApp;
};

export const updateApplication = async (id, patchData) => {
  const apps = getStoredApps();
  const index = apps.findIndex(a => a.id === id);
  if (index === -1) {
    throw new Error(`Application ${id} not found.`);
  }
  const updatedApp = {
    ...apps[index],
    ...patchData,
    updatedAt: new Date().toISOString()
  };
  apps[index] = updatedApp;
  setStoredApps(apps);
  return updatedApp;
};

export const deleteApplication = async (id) => {
  const apps = getStoredApps();
  const filtered = apps.filter(a => a.id !== id);
  setStoredApps(filtered);
  return true;
};

// --- Public Service Methods for Security Events ---

export const getSecurityEvents = async (filters = {}) => {
  let list = [...DEFAULT_SECURITY_EVENTS];

  if (filters.applicationId && filters.applicationId !== 'all') {
    list = list.filter(e => e.applicationId === filters.applicationId);
  }
  if (filters.tenantId && filters.tenantId !== 'all') {
    list = list.filter(e => e.tenantId === filters.tenantId);
  }
  if (filters.severity && filters.severity !== 'all') {
    list = list.filter(e => e.severity === filters.severity);
  }
  if (filters.category && filters.category !== 'all') {
    list = list.filter(e => e.category === filters.category);
  }
  if (filters.routingOutcome && filters.routingOutcome !== 'all') {
    list = list.filter(e => e.routingOutcome === filters.routingOutcome);
  }
  if (filters.search) {
    const q = filters.search.toLowerCase().trim();
    list = list.filter(e =>
      e.id.toLowerCase().includes(q) ||
      e.sourceIp.toLowerCase().includes(q) ||
      e.vector.toLowerCase().includes(q) ||
      e.application.toLowerCase().includes(q) ||
      e.details.toLowerCase().includes(q)
    );
  }

  return list;
};

export const getSecurityEventById = async (id) => {
  const event = DEFAULT_SECURITY_EVENTS.find(e => e.id === id);
  return event || null;
};

export const getApplicationTraffic = async (appId) => {
  return [
    { time: "00:00", requests: 12000, diverted: 35, blocked: 8 },
    { time: "03:00", requests: 8400, diverted: 22, blocked: 4 },
    { time: "06:00", requests: 11200, diverted: 30, blocked: 9 },
    { time: "09:00", requests: 28500, diverted: 92, blocked: 34 },
    { time: "12:00", requests: 36800, diverted: 115, blocked: 26 },
    { time: "15:00", requests: 41200, diverted: 124, blocked: 38 },
    { time: "18:00", requests: 31400, diverted: 84, blocked: 21 },
    { time: "21:00", requests: 19800, diverted: 54, blocked: 18 }
  ];
};

// --- Public Service Methods for Settings ---

function getStoredSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn("Could not read stored settings, using defaults", e);
  }
  return DEFAULT_OWNER_SETTINGS;
}

function setStoredSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  } catch (e) {
    console.warn("Could not persist settings", e);
  }
}

export const getOwnerSettings = async () => {
  return getStoredSettings();
};

export const updateOwnerSettings = async (patch) => {
  const current = getStoredSettings();
  const merged = {
    ...current,
    ...patch,
    organization: { ...current.organization, ...(patch.organization || {}) },
    displayPreferences: { ...current.displayPreferences, ...(patch.displayPreferences || {}) },
    notificationPreferences: { ...current.notificationPreferences, ...(patch.notificationPreferences || {}) }
  };
  setStoredSettings(merged);
  return merged;
};

export const DEFAULT_OWNER_SETTINGS = {
  organization: {
    tenantName: "Apex FinTech Cloud",
    tenantId: "tenant-apex-9941",
    contactEmail: "security-ops@apexfintech.io",
    environmentTier: "Enterprise Shield Tier",
    timezone: "UTC (Coordinated Universal Time)",
    dataResidency: "United States (US-East / US-West)"
  },
  displayPreferences: {
    defaultTimeRange: "24h",
    rowDensity: "compact",
    autoRefreshInterval: 30,
    showCanaryDetails: true
  },
  notificationPreferences: {
    emailAlertsCritical: true,
    emailAlertsHigh: true,
    honeynetTriggerDigest: true,
    webhookAlertsEnabled: false,
    webhookEndpoint: "https://siem.apexfintech.internal/webhooks/deception-events"
  },
  teamMembers: [
    {
      id: "tm-1",
      name: "Alex Vance",
      email: "alex.vance@apexfintech.io",
      role: "Security Principal (Owner)",
      status: "Active",
      lastLogin: "Active Now"
    },
    {
      id: "tm-2",
      name: "Elena Rostova",
      email: "elena.r@apexfintech.io",
      role: "Lead Cloud Architect",
      status: "Active",
      lastLogin: "2 hours ago"
    },
    {
      id: "tm-3",
      name: "David Kim",
      email: "david.kim@apexfintech.io",
      role: "DevOps / SRE Engineer",
      status: "Active",
      lastLogin: "Yesterday"
    },
    {
      id: "tm-4",
      name: "Priya Patel",
      email: "priya.p@apexfintech.io",
      role: "Incident Responder",
      status: "Invited (Simulated)",
      lastLogin: "Never"
    }
  ]
};

// --- Backward Compatible Overview Accessor for Stage 1 Owner Overview ---
export const ownerSummaryMetrics = {
  reportingPeriod: "Last 24 Hours",
  tenantName: "Apex FinTech Cloud",
  totalApplications: {
    value: 6,
    subtext: "All 6 active with deception decoys enabled",
    trend: "+1 this month"
  },
  requestsProcessed: {
    value: "1,428,950",
    numeric: 1428950,
    subtext: "Avg 992 req/sec across all routes",
    trend: "+8.4% vs yesterday"
  },
  threatsDetected: {
    value: "3,842",
    numeric: 3842,
    subtext: "0.27% of total ingress requests",
    trend: "-3.2% vs yesterday"
  },
  deceptionActions: {
    diverted: "1,289",
    divertedNumeric: 1289,
    blocked: "512",
    blockedNumeric: 512,
    subtext: "94.8% of high-confidence threats deceived or contained",
    trend: "+12.1% diversion efficacy"
  }
};

export const ownerTrafficTimeSeries = [
  { time: "00:00", totalRequests: 42000, cleanTraffic: 41850, divertedToDecoy: 110, blocked: 40 },
  { time: "03:00", totalRequests: 28000, cleanTraffic: 27910, divertedToDecoy: 72, blocked: 18 },
  { time: "06:00", totalRequests: 36000, cleanTraffic: 35890, divertedToDecoy: 85, blocked: 25 },
  { time: "09:00", totalRequests: 89000, cleanTraffic: 88640, divertedToDecoy: 260, blocked: 100 },
  { time: "12:00", totalRequests: 115000, cleanTraffic: 114620, divertedToDecoy: 295, blocked: 85 },
  { time: "15:00", totalRequests: 128000, cleanTraffic: 127590, divertedToDecoy: 310, blocked: 100 },
  { time: "18:00", totalRequests: 98000, cleanTraffic: 97720, divertedToDecoy: 215, blocked: 65 },
  { time: "21:00", totalRequests: 62000, cleanTraffic: 61780, divertedToDecoy: 152, blocked: 68 }
];

export const ownerThreatDistribution = [
  { name: "Critical", value: 428, color: "#ef4444" },
  { name: "High", value: 861, color: "#f97316" },
  { name: "Medium", value: 1493, color: "#eab308" },
  { name: "Low", value: 1060, color: "#3b82f6" }
];

export const ownerProtectedApps = DEFAULT_APPLICATIONS.slice(0, 5);
export const ownerSecurityEvents = DEFAULT_SECURITY_EVENTS.slice(0, 5);

export const getOwnerOverviewData = async () => {
  const currentApps = getStoredApps().filter(a => a.tenantId === "tenant-apex-9941");
  return {
    metrics: {
      ...ownerSummaryMetrics,
      totalApplications: {
        value: currentApps.length,
        subtext: `All ${currentApps.length} enrolled in gateway protection`,
        trend: "+1 this month"
      }
    },
    trafficSeries: ownerTrafficTimeSeries,
    threatDistribution: ownerThreatDistribution,
    protectedApps: currentApps,
    securityEvents: DEFAULT_SECURITY_EVENTS.slice(0, 5),
    isDemoData: true
  };
};

// --- Gateway Administrator Mock Data (Extended for Stage 2B.1) ---

export const adminSummaryMetrics = {
  platformHealth: "Operational",
  latency: "1.4 ms",
  activeNodes: "12 / 12 Nodes Online",
  totalTenants: {
    value: 6,
    subtext: "14 total protected applications registered across tenants",
    trend: "+2 this quarter"
  },
  platformRequests: {
    value: "34,812,490",
    numeric: 34812490,
    subtext: "Global ingress across 4 geographic edge clusters",
    trend: "+14.2% vs last week"
  },
  suspiciousSessions: {
    value: "214",
    numeric: 214,
    subtext: "Active honeynet engagements underway",
    trend: "28 high-confidence attacker tracking sessions"
  },
  threatsNeutralized: {
    value: "14,920",
    numeric: 14920,
    subtext: "Diverted into sandbox or rate-isolated in last 24h",
    trend: "99.98% clean traffic SLA maintained"
  }
};

export const adminPlatformTrends = [
  { time: "00:00", platformIngress: 980000, suspiciousAttempts: 1240, decoyDiverted: 820 },
  { time: "04:00", platformIngress: 650000, suspiciousAttempts: 920, decoyDiverted: 610 },
  { time: "08:00", platformIngress: 1850000, suspiciousAttempts: 2480, decoyDiverted: 1720 },
  { time: "12:00", platformIngress: 2450000, suspiciousAttempts: 3150, decoyDiverted: 2240 },
  { time: "16:00", platformIngress: 2620000, suspiciousAttempts: 3410, decoyDiverted: 2510 },
  { time: "20:00", platformIngress: 1720000, suspiciousAttempts: 2190, decoyDiverted: 1530 }
];

export const adminDeceptionVectors = [
  { vector: "Fake REST API", engagements: 412 },
  { vector: "Admin Portal Decoy", engagements: 298 },
  { vector: "SSH/Telnet Decoy", engagements: 245 },
  { vector: "Honey-token Trigger", engagements: 189 },
  { vector: "Database Shadow Trap", engagements: 145 }
];

export const getAdminOverviewData = async () => {
  const tenants = getStoredTenants();
  const apps = getStoredApps();
  return {
    metrics: {
      ...adminSummaryMetrics,
      totalTenants: {
        value: tenants.length,
        subtext: `${apps.length} total protected applications registered across tenants`,
        trend: "+2 this quarter"
      }
    },
    trends: adminPlatformTrends,
    vectors: adminDeceptionVectors,
    components: DEFAULT_COMPONENT_HEALTH,
    highSeverityEvents: DEFAULT_SECURITY_EVENTS.slice(0, 4),
    auditEvents: DEFAULT_AUDIT_LOGS.slice(0, 4),
    isDemoData: true
  };
};
