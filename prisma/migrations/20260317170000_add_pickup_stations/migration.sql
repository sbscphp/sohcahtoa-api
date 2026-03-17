-- CreateTable
CREATE TABLE "pickup_stations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pickup_stations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pickup_stations_name_idx" ON "pickup_stations"("name");

-- CreateIndex
CREATE INDEX "pickup_stations_state_idx" ON "pickup_stations"("state");

-- CreateIndex
CREATE INDEX "pickup_stations_region_idx" ON "pickup_stations"("region");

-- CreateIndex
CREATE INDEX "pickup_stations_status_idx" ON "pickup_stations"("status");
