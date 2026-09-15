const express = require("express");
const transferController = require("../controllers/transfer.controller");
const { authenticate, requireAdmin } = require("../middleware/auth");
const {
  validateCreateTransfer,
  validateUpdateTransfer,
  validateIdParam,
} = require("../middleware/validateTransfer");

const router = express.Router();

router.use(authenticate, requireAdmin);

router.get("/", transferController.list);
router.post("/", validateCreateTransfer, transferController.create);

router.get("/:id", validateIdParam("id"), transferController.getById);
router.put(
  "/:id",
  validateIdParam("id"),
  validateUpdateTransfer,
  transferController.update
);
router.delete("/:id", validateIdParam("id"), transferController.remove);

module.exports = router;
