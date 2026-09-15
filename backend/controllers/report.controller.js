const reportService = require("../services/report.service");
const { success } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { normalizeExportFormat } = require("../utils/reportExport");

function sendExport(res, file) {
  res.setHeader("Content-Type", file.contentType);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${file.filename}"`
  );
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).send(file.body);
}

async function handleReport(req, res, reportType, jsonMessage, jsonLoader) {
  const format = normalizeExportFormat(req.query.format);
  if (format === "csv" || format === "pdf") {
    const file = await reportService.exportReport(reportType, req.query);
    return sendExport(res, file);
  }
  if (format) {
    throw new ApiError(400, "Validation failed", [
      { field: "format", message: "format must be csv or pdf" },
    ]);
  }
  const result = await jsonLoader(req.query);
  return success(res, 200, jsonMessage, result);
}

const bookings = asyncHandler(async (req, res) => {
  return handleReport(
    req,
    res,
    "bookings",
    "Booking report retrieved",
    reportService.bookingReport
  );
});

const payments = asyncHandler(async (req, res) => {
  return handleReport(
    req,
    res,
    "payments",
    "Payment report retrieved",
    reportService.paymentReport
  );
});

const expenses = asyncHandler(async (req, res) => {
  return handleReport(
    req,
    res,
    "expenses",
    "Expense report retrieved",
    reportService.expenseReport
  );
});

const properties = asyncHandler(async (req, res) => {
  return handleReport(
    req,
    res,
    "properties",
    "Property report retrieved",
    reportService.propertyReport
  );
});

module.exports = {
  bookings,
  payments,
  expenses,
  properties,
};
