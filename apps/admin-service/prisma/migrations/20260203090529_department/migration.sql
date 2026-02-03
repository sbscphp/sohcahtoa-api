/*
  Warnings:

  - You are about to drop the column `department` on the `admin_users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "admin_actions" ADD COLUMN     "departmentId" TEXT;

-- AlterTable
ALTER TABLE "admin_users" DROP COLUMN "department",
ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "departmentName" TEXT;

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "departmentEmail" TEXT,
    "description" TEXT,
    "branch" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- AddForeignKey
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
