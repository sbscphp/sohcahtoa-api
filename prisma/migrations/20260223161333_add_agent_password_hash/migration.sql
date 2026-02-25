-- AlterTable
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "password" TEXT;

-- RenameIndex (with IF EXISTS checks)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'workflow_assignees_admin_idx') THEN
    ALTER INDEX "workflow_assignees_admin_idx" RENAME TO "workflow_assignees_adminId_idx";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'workflow_assignees_stage_admin_unique') THEN
    ALTER INDEX "workflow_assignees_stage_admin_unique" RENAME TO "workflow_assignees_stageId_adminId_key";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'workflow_assignees_stage_idx') THEN
    ALTER INDEX "workflow_assignees_stage_idx" RENAME TO "workflow_assignees_stageId_idx";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'workflow_stages_template_idx') THEN
    ALTER INDEX "workflow_stages_template_idx" RENAME TO "workflow_stages_templateId_idx";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'workflow_templates_department_idx') THEN
    ALTER INDEX "workflow_templates_department_idx" RENAME TO "workflow_templates_departmentId_idx";
  END IF;
END $$;
