/**
 * Serve files from uploads/ behind Admin JWT (Authorization header or ?access_token=).
 */
const fs = require("fs");
const path = require("path");
const express = require("express");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { verifyAccessToken } = require("../utils/token");
const authService = require("../services/auth.service");
const { absoluteFromPublicPath } = require("../utils/upload");

const router = express.Router();

function extractToken(req) {
  const header = req.headers.authorization;
  if (header && typeof header === "string") {
    const [scheme, token] = header.split(" ");
    if (scheme && token && scheme.toLowerCase() === "bearer") {
      return token.trim();
    }
  }
  const q = req.query.access_token;
  if (q && String(q).trim()) return String(q).trim();
  return null;
}

router.use(
  asyncHandler(async (req, _res, next) => {
    const token = extractToken(req);
    if (!token) throw new ApiError(401, "Authentication required");
    const decoded = verifyAccessToken(token);
    const adminId = Number(decoded.sub);
    const admin = await authService.findAdminById(adminId);
    if (!admin || !admin.is_active) {
      throw new ApiError(401, "Authentication required");
    }
    req.auth = {
      adminId,
      role: admin.role || decoded.role || "admin",
      token,
    };
    return next();
  })
);

router.get(
  /.+/,
  asyncHandler(async (req, res) => {
    const rel = String(req.path || "").replace(/^\/+/, "");
    if (!rel || rel.includes("..")) {
      throw new ApiError(400, "Invalid file path");
    }
    const publicPath = `/api/uploads/${rel}`;
    const abs = absoluteFromPublicPath(publicPath);
    if (!abs || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
      throw new ApiError(404, "File not found");
    }
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, max-age=3600");
    return res.sendFile(path.resolve(abs));
  })
);

module.exports = router;
