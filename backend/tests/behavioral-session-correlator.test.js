/**
 * Stage 4B: Behavioral Session Correlator Test Suite
 *
 * Verifies:
 * 1. Associative session reference: preserves explicit session tokens when provided.
 * 2. Pseudonymous ephemeral fallback: deterministic generation with documented caveats.
 * 3. Inactivity timeout: session rotation to a new epoch when exceeding inactivity window.
 * 4. Disambiguation: distinct sessions originating from identical NAT/proxy IP remain separate.
 * 5. Bounded capacity: LRU eviction on exceeding max capacity.
 */

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { BehavioralSessionCorrelator } from '../src/services/behavioral-session-correlator.service.js';

describe('Stage 4B: Behavioral Session Correlator', () => {
  let correlator;

  beforeEach(() => {
    correlator = new BehavioralSessionCorrelator({
      inactivityTimeoutMs: 15 * 60 * 1000, // 15m
      maxActiveSessions: 100
    });
  });

  test('1. Explicit session token is associated with 1.0 confidence and zero caveats', () => {
    const event = {
      tenantId: 'tenant-apex',
      applicationId: 'app-01',
      sessionReference: 'sess-auth-user-9912',
      timestamp: '2026-10-31T20:00:00.000Z',
      sourceMetadata: { ipSubnetHash: 'hash-subnet-01' }
    };

    const result = correlator.correlateEvent(event);
    assert.equal(result.sessionRef, 'sess-auth-user-9912');
    assert.equal(result.correlationType, 'EXPLICIT_APPLICATION_SESSION');
    assert.equal(result.isPseudonymous, false);
    assert.equal(result.correlationConfidence, 1.0);
    assert.deepEqual(result.caveats, []);
    assert.equal(result.eventCount, 1);
  });

  test('2. Missing session token generates pseudonymous correlation key with documented caveats', () => {
    const event = {
      tenantId: 'tenant-apex',
      applicationId: 'app-01',
      sessionReference: null,
      timestamp: '2026-10-31T20:00:00.000Z',
      sourceMetadata: { ipSubnetHash: 'hash-subnet-01' }
    };

    const result = correlator.correlateEvent(event);
    assert.ok(result.sessionRef.startsWith('pseudo-sess-'));
    assert.equal(result.correlationType, 'PSEUDONYMOUS_NETWORK_HEURISTIC');
    assert.equal(result.isPseudonymous, true);
    assert.equal(result.correlationConfidence, 0.5);
    assert.ok(result.caveats.includes('SHARED_NAT_COLLISION_POSSIBLE'));
    assert.ok(result.caveats.includes('NOT_PERMANENT_INDIVIDUAL_IDENTITY'));
  });

  test('3. Successive events within inactivity window accumulate under identical session', () => {
    const event1 = {
      tenantId: 'tenant-apex',
      applicationId: 'app-01',
      sessionReference: 'sess-client-44',
      timestamp: '2026-10-31T20:00:00.000Z',
      sourceMetadata: { ipSubnetHash: 'hash-01' }
    };
    const event2 = {
      tenantId: 'tenant-apex',
      applicationId: 'app-01',
      sessionReference: 'sess-client-44',
      timestamp: '2026-10-31T20:05:00.000Z', // 5m later (within 15m)
      sourceMetadata: { ipSubnetHash: 'hash-01' }
    };

    const res1 = correlator.correlateEvent(event1);
    const res2 = correlator.correlateEvent(event2);

    assert.equal(res1.sessionRef, res2.sessionRef);
    assert.equal(res2.eventCount, 2);
    assert.equal(res2.isNewSession, false);
    assert.equal(res2.lastActiveAt, '2026-10-31T20:05:00.000Z');
  });

  test('4. Exceeding inactivity timeout advances epoch and rotates pseudonymous session reference', () => {
    const event1 = {
      tenantId: 'tenant-apex',
      applicationId: 'app-01',
      sessionReference: null,
      timestamp: '2026-10-31T20:00:00.000Z',
      sourceMetadata: { ipSubnetHash: 'hash-subnet-02' }
    };
    // 20 minutes later (exceeds 15m inactivity threshold)
    const event2 = {
      tenantId: 'tenant-apex',
      applicationId: 'app-01',
      sessionReference: null,
      timestamp: '2026-10-31T20:20:00.000Z',
      sourceMetadata: { ipSubnetHash: 'hash-subnet-02' }
    };

    const res1 = correlator.correlateEvent(event1);
    const res2 = correlator.correlateEvent(event2);

    assert.notEqual(res1.sessionRef, res2.sessionRef);
    assert.equal(res2.isNewSession, true);
    assert.equal(res2.previousSessionRef, res1.sessionRef);
    assert.equal(res2.eventCount, 1);
  });

  test('5. Shared IP / NAT disambiguation: distinct session tokens from same subnet remain separated', () => {
    const eventA = {
      tenantId: 'tenant-apex',
      applicationId: 'app-01',
      sessionReference: 'sess-employee-A',
      timestamp: '2026-10-31T20:00:00.000Z',
      sourceMetadata: { ipSubnetHash: 'shared-corporate-nat' }
    };
    const eventB = {
      tenantId: 'tenant-apex',
      applicationId: 'app-01',
      sessionReference: 'sess-employee-B',
      timestamp: '2026-10-31T20:00:01.000Z',
      sourceMetadata: { ipSubnetHash: 'shared-corporate-nat' }
    };

    const resA = correlator.correlateEvent(eventA);
    const resB = correlator.correlateEvent(eventB);

    assert.notEqual(resA.sessionRef, resB.sessionRef);
    assert.equal(resA.sessionRef, 'sess-employee-A');
    assert.equal(resB.sessionRef, 'sess-employee-B');
  });

  test('6. Bounded capacity evicts oldest active session on overflow', () => {
    const tinyCorrelator = new BehavioralSessionCorrelator({
      maxActiveSessions: 3,
      inactivityTimeoutMs: 60000
    });

    for (let i = 1; i <= 4; i++) {
      tinyCorrelator.correlateEvent({
        tenantId: 'tenant-apex',
        applicationId: 'app-01',
        sessionReference: `sess-client-${i}`,
        timestamp: '2026-10-31T20:00:00.000Z',
        sourceMetadata: { ipSubnetHash: 'hash' }
      });
    }

    const stats = tinyCorrelator.getStats();
    assert.equal(stats.activeSessionCount, 3, 'Active sessions count must not exceed max capacity of 3');
  });
});
