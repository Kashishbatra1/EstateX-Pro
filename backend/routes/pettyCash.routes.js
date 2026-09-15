const express = require("express");
const pettyCashController = require("../controllers/pettyCash.controller");
const { authenticate, requireAdmin } = require("../middleware/auth");
const {
  validateIdParam,
  validateCreateAccount,
  validateUpdateAccount,
  validateTxn,
  validateReconciliation,
} = require("../middleware/validatePettyCash");

const router = express.Router();

router.use(authenticate, requireAdmin);

router.get("/", pettyCashController.list);
router.post("/", validateCreateAccount, pettyCashController.create);

router.get("/:id", validateIdParam("id"), pettyCashController.getById);
router.put(
  "/:id",
  validateIdParam("id"),
  validateUpdateAccount,
  pettyCashController.update
);
router.delete("/:id", validateIdParam("id"), pettyCashController.remove);

router.get("/:id/transactions", validateIdParam("id"), pettyCashController.listTxns);
router.post(
  "/:id/transactions",
  validateIdParam("id"),
  validateTxn,
  pettyCashController.createTxn
);

router.get(
  "/:id/reconciliations",
  validateIdParam("id"),
  pettyCashController.listRecons
);
router.post(
  "/:id/reconciliations",
  validateIdParam("id"),
  validateReconciliation,
  pettyCashController.createRecon
);

module.exports = router;
