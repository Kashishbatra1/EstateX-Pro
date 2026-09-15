const express = require("express");
const bankController = require("../controllers/bank.controller");
const { authenticate, requireAdmin } = require("../middleware/auth");
const {
  validateCreatePaymentMethod,
  validateUpdatePaymentMethod,
  validateIdParam,
} = require("../middleware/validateBank");

const router = express.Router();

router.use(authenticate, requireAdmin);

router.get("/", bankController.listPaymentMethods);
router.post("/", validateCreatePaymentMethod, bankController.createPaymentMethod);
router.get("/:id", validateIdParam("id"), bankController.getPaymentMethod);
router.put("/:id", validateIdParam("id"), validateUpdatePaymentMethod, bankController.updatePaymentMethod);

module.exports = router;
