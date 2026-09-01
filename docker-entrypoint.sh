#!/bin/sh

# Docker entrypoint script for Sochatoa API

set -e

echo "=========================================="
echo "Sochatoa API - Starting..."
echo "=========================================="

# ──────────────────────────────────────────────
# 1. Wait for PostgreSQL
# ──────────────────────────────────────────────
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:\/]*\).*/\1/p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
[ -z "$DB_PORT" ] && DB_PORT=5432

echo "⏳ Waiting for PostgreSQL at $DB_HOST:$DB_PORT..."
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
  if nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; then
    echo "✅ PostgreSQL is ready!"
    break
  fi
  attempt=$((attempt + 1))
  echo "   attempt $attempt/$max_attempts"
  sleep 2
done
if [ $attempt -eq $max_attempts ]; then
  echo "❌ PostgreSQL did not become ready in time"
  exit 1
fi

# ──────────────────────────────────────────────
# 2. Wait for Redis
# ──────────────────────────────────────────────
REDIS_HOST=$(echo "$REDIS_URL" | sed -n 's/redis:\/\/\([^:]*\).*/\1/p')
REDIS_PORT=$(echo "$REDIS_URL" | sed -n 's/.*:\([0-9]*\)$/\1/p')
[ -z "$REDIS_PORT" ] || [ "$REDIS_PORT" = "$REDIS_HOST" ] && REDIS_PORT=6379
[ -z "$REDIS_HOST" ] && REDIS_HOST=$(echo "$REDIS_URL" | sed -n 's/redis:\/\/\(.*\)/\1/p' | cut -d: -f1)

echo "⏳ Waiting for Redis at $REDIS_HOST:$REDIS_PORT..."
attempt=0
while [ $attempt -lt $max_attempts ]; do
  if nc -z "$REDIS_HOST" "$REDIS_PORT" 2>/dev/null; then
    echo "✅ Redis is ready!"
    break
  fi
  attempt=$((attempt + 1))
  echo "   attempt $attempt/$max_attempts"
  sleep 2
done
if [ $attempt -eq $max_attempts ]; then
  echo "⚠️  Redis did not become ready in time (continuing anyway...)"
fi

# ──────────────────────────────────────────────
# 3. Run Prisma migrations
# ──────────────────────────────────────────────
echo ""
echo "🚀 Running database migrations and schema sync..."
npx prisma migrate deploy && echo "✅ Migrations deployed successfully" || echo "⚠️  Migration deploy had issues — continuing"
npx prisma db push --accept-data-loss && echo "✅ Schema synced via db push successfully" || echo "⚠️  Prisma db push had issues — continuing"

# ──────────────────────────────────────────────
# 4. Schema fallback (idempotent safety net)
#    Covers any schema changes not yet in a migration.
#    All statements use IF NOT EXISTS / IF EXISTS guards.
# ──────────────────────────────────────────────
echo ""
echo "🔧 Applying schema fallback patches..."
cat > /tmp/schema-fallback.sql <<'EOF'
-- Ensure taxClearanceNumber column exists
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "taxClearanceNumber" TEXT;

-- Ensure agents.password column exists
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "password" TEXT;

-- Ensure agents.isActive defaults to false
ALTER TABLE "agents" ALTER COLUMN "isActive" SET DEFAULT false;

-- Ensure agents.isApproved defaults to false
ALTER TABLE "agents" ALTER COLUMN "isApproved" SET DEFAULT false;

-- Ensure departments.isDefault exists
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- Ensure AGENT_SET_PASSWORD exists in OtpPurpose enum
DO $$ BEGIN
  ALTER TYPE "OtpPurpose" ADD VALUE IF NOT EXISTS 'AGENT_SET_PASSWORD';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Ensure CHANGE_PASSWORD exists in OtpPurpose enum
