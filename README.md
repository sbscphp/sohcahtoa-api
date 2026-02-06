# Sochatoa API - Monolith

Foreign Exchange Transaction Platform rebuilt as a monolithic application.

## Architecture Overview

This application has been converted from a microservices architecture to a **monolith architecture** while preserving all functionality:

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

- **Runtime**: Node.js 18+
- **Language**: TypeScript 5.3
- **Framework**: Express 4.18
- **Database**: PostgreSQL 15 (single unified database)
- **Cache**: Redis 7
- **ORM**: Prisma 5.7
- **Authentication**: JWT
- **API Docs**: Scalar (Swagger)

## Project Structure

```
sochatoa-api/
├── src/
│   ├── index.ts                    # Application entry point
│   ├── app.ts                      # Express app configuration
│   ├── config/                     # Configuration (DB, Redis, Email)
│   │   ├── database.ts
│   │   ├── redis.ts
│   │   └── email.ts
│   ├── events/                     # In-memory event bus
│   │   └── event-bus.ts
│   ├── modules/                    # Domain modules
│   │   ├── auth/                   # Authentication & KYC
│   │   ├── transactions/           # Transaction management
│   │   ├── payments/               # Payment processing
│   │   ├── compliance/             # AML & compliance
│   │   ├── documents/              # Document verification
│   │   ├── notifications/          # Email/SMS
│   │   ├── audit/                  # Audit logging
│   │   └── admin/                  # Admin operations
│   └── shared/                     # Shared code
│       ├── middleware/             # Express middleware
│       ├── utils/                  # Utility functions
│       └── types/                  # TypeScript types
├── prisma/
│   ├── schema.prisma               # Unified database schema
│   └── migrations/                 # Database migrations
├── Dockerfile                       # Single container build
├── docker-compose.yml               # PostgreSQL + Redis + API
├── package.json                     # All dependencies
└── tsconfig.json                    # TypeScript config
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

## Available Endpoints

### Authentication (`/api/auth`)
- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/verify-email` - Verify email with OTP
- `POST /api/auth/kyc/bvn` - BVN verification
- `POST /api/auth/kyc/passport` - Passport verification

### Transactions (`/api/transactions`)
- `POST /api/transactions` - Create transaction
- `GET /api/transactions` - List transactions
- `GET /api/transactions/:id` - Get transaction details
- `PATCH /api/transactions/:id` - Update transaction
- `DELETE /api/transactions/:id` - Cancel transaction

### Payments (`/api/payments`)
- `POST /api/payments/deposit` - Initiate deposit
- `POST /api/payments/confirm` - Confirm payment
- `GET /api/payments/exchange-rates` - Get exchange rates

### Admin (`/api/admin`)
- `POST /api/admin/users` - Create admin user
- `GET /api/admin/users` - List admin users
- `POST /api/admin/roles` - Create role
- `POST /api/admin/departments` - Create department

## Event System

The monolith uses an **in-memory event bus** (EventEmitter) for inter-module communication:

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
});
```

Available event types:
- User events: `USER_REGISTERED`, `USER_LOGIN`, `USER_VERIFIED`
- KYC events: `BVN_VERIFIED`, `PASSPORT_VERIFIED`
- Transaction events: `TRANSACTION_CREATED`, `TRANSACTION_APPROVED`
- Payment events: `DEPOSIT_CONFIRMED`, `PAYMENT_PROCESSED`
- Compliance events: `AML_CHECK_COMPLETED`, `AML_FLAG_RAISED`

## Development

### Scripts

```bash
npm run dev          # Start development server with hot reload
npm run build        # Build for production
npm start            # Start production server
npm run clean        # Clean build artifacts
npm run format       # Format code with Prettier
npm test             # Run tests (when configured)
```

### Adding a New Module

1. Create module directory: `src/modules/your-module/`
2. Add controllers, services, routes
3. Register routes in `src/app.ts`
4. Add event handlers in `src/index.ts` (if needed)

## Production Deployment

### Docker

```bash
# Build image
docker build -t sochatoa-api:latest .

# Run container
docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e REDIS_URL="redis://..." \
  -e JWT_ACCESS_SECRET="..." \
  -e JWT_REFRESH_SECRET="..." \
  --name sochatoa-api \
  sochatoa-api:latest
```

### Environment Variables (Production)

**Required:**
- `NODE_ENV=production`
- `PORT=3000`
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_ACCESS_SECRET` - Strong secret for access tokens
- `JWT_REFRESH_SECRET` - Strong secret for refresh tokens

**Optional:**
- SMTP configuration for email sending
- TERMII configuration for SMS sending
- `CORS_ORIGIN` - Allowed origins for CORS

## Benefits of Monolith Architecture

1. **Simpler Deployment** - Single container vs 9 containers
2. **Faster Development** - No network calls between modules
3. **Easier Debugging** - All code in one place
4. **Lower Costs** - Less infrastructure overhead
5. **No Distributed Transactions** - ACID guarantees within single DB
6. **Faster Queries** - Database joins instead of service calls

## Migration Notes

This codebase was converted from microservices to monolith:

- **Database schemas merged** - All Prisma schemas combined into one
- **Kafka removed** - Replaced with in-memory EventEmitter
- **API Gateway integrated** - Routes now handled by single Express app
- **Shared packages inlined** - Code moved to `src/shared/`
- **Service modules preserved** - Organized in `src/modules/`

The conversion maintains backward compatibility with the original API.

## License

MIT

## Support

For issues and questions, please open an issue in the repository.
