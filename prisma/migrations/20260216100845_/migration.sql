/*
  Warnings:

  - A unique constraint covering the columns `[franchiseId,name]` on the table `branches` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActionType" ADD VALUE 'AGENT_CREATE';
ALTER TYPE "ActionType" ADD VALUE 'AGENT_UPDATE_STATUS';
ALTER TYPE "ActionType" ADD VALUE 'AGENT_APPROVE';
ALTER TYPE "ActionType" ADD VALUE 'AGENT_DEACTIVATE';
ALTER TYPE "ActionType" ADD VALUE 'RATE_CREATE';
ALTER TYPE "ActionType" ADD VALUE 'RATE_UPDATE';
ALTER TYPE "ActionType" ADD VALUE 'RATE_DEACTIVATE';
ALTER TYPE "ActionType" ADD VALUE 'REPORT_GENERATE';

-- AlterEnum
ALTER TYPE "CustomerType" ADD VALUE 'EXPATRIATE';

-- DropForeignKey
ALTER TABLE "admin_users" DROP CONSTRAINT "admin_users_departmentId_fkey";

-- DropIndex
DROP INDEX "branches_name_idx";

-- AlterTable
ALTER TABLE "admin_users" ALTER COLUMN "departmentId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "agents" ADD COLUMN     "branchId" TEXT;

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "label" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateIndex
CREATE INDEX "permissions_module_featureKey_action_idx" ON "permissions"("module", "featureKey", "action");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_module_featureKey_action_key" ON "permissions"("module", "featureKey", "action");

-- CreateIndex
CREATE INDEX "role_permissions_permissionId_idx" ON "role_permissions"("permissionId");

-- CreateIndex
CREATE INDEX "agents_branchId_idx" ON "agents"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "branches_franchiseId_name_key" ON "branches"("franchiseId", "name");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
