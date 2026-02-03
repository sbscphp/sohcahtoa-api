/*
  Warnings:

  - You are about to drop the column `branches` on the `roles` table. All the data in the column will be lost.
  - You are about to drop the column `departments` on the `roles` table. All the data in the column will be lost.
  - Made the column `description` on table `roles` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
ALTER TYPE "TokenType" ADD VALUE 'REFRESH';

-- AlterTable
ALTER TABLE "roles" DROP COLUMN "branches",
DROP COLUMN "departments",
ADD COLUMN     "branch" TEXT,
ADD COLUMN     "department" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "description" SET NOT NULL;
