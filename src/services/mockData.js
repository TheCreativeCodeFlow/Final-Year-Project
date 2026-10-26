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
const STORAGE_KEY_ENVIRONMENTS = 'cyber_deception_environments_v1';
const STORAGE_KEY_ASSETS = 'cyber_deception_assets_v1';
const STORAGE_KEY_RELATIONSHIPS = 'cyber_deception_relationships_v1';
const STORAGE_KEY_TRANSITIONS = 'cyber_deception_transitions_v1';
const STORAGE_KEY_POLICIES = 'cyber_deception_policies_v1';
const STORAGE_KEY_STRATEGIES = 'cyber_deception_strategies_v1';
const STORAGE_KEY_POLICY_HISTORY = 'cyber_deception_policy_history_v1';
const STORAGE_KEY_STRATEGY_SCENARIOS = 'cyber_deception_strategy_scenarios_v1';

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

// --- Deception Environments Seed Data (Stage 2B.3) ---
export const DEFAULT_DECEPTION_ENVIRONMENTS = [
  {
    id: "env-apex-auth-01",
    name: "Apex Retail Banking Auth Shadow",
    tenantId: "tenant-apex-9941",
    tenantName: "Apex FinTech Cloud",
    applicationId: "app-03",
    applicationName: "Enterprise Admin Portal",
    type: "High-interaction honeynet",
    status: "Active",
    statusLabel: "Active (Simulated)",
    description: "High-interaction synthetic authentication and administrative shadow sandbox. Emulates administrative token endpoints, simulated JWT signing authorities, and canary credential traps.",
    isolationProfile: "Dedicated VPC Decoy Sink (Namespace: apex-auth-sandbox)",
    clusterNode: "Decoy-Worker-Node-US-East-04",
    simulatedStrategy: "Credential Exhaustion & Tarpit Latency (Policy SEC-AUTH-09)",
    activeAssetCount: 8,
    createdAt: "2026-08-15T10:00:00Z",
    updatedAt: "2026-10-25T15:42:00Z",
    lastUpdateHuman: "15 mins ago",
    linkedInvestigationIds: ["inv-801"],
    associatedEventIds: ["evt-901", "adm-evt-101"],
    associatedProfileIds: ["prof-701"]
  },
  {
    id: "env-med-fhir-02",
    name: "MedSecure FHIR Synthetic Records Vault",
    tenantId: "tenant-medsecure-1022",
    tenantName: "MedSecure Health Net",
    applicationId: "app-11",
    applicationName: "Patient Records FHIR API",
    type: "Synthetic API environment",
    status: "Active",
    statusLabel: "Active (Simulated)",
    description: "High-fidelity synthetic HL7 FHIR v4 resource sandbox. Generates fabricated patient EHR records, diagnostic labs, and observation tripwires to catch horizontal privilege escalation (BOLA).",
    isolationProfile: "HIPAA Zero-Trust Sandbox Sink",
    clusterNode: "Decoy-Worker-Node-US-Central-02",
    simulatedStrategy: "Synthetic Object Emulation & Trap Injection (Policy HIPAA-SEC-04)",
    activeAssetCount: 7,
    createdAt: "2026-08-20T11:30:00Z",
    updatedAt: "2026-10-25T15:25:00Z",
    lastUpdateHuman: "32 mins ago",
    linkedInvestigationIds: ["inv-802"],
    associatedEventIds: ["adm-evt-102"],
    associatedProfileIds: ["prof-702"]
  },
  {
    id: "env-omni-fleet-03",
    name: "OmniLogistics Fleet Protocol Decoy Sink",
    tenantId: "tenant-omni-4401",
    tenantName: "OmniLogistics Global",
    applicationId: "app-21",
    applicationName: "Fleet Dispatch WebSocket",
    type: "Low-interaction decoy",
    status: "Active",
    statusLabel: "Active (Simulated)",
    description: "Protocol smuggling containment container serving mock WebSocket echo framing, fake telemetry channels, and isolated dispatch sockets.",
    isolationProfile: "Container Namespace Isolation (Pod: decoy-ws-sink-04)",
    clusterNode: "Decoy-Worker-Node-EU-West-01",
    simulatedStrategy: "Protocol Delay & Command Sink Isolation (Policy OMNI-WS-02)",
    activeAssetCount: 5,
    createdAt: "2026-08-28T14:15:00Z",
    updatedAt: "2026-10-25T14:59:00Z",
    lastUpdateHuman: "1 hour ago",
    linkedInvestigationIds: ["inv-803"],
    associatedEventIds: ["adm-evt-103"],
    associatedProfileIds: ["prof-703"]
  },
  {
    id: "env-aero-apt-04",
    name: "AeroDynamics Classified Sensor Honey-Mesh",
    tenantId: "tenant-aerodyn-8823",
    tenantName: "AeroDynamics Defence Lab",
    applicationId: "app-31",
    applicationName: "Telemetry Ingestion Relay",
    type: "Synthetic enterprise network",
    status: "Review Required",
    statusLabel: "Review Required (Simulated)",
    description: "High-assurance avionics telemetry and propulsion mesh. Designed for APT nation-state fingerprinting with synthetic test-rig sensor streams and air-gap trap indicators.",
    isolationProfile: "Air-Gapped Sovereign Honeynet Mesh (Cluster: Edge-Cluster-Gov-Isolated)",
    clusterNode: "Gov-Isolated-Decoy-Pod-Prime",
    simulatedStrategy: "High-Interaction Sandbox Diversion with Fail-Closed Interlock (Policy DEF-APT-01)",
    activeAssetCount: 6,
    createdAt: "2026-06-12T09:00:00Z",
    updatedAt: "2026-10-25T14:48:00Z",
    lastUpdateHuman: "1.2 hours ago",
    linkedInvestigationIds: ["inv-804"],
    associatedEventIds: ["adm-evt-104"],
    associatedProfileIds: ["prof-704"]
  },
  {
    id: "env-nexus-api-05",
    name: "NexusHub GraphQL Schema Poisoning Sandbox",
    tenantId: "tenant-nexushub-3319",
    tenantName: "NexusHub SaaS Ecosystem",
    applicationId: "app-41",
    applicationName: "Developer API Mesh",
    type: "Synthetic API environment",
    status: "Maintenance",
    statusLabel: "Maintenance (Simulated)",
    description: "Public-facing GraphQL schema poisoning sandbox. Serves fabricated __schema introspection graphs with canary developer tokens and rate-limiting tarpits.",
    isolationProfile: "Standard Shared Worker Pool",
    clusterNode: "Decoy-Worker-Node-US-West-03",
    simulatedStrategy: "Introspection Tarpit & Schema Obfuscation",
    activeAssetCount: 4,
    createdAt: "2026-09-05T12:00:00Z",
    updatedAt: "2026-10-25T13:16:00Z",
    lastUpdateHuman: "2.8 hours ago",
    linkedInvestigationIds: ["inv-806"],
    associatedEventIds: [],
    associatedProfileIds: ["prof-706"]
  },
  {
    id: "env-quant-fix-06",
    name: "QuantEdge Ultra-Low Latency FIX Trap",
    tenantId: "tenant-quant-7712",
    tenantName: "QuantEdge Capital",
    applicationId: "app-51",
    applicationName: "High-Frequency FIX Gateway",
    type: "Low-interaction decoy",
    status: "Provisioning",
    statusLabel: "Provisioning (Simulated)",
    description: "Ultra-low latency FIX protocol shadow sink designed to emulate financial exchange market data with canary order routing traps.",
    isolationProfile: "Hardware Accelerated eBPF Bypass",
    clusterNode: "Decoy-Worker-Node-Equinix-NY4",
    simulatedStrategy: "Simulated Order Sink & Tarpit Delay",
    activeAssetCount: 3,
    createdAt: "2026-10-20T16:00:00Z",
    updatedAt: "2026-10-25T12:44:00Z",
    lastUpdateHuman: "3.5 hours ago",
    linkedInvestigationIds: [],
    associatedEventIds: [],
    associatedProfileIds: []
  }
];

