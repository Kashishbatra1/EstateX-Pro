const healthService = require("../services/health.service");
const { success } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");

const getRoot = asyncHandler(async (req, res) => {
  return success(res, 200, "EstateX Pro Backend is running", {
    service: "estatex-pro-api",
    version: "1.0.0",
  });
});

const getHealth = asyncHandler(async (req, res) => {
  return success(res, 200, "OK", {
    status: "up",
    timestamp: new Date().toISOString(),
  });
});

const getDbHealth = asyncHandler(async (req, res) => {
  const db = await healthService.checkDatabase();
  return success(res, 200, "Database connection successful", db);
});

module.exports = {
  getRoot,
  getHealth,
  getDbHealth,
};
