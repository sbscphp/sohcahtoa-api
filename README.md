# Sochatoa API

A comprehensive Foreign Exchange (FX) Transaction Platform built as a monolithic application for managing international money transfers, compliance, and regulatory reporting in Nigeria.

## Overview

Sochatoa API is an enterprise-grade FX platform that handles the complete lifecycle of foreign exchange transactions including:
- Customer onboarding and KYC/AML verification
- Multi-currency transaction processing (PTA, BTA, School Fees, Medical, etc.)
- Payment collection and disbursement
- Regulatory compliance and reporting (CBN Form A/M/B)
- Document verification and management
- Administrative workflows and approvals

## Architecture Overview

This application follows a **modular monolith architecture** converted from microservices while preserving all functionality:

### What Changed

| Aspect | Before (Microservices) | After (Monolith) |
|--------|------------------------|------------------|
| **Databases** | 8 separate PostgreSQL databases | 1 unified PostgreSQL database |
| **Communication** | Kafka event bus | In-memory EventEmitter |
| **API Gateway** | Separate service | Integrated into monolith |
| **Deployment** | 9 Docker containers | 1 Docker container (+ PostgreSQL + Redis) |
| **Dependencies** | 9 package.json files | 1 package.json file |

### What Stayed the Same

✅ All functionality (auth, transactions, payments, compliance, documents, notifications, audit, admin)
✅ Tech stack (Node.js, TypeScript, Express, Prisma, PostgreSQL, Redis)
✅ API endpoints and routes
✅ Authentication/authorization
✅ Business logic

## Tech Stack

### Core Technologies
- **Runtime**: Node.js 18+
- **Language**: TypeScript 5.3
- **Framework**: Express 4.18
- **Database**: PostgreSQL 15 (single unified database)
- **Cache**: Redis 7 (rate limiting, session storage, exchange rate caching)
- **ORM**: Prisma 5.7

### Security & Authentication
- **Authentication**: JWT (15m access tokens, 7d refresh tokens)
- **Password Hashing**: bcryptjs
- **HTTP Security**: Helmet (security headers)
- **Input Validation**: express-validator
- **Rate Limiting**: express-rate-limit

### File & Media Management
- **Cloud Storage**: Cloudinary
- **File Upload**: Multer
- **Image Processing**: Sharp
- **OCR**: Google Vision / AWS Textract / Azure Computer Vision

### External Integrations
- **NIBSS**: BVN verification, account validation
- **CBN**: Regulatory compliance, FX rates, sanctions screening
- **TRMS**: Form A/M/B submission
- **SMS Gateway**: Termii / Infobip
- **Card Issuance**: Interswitch / Unified Payments
- **Email**: Nodemailer (SMTP)

### Observability & Documentation
- **Logging**: Winston (structured logging)
- **Audit**: Custom comprehensive audit trail system
- **API Docs**: Swagger UI Express (OpenAPI 3.0)
- **Monitoring**: Correlation IDs for distributed tracing

## Project Structure

