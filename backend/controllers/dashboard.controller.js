const dashboardService = require("../services/dashboard.service");
const { success } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");

const getDashboard = asyncHandler(async (req, res) => {
  const dashboard = await dashboardService.getDashboard();
  return success(res, 200, "Dashboard summary retrieved", { dashboard });
});

module.exports = {
  getDashboard,
};
