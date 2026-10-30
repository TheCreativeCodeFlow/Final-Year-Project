/**
 * Structured Logger for Gateway Runtime.
 *
 * Implements:
 * - JSON-formatted structured logging.
 * - Log level gating (debug, info, warn, error).
 * - Automatic redaction of sensitive headers and credentials.
 */

const LOG_LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

const SENSITIVE_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-gateway-service-token',
  'session',
  'token'
]);

class GatewayLogger {
  constructor() {
    this.currentLevel = LOG_LEVELS[process.env.LOG_LEVEL?.toLowerCase()] || LOG_LEVELS.info;
  }

  setLogLevel(level) {
    if (level && LOG_LEVELS[level.toLowerCase()]) {
      this.currentLevel = LOG_LEVELS[level.toLowerCase()];
    }
  }

  redactHeaders(headers = {}) {
    const sanitized = {};
    for (const [key, value] of Object.entries(headers)) {
      if (SENSITIVE_HEADERS.has(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  log(levelName, message, metadata = {}) {
    if (LOG_LEVELS[levelName] < this.currentLevel) return;

    const logEntry = {
      timestamp: new Date().toISOString(),
      severity: levelName.toUpperCase(),
      subsystem: 'gateway-runtime',
      message
    };

    if (metadata && Object.keys(metadata).length > 0) {
      if (metadata.headers) {
        logEntry.headers = this.redactHeaders(metadata.headers);
        const { headers, ...rest } = metadata;
        Object.assign(logEntry, rest);
      } else {
        Object.assign(logEntry, metadata);
      }
    }

    const jsonStr = JSON.stringify(logEntry);
    if (levelName === 'error') {
      console.error(jsonStr);
    } else if (levelName === 'warn') {
      console.warn(jsonStr);
    } else {
      console.log(jsonStr);
    }
  }

  debug(message, metadata) {
    this.log('debug', message, metadata);
  }

  info(message, metadata) {
    this.log('info', message, metadata);
  }

  warn(message, metadata) {
    this.log('warn', message, metadata);
  }

  error(message, metadata) {
    this.log('error', message, metadata);
  }
}

export const logger = new GatewayLogger();
