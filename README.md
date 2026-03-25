# 📚 Book Service

Production-ready book microservice with MinIO/S3 image storage, built with **Bun**, **Express**, **PostgreSQL**, **Prisma**, and **AWS SDK v3**.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Bun |
| Framework | Express.js |
| Database | PostgreSQL + Prisma |
| Object Storage | MinIO (S3-compatible, AWS SDK v3) |
| Auth | JWT (shared secret with auth-service) |
| Validation | Zod |
| Logging | Winston (structured JSON) |

---

## Project Structure

```
book-service/
├── prisma/
│   └── schema.prisma           # books table schema
├── src/
│   ├── config/
│   │   └── env.ts              # Env var validation & typed access
│   ├── controllers/
│   │   └── book.controller.ts  # HTTP layer — parse, validate, respond
│   ├── db/
│   │   └── prisma.ts           # Prisma client singleton
│   ├── middleware/
│   │   ├── auth.ts             # authenticateJWT + authorizeRole
│   │   ├── errorHandler.ts     # Global error handler (incl. Multer errors)
│   │   └── upload.ts           # Multer memoryStorage config
│   ├── routes/
│   │   └── book.routes.ts      # Route definitions
│   ├── services/
│   │   └── book.service.ts     # Business logic (DB + storage coordination)
│   ├── storage/
│   │   └── s3.ts               # MinIO/S3 integration (upload, delete)
│   ├── utils/
│   │   ├── logger.ts           # Winston JSON logger
│   │   ├── response.ts         # Standardized API response helpers
│   │   └── validators.ts       # Zod schemas
│   ├── app.ts                  # Express factory
│   └── server.ts               # Entry point
├── .dockerignore
├── .env.example
├── Dockerfile                  # Multi-stage production image
├── entrypoint.sh               # DB schema sync → start server
└── package.json
```

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) >= 1.0
- PostgreSQL >= 14
- MinIO running locally (or any S3-compatible storage)

### 1. Install

```bash
git clone https://github.com/sandyxd18/book-svc-devsecops.git
cd book-service
bun install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

```env
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/book_db"
JWT_SECRET="same-secret-as-auth-service"
S3_ENDPOINT="http://localhost:9000"
S3_ACCESS_KEY="minioadmin"
S3_SECRET_KEY="minioadmin"
S3_BUCKET="books"
S3_REGION="us-east-1"
S3_PUBLIC_URL="http://localhost:9000"
PORT=8000
NODE_ENV="development"
```

### 3. MinIO Setup

```bash
# Run MinIO locally with Docker
docker run -d \
  -p 9000:9000 \
  -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  quay.io/minio/minio server /data --console-address ":9001"