// --- Synthetic Assets Seed Data (Stage 2B.3) ---
export const DEFAULT_SYNTHETIC_ASSETS = [
  // Assets for Apex Auth Sandbox (env-apex-auth-01)
  {
    id: "ast-apex-web-01",
    environmentId: "env-apex-auth-01",
    name: "Decoy Admin Portal UI",
    type: "web_application",
    simulatedState: "Active",
    dsgLayer: "immutable_policy",
    description: "Public landing portal for administrative authentication emulation with synthetic branding.",
    fictionalDetails: { url: "https://decoy-admin.apexfintech.internal", port: 443, protocol: "HTTPS/2" },
    x: 80,
    y: 180,
    relatedAssetIds: ["ast-apex-api-01"]
  },
  {
    id: "ast-apex-api-01",
    environmentId: "env-apex-auth-01",
    name: "Fake Auth Token Endpoint",
    type: "api_endpoint",
    simulatedState: "Engaged",
    dsgLayer: "controlled_dynamic",
    description: "REST endpoint accepting dictionary authentication requests and issuing simulated session tokens.",
    fictionalDetails: { path: "/manage/v1/auth/token", method: "POST", rateLimit: "Adaptive Tarpit" },
    x: 280,
    y: 120,
    relatedAssetIds: ["ast-apex-user-01", "ast-apex-canary-01"]
  },
  {
    id: "ast-apex-user-01",
    environmentId: "env-apex-auth-01",
    name: "Synthetic SuperAdmin Account",
    type: "user_identity",
    simulatedState: "Active",
    dsgLayer: "controlled_dynamic",
    description: "Fabricated high-privilege administrative persona with mock organizational metadata.",
    fictionalDetails: { username: "superadmin-dev", role: "ClusterAdmin", email: "superadmin-canary@apexfintech.internal" },
    x: 480,
    y: 80,
    relatedAssetIds: ["ast-apex-cred-01", "ast-apex-svc-01"]
  },
  {
    id: "ast-apex-cred-01",
    environmentId: "env-apex-auth-01",
    name: "Simulated JWT Signing Key",
    type: "synthetic_credential",
    simulatedState: "Engaged",
    dsgLayer: "controlled_dynamic",
    description: "Cryptographic canary key embedded in mock token response to track token replay downstream.",
    fictionalDetails: { algorithm: "RS256-Simulated", keyId: "canary-rsa-key-#8891", fingerprint: "SHA256:4a8f9c10b22" },
    x: 680,
    y: 80,
    relatedAssetIds: []
  },
  {
    id: "ast-apex-canary-01",
    environmentId: "env-apex-auth-01",
    name: "Canary Tripwire Token #88912",
    type: "canary_token",
    simulatedState: "Triggered",
    dsgLayer: "immutable_policy",
    description: "High-interaction canary credential planted in public documentation to detect reconnaissance.",
    fictionalDetails: { tokenValue: "CANARY_TOKEN_HASH_#88912", tripwireAction: "Lock to Sandbox", alertSlack: true },
    x: 280,
    y: 320,
    relatedAssetIds: ["ast-apex-cred-01"]
  },
  {
    id: "ast-apex-svc-01",
    environmentId: "env-apex-auth-01",
    name: "Synthetic Tenant Directory API",
    type: "internal_service",
    simulatedState: "Standby",
    dsgLayer: "controlled_dynamic",
    description: "Internal microservice simulating multi-tenant customer lookups with delayed responses.",
    fictionalDetails: { internalHost: "tenant-svc.decoy.internal", port: 8080, latencyDelay: "650ms" },
    x: 480,
    y: 260,
    relatedAssetIds: ["ast-apex-db-01"]
  },
  {
    id: "ast-apex-db-01",
    environmentId: "env-apex-auth-01",
    name: "Decoy Ledger PostgreSQL Trap",
    type: "database",
    simulatedState: "Active",
    dsgLayer: "controlled_dynamic",
    description: "Emulated relational database with synthetic financial transaction schemas and query tarpit.",
    fictionalDetails: { engine: "PostgreSQL 14 Decoy", dbName: "apex_settlement_canary", tablesCount: 14 },
    x: 680,
    y: 260,
    relatedAssetIds: ["ast-apex-doc-01"]
  },
  {
    id: "ast-apex-doc-01",
    environmentId: "env-apex-auth-01",
    name: "Simulated Compliance Audit Report",
    type: "file_document",
    simulatedState: "Active",
    dsgLayer: "observational_attacker",
    description: "Fabricated PDF containing canary tracking beacon to log unauthorized document download.",
    fictionalDetails: { filename: "pci_dss_audit_q3_confidential.pdf", size: "2.4 MB", beaconType: "DNS-Canary-Beacon" },
    x: 680,
    y: 400,
    relatedAssetIds: []
  },

  // Assets for MedSecure FHIR Vault (env-med-fhir-02)
  {
    id: "ast-med-web-01",
    environmentId: "env-med-fhir-02",
    name: "FHIR Client Portal Decoy",
    type: "web_application",
    simulatedState: "Active",
    dsgLayer: "immutable_policy",
    description: "Emulated electronic health record (EHR) partner login portal for hospital federation access.",
    fictionalDetails: { url: "https://fhir-portal.medsecure.internal", tlsCert: "Simulated-EHR-Authority" },
    x: 80,
    y: 180,
    relatedAssetIds: ["ast-med-api-01"]
  },
  {
    id: "ast-med-api-01",
    environmentId: "env-med-fhir-02",
    name: "Synthetic /Patient FHIR Resource",
    type: "api_endpoint",
    simulatedState: "Engaged",
    dsgLayer: "controlled_dynamic",
    description: "RESTful HL7 FHIR resource endpoint dynamically producing synthetic patient records.",
    fictionalDetails: { path: "/api/v4/Patient", standard: "HL7 FHIR Release 4", supportedParams: ["_id", "name", "birthdate"] },
    x: 280,
    y: 140,
    relatedAssetIds: ["ast-med-user-01", "ast-med-db-01", "ast-med-canary-01"]
  },
  {
    id: "ast-med-user-01",
    environmentId: "env-med-fhir-02",
    name: "Simulated Attending Physician",
    type: "user_identity",
    simulatedState: "Active",
    dsgLayer: "controlled_dynamic",
    description: "Synthetic medical practitioner persona with clinical credentials and specialty tags.",
    fictionalDetails: { username: "dr.evans.canary", specialty: "Cardiology", npiNumber: "1942088192" },
    x: 480,
    y: 80,
    relatedAssetIds: ["ast-med-cred-01"]
  },
  {
    id: "ast-med-cred-01",
    environmentId: "env-med-fhir-02",
    name: "Canary OAuth Clinical Bearer Token",
    type: "synthetic_credential",
    simulatedState: "Standby",
    dsgLayer: "controlled_dynamic",
    description: "Synthetic SMART-on-FHIR OAuth token containing cryptographic canary claims.",
    fictionalDetails: { tokenType: "Bearer", scope: "patient/Patient.read", expiry: "2026-12-31" },
    x: 680,
    y: 80,
    relatedAssetIds: []
  },
  {
    id: "ast-med-canary-01",
    environmentId: "env-med-fhir-02",
    name: "Synthetic Patient #1042 Tripwire",
    type: "canary_token",
    simulatedState: "Triggered",
    dsgLayer: "immutable_policy",
    description: "Dedicated canary patient record designed to alert when sequential ID enumeration (BOLA) occurs.",
    fictionalDetails: { patientId: "CANARY_PATIENT_1042", simulatedName: "Jane Doe (Canary)", triggerAlert: "Immediate SOC Alert" },
    x: 280,
    y: 340,
    relatedAssetIds: []
  },
  {
    id: "ast-med-db-01",
    environmentId: "env-med-fhir-02",
    name: "Mock MongoDB FHIR Document Store",
    type: "database",
    simulatedState: "Active",
    dsgLayer: "controlled_dynamic",
    description: "NoSQL document collection holding 500 generated JSON medical observation charts.",
    fictionalDetails: { engine: "MongoDB Decoy", collection: "fhir_patients_mock", recordsCount: 500 },
    x: 480,
    y: 260,
    relatedAssetIds: ["ast-med-doc-01"]
  },
  {
    id: "ast-med-doc-01",
    environmentId: "env-med-fhir-02",
    name: "Fabricated Diagnostic Chart #1042",
    type: "file_document",
    simulatedState: "Engaged",
    dsgLayer: "observational_attacker",
    description: "Synthetic medical diagnostic report containing simulated lab panels and canary watermarks.",
    fictionalDetails: { recordId: "ehr_diag_chart_canary_1042.json", format: "FHIR DiagnosticReport", size: "128 KB" },
    x: 680,
    y: 260,
    relatedAssetIds: ["ast-med-canary-01"]
  },

  // Assets for OmniLogistics Fleet Decoy Sink (env-omni-fleet-03)
  {
    id: "ast-omni-api-01",
    environmentId: "env-omni-fleet-03",
    name: "Mock WebSocket Upgrade Route",
    type: "api_endpoint",
    simulatedState: "Engaged",
    dsgLayer: "controlled_dynamic",
    description: "Protocol upgrade handler validating WebSocket handshakes and trapping CRLF smuggling packets.",
    fictionalDetails: { path: "/v1/telemetry/ws", subprotocol: "fleet-telemetry-v2", proxyTrap: "CRLF Sanitizer" },
    x: 120,
    y: 200,
    relatedAssetIds: ["ast-omni-svc-01", "ast-omni-canary-01"]
  },
  {
    id: "ast-omni-svc-01",
    environmentId: "env-omni-fleet-03",
    name: "Decoy Fleet Telemetry Relay",
    type: "internal_service",
    simulatedState: "Active",
    dsgLayer: "controlled_dynamic",
    description: "Mock event broker echoing synthetic GPS coordinates and simulated vehicle telemetry.",
    fictionalDetails: { podName: "decoy-ws-sink-04", activeConnections: 1, commandsExecuted: 12 },
    x: 360,
    y: 140,
    relatedAssetIds: ["ast-omni-user-01", "ast-omni-db-01"]
  },
  {
    id: "ast-omni-user-01",
    environmentId: "env-omni-fleet-03",
    name: "Simulated Vehicle Unit GPS-882",
    type: "user_identity",
    simulatedState: "Active",
    dsgLayer: "controlled_dynamic",
    description: "Synthetic vehicle telemetry transponder persona with simulated fleet VIN.",
    fictionalDetails: { unitId: "FLEET-TRUCK-882", routeId: "EU-FRA-MUC-901", speed: "84 km/h (Simulated)" },
    x: 620,
    y: 80,
    relatedAssetIds: []
  },
  {
    id: "ast-omni-db-01",
    environmentId: "env-omni-fleet-03",
    name: "Simulated Redis Geolocation Buffer",
    type: "database",
    simulatedState: "Active",
    dsgLayer: "controlled_dynamic",
    description: "In-memory cache emulating high-frequency fleet coordinate queues.",
    fictionalDetails: { engine: "Redis 7 Decoy", memoryUsage: "18 MB", keysCount: 420 },
    x: 620,
    y: 240,
    relatedAssetIds: []
  },
  {
    id: "ast-omni-canary-01",
    environmentId: "env-omni-fleet-03",
    name: "Protocol Framing Fingerprint Trap",
    type: "canary_token",
    simulatedState: "Triggered",
    dsgLayer: "immutable_policy",
    description: "Inspection filter detecting malformed HTTP upgrade byte sequences.",
    fictionalDetails: { ruleId: "SIG-OMNI-CRLF-02", action: "Container Isolation", dwellTimer: "4m 10s" },
    x: 360,
    y: 340,
    relatedAssetIds: []
  },

  // Assets for AeroDynamics Classified Sensor Honey-Mesh (env-aero-apt-04)
  {
    id: "ast-aero-svc-01",
    environmentId: "env-aero-apt-04",
    name: "Classified Sensor Rig Ingress Relay",
    type: "internal_service",
    simulatedState: "Active",
    dsgLayer: "immutable_policy",
    description: "Military-grade avionics telemetry relay equipped with hardware eBPF inspection.",
    fictionalDetails: { classification: "Sovereign Tier", port: 443, hardwareFilter: "eBPF-AirGap-Relay" },
    x: 100,
    y: 180,
    relatedAssetIds: ["ast-aero-api-01"]
  },
  {
    id: "ast-aero-api-01",
    environmentId: "env-aero-apt-04",
    name: "Synthetic /telemetry/v1/sync Endpoint",
    type: "api_endpoint",
    simulatedState: "Quarantined",
    dsgLayer: "controlled_dynamic",
    description: "Proprietary telemetry sync interface emulating avionics test bench sensor packets.",
    fictionalDetails: { path: "/telemetry/v1/sync", format: "Binary Avionics Framing", disposition: "Blocked at Edge" },
    x: 340,
    y: 140,
    relatedAssetIds: ["ast-aero-cred-01", "ast-aero-db-01", "ast-aero-canary-01"]
  },
  {
    id: "ast-aero-cred-01",
    environmentId: "env-aero-apt-04",
    name: "Simulated Avionics Token CANARY_DEFENCE",
    type: "synthetic_credential",
    simulatedState: "Standby",
    dsgLayer: "controlled_dynamic",
    description: "Fabricated cryptographic beacon credentials planted in telemetry headers.",
    fictionalDetails: { tokenName: "CANARY_DEFENCE_BEACON_ALPHA", cipher: "Proprietary Test Cipher" },
    x: 580,
    y: 80,
    relatedAssetIds: ["ast-aero-canary-01"]
  },
  {
    id: "ast-aero-db-01",
    environmentId: "env-aero-apt-04",
    name: "Synthetic Propulsion Telemetry Store",
    type: "database",
    simulatedState: "Active",
    dsgLayer: "controlled_dynamic",
    description: "Time-series database simulating turbine vibration and exhaust temperature logs.",
    fictionalDetails: { engine: "InfluxDB Decoy", retention: "7 Days", streamsCount: 8 },
    x: 580,
    y: 220,
    relatedAssetIds: ["ast-aero-doc-01"]
  },
  {
    id: "ast-aero-doc-01",
    environmentId: "env-aero-apt-04",
    name: "Fake Aerodynamic Test Spec 2026.docx",
    type: "file_document",
    simulatedState: "Active",
    dsgLayer: "observational_attacker",
    description: "Synthetic propulsion specification document containing honey-token canary macros.",
    fictionalDetails: { docId: "AERO-SPEC-2026-X9", classification: "Synthetic Classified", size: "1.8 MB" },
    x: 580,
    y: 360,
    relatedAssetIds: []
  },
  {
    id: "ast-aero-canary-01",
    environmentId: "env-aero-apt-04",
    name: "Air-Gap Beacon Tripwire Alpha",
    type: "canary_token",
    simulatedState: "Triggered",
    dsgLayer: "immutable_policy",
    description: "Tripwire beacon matching nation-state threat signature SIG-APT-DEF-88.",
    fictionalDetails: { sigId: "SIG-APT-DEF-88", failSafe: "TCP Reset / Air-Gap Severance", alertLevel: "Critical" },
    x: 340,
    y: 340,
    relatedAssetIds: []
  },

  // Assets for NexusHub GraphQL Sandbox (env-nexus-api-05)
  {
    id: "ast-nexus-api-01",
    environmentId: "env-nexus-api-05",
    name: "Synthetic /graphql Endpoint",
    type: "api_endpoint",
    simulatedState: "Active",
    dsgLayer: "controlled_dynamic",
    description: "Public GraphQL query interface responding with synthetic schema introspection structures.",
    fictionalDetails: { path: "/graphql", introspection: "Simulated Schema Enabled", queryDepthMax: 6 },
    x: 140,
    y: 180,
    relatedAssetIds: ["ast-nexus-user-01", "ast-nexus-canary-01"]
  },
  {
    id: "ast-nexus-user-01",
    environmentId: "env-nexus-api-05",
    name: "Simulated Developer Account",
    type: "user_identity",
    simulatedState: "Active",
    dsgLayer: "controlled_dynamic",
    description: "Synthetic external developer identity registered with sandbox API access.",
    fictionalDetails: { username: "dev-community-canary", plan: "Free Sandbox Tier", created: "2026-09-05" },
    x: 420,
    y: 120,
    relatedAssetIds: ["ast-nexus-cred-01"]
  },
  {
    id: "ast-nexus-cred-01",
    environmentId: "env-nexus-api-05",
    name: "Canary API Key 'canary_dev_key_#441'",
    type: "synthetic_credential",
    simulatedState: "Standby",
    dsgLayer: "controlled_dynamic",
    description: "Synthetic API key embedded in introspection queries to log downstream developer usage.",
    fictionalDetails: { keyPrefix: "nex_canary_441", permissions: "schema:read:mock" },
    x: 680,
    y: 120,
    relatedAssetIds: []
  },
  {
    id: "ast-nexus-canary-01",
    environmentId: "env-nexus-api-05",
    name: "Schema Introspection Trap",
    type: "canary_token",
    simulatedState: "Standby",
    dsgLayer: "immutable_policy",
    description: "Monitors recursive schema inspection attempts and applies artificial response latency.",
    fictionalDetails: { rule: "MaxDepth > 5 -> Delay 1200ms", hitCount: 310 },
    x: 420,
    y: 300,
    relatedAssetIds: []
  },

  // Assets for QuantEdge FIX Trap (env-quant-fix-06)
  {
    id: "ast-quant-api-01",
    environmentId: "env-quant-fix-06",
    name: "FIX Protocol Ingress Socket",
    type: "api_endpoint",
    simulatedState: "Standby",
    dsgLayer: "controlled_dynamic",
    description: "Low-latency FIX protocol session socket emulating financial market data streams.",
    fictionalDetails: { port: 9800, protocol: "FIX.4.4", crossConnect: "Equinix NY4" },
    x: 160,
    y: 200,
    relatedAssetIds: ["ast-quant-db-01", "ast-quant-canary-01"]
  },
  {
    id: "ast-quant-db-01",
    environmentId: "env-quant-fix-06",
    name: "Synthetic Order Book Sink",
    type: "database",
    simulatedState: "Standby",
    dsgLayer: "controlled_dynamic",
    description: "Simulated financial exchange book accepting and discarding canary market orders.",
    fictionalDetails: { symbol: "CANY/USD", orderType: "Limit Order Decoy Sink" },
    x: 520,
    y: 140,
    relatedAssetIds: []
  },
  {
    id: "ast-quant-canary-01",
    environmentId: "env-quant-fix-06",
    name: "Canary Order ID Trap",
    type: "canary_token",
    simulatedState: "Standby",
    dsgLayer: "immutable_policy",
    description: "Unique synthetic order ID identifier notifying risk systems if traded externally.",
    fictionalDetails: { orderId: "CANARY_ORD_99182A", alertBus: "Equinix-LowLatency-Relay" },
    x: 520,
    y: 300,
    relatedAssetIds: []
  }
];

