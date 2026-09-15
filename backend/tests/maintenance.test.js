/**
 * Phase 38 — Property Maintenance smoke tests
 */
const http = require("http");
const pool = require("../config/db");
const app = require("../app");
const { hashPassword } = require("../utils/password");

const stamp = Date.now();
const TEST_EMAIL = `maint.${stamp}@estatex.test`;
const TEST_PASSWORD = `Mt!${String(stamp).slice(-6)}`;

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

function tomorrow() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function yesterday() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function run() {
  let passed = 0;
  let failed = 0;
  let adminId = null;
  let propertyId = null;
  let taskId = null;
  let overdueId = null;
  let notificationIds = [];
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
    ["Maint Tester", TEST_EMAIL, passwordHash]
  );
  adminId = Number(adminIns.rows[0].id);

  const prop = await pool.query(
    `INSERT INTO properties (title, purpose, category, status, created_by)
     VALUES ($1,'sale','residential','draft',$2) RETURNING id`,
    [`Maint Prop ${stamp}`, adminId]
  );
  propertyId = Number(prop.rows[0].id);

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

    const created = await request(port, {
      method: "POST",
      path: "/api/maintenance",
      token,
      body: {
        propertyId,
        title: `AC service ${stamp}`,
        category: "hvac",
        priority: "high",
        dueDate: tomorrow(),
        reminderDaysBefore: 7,
        estimatedCost: 5000,
      },
    });
    taskId = Number(created.json?.data?.task?.id);
    assert("Create 201", created.status === 201);
    assert("Has id", Boolean(taskId));
    assert("Status scheduled", created.json?.data?.task?.status === "scheduled");

    const list = await request(port, {
      path: `/api/maintenance?propertyId=${propertyId}`,
      token,
    });
    assert("List 200", list.status === 200);
    assert(
      "Listed",
      (list.json?.data?.items || []).some((t) => t.id === taskId)
    );

    const updated = await request(port, {
      method: "PUT",
      path: `/api/maintenance/${taskId}`,
      token,
      body: { status: "in_progress", notes: "Tech scheduled" },
    });
    assert("Update 200", updated.status === 200);
    assert("In progress", updated.json?.data?.task?.status === "in_progress");

    const overdueCreate = await request(port, {
      method: "POST",
      path: "/api/maintenance",
      token,
      body: {
        propertyId,
        title: `Overdue paint ${stamp}`,
        dueDate: yesterday(),
        priority: "urgent",
      },
    });
    overdueId = Number(overdueCreate.json?.data?.task?.id);
    assert("Overdue task created", overdueCreate.status === 201);

    const overdueDetail = await request(port, {
      path: `/api/maintenance/${overdueId}`,
      token,
    });
    assert("Synced to overdue", overdueDetail.json?.data?.task?.status === "overdue");

    const reminders = await request(port, {
      method: "POST",
      path: "/api/maintenance/reminders/process",
      token,
    });
    assert("Reminders 200", reminders.status === 200);
    assert("Reminders scanned", Number(reminders.json?.data?.scanned) >= 1);

    const notes = await pool.query(
      `SELECT id FROM notifications
       WHERE notification_type = 'maintenance_deadline'
         AND entity_type = 'maintenance_tasks'
         AND entity_id = $1`,
      [taskId]
    );
    notificationIds = notes.rows.map((r) => Number(r.id));
    assert("Deadline notification created", notificationIds.length >= 1);

    const completed = await request(port, {
      method: "PUT",
      path: `/api/maintenance/${taskId}`,
      token,
      body: { status: "completed", actualCost: 4800 },
    });
    assert("Complete 200", completed.status === 200);
    assert("Completed status", completed.json?.data?.task?.status === "completed");
    assert("Completed at set", Boolean(completed.json?.data?.task?.completedAt));

    const removed = await request(port, {
      method: "DELETE",
      path: `/api/maintenance/${taskId}`,
      token,
    });
    assert("Soft delete 200", removed.status === 200);

    const gone = await request(port, {
      path: `/api/maintenance/${taskId}`,
      token,
    });
    assert("Deleted not found", gone.status === 404);
  } finally {
    server.close();
    if (notificationIds.length) {
      await pool.query(`DELETE FROM notifications WHERE id = ANY($1::bigint[])`, [
        notificationIds,
      ]);
    }
    const ids = [taskId, overdueId].filter(Boolean);
    if (ids.length) {
      await pool.query(`DELETE FROM maintenance_tasks WHERE id = ANY($1::bigint[])`, [
        ids,
      ]);
      await pool.query(
        `DELETE FROM audit_logs WHERE entity_type = 'maintenance_tasks' AND entity_id = ANY($1::bigint[])`,
        [ids]
      );
    }
    if (propertyId) {
      await pool.query(`DELETE FROM properties WHERE id = $1`, [propertyId]);
    }
    if (adminId) {
      await pool.query(`DELETE FROM audit_logs WHERE admin_id = $1`, [adminId]);
      await pool.query(`DELETE FROM admins WHERE id = $1`, [adminId]);
    }
    await pool.end();
  }

  console.log(`\nMaintenance tests: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
