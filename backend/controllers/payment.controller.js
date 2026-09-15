const paymentService = require("../services/payment.service");
const { success } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");

const create = asyncHandler(async (req, res) => {
  const payment = await paymentService.createPayment(req.body, req.auth.adminId);
  return success(res, 201, "Payment recorded", { payment });
});

const list = asyncHandler(async (req, res) => {
  const result = await paymentService.listPayments(req.query);
  return success(res, 200, "Payments retrieved", result);
});

const getById = asyncHandler(async (req, res) => {
  const payment = await paymentService.getPaymentById(req.params.id);
  return success(res, 200, "Payment retrieved", { payment });
});

const update = asyncHandler(async (req, res) => {
  const payment = await paymentService.updatePayment(
    req.params.id,
    req.body,
    req.auth.adminId
  );
  return success(res, 200, "Payment updated", { payment });
});

const reverse = asyncHandler(async (req, res) => {
  const payment = await paymentService.reversePayment(req.params.id, req.auth.adminId);
  return success(res, 200, "Payment reversed and moved to recycle bin", { payment });
});

module.exports = {
  create,
  list,
  getById,
  update,
  reverse,
};
