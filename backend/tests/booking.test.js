/**
 * Phase 7 — Booking Management tests against live estatex_pro.
 * Usage: npm run test:bookings
 */
const http = require("http");
const pool = require("../config/db");
const app = require("../app");
const { hashPassword } = require("../utils/password");

const stamp = Date.now();
const TEST_EMAIL = `bookings.phase7.${stamp}@estatex.test`;
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

async function prepareAvailableProperty(adminId, label) {
  const pm = await pool.query(
    `SELECT id FROM payment_methods WHERE is_active = TRUE ORDER BY id LIMIT 1`
  );
  const paymentMethodId = pm.rows[0].id;

  const ownerIns = await pool.query(
    `INSERT INTO owners (owner_name, cnic, verification_status, verified_at, verified_by)
     VALUES ($1, $2, 'verified', CURRENT_TIMESTAMP, $3)
     RETURNING id`,
    [`P7 Owner ${label}`, `35202-${String(stamp).slice(-6)}${label}`.slice(0, 15), adminId]
  );
  const ownerId = ownerIns.rows[0].id;

  const bankIns = await pool.query(
    `INSERT INTO bank_accounts (bank_name, account_holder_name, account_number, is_active)
     VALUES ($1, $2, $3, TRUE)
     RETURNING id`,
    [`P7 Bank ${label}`, "EstateX Test", `P7ACC${stamp}${label}`]
  );
  const bankId = bankIns.rows[0].id;

  const propIns = await pool.query(
    `INSERT INTO properties (
       title, property_type, purpose, category, city, area,
       asking_price, primary_payment_method_id, status
     ) VALUES ($1, 'House', 'sale', 'residential', 'Lahore', 'DHA',
               25000000, $2, 'draft')
     RETURNING id, property_code`,
    [`Phase7 Property ${label} ${stamp}`, paymentMethodId]
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

  return { propertyId, propertyCode: propIns.rows[0].property_code };
}

async function run() {
  let passed = 0;
  let failed = 0;
  let adminId = null;
  let token = null;
  let clientId = null;
  let propertyA = null;
  let propertyB = null;
  let bookingId = null;
  let bookingCode = null;
  let cancelBookingId = null;
  let completeBookingId = null;

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
    ["Phase 7 Booking Tester", TEST_EMAIL, passwordHash]
  );
  adminId = adminIns.rows[0].id;

  const clientIns = await pool.query(
    `INSERT INTO clients (client_name, cnic, phone, client_type)
     VALUES ($1, $2, $3, 'buyer')
     RETURNING id`,
    [`Phase7 Client ${stamp}`, `35202-${String(stamp).slice(-7)}-7`, "03001112233"]
  );
  clientId = clientIns.rows[0].id;

  propertyA = await prepareAvailableProperty(adminId, "A");
  propertyB = await prepareAvailableProperty(adminId, "B");
  const propertyC = await prepareAvailableProperty(adminId, "C");

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
    const unauth = await request(port, { path: "/api/bookings" });
    assert("Unauthorized access returns 401", unauth.status === 401);

    // 2) Create booking
    const create = await request(port, {
      method: "POST",
      path: "/api/bookings",
      token,
      body: {
        propertyId: propertyA.propertyId,
        clientId,
        bookingAmount: 2000000,
        totalPrice: 25000000,
        installmentPlanName: "12-Month Plan",
        monthlyInstallmentAmount: 1916666.67,
        tokenReceiptNumber: `TR-P7-${stamp}`,
        bookingExpiryDate: "2030-12-31",
        digitalAgreementUrl: "https://example.com/agreement/p7",
        installments: [
          { dueDate: "2030-01-31", amountDue: 1916666.67 },
          { dueDate: "2030-02-28", amountDue: 1916666.67 },
        ],
      },
    });
    assert("Create booking returns 201", create.status === 201);
    bookingId = create.json?.data?.booking?.id;
    bookingCode = create.json?.data?.booking?.bookingCode;
    assert("Created booking has id", Boolean(bookingId));
    assert("Created booking status is pending", create.json?.data?.booking?.status === "pending");
    assert(
      "Remaining balance = total - down payment",
      create.json?.data?.booking?.remainingBalance === 23000000
    );
    assert(
      "Installment schedule stored",
      Array.isArray(create.json?.data?.booking?.installments) &&
        create.json.data.booking.installments.length === 2
    );

    // 3) Invalid property
    const badProp = await request(port, {
      method: "POST",
      path: "/api/bookings",
      token,
      body: {
        propertyId: 99999999,
        clientId,
        bookingAmount: 1000,
        totalPrice: 5000,
      },
    });
    assert("Create with invalid property returns 400", badProp.status === 400);

    // 4) Invalid client
    const badClient = await request(port, {
      method: "POST",
      path: "/api/bookings",
      token,
      body: {
        propertyId: propertyB.propertyId,
        clientId: 99999999,
        bookingAmount: 1000,
        totalPrice: 5000,
      },
    });
    assert("Create with invalid client returns 400", badClient.status === 400);

    // 5) Get all
    const list = await request(port, { path: "/api/bookings", token });
    assert("Get all bookings returns 200", list.status === 200);
    assert("Get all returns items", Array.isArray(list.json?.data?.items));

    // 6) Get by id
    const byId = await request(port, { path: `/api/bookings/${bookingId}`, token });
    assert("Get booking by id returns 200", byId.status === 200);
    assert("Get by id matches code", byId.json?.data?.booking?.bookingCode === bookingCode);

    // 7) Update booking
    const update = await request(port, {
      method: "PUT",
      path: `/api/bookings/${bookingId}`,
      token,
      body: {
        tokenReceiptNumber: `TR-P7-UPD-${stamp}`,
        bookingExpiryDate: "2031-01-15",
        bookingAmount: 3000000,
        totalPrice: 25000000,
      },
    });
    assert("Update booking returns 200", update.status === 200);
    assert(
      "Update changes token receipt",
      update.json?.data?.booking?.tokenReceiptNumber === `TR-P7-UPD-${stamp}`
    );
    assert(
      "Update recalculates remaining balance",
      update.json?.data?.booking?.remainingBalance === 22000000
    );

    // 8–11) Amount validations
    const neg = await request(port, {
      method: "POST",
      path: "/api/bookings",
      token,
      body: {
        propertyId: propertyB.propertyId,
        clientId,
        bookingAmount: -100,
        totalPrice: 5000,
      },
    });
    assert("Negative amount rejected", neg.status === 400);

    const exceed = await request(port, {
      method: "POST",
      path: "/api/bookings",
      token,
      body: {
        propertyId: propertyB.propertyId,
        clientId,
        bookingAmount: 6000,
        totalPrice: 5000,
      },
    });
    assert("Down payment exceeding total rejected", exceed.status === 400);

    const updateExceed = await request(port, {
      method: "PUT",
      path: `/api/bookings/${bookingId}`,
      token,
      body: { bookingAmount: 30000000 },
    });
    assert("Update down payment exceeding total rejected", updateExceed.status === 400);

    // 12–16) Status workflow
    const toConfirmed = await request(port, {
      method: "PATCH",
      path: `/api/bookings/${bookingId}/status`,
      token,
      body: { status: "confirmed" },
    });
    assert("Pending → Confirmed returns 200", toConfirmed.status === 200);
    assert("Status is confirmed", toConfirmed.json?.data?.booking?.status === "confirmed");

    const propAfterConfirm = await pool.query(
      `SELECT status FROM properties WHERE id = $1`,
      [propertyA.propertyId]
    );
    assert(
      "Confirm reserves property",
      propAfterConfirm.rows[0].status === "reserved"
    );

    const invalidJump = await request(port, {
      method: "PATCH",
      path: `/api/bookings/${bookingId}/status`,
      token,
      body: { status: "pending" },
    });
    assert("Invalid status transition rejected", invalidJump.status === 400);

    // Pending → Cancelled on another booking
    const createCancel = await request(port, {
      method: "POST",
      path: "/api/bookings",
      token,
      body: {
        propertyId: propertyB.propertyId,
        clientId,
        bookingAmount: 500000,
        totalPrice: 10000000,
        bookingExpiryDate: "2030-06-01",
      },
    });
    cancelBookingId = createCancel.json?.data?.booking?.id;
    const pendingCancel = await request(port, {
      method: "POST",
      path: `/api/bookings/${cancelBookingId}/cancel`,
      token,
      body: {
        cancellationReason: "Client withdrew",
        refundAmount: 500000,
        refundDetails: "Full refund of token",
      },
    });
    assert("Pending → Cancelled returns 200", pendingCancel.status === 200);
    assert(
      "Cancelled preserves reason",
      pendingCancel.json?.data?.booking?.cancellationReason === "Client withdrew"
    );
    assert(
      "Cancelled stores refund amount",
      pendingCancel.json?.data?.booking?.refundAmount === 500000
    );

    // Confirmed → Completed
    const createComplete = await request(port, {
      method: "POST",
      path: "/api/bookings",
      token,
      body: {
        propertyId: propertyC.propertyId,
        clientId,
        bookingAmount: 1000000,
        totalPrice: 20000000,
      },
    });
    completeBookingId = createComplete.json?.data?.booking?.id;
    await request(port, {
      method: "PATCH",
      path: `/api/bookings/${completeBookingId}/status`,
      token,
      body: { status: "confirmed" },
    });
    const completed = await request(port, {
      method: "POST",
      path: `/api/bookings/${completeBookingId}/complete`,
      token,
    });
    assert("Confirmed → Completed returns 200", completed.status === 200);
    assert("Status is completed", completed.json?.data?.booking?.status === "completed");

    const propSold = await pool.query(
      `SELECT status FROM properties WHERE id = $1`,
      [propertyC.propertyId]
    );
    assert("Complete sets property sold", propSold.rows[0].status === "sold");

    // Confirmed → Cancelled on main booking
    const confirmedCancel = await request(port, {
      method: "POST",
      path: `/api/bookings/${bookingId}/cancel`,
      token,
      body: { cancellationReason: "Deal collapsed after confirmation" },
    });
    assert("Confirmed → Cancelled returns 200", confirmedCancel.status === 200);

    const propRestored = await pool.query(
      `SELECT status FROM properties WHERE id = $1`,
      [propertyA.propertyId]
    );
    assert(
      "Cancel restores reserved property to available",
      propRestored.rows[0].status === "available"
    );

    // 17–18) Search / filter
    const search = await request(port, {
      path: `/api/bookings?search=${encodeURIComponent(bookingCode)}`,
      token,
    });
    assert("Search bookings returns 200", search.status === 200);
    assert(
      "Search finds booking by reference",
      (search.json?.data?.items || []).some((b) => b.id === bookingId)
    );

    const filter = await request(port, {
      path: `/api/bookings?status=cancelled&clientId=${clientId}&propertyId=${propertyB.propertyId}`,
      token,
    });
    assert("Filter bookings returns 200", filter.status === 200);
    assert(
      "Filter includes cancelled booking",
      (filter.json?.data?.items || []).some((b) => b.id === cancelBookingId)
    );

    const expiryFilter = await request(port, {
      path: "/api/bookings?expiryFrom=2030-01-01&expiryTo=2031-12-31",
      token,
    });
    assert("Filter by expiry date returns 200", expiryFilter.status === 200);

    // 19) Conflicting active booking
    const conflictProp = await prepareAvailableProperty(adminId, "D");
    const first = await request(port, {
      method: "POST",
      path: "/api/bookings",
      token,
      body: {
        propertyId: conflictProp.propertyId,
        clientId,
        bookingAmount: 100,
        totalPrice: 1000,
      },
    });
    assert("First booking on free property ok", first.status === 201);
    const conflict = await request(port, {
      method: "POST",
      path: "/api/bookings",
      token,
      body: {
        propertyId: conflictProp.propertyId,
        clientId,
        bookingAmount: 100,
        totalPrice: 1000,
      },
    });
    assert("Conflicting active booking prevented", conflict.status === 409);

    // 20) Soft delete cancelled booking
    const softDel = await request(port, {
      method: "DELETE",
      path: `/api/bookings/${cancelBookingId}`,
      token,
    });
    assert("Soft delete cancelled booking returns 200", softDel.status === 200);
    assert("Soft deleted has deletedAt", Boolean(softDel.json?.data?.booking?.deletedAt));

    // Confirmed cannot soft-delete without cancel — recreate confirmed
    const propE = await prepareAvailableProperty(adminId, "E");
    const confCreate = await request(port, {
      method: "POST",
      path: "/api/bookings",
      token,
      body: {
        propertyId: propE.propertyId,
        clientId,
        bookingAmount: 100,
        totalPrice: 1000,
      },
    });
    const confId = confCreate.json?.data?.booking?.id;
    await request(port, {
      method: "PATCH",
      path: `/api/bookings/${confId}/status`,
      token,
      body: { status: "confirmed" },
    });
    const badDel = await request(port, {
      method: "DELETE",
      path: `/api/bookings/${confId}`,
      token,
    });
    assert("Soft delete confirmed booking rejected", badDel.status === 400);

    // 21) Audit / history
    const audits = await pool.query(
      `SELECT action FROM audit_logs
       WHERE entity_type = 'booking' AND entity_id = $1
       ORDER BY id`,
      [bookingId]
    );
    const actions = audits.rows.map((r) => r.action);
    assert(
      "Audit recorded create/update/status actions",
      actions.includes("BOOKING_CREATE") &&
        actions.includes("BOOKING_UPDATE") &&
        actions.includes("BOOKING_CONFIRMED") &&
        actions.includes("BOOKING_CANCELLED")
    );

    const hist = await pool.query(
      `SELECT COUNT(*)::INT AS c FROM property_history
       WHERE property_id = $1 AND description ILIKE '%Booking%'`,
      [propertyA.propertyId]
    );
    assert("Property history has booking events", hist.rows[0].c >= 1);

    // 22) Regression — existing modules still respond
    const clients = await request(port, { path: "/api/clients", token });
    assert("Regression: clients list ok", clients.status === 200);
    const props = await request(port, { path: "/api/properties", token });
    assert("Regression: properties list ok", props.status === 200);
    const banks = await request(port, { path: "/api/bank-accounts", token });
    assert("Regression: bank accounts list ok", banks.status === 200);
    const me = await request(port, { path: "/api/auth/me", token });
    assert("Regression: auth/me ok", me.status === 200);
  } catch (err) {
    console.error("UNEXPECTED ERROR:", err);
    failed += 1;
  } finally {
    await new Promise((r) => server.close(r));
    // Cleanup ephemeral rows (best-effort; soft-deleted / FK-safe)
    try {
      if (bookingId) {
        await pool.query(`DELETE FROM booking_installments WHERE booking_id = $1`, [bookingId]);
      }
      await pool.query(
        `DELETE FROM bookings WHERE created_by = $1 OR client_id = $2`,
        [adminId, clientId]
      );
      await pool.query(`DELETE FROM clients WHERE id = $1`, [clientId]);
      await pool.query(
        `UPDATE properties SET status = 'draft' WHERE title LIKE $1`,
        [`Phase7 Property %${stamp}%`]
      );
      await pool.query(
        `DELETE FROM property_owners WHERE property_id IN (
           SELECT id FROM properties WHERE title LIKE $1
         )`,
        [`Phase7 Property %${stamp}%`]
      );
      await pool.query(
        `DELETE FROM property_bank_accounts WHERE property_id IN (
           SELECT id FROM properties WHERE title LIKE $1
         )`,
        [`Phase7 Property %${stamp}%`]
      );
      await pool.query(`DELETE FROM property_history WHERE property_id IN (
           SELECT id FROM properties WHERE title LIKE $1
         )`, [`Phase7 Property %${stamp}%`]);
      await pool.query(`DELETE FROM properties WHERE title LIKE $1`, [
        `Phase7 Property %${stamp}%`,
      ]);
      await pool.query(`DELETE FROM owners WHERE owner_name LIKE $1`, [
        `P7 Owner % ${stamp}`,
      ]);
      await pool.query(
        `DELETE FROM bank_accounts WHERE account_number LIKE $1`,
        [`P7ACC${stamp}%`]
      );
      await pool.query(`DELETE FROM audit_logs WHERE admin_id = $1`, [adminId]);
      await pool.query(`DELETE FROM admins WHERE id = $1`, [adminId]);
    } catch (cleanupErr) {
      console.warn("Cleanup warning:", cleanupErr.message);
    }
    await pool.end();
  }

  console.log(`\nPhase 7 booking tests: ${passed} passed, ${failed} failed`);
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
