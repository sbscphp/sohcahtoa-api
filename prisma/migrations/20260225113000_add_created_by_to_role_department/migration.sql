-- Add createdBy and createdById to roles and departments, with FKs
-- Safe to run multiple times

-- Roles
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "createdBy" TEXT;
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "createdById" TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'roles_createdById_fkey') THEN
    ALTER TABLE "roles"
      ADD CONSTRAINT "roles_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "roles_createdById_idx" ON "roles" ("createdById");

-- Departments
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "createdBy" TEXT;
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "createdById" TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'departments_createdById_fkey') THEN
    ALTER TABLE "departments"
      ADD CONSTRAINT "departments_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "departments_createdById_idx" ON "departments" ("createdById");
