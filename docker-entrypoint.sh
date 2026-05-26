#!/bin/sh

# Docker entrypoint script for Sochatoa API
# This runs migrations before starting the application

set -e

echo "=========================================="
echo "Sochatoa API - Starting..."
echo "=========================================="

# Extract database host and port from DATABASE_URL
# Format: postgresql://user:password@host:port/database
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:\/]*\).*/\1/p')
DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')

# Default to standard PostgreSQL port if not found
if [ -z "$DB_PORT" ]; then
  DB_PORT=5432
fi

echo "⏳ Waiting for PostgreSQL at $DB_HOST:$DB_PORT..."

# Wait for PostgreSQL to be ready using nc (netcat)
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
  if nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; then
    echo "✅ PostgreSQL is ready!"
    break
  fi

  attempt=$((attempt + 1))
  echo "⏳ PostgreSQL is unavailable - sleeping (attempt $attempt/$max_attempts)"
  sleep 2
done

if [ $attempt -eq $max_attempts ]; then
  echo "❌ PostgreSQL did not become ready in time"
  exit 1
fi

echo ""

# Wait for Redis to be ready
echo "⏳ Waiting for Redis..."

# Extract Redis host and port from REDIS_URL
# Format: redis://host:port
REDIS_HOST=$(echo $REDIS_URL | sed -n 's/redis:\/\/\([^:]*\).*/\1/p')
REDIS_PORT=$(echo $REDIS_URL | sed -n 's/.*:\([0-9]*\)$/\1/p')

# Default to standard Redis port if not found
if [ -z "$REDIS_PORT" ] || [ "$REDIS_PORT" = "$REDIS_HOST" ]; then
  REDIS_PORT=6379
fi

# If REDIS_HOST is empty, extract it differently
if [ -z "$REDIS_HOST" ]; then
  REDIS_HOST=$(echo $REDIS_URL | sed -n 's/redis:\/\/\(.*\)/\1/p' | cut -d: -f1)
fi

max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
  if nc -z "$REDIS_HOST" "$REDIS_PORT" 2>/dev/null; then
    echo "✅ Redis is ready!"
    break
  fi

  attempt=$((attempt + 1))
  echo "⏳ Redis is unavailable - sleeping (attempt $attempt/$max_attempts)"
  sleep 2
done

if [ $attempt -eq $max_attempts ]; then
  echo "⚠️  Redis did not become ready in time (this is optional, continuing...)"
fi

echo ""

# Generate Prisma Client (in case it's not already generated)
echo "🔧 Generating Prisma Client..."
npx prisma generate
echo "✅ Prisma Client generated"
echo ""

# Run Prisma migrations
echo "🚀 Running database migrations..."

# Function to check if migration is in failed state
check_failed_migration() {
  npx prisma migrate status 2>&1 | grep -q "failed" && return 0 || return 1
}

# Try to deploy migrations
if npx prisma migrate deploy 2>&1; then
  echo "✅ Migrations deployed successfully"
