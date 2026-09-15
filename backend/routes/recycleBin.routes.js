const express = require("express");
const ctrl = require("../controllers/recycleSearch.controller");
const { authenticate, requireAdmin } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate, requireAdmin);

router.get("/", ctrl.listRecycleBin);
router.post("/restore", ctrl.restore);
router.post("/purge", ctrl.purge);

module.exports = router;
