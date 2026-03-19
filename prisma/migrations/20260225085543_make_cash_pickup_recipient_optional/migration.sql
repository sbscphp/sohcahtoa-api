-- AlterTable
-- Make recipientName and recipientPhone optional (idempotent)
DO $$
BEGIN
  -- Drop NOT NULL constraint on recipientName if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_pickup'
    AND column_name = 'recipientName'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE "cash_pickup" ALTER COLUMN "recipientName" DROP NOT NULL;
  END IF;

  -- Drop NOT NULL constraint on recipientPhone if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_pickup'
    AND column_name = 'recipientPhone'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE "cash_pickup" ALTER COLUMN "recipientPhone" DROP NOT NULL;
  END IF;
END $$;
