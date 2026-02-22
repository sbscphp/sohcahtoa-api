-- CreateEnum
CREATE TYPE "WorkflowType" AS ENUM ('REVIEW', 'APPROVAL');

-- CreateEnum
CREATE TYPE "WorkflowTemplateStatus" AS ENUM ('ACTIVE', 'DRAFT', 'ARCHIVED');

-- CreateTable
CREATE TABLE "workflow_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "WorkflowType" NOT NULL,
    "departmentId" TEXT,
    "escalationMinutes" INTEGER NOT NULL DEFAULT 0,
    "hasPtaRequest" BOOLEAN NOT NULL DEFAULT false,
    "status" "WorkflowTemplateStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "workflow_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_stages" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "escalationMinutes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workflow_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_assignees" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workflow_assignees_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "workflow_templates"
  ADD CONSTRAINT "workflow_templates_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "workflow_templates"
  ADD CONSTRAINT "workflow_templates_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "workflow_stages"
  ADD CONSTRAINT "workflow_stages_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "workflow_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workflow_assignees"
  ADD CONSTRAINT "workflow_assignees_stageId_fkey"
  FOREIGN KEY ("stageId") REFERENCES "workflow_stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workflow_assignees"
  ADD CONSTRAINT "workflow_assignees_adminId_fkey"
  FOREIGN KEY ("adminId") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "workflow_templates_status_idx" ON "workflow_templates" ("status");
CREATE INDEX "workflow_templates_department_idx" ON "workflow_templates" ("departmentId");
CREATE INDEX "workflow_stages_template_idx" ON "workflow_stages" ("templateId");
CREATE INDEX "workflow_stages_order_idx" ON "workflow_stages" ("order");
CREATE INDEX "workflow_assignees_stage_idx" ON "workflow_assignees" ("stageId");
CREATE INDEX "workflow_assignees_admin_idx" ON "workflow_assignees" ("adminId");

-- Unique Constraints
CREATE UNIQUE INDEX "workflow_assignees_stage_admin_unique" ON "workflow_assignees" ("stageId", "adminId");
