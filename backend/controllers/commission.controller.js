const commissionService = require("../services/commission.service");
const { success } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");

const create = asyncHandler(async (req, res) => {
  const commission = await commissionService.createCommission(
    req.body,
    req.auth.adminId
  );
  return success(res, 201, "Commission created", { commission });
});

const list = asyncHandler(async (req, res) => {
  const result = await commissionService.listCommissions(req.query);
  return success(res, 200, "Commissions retrieved", result);
});

const getById = asyncHandler(async (req, res) => {
  const commission = await commissionService.getCommissionById(req.params.id);
  return success(res, 200, "Commission retrieved", { commission });
});

const update = asyncHandler(async (req, res) => {
  const commission = await commissionService.updateCommission(
    req.params.id,
    req.body,
    req.auth.adminId
  );
  return success(res, 200, "Commission updated", { commission });
});

const remove = asyncHandler(async (req, res) => {
  const commission = await commissionService.softDeleteCommission(
    req.params.id,
    req.auth.adminId
  );
  return success(res, 200, "Commission moved to recycle bin", { commission });
});

module.exports = {
  create,
  list,
  getById,
  update,
  remove,
};
