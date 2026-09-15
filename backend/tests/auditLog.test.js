/**
 * Phase 37 — Audit log viewer smoke tests
 */
const http = require("http");
const pool = require("../config/db");
const app = require("../app");
const { hashPassword } = require("../utils/password");

const stamp = Date.now();
const TEST_EMAIL = `audit.${stamp}@estatex.test`;
const TEST_PASSWORD = `Au!${String(stamp).slice(-6)}`;

function request(port, { method = "GET", path, body, token } = {}) {
  const payload = body ? JSON.stringify(body) : null;
  const headers = { Accept: "application/json" };
  if (payload) {
    headers["Content-Type"] = "application/json";
    headers["Content-Length"] = Buffer.byteLength(payload);
  }
  if (token) headers.Authorization = `Bearer ${token}`;
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: "127.0.0.1", port, path, method, headers },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          let json = null;
          try {
            json = JSON.parse(data);
          } catch {
            json = null;
          }
          resolve({ status: res.statusCode, json });
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function run() {
  let passed = 0;
  let failed = 0;
  let adminId = null;
  let auditId = null;
  let token = null;

  function assert(name, condition) {
    if (condition) {
      console.log(`PASS — ${name}`);
      passed += 1;
    } else {
      console.error(`FAIL — ${name}`);
      failed += 1;
    }
  }

  const passwordHash = await hashPassword(TEST_PASSWORD);
  const adminIns = await pool.query(
    `INSERT INTO admins (full_name, email, password_hash, is_active)
     VALUES ($1,$2,$3,TRUE) RETURNING id`,
    ["Audit Tester", TEST_EMAIL, passwordHash]
  );
  adminId = Number(adminIns.rows[0].id);

  const auditIns = await pool.query(
    `INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, old_data, new_data)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
     RETURNING id`,
    [
      adminId,
      `AUDIT_VIEW_TEST_${stamp}`,
      "budgets",
      999001,
      JSON.stringify({ before: true }),
      JSON.stringify({ after: true, stamp }),
    ]
  );
  auditId = Number(auditIns.rows[0].id);

  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  const { port } = server.address();

  try {
    const unauth = await request(port, { path: "/api/audit-logs" });
    assert("Unauthorized 401", unauth.status === 401);

    const login = await request(port, {
      method: "POST",
      path: "/api/auth/login",
      body: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });
    token = login.json?.data?.token;
    assert("Auth", Boolean(token));

    const list = await request(port, {
      path: `/api/audit-logs?action=AUDIT_VIEW_TEST_${stamp}`,
      token,
    });
    assert("List 200", list.status === 200);
    assert(
      "List contains seeded log",
      (list.json?.data?.items || []).some((x) => x.id === auditId)
    );

    const byEntity = await request(port, {
      path: "/api/audit-logs?entityType=budgets&entityId=999001",
      token,
    });
    assert("Filter entity 200", byEntity.status === 200);
    assert(
      "Filter entity match",
      (byEntity.json?.data?.items || []).some((x) => x.id === auditId)
    );

    const byAdmin = await request(port, {
      path: `/api/audit-logs?adminId=${adminId}`,
      token,
    });
    assert("Filter admin 200", byAdmin.status === 200);
    assert(
      "Filter admin match",
      (byAdmin.json?.data?.items || []).some((x) => x.id === auditId)
    );

    const search = await request(port, {
      path: `/api/audit-logs?search=${stamp}`,
      token,
    });
    assert("Search 200", search.status === 200);
    assert(
      "Search match",
      (search.json?.data?.items || []).some((x) => x.id === auditId)
    );

    const badDate = await request(port, {
      path: "/api/audit-logs?dateFrom=2026-12-31&dateTo=2026-01-01",
      token,
    });
    assert("Inverted dates rejected", badDate.status === 400);

    const detail = await request(port, {
      path: `/api/audit-logs/${auditId}`,
      token,
    });
    assert("Detail 200", detail.status === 200);
    assert("Detail action", detail.json?.data?.auditLog?.action?.includes("AUDIT_VIEW_TEST"));
    assert("Detail has newData", detail.json?.data?.auditLog?.newData?.after === true);
    assert("Detail admin name", detail.json?.data?.auditLog?.adminName === "Audit Tester");

    const missing = await request(port, {
      path: "/api/audit-logs/999999999",
      token,
    });
    assert("Missing 404", missing.status === 404);
  } finally {
    server.close();
    if (auditId) {
      await pool.query(`DELETE FROM audit_logs WHERE id = $1`, [auditId]);
    }
    if (adminId) {
      await pool.query(`DELETE FROM audit_logs WHERE admin_id = $1`, [adminId]);
      await pool.query(`DELETE FROM admins WHERE id = $1`, [adminId]);
    }
    await pool.end();
  }

  console.log(`\nAudit log tests: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
