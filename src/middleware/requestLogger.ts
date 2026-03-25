// src/middleware/requestLogger.ts
// HTTP request/response logging + Prometheus metrics middleware.
// Each log entry is structured JSON including trace_id/span_id
// for Grafana log ↔ trace correlation.

import type { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";
import {
  httpRequestsTotal,
  httpRequestDurationSeconds,
  httpRequestsInFlight,
} from "../telemetry/metrics";

// Normalize route params to avoid high-cardinality Prometheus labels.
// e.g. /books/abc-123  →  /books/:id
function normalizeRoute(req: Request): string {
  return req.route?.path
    ? `${req.baseUrl ?? ""}${req.route.path}`
    : req.path;
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startAt = process.hrtime.bigint();
  const route   = normalizeRoute(req);

  httpRequestsInFlight.inc({ method: req.method, route });

  res.on("finish", () => {
    const durationSec = Number(process.hrtime.bigint() - startAt) / 1e9;
    const statusCode  = String(res.statusCode);
    const labels      = { method: req.method, route, status_code: statusCode };

    httpRequestsTotal.inc(labels);
    httpRequestDurationSeconds.observe(labels, durationSec);
    httpRequestsInFlight.dec({ method: req.method, route });

    logger.info("http_request", {
      method:      req.method,
      url:         req.originalUrl,
      route,
      status_code: res.statusCode,
      duration_ms: Math.round(durationSec * 1000),
      user_id:     (req as any).user?.sub ?? null,
      user_agent:  req.headers["user-agent"] ?? null,
    });
  });

  next();
}
