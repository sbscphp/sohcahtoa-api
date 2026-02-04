# Codebase Structure

**Analysis Date:** 2026-02-04

## Directory Layout

```
sochatoa-api/
├── apps/                           # Microservices (8 independent services)
│   ├── api-gateway/                # Single entry point, request routing
│   ├── auth-service/               # Authentication & KYC verification
│   ├── transaction-service/        # Transaction management
│   ├── payment-service/            # Payment processing & exchange rates
│   ├── compliance-service/         # AML checks & compliance reviews
│   ├── document-service/           # Document uploads & verification
│   ├── notification-service/       # Email/SMS delivery
│   ├── audit-service/              # Audit logging
│   └── admin-service/              # Admin operations & user management
├── packages/                       # Shared code
│   ├── shared-types/               # TypeScript interfaces & enums
│   ├── shared-middlewares/         # Express middleware
│   └── shared-utils/               # Utility functions
├── k8s/                            # Kubernetes manifests
├── helm/                           # Helm charts
├── .planning/                      # GSD planning documents
├── package.json                    # Monorepo workspace config
├── pnpm-workspace.yaml             # pnpm workspace definition
├── tsconfig.json                   # Root TypeScript config
├── turbo.json                      # Turbo build pipeline config
├── docker-compose.yml              # Local development compose
└── .env                            # Environment variables
```

## Directory Purposes

**apps/ (Microservices):**
- Purpose: Independent services with separate databases, business logic, and ports
- Contains: 8 production services + 1 API Gateway
- Key files: `src/index.ts` (entry point), `package.json`, `prisma/schema.prisma`

**apps/api-gateway/:**
- Purpose: Single HTTP entry point, request routing, API documentation
- Contains: HTTP proxy middleware, health checks, Scalar API docs
- Key files: `src/index.ts`
- Port: 3000 (default)

**apps/auth-service/:**
- Purpose: User registration, login, KYC verification, session management
- Contains: BVN/Passport verification, OTP flows, JWT token generation
- Key files: `src/controllers/auth.controller.ts`, `src/services/auth.service.ts`, `src/services/bvn.service.ts`, `src/services/passport.service.ts`
- Port: 3001 (default)
- Database: PostgreSQL with Prisma (auth-specific schema)

**apps/transaction-service/:**
- Purpose: Foreign exchange transactions (PTA, BTA, School Fees, Medical, Remittances)
- Contains: Transaction CRUD, status management, document tracking
- Key files: `src/controllers/transaction.controller.ts`, `src/services/transaction.service.ts`
- Port: 3003 (default)
- Database: PostgreSQL with Prisma

**apps/payment-service/:**
- Purpose: Deposit processing, exchange rate calculation, settlement
- Contains: Exchange rate APIs, payment method handling, settlement logic
- Key files: `src/services/payment.service.ts`
- Port: 3004 (default)
- Database: PostgreSQL with Prisma

**apps/compliance-service/:**
- Purpose: AML checks, compliance reviews, transaction monitoring
- Contains: AML screening, suspicious activity flagging, compliance reports
- Key files: `src/config/`, `src/services/`
- Port: 3005 (default)
- Database: PostgreSQL with Prisma

**apps/document-service/:**
- Purpose: Document upload, storage, verification
- Contains: File handling, KYC document management, verification status tracking
- Key files: `src/config/`, `src/services/`
- Port: 3002 (default)
- Database: PostgreSQL with Prisma

**apps/notification-service/:**
- Purpose: Email and SMS delivery
- Contains: Email service integration, SMS gateway, notification templates
- Key files: `src/index.ts`, `src/config/email.ts`
- Port: 3006 (default)
- Database: None (event-driven, no persistent data store)

**apps/audit-service/:**
- Purpose: Audit trail logging, compliance auditing
- Contains: Audit event logging, audit report generation
- Key files: `src/index.ts`, `src/services/`
- Port: 3008 (default)
- Database: PostgreSQL with Prisma

**apps/admin-service/:**
- Purpose: Admin operations, user/role/department management
- Contains: RBAC setup, admin user CRUD, customer management, authorization
- Key files: `src/controllers/admin.controller.ts`, `src/routes/admin.routes.ts`, `src/routes/user-management.routes.ts`, `src/dto/user-management.dto.ts`
- Port: 3007 (default)
- Database: PostgreSQL with Prisma