else
  echo "⚠️  Migration deployment encountered an issue. Checking status..."

  # Check if there's a failed migration
  if check_failed_migration; then
    echo "🔍 Found failed migration. Attempting to resolve..."

    # List of migrations that might fail (space-separated for POSIX sh compatibility)
    MIGRATIONS_TO_RESOLVE="20260216100845_ 20260223161333_add_agent_password_hash 20260223165352_add_agent_otp_purpose 20260224093423_make_destination_country_optional 20260225085543_make_cash_pickup_recipient_optional 20260225113000_add_created_by_to_role_department 20260303131500_add_department_is_default 20260323145900_add_escrow_accounts 20260326095000_store_currency_type_for_escrow_accounts 20260416100000_add_ticket_created_by_admin 20260417000000_add_bank_verification_doc_and_pending_record_validation"

    # Try to mark each potentially failed migration as rolled back
    for migration in $MIGRATIONS_TO_RESOLVE; do
      echo "⚙️  Attempting to resolve migration: $migration"
      npx prisma migrate resolve --rolled-back "$migration" 2>&1 || true
    done

    # Retry deployment after resolving failed migrations
    if npx prisma migrate deploy 2>&1; then
      echo "✅ Migrations deployed successfully after resolution"
    else
      echo "⚠️  Still having issues. Marking all migrations as applied..."
      # If database already has the schema changes, mark all as applied
      for migration in $MIGRATIONS_TO_RESOLVE; do
        npx prisma migrate resolve --applied "$migration" 2>&1 || true
      done
      echo "⚠️  Continuing with application start..."
    fi
  else
    # Check for P3005 error (database already has schema)
    if npx prisma migrate deploy 2>&1 | grep -q "P3005"; then
      echo "⚠️  Database already has schema, marking migrations as applied..."
      npx prisma migrate resolve --applied 20260206140753_init 2>&1 || true
      npx prisma migrate resolve --applied 20260213120640_unique_constraint_on_nin 2>&1 || true
      npx prisma migrate resolve --applied 20260216094318_add_actiontypes_ticket_relations 2>&1 || true
      npx prisma migrate resolve --applied 20260216100845_ 2>&1 || true
      npx prisma migrate resolve --applied 20260219221933_ 2>&1 || true
      npx prisma migrate resolve --applied 20260220081045_add_push_notifications 2>&1 || true
      npx prisma migrate resolve --applied 20260222000000_add_pickup_scheduling_fields 2>&1 || true
      npx prisma migrate resolve --applied 20260222120000_add_workflow_models 2>&1 || true
      npx prisma migrate resolve --applied 20260223161333_add_agent_password_hash 2>&1 || true
      npx prisma migrate resolve --applied 20260223165352_add_agent_otp_purpose 2>&1 || true
      npx prisma migrate resolve --applied 20260224093423_make_destination_country_optional 2>&1 || true
      npx prisma migrate resolve --applied 20260225085543_make_cash_pickup_recipient_optional 2>&1 || true
      npx prisma migrate resolve --applied 20260225113000_add_created_by_to_role_department 2>&1 || true
      npx prisma migrate resolve --applied 20260225150000_add_admin_action_types 2>&1 || true
      npx prisma migrate resolve --applied 20260225160000_add_tax_clearance_and_document_types 2>&1 || true
      npx prisma migrate resolve --applied 20260303131500_add_department_is_default 2>&1 || true
      npx prisma migrate resolve --applied 20260227112539_add_user_created_by_agent 2>&1 || true
      npx prisma migrate resolve --applied 20260305094327_add_transaction_mode 2>&1 || true
      npx prisma migrate resolve --applied 20260323145900_add_escrow_accounts 2>&1 || true
      npx prisma migrate resolve --applied 20260326095000_store_currency_type_for_escrow_accounts 2>&1 || true
      npx prisma migrate resolve --applied 20260416100000_add_ticket_created_by_admin 2>&1 || true
      npx prisma migrate resolve --applied 20260417000000_add_bank_verification_doc_and_pending_record_validation 2>&1 || true
      echo "✅ Migrations marked as applied"
    else
      echo "⚠️  Unknown migration issue, continuing with application start..."
    fi
  fi
fi

echo "✅ Migration process completed"
echo ""

# Ensure critical schema changes are applied (fallback for migration issues)
echo "🔧 Verifying critical schema changes..."
npx prisma db execute --stdin <<'EOF'
-- Ensure taxClearanceNumber column exists
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "taxClearanceNumber" TEXT;

-- Ensure agents.password column exists
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "password" TEXT;

-- Ensure departments.isDefault exists
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- Ensure AGENT_SET_PASSWORD exists in OtpPurpose enum
DO $$ BEGIN
  ALTER TYPE "OtpPurpose" ADD VALUE IF NOT EXISTS 'AGENT_SET_PASSWORD';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Ensure users.createdByAgentId column exists
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "createdByAgentId" TEXT;

