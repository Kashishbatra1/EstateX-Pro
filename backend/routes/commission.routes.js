const express = require("express");
const commissionController = require("../controllers/commission.controller");
const { authenticate, requireAdmin } = require("../middleware/auth");
const {
  validateCreateCommission,
  validateUpdateCommission,
  validateIdParam,
} = require("../middleware/validateCommission");

const router = express.Router();

router.use(authenticate, requireAdmin);

router.get("/", commissionController.list);
router.post("/", validateCreateCommission, commissionController.create);

router.get("/:id", validateIdParam("id"), commissionController.getById);
router.put(
  "/:id",
  validateIdParam("id"),
  validateUpdateCommission,
  commissionController.update
);
router.delete("/:id", validateIdParam("id"), commissionController.remove);

module.exports = router;