// --- Deception Relationships Seed Data (Stage 2B.3) ---
export const DEFAULT_DECEPTION_RELATIONSHIPS = [
  // Apex Environment Relationships
  {
    id: "rel-apex-1",
    environmentId: "env-apex-auth-01",
    source: "ast-apex-web-01",
    target: "ast-apex-api-01",
    type: "EXPOSES",
    label: "Exposes",
    dsgLayer: "immutable_policy",
    status: "Configured",
    notes: "Web application serves public login form forwarding to fake auth API endpoint."
  },
  {
    id: "rel-apex-2",
    environmentId: "env-apex-auth-01",
    source: "ast-apex-api-01",
    target: "ast-apex-user-01",
    type: "AUTHENTICATES_TO",
    label: "Authenticates To",
    dsgLayer: "controlled_dynamic",
    status: "Active Ingress",
    notes: "API endpoint matches dictionary payloads against synthetic superadmin persona."
  },
  {
    id: "rel-apex-3",
    environmentId: "env-apex-auth-01",
    source: "ast-apex-user-01",
    target: "ast-apex-cred-01",
    type: "CAN_ACCESS",
    label: "Can Access",
    dsgLayer: "controlled_dynamic",
    status: "Observed Traversal",
    notes: "Synthetic superadmin persona is authorized to claim simulated JWT signing keys."
  },
  {
    id: "rel-apex-4",
    environmentId: "env-apex-auth-01",
    source: "ast-apex-api-01",
    target: "ast-apex-canary-01",
    type: "MONITORS",
    label: "Monitors",
    dsgLayer: "immutable_policy",
    status: "Observed Traversal",
    notes: "API endpoint embeds canary token #88912 tripwire on all invalid password responses."
  },
  {
    id: "rel-apex-5",
    environmentId: "env-apex-auth-01",
    source: "ast-apex-user-01",
    target: "ast-apex-svc-01",
    type: "CAN_ACCESS",
    label: "Can Access",
    dsgLayer: "controlled_dynamic",
    status: "Configured",
    notes: "Authenticated sessions permit horizontal traversal into fake tenant directory service."
  },
  {
    id: "rel-apex-6",
    environmentId: "env-apex-auth-01",
    source: "ast-apex-svc-01",
    target: "ast-apex-db-01",
    type: "CONNECTS_TO",
    label: "Connects To",
    dsgLayer: "controlled_dynamic",
    status: "Configured",
    notes: "Tenant directory microservice maintains connection pool to synthetic PostgreSQL trap."
  },
  {
    id: "rel-apex-7",
    environmentId: "env-apex-auth-01",
    source: "ast-apex-db-01",
    target: "ast-apex-doc-01",
    type: "CONTAINS",
    label: "Contains",
    dsgLayer: "observational_attacker",
    status: "Configured",
    notes: "Database mock table stores references to downloadable synthetic PCI audit document."
  },
  {
    id: "rel-apex-8",
    environmentId: "env-apex-auth-01",
    source: "ast-apex-canary-01",
    target: "ast-apex-cred-01",
    type: "MONITORS",
    label: "Monitors",
    dsgLayer: "immutable_policy",
    status: "Configured",
    notes: "Canary tripwire detects any unauthorized attempt to sign payloads with synthetic JWT key."
  },

  // MedSecure Environment Relationships
  {
    id: "rel-med-1",
    environmentId: "env-med-fhir-02",
    source: "ast-med-web-01",
    target: "ast-med-api-01",
    type: "EXPOSES",
    label: "Exposes",
    dsgLayer: "immutable_policy",
    status: "Configured",
    notes: "Portal UI routes clinical FHIR queries to synthetic /Patient endpoint."
  },
  {
    id: "rel-med-2",
    environmentId: "env-med-fhir-02",
    source: "ast-med-api-01",
    target: "ast-med-user-01",
    type: "AUTHENTICATES_TO",
    label: "Authenticates To",
    dsgLayer: "controlled_dynamic",
    status: "Configured",
    notes: "FHIR endpoint accepts requests authenticated as simulated attending physician."
  },
  {
    id: "rel-med-3",
    environmentId: "env-med-fhir-02",
    source: "ast-med-user-01",
    target: "ast-med-cred-01",
    type: "CAN_ACCESS",
    label: "Can Access",
    dsgLayer: "controlled_dynamic",
    status: "Configured",
    notes: "Physician persona holds mock OAuth token credentials for healthcare API access."
  },
  {
    id: "rel-med-4",
    environmentId: "env-med-fhir-02",
    source: "ast-med-api-01",
    target: "ast-med-db-01",
    type: "CONNECTS_TO",
    label: "Connects To",
    dsgLayer: "controlled_dynamic",
    status: "Active Ingress",
    notes: "API endpoint reads patient resources from synthetic MongoDB document repository."
  },
  {
    id: "rel-med-5",
    environmentId: "env-med-fhir-02",
    source: "ast-med-db-01",
    target: "ast-med-doc-01",
    type: "CONTAINS",
    label: "Contains",
    dsgLayer: "observational_attacker",
    status: "Active Ingress",
    notes: "Database collection houses synthetic diagnostic report JSON record #1042."
  },
  {
    id: "rel-med-6",
    environmentId: "env-med-fhir-02",
    source: "ast-med-doc-01",
    target: "ast-med-canary-01",
    type: "MONITORS",
    label: "Monitors",
    dsgLayer: "immutable_policy",
    status: "Observed Traversal",
    notes: "Diagnostic report record embeds canary tripwire #1042 triggered during BOLA scrape."
  },
  {
    id: "rel-med-7",
    environmentId: "env-med-fhir-02",
    source: "ast-med-api-01",
    target: "ast-med-canary-01",
    type: "MONITORS",
    label: "Monitors",
    dsgLayer: "immutable_policy",
    status: "Observed Traversal",
    notes: "Endpoint tripwire rule monitors sequential integer query parameters."
  },

  // OmniLogistics Environment Relationships
  {
    id: "rel-omni-1",
    environmentId: "env-omni-fleet-03",
    source: "ast-omni-api-01",
    target: "ast-omni-svc-01",
    type: "CONNECTS_TO",
    label: "Connects To",
    dsgLayer: "controlled_dynamic",
    status: "Active Ingress",
    notes: "WebSocket handshake forwards client frames to sandboxed echo telemetry relay."
  },
  {
    id: "rel-omni-2",
    environmentId: "env-omni-fleet-03",
    source: "ast-omni-svc-01",
    target: "ast-omni-user-01",
    type: "AUTHENTICATES_TO",
    label: "Authenticates To",
    dsgLayer: "controlled_dynamic",
    status: "Configured",
    notes: "Telemetry relay validates packets against synthetic truck unit GPS-882 persona."
  },
  {
    id: "rel-omni-3",
    environmentId: "env-omni-fleet-03",
    source: "ast-omni-svc-01",
    target: "ast-omni-db-01",
    type: "CONNECTS_TO",
    label: "Connects To",
    dsgLayer: "controlled_dynamic",
    status: "Configured",
    notes: "Relay buffers inbound mock telemetry points in synthetic Redis store."
  },
  {
    id: "rel-omni-4",
    environmentId: "env-omni-fleet-03",
    source: "ast-omni-api-01",
    target: "ast-omni-canary-01",
    type: "MONITORS",
    label: "Monitors",
    dsgLayer: "immutable_policy",
    status: "Observed Traversal",
    notes: "Inspection tripwire flags CRLF injection attempts on HTTP Upgrade packets."
  },

  // AeroDynamics Environment Relationships
  {
    id: "rel-aero-1",
    environmentId: "env-aero-apt-04",
    source: "ast-aero-svc-01",
    target: "ast-aero-api-01",
    type: "EXPOSES",
    label: "Exposes",
    dsgLayer: "immutable_policy",
    status: "Configured",
    notes: "Sensor rig ingress service exposes binary sync endpoint."
  },
  {
    id: "rel-aero-2",
    environmentId: "env-aero-apt-04",
    source: "ast-aero-api-01",
    target: "ast-aero-cred-01",
    type: "CAN_ACCESS",
    label: "Can Access",
    dsgLayer: "controlled_dynamic",
    status: "Configured",
    notes: "Sync endpoint permits authenticated access to mock avionics cryptographic tokens."
  },
  {
    id: "rel-aero-3",
    environmentId: "env-aero-apt-04",
    source: "ast-aero-api-01",
    target: "ast-aero-db-01",
    type: "CONNECTS_TO",
    label: "Connects To",
    dsgLayer: "controlled_dynamic",
    status: "Configured",
    notes: "Sync service streams sensor readings to synthetic propulsion time-series DB."
  },
  {
    id: "rel-aero-4",
    environmentId: "env-aero-apt-04",
    source: "ast-aero-db-01",
    target: "ast-aero-doc-01",
    type: "CONTAINS",
    label: "Contains",
    dsgLayer: "observational_attacker",
    status: "Configured",
    notes: "Database mock schema links to classified aerodynamic test specification document."
  },
  {
    id: "rel-aero-5",
    environmentId: "env-aero-apt-04",
    source: "ast-aero-api-01",
    target: "ast-aero-canary-01",
    type: "MONITORS",
    label: "Monitors",
    dsgLayer: "immutable_policy",
    status: "Observed Traversal",
    notes: "Tripwire flags binary byte sequences matching classified signature SIG-APT-DEF-88."
  },
  {
    id: "rel-aero-6",
    environmentId: "env-aero-apt-04",
    source: "ast-aero-cred-01",
    target: "ast-aero-canary-01",
    type: "MONITORS",
    label: "Monitors",
    dsgLayer: "immutable_policy",
    status: "Configured",
    notes: "Beacon tripwire alerts if synthetic avionics token is broadcast on external networks."
  },

  // NexusHub Environment Relationships
  {
    id: "rel-nexus-1",
    environmentId: "env-nexus-api-05",
    source: "ast-nexus-api-01",
    target: "ast-nexus-user-01",
    type: "AUTHENTICATES_TO",
    label: "Authenticates To",
    dsgLayer: "controlled_dynamic",
    status: "Configured",
    notes: "GraphQL endpoint authenticates sandbox developer identity."
  },
  {
    id: "rel-nexus-2",
    environmentId: "env-nexus-api-05",
    source: "ast-nexus-user-01",
    target: "ast-nexus-cred-01",
    type: "CAN_ACCESS",
    label: "Can Access",
    dsgLayer: "controlled_dynamic",
    status: "Configured",
    notes: "Developer account grants access to canary API key for sandbox queries."
  },
  {
    id: "rel-nexus-3",
    environmentId: "env-nexus-api-05",
    source: "ast-nexus-api-01",
    target: "ast-nexus-canary-01",
    type: "MONITORS",
    label: "Monitors",
    dsgLayer: "immutable_policy",
    status: "Observed Traversal",
    notes: "Introspection trap rate-limits high-depth recursive AST queries."
  },

  // QuantEdge Environment Relationships
  {
    id: "rel-quant-1",
    environmentId: "env-quant-fix-06",
    source: "ast-quant-api-01",
    target: "ast-quant-db-01",
    type: "CONNECTS_TO",
    label: "Connects To",
    dsgLayer: "controlled_dynamic",
    status: "Configured",
    notes: "FIX socket feeds test order frames to synthetic order book sink."
  },
  {
    id: "rel-quant-2",
    environmentId: "env-quant-fix-06",
    source: "ast-quant-api-01",
    target: "ast-quant-canary-01",
    type: "MONITORS",
    label: "Monitors",
    dsgLayer: "immutable_policy",
    status: "Configured",
    notes: "Canary order tripwire alerts if simulated limit orders are re-routed outside sandbox."
  }
];

