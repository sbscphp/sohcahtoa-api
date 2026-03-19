/*
  Warnings:

  - The `actionType` column on the `admin_actions` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "SettlementDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUBMITTED', 'COMPLETED', 'FAILED', 'CANCELLED', 'REQUIRES_APPROVAL');

-- CreateEnum
CREATE TYPE "VirtualAccountType" AS ENUM ('DYNAMIC', 'RESERVED');

-- CreateEnum
CREATE TYPE "VirtualAccountStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLACKLISTED');

-- CreateEnum
CREATE TYPE "ProvidusTransactionStatus" AS ENUM ('PENDING', 'VERIFIED', 'SETTLED', 'FAILED');

-- AlterTable
ALTER TABLE "admin_actions" DROP COLUMN "actionType",
ADD COLUMN     "actionType" TEXT;

-- CreateTable
CREATE TABLE "virtual_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "transactionId" TEXT,
    "accountNumber" TEXT NOT NULL,
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "virtual_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "providus_deposits" (
    "id" TEXT NOT NULL,
    "virtualAccountId" TEXT NOT NULL,
    "transactionId" TEXT,
    "sessionId" TEXT NOT NULL,
    "settlementId" TEXT,
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "providus_deposits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlement_batches" (
    "id" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settlement_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbound_settlements" (
    "id" TEXT NOT NULL,
    "batchId" TEXT,
    "transactionId" TEXT,
    "referenceNumber" TEXT NOT NULL,
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbound_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlement_reconciliations" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settlement_reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "virtual_accounts_transactionId_key" ON "virtual_accounts"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "virtual_accounts_accountNumber_key" ON "virtual_accounts"("accountNumber");

-- CreateIndex
CREATE INDEX "virtual_accounts_userId_idx" ON "virtual_accounts"("userId");

-- CreateIndex
CREATE INDEX "virtual_accounts_transactionId_idx" ON "virtual_accounts"("transactionId");

-- CreateIndex
CREATE INDEX "virtual_accounts_accountNumber_idx" ON "virtual_accounts"("accountNumber");

-- CreateIndex
CREATE INDEX "virtual_accounts_status_idx" ON "virtual_accounts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "providus_deposits_sessionId_key" ON "providus_deposits"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "providus_deposits_settlementId_key" ON "providus_deposits"("settlementId");

-- CreateIndex
CREATE INDEX "providus_deposits_virtualAccountId_idx" ON "providus_deposits"("virtualAccountId");

-- CreateIndex
CREATE INDEX "providus_deposits_transactionId_idx" ON "providus_deposits"("transactionId");

-- CreateIndex
CREATE INDEX "providus_deposits_sessionId_idx" ON "providus_deposits"("sessionId");

-- CreateIndex
CREATE INDEX "providus_deposits_settlementId_idx" ON "providus_deposits"("settlementId");

-- CreateIndex
CREATE INDEX "providus_deposits_status_idx" ON "providus_deposits"("status");

-- CreateIndex
CREATE INDEX "providus_deposits_accountNumber_idx" ON "providus_deposits"("accountNumber");

-- CreateIndex
CREATE UNIQUE INDEX "settlement_batches_batchNumber_key" ON "settlement_batches"("batchNumber");

-- CreateIndex
CREATE INDEX "settlement_batches_batchNumber_idx" ON "settlement_batches"("batchNumber");

-- CreateIndex
CREATE INDEX "settlement_batches_status_idx" ON "settlement_batches"("status");

-- CreateIndex
CREATE INDEX "settlement_batches_createdBy_idx" ON "settlement_batches"("createdBy");

-- CreateIndex
CREATE INDEX "settlement_batches_direction_idx" ON "settlement_batches"("direction");

-- CreateIndex
CREATE UNIQUE INDEX "outbound_settlements_referenceNumber_key" ON "outbound_settlements"("referenceNumber");

-- CreateIndex
CREATE INDEX "outbound_settlements_batchId_idx" ON "outbound_settlements"("batchId");

-- CreateIndex
CREATE INDEX "outbound_settlements_transactionId_idx" ON "outbound_settlements"("transactionId");

-- CreateIndex
CREATE INDEX "outbound_settlements_referenceNumber_idx" ON "outbound_settlements"("referenceNumber");

-- CreateIndex
CREATE INDEX "outbound_settlements_status_idx" ON "outbound_settlements"("status");

-- CreateIndex
CREATE INDEX "outbound_settlements_initiatedBy_idx" ON "outbound_settlements"("initiatedBy");

-- CreateIndex
CREATE INDEX "settlement_reconciliations_settlementId_idx" ON "settlement_reconciliations"("settlementId");

-- CreateIndex
CREATE INDEX "settlement_reconciliations_status_idx" ON "settlement_reconciliations"("status");

-- CreateIndex
CREATE INDEX "admin_actions_actionType_idx" ON "admin_actions"("actionType");

-- AddForeignKey
ALTER TABLE "providus_deposits" ADD CONSTRAINT "providus_deposits_virtualAccountId_fkey" FOREIGN KEY ("virtualAccountId") REFERENCES "virtual_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_settlements" ADD CONSTRAINT "outbound_settlements_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "settlement_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
