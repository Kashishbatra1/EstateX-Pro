/**
 * Phase 10 — Reports & Dashboard tests against live estatex_pro.
 * Usage: npm run test:reports
 */
const http = require("http");
const pool = require("../config/db");
const app = require("../app");
const { hashPassword } = require("../utils/password");

const stamp = Date.now();
const TEST_EMAIL = `reports.phase10.${stamp}@estatex.test`;
const TEST_PASSWORD = `Rep!${String(stamp).slice(-6)}`;

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
        const chunks = [];
        res.on("data", (c) => {
          chunks.push(c);
        });
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          const data = buf.toString("utf8");
          let json = null;
          try {
            json = JSON.parse(data);
          } catch {
            json = null;
          }
          resolve({
            status: res.statusCode,
            body: data,
            json,
            headers: res.headers,
            buffer: buf,
          });
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

  const owner = await pool.query(
    `INSERT INTO owners (owner_name, cnic, verification_status, verified_at, verified_by)
     VALUES ($1,$2,'verified',CURRENT_TIMESTAMP,$3) RETURNING id`,
    [`P10 Owner ${label} ${stamp}`, `35202-${cnicSuffix}-0`, adminId]
  );
  const bank = await pool.query(
    `INSERT INTO bank_accounts (bank_name, account_holder_name, account_number, is_active)
     VALUES ($1,$2,$3,TRUE) RETURNING id`,
    [`P10 Bank ${label}`, "Report Test", `P10ACC${stamp}${label}`]
  );
  const prop = await pool.query(
    `INSERT INTO properties (
       title, property_type, purpose, category, city, area,
       asking_price, primary_payment_method_id, status
     ) VALUES ($1,'House','sale','residential','Lahore','DHA',15000000,$2,'draft')
     RETURNING id`,
    [`Phase10 Property ${label} ${stamp}`, paymentMethodId]
  );
  await pool.query(
    `INSERT INTO property_owners (property_id, owner_id, share_percentage, is_primary)
     VALUES ($1,$2,100,TRUE)`,
    [prop.rows[0].id, owner.rows[0].id]
  );
  await pool.query(
    `INSERT INTO property_bank_accounts (property_id, bank_account_id, is_primary)
     VALUES ($1,$2,TRUE)`,
    [prop.rows[0].id, bank.rows[0].id]
  );
  await pool.query(`UPDATE properties SET status='available' WHERE id=$1`, [prop.rows[0].id]);
  return { propertyId: prop.rows[0].id, paymentMethodId, bankId: bank.rows[0].id };
}

