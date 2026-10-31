/**
 * Behavioral Features and Baselines Controller (Stage 4B)
 *
 * Provides tenant-isolated REST endpoints to query and manage derived behavioral telemetry:
 * 1. Time-windowed behavioral feature sets (30s, 5m, 15m).
 * 2. Tenant and application behavioral baselines.
 * 3. On-demand baseline calibration from recorded historical observations.
 *
 * Enforces strict tenant boundaries on every database operation.
 */

import { getPrismaClient } from '../db/client.js';
import { BehavioralBaselineService } from '../services/behavioral-baseline.service.js';
import { logger } from '../utils/logger.js';

const baselineService = new BehavioralBaselineService();

/**
 * Lists derived behavioral feature sets for the authenticated tenant.
 */
export async function listBehavioralFeatures(req, res, next) {
  const prisma = req.prisma || getPrismaClient();
  const tenantId = req.params.tenantId;
  const { applicationId, sessionRef, windowLabel, limit = 50, offset = 0 } = req.query;

  try {
    const where = { tenantId };
    if (applicationId) where.applicationId = applicationId;
    if (sessionRef) where.sessionRef = sessionRef;
    if (windowLabel) where.windowLabel = windowLabel;

    const [featureSets, total] = await Promise.all([
      prisma.behavioralFeatureSet.findMany({
        where,
        orderBy: { windowEnd: 'desc' },
        take: Math.min(Number(limit) || 50, 100),
        skip: Number(offset) || 0
      }),
      prisma.behavioralFeatureSet.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: featureSets,
      pagination: {
        total,
        limit: Math.min(Number(limit) || 50, 100),
        offset: Number(offset) || 0
      }
    });
  } catch (err) {
    logger.error('Failed to list behavioral features', { tenantId, error: err.message });
    next(err);
  }
}

/**
 * Retrieves a single behavioral feature set by ID within tenant scope.
 */
export async function getBehavioralFeatureById(req, res, next) {
  const prisma = req.prisma || getPrismaClient();
  const { tenantId, id } = req.params;

  try {
    const featureSet = await prisma.behavioralFeatureSet.findFirst({
      where: { id, tenantId }
    });

    if (!featureSet) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'FEATURE_SET_NOT_FOUND',
          message: `Behavioral feature set "${id}" not found for this tenant.`
        }
      });
    }

    res.status(200).json({
      success: true,
      data: featureSet
    });
  } catch (err) {
    logger.error('Failed to get behavioral feature set by ID', { tenantId, id, error: err.message });
    next(err);
  }
}

/**
 * Lists behavioral baselines for the authenticated tenant.
 */
export async function listBehavioralBaselines(req, res, next) {
  const prisma = req.prisma || getPrismaClient();
  const tenantId = req.params.tenantId;
  const { applicationId, status } = req.query;

  try {
    const where = { tenantId };
    if (applicationId) where.applicationId = applicationId;
    if (status) where.status = status;

    const baselines = await prisma.behavioralBaseline.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({
      success: true,
      data: baselines
    });
  } catch (err) {
    logger.error('Failed to list behavioral baselines', { tenantId, error: err.message });
    next(err);
  }
}

/**
 * Retrieves a single behavioral baseline by ID within tenant scope.
 */
export async function getBehavioralBaselineById(req, res, next) {
  const prisma = req.prisma || getPrismaClient();
  const { tenantId, id } = req.params;

  try {
    const baseline = await prisma.behavioralBaseline.findFirst({
      where: { id, tenantId }
    });

    if (!baseline) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'BASELINE_NOT_FOUND',
          message: `Behavioral baseline "${id}" not found for this tenant.`
        }
      });
    }

    res.status(200).json({
      success: true,
      data: baseline
    });
  } catch (err) {
    logger.error('Failed to get behavioral baseline by ID', { tenantId, id, error: err.message });
    next(err);
  }
}

/**
 * Calibrates or recomputes a behavioral baseline for an application from historical observations.
 */
export async function calibrateBaseline(req, res, next) {
  const prisma = req.prisma || getPrismaClient();
  const tenantId = req.params.tenantId;
  const { applicationId, sampleWindowHours = 24 } = req.body;

  try {
    if (applicationId) {
      const app = await prisma.protectedApplication.findFirst({
        where: { id: applicationId, tenantId }
      });
      if (!app) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'APPLICATION_NOT_FOUND',
            message: `Application "${applicationId}" not found for this tenant.`
          }
        });
      }
    }

    // Query historical observations within the sampling window
    const windowStart = new Date(Date.now() - Number(sampleWindowHours) * 3600 * 1000);
    const observations = await prisma.securityObservation.findMany({
      where: {
        tenantId,
        applicationId: applicationId || undefined,
        observedAt: { gte: windowStart }
      },
      orderBy: { observedAt: 'asc' },
      take: 2000
    });

    // Compute baseline statistics
    const baselineResult = baselineService.computeBaseline({
      observations: observations.map((o) => {
        const ev = o.sanitizedStructuredEvidence || {};
        return {
          timestamp: ev.timestamp || o.observedAt.toISOString(),
          observedAt: o.observedAt.toISOString(),
          httpMethod: ev.method || 'GET',
          normalizedRoute: ev.normalizedRoute || '/',
          responseStatus: ev.responseStatus || 200,
          forwardingResult: ev.forwardingResult || 'SUCCESS',
          validationOutcome: ev.validationOutcome || 'VALIDATED'
        };
      }),
      tenantId,
      applicationId: applicationId || null,
      sampleWindowHours: Number(sampleWindowHours)
    });

    // Idempotent upsert into PostgreSQL
    const baselineRecord = await prisma.behavioralBaseline.upsert({
      where: {
        tenantId_applicationId_baselineVersion: {
          tenantId,
          applicationId: applicationId || null,
          baselineVersion: baselineResult.baselineVersion
        }
      },
      create: {
        tenantId,
        applicationId: applicationId || null,
        baselineVersion: baselineResult.baselineVersion,
        status: baselineResult.status,
        observationCount: baselineResult.observationCount,
        sampleWindowHours: baselineResult.sampleWindowHours,
        metrics: baselineResult.metrics,
        establishedAt: baselineResult.establishedAt ? new Date(baselineResult.establishedAt) : null
      },
      update: {
        status: baselineResult.status,
        observationCount: baselineResult.observationCount,
        sampleWindowHours: baselineResult.sampleWindowHours,
        metrics: baselineResult.metrics,
        establishedAt: baselineResult.establishedAt ? new Date(baselineResult.establishedAt) : null
      }
    });

    res.status(200).json({
      success: true,
      data: baselineRecord
    });
  } catch (err) {
    logger.error('Failed to calibrate behavioral baseline', { tenantId, applicationId, error: err.message });
    next(err);
  }
}
