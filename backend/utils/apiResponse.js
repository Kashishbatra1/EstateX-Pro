/**
 * Standard API response helpers.
 */
function success(res, statusCode, message, data = null) {
  const body = { success: true, message };
  if (data !== null) body.data = data;
  return res.status(statusCode).json(body);
}

function fail(res, statusCode, message, details = null) {
  const body = { success: false, message };
  if (details !== null) body.details = details;
  return res.status(statusCode).json(body);
}

module.exports = { success, fail };
