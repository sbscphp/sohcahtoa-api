-- Agent receipt confirmation step for cash disbursements:
-- balances now apply on agent confirmation, not admin approval.

DO $$ BEGIN
  ALTER TYPE "CashDisbursementStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "cash_disbursements" ADD COLUMN IF NOT EXISTS "receiptConfirmedAt" TIMESTAMP(3);
ALTER TABLE "cash_disbursements" ADD COLUMN IF NOT EXISTS "receiptRejectedAt" TIMESTAMP(3);
ALTER TABLE "cash_disbursements" ADD COLUMN IF NOT EXISTS "receiptRejectionReason" TEXT;
