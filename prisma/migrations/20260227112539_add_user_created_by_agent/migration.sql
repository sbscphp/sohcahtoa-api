-- DropForeignKey (if exists)
ALTER TABLE "departments" DROP CONSTRAINT IF EXISTS "departments_createdById_fkey";

-- DropForeignKey (if exists)
ALTER TABLE "roles" DROP CONSTRAINT IF EXISTS "roles_createdById_fkey";

-- DropIndex (if exists)
DROP INDEX IF EXISTS "departments_createdById_idx";

-- DropIndex (if exists)
DROP INDEX IF EXISTS "roles_createdById_idx";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "createdByAgentId" TEXT;

-- CreateIndex
CREATE INDEX "users_createdByAgentId_idx" ON "users"("createdByAgentId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_createdByAgentId_fkey" FOREIGN KEY ("createdByAgentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
