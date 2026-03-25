// src/storage/s3.ts
// Object storage service — wraps AWS SDK v3 for MinIO (S3-compatible).
// Emits Prometheus metrics for every upload and delete operation.
//
// Public API:
//   uploadImage(file)  → { url, key }
//   deleteImage(key)   → void

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { env } from "../config/env";
import logger from "../utils/logger";
import {
  storageOperationsTotal,
  storageOperationDurationSeconds,
  storageUploadBytes,
} from "../telemetry/metrics";

// ── Allowed MIME types ────────────────────────────────────────────────────────
const ALLOWED_MIME_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg":  "jpg",
  "image/png":  "png",
};

export const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

// ── S3 client — configured for MinIO ─────────────────────────────────────────
const s3 = new S3Client({
  endpoint:   env.S3_ENDPOINT,
  region:     env.S3_REGION,
  credentials: {
    accessKeyId:     env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
  },
  // MinIO requires path-style: http://minio:9000/<bucket>/<key>
  forcePathStyle: true,
});

export interface UploadResult {
  url: string;
  key: string;
}

export interface UploadFile {
  buffer:   Buffer;
  mimetype: string;
  size:     number;
}

export const StorageService = {

  /**
   * uploadImage
   * Validates file, generates unique key, uploads to MinIO,
   * returns public URL + object key. Emits storage metrics.
   */
  async uploadImage(file: UploadFile): Promise<UploadResult> {
    // ── Validate MIME type ──────────────────────────────────────────────────
    const extension = ALLOWED_MIME_TYPES[file.mimetype];
    if (!extension) {
      throw new StorageValidationError(
        `Invalid file type: ${file.mimetype}. Allowed: jpg, png`
      );
    }

    // ── Validate file size ──────────────────────────────────────────────────
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new StorageValidationError(
        `File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Max: 2MB`
      );
    }

    // ── Generate safe, unique object key — never use client filename ────────
    const key = `books/${randomUUID()}.${extension}`;

    // ── Upload with timing metric ────────────────────────────────────────────
    const timer = storageOperationDurationSeconds.startTimer({ operation: "upload" });
    try {
      await s3.send(
        new PutObjectCommand({
          Bucket:        env.S3_BUCKET,
          Key:           key,
          Body:          file.buffer,
          ContentType:   file.mimetype,
          ContentLength: file.size,
        })
      );

      timer();  // record duration
      storageOperationsTotal.inc({ operation: "upload", status: "success" });
      storageUploadBytes.observe(file.size);

      const url = `${env.S3_PUBLIC_URL}/${env.S3_BUCKET}/${key}`;
      logger.info("storage_upload_success", { key, size: file.size, mime: file.mimetype });
      return { url, key };

    } catch (err) {
      timer();
      storageOperationsTotal.inc({ operation: "upload", status: "failure" });
      logger.error("storage_upload_failed", { key, error: (err as Error).message });
      throw err;
    }
  },

  /**
   * deleteImage
   * Deletes object from MinIO. Fails silently (logs warning) —
   * a missing image key should not block book deletion.
   */
  async deleteImage(key: string): Promise<void> {
    const timer = storageOperationDurationSeconds.startTimer({ operation: "delete" });
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
      timer();
      storageOperationsTotal.inc({ operation: "delete", status: "success" });
      logger.info("storage_delete_success", { key });
    } catch (err) {
      timer();
      storageOperationsTotal.inc({ operation: "delete", status: "failure" });
      logger.warn("storage_delete_failed", { key, error: (err as Error).message });
      // Do NOT re-throw — book deletion must still succeed
    }
  },
};

export class StorageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageValidationError";
  }
}
