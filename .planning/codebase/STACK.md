# Technology Stack

**Analysis Date:** 2026-02-04

## Languages

**Primary:**
- TypeScript 5.3.2 - All microservices and shared packages
- JavaScript (Node.js) - Runtime execution

**Secondary:**
- SQL - PostgreSQL schemas managed by Prisma migrations

## Runtime

**Environment:**
- Node.js 18-slim (Alpine Linux)
  - Minimum version: 18.0.0
  - Docker image: `node:18-slim`

**Package Manager:**
- pnpm 8.10.0 (configured in `package.json` engines field)
- Lockfile: `pnpm-lock.yaml` (present)

## Frameworks

**Web Framework:**
- Express 4.18.2 - HTTP server for all microservices
  - Middleware: helmet, cors, express-rate-limit (API gateway)
  - Request validation: express-validator (admin-service)
  - File upload: multer (document-service)

**Build/Development:**
- Turbo 1.13.4 - Monorepo task orchestration
- tsc (TypeScript Compiler) - Production builds
- tsx 4.6.2 - Development watch mode and execution

**API Documentation:**
- Swagger JSDoc 6.2.8 - API documentation generation
- Scalar Express API Reference 0.6.0 - Interactive API docs

**ORM/Database:**
- Prisma 5.7.0 - Database abstraction layer
  - Client: `@prisma/client` 5.7.0
  - Schema management: migrations in `apps/*/prisma/migrations/`

## Key Dependencies

**Authentication & Security:**
- jsonwebtoken 9.0.2 - JWT token generation and verification
- bcryptjs 2.4.3 - Password hashing (shared-utils, auth-service)
- uuid 9.0.1 - Unique identifier generation

**Messaging & Events:**
- kafkajs 2.2.4 - Apache Kafka consumer/producer for event-driven architecture
  - Used by: auth-service, transaction-service, payment-service, notification-service, compliance-service, audit-service, admin-service

**Data Storage Clients:**
- ioredis 5.3.2 - Redis client for caching
  - Used by: auth-service, payment-service

**HTTP Client:**
- axios 1.6.2 - HTTP requests for inter-service communication
  - Used by: admin-service, payment-service, notification-service, compliance-service

**Email & Notifications:**
- nodemailer 6.9.7 - SMTP email sending (notification-service, shared-utils, auth-service)
- Termii SMS API - SMS integration via axios (notification-service)

**Image Processing:**
- sharp 0.33.0 - Image processing and optimization (document-service)

**Logging:**
- winston 3.11.0 - Structured logging (shared-utils)

**Middleware & Utilities:**
- dotenv 16.3.1 - Environment variable loading
- cors 2.8.5 - Cross-origin resource sharing
- helmet 7.1.0 - HTTP security headers

**Code Generation:**
- qrcode 1.5.3 - QR code generation (transaction-service)

## Configuration

**Environment:**
- `.env` and `.env.example` files at project root
- Loaded via dotenv in each service's `src/index.ts`
- Each microservice has independent database via PostgreSQL

**Build Configuration:**
- `tsconfig.json` (root) - Shared TypeScript configuration
  - Target: ES2022
  - Module: commonjs
  - Strict mode enabled
  - Declaration maps and source maps enabled
- `turbo.json` (root) - Turbo task pipeline configuration

**Docker:**
- `docker-compose.yml` - Multi-stage builds with separate services
- Individual `Dockerfile` per microservice using Node 18-slim
- Dockerfile pattern: Copy workspace → Install dependencies → Build shared packages → Generate Prisma client → Build service

## Platform Requirements

**Development:**
- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Docker and Docker Compose (for local infrastructure)
- PostgreSQL 15 (via Docker)
- Redis 7 (via Docker)
- Apache Kafka 3.7.0 (via Docker)

**Production:**
- Node.js 18-slim runtime
- Docker container orchestration (Kubernetes-ready, see `k8s/` directory)
- PostgreSQL 15
- Redis 7
- Apache Kafka 3.7.0

---

*Stack analysis: 2026-02-04*