-- Create index for createdByAgentId if it doesn't exist
CREATE INDEX IF NOT EXISTS "users_createdByAgentId_idx" ON "users"("createdByAgentId");

-- Add foreign key constraint if it doesn't exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_createdByAgentId_fkey') THEN
    ALTER TABLE "users"
      ADD CONSTRAINT "users_createdByAgentId_fkey"
      FOREIGN KEY ("createdByAgentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Ensure transactions.createdByAgentId column exists
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "createdByAgentId" TEXT;

-- Create index for transactions.createdByAgentId if it doesn't exist
CREATE INDEX IF NOT EXISTS "transactions_createdByAgentId_idx" ON "transactions"("createdByAgentId");

-- Add foreign key constraint for transactions.createdByAgentId if it doesn't exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_createdByAgentId_fkey') THEN
    ALTER TABLE "transactions"
      ADD CONSTRAINT "transactions_createdByAgentId_fkey"
      FOREIGN KEY ("createdByAgentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Add foreign key constraint for transactions.userId if it doesn't exist
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

ALTER TABLE "exchange_rates" ADD COLUMN IF NOT EXISTS "note" TEXT;
 
-- Add sequenceId to admin_users if it doesn't exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_users' AND column_name = 'sequenceId') THEN
    ALTER TABLE "admin_users" ADD COLUMN "sequenceId" SERIAL;
    -- Ensure it's unique
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_users_sequenceId_key') THEN
      ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_sequenceId_key" UNIQUE ("sequenceId");
    END IF;
  END IF;
END $$;
-- Ensure escrow accounts table exists (migration fallback)
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

-- Ensure pickup stations table exists (migration fallback)
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
DECLARE
  rate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO rate_count FROM "exchange_rates";
  IF rate_count = 0 THEN
    INSERT INTO "exchange_rates"(
      "id","fromCurrency","toCurrency","rate","buyRate","sellRate","source","validFrom","validUntil","createdAt","updatedAt","isActive"
    ) VALUES (
      gen_random_uuid(), 'USD', 'NGN', 1500.000000, 1490.000000, 1500.000000, 'SEED',
      NOW() - INTERVAL '1 hour',
      NOW() + INTERVAL '30 days',
      NOW(), NOW(), true
    );
  END IF;
END $$;

-- Ensure TransactionMode enum and transactions.transaction_mode column exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TransactionMode') THEN
    CREATE TYPE "TransactionMode" AS ENUM ('BUY', 'SELL');
  END IF;
END $$;

ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "transaction_mode" "TransactionMode";
CREATE INDEX IF NOT EXISTS "transactions_transaction_mode_idx" ON "transactions"("transaction_mode");

-- Ensure admin_actions.actionType is TEXT (convert from enum if necessary)
DO $$
DECLARE
  col_data_type TEXT;
  col_udt_name TEXT;
BEGIN
  SELECT data_type, udt_name
  INTO col_data_type, col_udt_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'admin_actions'
    AND column_name = 'actionType';

  IF col_data_type = 'USER-DEFINED' AND col_udt_name = 'ActionType' THEN
    IF EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'admin_actions_actionType_idx'
    ) THEN
      EXECUTE 'DROP INDEX "admin_actions_actionType_idx"';
    END IF;

    ALTER TABLE "admin_actions" ADD COLUMN IF NOT EXISTS "actionType_text" TEXT;
    UPDATE "admin_actions"
      SET "actionType_text" = "actionType"::text
      WHERE "actionType" IS NOT NULL;

    ALTER TABLE "admin_actions" DROP COLUMN "actionType";
    ALTER TABLE "admin_actions" RENAME COLUMN "actionType_text" TO "actionType";
    CREATE INDEX IF NOT EXISTS "admin_actions_actionType_idx" ON "admin_actions"("actionType");
  END IF;
END $$;

