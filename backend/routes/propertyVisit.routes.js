const express = require("express");
const ctrl = require("../controllers/propertyVisit.controller");
const { authenticate, requireAdmin } = require("../middleware/auth");

const router = express.Router({ mergeParams: true });
router.use(authenticate, requireAdmin);

router.get("/", ctrl.list);
router.post("/", ctrl.create);
router.put("/:visitId", ctrl.update);
router.delete("/:visitId", ctrl.remove);

module.exports = router;
