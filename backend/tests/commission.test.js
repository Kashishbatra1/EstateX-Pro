/**
 * Phase 22 — Commission & Brokerage tests against live estatex_pro.
 * Usage: npm run test:commissions
 */
const http = require("http");
const pool = require("../config/db");
const app = require("../app");
const { hashPassword } = require("../utils/password");

const stamp = Date.now();
const TEST_EMAIL = `commissions.phase22.${stamp}@estatex.test`;
const TEST_PASSWORD = `Com!${String(stamp).slice(-6)}`;

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

async function prepareAvailableProperty(adminId) {
  const pm = await pool.query(
    `SELECT id FROM payment_methods WHERE is_active = TRUE ORDER BY id LIMIT 1`
  );
  const paymentMethodId = pm.rows[0].id;
  const cnicSuffix = String(stamp).slice(-7).padStart(7, "0");

  const ownerIns = await pool.query(
    `INSERT INTO owners (owner_name, cnic, verification_status, verified_at, verified_by)
     VALUES ($1, $2, 'verified', CURRENT_TIMESTAMP, $3)
     RETURNING id`,
    [`P22 Owner ${stamp}`, `35202-${cnicSuffix}-2`, adminId]
  );
  const ownerId = ownerIns.rows[0].id;

  const bankIns = await pool.query(
    `INSERT INTO bank_accounts (bank_name, account_holder_name, account_number, is_active)
     VALUES ($1, $2, $3, TRUE) RETURNING id`,
    [`P22 Bank`, "EstateX Test", `P22ACC${stamp}`]
  );
  const bankId = bankIns.rows[0].id;

  const propIns = await pool.query(
    `INSERT INTO properties (
       title, property_type, purpose, category, city, area,
       asking_price, primary_payment_method_id, status
     ) VALUES ($1, 'House', 'sale', 'residential', 'Lahore', 'DHA',
               10000000, $2, 'draft')
     RETURNING id, property_code`,
    [`Phase22 Property ${stamp}`, paymentMethodId]
  );
  const propertyId = propIns.rows[0].id;

  await pool.query(
    `INSERT INTO property_owners (property_id, owner_id, share_percentage, is_primary)
     VALUES ($1, $2, 100, TRUE)`,
    [propertyId, ownerId]
  );
  await pool.query(
    `INSERT INTO property_bank_accounts (property_id, bank_account_id, is_primary)
     VALUES ($1, $2, TRUE)`,
    [propertyId, bankId]
  );
  await pool.query(
    `UPDATE properties SET status = 'available', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
    [propertyId]
  );

  return { propertyId, paymentMethodId };
}

async function run() {
  let passed = 0;
  let failed = 0;
  let adminId = null;
  let token = null;
  let propertyId = null;
  let clientId = null;
  let bookingId = null;
  let commissionId = null;
  let employeeId = null;

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
    ["Phase 22 Commission Tester", TEST_EMAIL, passwordHash]
  );
  adminId = adminIns.rows[0].id;

  const empIns = await pool.query(
    `INSERT INTO employees (full_name, email, designation, is_active, admin_id)
     VALUES ($1, $2, 'Agent', TRUE, $3) RETURNING id`,
    [`P22 Agent ${stamp}`, `agent.p22.${stamp}@estatex.test`, adminId]
  );
  employeeId = empIns.rows[0].id;

  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();

  try {
    const login = await request(port, {
      method: "POST",
      path: "/api/auth/login",
      body: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });
    token = login.json?.data?.token;
    assert("Auth setup", Boolean(token));

    const noAuth = await request(port, { path: "/api/commissions" });
    assert("Unauthorized access returns 401", noAuth.status === 401);

    const prepared = await prepareAvailableProperty(adminId);
    propertyId = prepared.propertyId;

    const clientIns = await pool.query(
      `INSERT INTO clients (client_name, client_type, phone)
       VALUES ($1, 'buyer', '03001234567') RETURNING id`,
      [`P22 Client ${stamp}`]
    );
    clientId = clientIns.rows[0].id;

    const booking = await request(port, {
      method: "POST",
      path: "/api/bookings",
      token,
      body: {
        propertyId,
        clientId,
        bookingAmount: 1000000,
        totalPrice: 10000000,
      },
    });
    assert("Setup booking", booking.status === 201);
    bookingId = booking.json?.data?.booking?.id;

    const badPct = await request(port, {
      method: "POST",
      path: "/api/commissions",
      token,
      body: {
        propertyId,
        bookingId,
        commissionPercentage: -1,
      },
    });
    assert("Negative percentage rejected", badPct.status === 400);

    const badOverride = await request(port, {
      method: "POST",
      path: "/api/commissions",
      token,
      body: {
        propertyId,
        bookingId,
        commissionPercentage: 2,
        isManualOverride: true,
        finalAmount: 150000,
      },
    });
    assert("Override without reason rejected", badOverride.status === 400);

    const badRel = await request(port, {
      method: "POST",
      path: "/api/commissions",
      token,
      body: {
        propertyId,
        bookingId: 999999999,
        commissionPercentage: 2,
      },
    });
    assert("Invalid booking rejected", badRel.status === 400);

    const create = await request(port, {
      method: "POST",
      path: "/api/commissions",
      token,
      body: {
        propertyId,
        bookingId,
        commissionPercentage: 2,
        brokerageFromBuyer: 50000,
        brokerageFromSeller: 75000,
        assignedAgentId: employeeId,
        referralSource: "Walk-in",
      },
    });
    assert("Create commission returns 201", create.status === 201);
    const commission = create.json?.data?.commission;
    commissionId = commission?.id;
    assert("Calculated amount is 2% of booking total", commission?.calculatedAmount === 200000);
    assert("Final equals calculated without override", commission?.finalAmount === 200000);
    assert("Buyer brokerage stored", commission?.brokerageFromBuyer === 50000);
    assert("Seller brokerage stored", commission?.brokerageFromSeller === 75000);
    assert("Starts unpaid", commission?.paymentStatus === "unpaid");

    const list = await request(port, {
      path: `/api/commissions?propertyId=${propertyId}`,
      token,
    });
    assert("List commissions returns 200", list.status === 200);
    assert(
      "List includes created commission",
      (list.json?.data?.items || []).some((c) => c.id === commissionId)
    );

    const get = await request(port, {
      path: `/api/commissions/${commissionId}`,
      token,
    });
    assert("Get by id returns 200", get.status === 200);
    assert("Get includes base amount", get.json?.data?.commission?.baseAmount === 10000000);

    const override = await request(port, {
      method: "PUT",
      path: `/api/commissions/${commissionId}`,
      token,
      body: {
        isManualOverride: true,
        finalAmount: 180000,
        overrideReason: "Negotiated package deal",
        paymentStatus: "partial",
      },
    });
    assert("Manual override returns 200", override.status === 200);
    assert(
      "Override final amount applied",
      override.json?.data?.commission?.finalAmount === 180000
    );
    assert(
      "Calculated amount retained",
      override.json?.data?.commission?.calculatedAmount === 200000
    );
    assert(
      "Override flag true",
      override.json?.data?.commission?.isManualOverride === true
    );

    const hist = await pool.query(
      `SELECT id FROM property_history
       WHERE property_id = $1 AND event_type = 'commission_override'
       ORDER BY id DESC LIMIT 1`,
      [propertyId]
    );
    assert("Property history has commission_override", Boolean(hist.rows[0]));

    const audit = await pool.query(
      `SELECT action FROM audit_logs
       WHERE entity_type = 'commission' AND entity_id = $1`,
      [commissionId]
    );
    const actions = audit.rows.map((r) => r.action);
    assert("Audit has create", actions.includes("COMMISSION_CREATE"));
    assert(
      "Audit has override/update",
      actions.includes("COMMISSION_OVERRIDE") ||
        actions.includes("COMMISSION_UPDATE")
    );

    const remove = await request(port, {
      method: "DELETE",
      path: `/api/commissions/${commissionId}`,
      token,
      body: {},
    });
    assert("Soft-delete returns 200", remove.status === 200);

    const gone = await request(port, {
      path: `/api/commissions/${commissionId}`,
      token,
    });
    assert("Soft-deleted hidden from get", gone.status === 404);

    const listAfter = await request(port, {
      path: `/api/commissions?propertyId=${propertyId}`,
      token,
    });
    assert(
      "Soft-deleted excluded from list",
      !(listAfter.json?.data?.items || []).some((c) => c.id === commissionId)
    );

    const props = await request(port, { path: "/api/properties?limit=1", token });
    assert("Regression: properties ok", props.status === 200);
    const bookings = await request(port, { path: "/api/bookings?limit=1", token });
    assert("Regression: bookings ok", bookings.status === 200);
    const payments = await request(port, { path: "/api/payments?limit=1", token });
    assert("Regression: payments ok", payments.status === 200);
  } catch (err) {
    assert(`Unexpected test error: ${err.message}`, false);
  } finally {
    server.close();
    if (commissionId) {
      await pool.query(`DELETE FROM audit_logs WHERE entity_type = 'commission' AND entity_id = $1`, [
        commissionId,
      ]);
      await pool.query(`DELETE FROM commissions WHERE id = $1`, [commissionId]);
    }
    if (bookingId) {
      await pool.query(`DELETE FROM booking_installments WHERE booking_id = $1`, [
        bookingId,
      ]);
      await pool.query(`DELETE FROM bookings WHERE id = $1`, [bookingId]);
    }
    if (propertyId) {
      await pool.query(
        `UPDATE properties SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [propertyId]
      );
      await pool.query(`DELETE FROM property_history WHERE property_id = $1`, [
        propertyId,
      ]);
      await pool.query(`DELETE FROM property_owners WHERE property_id = $1`, [
        propertyId,
      ]);
      await pool.query(
        `DELETE FROM property_bank_accounts WHERE property_id = $1`,
        [propertyId]
      );
      await pool.query(`DELETE FROM properties WHERE id = $1`, [propertyId]);
    }
    if (clientId) {
      await pool.query(`DELETE FROM clients WHERE id = $1`, [clientId]);
    }
    if (employeeId) {
      await pool.query(`DELETE FROM employees WHERE id = $1`, [employeeId]);
    }
    if (adminId) {
      await pool.query(`DELETE FROM audit_logs WHERE admin_id = $1`, [adminId]);
      await pool.query(`DELETE FROM admins WHERE id = $1`, [adminId]);
    }
    await pool.query(
      `DELETE FROM bank_accounts WHERE account_number = $1`,
      [`P22ACC${stamp}`]
    );
    await pool.query(
      `DELETE FROM owners WHERE cnic LIKE $1`,
      [`%${String(stamp).slice(-7)}%`]
    );
    await pool.end();
  }

  console.log("");
  console.log(`Phase 22 commission tests: ${passed} passed, ${failed} failed`);
  process.exitCode = failed > 0 ? 1 : 0;
}

run().catch(async (err) => {
  console.error("Commission test runner failed:", err.message);
  await pool.end().catch(() => {});
  process.exit(1);
});