```
sochatoa-api/
├── src/
│   ├── index.ts                      # Application entry point & event listeners
│   ├── app.ts                        # Express app configuration & middleware
│   ├── config/                       # Core configurations
│   │   ├── database.ts               # PostgreSQL/Prisma setup
│   │   ├── redis.ts                  # Redis client configuration
│   │   └── email.ts                  # Nodemailer/SMTP configuration
│   ├── events/                       # In-memory event bus
│   │   └── event-bus.ts              # EventEmitter-based pub/sub
│   ├── integrations/                 # External service clients
│   │   ├── cbn/                      # CBN API client (rates, sanctions, BDC)
│   │   ├── nibss/                    # NIBSS client (BVN, account verification)
│   │   ├── trms/                     # TRMS client (Form A/M/B submission)
│   │   ├── sms-gateway/              # SMS provider clients (Termii/Infobip)
│   │   ├── card-issuer/              # Card issuance (Interswitch/UP)
│   │   ├── ocr-service/              # OCR services (Google/AWS/Azure)
│   │   └── fn-window/                # FN-Window integration
│   ├── modules/                      # Domain modules (business logic)
│   │   ├── auth/                     # Authentication & KYC
│   │   │   ├── controllers/          # HTTP request handlers
│   │   │   ├── services/             # Business logic
│   │   │   ├── routes/               # Express routes
│   │   │   └── dto/                  # Data transfer objects
│   │   ├── customer/                 # Customer transaction management
│   │   ├── payments/                 # Payment processing & exchange rates
│   │   ├── admin/                    # Admin operations (13+ services)
│   │   │   ├── user-management/      # Admin user CRUD
│   │   │   ├── settlement/           # Settlement management
│   │   │   ├── workflow/             # Workflow orchestration
│   │   │   ├── report/               # Dashboard & analytics
│   │   │   ├── agent/                # Agent/outlet management
│   │   │   ├── rate/                 # Exchange rate management
│   │   │   └── ...                   # 7 more specialized services
│   │   ├── compliance/               # AML/CFT & regulatory compliance
│   │   ├── documents/                # Document upload & verification
│   │   ├── notifications/            # Email/SMS notifications
│   │   └── audit/                    # Comprehensive audit logging
│   └── shared/                       # Cross-cutting concerns
│       ├── middleware/               # Express middleware (auth, validation, etc.)
│       ├── types/                    # TypeScript type definitions
│       └── utils/                    # Utility functions & helpers
├── prisma/
│   ├── schema.prisma                 # Unified database schema (40+ models)
│   ├── migrations/                   # Database version control
│   └── seed.ts                       # Database seeding scripts
├── scripts/                          # Utility scripts
├── Dockerfile                        # Single container build
├── docker-compose.yml                # Full stack (PostgreSQL + Redis + API)
├── package.json                      # All dependencies
└── tsconfig.json                     # TypeScript configuration
```

## Getting Started

### Prerequisites

- Node.js 18 or higher
- Docker and Docker Compose (recommended)
- Or: PostgreSQL 15 + Redis 7 (if running locally)

### Installation

1. **Clone the repository**

```bash
git clone <repository-url>
cd sochatoa-api
```

2. **Install dependencies**

```bash
npm install
```

3. **Configure environment variables**

```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Setup database**

```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations
npm run prisma:migrate
```

### Running with Docker (Recommended)

```bash
# Start all services (PostgreSQL, Redis, API)
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop all services
docker-compose down
```

The API will be available at `http://localhost:3000`

### Running Locally (Development)

```bash
# Make sure PostgreSQL and Redis are running
# Update DATABASE_URL and REDIS_URL in .env

# Run in development mode with hot reload
npm run dev

# Or build and run in production mode
npm run build
npm start
```

## Database Management

```bash
# Generate Prisma Client (after schema changes)
npm run prisma:generate

# Create a new migration
npm run prisma:migrate

# Apply migrations
npx prisma migrate deploy

# Open Prisma Studio (database GUI)
npm run prisma:studio

# Push schema without migrations (development only)
npm run prisma:push
```

## API Documentation

Once the server is running, visit:

- **API Docs**: http://localhost:3000/api/docs
- **Health Check**: http://localhost:3000/health

## Core Features

### 1. Customer Onboarding & KYC
- Multi-step registration for Nigerian citizens and tourists
- BVN verification via NIBSS integration
- Passport OCR and data extraction
- OTP-based email/phone verification
- Dual authentication paths (Nigerian vs International)

### 2. Transaction Management
Supports 10+ transaction types:
- **PTA** (Personal Travel Allowance)
- **BTA** (Business Travel Allowance)
- **SCHOOL_FEES** (Tuition payments)
- **MEDICAL** (Medical expenses abroad)
- **PROFESSIONAL_BODY** (Professional membership fees)
- **TOURIST_FX** (Foreign currency for tourists)
- **RESIDENT_FX** (Resident foreign exchange)
- **EXPATRIATE_FX** (Expatriate transactions)
- **IMTO_REMITTANCE** (International Money Transfer)
- **CASH_REMITTANCE** (Cash-based remittance)

### 3. Payment Processing
- **Payment Methods**: Bank transfer, card, mobile money, cash deposit
- **Disbursement Methods**: Bank transfer, cash pickup, prepaid card, IMTO
- **Exchange Rates**: Real-time rates with Redis caching (5-min TTL)
- **Settlement Management**: Multi-currency settlement processing

### 4. Compliance & AML
Automated checks include:
- Threshold monitoring (transaction amount limits)
- Frequency analysis (pattern detection)
- Watchlist screening (sanctions lists)
- Country risk assessment
- NFIU (Nigeria Financial Intelligence Unit) checks
- Structuring detection
- PEP (Politically Exposed Person) screening
- Dynamic risk scoring

