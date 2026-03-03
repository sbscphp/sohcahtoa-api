-- CreateEnum
CREATE TYPE "TransactionMode" AS ENUM ('BUY', 'SELL');

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN "transaction_mode" "TransactionMode";

-- CreateIndex
CREATE INDEX "transactions_transaction_mode_idx" ON "transactions"("transaction_mode");
