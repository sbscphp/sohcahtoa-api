# FX Transaction Platform - Microservices Architecture

A comprehensive microservices-based platform for managing foreign exchange transactions with KYC verification, compliance checks, and automated workflows.

## Architecture Overview

This platform is built using a microservices architecture with the following services:

### Core Services

1. **API Gateway** (Port 3000) - Single entry point for all client requests
   - Request routing
   - Rate limiting
   - Authentication validation
   - Request/response logging

2. **Authentication Service** (Port 3001) - User authentication and authorization
   - User registration and login
   - JWT token management
   - OTP validation
   - KYC verification initiation
   - Session management

3. **Transaction Orchestration Service** (Port 3003) - Core workflow engine
   - Transaction lifecycle management
   - Document upload handling
   - Transaction limits enforcement
   - Workflow step tracking
   - Support for multiple transaction types:
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

4. **Payment & Settlement Service** (Port 3004) - Payment processing
   - Exchange rate management
   - Deposit tracking
   - Payment confirmation
   - Payout instructions
   - Settlement reconciliation

5. **Notification Service** (Port 3006) - Communication hub
   - Email notifications
   - SMS notifications
   - Event-driven notifications via Kafka

### Technology Stack

- **Backend**: Node.js + TypeScript + Express
- **ORM**: Prisma
- **Databases**: PostgreSQL (separate DB per service)
- **Cache**: Redis
- **Message Queue**: Kafka
- **Authentication**: JWT
- **Monorepo**: Turborepo
- **Containerization**: Docker + Kubernetes
- **Package Manager**: pnpm

## Project Structure

```
fx-transaction-platform/
├── apps/
│   ├── api-gateway/          # API Gateway service
│   ├── auth-service/          # Authentication service
│   ├── transaction-service/   # Transaction orchestration
│   ├── payment-service/       # Payment & settlement
│   └── notification-service/  # Notification handler
├── packages/
│   ├── shared-types/          # Shared TypeScript types
│   ├── shared-utils/          # Shared utilities
│   └── shared-middlewares/    # Shared Express middlewares
├── k8s/                       # Kubernetes manifests
├── helm/                      # Helm charts
├── docker-compose.yml         # Docker Compose configuration
└── turbo.json                 # Turborepo configuration
```

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+
- Docker & Docker Compose
- PostgreSQL 15+
- Redis 7+
- Kafka

### Installation

1. **Clone the repository**
   ```bash
   cd sohcahtoa
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**

   Copy `.env.example` files in each service directory and configure:

   ```bash
   cp apps/auth-service/.env.example apps/auth-service/.env
   cp apps/transaction-service/.env.example apps/transaction-service/.env
   cp apps/payment-service/.env.example apps/payment-service/.env
   cp apps/notification-service/.env.example apps/notification-service/.env
   cp apps/api-gateway/.env.example apps/api-gateway/.env
   ```

4. **Generate Prisma clients**
   ```bash
   pnpm prisma:generate
   ```

5. **Run database migrations**
   ```bash
   cd apps/auth-service && pnpm prisma:migrate
   cd apps/transaction-service && pnpm prisma:migrate
   cd apps/payment-service && pnpm prisma:migrate
   ```

### Running the Application

#### Option 1: Local Development

1. **Start infrastructure services** (Redis, Kafka, PostgreSQL)
   ```bash
   docker-compose up -d postgres-auth postgres-transaction postgres-payment redis kafka
   ```

2. **Start all microservices**
   ```bash
   pnpm dev
   ```

   Or run individual services:
   ```bash
   cd apps/auth-service && pnpm dev
   cd apps/transaction-service && pnpm dev
   cd apps/payment-service && pnpm dev
   cd apps/notification-service && pnpm dev
   cd apps/api-gateway && pnpm dev
   ```

#### Option 2: Docker Compose

```bash
docker-compose up --build
```

#### Option 3: Kubernetes

1. **Create namespace**
   ```bash
   kubectl apply -f k8s/namespace.yaml
   ```

2. **Apply secrets**
   ```bash
   kubectl apply -f k8s/secrets.yaml
   ```

3. **Deploy infrastructure**
   ```bash
   kubectl apply -f k8s/postgres-auth.yaml
   kubectl apply -f k8s/redis.yaml
   kubectl apply -f k8s/kafka.yaml
   ```

4. **Deploy services**
   ```bash
   kubectl apply -f k8s/auth-service.yaml
   kubectl apply -f k8s/api-gateway.yaml
   ```

#### Option 4: Helm

```bash
helm install fx-platform ./helm
```

## API Documentation

### Authentication Service

#### Register User
```http
POST /api/auth/signup
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "+2348012345678"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

#### Send OTP
```http
POST /api/auth/otp/send
Content-Type: application/json

{
  "email": "user@example.com",
  "phoneNumber": "+2348012345678",
  "purpose": "REGISTRATION"
}
```

### Transaction Service

