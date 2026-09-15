/**
 * Password hashing and verification.
 * Supports bcryptjs hashes and legacy PostgreSQL pgcrypto (bf) seed hashes.
 * Never log plaintext passwords or hash values.
 */
const bcrypt = require("bcryptjs");
const pool = require("../config/db");

const BCRYPT_ROUNDS = 10;

async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
}

/**
 * Verify a password against a stored hash.
 * @returns {{ valid: boolean, needsRehash: boolean }}
 */
async function verifyPassword(plainPassword, passwordHash) {
  if (!plainPassword || !passwordHash) {
    return { valid: false, needsRehash: false };
  }

  // Node bcrypt / bcryptjs hashes
  if (
    passwordHash.startsWith("$2a$") ||
    passwordHash.startsWith("$2b$") ||
    passwordHash.startsWith("$2y$")
  ) {
    try {
      const valid = await bcrypt.compare(plainPassword, passwordHash);
      if (valid) {
        return { valid: true, needsRehash: false };
      }
    } catch {
      // Fall through to pgcrypto verification
    }
  }

  // Legacy seed hashes created with pgcrypto crypt(..., gen_salt('bf'))
  const result = await pool.query(
    `SELECT (crypt($1, $2) = $2) AS matched`,
    [plainPassword, passwordHash]
  );

  const valid = Boolean(result.rows[0] && result.rows[0].matched);
  return { valid, needsRehash: valid };
}

module.exports = {
  hashPassword,
  verifyPassword,
};
