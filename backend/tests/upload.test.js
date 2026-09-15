/**
 * Phase 42 — Real file upload tests against live estatex_pro.
 * Usage: npm run test:uploads
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const pool = require("../config/db");
const app = require("../app");
const { hashPassword } = require("../utils/password");
const {
  UPLOADS_ROOT,
  MAX_DOCUMENT_BYTES,
  absoluteFromPublicPath,
} = require("../utils/upload");

const stamp = Date.now();
const TEST_EMAIL = `uploads.phase42.${stamp}@estatex.test`;
const TEST_PASSWORD = `Up!${String(stamp).slice(-6)}`;

/** Minimal 1x1 PNG */
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

/** Minimal PDF bytes */
const PDF_MIN = Buffer.from(
  "%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n",
  "utf8"
);

function request(port, { method = "GET", path: reqPath, body, token } = {}) {
  const payload = body ? JSON.stringify(body) : null;
  const headers = { Accept: "application/json" };
  if (payload) {
    headers["Content-Type"] = "application/json";
    headers["Content-Length"] = Buffer.byteLength(payload);
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: "127.0.0.1", port, path: reqPath, method, headers },
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
          resolve({ status: res.statusCode, body: data, json, headers: res.headers });
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function multipartUpload(
  port,
  {
    method = "POST",
    path: reqPath,
    token,
    fields = {},
    file,
  } = {}
) {
  const boundary = `----EstateXBoundary${stamp}${Math.random().toString(16).slice(2)}`;
  const parts = [];

  for (const [name, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
        "utf8"
      )
    );
  }

  if (file) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.filename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`,
        "utf8"
      )
    );
    parts.push(Buffer.isBuffer(file.buffer) ? file.buffer : Buffer.from(file.buffer));
    parts.push(Buffer.from("\r\n", "utf8"));
  }

  parts.push(Buffer.from(`--${boundary}--\r\n`, "utf8"));
  const payload = Buffer.concat(parts);

  const headers = {
    Accept: "application/json",
    "Content-Type": `multipart/form-data; boundary=${boundary}`,
    "Content-Length": payload.length,
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: "127.0.0.1", port, path: reqPath, method, headers },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const raw = Buffer.concat(chunks);
          const text = raw.toString("utf8");
          let json = null;
          try {
            json = JSON.parse(text);
          } catch {
            json = null;
          }
          resolve({
            status: res.statusCode,
            body: text,
            json,
            raw,
            headers: res.headers,
          });
        });
      }
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function safeRm(dir) {
  try {
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  } catch {
    /* ignore cleanup errors */
  }
}

async function run() {
  let passed = 0;
  let failed = 0;
  let adminId = null;
  let propertyId = null;
  let clientId = null;
  let vendorId = null;
  let token = null;
  const uploadedPaths = [];

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
    ["Phase 42 Upload Tester", TEST_EMAIL, passwordHash]
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

    const createProp = await request(port, {
      method: "POST",
      path: "/api/properties",
      token,
      body: {
        title: `Phase42 Upload House ${stamp}`,
        propertyType: "House",
        purpose: "sale",
        category: "residential",
        city: "Lahore",
        askingPrice: 8500000,
      },
    });
    assert("Create property returns 201", createProp.status === 201);
    propertyId = createProp.json?.data?.property?.id;
    assert("Property id present", Boolean(propertyId));

    // 1) Unauthorized upload rejected
    const unauth = await multipartUpload(port, {
      path: `/api/properties/${propertyId}/documents/upload`,
      fields: { documentType: "registry" },
      file: {
        filename: "title.pdf",
        contentType: "application/pdf",
        buffer: PDF_MIN,
      },
    });
    assert("Unauthorized document upload returns 401", unauth.status === 401);

    // 2) Missing file
    const missing = await multipartUpload(port, {
      path: `/api/properties/${propertyId}/documents/upload`,
      token,
      fields: { documentType: "registry" },
    });
    assert("Missing file returns 400", missing.status === 400);

    // 3) Unsupported type
    const badType = await multipartUpload(port, {
      path: `/api/properties/${propertyId}/documents/upload`,
      token,
      fields: { documentType: "other" },
      file: {
        filename: "malware.exe",
        contentType: "application/x-msdownload",
        buffer: Buffer.from("MZ"),
      },
    });
    assert("Unsupported file type rejected", badType.status === 400);

    // 4) Oversized document
    const oversized = await multipartUpload(port, {
      path: `/api/properties/${propertyId}/documents/upload`,
      token,
      fields: { documentType: "other" },
      file: {
        filename: "huge.pdf",
        contentType: "application/pdf",
        buffer: Buffer.alloc(MAX_DOCUMENT_BYTES + 1024, 0x25),
      },
    });
    assert("Oversized file rejected", oversized.status === 400);

    // 5) Authenticated PDF upload
    const docUp = await multipartUpload(port, {
      path: `/api/properties/${propertyId}/documents/upload`,
      token,
      fields: {
        documentType: "registry",
        documentName: "Uploaded Registry",
        notes: "Phase 42 binary upload",
      },
      file: {
        filename: `registry-${stamp}.pdf`,
        contentType: "application/pdf",
        buffer: PDF_MIN,
      },
    });
    assert("Authenticated document upload returns 201", docUp.status === 201);
    const doc = docUp.json?.data?.document;
    assert("Document metadata persisted", Boolean(doc?.id));
    assert(
      "Document file_path is local upload URL",
      typeof doc?.filePath === "string" && doc.filePath.startsWith("/api/uploads/")
    );
    assert(
      "Document fileName preserved",
      doc?.fileName === `registry-${stamp}.pdf`
    );
    assert("Document mimeType is pdf", doc?.mimeType === "application/pdf");
    uploadedPaths.push(doc?.filePath);

    const absDoc = absoluteFromPublicPath(doc.filePath);
    assert("Document file exists on disk", Boolean(absDoc && fs.existsSync(absDoc)));

    // 6) Existing path/URL registration still works
    const pathReg = await request(port, {
      method: "POST",
      path: `/api/properties/${propertyId}/documents`,
      token,
      body: {
        documentType: "agreement",
        filePath: `/uploads/docs/legacy-${stamp}.pdf`,
        fileName: `legacy-${stamp}.pdf`,
      },
    });
    assert("Path/URL document registration still works", pathReg.status === 201);

    // 7) Media upload
    const mediaUp = await multipartUpload(port, {
      path: `/api/properties/${propertyId}/media/upload`,
      token,
      fields: {
        mediaType: "image",
        caption: "Phase 42 cover",
        isCover: "true",
        sortOrder: "1",
      },
      file: {
        filename: `cover-${stamp}.png`,
        contentType: "image/png",
        buffer: PNG_1X1,
      },
    });
    assert("Authenticated media upload returns 201", mediaUp.status === 201);
    const media = mediaUp.json?.data?.media;
    assert("Media metadata persisted", Boolean(media?.id));
    assert(
      "Media file_path is local upload URL",
      typeof media?.filePath === "string" && media.filePath.startsWith("/api/uploads/")
    );
    uploadedPaths.push(media?.filePath);

    // 8) Retrieve uploaded media via serve endpoint
    const serveUnauth = await request(port, {
      path: media.filePath,
    });
    assert("Serve without auth returns 401", serveUnauth.status === 401);

    const serveAuth = await new Promise((resolve, reject) => {
      const req = http.request(
        {
          host: "127.0.0.1",
          port,
          path: media.filePath,
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "*/*",
          },
        },
        (res) => {
          const chunks = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () =>
            resolve({
              status: res.statusCode,
              raw: Buffer.concat(chunks),
              headers: res.headers,
            })
          );
        }
      );
      req.on("error", reject);
      req.end();
    });
    assert("Serve uploaded media with auth returns 200", serveAuth.status === 200);
    assert(
      "Served media bytes match upload",
      serveAuth.raw.equals(PNG_1X1)
    );

    const serveQuery = await new Promise((resolve, reject) => {
      const q = `${media.filePath}?access_token=${encodeURIComponent(token)}`;
      const req = http.request(
        {
          host: "127.0.0.1",
          port,
          path: q,
          method: "GET",
          headers: { Accept: "*/*" },
        },
        (res) => {
          const chunks = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () =>
            resolve({ status: res.statusCode, raw: Buffer.concat(chunks) })
          );
        }
      );
      req.on("error", reject);
      req.end();
    });
    assert(
      "Serve with access_token query returns 200",
      serveQuery.status === 200
    );

    // Video binary upload blocked
    const videoUp = await multipartUpload(port, {
      path: `/api/properties/${propertyId}/media/upload`,
      token,
      fields: { mediaType: "video" },
      file: {
        filename: "clip.png",
        contentType: "image/png",
        buffer: PNG_1X1,
      },
    });
    assert("Video binary upload rejected", videoUp.status === 400);

    // Path/URL media still works
    const mediaPath = await request(port, {
      method: "POST",
      path: `/api/properties/${propertyId}/media`,
      token,
      body: {
        mediaType: "video",
        filePath: `https://example.com/videos/clip-${stamp}.mp4`,
        fileName: `clip-${stamp}.mp4`,
      },
    });
    assert("Path/URL media registration still works", mediaPath.status === 201);

    // Client KYC upload
    const createClient = await request(port, {
      method: "POST",
      path: "/api/clients",
      token,
      body: {
        clientName: `Phase42 Client ${stamp}`,
        phone: "03119998877",
        clientType: "buyer",
      },
    });
    assert("Create client returns 201", createClient.status === 201);
    clientId = createClient.json?.data?.client?.id;

    const kycUp = await multipartUpload(port, {
      path: `/api/clients/${clientId}/kyc-documents/upload`,
      token,
      fields: { documentType: "CNIC" },
      file: {
        filename: `cnic-${stamp}.pdf`,
        contentType: "application/pdf",
        buffer: PDF_MIN,
      },
    });
    assert("KYC upload returns 201", kycUp.status === 201);
    assert(
      "KYC file_path stored",
      kycUp.json?.data?.document?.filePath?.startsWith("/api/uploads/")
    );
    uploadedPaths.push(kycUp.json?.data?.document?.filePath);

    // Vendor document upload
    const createVendor = await request(port, {
      method: "POST",
      path: "/api/vendors",
      token,
      body: {
        vendorName: `Phase42 Vendor ${stamp}`,
        phone: "03001112233",
      },
    });
    assert("Create vendor returns 201", createVendor.status === 201);
    vendorId = createVendor.json?.data?.vendor?.id;

    const vendUp = await multipartUpload(port, {
      path: `/api/vendors/${vendorId}/documents/upload`,
      token,
      fields: { documentName: "Contract scan" },
      file: {
        filename: `contract-${stamp}.pdf`,
        contentType: "application/pdf",
        buffer: PDF_MIN,
      },
    });
    assert("Vendor document upload returns 201", vendUp.status === 201);
    assert(
      "Vendor file_path stored",
      vendUp.json?.data?.document?.filePath?.startsWith("/api/uploads/")
    );
    uploadedPaths.push(vendUp.json?.data?.document?.filePath);

    // List APIs still work
    const listDocs = await request(port, {
      path: `/api/properties/${propertyId}/documents`,
      token,
    });
    assert("List documents still returns 200", listDocs.status === 200);
    assert(
      "List includes uploaded + path docs",
      (listDocs.json?.data?.items || []).length >= 2
    );

    const listMedia = await request(port, {
      path: `/api/properties/${propertyId}/media`,
      token,
    });
    assert("List media still returns 200", listMedia.status === 200);
    assert(
      "List includes uploaded + path media",
      (listMedia.json?.data?.items || []).length >= 2
    );
  } catch (err) {
    console.error("Upload test crash:", err);
    failed += 1;
  } finally {
    server.close();

    if (propertyId) {
      safeRm(path.join(UPLOADS_ROOT, "properties", String(propertyId)));
      try {
        await pool.query(`DELETE FROM property_documents WHERE property_id = $1`, [
          propertyId,
        ]);
        await pool.query(`DELETE FROM property_media WHERE property_id = $1`, [
          propertyId,
        ]);
        await pool.query(`DELETE FROM property_history WHERE property_id = $1`, [
          propertyId,
        ]);
        await pool.query(`DELETE FROM properties WHERE id = $1`, [propertyId]);
      } catch (e) {
        console.error("Property cleanup:", e.message);
      }
    }
    if (clientId) {
      safeRm(path.join(UPLOADS_ROOT, "clients", String(clientId)));
      try {
        await pool.query(`DELETE FROM client_kyc_documents WHERE client_id = $1`, [
          clientId,
        ]);
        await pool.query(`DELETE FROM clients WHERE id = $1`, [clientId]);
      } catch (e) {
        console.error("Client cleanup:", e.message);
      }
    }
    if (vendorId) {
      safeRm(path.join(UPLOADS_ROOT, "vendors", String(vendorId)));
      try {
        await pool.query(`DELETE FROM vendor_documents WHERE vendor_id = $1`, [
          vendorId,
        ]);
        await pool.query(`DELETE FROM vendors WHERE id = $1`, [vendorId]);
      } catch (e) {
        console.error("Vendor cleanup:", e.message);
      }
    }
    if (adminId) {
      try {
        await pool.query(`DELETE FROM audit_logs WHERE admin_id = $1`, [adminId]);
        await pool.query(`DELETE FROM admins WHERE id = $1`, [adminId]);
      } catch (e) {
        console.error("Admin cleanup:", e.message);
      }
    }

    await pool.end().catch(() => {});
  }

  console.log(`\nPhase 42 upload tests: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
