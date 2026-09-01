-- AlterTable
ALTER TABLE "tickets" ADD COLUMN "transactionId" TEXT;

-- CreateIndex
CREATE INDEX "tickets_transactionId_idx" ON "tickets"("transactionId");

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
