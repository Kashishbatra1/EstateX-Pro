/**
 * Phase 36 — Petty Cash smoke tests
 */
const http = require("http");
const pool = require("../config/db");
const app = require("../app");
const { hashPassword } = require("../utils/password");

const stamp = Date.now();
const TEST_EMAIL = `petty.${stamp}@estatex.test`;
const TEST_PASSWORD = `Pc!${String(stamp).slice(-6)}`;

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
  let employeeId = null;
  let accountId = null;
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
    ["Petty Tester", TEST_EMAIL, passwordHash]
  );
  adminId = adminIns.rows[0].id;

  const emp = await pool.query(
    `SELECT id FROM employees WHERE deleted_at IS NULL AND is_active = TRUE ORDER BY id LIMIT 1`
  );
  employeeId = emp.rows[0]?.id;

  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  const { port } = server.address();

  try {
    assert("Have employee", Boolean(employeeId));

    const login = await request(port, {
      method: "POST",
      path: "/api/auth/login",
      body: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });
    token = login.json?.data?.token;
    assert("Auth", Boolean(token));

    const created = await request(port, {
      method: "POST",
      path: "/api/petty-cash",
      token,
      body: {
        accountName: `Front desk float ${stamp}`,
        custodianEmployeeId: employeeId,
        floatAmount: 10000,
        notes: "test",
      },
    });
    accountId = created.json?.data?.account?.id;
    assert("Create 201", created.status === 201);
    assert("Balance equals float", Number(created.json?.data?.account?.currentBalance) === 10000);

    const list = await request(port, { path: "/api/petty-cash", token });
    assert("List 200", list.status === 200);
    assert(
      "Listed",
      (list.json?.data?.items || []).some((a) => a.id === accountId)
    );

    const inflow = await request(port, {
      method: "POST",
      path: `/api/petty-cash/${accountId}/transactions`,
      token,
      body: { txnType: "in", amount: 500, description: "top up", performedBy: employeeId },
    });
    assert("In txn 201", inflow.status === 201);
    assert(
      "Balance after in",
      Number(inflow.json?.data?.account?.currentBalance) === 10500
    );

    const outflow = await request(port, {
      method: "POST",
      path: `/api/petty-cash/${accountId}/transactions`,
      token,
      body: { txnType: "out", amount: 1500, description: "taxi" },
    });
    assert("Out txn 201", outflow.status === 201);
    assert(
      "Balance after out",
      Number(outflow.json?.data?.account?.currentBalance) === 9000
    );

    const overdraw = await request(port, {
      method: "POST",
      path: `/api/petty-cash/${accountId}/transactions`,
      token,
      body: { txnType: "out", amount: 999999 },
    });
    assert("Overdraw rejected", overdraw.status === 400);

    const recon = await request(port, {
      method: "POST",
      path: `/api/petty-cash/${accountId}/reconciliations`,
      token,
      body: { countedBalance: 8950, reconciledBy: employeeId, notes: "short 50" },
    });
    assert("Recon 201", recon.status === 201);
    assert("Variance -50", Number(recon.json?.data?.reconciliation?.variance) === -50);
    assert(
      "System balance 9000",
      Number(recon.json?.data?.reconciliation?.systemBalance) === 9000
    );

    const detail = await request(port, {
      path: `/api/petty-cash/${accountId}`,
      token,
    });
    assert("Detail 200", detail.status === 200);
    assert(
      "Detail has txns",
      (detail.json?.data?.account?.transactions || []).length >= 2
    );
    assert(
      "Detail has recons",
      (detail.json?.data?.account?.reconciliations || []).length >= 1
    );

    const updated = await request(port, {
      method: "PUT",
      path: `/api/petty-cash/${accountId}`,
      token,
      body: { accountName: `Front desk updated ${stamp}`, isActive: true },
    });
    assert("Update 200", updated.status === 200);

    const removed = await request(port, {
      method: "DELETE",
      path: `/api/petty-cash/${accountId}`,
      token,
    });
    assert("Soft delete 200", removed.status === 200);

    const gone = await request(port, {
      path: `/api/petty-cash/${accountId}`,
      token,
    });
    assert("Deleted not found", gone.status === 404);
  } finally {
    server.close();
    if (accountId) {
      await pool.query(`DELETE FROM petty_cash_reconciliations WHERE account_id = $1`, [
        accountId,
      ]);
      await pool.query(`DELETE FROM petty_cash_transactions WHERE account_id = $1`, [
        accountId,
      ]);
      await pool.query(`DELETE FROM petty_cash_accounts WHERE id = $1`, [accountId]);
      await pool.query(
        `DELETE FROM audit_logs WHERE entity_type = 'petty_cash_accounts' AND entity_id = $1`,
        [accountId]
      );
    }
    if (adminId) {
      await pool.query(`DELETE FROM audit_logs WHERE admin_id = $1`, [adminId]);
      await pool.query(`DELETE FROM admins WHERE id = $1`, [adminId]);
    }
    await pool.end();
  }

  console.log(`\nPetty cash tests: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
