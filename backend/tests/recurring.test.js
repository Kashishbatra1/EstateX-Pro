/**
 * Phase 28 — Recurring Expenses tests against live estatex_pro.
 * Usage: npm run test:recurring
 */
const http = require("http");
const pool = require("../config/db");
const app = require("../app");
const { hashPassword } = require("../utils/password");

const stamp = Date.now();
const TEST_EMAIL = `recurring.phase28.${stamp}@estatex.test`;
const TEST_PASSWORD = `Rec!${String(stamp).slice(-6)}`;

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
        res.on("data", (c) => {
          data += c;
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

function tomorrowIso() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function run() {
  let passed = 0;
  let failed = 0;
  let adminId = null;
  let recurringId = null;
  let categoryId = null;
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
     VALUES ($1, $2, $3, TRUE) RETURNING id`,
    ["Phase 28 Recurring Tester", TEST_EMAIL, passwordHash]
  );
  adminId = adminIns.rows[0].id;

  const cat = await pool.query(
    `SELECT id FROM expense_categories WHERE is_active = TRUE ORDER BY id ASC LIMIT 1`
  );
  categoryId = cat.rows[0]?.id || null;

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
    assert("Auth setup", Boolean(token));

    const unauth = await request(port, { path: "/api/recurring-expenses" });
    assert("Unauthorized returns 401", unauth.status === 401);

    const bad = await request(port, {
      method: "POST",
      path: "/api/recurring-expenses",
      token,
      body: { notes: "missing title" },
    });
    assert("Create without title rejected", bad.status === 400);

    const badFreq = await request(port, {
      method: "POST",
      path: "/api/recurring-expenses",
      token,
      body: {
        title: `P28 Bad Freq ${stamp}`,
        amount: 100,
        frequency: "daily",
      },
    });
    assert("Invalid frequency rejected", badFreq.status === 400);

    const dueDate = tomorrowIso();
    const create = await request(port, {
      method: "POST",
      path: "/api/recurring-expenses",
      token,
      body: {
        title: `P28 Office Rent ${stamp}`,
        categoryId,
        amount: 150000,
        frequency: "monthly",
        dueDay: 1,
        nextDueDate: dueDate,
        reminderDaysBefore: 7,
        autoDebitFlag: false,
        annualEscalationPct: 5,
        isActive: true,
        notes: "Phase 28 test recurring",
      },
    });
    assert("Create recurring returns 201", create.status === 201);
    recurringId = create.json?.data?.recurringExpense?.id;
    assert("Create returns id", Boolean(recurringId));
    assert(
      "Create maps fields",
      create.json?.data?.recurringExpense?.title === `P28 Office Rent ${stamp}` &&
        Number(create.json?.data?.recurringExpense?.amount) === 150000 &&
        create.json?.data?.recurringExpense?.frequency === "monthly"
    );

    const list = await request(port, {
      path: `/api/recurring-expenses?search=P28%20Office%20Rent%20${stamp}`,
      token,
    });
    assert("List returns 200", list.status === 200);
    assert(
      "List includes created item",
      (list.json?.data?.items || []).some((i) => i.id === recurringId)
    );

    const dueSoon = await request(port, {
      path: "/api/recurring-expenses?dueSoon=true",
      token,
    });
    assert("Due soon list returns 200", dueSoon.status === 200);
    assert(
      "Due soon includes created item",
      (dueSoon.json?.data?.items || []).some((i) => i.id === recurringId)
    );

    const detail = await request(port, {
      path: `/api/recurring-expenses/${recurringId}`,
      token,
    });
    assert("Get returns 200", detail.status === 200);
    assert(
      "Get title matches",
      detail.json?.data?.recurringExpense?.title === `P28 Office Rent ${stamp}`
    );

    const update = await request(port, {
      method: "PUT",
      path: `/api/recurring-expenses/${recurringId}`,
      token,
      body: {
        amount: 160000,
        autoDebitFlag: true,
        notes: "Escalated for test",
      },
    });
    assert("Update returns 200", update.status === 200);
    assert(
      "Update applied",
      Number(update.json?.data?.recurringExpense?.amount) === 160000 &&
        update.json?.data?.recurringExpense?.autoDebitFlag === true
    );

    const reminders = await request(port, {
      method: "POST",
      path: "/api/recurring-expenses/reminders/process",
      token,
    });
    assert("Process reminders returns 200", reminders.status === 200);
    assert(
      "Reminder created or skipped",
      Number(reminders.json?.data?.created || 0) +
        Number(reminders.json?.data?.skipped || 0) >=
        1
    );

    const remindersAgain = await request(port, {
      method: "POST",
      path: "/api/recurring-expenses/reminders/process",
      token,
    });
    assert("Reminder re-process returns 200", remindersAgain.status === 200);
    assert(
      "Reminder dedupes",
      Number(remindersAgain.json?.data?.created || 0) === 0 ||
        Number(remindersAgain.json?.data?.skipped || 0) >= 1
    );

    const audit = await pool.query(
      `SELECT action FROM audit_logs
       WHERE entity_type = 'recurring_expenses' AND entity_id = $1
       ORDER BY id ASC`,
      [recurringId]
    );
    const actions = audit.rows.map((r) => r.action);
    assert("Audit create logged", actions.includes("RECURRING_CREATE"));
    assert("Audit update logged", actions.includes("RECURRING_UPDATE"));

    const remove = await request(port, {
      method: "DELETE",
      path: `/api/recurring-expenses/${recurringId}`,
      token,
    });
    assert("Soft delete returns 200", remove.status === 200);

    const gone = await request(port, {
      path: `/api/recurring-expenses/${recurringId}`,
      token,
    });
    assert("Deleted item not found", gone.status === 404);

    const auditDel = await pool.query(
      `SELECT 1 FROM audit_logs
       WHERE entity_type = 'recurring_expenses'
         AND entity_id = $1
         AND action = 'RECURRING_SOFT_DELETE'
       LIMIT 1`,
      [recurringId]
    );
    assert("Audit soft delete logged", Boolean(auditDel.rows[0]));
  } catch (err) {
    console.error("Unexpected error:", err);
    failed += 1;
  } finally {
    try {
      if (recurringId) {
        await pool.query(`DELETE FROM notifications WHERE entity_type = 'recurring_expense' AND entity_id = $1`, [
          recurringId,
        ]);
        await pool.query(`DELETE FROM audit_logs WHERE entity_type = 'recurring_expenses' AND entity_id = $1`, [
          recurringId,
        ]);
        await pool.query(`DELETE FROM recurring_expenses WHERE id = $1`, [recurringId]);
      }
      if (adminId) {
        await pool.query(`DELETE FROM audit_logs WHERE admin_id = $1`, [adminId]);
        await pool.query(`DELETE FROM admins WHERE id = $1`, [adminId]);
      }
    } catch (cleanupErr) {
      console.error("Cleanup error:", cleanupErr.message);
    }
    await new Promise((r) => server.close(r));
    await pool.end();
  }

  console.log(`\nRecurring tests: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
