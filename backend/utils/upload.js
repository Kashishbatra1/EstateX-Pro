/**
 * Local file upload helpers — stores under backend/uploads, metadata path is /api/uploads/...
 * No schema changes; uses existing file_path / file_name / mime_type columns.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const ApiError = require("./ApiError");

const UPLOADS_ROOT = path.join(__dirname, "..", "uploads");

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_MEDIA_BYTES = 8 * 1024 * 1024; // 8 MB

const DOCUMENT_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MEDIA_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const EXT_BY_MIME = {
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function sanitizeOriginalName(name) {
  const base = path.basename(String(name || "file")).replace(/[^\w.\-()+ ]+/g, "_");
  return base.slice(0, 180) || "file";
}

function publicUploadPath(relativePosix) {
  const cleaned = String(relativePosix).replace(/\\/g, "/").replace(/^\/+/, "");
  return `/api/uploads/${cleaned}`;
}

function absoluteFromPublicPath(publicPath) {
  if (!publicPath || typeof publicPath !== "string") return null;
  if (!publicPath.startsWith("/api/uploads/")) return null;
  const rel = publicPath.slice("/api/uploads/".length);
  const abs = path.normalize(path.join(UPLOADS_ROOT, rel));
  if (!abs.startsWith(path.normalize(UPLOADS_ROOT + path.sep))) {
    return null;
  }
  return abs;
}

function isLocalUploadPath(filePath) {
  return typeof filePath === "string" && filePath.startsWith("/api/uploads/");
}

function createUploader({ subdir, allowedMimes, maxBytes }) {
  const dest = path.join(UPLOADS_ROOT, ...subdir.split("/").filter(Boolean));
  ensureDir(dest);

  const storage = multer.diskStorage({
    destination(_req, _file, cb) {
      cb(null, dest);
    },
    filename(_req, file, cb) {
      const mime = file.mimetype;
      const ext =
        EXT_BY_MIME[mime] ||
        path.extname(file.originalname || "").toLowerCase() ||
        "";
      const safeExt = /^\.[a-z0-9]{1,8}$/i.test(ext) ? ext.toLowerCase() : "";
      const stamp = Date.now();
      const rand = crypto.randomBytes(8).toString("hex");
      cb(null, `${stamp}-${rand}${safeExt}`);
    },
  });

  return multer({
    storage,
    limits: { fileSize: maxBytes, files: 1 },
    fileFilter(_req, file, cb) {
      if (!allowedMimes.has(file.mimetype)) {
        return cb(
          new ApiError(400, "Unsupported file type", [
            {
              field: "file",
              message: `Allowed types: ${[...allowedMimes].join(", ")}`,
            },
          ])
        );
      }
      return cb(null, true);
    },
  });
}

const documentUpload = createUploader({
  subdir: "documents",
  allowedMimes: DOCUMENT_MIME,
  maxBytes: MAX_DOCUMENT_BYTES,
});

const mediaUpload = createUploader({
  subdir: "media",
  allowedMimes: MEDIA_MIME,
  maxBytes: MAX_MEDIA_BYTES,
});

function singleFile(uploader) {
  return (req, res, next) => {
    uploader.single("file")(req, res, (err) => {
      if (!err) return next();
      if (err instanceof ApiError) return next(err);
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return next(
            new ApiError(400, "File too large", [
              { field: "file", message: "Maximum size exceeded" },
            ])
          );
        }
        return next(new ApiError(400, "Upload failed", [{ message: err.message }]));
      }
      return next(err);
    });
  };
}

function requireUploadedFile(req, _res, next) {
  if (!req.file) {
    return next(
      new ApiError(400, "Validation failed", [
        { field: "file", message: "A file is required" },
      ])
    );
  }
  return next();
}

function toStoredFileMeta(file, categoryFolder) {
  const original = sanitizeOriginalName(file.originalname);
  const relative = path.posix.join(categoryFolder, file.filename);
  return {
    filePath: publicUploadPath(relative),
    fileName: original,
    mimeType: file.mimetype,
    sizeBytes: file.size,
  };
}

function moveToEntityFolder(file, entityFolderParts) {
  const destDir = path.join(UPLOADS_ROOT, ...entityFolderParts);
  ensureDir(destDir);
  const destAbs = path.join(destDir, file.filename);
  fs.renameSync(file.path, destAbs);
  file.path = destAbs;
  const relative = path.posix.join(...entityFolderParts, file.filename);
  return {
    filePath: publicUploadPath(relative),
    fileName: sanitizeOriginalName(file.originalname),
    mimeType: file.mimetype,
    sizeBytes: file.size,
  };
}

module.exports = {
  UPLOADS_ROOT,
  MAX_DOCUMENT_BYTES,
  MAX_MEDIA_BYTES,
  DOCUMENT_MIME,
  MEDIA_MIME,
  ensureDir,
  publicUploadPath,
  absoluteFromPublicPath,
  isLocalUploadPath,
  documentUpload,
  mediaUpload,
  singleFile,
  requireUploadedFile,
  toStoredFileMeta,
  moveToEntityFolder,
  sanitizeOriginalName,
};
