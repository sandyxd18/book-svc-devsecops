// src/services/book.service.ts
// Business logic for book management.
// Emits structured logs and Prometheus metrics for every operation.

import prisma from "../db/prisma";
import { StorageService } from "../storage/s3";
import { bookOperationsTotal } from "../telemetry/metrics";
import logger from "../utils/logger";
import type { CreateBookInput, UpdateBookInput } from "../utils/validators";

// Helper to record metric + log in one call
function recordOp(operation: string, status: "success" | "failure", extra?: object) {
  bookOperationsTotal.inc({ operation, status });
  const level = status === "success" ? "info" : "warn";
  logger[level](`book_${operation}`, { operation, status, ...extra });
}

export const BookService = {

  async listBooks(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [books, total] = await Promise.all([
      prisma.book.findMany({
        skip,
        take:    limit,
        orderBy: { created_at: "desc" },
        select: {
          id: true, title: true, author: true, description: true,
          price: true, stock: true, image_url: true, created_at: true,
        },
      }),
      prisma.book.count(),
    ]);

    recordOp("list", "success", { page, limit, total });
    return {
      books,
      pagination: { total, page, limit, total_pages: Math.ceil(total / limit) },
    };
  },

  async getBookById(id: string) {
    const book = await prisma.book.findUnique({
      where: { id },
      select: {
        id: true, title: true, author: true, description: true, price: true,
        stock: true, image_url: true, created_at: true, updated_at: true,
      },
    });
    if (!book) {
      recordOp("get", "failure", { reason: "not_found", book_id: id });
      throw new NotFoundError("Book not found");
    }
    recordOp("get", "success", { book_id: id });
    return book;
  },

  async createBook(input: CreateBookInput, file?: Express.Multer.File) {
    let image_url: string | undefined;
    let image_key: string | undefined;

    if (file) {
      const uploaded = await StorageService.uploadImage({
        buffer:   file.buffer,
        mimetype: file.mimetype,
        size:     file.size,
      });
      image_url = uploaded.url;
      image_key = uploaded.key;
    }

    const book = await prisma.book.create({
      data: { ...input, image_url, image_key },
      select: {
        id: true, title: true, author: true, description: true,
        price: true, stock: true, image_url: true, created_at: true,
      },
    });

    recordOp("create", "success", { book_id: book.id, has_image: !!image_url });
    return book;
  },

  async updateBook(id: string, input: UpdateBookInput, file?: Express.Multer.File) {
    const existing = await prisma.book.findUnique({ where: { id } });
    if (!existing) {
      recordOp("update", "failure", { reason: "not_found", book_id: id });
      throw new NotFoundError("Book not found");
    }

    let image_url: string | undefined;
    let image_key: string | undefined;

    if (file) {
      const uploaded = await StorageService.uploadImage({
        buffer:   file.buffer,
        mimetype: file.mimetype,
        size:     file.size,
      });
      image_url = uploaded.url;
      image_key = uploaded.key;
    }

    const book = await prisma.book.update({
      where: { id },
      data: {
        ...(input.title       !== undefined && { title:       input.title }),
        ...(input.author      !== undefined && { author:      input.author }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.price       !== undefined && { price:       input.price }),
        ...(input.stock       !== undefined && { stock:       input.stock }),
        ...(image_url         !== undefined && { image_url }),
        ...(image_key         !== undefined && { image_key }),
      },
      select: {
        id: true, title: true, author: true, description: true,
        price: true, stock: true, image_url: true, updated_at: true,
      },
    });

    // Delete old image after DB update succeeds
    if (file && existing.image_key) {
      await StorageService.deleteImage(existing.image_key);
    }

    recordOp("update", "success", { book_id: id, image_replaced: !!file });
    return book;
  },

  async deleteBook(id: string) {
    const existing = await prisma.book.findUnique({ where: { id } });
    if (!existing) {
      recordOp("delete", "failure", { reason: "not_found", book_id: id });
      throw new NotFoundError("Book not found");
    }

    await prisma.book.delete({ where: { id } });

    if (existing.image_key) {
      await StorageService.deleteImage(existing.image_key);
    }

    recordOp("delete", "success", { book_id: id, had_image: !!existing.image_key });
  },

  async deductStock(id: string, quantity: number) {
    const existing = await prisma.book.findUnique({ where: { id } });
    if (!existing) {
      recordOp("deduct_stock", "failure", { reason: "not_found", book_id: id });
      throw new NotFoundError("Book not found");
    }
    if (existing.stock < quantity) {
      recordOp("deduct_stock", "failure", { reason: "insufficient_stock", book_id: id });
      throw new Error("Insufficient stock");
    }

    const book = await prisma.book.update({
      where: { id },
      data: { stock: { decrement: quantity } }
    });

    recordOp("deduct_stock", "success", { book_id: id, quantity });
    return book;
  },
};

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}
