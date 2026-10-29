import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Logger, getSafePath, redactSensitiveData, sanitizeString } from '../src/utils/logger.js';

describe('Structured Logger & Security Redaction', () => {
  test('emits structured JSON log records with standard audit fields', () => {
    const logs = [];
    const testLogger = new Logger({
      logLevel: 'debug',
      sink: (json) => logs.push(JSON.parse(json))
    });

    testLogger.info('Gateway component initialized', {
      component: 'ReverseProxyMock',
      activeConnections: 0
    });

    assert.equal(logs.length, 1);
    const log = logs[0];
    assert.equal(log.severity, 'INFO');
    assert.equal(log.message, 'Gateway component initialized');
    assert.equal(log.component, 'ReverseProxyMock');
    assert.equal(log.activeConnections, 0);
    assert.ok(typeof log.timestamp === 'string');
  });

  test('respects log level thresholds', () => {
    const logs = [];
    const testLogger = new Logger({
      logLevel: 'warn',
      sink: (json) => logs.push(JSON.parse(json))
    });

    testLogger.debug('Debug trace');
    testLogger.info('Informational message');
    testLogger.warn('Warning condition');
    testLogger.error('Critical failure');

    assert.equal(logs.length, 2);
    assert.equal(logs[0].severity, 'WARN');
    assert.equal(logs[1].severity, 'ERROR');
  });

  test('redacts sensitive credentials, authorization tokens, and secrets', () => {
    const sensitivePayload = {
      username: 'admin',
      password: 'SuperSecretPassword123!',
      token: 'jwt.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      apiKey: 'sec_live_99482847291',
      authorization: 'Bearer secret-access-token',
      nested: {
        dbSecret: 'my-db-pass',
        publicNote: 'safe note'
      }
    };

    const clean = redactSensitiveData(sensitivePayload);

    assert.equal(clean.username, 'admin');
    assert.equal(clean.password, '[REDACTED]');
    assert.equal(clean.token, '[REDACTED]');
    assert.equal(clean.apiKey, '[REDACTED]');
    assert.equal(clean.authorization, '[REDACTED]');
    assert.equal(clean.nested.dbSecret, '[REDACTED]');
    assert.equal(clean.nested.publicNote, 'safe note');
  });

  test('getSafePath strips query parameters to prevent token/secret leakage', () => {
    assert.equal(
      getSafePath('/api/v1/auth/callback?code=sec_auth_code_991&state=xyz'),
      '/api/v1/auth/callback'
    );
    assert.equal(
      getSafePath('/api/v1/users?apiKey=secret-key-in-query'),
      '/api/v1/users'
    );
    assert.equal(
      getSafePath('/api/v1/health/live#fragment'),
      '/api/v1/health/live'
    );
  });

  test('sanitizeString neutralizes CRLF log injection attempts', () => {
    const maliciousInput = 'admin-user\r\n{"severity":"CRITICAL","message":"Forged root entry"}';
    const sanitized = sanitizeString(maliciousInput);

    assert.equal(sanitized.includes('\r'), false);
    assert.equal(sanitized.includes('\n'), false);
    assert.equal(
      sanitized,
      'admin-user  {"severity":"CRITICAL","message":"Forged root entry"}'
    );
  });
});
