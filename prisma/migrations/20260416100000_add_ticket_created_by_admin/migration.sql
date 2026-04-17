-- AlterTable
ALTER TABLE "tickets" ADD COLUMN "createdByAdminId" TEXT;

-- CreateIndex
CREATE INDEX "tickets_createdByAdminId_idx" ON "tickets"("createdByAdminId");

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
