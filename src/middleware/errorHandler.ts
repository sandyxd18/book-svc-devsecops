// src/middleware/errorHandler.ts
// Global Express error handler — catches errors passed via next(err),
// including Multer errors (file size exceeded, wrong type).

import type { Request, Response, NextFunction } from "express";
import multer from "multer";
import { sendError } from "../utils/response";
import logger from "../utils/logger";

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Handle Multer-specific errors with user-friendly messages
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      sendError(res, "File too large. Maximum size is 2MB", 400);
      return;
    }
    sendError(res, `Upload error: ${err.message}`, 400);
    return;
  }

  // File filter rejection (from multer fileFilter callback)
  if (err.message?.startsWith("Invalid file type")) {
    sendError(res, err.message, 400);
    return;
  }

  // trace_id is auto-injected by logger via active OTel span
  logger.error("unhandled_error", {
    error:  err.message,
    stack:  err.stack,
    method: req.method,
    url:    req.originalUrl,
  });

  const message = process.env.NODE_ENV === "production"
    ? "Internal server error"
    : err.message;

  sendError(res, message, 500);
}

export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, `Route ${req.method} ${req.path} not found`, 404);
}
