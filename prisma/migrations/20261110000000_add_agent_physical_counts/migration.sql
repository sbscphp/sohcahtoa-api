CREATE TABLE IF NOT EXISTS "agent_physical_counts" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "countedAmount" DECIMAL(18,2) NOT NULL,
    "countDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "countedBy" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_physical_counts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "agent_physical_counts_agentId_currency_countDate_idx" ON "agent_physical_counts"("agentId", "currency", "countDate");

DO $$ BEGIN
  ALTER TABLE "agent_physical_counts" ADD CONSTRAINT "agent_physical_counts_agentId_fkey"
    FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
