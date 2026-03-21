-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "createdByAgentId" TEXT;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_createdByAgentId_fkey" FOREIGN KEY ("createdByAgentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
