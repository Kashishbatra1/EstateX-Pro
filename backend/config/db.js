/**
 * PostgreSQL connection pool (environment-based).
 * Supports local discrete DB_* settings or Neon/Vercel DATABASE_URL.
 */
const { Pool, types } = require("pg");
const env = require("./env");

// Keep DATE columns as YYYY-MM-DD strings (avoid timezone shifts)
types.setTypeParser(types.builtins.DATE, (value) => value);

const poolConfig = {
  ...env.db,
  // Serverless: keep the pool tiny to avoid exhausting Neon connections
  max: env.isServerless ? 1 : 10,
  idleTimeoutMillis: env.isServerless ? 10000 : 30000,
  connectionTimeoutMillis: 15000,
  allowExitOnIdle: Boolean(env.isServerless),
};

const pool = new Pool(poolConfig);

pool.on("error", (err) => {
  // Never log connection strings or credentials
  console.error("Unexpected PostgreSQL pool error:", err.message);
});

module.exports = pool;