### 5. Document Management
- **Cloudinary Integration**: Cloud-based document storage
- **OCR Verification**: Automated document text extraction
- **Supported Documents** (14+ types): Passport, Visa, BVN, NIN, TIN, Utility Bills, Medical Letters, School Admission, Invoices, etc.
- **File Validation**: Size limits (10MB), format validation
- **Verification Workflow**: PENDING → VERIFIED / FAILED

### 6. Administrative Operations
Comprehensive admin panel with:
- Dashboard with transaction statistics
- Pending approvals queue
- Customer management and flagging system
- Exchange rate management
- Agent/outlet management
- Settlement and payout processing
- Workflow orchestration
- Report generation and analytics
- Support ticket management
- Comprehensive audit trails

### 7. Regulatory Reporting
- **CBN Form A**: Invisible transaction reporting (PTA, BTA, Medical, School Fees)
- **CBN Form M**: Merchandise import/export reporting
- **CBN Form B**: General transaction reporting
- **TRMS Integration**: Automated submission to CBN Trade Reporting System

### 8. Notifications
Event-driven notifications for:
- Welcome emails on registration
- Transaction status updates
- Compliance alerts
- Payment confirmations
- OTP delivery (email/SMS)

## API Endpoints

### Authentication (`/api/auth`)
- `POST /api/auth/signup` - User registration (Nigerian/Tourist)
- `POST /api/auth/login` - User login with rate limiting
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/verify-email` - Verify email with OTP
- `POST /api/auth/kyc/bvn` - BVN verification
- `POST /api/auth/kyc/passport` - Passport verification

### Customer Transactions (`/api/customer`)
- `POST /api/customer/transactions` - Create transaction with inline documents
- `GET /api/customer/transactions` - List customer transactions
- `GET /api/customer/transactions/:id` - Get transaction details
- `PATCH /api/customer/transactions/:id` - Update transaction
- `DELETE /api/customer/transactions/:id` - Cancel transaction

### Payments (`/api/payments`)
- `GET /api/payments/exchange-rates` - Get current exchange rates
- `POST /api/payments/deposit` - Initiate deposit
- `POST /api/payments/confirm` - Confirm payment
- `GET /api/payments/settlements` - List settlements

### Admin (`/api/admin`)
- **Dashboard**: `GET /api/admin/dashboard` - Transaction stats and metrics
- **Users**: `POST /api/admin/users`, `GET /api/admin/users`, `PATCH /api/admin/users/:id`
- **Transactions**: `GET /api/admin/transactions/pending`, `POST /api/admin/transactions/:id/approve`
- **Customers**: `GET /api/admin/customers`, `POST /api/admin/customers/:id/flag`
- **Rates**: `POST /api/admin/rates`, `PATCH /api/admin/rates/:id`
- **Agents**: `POST /api/admin/agents`, `GET /api/admin/agents`
- **Outlets**: `POST /api/admin/outlets`, `GET /api/admin/outlets`
- **Settlements**: `POST /api/admin/settlements`, `GET /api/admin/settlements`
- **Reports**: `POST /api/admin/reports/generate`
- **Workflows**: `GET /api/admin/workflows`, `POST /api/admin/workflows`

### Documents (`/api/documents`)
- `POST /api/documents/upload` - Upload document (Cloudinary)
- `GET /api/documents/:id` - Retrieve document
- `GET /api/documents/user/:userId` - List user documents
- `PATCH /api/documents/:id/verify` - Verify document

### Audit (`/api/audit`)
- `GET /api/audit/logs` - Query audit logs
- `GET /api/audit/logs/:id` - Get specific audit entry

## Event System

The monolith uses an **in-memory event bus** (EventEmitter) for inter-module communication, enabling loose coupling between modules while maintaining synchronous execution within a single process.

### Event-Driven Architecture

```typescript
import { eventBus, EventTypes } from './events/event-bus';

// Publish an event
eventBus.publish(EventTypes.USER_REGISTERED, {
  userId: user.id,
  email: user.email,
  firstName: user.firstName,
});

