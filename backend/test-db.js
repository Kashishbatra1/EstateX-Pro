/**
 * Standalone database connection test (no credentials printed).
 * Usage: npm run test:db
 */
const pool = require("./config/db");
const env = require("./config/env");

async function testDatabase() {
  try {
    const result = await pool.query(
      "SELECT current_database() AS database, NOW() AS server_time"
    );
    console.log("Database connected successfully!");
    console.log(`Database: ${result.rows[0].database}`);
    console.log(`Host: ${env.db.host}`);
    console.log(`Port: ${env.db.port}`);
    console.log(`Server time: ${result.rows[0].server_time}`);
    process.exitCode = 0;
  } catch (error) {
    console.error("Database connection failed:");
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

testDatabase();
