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
    try {
      const [sumRows, pendingRows, escrowRows] = await Promise.all([
        prisma.$queryRaw<{ sum: any }[]>`
          SELECT COALESCE(SUM("amount"), 0) AS sum
          FROM "settlements"
          WHERE "status"::text IN ('CONFIRMED', 'COMPLETED')
        `,
        prisma.$queryRaw<{ count: bigint }[]>`
          SELECT COUNT(*)::bigint AS count
          FROM "settlements"
          WHERE "status"::text IN ('PENDING', 'AWAITING_CONFIRMATION')
        `,
        prisma.$queryRaw<{ count: bigint }[]>`
          SELECT COUNT(*)::bigint AS count
          FROM "escrow_accounts"
        `,
      ]);

      return {
        currentBalance: Number(sumRows?.[0]?.sum || 0),
        pendingReconciliation: Number(pendingRows?.[0]?.count || 0),
        totalEscrowAccounts: Number(escrowRows?.[0]?.count || 0),
      };
    } catch {
      return { currentBalance: 0, pendingReconciliation: 0, totalEscrowAccounts: 0 };
    }
  }

  async discrepancies(page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const where: any = {
      OR: [
        { status: { in: ["FAILED", "REFUNDED"] } },
        { notes: { not: null } },
      ],
    };
    const total = await (prisma as any).settlement.count({ where });
    const rows = await (prisma as any).settlement.findMany({
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
    });
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
    
    const countRes = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count FROM (
        SELECT id FROM "settlements" WHERE status = 'PENDING'
        UNION ALL
        SELECT id FROM "providus_deposits" WHERE "transactionId" IS NULL OR status = 'PENDING'
      ) as combined
    `;
    const total = Number(countRes?.[0]?.count || 0);

    let rows: any[] = [];
    if (total > 0) {
      rows = await prisma.$queryRaw<any[]>`
        SELECT 
          id, 
          'MANUAL_UPLOAD' as source,
          COALESCE("paymentReference", "transactionId") as "referenceId",
          COALESCE("depositedAt", "createdAt") as "fundDate",
          amount,
          currency,
          status::text,
          "transactionId",
          NULL as "virtualAccountNumber"
        FROM "settlements" 
        WHERE status = 'PENDING'
        
        UNION ALL
        
        SELECT 
          id, 
          'ORPHAN_DEPOSIT' as source,
          "sessionId" as "referenceId",
          "tranDateTime" as "fundDate",
          amount,
          currency,
          status::text,
          "transactionId",
          "accountNumber" as "virtualAccountNumber"
        FROM "providus_deposits" 
        WHERE "transactionId" IS NULL OR status = 'PENDING'
        
        ORDER BY "fundDate" ASC NULLS LAST
        LIMIT ${limit} OFFSET ${skip}
      `;
    }

    const data = rows.map((r: any) => {
      const fundDate = r.fundDate || new Date();
      const mins = this.minutesSince(fundDate);
      const priority = mins >= 120 ? "High" : mins >= 60 ? "Medium" : "Low";
      return {
        id: r.id,
        source: r.source,
        referenceId: r.referenceId,
        fundDate: r.fundDate,
        amount: Number(r.amount || 0),
        currency: r.currency,
        overdueMinutes: mins,
        priority,
        status: r.status,
        transactionId: r.transactionId,
        virtualAccountNumber: r.virtualAccountNumber,
      };
    });

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async escrowAccounts() {
    try {
      const rows = await (prisma as any).escrowAccount.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          currency: true,
          bankName: true,
          accountNumber: true,
          accountName: true,
          status: true,
          createdAt: true,
        },
      });

      return rows.map((b: any) => ({
        id: b.id,
        name: b.accountName,
        bank: b.bankName,
        accountNumber: b.accountNumber,
        reference: `ESCROW-${b.id}`,
        currencyType: b.currency,
        status: (b.status || "").toString().toUpperCase() === "ACTIVE" ? "Active" : "Inactive",
        createdAt: b.createdAt,
      }));
    } catch {
      return [];
    }
  }

  async fundingTransactions(page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    
    const countRes = await prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*)::bigint AS count FROM "settlements" WHERE status = 'CONFIRMED'`;
    const total = Number(countRes?.[0]?.count || 0);

    let data: any[] = [];
    if (total > 0) {
      const rows = await prisma.$queryRaw<any[]>`
        SELECT 
          s.id, 
          s."transactionId", 
          COALESCE(s."paymentReference", s."transactionId") as "referenceId", 
          s.amount, 
          s.currency, 
          COALESCE(s."confirmedAt", s."createdAt") as "fundDate", 
          s."paymentMethod", 
          pr."receiptNumber"
        FROM "settlements" s
        LEFT JOIN "payment_receipts" pr ON pr."settlementId" = s.id
        WHERE s.status = 'CONFIRMED'
        ORDER BY s."confirmedAt" DESC NULLS LAST
        LIMIT ${limit} OFFSET ${skip}
      `;

      data = rows.map(r => ({
        id: r.id,
        transactionId: r.transactionId,
        referenceId: r.referenceId,
        amount: Number(r.amount || 0),
        currency: r.currency,
        fundDate: r.fundDate,
        paymentMethod: r.paymentMethod,
        receiptNumber: r.receiptNumber || null,
      }));
    }

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async createEscrowAccount(payload: {
    currency: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
    createdBy?: string;
  }) {
    const currency = (payload.currency || "").toString().trim();
    const bankName = (payload.bankName || "").toString().trim();
    const accountNumber = (payload.accountNumber || "").toString().trim();
    const accountName = (payload.accountName || "").toString().trim();

    if (!currency) throw new ValidationError("currencyType is required");
    if (!bankName) throw new ValidationError("bankName is required");
    if (!accountNumber) throw new ValidationError("accountNumber is required");
    if (!accountName) throw new ValidationError("accountName is required");

    const existing = await (prisma as any).escrowAccount.findFirst({
      where: { accountNumber },
      select: { id: true },
    });
    if (existing) throw new ValidationError("Escrow account already exists");

    const created = await (prisma as any).escrowAccount.create({
      data: {
        id: randomUUID(),
        currency,
        bankName,
        accountNumber,
        accountName,
        createdBy: payload.createdBy || null,
      },
      select: {
        id: true,
        currency: true,
        bankName: true,
        accountNumber: true,
        accountName: true,
        status: true,
        createdAt: true,
      },
    });

    return {
      id: created.id,
      name: created.accountName,
      bank: created.bankName,
      accountNumber: created.accountNumber,
      reference: `ESCROW-${created.id}`,
      currencyType: created.currency,
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

  /**
   * List all inbound Settlement records (customer NGN deposits) with filters and pagination.
   */
  async listInboundSettlements(filters: {
    status?: string;
    paymentMethod?: string;
    currency?: string;
    startDate?: string;
    endDate?: string;
    q?: string;
    page?: number;
    limit?: number;
  }) {
    const { status, paymentMethod, currency, startDate, endDate, q, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where: any = {
      ...(status && { status }),
      ...(paymentMethod && { paymentMethod }),
      ...(currency && { currency }),
      ...(startDate || endDate
        ? {
            createdAt: {
              ...(startDate && { gte: new Date(startDate) }),
              ...(endDate && { lte: new Date(endDate) }),
            },
          }
        : {}),
      ...(q && {
        OR: [
          { paymentReference: { contains: q, mode: 'insensitive' } },
          { notes: { contains: q, mode: 'insensitive' } },
          { transaction: { referenceNumber: { contains: q, mode: 'insensitive' } } },
        ],
      }),
    };

    const [total, rows] = await Promise.all([
      (prisma as any).settlement.count({ where }),
      (prisma as any).settlement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          transactionId: true,
          amount: true,
          currency: true,
          status: true,
          paymentMethod: true,
          paymentReference: true,
          depositedAt: true,
          confirmedAt: true,
          confirmedBy: true,
          proofOfPayment: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
          bankDetails: {
            select: {
              bankName: true,
              accountNumber: true,
              accountName: true,
              reference: true,
            },
          },
          transaction: {
            select: {
              referenceNumber: true,
              type: true,
              status: true,
              currency: true,
              foreignAmount: true,
              nairaEquivalent: true,
              user: {
                select: {
                  email: true,
                  profile: { select: { firstName: true, lastName: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      data: rows.map((r: any) => ({
        id: r.id,
        transactionId: r.transactionId,
        referenceNumber: r.transaction?.referenceNumber ?? null,
        transactionType: r.transaction?.type ?? null,
        transactionStatus: r.transaction?.status ?? null,
        customer: r.transaction?.user
          ? {
              email: r.transaction.user.email,
              name: `${r.transaction.user.profile?.firstName ?? ''} ${r.transaction.user.profile?.lastName ?? ''}`.trim(),
            }
          : null,
        amount: Number(r.amount),
        currency: r.currency,
        status: r.status,
        paymentMethod: r.paymentMethod,
        paymentReference: r.paymentReference,
        bankDetails: r.bankDetails ?? null,
        depositedAt: r.depositedAt,
        confirmedAt: r.confirmedAt,
        confirmedBy: r.confirmedBy,
        proofOfPayment: r.proofOfPayment,
        notes: r.notes,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export const settlementService = new SettlementService();
