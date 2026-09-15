const express = require("express");
const ctrl = require("../controllers/recycleSearch.controller");
const { authenticate, requireAdmin } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate, requireAdmin);

router.get("/", ctrl.search);

module.exports = router;
