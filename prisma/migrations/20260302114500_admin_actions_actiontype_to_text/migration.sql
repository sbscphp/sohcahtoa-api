-- Convert admin_actions.actionType from enum "ActionType" to TEXT (nullable)
-- Safe approach: add new column, copy data, swap columns, recreate index

-- 1) Add new TEXT column
ALTER TABLE "admin_actions" ADD COLUMN "actionType_text" TEXT;

-- 2) Copy existing values (enum -> text)
UPDATE "admin_actions"
SET "actionType_text" = "actionType"::text
WHERE "actionType" IS NOT NULL;

-- 3) Drop old index if it exists (was on enum column)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND indexname = 'admin_actions_actionType_idx'
  ) THEN
    DROP INDEX "admin_actions_actionType_idx";
  END IF;
END $$;

-- 4) Drop old enum column and rename new
ALTER TABLE "admin_actions" DROP COLUMN "actionType";
ALTER TABLE "admin_actions" RENAME COLUMN "actionType_text" TO "actionType";

-- 5) Recreate index on the TEXT column
CREATE INDEX "admin_actions_actionType_idx" ON "admin_actions"("actionType");
