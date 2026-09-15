/**
 * PostgreSQL connection pool (environment-based).
 */
const { Pool, types } = require("pg");
const env = require("./env");

// Keep DATE columns as YYYY-MM-DD strings (avoid timezone shifts)
types.setTypeParser(types.builtins.DATE, (value) => value);

const pool = new Pool({
  host: env.db.host,
  port: env.db.port,
  database: env.db.name,
  user: env.db.user,
  password: env.db.password,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on("error", (err) => {
  // Never log connection strings or credentials
  console.error("Unexpected PostgreSQL pool error:", err.message);
});

module.exports = pool;
