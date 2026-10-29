-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "protected_applications" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "applicationIdentifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROTECTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "protected_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deception_policies" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "policyIdentifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "version" INTEGER NOT NULL DEFAULT 1,
    "triggerConditions" JSONB NOT NULL,
    "requiredEvidenceCriteria" JSONB NOT NULL,
    "permittedActions" JSONB NOT NULL,
    "prohibitedActions" JSONB NOT NULL,
    "protectedIsolationConstraints" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deception_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deception_strategies" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "strategyIdentifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "strategyType" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "prerequisites" JSONB NOT NULL,
    "permittedStateChangeProposal" JSONB NOT NULL,
    "isolationRequirements" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deception_strategies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deception_environments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "environmentIdentifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "lifecycleState" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isolationConfiguration" JSONB NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deception_environments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investigations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "applicationId" TEXT,
    "investigationIdentifier" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "summary" TEXT NOT NULL,
    "evidenceReferences" JSONB,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investigations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attacker_profiles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "profileIdentifier" TEXT NOT NULL,
    "displayLabel" TEXT NOT NULL,
    "observedBehaviorIndicators" JSONB NOT NULL,
    "firstSeenAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attacker_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investigation_attacker_profiles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "investigationId" TEXT NOT NULL,
    "attackerProfileId" TEXT NOT NULL,
    "associatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "investigation_attacker_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_observations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "applicationId" TEXT,
    "investigationId" TEXT,
    "observationIdentifier" TEXT NOT NULL,
    "observationType" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sanitizedStructuredEvidence" JSONB NOT NULL,
    "evidenceProvenance" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "evidenceStatus" TEXT NOT NULL DEFAULT 'OBSERVED',

    CONSTRAINT "security_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "behavioral_assessments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "observationId" TEXT,
    "investigationId" TEXT,
    "classification" TEXT NOT NULL,
    "riskScore" DOUBLE PRECISION,
    "confidenceScore" DOUBLE PRECISION,
    "modelOrRuleVersion" TEXT NOT NULL,
    "explanation" JSONB,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "behavioral_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_decisions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "observationId" TEXT,
    "assessmentId" TEXT,
    "policyId" TEXT,
    "policyVersion" INTEGER,
    "decisionResult" TEXT NOT NULL,
    "decisionRationale" TEXT NOT NULL,
    "evidenceReferences" JSONB,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routing_decisions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "policyDecisionId" TEXT,
    "intendedAction" TEXT NOT NULL,
    "targetApplicationId" TEXT,
    "targetEnvironmentId" TEXT,
    "correlationId" TEXT NOT NULL,
    "decisionStatus" TEXT NOT NULL DEFAULT 'DECIDED',
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "routing_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routing_outcomes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "routingDecisionId" TEXT NOT NULL,
    "outcomeStatus" TEXT NOT NULL,
    "outcomeSource" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "failureOrDiscrepancyDetails" JSONB,

    CONSTRAINT "routing_outcomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_evidences" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "routingDecisionId" TEXT NOT NULL,
    "evidenceStatus" TEXT NOT NULL,
    "evidenceSource" TEXT,
    "evidenceData" JSONB,
    "recordedAt" TIMESTAMP(3),
    "correlationId" TEXT NOT NULL,

    CONSTRAINT "execution_evidences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deception_graphs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "graphIdentifier" TEXT NOT NULL,
    "graphVersion" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deception_graphs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deception_graph_nodes" (
    "id" TEXT NOT NULL,
    "graphId" TEXT NOT NULL,
    "nodeIdentifier" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "assetDescription" TEXT NOT NULL,
    "layerClassification" TEXT NOT NULL,
    "structuredAttributes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deception_graph_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deception_graph_edges" (
    "id" TEXT NOT NULL,
    "graphId" TEXT NOT NULL,
    "sourceNodeId" TEXT NOT NULL,
    "targetNodeId" TEXT NOT NULL,
    "edgeType" TEXT NOT NULL,
    "structuredAttributes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deception_graph_edges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deception_graph_transitions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "graphId" TEXT NOT NULL,
    "previousState" JSONB NOT NULL,
    "proposedState" JSONB NOT NULL,
    "transitionStatus" TEXT NOT NULL DEFAULT 'PROPOSED',
    "triggeringObservationId" TEXT,
    "triggeringDecisionId" TEXT,
    "provenance" TEXT NOT NULL,
    "proposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "deception_graph_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "actorIdentifier" TEXT,
    "action" TEXT NOT NULL,
    "targetEntityType" TEXT NOT NULL,
    "targetEntityId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "correlationId" TEXT,
    "structuredMetadata" JSONB NOT NULL,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_identifier_key" ON "tenants"("identifier");

-- CreateIndex
CREATE INDEX "protected_applications_tenantId_idx" ON "protected_applications"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "protected_applications_id_tenantId_key" ON "protected_applications"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "protected_applications_tenantId_applicationIdentifier_key" ON "protected_applications"("tenantId", "applicationIdentifier");

-- CreateIndex
CREATE INDEX "deception_policies_tenantId_idx" ON "deception_policies"("tenantId");

-- CreateIndex
CREATE INDEX "deception_policies_priority_idx" ON "deception_policies"("priority");

-- CreateIndex
CREATE UNIQUE INDEX "deception_policies_policyIdentifier_version_key" ON "deception_policies"("policyIdentifier", "version");

-- CreateIndex
CREATE UNIQUE INDEX "deception_strategies_strategyIdentifier_key" ON "deception_strategies"("strategyIdentifier");

-- CreateIndex
CREATE INDEX "deception_strategies_tenantId_idx" ON "deception_strategies"("tenantId");

-- CreateIndex
CREATE INDEX "deception_environments_tenantId_idx" ON "deception_environments"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "deception_environments_id_tenantId_key" ON "deception_environments"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "deception_environments_tenantId_environmentIdentifier_key" ON "deception_environments"("tenantId", "environmentIdentifier");

-- CreateIndex
CREATE INDEX "investigations_tenantId_idx" ON "investigations"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "investigations_id_tenantId_key" ON "investigations"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "investigations_tenantId_investigationIdentifier_key" ON "investigations"("tenantId", "investigationIdentifier");

-- CreateIndex
CREATE INDEX "attacker_profiles_tenantId_idx" ON "attacker_profiles"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "attacker_profiles_id_tenantId_key" ON "attacker_profiles"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "attacker_profiles_tenantId_profileIdentifier_key" ON "attacker_profiles"("tenantId", "profileIdentifier");

-- CreateIndex
CREATE INDEX "investigation_attacker_profiles_tenantId_idx" ON "investigation_attacker_profiles"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "investigation_attacker_profiles_investigationId_attackerPro_key" ON "investigation_attacker_profiles"("investigationId", "attackerProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "security_observations_observationIdentifier_key" ON "security_observations"("observationIdentifier");

-- CreateIndex
CREATE INDEX "security_observations_tenantId_idx" ON "security_observations"("tenantId");

-- CreateIndex
CREATE INDEX "security_observations_correlationId_idx" ON "security_observations"("correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "security_observations_id_tenantId_key" ON "security_observations"("id", "tenantId");

-- CreateIndex
CREATE INDEX "behavioral_assessments_tenantId_idx" ON "behavioral_assessments"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "behavioral_assessments_id_tenantId_key" ON "behavioral_assessments"("id", "tenantId");

-- CreateIndex
CREATE INDEX "policy_decisions_tenantId_idx" ON "policy_decisions"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "policy_decisions_id_tenantId_key" ON "policy_decisions"("id", "tenantId");

-- CreateIndex
CREATE INDEX "routing_decisions_tenantId_idx" ON "routing_decisions"("tenantId");

-- CreateIndex
CREATE INDEX "routing_decisions_correlationId_idx" ON "routing_decisions"("correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "routing_decisions_id_tenantId_key" ON "routing_decisions"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "routing_outcomes_routingDecisionId_key" ON "routing_outcomes"("routingDecisionId");

-- CreateIndex
CREATE INDEX "routing_outcomes_tenantId_idx" ON "routing_outcomes"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "routing_outcomes_routingDecisionId_tenantId_key" ON "routing_outcomes"("routingDecisionId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "routing_outcomes_id_tenantId_key" ON "routing_outcomes"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "execution_evidences_routingDecisionId_key" ON "execution_evidences"("routingDecisionId");

-- CreateIndex
CREATE INDEX "execution_evidences_tenantId_idx" ON "execution_evidences"("tenantId");

-- CreateIndex
CREATE INDEX "execution_evidences_correlationId_idx" ON "execution_evidences"("correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "execution_evidences_routingDecisionId_tenantId_key" ON "execution_evidences"("routingDecisionId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "execution_evidences_id_tenantId_key" ON "execution_evidences"("id", "tenantId");

-- CreateIndex
CREATE INDEX "deception_graphs_tenantId_idx" ON "deception_graphs"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "deception_graphs_id_tenantId_key" ON "deception_graphs"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "deception_graphs_tenantId_graphIdentifier_graphVersion_key" ON "deception_graphs"("tenantId", "graphIdentifier", "graphVersion");

-- CreateIndex
CREATE INDEX "deception_graph_nodes_graphId_idx" ON "deception_graph_nodes"("graphId");

-- CreateIndex
CREATE UNIQUE INDEX "deception_graph_nodes_id_graphId_key" ON "deception_graph_nodes"("id", "graphId");

-- CreateIndex
CREATE UNIQUE INDEX "deception_graph_nodes_graphId_nodeIdentifier_key" ON "deception_graph_nodes"("graphId", "nodeIdentifier");

-- CreateIndex
CREATE INDEX "deception_graph_edges_graphId_idx" ON "deception_graph_edges"("graphId");

-- CreateIndex
CREATE UNIQUE INDEX "deception_graph_edges_graphId_sourceNodeId_targetNodeId_edg_key" ON "deception_graph_edges"("graphId", "sourceNodeId", "targetNodeId", "edgeType");

-- CreateIndex
CREATE INDEX "deception_graph_transitions_tenantId_idx" ON "deception_graph_transitions"("tenantId");

-- CreateIndex
CREATE INDEX "deception_graph_transitions_graphId_idx" ON "deception_graph_transitions"("graphId");

-- CreateIndex
CREATE INDEX "audit_events_tenantId_idx" ON "audit_events"("tenantId");

-- CreateIndex
CREATE INDEX "audit_events_timestamp_idx" ON "audit_events"("timestamp");

-- CreateIndex
CREATE INDEX "audit_events_correlationId_idx" ON "audit_events"("correlationId");

-- AddForeignKey
ALTER TABLE "protected_applications" ADD CONSTRAINT "protected_applications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deception_policies" ADD CONSTRAINT "deception_policies_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deception_strategies" ADD CONSTRAINT "deception_strategies_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deception_environments" ADD CONSTRAINT "deception_environments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigations" ADD CONSTRAINT "investigations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigations" ADD CONSTRAINT "investigations_applicationId_tenantId_fkey" FOREIGN KEY ("applicationId", "tenantId") REFERENCES "protected_applications"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attacker_profiles" ADD CONSTRAINT "attacker_profiles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigation_attacker_profiles" ADD CONSTRAINT "investigation_attacker_profiles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigation_attacker_profiles" ADD CONSTRAINT "investigation_attacker_profiles_investigationId_tenantId_fkey" FOREIGN KEY ("investigationId", "tenantId") REFERENCES "investigations"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigation_attacker_profiles" ADD CONSTRAINT "investigation_attacker_profiles_attackerProfileId_tenantId_fkey" FOREIGN KEY ("attackerProfileId", "tenantId") REFERENCES "attacker_profiles"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_observations" ADD CONSTRAINT "security_observations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_observations" ADD CONSTRAINT "security_observations_applicationId_tenantId_fkey" FOREIGN KEY ("applicationId", "tenantId") REFERENCES "protected_applications"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_observations" ADD CONSTRAINT "security_observations_investigationId_tenantId_fkey" FOREIGN KEY ("investigationId", "tenantId") REFERENCES "investigations"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "behavioral_assessments" ADD CONSTRAINT "behavioral_assessments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "behavioral_assessments" ADD CONSTRAINT "behavioral_assessments_observationId_tenantId_fkey" FOREIGN KEY ("observationId", "tenantId") REFERENCES "security_observations"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "behavioral_assessments" ADD CONSTRAINT "behavioral_assessments_investigationId_tenantId_fkey" FOREIGN KEY ("investigationId", "tenantId") REFERENCES "investigations"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_decisions" ADD CONSTRAINT "policy_decisions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_decisions" ADD CONSTRAINT "policy_decisions_observationId_tenantId_fkey" FOREIGN KEY ("observationId", "tenantId") REFERENCES "security_observations"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_decisions" ADD CONSTRAINT "policy_decisions_assessmentId_tenantId_fkey" FOREIGN KEY ("assessmentId", "tenantId") REFERENCES "behavioral_assessments"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_decisions" ADD CONSTRAINT "policy_decisions_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "deception_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routing_decisions" ADD CONSTRAINT "routing_decisions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routing_decisions" ADD CONSTRAINT "routing_decisions_policyDecisionId_tenantId_fkey" FOREIGN KEY ("policyDecisionId", "tenantId") REFERENCES "policy_decisions"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routing_decisions" ADD CONSTRAINT "routing_decisions_targetApplicationId_tenantId_fkey" FOREIGN KEY ("targetApplicationId", "tenantId") REFERENCES "protected_applications"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routing_decisions" ADD CONSTRAINT "routing_decisions_targetEnvironmentId_tenantId_fkey" FOREIGN KEY ("targetEnvironmentId", "tenantId") REFERENCES "deception_environments"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routing_outcomes" ADD CONSTRAINT "routing_outcomes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routing_outcomes" ADD CONSTRAINT "routing_outcomes_routingDecisionId_tenantId_fkey" FOREIGN KEY ("routingDecisionId", "tenantId") REFERENCES "routing_decisions"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_evidences" ADD CONSTRAINT "execution_evidences_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_evidences" ADD CONSTRAINT "execution_evidences_routingDecisionId_tenantId_fkey" FOREIGN KEY ("routingDecisionId", "tenantId") REFERENCES "routing_decisions"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deception_graphs" ADD CONSTRAINT "deception_graphs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deception_graphs" ADD CONSTRAINT "deception_graphs_environmentId_tenantId_fkey" FOREIGN KEY ("environmentId", "tenantId") REFERENCES "deception_environments"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deception_graph_nodes" ADD CONSTRAINT "deception_graph_nodes_graphId_fkey" FOREIGN KEY ("graphId") REFERENCES "deception_graphs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deception_graph_edges" ADD CONSTRAINT "deception_graph_edges_graphId_fkey" FOREIGN KEY ("graphId") REFERENCES "deception_graphs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deception_graph_edges" ADD CONSTRAINT "deception_graph_edges_sourceNodeId_graphId_fkey" FOREIGN KEY ("sourceNodeId", "graphId") REFERENCES "deception_graph_nodes"("id", "graphId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deception_graph_edges" ADD CONSTRAINT "deception_graph_edges_targetNodeId_graphId_fkey" FOREIGN KEY ("targetNodeId", "graphId") REFERENCES "deception_graph_nodes"("id", "graphId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deception_graph_transitions" ADD CONSTRAINT "deception_graph_transitions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deception_graph_transitions" ADD CONSTRAINT "deception_graph_transitions_graphId_tenantId_fkey" FOREIGN KEY ("graphId", "tenantId") REFERENCES "deception_graphs"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
