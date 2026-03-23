import { PrismaClient } from "@prisma/client";
import { getDatabase } from "../../../config/database";
import { randomUUID } from "crypto";
import { ServiceUnavailableError, ValidationError } from "../../../shared/utils/errors";
import { nibssClient } from "../../../integrations";

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
      (prisma as any).escrowAccount.count(),
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
    const rows = await (prisma as any).escrowAccount.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        bankName: true,
        accountNumber: true,
        accountName: true,
        reference: true,
        status: true,
        createdAt: true,
      },
    });
    return rows.map((b: any) => ({
      id: b.id,
      name: b.accountName,
      bank: b.bankName,
      accountNumber: b.accountNumber,
      reference: b.reference,
      status: (b.status || "").toString().toUpperCase() === "ACTIVE" ? "Active" : "Inactive",
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

  async createEscrowAccount(payload: {
    currency: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
    createdBy?: string;
  }) {
    const currency = (payload.currency || "").toString().trim().toUpperCase();
    const bankName = (payload.bankName || "").toString().trim();
    const accountNumber = (payload.accountNumber || "").toString().trim();
    const accountName = (payload.accountName || "").toString().trim();

    if (!currency || currency.length !== 3) throw new ValidationError("currency is required");
    if (!bankName) throw new ValidationError("bankName is required");
    if (!accountNumber) throw new ValidationError("accountNumber is required");
    if (!accountName) throw new ValidationError("accountName is required");

    const existing = await (prisma as any).escrowAccount.findFirst({
      where: { accountNumber },
      select: { id: true },
    });
    if (existing) throw new ValidationError("Escrow account already exists");

    const reference = `ESCROW-${randomUUID()}`;
    const created = await (prisma as any).escrowAccount.create({
      data: {
        currency,
        bankName,
        accountNumber,
        accountName,
        reference,
        createdBy: payload.createdBy || null,
      },
      select: {
        id: true,
        bankName: true,
        accountNumber: true,
        accountName: true,
        reference: true,
        status: true,
        createdAt: true,
      },
    });

    return {
      id: created.id,
      name: created.accountName,
      bank: created.bankName,
      accountNumber: created.accountNumber,
      reference: created.reference,
      currency,
      status: (created.status || "").toString().toUpperCase() === "ACTIVE" ? "Active" : "Inactive",
      createdAt: created.createdAt,
    };
  }

  async getBankList() {
    try {
      const banks = await nibssClient.getBankList();
      const normalized = (banks || []).map((b: any) => ({
        bankCode: (b.bankCode || "").toString(),
        bankName: (b.bankName || "").toString(),
      }));
      normalized.sort((a: any, b: any) =>
        (a.bankName || "").localeCompare(b.bankName || "", undefined, { sensitivity: "base" })
      );
      return normalized;
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 401 || status === 403) {
        throw new ServiceUnavailableError("Bank list service is not configured", {
          upstreamStatus: status,
        });
      }
      throw new ServiceUnavailableError("Failed to fetch bank list", {
        upstreamStatus: status,
        message: error?.message,
      });
    }
  }

  async verifyBankAccount(payload: { accountNumber: string; bankCode: string }) {
    const accountNumber = (payload.accountNumber || "").toString().trim();
    const bankCode = (payload.bankCode || "").toString().trim();
    if (!accountNumber) throw new ValidationError("accountNumber is required");
    if (!bankCode) throw new ValidationError("bankCode is required");

    try {
      const result = await nibssClient.verifyAccount(accountNumber, bankCode);
      return {
        verified: !!result.verified,
        accountName: result.accountName || null,
        accountNumber: result.accountNumber || accountNumber,
        bankCode,
      };
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 400) {
        throw new ValidationError("Invalid bank details", {
          upstreamStatus: status,
        });
      }
      if (status === 401 || status === 403) {
        throw new ServiceUnavailableError("Bank verification service is not configured", {
          upstreamStatus: status,
        });
      }
      throw new ServiceUnavailableError("Unable to verify bank account", {
        upstreamStatus: status,
        message: error?.message,
      });
    }
  }
}

export const settlementService = new SettlementService();
