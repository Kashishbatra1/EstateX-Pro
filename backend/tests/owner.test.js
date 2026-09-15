/**
 * Phase 4 — Owners Management tests against live PostgreSQL (estatex_pro).
 * Does not print secrets.
 *
 * Usage: npm run test:owners
 */
const http = require("http");
const pool = require("../config/db");
const app = require("../app");
const { hashPassword } = require("../utils/password");

const stamp = Date.now();
const TEST_EMAIL = `owners.phase4.${stamp}@estatex.test`;
const TEST_PASSWORD = `Own!${String(stamp).slice(-6)}`;

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
  let token = null;
  let ownerA = null;
  let ownerB = null;
  let propertyId = null;
  let paymentMethodId = null;
  let bankId = null;

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
    ["Phase 4 Owner Tester", TEST_EMAIL, passwordHash]
  );
  adminId = adminIns.rows[0].id;

  const pm = await pool.query(
    `SELECT id FROM payment_methods WHERE is_active = TRUE ORDER BY id LIMIT 1`
  );
  paymentMethodId = pm.rows[0]?.id;

  const bankIns = await pool.query(
    `INSERT INTO bank_accounts (bank_name, account_holder_name, account_number, is_active)
     VALUES ($1, $2, $3, TRUE) RETURNING id`,
    [`P4 Bank ${stamp}`, "EstateX Test", `P4ACC${stamp}`]
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
    assert("Auth setup", Boolean(token));

    // 1) Unauthorized
    const unauth = await request(port, { path: "/api/owners" });
    assert("Unauthorized access returns 401", unauth.status === 401);

    // 2) Create owner
    const createA = await request(port, {
      method: "POST",
      path: "/api/owners",
      token,
      body: {
        ownerName: `Phase4 Owner A ${stamp}`,
        cnic: `35202-${String(stamp).slice(-7)}-1`,
        phone: "03001112223",
        email: `owner.a.${stamp}@test.com`,
        ntn: "1234567-8",
        nomineeName: "Nominee A",
        nomineeRelation: "Spouse",
        poaHolderName: "POA Holder",
        poaDetails: "Limited POA",
      },
    });
    assert("Create owner returns 201", createA.status === 201);
    ownerA = createA.json?.data?.owner?.id;
    assert("Created owner has id", Boolean(ownerA));
    assert(
      "New owner starts unverified",
      createA.json?.data?.owner?.verificationStatus === "unverified"
    );

    // 3) Get all owners
    const list = await request(port, { path: "/api/owners", token });
    assert("Get all owners returns 200", list.status === 200);
    assert("Get all owners returns items", Array.isArray(list.json?.data?.items));

    // 4) Get by id
    const byId = await request(port, { path: `/api/owners/${ownerA}`, token });
    assert("Get owner by id returns 200", byId.status === 200);
    assert(
      "Get owner by id matches name",
      byId.json?.data?.owner?.ownerName.includes("Owner A")
    );

    // 5) Update owner
    const update = await request(port, {
      method: "PUT",
      path: `/api/owners/${ownerA}`,
      token,
      body: { phone: "03009998887", address: "Lahore Test Address" },
    });
    assert("Update owner returns 200", update.status === 200);
    assert("Update owner changes phone", update.json?.data?.owner?.phone === "03009998887");

    // 6) Invalid input
    const invalid = await request(port, {
      method: "POST",
      path: "/api/owners",
      token,
      body: { ownerName: "" },
    });
    assert("Invalid input returns 400", invalid.status === 400);

    // 7) Owner verification
    const verify = await request(port, {
      method: "PATCH",
      path: `/api/owners/${ownerA}/verification`,
      token,
      body: { verificationStatus: "verified" },
    });
    assert("Verify owner returns 200", verify.status === 200);
    assert(
      "Owner verification is verified",
      verify.json?.data?.owner?.verificationStatus === "verified"
    );

    // 8) Search owner
    const search = await request(port, {
      path: `/api/owners?search=Phase4%20Owner%20A%20${stamp}`,
      token,
    });
    assert("Search owner returns 200", search.status === 200);
    assert(
      "Search finds owner",
      (search.json?.data?.items || []).some((o) => o.id === ownerA)
    );

    // Create draft property for linking tests
    const property = await request(port, {
      method: "POST",
      path: "/api/properties",
      token,
      body: {
        title: `P4 Ownership Property ${stamp}`,
        purpose: "sale",
        category: "residential",
        city: "Lahore",
        primaryPaymentMethodId: paymentMethodId,
      },
    });
    propertyId = property.json?.data?.property?.id;
    assert("Draft property created for ownership tests", Boolean(propertyId));

    // 9) Link owner to property
    const linkA = await request(port, {
      method: "POST",
      path: `/api/properties/${propertyId}/owners`,
      token,
      body: {
        ownerId: ownerA,
        sharePercentage: 60,
        ownershipDocumentType: "Registry",
        isPrimary: true,
      },
    });
    assert("Link owner returns 201", linkA.status === 201);
    assert("Linked share is 60", linkA.json?.data?.link?.sharePercentage === 60);

    // Create second verified owner
    const createB = await request(port, {
      method: "POST",
      path: "/api/owners",
      token,
      body: {
        ownerName: `Phase4 Owner B ${stamp}`,
        cnic: `35202-${String(stamp).slice(-7)}-2`,
      },
    });
    ownerB = createB.json?.data?.owner?.id;
    await request(port, {
      method: "PATCH",
      path: `/api/owners/${ownerB}/verification`,
      token,
      body: { verificationStatus: "verified" },
    });

    // 10) Multiple owners
    const linkB = await request(port, {
      method: "POST",
      path: `/api/properties/${propertyId}/owners`,
      token,
      body: {
        ownerId: ownerB,
        sharePercentage: 40,
        ownershipDocumentType: "Agreement",
        isPrimary: false,
      },
    });
    assert("Link second owner returns 201", linkB.status === 201);

    const propertyOwners = await request(port, {
      path: `/api/properties/${propertyId}/owners`,
      token,
    });
    assert("View property owners returns 200", propertyOwners.status === 200);
    assert(
      "Property has two owners",
      (propertyOwners.json?.data?.owners || []).length === 2
    );
    assert(
      "Share total is 100",
      propertyOwners.json?.data?.shareTotal === 100
    );

    // 11/12) Share validation — exceed 100%
    const overShare = await request(port, {
      method: "PATCH",
      path: `/api/properties/${propertyId}/owners/${ownerB}`,
      token,
      body: { sharePercentage: 50 },
    });
    assert("Share update exceeding 100% is rejected", overShare.status === 400);

    const invalidShare = await request(port, {
      method: "POST",
      path: `/api/properties/${propertyId}/owners`,
      token,
      body: { ownerId: ownerA, sharePercentage: 150 },
    });
    assert("Invalid share percentage rejected", invalidShare.status === 400 || invalidShare.status === 409);

    // Update share validly (60/40 -> 70/30)
    const shareUpdate = await request(port, {
      method: "PATCH",
      path: `/api/properties/${propertyId}/owners/${ownerA}`,
      token,
      body: { sharePercentage: 70 },
    });
    // This would make total 110 with B still at 40 — should fail
    assert("Unbalanced share update rejected when total > 100", shareUpdate.status === 400);

    const shareA = await request(port, {
      method: "PATCH",
      path: `/api/properties/${propertyId}/owners/${ownerA}`,
      token,
      body: { sharePercentage: 55 },
    });
    // 55 + 40 = 95, draft allows < 100
    assert("Valid share reduction on draft returns 200", shareA.status === 200);

    const shareB = await request(port, {
      method: "PATCH",
      path: `/api/properties/${propertyId}/owners/${ownerB}`,
      token,
      body: { sharePercentage: 45 },
    });
    assert("Valid complementary share update returns 200", shareB.status === 200);

    // Listing readiness: attach bank, then set available (shares now 100)
    await pool.query(
      `INSERT INTO property_bank_accounts (property_id, bank_account_id, is_primary)
       VALUES ($1, $2, TRUE)`,
      [propertyId, bankId]
    );
    const listable = await request(port, {
      method: "PATCH",
      path: `/api/properties/${propertyId}/status`,
      token,
      body: { status: "available" },
    });
    assert(
      "Property can become available with verified owners + 100% shares",
      listable.status === 200
    );

    // 13) Unlink from listed property should fail (would break 100% / verified owner rules)
    const unlinkListed = await request(port, {
      method: "DELETE",
      path: `/api/properties/${propertyId}/owners/${ownerB}`,
      token,
    });
    assert(
      "Unlink owner from listed property is blocked",
      unlinkListed.status === 400
    );

    // Move back to draft then unlink
    await pool.query(
      `UPDATE properties SET status = 'draft' WHERE id = $1`,
      [propertyId]
    );
    const unlink = await request(port, {
      method: "DELETE",
      path: `/api/properties/${propertyId}/owners/${ownerB}`,
      token,
    });
    assert("Unlink owner from draft property returns 200", unlink.status === 200);

    const afterUnlink = await request(port, {
      path: `/api/properties/${propertyId}/owners`,
      token,
    });
    assert(
      "Only one owner remains after unlink",
      (afterUnlink.json?.data?.owners || []).length === 1
    );

    // 14) Property history recorded
    const history = await pool.query(
      `SELECT COUNT(*)::INT AS count
       FROM property_history
       WHERE property_id = $1 AND event_type = 'ownership_change'`,
      [propertyId]
    );
    assert(
      "Ownership changes recorded in property history",
      history.rows[0].count >= 1
    );
  } catch (err) {
    assert(`Unexpected error: ${err.message}`, false);
  } finally {
    server.close();

    if (propertyId) {
      await pool.query(`DELETE FROM property_history WHERE property_id = $1`, [propertyId]);
      await pool.query(`DELETE FROM property_owners WHERE property_id = $1`, [propertyId]);
      await pool.query(`DELETE FROM property_bank_accounts WHERE property_id = $1`, [propertyId]);
      await pool.query(`DELETE FROM properties WHERE id = $1`, [propertyId]);
    }
    if (ownerA) await pool.query(`DELETE FROM owners WHERE id = $1`, [ownerA]);
    if (ownerB) await pool.query(`DELETE FROM owners WHERE id = $1`, [ownerB]);
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
  console.error("Owner test runner failed:", err.message);
  await pool.end().catch(() => {});
  process.exit(1);
});