# Create a public bucket named "books"
# Open http://localhost:9001 → create bucket → set access policy to "public"
```

### 4. Setup Database

```bash
bun run db:generate
bun run db:push
```

### 5. Start

```bash
bun run dev     # hot reload
bun run start   # production
```

---

## API Reference

### Endpoint Summary

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| GET | `/health` | — | — | Health check |
| GET | `/books` | — | — | List books (paginated) |
| GET | `/books/:id` | — | — | Get book detail |
| POST | `/books` | ✅ JWT | admin | Create book + upload image |
| PUT | `/books/:id` | ✅ JWT | admin | Update book (optional image) |
| DELETE | `/books/:id` | ✅ JWT | admin | Delete book + image |

---

### GET /books

List all books with pagination.

**Query params:** `page` (default: 1), `limit` (default: 20, max: 100)

```
GET /books?page=1&limit=10
```

**200 OK:**
```json
{
  "success": true,
  "data": {
    "books": [
      {
        "id": "uuid",
        "title": "Clean Code",
        "author": "Robert C. Martin",
        "price": "35.99",
        "stock": 50,
        "image_url": "http://minio:9000/books/books/uuid.jpg",
        "created_at": "2025-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 10,
      "total_pages": 1
    }
  }
}
```

---

### GET /books/:id

```
GET /books/550e8400-e29b-41d4-a716-446655440000
```

**200 OK:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Clean Code",
    "author": "Robert C. Martin",
    "price": "35.99",
    "stock": 50,
    "image_url": "http://minio:9000/books/books/uuid.jpg",
    "created_at": "2025-01-01T00:00:00.000Z",
    "updated_at": "2025-01-01T00:00:00.000Z"
  }
}
```

**404 Not Found:**
```json
{ "success": false, "error": "Book not found" }
```

---

### POST /books

Create a book with an optional cover image.

**Content-Type:** `multipart/form-data`
**Authorization:** `Bearer <admin-token>`

| Field | Type | Required | Description |
|---|---|---|---|
| `title` | string | ✅ | Book title (max 255 chars) |
| `author` | string | ✅ | Author name (max 255 chars) |
| `price` | number | ✅ | Price ≥ 0 |
| `stock` | integer | ✅ | Stock quantity ≥ 0 |
| `image` | file | ❌ | jpg/png, max 2MB |

**Example (curl):**
```bash
curl -X POST http://localhost:8000/books \
  -H "Authorization: Bearer <admin-token>" \
  -F "title=Clean Code" \
  -F "author=Robert C. Martin" \
  -F "price=35.99" \
  -F "stock=50" \
  -F "image=@/path/to/cover.jpg"
```

**201 Created:**
```json
{
  "success": true,
  "message": "Book created successfully",
  "data": {
    "id": "uuid",
    "title": "Clean Code",
    "author": "Robert C. Martin",
    "price": "35.99",
    "stock": 50,
    "image_url": "http://minio:9000/books/books/uuid.jpg",
    "created_at": "2025-01-01T00:00:00.000Z"
  }
}
```

**400 Bad Request (invalid file type):**
```json
{ "success": false, "error": "Invalid file type: image/gif. Allowed: jpg, png" }
```

**400 Bad Request (file too large):**
```json
{ "success": false, "error": "File too large. Maximum size is 2MB" }
```

**403 Forbidden (non-admin):**
```json
{ "success": false, "error": "Access denied. Required role(s): admin" }
```

---

### PUT /books/:id

Update book fields. Image is replaced if a new file is provided (old image is deleted from MinIO).

**Content-Type:** `multipart/form-data`
**Authorization:** `Bearer <admin-token>`

All fields are optional.

```bash
curl -X PUT http://localhost:8000/books/<id> \
  -H "Authorization: Bearer <admin-token>" \
  -F "price=29.99" \
  -F "stock=100"
```

**200 OK:**
```json
{
  "success": true,
  "message": "Book updated successfully",
  "data": {
    "id": "uuid",
    "title": "Clean Code",
    "author": "Robert C. Martin",
    "price": "29.99",
    "stock": 100,
    "image_url": "http://minio:9000/books/books/uuid.jpg",
    "updated_at": "2025-01-02T00:00:00.000Z"
  }
}
```

---

### DELETE /books/:id

Deletes the book record **and** its image from MinIO.

**Authorization:** `Bearer <admin-token>`

```bash
curl -X DELETE http://localhost:8000/books/<id> \
  -H "Authorization: Bearer <admin-token>"
```

**200 OK:**
```json
{ "success": true, "message": "Book deleted successfully", "data": null }
```

---

## Image Upload Details

| Constraint | Value |
|---|---|
| Allowed types | `image/jpeg`, `image/png` |
| Max file size | 2 MB |
| Storage | MinIO (never stored locally) |
| Filename | UUID-based, client filename is **ignored** |
| URL pattern | `<S3_PUBLIC_URL>/<bucket>/books/<uuid>.<ext>` |
| Deletion | Auto-deleted from MinIO on book delete or image replace |

**File naming strategy:**
```
books/<uuid>.jpg
books/<uuid>.png
```
Client-supplied filenames are discarded entirely. The path never contains user input, preventing path traversal attacks.

---

## RBAC

| Operation | `user` role | `admin` role |
|---|---|---|
| List books | ✅ (no auth needed) | ✅ |
| Get book | ✅ (no auth needed) | ✅ |
| Create book | ❌ 403 | ✅ |
| Update book | ❌ 403 | ✅ |
| Delete book | ❌ 403 | ✅ |

The JWT payload is expected in this format (same as auth-service output):
```json
{
  "sub": "user-uuid",
  "username": "alice",
  "role": "user",
  "iat": 1700000000,
  "exp": 1700003600
}
```

---

## Scripts

| Command | Description |
|---|---|
| `bun run dev` | Start with hot reload |
| `bun run start` | Start production |
| `bun run db:generate` | Generate Prisma client |
| `bun run db:push` | Sync schema to DB |
| `bun run db:migrate` | Create migration files (dev) |
| `bun run db:studio` | Open Prisma Studio |

---

## Security Notes

- File type validated at **both** Multer and StorageService layers (defense in depth)
- Client filename is **never used** — UUID generated server-side
- `image_key` (internal MinIO path) is **never returned** in API responses
- JWT validated locally using shared secret — no runtime call to auth-service
- All SQL queries via Prisma ORM — no raw SQL, no injection surface
- `readOnlyRootFilesystem: true` in Kubernetes pod spec
- Non-root container user (UID 1001) in both Docker and Kubernetes

---

## 📊 Observability

### Arsitektur

```
┌──────────────────────────────────────────────────────────┐
│                   book-service :8000                      │
│                                                          │
│  /metrics  ──────────────────────────► Prometheus        │
│  stdout (JSON logs) ─────► Alloy ───► Loki               │
│  OTLP traces (gRPC) ─────► Alloy ───► Tempo              │
└──────────────────────────────────────────────────────────┘
                                             │
                                             ▼
                                         Grafana :3001
                              (metrics + logs + traces correlated)
```

### Signal Pipeline

| Signal | Diproduksi oleh | Collector | Storage |
|---|---|---|---|
| **Metrics** | `prom-client` → `/metrics` | Prometheus scrape | Prometheus TSDB |
| **Logs** | `Winston` JSON → stdout | Alloy Docker scrape | Loki |
| **Traces** | `OpenTelemetry` → OTLP/gRPC | Alloy OTLP receiver | Tempo |

### Prometheus Metrics

| Metric | Type | Labels | Deskripsi |
|---|---|---|---|
| `http_requests_total` | Counter | `method`, `route`, `status_code` | Total HTTP requests |
| `http_request_duration_seconds` | Histogram | `method`, `route`, `status_code` | Request latency |
| `http_requests_in_flight` | Gauge | `method`, `route` | Active requests |
| `book_operations_total` | Counter | `operation`, `status` | CRUD operations |
| `storage_operations_total` | Counter | `operation`, `status` | MinIO upload/delete |
| `storage_operation_duration_seconds` | Histogram | `operation` | MinIO latency |
| `storage_upload_bytes` | Histogram | — | Upload size distribution |

---

### Service URLs

| Service | URL | Credentials |
|---|---|---|
| **Book API** | http://localhost:8000 | — |
| **MinIO Console** | http://localhost:9001 | minioadmin / minioadmin |
| **Grafana** | http://localhost:3001 | admin / admin |
| **Prometheus** | http://localhost:9090 | — |
| **Alloy UI** | http://localhost:12345 | — |

### Boot Sequence

```
[entrypoint] Syncing database schema...
🚀  Your database is now in sync with your Prisma schema.
[entrypoint] Starting server...
[Tracer] OpenTelemetry SDK started → http://alloy:4317
{"message":"db_connected","service":"book-service"}
{"message":"server_started","port":8000}
```

### MinIO Bucket Init

Service `minio-init` otomatis membuat bucket `books` dan set access policy ke `public` saat pertama kali dijalankan. Bucket public artinya image URL bisa diakses langsung tanpa pre-signed token.

---

## Grafana — Menggunakan Dashboard

### Pre-built Dashboard

Grafana auto-provisions dashboard **"Book Service — Overview"** saat boot.

`Grafana → Dashboards → Book Service → Book Service — Overview`

Panels yang tersedia:
- Request rate, error rate, p95 latency, in-flight requests
- Request rate per route
- Book CRUD operations breakdown
- MinIO upload/delete operations
- MinIO upload latency (p95)
- Upload size distribution
- Live log stream dari Loki

### Explore — Logs

```logql
# Semua log book-service
{service_name="book_service"}

# Hanya error
{service_name="book_service"} | json | level="error"

# Trace ke log berdasarkan trace_id
{service_name="book_service"} | json | trace_id="<id>"
```

### Explore — Traces

```
Grafana → Explore → datasource: Tempo
Service Name: book-service
```

Dari span manapun → klik **"Logs for this span"** → langsung jump ke Loki log yang berkorelasi.

### Useful PromQL Queries

```promql
# Request rate per route
sum(rate(http_requests_total{service="book-service"}[1m])) by (route, method)

# MinIO upload success rate
rate(storage_operations_total{operation="upload", status="success"}[5m])

# MinIO upload p95 latency (ms)
histogram_quantile(0.95, sum(rate(storage_operation_duration_seconds_bucket{operation="upload"}[5m])) by (le)) * 1000

# Average upload size (bytes)
histogram_quantile(0.50, sum(rate(storage_upload_bytes_bucket[5m])) by (le))

# Book creation rate
rate(book_operations_total{operation="create", status="success"}[5m])
```