// --- Simulated DSG Transitions History Seed Data (Stage 2B.3) ---
export const DEFAULT_DSG_TRANSITIONS = [
  {
    id: "trans-apex-01",
    environmentId: "env-apex-auth-01",
    timestamp: "2026-10-25 15:40:02 UTC",
    previousState: "Standby Decoy Pool (Warm)",
    newState: "High-Interaction Container Allocated",
    trigger: "Attacker burst of 140 dictionary password variants scored 0.985 anomaly confidence.",
    evidenceReference: "evt-901 / inv-801",
    adaptationAction: "Dynamic deployment of decoy container decoy-worker-pod-89b to absorb authentication traffic.",
    dsgLayerAffected: "controlled_dynamic",
    status: "Simulated Demonstration Transition"
  },
  {
    id: "trans-apex-02",
    environmentId: "env-apex-auth-01",
    timestamp: "2026-10-25 15:41:15 UTC",
    previousState: "Generic Decoy Credentials Active",
    newState: "Canary Token Tripwire Activated",
    trigger: "POST request presented canary token CANARY_TOKEN_HASH_#88912 harvested from fake documentation.",
    evidenceReference: "evt-901 / inv-801",
    adaptationAction: "Canary tripwire locked session sess-88f1c-d7 strictly into sandbox namespace; dispatched simulated JWT keys.",
    dsgLayerAffected: "immutable_policy",
    status: "Simulated Demonstration Transition"
  },
  {
    id: "trans-apex-03",
    environmentId: "env-apex-auth-01",
    timestamp: "2026-10-25 15:42:00 UTC",
    previousState: "Standard Latency (2ms)",
    newState: "Tarpit Latency Injected (1200ms)",
    trigger: "Attacker initiated automated API enumeration using python-requests tooling.",
    evidenceReference: "inv-801",
    adaptationAction: "Applied 1200ms synthetic delay on /manage/v1/tenants/list endpoint to slow scanner velocity by 84%.",
    dsgLayerAffected: "controlled_dynamic",
    status: "Simulated Demonstration Transition"
  },
  {
    id: "trans-med-01",
    environmentId: "env-med-fhir-02",
    timestamp: "2026-10-25 15:22:10 UTC",
    previousState: "Production Passthrough",
    newState: "Rerouted to Synthetic Patient Vault",
    trigger: "Sequential iteration across consecutive patient integer IDs flagged horizontal BOLA traversal.",
    evidenceReference: "adm-evt-102 / inv-802",
    adaptationAction: "Policy HIPAA-SEC-04 diverted session sess-med-419b-01 to synthetic FHIR resource provider.",
    dsgLayerAffected: "controlled_dynamic",
    status: "Simulated Demonstration Transition"
  },
  {
    id: "trans-med-02",
    environmentId: "env-med-fhir-02",
    timestamp: "2026-10-25 15:25:00 UTC",
    previousState: "Dynamic Patient Generation",
    newState: "Canary Patient #1042 Accessed",
    trigger: "Query parameter requested targeted synthetic canary record CANARY_PATIENT_1042.",
    evidenceReference: "adm-evt-102 / inv-802",
    adaptationAction: "Dispatched fabricated diagnostic oncology chart containing canary watermarks.",
    dsgLayerAffected: "observational_attacker",
    status: "Simulated Demonstration Transition"
  },
  {
    id: "trans-omni-01",
    environmentId: "env-omni-fleet-03",
    timestamp: "2026-10-25 14:55:00 UTC",
    previousState: "Normal WebSocket Gateway",
    newState: "CRLF Smuggling Isolated",
    trigger: "HTTP Upgrade packet contained embedded carriage-return and newline bytes attempting socket pipe takeover.",
    evidenceReference: "adm-evt-103 / inv-803",
    adaptationAction: "Rerouted session sess-ws-omni-77a into mock echo container decoy-ws-sink-04.",
    dsgLayerAffected: "controlled_dynamic",
    status: "Simulated Demonstration Transition"
  },
  {
    id: "trans-aero-01",
    environmentId: "env-aero-apt-04",
    timestamp: "2026-10-25 14:44:10 UTC",
    previousState: "Air-Gap Ingress Active",
    newState: "Emergency Fail-Closed TCP Reset",
    trigger: "Binary payload matched classified nation-state threat signature SIG-APT-DEF-88.",
    evidenceReference: "adm-evt-104 / inv-804",
    adaptationAction: "Discrepancy: Policy designated Honeynet diversion, but hardware eBPF enforced immediate TCP Reset (Air-Gap Interlock).",
    dsgLayerAffected: "immutable_policy",
    status: "Simulated Demonstration Transition"
  },
  {
    id: "trans-nexus-01",
    environmentId: "env-nexus-api-05",
    timestamp: "2026-10-25 13:05:00 UTC",
    previousState: "Standard Introspection",
    newState: "Schema Poisoning Active",
    trigger: "Unauthenticated crawler requested __schema AST with query depth > 5.",
    evidenceReference: "inv-806",
    adaptationAction: "Returned synthetic schema graph obfuscating internal mutations and advertising canary API key.",
    dsgLayerAffected: "controlled_dynamic",
    status: "Simulated Demonstration Transition"
  }
];

