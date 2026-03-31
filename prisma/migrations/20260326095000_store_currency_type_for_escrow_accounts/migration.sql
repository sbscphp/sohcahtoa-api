-- Align escrow_accounts.currency with "currencyType" UI values (e.g. "NGN - Naira")
ALTER TABLE "escrow_accounts"
ALTER COLUMN "currency" SET DEFAULT 'NGN - Naira';

UPDATE "escrow_accounts"
SET "currency" = 'NGN - Naira'
WHERE "currency" IS NULL
   OR "currency" = ''
   OR "currency" = 'NGN';

