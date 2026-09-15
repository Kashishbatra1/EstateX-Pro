/**
 * Phase 3 — Property Management tests against live PostgreSQL (estatex_pro).
 * Uses ephemeral admin + property records. Does not print secrets.
 *
 * Usage: npm run test:properties
 */
const http = require("http");
const pool = require("../config/db");
const app = require("../app");
const { hashPassword } = require("../utils/password");

const stamp = Date.now();
const TEST_EMAIL = `property.phase3.${stamp}@estatex.test`;
const TEST_PASSWORD = `Prop!${String(stamp).slice(-6)}`;

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
  let propertyId = null;
  let ownerId = null;
  let bankId = null;
  let paymentMethodId = null;
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
    ["Phase 3 Property Tester", TEST_EMAIL, passwordHash]
  );
  adminId = adminIns.rows[0].id;

  const pm = await pool.query(
    `SELECT id FROM payment_methods WHERE is_active = TRUE ORDER BY id LIMIT 1`
  );
  paymentMethodId = pm.rows[0]?.id;

  const ownerIns = await pool.query(
    `INSERT INTO owners (owner_name, cnic, verification_status, verified_at, verified_by)
     VALUES ($1, $2, 'verified', CURRENT_TIMESTAMP, $3)
     RETURNING id`,
    [`Phase3 Owner ${stamp}`, `35202-${String(stamp).slice(-7)}-1`, adminId]
  );
  ownerId = ownerIns.rows[0].id;

  const bankIns = await pool.query(
    `INSERT INTO bank_accounts (bank_name, account_holder_name, account_number, is_active)
     VALUES ($1, $2, $3, TRUE)
     RETURNING id`,
    [`Phase3 Bank ${stamp}`, "EstateX Test", `ACC${stamp}`]
  );
  bankId = bankIns.rows[0].id;

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
    assert("Auth setup for property tests", Boolean(token));

    // 1) Unauthorized access
    const unauth = await request(port, { path: "/api/properties" });
    assert("Unauthorized list returns 401", unauth.status === 401);

    // 2) Create draft property
    const create = await request(port, {
      method: "POST",
      path: "/api/properties",
      token,
      body: {
        title: `Phase3 Test House ${stamp}`,
        propertyType: "House",
        purpose: "sale",
        category: "residential",
        city: "Lahore",
        area: "DHA",
        society: "Phase 6",
        block: "A",
        street: "Street 1",
        flatOrPlotNumber: "99",
        floorNumber: 1,
        coveredArea: 2500,
        plotSize: 10,
        areaUnit: "Marla",
        askingPrice: 50000000,
        description: "Phase 3 automated test property",
        isFeatured: false,
      },
    });
    assert("Create draft property returns 201", create.status === 201);
    assert("Created property status is draft", create.json?.data?.property?.status === "draft");
    propertyId = create.json?.data?.property?.id;
    assert("Created property has id", Boolean(propertyId));
    assert("Created property has propertyCode", Boolean(create.json?.data?.property?.propertyCode));

    // 3) Get properties
    const list = await request(port, { path: "/api/properties", token });
    assert("Get properties returns 200", list.status === 200);
    assert("Get properties returns items array", Array.isArray(list.json?.data?.items));

    // 4) Get by id
    const byId = await request(port, { path: `/api/properties/${propertyId}`, token });
    assert("Get property by id returns 200", byId.status === 200);
    assert(
      "Get property by id matches title",
      byId.json?.data?.property?.title.includes("Phase3 Test House")
    );

    // 5) Update property
    const update = await request(port, {
      method: "PUT",
      path: `/api/properties/${propertyId}`,
      token,
      body: {
        title: `Phase3 Updated House ${stamp}`,
        nearbyLandmarks: "Park, Mosque",
        primaryPaymentMethodId: paymentMethodId,
        furnishingStatus: "Semi-Furnished",
      },
    });
    assert("Update property returns 200", update.status === 200);
    assert(
      "Update property changes title",
      update.json?.data?.property?.title.includes("Updated House")
    );

    // 6) Search property
    const search = await request(port, {
      path: `/api/properties?search=Phase3%20Updated%20House%20${stamp}`,
      token,
    });
    assert("Search property returns 200", search.status === 200);
    assert(
      "Search finds created property",
      (search.json?.data?.items || []).some((p) => p.id === propertyId)
    );

    // 7) Filter property
    const filter = await request(port, {
      path: "/api/properties?status=draft&city=Lahore&category=residential&purpose=sale",
      token,
    });
    assert("Filter property returns 200", filter.status === 200);
    assert(
      "Filter includes test property",
      (filter.json?.data?.items || []).some((p) => p.id === propertyId)
    );

    // 8a) Change status to available WITHOUT prerequisites → 400
    const badStatus = await request(port, {
      method: "PATCH",
      path: `/api/properties/${propertyId}/status`,
      token,
      body: { status: "available" },
    });
    assert(
      "Status available without owner/bank is rejected",
      badStatus.status === 400
    );

    // Link owner + bank (approved schema relationships) then retry
    await pool.query(
      `INSERT INTO property_owners (property_id, owner_id, share_percentage, is_primary, ownership_document_type)
       VALUES ($1, $2, 100, TRUE, 'Registry')`,
      [propertyId, ownerId]
    );
    await pool.query(
      `INSERT INTO property_bank_accounts (property_id, bank_account_id, is_primary)
       VALUES ($1, $2, TRUE)`,
      [propertyId, bankId]
    );

    const goodStatus = await request(port, {
      method: "PATCH",
      path: `/api/properties/${propertyId}/status`,
      token,
      body: { status: "available" },
    });
    assert("Status available with prerequisites returns 200", goodStatus.status === 200);
    assert(
      "Property status is available",
      goodStatus.json?.data?.property?.status === "available"
    );

    // 9) Invalid input validation
    const invalid = await request(port, {
      method: "POST",
      path: "/api/properties",
      token,
      body: { title: "", purpose: "invalid", category: "nope" },
    });
    assert("Invalid create input returns 400", invalid.status === 400);

    const invalidStatus = await request(port, {
      method: "PATCH",
      path: `/api/properties/${propertyId}/status`,
      token,
      body: { status: "listed" },
    });
    assert("Invalid status value returns 400", invalidStatus.status === 400);

    // 10) Soft delete behavior
    const del = await request(port, {
      method: "DELETE",
      path: `/api/properties/${propertyId}`,
      token,
    });
    assert("Delete property returns 200", del.status === 200);
    assert("Delete sets deletedAt", Boolean(del.json?.data?.property?.deletedAt));

    const afterDelete = await request(port, {
      path: `/api/properties/${propertyId}`,
      token,
    });
    assert("Soft-deleted property not returned by get", afterDelete.status === 404);

    const listAfter = await request(port, {
      path: `/api/properties?search=Phase3%20Updated%20House%20${stamp}`,
      token,
    });
    assert(
      "Soft-deleted property excluded from list",
      !(listAfter.json?.data?.items || []).some((p) => p.id === propertyId)
    );

    const inBin = await pool.query(
      `SELECT deleted_at IS NOT NULL AS in_bin FROM properties WHERE id = $1`,
      [propertyId]
    );
    assert("Property remains in DB as soft-deleted", inBin.rows[0]?.in_bin === true);
  } catch (err) {
    assert(`Unexpected error: ${err.message}`, false);
  } finally {
    server.close();

    // Cleanup test data (hard delete test fixtures only)
    if (propertyId) {
      await pool.query(`DELETE FROM property_history WHERE property_id = $1`, [propertyId]);
      await pool.query(`DELETE FROM property_owners WHERE property_id = $1`, [propertyId]);
      await pool.query(`DELETE FROM property_bank_accounts WHERE property_id = $1`, [propertyId]);
      await pool.query(`DELETE FROM properties WHERE id = $1`, [propertyId]);
    }
    if (ownerId) await pool.query(`DELETE FROM owners WHERE id = $1`, [ownerId]);
    if (bankId) await pool.query(`DELETE FROM bank_accounts WHERE id = $1`, [bankId]);
    if (adminId) {
      await pool.query(`DELETE FROM audit_logs WHERE admin_id = $1`, [adminId]);
      await pool.query(`DELETE FROM admins WHERE id = $1`, [adminId]);
    }
    await pool.end();
  }

  console.log("");
  console.log(`Results: ${passed} passed, ${failed} failed`);
  process.exitCode = failed > 0 ? 1 : 0;
}

run().catch(async (err) => {
  console.error("Property test runner failed:", err.message);
  await pool.end().catch(() => {});
  process.exit(1);
});
