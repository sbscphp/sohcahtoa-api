# Architecture

**Analysis Date:** 2026-02-04

## Pattern Overview

**Overall:** Microservices with API Gateway Pattern

**Key Characteristics:**
- Polyglot microservices (8 independent services + 3 shared packages)
- API Gateway as single entry point for client requests
- Event-driven inter-service communication via Kafka
- Service-specific databases (data isolation per service)
- Shared types and utilities for consistency
- TypeScript + Express across all services
- Prisma ORM for database access

## Layers

**API Gateway Layer:**
- Purpose: Single entry point, request routing, API documentation, cross-cutting concerns
- Location: `apps/api-gateway/src/index.ts`
- Contains: HTTP proxy middleware, health checks, Scalar API docs setup
- Depends on: All downstream services via HTTP proxy
- Used by: External clients and frontend applications

**Service Layer (Business Domain):**
- Purpose: Domain-specific business logic and workflows
- Location: `apps/{service}/src/` (auth-service, transaction-service, payment-service, etc.)
- Contains: Controllers, routes, services, configuration
- Depends on: Shared middleware, shared types, shared utils, Prisma, Kafka, Redis
- Used by: API Gateway and other services via event publishing

**Controller/Route Layer:**
- Purpose: HTTP request handling and routing
- Location: `apps/{service}/src/controllers/` and `apps/{service}/src/routes/`
- Contains: Express route definitions, request validation, response formatting
- Depends on: Service layer business logic
- Used by: Express application setup

**Service/Business Logic Layer:**
- Purpose: Core business logic, data validation, external integrations
- Location: `apps/{service}/src/services/`
- Contains: Business rules, Prisma queries, Kafka event publishing, third-party API calls
- Depends on: Database (Prisma), Redis, Kafka, shared utilities
- Used by: Controllers and other services via events

**Data Access Layer:**
- Purpose: Database interaction
- Location: `apps/{service}/src/config/database.ts` (Prisma client)
- Contains: Prisma client initialization, query logging
- Depends on: Database connection
- Used by: All service layer classes

**Configuration Layer:**
- Purpose: Service initialization and external service connections
- Location: `apps/{service}/src/config/` (kafka.ts, redis.ts, database.ts, email.ts)
- Contains: Kafka producer/consumer setup, database connections, external service clients
- Depends on: Environment variables
- Used by: Service initialization in index.ts

**Shared Infrastructure:**
- Purpose: Cross-cutting concerns reused across services
- Location: `packages/shared-types/`, `packages/shared-middlewares/`, `packages/shared-utils/`
- Contains: TypeScript interfaces, middleware functions, utility functions, validation logic
- Depends on: Nothing (foundational)
- Used by: All services and gateway

## Data Flow

**User Registration Flow:**

1. Client sends POST request to `/api/auth/signup` via Gateway
2. API Gateway routes to Auth Service (`http://localhost:3001/api/auth/signup`)
3. Auth Controller receives request, validates input using shared validators
4. Auth Service executes signup logic:
   - Validates email/phone/password strength
   - Checks for duplicate users in database (Prisma)
   - Hashes password and creates user record with related records (profile, credentials, kyc)
   - Publishes `USER_REGISTERED` event to Kafka
5. Other services (Notification, Audit) consume event via Kafka subscribers
6. Response returned to client with userId and status

**Inter-Service Communication (Async):**

1. Auth Service publishes event: `USER_REGISTERED`
   - Topic: `user.registered`
   - Payload: `DomainEvent` with userId, email, timestamp, etc.
2. Kafka persists message by event type topic
3. Interested services (Notification, Audit, Admin) subscribed to topics consume:
   - Notification Service: sends welcome email/SMS
   - Audit Service: logs user registration
   - Compliance Service: initiates AML checks
4. Each service independently processes and updates its database

**Transaction Processing Flow:**

1. Client requests transaction via `/api/transactions` → Gateway → Transaction Service
2. Transaction Service validates request, creates transaction record (status: DRAFT)
3. Transaction Service publishes `TRANSACTION_CREATED` event
4. Compliance Service consumes event, performs AML checks
5. Document Service consumes event, tracks document uploads
6. Payment Service waits for completion before processing deposits
7. Transaction moves through states: AWAITING_VERIFICATION → VERIFICATION_IN_PROGRESS → VERIFICATION_COMPLETED

**State Management:**

- Per-service persistent state: PostgreSQL (via Prisma)
- Session state: Redis (via Auth Service config/redis.ts)
- Transient distributed state: Kafka topics (event log)
- No shared database or centralized state store
- Eventual consistency model via event-driven updates

## Key Abstractions

**DomainEvent (Event-Driven Architecture):**
- Purpose: Represents something significant that happened in a service
- Examples: `USER_REGISTERED`, `TRANSACTION_CREATED`, `PAYMENT_CONFIRMED`
- Pattern: Defined in `packages/shared-types/src/events.ts`
- Published by services, consumed by interested services
- Guarantees: Once published, can be consumed multiple times

