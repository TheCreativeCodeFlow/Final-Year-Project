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

  test('1. Explicit session token is pseudonymized via keyed HMAC with 1.0 confidence and zero caveats', () => {
    const event = {
      tenantId: 'tenant-apex',
      applicationId: 'app-01',
      sessionReference: 'sess-auth-user-9912',
      timestamp: '2026-10-31T20:00:00.000Z',
      sourceMetadata: { ipSubnetHash: 'hash-subnet-01' }
    };

    const result = correlator.correlateEvent(event);
    assert.ok(result.sessionRef.startsWith('sess-hmac-'), 'Explicit token must be converted to keyed HMAC');
    assert.notEqual(result.sessionRef, 'sess-auth-user-9912', 'Raw session token must NEVER be stored raw');
    assert.equal(result.correlationType, 'EXPLICIT_APPLICATION_SESSION');
    assert.equal(result.isPseudonymous, false);
    assert.equal(result.correlationConfidence, 1.0);
    assert.equal(result.collisionRisk.level, 'LOW');
    assert.deepEqual(result.caveats, []);
    assert.equal(result.isAttackerIdentity, false);
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
    assert.ok(resA.sessionRef.startsWith('sess-hmac-'));
    assert.ok(resB.sessionRef.startsWith('sess-hmac-'));
    assert.equal(resA.collisionRisk.level, 'LOW');
    assert.equal(resB.collisionRisk.level, 'LOW');
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

  test('7. Cross-tenant identifier isolation: same raw token derives different HMACs per tenant', () => {
    const rawToken = 'shared-cookie-value-abc';
    const refTenantA = correlator.generateExplicitSessionRef('tenant-apex', rawToken);
    const refTenantB = correlator.generateExplicitSessionRef('tenant-medsecure', rawToken);

    assert.ok(refTenantA.startsWith('sess-hmac-'));
    assert.ok(refTenantB.startsWith('sess-hmac-'));
    assert.notEqual(refTenantA, refTenantB, 'Cryptographic tenant isolation must prevent cross-tenant correlation');
  });

  test('8. Client-forged / untrusted session metadata is tagged with reduced confidence and caveats', () => {
    const event = {
      tenantId: 'tenant-apex',
      applicationId: 'app-01',
      sessionReference: 'spoofed-admin-id',
      sessionProvenance: { isClientSuppliedUntrusted: true },
      timestamp: '2026-10-31T20:00:00.000Z',
      sourceMetadata: { ipSubnetHash: 'hash-attacker' }
    };

    const res = correlator.correlateEvent(event);
    assert.equal(res.correlationType, 'UNTRUSTED_CLIENT_SESSION_METADATA');
    assert.equal(res.correlationConfidence, 0.4);
    assert.equal(res.collisionRisk.level, 'HIGH');
    assert.ok(res.caveats.includes('CLIENT_FORGED_SESSION_METADATA_SUSPECTED'));
  });

  test('9. Identical User-Agent without tokens flags high collision risk and caveats', () => {
    const event1 = {
      tenantId: 'tenant-apex',
      applicationId: 'app-01',
      sessionReference: null,
      timestamp: '2026-10-31T20:00:00.000Z',
      sourceMetadata: { ipSubnetHash: 'corporate-cgnat' },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'
    };

    const res = correlator.correlateEvent(event1);
    assert.equal(res.collisionRisk.level, 'HIGH');
    assert.ok(res.collisionRisk.riskFactors.includes('SHARED_NAT_POSSIBLE'));
    assert.ok(res.collisionRisk.riskFactors.includes('IDENTICAL_USER_AGENT_POSSIBLE'));
    assert.equal(res.isAttackerIdentity, false);
  });
});
