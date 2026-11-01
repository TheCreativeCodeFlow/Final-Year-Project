-- AlterTable
ALTER TABLE "behavioral_assessments" ADD COLUMN     "applicationId" TEXT,
ADD COLUMN     "assessmentLabel" TEXT NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "dataQualityState" TEXT NOT NULL DEFAULT 'COMPLETE',
ADD COLUMN     "mlAnomalyResult" JSONB,
ADD COLUMN     "ruleFindings" JSONB,
ADD COLUMN     "sessionRef" TEXT,
ADD COLUMN     "telemetryLossDetected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "windowLabel" TEXT;

-- CreateTable
CREATE TABLE "detection_model_versions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "modelIdentifier" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "algorithm" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "hyperparameters" JSONB NOT NULL,
    "modelArtifact" JSONB NOT NULL,
    "featureSchemaVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "featureList" JSONB NOT NULL,
    "trainingSampleCount" INTEGER NOT NULL,
    "trainingPeriodStart" TIMESTAMP(3),
    "trainingPeriodEnd" TIMESTAMP(3),
    "decisionThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.60,
    "evaluationMetrics" JSONB,
    "trainedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "detection_model_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_training_runs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "modelVersionId" TEXT,
    "algorithm" TEXT NOT NULL DEFAULT 'ISOLATION_FOREST',
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "sampleCount" INTEGER NOT NULL DEFAULT 0,
    "trainingDurationMs" INTEGER,
    "errorMessage" TEXT,
    "evaluationMetrics" JSONB,
    "initiatedBy" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "model_training_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detection_rule_versions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "ruleIdentifier" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "severity" TEXT NOT NULL DEFAULT 'HIGH',
    "conditions" JSONB NOT NULL,
    "thresholdOverrides" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "detection_rule_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "detection_model_versions_tenantId_idx" ON "detection_model_versions"("tenantId");

-- CreateIndex
CREATE INDEX "detection_model_versions_applicationId_idx" ON "detection_model_versions"("applicationId");

-- CreateIndex
CREATE INDEX "detection_model_versions_status_idx" ON "detection_model_versions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "detection_model_versions_tenantId_applicationId_version_key" ON "detection_model_versions"("tenantId", "applicationId", "version");

-- CreateIndex
CREATE INDEX "model_training_runs_tenantId_idx" ON "model_training_runs"("tenantId");

-- CreateIndex
CREATE INDEX "model_training_runs_applicationId_idx" ON "model_training_runs"("applicationId");

-- CreateIndex
CREATE INDEX "model_training_runs_status_idx" ON "model_training_runs"("status");

-- CreateIndex
CREATE INDEX "model_training_runs_startedAt_idx" ON "model_training_runs"("startedAt");

-- CreateIndex
CREATE INDEX "detection_rule_versions_tenantId_idx" ON "detection_rule_versions"("tenantId");

-- CreateIndex
CREATE INDEX "detection_rule_versions_ruleIdentifier_idx" ON "detection_rule_versions"("ruleIdentifier");

-- CreateIndex
CREATE UNIQUE INDEX "detection_rule_versions_ruleIdentifier_version_tenantId_key" ON "detection_rule_versions"("ruleIdentifier", "version", "tenantId");

-- CreateIndex
CREATE INDEX "behavioral_assessments_applicationId_idx" ON "behavioral_assessments"("applicationId");

-- CreateIndex
CREATE INDEX "behavioral_assessments_sessionRef_idx" ON "behavioral_assessments"("sessionRef");

-- CreateIndex
CREATE INDEX "behavioral_assessments_assessmentLabel_idx" ON "behavioral_assessments"("assessmentLabel");

-- AddForeignKey
ALTER TABLE "behavioral_assessments" ADD CONSTRAINT "behavioral_assessments_applicationId_tenantId_fkey" FOREIGN KEY ("applicationId", "tenantId") REFERENCES "protected_applications"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detection_model_versions" ADD CONSTRAINT "detection_model_versions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detection_model_versions" ADD CONSTRAINT "detection_model_versions_applicationId_tenantId_fkey" FOREIGN KEY ("applicationId", "tenantId") REFERENCES "protected_applications"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_training_runs" ADD CONSTRAINT "model_training_runs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_training_runs" ADD CONSTRAINT "model_training_runs_applicationId_tenantId_fkey" FOREIGN KEY ("applicationId", "tenantId") REFERENCES "protected_applications"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_training_runs" ADD CONSTRAINT "model_training_runs_modelVersionId_fkey" FOREIGN KEY ("modelVersionId") REFERENCES "detection_model_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detection_rule_versions" ADD CONSTRAINT "detection_rule_versions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