**ServiceName Enum:**
- Purpose: Identify services in logs and headers
- Examples: `ServiceName.AUTH`, `ServiceName.TRANSACTION`, `ServiceName.PAYMENT`
- Used in logging context, Kafka group IDs, correlation tracking

**API Response Wrapper:**
- Purpose: Standardize all HTTP responses
- Pattern: `{ success: boolean, data?: T, error?: {...}, metadata?: {...} }`
- Used consistently across all services via `@fx-platform/shared-utils`

**AuthRequest (Extended Express Request):**
- Purpose: Type-safe authenticated request handling
- Pattern: Extends Express Request with `user` property containing JWT payload
- Used in protected routes like `/api/auth/logout`, `/api/payments/deposit`

**User Roles and Authorization:**
- Purpose: Role-based access control
- Enum values: `CUSTOMER`, `ADMIN`, `COMPLIANCE_OFFICER`, `OPERATIONS`, `SUPER_ADMIN`
- Enforced via `authorize()` middleware in protected routes
- Used in Admin Service for resource access control

## Entry Points

**API Gateway:**
- Location: `apps/api-gateway/src/index.ts`
- Triggers: Server startup with `npm run dev` or deployment
- Responsibilities: Listen on port 3000, proxy requests to backend services, serve API docs

**Auth Service:**
- Location: `apps/auth-service/src/index.ts`
- Triggers: Server startup
- Responsibilities: Initialize Kafka/Redis/Prisma, handle authentication flows, publish user events

**Transaction Service:**
- Location: `apps/transaction-service/src/index.ts`
- Triggers: Server startup
- Responsibilities: Initialize Kafka/Prisma, manage transaction lifecycle, publish transaction events

**Payment Service:**
- Location: `apps/payment-service/src/index.ts`
- Triggers: Server startup
- Responsibilities: Handle payments, exchange rates, settlement calculations

**Admin Service:**
- Location: `apps/admin-service/src/index.ts`
- Triggers: Server startup
- Responsibilities: User/role/department management, admin operations, authorization checks

**Compliance Service:**
- Location: `apps/compliance-service/src/index.ts`
- Triggers: Server startup
- Responsibilities: AML checks, compliance reviews, transaction monitoring

**Document Service:**
- Location: `apps/document-service/src/index.ts`
- Triggers: Server startup
- Responsibilities: Document upload/verification, KYC document handling

**Notification Service:**
- Location: `apps/notification-service/src/index.ts`
- Triggers: Server startup
- Responsibilities: Email/SMS delivery, event-driven notifications

**Audit Service:**
- Location: `apps/audit-service/src/index.ts`
- Triggers: Server startup
- Responsibilities: Audit trail logging, compliance auditing

## Error Handling

**Strategy:** Centralized error handler middleware with typed custom errors

**Patterns:**

- Custom error classes in `@fx-platform/shared-utils`:
  - `ValidationError` - Input validation failures
  - `UnauthorizedError` - Authentication/authorization failures
  - `NotFoundError` - Resource not found
  - `DuplicateError` - Unique constraint violations
  - `AppError` - Generic application errors

- Error handler middleware catches all errors and:
  - Logs with context (service name, request ID, error details)
  - Converts to standardized JSON response: `{ success: false, error: { code, message, details } }`
  - Returns appropriate HTTP status codes (400, 401, 404, 409, 500)
  - Preserves correlation ID in response headers

- Service layer throws custom errors, controllers catch and pass to error handler via `next(error)`

## Cross-Cutting Concerns

**Logging:**
- Framework: winston via `createLogger()` utility in `@fx-platform/shared-utils`
- Each service creates logger with `ServiceName` enum for context
- Patterns: Service names in all logs, correlation ID included, structured logging for JSON output

**Validation:**
- Email validation: `validateEmail()` in shared-utils
- Phone validation: `validatePhoneNumber()` in shared-utils
- Password strength: `validatePasswordStrength()` in shared-utils
- Custom DTO validation in services before Prisma operations

**Authentication:**
- JWT tokens with payload: `{ userId, email, role, sessionId }`
- Access tokens (short-lived) and refresh tokens (long-lived)
- Middleware `authenticate()` extracts and validates JWT from Authorization header
- Session tracking via Redis for logout enforcement

**Authorization:**
- Middleware `authorize()` checks user role against required roles
- Used in protected routes: `router.post('/logout', authenticate, authController.logout)`
- Admin Service enforces: `authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN, ...)`

**Correlation Tracking:**
- Middleware `correlationIdMiddleware` generates or passes through correlation ID
- Included in all logs for request tracing across services
- Added to proxy headers for downstream service tracing

**Rate Limiting:**
- Middleware `apiRateLimiter` on API Gateway for general endpoints
- Stronger `authRateLimiter` on Auth Service endpoints (signup, login, OTP)
- Prevents brute force and DDoS attacks

---

*Architecture analysis: 2026-02-04*
