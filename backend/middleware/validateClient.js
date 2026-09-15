/**
 * Validation for Client / CRM endpoints.
 */
const ApiError = require("../utils/ApiError");
const {
  CLIENT_TYPES,
  WHATSAPP_SMS_PREFS,
  COMMUNICATION_TYPES,
} = require("../utils/clientMapper");

function pushError(errors, field, message) {
  errors.push({ field, message });
}

function isPresent(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function validateBudget(body, errors) {
  const hasMin = body.budgetMin !== undefined && body.budgetMin !== null && body.budgetMin !== "";
  const hasMax = body.budgetMax !== undefined && body.budgetMax !== null && body.budgetMax !== "";

  if (hasMin) {
    const min = Number(body.budgetMin);
    if (Number.isNaN(min) || min < 0) {
      pushError(errors, "budgetMin", "Budget min must be a non-negative number");
    }
  }
  if (hasMax) {
    const max = Number(body.budgetMax);
    if (Number.isNaN(max) || max < 0) {
      pushError(errors, "budgetMax", "Budget max must be a non-negative number");
    }
  }
  if (hasMin && hasMax && Number(body.budgetMin) > Number(body.budgetMax)) {
    pushError(errors, "budgetMax", "Budget max must be greater than or equal to budget min");
  }
}

function validateCreateClient(req, res, next) {
  const body = req.body || {};
  const errors = [];

  if (!isPresent(body.clientName)) {
    pushError(errors, "clientName", "Client name is required");
  } else if (String(body.clientName).trim().length > 150) {
    pushError(errors, "clientName", "Client name must be at most 150 characters");
  }

  if (body.clientType !== undefined && body.clientType !== null && body.clientType !== "") {
    if (!CLIENT_TYPES.includes(String(body.clientType).toLowerCase())) {
      pushError(errors, "clientType", `Client type must be one of: ${CLIENT_TYPES.join(", ")}`);
    }
  }

  if (body.email && String(body.email).trim() !== "") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body.email).trim())) {
      pushError(errors, "email", "Email format is invalid");
    }
  }

  if (body.cnic !== undefined && body.cnic !== null && String(body.cnic).trim().length > 20) {
    pushError(errors, "cnic", "CNIC must be at most 20 characters");
  }

  if (
    body.whatsappSmsPreference !== undefined &&
    body.whatsappSmsPreference !== null &&
    body.whatsappSmsPreference !== ""
  ) {
    if (!WHATSAPP_SMS_PREFS.includes(String(body.whatsappSmsPreference).toLowerCase())) {
      pushError(
        errors,
        "whatsappSmsPreference",
        `Preference must be one of: ${WHATSAPP_SMS_PREFS.join(", ")}`
      );
    }
  }

  if (
    body.clientRating !== undefined &&
    body.clientRating !== null &&
    body.clientRating !== ""
  ) {
    const rating = Number(body.clientRating);
    if (Number.isNaN(rating) || rating < 0 || rating > 5) {
      pushError(errors, "clientRating", "Client rating must be between 0 and 5");
    }
  }

  validateBudget(body, errors);

  if (errors.length) {
    return next(new ApiError(400, "Validation failed", errors));
  }

  req.body.clientName = String(body.clientName).trim();
  if (body.clientType) req.body.clientType = String(body.clientType).toLowerCase();
  if (body.email) req.body.email = String(body.email).trim().toLowerCase();
  if (body.whatsappSmsPreference) {
    req.body.whatsappSmsPreference = String(body.whatsappSmsPreference).toLowerCase();
  }
  if (body.cnic !== undefined && body.cnic !== null && String(body.cnic).trim() === "") {
    req.body.cnic = null;
  }
  return next();
}

