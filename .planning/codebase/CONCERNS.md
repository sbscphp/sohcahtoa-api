# Codebase Concerns

**Analysis Date:** 2026-02-04

## Tech Debt

**Stub/Mock Implementations for External Services:**
- Issue: BVN verification, passport verification, and SMS delivery are not integrated with actual external services, using mock implementations instead
- Files: `apps/auth-service/src/services/bvn.service.ts`, `apps/auth-service/src/services/passport-verification.service.ts`, `apps/notification-service/src/index.ts`
- Impact: System cannot perform real KYC verification. All BVN and passport verifications return hardcoded mock data. SMS notifications are not sent (SMS service has no implementation).
- Fix approach: Integrate actual CBN TRMS API for BVN verification, implement OCR/document verification service for passport validation, and implement SMS delivery via Termii or alternative provider.

**Missing Service Integrations:**
- Issue: Passport verification service does not actually create verification requests in document service
- Files: `apps/auth-service/src/services/passport.service.ts` (lines 38-70)
- Impact: Passport verification flow is incomplete; document service integration is commented out and not functional
- Fix approach: Implement actual API call or Kafka event publishing to document service to trigger passport verification workflow

**Incomplete SMS OTP Implementation:**
- Issue: OTP sending only works for email; SMS sending has no implementation
- Files: `apps/auth-service/src/services/auth.service.ts` (line 548 TODO comment)
- Impact: Users cannot receive OTP via phone for signup verification, blocking phone-based verification flows
- Fix approach: Implement SMS delivery using Termii API integration with proper error handling and retry logic

## Known Bugs

**Debug Logging Left in Production Code:**
- Symptoms: Console debug output is printed to stdout in production services
- Files: `apps/admin-service/src/index.ts` (line 28), `apps/auth-service/src/services/bvn.service.ts` (line 47), `apps/auth-service/src/services/passport.service.ts` (lines 43-44), `apps/auth-service/src/services/passport-verification.service.ts` (line 36)
- Trigger: Any request to admin service, any BVN/passport verification attempt
- Workaround: Filter debug logs in output parser; use structured logging with proper log levels

**Unhandled Promise Rejection in Outbox Worker:**
- Symptoms: Outbox worker silently crashes if database connection fails
- Files: `apps/admin-service/src/config/workers/outbox.worker.ts` (line 53)
- Trigger: Database connection loss during event publishing
- Workaround: None - requires code fix to implement connection retry logic

**Hardcoded Mock Data in Verification Services:**
- Symptoms: Passport and BVN verification always returns same hardcoded data for specific IDs
- Files: `apps/auth-service/src/services/bvn.service.ts` (lines 61-83), `apps/auth-service/src/services/passport-verification.service.ts` (lines 51-79)
- Trigger: Call BVN verification with BVN '12345678901' or passport verification with any URL
- Workaround: Use exact mock BVN values ('12345678901' or '23456789012') for testing, but this limits test coverage

## Security Considerations

**OTP Stored in Plain Text in Cache:**
- Risk: Redis stores OTP values without encryption, vulnerable if Redis is compromised
- Files: `apps/auth-service/src/services/auth.service.ts` (line 538)
- Current mitigation: Redis connection uses environment variables, likely over TCP without encryption in development
- Recommendations: Implement Redis encryption at rest, use TLS for Redis connection in production, consider hashing OTP in cache with verification during validation

**Unvalidated Email Addresses in OTP Fallback:**
- Risk: When email service is not ready, OTP is logged to console including user email addresses
- Files: `apps/auth-service/src/services/auth.service.ts` (line 545)
- Current mitigation: None - email and OTP are printed directly
- Recommendations: Remove console logging of sensitive data, log only masked/hashed identifiers with proper log level control

**Insufficient Input Validation in Gateway Proxy:**
- Risk: API Gateway proxies all requests to backend services without validating request body structure
- Files: `apps/api-gateway/src/index.ts` (lines 46-128)
- Current mitigation: Rate limiting applied at gateway level
- Recommendations: Add request schema validation at gateway level, implement request size limits, validate content-type headers