// --- Default Deception Policies Seed Data ---
export const DEFAULT_DECEPTION_POLICIES = [
  {
    id: "pol-sec-01",
    name: "Apex Retail Banking Authentication Tarpit & Tripwire Policy",
    description: "Enforces progressive response latency and canary credential provisioning when brute-force dictionary bursts or credential-stuffing patterns are detected targeting retail auth APIs.",
    scope: "environment",
    tenantId: "tenant-apex-9941",
    tenantName: "Apex FinTech Cloud",
    environmentId: "env-apex-auth-01",
    environmentName: "Apex Retail Banking Auth Shadow",
    category: "suspicious_activity_handling",
    priority: 10,
    status: "Enabled (Simulated)",
    triggerConditions: [
      "Repeated authentication failures >= 25 within 60s sliding window",
      "Anomaly confidence score >= 0.85 from behavioral detection engine",
      "Ingress URI matches sensitive auth endpoints (/manage/v1/auth/*)"
    ],
    requiredEvidence: [
      "Structured HTTP request log with client IP and user-agent header",
      "Behavioral anomaly vector scoring burst frequency and dictionary diversity",
      "Session fingerprint token assigned by gateway ingress proxy"
    ],
    permittedActions: [
      "Divert session into dedicated synthetic auth sandbox (env-apex-auth-01)",
      "Inject simulated exponential tarpit response delay (200ms - 1500ms)",
      "Serve synthetic superadmin persona (ast-apex-user-01) with mock directory claims",
      "Present simulated RS256 JWT key and canary token #88912"
    ],
    prohibitedActions: [
      "Modify real production user database or authentication authority",
      "Expose real tenant secrets, credentials, or production signing keys",
      "Permit outbound egress traffic from honeynet worker container",
      "Silently route suspicious traffic to real origin if sandbox allocation fails"
    ],
    safetyConstraints: [
      "Tenant Isolation: Strict VPC namespace containment; cross-tenant traversal prohibited",
      "Fail-Safe Interlock: If sandbox container is unresponsive, fail closed with HTTP 429",
      "Missing Evidence Guard: Unrecorded telemetry shall never be treated as verified safe traffic"
    ],
    humanReviewRequired: false,
    owner: "Sarah Chen (Platform Ops)",
    associatedStrategyIds: ["strat-auth-01", "strat-canary-01"],
    createdAt: "2026-08-15T10:00:00Z",
    updatedAt: "2026-10-25T15:42:00Z"
  },
  {
    id: "pol-sec-02",
    name: "MedSecure FHIR Broken Object Level Authorization (BOLA) Decoy Policy",
    description: "Governs isolation and synthetic record emulation when sequential identifier enumeration is observed traversing FHIR healthcare patient resource endpoints.",
    scope: "environment",
    tenantId: "tenant-medsecure-1022",
    tenantName: "MedSecure Health Net",
    environmentId: "env-med-fhir-02",
    environmentName: "MedSecure FHIR Synthetic Records Vault",
    category: "deception_routing_eligibility",
    priority: 15,
    status: "Enabled (Simulated)",
    triggerConditions: [
      "Sequential GET queries across >= 10 distinct patient ID keys within 30s",
      "Zero legitimate authorization token binding to targeted patient IDs",
      "Request URI matches /api/v4/Patient/* or /api/v4/DiagnosticReport/*"
    ],
    requiredEvidence: [
      "API gateway access log recording enumeration pattern",
      "Decoded JWT token subject mismatch with requested resource IDs",
      "Client TLS fingerprint hash and JA4 signature"
    ],
    permittedActions: [
      "Divert requests to synthetic FHIR resource sandbox (env-med-fhir-02)",
      "Generate fabricated patient demographic records with realistic synthetics",
      "Seed diagnostic report record containing canary tracking token #1042",
      "Increment lateral observation score in attacker behavior profile"
    ],
    prohibitedActions: [
      "Expose genuine patient electronic health records (EHR) under any condition",
      "Allow outbound connections from FHIR sandbox to production clinical systems",
      "Treat missing patient consent telemetry as verified authorization",
      "Bypass HIPAA boundary audit logging during synthetic diversion"
    ],
    safetyConstraints: [
      "HIPAA Zero-Trust Boundary: Real patient databases must remain physically isolated",
      "Strict tenant boundary isolation: medsecure tenant sandbox cannot access other tenants",
      "Fail-safe interlock: If synthetic generator fails, drop connection immediately"
    ],
    humanReviewRequired: true,
    owner: "Alex Vance (SecOps Lead)",
    associatedStrategyIds: ["strat-bola-02", "strat-canary-01"],
    createdAt: "2026-08-20T11:30:00Z",
    updatedAt: "2026-10-25T15:25:00Z"
  },
  {
    id: "pol-sec-03",
    name: "Global Honeynet Egress and Outbound Traffic Containment Policy",
    description: "Platform-wide mandatory containment rule ensuring zero unsolicited network egress originates from any synthetic deception asset, honeynet worker, or sandbox pod.",
    scope: "platform",
    tenantId: null,
    tenantName: "Platform-Wide",
    environmentId: null,
    environmentName: "All Deception Environments",
    category: "isolation_egress_restrictions",
    priority: 1,
    status: "Enabled (Simulated)",
    triggerConditions: [
      "Any outbound SYN packet initiated from honeynet container or sandbox namespace",
      "DNS resolution request for external domain originating inside decoy network",
      "Raw socket creation attempt inside synthetic pod"
    ],
    requiredEvidence: [
      "Linux eBPF kernel network trace or Cilium network policy alert",
      "Container PID and namespace identifier matching registered decoy scope"
    ],
    permittedActions: [
      "Immediately drop outbound packet at kernel/eBPF boundary with zero RST dispatch",
      "Capture socket payload and destination IP for threat intelligence attribution",
      "Quarantine honeynet container and preserve memory snapshot for forensics",
      "Trigger immediate high-severity administrative alert and escalation"
    ],
    prohibitedActions: [
      "Permit outbound connections to reach external internet or cloud VPC infrastructure",
      "Permit decoy containers to scan or probe internal gateway management networks",
      "Allow automated scripts to disable egress filters without multi-party authorization",
      "Silently bypass egress policy for diagnostic testing in production clusters"
    ],
    safetyConstraints: [
      "Absolute Egress Block: Default-deny all outbound traffic across all decoy namespaces",
      "Tenant Isolation: Decoy pods must never share network namespaces across tenants",
      "Fail-Closed Design: Kernel network filter failure causes instant container termination"
    ],
    humanReviewRequired: false,
    owner: "Sarah Chen (Platform Ops)",
    associatedStrategyIds: ["strat-egress-03", "strat-contain-06"],
    createdAt: "2026-06-01T08:00:00Z",
    updatedAt: "2026-10-25T16:00:00Z"
  },
  {
    id: "pol-sec-04",
    name: "AeroDynamics Sovereign Air-Gap Threat Neutralization & Interlock Policy",
    description: "High-assurance fail-safe policy for defense telemetry systems. Mandates immediate hardware TCP reset and air-gap interlock when classified nation-state exploit signatures are observed.",
    scope: "tenant",
    tenantId: "tenant-aerodyn-8823",
    tenantName: "AeroDynamics Defence Lab",
    environmentId: "env-aero-apt-04",
    environmentName: "AeroDynamics Classified Sensor Honey-Mesh",
    category: "fail_safe_handling",
    priority: 5,
    status: "Review Required",
    triggerConditions: [
      "Binary payload matches classified APT signature SIG-APT-DEF-88",
      "Sensor telemetry ingestion packet contains shellcode or ROP chain patterns",
      "Simulated air-gap beacon tripwire triggered by adversary probe"
    ],
    requiredEvidence: [
      "Deep packet inspection byte-stream offset matching classified threat indicator",
      "Calculated threat confidence score == 1.00 (Hard positive signature)",
      "Hardware cryptoprocessor tamper status clean"
    ],
    permittedActions: [
      "Enforce immediate TCP Reset at eBPF level, dropping ingress connection",
      "Lock target IP into gateway boundary blocklist for 48 hours",
      "Preserve binary payload in write-once forensic storage volume",
      "Escalate incident to Tier-3 Sovereign Defense analyst team"
    ],
    prohibitedActions: [
      "Allow classified threat actor to prolong interaction beyond initial signature match",
      "Permit honeynet payload diversion when fail-closed interlock is active",
      "Forward suspicious binary to unverified secondary processing queues",
      "Treat missing behavioral evidence as low-confidence or safe"
    ],
    safetyConstraints: [
      "Sovereign Defense Interlock: Air-gap integrity overrides observational deception goals",
      "Strict tenant boundary isolation: aero tenant resources isolated from commercial tenants",
      "Explicit execution verification required before marking incident mitigated"
    ],
    humanReviewRequired: true,
    owner: "Sarah Chen (Platform Ops)",
    associatedStrategyIds: ["strat-airgap-04"],
    createdAt: "2026-06-12T09:00:00Z",
    updatedAt: "2026-10-25T14:48:00Z"
  },
  {
    id: "pol-sec-05",
    name: "NexusHub GraphQL Introspection Poisoning & Canary Injection Policy",
    description: "Directs unauthenticated API recon crawlers to a synthetic GraphQL schema graph with honey-fields and canary API tokens to track downstream credential reuse.",
    scope: "environment",
    tenantId: "tenant-nexushub-3319",
    tenantName: "NexusHub SaaS Ecosystem",
    environmentId: "env-nexus-api-05",
    environmentName: "NexusHub GraphQL Schema Poisoning Sandbox",
    category: "synthetic_asset_modification",
    priority: 30,
    status: "Draft",
    triggerConditions: [
      "GraphQL introspection query (__schema or __type) received from untrusted IP",
      "Missing valid Bearer developer token or expired API key presented",
      "Introspection query AST depth score >= 4"
    ],
    requiredEvidence: [
      "Parsed GraphQL query AST demonstrating full schema extraction intent",
      "Client HTTP request metadata lacking valid developer session claims"
    ],
    permittedActions: [
      "Serve poisoned synthetic schema definition with fake deprecated mutations",
      "Inject canary developer API key into simulated schema comment fields",
      "Monitor global SIEM telemetry for unauthorized presentation of canary key"
    ],
    prohibitedActions: [
      "Expose genuine internal microservice schema or private mutations",
      "Alter production GraphQL gateway routing tables or endpoint resolvers",
      "Allow unauthenticated introspection on real developer portal"
    ],
    safetyConstraints: [
      "Tenant boundary isolation: NexusHub schema mutations cannot reference other tenants",
      "Synthetic only: All returned types and field resolvers must remain purely mock"
    ],
    humanReviewRequired: false,
    owner: "Alex Vance (SecOps Lead)",
    associatedStrategyIds: ["strat-graphql-05"],
    createdAt: "2026-09-05T12:00:00Z",
    updatedAt: "2026-10-25T13:16:00Z"
  },
  {
    id: "pol-sec-06",
    name: "OmniLogistics WebSocket Smuggling Session Termination & Drain Policy",
    description: "Terminates and isolates sessions attempting HTTP protocol smuggling or raw socket injection against logistics dispatch WebSocket endpoints.",
    scope: "environment",
    tenantId: "tenant-omni-4401",
    tenantName: "OmniLogistics Global",
    environmentId: "env-omni-fleet-03",
    environmentName: "OmniLogistics Fleet Protocol Decoy Sink",
    category: "session_termination",
    priority: 20,
    status: "Enabled (Simulated)",
    triggerConditions: [
      "HTTP Upgrade header contains CRLF byte injection or malformed chunked encoding",
      "WebSocket framing payload violates RFC 6455 opcode specifications",
      "Repeated socket pipe resets exceeding 15 failures per minute"
    ],
    requiredEvidence: [
      "Raw byte stream capture displaying protocol smuggling delimiters",
      "Gateway reverse proxy anomaly flag for malformed Upgrade negotiation"
    ],
    permittedActions: [
      "Immediately close real client socket and divert subsequent IP traffic to decoy echo sink",
      "Record session telemetry in threat investigation queue",
      "Issue WebSocket close frame 1008 (Policy Violation) after 500ms tarpit delay"
    ],
    prohibitedActions: [
      "Allow malformed socket packets to reach real fleet dispatch microservices",
      "Attempt protocol recovery on corrupted socket frames",
      "Route to unmonitored drop sink without telemetry capture"
    ],
    safetyConstraints: [
      "Tenant isolation: WebSocket sink isolated to omni-fleet container pool",
      "Missing evidence guard: Indeterminate socket anomalies must fail closed"
    ],
    humanReviewRequired: false,
    owner: "Sarah Chen (Platform Ops)",
    associatedStrategyIds: ["strat-contain-06"],
    createdAt: "2026-08-28T14:15:00Z",
    updatedAt: "2026-10-25T14:59:00Z"
  },
  {
    id: "pol-sec-07",
    name: "Canary Token Global Tripwire & Immediate Session Quarantine Policy",
    description: "Platform-wide policy triggering immediate high-confidence containment and analyst alerting when any registered canary token signature is accessed or presented.",
    scope: "platform",
    tenantId: null,
    tenantName: "Platform-Wide",
    environmentId: null,
    environmentName: "All Deception Environments",
    category: "canary_token_response",
    priority: 2,
    status: "Enabled (Simulated)",
    triggerConditions: [
      "Incoming request matches known active canary token hash or cryptographic canary key",
      "Downloaded synthetic document canary beacon opened with DNS callback",
      "Canary database credentials presented to any gateway ingress endpoint"
    ],
    requiredEvidence: [
      "Cryptographic match against platform registered canary token registry",
      "Active request payload or header containing token signature",
      "Correlation with recorded origin IP and TLS session state"
    ],
    permittedActions: [
      "Lock current session into strict honeynet sandbox namespace with zero egress",
      "Elevate attacker profile classification to Confirmed Malicious Actor (1.00)",
      "Notify Security Operations Center via priority PagerDuty / Slack webhook",
      "Seed secondary lateral movement canary assets to track exfiltration objectives"
    ],
    prohibitedActions: [
      "Dismiss canary token activation as benign regardless of source IP reputation",
      "Allow token-bearing sessions to access real backend services",
      "Mutate canary token database during active investigation"
    ],
    safetyConstraints: [
      "Zero Egress: All canary-engaged sessions locked to sandbox",
      "Tenant Isolation: Decoy credentials cannot cross tenant boundaries"
    ],
    humanReviewRequired: true,
    owner: "Sarah Chen (Platform Ops)",
    associatedStrategyIds: ["strat-canary-01", "strat-contain-06"],
    createdAt: "2026-07-10T10:00:00Z",
    updatedAt: "2026-10-25T15:41:00Z"
  }
];

