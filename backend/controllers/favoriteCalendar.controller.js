const favoriteService = require("../services/favorite.service");
const calendarService = require("../services/calendar.service");
const { success } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");

const listFavorites = asyncHandler(async (req, res) => {
  const result = await favoriteService.listFavorites(req.auth.adminId, req.query);
  return success(res, 200, "Favorites retrieved", result);
});

const addFavorite = asyncHandler(async (req, res) => {
  const favorite = await favoriteService.addFavorite(req.auth.adminId, req.body);
  return success(res, 201, "Added to favorites", { favorite });
});

const removeFavorite = asyncHandler(async (req, res) => {
  const result = await favoriteService.removeFavorite(
    req.auth.adminId,
    Number(req.params.id)
  );
  return success(res, 200, "Favorite removed", result);
});

const calendar = asyncHandler(async (req, res) => {
  const result = await calendarService.getCalendarEvents(req.query);
  return success(res, 200, "Calendar events retrieved", result);
});

module.exports = {
  listFavorites,
  addFavorite,
  removeFavorite,
  calendar,
};
