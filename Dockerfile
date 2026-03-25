# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — deps
# Install all dependencies.
# --frozen-lockfile is used only when bun.lockb exists (project already locked).
# If bun.lockb does not exist yet, bun install will create it.
# ─────────────────────────────────────────────────────────────────────────────
FROM oven/bun:1-alpine AS deps

WORKDIR /app

# openssl required by Prisma engine on Alpine (musl libc + openssl 3.x)
RUN apk add --no-cache openssl

# Copy manifest files — lockfile is optional on first build
COPY package.json ./
COPY bun.lockb* ./

# Install deps:
#   - If bun.lockb exists  → use --frozen-lockfile (reproducible, CI-safe)
#   - If bun.lockb missing → run plain bun install and generate the lockfile
# RUN if [ -f bun.lockb ]; then \
#       bun install --frozen-lockfile; \
#     else \
#       bun install; \
#     fi

RUN bun install --frozen-lockfile

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — builder
# Generate Prisma client for linux-musl-openssl-3.0.x (Alpine target).
# DATABASE_URL must be set to a dummy value — Prisma generate does not
# connect to the database, but it validates that the env var is present.
# ─────────────────────────────────────────────────────────────────────────────
FROM oven/bun:1-alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl

# Carry over installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source and schema
COPY prisma      ./prisma
COPY src         ./src
COPY package.json ./

# Dummy DATABASE_URL so Prisma validate doesn't abort.
# This value is never used at runtime — the real value comes from env/secret.
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"

RUN bunx prisma generate

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3 — runner
# Minimal production image — only runtime files, non-root user.
# ─────────────────────────────────────────────────────────────────────────────
FROM oven/bun:1-alpine AS runner

WORKDIR /app

# openssl required at runtime by Prisma query engine
RUN apk add --no-cache openssl

# Create non-root user for security
RUN addgroup --system --gid 1001 appgroup && \
    adduser  --system --uid 1001 --ingroup appgroup appuser

# Copy only what is needed at runtime
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/src         ./src
COPY --from=builder --chown=appuser:appgroup /app/prisma      ./prisma
COPY --chown=appuser:appgroup package.json   ./
COPY --chown=appuser:appgroup entrypoint.sh  ./entrypoint.sh

RUN chmod +x ./entrypoint.sh

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

ENTRYPOINT ["sh", "./entrypoint.sh"]