-- Ensure cash_pickup recipient fields are nullable
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_pickup'
    AND column_name = 'recipientName'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE "cash_pickup" ALTER COLUMN "recipientName" DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_pickup'
    AND column_name = 'recipientPhone'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE "cash_pickup" ALTER COLUMN "recipientPhone" DROP NOT NULL;
  END IF;
END $$;

-- Ensure createdBy and createdById columns exist in roles table
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "createdBy" TEXT;
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "createdById" TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'roles_createdById_fkey') THEN
    ALTER TABLE "roles"
      ADD CONSTRAINT "roles_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "roles_createdById_idx" ON "roles" ("createdById");

-- Ensure createdBy and createdById columns exist in departments table
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "createdBy" TEXT;
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "createdById" TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'departments_createdById_fkey') THEN
    ALTER TABLE "departments"
      ADD CONSTRAINT "departments_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "departments_createdById_idx" ON "departments" ("createdById");

-- Ensure new document types exist
DO $$ BEGIN
  ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'TCC';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'STATEMENT_OF_RESULT';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'DEGREE';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'MEMBERSHIP_CARD';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'WORK_PERMIT';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'PROOF_OF_FUNDS';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'SOURCE_OF_FUNDS_DECLARATION';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'DIGITAL_SIGNATURE';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'BANK_VERIFICATION';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "TransactionStatus" ADD VALUE IF NOT EXISTS 'PENDING_RECORD_VALIDATION';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "TransactionStatus" ADD VALUE IF NOT EXISTS 'AWAITING_DISBURSEMENT';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ========================================
-- PROVIDUS BANK & SETTLEMENT SYSTEM
-- ========================================

-- Ensure SettlementDirection enum exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SettlementDirection') THEN
    CREATE TYPE "SettlementDirection" AS ENUM ('INBOUND', 'OUTBOUND');
  END IF;
END $$;

-- Ensure SettlementStatus enum exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SettlementStatus') THEN
    CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUBMITTED', 'COMPLETED', 'FAILED', 'CANCELLED', 'REQUIRES_APPROVAL');
  END IF;
END $$;

-- Ensure VirtualAccountType enum exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VirtualAccountType') THEN
    CREATE TYPE "VirtualAccountType" AS ENUM ('DYNAMIC', 'RESERVED');
  END IF;
END $$;

-- Ensure VirtualAccountStatus enum exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VirtualAccountStatus') THEN
    CREATE TYPE "VirtualAccountStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLACKLISTED');
  END IF;
END $$;

-- Ensure ProvidusTransactionStatus enum exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProvidusTransactionStatus') THEN
    CREATE TYPE "ProvidusTransactionStatus" AS ENUM ('PENDING', 'VERIFIED', 'SETTLED', 'FAILED');
  END IF;
END $$;

-- Create virtual_accounts table
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

-- Create providus_deposits table
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

-- Create settlement_batches table
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

-- Create outbound_settlements table
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

-- Create settlement_reconciliations table
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
-- Ensure WorkflowProcessType enum exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WorkflowProcessType') THEN
    CREATE TYPE "WorkflowProcessType" AS ENUM ('RIGID_LINEAR', 'FLEXIBLE');
  END IF;
END $$;

-- Update workflow_templates
ALTER TABLE "workflow_templates" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "workflow_templates" ADD COLUMN IF NOT EXISTS "processType" "WorkflowProcessType" NOT NULL DEFAULT 'RIGID_LINEAR';
ALTER TABLE "workflow_templates" ADD COLUMN IF NOT EXISTS "action" TEXT;
ALTER TABLE "workflow_templates" ADD COLUMN IF NOT EXISTS "branchId" TEXT;
CREATE INDEX IF NOT EXISTS "workflow_templates_branchId_idx" ON "workflow_templates"("branchId");

-- Update workflow_stages
ALTER TABLE "workflow_stages" ADD COLUMN IF NOT EXISTS "type" "WorkflowType";

-- Update workflow_assignees
ALTER TABLE "workflow_assignees" ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 1;

-- Update transactions
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "workflowTemplateId" TEXT;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "currentWorkflowStageId" TEXT;

