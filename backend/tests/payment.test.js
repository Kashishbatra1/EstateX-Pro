/**
 * Phase 8 — Payments Management tests against live estatex_pro.
 * Usage: npm run test:payments
 */
const http = require("http");
const pool = require("../config/db");
const app = require("../app");
const { hashPassword } = require("../utils/password");

const stamp = Date.now();
const TEST_EMAIL = `payments.phase8.${stamp}@estatex.test`;
const TEST_PASSWORD = `Pay!${String(stamp).slice(-6)}`;

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
  const cnicSuffix = `${String(stamp).slice(-5)}${label.charCodeAt(0)}`.padStart(7, "0").slice(-7);

  const ownerIns = await pool.query(
    `INSERT INTO owners (owner_name, cnic, verification_status, verified_at, verified_by)
     VALUES ($1, $2, 'verified', CURRENT_TIMESTAMP, $3)
     RETURNING id`,
    [`P8 Owner ${label} ${stamp}`, `35202-${cnicSuffix}-8`, adminId]
  );
  const ownerId = ownerIns.rows[0].id;

  const bankIns = await pool.query(
    `INSERT INTO bank_accounts (bank_name, account_holder_name, account_number, is_active)
     VALUES ($1, $2, $3, TRUE)
     RETURNING id`,
    [`P8 Bank ${label}`, "EstateX Test", `P8ACC${stamp}${label}`]
  );
  const bankId = bankIns.rows[0].id;

  const propIns = await pool.query(
    `INSERT INTO properties (
       title, property_type, purpose, category, city, area,
       asking_price, primary_payment_method_id, status
     ) VALUES ($1, 'House', 'sale', 'residential', 'Lahore', 'DHA',
               20000000, $2, 'draft')
     RETURNING id, property_code`,
    [`Phase8 Property ${label} ${stamp}`, paymentMethodId]
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

  return { propertyId, bankId, paymentMethodId };
}

