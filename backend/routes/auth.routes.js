const express = require("express");
const authController = require("../controllers/auth.controller");
const { validateLogin, validateRegister } = require("../middleware/validate");
const { authenticate, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// Public
router.post("/register", validateRegister, authController.register);
router.post("/login", validateLogin, authController.login);

// Protected (Admin)
router.post("/logout", authenticate, requireAdmin, authController.logout);
router.get("/me", authenticate, requireAdmin, authController.me);
router.get("/admin-ping", authenticate, requireAdmin, authController.adminPing);

module.exports = router;
