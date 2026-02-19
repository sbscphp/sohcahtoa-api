/*
  Warnings:

  - The values [AGENT] on the enum `CustomerType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "CustomerType_new" AS ENUM ('NIGERIAN_CITIZEN', 'TOURIST', 'EXPATRIATE');
ALTER TABLE "users" ALTER COLUMN "customerType" TYPE "CustomerType_new" USING ("customerType"::text::"CustomerType_new");
ALTER TYPE "CustomerType" RENAME TO "CustomerType_old";
ALTER TYPE "CustomerType_new" RENAME TO "CustomerType";
DROP TYPE "CustomerType_old";
COMMIT;

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'AGENT';
