const express = require("express");
const reportController = require("../controllers/report.controller");
const { authenticate, requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.use(authenticate, requireAdmin);

router.get("/bookings", reportController.bookings);
router.get("/payments", reportController.payments);
router.get("/expenses", reportController.expenses);
router.get("/properties", reportController.properties);

module.exports = router;
