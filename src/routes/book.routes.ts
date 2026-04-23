// src/routes/book.routes.ts
// Route definitions for /books endpoints.

import { Router } from "express";
import { BookController } from "../controllers/book.controller";
import { authenticateJWT, authorizeRole, authenticateInternalService } from "../middleware/auth";
import { uploadImage } from "../middleware/upload";

const router = Router();

// ── Public — any authenticated user OR unauthenticated ────────────────────────

/** List all books (paginated) */
router.get("/", BookController.listBooks);

/** Get a single book by ID */
router.get("/:id", BookController.getBook);

// ── Admin only ────────────────────────────────────────────────────────────────

/**
 * Create a book
 * Middleware chain:
 *   1. authenticateJWT  — verify token
 *   2. authorizeRole    — must be admin
 *   3. uploadImage      — parse multipart/form-data, validate file
 *   4. BookController   — validate body, create DB record, upload to MinIO
 */
router.post(
  "/",
  authenticateJWT,
  authorizeRole("admin"),
  uploadImage,
  BookController.createBook
);

/** Update a book (image replacement is optional) */
router.put(
  "/:id",
  authenticateJWT,
  authorizeRole("admin"),
  uploadImage,
  BookController.updateBook
);

/** Delete a book and its image */
router.delete(
  "/:id",
  authenticateJWT,
  authorizeRole("admin"),
  BookController.deleteBook
);

/** Deduct stock (internal service only) */
router.patch(
  "/:id/deduct-stock",
  authenticateInternalService,
  BookController.deductStock
);

export default router;
