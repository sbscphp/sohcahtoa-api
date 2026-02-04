# External Integrations

**Analysis Date:** 2026-02-04

## APIs & External Services

**SMS Service:**
- Termii - SMS delivery provider
  - SDK/Client: axios HTTP client
  - Endpoint: `https://api.termii.com/api/sms/send`
  - Auth: `TERMII_API_KEY` environment variable
  - Usage: `/apps/notification-service/src/index.ts` (sendSMS function)
  - Configuration: `TERMII_SENDER_ID` env var for sender identification
  - Purpose: Send SMS notifications on events (USER_REGISTERED, TRANSACTION_CREATED, DEPOSIT_CONFIRMED, AML_FLAG_RAISED)

**Inter-Service Communication:**
- Service-to-service HTTP calls via axios
  - Admin service calls Transaction service: `PUT /api/transactions/{id}` for status updates
  - Admin service calls Payment service: `POST /api/payments/deposit/confirm` for deposit confirmations
  - Admin service to Auth service: Login, password reset via `auth.client.ts`
  - Admin service to Customer service: User queries via `customer.client.ts`
  - Configured via environment variables: `TRANSACTION_SERVICE_URL`, `PAYMENT_SERVICE_URL`, `AUTH_SERVICE_URL`, `CUSTOMER_SERVICE_URL`

## Data Storage

**Databases:**
- PostgreSQL 15-Alpine (multiple instances)
  - `postgres-auth` on port 5432 - auth_db (auth-service)
  - `postgres-transaction` on port 5433 - transaction_db (transaction-service)
  - `postgres-payment` on port 5434 - payment_db (payment-service)
  - `postgres-document` on port 5435 - document_db (document-service)
  - `postgres-compliance` on port 5436 - compliance_db (compliance-service)
  - `postgres-admin` on port 5437 - admin_db (admin-service)
  - `postgres-audit` on port 5438 - audit_db (audit-service)
  - Connection: PostgreSQL driver via Prisma ORM
  - Connection string format: `postgresql://postgres:password@host:port/db_name?schema=public`

**Cache:**
- Redis 7-Alpine on port 6379
  - Client: ioredis (Node.js Redis client)
  - Used by: auth-service, payment-service
  - Configuration: `REDIS_HOST`, `REDIS_PORT`, optional `REDIS_PASSWORD`
  - Purpose: Session caching, token blacklisting, rate limiting data

**File Storage:**
- Local filesystem only - No external object storage detected
  - Document service handles file uploads via multer middleware
  - Image processing via sharp library
  - No S3, GCS, or cloud storage integration

## Authentication & Identity