// Subscribe to an event
eventBus.subscribe(EventTypes.USER_REGISTERED, async (payload) => {
  // Handle event (e.g., send welcome email)
  await sendWelcomeEmail(payload.email, payload.firstName);
});
```

### Available Event Types

**User Events**:
- `USER_REGISTERED` - New user account created
- `USER_LOGIN` - User successfully logged in
- `USER_VERIFIED` - Email/phone verification completed
- `USER_SUSPENDED` - Account suspended by admin

**KYC Events**:
- `BVN_VERIFIED` - BVN verification completed
- `PASSPORT_VERIFIED` - Passport verification completed
- `KYC_COMPLETED` - All KYC steps finished

**Transaction Events**:
- `TRANSACTION_CREATED` - New transaction initiated
- `TRANSACTION_SUBMITTED` - Transaction submitted for review
- `TRANSACTION_APPROVED` - Admin approved transaction
- `TRANSACTION_REJECTED` - Admin rejected transaction
- `TRANSACTION_COMPLETED` - Transaction fully processed
- `TRANSACTION_CANCELLED` - Transaction cancelled

**Payment Events**:
- `DEPOSIT_INITIATED` - Customer initiated deposit
- `DEPOSIT_CONFIRMED` - Payment confirmed
- `PAYMENT_PROCESSED` - Payment successfully processed
- `DISBURSEMENT_COMPLETED` - Funds disbursed to beneficiary

**Compliance Events**:
- `AML_CHECK_STARTED` - AML screening initiated
- `AML_CHECK_COMPLETED` - AML screening finished
- `AML_FLAG_RAISED` - Suspicious activity detected
- `COMPLIANCE_REVIEW_REQUIRED` - Manual review needed

**Document Events**:
- `DOCUMENT_UPLOADED` - Document uploaded to cloud
- `DOCUMENT_VERIFIED` - Document verification completed
- `DOCUMENT_REJECTED` - Document verification failed

**Admin Events**:
- `ADMIN_ACTION_PERFORMED` - Admin performed an action
- `CUSTOMER_FLAGGED` - Customer flagged for review
- `RATE_UPDATED` - Exchange rate updated

## Development

### Available Scripts

```bash
# Development
npm run dev                     # Start dev server with hot reload (tsx watch)
npm run build                   # Build TypeScript to JavaScript
npm start                       # Start production server
npm run clean                   # Clean build artifacts
npm run format                  # Format code with Prettier
npm test                        # Run Jest tests

# Database
npm run prisma:generate         # Generate Prisma Client
npm run prisma:migrate          # Create and apply migration
npm run prisma:migrate:deploy   # Apply migrations (production)
npm run prisma:studio           # Open Prisma Studio GUI
npm run prisma:push             # Push schema to DB (dev only)
npm run prisma:seed             # Seed database
npm run db:init                 # Initialize DB (generate + migrate)

# Docker
npm run docker:build            # Build Docker image
npm run docker:up               # Start Docker Compose services
npm run docker:down             # Stop Docker Compose services
```

### Adding a New Module

1. **Create Module Structure**:
   ```bash
   mkdir -p src/modules/your-module/{controllers,services,routes,dto}
   ```

2. **Implement Service Layer**:
   ```typescript
   // src/modules/your-module/services/your-module.service.ts
   export class YourModuleService {
     async yourMethod() {
       // Business logic here
     }
   }
   ```

3. **Create Controller**:
   ```typescript
   // src/modules/your-module/controllers/your-module.controller.ts
   import { Request, Response } from 'express';

   export class YourModuleController {
     async handleRequest(req: Request, res: Response) {
       // Handle HTTP request
     }
   }
   ```

4. **Define Routes**:
   ```typescript
   // src/modules/your-module/routes/index.ts
   import { Router } from 'express';

   const router = Router();
   router.post('/', yourController.handleRequest);

   export default router;
   ```

5. **Register Routes in App**:
   ```typescript
   // src/app.ts
   import yourModuleRoutes from './modules/your-module/routes';
   app.use('/api/your-module', yourModuleRoutes);
   ```

6. **Add Event Handlers** (if needed):
   ```typescript
   // src/index.ts
   eventBus.subscribe(EventTypes.YOUR_EVENT, async (payload) => {
     // Handle event
   });
   ```

### Code Structure Best Practices

- **Controllers**: Handle HTTP requests/responses, validation
- **Services**: Business logic, database operations
- **Routes**: Express route definitions
- **DTOs**: Data transfer objects for request/response typing
- **Middleware**: Shared middleware in `src/shared/middleware/`
- **Types**: TypeScript types in `src/shared/types/`
- **Utils**: Helper functions in `src/shared/utils/`

## Production Deployment

### Docker Deployment

```bash
# Build image
docker build -t sochatoa-api:latest .

