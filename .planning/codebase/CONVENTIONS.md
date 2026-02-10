# Coding Conventions

**Analysis Date:** 2026-02-04

## Naming Patterns

**Files:**
- Services: `*.service.ts` - `PaymentService`, `AuthService`, `AdminService` located in `src/services/`
- Controllers: `*.controller.ts` - `PaymentController`, `AuthController` located in `src/controllers/`
- Routes: `*.routes.ts` - `auth.routes.ts`, `payment.routes.ts` located in `src/routes/`
- DTOs: `*.dto.ts` - `user-management.dto.ts` located in `src/dto/`
- Configuration: `*.ts` in `src/config/` - `database.ts`, `kafka.ts`, `redis.ts`, `email.ts`
- Middleware: `*.ts` in `src/middlewares/` or `packages/shared-middlewares/src/`
- Types: `*.d.ts` or shared in `packages/shared-types/src/`

**Functions:**
- camelCase for all function names: `getExchangeRate()`, `initiateDeposit()`, `confirmDeposit()`
- Async functions use async keyword: `async getSettlement()`
- Private/internal functions use camelCase with underscore prefix not used
- Handler functions: `getDashboard`, `approveTransaction`, `rejectTransaction`

**Variables:**
- camelCase for all variables and constants: `cacheKey`, `rateRecord`, `exchangeRate`, `OTP_EXPIRY_MINUTES`
- Constants use UPPER_SNAKE_CASE: `OTP_EXPIRY_MINUTES`, `MAX_LOGIN_ATTEMPTS`, `LOCK_DURATION_MINUTES`
- Enums use PascalCase values: `ServiceName.AUTH`, `ErrorCode.UNAUTHORIZED`, `PaymentStatus.PENDING`

**Types:**
- Classes use PascalCase: `PaymentService`, `AuthService`, `PaymentController`
- Interfaces use PascalCase with `I` prefix not used: `ApiResponse<T>`, `PaginatedResponse<T>`, `LoginResponse`
- Type aliases use PascalCase: `ReviewPayload`, `SettlePayload`, `CreateCustomerFlagPayload`
- DTOs use PascalCase with Dto suffix: `CreateAdminUserDto`, `CreateRoleDto`, `UpdateRoleDto`
- Enums use PascalCase: `ServiceName`, `ErrorCode`, `DocumentType`, `VerificationStatus`

## Code Style

**Formatting:**
- Tool: Prettier v3.1.0
- Config file: `.prettierrc`
- Settings:
  - Semi-colons: enabled (`"semi": true`)
  - Trailing commas: ES5 style (`"trailingComma": "es5"`)
  - Single quotes: enabled (`"singleQuote": true`)
  - Print width: 100 characters (`"printWidth": 100`)
  - Tab width: 2 spaces (`"tabWidth": 2`)
  - Arrow function parentheses: always (`"arrowParens": "always"`)

**Linting:**
- No ESLint config found in root; linting not configured project-wide
- Services have their own tsconfig.json extending root config

## Import Organization

**Order:**
1. External dependencies (express, cors, helmet, dotenv)
2. Prisma/database imports
3. Redis/cache imports
4. Kafka/event imports
5. Shared workspace imports (@fx-platform/shared-*)
6. Local relative imports (./config, ./services, ./controllers, ./routes)

**Path Aliases:**
- Workspace packages use @fx-platform/ prefix:
  - `@fx-platform/shared-types` - Type definitions and enums
  - `@fx-platform/shared-utils` - Utility functions and helpers
  - `@fx-platform/shared-middlewares` - Express middlewares
- Relative imports use `./` or `../` format
- Example from `payment.controller.ts`: `import paymentService from '../services/payment.service';`

## Error Handling

