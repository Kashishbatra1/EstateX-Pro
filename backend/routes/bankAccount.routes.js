const express = require("express");
const bankController = require("../controllers/bank.controller");
const { authenticate, requireAdmin } = require("../middleware/auth");
const {
  validateCreateBankAccount,
  validateUpdateBankAccount,
  validateIdParam,
} = require("../middleware/validateBank");

const router = express.Router();

router.use(authenticate, requireAdmin);

router.get("/", bankController.listBankAccounts);
router.post("/", validateCreateBankAccount, bankController.createBankAccount);
router.get("/:id", validateIdParam("id"), bankController.getBankAccount);
router.put("/:id", validateIdParam("id"), validateUpdateBankAccount, bankController.updateBankAccount);
router.delete("/:id", validateIdParam("id"), bankController.deleteBankAccount);

module.exports = router;
