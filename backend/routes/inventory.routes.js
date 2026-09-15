const express = require("express");
const inventoryController = require("../controllers/inventory.controller");
const { authenticate, requireAdmin } = require("../middleware/auth");
const {
  validateIdParam,
  validateCreateInventory,
  validateUpdateInventory,
  validateAssign,
  validateAdjust,
} = require("../middleware/validateInventory");

const router = express.Router();

router.use(authenticate, requireAdmin);

router.get("/", inventoryController.list);
router.post("/", validateCreateInventory, inventoryController.create);

router.get("/:id", validateIdParam("id"), inventoryController.getById);
router.put(
  "/:id",
  validateIdParam("id"),
  validateUpdateInventory,
  inventoryController.update
);
router.delete("/:id", validateIdParam("id"), inventoryController.remove);

router.post(
  "/:id/assign",
  validateIdParam("id"),
  validateAssign,
  inventoryController.assign
);
router.post(
  "/:id/return",
  validateIdParam("id"),
  inventoryController.returnItem
);
router.post(
  "/:id/adjust",
  validateIdParam("id"),
  validateAdjust,
  inventoryController.adjust
);
router.get(
  "/:id/transactions",
  validateIdParam("id"),
  inventoryController.listTransactions
);

module.exports = router;
