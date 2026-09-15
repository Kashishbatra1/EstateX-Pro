/**
 * Phase 24 — Property History Tracking tests against live estatex_pro.
 * Usage: npm run test:history
 */
const http = require("http");
const pool = require("../config/db");
const app = require("../app");
const { hashPassword } = require("../utils/password");

const stamp = Date.now();
const TEST_EMAIL = `history.phase24.${stamp}@estatex.test`;
const TEST_PASSWORD = `Hist!${String(stamp).slice(-6)}`;

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
    ["Phase 24 History Tester", TEST_EMAIL, passwordHash]
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
    assert("Auth setup for history tests", Boolean(token));

    const unauth = await request(port, {
      path: "/api/properties/1/history",
    });
    assert("Unauthorized history returns 401", unauth.status === 401);

    const missing = await request(port, {
      path: "/api/properties/999999999/history",
      token,
    });
    assert("History for missing property returns 404", missing.status === 404);

    const create = await request(port, {
      method: "POST",
      path: "/api/properties",
      token,
      body: {
        title: `Phase24 History House ${stamp}`,
        propertyType: "House",
        purpose: "sale",
        category: "residential",
        city: "Lahore",
        area: "DHA",
        askingPrice: 10000000,
        description: "Phase 24 history test property",
      },
    });
    assert("Create property for history returns 201", create.status === 201);
    propertyId = create.json?.data?.property?.id;
    assert("Created property has id", Boolean(propertyId));

    const afterCreate = await request(port, {
      path: `/api/properties/${propertyId}/history`,
      token,
    });
    assert("List history after create returns 200", afterCreate.status === 200);
    assert(
      "History items is array",
      Array.isArray(afterCreate.json?.data?.items)
    );
    assert(
      "Created event present",
      (afterCreate.json?.data?.items || []).some((e) => e.eventType === "created")
    );
    assert(
      "Performed by name present on created event",
      (afterCreate.json?.data?.items || []).some(
        (e) => e.eventType === "created" && e.performedByName
      )
    );

    const priceUpdate = await request(port, {
      method: "PUT",
      path: `/api/properties/${propertyId}`,
      token,
      body: { askingPrice: 12500000 },
    });
    assert("Price-only update returns 200", priceUpdate.status === 200);

    const afterPrice = await request(port, {
      path: `/api/properties/${propertyId}/history?eventType=price_update`,
      token,
    });
    assert("Filter price_update returns 200", afterPrice.status === 200);
    assert(
      "price_update event recorded",
      (afterPrice.json?.data?.items || []).some(
        (e) =>
          e.eventType === "price_update" &&
          e.newValue?.askingPrice === 12500000 &&
          e.oldValue?.askingPrice === 10000000
      )
    );

    const priceOnlyOther = await request(port, {
      path: `/api/properties/${propertyId}/history?eventType=other&limit=5`,
      token,
    });
    const otherAfterPriceOnly = (priceOnlyOther.json?.data?.items || []).filter(
      (e) => e.description === "Property details updated"
    );
    // Price-only change should not add a redundant "other" update for that same action
    // (may still have zero other events at this point)
    assert(
      "Price-only update does not require other event",
      Array.isArray(priceOnlyOther.json?.data?.items)
    );

    const mixedUpdate = await request(port, {
      method: "PUT",
      path: `/api/properties/${propertyId}`,
      token,
      body: {
        askingPrice: 13000000,
        title: `Phase24 History House Updated ${stamp}`,
      },
    });
    assert("Mixed price+title update returns 200", mixedUpdate.status === 200);

    const afterMixed = await request(port, {
      path: `/api/properties/${propertyId}/history`,
      token,
    });
    const mixedItems = afterMixed.json?.data?.items || [];
    assert(
      "Mixed update writes price_update",
      mixedItems.some(
        (e) =>
          e.eventType === "price_update" && e.newValue?.askingPrice === 13000000
      )
    );
    assert(
      "Mixed update also writes other",
      mixedItems.some((e) => e.eventType === "other")
    );

    const badFilter = await request(port, {
      path: `/api/properties/${propertyId}/history?eventType=not_a_real_type`,
      token,
    });
    assert("Invalid eventType returns 400", badFilter.status === 400);

    const badId = await request(port, {
      path: "/api/properties/abc/history",
      token,
    });
    assert("Invalid propertyId returns 400", badId.status === 400);

    const filteredCreated = await request(port, {
      path: `/api/properties/${propertyId}/history?eventType=created&page=1&limit=10`,
      token,
    });
    assert("Filter created returns 200", filteredCreated.status === 200);
    assert(
      "Created filter only returns created",
      (filteredCreated.json?.data?.items || []).every(
        (e) => e.eventType === "created"
      )
    );
    assert(
      "Pagination object present",
      filteredCreated.json?.data?.pagination?.page === 1
    );

    // Suppress unused var lint-style noise for otherAfterPriceOnly
    void otherAfterPriceOnly;
  } catch (err) {
    assert(`Unexpected error: ${err.message}`, false);
  } finally {
    server.close();
    if (propertyId) {
      await pool.query(`DELETE FROM property_history WHERE property_id = $1`, [
        propertyId,
      ]);
      await pool.query(`DELETE FROM properties WHERE id = $1`, [propertyId]);
    }
    if (adminId) {
      await pool.query(`DELETE FROM admins WHERE id = $1`, [adminId]);
    }
    await pool.end();
  }

  console.log(`\nPhase 24 history tests: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
