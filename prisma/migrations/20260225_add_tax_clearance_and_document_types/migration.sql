-- AlterEnum
-- Add new document types
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

-- AlterTable
-- Add taxClearanceNumber field to transactions table
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "taxClearanceNumber" TEXT;
