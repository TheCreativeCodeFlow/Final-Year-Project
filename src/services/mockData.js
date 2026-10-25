/**
 * Mock Data Service for Cyber Deception Gateway
 * All data in this file is strictly simulated for demonstration and prototyping purposes.
 * It is NOT live security telemetry.
 */

export const IS_DEMO_DATA = true;
export const DEMO_DATA_DISCLAIMER = "DEMO DATA: Simulated telemetry for prototype evaluation only.";

// --- Application Owner Mock Data ---

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

export const ownerProtectedApps = [
  {
    id: "app-01",
    name: "Customer Accounts API",
    route: "api.apexfintech.io/v2/accounts",
    status: "shielded",
    deceptionMode: "Synthetic SQL & API Decoys",
    requestsPerSec: 420,
    threatIndex: "Low",
    activeDecoys: 4
  },
  {
    id: "app-02",
    name: "Payment Settlement Core",
    route: "payments.apexfintech.io/checkout",
    status: "shielded",
    deceptionMode: "Adaptive Emulation Sandbox",
    requestsPerSec: 285,
    threatIndex: "Medium",
    activeDecoys: 6
  },
  {
    id: "app-03",
    name: "Enterprise Admin Portal",
    route: "admin.apexfintech.io/manage",
    status: "shielded",
    deceptionMode: "Canary Credentials & Honey-routes",
    requestsPerSec: 45,
    threatIndex: "Elevated",
    activeDecoys: 8
  },
  {
    id: "app-04",
    name: "Mobile Banking Gateway",
    route: "mobile-gw.apexfintech.io/graphql",
    status: "shielded",
    deceptionMode: "Schema Poisoning Decoys",
    requestsPerSec: 180,
    threatIndex: "Low",
    activeDecoys: 3
  },
  {
    id: "app-05",
    name: "Partner B2B Webhook Ingress",
    route: "hooks.apexfintech.io/v1/incoming",
    status: "shielded",
    deceptionMode: "Shadow API Shadowing",
    requestsPerSec: 62,
    threatIndex: "Low",
    activeDecoys: 2
  }
];

export const ownerSecurityEvents = [
  {
    id: "evt-901",
    timestamp: "2 mins ago",
    application: "Enterprise Admin Portal",
    sourceIp: "198.51.100.44",
    vector: "Credential Stuffing & Auth Bypass",
    gatewayAction: "Diverted to Fake Auth Shadow",
    severity: "critical",
    details: "140 invalid tokens passed; attacker isolated in canary container"
  },
  {
    id: "evt-902",
    timestamp: "14 mins ago",
    application: "Customer Accounts API",
    sourceIp: "203.0.113.89",
    vector: "SQLi Injection Probe (/v2/users?id=1' OR)",
    gatewayAction: "Served Simulated DB Delay & Error",
    severity: "high",
    details: "Fingerprinting attempt delayed and logged in deception sandbox"
  },
  {
    id: "evt-903",
    timestamp: "32 mins ago",
    application: "Payment Settlement Core",
    sourceIp: "192.0.2.112",
    vector: "SSRF Parameter Tampering",
    gatewayAction: "Rerouted to Internal Honey-Metadata Service",
    severity: "high",
    details: "Targeted AWS metadata mock; payload signature captured"
  },
  {
    id: "evt-904",
    timestamp: "1 hr ago",
    application: "Mobile Banking Gateway",
    sourceIp: "198.51.100.17",
    vector: "GraphQL Introspection Brute-Force",
    gatewayAction: "Served Fabricated Schema Decoy",
    severity: "medium",
    details: "Attacker mapping fake queries and dummy mutations"
  },
  {
    id: "evt-905",
    timestamp: "2 hrs ago",
    application: "Customer Accounts API",
    sourceIp: "198.51.100.201",
    vector: "Suspicious User-Agent Vulnerability Scanner",
    gatewayAction: "Throttled & Honey-token Injected",
    severity: "low",
    details: "Automated scan headers flagged; decoy cookie attached"
  }
];

// --- Gateway Administrator Mock Data ---

