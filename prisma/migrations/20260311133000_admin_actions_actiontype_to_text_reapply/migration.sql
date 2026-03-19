DO $$
DECLARE
  col_data_type TEXT;
  col_udt_name TEXT;
BEGIN
  SELECT data_type, udt_name
  INTO col_data_type, col_udt_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'admin_actions'
    AND column_name = 'actionType';

  IF col_data_type = 'USER-DEFINED' AND col_udt_name = 'ActionType' THEN
    IF EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'admin_actions_actionType_idx'
    ) THEN
      EXECUTE 'DROP INDEX "admin_actions_actionType_idx"';
    END IF;

    ALTER TABLE "admin_actions" ADD COLUMN IF NOT EXISTS "actionType_text" TEXT;
    UPDATE "admin_actions"
      SET "actionType_text" = "actionType"::text
      WHERE "actionType" IS NOT NULL;

    ALTER TABLE "admin_actions" DROP COLUMN "actionType";
    ALTER TABLE "admin_actions" RENAME COLUMN "actionType_text" TO "actionType";
    CREATE INDEX IF NOT EXISTS "admin_actions_actionType_idx" ON "admin_actions"("actionType");
  END IF;
END $$;

