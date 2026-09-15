/**
 * Phase 26 — Office Inventory Tracking tests against live estatex_pro.
 * Usage: npm run test:inventory
 */
const http = require("http");
const pool = require("../config/db");
const app = require("../app");
const { hashPassword } = require("../utils/password");

const stamp = Date.now();
const TEST_EMAIL = `inventory.phase26.${stamp}@estatex.test`;
const TEST_PASSWORD = `Inv!${String(stamp).slice(-6)}`;

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
  let employeeId = null;
  let employeeId2 = null;
  let itemId = null;
  let expenseId = null;
  let expenseInventoryId = null;
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
    ["Phase 26 Inventory Tester", TEST_EMAIL, passwordHash]
  );
  adminId = adminIns.rows[0].id;

  const emp1 = await pool.query(
    `INSERT INTO employees (full_name, email, designation, is_active, admin_id)
     VALUES ($1, $2, 'Agent', TRUE, $3) RETURNING id`,
    [`P26 Emp A ${stamp}`, `p26a.${stamp}@estatex.test`, adminId]
  );
  employeeId = emp1.rows[0].id;

  const emp2 = await pool.query(
    `INSERT INTO employees (full_name, email, designation, is_active, admin_id)
     VALUES ($1, $2, 'Clerk', TRUE, $3) RETURNING id`,
    [`P26 Emp B ${stamp}`, `p26b.${stamp}@estatex.test`, adminId]
  );
  employeeId2 = emp2.rows[0].id;

  const cat = await pool.query(
    `SELECT id FROM expense_categories WHERE is_active = TRUE ORDER BY id LIMIT 1`
  );
  categoryId = cat.rows[0]?.id;

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

    const unauth = await request(port, { path: "/api/inventory" });
    assert("Unauthorized inventory returns 401", unauth.status === 401);

    const employees = await request(port, {
      path: "/api/employees",
      token,
    });
    assert("List employees returns 200", employees.status === 200);
    assert(
      "Employees include test employee",
      (employees.json?.data?.items || []).some(
        (e) => Number(e.id) === Number(employeeId)
      )
    );

    const badCreate = await request(port, {
      method: "POST",
      path: "/api/inventory",
      token,
      body: { quantity: 2 },
    });
    assert("Create without itemName rejected", badCreate.status === 400);

    const create = await request(port, {
      method: "POST",
      path: "/api/inventory",
      token,
      body: {
        itemName: `P26 Laptop ${stamp}`,
        itemType: "Device",
        quantity: 2,
        unit: "pcs",
        purchaseCost: 150000,
        locationNotes: "Main office",
      },
    });
    assert("Create inventory returns 201", create.status === 201);
    itemId = create.json?.data?.item?.id;
    assert("Created item has id", Boolean(itemId));
    assert("Created quantity is 2", create.json?.data?.item?.quantity === 2);
    assert(
      "Created status in_stock",
      create.json?.data?.item?.status === "in_stock"
    );

    const list = await request(port, {
      path: `/api/inventory?search=P26%20Laptop%20${stamp}`,
      token,
    });
    assert("List inventory returns 200", list.status === 200);
    assert(
      "List includes created item",
      (list.json?.data?.items || []).some((i) => i.id === itemId)
    );

    const detail = await request(port, {
      path: `/api/inventory/${itemId}`,
      token,
    });
    assert("Get inventory returns 200", detail.status === 200);

    const txnsBefore = await request(port, {
      path: `/api/inventory/${itemId}/transactions`,
      token,
    });
    assert("Transactions list returns 200", txnsBefore.status === 200);
    assert(
      "Initial purchase txn present",
      (txnsBefore.json?.data?.items || []).some((t) => t.txnType === "purchase")
    );

    const assignBad = await request(port, {
      method: "POST",
      path: `/api/inventory/${itemId}/assign`,
      token,
      body: {},
    });
    assert("Assign without employee rejected", assignBad.status === 400);

    const assign = await request(port, {
      method: "POST",
      path: `/api/inventory/${itemId}/assign`,
      token,
      body: { employeeId, notes: "Assigned for fieldwork" },
    });
    assert("Assign returns 200", assign.status === 200);
    assert("Status is assigned", assign.json?.data?.item?.status === "assigned");
    assert(
      "Assigned to employee",
      Number(assign.json?.data?.item?.assignedTo) === Number(employeeId)
    );

    const reassign = await request(port, {
      method: "POST",
      path: `/api/inventory/${itemId}/assign`,
      token,
      body: { employeeId: employeeId2 },
    });
    assert("Reassign returns 200", reassign.status === 200);
    assert(
      "Reassigned employee",
      Number(reassign.json?.data?.item?.assignedTo) === Number(employeeId2)
    );

    const ret = await request(port, {
      method: "POST",
      path: `/api/inventory/${itemId}/return`,
      token,
      body: { notes: "Back to store" },
    });
    assert("Return returns 200", ret.status === 200);
    assert("Returned status in_stock", ret.json?.data?.item?.status === "in_stock");
    assert("Assigned cleared", ret.json?.data?.item?.assignedTo === null);

    const retAgain = await request(port, {
      method: "POST",
      path: `/api/inventory/${itemId}/return`,
      token,
      body: {},
    });
    assert("Return when unassigned rejected", retAgain.status === 400);

    const adjust = await request(port, {
      method: "POST",
      path: `/api/inventory/${itemId}/adjust`,
      token,
      body: { quantityChange: 1, notes: "Extra unit found" },
    });
    assert("Adjust returns 200", adjust.status === 200);
    assert("Quantity after adjust is 3", adjust.json?.data?.item?.quantity === 3);

    const negAdjust = await request(port, {
      method: "POST",
      path: `/api/inventory/${itemId}/adjust`,
      token,
      body: { quantityChange: -10 },
    });
    assert("Negative over-adjust rejected", negAdjust.status === 400);

    const update = await request(port, {
      method: "PUT",
      path: `/api/inventory/${itemId}`,
      token,
      body: { locationNotes: "Store room B", notes: "Updated" },
    });
    assert("Update returns 200", update.status === 200);
    assert(
      "Location updated",
      update.json?.data?.item?.locationNotes === "Store room B"
    );

    const txns = await request(port, {
      path: `/api/inventory/${itemId}/transactions`,
      token,
    });
    const types = (txns.json?.data?.items || []).map((t) => t.txnType);
    assert("Has assign txn", types.includes("assign"));
    assert("Has return txn", types.includes("return"));
    assert("Has adjust txn", types.includes("adjust"));

    // Expense device purchase → inventory sync (acceptance criterion)
    if (categoryId) {
      const expense = await request(port, {
        method: "POST",
        path: "/api/expenses",
        token,
        body: {
          categoryId,
          paidByEmployeeId: employeeId,
          amount: 45000,
          description: `P26 device purchase ${stamp}`,
          deviceOrItemName: `P26 Printer ${stamp}`,
          quantity: 1,
        },
      });
      assert("Device expense create returns 201", expense.status === 201);
      expenseId = expense.json?.data?.expense?.id;
      expenseInventoryId = expense.json?.data?.expense?.inventoryItemId;
      assert(
        "Expense linked to inventory item",
        Boolean(expenseInventoryId)
      );

      const synced = await request(port, {
        path: `/api/inventory/${expenseInventoryId}`,
        token,
      });
      assert("Synced inventory readable", synced.status === 200);
      assert(
        "Synced item name matches device",
        synced.json?.data?.item?.itemName === `P26 Printer ${stamp}`
      );

      const purchaseTx = await request(port, {
        path: `/api/inventory/${expenseInventoryId}/transactions`,
        token,
      });
      assert(
        "Expense purchase txn linked",
        (purchaseTx.json?.data?.items || []).some(
          (t) => t.txnType === "purchase" && t.expenseId === expenseId
        )
      );
    } else {
      assert("Expense category available for sync test", false);
    }

    const del = await request(port, {
      method: "DELETE",
      path: `/api/inventory/${itemId}`,
      token,
    });
    assert("Soft-delete returns 200", del.status === 200);
    assert("deletedAt set", Boolean(del.json?.data?.item?.deletedAt));

    const afterDel = await request(port, {
      path: `/api/inventory/${itemId}`,
      token,
    });
    assert("Soft-deleted hidden from get", afterDel.status === 404);

    const expensesOk = await request(port, {
      path: "/api/expenses?limit=1",
      token,
    });
    assert("Expenses regression ok", expensesOk.status === 200);
  } catch (err) {
    assert(`Unexpected error: ${err.message}`, false);
  } finally {
    server.close();
    if (expenseId) {
      await pool.query(`DELETE FROM inventory_transactions WHERE expense_id = $1`, [
        expenseId,
      ]);
      await pool.query(`DELETE FROM expenses WHERE id = $1`, [expenseId]);
    }
    if (expenseInventoryId) {
      await pool.query(`DELETE FROM inventory_transactions WHERE inventory_item_id = $1`, [
        expenseInventoryId,
      ]);
      await pool.query(`DELETE FROM inventory_items WHERE id = $1`, [
        expenseInventoryId,
      ]);
    }
    if (itemId) {
      await pool.query(`DELETE FROM inventory_transactions WHERE inventory_item_id = $1`, [
        itemId,
      ]);
      await pool.query(`DELETE FROM inventory_items WHERE id = $1`, [itemId]);
    }
    if (adminId) {
      await pool.query(`DELETE FROM audit_logs WHERE admin_id = $1`, [adminId]);
    }
    if (employeeId) await pool.query(`DELETE FROM employees WHERE id = $1`, [employeeId]);
    if (employeeId2) await pool.query(`DELETE FROM employees WHERE id = $1`, [employeeId2]);
    if (adminId) await pool.query(`DELETE FROM admins WHERE id = $1`, [adminId]);
    await pool.end();
  }

  console.log(`\nPhase 26 inventory tests: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