async function run() {
  let passed = 0;
  let failed = 0;
  let adminId = null;
  let token = null;
  let clientId = null;
  let employeeId = null;
  let categoryId = null;
  let bookingId = null;
  let paymentId = null;
  let expenseId = null;
  let propertyA = null;
  let propertyB = null;

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
    ["Phase 10 Report Tester", TEST_EMAIL, passwordHash]
  );
  adminId = adminIns.rows[0].id;

  const emp = await pool.query(
    `INSERT INTO employees (full_name, email, designation, is_active, admin_id)
     VALUES ($1,$2,'Agent',TRUE,$3) RETURNING id`,
    [`P10 Emp ${stamp}`, `p10.emp.${stamp}@estatex.test`, adminId]
  );
  employeeId = emp.rows[0].id;

  const clientIns = await pool.query(
    `INSERT INTO clients (client_name, cnic, phone, client_type, next_follow_up_date)
     VALUES ($1,$2,$3,'buyer',$4) RETURNING id`,
    [`Phase10 Client ${stamp}`, `35202-${String(stamp).slice(-7)}-0`, "03007778899", "2030-06-01"]
  );
  clientId = clientIns.rows[0].id;

  const cat = await pool.query(
    `SELECT id FROM expense_categories WHERE is_active = TRUE ORDER BY id LIMIT 1`
  );
  categoryId = cat.rows[0].id;

  propertyA = await prepareAvailableProperty(adminId, "A");
  propertyB = await prepareAvailableProperty(adminId, "B");

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

    // Unauthorized
    const unauthDash = await request(port, { path: "/api/dashboard" });
    assert("Unauthorized dashboard returns 401", unauthDash.status === 401);
    const unauthRep = await request(port, { path: "/api/reports/bookings" });
    assert("Unauthorized reports returns 401", unauthRep.status === 401);

    // Seed workflow data via APIs
    const booking = await request(port, {
      method: "POST",
      path: "/api/bookings",
      token,
      body: {
        propertyId: propertyA.propertyId,
        clientId,
        bookingAmount: 1000000,
        totalPrice: 10000000,
      },
    });
    bookingId = booking.json?.data?.booking?.id;
    assert("Setup booking", booking.status === 201);

    const payment = await request(port, {
      method: "POST",
      path: "/api/payments",
      token,
      body: {
        bookingId,
        amount: 500000,
        paymentMethodId: propertyA.paymentMethodId,
        paymentDate: "2026-09-08",
      },
    });
    paymentId = payment.json?.data?.payment?.id;
    assert("Setup payment", payment.status === 201);
    assert(
      "Remaining after payment is 8.5M",
      payment.json?.data?.payment?.remainingBalanceAfter === 8500000
    );

    const expense = await request(port, {
      method: "POST",
      path: "/api/expenses",
      token,
      body: {
        categoryId,
        amount: 1200,
        paidByEmployeeId: employeeId,
        paymentMethodId: propertyA.paymentMethodId,
        propertyId: propertyA.propertyId,
        description: `P10 expense ${stamp}`,
        expenseDate: "2026-09-08",
      },
    });
    expenseId = expense.json?.data?.expense?.id;
    assert("Setup expense", expense.status === 201);

    // Soft-deleted payment should be excluded from totals
    const softPay = await request(port, {
      method: "POST",
      path: "/api/payments",
      token,
      body: {
        bookingId,
        amount: 100000,
        paymentMethodId: propertyA.paymentMethodId,
        paymentDate: "2026-09-08",
      },
    });
    const softPayId = softPay.json?.data?.payment?.id;
    await request(port, {
      method: "DELETE",
      path: `/api/payments/${softPayId}`,
      token,
    });

    // Soft-deleted expense excluded
    const softExp = await request(port, {
      method: "POST",
      path: "/api/expenses",
      token,
      body: {
        categoryId,
        amount: 9999,
        paidByEmployeeId: employeeId,
        description: `P10 soft expense ${stamp}`,
      },
    });
    const softExpId = softExp.json?.data?.expense?.id;
    await request(port, {
      method: "DELETE",
      path: `/api/expenses/${softExpId}`,
      token,
    });

    // Cancelled booking on property B
    const cancelBk = await request(port, {
      method: "POST",
      path: "/api/bookings",
      token,
      body: {
        propertyId: propertyB.propertyId,
        clientId,
        bookingAmount: 200000,
        totalPrice: 2000000,
      },
    });
    const cancelId = cancelBk.json?.data?.booking?.id;
    await request(port, {
      method: "POST",
      path: `/api/bookings/${cancelId}/cancel`,
      token,
      body: { cancellationReason: "Report test cancel" },
    });

    // Dashboard
    const dash = await request(port, { path: "/api/dashboard", token });
    assert("Dashboard returns 200", dash.status === 200);
    const d = dash.json?.data?.dashboard;
    assert("Dashboard has property stats", d?.properties?.total >= 1);
    assert("Dashboard available count present", typeof d?.properties?.available === "number");
    assert("Dashboard client stats", d?.clients?.total >= 1);
    assert("Dashboard booking stats", d?.bookings?.total >= 1);
    assert("Dashboard pending/confirmed/cancelled fields", typeof d?.bookings?.cancelled === "number");
    assert(
      "Dashboard payments exclude soft-deleted (at least includes 500000)",
      d?.financials?.totalPaymentsReceived >= 500000
    );
    assert(
      "Dashboard expenses exclude soft-deleted 9999",
      d?.financials?.totalExpenses >= 1200
    );
    // Double-counting: down payment listed separately, not inside payments
    assert(
      "Dashboard exposes down payments separately",
      typeof d?.financials?.totalDownPayments === "number"
    );
    assert(
      "Dashboard remaining receivables present",
      typeof d?.financials?.remainingReceivables === "number"
    );

    // Verify financial formula for our booking against dashboard/report
    const bal = await pool.query(
      `SELECT total_price, booking_amount, remaining_balance FROM bookings WHERE id=$1`,
      [bookingId]
    );
    const paid = await pool.query(
      `SELECT COALESCE(SUM(amount),0)::NUMERIC AS s FROM payments
       WHERE booking_id=$1 AND deleted_at IS NULL`,
      [bookingId]
    );
    const expectedRem =
      Number(bal.rows[0].total_price) -
      Number(bal.rows[0].booking_amount) -
      Number(paid.rows[0].s);
    assert(
      "Financial integrity remaining matches formula",
      Number(bal.rows[0].remaining_balance) === expectedRem && expectedRem === 8500000
    );
    assert(
      "Active payments sum is 500000 (soft-deleted excluded)",
      Number(paid.rows[0].s) === 500000
    );

    // Booking report
    const bookRep = await request(port, {
      path: `/api/reports/bookings?status=pending&propertyId=${propertyA.propertyId}&clientId=${clientId}&dateFrom=2020-01-01&dateTo=2035-12-31`,
      token,
    });
    assert("Booking report returns 200", bookRep.status === 200);
    assert(
      "Booking report includes setup booking",
      (bookRep.json?.data?.items || []).some((b) => b.id === bookingId)
    );
    assert(
      "Booking report summary has totals",
      typeof bookRep.json?.data?.summary?.totalBookingValue === "number"
    );

    const cancelRep = await request(port, {
      path: `/api/reports/bookings?status=cancelled&propertyId=${propertyB.propertyId}`,
      token,
    });
    assert("Cancelled booking report works", cancelRep.status === 200);
    assert(
      "Cancelled booking appears in cancelled filter",
      (cancelRep.json?.data?.items || []).some((b) => b.id === cancelId)
    );

    // Payment report
    const payRep = await request(port, {
      path: `/api/reports/payments?bookingId=${bookingId}&propertyId=${propertyA.propertyId}&paymentMethodId=${propertyA.paymentMethodId}&dateFrom=2026-01-01&dateTo=2026-12-31`,
      token,
    });
    assert("Payment report returns 200", payRep.status === 200);
    assert(
      "Payment report includes active payment",
      (payRep.json?.data?.items || []).some((p) => p.id === paymentId)
    );
    assert(
      "Payment report excludes soft-deleted",
      !(payRep.json?.data?.items || []).some((p) => p.id === softPayId)
    );
    assert(
      "Payment report total equals active payments",
      payRep.json?.data?.summary?.totalAmount === 500000
    );

    // Expense report
    const expRep = await request(port, {
      path: `/api/reports/expenses?categoryId=${categoryId}&propertyId=${propertyA.propertyId}&dateFrom=2026-01-01&dateTo=2026-12-31`,
      token,
    });
    assert("Expense report returns 200", expRep.status === 200);
    assert(
      "Expense report includes active expense",
      (expRep.json?.data?.items || []).some((e) => e.id === expenseId)
    );
    assert(
      "Expense report excludes soft-deleted",
      !(expRep.json?.data?.items || []).some((e) => e.id === softExpId)
    );

    // Property report
    const propRep = await request(port, {
      path: `/api/reports/properties?status=available&propertyType=House&dateFrom=2020-01-01&dateTo=2035-12-31`,
      token,
    });
    assert("Property report returns 200", propRep.status === 200);
    assert(
      "Property report includes test property",
      (propRep.json?.data?.items || []).some(
        (p) => Number(p.id) === Number(propertyA.propertyId)
      )
    );

    // Invalid filters
    const badDate = await request(port, {
      path: "/api/reports/bookings?dateFrom=not-a-date",
      token,
    });
    assert("Invalid date filter rejected", badDate.status === 400);

    const badId = await request(port, {
      path: "/api/reports/payments?bookingId=abc",
      token,
    });
    assert("Invalid ID filter rejected", badId.status === 400);

    const badRange = await request(port, {
      path: "/api/reports/expenses?dateFrom=2030-01-01&dateTo=2020-01-01",
      token,
    });
    assert("Inverted date range rejected", badRange.status === 400);

    // Phase 33 — CSV / PDF exports
    const badFormat = await request(port, {
      path: "/api/reports/bookings?format=docx",
      token,
    });
    assert("Invalid export format rejected", badFormat.status === 400);

    const csvBookings = await request(port, {
      path: `/api/reports/bookings?format=csv&propertyId=${propertyA.propertyId}&dateFrom=2020-01-01&dateTo=2035-12-31`,
      token,
    });
    assert("Booking CSV export returns 200", csvBookings.status === 200);
    assert(
      "Booking CSV has text/csv content type",
      String(csvBookings.headers["content-type"] || "").includes("text/csv")
    );
    assert(
      "Booking CSV has attachment disposition",
      String(csvBookings.headers["content-disposition"] || "").includes(
        "attachment"
      )
    );
    assert(
      "Booking CSV body includes header and booking code",
      csvBookings.body.includes("Code") &&
        (csvBookings.body.includes("Total Price") ||
          csvBookings.body.includes("Status"))
    );

    const excelAlias = await request(port, {
      path: `/api/reports/payments?format=excel&bookingId=${bookingId}`,
      token,
    });
    assert("format=excel aliases to CSV", excelAlias.status === 200);
    assert(
      "Excel alias content type is CSV",
      String(excelAlias.headers["content-type"] || "").includes("text/csv")
    );
    assert(
      "Payment CSV includes amount",
      excelAlias.body.includes("500000") || excelAlias.body.includes("Amount")
    );

    const pdfExpenses = await request(port, {
      path: `/api/reports/expenses?format=pdf&propertyId=${propertyA.propertyId}&dateFrom=2026-01-01&dateTo=2026-12-31`,
      token,
    });
    assert("Expense PDF export returns 200", pdfExpenses.status === 200);
    assert(
      "Expense PDF content type",
      String(pdfExpenses.headers["content-type"] || "").includes(
        "application/pdf"
      )
    );
    assert(
      "Expense PDF starts with %PDF",
      pdfExpenses.body.startsWith("%PDF")
    );

    const pdfProps = await request(port, {
      path: "/api/reports/properties?format=pdf&status=available",
      token,
    });
    assert("Property PDF export returns 200", pdfProps.status === 200);
    assert(
      "Property PDF disposition present",
      String(pdfProps.headers["content-disposition"] || "").includes(".pdf")
    );

    const unauthExport = await request(port, {
      path: "/api/reports/bookings?format=csv",
    });
    assert("Unauthorized export returns 401", unauthExport.status === 401);

    // Regression
    const clients = await request(port, { path: "/api/clients", token });
    assert("Regression: clients ok", clients.status === 200);
    const bookings = await request(port, { path: "/api/bookings", token });
    assert("Regression: bookings ok", bookings.status === 200);
    const payments = await request(port, { path: "/api/payments", token });
    assert("Regression: payments ok", payments.status === 200);
    const expenses = await request(port, { path: "/api/expenses", token });
    assert("Regression: expenses ok", expenses.status === 200);
  } catch (err) {
    console.error("UNEXPECTED ERROR:", err);
    failed += 1;
  } finally {
    await new Promise((r) => server.close(r));
    try {
      await pool.query(
        `DELETE FROM payments WHERE created_by=$1 OR booking_id IN (
           SELECT id FROM bookings WHERE client_id=$2
         )`,
        [adminId, clientId]
      );
      await pool.query(`DELETE FROM booking_installments WHERE booking_id IN (
           SELECT id FROM bookings WHERE client_id=$1
         )`, [clientId]);
      await pool.query(`DELETE FROM bookings WHERE client_id=$1 OR created_by=$2`, [
        clientId,
        adminId,
      ]);
      await pool.query(`DELETE FROM expenses WHERE created_by=$1`, [adminId]);
      await pool.query(`DELETE FROM clients WHERE id=$1`, [clientId]);
      await pool.query(`UPDATE properties SET status='draft' WHERE title LIKE $1`, [
        `Phase10 Property %${stamp}%`,
      ]);
      await pool.query(
        `DELETE FROM property_owners WHERE property_id IN (SELECT id FROM properties WHERE title LIKE $1)`,
        [`Phase10 Property %${stamp}%`]
      );
      await pool.query(
        `DELETE FROM property_bank_accounts WHERE property_id IN (SELECT id FROM properties WHERE title LIKE $1)`,
        [`Phase10 Property %${stamp}%`]
      );
      await pool.query(
        `DELETE FROM property_history WHERE property_id IN (SELECT id FROM properties WHERE title LIKE $1)`,
        [`Phase10 Property %${stamp}%`]
      );
      await pool.query(`DELETE FROM properties WHERE title LIKE $1`, [
        `Phase10 Property %${stamp}%`,
      ]);
      await pool.query(`DELETE FROM owners WHERE owner_name LIKE $1`, [
        `P10 Owner % ${stamp}`,
      ]);
      await pool.query(`DELETE FROM bank_accounts WHERE account_number LIKE $1`, [
        `P10ACC${stamp}%`,
      ]);
      await pool.query(`DELETE FROM audit_logs WHERE admin_id=$1`, [adminId]);
      await pool.query(`DELETE FROM employees WHERE id=$1`, [employeeId]);
      await pool.query(`DELETE FROM admins WHERE id=$1`, [adminId]);
    } catch (cleanupErr) {
      console.warn("Cleanup warning:", cleanupErr.message);
    }
    await pool.end();
  }

  console.log(`\nPhase 10/33 report tests: ${passed} passed, ${failed} failed`);
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