DO $$ BEGIN
  ALTER TYPE "OtpPurpose" ADD VALUE IF NOT EXISTS 'CHANGE_PASSWORD';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Ensure users.createdByAgentId column exists
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "createdByAgentId" TEXT;
CREATE INDEX IF NOT EXISTS "users_createdByAgentId_idx" ON "users"("createdByAgentId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_createdByAgentId_fkey') THEN
    ALTER TABLE "users"
      ADD CONSTRAINT "users_createdByAgentId_fkey"
      FOREIGN KEY ("createdByAgentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Ensure transactions.createdByAgentId column exists
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "createdByAgentId" TEXT;
CREATE INDEX IF NOT EXISTS "transactions_createdByAgentId_idx" ON "transactions"("createdByAgentId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_createdByAgentId_fkey') THEN
    ALTER TABLE "transactions"
      ADD CONSTRAINT "transactions_createdByAgentId_fkey"
      FOREIGN KEY ("createdByAgentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_userId_fkey') THEN
    ALTER TABLE "transactions"
      ADD CONSTRAINT "transactions_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "createdByAgentId" TEXT;
CREATE INDEX IF NOT EXISTS "tickets_createdByAgentId_idx" ON "tickets"("createdByAgentId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_createdByAgentId_fkey') THEN
    ALTER TABLE "tickets"
      ADD CONSTRAINT "tickets_createdByAgentId_fkey"
      FOREIGN KEY ("createdByAgentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "createdByAdminId" TEXT;
CREATE INDEX IF NOT EXISTS "tickets_createdByAdminId_idx" ON "tickets"("createdByAdminId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_createdByAdminId_fkey') THEN
    ALTER TABLE "tickets"
      ADD CONSTRAINT "tickets_createdByAdminId_fkey"
      FOREIGN KEY ("createdByAdminId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "transactionId" TEXT;
CREATE INDEX IF NOT EXISTS "tickets_transactionId_idx" ON "tickets"("transactionId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_transactionId_fkey') THEN
    ALTER TABLE "tickets"
      ADD CONSTRAINT "tickets_transactionId_fkey"
      FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "exchange_rates" ADD COLUMN IF NOT EXISTS "note" TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_users' AND column_name = 'sequenceId') THEN
    ALTER TABLE "admin_users" ADD COLUMN "sequenceId" SERIAL;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_users_sequenceId_key') THEN
      ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_sequenceId_key" UNIQUE ("sequenceId");
    END IF;
  END IF;
END $$;

-- Ensure EscrowAccountStatus enum and escrow_accounts table exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EscrowAccountStatus') THEN
    CREATE TYPE "EscrowAccountStatus" AS ENUM ('ACTIVE', 'INACTIVE');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "escrow_accounts" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "currency" TEXT NOT NULL DEFAULT 'NGN - Naira',
  "bankName" TEXT NOT NULL,
  "accountNumber" TEXT NOT NULL,
  "accountName" TEXT NOT NULL,
  "status" "EscrowAccountStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "escrow_accounts_accountNumber_key" ON "escrow_accounts"("accountNumber");
CREATE INDEX IF NOT EXISTS "escrow_accounts_status_idx" ON "escrow_accounts"("status");

-- Ensure pickup_stations table exists
CREATE TABLE IF NOT EXISTS "pickup_stations" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phoneNumber" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "region" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "pickup_stations_name_idx" ON "pickup_stations"("name");
CREATE INDEX IF NOT EXISTS "pickup_stations_state_idx" ON "pickup_stations"("state");
CREATE INDEX IF NOT EXISTS "pickup_stations_region_idx" ON "pickup_stations"("region");
CREATE INDEX IF NOT EXISTS "pickup_stations_status_idx" ON "pickup_stations"("status");

-- Seed a default USD->NGN exchange rate if none exist
DO $$
DECLARE rate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO rate_count FROM "exchange_rates";
  IF rate_count = 0 THEN
    INSERT INTO "exchange_rates"(
      "id","fromCurrency","toCurrency","rate","buyRate","sellRate","source","validFrom","validUntil","createdAt","updatedAt","isActive"
    ) VALUES (
      gen_random_uuid(), 'USD', 'NGN', 1500.000000, 1490.000000, 1500.000000, 'SEED',
      NOW() - INTERVAL '1 hour', NOW() + INTERVAL '30 days', NOW(), NOW(), true
    );
  END IF;
END $$;

-- Ensure TransactionMode enum and column exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TransactionMode') THEN
    CREATE TYPE "TransactionMode" AS ENUM ('BUY', 'SELL');
  END IF;
END $$;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "transaction_mode" "TransactionMode";
CREATE INDEX IF NOT EXISTS "transactions_transaction_mode_idx" ON "transactions"("transaction_mode");

-- Convert admin_actions.actionType from enum to TEXT if needed
DO $$
DECLARE col_data_type TEXT; col_udt_name TEXT;
BEGIN
  SELECT data_type, udt_name INTO col_data_type, col_udt_name
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'admin_actions' AND column_name = 'actionType';

  IF col_data_type = 'USER-DEFINED' AND col_udt_name = 'ActionType' THEN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'admin_actions_actionType_idx') THEN
      EXECUTE 'DROP INDEX "admin_actions_actionType_idx"';
    END IF;
    ALTER TABLE "admin_actions" ADD COLUMN IF NOT EXISTS "actionType_text" TEXT;
    UPDATE "admin_actions" SET "actionType_text" = "actionType"::text WHERE "actionType" IS NOT NULL;
    ALTER TABLE "admin_actions" DROP COLUMN "actionType";
    ALTER TABLE "admin_actions" RENAME COLUMN "actionType_text" TO "actionType";
    CREATE INDEX IF NOT EXISTS "admin_actions_actionType_idx" ON "admin_actions"("actionType");
  END IF;
END $$;

-- Ensure cash_pickup recipient fields are nullable
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cash_pickup' AND column_name = 'recipientName' AND is_nullable = 'NO') THEN
    ALTER TABLE "cash_pickup" ALTER COLUMN "recipientName" DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cash_pickup' AND column_name = 'recipientPhone' AND is_nullable = 'NO') THEN
    ALTER TABLE "cash_pickup" ALTER COLUMN "recipientPhone" DROP NOT NULL;
  END IF;
END $$;

-- Ensure createdBy/createdById columns exist in roles and departments
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "createdBy" TEXT;
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'roles_createdById_fkey') THEN
    ALTER TABLE "roles" ADD CONSTRAINT "roles_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "roles_createdById_idx" ON "roles"("createdById");

ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "createdBy" TEXT;
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'departments_createdById_fkey') THEN
    ALTER TABLE "departments" ADD CONSTRAINT "departments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "departments_createdById_idx" ON "departments"("createdById");

-- Ensure new DocumentType enum values exist
DO $$ BEGIN ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'TCC'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'STATEMENT_OF_RESULT'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'DEGREE'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'MEMBERSHIP_CARD'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'WORK_PERMIT'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'PROOF_OF_FUNDS'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'SOURCE_OF_FUNDS_DECLARATION'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'DIGITAL_SIGNATURE'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'BANK_VERIFICATION'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'STUDENT_PASSPORT'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TYPE "TransactionStatus" ADD VALUE IF NOT EXISTS 'PENDING_RECORD_VALIDATION'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "TransactionStatus" ADD VALUE IF NOT EXISTS 'AWAITING_DISBURSEMENT'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "TransactionStatus" ADD VALUE IF NOT EXISTS 'AWAITING_REFUND_VERIFICATION'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "TransactionStatus" ADD VALUE IF NOT EXISTS 'REFUNDED'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "TransactionStep" ADD VALUE IF NOT EXISTS 'REFUNDED'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "TransactionStep" ADD VALUE IF NOT EXISTS 'COMPLETED'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'REJECTED'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "DisbursementOption" ADD VALUE IF NOT EXISTS 'CASH_AND_TRANSFER'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "ProvidusTransactionStatus" ADD VALUE IF NOT EXISTS 'REVERSED'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "user_kyc" ADD COLUMN IF NOT EXISTS "passportIssueDate" TIMESTAMPTZ; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "user_kyc" ADD COLUMN IF NOT EXISTS "passportExpiryDate" TIMESTAMPTZ; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "customer_bank_accounts" ADD COLUMN IF NOT EXISTS "currency" TEXT; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "customer_bank_accounts" ADD COLUMN IF NOT EXISTS "swiftCode" TEXT; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "customer_bank_accounts" ADD COLUMN IF NOT EXISTS "iban" TEXT; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "customer_bank_accounts" ADD COLUMN IF NOT EXISTS "routingNumber" TEXT; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "customer_bank_accounts" ADD COLUMN IF NOT EXISTS "bankAddress" TEXT; EXCEPTION WHEN others THEN NULL; END $$;

-- Providus / Settlement enums and tables
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SettlementDirection') THEN CREATE TYPE "SettlementDirection" AS ENUM ('INBOUND', 'OUTBOUND'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SettlementStatus') THEN CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUBMITTED', 'COMPLETED', 'FAILED', 'CANCELLED', 'REQUIRES_APPROVAL'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VirtualAccountType') THEN CREATE TYPE "VirtualAccountType" AS ENUM ('DYNAMIC', 'RESERVED'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VirtualAccountStatus') THEN CREATE TYPE "VirtualAccountStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLACKLISTED'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProvidusTransactionStatus') THEN CREATE TYPE "ProvidusTransactionStatus" AS ENUM ('PENDING', 'VERIFIED', 'SETTLED', 'FAILED'); END IF; END $$;

CREATE TABLE IF NOT EXISTS "virtual_accounts" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT,
  "transactionId" TEXT UNIQUE,
  "accountNumber" TEXT NOT NULL UNIQUE,
  "accountName" TEXT NOT NULL,
  "type" "VirtualAccountType" NOT NULL,
  "status" "VirtualAccountStatus" NOT NULL DEFAULT 'ACTIVE',
  "bankName" TEXT NOT NULL DEFAULT 'Providus Bank',
  "initiationTranRef" TEXT,
  "bvn" TEXT,
  "isBlacklisted" BOOLEAN NOT NULL DEFAULT false,
  "blacklistedAt" TIMESTAMP(3),
  "blacklistReason" TEXT,
  "expiresAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "virtual_accounts_userId_idx" ON "virtual_accounts"("userId");
CREATE INDEX IF NOT EXISTS "virtual_accounts_transactionId_idx" ON "virtual_accounts"("transactionId");
CREATE INDEX IF NOT EXISTS "virtual_accounts_accountNumber_idx" ON "virtual_accounts"("accountNumber");
CREATE INDEX IF NOT EXISTS "virtual_accounts_status_idx" ON "virtual_accounts"("status");

CREATE TABLE IF NOT EXISTS "providus_deposits" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "virtualAccountId" TEXT NOT NULL,
  "transactionId" TEXT,
  "sessionId" TEXT NOT NULL UNIQUE,
  "settlementId" TEXT UNIQUE,
  "accountNumber" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "settledAmount" DECIMAL(18,2) NOT NULL,
  "feeAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "vatAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "sourceAccountNumber" TEXT,
  "sourceAccountName" TEXT,
  "sourceBankName" TEXT,
  "channelId" TEXT,
  "tranRemarks" TEXT,
  "tranDateTime" TIMESTAMP(3),
  "status" "ProvidusTransactionStatus" NOT NULL DEFAULT 'PENDING',
  "verifiedAt" TIMESTAMP(3),
  "webhookReceivedAt" TIMESTAMP(3),
  "webhookPayload" JSONB,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "providus_deposits_virtualAccountId_fkey" FOREIGN KEY ("virtualAccountId") REFERENCES "virtual_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "providus_deposits_virtualAccountId_idx" ON "providus_deposits"("virtualAccountId");
CREATE INDEX IF NOT EXISTS "providus_deposits_transactionId_idx" ON "providus_deposits"("transactionId");
CREATE INDEX IF NOT EXISTS "providus_deposits_sessionId_idx" ON "providus_deposits"("sessionId");
CREATE INDEX IF NOT EXISTS "providus_deposits_settlementId_idx" ON "providus_deposits"("settlementId");
CREATE INDEX IF NOT EXISTS "providus_deposits_status_idx" ON "providus_deposits"("status");
CREATE INDEX IF NOT EXISTS "providus_deposits_accountNumber_idx" ON "providus_deposits"("accountNumber");

CREATE TABLE IF NOT EXISTS "settlement_batches" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "batchNumber" TEXT NOT NULL UNIQUE,
  "direction" "SettlementDirection" NOT NULL,
  "totalAmount" DECIMAL(18,2) NOT NULL,
  "totalCount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "status" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
  "description" TEXT,
  "createdBy" TEXT NOT NULL,
  "approvedBy" TEXT,
  "processedBy" TEXT,
  "approvedAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failureReason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "settlement_batches_batchNumber_idx" ON "settlement_batches"("batchNumber");
CREATE INDEX IF NOT EXISTS "settlement_batches_status_idx" ON "settlement_batches"("status");
CREATE INDEX IF NOT EXISTS "settlement_batches_createdBy_idx" ON "settlement_batches"("createdBy");
CREATE INDEX IF NOT EXISTS "settlement_batches_direction_idx" ON "settlement_batches"("direction");

CREATE TABLE IF NOT EXISTS "outbound_settlements" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "batchId" TEXT,
  "transactionId" TEXT,
  "referenceNumber" TEXT NOT NULL UNIQUE,
  "amount" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL,
  "status" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
  "beneficiaryName" TEXT NOT NULL,
  "beneficiaryBank" TEXT,
  "beneficiaryAccount" TEXT,
  "beneficiarySwift" TEXT,
  "beneficiaryIban" TEXT,
  "beneficiaryCountry" TEXT,
  "beneficiaryAddress" TEXT,
  "paymentMethod" TEXT NOT NULL,
  "paymentReference" TEXT,
  "paymentProof" TEXT,
  "providusReference" TEXT,
  "providusSessionId" TEXT,
  "providusResponse" JSONB,
  "initiatedBy" TEXT NOT NULL,
  "approvedBy" TEXT,
  "processedBy" TEXT,
  "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt" TIMESTAMP(3),
  "processedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "failureReason" TEXT,
  "notes" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "outbound_settlements_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "settlement_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "outbound_settlements_batchId_idx" ON "outbound_settlements"("batchId");
CREATE INDEX IF NOT EXISTS "outbound_settlements_transactionId_idx" ON "outbound_settlements"("transactionId");
CREATE INDEX IF NOT EXISTS "outbound_settlements_referenceNumber_idx" ON "outbound_settlements"("referenceNumber");
CREATE INDEX IF NOT EXISTS "outbound_settlements_status_idx" ON "outbound_settlements"("status");
CREATE INDEX IF NOT EXISTS "outbound_settlements_initiatedBy_idx" ON "outbound_settlements"("initiatedBy");

CREATE TABLE IF NOT EXISTS "settlement_reconciliations" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "settlementId" TEXT NOT NULL,
  "reconciliationType" TEXT NOT NULL,
  "expectedAmount" DECIMAL(18,2) NOT NULL,
  "actualAmount" DECIMAL(18,2),
  "variance" DECIMAL(18,2),
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "providusData" JSONB,
  "reconciledBy" TEXT,
  "reconciledAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "settlement_reconciliations_settlementId_idx" ON "settlement_reconciliations"("settlementId");
CREATE INDEX IF NOT EXISTS "settlement_reconciliations_status_idx" ON "settlement_reconciliations"("status");

-- Workflow enums and schema updates
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WorkflowProcessType') THEN CREATE TYPE "WorkflowProcessType" AS ENUM ('RIGID_LINEAR', 'FLEXIBLE'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ApprovalType') THEN CREATE TYPE "ApprovalType" AS ENUM ('TRANSACTION', 'REFUND', 'RATE'); END IF; END $$;

ALTER TABLE "workflow_templates" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "workflow_templates" ADD COLUMN IF NOT EXISTS "processType" "WorkflowProcessType" NOT NULL DEFAULT 'RIGID_LINEAR';
ALTER TABLE "workflow_templates" ADD COLUMN IF NOT EXISTS "action" TEXT;
ALTER TABLE "workflow_templates" ADD COLUMN IF NOT EXISTS "branchId" TEXT;
ALTER TABLE "workflow_templates" ADD COLUMN IF NOT EXISTS "type" TEXT;
ALTER TABLE "workflow_templates" ALTER COLUMN "type" TYPE TEXT;
ALTER TABLE "workflow_templates" ADD COLUMN IF NOT EXISTS "approvalType" "ApprovalType" NOT NULL DEFAULT 'TRANSACTION';
ALTER TABLE "workflow_templates" ADD COLUMN IF NOT EXISTS "minAmount" DECIMAL(18, 2);
ALTER TABLE "workflow_templates" ADD COLUMN IF NOT EXISTS "maxAmount" DECIMAL(18, 2);
CREATE INDEX IF NOT EXISTS "workflow_templates_branchId_idx" ON "workflow_templates"("branchId");

ALTER TABLE "workflow_stages" ADD COLUMN IF NOT EXISTS "type" TEXT;
ALTER TABLE "workflow_stages" ALTER COLUMN "type" TYPE TEXT;
ALTER TABLE "workflow_stages" ADD COLUMN IF NOT EXISTS "escalationAdminId" TEXT;
CREATE INDEX IF NOT EXISTS "workflow_stages_escalationAdminId_idx" ON "workflow_stages"("escalationAdminId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workflow_stages_escalationAdminId_fkey') THEN
    ALTER TABLE "workflow_stages" ADD CONSTRAINT "workflow_stages_escalationAdminId_fkey" FOREIGN KEY ("escalationAdminId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "workflow_assignees" ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "workflowTemplateId" TEXT;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "currentWorkflowStageId" TEXT;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "disbursementWorkflowTemplateId" TEXT;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "disbursementWorkflowStageId" TEXT;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "disbursementApprovalStatus" TEXT;
CREATE INDEX IF NOT EXISTS "transactions_disbursementWorkflowTemplateId_idx" ON "transactions"("disbursementWorkflowTemplateId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_disbursementWorkflowTemplateId_fkey') THEN
    ALTER TABLE "transactions"
      ADD CONSTRAINT "transactions_disbursementWorkflowTemplateId_fkey"
      FOREIGN KEY ("disbursementWorkflowTemplateId") REFERENCES "workflow_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN ALTER TYPE "ApprovalType" ADD VALUE IF NOT EXISTS 'DISBURSEMENT'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "workflow_stage_types" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "workflow_stage_types_name_key" ON "workflow_stage_types"("name");

ALTER TABLE "exchange_rates" ADD COLUMN IF NOT EXISTS "workflowTemplateId" TEXT;
ALTER TABLE "exchange_rates" ADD COLUMN IF NOT EXISTS "currentWorkflowStageId" TEXT;
ALTER TABLE "exchange_rates" ADD COLUMN IF NOT EXISTS "isApproved" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "exchange_rates_workflowTemplateId_idx" ON "exchange_rates"("workflowTemplateId");
CREATE INDEX IF NOT EXISTS "exchange_rates_currentWorkflowStageId_idx" ON "exchange_rates"("currentWorkflowStageId");

ALTER TABLE "wallet_entries" ADD COLUMN IF NOT EXISTS "workflowTemplateId" TEXT;
ALTER TABLE "wallet_entries" ADD COLUMN IF NOT EXISTS "currentWorkflowStageId" TEXT;
CREATE INDEX IF NOT EXISTS "wallet_entries_workflowTemplateId_idx" ON "wallet_entries"("workflowTemplateId");
CREATE INDEX IF NOT EXISTS "wallet_entries_currentWorkflowStageId_idx" ON "wallet_entries"("currentWorkflowStageId");

ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "amountPaid" DECIMAL(18,2);
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "balanceDue" DECIMAL(18,2);

-- Customer bank accounts and wallet tables
CREATE TABLE IF NOT EXISTS "customer_bank_accounts" (
  "id"            TEXT NOT NULL PRIMARY KEY,
  "userId"        TEXT NOT NULL,
  "bankName"      TEXT NOT NULL,
  "accountNumber" TEXT NOT NULL,
  "accountName"   TEXT NOT NULL,
  "isVerified"    BOOLEAN NOT NULL DEFAULT false,
  "isDefault"     BOOLEAN NOT NULL DEFAULT false,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_bank_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "customer_bank_accounts_userId_accountNumber_key" UNIQUE ("userId", "accountNumber")
);
CREATE INDEX IF NOT EXISTS "customer_bank_accounts_userId_idx" ON "customer_bank_accounts"("userId");

CREATE TABLE IF NOT EXISTS "transaction_bank_accounts" (
  "id"                    TEXT NOT NULL PRIMARY KEY,
  "transactionId"         TEXT NOT NULL,
  "customerBankAccountId" TEXT NOT NULL,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "transaction_bank_accounts_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "transaction_bank_accounts_customerBankAccountId_fkey" FOREIGN KEY ("customerBankAccountId") REFERENCES "customer_bank_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "transaction_bank_accounts_transactionId_customerBankAccountId_key" UNIQUE ("transactionId", "customerBankAccountId")
);
CREATE INDEX IF NOT EXISTS "transaction_bank_accounts_transactionId_idx" ON "transaction_bank_accounts"("transactionId");

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DisbursementOption') THEN CREATE TYPE "DisbursementOption" AS ENUM ('ELECTRONIC_TRANSFER', 'CARD', 'CARD_AND_CASH', 'CASH_AND_TRANSFER'); END IF; END $$;
DO $$ BEGIN ALTER TYPE "DisbursementOption" ADD VALUE IF NOT EXISTS 'CASH_AND_TRANSFER'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "disbursementOption" "DisbursementOption";
CREATE INDEX IF NOT EXISTS "transactions_disbursementOption_idx" ON "transactions"("disbursementOption");

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WalletEntryType') THEN CREATE TYPE "WalletEntryType" AS ENUM ('DEBIT', 'CREDIT'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WalletEntryStatus') THEN CREATE TYPE "WalletEntryStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REVERSED'); END IF; END $$;

CREATE TABLE IF NOT EXISTS "customer_wallets" (
  "id"        TEXT NOT NULL PRIMARY KEY,
  "userId"    TEXT NOT NULL UNIQUE,
  "balance"   DECIMAL(18,2) NOT NULL DEFAULT 0,
  "currency"  TEXT NOT NULL DEFAULT 'NGN',
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "customer_wallets_userId_idx" ON "customer_wallets"("userId");

CREATE TABLE IF NOT EXISTS "wallet_entries" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "walletId"       TEXT NOT NULL,
  "transactionId"  TEXT,
  "transactionRef" TEXT,
  "sessionId"      TEXT,
  "type"           "WalletEntryType" NOT NULL,
  "amount"         DECIMAL(18,2) NOT NULL,
  "balanceBefore"  DECIMAL(18,2) NOT NULL,
  "balanceAfter"   DECIMAL(18,2) NOT NULL,
  "description"    TEXT,
  "status"         "WalletEntryStatus" NOT NULL DEFAULT 'COMPLETED',
  "metadata"       JSONB,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "wallet_entries_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "customer_wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "wallet_entries_walletId_idx"      ON "wallet_entries"("walletId");
CREATE INDEX IF NOT EXISTS "wallet_entries_transactionId_idx" ON "wallet_entries"("transactionId");
CREATE INDEX IF NOT EXISTS "wallet_entries_sessionId_idx"     ON "wallet_entries"("sessionId");
CREATE INDEX IF NOT EXISTS "wallet_entries_type_idx"          ON "wallet_entries"("type");
CREATE INDEX IF NOT EXISTS "wallet_entries_createdAt_idx"     ON "wallet_entries"("createdAt");

ALTER TABLE "wallet_entries" ADD COLUMN IF NOT EXISTS "matchStatus" TEXT;
ALTER TABLE "wallet_entries" ADD COLUMN IF NOT EXISTS "linkedTransactionId" TEXT;
ALTER TABLE "wallet_entries" ADD COLUMN IF NOT EXISTS "linkReason" TEXT;
ALTER TABLE "wallet_entries" ADD COLUMN IF NOT EXISTS "isFlagged" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "wallet_entries" ADD COLUMN IF NOT EXISTS "flagReason" TEXT;
ALTER TABLE "wallet_entries" ADD COLUMN IF NOT EXISTS "flaggedBy" TEXT;
ALTER TABLE "wallet_entries" ADD COLUMN IF NOT EXISTS "flaggedAt" TIMESTAMP(3);
ALTER TABLE "wallet_entries" ADD COLUMN IF NOT EXISTS "refundStatus" TEXT;
ALTER TABLE "wallet_entries" ADD COLUMN IF NOT EXISTS "refundedBy" TEXT;
ALTER TABLE "wallet_entries" ADD COLUMN IF NOT EXISTS "refundedAt" TIMESTAMP(3);
ALTER TABLE "wallet_entries" ADD COLUMN IF NOT EXISTS "disbursementStatus" TEXT;
ALTER TABLE "wallet_entries" ADD COLUMN IF NOT EXISTS "disbursedBy" TEXT;
ALTER TABLE "wallet_entries" ADD COLUMN IF NOT EXISTS "disbursedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "wallet_entries_matchStatus_idx" ON "wallet_entries"("matchStatus");
CREATE INDEX IF NOT EXISTS "wallet_entries_isFlagged_idx"   ON "wallet_entries"("isFlagged");

CREATE TABLE IF NOT EXISTS "wallet_entry_notes" (
  "id"        TEXT NOT NULL PRIMARY KEY,
  "entryId"   TEXT NOT NULL,
  "adminId"   TEXT NOT NULL,
  "note"      TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "wallet_entry_notes_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "wallet_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "wallet_entry_notes_entryId_idx" ON "wallet_entry_notes"("entryId");
EOF

psql "${DATABASE_URL%\?*}" -f /tmp/schema-fallback.sql || echo "⚠️  Schema fallback had non-fatal errors, continuing..."
echo "✅ Schema fallback completed"

# ──────────────────────────────────────────────
# 5. Start the application
# ──────────────────────────────────────────────
echo ""
echo "🚀 Starting application..."
exec "$@"
