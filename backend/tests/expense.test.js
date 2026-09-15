/**
 * Phase 9 — Expense Management tests against live estatex_pro.
 * Usage: npm run test:expenses
 */
const http = require("http");
const pool = require("../config/db");
const app = require("../app");
const { hashPassword } = require("../utils/password");

const stamp = Date.now();
const TEST_EMAIL = `expenses.phase9.${stamp}@estatex.test`;
const TEST_PASSWORD = `Exp!${String(stamp).slice(-6)}`;

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

async function run() {
  let passed = 0;
  let failed = 0;
  let adminId = null;
  let token = null;
  let employeeId = null;
  let categoryId = null;
  let subcategoryId = null;
  let paymentMethodId = null;
  let expenseId = null;
  let expenseCode = null;
  let deviceExpenseId = null;
  let inventoryItemId = null;

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
    ["Phase 9 Expense Tester", TEST_EMAIL, passwordHash]
  );
  adminId = adminIns.rows[0].id;

  const empIns = await pool.query(
    `INSERT INTO employees (full_name, email, phone, designation, is_active, admin_id)
     VALUES ($1, $2, $3, 'Agent', TRUE, $4)
     RETURNING id`,
    [`P9 Employee ${stamp}`, `p9.emp.${stamp}@estatex.test`, "03005556677", adminId]
  );
  employeeId = empIns.rows[0].id;

  const cat = await pool.query(
    `SELECT id FROM expense_categories WHERE is_active = TRUE ORDER BY id LIMIT 1`
  );
  categoryId = cat.rows[0]?.id;

  const sub = await pool.query(
    `SELECT id FROM expense_subcategories WHERE category_id = $1 AND is_active = TRUE LIMIT 1`,
    [categoryId]
  );
  subcategoryId = sub.rows[0]?.id || null;

  const pm = await pool.query(
    `SELECT id FROM payment_methods WHERE is_active = TRUE ORDER BY id LIMIT 1`
  );
  paymentMethodId = pm.rows[0]?.id;

  const deviceCat = await pool.query(
    `SELECT id FROM expense_categories WHERE category_name = 'Device Purchases' LIMIT 1`
  );
  const deviceCategoryId = deviceCat.rows[0]?.id || categoryId;

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

    // 1) Unauthorized
    const unauth = await request(port, { path: "/api/expenses" });
    assert("Unauthorized access returns 401", unauth.status === 401);

    // 2) Create expense
    const create = await request(port, {
      method: "POST",
      path: "/api/expenses",
      token,
      body: {
        categoryId,
        subcategoryId,
        amount: 2500,
        gstSalesTax: 0,
        remainingAmount: 0,
        paymentMethodId,
        paidByEmployeeId: employeeId,
        description: `Phase9 fuel expense ${stamp}`,
        expenseDate: "2026-09-08",
        reimbursementStatus: "none",
      },
    });
    assert("Create expense returns 201", create.status === 201);
    expenseId = create.json?.data?.expense?.id;
    expenseCode = create.json?.data?.expense?.expenseCode;
    assert("Created expense has id/code", Boolean(expenseId) && Boolean(expenseCode));
    assert(
      "New expense starts as requested",
      create.json?.data?.expense?.approvalStatus === "requested"
    );

    // 3) Invalid amount
    const zero = await request(port, {
      method: "POST",
      path: "/api/expenses",
      token,
      body: {
        categoryId,
        amount: 0,
        paidByEmployeeId: employeeId,
      },
    });
    assert("Zero amount rejected", zero.status === 400);

    const neg = await request(port, {
      method: "POST",
      path: "/api/expenses",
      token,
      body: {
        categoryId,
        amount: -100,
        paidByEmployeeId: employeeId,
      },
    });
    assert("Negative amount rejected", neg.status === 400);

    // 4) Invalid relationships
    const badCat = await request(port, {
      method: "POST",
      path: "/api/expenses",
      token,
      body: { categoryId: 999999, amount: 100, paidByEmployeeId: employeeId },
    });
    assert("Invalid category rejected", badCat.status === 400);

    const badEmp = await request(port, {
      method: "POST",
      path: "/api/expenses",
      token,
      body: { categoryId, amount: 100, paidByEmployeeId: 999999 },
    });
    assert("Invalid employee rejected", badEmp.status === 400);

    const badProp = await request(port, {
      method: "POST",
      path: "/api/expenses",
      token,
      body: {
        categoryId,
        amount: 100,
        paidByEmployeeId: employeeId,
        propertyId: 99999999,
      },
    });
    assert("Invalid property rejected", badProp.status === 400);

    // Remaining > amount
    const remBad = await request(port, {
      method: "POST",
      path: "/api/expenses",
      token,
      body: {
        categoryId,
        amount: 100,
        remainingAmount: 150,
        paidByEmployeeId: employeeId,
      },
    });
    assert("Remaining exceeding amount rejected", remBad.status === 400);

    // 5) List / search / filter
    const list = await request(port, { path: "/api/expenses", token });
    assert("List expenses returns 200", list.status === 200);
    assert("List returns items", Array.isArray(list.json?.data?.items));

    const search = await request(port, {
      path: `/api/expenses?search=${encodeURIComponent(expenseCode)}`,
      token,
    });
    assert("Search expenses returns 200", search.status === 200);
    assert(
      "Search finds expense",
      (search.json?.data?.items || []).some((e) => e.id === expenseId)
    );

    const filter = await request(port, {
      path: `/api/expenses?categoryId=${categoryId}&approvalStatus=requested&expenseFrom=2026-01-01&expenseTo=2026-12-31&paidByEmployeeId=${employeeId}`,
      token,
    });
    assert("Filter expenses returns 200", filter.status === 200);
    assert(
      "Filter includes created expense",
      (filter.json?.data?.items || []).some((e) => e.id === expenseId)
    );

    // 6) Get by ID
    const byId = await request(port, { path: `/api/expenses/${expenseId}`, token });
    assert("Get expense by id returns 200", byId.status === 200);
    assert("Get by id matches code", byId.json?.data?.expense?.expenseCode === expenseCode);

    // 7) Update
    const update = await request(port, {
      method: "PUT",
      path: `/api/expenses/${expenseId}`,
      token,
      body: {
        description: `Updated phase9 expense ${stamp}`,
        amount: 2750,
        remainingAmount: 250,
      },
    });
    assert("Update expense returns 200", update.status === 200);
    assert(
      "Update changes description",
      update.json?.data?.expense?.description.includes("Updated phase9")
    );
    assert("Update changes amount", update.json?.data?.expense?.amount === 2750);

    // 8) Approval workflow
    const approve = await request(port, {
      method: "PATCH",
      path: `/api/expenses/${expenseId}/approval`,
      token,
      body: { approvalStatus: "approved" },
    });
    assert("Approve expense returns 200", approve.status === 200);
    assert(
      "Approval status is approved",
      approve.json?.data?.expense?.approvalStatus === "approved"
    );

    const badTransition = await request(port, {
      method: "PATCH",
      path: `/api/expenses/${expenseId}/approval`,
      token,
      body: { approvalStatus: "rejected", rejectionReason: "too late" },
    });
    assert("Invalid approval transition rejected", badTransition.status === 400);

    const updateApproved = await request(port, {
      method: "PUT",
      path: `/api/expenses/${expenseId}`,
      token,
      body: { description: "should fail" },
    });
    assert("Update approved expense rejected", updateApproved.status === 400);

    // Device purchase → inventory sync
    const device = await request(port, {
      method: "POST",
      path: "/api/expenses",
      token,
      body: {
        categoryId: deviceCategoryId,
        amount: 45000,
        paidByEmployeeId: employeeId,
        paymentMethodId,
        deviceOrItemName: `P9 Test Printer ${stamp}`,
        quantity: 1,
        description: "Device purchase for inventory sync",
      },
    });
    assert("Device expense create returns 201", device.status === 201);
    deviceExpenseId = device.json?.data?.expense?.id;
    inventoryItemId = device.json?.data?.expense?.inventoryItemId;
    assert("Device expense linked to inventory", Boolean(inventoryItemId));

    const inv = await pool.query(
      `SELECT item_name, quantity FROM inventory_items WHERE id = $1`,
      [inventoryItemId]
    );
    assert(
      "Inventory item created",
      inv.rows[0]?.item_name === `P9 Test Printer ${stamp}` &&
        Number(inv.rows[0].quantity) === 1
    );
    const txn = await pool.query(
      `SELECT COUNT(*)::INT AS c FROM inventory_transactions
       WHERE expense_id = $1 AND txn_type = 'purchase'`,
      [deviceExpenseId]
    );
    assert("Inventory purchase transaction recorded", txn.rows[0].c === 1);

    // Reject path on another expense
    const toReject = await request(port, {
      method: "POST",
      path: "/api/expenses",
      token,
      body: {
        categoryId,
        amount: 500,
        paidByEmployeeId: employeeId,
        description: `reject-me ${stamp}`,
      },
    });
    const rejectId = toReject.json?.data?.expense?.id;
    const rejectNoReason = await request(port, {
      method: "PATCH",
      path: `/api/expenses/${rejectId}/approval`,
      token,
      body: { approvalStatus: "rejected" },
    });
    assert("Reject without reason rejected", rejectNoReason.status === 400);
    const reject = await request(port, {
      method: "PATCH",
      path: `/api/expenses/${rejectId}/approval`,
      token,
      body: { approvalStatus: "rejected", rejectionReason: "Duplicate claim" },
    });
    assert("Reject with reason returns 200", reject.status === 200);

    // 9) Soft-delete
    const softDel = await request(port, {
      method: "DELETE",
      path: `/api/expenses/${rejectId}`,
      token,
    });
    assert("Soft-delete expense returns 200", softDel.status === 200);
    assert("Soft-deleted has deletedAt", Boolean(softDel.json?.data?.expense?.deletedAt));

    const getDeleted = await request(port, { path: `/api/expenses/${rejectId}`, token });
    assert("Soft-deleted expense hidden from get", getDeleted.status === 404);

    const listAfter = await request(port, {
      path: `/api/expenses?search=${encodeURIComponent(`reject-me ${stamp}`)}`,
      token,
    });
    assert(
      "Soft-deleted excluded from list",
      !(listAfter.json?.data?.items || []).some((e) => e.id === rejectId)
    );

    // 10) Audit logs
    const audits = await pool.query(
      `SELECT action FROM audit_logs
       WHERE entity_type = 'expense' AND entity_id = $1
       ORDER BY id`,
      [expenseId]
    );
    const actions = audits.rows.map((r) => r.action);
    assert(
      "Audit log has create/update/approve",
      actions.includes("EXPENSE_CREATE") &&
        actions.includes("EXPENSE_UPDATE") &&
        actions.includes("EXPENSE_APPROVED")
    );

    // Regression modules
    const clients = await request(port, { path: "/api/clients", token });
    assert("Regression: clients ok", clients.status === 200);
    const bookings = await request(port, { path: "/api/bookings", token });
    assert("Regression: bookings ok", bookings.status === 200);
    const payments = await request(port, { path: "/api/payments", token });
    assert("Regression: payments ok", payments.status === 200);
  } catch (err) {
    console.error("UNEXPECTED ERROR:", err);
    failed += 1;
  } finally {
    await new Promise((r) => server.close(r));
    try {
      if (deviceExpenseId) {
        await pool.query(`DELETE FROM inventory_transactions WHERE expense_id = $1`, [
          deviceExpenseId,
        ]);
      }
      await pool.query(
        `DELETE FROM inventory_transactions WHERE expense_id IN (
           SELECT id FROM expenses WHERE created_by = $1
         )`,
        [adminId]
      );
      await pool.query(`DELETE FROM expenses WHERE created_by = $1`, [adminId]);
      if (inventoryItemId) {
        await pool.query(`DELETE FROM inventory_items WHERE id = $1`, [inventoryItemId]);
      }
      await pool.query(`DELETE FROM inventory_items WHERE item_name LIKE $1`, [
        `P9 Test Printer ${stamp}%`,
      ]);
      await pool.query(`DELETE FROM audit_logs WHERE admin_id = $1`, [adminId]);
      await pool.query(`DELETE FROM employees WHERE id = $1`, [employeeId]);
      await pool.query(`DELETE FROM admins WHERE id = $1`, [adminId]);
    } catch (cleanupErr) {
      console.warn("Cleanup warning:", cleanupErr.message);
    }
    await pool.end();
  }

  console.log(`\nPhase 9 expense tests: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(async (err) => {
  console.error(err);
  try {
    await pool.end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