async function run() {
  let passed = 0;
  let failed = 0;
  let adminId = null;
  let token = null;
  let clientId = null;
  let paymentMethodId = null;
  let bankId = null;
  let bookingId = null;
  let installmentId = null;
  let paymentId = null;
  let paymentCode = null;
  let cancelledBookingId = null;

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
    ["Phase 8 Payment Tester", TEST_EMAIL, passwordHash]
  );
  adminId = adminIns.rows[0].id;

  const clientIns = await pool.query(
    `INSERT INTO clients (client_name, cnic, phone, client_type)
     VALUES ($1, $2, $3, 'buyer')
     RETURNING id`,
    [`Phase8 Client ${stamp}`, `35202-${String(stamp).slice(-7)}-8`, "03002223344"]
  );
  clientId = clientIns.rows[0].id;

  const propA = await prepareAvailableProperty(adminId, "A");
  const propB = await prepareAvailableProperty(adminId, "B");
  paymentMethodId = propA.paymentMethodId;
  bankId = propA.bankId;

  const inactivePm = await pool.query(
    `INSERT INTO payment_methods (method_name, is_active)
     VALUES ($1, FALSE)
     ON CONFLICT (method_name) DO UPDATE SET is_active = FALSE
     RETURNING id`,
    [`P8 Inactive ${stamp}`]
  );
  const inactivePmId = inactivePm.rows[0].id;

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
    assert("Authorized access / auth setup", Boolean(token));

    // Setup booking with installments via Phase 7 API
    const booking = await request(port, {
      method: "POST",
      path: "/api/bookings",
      token,
      body: {
        propertyId: propA.propertyId,
        clientId,
        bookingAmount: 2000000,
        totalPrice: 20000000,
        installmentPlanName: "10-Month",
        monthlyInstallmentAmount: 1800000,
        installments: [
          { dueDate: "2030-01-31", amountDue: 1800000 },
          { dueDate: "2030-02-28", amountDue: 1800000 },
        ],
      },
    });
    assert("Setup booking via Phase 7", booking.status === 201);
    bookingId = booking.json?.data?.booking?.id;
    installmentId = booking.json?.data?.booking?.installments?.[0]?.id;
    assert("Booking remaining starts at total-down", booking.json?.data?.booking?.remainingBalance === 18000000);

    const cancelBooking = await request(port, {
      method: "POST",
      path: "/api/bookings",
      token,
      body: {
        propertyId: propB.propertyId,
        clientId,
        bookingAmount: 500000,
        totalPrice: 5000000,
      },
    });
    cancelledBookingId = cancelBooking.json?.data?.booking?.id;
    await request(port, {
      method: "POST",
      path: `/api/bookings/${cancelledBookingId}/cancel`,
      token,
      body: { cancellationReason: "Cancelled for payment tests" },
    });

    // 1) Unauthorized
    const unauth = await request(port, { path: "/api/payments" });
    assert("Unauthorized access returns 401", unauth.status === 401);

    // 2) Create valid payment linked to installment
    const create = await request(port, {
      method: "POST",
      path: "/api/payments",
      token,
      body: {
        bookingId,
        installmentId,
        amount: 1000000,
        paymentMethodId,
        bankAccountId: bankId,
        paymentDate: "2026-09-08",
        referenceNumber: `REF-P8-${stamp}`,
        notes: "First installment partial payment",
      },
    });
    assert("Create valid payment returns 201", create.status === 201);
    paymentId = create.json?.data?.payment?.id;
    paymentCode = create.json?.data?.payment?.paymentCode;
    assert("Created payment has code", Boolean(paymentCode));
    assert(
      "Remaining balance reduced correctly",
      create.json?.data?.payment?.remainingBalanceAfter === 17000000
    );
    assert(
      "Installment updated to partial",
      create.json?.data?.payment?.installment?.status === "partial"
    );
    assert(
      "Installment amount_paid updated",
      create.json?.data?.payment?.installment?.amountPaid === 1000000
    );

    // Confirm remaining in DB
    const rem = await pool.query(`SELECT remaining_balance FROM bookings WHERE id = $1`, [bookingId]);
    assert("DB remaining balance matches", Number(rem.rows[0].remaining_balance) === 17000000);

    // 3) Invalid booking
    const badBooking = await request(port, {
      method: "POST",
      path: "/api/payments",
      token,
      body: { bookingId: 99999999, amount: 100, paymentMethodId },
    });
    assert("Invalid booking rejected", badBooking.status === 400);

    // 4) Wrong installment / booking relationship
    const orphanInst = await pool.query(
      `INSERT INTO booking_installments (booking_id, installment_number, due_date, amount_due)
       VALUES ($1, 99, '2030-12-31', 1000)
       RETURNING id`,
      [cancelledBookingId]
    );
    const badRel = await request(port, {
      method: "POST",
      path: "/api/payments",
      token,
      body: {
        bookingId,
        installmentId: orphanInst.rows[0].id,
        amount: 100,
        paymentMethodId,
      },
    });
    assert("Invalid installment/booking relationship rejected", badRel.status === 400);

    // 5–7) Amount validations
    const zero = await request(port, {
      method: "POST",
      path: "/api/payments",
      token,
      body: { bookingId, amount: 0, paymentMethodId },
    });
    assert("Zero amount rejected", zero.status === 400);

    const neg = await request(port, {
      method: "POST",
      path: "/api/payments",
      token,
      body: { bookingId, amount: -50, paymentMethodId },
    });
    assert("Negative amount rejected", neg.status === 400);

    // 8) Invalid / inactive payment method
    const badPm = await request(port, {
      method: "POST",
      path: "/api/payments",
      token,
      body: { bookingId, amount: 100, paymentMethodId: 999999 },
    });
    assert("Invalid payment method rejected", badPm.status === 400);

    const inactive = await request(port, {
      method: "POST",
      path: "/api/payments",
      token,
      body: { bookingId, amount: 100, paymentMethodId: inactivePmId },
    });
    assert("Inactive payment method rejected", inactive.status === 400);

    // 9) Payment against cancelled booking
    const onCancelled = await request(port, {
      method: "POST",
      path: "/api/payments",
      token,
      body: { bookingId: cancelledBookingId, amount: 100, paymentMethodId },
    });
    assert("Payment against cancelled booking rejected", onCancelled.status === 400);

    // 10) Overpayment rejected
    const overpay = await request(port, {
      method: "POST",
      path: "/api/payments",
      token,
      body: { bookingId, amount: 999999999, paymentMethodId },
    });
    assert("Overpayment rejected", overpay.status === 400);

    // Installment overpay
    const instOver = await request(port, {
      method: "POST",
      path: "/api/payments",
      token,
      body: {
        bookingId,
        installmentId,
        amount: 900000, // remaining on installment is 800000
        paymentMethodId,
      },
    });
    assert("Installment overpayment rejected", instOver.status === 400);

    // Finish installment with exact remaining
    const finishInst = await request(port, {
      method: "POST",
      path: "/api/payments",
      token,
      body: {
        bookingId,
        installmentId,
        amount: 800000,
        paymentMethodId,
        referenceNumber: `REF-P8-FINISH-${stamp}`,
      },
    });
    assert("Exact installment remainder accepted", finishInst.status === 201);
    assert(
      "Installment marked paid",
      finishInst.json?.data?.payment?.installment?.status === "paid"
    );

    // 11) List / search / filter
    const list = await request(port, { path: "/api/payments", token });
    assert("List payments returns 200", list.status === 200);
    assert("List returns items", Array.isArray(list.json?.data?.items));

    const search = await request(port, {
      path: `/api/payments?search=${encodeURIComponent(paymentCode)}`,
      token,
    });
    assert("Search payments returns 200", search.status === 200);
    assert(
      "Search finds payment",
      (search.json?.data?.items || []).some((p) => p.id === paymentId)
    );

    const filter = await request(port, {
      path: `/api/payments?bookingId=${bookingId}&clientId=${clientId}&propertyId=${propA.propertyId}&paymentMethodId=${paymentMethodId}&paymentFrom=2026-01-01&paymentTo=2026-12-31`,
      token,
    });
    assert("Filter payments returns 200", filter.status === 200);
    assert(
      "Filter includes created payment",
      (filter.json?.data?.items || []).some((p) => p.id === paymentId)
    );

    // 12) Get by ID
    const byId = await request(port, { path: `/api/payments/${paymentId}`, token });
    assert("Get payment by id returns 200", byId.status === 200);
    assert("Get by id includes booking info", Boolean(byId.json?.data?.payment?.booking));
    assert(
      "Get by id matches reference",
      byId.json?.data?.payment?.referenceNumber === `REF-P8-${stamp}`
    );

    // 13) Valid update (metadata)
    const updateMeta = await request(port, {
      method: "PUT",
      path: `/api/payments/${paymentId}`,
      token,
      body: { notes: "Updated note", referenceNumber: `REF-P8-UPD-${stamp}` },
    });
    assert("Valid metadata update returns 200", updateMeta.status === 200);
    assert(
      "Notes updated",
      updateMeta.json?.data?.payment?.notes === "Updated note"
    );

    // Amount update within remaining
    const updateAmt = await request(port, {
      method: "PUT",
      path: `/api/payments/${paymentId}`,
      token,
      body: { amount: 900000 },
    });
    assert("Valid amount decrease update returns 200", updateAmt.status === 200);

    const remAfterUpdate = await pool.query(
      `SELECT remaining_balance FROM bookings WHERE id = $1`,
      [bookingId]
    );
    // payments: 900000 + 800000 = 1700000; remaining = 20000000 - 2000000 - 1700000 = 16300000
    assert(
      "Remaining recalculated after amount update",
      Number(remAfterUpdate.rows[0].remaining_balance) === 16300000
    );

    // 14) Invalid update — reassign booking
    const badUpdate = await request(port, {
      method: "PUT",
      path: `/api/payments/${paymentId}`,
      token,
      body: { bookingId: cancelledBookingId },
    });
    assert("Invalid update (reassign booking) rejected", badUpdate.status === 400);

    const badAmtUpdate = await request(port, {
      method: "PUT",
      path: `/api/payments/${paymentId}`,
      token,
      body: { amount: -10 },
    });
    assert("Invalid update (negative amount) rejected", badAmtUpdate.status === 400);

    // 15) No payment status column — soft-delete reverse instead
    const reverse = await request(port, {
      method: "DELETE",
      path: `/api/payments/${paymentId}`,
      token,
    });
    assert("Payment reverse (soft-delete) returns 200", reverse.status === 200);
    assert("Reversed payment has deletedAt", Boolean(reverse.json?.data?.payment?.deletedAt));

    const remAfterRev = await pool.query(
      `SELECT remaining_balance FROM bookings WHERE id = $1`,
      [bookingId]
    );
    // only 800000 payment left; remaining = 20000000 - 2000000 - 800000 = 17200000
    assert(
      "Remaining restored after reverse",
      Number(remAfterRev.rows[0].remaining_balance) === 17200000
    );

    const instAfterRev = await pool.query(
      `SELECT amount_paid, status FROM booking_installments WHERE id = $1`,
      [installmentId]
    );
    assert(
      "Installment amount restored after reverse",
      Number(instAfterRev.rows[0].amount_paid) === 800000
    );

    // Soft-deleted excluded from list
    const listAfter = await request(port, {
      path: `/api/payments?bookingId=${bookingId}`,
      token,
    });
    assert(
      "Reversed payment excluded from active list",
      !(listAfter.json?.data?.items || []).some((p) => p.id === paymentId)
    );

    // 16) Audit log
    const audits = await pool.query(
      `SELECT action FROM audit_logs
       WHERE entity_type = 'payment' AND entity_id = $1
       ORDER BY id`,
      [paymentId]
    );
    const actions = audits.rows.map((r) => r.action);
    assert(
      "Audit log has create/update/reverse",
      actions.includes("PAYMENT_CREATE") &&
        actions.includes("PAYMENT_UPDATE") &&
        actions.includes("PAYMENT_REVERSE")
    );

    // 17) Transaction rollback — force overpayment mid-path via second payment exceeding remaining
    const almost = await request(port, {
      method: "POST",
      path: "/api/payments",
      token,
      body: { bookingId, amount: 17200000, paymentMethodId },
    });
    assert("Payment consuming full remaining ok", almost.status === 201);
    const remZero = await pool.query(`SELECT remaining_balance FROM bookings WHERE id = $1`, [
      bookingId,
    ]);
    assert("Remaining is zero after full pay-down", Number(remZero.rows[0].remaining_balance) === 0);

    const beyond = await request(port, {
      method: "POST",
      path: "/api/payments",
      token,
      body: { bookingId, amount: 1, paymentMethodId },
    });
    assert("Further payment rolled back / rejected", beyond.status === 400);

    // 18) Regression Booking + Client
    const bookings = await request(port, { path: `/api/bookings/${bookingId}`, token });
    assert("Regression: get booking ok", bookings.status === 200);
    const clients = await request(port, { path: "/api/clients", token });
    assert("Regression: clients list ok", clients.status === 200);
    const bookingList = await request(port, { path: "/api/bookings", token });
    assert("Regression: bookings list ok", bookingList.status === 200);
  } catch (err) {
    console.error("UNEXPECTED ERROR:", err);
    failed += 1;
  } finally {
    await new Promise((r) => server.close(r));
    try {
      await pool.query(
        `DELETE FROM payments WHERE created_by = $1 OR booking_id IN (
           SELECT id FROM bookings WHERE client_id = $2
         )`,
        [adminId, clientId]
      );
      await pool.query(`DELETE FROM booking_installments WHERE booking_id IN (
           SELECT id FROM bookings WHERE client_id = $1
         )`, [clientId]);
      await pool.query(`DELETE FROM bookings WHERE client_id = $1`, [clientId]);
      await pool.query(`DELETE FROM clients WHERE id = $1`, [clientId]);
      await pool.query(
        `UPDATE properties SET status = 'draft' WHERE title LIKE $1`,
        [`Phase8 Property %${stamp}%`]
      );
      await pool.query(
        `DELETE FROM property_owners WHERE property_id IN (
           SELECT id FROM properties WHERE title LIKE $1
         )`,
        [`Phase8 Property %${stamp}%`]
      );
      await pool.query(
        `DELETE FROM property_bank_accounts WHERE property_id IN (
           SELECT id FROM properties WHERE title LIKE $1
         )`,
        [`Phase8 Property %${stamp}%`]
      );
      await pool.query(
        `DELETE FROM property_history WHERE property_id IN (
           SELECT id FROM properties WHERE title LIKE $1
         )`,
        [`Phase8 Property %${stamp}%`]
      );
      await pool.query(`DELETE FROM properties WHERE title LIKE $1`, [
        `Phase8 Property %${stamp}%`,
      ]);
      await pool.query(`DELETE FROM owners WHERE owner_name LIKE $1`, [
        `P8 Owner % ${stamp}`,
      ]);
      await pool.query(`DELETE FROM bank_accounts WHERE account_number LIKE $1`, [
        `P8ACC${stamp}%`,
      ]);
      await pool.query(`DELETE FROM payment_methods WHERE method_name = $1`, [
        `P8 Inactive ${stamp}`,
      ]);
      await pool.query(`DELETE FROM audit_logs WHERE admin_id = $1`, [adminId]);
      await pool.query(`DELETE FROM admins WHERE id = $1`, [adminId]);
    } catch (cleanupErr) {
      console.warn("Cleanup warning:", cleanupErr.message);
    }
    await pool.end();
  }

  console.log(`\nPhase 8 payment tests: ${passed} passed, ${failed} failed`);
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