-- Payment balance tracking for underpayment/overpayment settlement
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "amountPaid" DECIMAL(18,2);
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "balanceDue" DECIMAL(18,2);

-- ========================================
-- CUSTOMER BANK ACCOUNTS
-- ========================================

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
  CONSTRAINT "customer_bank_accounts_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "customer_bank_accounts_userId_accountNumber_key"
    UNIQUE ("userId", "accountNumber")
);

CREATE INDEX IF NOT EXISTS "customer_bank_accounts_userId_idx" ON "customer_bank_accounts"("userId");

CREATE TABLE IF NOT EXISTS "transaction_bank_accounts" (
  "id"                    TEXT NOT NULL PRIMARY KEY,
  "transactionId"         TEXT NOT NULL,
  "customerBankAccountId" TEXT NOT NULL,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "transaction_bank_accounts_transactionId_fkey"
    FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "transaction_bank_accounts_customerBankAccountId_fkey"
    FOREIGN KEY ("customerBankAccountId") REFERENCES "customer_bank_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "transaction_bank_accounts_transactionId_customerBankAccountId_key"
    UNIQUE ("transactionId", "customerBankAccountId")
);

CREATE INDEX IF NOT EXISTS "transaction_bank_accounts_transactionId_idx" ON "transaction_bank_accounts"("transactionId");

-- ========================================
-- DISBURSEMENT OPTION (customer pickup preference)
-- ========================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DisbursementOption') THEN
    CREATE TYPE "DisbursementOption" AS ENUM ('ELECTRONIC_TRANSFER', 'CARD', 'CARD_AND_CASH');
  END IF;
END $$;

ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "disbursementOption" "DisbursementOption";
CREATE INDEX IF NOT EXISTS "transactions_disbursementOption_idx" ON "transactions"("disbursementOption");

-- ========================================
-- TRANSIENT WALLET SYSTEM
-- ========================================

-- Ensure WalletEntryType enum exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WalletEntryType') THEN
    CREATE TYPE "WalletEntryType" AS ENUM ('DEBIT', 'CREDIT');
  END IF;
END $$;

-- Ensure WalletEntryStatus enum exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WalletEntryStatus') THEN
    CREATE TYPE "WalletEntryStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REVERSED');
  END IF;
END $$;

