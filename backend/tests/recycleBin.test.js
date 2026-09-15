/**
 * Phase — Recycle Bin (list via v_recycle_bin + restore)
 */
const http = require("http");
const pool = require("../config/db");
const app = require("../app");
const { hashPassword } = require("../utils/password");

const stamp = Date.now();
const TEST_EMAIL = `recycle.bin.${stamp}@estatex.test`;
const TEST_PASSWORD = `Rb!${String(stamp).slice(-6)}`;
const VENDOR_NAME = `RecycleBin Vendor ${stamp}`;

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
  let vendorId = null;
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
    ["Recycle Bin Tester", TEST_EMAIL, passwordHash]
  );
  adminId = adminIns.rows[0].id;

  const vendor = await pool.query(
    `INSERT INTO vendors (vendor_name, phone, deleted_at, deleted_by)
     VALUES ($1,$2,CURRENT_TIMESTAMP,$3) RETURNING id`,
    [VENDOR_NAME, `03${String(stamp).slice(-8)}`, adminId]
  );
  vendorId = vendor.rows[0].id;

  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  const { port } = server.address();

  try {
    const unauth = await request(port, { path: "/api/recycle-bin" });
    assert("Unauthorized returns 401", unauth.status === 401);

    const login = await request(port, {
      method: "POST",
      path: "/api/auth/login",
      body: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });
    token = login.json?.data?.token;
    assert("Auth setup", Boolean(token));

    const bin = await request(port, {
      path: `/api/recycle-bin?entityType=vendor&search=${encodeURIComponent(VENDOR_NAME)}`,
      token,
    });
    assert("Recycle list returns 200", bin.status === 200);
    assert("Pagination present", Boolean(bin.json?.data?.pagination));
    assert(
      "Deleted vendor in recycle bin",
      (bin.json?.data?.items || []).some(
        (i) =>
          i.entityType === "vendor" && Number(i.entityId) === Number(vendorId)
      )
    );

    const badType = await request(port, {
      method: "POST",
      path: "/api/recycle-bin/restore",
      token,
      body: { entityType: "not_a_real_type", entityId: vendorId },
    });
    assert("Unsupported entity type returns 400", badType.status === 400);

    const restore = await request(port, {
      method: "POST",
      path: "/api/recycle-bin/restore",
      token,
      body: { entityType: "vendor", entityId: vendorId },
    });
    assert("Restore returns 200", restore.status === 200);
    assert("Restore payload restored=true", restore.json?.data?.restored === true);

    const getVendor = await request(port, {
      path: `/api/vendors/${vendorId}`,
      token,
    });
    assert("Restored vendor visible again", getVendor.status === 200);

    const row = await pool.query(
      `SELECT deleted_at, deleted_by FROM vendors WHERE id = $1`,
      [vendorId]
    );
    assert("deleted_at cleared", row.rows[0]?.deleted_at == null);
    assert("deleted_by cleared", row.rows[0]?.deleted_by == null);

    const audit = await pool.query(
      `SELECT action FROM audit_logs
       WHERE admin_id = $1 AND action = 'RECYCLE_RESTORE'
         AND entity_type = 'vendor' AND entity_id = $2`,
      [adminId, vendorId]
    );
    assert("RECYCLE_RESTORE audit written", Boolean(audit.rows[0]));

    const again = await request(port, {
      method: "POST",
      path: "/api/recycle-bin/restore",
      token,
      body: { entityType: "vendor", entityId: vendorId },
    });
    assert("Already restored returns 404", again.status === 404);

    const empty = await request(port, {
      path: `/api/recycle-bin?entityType=vendor&search=${encodeURIComponent(VENDOR_NAME)}`,
      token,
    });
    assert(
      "Restored item no longer in bin",
      !(empty.json?.data?.items || []).some(
        (i) => Number(i.entityId) === Number(vendorId)
      )
    );

    // Soft-delete again, then permanent purge
    await pool.query(
      `UPDATE vendors SET deleted_at = CURRENT_TIMESTAMP, deleted_by = $1 WHERE id = $2`,
      [adminId, vendorId]
    );

    const badPurgeType = await request(port, {
      method: "POST",
      path: "/api/recycle-bin/purge",
      token,
      body: { entityType: "not_a_real_type", entityId: vendorId },
    });
    assert("Unsupported purge type returns 400", badPurgeType.status === 400);

    const purge = await request(port, {
      method: "POST",
      path: "/api/recycle-bin/purge",
      token,
      body: { entityType: "vendor", entityId: vendorId },
    });
    assert("Purge returns 200", purge.status === 200);
    assert("Purge payload purged=true", purge.json?.data?.purged === true);

    const gone = await pool.query(`SELECT id FROM vendors WHERE id = $1`, [vendorId]);
    assert("Vendor hard-deleted from DB", gone.rows.length === 0);
    vendorId = null;

    const purgeAudit = await pool.query(
      `SELECT action FROM audit_logs
       WHERE admin_id = $1 AND action = 'RECYCLE_PURGE'
         AND entity_type = 'vendor'`,
      [adminId]
    );
    assert("RECYCLE_PURGE audit written", Boolean(purgeAudit.rows[0]));

    const purgeAgain = await request(port, {
      method: "POST",
      path: "/api/recycle-bin/purge",
      token,
      body: { entityType: "vendor", entityId: 999999999 },
    });
    assert("Purge missing item returns 404", purgeAgain.status === 404);

    // Property permanent delete (RESTRICT FKs: bookings/payments/commissions/transfers)
    const propIns = await pool.query(
      `INSERT INTO properties (
         title, property_type, purpose, category, city, area, status, deleted_at, deleted_by, created_by
       ) VALUES ($1, 'House', 'sale', 'residential', 'Lahore', 'DHA', 'draft', CURRENT_TIMESTAMP, $2, $2)
       RETURNING id`,
      [`RecyclePurge Prop ${stamp}`, adminId]
    );
    const propId = propIns.rows[0].id;
    const clientIns = await pool.query(
      `INSERT INTO clients (client_name, client_type, phone)
       VALUES ($1, 'buyer', $2) RETURNING id`,
      [`RecyclePurge Client ${stamp}`, `03${String(stamp).slice(-8)}`]
    );
    const clientId = clientIns.rows[0].id;
    const bookIns = await pool.query(
      `INSERT INTO bookings (
         booking_code, property_id, client_id, status,
         booking_amount, total_price, remaining_balance, created_by
       ) VALUES ($1,$2,$3,'pending',1000,5000,4000,$4)
       RETURNING id`,
      [`RB-${stamp}`, propId, clientId, adminId]
    );
    const bookingId = bookIns.rows[0].id;
    await pool.query(
      `INSERT INTO payments (payment_code, booking_id, amount, payment_date, created_by)
       VALUES ($1,$2,500,CURRENT_DATE,$3)`,
      [`PAY-RB-${stamp}`, bookingId, adminId]
    );
    await pool.query(
      `INSERT INTO commissions (property_id, booking_id, final_amount, created_by)
       VALUES ($1,$2,250,$3)`,
      [propId, bookingId, adminId]
    );

    const propPurge = await request(port, {
      method: "POST",
      path: "/api/recycle-bin/purge",
      token,
      body: { entityType: "property", entityId: propId },
    });
    assert("Property purge returns 200", propPurge.status === 200);
    const propGone = await pool.query(`SELECT id FROM properties WHERE id = $1`, [propId]);
    assert("Property hard-deleted", propGone.rows.length === 0);
    const bookGone = await pool.query(`SELECT id FROM bookings WHERE id = $1`, [bookingId]);
    assert("Related booking removed with property purge", bookGone.rows.length === 0);

    await pool.query(`DELETE FROM clients WHERE id = $1`, [clientId]);
  } catch (err) {
    assert(`Unexpected: ${err.message}`, false);
  } finally {
    server.close();
    if (vendorId) {
      await pool.query(`DELETE FROM vendors WHERE id = $1`, [vendorId]);
    }
    if (adminId) {
      await pool.query(`DELETE FROM audit_logs WHERE admin_id = $1`, [adminId]);
      await pool.query(`DELETE FROM admins WHERE id = $1`, [adminId]);
    }
    await pool.end();
  }

  console.log(`\nRecycle Bin tests: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
