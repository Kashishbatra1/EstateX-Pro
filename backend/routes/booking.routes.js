const express = require("express");
const bookingController = require("../controllers/booking.controller");
const { authenticate, requireAdmin } = require("../middleware/auth");
const {
  validateCreateBooking,
  validateUpdateBooking,
  validateStatusChange,
  validateCancelBooking,
  validateIdParam,
} = require("../middleware/validateBooking");

const router = express.Router();

router.use(authenticate, requireAdmin);

router.get("/", bookingController.list);
router.post("/", validateCreateBooking, bookingController.create);

router.get("/:id", validateIdParam("id"), bookingController.getById);
router.put(
  "/:id",
  validateIdParam("id"),
  validateUpdateBooking,
  bookingController.update
);
router.patch(
  "/:id/status",
  validateIdParam("id"),
  validateStatusChange,
  bookingController.changeStatus
);
router.post(
  "/:id/cancel",
  validateIdParam("id"),
  validateCancelBooking,
  bookingController.cancel
);
router.post(
  "/:id/complete",
  validateIdParam("id"),
  bookingController.complete
);
router.delete("/:id", validateIdParam("id"), bookingController.remove);

module.exports = router;