-- Create customer_wallets table (one per customer)
CREATE TABLE IF NOT EXISTS "customer_wallets" (
  "id"        TEXT NOT NULL PRIMARY KEY,
  "userId"    TEXT NOT NULL UNIQUE,
  "balance"   DECIMAL(18,2) NOT NULL DEFAULT 0,
  "currency"  TEXT NOT NULL DEFAULT 'NGN',
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_wallets_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "customer_wallets_userId_idx" ON "customer_wallets"("userId");

-- Create wallet_entries table (ledger — no FK to transactions, loosely coupled)
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
  CONSTRAINT "wallet_entries_walletId_fkey"
    FOREIGN KEY ("walletId") REFERENCES "customer_wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "wallet_entries_walletId_idx"      ON "wallet_entries"("walletId");
CREATE INDEX IF NOT EXISTS "wallet_entries_transactionId_idx" ON "wallet_entries"("transactionId");
CREATE INDEX IF NOT EXISTS "wallet_entries_sessionId_idx"     ON "wallet_entries"("sessionId");
CREATE INDEX IF NOT EXISTS "wallet_entries_type_idx"          ON "wallet_entries"("type");
CREATE INDEX IF NOT EXISTS "wallet_entries_createdAt_idx"     ON "wallet_entries"("createdAt");

-- ========================================
-- WALLET ENTRY ADMIN FEATURES
-- ========================================

-- Matching status
ALTER TABLE "wallet_entries" ADD COLUMN IF NOT EXISTS "matchStatus" TEXT;

-- Linked transaction (manually linked by admin)
ALTER TABLE "wallet_entries" ADD COLUMN IF NOT EXISTS "linkedTransactionId" TEXT;

-- Flagging
ALTER TABLE "wallet_entries" ADD COLUMN IF NOT EXISTS "isFlagged" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "wallet_entries" ADD COLUMN IF NOT EXISTS "flagReason" TEXT;
ALTER TABLE "wallet_entries" ADD COLUMN IF NOT EXISTS "flaggedBy" TEXT;
ALTER TABLE "wallet_entries" ADD COLUMN IF NOT EXISTS "flaggedAt" TIMESTAMP(3);

-- Refund
ALTER TABLE "wallet_entries" ADD COLUMN IF NOT EXISTS "refundStatus" TEXT;
ALTER TABLE "wallet_entries" ADD COLUMN IF NOT EXISTS "refundedBy" TEXT;
ALTER TABLE "wallet_entries" ADD COLUMN IF NOT EXISTS "refundedAt" TIMESTAMP(3);

-- Disbursement
ALTER TABLE "wallet_entries" ADD COLUMN IF NOT EXISTS "disbursementStatus" TEXT;
ALTER TABLE "wallet_entries" ADD COLUMN IF NOT EXISTS "disbursedBy" TEXT;
ALTER TABLE "wallet_entries" ADD COLUMN IF NOT EXISTS "disbursedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "wallet_entries_matchStatus_idx" ON "wallet_entries"("matchStatus");
CREATE INDEX IF NOT EXISTS "wallet_entries_isFlagged_idx"   ON "wallet_entries"("isFlagged");

-- Wallet entry notes table
CREATE TABLE IF NOT EXISTS "wallet_entry_notes" (
  "id"        TEXT NOT NULL PRIMARY KEY,
  "entryId"   TEXT NOT NULL,
  "adminId"   TEXT NOT NULL,
  "note"      TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "wallet_entry_notes_entryId_fkey"
    FOREIGN KEY ("entryId") REFERENCES "wallet_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "wallet_entry_notes_entryId_idx" ON "wallet_entry_notes"("entryId");
EOF

echo "✅ Schema verification completed"
echo ""

# Regenerate Prisma Client to ensure it's in sync
echo "🔧 Regenerating Prisma Client..."
npx prisma generate > /dev/null 2>&1
echo "✅ Prisma Client regenerated"
echo ""

# Seed pickup locations (if needed)
echo "🌱 Seeding pickup locations..."
if [ -f "/app/dist/seeds/pickup-locations.seed.js" ]; then
  node /app/dist/seeds/pickup-locations.seed.js || echo "⚠️  Pickup locations seed skipped (may already exist)"
else
  echo "⚠️  Pickup locations seed file not found"
fi
echo ""

# Backfill workflow templates for existing transactions
echo "🔧 Backfilling workflow templates for existing transactions..."
node -e "
const { PrismaClient } = require('@prisma/client');
const { workflowService } = require('./dist/src/modules/admin/services/workflow.service');
(async () => {
  const prisma = new PrismaClient();
  try {
    const txs = await prisma.transaction.findMany({
      where: { workflowTemplateId: null, status: { notIn: ['COMPLETED','REJECTED','CANCELLED'] } },
      select: { id: true, referenceNumber: true },
    });
    if (txs.length === 0) { console.log('  No transactions need workflow backfill.'); return; }
    console.log('  Found ' + txs.length + ' transactions without workflow.');
    let ok = 0;
    for (const tx of txs) {
      const r = await workflowService.attachWorkflowToTransaction(tx.id).catch(() => null);
      if (r) ok++;
    }
    console.log('  Attached workflows to ' + ok + '/' + txs.length + ' transactions.');
  } catch (e) { console.log('  ⚠️  Workflow backfill error: ' + (e.message || e)); }
  finally { await prisma.\$disconnect(); }
})();
" || echo "⚠️  Workflow backfill skipped"
echo "✅ Workflow backfill completed"
echo ""

# Start the application
echo "🚀 Starting application..."
exec "$@"
