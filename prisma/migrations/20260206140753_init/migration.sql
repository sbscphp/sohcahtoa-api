-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'ADMIN', 'COMPLIANCE_OFFICER', 'OPERATIONS', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('NIGERIAN_CITIZEN', 'TOURIST', 'AGENT');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'PENDING_VERIFICATION', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('REGISTRATION', 'LOGIN', 'PASSWORD_RESET', 'TRANSACTION_VERIFICATION');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('ADMIN', 'COMPLIANCE_OFFICER', 'OPERATIONS', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('TRANSACTION_APPROVE', 'TRANSACTION_REJECT', 'DEPOSIT_CONFIRM', 'DOCUMENT_APPROVE', 'DOCUMENT_REJECT', 'COMPLIANCE_REVIEW', 'USER_SUSPEND', 'USER_ACTIVATE', 'LIMITS_OVERRIDE', 'CASH_PICKUP_ISSUE', 'PREPAID_CARD_ISSUE');

-- CreateEnum
CREATE TYPE "TokenType" AS ENUM ('OTP', 'PASSWORD_RESET', 'EMAIL_VERIFICATION', 'MAGIC_LINK', 'REFRESH');

-- CreateEnum
CREATE TYPE "CustomerFlagStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('PTA', 'BTA', 'SCHOOL_FEES', 'MEDICAL', 'PROFESSIONAL_BODY', 'TOURIST_FX', 'RESIDENT_FX', 'EXPATRIATE_FX', 'IMTO_REMITTANCE', 'CASH_REMITTANCE');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('DRAFT', 'AWAITING_VERIFICATION', 'VERIFICATION_IN_PROGRESS', 'VERIFICATION_COMPLETED', 'AWAITING_DEPOSIT', 'DEPOSIT_PENDING', 'DEPOSIT_CONFIRMED', 'COMPLIANCE_REVIEW', 'ADMIN_APPROVAL_PENDING', 'APPROVED', 'DISBURSEMENT_IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransactionStep" AS ENUM ('PERSONAL_INFO', 'DOCUMENT_UPLOAD', 'DOCUMENT_VERIFICATION', 'AMOUNT_CALCULATION', 'DEPOSIT_INFO', 'DEPOSIT_CONFIRMATION', 'COMPLIANCE_CHECK', 'ADMIN_REVIEW', 'DISBURSEMENT');

-- CreateEnum
CREATE TYPE "DisbursementMethod" AS ENUM ('BANK_TRANSFER', 'CASH_PICKUP', 'PREPAID_CARD', 'IMTO');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'VERIFIED', 'FAILED', 'REQUIRES_MANUAL_REVIEW');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('PASSPORT', 'VISA', 'TICKET', 'RECEIPT', 'INVOICE', 'MEDICAL_LETTER', 'PROFESSIONAL_BODY_LETTER', 'BVN', 'TIN', 'UTILITY_BILL', 'SCHOOL_ADMISSION');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'AWAITING_CONFIRMATION', 'CONFIRMED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'CARD', 'MOBILE_MONEY', 'CASH_DEPOSIT');

-- CreateEnum
CREATE TYPE "AmlCheckStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'PASSED', 'FLAGGED', 'FAILED');

-- CreateEnum
CREATE TYPE "AmlFlagSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AmlFlagType" AS ENUM ('THRESHOLD_EXCEEDED', 'SUSPICIOUS_PATTERN', 'HIGH_RISK_COUNTRY', 'FREQUENT_TRANSACTIONS', 'STRUCTURING', 'POLITICALLY_EXPOSED_PERSON', 'SANCTIONS_LIST', 'ADVERSE_MEDIA');

-- CreateEnum
CREATE TYPE "ComplianceReviewStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'REQUIRES_MORE_INFO');

-- CreateEnum
CREATE TYPE "VerificationType" AS ENUM ('PASSPORT', 'VISA', 'BVN', 'TIN', 'TICKET', 'INVOICE', 'MEDICAL_LETTER', 'SCHOOL_ADMISSION', 'PROFESSIONAL_BODY_LETTER');