**Auth Provider:**
- Custom JWT-based authentication (no third-party OAuth)
  - Implementation: jsonwebtoken library (`@fx-platform/shared-utils`)
  - Tokens: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` environment variables
  - Location: `/apps/auth-service/` handles all auth flows
  - Services: User registration, login, password reset, KYC verification
  - Session storage: Redis (token blacklisting, session cache)

**Password Management:**
- bcryptjs for password hashing
- Email-based password reset flow with reset URL generation

## Monitoring & Observability

**Error Tracking:**
- Not detected - No Sentry, Rollbar, or similar integration

**Logs:**
- Winston logger (Node.js logging library)
  - Configured in: `/packages/shared-utils/src/logger.ts`
  - Service name based logging (ServiceName enum from shared-types)
  - Log levels: info, error, warn, debug
  - Structured logging with metadata
  - No external log aggregation (e.g., ELK, CloudWatch) detected

**Request Tracing:**
- Correlation ID middleware for request tracing
  - Location: `/packages/shared-middlewares/` (correlationIdMiddleware)
  - Propagated across service calls

## CI/CD & Deployment

**Hosting:**
- Docker containers with Docker Compose orchestration
- Kubernetes ready (k8s/ directory present)
- No cloud provider integration detected (AWS, GCP, Azure)

**CI Pipeline:**
- Not detected in codebase
- No GitHub Actions, GitLab CI, Jenkins, or similar configuration found
- Manual deployment via Docker Compose or Kubernetes manifests

## Environment Configuration

**Required env vars:**
- `NODE_ENV` - Application environment (development/production)
- `PORT` - Service port (varies per service: 3000-3008)

**Database:**
- `DATABASE_URL` - PostgreSQL connection string (per service)
- `POSTGRES_USER` - Default: "postgres"
- `POSTGRES_PASSWORD` - Default: "password" (dev only)

**Cache:**
- `REDIS_HOST` - Default: "localhost"
- `REDIS_PORT` - Default: 6379
- `REDIS_PASSWORD` - Optional

**Message Queue:**
- `KAFKA_BROKERS` - Kafka broker addresses (comma-separated)
  - Default: "localhost:9092"
  - Format: "host:port,host:port,..."
- `KAFKA_CLIENT_ID` - Client identifier (auth-service uses 'auth-service')
- `KAFKA_GROUP_ID` - Consumer group (auth-service uses 'auth-service-group')

**JWT/Security:**
- `JWT_ACCESS_SECRET` - Access token signing key
- `JWT_REFRESH_SECRET` - Refresh token signing key

**Email/SMTP:**
- `SMTP_HOST` - SMTP server hostname (e.g., smtp.gmail.com)
- `SMTP_PORT` - SMTP port (default: 587)
- `SMTP_USER` - SMTP authentication username
- `SMTP_PASSWORD` - SMTP authentication password
- `SMTP_SECURE` - TLS/SSL flag (default: false)
- `EMAIL_FROM` - Sender email address (default: "FX Platform <noreply@fxplatform.com>")

**SMS:**
- `TERMII_API_KEY` - Termii SMS provider API key
- `TERMII_SENDER_ID` - SMS sender identification

**External Services:**
- `AUTH_SERVICE_URL` - Auth service endpoint (default: http://localhost:3001)
- `TRANSACTION_SERVICE_URL` - Transaction service endpoint (default: http://localhost:3003)
- `PAYMENT_SERVICE_URL` - Payment service endpoint (default: http://localhost:3004)
- `DOCUMENT_SERVICE_URL` - Document service endpoint (default: http://localhost:3002)
- `COMPLIANCE_SERVICE_URL` - Compliance service endpoint (default: http://localhost:3005)
- `NOTIFICATION_SERVICE_URL` - Notification service endpoint (default: http://localhost:3006)
- `ADMIN_SERVICE_URL` - Admin service endpoint (default: http://localhost:3007)
- `AUDIT_SERVICE_URL` - Audit service endpoint (default: http://localhost:3008)
- `ADMIN_FRONTEND_URL` - Admin frontend URL for password reset links (default: http://localhost:3000)
- `CUSTOMER_SERVICE_URL` - Customer service endpoint (default: http://localhost:3002)

**Secrets location:**
- `.env` file (development only, not committed)
- Environment variables in Docker Compose service definitions
- Must be changed in production (migration path documented in comments)

## Webhooks & Callbacks

**Incoming:**
- Not detected - No webhook endpoints in API gateway or services

**Outgoing:**
- Password reset URL callback from admin-service to frontend:
  - Format: `${ADMIN_FRONTEND_URL}/reset-password`
  - Location: `/apps/admin-service/src/services/user-management.service.ts`
  - Used in password reset email notifications

**Event Publishing:**
- Kafka event publishing to event topics
  - Topics: USER_REGISTERED, TRANSACTION_CREATED, DEPOSIT_CONFIRMED, AML_FLAG_RAISED
  - Published by: auth-service, transaction-service, payment-service, compliance-service
  - Consumed by: notification-service and audit services
  - Location: Kafka producer calls in individual services (sendEvent pattern)

---

*Integration audit: 2026-02-04*
