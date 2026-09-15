const pool = require("../config/db");

/**
 * Verify PostgreSQL connectivity without exposing credentials.
 */
async function checkDatabase() {
  const result = await pool.query(
    "SELECT current_database() AS database, NOW() AS server_time"
  );
  return {
    connected: true,
    database: result.rows[0].database,
    serverTime: result.rows[0].server_time,
  };
}

module.exports = {
  checkDatabase,
};