-- CreateEnum
CREATE TYPE "EventCategory" AS ENUM ('AUTHENTICATION', 'TRANSACTION', 'PAYMENT', 'COMPLIANCE', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('INFO', 'WARNING', 'ERROR', 'CRITICAL');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "customerType" "CustomerType",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_credentials" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "lastPasswordChange" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Nigeria',
    "postalCode" TEXT,
    "avatar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_kyc" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "KycStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "bvn" TEXT,
    "tin" TEXT,
    "passportNumber" TEXT,
    "passportDocumentUrl" TEXT,
    "bvnVerified" BOOLEAN NOT NULL DEFAULT false,
    "tinVerified" BOOLEAN NOT NULL DEFAULT false,
    "passportVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationNotes" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_kyc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "phoneNumber" TEXT,
    "otp" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "branch" TEXT,
    "department" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "altPhoneNumber" TEXT,
    "position" TEXT,
    "departmentName" TEXT,
    "branch" TEXT NOT NULL,
    "password" TEXT,
    "roleId" TEXT,
    "departmentId" TEXT,
    "role" "AdminRole",
    "permissions" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "departmentEmail" TEXT,
    "description" TEXT,
    "branch" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_actions" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "actionType" "ActionType" NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "previousState" JSONB,
    "newState" JSONB,
    "reason" TEXT,
    "metadata" JSONB,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "departmentId" TEXT,

    CONSTRAINT "admin_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_assignments" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "task_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboards" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalTransactions" INTEGER NOT NULL DEFAULT 0,
    "pendingApprovals" INTEGER NOT NULL DEFAULT 0,
    "completedTransactions" INTEGER NOT NULL DEFAULT 0,
    "rejectedTransactions" INTEGER NOT NULL DEFAULT 0,
    "totalVolume" DECIMAL(18,2) NOT NULL,
    "amlFlags" INTEGER NOT NULL DEFAULT 0,
    "pendingReviews" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,

    CONSTRAINT "dashboards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TokenType" NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "usedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_flags" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AmlFlagType" NOT NULL,
    "severity" "AmlFlagSeverity" NOT NULL,
    "status" "CustomerFlagStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT,
    "description" TEXT NOT NULL,
    "details" JSONB,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolutionNotes" TEXT,

    CONSTRAINT "customer_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'DRAFT',
    "currentStep" "TransactionStep" NOT NULL DEFAULT 'PERSONAL_INFO',
    "purpose" TEXT NOT NULL,
    "destinationCountry" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "foreignAmount" DECIMAL(18,2),
    "nairaEquivalent" DECIMAL(18,2),
    "exchangeRate" DECIMAL(18,6),
    "disbursementMethod" "DisbursementMethod",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_steps" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "step" "TransactionStep" NOT NULL,
    "status" TEXT NOT NULL,
    "data" JSONB,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_documents" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verificationNotes" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "transaction_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_history" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previousValue" TEXT,
    "newValue" TEXT,
    "performedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "transaction_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_limits" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "quarterlyLimit" DECIMAL(18,2) NOT NULL,
    "yearlyLimit" DECIMAL(18,2) NOT NULL,
    "currentQuarterUsage" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "currentYearUsage" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "quarter" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transaction_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_pickup" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "pickupLocation" TEXT NOT NULL,
    "pickupCode" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "recipientPhone" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "pickedUpAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_pickup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prepaid_cards" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "cardNumber" TEXT NOT NULL,
    "cardType" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "cvv" TEXT NOT NULL,
    "activationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prepaid_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipts" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "qrCode" TEXT NOT NULL,
    "pdfUrl" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlements" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" "PaymentMethod" NOT NULL,
    "paymentReference" TEXT,
    "depositedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "confirmedBy" TEXT,
    "proofOfPayment" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_details" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_instructions" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "recipientName" TEXT NOT NULL,
    "recipientBank" TEXT,
    "recipientAccount" TEXT,
    "swiftCode" TEXT,
    "iban" TEXT,
    "phoneNumber" TEXT,
    "address" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "payout_instructions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_receipts" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "pdfUrl" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "payment_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" TEXT NOT NULL,
    "fromCurrency" TEXT NOT NULL,
    "toCurrency" TEXT NOT NULL,
    "rate" DECIMAL(18,6) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aml_checks" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "transactionType" TEXT NOT NULL,
    "sourceOfFunds" TEXT,
    "status" "AmlCheckStatus" NOT NULL DEFAULT 'PENDING',
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "recommendations" JSONB,
    "checkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aml_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aml_flags" (
    "id" TEXT NOT NULL,
    "checkId" TEXT NOT NULL,
    "type" "AmlFlagType" NOT NULL,
    "severity" "AmlFlagSeverity" NOT NULL,
    "description" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aml_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_reviews" (
    "id" TEXT NOT NULL,
    "checkId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "status" "ComplianceReviewStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "decision" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "compliance_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watch_lists" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,

    CONSTRAINT "watch_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nfiu_reports" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "reportData" JSONB NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reportReference" TEXT NOT NULL,

    CONSTRAINT "nfiu_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_requests" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "verificationType" "VerificationType" NOT NULL,
    "documentUrl" TEXT NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 1,
    "automatedChecks" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "verification_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_results" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "verificationType" "VerificationType" NOT NULL,
    "status" "VerificationStatus" NOT NULL,
    "provider" TEXT NOT NULL,
    "apiResponse" JSONB,
    "extractedData" JSONB,
    "confidenceScore" DECIMAL(5,2),
    "flags" JSONB,
    "notes" TEXT,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_reviews" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "status" "VerificationStatus" NOT NULL,
    "decision" TEXT NOT NULL,
    "comments" TEXT,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "admin_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_api_logs" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "requestData" JSONB,
    "responseData" JSONB,
    "statusCode" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_api_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "category" "EventCategory" NOT NULL,
    "severity" "Severity" NOT NULL DEFAULT 'INFO',
    "source" TEXT NOT NULL,
    "userId" TEXT,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "action" TEXT,
    "previousState" JSONB,
    "newState" JSONB,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "correlationId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log_traces" (
    "id" TEXT NOT NULL,
    "traceId" TEXT NOT NULL,
    "spanId" TEXT NOT NULL,
    "parentSpanId" TEXT,
    "serviceName" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "duration" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "tags" JSONB,
    "logs" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "log_traces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_metrics" (
    "id" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "metricType" TEXT NOT NULL,
    "metricName" TEXT NOT NULL,
    "value" DECIMAL(18,6) NOT NULL,
    "unit" TEXT,
    "tags" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_events" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "userId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "description" TEXT NOT NULL,
    "details" JSONB,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phoneNumber_key" ON "users"("phoneNumber");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_phoneNumber_idx" ON "users"("phoneNumber");

-- CreateIndex
CREATE INDEX "users_customerType_idx" ON "users"("customerType");

-- CreateIndex
CREATE UNIQUE INDEX "user_credentials_userId_key" ON "user_credentials"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_userId_key" ON "user_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_kyc_userId_key" ON "user_kyc"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_kyc_bvn_key" ON "user_kyc"("bvn");

-- CreateIndex
CREATE INDEX "user_kyc_bvn_idx" ON "user_kyc"("bvn");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refreshToken_key" ON "sessions"("refreshToken");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_refreshToken_idx" ON "sessions"("refreshToken");

-- CreateIndex
CREATE INDEX "otp_logs_email_idx" ON "otp_logs"("email");

-- CreateIndex
CREATE INDEX "otp_logs_phoneNumber_idx" ON "otp_logs"("phoneNumber");

-- CreateIndex
CREATE INDEX "otp_logs_expiresAt_idx" ON "otp_logs"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE INDEX "admin_users_email_idx" ON "admin_users"("email");

-- CreateIndex
CREATE INDEX "admin_users_roleId_idx" ON "admin_users"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- CreateIndex
CREATE INDEX "admin_actions_adminId_idx" ON "admin_actions"("adminId");

-- CreateIndex
CREATE INDEX "admin_actions_resourceType_resourceId_idx" ON "admin_actions"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "admin_actions_actionType_idx" ON "admin_actions"("actionType");

-- CreateIndex
CREATE INDEX "task_assignments_adminId_idx" ON "task_assignments"("adminId");

-- CreateIndex
CREATE INDEX "task_assignments_status_idx" ON "task_assignments"("status");

-- CreateIndex
CREATE INDEX "task_assignments_priority_idx" ON "task_assignments"("priority");

-- CreateIndex
CREATE INDEX "dashboards_date_idx" ON "dashboards"("date");

-- CreateIndex
CREATE UNIQUE INDEX "tokens_token_key" ON "tokens"("token");

-- CreateIndex
CREATE INDEX "tokens_userId_idx" ON "tokens"("userId");

-- CreateIndex
CREATE INDEX "tokens_token_idx" ON "tokens"("token");

-- CreateIndex
CREATE INDEX "tokens_type_idx" ON "tokens"("type");

-- CreateIndex
CREATE INDEX "tokens_expiresAt_idx" ON "tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "customer_flags_status_idx" ON "customer_flags"("status");

-- CreateIndex
CREATE INDEX "customer_flags_type_idx" ON "customer_flags"("type");

-- CreateIndex
CREATE INDEX "customer_flags_severity_idx" ON "customer_flags"("severity");

-- CreateIndex
CREATE INDEX "customer_flags_userId_idx" ON "customer_flags"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_referenceNumber_key" ON "transactions"("referenceNumber");

-- CreateIndex
CREATE INDEX "transactions_userId_idx" ON "transactions"("userId");

-- CreateIndex
CREATE INDEX "transactions_referenceNumber_idx" ON "transactions"("referenceNumber");

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status");

-- CreateIndex
CREATE INDEX "transactions_type_idx" ON "transactions"("type");

-- CreateIndex
CREATE INDEX "transaction_steps_transactionId_idx" ON "transaction_steps"("transactionId");

-- CreateIndex
CREATE INDEX "transaction_documents_transactionId_idx" ON "transaction_documents"("transactionId");

-- CreateIndex
CREATE INDEX "transaction_documents_verificationStatus_idx" ON "transaction_documents"("verificationStatus");

-- CreateIndex
CREATE INDEX "transaction_history_transactionId_idx" ON "transaction_history"("transactionId");

-- CreateIndex
CREATE INDEX "transaction_limits_userId_idx" ON "transaction_limits"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_limits_userId_type_quarter_year_key" ON "transaction_limits"("userId", "type", "quarter", "year");

-- CreateIndex
CREATE UNIQUE INDEX "cash_pickup_transactionId_key" ON "cash_pickup"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "cash_pickup_pickupCode_key" ON "cash_pickup"("pickupCode");

-- CreateIndex
CREATE INDEX "cash_pickup_pickupCode_idx" ON "cash_pickup"("pickupCode");

-- CreateIndex
CREATE INDEX "cash_pickup_status_idx" ON "cash_pickup"("status");

-- CreateIndex
CREATE UNIQUE INDEX "prepaid_cards_transactionId_key" ON "prepaid_cards"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "prepaid_cards_cardNumber_key" ON "prepaid_cards"("cardNumber");

-- CreateIndex
CREATE INDEX "prepaid_cards_cardNumber_idx" ON "prepaid_cards"("cardNumber");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_transactionId_key" ON "receipts"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_receiptNumber_key" ON "receipts"("receiptNumber");

-- CreateIndex
CREATE INDEX "receipts_receiptNumber_idx" ON "receipts"("receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "settlements_transactionId_key" ON "settlements"("transactionId");

-- CreateIndex
CREATE INDEX "settlements_transactionId_idx" ON "settlements"("transactionId");

-- CreateIndex
CREATE INDEX "settlements_status_idx" ON "settlements"("status");

-- CreateIndex
CREATE UNIQUE INDEX "bank_details_settlementId_key" ON "bank_details"("settlementId");

-- CreateIndex
CREATE UNIQUE INDEX "bank_details_reference_key" ON "bank_details"("reference");

-- CreateIndex
CREATE INDEX "payout_instructions_transactionId_idx" ON "payout_instructions"("transactionId");

-- CreateIndex
CREATE INDEX "payout_instructions_status_idx" ON "payout_instructions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "payment_receipts_receiptNumber_key" ON "payment_receipts"("receiptNumber");

-- CreateIndex
CREATE INDEX "payment_receipts_transactionId_idx" ON "payment_receipts"("transactionId");

-- CreateIndex
CREATE INDEX "payment_receipts_receiptNumber_idx" ON "payment_receipts"("receiptNumber");

-- CreateIndex
CREATE INDEX "exchange_rates_fromCurrency_toCurrency_isActive_idx" ON "exchange_rates"("fromCurrency", "toCurrency", "isActive");

-- CreateIndex
CREATE INDEX "aml_checks_transactionId_idx" ON "aml_checks"("transactionId");

-- CreateIndex
CREATE INDEX "aml_checks_userId_idx" ON "aml_checks"("userId");

-- CreateIndex
CREATE INDEX "aml_checks_status_idx" ON "aml_checks"("status");

-- CreateIndex
CREATE INDEX "aml_flags_checkId_idx" ON "aml_flags"("checkId");

-- CreateIndex
CREATE INDEX "aml_flags_severity_idx" ON "aml_flags"("severity");

-- CreateIndex
CREATE INDEX "compliance_reviews_checkId_idx" ON "compliance_reviews"("checkId");

-- CreateIndex
CREATE INDEX "compliance_reviews_transactionId_idx" ON "compliance_reviews"("transactionId");

-- CreateIndex
CREATE INDEX "compliance_reviews_reviewerId_idx" ON "compliance_reviews"("reviewerId");

-- CreateIndex
CREATE INDEX "compliance_reviews_status_idx" ON "compliance_reviews"("status");

-- CreateIndex
CREATE INDEX "watch_lists_name_idx" ON "watch_lists"("name");

-- CreateIndex
CREATE INDEX "watch_lists_type_idx" ON "watch_lists"("type");

-- CreateIndex
CREATE INDEX "watch_lists_isActive_idx" ON "watch_lists"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "nfiu_reports_reportReference_key" ON "nfiu_reports"("reportReference");

-- CreateIndex
CREATE INDEX "nfiu_reports_transactionId_idx" ON "nfiu_reports"("transactionId");

-- CreateIndex
CREATE INDEX "nfiu_reports_userId_idx" ON "nfiu_reports"("userId");

-- CreateIndex
CREATE INDEX "verification_requests_transactionId_idx" ON "verification_requests"("transactionId");

-- CreateIndex
CREATE INDEX "verification_requests_status_idx" ON "verification_requests"("status");

-- CreateIndex
CREATE INDEX "verification_requests_priority_idx" ON "verification_requests"("priority");

-- CreateIndex
CREATE INDEX "verification_results_requestId_idx" ON "verification_results"("requestId");

-- CreateIndex
CREATE INDEX "admin_reviews_requestId_idx" ON "admin_reviews"("requestId");

-- CreateIndex
CREATE INDEX "admin_reviews_reviewerId_idx" ON "admin_reviews"("reviewerId");

-- CreateIndex
CREATE INDEX "external_api_logs_provider_idx" ON "external_api_logs"("provider");

-- CreateIndex
CREATE INDEX "external_api_logs_success_idx" ON "external_api_logs"("success");

-- CreateIndex
CREATE UNIQUE INDEX "audit_events_eventId_key" ON "audit_events"("eventId");

-- CreateIndex
CREATE INDEX "audit_events_eventType_idx" ON "audit_events"("eventType");

-- CreateIndex
CREATE INDEX "audit_events_category_idx" ON "audit_events"("category");

-- CreateIndex
CREATE INDEX "audit_events_userId_idx" ON "audit_events"("userId");

-- CreateIndex
CREATE INDEX "audit_events_resourceType_resourceId_idx" ON "audit_events"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "audit_events_timestamp_idx" ON "audit_events"("timestamp");

-- CreateIndex
CREATE INDEX "audit_events_correlationId_idx" ON "audit_events"("correlationId");

-- CreateIndex
CREATE INDEX "log_traces_traceId_idx" ON "log_traces"("traceId");

-- CreateIndex
CREATE INDEX "log_traces_serviceName_idx" ON "log_traces"("serviceName");

-- CreateIndex
CREATE INDEX "log_traces_startTime_idx" ON "log_traces"("startTime");

-- CreateIndex
CREATE INDEX "system_metrics_serviceName_idx" ON "system_metrics"("serviceName");

-- CreateIndex
CREATE INDEX "system_metrics_metricType_idx" ON "system_metrics"("metricType");

-- CreateIndex
CREATE INDEX "system_metrics_timestamp_idx" ON "system_metrics"("timestamp");

-- CreateIndex
CREATE INDEX "security_events_eventType_idx" ON "security_events"("eventType");

-- CreateIndex
CREATE INDEX "security_events_severity_idx" ON "security_events"("severity");

-- CreateIndex
CREATE INDEX "security_events_userId_idx" ON "security_events"("userId");

-- CreateIndex
CREATE INDEX "security_events_resolved_idx" ON "security_events"("resolved");

-- AddForeignKey
ALTER TABLE "user_credentials" ADD CONSTRAINT "user_credentials_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_kyc" ADD CONSTRAINT "user_kyc_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_logs" ADD CONSTRAINT "otp_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_steps" ADD CONSTRAINT "transaction_steps_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_documents" ADD CONSTRAINT "transaction_documents_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_history" ADD CONSTRAINT "transaction_history_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_pickup" ADD CONSTRAINT "cash_pickup_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prepaid_cards" ADD CONSTRAINT "prepaid_cards_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_details" ADD CONSTRAINT "bank_details_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "settlements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aml_flags" ADD CONSTRAINT "aml_flags_checkId_fkey" FOREIGN KEY ("checkId") REFERENCES "aml_checks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_reviews" ADD CONSTRAINT "compliance_reviews_checkId_fkey" FOREIGN KEY ("checkId") REFERENCES "aml_checks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_results" ADD CONSTRAINT "verification_results_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "verification_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_reviews" ADD CONSTRAINT "admin_reviews_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "verification_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
