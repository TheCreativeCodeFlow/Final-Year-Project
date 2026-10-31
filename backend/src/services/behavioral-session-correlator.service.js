/**
 * Behavioral Session Correlation Service (Stage 4B)
 *
 * Correlates canonical telemetry events into coherent behavioral session tracks:
 * 1. Associative session reference resolution:
 *    - Uses trusted explicit session tokens if provided by the application.
 *    - Falls back to pseudonymous ephemeral session keys if absent.
 * 2. Inactivity timeout enforcement (sliding inactivity window; default 15m).
 * 3. Session rotation handling (links predecessor epochs without conflating identities).
 * 4. NAT and shared-IP disambiguation:
 *    - Explicitly maintains separate concepts for client session, network source, investigation, and behavioral profile.
 *    - An IP address alone is NEVER treated as proof of single-actor identity.
 * 5. Bounded in-memory session index to prevent memory exhaustion.
 */

import crypto from 'node:crypto';

const DEFAULT_INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ACTIVE_SESSIONS = 10000;

export class BehavioralSessionCorrelator {
  /**
   * @param {object} [options]
   * @param {number} [options.inactivityTimeoutMs=900000] - 15 minutes
   * @param {number} [options.maxActiveSessions=10000]
   */
  constructor(options = {}) {
    this.inactivityTimeoutMs = options.inactivityTimeoutMs || DEFAULT_INACTIVITY_TIMEOUT_MS;
    this.maxActiveSessions = options.maxActiveSessions || MAX_ACTIVE_SESSIONS;
    // Map key: `${tenantId}:${applicationId || 'none'}:${sessionRef}`
    this.activeSessions = new Map();
  }

  /**
   * Generates a deterministic pseudonymous session reference when an explicit
   * session token is unavailable.
   *
   * @param {object} params
   * @param {string} params.tenantId
   * @param {string} [params.applicationId]
   * @param {string} params.ipSubnetHash
   * @param {number} [params.epochWindowId]
   * @returns {string}
   */
  generatePseudonymousSessionRef({ tenantId, applicationId, ipSubnetHash, epochWindowId = 0 }) {
    const basis = `${tenantId}:${applicationId || 'none'}:${ipSubnetHash}:epoch-${epochWindowId}`;
    const hash = crypto.createHash('sha256').update(basis).digest('hex').slice(0, 16);
    return `pseudo-sess-${hash}`;
  }

