# Microservices Overview

## Complete Service Architecture

The FX Transaction Platform consists of 9 microservices, each with its own database and specific responsibilities:

### 1. API Gateway (Port 3000)
**Purpose**: Single entry point for all client requests

**Responsibilities**:
- Request routing to appropriate microservices
- Rate limiting and throttling
- JWT token validation
- Request/response logging
- CORS handling
- Correlation ID management

**Technology**: Express + http-proxy-middleware
**No Database** - Stateless proxy

---

### 2. Authentication Service (Port 3001)
**Purpose**: User authentication and authorization

**Responsibilities**:
- User registration and login
- JWT token generation and validation
- OTP generation and validation (SMS/Email)
- Session management
- KYC verification initiation
- Password hashing and validation
- Account lockout after failed attempts

**Database**: `auth_db` (PostgreSQL)
**Tables**:
- `users` - User accounts
- `user_credentials` - Password hashes and security
- `user_profiles` - User profile information
- `user_kyc` - KYC verification data
- `sessions` - Active user sessions
- `otp_logs` - OTP generation and validation logs

**Key Features**:
- Bcrypt password hashing
- Redis-cached OTP for fast validation
- Refresh token rotation
- Session tracking with IP and user agent

---

### 3. Document Verification Service (Port 3002)
**Purpose**: Automated and manual document verification

**Responsibilities**:
- Document upload handling
- Automated verification via external APIs:
  - Nigerian Immigration (Passport)
  - CBN BVN verification
  - FIRS TIN verification
  - Visa validation
- OCR and document extraction
- Manual review queue management
- Admin document approval/rejection

**Database**: `document_db` (PostgreSQL)
**Tables**:
- `verification_requests` - Verification request tracking
- `verification_results` - API verification results
- `admin_reviews` - Manual review records
- `external_api_logs` - External API call logs

**Integration Points**:
- Nigerian Immigration Service API
- CBN BVN Verification API
- FIRS TIN API
- Document storage (S3/MinIO)

---

### 4. Transaction Orchestration Service (Port 3003)
**Purpose**: Core workflow engine for all transactions

**Responsibilities**:
- Transaction lifecycle management
- Support for 10 transaction types:
  - PTA (Personal Travel Allowance)
  - BTA (Business Travel Allowance)
  - School Fees
  - Medical
  - Professional Body
  - Tourist FX
  - Resident FX
  - Expatriate FX
  - IMTO Remittances
  - Cash Remittances
- Document upload and tracking
- Transaction limits enforcement (quarterly/yearly)
- Workflow step progression
- Cash pickup management
- Prepaid card issuance
- Receipt generation with QR codes

**Database**: `transaction_db` (PostgreSQL)
**Tables**:
- `transactions` - Main transaction records
- `transaction_steps` - Workflow step tracking
- `transaction_documents` - Document references
- `transaction_history` - Complete audit trail
- `transaction_limits` - User limits tracking
- `cash_pickup` - Cash pickup details
- `prepaid_cards` - Prepaid card information
- `receipts` - Transaction receipts

**Workflow Steps**:
1. Personal Info
2. Document Upload
3. Document Verification
4. Amount Calculation
5. Deposit Info
6. Deposit Confirmation
7. Compliance Check
8. Admin Review
9. Disbursement

---

### 5. Payment & Settlement Service (Port 3004)
**Purpose**: Payment processing and settlements

**Responsibilities**:
- Exchange rate management (cached in Redis)
- Deposit initiation and tracking
- Payment confirmation
- Naira equivalent calculation
- Bank transfer instructions
- Settlement reconciliation
- Payout instructions for disbursement
- IMTO payout processing

**Database**: `payment_db` (PostgreSQL)
**Tables**:
- `settlements` - Payment settlements
- `bank_details` - Bank transfer information
- `payout_instructions` - Disbursement instructions
- `payment_receipts` - Payment receipts
- `exchange_rates` - Currency exchange rates

**Features**:
- Real-time exchange rates with caching
- Multiple payment methods support
- Automated payout processing
- Payment reconciliation

---

### 6. Compliance/AML Service (Port 3005)
**Purpose**: Anti-Money Laundering and compliance checks

**Responsibilities**:
- Automated AML checks on all transactions
- Risk scoring (0-100)
- Multiple check types:
  - Threshold exceeded
  - Transaction frequency patterns
  - Watchlist screening
  - High-risk country checks
  - NFIU integration
  - PEP (Politically Exposed Person) screening
  - Sanctions list checks
- Flag management (Low, Medium, High, Critical)
- Compliance officer review queue
- NFIU reporting

**Database**: `compliance_db` (PostgreSQL)
**Tables**:
- `aml_checks` - AML check records
- `aml_flags` - Flagged transactions
- `compliance_reviews` - Officer reviews
- `watch_lists` - PEP and sanctions lists
- `nfiu_reports` - NFIU submissions

**Risk Scoring**:
- 0-49: PASSED (auto-approve)
- 50-79: FLAGGED (requires review)
- 80-100: FAILED (block transaction)

---

### 7. Notification Service (Port 3006)
**Purpose**: Communication hub for all notifications

**Responsibilities**:
- Email notifications via SMTP
- SMS notifications via Termii
- Push notifications
- Event-driven notification triggers
- Template management
- Notification delivery tracking

