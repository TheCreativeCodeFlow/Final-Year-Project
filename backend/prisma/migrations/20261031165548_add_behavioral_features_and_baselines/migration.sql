-- CreateTable
CREATE TABLE "behavioral_feature_sets" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "applicationId" TEXT,
    "sessionRef" TEXT NOT NULL,
    "windowLabel" TEXT NOT NULL,
    "windowDurationSeconds" INTEGER NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "observationCount" INTEGER NOT NULL,
    "features" JSONB NOT NULL,
    "schemaVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "extractionVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "qualityMetadata" JSONB NOT NULL,
    "sourceObservationIds" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "behavioral_feature_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "behavioral_baselines" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "applicationId" TEXT,
    "baselineVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "status" TEXT NOT NULL DEFAULT 'CALIBRATING',
    "observationCount" INTEGER NOT NULL DEFAULT 0,
    "sampleWindowHours" INTEGER NOT NULL DEFAULT 24,
    "metrics" JSONB NOT NULL,
    "establishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "behavioral_baselines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "behavioral_feature_sets_tenantId_idx" ON "behavioral_feature_sets"("tenantId");

-- CreateIndex
CREATE INDEX "behavioral_feature_sets_applicationId_idx" ON "behavioral_feature_sets"("applicationId");

-- CreateIndex
CREATE INDEX "behavioral_feature_sets_sessionRef_idx" ON "behavioral_feature_sets"("sessionRef");

-- CreateIndex
CREATE INDEX "behavioral_feature_sets_windowEnd_idx" ON "behavioral_feature_sets"("windowEnd");

-- CreateIndex
CREATE UNIQUE INDEX "behavioral_feature_sets_tenantId_applicationId_sessionRef_w_key" ON "behavioral_feature_sets"("tenantId", "applicationId", "sessionRef", "windowLabel", "windowEnd");

-- CreateIndex
CREATE INDEX "behavioral_baselines_tenantId_idx" ON "behavioral_baselines"("tenantId");

-- CreateIndex
CREATE INDEX "behavioral_baselines_applicationId_idx" ON "behavioral_baselines"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "behavioral_baselines_tenantId_applicationId_baselineVersion_key" ON "behavioral_baselines"("tenantId", "applicationId", "baselineVersion");

-- AddForeignKey
ALTER TABLE "behavioral_feature_sets" ADD CONSTRAINT "behavioral_feature_sets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "behavioral_feature_sets" ADD CONSTRAINT "behavioral_feature_sets_applicationId_tenantId_fkey" FOREIGN KEY ("applicationId", "tenantId") REFERENCES "protected_applications"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "behavioral_baselines" ADD CONSTRAINT "behavioral_baselines_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "behavioral_baselines" ADD CONSTRAINT "behavioral_baselines_applicationId_tenantId_fkey" FOREIGN KEY ("applicationId", "tenantId") REFERENCES "protected_applications"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