  /**
   * Correlates an incoming canonical telemetry event into a behavioral session context.
   *
   * @param {object} canonicalEvent
   * @returns {{
   *   sessionRef: string,
   *   tenantId: string,
   *   applicationId: string|null,
   *   correlationType: string,
   *   isPseudonymous: boolean,
   *   correlationConfidence: number,
   *   caveats: string[],
   *   firstSeenAt: string,
   *   lastActiveAt: string,
   *   eventCount: number,
   *   isNewSession: boolean,
   *   previousSessionRef: string|null
   * }}
   */
  correlateEvent(canonicalEvent) {
    const tenantId = canonicalEvent.tenantId;
    const applicationId = canonicalEvent.applicationId || null;
    const eventTime = new Date(canonicalEvent.timestamp).getTime();
    const eventTimeIso = canonicalEvent.timestamp;
    const ipSubnetHash = canonicalEvent.sourceMetadata?.ipSubnetHash || 'unknown-subnet';

    let rawSessionRef = canonicalEvent.sessionReference;
    let isExplicit = Boolean(rawSessionRef && typeof rawSessionRef === 'string' && rawSessionRef.trim());
    let sessionRef = isExplicit ? rawSessionRef.trim() : null;
    let previousSessionRef = canonicalEvent.previousSessionReference || null;

    let correlationType = isExplicit ? 'EXPLICIT_APPLICATION_SESSION' : 'PSEUDONYMOUS_NETWORK_HEURISTIC';
    let correlationConfidence = isExplicit ? 1.0 : 0.5;
    let caveats = isExplicit
      ? []
      : [
          'SHARED_NAT_COLLISION_POSSIBLE',
          'EPHEMERAL_WINDOW_BOUNDED',
          'NOT_PERMANENT_INDIVIDUAL_IDENTITY'
        ];

    // If no explicit session token, generate initial pseudonymous key
    if (!sessionRef) {
      sessionRef = this.generatePseudonymousSessionRef({
        tenantId,
        applicationId,
        ipSubnetHash,
        epochWindowId: 0
      });
    }

    const sessionLookupKey = `${tenantId}:${applicationId || 'none'}:${sessionRef}`;
    let sessionState = this.activeSessions.get(sessionLookupKey);

    let isNewSession = false;

    if (sessionState) {
      const inactiveDuration = eventTime - sessionState.lastActiveAtMs;

      // Inactivity timeout check: if inactive for longer than threshold, rotate to a new session epoch
      if (inactiveDuration > this.inactivityTimeoutMs) {
        // Record predecessor linkage and bump epoch
        const nextEpoch = sessionState.epoch + 1;
        previousSessionRef = sessionRef;

        if (isExplicit) {
          // Explicit token persisted after timeout is flagged as re-activated
          sessionState.firstSeenAt = eventTimeIso;
          sessionState.lastActiveAt = eventTimeIso;
          sessionState.lastActiveAtMs = eventTime;
          sessionState.eventCount = 1;
          sessionState.epoch = nextEpoch;
          isNewSession = true;
        } else {
          // For pseudonymous correlation, a timeout starts a fresh epoch identifier
          sessionRef = this.generatePseudonymousSessionRef({
            tenantId,
            applicationId,
            ipSubnetHash,
            epochWindowId: nextEpoch
          });

          const newLookupKey = `${tenantId}:${applicationId || 'none'}:${sessionRef}`;
          sessionState = {
            sessionRef,
            tenantId,
            applicationId,
            correlationType,
            isPseudonymous: !isExplicit,
            correlationConfidence,
            caveats,
            firstSeenAt: eventTimeIso,
            lastActiveAt: eventTimeIso,
            lastActiveAtMs: eventTime,
            eventCount: 1,
            epoch: nextEpoch,
            previousSessionRef
          };

          this.storeSession(newLookupKey, sessionState);
          isNewSession = true;
        }
      } else {
        // Active session update
        sessionState.lastActiveAt = eventTimeIso;
        sessionState.lastActiveAtMs = Math.max(sessionState.lastActiveAtMs, eventTime);
        sessionState.eventCount += 1;
      }
    } else {
      // New session registration
      isNewSession = true;
      sessionState = {
        sessionRef,
        tenantId,
        applicationId,
        correlationType,
        isPseudonymous: !isExplicit,
        correlationConfidence,
        caveats,
        firstSeenAt: eventTimeIso,
        lastActiveAt: eventTimeIso,
        lastActiveAtMs: eventTime,
        eventCount: 1,
        epoch: 0,
        previousSessionRef
      };

      this.storeSession(sessionLookupKey, sessionState);
    }

    return {
      sessionRef: sessionState.sessionRef,
      tenantId: sessionState.tenantId,
      applicationId: sessionState.applicationId,
      correlationType: sessionState.correlationType,
      isPseudonymous: sessionState.isPseudonymous,
      correlationConfidence: sessionState.correlationConfidence,
      caveats: sessionState.caveats,
      firstSeenAt: sessionState.firstSeenAt,
      lastActiveAt: sessionState.lastActiveAt,
      eventCount: sessionState.eventCount,
      isNewSession,
      previousSessionRef: sessionState.previousSessionRef
    };
  }

  /**
   * Stores session with LRU-style bounded capacity.
   *
   * @param {string} key
   * @param {object} session
   */
  storeSession(key, session) {
    if (this.activeSessions.size >= this.maxActiveSessions) {
      // Evict oldest session
      const oldestKey = this.activeSessions.keys().next().value;
      if (oldestKey) {
        this.activeSessions.delete(oldestKey);
      }
    }
    this.activeSessions.set(key, session);
  }

  /**
   * Prunes sessions that have exceeded the inactivity timeout.
   *
   * @param {number} [referenceTimeMs=Date.now()]
   * @returns {number} Count of pruned sessions
   */
  pruneInactiveSessions(referenceTimeMs = Date.now()) {
    let prunedCount = 0;
    for (const [key, session] of this.activeSessions.entries()) {
      if (referenceTimeMs - session.lastActiveAtMs > this.inactivityTimeoutMs) {
        this.activeSessions.delete(key);
        prunedCount++;
      }
    }
    return prunedCount;
  }

  /**
   * Diagnostic statistics for the correlation service.
   */
  getStats() {
    return {
      activeSessionCount: this.activeSessions.size,
      maxCapacity: this.maxActiveSessions,
      inactivityTimeoutMs: this.inactivityTimeoutMs
    };
  }

  /**
   * Clears all session states (useful for test resets).
   */
  clear() {
    this.activeSessions.clear();
  }
}
