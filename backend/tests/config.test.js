import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadEnv } from '../src/config/env.js';

describe('Environment Configuration & Validation', () => {
  test('loads valid default environment when variables are unset', () => {
    const config = loadEnv({});
    assert.equal(config.NODE_ENV, 'development');
    assert.equal(config.PORT, 4000);
    assert.equal(config.HOST, '127.0.0.1');
    assert.equal(config.LOG_LEVEL, 'info');
    assert.deepEqual(config.CORS_ORIGIN, ['http://localhost:3000']);
    assert.equal(config.isDevelopment, true);
    assert.equal(config.isProduction, false);
    assert.equal(config.isTest, false);
  });

  test('accepts valid production NODE_ENV and custom ports', () => {
    const config = loadEnv({
      NODE_ENV: 'production',
      PORT: '8080',
      HOST: '0.0.0.0',
      LOG_LEVEL: 'warn',
      CORS_ORIGIN: 'https://gateway.example.com,https://admin.example.com'
    });

    assert.equal(config.NODE_ENV, 'production');
    assert.equal(config.PORT, 8080);
    assert.equal(config.HOST, '0.0.0.0');
    assert.equal(config.LOG_LEVEL, 'warn');
    assert.deepEqual(config.CORS_ORIGIN, [
      'https://gateway.example.com',
      'https://admin.example.com'
    ]);
    assert.equal(config.isProduction, true);
  });

  test('rejects invalid NODE_ENV', () => {
    assert.throws(
      () => loadEnv({ NODE_ENV: 'staging' }),
      /Invalid NODE_ENV "staging"/
    );
  });

  test('rejects invalid LOG_LEVEL', () => {
    assert.throws(
      () => loadEnv({ LOG_LEVEL: 'verbose' }),
      /Invalid LOG_LEVEL "verbose"/
    );
  });

  test('rejects non-numeric PORT', () => {
    assert.throws(
      () => loadEnv({ PORT: 'abc' }),
      /Invalid PORT configuration: "abc"/
    );
  });

  test('rejects zero or negative PORT', () => {
    assert.throws(
      () => loadEnv({ PORT: '0' }),
      /Invalid PORT configuration: "0"/
    );
    assert.throws(
      () => loadEnv({ PORT: '-80' }),
      /Invalid PORT configuration: "-80"/
    );
  });

  test('rejects out-of-range PORT (> 65535)', () => {
    assert.throws(
      () => loadEnv({ PORT: '70000' }),
      /Invalid PORT configuration: "70000"/
    );
  });

  test('rejects wildcard "*" in CORS_ORIGIN', () => {
    assert.throws(
      () => loadEnv({ CORS_ORIGIN: '*' }),
      /Wildcard "\*" is prohibited/
    );
    assert.throws(
      () => loadEnv({ CORS_ORIGIN: 'http://localhost:3000,*' }),
      /Wildcard "\*" is prohibited/
    );
  });

  test('does not leak or require database or secret variables', () => {
    const config = loadEnv({});
    assert.equal('DATABASE_URL' in config, false);
    assert.equal('JWT_SECRET' in config, false);
    assert.equal('DB_PASSWORD' in config, false);
  });
});
