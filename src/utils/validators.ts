// src/utils/validators.ts
// Zod schemas for book input validation.

import { z } from "zod";

export const createBookSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(255, "Title is too long")
    .trim(),
  author: z
    .string()
    .min(1, "Author is required")
    .max(255, "Author is too long")
    .trim(),
  price: z
    .string()                         // comes as string from multipart form
    .refine((v) => !isNaN(Number(v)) && Number(v) >= 0, {
      message: "Price must be a non-negative number",
    })
    .transform(Number),
  stock: z
    .string()
    .refine((v) => Number.isInteger(Number(v)) && Number(v) >= 0, {
      message: "Stock must be a non-negative integer",
    })
    .transform(Number),
  description: z.string().max(2000, "Description is too long").trim().optional(),
});

export const updateBookSchema = z.object({
  title:  z.string().min(1).max(255).trim().optional(),
  author: z.string().min(1).max(255).trim().optional(),
  price: z
    .string()
    .refine((v) => !isNaN(Number(v)) && Number(v) >= 0, {
      message: "Price must be a non-negative number",
    })
    .transform(Number)
    .optional(),
  stock: z
    .string()
    .refine((v) => Number.isInteger(Number(v)) && Number(v) >= 0, {
      message: "Stock must be a non-negative integer",
    })
    .transform(Number)
    .optional(),
  description: z.string().max(2000, "Description is too long").trim().optional(),
});

export const paginationSchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateBookInput = z.infer<typeof createBookSchema>;
export type UpdateBookInput = z.infer<typeof updateBookSchema>;
