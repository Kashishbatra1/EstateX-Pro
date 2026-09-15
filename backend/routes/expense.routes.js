const express = require("express");
const expenseController = require("../controllers/expense.controller");
const { authenticate, requireAdmin } = require("../middleware/auth");
const {
  validateCreateExpense,
  validateUpdateExpense,
  validateApprovalChange,
  validateIdParam,
} = require("../middleware/validateExpense");

const router = express.Router();

router.use(authenticate, requireAdmin);

router.get("/", expenseController.list);
router.post("/", validateCreateExpense, expenseController.create);

router.get("/:id", validateIdParam("id"), expenseController.getById);
router.put(
  "/:id",
  validateIdParam("id"),
  validateUpdateExpense,
  expenseController.update
);
router.patch(
  "/:id/approval",
  validateIdParam("id"),
  validateApprovalChange,
  expenseController.changeApproval
);
router.delete("/:id", validateIdParam("id"), expenseController.remove);

module.exports = router;
