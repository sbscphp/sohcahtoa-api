/**
 * One-time migration script to attach workflow templates to existing transactions
 * that don't have one attached yet.
 *
 * Usage: npx tsx scripts/backfill-workflows.ts
 */
import { PrismaClient } from "@prisma/client";
import { workflowService } from "../src/modules/admin/services/workflow.service";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const prisma = new PrismaClient();

  try {
    // Find all transactions without a workflow template that are not in terminal states
    const transactions = await prisma.transaction.findMany({
      where: {
        workflowTemplateId: null,
        status: {
          notIn: ["COMPLETED", "REJECTED", "CANCELLED"],
        },
      },
      select: {
        id: true,
        referenceNumber: true,
        status: true,
        createdByAgentId: true,
      },
      orderBy: { createdAt: "asc" },
    });

    console.log(`Found ${transactions.length} transactions without a workflow template.`);

    let attached = 0;
    let skipped = 0;
    let failed = 0;

    for (const tx of transactions) {
      try {
        const result = await workflowService.attachWorkflowToTransaction(tx.id);
        if (result) {
          attached++;
          console.log(`  ✔ Attached workflow to ${tx.referenceNumber} (${tx.id}) [status: ${tx.status}, agent: ${tx.createdByAgentId || "customer"}]`);
        } else {
          skipped++;
          console.log(`  — Skipped ${tx.referenceNumber} (${tx.id}): no matching workflow template found`);
        }
      } catch (err) {
        failed++;
        console.error(`  ✘ Failed for ${tx.referenceNumber} (${tx.id}):`, err instanceof Error ? err.message : err);
      }
    }

    console.log(`\nDone. Attached: ${attached}, Skipped: ${skipped}, Failed: ${failed}`);
  } finally {
    await prisma.$disconnect();
  }
}

main();
