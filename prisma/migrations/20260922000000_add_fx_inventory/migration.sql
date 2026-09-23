-- FX Inventory: cash disbursement (Admin -> Agent) and cash lodgment (Agent -> Admin)

-- Ensure FX_CASH_DISBURSEMENT exists in ApprovalType enum
DO $$ BEGIN
  ALTER TYPE "ApprovalType" ADD VALUE IF NOT EXISTS 'FX_CASH_DISBURSEMENT';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "FxInventoryEntryType" AS ENUM ('DEBIT', 'CREDIT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AgentCashEntryType" AS ENUM ('DEBIT', 'CREDIT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CashDisbursementStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CashLodgmentStatus" AS ENUM ('PENDING_VERIFICATION', 'CONFIRMED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "fx_inventory_balances" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fx_inventory_balances_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "fx_inventory_entries" (
    "id" TEXT NOT NULL,
    "balanceId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "type" "FxInventoryEntryType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "balanceBefore" DECIMAL(18,2) NOT NULL,
    "balanceAfter" DECIMAL(18,2) NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fx_inventory_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "agent_cash_balances" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_cash_balances_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "agent_cash_entries" (
    "id" TEXT NOT NULL,
    "agentBalanceId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "type" "AgentCashEntryType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "balanceBefore" DECIMAL(18,2) NOT NULL,
    "balanceAfter" DECIMAL(18,2) NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_cash_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "cash_disbursements" (
    "id" TEXT NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "purpose" TEXT,
    "status" "CashDisbursementStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "initiatedBy" TEXT NOT NULL,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workflowTemplateId" TEXT,
    "currentStageId" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "decisionReason" TEXT,
    "autoApproved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_disbursements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "cash_disbursement_history" (
    "id" TEXT NOT NULL,
    "disbursementId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "performedBy" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_disbursement_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "cash_lodgments" (
    "id" TEXT NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "statedAmount" DECIMAL(18,2) NOT NULL,
    "confirmedAmount" DECIMAL(18,2),
    "varianceAmount" DECIMAL(18,2),
    "notes" TEXT,
    "status" "CashLodgmentStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedBy" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "rejectedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "decisionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_lodgments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "fx_inventory_balances_branchId_currency_key" ON "fx_inventory_balances"("branchId", "currency");
CREATE INDEX IF NOT EXISTS "fx_inventory_entries_balanceId_idx" ON "fx_inventory_entries"("balanceId");
CREATE INDEX IF NOT EXISTS "fx_inventory_entries_sourceType_sourceId_idx" ON "fx_inventory_entries"("sourceType", "sourceId");
CREATE UNIQUE INDEX IF NOT EXISTS "agent_cash_balances_agentId_currency_key" ON "agent_cash_balances"("agentId", "currency");
CREATE INDEX IF NOT EXISTS "agent_cash_entries_agentBalanceId_idx" ON "agent_cash_entries"("agentBalanceId");
CREATE INDEX IF NOT EXISTS "agent_cash_entries_sourceType_sourceId_idx" ON "agent_cash_entries"("sourceType", "sourceId");
CREATE UNIQUE INDEX IF NOT EXISTS "cash_disbursements_referenceNumber_key" ON "cash_disbursements"("referenceNumber");
CREATE INDEX IF NOT EXISTS "cash_disbursements_agentId_idx" ON "cash_disbursements"("agentId");
CREATE INDEX IF NOT EXISTS "cash_disbursements_branchId_currency_idx" ON "cash_disbursements"("branchId", "currency");
CREATE INDEX IF NOT EXISTS "cash_disbursements_status_idx" ON "cash_disbursements"("status");
CREATE INDEX IF NOT EXISTS "cash_disbursement_history_disbursementId_idx" ON "cash_disbursement_history"("disbursementId");
CREATE UNIQUE INDEX IF NOT EXISTS "cash_lodgments_referenceNumber_key" ON "cash_lodgments"("referenceNumber");
CREATE INDEX IF NOT EXISTS "cash_lodgments_agentId_idx" ON "cash_lodgments"("agentId");
CREATE INDEX IF NOT EXISTS "cash_lodgments_branchId_currency_idx" ON "cash_lodgments"("branchId", "currency");
CREATE INDEX IF NOT EXISTS "cash_lodgments_status_idx" ON "cash_lodgments"("status");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "fx_inventory_balances" ADD CONSTRAINT "fx_inventory_balances_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "fx_inventory_entries" ADD CONSTRAINT "fx_inventory_entries_balanceId_fkey" FOREIGN KEY ("balanceId") REFERENCES "fx_inventory_balances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "agent_cash_balances" ADD CONSTRAINT "agent_cash_balances_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "agent_cash_entries" ADD CONSTRAINT "agent_cash_entries_agentBalanceId_fkey" FOREIGN KEY ("agentBalanceId") REFERENCES "agent_cash_balances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "cash_disbursements" ADD CONSTRAINT "cash_disbursements_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "cash_disbursement_history" ADD CONSTRAINT "cash_disbursement_history_disbursementId_fkey" FOREIGN KEY ("disbursementId") REFERENCES "cash_disbursements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "cash_lodgments" ADD CONSTRAINT "cash_lodgments_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
