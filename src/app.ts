// src/app.ts
// Express application factory.

import express from "express";
import cors from "cors";
import bookRoutes from "./routes/book.routes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { requestLogger } from "./middleware/requestLogger";
import { register } from "./telemetry/metrics";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  // Allowed origins — loaded from CORS_ALLOWED_ORIGINS env variable (comma-separated).
  const allowedOrigins: string[] = process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
    : ["http://localhost", "http://localhost:80", "http://localhost:8081", "http://localhost:5173", "http://localhost:5174"];

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }));
  app.use(express.json({ limit: "10kb" }));
  app.use(express.urlencoded({ extended: false }));

  // ── Observability: structured request logging + Prometheus metrics ──────────
  app.use(requestLogger);

  // ── Health check ────────────────────────────────────────────────────────────
  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // ── Prometheus metrics endpoint — scraped by Prometheus every 15s ───────────
  app.get("/metrics", async (_req, res) => {
    try {
      res.set("Content-Type", register.contentType);
      res.end(await register.metrics());
    } catch {
      res.status(500).end();
    }
  });

  // ── Application routes ──────────────────────────────────────────────────────
  app.use("/books", bookRoutes);

  // ── Error handlers (must be last) ───────────────────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
