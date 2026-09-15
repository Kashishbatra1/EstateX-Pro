const express = require("express");
const ownerController = require("../controllers/owner.controller");
const { authenticate, requireAdmin } = require("../middleware/auth");
const {
  validateCreateOwner,
  validateUpdateOwner,
  validateVerification,
  validateIdParam,
} = require("../middleware/validateOwner");

const router = express.Router();

router.use(authenticate, requireAdmin);

router.get("/", ownerController.list);
router.post("/", validateCreateOwner, ownerController.create);
router.get("/:id", validateIdParam("id"), ownerController.getById);
router.put("/:id", validateIdParam("id"), validateUpdateOwner, ownerController.update);
router.patch(
  "/:id/verification",
  validateIdParam("id"),
  validateVerification,
  ownerController.verify
);
router.delete("/:id", validateIdParam("id"), ownerController.remove);

module.exports = router;
