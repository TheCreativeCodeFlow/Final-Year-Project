/**
 * Behavioral Telemetry Pipeline Service (Stage 4B)
 *
 * Orchestrates the end-to-end telemetry and feature extraction pipeline:
 * 1. Validates and normalizes raw telemetry into the Canonical Telemetry Event Schema.
 * 2. Correlates events into tenant- and application-scoped behavioral sessions.
 * 3. Persists the source SecurityObservation (preserving original evidence without modification).
 * 4. Extracts time-windowed behavioral feature sets (30s, 5m, 15m).
 * 5. Compares against established behavioral baselines (calculating rate, diversity, and failure deltas).
 * 6. Idempotently stores derived BehavioralFeatureSet records with unique window bounds.
 */

import crypto from 'node:crypto';
import { validateAndNormalizeCanonicalEvent } from '../telemetry/canonical-event.schema.js';
import { BehavioralSessionCorrelator } from './behavioral-session-correlator.service.js';
import { BehavioralFeatureExtractor } from './behavioral-feature-extractor.service.js';
import { BehavioralBaselineService } from './behavioral-baseline.service.js';
import { logger } from '../utils/logger.js';

export class BehavioralTelemetryPipelineService {
  /**
   * @param {object} options
   * @param {import('@prisma/client').PrismaClient} options.prisma
   * @param {BehavioralSessionCorrelator} [options.sessionCorrelator]
   * @param {BehavioralFeatureExtractor} [options.featureExtractor]
   * @param {BehavioralBaselineService} [options.baselineService]
   */
  constructor(options = {}) {
    this.prisma = options.prisma;
    this.sessionCorrelator = options.sessionCorrelator || new BehavioralSessionCorrelator();
    this.featureExtractor = options.featureExtractor || new BehavioralFeatureExtractor();
    this.baselineService = options.baselineService || new BehavioralBaselineService();
  }

