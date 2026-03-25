// src/controllers/book.controller.ts
// HTTP layer — validates input, calls BookService, sends response.
// No business logic lives here.

import type { Request, Response, NextFunction } from "express";
import { BookService, NotFoundError } from "../services/book.service";
import { StorageValidationError } from "../storage/s3";
import {
  createBookSchema,
  updateBookSchema,
  paginationSchema,
} from "../utils/validators";
import { sendSuccess, sendError } from "../utils/response";

export const BookController = {

  // ── Public ────────────────────────────────────────────────────────────────

  /**
   * GET /books
   * List all books with pagination.
   * Query params: page (default 1), limit (default 20, max 100)
   */
  async listBooks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = paginationSchema.safeParse(req.query);
      if (!parsed.success) {
        sendError(res, "Invalid pagination params", 400, parsed.error.flatten());
        return;
      }
      const result = await BookService.listBooks(parsed.data.page, parsed.data.limit);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /books/:id
   * Get a single book by ID.
   */
  async getBook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const book = await BookService.getBookById(req.params.id);
      sendSuccess(res, book);
    } catch (err) {
      if (err instanceof NotFoundError) sendError(res, err.message, 404);
      else next(err);
    }
  },

  // ── Admin ─────────────────────────────────────────────────────────────────

  /**
   * POST /books
   * Create a new book. Accepts multipart/form-data.
   * Fields: title, author, price, stock
   * File:   image (optional, jpg/png, max 2MB)
   */
  async createBook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = createBookSchema.safeParse(req.body);
      if (!parsed.success) {
        sendError(res, "Validation failed", 400, parsed.error.flatten());
        return;
      }
      const book = await BookService.createBook(parsed.data, req.file);
      sendSuccess(res, book, "Book created successfully", 201);
    } catch (err) {
      if (err instanceof StorageValidationError) sendError(res, err.message, 400);
      else next(err);
    }
  },

  /**
   * PUT /books/:id
   * Update an existing book. Accepts multipart/form-data.
   * All fields are optional. Image is replaced if a new file is provided.
   */
  async updateBook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = updateBookSchema.safeParse(req.body);
      if (!parsed.success) {
        sendError(res, "Validation failed", 400, parsed.error.flatten());
        return;
      }
      const book = await BookService.updateBook(req.params.id, parsed.data, req.file);
      sendSuccess(res, book, "Book updated successfully");
    } catch (err) {
      if (err instanceof NotFoundError)         sendError(res, err.message, 404);
      else if (err instanceof StorageValidationError) sendError(res, err.message, 400);
      else next(err);
    }
  },

  /**
   * DELETE /books/:id
   * Delete a book and its image from MinIO.
   */
  async deleteBook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await BookService.deleteBook(req.params.id);
      sendSuccess(res, null, "Book deleted successfully");
    } catch (err) {
      if (err instanceof NotFoundError) sendError(res, err.message, 404);
      else next(err);
    }
  },
};
