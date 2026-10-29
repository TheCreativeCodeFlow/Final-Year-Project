/**
 * Structured, security-conscious logger for Adaptive Deception Gateway Backend.
 * Emits JSON-formatted log records with request correlation and automatic sensitive data redaction.
 */

const SEVERITY_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

const SENSITIVE_KEY_PATTERNS = [
  /pass(word)?/i,
  /secret/i,
  /token/i,
  /auth(orization)?/i,
  /cookie/i,
  /api[-_]?key/i,
  /credential/i,
  /bearer/i,
  /jwt/i
];

/**
 * Sanitizes a string against CRLF / log-injection attempts.
 * @param {unknown} val
 * @returns {string}
 */
export function sanitizeString(val) {
  if (typeof val !== 'string') {
    return String(val ?? '');
  }
  return val.replace(/[\r\n\t]/g, ' ').trim();
}

/**
 * Strips query parameters and hashes to produce a safe URL path for logging.
 * Query strings often inadvertently capture credentials, tokens, or user data.
 * @param {string} rawUrl
 * @returns {string}
 */
export function getSafePath(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '/';
  const withoutHash = rawUrl.split('#')[0];
  const pathOnly = withoutHash.split('?')[0];
  return sanitizeString(pathOnly) || '/';
}

/**
 * Recursively redacts sensitive values from an object or array.
 * @param {unknown} data
 * @param {number} [depth=0]
 * @returns {unknown}
 */
export function redactSensitiveData(data, depth = 0) {
  if (depth > 6 || !data) return data;

  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveData(item, depth + 1));
  }

  if (typeof data === 'object') {
    const clean = {};
    for (const [key, val] of Object.entries(data)) {
      const isSensitive = SENSITIVE_KEY_PATTERNS.some((pat) => pat.test(key));
      if (isSensitive) {
        clean[key] = '[REDACTED]';
      } else if (typeof val === 'object' && val !== null) {
        clean[key] = redactSensitiveData(val, depth + 1);
      } else if (typeof val === 'string') {
        clean[key] = sanitizeString(val);
      } else {
        clean[key] = val;
      }
    }
    return clean;
  }

  if (typeof data === 'string') {
    return sanitizeString(data);
  }

  return data;
}

export class Logger {
  /**
   * @param {object} [options]
   * @param {string} [options.logLevel='info']
   * @param {function} [options.sink=console.log]
   */
  constructor(options = {}) {
    this.logLevel = (options.logLevel || 'info').toLowerCase();
    this.sink = options.sink || console.log;
  }

  setLogLevel(level) {
    if (SEVERITY_LEVELS[level] !== undefined) {
      this.logLevel = level.toLowerCase();
    }
  }

  _shouldLog(level) {
    const currentWeight = SEVERITY_LEVELS[this.logLevel] ?? 1;
    const targetWeight = SEVERITY_LEVELS[level] ?? 1;
    return targetWeight >= currentWeight;
  }

  _emit(level, message, metadata = {}) {
    if (!this._shouldLog(level)) return;

    const record = {
      timestamp: new Date().toISOString(),
      severity: level.toUpperCase(),
      message: sanitizeString(message),
      ...redactSensitiveData(metadata)
    };

    try {
      this.sink(JSON.stringify(record));
    } catch {
      this.sink(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          severity: 'ERROR',
          message: 'Failed to serialize log record'
        })
      );
    }
  }

  debug(message, metadata) {
    this._emit('debug', message, metadata);
  }

  info(message, metadata) {
    this._emit('info', message, metadata);
  }

  warn(message, metadata) {
    this._emit('warn', message, metadata);
  }

  error(message, metadata) {
    this._emit('error', message, metadata);
  }

  /**
   * Logs an HTTP request completion record.
   * Query parameters, cookies, and request bodies are intentionally omitted.
   * @param {object} params
   * @param {string} params.requestId
   * @param {string} params.method
   * @param {string} params.path
   * @param {number} params.status
   * @param {number} params.durationMs
   * @param {string} [params.clientIp]
   */
  logHttpRequest({ requestId, method, path, status, durationMs, clientIp }) {
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    this._emit(level, `${method} ${path} -> ${status} (${durationMs}ms)`, {
      requestId: sanitizeString(requestId),
      http: {
        method: sanitizeString(method),
        path: getSafePath(path),
        status,
        durationMs: Math.round(durationMs * 100) / 100,
        clientIp: sanitizeString(clientIp || '')
      }
    });
  }
}

export const logger = new Logger({
  logLevel: process.env.LOG_LEVEL || 'info'
});