**Unchecked External API Responses:**
- Risk: SMS sending and other external API calls may return errors that are silently logged
- Files: `apps/notification-service/src/index.ts` (lines 45-74)
- Current mitigation: Error logging exists but doesn't prevent failed notifications from silencing user
- Recommendations: Implement notification delivery verification, add retry mechanism with exponential backoff, implement dead letter queue for failed notifications

**Credentials Exposed in Client Configuration:**
- Risk: Auth client in admin service logs API base URL which may contain sensitive info
- Files: `apps/admin-service/src/clients/auth.client.ts` (console.log of baseURL)
- Current mitigation: None identified
- Recommendations: Remove all console logging of configuration; log only sanitized/non-sensitive config values at debug level

## Performance Bottlenecks

**Synchronous Mock Verification Delays:**
- Problem: BVN and passport verification services introduce artificial 1-2 second delays in request path
- Files: `apps/auth-service/src/services/bvn.service.ts` (line 58), `apps/auth-service/src/services/passport-verification.service.ts` (line 47)
- Cause: Mock implementation uses setTimeout to simulate external API latency
- Improvement path: Remove artificial delays, implement actual async external API calls with proper timeout handling (3-5 second timeout for external calls)

**Large Service Files Creating Complex Dependencies:**
- Problem: Auth service file is 694 lines; admin user management service is 656 lines - both exceed recommended file size
- Files: `apps/auth-service/src/services/auth.service.ts`, `apps/admin-service/src/services/user-management.service.ts`
- Cause: Multiple authentication flows bundled in single service class
- Improvement path: Split into specialized services (BvnAuthService, PassportAuthService, StandardAuthService) following Single Responsibility Principle

**N+1 Query Risk in Document Verification:**
- Problem: Verification service retrieves users/documents without include/select optimization
- Files: `apps/document-service/src/services/verification.service.ts` (needs review but likely present)
- Cause: No pagination or batching of document reviews
- Improvement path: Implement cursor-based pagination, add database query analysis/monitoring

**Outbox Worker Tight Poll Loop:**
- Problem: Outbox worker polls database every 5 seconds regardless of event queue size
- Files: `apps/admin-service/src/config/workers/outbox.worker.ts` (line 52)
- Cause: Fixed interval polling without exponential backoff
- Improvement path: Implement adaptive polling with exponential backoff when queue is empty, or use Kafka-based push model

## Fragile Areas

**Authentication Flow Complexity:**
- Files: `apps/auth-service/src/services/auth.service.ts`, `apps/auth-service/src/routes/auth.routes.ts`, `apps/auth-service/src/controllers/auth.controller.ts`
- Why fragile: Multiple signup flows (standard, BVN-based Nigerian, passport-based tourist) with overlapping logic and OTP handling. State machine implicit rather than explicit.
- Safe modification: Add comprehensive test coverage for each flow before refactoring, extract state transition logic to separate state machine class, create integration tests that verify end-to-end flow
- Test coverage: Likely minimal for edge cases like expired OTP, invalid BVN format, passport verification failures

**Verification Service Interdependencies:**
- Files: `apps/auth-service/src/services/`, `apps/document-service/src/services/verification.service.ts`
- Why fragile: Passport verification references document service but integration is commented out; BVN verification in auth service but verification in separate service
- Safe modification: Define clear service boundaries via OpenAPI specs, create integration tests before changes, implement health checks for service dependencies
- Test coverage: No visible cross-service integration tests

**Missing Error Handling in Event Processing:**
- Files: `apps/notification-service/src/index.ts` (lines 76-107)
- Why fragile: Event handler has no validation that required data fields exist (e.g., event.data.email)
- Safe modification: Add try-catch around event parsing, validate required fields before processing, implement dead letter queue for unparseable events
- Test coverage: No visible tests for malformed Kafka messages

**Admin Service Authorization:**
- Files: `apps/admin-service/src/index.ts` (lines 50-52)
- Why fragile: Authorization middleware applied AFTER user-management routes, meaning some admin endpoints may be unauthenticated
- Safe modification: Move authentication middleware above all protected routes, add tests verifying all admin endpoints require auth
- Test coverage: No visible auth tests

