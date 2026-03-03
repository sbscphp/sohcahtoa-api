-- DropForeignKey
ALTER TABLE "departments" DROP CONSTRAINT "departments_createdById_fkey";

-- DropForeignKey
ALTER TABLE "roles" DROP CONSTRAINT "roles_createdById_fkey";

-- DropIndex
DROP INDEX "departments_createdById_idx";

-- DropIndex
DROP INDEX "roles_createdById_idx";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "createdByAgentId" TEXT;

-- CreateIndex
CREATE INDEX "users_createdByAgentId_idx" ON "users"("createdByAgentId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_createdByAgentId_fkey" FOREIGN KEY ("createdByAgentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