function validateUpdateClient(req, res, next) {
  const body = req.body || {};
  const errors = [];

  if (body.clientName !== undefined && !isPresent(body.clientName)) {
    pushError(errors, "clientName", "Client name cannot be empty");
  }

  if (body.clientType !== undefined && body.clientType !== null && body.clientType !== "") {
    if (!CLIENT_TYPES.includes(String(body.clientType).toLowerCase())) {
      pushError(errors, "clientType", `Client type must be one of: ${CLIENT_TYPES.join(", ")}`);
    }
  }

  if (body.email && String(body.email).trim() !== "") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body.email).trim())) {
      pushError(errors, "email", "Email format is invalid");
    }
  }

  if (
    body.whatsappSmsPreference !== undefined &&
    body.whatsappSmsPreference !== null &&
    body.whatsappSmsPreference !== ""
  ) {
    if (!WHATSAPP_SMS_PREFS.includes(String(body.whatsappSmsPreference).toLowerCase())) {
      pushError(
        errors,
        "whatsappSmsPreference",
        `Preference must be one of: ${WHATSAPP_SMS_PREFS.join(", ")}`
      );
    }
  }

  if (
    body.clientRating !== undefined &&
    body.clientRating !== null &&
    body.clientRating !== ""
  ) {
    const rating = Number(body.clientRating);
    if (Number.isNaN(rating) || rating < 0 || rating > 5) {
      pushError(errors, "clientRating", "Client rating must be between 0 and 5");
    }
  }

  validateBudget(body, errors);

  if (errors.length) {
    return next(new ApiError(400, "Validation failed", errors));
  }

  if (body.clientName !== undefined) req.body.clientName = String(body.clientName).trim();
  if (body.clientType) req.body.clientType = String(body.clientType).toLowerCase();
  if (body.email) req.body.email = String(body.email).trim().toLowerCase();
  if (body.whatsappSmsPreference) {
    req.body.whatsappSmsPreference = String(body.whatsappSmsPreference).toLowerCase();
  }
  if (body.cnic !== undefined && body.cnic !== null && String(body.cnic).trim() === "") {
    req.body.cnic = null;
  }
  return next();
}

function validateCommunication(req, res, next) {
  const body = req.body || {};
  const errors = [];

  if (body.communicationType !== undefined && body.communicationType !== null) {
    if (!COMMUNICATION_TYPES.includes(String(body.communicationType).toLowerCase())) {
      pushError(
        errors,
        "communicationType",
        `Type must be one of: ${COMMUNICATION_TYPES.join(", ")}`
      );
    }
  }

  if (!isPresent(body.notes) && !isPresent(body.subject)) {
    pushError(errors, "notes", "Provide subject and/or notes for the communication log");
  }

  if (errors.length) {
    return next(new ApiError(400, "Validation failed", errors));
  }

  if (body.communicationType) {
    req.body.communicationType = String(body.communicationType).toLowerCase();
  } else {
    req.body.communicationType = "note";
  }
  return next();
}

function validateKycDocument(req, res, next) {
  const body = req.body || {};
  const errors = [];

  if (!isPresent(body.documentType)) {
    pushError(errors, "documentType", "Document type is required");
  }
  if (!isPresent(body.filePath)) {
    pushError(errors, "filePath", "File path is required");
  }

  if (errors.length) {
    return next(new ApiError(400, "Validation failed", errors));
  }

  req.body.documentType = String(body.documentType).trim();
  req.body.filePath = String(body.filePath).trim();
  return next();
}

function validateFollowUp(req, res, next) {
  const body = req.body || {};
  if (body.nextFollowUpDate === undefined) {
    return next(new ApiError(400, "Validation failed", [
      { field: "nextFollowUpDate", message: "Next follow-up date is required (use null to clear)" },
    ]));
  }
  if (body.nextFollowUpDate !== null && body.nextFollowUpDate !== "") {
    const d = new Date(body.nextFollowUpDate);
    if (Number.isNaN(d.getTime())) {
      return next(new ApiError(400, "Validation failed", [
        { field: "nextFollowUpDate", message: "Next follow-up date must be a valid date" },
      ]));
    }
  } else {
    req.body.nextFollowUpDate = null;
  }
  return next();
}

function validateIdParam(paramName = "id") {
  return (req, res, next) => {
    const id = Number(req.params[paramName]);
    if (!Number.isInteger(id) || id <= 0) {
      return next(new ApiError(400, `Invalid ${paramName}`));
    }
    req.params[paramName] = id;
    return next();
  };
}

module.exports = {
  validateCreateClient,
  validateUpdateClient,
  validateCommunication,
  validateKycDocument,
  validateFollowUp,
  validateIdParam,
};
