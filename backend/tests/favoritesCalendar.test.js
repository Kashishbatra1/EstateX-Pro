/**
 * Phase 31/32 — Calendar + Favorites smoke tests
 */
const http = require("http");
const pool = require("../config/db");
const app = require("../app");
const { hashPassword } = require("../utils/password");

const stamp = Date.now();
const TEST_EMAIL = `favcal.${stamp}@estatex.test`;
const TEST_PASSWORD = `Fc!${String(stamp).slice(-6)}`;

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
  let propertyId = null;
  let favoriteId = null;
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
    ["FavCal Tester", TEST_EMAIL, passwordHash]
  );
  adminId = adminIns.rows[0].id;

  const prop = await pool.query(
    `INSERT INTO properties (title, purpose, category, status, created_by)
     VALUES ($1,'sale','residential','draft',$2) RETURNING id`,
    [`FavCal Prop ${stamp}`, adminId]
  );
  propertyId = prop.rows[0].id;

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

    const cal = await request(port, {
      path: "/api/calendar?from=2026-01-01&to=2026-12-31",
      token,
    });
    assert("Calendar returns 200", cal.status === 200);
    assert("Calendar items array", Array.isArray(cal.json?.data?.items));

    const add = await request(port, {
      method: "POST",
      path: "/api/favorites",
      token,
      body: { entityType: "property", entityId: propertyId },
    });
    assert("Add favorite 201", add.status === 201);
    favoriteId = add.json?.data?.favorite?.id;

    const list = await request(port, { path: "/api/favorites", token });
    assert("List favorites 200", list.status === 200);
    assert(
      "Favorite present",
      (list.json?.data?.items || []).some((f) => Number(f.id) === Number(favoriteId))
    );

    const filtered = await request(port, {
      path: `/api/favorites?entityType=property&entityId=${propertyId}`,
      token,
    });
    assert("Filter by entity 200", filtered.status === 200);
    assert(
      "Filter returns pinned item",
      (filtered.json?.data?.items || []).length === 1 &&
        Number(filtered.json.data.items[0].entityId) === Number(propertyId)
    );

    const dup = await request(port, {
      method: "POST",
      path: "/api/favorites",
      token,
      body: { entityType: "property", entityId: propertyId },
    });
    assert("Duplicate favorite 409", dup.status === 409);

    const del = await request(port, {
      method: "DELETE",
      path: `/api/favorites/${favoriteId}`,
      token,
    });
    assert("Remove favorite 200", del.status === 200);
  } catch (err) {
    assert(`Unexpected: ${err.message}`, false);
  } finally {
    server.close();
    if (adminId) {
      await pool.query(`DELETE FROM favorites WHERE admin_id = $1`, [adminId]);
    }
    if (propertyId) {
      await pool.query(`DELETE FROM property_history WHERE property_id = $1`, [propertyId]);
      await pool.query(`DELETE FROM properties WHERE id = $1`, [propertyId]);
    }
    if (adminId) await pool.query(`DELETE FROM admins WHERE id = $1`, [adminId]);
    await pool.end();
  }

  console.log(`\nFavorites/Calendar tests: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
