-- AlterTable (add column if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='transactions' AND column_name='transaction_mode') THEN
        ALTER TABLE "transactions" ADD COLUMN "transaction_mode" TEXT;
    END IF;
END $$;

-- CreateIndex (create index if not exists)
CREATE INDEX IF NOT EXISTS "transactions_transaction_mode_idx" ON "transactions"("transaction_mode");
