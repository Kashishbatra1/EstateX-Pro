/**
 * Phase 23 — Resale & Transfer Management tests against live estatex_pro.
 * Usage: npm run test:transfers
 */
const http = require("http");
const pool = require("../config/db");
const app = require("../app");
const { hashPassword } = require("../utils/password");

const stamp = Date.now();
const TEST_EMAIL = `transfers.phase23.${stamp}@estatex.test`;
const TEST_PASSWORD = `Trn!${String(stamp).slice(-6)}`;

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

async function prepareAvailableProperty(adminId) {
  const pm = await pool.query(
    `SELECT id FROM payment_methods WHERE is_active = TRUE ORDER BY id LIMIT 1`
  );
  const paymentMethodId = pm.rows[0].id;
  const cnicSuffix = String(stamp).slice(-7).padStart(7, "0");

  const ownerIns = await pool.query(
    `INSERT INTO owners (owner_name, cnic, verification_status, verified_at, verified_by)
     VALUES ($1, $2, 'verified', CURRENT_TIMESTAMP, $3)
     RETURNING id, owner_name`,
    [`P23 Owner ${stamp}`, `35202-${cnicSuffix}-3`, adminId]
  );
  const ownerId = ownerIns.rows[0].id;
  const ownerName = ownerIns.rows[0].owner_name;

  const owner2Ins = await pool.query(
    `INSERT INTO owners (owner_name, cnic, verification_status, verified_at, verified_by)
     VALUES ($1, $2, 'verified', CURRENT_TIMESTAMP, $3)
     RETURNING id`,
    [`P23 ToOwner ${stamp}`, `35202-${cnicSuffix}-4`, adminId]
  );
  const toOwnerId = owner2Ins.rows[0].id;

  const bankIns = await pool.query(
    `INSERT INTO bank_accounts (bank_name, account_holder_name, account_number, is_active)
     VALUES ($1, $2, $3, TRUE) RETURNING id`,
    [`P23 Bank`, "EstateX Test", `P23ACC${stamp}`]
  );
  const bankId = bankIns.rows[0].id;

  const propIns = await pool.query(
    `INSERT INTO properties (
       title, property_type, purpose, category, city, area,
       asking_price, primary_payment_method_id, status
     ) VALUES ($1, 'House', 'sale', 'residential', 'Lahore', 'DHA',
               8500000, $2, 'draft')
     RETURNING id, property_code`,
    [`Phase23 Property ${stamp}`, paymentMethodId]
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

  const clientIns = await pool.query(
    `INSERT INTO clients (client_name, client_type, phone)
     VALUES ($1, 'buyer', $2) RETURNING id`,
    [`P23 Client ${stamp}`, `0300${String(stamp).slice(-7)}`]
  );

  return {
    propertyId,
    ownerId,
    ownerName,
    toOwnerId,
    toClientId: clientIns.rows[0].id,
    bankId,
  };
}

async function run() {
  let passed = 0;
  let failed = 0;
  let adminId = null;
  let token = null;
  let propertyId = null;
  let ownerId = null;
  let toOwnerId = null;
  let toClientId = null;
  let bankId = null;
  let transferId = null;
  let transferId2 = null;
  let orphanPropertyId = null;
  let orphanTransferId = null;
  let snapshotOwners = null;

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
    [`Phase23 Admin ${stamp}`, TEST_EMAIL, passwordHash]
  );
  adminId = adminIns.rows[0].id;

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  try {
    const login = await request(port, {
      method: "POST",
      path: "/api/auth/login",
      body: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });
    token = login.json?.data?.token;
    assert("Auth setup", login.status === 200 && Boolean(token));

    const unauth = await request(port, { path: "/api/transfers" });
    assert("Unauthorized access returns 401", unauth.status === 401);

    const setup = await prepareAvailableProperty(adminId);
    propertyId = setup.propertyId;
    ownerId = setup.ownerId;
    toOwnerId = setup.toOwnerId;
    toClientId = setup.toClientId;
    bankId = setup.bankId;
    assert("Setup property with owner", Boolean(propertyId && ownerId));

    const badType = await request(port, {
      method: "POST",
      path: "/api/transfers",
      token,
      body: { propertyId, transferType: "gift" },
    });
    assert("Invalid transfer type rejected", badType.status === 400);

    const badProp = await request(port, {
      method: "POST",
      path: "/api/transfers",
      token,
      body: { propertyId: 999999999, transferType: "resale" },
    });
    assert("Invalid property rejected", badProp.status === 400);

    const badOwner = await request(port, {
      method: "POST",
      path: "/api/transfers",
      token,
      body: {
        propertyId,
        transferType: "resale",
        fromOwnerId: 999999999,
      },
    });
    assert("Invalid owner rejected", badOwner.status === 400);

    const badClient = await request(port, {
      method: "POST",
      path: "/api/transfers",
      token,
      body: {
        propertyId,
        transferType: "resale",
        toClientId: 999999999,
      },
    });
    assert("Invalid client rejected", badClient.status === 400);

    const neg = await request(port, {
      method: "POST",
      path: "/api/transfers",
      token,
      body: {
        propertyId,
        transferType: "resale",
        transferCharges: -100,
      },
    });
    assert("Negative charges rejected", neg.status === 400);

    const orphanProp = await pool.query(
      `INSERT INTO properties (
         title, property_type, purpose, category, city, area,
         asking_price, status
       ) VALUES ($1, 'Plot', 'sale', 'land', 'Lahore', 'Bahria',
                 2000000, 'draft')
       RETURNING id`,
      [`Phase23 Orphan Prop ${stamp}`]
    );
    orphanPropertyId = orphanProp.rows[0].id;

    const createNoOwners = await request(port, {
      method: "POST",
      path: "/api/transfers",
      token,
      body: {
        propertyId: orphanPropertyId,
        transferType: "resale",
      },
    });
    assert(
      "Create with zero current owners succeeds",
      createNoOwners.status === 201
    );
    orphanTransferId = createNoOwners.json?.data?.transfer?.id;
    const emptySnap =
      createNoOwners.json?.data?.transfer?.previousOwnerSnapshot;
    assert(
      "Empty owner snapshot stored",
      Array.isArray(emptySnap?.owners) && emptySnap.owners.length === 0
    );

    const createResale = await request(port, {
      method: "POST",
      path: "/api/transfers",
      token,
      body: {
        propertyId,
        transferType: "resale",
        fromOwnerId: ownerId,
        toOwnerId,
        toClientId,
        transferCharges: 50000,
        leaseCharges: 0,
        transferTax: 25000,
        stampDuty: 10000,
        nocForTransfer: true,
        nocStatus: "pending",
        nocDocumentPath: "/docs/noc-meta-only.pdf",
        transferDate: "2026-09-10",
        notes: "Phase 23 resale test",
      },
    });
    assert("Valid resale creation returns 201", createResale.status === 201);
    transferId = createResale.json?.data?.transfer?.id;
    assert("Created transfer has id", Boolean(transferId));

    const snap = createResale.json?.data?.transfer?.previousOwnerSnapshot;
    snapshotOwners = snap?.owners;
    assert(
      "Previous-owner snapshot populated",
      Array.isArray(snapshotOwners) &&
        snapshotOwners.length >= 1 &&
        snapshotOwners.some((o) => Number(o.ownerId) === Number(ownerId))
    );

    const createTransfer = await request(port, {
      method: "POST",
      path: "/api/transfers",
      token,
      body: {
        propertyId,
        transferType: "transfer",
        fromOwnerId: ownerId,
        toOwnerId,
        transferCharges: 15000,
      },
    });
    assert("Valid transfer creation returns 201", createTransfer.status === 201);
    transferId2 = createTransfer.json?.data?.transfer?.id;

    const list = await request(port, {
      path: `/api/transfers?propertyId=${propertyId}`,
      token,
    });
    assert("List endpoint returns 200", list.status === 200);
    assert(
      "List includes created transfer",
      (list.json?.data?.items || []).some((t) => t.id === transferId)
    );

    const filtered = await request(port, {
      path: `/api/transfers?transferType=resale&propertyId=${propertyId}`,
      token,
    });
    assert("Filter by transferType works", filtered.status === 200);
    assert(
      "Filter returns only resale",
      (filtered.json?.data?.items || []).every((t) => t.transferType === "resale")
    );

    const search = await request(port, {
      path: `/api/transfers?search=Phase23&propertyId=${propertyId}`,
      token,
    });
    assert("Search returns 200", search.status === 200);
    assert(
      "Search finds property transfer",
      (search.json?.data?.items || []).some((t) => t.id === transferId)
    );

    const nested = await request(port, {
      path: `/api/properties/${propertyId}/transfers`,
      token,
    });
    assert("Nested property transfers returns 200", nested.status === 200);
    assert(
      "Nested list includes transfer",
      (nested.json?.data?.items || []).some((t) => t.id === transferId)
    );

    const detail = await request(port, {
      path: `/api/transfers/${transferId}`,
      token,
    });
    assert("Detail endpoint returns 200", detail.status === 200);
    assert(
      "Detail has charge breakdown",
      detail.json?.data?.transfer?.transferCharges === 50000 &&
        detail.json?.data?.transfer?.stampDuty === 10000
    );

    const update = await request(port, {
      method: "PUT",
      path: `/api/transfers/${transferId}`,
      token,
      body: {
        transferCharges: 55000,
        nocStatus: "approved",
        notes: "Updated Phase 23 notes",
      },
    });
    assert("Update returns 200", update.status === 200);
    assert(
      "Update applied charges",
      update.json?.data?.transfer?.transferCharges === 55000
    );
    assert(
      "Snapshot unchanged after update",
      JSON.stringify(update.json?.data?.transfer?.previousOwnerSnapshot?.owners) ===
        JSON.stringify(snapshotOwners)
    );

    const overwriteSnap = await request(port, {
      method: "PUT",
      path: `/api/transfers/${transferId}`,
      token,
      body: {
        previousOwnerSnapshot: { owners: [] },
      },
    });
    assert(
      "Historical snapshot overwrite rejected",
      overwriteSnap.status === 400
    );

    const hist = await pool.query(
      `SELECT id FROM property_history
       WHERE property_id = $1 AND event_type = 'transfer'
       ORDER BY id DESC LIMIT 1`,
      [propertyId]
    );
    assert("transfer property_history entry exists", Boolean(hist.rows[0]));

    const audit = await pool.query(
      `SELECT action FROM audit_logs
       WHERE entity_type = 'property_transfer' AND entity_id = $1`,
      [transferId]
    );
    const actions = audit.rows.map((r) => r.action);
    assert("TRANSFER_CREATE audit", actions.includes("TRANSFER_CREATE"));
    assert("TRANSFER_UPDATE audit", actions.includes("TRANSFER_UPDATE"));

    const remove = await request(port, {
      method: "DELETE",
      path: `/api/transfers/${transferId}`,
      token,
      body: {},
    });
    assert("Soft-delete returns 200", remove.status === 200);

    const auditDel = await pool.query(
      `SELECT action FROM audit_logs
       WHERE entity_type = 'property_transfer' AND entity_id = $1
         AND action = 'TRANSFER_SOFT_DELETE'`,
      [transferId]
    );
    assert("TRANSFER_SOFT_DELETE audit", Boolean(auditDel.rows[0]));

    const gone = await request(port, {
      path: `/api/transfers/${transferId}`,
      token,
    });
    assert("Soft-deleted hidden from get", gone.status === 404);

    const listAfter = await request(port, {
      path: `/api/transfers?propertyId=${propertyId}`,
      token,
    });
    assert(
      "Soft-deleted excluded from list",
      !(listAfter.json?.data?.items || []).some((t) => t.id === transferId)
    );

    const props = await request(port, { path: "/api/properties?limit=1", token });
    assert("Regression: properties ok", props.status === 200);
    const commissions = await request(port, {
      path: "/api/commissions?limit=1",
      token,
    });
    assert("Regression: commissions ok", commissions.status === 200);
    const owners = await request(port, { path: "/api/owners?limit=1", token });
    assert("Regression: owners ok", owners.status === 200);
  } catch (err) {
    assert(`Unexpected test error: ${err.message}`, false);
  } finally {
    server.close();
    const ids = [transferId, transferId2, orphanTransferId].filter(Boolean);
    for (const id of ids) {
      await pool.query(
        `DELETE FROM audit_logs WHERE entity_type = 'property_transfer' AND entity_id = $1`,
        [id]
      );
      await pool.query(`DELETE FROM property_transfers WHERE id = $1`, [id]);
    }
    if (orphanPropertyId) {
      await pool.query(`DELETE FROM property_history WHERE property_id = $1`, [
        orphanPropertyId,
      ]);
      await pool.query(`DELETE FROM properties WHERE id = $1`, [
        orphanPropertyId,
      ]);
    }
    if (propertyId) {
      await pool.query(
        `UPDATE properties SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [propertyId]
      );
      await pool.query(`DELETE FROM property_history WHERE property_id = $1`, [
        propertyId,
      ]);
      await pool.query(`DELETE FROM property_owners WHERE property_id = $1`, [
        propertyId,
      ]);
      await pool.query(
        `DELETE FROM property_bank_accounts WHERE property_id = $1`,
        [propertyId]
      );
      await pool.query(`DELETE FROM properties WHERE id = $1`, [propertyId]);
    }
    if (bankId) {
      await pool.query(`DELETE FROM bank_accounts WHERE id = $1`, [bankId]);
    }
    if (ownerId) {
      await pool.query(`DELETE FROM owners WHERE id = $1`, [ownerId]);
    }
    if (toOwnerId) {
      await pool.query(`DELETE FROM owners WHERE id = $1`, [toOwnerId]);
    }
    if (toClientId) {
      await pool.query(`DELETE FROM clients WHERE id = $1`, [toClientId]);
    }
    if (adminId) {
      await pool.query(`DELETE FROM audit_logs WHERE admin_id = $1`, [adminId]);
      await pool.query(`DELETE FROM admins WHERE id = $1`, [adminId]);
    }
    await pool.end();
  }

  console.log(`\nPhase 23 transfer tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

run().catch((err) => {
  console.error("Transfer test runner failed:", err);
  process.exitCode = 1;
  return pool.end().catch(() => {});
});
