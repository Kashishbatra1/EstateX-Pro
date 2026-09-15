/**
 * Phase — Global Search across properties, clients, owners, vendors, expenses
 */
const http = require("http");
const pool = require("../config/db");
const app = require("../app");
const { hashPassword } = require("../utils/password");

const stamp = Date.now();
const TEST_EMAIL = `global.search.${stamp}@estatex.test`;
const TEST_PASSWORD = `Gs!${String(stamp).slice(-6)}`;
const MARKER = `GxSearch${stamp}`;

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
  let propertyId = null;
  let clientId = null;
  let ownerId = null;
  let vendorId = null;
  let expenseId = null;
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
    ["Global Search Tester", TEST_EMAIL, passwordHash]
  );
  adminId = adminIns.rows[0].id;

  const empIns = await pool.query(
    `INSERT INTO employees (full_name, email, phone, designation, is_active, admin_id)
     VALUES ($1,$2,$3,'Agent',TRUE,$4) RETURNING id`,
    [
      `Search Emp ${stamp}`,
      `search.emp.${stamp}@estatex.test`,
      `03${String(stamp).slice(-8)}`,
      adminId,
    ]
  );
  employeeId = empIns.rows[0].id;

  const cat = await pool.query(
    `SELECT id FROM expense_categories WHERE is_active = TRUE ORDER BY id LIMIT 1`
  );
  const categoryId = cat.rows[0]?.id;

  const prop = await pool.query(
    `INSERT INTO properties (title, purpose, category, status, created_by)
     VALUES ($1,'sale','residential','draft',$2) RETURNING id`,
    [`${MARKER} Property`, adminId]
  );
  propertyId = prop.rows[0].id;

  const client = await pool.query(
    `INSERT INTO clients (client_name, phone)
     VALUES ($1,$2) RETURNING id`,
    [`${MARKER} Client`, `04${String(stamp).slice(-8)}`]
  );
  clientId = client.rows[0].id;

  const owner = await pool.query(
    `INSERT INTO owners (owner_name, phone)
     VALUES ($1,$2) RETURNING id`,
    [`${MARKER} Owner`, `05${String(stamp).slice(-8)}`]
  );
  ownerId = owner.rows[0].id;

  const vendor = await pool.query(
    `INSERT INTO vendors (vendor_name, phone)
     VALUES ($1,$2) RETURNING id`,
    [`${MARKER} Vendor`, `06${String(stamp).slice(-8)}`]
  );
  vendorId = vendor.rows[0].id;

  const expenseCode = `EX-${String(stamp).slice(-10)}`;
  const expense = await pool.query(
    `INSERT INTO expenses (
       expense_code, expense_date, category_id, amount, description,
       paid_by_employee_id, created_by
     ) VALUES ($1, CURRENT_DATE, $2, 100.00, $3, $4, $5) RETURNING id`,
    [expenseCode, categoryId, `${MARKER} expense desc`, employeeId, adminId]
  );
  expenseId = expense.rows[0].id;

  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  const { port } = server.address();

  try {
    const unauth = await request(port, { path: "/api/search?q=ab" });
    assert("Unauthorized returns 401", unauth.status === 401);

    const login = await request(port, {
      method: "POST",
      path: "/api/auth/login",
      body: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });
    token = login.json?.data?.token;
    assert("Auth setup", Boolean(token));

    const short = await request(port, { path: "/api/search?q=a", token });
    assert("Short query rejected (400)", short.status === 400);

    const empty = await request(port, { path: "/api/search?q=", token });
    assert("Empty query rejected (400)", empty.status === 400);

    const search = await request(port, {
      path: `/api/search?q=${encodeURIComponent(MARKER)}`,
      token,
    });
    assert("Search returns 200", search.status === 200);
    const data = search.json?.data || {};
    assert("Grouped properties array", Array.isArray(data.properties));
    assert("Grouped clients array", Array.isArray(data.clients));
    assert("Grouped owners array", Array.isArray(data.owners));
    assert("Grouped vendors array", Array.isArray(data.vendors));
    assert("Grouped expenses array", Array.isArray(data.expenses));

    assert(
      "Finds property",
      data.properties.some(
        (p) =>
          Number(p.id) === Number(propertyId) &&
          p.type === "property" &&
          p.path === `/properties/${propertyId}`
      )
    );
    assert(
      "Finds client",
      data.clients.some(
        (c) =>
          Number(c.id) === Number(clientId) &&
          c.type === "client" &&
          c.path === `/clients/${clientId}`
      )
    );
    assert(
      "Finds owner",
      data.owners.some(
        (o) =>
          Number(o.id) === Number(ownerId) &&
          o.type === "owner" &&
          o.path === `/owners/${ownerId}`
      )
    );
    assert(
      "Finds vendor",
      data.vendors.some(
        (v) =>
          Number(v.id) === Number(vendorId) &&
          v.type === "vendor" &&
          v.path === `/vendors/${vendorId}`
      )
    );
    assert(
      "Finds expense",
      data.expenses.some(
        (e) =>
          Number(e.id) === Number(expenseId) &&
          e.type === "expense" &&
          e.path === `/expenses/${expenseId}`
      )
    );
  } catch (err) {
    assert(`Unexpected: ${err.message}`, false);
  } finally {
    server.close();
    if (expenseId) await pool.query(`DELETE FROM expenses WHERE id = $1`, [expenseId]);
    if (vendorId) await pool.query(`DELETE FROM vendors WHERE id = $1`, [vendorId]);
    if (ownerId) await pool.query(`DELETE FROM owners WHERE id = $1`, [ownerId]);
    if (clientId) await pool.query(`DELETE FROM clients WHERE id = $1`, [clientId]);
    if (propertyId) {
      await pool.query(`DELETE FROM property_history WHERE property_id = $1`, [
        propertyId,
      ]);
      await pool.query(`DELETE FROM properties WHERE id = $1`, [propertyId]);
    }
    if (employeeId) await pool.query(`DELETE FROM employees WHERE id = $1`, [employeeId]);
    if (adminId) {
      await pool.query(`DELETE FROM audit_logs WHERE admin_id = $1`, [adminId]);
      await pool.query(`DELETE FROM admins WHERE id = $1`, [adminId]);
    }
    await pool.end();
  }

  console.log(`\nGlobal Search tests: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