#### Create Transaction
```http
POST /api/transactions
Authorization: Bearer <token>
Content-Type: application/json

{
  "type": "PTA",
  "purpose": "Travel to USA",
  "destinationCountry": "USA",
  "currency": "USD"
}
```

#### Upload Document
```http
POST /api/transactions/:id/documents
Authorization: Bearer <token>
Content-Type: application/json

{
  "documentType": "PASSPORT",
  "fileUrl": "https://storage.example.com/docs/passport.pdf",
  "fileName": "passport.pdf",
  "fileSize": 1024000
}
```

#### Get User Transactions
```http
GET /api/transactions?page=1&limit=10
Authorization: Bearer <token>
```

### Payment Service

#### Get Exchange Rate
```http
POST /api/payments/exchange-rate
Authorization: Bearer <token>
Content-Type: application/json

{
  "fromCurrency": "NGN",
  "toCurrency": "USD",
  "amount": 1000000
}
```

#### Initiate Deposit
```http
POST /api/payments/deposit
Authorization: Bearer <token>
Content-Type: application/json

{
  "transactionId": "uuid",
  "amount": 1000000,
  "currency": "NGN",
  "paymentMethod": "BANK_TRANSFER",
  "bankDetails": {
    "bankName": "First Bank",
    "accountNumber": "1234567890",
    "accountName": "FX Platform",
    "reference": "TXN-REF-123"
  }
}
```

## Database Schema

### Authentication Service

- `users` - User accounts
- `user_credentials` - Password hashes and security
- `user_profiles` - User profile information
- `user_kyc` - KYC verification data
- `sessions` - Active user sessions
- `otp_logs` - OTP generation and validation logs

### Transaction Service

- `transactions` - Main transaction records
- `transaction_steps` - Workflow step tracking
- `transaction_documents` - Uploaded documents
- `transaction_history` - Audit trail
- `transaction_limits` - Quarterly/yearly limits
- `cash_pickup` - Cash pickup details
- `prepaid_cards` - Prepaid card information
- `receipts` - Transaction receipts

### Payment Service

- `settlements` - Payment settlements
- `bank_details` - Bank transfer information
- `payout_instructions` - Disbursement instructions
- `payment_receipts` - Payment receipts
- `exchange_rates` - Currency exchange rates

## Event-Driven Architecture

The platform uses Kafka for asynchronous communication between services.

### Event Types

- `user.registered` - User registration completed
- `user.login` - User logged in
- `transaction.created` - New transaction created
- `transaction.updated` - Transaction updated
- `transaction.status.changed` - Transaction status changed
- `document.uploaded` - Document uploaded
- `verification.completed` - Verification completed
- `deposit.confirmed` - Deposit confirmed
- `aml.flag.raised` - AML flag raised
- `admin.approval.required` - Admin approval needed

## Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Rate limiting on all endpoints
- Request correlation IDs for tracing
- Input validation and sanitization
- SQL injection prevention (Prisma ORM)
- CORS configuration
- Helmet.js security headers

## Monitoring and Logging

- Structured logging with Winston
- Request/response logging
- Error tracking and reporting
- Health check endpoints on all services
- Correlation IDs for distributed tracing

## Development

### Build All Services
```bash
pnpm build
```

### Run Tests
```bash
pnpm test
```

### Lint Code
```bash
pnpm lint
```

### Format Code
```bash
pnpm format
```

## Deployment

### Docker Build
```bash
pnpm docker:build
pnpm docker:up
```

### Kubernetes Deploy
```bash
kubectl apply -f k8s/
```

### Helm Install
```bash
helm install fx-platform ./helm --values helm/values.yaml
```

## Production Considerations

1. **Security**
   - Change all default passwords and secrets
   - Use environment-specific secrets management (AWS Secrets Manager, HashiCorp Vault)
   - Enable HTTPS/TLS
   - Implement API authentication and authorization
   - Set up WAF (Web Application Firewall)

2. **Scalability**
   - Configure horizontal pod autoscaling
   - Use connection pooling for databases
   - Implement caching strategies
   - Set up CDN for static assets

3. **Monitoring**
   - Set up Prometheus + Grafana
   - Configure alerting (PagerDuty, Slack)
   - Implement distributed tracing (Jaeger, Zipkin)
   - Set up log aggregation (ELK stack)

4. **Backup and Recovery**
   - Configure automated database backups
   - Implement disaster recovery plan
   - Set up multi-region deployment

5. **CI/CD**
   - Set up GitHub Actions / GitLab CI
   - Implement automated testing
   - Configure staging environments
   - Implement blue-green deployments

## External Service Integrations

The platform is designed to integrate with:

- **CBN TRMS** - Central Bank verification
- **BVN Verification** - Bank Verification Number checks
- **NFIU** - Nigerian Financial Intelligence Unit
- **Termii** - SMS notifications
- **SendGrid** - Email notifications
- **Payment Gateways** - For payment processing
- **S3/MinIO** - Document storage

## License

Proprietary - All rights reserved

## Support

For support, contact: support@fxplatform.com

---

Built with Node.js, TypeScript, and Microservices Architecture
