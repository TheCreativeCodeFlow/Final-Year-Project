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