**packages/shared-types/:**
- Purpose: Shared TypeScript interfaces and enums
- Contains: Enums (UserRole, TransactionType, PaymentStatus, etc.), interfaces (DomainEvent, ApiResponse, JwtPayload)
- Key files: `src/auth.ts`, `src/transaction.ts`, `src/payment.ts`, `src/compliance.ts`, `src/events.ts`, `src/common.ts`
- Used by: All services for type safety

**packages/shared-middlewares/:**
- Purpose: Express middleware shared across services
- Contains: Authentication, authorization, error handling, rate limiting, request logging, validation
- Key files: `src/auth.ts`, `src/error-handler.ts`, `src/rate-limiter.ts`, `src/request-logger.ts`, `src/validator.ts`
- Key exports:
  - `authenticate()` - JWT validation middleware
  - `authorize()` - Role-based access control
  - `errorHandler()` - Centralized error handling
  - `requestLogger()` - HTTP request logging
  - `correlationIdMiddleware` - Request tracking
  - `apiRateLimiter` - Global rate limiting
  - `authRateLimiter` - Stronger rate limiting for auth endpoints

**packages/shared-utils/:**
- Purpose: Utility functions and helpers
- Contains: Logger creation, JWT helpers, password hashing, validators, error classes, response formatting, email service
- Key files: `src/logger.ts`, `src/jwt.ts`, `src/password.ts`, `src/validators.ts`, `src/errors.ts`, `src/response.ts`, `src/email.ts`, `src/scalar.ts`
- Key exports:
  - `createLogger()` - Winston logger factory
  - `generateAccessToken()`, `generateRefreshToken()` - JWT creation
  - `hashPassword()`, `comparePassword()` - Password utilities
  - `validateEmail()`, `validatePhoneNumber()` - Input validators
  - `successResponse()` - Standard response formatter
  - Custom error classes: `ValidationError`, `UnauthorizedError`, `NotFoundError`, `DuplicateError`
  - `setupScalar()` - API documentation setup (Swagger via Scalar)

## Key File Locations

**Entry Points:**
- `apps/api-gateway/src/index.ts` - API Gateway server startup
- `apps/{service}/src/index.ts` - Individual service startup
- `packages/shared-types/src/index.ts` - Shared type exports
- `packages/shared-middlewares/src/index.ts` - Shared middleware exports
- `packages/shared-utils/src/index.ts` - Shared utility exports

**Configuration:**
- `package.json` - Monorepo workspace configuration (root and per-service)
- `tsconfig.json` - TypeScript compilation settings
- `turbo.json` - Build pipeline and task dependencies
- `docker-compose.yml` - Local services (PostgreSQL, Kafka, Redis)
- `.env` - Environment variables (loaded by dotenv)
- `apps/{service}/.env` - Service-specific env vars (if applicable)

**Core Logic:**
- `apps/{service}/src/services/` - Business logic classes
- `apps/{service}/src/controllers/` - HTTP request handlers
- `apps/{service}/src/routes/` - Express route definitions
- `apps/{service}/src/config/` - Service initialization (database, Kafka, Redis, email)

**Database:**
- `apps/{service}/prisma/schema.prisma` - Service's data model
- `apps/{service}/prisma/migrations/` - Database migrations

**Testing:**
- Not detected - Test infrastructure not yet visible in current codebase

## Naming Conventions

**Files:**
- Service entry: `index.ts`
- Controllers: `{entity}.controller.ts` (e.g., `auth.controller.ts`)
- Services: `{entity}.service.ts` (e.g., `auth.service.ts`)
- Routes: `{entity}.routes.ts` (e.g., `auth.routes.ts`)
- DTOs: `{entity}.dto.ts` (e.g., `user-management.dto.ts`)
- Config: `{service}.ts` (e.g., `database.ts`, `kafka.ts`, `redis.ts`)

**Directories:**
- Domain services: lowercase with hyphens (e.g., `auth-service`, `transaction-service`)
- Feature directories: lowercase (e.g., `controllers/`, `services/`, `routes/`, `config/`, `dto/`, `validations/`)