**No Database** - Event-driven consumer

**Notification Triggers**:
- User registration
- OTP codes
- Transaction status updates
- Verification results
- Deposit confirmations
- Admin actions
- Compliance alerts

**Integration**:
- Termii SMS API
- SMTP for emails (Gmail, SendGrid, etc.)
- Push notification services

---

### 8. Admin Back-Office Service (Port 3007)
**Purpose**: Administrative operations and management

**Responsibilities**:
- Transaction approval/rejection
- Deposit confirmation
- Document manual review
- Dashboard and analytics
- Task assignment to admins
- Audit log viewing
- User management
- Limits override (with approval)
- Cash pickup management
- Prepaid card issuance

**Database**: `admin_db` (PostgreSQL)
**Tables**:
- `admin_users` - Admin accounts and roles
- `admin_actions` - Complete action log
- `task_assignments` - Task queue for admins
- `dashboards` - Dashboard metrics

**Admin Roles**:
- ADMIN - General administrative access
- COMPLIANCE_OFFICER - Compliance reviews
- OPERATIONS - Operational tasks
- SUPER_ADMIN - Full system access

---

### 9. Audit & Logging Service (Port 3008)
**Purpose**: Immutable audit trail and system logging

**Responsibilities**:
- Log all system events from Kafka
- Store immutable audit records
- Security event tracking
- Distributed tracing support
- System metrics collection
- Query audit logs
- Security incident management

**Database**: `audit_db` (PostgreSQL)
**Tables**:
- `audit_events` - All domain events
- `log_traces` - Distributed tracing
- `system_metrics` - Performance metrics
- `security_events` - Security incidents

**Event Categories**:
- AUTHENTICATION
- TRANSACTION
- PAYMENT
- COMPLIANCE
- ADMIN
- SYSTEM

**Features**:
- Subscribes to ALL Kafka events
- Correlation ID tracking
- Full request/response logging
- Security event alerting

---

## Service Communication

### Synchronous (HTTP/REST)
- Client → API Gateway → Microservices
- Used for real-time requests

### Asynchronous (Kafka Events)
- Service → Kafka → Multiple Services
- Used for event-driven workflows
- Examples:
  - Document uploaded → Verification triggered
  - Deposit confirmed → AML check started
  - AML flag → Notification sent
  - All events → Audit logged

---

## Port Allocation

| Service | Port | Database Port |
|---------|------|---------------|
| API Gateway | 3000 | - |
| Auth Service | 3001 | 5432 |
| Document Service | 3002 | 5435 |
| Transaction Service | 3003 | 5433 |
| Payment Service | 3004 | 5434 |
| Compliance Service | 3005 | 5436 |
| Notification Service | 3006 | - |
| Admin Service | 3007 | 5437 |
| Audit Service | 3008 | 5438 |

**Infrastructure**:
- Redis: 6379
- Kafka: 9092

---

## Service Dependencies

```
API Gateway
  ├── Auth Service (DB)
  ├── Document Service (DB + Kafka)
  ├── Transaction Service (DB + Kafka)
  ├── Payment Service (DB + Redis + Kafka)
  ├── Compliance Service (DB + Kafka)
  ├── Notification Service (Kafka only)
  ├── Admin Service (DB + Kafka)
  └── Audit Service (DB + Kafka)

All services depend on:
- Kafka (event bus)
- Their own PostgreSQL database (except Notification)
```

---

## Database Strategy

**Database per Service Pattern**:
- Each service has its own PostgreSQL database
- No direct database access between services
- Communication only via REST APIs or Kafka events
- Ensures loose coupling and independent scaling

**Data Consistency**:
- Eventual consistency via event-driven architecture
- Saga pattern for distributed transactions
- Idempotent event handlers

---

## Scaling Strategy

Each service can scale independently based on load:

**High Traffic Services**:
- API Gateway: Scale for request handling
- Auth Service: Scale for login/session traffic
- Transaction Service: Scale for workflow processing

**Processing Services**:
- Document Service: Scale for verification queue
- Compliance Service: Scale for AML checks
- Payment Service: Scale for payment processing

**Background Services**:
- Notification Service: Multiple consumers for events
- Audit Service: Multiple consumers for logging

---

## Security Architecture

**Authentication Flow**:
1. Client → API Gateway
2. API Gateway validates JWT (no service call)
3. If valid, forward to appropriate service
4. Service receives user context in JWT

**Authorization**:
- Role-based access control (RBAC)
- Admin-only endpoints protected
- Resource ownership validation

**Data Protection**:
- All passwords hashed with bcrypt
- Sensitive data encrypted at rest
- TLS for all service communication
- API keys for external services

---

## Monitoring & Observability

**Logging**:
- Winston structured logging in all services
- Correlation IDs for request tracing
- Log levels: DEBUG, INFO, WARN, ERROR

**Metrics** (Future):
- Prometheus metrics export
- Grafana dashboards
- Service health checks

**Tracing**:
- Distributed tracing via Audit Service
- Request flow visualization
- Performance bottleneck identification

---

## Deployment

**Development**:
```bash
docker-compose up
```

**Production**:
```bash
kubectl apply -f k8s/
# OR
helm install fx-platform ./helm
```

Each service:
- Has its own Dockerfile
- Builds independently
- Deploys independently
- Scales independently
