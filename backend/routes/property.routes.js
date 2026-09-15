const express = require("express");
const propertyController = require("../controllers/property.controller");
const { authenticate, requireAdmin } = require("../middleware/auth");
const {
  validateCreateProperty,
  validateUpdateProperty,
  validateStatusChange,
  validateIdParam,
} = require("../middleware/validateProperty");

const router = express.Router();

router.use(authenticate, requireAdmin);

router.get("/", propertyController.list);
router.post("/", validateCreateProperty, propertyController.create);
router.get("/:id", validateIdParam, propertyController.getById);
router.put("/:id", validateIdParam, validateUpdateProperty, propertyController.update);
router.patch(
  "/:id/status",
  validateIdParam,
  validateStatusChange,
  propertyController.changeStatus
);
router.delete("/:id", validateIdParam, propertyController.remove);

module.exports = router;