**Patterns:**
- Custom error classes extend `AppError` base class
- Specific error types: `BadRequestError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ValidationError`, `InternalError`, `ServiceUnavailableError`, `RateLimitError`, `DuplicateError`
- Each error class maps to ErrorCode enum
- Throw errors with specific message and optional details: `throw new NotFoundError('Settlement not found')`
- Controllers wrap try-catch and pass errors to Express error handler: `try { ... } catch (error) { next(error); }`
- Global error handler in middleware: `errorHandler(logger)` handles both AppError and generic errors

**Error Response Format:**
```typescript
{
  success: false,
  error: {
    code: ErrorCode,
    message: string,
    details?: any
  },
  metadata: { timestamp, requestId, version }
}
```

## Logging

**Framework:** Winston v4.9.0 (from `packages/shared-utils/src/logger.ts`)

**Patterns:**
- Logger created per service: `const logger = createLogger(ServiceName.AUTH);`
- Log levels: error, warn, info, http, debug
- HTTP requests logged with: method, url, status, duration, ip, userAgent
- Errors logged with full context: code, message, statusCode, details, stack
- Request logger attached as middleware: `app.use(requestLogger(logger));`
- Logs written to files in `logs/` directory:
  - `{serviceName}-error.log` - errors only
  - `{serviceName}-all.log` - all log levels
- Example from auth service: `logger.error('Failed to start server:', error);`

## Comments

**When to Comment:**
- Comment requirement blocks in controllers (marked with JSDoc style): `/** REVIEW (Requirement) */`
- Comments for TODO items indicating future work
- Comments for complex business logic (e.g., transaction approval flow)
- Comments for API integration notes (TODO comments referencing external APIs)

**JSDoc/TSDoc:**
- Swagger/OpenAPI comments for API endpoints: `/** @swagger */` blocks in route files
- Limited JSDoc usage; most code is self-documenting through naming
- Example in `payment.routes.ts`:
  ```typescript
  router.post('/initialize', authenticate, paymentController.initializePayment);
  ```

## Function Design

**Size:**
- Service methods average 15-40 lines
- Controller methods average 8-12 lines (most delegate to services)
- Largest files: auth.service.ts (694 lines), user-management.service.ts (656 lines)

**Parameters:**
- DTOs used for complex input validation: `CreateAdminUserDto`, `CreateRoleDto`
- Request bodies destructured in controllers: `const { reason } = req.body;`
- User context extracted from request: `const userId = (req as any).user?.userId;` or `const adminId = (req as any).user?.userId as string;`

**Return Values:**
- Services return typed responses or throw errors
- Controllers return `successResponse(data)` or pass error to next()
- Async/await pattern used throughout
- Example: `return { userId: string; message: string }`

## Module Design

**Exports:**
- Services exported as default: `export default new PaymentService();`
- Controllers exported as default: `export default new PaymentController();`
- Routes exported as default Router: `export default router;`
- Shared utilities use named exports in barrel file: `export * from './logger';`, `export * from './errors';`

**Barrel Files:**
- `packages/shared-utils/src/index.ts` exports all utilities
- Used to simplify imports across workspace
- No barrel files in individual services (each service self-contained)

## TypeScript

**Compiler Options (tsconfig.json):**
- Target: ES2022
- Module: commonjs
- Strict mode: enabled
- esModuleInterop: true
- Declaration maps: enabled
- Source maps: enabled
- Output dir: ./dist
- Root dir: ./src
- Module resolution: node

**Type Annotations:**
- Type annotations on class properties: `private code: ErrorCode`
- Type annotations on function parameters and returns
- Interfaces used for complex types: `ApiResponse<T>`, `PaginatedResponse<T>`
- Type aliases for payload objects: `type ReviewPayload = { ... }`
- Generic types used in response wrappers

## Class Design

**Pattern:**
- Controllers implemented as classes instantiated with `new`
- Services implemented as classes instantiated with `new`
- Single instance exported as default: `export default new PaymentController();`
- Methods are instance methods (not static)
- Controllers use arrow functions for methods: `getDashboard = async (...) => { ... }`
- Services use regular methods: `async getExchangeRate(...) { ... }`

---

*Convention analysis: 2026-02-04*
