/*
  Warnings:

  - Added the required column `actionType` to the `admin_actions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "admin_actions" DROP COLUMN "actionType",
ADD COLUMN     "actionType" "ActionType" NOT NULL;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "createdByAgentId" TEXT;

-- CreateIndex
CREATE INDEX "admin_actions_actionType_idx" ON "admin_actions"("actionType");

-- CreateIndex
CREATE INDEX "transactions_createdByAgentId_idx" ON "transactions"("createdByAgentId");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_createdByAgentId_fkey" FOREIGN KEY ("createdByAgentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
