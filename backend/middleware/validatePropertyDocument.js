/**
 * Validation for property documents & media (path/URL registration).
 * Blocks incomplete submissions — filePath and type are required.
 */
const ApiError = require("../utils/ApiError");
const {
  DOCUMENT_TYPES,
  MEDIA_TYPES,
} = require("../utils/propertyDocumentMapper");

function pushError(errors, field, message) {
  errors.push({ field, message });
}

function isPresent(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
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

function validateCreateDocument(req, res, next) {
  const body = req.body || {};
  const errors = [];

  if (!isPresent(body.documentType)) {
    pushError(errors, "documentType", "Document type is required");
  } else if (!DOCUMENT_TYPES.includes(String(body.documentType).toLowerCase())) {
    pushError(
      errors,
      "documentType",
      `Must be one of: ${DOCUMENT_TYPES.join(", ")}`
    );
  }

  if (!isPresent(body.filePath)) {
    pushError(errors, "filePath", "File path or URL is required");
  } else if (String(body.filePath).trim().length > 500) {
    pushError(errors, "filePath", "File path must be at most 500 characters");
  }

  if (body.documentName && String(body.documentName).trim().length > 200) {
    pushError(errors, "documentName", "Document name must be at most 200 characters");
  }
  if (body.fileName && String(body.fileName).trim().length > 255) {
    pushError(errors, "fileName", "File name must be at most 255 characters");
  }
  if (body.mimeType && String(body.mimeType).trim().length > 100) {
    pushError(errors, "mimeType", "Mime type must be at most 100 characters");
  }
  if (body.expiryDate !== undefined && body.expiryDate !== null && body.expiryDate !== "") {
    const d = new Date(body.expiryDate);
    if (Number.isNaN(d.getTime())) {
      pushError(errors, "expiryDate", "Expiry date must be a valid date");
    }
  }

  if (errors.length) {
    return next(new ApiError(400, "Validation failed", errors));
  }

  req.body.documentType = String(body.documentType).toLowerCase().trim();
  req.body.filePath = String(body.filePath).trim();
  if (body.documentName !== undefined) {
    req.body.documentName =
      body.documentName === null || body.documentName === ""
        ? null
        : String(body.documentName).trim();
  }
  if (body.fileName !== undefined) {
    req.body.fileName =
      body.fileName === null || body.fileName === ""
        ? null
        : String(body.fileName).trim();
  }
  if (body.mimeType !== undefined) {
    req.body.mimeType =
      body.mimeType === null || body.mimeType === ""
        ? null
        : String(body.mimeType).trim();
  }
  if (body.expiryDate === "" || body.expiryDate === null) {
    req.body.expiryDate = null;
  }
  if (body.notes === "") req.body.notes = null;
  return next();
}

function validateUpdateDocument(req, res, next) {
  const body = req.body || {};
  const errors = [];
  const hasAny =
    body.documentType !== undefined ||
    body.documentName !== undefined ||
    body.filePath !== undefined ||
    body.fileName !== undefined ||
    body.mimeType !== undefined ||
    body.expiryDate !== undefined ||
    body.notes !== undefined ||
    body.uploadDate !== undefined;

  if (!hasAny) {
    return next(
      new ApiError(400, "Validation failed", [
        { field: "body", message: "No updatable fields provided" },
      ])
    );
  }

  if (body.documentType !== undefined && body.documentType !== null && body.documentType !== "") {
    if (!DOCUMENT_TYPES.includes(String(body.documentType).toLowerCase())) {
      pushError(
        errors,
        "documentType",
        `Must be one of: ${DOCUMENT_TYPES.join(", ")}`
      );
    } else {
      req.body.documentType = String(body.documentType).toLowerCase().trim();
    }
  }

  if (body.filePath !== undefined) {
    if (!isPresent(body.filePath)) {
      pushError(errors, "filePath", "File path or URL cannot be empty");
    } else if (String(body.filePath).trim().length > 500) {
      pushError(errors, "filePath", "File path must be at most 500 characters");
    } else {
      req.body.filePath = String(body.filePath).trim();
    }
  }

  if (body.expiryDate !== undefined && body.expiryDate !== null && body.expiryDate !== "") {
    const d = new Date(body.expiryDate);
    if (Number.isNaN(d.getTime())) {
      pushError(errors, "expiryDate", "Expiry date must be a valid date");
    }
  } else if (body.expiryDate === "") {
    req.body.expiryDate = null;
  }

  if (errors.length) {
    return next(new ApiError(400, "Validation failed", errors));
  }
  return next();
}

function validateCreateMedia(req, res, next) {
  const body = req.body || {};
  const errors = [];

  if (!isPresent(body.mediaType)) {
    pushError(errors, "mediaType", "Media type is required");
  } else if (!MEDIA_TYPES.includes(String(body.mediaType).toLowerCase())) {
    pushError(errors, "mediaType", `Must be one of: ${MEDIA_TYPES.join(", ")}`);
  }

  if (!isPresent(body.filePath)) {
    pushError(errors, "filePath", "File path or URL is required");
  } else if (String(body.filePath).trim().length > 500) {
    pushError(errors, "filePath", "File path must be at most 500 characters");
  }

  if (body.fileName && String(body.fileName).trim().length > 255) {
    pushError(errors, "fileName", "File name must be at most 255 characters");
  }
  if (body.caption && String(body.caption).trim().length > 255) {
    pushError(errors, "caption", "Caption must be at most 255 characters");
  }
  if (body.sortOrder !== undefined && body.sortOrder !== null && body.sortOrder !== "") {
    const n = Number(body.sortOrder);
    if (!Number.isInteger(n)) {
      pushError(errors, "sortOrder", "Sort order must be an integer");
    }
  }

  if (errors.length) {
    return next(new ApiError(400, "Validation failed", errors));
  }

  req.body.mediaType = String(body.mediaType).toLowerCase().trim();
  req.body.filePath = String(body.filePath).trim();
  if (body.isCover !== undefined) {
    req.body.isCover =
      body.isCover === true || body.isCover === "true" || body.isCover === 1;
  }
  if (body.sortOrder !== undefined && body.sortOrder !== null && body.sortOrder !== "") {
    req.body.sortOrder = Number(body.sortOrder);
  }
  if (body.caption === "") req.body.caption = null;
  if (body.fileName === "") req.body.fileName = null;
  if (body.mimeType === "") req.body.mimeType = null;
  return next();
}

function validateUpdateMedia(req, res, next) {
  const body = req.body || {};
  const errors = [];
  const hasAny =
    body.mediaType !== undefined ||
    body.filePath !== undefined ||
    body.fileName !== undefined ||
    body.mimeType !== undefined ||
    body.caption !== undefined ||
    body.sortOrder !== undefined ||
    body.isCover !== undefined;

  if (!hasAny) {
    return next(
      new ApiError(400, "Validation failed", [
        { field: "body", message: "No updatable fields provided" },
      ])
    );
  }

  if (body.mediaType !== undefined && body.mediaType !== null && body.mediaType !== "") {
    if (!MEDIA_TYPES.includes(String(body.mediaType).toLowerCase())) {
      pushError(errors, "mediaType", `Must be one of: ${MEDIA_TYPES.join(", ")}`);
    } else {
      req.body.mediaType = String(body.mediaType).toLowerCase().trim();
    }
  }

  if (body.filePath !== undefined) {
    if (!isPresent(body.filePath)) {
      pushError(errors, "filePath", "File path or URL cannot be empty");
    } else {
      req.body.filePath = String(body.filePath).trim();
    }
  }

  if (body.sortOrder !== undefined && body.sortOrder !== null && body.sortOrder !== "") {
    const n = Number(body.sortOrder);
    if (!Number.isInteger(n)) {
      pushError(errors, "sortOrder", "Sort order must be an integer");
    } else {
      req.body.sortOrder = n;
    }
  }

  if (body.isCover !== undefined) {
    req.body.isCover =
      body.isCover === true || body.isCover === "true" || body.isCover === 1;
  }

  if (errors.length) {
    return next(new ApiError(400, "Validation failed", errors));
  }
  return next();
}

module.exports = {
  validateIdParam,
  validateCreateDocument,
  validateUpdateDocument,
  validateCreateMedia,
  validateUpdateMedia,
};
