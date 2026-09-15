/**
 * Phase 11 — Notifications & Reminders tests against live estatex_pro.
 * Usage: npm run test:notifications
 */
const http = require("http");
const pool = require("../config/db");
const app = require("../app");
const { hashPassword } = require("../utils/password");

const stamp = Date.now();
const TEST_EMAIL = `notifications.phase11.${stamp}@estatex.test`;
const TEST_PASSWORD = `Ntf!${String(stamp).slice(-6)}`;

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
  const owner = await pool.query(
    `INSERT INTO owners (owner_name, cnic, verification_status, verified_at, verified_by)
     VALUES ($1,$2,'verified',CURRENT_TIMESTAMP,$3) RETURNING id`,
    [`P11 Owner ${label} ${stamp}`, `35202-${cnicSuffix}-1`, adminId]
  );
  const bank = await pool.query(
    `INSERT INTO bank_accounts (bank_name, account_holder_name, account_number, is_active)
     VALUES ($1,$2,$3,TRUE) RETURNING id`,
    [`P11 Bank ${label}`, "Notify Test", `P11ACC${stamp}${label}`]
  );
  const prop = await pool.query(
    `INSERT INTO properties (
       title, property_type, purpose, category, city, area,
       asking_price, primary_payment_method_id, status
     ) VALUES ($1,'House','sale','residential','Lahore','DHA',12000000,$2,'draft')
     RETURNING id`,
    [`Phase11 Property ${label} ${stamp}`, paymentMethodId]
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
  return { propertyId: prop.rows[0].id, paymentMethodId };
}

