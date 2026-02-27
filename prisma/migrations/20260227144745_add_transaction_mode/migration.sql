-- CreateEnum
CREATE TYPE "TransactionMode" AS ENUM ('BUY', 'SELL');

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN "mode" "TransactionMode";

-- CreateIndex
CREATE INDEX "transactions_mode_idx" ON "transactions"("mode");
