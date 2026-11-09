/**
 * One-time backfill: create zero-balance FX inventory rows for existing
 * branches (fx_inventory_balances) and existing agents (agent_cash_balances).
 *
 * Rows are otherwise created lazily on first disbursement/lodgment, so branches
 * and agents with no activity yet show up empty in
 * GET /api/admin/fx-inventory/balances.
 *
 * Idempotent: existing rows (and their balances) are never touched.
 *
 * Usage:
 *   npx tsx scripts/backfill-fx-inventory.ts --dry-run
 *   npx tsx scripts/backfill-fx-inventory.ts --currencies=USD,EUR,GBP
 *
 * If --currencies is omitted, currencies are derived from active ExchangeRate
 * rows (every currency except NGN).
 */
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

dotenv.config();

const BASE_CURRENCY = "NGN";

async function resolveCurrencies(prisma: PrismaClient): Promise<string[]> {
  const arg = process.argv.find((a) => a.startsWith("--currencies="));
  if (arg) {
    return arg
      .split("=")[1]
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);
  }

  const rates = await prisma.exchangeRate.findMany({
    where: { isActive: true },
    select: { fromCurrency: true, toCurrency: true },
  });
  const set = new Set<string>();
  for (const r of rates) {
    set.add(r.fromCurrency.toUpperCase());
    set.add(r.toCurrency.toUpperCase());
  }
  set.delete(BASE_CURRENCY);
  return [...set].sort();
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const prisma = new PrismaClient();

  try {
    const currencies = await resolveCurrencies(prisma);
    if (currencies.length === 0) {
      console.error("No currencies resolved. Pass --currencies=USD,EUR,GBP");
      process.exit(1);
    }

    const branches = await prisma.branch.findMany({ select: { id: true, name: true } });
    const agents = await prisma.agent.findMany({ select: { id: true } });

    console.log(
      `${dryRun ? "[DRY RUN] " : ""}Currencies: ${currencies.join(", ")} | branches: ${branches.length} | agents: ${agents.length}`
    );

    const inventoryRows = branches.flatMap((b) =>
      currencies.map((currency) => ({ branchId: b.id, currency, balance: 0 }))
    );
    const agentRows = agents.flatMap((a) =>
      currencies.map((currency) => ({ agentId: a.id, currency, balance: 0 }))
    );

    if (dryRun) {
      console.log(`Would ensure ${inventoryRows.length} inventory rows and ${agentRows.length} agent cash rows.`);
      return;
    }

    const inv = await prisma.fxInventoryBalance.createMany({ data: inventoryRows, skipDuplicates: true });
    const cash = await prisma.agentCashBalance.createMany({ data: agentRows, skipDuplicates: true });

    console.log(`Created ${inv.count} inventory rows and ${cash.count} agent cash rows (existing rows untouched).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