async function run() {
  let passed = 0;
  let failed = 0;
  let adminId = null;
  let token = null;
  let clientId = null;
  let notificationId = null;
  let bookingId = null;
  let property = null;

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
    ["Phase 11 Notify Tester", TEST_EMAIL, passwordHash]
  );
  adminId = adminIns.rows[0].id;

  const clientIns = await pool.query(
    `INSERT INTO clients (client_name, cnic, phone, client_type)
     VALUES ($1,$2,$3,'buyer') RETURNING id`,
    [`Phase11 Client ${stamp}`, `35202-${String(stamp).slice(-7)}-1`, "03006667788"]
  );
  clientId = clientIns.rows[0].id;
  property = await prepareAvailableProperty(adminId, "A");

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
    const unauth = await request(port, { path: "/api/notifications" });
    assert("Unauthorized access returns 401", unauth.status === 401);

    // Create
    const create = await request(port, {
      method: "POST",
      path: "/api/notifications",
      token,
      body: {
        notificationType: "general",
        title: `Manual note ${stamp}`,
        message: "Phase 11 manual notification",
        entityType: "system",
        entityId: 1,
      },
    });
    assert("Create notification returns 201", create.status === 201);
    notificationId = create.json?.data?.notification?.id;
    assert("Created notification has id", Boolean(notificationId));
    assert("Created starts unread", create.json?.data?.notification?.isRead === false);

    // Invalid create
    const bad = await request(port, {
      method: "POST",
      path: "/api/notifications",
      token,
      body: { title: "", message: "" },
    });
    assert("Invalid create rejected", bad.status === 400);

    const badType = await request(port, {
      method: "POST",
      path: "/api/notifications",
      token,
      body: {
        notificationType: "not_a_real_type",
        title: "x",
        message: "y",
      },
    });
    assert("Invalid notification type rejected", badType.status === 400);

    // List / get
    const list = await request(port, { path: "/api/notifications", token });
    assert("List notifications returns 200", list.status === 200);
    assert(
      "List includes created notification",
      (list.json?.data?.items || []).some((n) => n.id === notificationId)
    );

    const byId = await request(port, {
      path: `/api/notifications/${notificationId}`,
      token,
    });
    assert("Get by id returns 200", byId.status === 200);

    const badId = await request(port, { path: "/api/notifications/abc", token });
    assert("Invalid id rejected", badId.status === 400);

    // Read / unread
    const markRead = await request(port, {
      method: "PATCH",
      path: `/api/notifications/${notificationId}/read`,
      token,
    });
    assert("Mark read returns 200", markRead.status === 200);
    assert("Is read true", markRead.json?.data?.notification?.isRead === true);

    const markUnread = await request(port, {
      method: "PATCH",
      path: `/api/notifications/${notificationId}/unread`,
      token,
    });
    assert("Mark unread returns 200", markUnread.status === 200);
    assert("Is read false again", markUnread.json?.data?.notification?.isRead === false);

    // Automatic booking notification
    const booking = await request(port, {
      method: "POST",
      path: "/api/bookings",
      token,
      body: {
        propertyId: property.propertyId,
        clientId,
        bookingAmount: 500000,
        totalPrice: 5000000,
        bookingExpiryDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
        installments: [
          {
            dueDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
            amountDue: 1000000,
          },
          {
            dueDate: new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10),
            amountDue: 1000000,
          },
        ],
      },
    });
    assert("Booking create for auto-notify", booking.status === 201);
    bookingId = booking.json?.data?.booking?.id;

    const afterCreate = await request(port, {
      path: "/api/notifications?entityType=booking",
      token,
    });
    assert(
      "Automatic booking created notification exists",
      (afterCreate.json?.data?.items || []).some(
        (n) => n.entityId === bookingId && n.title === "Booking created"
      )
    );

    await request(port, {
      method: "PATCH",
      path: `/api/bookings/${bookingId}/status`,
      token,
      body: { status: "confirmed" },
    });
    const afterConfirm = await request(port, {
      path: "/api/notifications?entityType=booking",
      token,
    });
    assert(
      "Automatic booking confirmed notification exists",
      (afterConfirm.json?.data?.items || []).some(
        (n) => n.entityId === bookingId && n.title === "Booking confirmed"
      )
    );

    // Reminder processing: expiry + due + overdue
    const process1 = await request(port, {
      method: "POST",
      path: "/api/notifications/reminders/process?daysAhead=7",
      token,
    });
    assert("Process reminders returns 200", process1.status === 200);
    assert(
      "Reminders created at least one",
      process1.json?.data?.createdCount >= 1
    );

    const expiryNotes = await request(port, {
      path: "/api/notifications?notificationType=booking_expiry",
      token,
    });
    assert(
      "Booking expiry reminder present",
      (expiryNotes.json?.data?.items || []).some(
        (n) => n.entityType === "booking" && n.entityId === bookingId
      )
    );

    const dueNotes = await request(port, {
      path: "/api/notifications?notificationType=rent_due",
      token,
    });
    const rentItems = dueNotes.json?.data?.items || [];
    assert(
      "Installment due/overdue reminder present",
      rentItems.some((n) => n.entityType === "booking_installment")
    );

    // Duplicate prevention
    const process2 = await request(port, {
      method: "POST",
      path: "/api/notifications/reminders/process?daysAhead=7",
      token,
    });
    assert("Second reminder process returns 200", process2.status === 200);
    assert(
      "Duplicate reminders prevented",
      process2.json?.data?.createdCount === 0
    );

    // Overdue status applied
    const overdueCheck = await pool.query(
      `SELECT status FROM booking_installments
       WHERE booking_id = $1 AND due_date < CURRENT_DATE
       ORDER BY installment_number LIMIT 1`,
      [bookingId]
    );
    assert(
      "Overdue installment status updated",
      overdueCheck.rows[0]?.status === "overdue"
    );

    // Delete
    const del = await request(port, {
      method: "DELETE",
      path: `/api/notifications/${notificationId}`,
      token,
    });
    assert("Delete notification returns 200", del.status === 200);
    const gone = await request(port, {
      path: `/api/notifications/${notificationId}`,
      token,
    });
    assert("Deleted notification not found", gone.status === 404);

    // Cancel booking auto-notify
    await request(port, {
      method: "POST",
      path: `/api/bookings/${bookingId}/cancel`,
      token,
      body: { cancellationReason: "Phase 11 cancel test" },
    });
    const afterCancel = await request(port, {
      path: "/api/notifications?entityType=booking",
      token,
    });
    assert(
      "Automatic booking cancelled notification exists",
      (afterCancel.json?.data?.items || []).some(
        (n) => n.entityId === bookingId && n.title === "Booking cancelled"
      )
    );

    // Regression
    const bookings = await request(port, { path: "/api/bookings", token });
    assert("Regression: bookings ok", bookings.status === 200);
    const payments = await request(port, { path: "/api/payments", token });
    assert("Regression: payments ok", payments.status === 200);
    const expenses = await request(port, { path: "/api/expenses", token });
    assert("Regression: expenses ok", expenses.status === 200);
    const reports = await request(port, { path: "/api/dashboard", token });
    assert("Regression: dashboard ok", reports.status === 200);
  } catch (err) {
    console.error("UNEXPECTED ERROR:", err);
    failed += 1;
  } finally {
    await new Promise((r) => server.close(r));
    try {
      await pool.query(
        `DELETE FROM notifications WHERE admin_id = $1 OR entity_id IN (
           SELECT id FROM bookings WHERE client_id = $2
         ) OR title LIKE $3`,
        [adminId, clientId, `%${stamp}%`]
      );
      await pool.query(
        `DELETE FROM booking_installments WHERE booking_id IN (
           SELECT id FROM bookings WHERE client_id = $1
         )`,
        [clientId]
      );
      await pool.query(`DELETE FROM bookings WHERE client_id = $1 OR created_by = $2`, [
        clientId,
        adminId,
      ]);
      await pool.query(`DELETE FROM clients WHERE id = $1`, [clientId]);
      await pool.query(`UPDATE properties SET status='draft' WHERE title LIKE $1`, [
        `Phase11 Property %${stamp}%`,
      ]);
      await pool.query(
        `DELETE FROM property_owners WHERE property_id IN (SELECT id FROM properties WHERE title LIKE $1)`,
        [`Phase11 Property %${stamp}%`]
      );
      await pool.query(
        `DELETE FROM property_bank_accounts WHERE property_id IN (SELECT id FROM properties WHERE title LIKE $1)`,
        [`Phase11 Property %${stamp}%`]
      );
      await pool.query(
        `DELETE FROM property_history WHERE property_id IN (SELECT id FROM properties WHERE title LIKE $1)`,
        [`Phase11 Property %${stamp}%`]
      );
      await pool.query(`DELETE FROM properties WHERE title LIKE $1`, [
        `Phase11 Property %${stamp}%`,
      ]);
      await pool.query(`DELETE FROM owners WHERE owner_name LIKE $1`, [
        `P11 Owner % ${stamp}`,
      ]);
      await pool.query(`DELETE FROM bank_accounts WHERE account_number LIKE $1`, [
        `P11ACC${stamp}%`,
      ]);
      await pool.query(`DELETE FROM audit_logs WHERE admin_id = $1`, [adminId]);
      await pool.query(`DELETE FROM admins WHERE id = $1`, [adminId]);
    } catch (cleanupErr) {
      console.warn("Cleanup warning:", cleanupErr.message);
    }
    await pool.end();
  }

  console.log(`\nPhase 11 notification tests: ${passed} passed, ${failed} failed`);
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