export const adminSummaryMetrics = {
  platformHealth: "Operational",
  latency: "1.4 ms",
  activeNodes: "12 / 12 Nodes Online",
  totalTenants: {
    value: 18,
    subtext: "58 total protected applications registered across tenants",
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

export const adminComponentHealth = [
  {
    id: "comp-proxy",
    name: "L7 Reverse Proxy & Ingress Filter",
    status: "operational",
    latency: "0.8ms",
    cluster: "Edge-Cluster-US-East",
    uptime: "99.99%"
  },
  {
    id: "comp-ai",
    name: "AI Behavioral Anomaly Detector",
    status: "operational",
    latency: "3.2ms",
    cluster: "Inference-Worker-Pool-1",
    uptime: "99.95%"
  },
  {
    id: "comp-deception",
    name: "Dynamic Deception Orchestrator",
    status: "operational",
    latency: "2.1ms",
    cluster: "Decoy-Runtime-Vanguard",
    uptime: "100.00%"
  },
  {
    id: "comp-telemetry",
    name: "Threat Telemetry & Event Stream Pipeline",
    status: "operational",
    latency: "1.2ms",
    cluster: "Kafka-Ingest-Broker-A",
    uptime: "99.98%"
  },
  {
    id: "comp-policy",
    name: "Tenant Isolation & Policy Engine",
    status: "operational",
    latency: "0.4ms",
    cluster: "Core-Policy-Matrix",
    uptime: "100.00%"
  }
];

export const adminHighSeverityEvents = [
  {
    id: "adm-evt-101",
    timestamp: "4 mins ago",
    tenant: "Apex FinTech Cloud",
    target: "Enterprise Admin Portal",
    sourceIp: "198.51.100.44",
    threatType: "Distributed Credential Stuffing & Session Hijack",
    deceptionStatus: "Active in Sandboxed Honeynet",
    severity: "critical"
  },
  {
    id: "adm-evt-102",
    timestamp: "19 mins ago",
    tenant: "MedSecure Health Net",
    target: "Patient Records FHIR API",
    sourceIp: "203.0.113.12",
    threatType: "Mass BOLA / IDOR Traversal Probe",
    deceptionStatus: "Rerouted to Synthetic Patient Database",
    severity: "critical"
  },
  {
    id: "adm-evt-103",
    timestamp: "45 mins ago",
    tenant: "OmniLogistics Global",
    target: "Fleet Dispatch WebSocket",
    sourceIp: "192.0.2.78",
    threatType: "Protocol Smuggling & Command Injection",
    deceptionStatus: "Isolated in Containerized Shadow Sink",
    severity: "high"
  },
  {
    id: "adm-evt-104",
    timestamp: "1 hr ago",
    tenant: "AeroDynamics Defence Lab",
    target: "Telemetry Ingestion Relay",
    sourceIp: "198.51.100.198",
    threatType: "Known Nation-State Scanning Signature (APT Probe)",
    deceptionStatus: "Honey-token Fingerprint Dispatched",
    severity: "critical"
  }
];

export const adminAuditLog = [
  {
    id: "aud-501",
    timestamp: "12 mins ago",
    adminUser: "sarah.chen@gateway-admin.internal",
    action: "POLICY_UPDATE",
    target: "Tenant: Apex FinTech Cloud - Stricter SQLi Diversion Threshold",
    status: "success",
    ip: "10.14.0.52"
  },
  {
    id: "aud-502",
    timestamp: "38 mins ago",
    adminUser: "system-orchestrator",
    action: "DECOY_POOL_SCALED",
    target: "Decoy-Cluster-US-East: Scaled from 30 to 45 containers",
    status: "success",
    ip: "10.14.0.1"
  },
  {
    id: "aud-503",
    timestamp: "2 hrs ago",
    adminUser: "marcus.vance@gateway-admin.internal",
    action: "QUARANTINE_IP_RANGE",
    target: "Range 198.51.100.0/24 placed into Persistent Honeynet diversion",
    status: "success",
    ip: "10.14.0.88"
  },
  {
    id: "aud-504",
    timestamp: "4 hrs ago",
    adminUser: "sarah.chen@gateway-admin.internal",
    action: "CANARY_TOKEN_ROTATION",
    target: "Global JWT Secret Canary Keys Rotated",
    status: "success",
    ip: "10.14.0.52"
  }
];

// Service accessor functions (mimicking async API for easy future backend integration)
export const getOwnerOverviewData = async () => {
  return {
    metrics: ownerSummaryMetrics,
    trafficSeries: ownerTrafficTimeSeries,
    threatDistribution: ownerThreatDistribution,
    protectedApps: ownerProtectedApps,
    securityEvents: ownerSecurityEvents,
    isDemoData: true
  };
};

export const getAdminOverviewData = async () => {
  return {
    metrics: adminSummaryMetrics,
    trends: adminPlatformTrends,
    vectors: adminDeceptionVectors,
    components: adminComponentHealth,
    highSeverityEvents: adminHighSeverityEvents,
    auditEvents: adminAuditLog,
    isDemoData: true
  };
};
