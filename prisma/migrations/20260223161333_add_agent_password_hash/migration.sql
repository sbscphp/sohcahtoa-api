-- AlterTable
ALTER TABLE "agents" ADD COLUMN     "password" TEXT;

-- RenameIndex
ALTER INDEX "workflow_assignees_admin_idx" RENAME TO "workflow_assignees_adminId_idx";

-- RenameIndex
ALTER INDEX "workflow_assignees_stage_admin_unique" RENAME TO "workflow_assignees_stageId_adminId_key";

-- RenameIndex
ALTER INDEX "workflow_assignees_stage_idx" RENAME TO "workflow_assignees_stageId_idx";

-- RenameIndex
ALTER INDEX "workflow_stages_template_idx" RENAME TO "workflow_stages_templateId_idx";

-- RenameIndex
ALTER INDEX "workflow_templates_department_idx" RENAME TO "workflow_templates_departmentId_idx";
