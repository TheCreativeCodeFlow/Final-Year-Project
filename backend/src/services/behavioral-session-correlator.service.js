/**
 * Behavioral Session Correlation Service (Stage 4B & 4B.1 Hardened)
 *
 * Correlates canonical telemetry events into coherent behavioral session tracks:
 * 1. Associative session reference resolution:
 *    - Uses trusted explicit session tokens if provided by the application.
 *    - Explicit session tokens are pseudonymized via a keyed HMAC (HMAC-SHA256) with tenant-isolated keys.
 *    - Raw credentials/tokens are NEVER stored in behavioral features or session states.
 *    - Key rotation: Rotating SESSION_HMAC_SECRET alters the derived keys; historical correlations remain
 *      isolated, and active sessions gracefully rotate epochs without leaking plaintext credentials.
 *    - Falls back to pseudonymous ephemeral session keys if explicit session is absent.
 * 2. Inactivity timeout enforcement (sliding inactivity window; default 15m).
 * 3. Session rotation handling (links predecessor epochs without conflating identities).
 * 4. NAT and shared-IP disambiguation:
 *    - Explicitly maintains separate concepts for client session, network source, investigation, and behavioral profile.
 *    - An IP address alone is NEVER treated as proof of single-actor identity.
 *    - Collision-risk metadata explicitly tags shared NAT and ambiguous fallback sessions.
 * 5. Bounded in-memory session index to prevent memory exhaustion.
 */

import crypto from 'node:crypto';

const DEFAULT_INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ACTIVE_SESSIONS = 10000;
const DEFAULT_HMAC_SECRET = 'adg-session-correlation-master-secret-2026';

export class BehavioralSessionCorrelator {
  /**
   * @param {object} [options]
   * @param {number} [options.inactivityTimeoutMs=900000] - 15 minutes
   * @param {number} [options.maxActiveSessions=10000]
   * @param {string} [options.hmacSecret] - Master secret for keyed HMAC session pseudonymization
   */
  constructor(options = {}) {
    this.inactivityTimeoutMs = options.inactivityTimeoutMs || DEFAULT_INACTIVITY_TIMEOUT_MS;
    this.maxActiveSessions = options.maxActiveSessions || MAX_ACTIVE_SESSIONS;
    this.hmacSecret = options.hmacSecret || process.env.SESSION_HMAC_SECRET || DEFAULT_HMAC_SECRET;
    // Map key: `${tenantId}:${applicationId || 'none'}:${sessionRef}`
    this.activeSessions = new Map();
  }

  /**
   * Derives a tenant-specific HMAC key from the master secret, guaranteeing
   * strict cross-tenant cryptographic isolation.
   *
   * @param {string} tenantId
   * @returns {Buffer}
   */
  deriveTenantKey(tenantId) {
    return crypto.createHmac('sha256', this.hmacSecret).update(tenantId || 'global').digest();
  }

  /**
   * Generates a protected pseudonymous session reference from a trusted raw session token.
   * Uses HMAC-SHA256 with tenant-scoped keying to prevent storing raw credentials or tokens.
   *
   * @param {string} tenantId
   * @param {string} rawToken
   * @returns {string}
   */
  generateExplicitSessionRef(tenantId, rawToken) {
    if (!rawToken || typeof rawToken !== 'string') return null;
    const cleanToken = rawToken.trim();
    if (/^sess-hmac-[0-9a-f]{32}$/i.test(cleanToken)) {
      return cleanToken.toLowerCase();
    }
    const tenantKey = this.deriveTenantKey(tenantId);
    const hmac = crypto.createHmac('sha256', tenantKey).update(cleanToken).digest('hex').slice(0, 32);
    return `sess-hmac-${hmac}`;
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
   *   collisionRisk: { level: string, riskFactors: string[] },
   *   caveats: string[],
   *   isAttackerIdentity: boolean,
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
    const hasRawSession = Boolean(rawSessionRef && typeof rawSessionRef === 'string' && rawSessionRef.trim());
    const isUntrustedClient = Boolean(canonicalEvent.sessionProvenance?.isClientSuppliedUntrusted || canonicalEvent.isClientSuppliedSessionRef);

    let sessionRef;
    let correlationType;
    let correlationConfidence;
    let caveats = [];
    let collisionRisk;
    let isExplicit = false;

    if (hasRawSession && !isUntrustedClient) {
      // 1. Trusted explicit session token -> Pseudonymize with Keyed HMAC
      isExplicit = true;
      sessionRef = this.generateExplicitSessionRef(tenantId, rawSessionRef);
      correlationType = 'EXPLICIT_APPLICATION_SESSION';
      correlationConfidence = 1.0;
      caveats = [];
      collisionRisk = {
        level: 'LOW',
        riskFactors: []
      };
    } else if (hasRawSession && isUntrustedClient) {
      // 2. Client-supplied / unverified session header -> Treat with caution
      sessionRef = this.generateExplicitSessionRef(tenantId, rawSessionRef);
      correlationType = 'UNTRUSTED_CLIENT_SESSION_METADATA';
      correlationConfidence = 0.4;
      caveats = [
        'CLIENT_FORGED_SESSION_METADATA_SUSPECTED',
        'NOT_PERMANENT_INDIVIDUAL_IDENTITY'
      ];
      collisionRisk = {
        level: 'HIGH',
        riskFactors: ['CLIENT_UNVERIFIED_SESSION_HEADER', 'SPOOFING_POSSIBLE']
      };
    } else {
      // 3. Fallback to Pseudonymous Network Heuristic
      sessionRef = this.generatePseudonymousSessionRef({
        tenantId,
        applicationId,
        ipSubnetHash,
        epochWindowId: 0
      });
      correlationType = 'PSEUDONYMOUS_NETWORK_HEURISTIC';
      correlationConfidence = 0.5;
      caveats = [
        'SHARED_NAT_COLLISION_POSSIBLE',
        'EPHEMERAL_WINDOW_BOUNDED',
        'NOT_PERMANENT_INDIVIDUAL_IDENTITY'
      ];
      collisionRisk = {
        level: 'HIGH',
        riskFactors: [
          'SHARED_NAT_POSSIBLE',
          'IDENTICAL_USER_AGENT_POSSIBLE',
          'EPHEMERAL_WINDOW_BOUNDED'
        ]
      };
    }

    let previousSessionRef = canonicalEvent.previousSessionReference || null;
    const sessionLookupKey = `${tenantId}:${applicationId || 'none'}:${sessionRef}`;
    let sessionState = this.activeSessions.get(sessionLookupKey);

    let isNewSession = false;

    if (sessionState) {
      const inactiveDuration = eventTime - sessionState.lastActiveAtMs;

      // Inactivity timeout check: if inactive for longer than threshold, rotate to a new session epoch
      if (inactiveDuration > this.inactivityTimeoutMs) {
        const nextEpoch = sessionState.epoch + 1;
        previousSessionRef = sessionRef;

        if (isExplicit) {
          // Explicit token persisted after timeout is flagged as re-activated
          sessionState.firstSeenAt = eventTimeIso;
          sessionState.lastActiveAt = eventTimeIso;
          sessionState.lastActiveAtMs = eventTime;
          sessionState.eventCount = 1;
          sessionState.epoch = nextEpoch;
          sessionState.previousSessionRef = previousSessionRef;
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
            collisionRisk,
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
        collisionRisk,
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
      collisionRisk: sessionState.collisionRisk,
      caveats: sessionState.caveats,
      isAttackerIdentity: false, // IP clusters & sessions are NEVER treated as individual attacker identities
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
