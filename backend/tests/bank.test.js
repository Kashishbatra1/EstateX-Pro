/**
 * Phase 5 — Bank Accounts & Payment Methods tests (live estatex_pro).
 * Usage: npm run test:banks
 */
const http = require("http");
const pool = require("../config/db");
const app = require("../app");
const { hashPassword } = require("../utils/password");

const stamp = Date.now();
const TEST_EMAIL = `banks.phase5.${stamp}@estatex.test`;
const TEST_PASSWORD = `Bank!${String(stamp).slice(-6)}`;

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
  let bankId = null;
  let bankId2 = null;
  let propertyId = null;
  let ownerId = null;
  let paymentMethodId = null;
  let createdPaymentMethodId = null;

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
    ["Phase 5 Bank Tester", TEST_EMAIL, passwordHash]
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

    // Unauthorized
    const unauth = await request(port, { path: "/api/bank-accounts" });
    assert("Unauthorized bank list returns 401", unauth.status === 401);

    // Payment methods list (seeded)
    const pmList = await request(port, { path: "/api/payment-methods", token });
    assert("List payment methods returns 200", pmList.status === 200);
    assert(
      "Seeded payment methods exist",
      (pmList.json?.data?.items || []).length >= 1
    );
    paymentMethodId = pmList.json?.data?.items?.[0]?.id;

    const pmCreate = await request(port, {
      method: "POST",
      path: "/api/payment-methods",
      token,
      body: { methodName: `Phase5 Method ${stamp}` },
    });
    assert("Create payment method returns 201", pmCreate.status === 201);
    createdPaymentMethodId = pmCreate.json?.data?.paymentMethod?.id;

    const pmInvalid = await request(port, {
      method: "POST",
      path: "/api/payment-methods",
      token,
      body: { methodName: "" },
    });
    assert("Invalid payment method returns 400", pmInvalid.status === 400);

    // Create bank account
    const createBank = await request(port, {
      method: "POST",
      path: "/api/bank-accounts",
      token,
      body: {
        bankName: `Phase5 Bank ${stamp}`,
        accountHolderName: "EstateX Test Holder",
        accountNumber: `P5${stamp}`,
        iban: `PK00TEST${stamp}`,
        branchName: "Main",
        accountDetails: "Phase 5 test account",
      },
    });
    assert("Create bank account returns 201", createBank.status === 201);
    bankId = createBank.json?.data?.bankAccount?.id;
    assert("Created bank account has id", Boolean(bankId));

    const listBanks = await request(port, { path: "/api/bank-accounts", token });
    assert("List bank accounts returns 200", listBanks.status === 200);

    const getBank = await request(port, {
      path: `/api/bank-accounts/${bankId}`,
      token,
    });
    assert("Get bank account by id returns 200", getBank.status === 200);

    const updateBank = await request(port, {
      method: "PUT",
      path: `/api/bank-accounts/${bankId}`,
      token,
      body: { branchName: "Updated Branch" },
    });
    assert("Update bank account returns 200", updateBank.status === 200);
    assert(
      "Update changes branch",
      updateBank.json?.data?.bankAccount?.branchName === "Updated Branch"
    );

    const search = await request(port, {
      path: `/api/bank-accounts?search=Phase5%20Bank%20${stamp}`,
      token,
    });
    assert("Search bank accounts returns 200", search.status === 200);
    assert(
      "Search finds bank account",
      (search.json?.data?.items || []).some((b) => b.id === bankId)
    );

    const invalidBank = await request(port, {
      method: "POST",
      path: "/api/bank-accounts",
      token,
      body: { bankName: "", accountHolderName: "", accountNumber: "" },
    });
    assert("Invalid bank create returns 400", invalidBank.status === 400);

    // Property + owner for listing readiness tests
    const ownerIns = await pool.query(
      `INSERT INTO owners (owner_name, cnic, verification_status, verified_at, verified_by)
       VALUES ($1, $2, 'verified', CURRENT_TIMESTAMP, $3) RETURNING id`,
      [`P5 Owner ${stamp}`, `35202-${String(stamp).slice(-7)}-5`, adminId]
    );
    ownerId = ownerIns.rows[0].id;

    const property = await request(port, {
      method: "POST",
      path: "/api/properties",
      token,
      body: {
        title: `P5 Bank Property ${stamp}`,
        purpose: "sale",
        category: "residential",
        city: "Lahore",
        primaryPaymentMethodId: paymentMethodId,
      },
    });
    propertyId = property.json?.data?.property?.id;
    assert("Draft property created", Boolean(propertyId));

    await request(port, {
      method: "POST",
      path: `/api/properties/${propertyId}/owners`,
      token,
      body: { ownerId, sharePercentage: 100, isPrimary: true },
    });

    // Link bank to property
    const link = await request(port, {
      method: "POST",
      path: `/api/properties/${propertyId}/bank-accounts`,
      token,
      body: { bankAccountId: bankId, isPrimary: true },
    });
    assert("Link bank to property returns 201", link.status === 201);

    const propertyBanks = await request(port, {
      path: `/api/properties/${propertyId}/bank-accounts`,
      token,
    });
    assert("List property banks returns 200", propertyBanks.status === 200);
    assert(
      "Property has linked bank",
      (propertyBanks.json?.data?.bankAccounts || []).length === 1
    );

    // Listing should succeed with owner + bank + payment method
    const available = await request(port, {
      method: "PATCH",
      path: `/api/properties/${propertyId}/status`,
      token,
      body: { status: "available" },
    });
    assert("Property becomes available with bank linked", available.status === 200);

    // Unlink only bank from listed property should fail
    const unlinkListed = await request(port, {
      method: "DELETE",
      path: `/api/properties/${propertyId}/bank-accounts/${bankId}`,
      token,
    });
    assert("Unlink only bank from listed property blocked", unlinkListed.status === 400);

    // Soft-delete bank required by listed property should fail
    const deleteListedBank = await request(port, {
      method: "DELETE",
      path: `/api/bank-accounts/${bankId}`,
      token,
    });
    assert(
      "Soft-delete bank required by listed property blocked",
      deleteListedBank.status === 400
    );

    // Add second bank, then unlink first from listed property (still has a bank)
    const createBank2 = await request(port, {
      method: "POST",
      path: "/api/bank-accounts",
      token,
      body: {
        bankName: `Phase5 Bank B ${stamp}`,
        accountHolderName: "Second Holder",
        accountNumber: `P5B${stamp}`,
      },
    });
    bankId2 = createBank2.json?.data?.bankAccount?.id;
    await request(port, {
      method: "POST",
      path: `/api/properties/${propertyId}/bank-accounts`,
      token,
      body: { bankAccountId: bankId2, isPrimary: false },
    });

    const unlinkOne = await request(port, {
      method: "DELETE",
      path: `/api/properties/${propertyId}/bank-accounts/${bankId}`,
      token,
    });
    assert(
      "Unlink non-last bank from listed property returns 200",
      unlinkOne.status === 200
    );

    // Move to draft and soft-delete remaining linked bank after unlink all / draft
    await pool.query(`UPDATE properties SET status = 'draft' WHERE id = $1`, [propertyId]);
    await request(port, {
      method: "DELETE",
      path: `/api/properties/${propertyId}/bank-accounts/${bankId2}`,
      token,
    });

    const delBank = await request(port, {
      method: "DELETE",
      path: `/api/bank-accounts/${bankId2}`,
      token,
    });
    assert("Soft-delete unlinked bank returns 200", delBank.status === 200);

    const history = await pool.query(
      `SELECT COUNT(*)::INT AS count FROM property_history
       WHERE property_id = $1
         AND (new_value->>'action' IN ('bank_link', 'bank_unlink')
              OR old_value->>'action' = 'bank_unlink')`,
      [propertyId]
    );
    assert("Bank link/unlink recorded in property history", history.rows[0].count >= 1);
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
    if (ownerId) await pool.query(`DELETE FROM owners WHERE id = $1`, [ownerId]);
    if (bankId) await pool.query(`DELETE FROM bank_accounts WHERE id = $1`, [bankId]);
    if (bankId2) await pool.query(`DELETE FROM bank_accounts WHERE id = $1`, [bankId2]);
    if (createdPaymentMethodId) {
      await pool.query(`DELETE FROM payment_methods WHERE id = $1`, [createdPaymentMethodId]);
    }
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
  console.error("Bank test runner failed:", err.message);
  await pool.end().catch(() => {});
  process.exit(1);
});
