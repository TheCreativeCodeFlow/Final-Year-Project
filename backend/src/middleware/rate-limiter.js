/**
 * In-Memory Sliding Window Rate Limiter for Login Throttling.
 *
 * Enforces per-IP and per-account failed login throttling to mitigate brute-force
 * and credential stuffing attacks.
 *
 * Operational Notice:
 * This implementation tracks attempts in process memory, suitable for single-node
 * deployments and automated integration testing. In a horizontally scaled cluster,
 * a distributed state store (such as Redis or Memcached) is required.
 */

class LoginRateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 15 * 60 * 1000; // 15 minutes
    this.maxFailures = options.maxFailures || 5;          // 5 attempts
    this.attempts = new Map(); // key -> Array<number> timestamps
  }

  /**
   * Generates a composite key for throttling tracking.
   * @param {string} ip
   * @param {string} [email]
   * @returns {string}
   */
  _getKey(ip, email) {
    const cleanIp = ip ? ip.trim() : 'unknown';
    const cleanEmail = email ? email.trim().toLowerCase() : '';
    return cleanEmail ? `account:${cleanEmail}` : `ip:${cleanIp}`;
  }

  /**
   * Checks whether the current request is allowed.
   * @param {string} ip
   * @param {string} [email]
   * @returns {{ allowed: boolean, remainingAttempts: number, retryAfterSeconds?: number }}
   */
  check(ip, email) {
    const now = Date.now();
    const key = this._getKey(ip, email);
    const timestamps = this.attempts.get(key) || [];

    // Filter out expired timestamps
    const activeTimestamps = timestamps.filter((t) => now - t < this.windowMs);
    this.attempts.set(key, activeTimestamps);

    if (activeTimestamps.length >= this.maxFailures) {
      const oldestAttempt = activeTimestamps[0];
      const retryAfterMs = this.windowMs - (now - oldestAttempt);
      const retryAfterSeconds = Math.ceil(Math.max(1, retryAfterMs / 1000));

      return {
        allowed: false,
        remainingAttempts: 0,
        retryAfterSeconds
      };
    }

    return {
      allowed: true,
      remainingAttempts: this.maxFailures - activeTimestamps.length
    };
  }

  /**
   * Records a failed attempt for the given key.
   * @param {string} ip
   * @param {string} [email]
   */
  recordFailure(ip, email) {
    const now = Date.now();
    const key = this._getKey(ip, email);
    const timestamps = this.attempts.get(key) || [];
    const activeTimestamps = timestamps.filter((t) => now - t < this.windowMs);
    activeTimestamps.push(now);
    this.attempts.set(key, activeTimestamps);
  }

  /**
   * Resets attempts upon successful authentication.
   * @param {string} ip
   * @param {string} [email]
   */
  recordSuccess(ip, email) {
    const key = this._getKey(ip, email);
    this.attempts.delete(key);
  }

  /**
   * Clears all tracking state (used in testing).
   */
  reset() {
    this.attempts.clear();
  }
}

export const defaultLoginLimiter = new LoginRateLimiter();

/**
 * Express middleware enforcing login attempt limits.
 * @param {LoginRateLimiter} [limiter=defaultLoginLimiter]
 */
export function createLoginThrottleMiddleware(limiter = defaultLoginLimiter) {
  return (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const email = req.body && req.body.email ? String(req.body.email) : undefined;

    const status = limiter.check(ip, email);
    if (!status.allowed) {
      res.setHeader('Retry-After', status.retryAfterSeconds);
      return res.status(429).json({
        success: false,
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: 'Too many failed login attempts. Please try again later.',
          retryAfterSeconds: status.retryAfterSeconds,
          requestId: req.id || null,
          timestamp: new Date().toISOString()
        }
      });
    }

    req.rateLimiter = limiter;
    next();
  };
}
