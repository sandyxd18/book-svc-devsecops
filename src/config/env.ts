// src/config/env.ts
// Centralized env var validation — fails fast at startup if required vars are missing.

const required = [
  "DATABASE_URL",
  "JWT_SECRET",
  "S3_ENDPOINT",
  "S3_ACCESS_KEY",
  "S3_SECRET_KEY",
  "S3_BUCKET",
] as const;

for (const key of required) {
  if (!process.env[key]) {
    console.error(`[Config] FATAL: Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

export const env = {
  // App
  PORT:          parseInt(process.env.PORT ?? "8000", 10),
  NODE_ENV:      process.env.NODE_ENV ?? "development",
  IS_PRODUCTION: process.env.NODE_ENV === "production",

  // Auth
  JWT_SECRET: process.env.JWT_SECRET as string,

  // Database
  DATABASE_URL: process.env.DATABASE_URL as string,

  // MinIO / S3
  S3_ENDPOINT:   process.env.S3_ENDPOINT as string,
  S3_ACCESS_KEY: process.env.S3_ACCESS_KEY as string,
  S3_SECRET_KEY: process.env.S3_SECRET_KEY as string,
  S3_BUCKET:     process.env.S3_BUCKET as string,
  S3_REGION:     process.env.S3_REGION ?? "us-east-1",
  S3_PUBLIC_URL: process.env.S3_PUBLIC_URL ?? process.env.S3_ENDPOINT as string,

  // Observability
  SERVICE_NAME:    process.env.SERVICE_NAME ?? "book-service",
  SERVICE_VERSION: process.env.SERVICE_VERSION ?? "1.0.0",
  OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://alloy:4317",
  LOKI_HOST: process.env.LOKI_HOST ?? "http://loki:3100",
};