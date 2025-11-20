# System Architecture Documentation

## High-Level Architecture

```
┌─────────────┐
│   Clients   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────┐
│          API Gateway (Port 3000)        │
│  - Routing                              │
│  - Rate Limiting                        │
│  - Authentication                       │
│  - Request Logging                      │
└──────┬──────────────────────────────────┘
       │
       ├──────────────────┬──────────────────┬──────────────────┐
       ▼                  ▼                  ▼                  ▼
┌─────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ Auth Service│   │ Transaction  │   │   Payment    │   │Notification  │
│ (Port 3001) │   │   Service    │   │   Service    │   │  Service     │
│             │   │ (Port 3003)  │   │ (Port 3004)  │   │ (Port 3006)  │
└──────┬──────┘   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘
       │                 │                  │                  │
       ▼                 ▼                  ▼                  │
┌─────────────┐   ┌──────────────┐   ┌──────────────┐        │
│  Auth DB    │   │Transaction DB│   │  Payment DB  │        │
│ PostgreSQL  │   │  PostgreSQL  │   │  PostgreSQL  │        │
└─────────────┘   └──────────────┘   └──────────────┘        │
                                                              │
       ┌──────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│              Kafka (Event Bus)          │
│  - Event Publishing                     │
│  - Event Consumption                    │
│  - Service Communication                │
└─────────────────────────────────────────┘
       │
       ├──────────────────┐
       ▼                  ▼
┌─────────────┐   ┌──────────────┐
│    Redis    │   │  File Store  │
│   (Cache)   │   │   (S3/MinIO) │
└─────────────┘   └──────────────┘
```

## Service Communication Patterns

### 1. Synchronous Communication (HTTP/REST)
- Client → API Gateway
- API Gateway → Microservices
- Used for: Real-time requests requiring immediate responses

### 2. Asynchronous Communication (Kafka Events)
- Service → Kafka → Service
- Used for: Background processing, notifications, audit logs
- Examples:
  - User registration triggers email notification
  - Transaction creation triggers compliance check
  - Deposit confirmation triggers workflow progression

## Transaction Workflow

```
User Registration → Email Verification → KYC Verification
                                              │
                                              ▼
                              ┌───────────────────────────┐
                              │ Create Transaction (PTA)  │
                              └───────────┬───────────────┘
                                          │
                                          ▼
                              ┌───────────────────────────┐
                              │  Upload Documents         │
                              │  - Passport               │
                              │  - Visa                   │
                              │  - Ticket                 │
                              └───────────┬───────────────┘
                                          │
                                          ▼
                              ┌───────────────────────────┐
                              │  Document Verification    │
                              │  - Automated checks       │
                              │  - Manual review          │
                              └───────────┬───────────────┘
                                          │
                                          ▼
                              ┌───────────────────────────┐
                              │  Amount Calculation       │
                              │  - Get exchange rate      │
                              │  - Calculate naira equiv  │
                              │  - Check limits           │
                              └───────────┬───────────────┘
                                          │
                                          ▼
                              ┌───────────────────────────┐
                              │  Deposit Initiation       │
                              │  - Generate account       │
                              │  - User transfers funds   │
                              └───────────┬───────────────┘
                                          │
                                          ▼
                              ┌───────────────────────────┐
                              │  Deposit Confirmation     │
                              │  - Admin verifies         │
                              │  - Update status          │
                              └───────────┬───────────────┘
                                          │
                                          ▼
                              ┌───────────────────────────┐
                              │  AML/Compliance Check     │
                              │  - Risk scoring           │
                              │  - NFIU check             │
                              │  - Flag if suspicious     │
                              └───────────┬───────────────┘
                                          │
                                          ▼
                              ┌───────────────────────────┐
                              │  Admin Approval           │
                              │  - Review transaction     │
                              │  - Approve/Reject         │
                              └───────────┬───────────────┘
                                          │
                                          ▼
                              ┌───────────────────────────┐
                              │  Disbursement             │
                              │  - Bank transfer          │
                              │  - Cash pickup            │
                              │  - Prepaid card           │
                              └───────────┬───────────────┘
                                          │
                                          ▼
                              ┌───────────────────────────┐
                              │  Transaction Complete     │
                              │  - Generate receipt       │
                              │  - Send notification      │
                              └───────────────────────────┘
```

## Database Design Principles

1. **Database per Service Pattern**
   - Each microservice has its own database
   - Ensures loose coupling
   - Allows independent scaling
   - Prevents direct database access between services

2. **Data Consistency**
   - Eventual consistency via event-driven architecture
   - Saga pattern for distributed transactions
   - Idempotent event handlers

## Scalability Considerations

1. **Horizontal Scaling**
   - All services are stateless
   - Can scale independently based on load
   - Load balancing via Kubernetes

2. **Caching Strategy**
   - Redis for session storage
   - Exchange rates cached for 5 minutes
   - OTP cached for fast validation

3. **Database Optimization**
   - Connection pooling
   - Read replicas for reporting
   - Indexes on frequently queried fields

## Security Architecture

1. **Authentication & Authorization**
   - JWT tokens for stateless auth
   - Role-based access control (RBAC)
   - Session management with Redis

2. **Data Protection**
   - Passwords hashed with bcrypt
   - Sensitive data encrypted at rest
   - TLS for data in transit

3. **API Security**
   - Rate limiting per IP
   - Request validation
   - CORS configuration
   - Security headers (Helmet.js)

## Monitoring & Observability

1. **Logging**
   - Structured logging with Winston
   - Correlation IDs for request tracing
   - Centralized log aggregation

2. **Metrics**
   - Service health checks
   - Performance metrics
   - Business metrics (transactions/day, etc.)

3. **Tracing**
   - Distributed tracing support
   - Request flow visualization
   - Performance bottleneck identification

## Deployment Strategy

1. **Development**
   - Local Docker Compose
   - Hot reload for development

2. **Staging**
   - Kubernetes cluster
   - Mimics production environment
   - Automated testing

3. **Production**
   - Multi-zone Kubernetes deployment
   - Auto-scaling policies
   - Blue-green deployments
   - Rollback capabilities

## Future Enhancements

1. **Additional Services**
   - Document Verification Service (OCR, AI validation)
   - Compliance/AML Service (dedicated)
   - Admin Back-Office Service
   - Audit & Logging Service
   - Customer Profile Service

2. **Features**
   - Mobile app support
   - Real-time transaction tracking
   - Analytics dashboard
   - Multi-currency support
   - Automated KYC verification

3. **Infrastructure**
   - Service mesh (Istio)
   - Advanced monitoring (Prometheus + Grafana)
   - CI/CD pipeline
   - Infrastructure as Code (Terraform)
