-- AlterTable
ALTER TABLE "cash_pickup" ADD COLUMN     "pickupLocationId" TEXT,
ADD COLUMN     "pickupState" TEXT,
ADD COLUMN     "pickupCity" TEXT,
ADD COLUMN     "scheduledPickupDate" TIMESTAMP(3),
ADD COLUMN     "scheduledPickupTime" TEXT;

-- CreateIndex
CREATE INDEX "cash_pickup_pickupState_idx" ON "cash_pickup"("pickupState");

-- CreateIndex
CREATE INDEX "cash_pickup_pickupCity_idx" ON "cash_pickup"("pickupCity");
