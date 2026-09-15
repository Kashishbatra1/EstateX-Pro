const express = require("express");
const dashboardController = require("../controllers/dashboard.controller");
const { authenticate, requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.use(authenticate, requireAdmin);
router.get("/", dashboardController.getDashboard);

module.exports = router;