// --- Default Deception Strategies Seed Data ---
export const DEFAULT_DECEPTION_STRATEGIES = [
  {
    id: "strat-auth-01",
    name: "Adaptive Credential Exhaustion & Progressive Tarpit",
    description: "Absorbs brute-force and dictionary authentication attacks by dynamically spinning up high-interaction fake auth containers, serving synthetic credentials, and imposing exponential latency.",
    category: "reconnaissance_diversion",
    applicableEnvironmentTypes: ["High-interaction honeynet", "Synthetic API environment"],
    compatiblePolicyIds: ["pol-sec-01", "pol-sec-03"],
    requiredEvidence: [
      "Dictionary attack pattern >= 25 attempts/min",
      "Client anomaly score >= 0.85",
      "Session fingerprint token verified"
    ],
    intendedSyntheticStateChanges: [
      "Provision container decoy-worker-pod-89b to absorb authentication traffic",
      "Seed synthetic persona (ast-apex-user-01) with ClusterAdmin role claims",
      "Expose fake JWT signing key (ast-apex-cred-01) in mock response token"
    ],
    safetyConstraints: [
      "Zero egress allowed from honeynet container",
      "No real database connectivity permitted",
      "Strict isolation to apex-auth sandbox namespace"
    ],
    humanReviewRequired: false,
    status: "Active (Simulated)",
    associatedEnvironmentIds: ["env-apex-auth-01"],
    updatedAt: "2026-10-25T15:42:00Z"
  },
  {
    id: "strat-canary-01",
    name: "High-Interaction Canary Token Tripwire Deployment",
    description: "Strategically places cryptographic and document canary tokens inside synthetic API responses, mock tables, and downloaded PDFs to track downstream credential reuse.",
    category: "canary_token_placement",
    applicableEnvironmentTypes: ["High-interaction honeynet", "Synthetic API environment", "Low-interaction decoy"],
    compatiblePolicyIds: ["pol-sec-01", "pol-sec-02", "pol-sec-07"],
    requiredEvidence: [
      "Adversary traversal detected into synthetic document or credential store",
      "Telemetry confirms request reached synthetic layer"
    ],
    intendedSyntheticStateChanges: [
      "Embed canary token CANARY_TOKEN_HASH_#88912 into mock JWT claims",
      "Create synthetic document ast-apex-doc-01 referencing PCI audit findings",
      "Link canary token tripwire ast-apex-canary-01 to monitor endpoint"
    ],
    safetyConstraints: [
      "Tokens must be cryptographically distinguishable from production secrets",
      "All token activations must log to write-once platform audit trail"
    ],
    humanReviewRequired: false,
    status: "Active (Simulated)",
    associatedEnvironmentIds: ["env-apex-auth-01", "env-med-fhir-02"],
    updatedAt: "2026-10-25T15:41:00Z"
  },
  {
    id: "strat-bola-02",
    name: "Sequential Object Identifier Emulation & Trap Infiltration",
    description: "Counters Broken Object Level Authorization (BOLA) enumeration by generating plausible fake healthcare resource graphs that lead to synthetic patient records with embedded tripwires.",
    category: "synthetic_lateral_path_construction",
    applicableEnvironmentTypes: ["Synthetic API environment"],
    compatiblePolicyIds: ["pol-sec-02", "pol-sec-03"],
    requiredEvidence: [
      "Sequential ID enumeration across >= 10 patient IDs within 30s",
      "JWT token subject mismatch against targeted resource"
    ],
    intendedSyntheticStateChanges: [
      "Serve synthetic patient resource ast-med-doc-01 with mock oncology lab values",
      "Create synthetic relationship CAN_ACCESS linking physician persona to mock record",
      "Activate tripwire ast-med-canary-01 on first download attempt"
    ],
    safetyConstraints: [
      "Zero genuine patient records accessible under any circumstances",
      "Strict HIPAA boundary containment"
    ],
    humanReviewRequired: true,
    status: "Active (Simulated)",
    associatedEnvironmentIds: ["env-med-fhir-02"],
    updatedAt: "2026-10-25T15:25:00Z"
  },
  {
    id: "strat-egress-03",
    name: "Kernel-Level Zero-Egress Network Isolation Interlock",
    description: "Platform-wide enforcement strategy blocking all outbound traffic attempts from synthetic assets at the Linux eBPF layer while capturing adversary command-and-control metadata.",
    category: "observation_intensification",
    applicableEnvironmentTypes: ["High-interaction honeynet", "Synthetic enterprise network", "Synthetic API environment", "Low-interaction decoy"],
    compatiblePolicyIds: ["pol-sec-03"],
    requiredEvidence: [
      "Outbound connection attempt detected from honeynet container PID",
      "Cilium eBPF network trace verified"
    ],
    intendedSyntheticStateChanges: [
      "Quarantine honeynet container into isolated memory snapshot state",
      "Log destination IP and port to threat profile lateral movement ledger",
      "Maintain synthetic responsive shell locally without external network transit"
    ],
    safetyConstraints: [
      "Absolute default-deny egress on all synthetic interfaces",
      "Kernel-level enforcement independent of container user permissions"
    ],
    humanReviewRequired: false,
    status: "Active (Simulated)",
    associatedEnvironmentIds: ["env-apex-auth-01", "env-med-fhir-02", "env-omni-fleet-03", "env-aero-apt-04"],
    updatedAt: "2026-10-25T16:00:00Z"
  },
  {
    id: "strat-airgap-04",
    name: "Air-Gap Interlock with Fail-Closed TCP Reset",
    description: "High-assurance defense strategy overriding normal honeynet diversion with immediate TCP reset and forensic memory freeze when nation-state APT signatures are recognized.",
    category: "analyst_escalation",
    applicableEnvironmentTypes: ["Synthetic enterprise network"],
    compatiblePolicyIds: ["pol-sec-04"],
    requiredEvidence: [
      "Binary payload matches classified threat indicator SIG-APT-DEF-88",
      "Confidence score == 1.00 (Hard positive signature)"
    ],
    intendedSyntheticStateChanges: [
      "Issue immediate hardware TCP Reset terminating ingress socket",
      "Lock client IP at edge gateway boundary blocklist for 48 hours",
      "Snapshot packet buffer to immutable forensic archive"
    ],
    safetyConstraints: [
      "Air-gap defense interlock supersedes honeynet diversion",
      "Requires manual Tier-3 analyst review to release IP block"
    ],
    humanReviewRequired: true,
    status: "Under Review",
    associatedEnvironmentIds: ["env-aero-apt-04"],
    updatedAt: "2026-10-25T14:48:00Z"
  },
  {
    id: "strat-contain-06",
    name: "Protocol Anomaly Tarpit & Protocol Smuggling Containment",
    description: "Absorbs malformed HTTP Upgrade and WebSocket pipe-tampering exploits into isolated echo containers with delayed disconnection to drain attacker resources.",
    category: "session_containment",
    applicableEnvironmentTypes: ["Low-interaction decoy"],
    compatiblePolicyIds: ["pol-sec-06", "pol-sec-03", "pol-sec-07"],
    requiredEvidence: [
      "CRLF injection in Upgrade negotiation headers",
      "RFC 6455 framing violation detected"
    ],
    intendedSyntheticStateChanges: [
      "Divert session into mock container decoy-ws-sink-04",
      "Inject 500ms protocol response delay before closing socket",
      "Capture raw byte stream into security event log"
    ],
    safetyConstraints: [
      "Zero traversal into internal dispatch microservices",
      "Container CPU and memory throttled to prevent resource exhaustion"
    ],
    humanReviewRequired: false,
    status: "Active (Simulated)",
    associatedEnvironmentIds: ["env-omni-fleet-03"],
    updatedAt: "2026-10-25T14:59:00Z"
  }
];

// --- Default Policy Change History ---
export const DEFAULT_POLICY_CHANGE_HISTORY = [
  {
    id: "pch-01",
    policyId: "pol-sec-01",
    timestamp: "2026-10-25 14:30:00 UTC",
    previousStatus: "Draft",
    newStatus: "Enabled (Simulated)",
    changeDescription: "Adjusted brute force burst threshold from 50 to 25 attempts/min; updated canary token reference #88912.",
    actor: "Sarah Chen (Platform Ops)"
  },
  {
    id: "pch-02",
    policyId: "pol-sec-02",
    timestamp: "2026-10-25 13:45:00 UTC",
    previousStatus: "Review Required",
    newStatus: "Enabled (Simulated)",
    changeDescription: "Approved BOLA sequential traversal detection parameters and integrated FHIR v4 DiagnosticReport canary schema #1042.",
    actor: "Alex Vance (SecOps Lead)"
  },
  {
    id: "pch-03",
    policyId: "pol-sec-04",
    timestamp: "2026-10-25 14:50:00 UTC",
    previousStatus: "Enabled (Simulated)",
    newStatus: "Review Required",
    changeDescription: "Flagged policy discrepancy: Air-gap interlock enforced hardware TCP Reset during APT-88 incident while policy specified honeynet diversion.",
    actor: "Sarah Chen (Platform Ops)"
  },
  {
    id: "pch-04",
    policyId: "pol-sec-05",
    timestamp: "2026-10-25 12:15:00 UTC",
    previousStatus: "Not Recorded",
    newStatus: "Draft",
    changeDescription: "Initial policy draft authored for NexusHub GraphQL introspection AST poisoning.",
    actor: "Alex Vance (SecOps Lead)"
  }
];

