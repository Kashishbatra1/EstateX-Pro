/**
 * Phase 34 — Backup & Restore smoke tests
 */
const fs = require("fs");
const http = require("http");
const pool = require("../config/db");
const app = require("../app");
const { hashPassword } = require("../utils/password");

const stamp = Date.now();
const TEST_EMAIL = `backup.${stamp}@estatex.test`;
const TEST_PASSWORD = `Bk!${String(stamp).slice(-6)}`;

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
  let backupId = null;
  let filePath = null;
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
    ["Backup Tester", TEST_EMAIL, passwordHash]
  );
  adminId = adminIns.rows[0].id;

  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  const { port } = server.address();

  try {
    const login = await request(port, {
      method: "POST",
      path: "/api/auth/login",
      body: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });
    token = login.json?.data?.token;
    assert("Auth", Boolean(token));

    const listEmpty = await request(port, { path: "/api/backups", token });
    assert("List backups 200", listEmpty.status === 200);
    assert("List items array", Array.isArray(listEmpty.json?.data?.items));

    const created = await request(port, {
      method: "POST",
      path: "/api/backups",
      token,
      body: { notes: `test ${stamp}` },
    });
    backupId = created.json?.data?.backup?.id;
    filePath = created.json?.data?.backup?.filePath;
    assert("Create backup 201", created.status === 201);
    assert("Backup completed", created.json?.data?.backup?.status === "completed");
    assert("Backup has file", Boolean(filePath) && fs.existsSync(filePath));
    assert("Backup has size", Number(created.json?.data?.backup?.sizeBytes) > 0);

    const list = await request(port, { path: "/api/backups", token });
    assert(
      "Created backup listed",
      (list.json?.data?.items || []).some((b) => b.id === backupId)
    );

    const restored = await request(port, {
      method: "POST",
      path: `/api/backups/${backupId}/restore`,
      token,
      body: {},
    });
    assert("Mark restored 200", restored.status === 200);
    assert("Status restored", restored.json?.data?.backup?.status === "restored");
    assert("Restored at set", Boolean(restored.json?.data?.backup?.restoredAt));
  } finally {
    server.close();
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        /* ignore */
      }
    }
    if (backupId) {
      await pool.query(`DELETE FROM backups WHERE id = $1`, [backupId]);
    }
    if (adminId) {
      await pool.query(`DELETE FROM admins WHERE id = $1`, [adminId]);
    }
    await pool.end();
  }

  console.log(`\nBackup tests: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
