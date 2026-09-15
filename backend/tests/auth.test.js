/**
 * Phase 2 authentication tests against live PostgreSQL (estatex_pro).
 * Creates an ephemeral admin for testing — does not print passwords or tokens.
 *
 * Usage: npm run test:auth
 */
const http = require("http");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const env = require("../config/env");
const app = require("../app");
const { hashPassword } = require("../utils/password");

const TEST_EMAIL = `auth.phase2.${Date.now()}@estatex.test`;
const TEST_PASSWORD = `T3st!${Date.now().toString().slice(-6)}`;

function request(port, { method = "GET", path, body, token } = {}) {
  const payload = body ? JSON.stringify(body) : null;
  const headers = {
    Accept: "application/json",
  };
  if (payload) {
    headers["Content-Type"] = "application/json";
    headers["Content-Length"] = Buffer.byteLength(payload);
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: "127.0.0.1", port, path, method, headers },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          let json = null;
          try {
            json = JSON.parse(data);
          } catch {
            json = null;
          }
          resolve({ status: res.statusCode, body: data, json });
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function containsSecretLeak(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return (
    lower.includes(TEST_PASSWORD.toLowerCase()) ||
    lower.includes("password_hash") ||
    lower.includes(env.jwt.secret.toLowerCase())
  );
}

async function run() {
  let passed = 0;
  let failed = 0;
  let adminId = null;

  function assert(name, condition) {
    if (condition) {
      console.log(`PASS — ${name}`);
      passed += 1;
    } else {
      console.error(`FAIL — ${name}`);
      failed += 1;
    }
  }

  // Create ephemeral admin in real DB
  const passwordHash = await hashPassword(TEST_PASSWORD);
  const inserted = await pool.query(
    `INSERT INTO admins (full_name, email, password_hash, role, is_active)
     VALUES ($1, $2, $3, 'admin', TRUE)
     RETURNING id`,
    ["Phase 2 Auth Tester", TEST_EMAIL, passwordHash]
  );
  adminId = inserted.rows[0].id;

  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();

  let accessToken = null;

  try {
    // 1) Valid login
    const loginOk = await request(port, {
      method: "POST",
      path: "/api/auth/login",
      body: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });
    assert("Valid login returns 200", loginOk.status === 200);
    assert("Valid login returns token", Boolean(loginOk.json?.data?.token));
    assert(
      "Valid login returns admin role",
      loginOk.json?.data?.admin?.role === "admin" ||
        loginOk.json?.data?.admin?.role === "super_admin"
    );
    assert("Valid login response has no secret leak", !containsSecretLeak(loginOk.body));
    accessToken = loginOk.json?.data?.token;

    // 2) Invalid credentials
    const badLogin = await request(port, {
      method: "POST",
      path: "/api/auth/login",
      body: { email: TEST_EMAIL, password: "WrongPassword999" },
    });
    assert("Invalid credentials return 401", badLogin.status === 401);

    // 3) Missing / invalid input
    const missing = await request(port, {
      method: "POST",
      path: "/api/auth/login",
      body: { email: "", password: "" },
    });
    assert("Missing input returns 400", missing.status === 400);

    const badEmail = await request(port, {
      method: "POST",
      path: "/api/auth/login",
      body: { email: "not-an-email", password: "abcdef" },
    });
    assert("Invalid email format returns 400", badEmail.status === 400);

    // 4) Password verification (wrong vs right already covered; confirm bcrypt path via re-login)
    const loginAgain = await request(port, {
      method: "POST",
      path: "/api/auth/login",
      body: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });
    assert("Password verification succeeds on re-login", loginAgain.status === 200);

    // 5) Protected route without auth
    const noAuth = await request(port, { path: "/api/auth/admin-ping" });
    assert("Protected route without token returns 401", noAuth.status === 401);

    const meNoAuth = await request(port, { path: "/api/auth/me" });
    assert("GET /me without token returns 401", meNoAuth.status === 401);

    // 6) Protected route with valid auth
    const ping = await request(port, {
      path: "/api/auth/admin-ping",
      token: accessToken,
    });
    assert("Protected route with valid token returns 200", ping.status === 200);
    assert(
      "Protected route returns admin role",
      ping.json?.data?.role === "admin" || ping.json?.data?.role === "super_admin"
    );

    const me = await request(port, { path: "/api/auth/me", token: accessToken });
    assert("GET /me with valid token returns 200", me.status === 200);
    assert("GET /me does not leak secrets", !containsSecretLeak(me.body));

    // 7) Role-based access control (forged non-admin role token)
    const forged = jwt.sign(
      { sub: String(adminId), email: TEST_EMAIL, role: "employee", type: "access" },
      env.jwt.secret,
      { expiresIn: "5m" }
    );
    const rbac = await request(port, {
      path: "/api/auth/admin-ping",
      token: forged,
    });
    assert("Non-admin role token is rejected (401/403)", rbac.status === 401 || rbac.status === 403);

    // 8) Invalid / expired token
    const invalid = await request(port, {
      path: "/api/auth/admin-ping",
      token: "not.a.real.token",
    });
    assert("Invalid token returns 401", invalid.status === 401);

    const expired = jwt.sign(
      { sub: String(adminId), email: TEST_EMAIL, role: "admin", type: "access" },
      env.jwt.secret,
      { expiresIn: "1ms" }
    );
    await new Promise((r) => setTimeout(r, 20));
    const expiredRes = await request(port, {
      path: "/api/auth/admin-ping",
      token: expired,
    });
    assert("Expired token returns 401", expiredRes.status === 401);

    // Logout
    const logout = await request(port, {
      method: "POST",
      path: "/api/auth/logout",
      token: accessToken,
    });
    assert("Logout returns 200", logout.status === 200);

    // Inactive admin cannot use me after deactivation
    await pool.query(`UPDATE admins SET is_active = FALSE WHERE id = $1`, [adminId]);
    const inactive = await request(port, {
      path: "/api/auth/me",
      token: accessToken,
    });
    assert("Inactive admin token is rejected", inactive.status === 401);

    // 9) Admin registration
    await pool.query(`UPDATE admins SET is_active = TRUE WHERE id = $1`, [adminId]);

    const REG_EMAIL = `auth.register.${Date.now()}@estatex.test`;
    const REG_PASSWORD = `Reg!${Date.now().toString().slice(-6)}`;
    let registeredId = null;

    const missingName = await request(port, {
      method: "POST",
      path: "/api/auth/register",
      body: { email: REG_EMAIL, password: REG_PASSWORD },
    });
    assert("Register missing fullName returns 400", missingName.status === 400);

    const weakPass = await request(port, {
      method: "POST",
      path: "/api/auth/register",
      body: {
        fullName: "Register Tester",
        email: REG_EMAIL,
        password: "123",
      },
    });
    assert("Register weak password returns 400", weakPass.status === 400);

    const missingRole = await request(port, {
      method: "POST",
      path: "/api/auth/register",
      body: {
        fullName: "Register Tester",
        email: REG_EMAIL,
        password: REG_PASSWORD,
      },
    });
    assert("Register missing role returns 400", missingRole.status === 400);

    const registerOk = await request(port, {
      method: "POST",
      path: "/api/auth/register",
      body: {
        fullName: "Register Tester",
        email: REG_EMAIL,
        password: REG_PASSWORD,
        role: "admin",
      },
    });
    assert("Valid register returns 201", registerOk.status === 201);
    assert(
      "Register returns admin role",
      registerOk.json?.data?.admin?.role === "admin"
    );

    const REG_SUPER_EMAIL = `auth.super.${Date.now()}@estatex.test`;
    const registerSuper = await request(port, {
      method: "POST",
      path: "/api/auth/register",
      body: {
        fullName: "Super Register Tester",
        email: REG_SUPER_EMAIL,
        password: REG_PASSWORD,
        role: "super_admin",
      },
    });
    assert("Valid super admin register returns 201", registerSuper.status === 201);
    assert(
      "Register returns super_admin role",
      registerSuper.json?.data?.admin?.role === "super_admin"
    );
    const registeredSuperId = registerSuper.json?.data?.admin?.id;
    assert(
      "Register does not return token (login required)",
      !registerOk.json?.data?.token
    );
    assert(
      "Register response has no secret leak",
      !containsSecretLeak(registerOk.body) &&
        !String(registerOk.body).toLowerCase().includes(REG_PASSWORD.toLowerCase())
    );
    registeredId = registerOk.json?.data?.admin?.id;

    const duplicate = await request(port, {
      method: "POST",
      path: "/api/auth/register",
      body: {
        fullName: "Duplicate Tester",
        email: REG_EMAIL,
        password: REG_PASSWORD,
        role: "admin",
      },
    });
    assert("Duplicate email register returns 409", duplicate.status === 409);

    const newLogin = await request(port, {
      method: "POST",
      path: "/api/auth/login",
      body: { email: REG_EMAIL, password: REG_PASSWORD },
    });
    assert("Newly registered admin can log in", newLogin.status === 200);
    assert(
      "New admin login returns token",
      Boolean(newLogin.json?.data?.token)
    );

    const newPing = await request(port, {
      path: "/api/auth/admin-ping",
      token: newLogin.json?.data?.token,
    });
    assert(
      "Newly registered admin reaches protected route",
      newPing.status === 200
    );

    if (registeredId) {
      await pool.query(`DELETE FROM audit_logs WHERE admin_id = $1`, [
        registeredId,
      ]);
      await pool.query(`DELETE FROM admins WHERE id = $1`, [registeredId]);
    }
    if (registeredSuperId) {
      await pool.query(`DELETE FROM audit_logs WHERE admin_id = $1`, [
        registeredSuperId,
      ]);
      await pool.query(`DELETE FROM admins WHERE id = $1`, [registeredSuperId]);
    }
  } catch (err) {
    assert(`Unexpected test error: ${err.message}`, false);
  } finally {
    server.close();
    if (adminId) {
      await pool.query(`DELETE FROM audit_logs WHERE admin_id = $1`, [adminId]);
      await pool.query(`DELETE FROM admins WHERE id = $1`, [adminId]);
    }
    await pool.end();
  }

  console.log("");
  console.log(`Results: ${passed} passed, ${failed} failed`);
  process.exitCode = failed > 0 ? 1 : 0;
}

run().catch(async (err) => {
  console.error("Auth test runner failed:", err.message);
  try {
    await pool.query(`DELETE FROM admins WHERE email = $1`, [TEST_EMAIL]);
  } catch {
    /* ignore cleanup errors */
  }
  await pool.end().catch(() => {});
  process.exit(1);
});