# Run with Docker Compose (recommended)
docker-compose up -d

# Or run container manually
docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/sochatoa_db" \
  -e REDIS_URL="redis://host:6379" \
  -e JWT_ACCESS_SECRET="your-strong-secret-key" \
  -e JWT_REFRESH_SECRET="your-strong-refresh-secret" \
  --name sochatoa-api \
  sochatoa-api:latest
```

### Environment Variables

#### Required
```bash
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
SERVICE_NAME=sochatoa-api-monolith

# Database
DATABASE_URL=postgresql://user:password@host:5432/sochatoa_db?schema=public

# Redis
REDIS_URL=redis://host:6379

# JWT (use strong random secrets in production!)
JWT_ACCESS_SECRET=your-super-secret-access-key-CHANGE-THIS
JWT_REFRESH_SECRET=your-super-secret-refresh-key-CHANGE-THIS
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
```

#### Email Configuration (Required for notifications)
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@sochatoa.com
```

#### SMS Configuration (Optional - Termii)
```bash
TERMII_API_KEY=your-termii-api-key
TERMII_SENDER_ID=Sochatoa
```

#### Cloud Storage (Required for document uploads)
```bash
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
CLOUDINARY_URL=cloudinary://key:secret@cloud-name
```

#### External Integrations (Production)
```bash
# NIBSS Integration
NIBSS_API_KEY=your-nibss-api-key
NIBSS_API_URL=https://api.nibss.com

# CBN Integration
CBN_API_KEY=your-cbn-api-key
CBN_API_URL=https://api.cbn.gov.ng

# TRMS Integration
TRMS_API_KEY=your-trms-key
TRMS_API_URL=https://trms.cbn.gov.ng

# Card Issuance (Interswitch/Unified Payments)
CARD_ISSUER_API_KEY=your-key
CARD_ISSUER_API_URL=https://api.interswitch.com

# OCR Service (Google Vision/AWS/Azure)
OCR_PROVIDER=google  # google, aws, or azure
GOOGLE_VISION_API_KEY=your-key
# OR
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
# OR
AZURE_COMPUTER_VISION_KEY=your-key
```

#### Optional Configuration
```bash
CORS_ORIGIN=https://yourdomain.com,https://admin.yourdomain.com
API_BASE_URL=https://api.yourdomain.com
API_BASE_PATH=/api
LOG_LEVEL=info  # debug, info, warn, error
```

### Security Recommendations

1. **Generate Strong Secrets**:
   ```bash
   # Generate JWT secrets
   openssl rand -base64 64
   ```

2. **Use Environment-Specific Configs**:
   - Never commit `.env` files to version control
   - Use secret management services (AWS Secrets Manager, Azure Key Vault, etc.)

3. **Enable HTTPS**:
   - Run behind reverse proxy (Nginx, Caddy)
   - Use Let's Encrypt for SSL certificates

4. **Database Security**:
   - Use strong database passwords
   - Enable SSL for PostgreSQL connections
   - Restrict database access by IP

5. **Redis Security**:
   - Enable password authentication
   - Use Redis ACLs for fine-grained access control

### Health Checks

The application exposes a health check endpoint:
```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2026-02-19T10:30:00.000Z",
  "uptime": 3600,
  "database": "connected",
  "redis": "connected"
}
```

## Data Models & Workflow

### Transaction Workflow States
```
DRAFT
  ↓
AWAITING_VERIFICATION
  ↓
VERIFICATION_IN_PROGRESS
  ↓
VERIFICATION_COMPLETED
  ↓
AWAITING_DEPOSIT
  ↓
DEPOSIT_PENDING
  ↓
DEPOSIT_CONFIRMED
  ↓
COMPLIANCE_REVIEW
  ↓
ADMIN_APPROVAL_PENDING
  ↓
APPROVED
  ↓
DISBURSEMENT_IN_PROGRESS
  ↓
COMPLETED / REJECTED / CANCELLED
```

### User Roles
- **CUSTOMER**: Standard customer accounts
- **ADMIN**: Administrative staff
- **COMPLIANCE_OFFICER**: AML/KYC review officers
- **OPERATIONS**: Operations team members
- **SUPER_ADMIN**: System administrators with full access