  /**
   * Processes an incoming raw telemetry event through normalization, correlation,
   * persistence, and feature extraction.
   *
   * @param {object} rawEvent
   * @param {object} [options]
   * @param {boolean} [options.extractFeatures=true]
   * @param {string} [options.expectedTenantId]
   * @returns {Promise<{
   *   success: boolean,
   *   duplicate?: boolean,
   *   canonicalEvent?: object,
   *   correlation?: object,
   *   observationId?: string,
   *   featureSets?: Array<object>,
   *   errors?: string[]
   * }>}
   */
  async processTelemetryEvent(rawEvent, options = {}) {
    // 1. Validation and Normalization
    const normResult = validateAndNormalizeCanonicalEvent(rawEvent, options);
    if (!normResult.valid) {
      return { success: false, errors: normResult.errors };
    }

    const event = normResult.canonicalEvent;

    // 2. Behavioral Session Correlation
    const correlation = this.sessionCorrelator.correlateEvent(event);
    event.sessionReference = correlation.sessionRef;

    // 3. Check for Duplicate Observation (Idempotency)
    const existingObs = await this.prisma.securityObservation.findFirst({
      where: {
        tenantId: event.tenantId,
        correlationId: event.correlationId
      }
    });

    let observationId;
    let observationIdentifier;
    let isDuplicate = false;

    if (existingObs) {
      observationId = existingObs.id;
      observationIdentifier = existingObs.observationIdentifier;
      isDuplicate = true;
    } else {
      // 4. Persist Raw Observation (Preserve source evidence separately from features)
      observationIdentifier = `obs-gw-${crypto.randomUUID().slice(0, 8)}`;
      const createdObs = await this.prisma.securityObservation.create({
        data: {
          tenantId: event.tenantId,
          applicationId: event.applicationId,
          observationIdentifier,
          observationType: 'GATEWAY_REQUEST',
          evidenceProvenance: event.provenance.subsystem,
          correlationId: event.correlationId,
          evidenceStatus: 'OBSERVED',
          sanitizedStructuredEvidence: {
            eventId: event.eventId,
            schemaVersion: event.schemaVersion,
            method: event.httpMethod,
            normalizedRoute: event.normalizedRoute,
            responseStatus: event.responseStatus,
            durationMs: event.durationMs,
            requestSizeBytes: event.requestSizeBytes,
            responseSizeBytes: event.responseSizeBytes,
            sessionRef: correlation.sessionRef,
            correlationType: correlation.correlationType,
            isPseudonymous: correlation.isPseudonymous,
            sourceMetadata: event.sourceMetadata,
            forwardingResult: event.forwardingResult,
            validationOutcome: event.validationOutcome,
            timestamp: event.timestamp
          }
        }
      });
      observationId = createdObs.id;
    }

    let recordedRoutingDecisionId = null;

    // Record RoutingDecision & RoutingOutcome if present
    if (!isDuplicate && rawEvent.routingDecision && typeof rawEvent.routingDecision === 'object') {
      const routingDecision = await this.prisma.routingDecision.create({
        data: {
          tenantId: event.tenantId,
          targetApplicationId: event.applicationId,
          intendedAction: rawEvent.routingDecision.intendedAction || 'NORMAL_ROUTING',
          correlationId: event.correlationId,
          decisionStatus: 'DECIDED'
        }
      });
      recordedRoutingDecisionId = routingDecision.id;

      await this.prisma.routingOutcome.create({
        data: {
          tenantId: event.tenantId,
          routingDecisionId: routingDecision.id,
          outcomeStatus: rawEvent.routingDecision.outcomeStatus || 'FORWARDED_TO_ORIGIN',
          outcomeSource: 'GATEWAY_REVERSE_PROXY',
          failureOrDiscrepancyDetails: rawEvent.routingDecision.failureDetails || null
        }
      });
    }

    // 5. Time-Windowed Behavioral Feature Extraction
    let persistedFeatureSets = [];
    if (options.extractFeatures !== false && event.applicationId) {
      try {
        // Query recent observations for this (tenantId, applicationId, sessionRef) within 15m window
        const fifteenMinAgo = new Date(new Date(event.timestamp).getTime() - 15 * 60 * 1000);

        const recentObservations = await this.prisma.securityObservation.findMany({
          where: {
            tenantId: event.tenantId,
            applicationId: event.applicationId,
            observedAt: { gte: fifteenMinAgo }
          },
          orderBy: { observedAt: 'asc' },
          take: 200
        });

        // Convert stored observation records to canonical event structures
        const windowEvents = recentObservations
          .map((obs) => {
            const ev = obs.sanitizedStructuredEvidence || {};
            // Filter by matching sessionRef if session correlation is tracked
            if (ev.sessionRef && ev.sessionRef !== correlation.sessionRef) {
              return null;
            }
            return {
              eventId: ev.eventId || obs.id,
              schemaVersion: ev.schemaVersion || '1.0.0',
              correlationId: obs.correlationId,
              tenantId: obs.tenantId,
              applicationId: obs.applicationId,
              timestamp: ev.timestamp || obs.observedAt.toISOString(),
              httpMethod: ev.method || 'GET',
              normalizedRoute: ev.normalizedRoute || '/',
              responseStatus: ev.responseStatus || 200,
              requestSizeBytes: ev.requestSizeBytes || 0,
              responseSizeBytes: ev.responseSizeBytes || 0,
              durationMs: ev.durationMs || 0,
              forwardingResult: ev.forwardingResult || 'SUCCESS',
              validationOutcome: ev.validationOutcome || 'VALIDATED',
              sessionReference: ev.sessionRef || null,
              persistenceStatus: 'TELEMETRY_PERSISTED'
            };
          })
          .filter(Boolean);

        // Fetch active baseline for this application
        const activeBaseline = await this.prisma.behavioralBaseline.findFirst({
          where: {
            tenantId: event.tenantId,
            applicationId: event.applicationId,
            status: 'ESTABLISHED'
          },
          orderBy: { createdAt: 'desc' }
        });

        // Compute features
        const computedFeatureSets = this.featureExtractor.extractFeatures({
          canonicalEvents: windowEvents,
          tenantId: event.tenantId,
          applicationId: event.applicationId,
          sessionRef: correlation.sessionRef,
          referenceTimestamp: event.timestamp,
          baseline: activeBaseline
        });

        // 6. Idempotent Persistence into PostgreSQL
        for (const fSet of computedFeatureSets) {
          const persisted = await this.prisma.behavioralFeatureSet.upsert({
            where: {
              tenantId_applicationId_sessionRef_windowLabel_windowEnd: {
                tenantId: fSet.tenantId,
                applicationId: fSet.applicationId,
                sessionRef: fSet.sessionRef,
                windowLabel: fSet.windowLabel,
                windowEnd: new Date(fSet.windowEnd)
              }
            },
            create: {
              tenantId: fSet.tenantId,
              applicationId: fSet.applicationId,
              sessionRef: fSet.sessionRef,
              windowLabel: fSet.windowLabel,
              windowDurationSeconds: fSet.windowDurationSeconds,
              windowStart: new Date(fSet.windowStart),
              windowEnd: new Date(fSet.windowEnd),
              observationCount: fSet.observationCount,
              features: fSet.features,
              schemaVersion: fSet.schemaVersion,
              extractionVersion: fSet.extractionVersion,
              qualityMetadata: fSet.qualityMetadata,
              sourceObservationIds: fSet.sourceObservationIds
            },
            update: {
              observationCount: fSet.observationCount,
              features: fSet.features,
              qualityMetadata: fSet.qualityMetadata,
              sourceObservationIds: fSet.sourceObservationIds
            }
          });
          persistedFeatureSets.push(persisted);
        }
      } catch (err) {
        logger.error('Error during behavioral feature extraction or persistence', {
          correlationId: event.correlationId,
          error: err.message
        });
      }
    }

    return {
      success: true,
      duplicate: isDuplicate,
      canonicalEvent: event,
      correlation,
      observationId,
      observationIdentifier,
      routingDecisionId: recordedRoutingDecisionId,
      featureSets: persistedFeatureSets
    };
  }
}
