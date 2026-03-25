// src/telemetry/metrics.ts
// Prometheus metrics registry using prom-client.
// Exposes /metrics endpoint scraped by Prometheus every 15s.
//
// Metrics:
//   http_requests_total              — HTTP counter by method/route/status
//   http_request_duration_seconds    — HTTP latency histogram
//   http_requests_in_flight          — active requests gauge
//   book_operations_total            — book CRUD operations counter
//   storage_operations_total         — MinIO upload/delete counter
//   storage_operation_duration_seconds — MinIO latency histogram
//   storage_upload_bytes             — bytes uploaded to MinIO histogram

import {
  Registry,
  Counter,
  Histogram,
  Gauge,
  collectDefaultMetrics,
} from "prom-client";
import { env } from "../config/env";

export const register = new Registry();

collectDefaultMetrics({
  register,
  labels: { service: env.SERVICE_NAME, version: env.SERVICE_VERSION },
});

// ── HTTP Metrics ──────────────────────────────────────────────────────────────

export const httpRequestsTotal = new Counter({
  name:       "http_requests_total",
  help:       "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
  registers:  [register],
});

export const httpRequestDurationSeconds = new Histogram({
  name:       "http_request_duration_seconds",
  help:       "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets:    [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers:  [register],
});

export const httpRequestsInFlight = new Gauge({
  name:       "http_requests_in_flight",
  help:       "Number of HTTP requests currently being processed",
  labelNames: ["method", "route"],
  registers:  [register],
});

// ── Book Business Metrics ─────────────────────────────────────────────────────

export const bookOperationsTotal = new Counter({
  name:       "book_operations_total",
  help:       "Total number of book CRUD operations",
  labelNames: ["operation", "status"], // operation: list|get|create|update|delete
  registers:  [register],
});

// ── Storage (MinIO) Metrics ───────────────────────────────────────────────────

export const storageOperationsTotal = new Counter({
  name:       "storage_operations_total",
  help:       "Total number of MinIO/S3 storage operations",
  labelNames: ["operation", "status"], // operation: upload|delete
  registers:  [register],
});

export const storageOperationDurationSeconds = new Histogram({
  name:       "storage_operation_duration_seconds",
  help:       "MinIO/S3 operation duration in seconds",
  labelNames: ["operation"],
  buckets:    [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers:  [register],
});

export const storageUploadBytes = new Histogram({
  name:    "storage_upload_bytes",
  help:    "Size of files uploaded to MinIO in bytes",
  buckets: [10_000, 50_000, 100_000, 500_000, 1_000_000, 2_000_000],
  registers: [register],
});