### Customer Types
- **NIGERIAN_CITIZEN**: Nigerian nationals (BVN required)
- **TOURIST**: International tourists
- **EXPATRIATE**: Foreign nationals residing in Nigeria
- **AGENT**: Authorized FX agents/outlets

### KYC Status Progression
```
NOT_STARTED → IN_PROGRESS → PENDING_VERIFICATION → VERIFIED / REJECTED
```

### AML Flag Types
- `THRESHOLD_EXCEEDED` - Transaction amount over regulatory limits
- `SUSPICIOUS_PATTERN` - Unusual transaction patterns detected
- `HIGH_RISK_COUNTRY` - Transaction involving high-risk jurisdictions
- `STRUCTURING` - Potential transaction structuring/smurfing
- `POLITICALLY_EXPOSED_PERSON` - PEP involvement
- `SANCTIONS_LIST` - Match on sanctions/watchlist
- `ADVERSE_MEDIA` - Negative news coverage

## Benefits of Monolith Architecture

1. **Simpler Deployment** - Single container vs 9 containers
2. **Faster Development** - No network calls between modules
3. **Easier Debugging** - All code in one place, unified logging
4. **Lower Costs** - Reduced infrastructure overhead
5. **ACID Transactions** - Database-level guarantees, no distributed transactions
6. **Faster Queries** - Database joins instead of HTTP service calls
7. **Simplified Testing** - Integration tests run in single process
8. **Easier Refactoring** - Change module boundaries without breaking APIs

## Migration Notes

This codebase was converted from microservices to monolith:

- **Database schemas merged** - All Prisma schemas combined into one
- **Kafka removed** - Replaced with in-memory EventEmitter
- **API Gateway integrated** - Routes now handled by single Express app
- **Shared packages inlined** - Code moved to `src/shared/`
- **Service modules preserved** - Organized in `src/modules/`

The conversion maintains backward compatibility with the original API.

## Monitoring & Observability

### Logging
The application uses **Winston** for structured logging with multiple transports:

```typescript
// Log levels: error, warn, info, debug
logger.info('Transaction created', {
  transactionId: tx.id,
  userId: user.id,
  amount: tx.amount,
  correlationId: req.correlationId
});
```

### Audit Trail
Comprehensive audit logging captures:
- All authentication events
- Transaction lifecycle events
- Payment operations
- Admin actions
- Compliance checks
- Document operations

Query audit logs via `/api/audit/logs` with filters:
- User ID
- Resource type
- Action type
- Date range
- Severity level

### Correlation IDs
Every request is assigned a correlation ID for distributed tracing across modules and events.

## Testing

### Running Tests
```bash
npm test                # Run all tests
npm test -- --watch     # Run in watch mode
npm test -- --coverage  # Generate coverage report
```

### Test Structure
```
src/
├── modules/
│   └── auth/
│       ├── __tests__/
│       │   ├── auth.service.test.ts
│       │   └── auth.controller.test.ts
```

## Troubleshooting

### Common Issues

**1. Database Connection Errors**
```bash
# Check PostgreSQL is running
docker-compose ps postgres

# View PostgreSQL logs
docker-compose logs postgres

# Test connection
psql $DATABASE_URL -c "SELECT 1"
```

**2. Redis Connection Errors**
```bash
# Check Redis is running
docker-compose ps redis

# Test connection
redis-cli -u $REDIS_URL ping
```

**3. Migration Issues**
```bash
# Reset database (development only!)
npm run prisma:push -- --force-reset

# Check migration status
npx prisma migrate status

# Apply pending migrations
npm run prisma:migrate:deploy
```

**4. Port Already in Use**
```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature/your-feature`
5. Submit a pull request

### Code Standards
- Follow TypeScript best practices
- Write tests for new features
- Update documentation
- Use Prettier for code formatting
- Follow existing project structure

## License

MIT License - See LICENSE file for details

## Support & Contact

For issues, questions, or feature requests:
- Open an issue in the repository
- Contact: support@sochatoa.com

## Acknowledgments

Built with:
- Node.js & Express
- Prisma ORM
- PostgreSQL & Redis
- TypeScript
- And many other open-source libraries

---

**Version**: 1.0.0
**Last Updated**: February 2026
