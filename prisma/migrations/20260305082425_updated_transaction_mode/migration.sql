-- DropForeignKey
ALTER TABLE "departments" DROP CONSTRAINT "departments_createdById_fkey";

-- DropForeignKey
ALTER TABLE "roles" DROP CONSTRAINT "roles_createdById_fkey";

-- DropIndex
DROP INDEX "departments_createdById_idx";

-- DropIndex
DROP INDEX "roles_createdById_idx";
