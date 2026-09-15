/**
 * Phase 1 foundation checks against the live PostgreSQL database.
 * Does not print credentials.
 *
 * Usage: npm run test:foundation
 */
const http = require("http");
const pool = require("../config/db");
const env = require("../config/env");
const app = require("../app");

function request(port, path) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: "127.0.0.1", port, path }, (res) => {
      let body = "";
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        resolve({ status: res.statusCode, body });
      });
    });
    req.on("error", reject);
  });
}

async function run() {
  let passed = 0;
  let failed = 0;

  function assert(name, condition) {
    if (condition) {
      console.log(`PASS — ${name}`);
      passed += 1;
    } else {
      console.error(`FAIL — ${name}`);
      failed += 1;
    }
  }

  // 1) Direct DB pool test
  try {
    const result = await pool.query("SELECT 1 AS ok, current_database() AS db");
    assert("PostgreSQL pool query", result.rows[0].ok === 1);
    assert("Connected database is estatex_pro", result.rows[0].db === "estatex_pro");
  } catch (err) {
    assert(`PostgreSQL pool query (${err.message})`, false);
  }

  // 2) HTTP endpoints
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();

  try {
    const root = await request(port, "/");
    assert("GET / returns 200", root.status === 200);
    assert("GET / body has no password fields", !/password/i.test(root.body));

    const health = await request(port, "/api/health");
    assert("GET /api/health returns 200", health.status === 200);

    const dbHealth = await request(port, "/api/health/db");
    assert("GET /api/health/db returns 200", dbHealth.status === 200);
    assert(
      "GET /api/health/db does not expose secrets",
      !/password|your_password|jwt_secret/i.test(dbHealth.body)
    );

    const missing = await request(port, "/api/does-not-exist");
    assert("Unknown route returns 404", missing.status === 404);
  } catch (err) {
    assert(`HTTP tests (${err.message})`, false);
  } finally {
    server.close();
    await pool.end();
  }

  console.log("");
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`Environment: ${env.nodeEnv}, port config: ${env.port}`);
  process.exitCode = failed > 0 ? 1 : 0;
}

run();
