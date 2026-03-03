-- Ensure agents.password exists (idempotent)
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "password" TEXT;
