/**
 * Deception Strategy Catalog (Stage 5A).
 *
 * Pre-configured deterministic strategies across 5 categories:
 * 1. RECONNAISSANCE_DECEPTION
 * 2. CREDENTIAL_DECEPTION
 * 3. API_DECEPTION
 * 4. DATA_ACCESS_DECEPTION
 * 5. SERVICE_INTERACTION_DECEPTION
 *
 * Each strategy defines:
 * - Category classification
 * - Targeted attack patterns / rules
 * - Prerequisites (confidence, telemetry quality, correlation)
 * - Isolation boundaries (sandbox requirements)
 * - Permitted state change proposals (strictly bounded - NO arbitrary code or commands)
 * - DSG mutation template
 */

export const STRATEGY_CATEGORIES = {
  RECONNAISSANCE_DECEPTION: 'RECONNAISSANCE_DECEPTION',
  CREDENTIAL_DECEPTION: 'CREDENTIAL_DECEPTION',
  API_DECEPTION: 'API_DECEPTION',
  DATA_ACCESS_DECEPTION: 'DATA_ACCESS_DECEPTION',
  SERVICE_INTERACTION_DECEPTION: 'SERVICE_INTERACTION_DECEPTION'
};

export const BASELINE_STRATEGIES = [
  {
    strategyIdentifier: 'strat-recon-honey-endpoints-01',
    name: 'Synthetic Administrative & Debugging Decoy Endpoints',
    description: 'Deploys synthetic administrative routes and debug endpoints to capture reconnaissance scanners.',
    strategyType: STRATEGY_CATEGORIES.RECONNAISSANCE_DECEPTION,
    version: 1,
    enabled: true,
    prerequisites: {
      supportedCategories: ['RECONNAISSANCE_DECEPTION'],
      targetedRules: ['RULE_REPEATED_RESOURCE_PROBING', 'RULE_SUSPICIOUS_METHOD'],
      minConfidence: 0.70,
      requiredTelemetryQuality: 'COMPLETE',
      minCorrelationConfidence: 0.60,
      maxCollisionRisk: 'LOW',
      requireRuleCorroboration: true
    },
    isolationRequirements: {
      strictNamespaceIsolation: true,
      noOutboundEgress: true,
      executionEngine: 'SYNTHETIC_MOCK_ROUTER'
    },
    permittedStateChangeProposal: {
      actionType: 'SIMULATE_DECOY_ROUTES',
      routes: [
        { path: '/api/v1/internal/admin/status', method: 'GET', simulatedStatus: 200 },
        { path: '/debug/pprof', method: 'GET', simulatedStatus: 200 },
        { path: '/.env.backup', method: 'GET', simulatedStatus: 403 }
      ],
      canaryHitAlert: true
    },
    dsgBlueprint: {
      nodes: [
        {
          nodeIdentifier: 'node-recon-decoy-admin',
          nodeType: 'SYNTHETIC_API',
          assetDescription: 'Decoy Admin Status and Diagnostic API',
          layerClassification: 'CONTROLLED_DYNAMIC_STATE',
          structuredAttributes: {
            endpoint: '/api/v1/internal/admin/status',
            responseSchema: 'internal_admin_v1',
            canaryTokenActive: true
          }
        },
        {
          nodeIdentifier: 'node-recon-attacker-tracker',
          nodeType: 'OBSERVATIONAL_TRACKER',
          assetDescription: 'Attacker Reconnaissance Trajectory Recorder',
          layerClassification: 'OBSERVATIONAL_ATTACKER_STATE',
          structuredAttributes: {
            trackingMode: 'ROUTE_ENUMERATION',
            alertOnTraversal: true
          }
        }
      ],
      edges: [
        {
          sourceNodeIdentifier: 'node-recon-decoy-admin',
          targetNodeIdentifier: 'node-recon-attacker-tracker',
          edgeType: 'OBSERVATION_LINK',
          structuredAttributes: { capturePayload: true, delayMs: 45 }
        }
      ]
    }
  },
  {
    strategyIdentifier: 'strat-credential-canary-token-01',
    name: 'Canary Bearer Token & Decoy Credential Sink',
    description: 'Responds to brute-force authentication with high-entropy canary JWTs to trace lateral exfiltration.',
    strategyType: STRATEGY_CATEGORIES.CREDENTIAL_DECEPTION,
    version: 1,
    enabled: true,
    prerequisites: {
      supportedCategories: ['CREDENTIAL_DECEPTION'],
      targetedRules: ['RULE_BRUTE_FORCE_AUTH', 'RULE_RAPID_FAILURE_ANOMALY'],
      minConfidence: 0.75,
      requiredTelemetryQuality: 'COMPLETE',
      minCorrelationConfidence: 0.70,
      maxCollisionRisk: 'LOW',
      requireRuleCorroboration: true
    },
    isolationRequirements: {
      strictNamespaceIsolation: true,
      noOutboundEgress: true,
      executionEngine: 'HONEY_AUTH_PROVIDER'
    },
    permittedStateChangeProposal: {
      actionType: 'INJECT_CANARY_CREDENTIALS',
      tokenTemplate: {
        type: 'BEARER_CANARY',
        claims: { sub: 'synthetic-user-991', role: 'AUDITOR_RESTRICTED', canarySeed: 'cnry-991' },
        expiresIn: '2h'
      },
      alertOnCanaryUse: true
    },
    dsgBlueprint: {
      nodes: [
        {
          nodeIdentifier: 'node-credential-canary-issuer',
          nodeType: 'HONEY_CREDENTIAL',
          assetDescription: 'Canary JWT Token Generator & Validator Decoy',
          layerClassification: 'CONTROLLED_DYNAMIC_STATE',
          structuredAttributes: {
            canaryKeyId: 'cnry-auth-key-01',
            algorithm: 'HS256',
            tokenPrefix: 'canary_jwt_'
          }
        },
        {
          nodeIdentifier: 'node-credential-auth-sink',
          nodeType: 'LATERAL_MOVEMENT_TRAP',
          assetDescription: 'Canary Token Usage Observation Sink',
          layerClassification: 'OBSERVATIONAL_ATTACKER_STATE',
          structuredAttributes: {
            sinkType: 'TOKEN_HONEYPOT',
            alertSeverity: 'CRITICAL'
          }
        }
      ],
      edges: [
        {
          sourceNodeIdentifier: 'node-credential-canary-issuer',
          targetNodeIdentifier: 'node-credential-auth-sink',
          edgeType: 'CREDENTIAL_BINDING',
          structuredAttributes: { trapTrigger: 'EXFIL_ATTEMPT' }
        }
      ]
    }
  },
  {
    strategyIdentifier: 'strat-api-shadow-facade-01',
    name: 'Shadow OpenAPI Facade & Verb Probing Decoy',
    description: 'Provides simulated responses for non-standard verbs and unsupported endpoints to map attacker toolkits.',
    strategyType: STRATEGY_CATEGORIES.API_DECEPTION,
    version: 1,
    enabled: true,
    prerequisites: {
      supportedCategories: ['API_DECEPTION'],
      targetedRules: ['RULE_SUSPICIOUS_METHOD', 'RULE_REPEATED_RESOURCE_PROBING'],
      minConfidence: 0.65,
      requiredTelemetryQuality: 'COMPLETE',
      minCorrelationConfidence: 0.60,
      maxCollisionRisk: 'MEDIUM',
      requireRuleCorroboration: false
    },
    isolationRequirements: {
      strictNamespaceIsolation: true,
      noOutboundEgress: true,
      executionEngine: 'SHADOW_API_GATEWAY'
    },
    permittedStateChangeProposal: {
      actionType: 'ACTIVATE_SHADOW_FACADE',
      mockedEndpoints: ['/graphql/introspect', '/api/v2/private/spec.json'],
      simulatedLatencyMs: 60
    },
    dsgBlueprint: {
      nodes: [
        {
          nodeIdentifier: 'node-api-shadow-gateway',
          nodeType: 'SYNTHETIC_API',
          assetDescription: 'Shadow API Mock Gateway with Strict Sandbox Boundaries',
          layerClassification: 'CONTROLLED_DYNAMIC_STATE',
          structuredAttributes: {
            protocols: ['REST', 'GRAPHQL'],
            simulationEngine: 'INLINE_MOCK_ENGINE'
          }
        },
        {
          nodeIdentifier: 'node-api-interaction-tracker',
          nodeType: 'ATTACKER_SESSION',
          assetDescription: 'Attacker Verb and Fuzzing Behavior Tracker',
          layerClassification: 'OBSERVATIONAL_ATTACKER_STATE',
          structuredAttributes: {
            logVerbs: ['PUT', 'DELETE', 'PATCH', 'CONNECT'],
            trackPayloadSignatures: true
          }
        }
      ],
      edges: [
        {
          sourceNodeIdentifier: 'node-api-shadow-gateway',
          targetNodeIdentifier: 'node-api-interaction-tracker',
          edgeType: 'OBSERVATION_LINK',
          structuredAttributes: { streamTelemetry: true }
        }
      ]
    }
  },
  {
    strategyIdentifier: 'strat-data-honey-records-01',
    name: 'Synthetic Database Decoy Store & Honey Record Injection',
    description: 'Injects synthetic customer, balance, and account records to detect and trace SQL exfiltration.',
    strategyType: STRATEGY_CATEGORIES.DATA_ACCESS_DECEPTION,
    version: 1,
    enabled: true,
    prerequisites: {
      supportedCategories: ['DATA_ACCESS_DECEPTION'],
      targetedRules: ['RULE_DATA_ACCESS', 'RULE_REPEATED_RESOURCE_PROBING'],
      minConfidence: 0.80,
      requiredTelemetryQuality: 'COMPLETE',
      minCorrelationConfidence: 0.75,
      maxCollisionRisk: 'LOW',
      requireRuleCorroboration: true
    },
    isolationRequirements: {
      strictNamespaceIsolation: true,
      noOutboundEgress: true,
      executionEngine: 'SYNTHETIC_DATA_SANDBOX'
    },
    permittedStateChangeProposal: {
      actionType: 'INJECT_HONEY_RECORDS',
      honeyTable: 'synthetic_customer_vault',
      recordCount: 15,
      canaryFields: ['canary_pan', 'canary_email']
    },
    dsgBlueprint: {
      nodes: [
        {
          nodeIdentifier: 'node-data-honey-db',
          nodeType: 'SANDBOX_DATABASE',
          assetDescription: 'Isolated Decoy Database with Honey Tables and Records',
          layerClassification: 'CONTROLLED_DYNAMIC_STATE',
          structuredAttributes: {
            schema: 'synthetic_financials',
            tableCount: 3,
            enforceNoEgress: true
          }
        },
        {
          nodeIdentifier: 'node-data-exfil-sink',
          nodeType: 'DATA_EXFIL_SINK',
          assetDescription: 'Exfiltration Alarm Sink Triggered on Canary Access',
          layerClassification: 'OBSERVATIONAL_ATTACKER_STATE',
          structuredAttributes: {
            alarmSeverity: 'CRITICAL',
            notifySecOps: true
          }
        }
      ],
      edges: [
        {
          sourceNodeIdentifier: 'node-data-honey-db',
          targetNodeIdentifier: 'node-data-exfil-sink',
          edgeType: 'DATA_EXFIL_SINK',
          structuredAttributes: { trapTrigger: 'DB_CANARY_READ' }
        }
      ]
    }
  },
  {
    strategyIdentifier: 'strat-service-tarpit-latency-01',
    name: 'Adaptive Latency Tarpit & Microservice Interceptor',
    description: 'Engages high-frequency scanners in an adaptive tarpit with progressive delays to mitigate burst volume.',
    strategyType: STRATEGY_CATEGORIES.SERVICE_INTERACTION_DECEPTION,
    version: 1,
    enabled: true,
    prerequisites: {
      supportedCategories: ['SERVICE_INTERACTION_DECEPTION'],
      targetedRules: ['RULE_HIGH_FREQUENCY_BURST', 'RULE_RAPID_FAILURE_ANOMALY'],
      minConfidence: 0.70,
      requiredTelemetryQuality: 'COMPLETE',
      minCorrelationConfidence: 0.65,
      maxCollisionRisk: 'LOW',
      requireRuleCorroboration: true
    },
    isolationRequirements: {
      strictNamespaceIsolation: true,
      noOutboundEgress: true,
      executionEngine: 'TARPIT_RATE_CONTAINER'
    },
    permittedStateChangeProposal: {
      actionType: 'APPLY_ADAPTIVE_TARPIT',
      initialDelayMs: 250,
      maxDelayMs: 5000,
      progressiveBackoffMultiplier: 1.5
    },
    dsgBlueprint: {
      nodes: [
        {
          nodeIdentifier: 'node-service-tarpit-interceptor',
          nodeType: 'TARPIT_INTERCEPTOR',
          assetDescription: 'Asynchronous Slow-Response Rate Tarpit Buffer',
          layerClassification: 'CONTROLLED_DYNAMIC_STATE',
          structuredAttributes: {
            bufferCapacity: 50,
            maxConnectionHoldSec: 30
          }
        },
        {
          nodeIdentifier: 'node-service-burst-observer',
          nodeType: 'OBSERVATIONAL_TRACKER',
          assetDescription: 'Burst Rate Attenuation and Response Latency Monitor',
          layerClassification: 'OBSERVATIONAL_ATTACKER_STATE',
          structuredAttributes: {
            monitorMetric: 'REQUESTS_PER_SECOND',
            targetRate: 0.2
          }
        }
      ],
      edges: [
        {
          sourceNodeIdentifier: 'node-service-tarpit-interceptor',
          targetNodeIdentifier: 'node-service-burst-observer',
          edgeType: 'LATENCY_OBSERVATION',
          structuredAttributes: { logDelayChanges: true }
        }
      ]
    }
  }
];
