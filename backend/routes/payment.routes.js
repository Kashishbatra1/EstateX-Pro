const express = require("express");
const paymentController = require("../controllers/payment.controller");
const { authenticate, requireAdmin } = require("../middleware/auth");
const {
  validateCreatePayment,
  validateUpdatePayment,
  validateIdParam,
} = require("../middleware/validatePayment");

const router = express.Router();

router.use(authenticate, requireAdmin);

router.get("/", paymentController.list);
router.post("/", validateCreatePayment, paymentController.create);

router.get("/:id", validateIdParam("id"), paymentController.getById);
router.put(
  "/:id",
  validateIdParam("id"),
  validateUpdatePayment,
  paymentController.update
);
router.delete("/:id", validateIdParam("id"), paymentController.reverse);

module.exports = router;
