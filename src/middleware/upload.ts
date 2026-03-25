// src/middleware/upload.ts
// Multer configuration for handling multipart/form-data file uploads.
//
// Uses memoryStorage — file is held in RAM as a Buffer and passed directly
// to the S3 storage service. Nothing is written to disk.
//
// File type and size are validated again in the storage service (defense in depth),
// but multer also enforces a hard size limit here to reject oversized requests early.

import multer from "multer";
import { MAX_FILE_SIZE_BYTES } from "../storage/s3";

const upload = multer({
  // Store in memory — no disk I/O, buffer passed directly to MinIO upload
  storage: multer.memoryStorage(),

  // Reject files larger than 2MB before they reach the storage service
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files:    1,                   // Only one file per request
  },

  // Pre-filter: reject non-image MIME types at the multer level
  // The storage service validates this again — this is an early fast-fail
  fileFilter(_req, file, callback) {
    const allowed = ["image/jpeg", "image/jpg", "image/png"];
    if (allowed.includes(file.mimetype)) {
      callback(null, true);
    } else {
      callback(new Error(`Invalid file type: ${file.mimetype}. Allowed: jpg, png`));
    }
  },
});

// Export as a named middleware that expects a field named "image"
export const uploadImage = upload.single("image");
