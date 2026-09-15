const bookingService = require("../services/booking.service");
const { success } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");

const create = asyncHandler(async (req, res) => {
  const booking = await bookingService.createBooking(req.body, req.auth.adminId);
  return success(res, 201, "Booking created", { booking });
});

const list = asyncHandler(async (req, res) => {
  const result = await bookingService.listBookings(req.query);
  return success(res, 200, "Bookings retrieved", result);
});

const getById = asyncHandler(async (req, res) => {
  const booking = await bookingService.getBookingById(req.params.id);
  return success(res, 200, "Booking retrieved", { booking });
});

const update = asyncHandler(async (req, res) => {
  const booking = await bookingService.updateBooking(
    req.params.id,
    req.body,
    req.auth.adminId
  );
  return success(res, 200, "Booking updated", { booking });
});

const changeStatus = asyncHandler(async (req, res) => {
  const booking = await bookingService.changeBookingStatus(
    req.params.id,
    req.body,
    req.auth.adminId
  );
  return success(res, 200, "Booking status updated", { booking });
});

const cancel = asyncHandler(async (req, res) => {
  const booking = await bookingService.cancelBooking(
    req.params.id,
    req.body,
    req.auth.adminId
  );
  return success(res, 200, "Booking cancelled", { booking });
});

const complete = asyncHandler(async (req, res) => {
  const booking = await bookingService.completeBooking(req.params.id, req.auth.adminId);
  return success(res, 200, "Booking completed", { booking });
});

const remove = asyncHandler(async (req, res) => {
  const booking = await bookingService.softDeleteBooking(req.params.id, req.auth.adminId);
  return success(res, 200, "Booking moved to recycle bin", { booking });
});

module.exports = {
  create,
  list,
  getById,
  update,
  changeStatus,
  cancel,
  complete,
  remove,
};
