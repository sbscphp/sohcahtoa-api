-- Add createdBy and createdById to roles and departments, with FKs
-- Safe to run multiple times

-- Roles
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "createdBy" TEXT;
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "roles"
  ADD CONSTRAINT IF NOT EXISTS "roles_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "roles_createdById_idx" ON "roles" ("createdById");

-- Departments
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "createdBy" TEXT;
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "departments"
  ADD CONSTRAINT IF NOT EXISTS "departments_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "departments_createdById_idx" ON "departments" ("createdById");
