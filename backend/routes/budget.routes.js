const express = require("express");
const budgetController = require("../controllers/budget.controller");
const { authenticate, requireAdmin } = require("../middleware/auth");
const {
  validateIdParam,
  validateCreateBudget,
  validateUpdateBudget,
  validateBudgetLine,
  validateUpdateBudgetLine,
} = require("../middleware/validateBudget");

const router = express.Router();

router.use(authenticate, requireAdmin);

router.get("/", budgetController.list);
router.post("/", validateCreateBudget, budgetController.create);
router.post("/alerts/process", budgetController.processAlerts);

router.get("/:id", validateIdParam("id"), budgetController.getById);
router.put(
  "/:id",
  validateIdParam("id"),
  validateUpdateBudget,
  budgetController.update
);
router.delete("/:id", validateIdParam("id"), budgetController.remove);

router.post(
  "/:id/lines",
  validateIdParam("id"),
  validateBudgetLine,
  budgetController.addLine
);
router.put(
  "/:id/lines/:lineId",
  validateIdParam("id"),
  validateIdParam("lineId"),
  validateUpdateBudgetLine,
  budgetController.updateLine
);
router.delete(
  "/:id/lines/:lineId",
  validateIdParam("id"),
  validateIdParam("lineId"),
  budgetController.removeLine
);

module.exports = router;
