/**
 * Phase 27 — Vendor Management tests against live estatex_pro.
 */
const http = require("http");
const pool = require("../config/db");
const app = require("../app");
const { hashPassword } = require("../utils/password");

const stamp = Date.now();
const TEST_EMAIL = `vendors.phase27.${stamp}@estatex.test`;
const TEST_PASSWORD = `Ven!${String(stamp).slice(-6)}`;

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
     VALUES ($1, $2, $3, TRUE) RETURNING id`,
    ["Phase 27 Vendor Tester", TEST_EMAIL, passwordHash]
  );
  adminId = adminIns.rows[0].id;

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

    const unauth = await request(port, { path: "/api/vendors" });
    assert("Unauthorized returns 401", unauth.status === 401);

    const bad = await request(port, {
      method: "POST",
      path: "/api/vendors",
      token,
      body: { phone: "0300" },
    });
    assert("Create without name rejected", bad.status === 400);

    const create = await request(port, {
      method: "POST",
      path: "/api/vendors",
      token,
      body: {
        vendorName: `P27 Vendor ${stamp}`,
        contactPerson: "Ali",
        phone: "03001234567",
        services: "AC repair",
        isPreferred: true,
        outstandingBalance: 10000,
        contractStartDate: "2026-01-01",
        contractEndDate: "2026-12-31",
      },
    });
    assert("Create vendor returns 201", create.status === 201);
    vendorId = create.json?.data?.vendor?.id;
    assert("Vendor id present", Boolean(vendorId));
    assert(
      "Outstanding is 10000",
      Number(create.json?.data?.vendor?.outstandingBalance) === 10000
    );

    const list = await request(port, {
      path: `/api/vendors?search=P27%20Vendor%20${stamp}`,
      token,
    });
    assert("List returns 200", list.status === 200);
    assert(
      "List includes vendor",
      (list.json?.data?.items || []).some((v) => Number(v.id) === Number(vendorId))
    );

    const detail = await request(port, {
      path: `/api/vendors/${vendorId}`,
      token,
    });
    assert("Detail returns 200", detail.status === 200);
    assert("Detail has payments array", Array.isArray(detail.json?.data?.vendor?.payments));

    const pay = await request(port, {
      method: "POST",
      path: `/api/vendors/${vendorId}/payments`,
      token,
      body: { amount: 2500, notes: "Partial payment" },
    });
    assert("Payment returns 201", pay.status === 201);
    assert(
      "Balance reduced to 7500",
      Number(pay.json?.data?.outstandingBalance) === 7500
    );

    const docBad = await request(port, {
      method: "POST",
      path: `/api/vendors/${vendorId}/documents`,
      token,
      body: { documentName: "Contract" },
    });
    assert("Document without path blocked", docBad.status === 400);

    const doc = await request(port, {
      method: "POST",
      path: `/api/vendors/${vendorId}/documents`,
      token,
      body: {
        documentName: "Contract",
        documentType: "agreement",
        filePath: `/uploads/vendors/contract-${stamp}.pdf`,
      },
    });
    assert("Document register returns 201", doc.status === 201);
    const documentId = doc.json?.data?.document?.id;

    const update = await request(port, {
      method: "PUT",
      path: `/api/vendors/${vendorId}`,
      token,
      body: { notes: "Preferred AC vendor" },
    });
    assert("Update returns 200", update.status === 200);

    const delDoc = await request(port, {
      method: "DELETE",
      path: `/api/vendors/${vendorId}/documents/${documentId}`,
      token,
    });
    assert("Soft-delete document returns 200", delDoc.status === 200);

    const del = await request(port, {
      method: "DELETE",
      path: `/api/vendors/${vendorId}`,
      token,
    });
    assert("Soft-delete vendor returns 200", del.status === 200);

    const after = await request(port, {
      path: `/api/vendors/${vendorId}`,
      token,
    });
    assert("Soft-deleted vendor hidden", after.status === 404);

    const invOk = await request(port, { path: "/api/inventory?limit=1", token });
    assert("Inventory regression ok", invOk.status === 200);
  } catch (err) {
    assert(`Unexpected error: ${err.message}`, false);
  } finally {
    server.close();
    if (vendorId) {
      await pool.query(`DELETE FROM vendor_documents WHERE vendor_id = $1`, [vendorId]);
      await pool.query(`DELETE FROM vendor_payments WHERE vendor_id = $1`, [vendorId]);
      await pool.query(`DELETE FROM vendors WHERE id = $1`, [vendorId]);
    }
    if (adminId) {
      await pool.query(`DELETE FROM audit_logs WHERE admin_id = $1`, [adminId]);
      await pool.query(`DELETE FROM admins WHERE id = $1`, [adminId]);
    }
    await pool.end();
  }

  console.log(`\nPhase 27 vendor tests: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
