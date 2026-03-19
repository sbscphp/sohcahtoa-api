import { PrismaClient } from "@prisma/client";
import { getDatabase } from "../../../config/database";

const prisma: PrismaClient = getDatabase();

export class SettlementService {
  private minutesSince(d: Date | null | undefined) {
    const t = d ? d.getTime() : Date.now();
    return Math.max(0, Math.floor((Date.now() - t) / 60000));
  }

  async stats() {
    const [sumConfirmed, pendingRecon, escrowCount] = await Promise.all([
      (prisma as any).settlement.aggregate({
        where: { status: "CONFIRMED" },
        _sum: { amount: true },
      }),
      (prisma as any).settlement.count({
        where: { OR: [{ status: "PENDING" }, { status: "AWAITING_CONFIRMATION" }] },
      }),
      (prisma as any).bankDetail.count(),
    ]);
    const currentBalance = Number(sumConfirmed._sum?.amount || 0);
    return {
      currentBalance,
      pendingReconciliation: pendingRecon,
      totalEscrowAccounts: escrowCount,
    };
  }

  async discrepancies(page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const where: any = {
      OR: [
        { status: "FAILED" },
        { status: "REFUNDED" },
        { notes: { not: null } },
      ],
    };
    const [total, rows] = await Promise.all([
      (prisma as any).settlement.count({ where }),
      (prisma as any).settlement.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          transactionId: true,
          amount: true,
          status: true,
          notes: true,
          createdAt: true,
        },
      }),
    ]);
    const data = rows.map((r: any) => {
      const amt = Number(r.amount || 0);
      const priority = amt >= 500000 ? "High" : amt >= 100000 ? "Medium" : "Low";
      return {
        id: r.id,
        title: r.notes || "Settlement discrepancy",
        outlet: null,
        flaggedDate: r.createdAt,
        priority,
        reference: r.transactionId,
        status: r.status,
      };
    });
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async pendingReconciliations(page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const where: any = { OR: [{ status: "PENDING" }, { status: "AWAITING_CONFIRMATION" }] };
    const [total, rows] = await Promise.all([
      (prisma as any).settlement.count({ where }),
      (prisma as any).settlement.findMany({
        where,
        orderBy: { createdAt: "asc" },
        skip,
        take: limit,
        select: {
          id: true,
          transactionId: true,
          paymentReference: true,
          depositedAt: true,
          createdAt: true,
          status: true,
          amount: true,
        },
      }),
    ]);
    const data = rows.map((r: any) => {
      const mins = this.minutesSince(r.depositedAt || r.createdAt);
      const priority = mins >= 120 ? "High" : mins >= 60 ? "Medium" : "Low";
      return {
        id: r.id,
        referenceId: r.paymentReference || r.transactionId,
        fundDate: r.depositedAt || r.createdAt,
        overdueMinutes: mins,
        priority,
        status: r.status,
        amount: Number(r.amount || 0),
      };
    });
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async escrowAccounts() {
    const rows = await (prisma as any).bankDetail.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        bankName: true,
        accountNumber: true,
        accountName: true,
        reference: true,
        createdAt: true,
      },
    });
    return rows.map((b: any) => ({
      id: b.id,
      name: b.accountName,
      bank: b.bankName,
      accountNumber: b.accountNumber,
      reference: b.reference,
      status: "Active",
      createdAt: b.createdAt,
    }));
  }

  async fundingTransactions(page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [total, receipts] = await Promise.all([
      (prisma as any).paymentReceipt.count(),
      (prisma as any).paymentReceipt.findMany({
        orderBy: { generatedAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          transactionId: true,
          receiptNumber: true,
          amount: true,
          currency: true,
          generatedAt: true,
          settlementId: true,
        },
      }),
    ]);
    // Fetch settlement status per receipt (small lists only)
    const statusMap: Record<string, string> = {};
    await Promise.all(
      receipts.map(async (r: any) => {
        if (r.settlementId && !statusMap[r.settlementId]) {
          try {
            const s = await (prisma as any).settlement.findUnique({
              where: { id: r.settlementId },
              select: { status: true },
            });
            statusMap[r.settlementId] = s?.status || "PENDING";
          } catch {
            statusMap[r.settlementId] = "PENDING";
          }
        }
      })
    );
    const data = receipts.map((r: any) => ({
      referenceId: r.receiptNumber,
      amount: Number(r.amount || 0),
      currency: r.currency,
      fundDate: r.generatedAt,
      status: r.settlementId ? statusMap[r.settlementId] : "PENDING",
    }));
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
}

export const settlementService = new SettlementService();