## Scaling Limits

**Single Database Per Service:**
- Current capacity: PostgreSQL connection pools (default 10 connections per service)
- Limit: At 8 services with 10 connections each = 80 DB connections maximum; production may need 50+ for concurrent load
- Scaling path: Implement connection pooling layer (PgBouncer), migrate to serverless database (Supabase), increase pool size but monitor CPU/memory

**Kafka Consumer Groups Without Parallelization:**
- Current capacity: Single consumer per service processes events sequentially
- Limit: Notification service processes one event at a time; high event volume will cause backlog
- Scaling path: Implement consumer groups with partition-aware consumption, add batch processing to handle multiple events concurrently

**Outbox Pattern Limited to Single Service:**
- Current capacity: Only admin service publishes via outbox; other services may lose events on failure
- Limit: Cannot guarantee event delivery for services not using outbox pattern
- Scaling path: Implement outbox pattern across all services with event publishing, add circuit breaker pattern for failed publishes, implement event sourcing for critical events

**Redis Single Instance:**
- Current capacity: OTP storage in single Redis instance with no replication
- Limit: No failover if Redis instance fails; all active OTP validations will fail
- Scaling path: Implement Redis clustering with sentinel, add persistent OTP backup to database with Redis as cache layer

## Dependencies at Risk

**Prisma Client Version Compatibility:**
- Risk: Multiple services with independent Prisma instances may have schema drift
- Impact: Migration failures, type mismatches between services
- Migration plan: Centralize prisma client to shared package, implement schema versioning, add migration validation tests

**Hardcoded Service URLs with Localhost Defaults:**
- Risk: Development URLs hardcoded as fallback may route production traffic to localhost
- Impact: Silent failures if environment variables not set
- Migration plan: Remove localhost defaults, require explicit environment configuration, add startup validation

**Email Service Optional Initialization:**
- Risk: Email service may fail silently if SMTP not configured; system continues without notification
- Impact: Users not notified of signup, password reset, important events
- Migration plan: Make email configuration required in production, add startup health check for SMTP, implement fallback notification mechanism

## Test Coverage Gaps

**No Tests for KYC Verification Flows:**
- What's not tested: BVN verification step-by-step flow, OTP validation in context of multi-step signup, passport verification integration
- Files: `apps/auth-service/src/services/bvn.service.ts`, `apps/auth-service/src/services/passport-verification.service.ts`, auth controller integration tests
- Risk: Multi-step verification flows may break without detection; mock data assumptions may not match real API responses
- Priority: High - KYC is critical security path

**No Tests for Event Publishing/Consumption:**
- What's not tested: Kafka event serialization/deserialization, outbox event publishing, notification service event handling
- Files: All event-driven services, `apps/notification-service/src/index.ts`, `apps/admin-service/src/config/workers/outbox.worker.ts`
- Risk: Event loss, duplicate events, or malformed messages go undetected until production
- Priority: High - event reliability is critical for distributed system

**No Tests for Gateway Proxy Behavior:**
- What's not tested: Service unavailability handling, error propagation, timeout behavior
- Files: `apps/api-gateway/src/index.ts`
- Risk: Gateway errors may not be properly formatted, service errors may leak implementation details
- Priority: Medium - gateway is public API surface

**No Tests for Rate Limiting:**
- What's not tested: Rate limit enforcement, recovery after limit reset
- Files: `apps/auth-service/src/routes/auth.routes.ts` uses authRateLimiter
- Risk: Rate limit bypass or overly strict limits go undetected
- Priority: Medium - affects API security

**Missing Database Transaction Tests:**
- What's not tested: Rollback behavior when multi-step operations fail, data consistency in concurrent scenarios
- Files: All service controllers that perform multiple DB operations
- Risk: Partial state updates, orphaned records, inconsistent data states
- Priority: High - financial transaction system cannot tolerate data inconsistency

---

*Concerns audit: 2026-02-04*
