-- Add branchCode column (nullable first so existing rows can be backfilled)
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "branchCode" TEXT;

-- Backfill existing branches with sequential codes ordered by creation date
DO $$
DECLARE
  rec RECORD;
  seq INTEGER := 1;
BEGIN
  FOR rec IN SELECT "id" FROM "branches" WHERE "branchCode" IS NULL ORDER BY "createdAt" ASC LOOP
    UPDATE "branches" SET "branchCode" = 'BR' || LPAD(seq::text, 2, '0') WHERE "id" = rec."id";
    seq := seq + 1;
  END LOOP;
END $$;

ALTER TABLE "branches" ALTER COLUMN "branchCode" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "branches_branchCode_key" ON "branches"("branchCode");
