/**
 * Password Security Module using Argon2id.
 *
 * Implements OWASP-compliant password hashing using Argon2id.
 * Enforces length boundaries to protect against DoS attacks without
 * forcing arbitrary character composition constraints.
 */

import argon2 from 'argon2';

const MIN_PASSWORD_LENGTH = 10;
const MAX_PASSWORD_LENGTH = 128;

/**
 * Validates password format against length boundaries.
 * @param {unknown} password
 * @returns {{ valid: boolean, error?: string }}
 */
export function validatePasswordFormat(password) {
  if (typeof password !== 'string') {
    return { valid: false, error: 'Password must be a valid text string.' };
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      valid: false,
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`
    };
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    return {
      valid: false,
      error: `Password exceeds maximum length limit of ${MAX_PASSWORD_LENGTH} characters.`
    };
  }

  return { valid: true };
}

/**
 * Hashes a plaintext password using Argon2id with recommended memory and iteration parameters.
 * @param {string} plaintext
 * @returns {Promise<string>}
 */
export function hashPassword(plaintext) {
  const validation = validatePasswordFormat(plaintext);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  return argon2.hash(plaintext, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MiB
    timeCost: 3,       // 3 iterations
    parallelism: 4     // 4 threads
  });
}

/**
 * Verifies a plaintext password against a stored Argon2id hash.
 * Timing-safe comparison handled by native argon2 library.
 * @param {string} hash
 * @param {string} plaintext
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(hash, plaintext) {
  if (typeof hash !== 'string' || typeof plaintext !== 'string') {
    return false;
  }

  try {
    return await argon2.verify(hash, plaintext);
  } catch {
    return false;
  }
}
