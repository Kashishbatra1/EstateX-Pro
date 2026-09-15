/**
 * Phase 39 — Document expiry + vendor contract reminder smoke tests
 */
const http = require("http");
const pool = require("../config/db");
const app = require("../app");
const { hashPassword } = require("../utils/password");

const stamp = Date.now();
const TEST_EMAIL = `docexp.${stamp}@estatex.test`;
const TEST_PASSWORD = `Dx!${String(stamp).slice(-6)}`;

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

function daysFromNow(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function run() {
  let passed = 0;
  let failed = 0;
  let adminId = null;
  let propertyId = null;
  let clientId = null;
  let vendorId = null;
  let propDocId = null;
  let kycDocId = null;
  let token = null;
  let notificationIds = [];

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
    ["DocExp Tester", TEST_EMAIL, passwordHash]
  );
  adminId = Number(adminIns.rows[0].id);

  const prop = await pool.query(
    `INSERT INTO properties (title, purpose, category, status, created_by)
     VALUES ($1,'sale','residential','draft',$2) RETURNING id`,
    [`DocExp Prop ${stamp}`, adminId]
  );
  propertyId = Number(prop.rows[0].id);

  const doc = await pool.query(
    `INSERT INTO property_documents (
       property_id, document_type, document_name, file_path, expiry_date, uploaded_by
     ) VALUES ($1, 'other', $2, $3, $4, $5)
     RETURNING id`,
    [
      propertyId,
      `Lease copy ${stamp}`,
      `/tmp/lease-${stamp}.pdf`,
      daysFromNow(3),
      adminId,
    ]
  );
  propDocId = Number(doc.rows[0].id);

  const client = await pool.query(
    `INSERT INTO clients (client_name, phone, client_type)
     VALUES ($1, $2, 'buyer') RETURNING id`,
    [`DocExp Client ${stamp}`, `03${String(stamp).slice(-9)}`]
  );
  clientId = Number(client.rows[0].id);

  const kyc = await pool.query(
    `INSERT INTO client_kyc_documents (
       client_id, document_type, file_path, file_name, expiry_date, uploaded_by
     ) VALUES ($1, 'CNIC', $2, $3, $4, $5)
     RETURNING id`,
    [clientId, `/tmp/cnic-${stamp}.pdf`, `cnic-${stamp}.pdf`, daysFromNow(2), adminId]
  );
  kycDocId = Number(kyc.rows[0].id);

  const vendor = await pool.query(
    `INSERT INTO vendors (vendor_name, contract_end_date)
     VALUES ($1, $2) RETURNING id`,
    [`DocExp Vendor ${stamp}`, daysFromNow(5)]
  );
  vendorId = Number(vendor.rows[0].id);

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

    const process1 = await request(port, {
      method: "POST",
      path: "/api/notifications/reminders/process?daysAhead=7",
      token,
    });
    assert("Process 200", process1.status === 200);
    assert("Created some", Number(process1.json?.data?.createdCount) >= 3);

    const docNotes = await request(port, {
      path: "/api/notifications?notificationType=document_expiry",
      token,
    });
    const docItems = docNotes.json?.data?.items || [];
    assert(
      "Property doc expiry notice",
      docItems.some(
        (n) => n.entityType === "property_document" && n.entityId === propDocId
      )
    );
    assert(
      "KYC doc expiry notice",
      docItems.some(
        (n) => n.entityType === "client_kyc_document" && n.entityId === kycDocId
      )
    );

    const vendorNotes = await request(port, {
      path: "/api/notifications?notificationType=vendor_contract_renewal",
      token,
    });
    assert(
      "Vendor contract notice",
      (vendorNotes.json?.data?.items || []).some(
        (n) => n.entityType === "vendor" && n.entityId === vendorId
      )
    );

    notificationIds = [
      ...docItems
        .filter(
          (n) =>
            (n.entityType === "property_document" && n.entityId === propDocId) ||
            (n.entityType === "client_kyc_document" && n.entityId === kycDocId)
        )
        .map((n) => n.id),
      ...((vendorNotes.json?.data?.items || [])
        .filter((n) => n.entityType === "vendor" && n.entityId === vendorId)
        .map((n) => n.id)),
    ];

    const process2 = await request(port, {
      method: "POST",
      path: "/api/notifications/reminders/process?daysAhead=7",
      token,
    });
    assert("Second process 200", process2.status === 200);
    assert(
      "Deduped for seeded entities",
      Number(process2.json?.data?.createdCount) === 0 ||
        !(process2.json?.data?.items || []).some(
          (n) =>
            (n.entityType === "property_document" && n.entityId === propDocId) ||
            (n.entityType === "client_kyc_document" && n.entityId === kycDocId) ||
            (n.entityType === "vendor" && n.entityId === vendorId)
        )
    );

    const cal = await request(port, {
      path: `/api/calendar?from=${daysFromNow(0)}&to=${daysFromNow(10)}`,
      token,
    });
    assert("Calendar 200", cal.status === 200);
    const calItems = cal.json?.data?.items || [];
    assert(
      "Calendar has property doc",
      calItems.some((e) => e.id === `property-doc-${propDocId}`)
    );
    assert(
      "Calendar has vendor contract",
      calItems.some((e) => e.id === `vendor-contract-${vendorId}`)
    );
  } finally {
    server.close();
    if (notificationIds.length) {
      await pool.query(`DELETE FROM notifications WHERE id = ANY($1::bigint[])`, [
        notificationIds,
      ]);
    }
    // Also clean any leftover from process for these entities
    await pool.query(
      `DELETE FROM notifications
       WHERE (entity_type = 'property_document' AND entity_id = $1)
          OR (entity_type = 'client_kyc_document' AND entity_id = $2)
          OR (entity_type = 'vendor' AND entity_id = $3)`,
      [propDocId || 0, kycDocId || 0, vendorId || 0]
    );
    if (propDocId) {
      await pool.query(`DELETE FROM property_documents WHERE id = $1`, [propDocId]);
    }
    if (kycDocId) {
      await pool.query(`DELETE FROM client_kyc_documents WHERE id = $1`, [kycDocId]);
    }
    if (vendorId) {
      await pool.query(`DELETE FROM vendors WHERE id = $1`, [vendorId]);
    }
    if (clientId) {
      await pool.query(`DELETE FROM clients WHERE id = $1`, [clientId]);
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

  console.log(`\nDocument expiry tests: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