// --- Default Strategy Evaluation Scenarios ---
export const DEFAULT_STRATEGY_EVALUATION_SCENARIOS = {
  recon_activity: {
    key: "recon_activity",
    name: "Reconnaissance-like Activity",
    description: "Adversary probes public landing pages and sends exploratory HTTP HEAD / OPTIONS requests across administrative endpoints.",
    simulatedEvidence: "High-frequency path enumeration (20 requests / 10s), user-agent indicates automated reconnaissance tool (Nuclei/v2.9).",
    evidenceAvailable: [
      "Path enumeration frequency: 2.0 req/s",
      "User-Agent: Nuclei/v2.9.15 (Automated Scanner)",
      "Zero valid session cookies presented"
    ],
    satisfiedPreconditions: [
      "Origin IP is outside trusted CIDR blocks",
      "Targeted endpoint matches configured deception route scope"
    ],
    unknownConditions: [
      "Adversary ultimate objective (credential theft vs denial-of-service)",
      "Threat actor organizational affiliation"
    ],
    relevantPolicyIds: ["pol-sec-01", "pol-sec-05"],
    eligibilityResult: {
      status: "Eligible (Simulated)",
      reason: "Reconnaissance behavior matches criteria for lightweight diversion. Strategy can deploy preliminary fake endpoints without consuming deep sandbox memory.",
      proposedSyntheticAction: "Expose synthetic login form and register IP into observation ledger."
    }
  },
  repeated_auth_failures: {
    key: "repeated_auth_failures",
    name: "Repeated Authentication Failures",
    description: "Burst of 40 consecutive failed POST /auth/login attempts presenting dictionary usernames (admin, root, test, superadmin).",
    simulatedEvidence: "Authentication failure rate = 40/min, dictionary variety score = 0.94, origin IP lacks historical legitimate sessions.",
    evidenceAvailable: [
      "Authentication failure counter: 40 failed attempts in 60s",
      "Dictionary entropy score: 0.94 (brute force pattern confirmed)",
      "Anomaly score from detection engine: 0.95"
    ],
    satisfiedPreconditions: [
      "Failure threshold (>= 25/min) satisfied",
      "Targeted environment (env-apex-auth-01) is active and has available sandbox slots",
      "Associated policy pol-sec-01 permits progressive tarpit"
    ],
    unknownConditions: [
      "Whether adversary holds valid credentials in secondary un-probed accounts"
    ],
    relevantPolicyIds: ["pol-sec-01", "pol-sec-03"],
    eligibilityResult: {
      status: "Eligible (Simulated)",
      reason: "High-confidence credential stuffing attack detected. Strategy is fully eligible for simulated execution under policy pol-sec-01.",
      proposedSyntheticAction: "Allocate container decoy-worker-pod-89b, impose 800ms exponential tarpit latency, and issue fake superadmin token."
    }
  },
  recorded_canary_interaction: {
    key: "recorded_canary_interaction",
    name: "Recorded Canary-Token Interaction",
    description: "Client request explicitly presents canary credential hash CANARY_TOKEN_HASH_#88912 harvested from synthetic documentation.",
    simulatedEvidence: "Cryptographic token match against active canary registry, zero legitimate operational use exists for this token signature.",
    evidenceAvailable: [
      "Token signature: CANARY_TOKEN_HASH_#88912 (Registered Tripwire)",
      "Token planted location: ast-apex-doc-01 (Fake PCI Audit Spec)",
      "Threat confidence score: 1.00 (Hard positive tripwire)"
    ],
    satisfiedPreconditions: [
      "Token match verified against immutable platform registry",
      "Policy pol-sec-07 authorizes immediate session quarantine",
      "Honeynet sandbox namespace is isolated"
    ],
    unknownConditions: [
      "Method of token retrieval by external third parties if token was leaked"
    ],
    relevantPolicyIds: ["pol-sec-01", "pol-sec-07", "pol-sec-02"],
    eligibilityResult: {
      status: "Requires Review",
      reason: "High-consequence tripwire activated. Strategy is eligible, but policy pol-sec-07 mandates human-in-the-loop analyst sign-off before secondary canary deployment.",
      proposedSyntheticAction: "Lock session to zero-egress sandbox and page on-call SecOps analyst."
    }
  },
  missing_incomplete_telemetry: {
    key: "missing_incomplete_telemetry",
    name: "Missing or Incomplete Telemetry",
    description: "Reverse proxy packet arrives with stripped TCP options, missing client IP header, and corrupted detection engine telemetry.",
    simulatedEvidence: "Missing Evidence: telemetry vector is null, anomaly detector returned timeout (ERR_TIMEOUT_TELEMETRY).",
    evidenceAvailable: [
      "Protocol: HTTP/1.1 over TLS 1.3",
      "Headers: Corrupted/Stripped by upstream proxy",
      "Behavioral Telemetry: Not Recorded (Telemetry Pipeline Timeout)"
    ],
    satisfiedPreconditions: [],
    unknownConditions: [
      "Client IP Address (Unknown)",
      "Anomaly Score (Not Recorded)",
      "Session Fingerprint (Unknown)",
      "Historical Reputation (Not Recorded)"
    ],
    relevantPolicyIds: ["pol-sec-03", "pol-sec-04"],
    eligibilityResult: {
      status: "Ineligible",
      reason: "Mandatory Safety Invariant: Missing or incomplete telemetry must NEVER be treated as safe or normal traffic. Strategy evaluation is prohibited when required behavioral evidence is unknown.",
      proposedSyntheticAction: "Fail closed: Reject packet with HTTP 400 and log pipeline telemetry failure."
    }
  },
  isolation_constraint_triggered: {
    key: "isolation_constraint_triggered",
    name: "Isolation Constraint Triggered",
    description: "Adversary inside synthetic sandbox attempts raw socket egress to external command-and-control server (198.51.100.44:443).",
    simulatedEvidence: "Linux eBPF kernel event: honeynet container attempted unsolicited outbound SYN packet across external interface.",
    evidenceAvailable: [
      "Process PID: 41092 inside container decoy-worker-pod-89b",
      "Socket call: connect() to 198.51.100.44:443 (Outbound SYN)",
      "Kernel eBPF verdict: DROP_DISPATCH"
    ],
    satisfiedPreconditions: [
      "Container PID verified within registered deception scope"
    ],
    unknownConditions: [
      "Payload intended for external C2 destination"
    ],
    relevantPolicyIds: ["pol-sec-03"],
    eligibilityResult: {
      status: "Ineligible",
      reason: "Strict Containment Interlock: Outbound egress attempt violates platform zero-egress policy pol-sec-03. Deception strategy execution is halted; container must be quarantined immediately.",
      proposedSyntheticAction: "Enforce kernel packet drop, freeze container memory snapshot, and terminate socket."
    }
  }
};

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

function getStoredEnvironments() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ENVIRONMENTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn("Could not read stored environments, using defaults", e);
  }
  return DEFAULT_DECEPTION_ENVIRONMENTS;
}

function setStoredEnvironments(environments) {
  try {
    localStorage.setItem(STORAGE_KEY_ENVIRONMENTS, JSON.stringify(environments));
  } catch (e) {
    console.warn("Could not persist environments", e);
  }
}

function getStoredAssets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ASSETS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn("Could not read stored assets, using defaults", e);
  }
  return DEFAULT_SYNTHETIC_ASSETS;
}

function setStoredAssets(assets) {
  try {
    localStorage.setItem(STORAGE_KEY_ASSETS, JSON.stringify(assets));
  } catch (e) {
    console.warn("Could not persist assets", e);
  }
}

function getStoredRelationships() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RELATIONSHIPS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn("Could not read stored relationships, using defaults", e);
  }
  return DEFAULT_DECEPTION_RELATIONSHIPS;
}

function setStoredRelationships(relationships) {
  try {
    localStorage.setItem(STORAGE_KEY_RELATIONSHIPS, JSON.stringify(relationships));
  } catch (e) {
    console.warn("Could not persist relationships", e);
  }
}

function getStoredTransitions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TRANSITIONS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn("Could not read stored transitions, using defaults", e);
  }
  return DEFAULT_DSG_TRANSITIONS;
}

function setStoredTransitions(transitions) {
  try {
    localStorage.setItem(STORAGE_KEY_TRANSITIONS, JSON.stringify(transitions));
  } catch (e) {
    console.warn("Could not persist transitions", e);
  }
}

function getStoredPolicies() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_POLICIES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn("Could not read stored policies, using defaults", e);
  }
  return DEFAULT_DECEPTION_POLICIES;
}

function setStoredPolicies(policies) {
  try {
    localStorage.setItem(STORAGE_KEY_POLICIES, JSON.stringify(policies));
  } catch (e) {
    console.warn("Could not persist policies", e);
  }
}

function getStoredStrategies() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_STRATEGIES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn("Could not read stored strategies, using defaults", e);
  }
  return DEFAULT_DECEPTION_STRATEGIES;
}

function setStoredStrategies(strategies) {
  try {
    localStorage.setItem(STORAGE_KEY_STRATEGIES, JSON.stringify(strategies));
  } catch (e) {
    console.warn("Could not persist strategies", e);
  }
}

function getStoredPolicyHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_POLICY_HISTORY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn("Could not read stored policy history, using defaults", e);
  }
  return DEFAULT_POLICY_CHANGE_HISTORY;
}

function setStoredPolicyHistory(history) {
  try {
    localStorage.setItem(STORAGE_KEY_POLICY_HISTORY, JSON.stringify(history));
  } catch (e) {
    console.warn("Could not persist policy history", e);
  }
}

function getStoredScenarios() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_STRATEGY_SCENARIOS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (e) {
    console.warn("Could not read stored scenarios, using defaults", e);
  }
  return DEFAULT_STRATEGY_EVALUATION_SCENARIOS;
}

