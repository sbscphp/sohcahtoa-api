-- Add isDefault flag to departments table
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN NOT NULL DEFAULT false;

