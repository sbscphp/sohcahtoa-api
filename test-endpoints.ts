import { PrismaClient } from '@prisma/client';
import { SettlementService } from './src/modules/admin/services/settlement.service';

const prisma = new PrismaClient();
const service = new SettlementService();

async function main() {
  console.log("=== FUNDING TRANSACTIONS ===");
  const funding = await service.fundingTransactions(1, 10);
  console.log(JSON.stringify(funding, null, 2));

  console.log("\n=== PENDING RECONCILIATIONS ===");
  const pending = await service.pendingReconciliations(1, 10);
  console.log(JSON.stringify(pending, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