function setStoredScenarios(scenarios) {
  try {
    localStorage.setItem(STORAGE_KEY_STRATEGY_SCENARIOS, JSON.stringify(scenarios));
  } catch (e) {
    console.warn("Could not persist scenarios", e);
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

// --- Public Service Methods for Deception Environments & DSG (Stage 2B.3) ---

export const getDeceptionEnvironments = async (filters = {}) => {
  let list = [...getStoredEnvironments()];

  if (filters.search) {
    const q = filters.search.toLowerCase().trim();
    list = list.filter(env =>
      env.id.toLowerCase().includes(q) ||
      env.name.toLowerCase().includes(q) ||
      env.tenantName.toLowerCase().includes(q) ||
      (env.applicationName && env.applicationName.toLowerCase().includes(q)) ||
      env.type.toLowerCase().includes(q) ||
      env.description.toLowerCase().includes(q)
    );
  }

  if (filters.tenantId && filters.tenantId !== 'all') {
    list = list.filter(env => env.tenantId === filters.tenantId);
  }

  if (filters.type && filters.type !== 'all') {
    list = list.filter(env => env.type === filters.type);
  }

  if (filters.status && filters.status !== 'all') {
    list = list.filter(env => env.status === filters.status);
  }

  const sortBy = filters.sortBy || 'name-asc';
  list.sort((a, b) => {
    if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
    if (sortBy === 'name-desc') return b.name.localeCompare(a.name);
    if (sortBy === 'assets-desc') return (b.activeAssetCount || 0) - (a.activeAssetCount || 0);
    if (sortBy === 'updated-desc') return new Date(b.updatedAt) - new Date(a.updatedAt);
    return 0;
  });

  return list;
};

export const getDeceptionEnvironmentById = async (id) => {
  const list = getStoredEnvironments();
  return list.find(env => env.id === id) || null;
};

export const getSyntheticAssets = async (environmentId = null) => {
  const assets = getStoredAssets();
  if (environmentId) {
    return assets.filter(a => a.environmentId === environmentId);
  }
  return [...assets];
};

export const getSyntheticAssetById = async (id) => {
  const assets = getStoredAssets();
  return assets.find(a => a.id === id) || null;
};

export const getDeceptionRelationships = async (environmentId = null) => {
  const relationships = getStoredRelationships();
  if (environmentId) {
    return relationships.filter(r => r.environmentId === environmentId);
  }
  return [...relationships];
};

export const getDeceptionGraph = async (environmentId) => {
  const env = await getDeceptionEnvironmentById(environmentId);
  if (!env) return null;

  const nodes = await getSyntheticAssets(environmentId);
  const edges = await getDeceptionRelationships(environmentId);

  // Group by conceptual DSG layers
  const layers = {
    immutable_policy: nodes.filter(n => n.dsgLayer === 'immutable_policy'),
    controlled_dynamic: nodes.filter(n => n.dsgLayer === 'controlled_dynamic'),
    observational_attacker: nodes.filter(n => n.dsgLayer === 'observational_attacker')
  };

  // Calculate degrees for nodes
  const enrichedNodes = nodes.map(node => {
    const incoming = edges.filter(e => e.target === node.id);
    const outgoing = edges.filter(e => e.source === node.id);
    return {
      ...node,
      inDegree: incoming.length,
      outDegree: outgoing.length,
      incomingEdges: incoming,
      outgoingEdges: outgoing
    };
  });

  return {
    environment: env,
    nodes: enrichedNodes,
    edges,
    layers
  };
};

export const getDsgTransitions = async (environmentId = null) => {
  const transitions = getStoredTransitions();
  if (environmentId) {
    return transitions.filter(t => t.environmentId === environmentId);
  }
  return [...transitions];
};

// --- Public Service Methods for Deception Policies & Strategies (Stage 2B.4) ---

/**
 * Deterministic rule-based policy validation function.
 * Validates required fields, priority ranges, environment existence,
 * tenant/environment scoping consistency, action contradictions, isolation safeguards,
 * and research integrity constraints.
 */
export const validateDeceptionPolicy = (policy) => {
  const issues = [];
  let status = 'Valid';

  if (!policy) {
    return { isValid: false, status: 'Invalid', issues: [{ type: 'error', message: 'Policy definition is null or missing.' }] };
  }

  // 1. Required fields
  if (!policy.name || !policy.name.trim()) {
    issues.push({ type: 'error', message: 'Policy name is required.' });
  }
  if (!policy.scope) {
    issues.push({ type: 'error', message: 'Policy scope (platform, tenant, or environment) is required.' });
  }
  if (!policy.category) {
    issues.push({ type: 'error', message: 'Policy category is required.' });
  }
  if (typeof policy.priority !== 'number' || isNaN(policy.priority)) {
    issues.push({ type: 'error', message: 'Priority must be a valid numeric value.' });
  } else if (policy.priority < 1 || policy.priority > 100) {
    issues.push({ type: 'error', message: 'Priority must be between 1 (highest priority) and 100 (lowest priority).' });
  }

  // 2. Scope consistency with tenant and environment
  if (policy.scope === 'tenant' && !policy.tenantId) {
    issues.push({ type: 'error', message: 'Tenant selection is required for tenant-scoped policies.' });
  }
  if (policy.scope === 'environment') {
    if (!policy.tenantId) {
      issues.push({ type: 'error', message: 'Tenant selection is required for environment-scoped policies.' });
    }
    if (!policy.environmentId) {
      issues.push({ type: 'error', message: 'Environment selection is required for environment-scoped policies.' });
    } else {
      // Validate that environment exists in platform registry
      const environments = getStoredEnvironments();
      const matchedEnv = environments.find(e => e.id === policy.environmentId);
      if (!matchedEnv) {
        issues.push({ type: 'error', message: `Referenced environment "${policy.environmentId}" does not exist in the platform registry.` });
      } else if (policy.tenantId && matchedEnv.tenantId !== policy.tenantId) {
        issues.push({
          type: 'error',
          message: `Tenant/Environment mismatch: Environment "${matchedEnv.name}" belongs to tenant "${matchedEnv.tenantName}" (${matchedEnv.tenantId}), which conflicts with selected tenant "${policy.tenantId}".`
        });
      }
    }
  }

  // 3. Contradiction check between permitted and prohibited synthetic actions
  const permitted = policy.permittedActions || [];
  const prohibited = policy.prohibitedActions || [];
  const permittedLower = permitted.map(p => p.toLowerCase());
  const prohibitedLower = prohibited.map(p => p.toLowerCase());

  // Check direct action contradiction
  permittedLower.forEach(p => {
    if (prohibitedLower.some(pr => pr === p || (pr.includes('modify real') && p.includes('modify real')) || (pr.includes('production') && p.includes('production credential')))) {
      issues.push({
        type: 'error',
        message: `Contradictory action detected: Action "${p}" appears in both permitted and prohibited configurations.`
      });
    }
  });

  // Check prohibited real application/infrastructure modifications
  if (permittedLower.some(p => p.includes('modify real') || p.includes('production database') || p.includes('real origin credentials') || p.includes('production clinical'))) {
    issues.push({
      type: 'error',
      message: 'Safety Boundary Violation: A deception policy must NEVER permit modification of real production applications, databases, or live credentials.'
    });
  }

  // 4. Isolation and tenant boundary constraint check
  const safety = policy.safetyConstraints || [];
  const safetyJoined = safety.join(' ').toLowerCase();
  const hasIsolationConstraint = safetyJoined.includes('isolation') || safetyJoined.includes('boundary') || safetyJoined.includes('containment') || safetyJoined.includes('namespace');
  if (!hasIsolationConstraint) {
    issues.push({
      type: 'warning',
      message: 'Isolation Safeguard Warning: Safety constraints do not explicitly mandate tenant isolation, boundary containment, or sandbox namespace isolation.'
    });
  }

  // 5. Research integrity: Missing telemetry must never qualify as safe
  const triggerJoined = (policy.triggerConditions || []).join(' ').toLowerCase();
  const evidenceJoined = (policy.requiredEvidence || []).join(' ').toLowerCase();
  if (triggerJoined.includes('missing evidence is safe') || triggerJoined.includes('missing telemetry is safe') || evidenceJoined.includes('treat missing as safe') || triggerJoined.includes('bypass if missing')) {
    issues.push({
      type: 'error',
      message: 'Research Integrity Violation: Missing or unrecorded telemetry must NEVER be treated as verified safe or benign traffic.'
    });
  }

  // 6. Terminology & enforcement claim check
  if (policy.status === 'Active' || policy.status === 'Enforced' || policy.status === 'Live') {
    issues.push({
      type: 'warning',
      message: 'Demonstration Terminology Notice: In this prototype, policies cannot claim live gateway enforcement. Use "Enabled (Simulated)" instead.'
    });
  }

  const hasErrors = issues.some(i => i.type === 'error');
  const hasWarnings = issues.some(i => i.type === 'warning');

  if (hasErrors) {
    status = 'Invalid';
  } else if (hasWarnings) {
    status = 'Warnings';
  } else {
    status = 'Valid';
  }

  return {
    isValid: !hasErrors,
    status,
    issues
  };
};

export const getDeceptionPolicies = async (filters = {}) => {
  let list = [...getStoredPolicies()];

  if (filters.search) {
    const q = filters.search.toLowerCase().trim();
    list = list.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      (p.tenantName && p.tenantName.toLowerCase().includes(q)) ||
      (p.environmentName && p.environmentName.toLowerCase().includes(q)) ||
      (p.owner && p.owner.toLowerCase().includes(q))
    );
  }

  if (filters.scope && filters.scope !== 'all') {
    list = list.filter(p => p.scope === filters.scope);
  }

  if (filters.tenantId && filters.tenantId !== 'all') {
    list = list.filter(p => p.tenantId === filters.tenantId);
  }

  if (filters.environmentId && filters.environmentId !== 'all') {
    list = list.filter(p => p.environmentId === filters.environmentId);
  }

  if (filters.category && filters.category !== 'all') {
    list = list.filter(p => p.category === filters.category);
  }

  if (filters.status && filters.status !== 'all') {
    list = list.filter(p => p.status === filters.status);
  }

  return list;
};

export const getDeceptionPolicyById = async (id) => {
  const list = getStoredPolicies();
  return list.find(p => p.id === id) || null;
};

export const saveDeceptionPolicy = async (policyData) => {
  const policies = getStoredPolicies();
  const history = getStoredPolicyHistory();
  const now = new Date().toISOString();

  let savedPolicy = null;

  if (policyData.id) {
    // Update existing policy
    const idx = policies.findIndex(p => p.id === policyData.id);
    if (idx !== -1) {
      const existing = policies[idx];
      const previousStatus = existing.status;
      const newStatus = policyData.status || existing.status;

      savedPolicy = {
        ...existing,
        ...policyData,
        updatedAt: now
      };

      policies[idx] = savedPolicy;

      // Log history entry if status changed or description modified
      const newHistoryEntry = {
        id: `pch-${String(history.length + 1).padStart(2, '0')}`,
        policyId: savedPolicy.id,
        timestamp: `${now.slice(0, 10)} ${now.slice(11, 19)} UTC`,
        previousStatus: previousStatus || "Draft",
        newStatus: newStatus,
        changeDescription: `Policy "${savedPolicy.name}" updated. Status: ${newStatus}.`,
        actor: policyData.editorActor || "Sarah Chen (Platform Ops)"
      };

      history.unshift(newHistoryEntry);
      setStoredPolicyHistory(history);
    }
  }

  if (!savedPolicy) {
    // Create new policy
    const nextNumber = policies.length + 1;
    const newId = `pol-sec-${String(nextNumber).padStart(2, '0')}`;

    savedPolicy = {
      id: newId,
      name: policyData.name || "Untitled Deception Policy",
      description: policyData.description || "",
      scope: policyData.scope || "environment",
      tenantId: policyData.tenantId || null,
      tenantName: policyData.tenantName || null,
      environmentId: policyData.environmentId || null,
      environmentName: policyData.environmentName || null,
      category: policyData.category || "suspicious_activity_handling",
      priority: Number(policyData.priority) || 50,
      status: policyData.status || "Draft",
      triggerConditions: policyData.triggerConditions || [],
      requiredEvidence: policyData.requiredEvidence || [],
      permittedActions: policyData.permittedActions || [],
      prohibitedActions: policyData.prohibitedActions || [],
      safetyConstraints: policyData.safetyConstraints || [
        "Tenant Isolation: Strict container namespace containment",
        "Zero Egress: Outbound traffic from synthetic decoys prohibited"
      ],
      humanReviewRequired: Boolean(policyData.humanReviewRequired),
      owner: policyData.owner || "Sarah Chen (Platform Ops)",
      associatedStrategyIds: policyData.associatedStrategyIds || [],
      createdAt: now,
      updatedAt: now
    };

    policies.unshift(savedPolicy);

    // Initial history record
    const initialHistoryEntry = {
      id: `pch-${String(history.length + 1).padStart(2, '0')}`,
      policyId: savedPolicy.id,
      timestamp: `${now.slice(0, 10)} ${now.slice(11, 19)} UTC`,
      previousStatus: "Not Recorded",
      newStatus: savedPolicy.status,
      changeDescription: `Initial policy draft authored: "${savedPolicy.name}".`,
      actor: savedPolicy.owner
    };

    history.unshift(initialHistoryEntry);
    setStoredPolicyHistory(history);
  }

  setStoredPolicies(policies);
  return savedPolicy;
};

export const deleteDeceptionPolicy = async (id) => {
  const policies = getStoredPolicies();
  const filtered = policies.filter(p => p.id !== id);
  if (filtered.length !== policies.length) {
    setStoredPolicies(filtered);
    return true;
  }
  return false;
};

export const getDeceptionStrategies = async (filters = {}) => {
  let list = [...getStoredStrategies()];

  if (filters.search) {
    const q = filters.search.toLowerCase().trim();
    list = list.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q)
    );
  }

  if (filters.category && filters.category !== 'all') {
    list = list.filter(s => s.category === filters.category);
  }

  if (filters.status && filters.status !== 'all') {
    list = list.filter(s => s.status === filters.status);
  }

  if (filters.environmentType && filters.environmentType !== 'all') {
    list = list.filter(s => s.applicableEnvironmentTypes?.includes(filters.environmentType));
  }

  if (filters.policyId && filters.policyId !== 'all') {
    list = list.filter(s => s.compatiblePolicyIds?.includes(filters.policyId));
  }

  return list;
};

export const getDeceptionStrategyById = async (id) => {
  const list = getStoredStrategies();
  return list.find(s => s.id === id) || null;
};

export const getPolicyChangeHistory = async (policyId = null) => {
  const history = getStoredPolicyHistory();
  if (policyId) {
    return history.filter(h => h.policyId === policyId);
  }
  return [...history];
};

export const getStrategyEvaluationScenarios = async () => {
  return getStoredScenarios();
};

export const evaluateStrategyScenario = async (strategyId, scenarioKey) => {
  const strategy = await getDeceptionStrategyById(strategyId);
  const scenarios = await getStrategyEvaluationScenarios();
  const scenario = scenarios[scenarioKey];

  if (!strategy || !scenario) {
    return null;
  }

  // Deterministic evaluation logic with strict semantics:
  // 1. Missing evidence scenario: Mandatory safety constraint enforces ineligibility.
  // 2. Isolation triggered scenario: Strict containment interlock halts strategy.
  // 3. Canary scenario: If strategy requires human review, status is "Requires Review".
  // 4. Auth failures: Eligible for auth & canary strategies.
  // 5. Reconnaissance: Eligible for reconnaissance strategies.

  let resultStatus = "Eligible (Simulated)";
  let resultReason = scenario.eligibilityResult.reason;
  let proposedAction = scenario.eligibilityResult.proposedSyntheticAction;

  if (scenarioKey === 'missing_incomplete_telemetry') {
    resultStatus = "Ineligible";
    resultReason = "Mandatory Safety Invariant: Missing or incomplete telemetry must NEVER be treated as safe or normal traffic. Strategy evaluation is prohibited when required behavioral evidence is unknown.";
    proposedAction = "Fail closed: Reject packet with HTTP 400 and log pipeline telemetry failure.";
  } else if (scenarioKey === 'isolation_constraint_triggered') {
    resultStatus = "Ineligible";
    resultReason = "Strict Containment Interlock: Outbound egress attempt violates platform zero-egress policy pol-sec-03. Deception strategy execution is halted; container must be quarantined immediately.";
    proposedAction = "Enforce kernel packet drop, freeze container memory snapshot, and terminate socket.";
  } else if (strategy.humanReviewRequired || scenarioKey === 'recorded_canary_interaction') {
    resultStatus = "Requires Review";
    resultReason = `${strategy.name} requires human analyst authorization before simulated synthetic mutation can proceed under policy rules.`;
  }

  return {
    strategy,
    scenario,
    status: resultStatus,
    reason: resultReason,
    evidenceAvailable: scenario.evidenceAvailable,
    satisfiedPreconditions: scenario.satisfiedPreconditions,
    unknownConditions: scenario.unknownConditions,
    relevantPolicyIds: scenario.relevantPolicyIds,
    proposedAction,
    isSimulated: true
  };
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
