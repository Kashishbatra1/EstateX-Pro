const express = require("express");
const ctrl = require("../controllers/favoriteCalendar.controller");
const { authenticate, requireAdmin } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate, requireAdmin);

router.get("/", ctrl.listFavorites);
router.post("/", ctrl.addFavorite);
router.delete("/:id", ctrl.removeFavorite);

module.exports = router;
