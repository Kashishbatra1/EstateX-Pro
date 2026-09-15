/**
 * Phase 35 — Budgets smoke tests
 */
const http = require("http");
const pool = require("../config/db");
const app = require("../app");
const { hashPassword } = require("../utils/password");

const stamp = Date.now();
const TEST_EMAIL = `budget.${stamp}@estatex.test`;
const TEST_PASSWORD = `Bd!${String(stamp).slice(-6)}`;
const YEAR = 2090;
const MONTH = 6;

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
  let categoryId = null;
  let categoryId2 = null;
  let budgetId = null;
  let lineId = null;
  let token = null;
  let notificationIds = [];

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
    ["Budget Tester", TEST_EMAIL, passwordHash]
  );
  adminId = adminIns.rows[0].id;

  const cats = await pool.query(
    `SELECT id FROM expense_categories WHERE is_active = TRUE ORDER BY id ASC LIMIT 2`
  );
  categoryId = cats.rows[0]?.id;
  categoryId2 = cats.rows[1]?.id || cats.rows[0]?.id;

  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  const { port } = server.address();

  try {
    assert("Have expense category", Boolean(categoryId));

    const login = await request(port, {
      method: "POST",
      path: "/api/auth/login",
      body: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });
    token = login.json?.data?.token;
    assert("Auth", Boolean(token));

    const created = await request(port, {
      method: "POST",
      path: "/api/budgets",
      token,
      body: {
        name: `Office Budget ${stamp}`,
        periodType: "monthly",
        year: YEAR,
        month: MONTH,
        totalAmount: 100000,
        alertThresholdPct: 50,
        lines: [
          { categoryId, allocatedAmount: 40000, notes: "Cat A" },
        ],
      },
    });
    budgetId = created.json?.data?.budget?.id;
    assert("Create budget 201", created.status === 201);
    assert("Budget has id", Boolean(budgetId));
    assert(
      "Budget has line",
      Array.isArray(created.json?.data?.budget?.lines) &&
        created.json.data.budget.lines.length === 1
    );
    lineId = created.json?.data?.budget?.lines?.[0]?.id;

    const dup = await request(port, {
      method: "POST",
      path: "/api/budgets",
      token,
      body: {
        name: `Dup ${stamp}`,
        periodType: "monthly",
        year: YEAR,
        month: MONTH,
        totalAmount: 1,
      },
    });
    assert("Duplicate period rejected", dup.status === 409);

    const badMonth = await request(port, {
      method: "POST",
      path: "/api/budgets",
      token,
      body: {
        name: `Annual bad ${stamp}`,
        periodType: "annual",
        year: YEAR,
        month: 3,
        totalAmount: 1,
      },
    });
    assert("Annual with month rejected", badMonth.status === 400);

    const list = await request(port, {
      path: `/api/budgets?year=${YEAR}&periodType=monthly`,
      token,
    });
    assert("List 200", list.status === 200);
    assert(
      "List contains budget",
      (list.json?.data?.items || []).some((b) => b.id === budgetId)
    );

    const detail = await request(port, {
      path: `/api/budgets/${budgetId}`,
      token,
    });
    assert("Detail 200", detail.status === 200);
    assert("Detail utilization present", detail.json?.data?.budget?.utilizationPct != null);

    const updated = await request(port, {
      method: "PUT",
      path: `/api/budgets/${budgetId}`,
      token,
      body: { totalAmount: 50000, name: `Office Budget Updated ${stamp}` },
    });
    assert("Update 200", updated.status === 200);
    assert("Total updated", Number(updated.json?.data?.budget?.totalAmount) === 50000);

    const addLine = await request(port, {
      method: "POST",
      path: `/api/budgets/${budgetId}/lines`,
      token,
      body: { categoryId: categoryId2, allocatedAmount: 10000 },
    });
    assert(
      "Add line",
      addLine.status === 201 || (categoryId2 === categoryId && addLine.status === 409)
    );
    if (addLine.status === 201) {
      const secondLineId = addLine.json?.data?.line?.id;
      const updLine = await request(port, {
        method: "PUT",
        path: `/api/budgets/${budgetId}/lines/${secondLineId}`,
        token,
        body: { allocatedAmount: 12000 },
      });
      assert("Update line 200", updLine.status === 200);
      const delLine = await request(port, {
        method: "DELETE",
        path: `/api/budgets/${budgetId}/lines/${secondLineId}`,
        token,
      });
      assert("Delete line 200", delLine.status === 200);
    } else {
      assert("Update line skipped (same category)", true);
      assert("Delete line skipped (same category)", true);
    }

    // Force overspend alert: threshold 50%, spent may be 0 — set threshold to 0.01 via update then process
    // With spent 0, utilization is 0 which is not >= 50. Create tiny total and fake by using alert 0.01 won't work (min > 0).
    // Instead set totalAmount very small if there are expenses in period, OR set threshold low and insert expense.
    const emp = await pool.query(
      `SELECT id FROM employees WHERE deleted_at IS NULL ORDER BY id LIMIT 1`
    );
    let expenseId = null;
    if (emp.rows[0]) {
      const exp = await pool.query(
        `INSERT INTO expenses (
           expense_code, expense_date, category_id, amount, paid_by_employee_id,
           approval_status, created_by
         ) VALUES ($1, $2, $3, $4, $5, 'approved', $6)
         RETURNING id`,
        [
          `BUD-EXP-${stamp}`,
          `${YEAR}-${String(MONTH).padStart(2, "0")}-15`,
          categoryId,
          40000,
          emp.rows[0].id,
          adminId,
        ]
      );
      expenseId = exp.rows[0].id;
    }

    const afterSpend = await request(port, {
      path: `/api/budgets/${budgetId}`,
      token,
    });
    assert(
      "Spent reflected",
      expenseId == null || Number(afterSpend.json?.data?.budget?.spentAmount) >= 40000
    );

    const alerts = await request(port, {
      method: "POST",
      path: "/api/budgets/alerts/process",
      token,
    });
    assert("Alerts process 200", alerts.status === 200);
    assert("Alerts scanned", Number(alerts.json?.data?.scanned) >= 1);

    if (expenseId) {
      const notes = await pool.query(
        `SELECT id FROM notifications
         WHERE notification_type = 'budget_overspending'
           AND entity_type = 'budgets'
           AND entity_id = $1`,
        [budgetId]
      );
      notificationIds = notes.rows.map((r) => r.id);
      assert("Overspend notification created", notificationIds.length >= 1);
    } else {
      assert("Overspend notification skipped (no employee)", true);
    }

    const removed = await request(port, {
      method: "DELETE",
      path: `/api/budgets/${budgetId}`,
      token,
    });
    assert("Soft delete 200", removed.status === 200);

    const gone = await request(port, {
      path: `/api/budgets/${budgetId}`,
      token,
    });
    assert("Deleted not found", gone.status === 404);

    if (expenseId) {
      await pool.query(`DELETE FROM expenses WHERE id = $1`, [expenseId]);
    }
  } finally {
    server.close();
    if (notificationIds.length) {
      await pool.query(`DELETE FROM notifications WHERE id = ANY($1::bigint[])`, [
        notificationIds,
      ]);
    }
    if (budgetId) {
      await pool.query(`DELETE FROM budget_lines WHERE budget_id = $1`, [budgetId]);
      await pool.query(`DELETE FROM budgets WHERE id = $1`, [budgetId]);
      await pool.query(
        `DELETE FROM audit_logs WHERE entity_type = 'budgets' AND entity_id = $1`,
        [budgetId]
      );
    }
    if (adminId) {
      await pool.query(`DELETE FROM audit_logs WHERE admin_id = $1`, [adminId]);
      await pool.query(`DELETE FROM admins WHERE id = $1`, [adminId]);
    }
    await pool.end();
  }

  console.log(`\nBudget tests: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