**Enums:**
- UPPERCASE_SNAKE_CASE values (e.g., `UserRole.CUSTOMER`, `TransactionStatus.DRAFT`)

**Classes/Interfaces:**
- PascalCase (e.g., `AuthController`, `AuthService`, `SignupRequest`)

**Functions/Variables:**
- camelCase (e.g., `validateEmail()`, `publishEvent()`, `authService`)

## Where to Add New Code

**New Feature (e.g., new business logic):**
- Primary code: Create new service in `apps/{appropriate-service}/src/services/{feature}.service.ts`
- Routes: Add endpoint to `apps/{service}/src/routes/{feature}.routes.ts`
- Controller: Add handler in `apps/{service}/src/controllers/{feature}.controller.ts`
- Types: Add interfaces to `packages/shared-types/src/{domain}.ts`
- Tests: Create `apps/{service}/src/{feature}.service.test.ts` (if test infrastructure added)

**New Microservice:**
- Create `apps/new-service/` directory
- Copy structure from `apps/auth-service/` as template
- Create `apps/new-service/package.json` with service name and dependencies
- Create `apps/new-service/prisma/schema.prisma` with data models
- Create `apps/new-service/src/index.ts` with Express app and initialization
- Add service routing to `apps/api-gateway/src/index.ts` proxy middleware
- Add ServiceName enum value to `packages/shared-types/src/common.ts`

**New Shared Utility:**
- Type definitions: `packages/shared-types/src/{domain}.ts` (e.g., `packages/shared-types/src/payment.ts`)
- Middleware: `packages/shared-middlewares/src/{feature}.ts` (e.g., `packages/shared-middlewares/src/auth.ts`)
- Utils/helpers: `packages/shared-utils/src/{feature}.ts` (e.g., `packages/shared-utils/src/validators.ts`)
- Export from respective `index.ts` file

**New API Endpoint:**
- Determine which service owns the domain (auth, transaction, payment, etc.)
- Add handler method to service class: `apps/{service}/src/services/{entity}.service.ts`
- Add controller method: `apps/{service}/src/controllers/{entity}.controller.ts`
- Add route with JSDoc/Swagger: `apps/{service}/src/routes/{entity}.routes.ts`
- Export route in `apps/{service}/src/index.ts` under `app.use()`

**New Middleware:**
- Create in `packages/shared-middlewares/src/{feature}.ts`
- Export from `packages/shared-middlewares/src/index.ts`
- Add to service initialization in `apps/{service}/src/index.ts`

## Special Directories

**logs/:**
- Purpose: Runtime logs generated by services
- Generated: Yes (created on first run)
- Committed: No (.gitignore excludes)
- Location: `apps/{service}/logs/`

**dist/:**
- Purpose: Compiled JavaScript output from TypeScript
- Generated: Yes (by `npm run build`)
- Committed: No (.gitignore excludes)
- Location: `apps/{service}/dist/`, `packages/{package}/dist/`

**node_modules/:**
- Purpose: Installed dependencies
- Generated: Yes (by `pnpm install`)
- Committed: No (.gitignore excludes)
- Location: Root and service-specific if using local dependencies

**k8s/:**
- Purpose: Kubernetes manifests for production deployment
- Generated: No (manually maintained)
- Committed: Yes
- Contents: Service, Deployment, ConfigMap, Secret definitions for each app

**helm/:**
- Purpose: Helm charts for Kubernetes package management
- Generated: No (manually maintained)
- Committed: Yes
- Contents: Chart metadata, templates, values for deployment

**.planning/codebase/:**
- Purpose: GSD codebase analysis documents
- Generated: Yes (by `/gsd:map-codebase`)
- Committed: No (.planning/ auto-generated)
- Contents: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, CONCERNS.md, STACK.md, INTEGRATIONS.md

**prisma/migrations/:**
- Purpose: Database schema version control
- Generated: Yes (by `prisma migrate`)
- Committed: Yes
- Location: `apps/{service}/prisma/migrations/`
- Contains: SQL migration files timestamped by Prisma

---

*Structure analysis: 2026-02-04*
