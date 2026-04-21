import { getDatabase } from "../../../config/database";
import { ValidationError, NotFoundError } from "../../../shared/utils";
import { UserRole } from "../../../shared/types";
import {
  DisbursementMethod,
  TransactionStatus,
  TransactionStep,
  TransactionType,
} from "../../../shared/types/transaction";
import { uploadFile } from "../../../shared/utils/file-upload";
import { generateId } from "../../../shared/utils";
import { createLogger } from "../../../shared/utils/logger";
import {
  resolveAgentCashStatsDateRange,
  resolveDashboardDateRange,
} from "../../../shared/utils/date-range-presets";
import customerTransactionService from "../../customer/services/customer-transaction.service";

const prisma = getDatabase();
const logger = createLogger("agent-transaction-service");

export interface AgentTransactionExportFilters {
  q?: string;
  status?: string;
  type?: string;
  group?: string;
  currency?: string;
  startDate?: string;
  endDate?: string;
}

export interface AgentTransactionListItem {
  transaction_id: string;
  transaction_date: string;
  transaction_type: string;
  transaction_stage: string;
  transaction_status: string;
}

export interface AgentTransactionListFilters {
  transaction_status?: string;
  transaction_stage?: string;
}

export interface AgentTransactionStats {
  total: number;
  pending: number;
  settled: number;
  rejected: number;
}

export interface AgentCashStatsResult {
  currency: string;
  currencyName: string;
  period: { preset: string; start: string; end: string };
  totalCashReceivedFromCustomer: number;
  totalCashReceivedFromAdmin: number;
  totalCashDisbursed: number;
}

export const AGENT_PAYMENT_MOVEMENT_TYPES = [
  "cash_disbursed",
  "cash_received_from_admin",
  "cash_received_from_customer",
] as const;

export type AgentPaymentMovementType = (typeof AGENT_PAYMENT_MOVEMENT_TYPES)[number];

/** Completed outbound settlement row for agent payment movements list */
export interface AgentPaymentMovementDisbursedRow {
  transaction_id: string;
  customer_full_name: string;
  amount_disbursed: number;
  currency_pair: string;
  prepaid_amount: number | null;
  transaction_type: string;
  transaction_date: string;
}

/** Inbound settlement row (from admin or from customer) */
export interface AgentPaymentMovementInboundRow {
  sender_full_name: string;
  amount_received: number;
  transaction_date: string;
}

export type AgentPaymentMovementRow = AgentPaymentMovementDisbursedRow | AgentPaymentMovementInboundRow;

export interface AgentDashboardRecentTransactionItem {
  transactionId: string;
  timestamp: string;
  amount: number | null;
  currency: string;
}

export interface AgentDashboardTransactionTypeSegment {
  transactionType: string;
  count: number;
  totalAmount: number;
  percentageOfVolume: number;
}

export interface AgentDashboardTransactionsByTypeResult {
  range: string;
  rangeStart: string;
  rangeEnd: string;
  amountBasis: "USD_FOREIGN_AMOUNT";
  totalTransactionCount: number;
  totalVolume: number;
  segments: AgentDashboardTransactionTypeSegment[];
}

/**
 * Payload for creating a transaction on behalf of a customer.
 * Same shape as customer create; userId (customer id) is required.
 */
export interface AgentCreateTransactionPayload {
  userId: string;
  type: string;
  mode?: "BUY" | "SELL";
  currency: string;
  amount: number;
  purpose: string;
  destinationCountry?: string;
  bvn?: string;
  nin?: string;
  formAId?: string;
  taxClearanceNumber?: string;
  admissionType?: "UNDERGRADUATE" | "POSTGRADUATE" | "OTHER";
  documents?: Array<{ documentType: string; fileUrl: string; fileName: string; fileSize?: number }>;
  beneficiaryDetails?: {
    name?: string;
    accountNumber?: string;
    accountName?: string;
    bankName?: string;
    iban?: string;
  };
  pickupLocation?: {
    id?: string;
    name: string;
    address: string;
    state: string;
    city: string;
    recipientName?: string;
    recipientPhone?: string;
    scheduledPickupDate?: string;
    scheduledPickupTime?: string;
  };
}

export interface AgentRecordDisbursementInput {
  transactionId: string;
  disbursementMethod: DisbursementMethod;
  totalAmount: number;
  notes?: string;
  receiptFile: Express.Multer.File;
}

/** Inbound NGN cash payment recorded by agent (non-VA only; virtual-account deposits use Providus). */
export interface AgentRecordInboundPaymentInput {
  transactionId: string;
  amount: number;
  method: "CASH_PICKUP";
  notes?: string;
  receiptFile: Express.Multer.File;
}

export type { AgentTransactionDetailUploadedDoc } from "./agent-transaction-view.helpers";

/** Same payload as GET /api/customer/transactions/:transactionId (customer transaction detail). */
export type AgentTransactionDetailView = Awaited<
  ReturnType<typeof customerTransactionService.getTransactionDetails>
>;

class AgentTransactionService {
  /**
   * Resolve Agent record from the authenticated User (agent).
   */
  private async resolveAgent(agentUserId: string) {
    const agentUser = await prisma.user.findUnique({ where: { id: agentUserId } });
    if (!agentUser || agentUser.role !== UserRole.AGENT) {
      throw new ValidationError("Only agents can create transactions for customers");
    }

    const agent = await (prisma as any).agent.findUnique({
      where: { email: agentUser.email },
    });

    if (!agent) {
      throw new ValidationError("Agent profile not found");
    }

    return agent;
  }

  /**
   * Create a transaction for a customer on behalf of the authenticated agent.
   * Sets createdByAgentId on the transaction.
   */
  async createTransaction(
    agentUserId: string,
    payload: AgentCreateTransactionPayload
  ) {
    if (!payload.userId) {
      throw new ValidationError("userId is required (customer for whom the transaction is created)");
    }

    const agent = await this.resolveAgent(agentUserId);

    return customerTransactionService.createTransaction({
      ...payload,
      createdByAgentId: agent.id,
    });
  }

  /**
   * List transactions created by the agent (paginated, filterable by status and stage).
   */
  async listTransactions(
    agentUserId: string,
    filters: AgentTransactionListFilters,
    page: number,
    limit: number
  ): Promise<{ data: AgentTransactionListItem[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    const agent = await this.resolveAgent(agentUserId);

    const where: any = { createdByAgentId: agent.id };
    if (filters.transaction_status) where.status = filters.transaction_status;
    if (filters.transaction_stage) where.currentStep = filters.transaction_stage;

    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      (prisma as any).transaction.findMany({
        where,
        select: { id: true, createdAt: true, type: true, currentStep: true, status: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      (prisma as any).transaction.count({ where }),
    ]);

    const data: AgentTransactionListItem[] = rows.map((t: any) => ({
      transaction_id: t.id,
      transaction_date: t.createdAt.toISOString(),
      transaction_type: t.type,
      transaction_stage: t.currentStep,
      transaction_status: t.status,
    }));

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Dashboard: recent transactions created by the agent (slim fields, optional type filter).
   */
  async listDashboardRecentTransactions(
    agentUserId: string,
    typeFilter: string | undefined,
    page: number,
    limit: number
  ): Promise<{
    data: AgentDashboardRecentTransactionItem[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const agent = await this.resolveAgent(agentUserId);

    if (typeFilter) {
      if (!Object.values(TransactionType).includes(typeFilter as TransactionType)) {
        throw new ValidationError(`Invalid transaction type: ${typeFilter}`);
      }
    }

    const where: { createdByAgentId: string; type?: TransactionType } = {
      createdByAgentId: agent.id,
    };
    if (typeFilter) {
      where.type = typeFilter as TransactionType;
    }

    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        select: { id: true, createdAt: true, foreignAmount: true, currency: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ]);

    const data: AgentDashboardRecentTransactionItem[] = rows.map((t) => ({
      transactionId: t.id,
      timestamp: t.createdAt.toISOString(),
      amount: t.foreignAmount != null ? Number(t.foreignAmount) : null,
      currency: t.currency,
    }));

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Dashboard pie chart: counts per type (all currencies) and USD foreignAmount sums per type.
   */
  async getDashboardTransactionsByType(
    agentUserId: string,
    rangePreset: string
  ): Promise<AgentDashboardTransactionsByTypeResult> {
    const agent = await this.resolveAgent(agentUserId);
    const { start, end } = resolveDashboardDateRange(rangePreset);

    const baseWhere = {
      createdByAgentId: agent.id,
      createdAt: { gte: start, lte: end },
    };

    const [countGroups, sumGroups] = await Promise.all([
      prisma.transaction.groupBy({
        by: ["type"],
        where: baseWhere,
        _count: { _all: true },
      }),
      prisma.transaction.groupBy({
        by: ["type"],
        where: {
          ...baseWhere,
          currency: { equals: "USD", mode: "insensitive" },
        },
        _sum: { foreignAmount: true },
      }),
    ]);

    const sumByType = new Map<string, number>();
    for (const row of sumGroups) {
      const amt = row._sum.foreignAmount;
      sumByType.set(row.type, amt != null ? Number(amt) : 0);
    }

    let totalVolume = 0;
    const segmentsRaw: AgentDashboardTransactionTypeSegment[] = [];

    for (const row of countGroups) {
      const count = row._count._all;
      if (count === 0) continue;
      const totalAmount = sumByType.get(row.type) ?? 0;
      totalVolume += totalAmount;
      segmentsRaw.push({
        transactionType: row.type,
        count,
        totalAmount,
        percentageOfVolume: 0,
      });
    }

    const round2 = (n: number) => Math.round(n * 100) / 100;
    const segments = segmentsRaw.map((s) => ({
      ...s,
      percentageOfVolume:
        totalVolume > 0 ? round2((s.totalAmount / totalVolume) * 100) : 0,
    }));

    const totalTransactionCount = segments.reduce((acc, s) => acc + s.count, 0);

    return {
      range: rangePreset.trim(),
      rangeStart: start.toISOString(),
      rangeEnd: end.toISOString(),
      amountBasis: "USD_FOREIGN_AMOUNT",
      totalTransactionCount,
      totalVolume: round2(totalVolume),
      segments,
    };
  }

  /**
   * Get transaction stats for the agent (total, pending, settled, rejected).
   */
  async getTransactionStats(agentUserId: string): Promise<AgentTransactionStats> {
    const agent = await this.resolveAgent(agentUserId);

    const baseWhere = { createdByAgentId: agent.id };

    const [total, pending, settled, rejected] = await Promise.all([
      (prisma as any).transaction.count({ where: baseWhere }),
      (prisma as any).transaction.count({
        where: {
          ...baseWhere,
          status: { notIn: ["COMPLETED", "REJECTED", "CANCELLED"] },
        },
      }),
      (prisma as any).transaction.count({
        where: { ...baseWhere, status: "COMPLETED" },
      }),
      (prisma as any).transaction.count({
        where: { ...baseWhere, status: "REJECTED" },
      }),
    ]);

    return { total, pending, settled, rejected };
  }

  /**
   * Cash movement stats for transactions created by this agent (one reporting currency).
   * - Customer: agent-recorded cash (`CASH_DEPOSIT` + confirmedBy agent user) or VA/Providus (`BANK_TRANSFER` + SYSTEM).
   * - Admin: inbound settlements confirmed by an AdminUser.
   * - Disbursed: completed outbound settlements initiated by this agent (`Agent.id`).
   */
  async getCashStats(
    agentUserId: string,
    periodPreset: string,
    currencyParam?: string
  ): Promise<AgentCashStatsResult> {
    const agent = await this.resolveAgent(agentUserId);
    const { start, end } = resolveAgentCashStatsDateRange(periodPreset);
    const currency = (currencyParam || "NGN").trim().toUpperCase();

    const currencyNames: Record<string, string> = {
      NGN: "Nigerian Naira",
      USD: "US Dollar",
      GBP: "British Pound Sterling",
      EUR: "Euro",
    };
    const currencyName = currencyNames[currency] || currency;

    const agentTransactions = await prisma.transaction.findMany({
      where: { createdByAgentId: agent.id },
      select: { id: true },
    });
    const agentTransactionIds = agentTransactions.map((t) => t.id);

    const round2 = (n: number) => Math.round(n * 100) / 100;

    if (agentTransactionIds.length === 0) {
      return {
        currency,
        currencyName,
        period: {
          preset: periodPreset.trim(),
          start: start.toISOString(),
          end: end.toISOString(),
        },
        totalCashReceivedFromCustomer: 0,
        totalCashReceivedFromAdmin: 0,
        totalCashDisbursed: 0,
      };
    }

    const txIdFilter = { in: agentTransactionIds };
    const confirmedAtRange = { gte: start, lte: end };

    const adminRows = await prisma.adminUser.findMany({ select: { id: true } });
    const adminIds = adminRows.map((a) => a.id);

    const [fromCustomerAgg, disbursedAgg] = await Promise.all([
      prisma.settlement.aggregate({
        where: {
          status: "CONFIRMED",
          currency,
          transactionId: txIdFilter,
          confirmedAt: confirmedAtRange,
          OR: [
            { paymentMethod: "CASH_DEPOSIT", confirmedBy: agentUserId },
            { paymentMethod: "BANK_TRANSFER", confirmedBy: "SYSTEM" },
          ],
        },
        _sum: { amount: true },
      }),
      prisma.outboundSettlement.aggregate({
        where: {
          status: "COMPLETED",
          currency,
          transactionId: txIdFilter,
          initiatedBy: agent.id,
          updatedAt: confirmedAtRange,
        },
        _sum: { amount: true },
      }),
    ]);

    const fromAdminAgg =
      adminIds.length > 0
        ? await prisma.settlement.aggregate({
            where: {
              status: "CONFIRMED",
              currency,
              transactionId: txIdFilter,
              confirmedAt: confirmedAtRange,
              confirmedBy: { in: adminIds },
            },
            _sum: { amount: true },
          })
        : { _sum: { amount: null } };

    return {
      currency,
      currencyName,
      period: {
        preset: periodPreset.trim(),
        start: start.toISOString(),
        end: end.toISOString(),
      },
      totalCashReceivedFromCustomer: round2(Number(fromCustomerAgg._sum?.amount ?? 0)),
      totalCashReceivedFromAdmin: round2(Number(fromAdminAgg._sum?.amount ?? 0)),
      totalCashDisbursed: round2(Number(disbursedAgg._sum?.amount ?? 0)),
    };
  }

  /**
   * Paginated cash movements for transactions created by this agent (same buckets as getCashStats).
   */
  async listPaymentMovements(
    agentUserId: string,
    type: AgentPaymentMovementType,
    page: number,
    limit: number
  ): Promise<{
    data: AgentPaymentMovementRow[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const agent = await this.resolveAgent(agentUserId);

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const round2 = (n: number) => Math.round(n * 100) / 100;
    const currencyPair = (currency: string) => `${currency}/NGN`;

    const profileFullName = (profile: { firstName: string; lastName: string } | null | undefined) => {
      if (!profile) return "Customer";
      const name = `${profile.firstName || ""} ${profile.lastName || ""}`.trim();
      return name || "Customer";
    };

    const agentTransactions = await prisma.transaction.findMany({
      where: { createdByAgentId: agent.id },
      select: { id: true },
    });
    const agentTransactionIds = agentTransactions.map((t) => t.id);
    const txIdFilter = { in: agentTransactionIds };

    if (agentTransactionIds.length === 0) {
      return {
        data: [],
        pagination: {
          page: safePage,
          limit: safeLimit,
          total: 0,
          totalPages: 1,
        },
      };
    }

    if (type === "cash_disbursed") {
      const where = {
        status: "COMPLETED" as const,
        initiatedBy: agent.id,
        transactionId: txIdFilter,
      };

      const [rows, total] = await Promise.all([
        prisma.outboundSettlement.findMany({
          where,
          select: {
            amount: true,
            completedAt: true,
            updatedAt: true,
            transactionId: true,
          },
          orderBy: { updatedAt: "desc" },
          skip,
          take: safeLimit,
        }),
        prisma.outboundSettlement.count({ where }),
      ]);

      const txIds = rows.map((r) => r.transactionId).filter((id): id is string => Boolean(id));
      const txs =
        txIds.length > 0
          ? await prisma.transaction.findMany({
              where: { id: { in: txIds } },
              select: {
                id: true,
                type: true,
                currency: true,
                userId: true,
                prepaidCard: { select: { amount: true } },
              },
            })
          : [];

      const userIds = [...new Set(txs.map((t) => t.userId))];
      const users =
        userIds.length > 0
          ? await prisma.user.findMany({
              where: { id: { in: userIds } },
              select: { id: true, profile: { select: { firstName: true, lastName: true } } },
            })
          : [];
      const profileByUserId = new Map(users.map((u) => [u.id, u.profile]));

      const txById = new Map(txs.map((t) => [t.id, t]));

      const data: AgentPaymentMovementDisbursedRow[] = rows.map((row) => {
        const tx = row.transactionId ? txById.get(row.transactionId) : undefined;
        const at = row.completedAt ?? row.updatedAt;
        const customerName = profileFullName(tx?.userId ? profileByUserId.get(tx.userId) : undefined);
        return {
          transaction_id: row.transactionId as string,
          customer_full_name: customerName,
          amount_disbursed: round2(Number(row.amount)),
          currency_pair: tx ? currencyPair(tx.currency) : "NGN/NGN",
          prepaid_amount: tx?.prepaidCard ? round2(Number(tx.prepaidCard.amount)) : null,
          transaction_type: tx ? String(tx.type) : "",
          transaction_date: at.toISOString(),
        };
      });

      return {
        data,
        pagination: {
          page: safePage,
          limit: safeLimit,
          total,
          totalPages: Math.ceil(total / safeLimit) || 1,
        },
      };
    }

    if (type === "cash_received_from_admin") {
      const adminRows = await prisma.adminUser.findMany({ select: { id: true, fullName: true } });
      const adminIds = adminRows.map((a) => a.id);
      const adminNameById = new Map(adminRows.map((a) => [a.id, a.fullName]));

      if (adminIds.length === 0) {
        return {
          data: [],
          pagination: { page: safePage, limit: safeLimit, total: 0, totalPages: 1 },
        };
      }

      const where = {
        status: "CONFIRMED" as const,
        transactionId: txIdFilter,
        confirmedBy: { in: adminIds },
      };

      const [rows, total] = await Promise.all([
        prisma.settlement.findMany({
          where,
          select: {
            amount: true,
            confirmedAt: true,
            confirmedBy: true,
          },
          orderBy: { confirmedAt: "desc" },
          skip,
          take: safeLimit,
        }),
        prisma.settlement.count({ where }),
      ]);

      const data: AgentPaymentMovementInboundRow[] = rows.map((row) => ({
        sender_full_name: (row.confirmedBy && adminNameById.get(row.confirmedBy)) || "Admin",
        amount_received: round2(Number(row.amount)),
        transaction_date: (row.confirmedAt ?? new Date(0)).toISOString(),
      }));

      return {
        data,
        pagination: {
          page: safePage,
          limit: safeLimit,
          total,
          totalPages: Math.ceil(total / safeLimit) || 1,
        },
      };
    }

    // cash_received_from_customer
    const where = {
      status: "CONFIRMED" as const,
      transactionId: txIdFilter,
      OR: [
        { paymentMethod: "CASH_DEPOSIT" as const, confirmedBy: agentUserId },
        { paymentMethod: "BANK_TRANSFER" as const, confirmedBy: "SYSTEM" },
      ],
    };

    const [rows, total] = await Promise.all([
      prisma.settlement.findMany({
        where,
        select: {
          transactionId: true,
          amount: true,
          paymentMethod: true,
          paymentReference: true,
          confirmedAt: true,
        },
        orderBy: { confirmedAt: "desc" },
        skip,
        take: safeLimit,
      }),
      prisma.settlement.count({ where }),
    ]);

    const custTxIds = [...new Set(rows.map((r) => r.transactionId))];
    const custTxs =
      custTxIds.length > 0
        ? await prisma.transaction.findMany({
            where: { id: { in: custTxIds } },
            select: { id: true, userId: true },
          })
        : [];
    const userIdByTxId = new Map(custTxs.map((t) => [t.id, t.userId]));
    const custUserIds = [...new Set(custTxs.map((t) => t.userId))];
    const custUsers =
      custUserIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: custUserIds } },
            select: { id: true, profile: { select: { firstName: true, lastName: true } } },
          })
        : [];
    const custProfileByUserId = new Map(custUsers.map((u) => [u.id, u.profile]));

    const sessionIds = rows
      .filter(
        (r) =>
          r.paymentMethod === "BANK_TRANSFER" &&
          r.paymentReference != null &&
          String(r.paymentReference).length > 0
      )
      .map((r) => r.paymentReference as string);
    const uniqueSessionIds = [...new Set(sessionIds)];

    const deposits =
      uniqueSessionIds.length > 0
        ? await prisma.providusDeposit.findMany({
            where: { sessionId: { in: uniqueSessionIds } },
            select: { sessionId: true, sourceAccountName: true },
          })
        : [];
    const sourceNameBySession = new Map(
      deposits.map((d) => [d.sessionId, d.sourceAccountName ?? ""])
    );

    const data: AgentPaymentMovementInboundRow[] = rows.map((row) => {
      const userId = userIdByTxId.get(row.transactionId);
      const customerName = profileFullName(userId ? custProfileByUserId.get(userId) : undefined);

      let senderFullName = customerName;
      if (row.paymentMethod === "BANK_TRANSFER" && row.paymentReference) {
        const fromProvidus = sourceNameBySession.get(row.paymentReference);
        if (fromProvidus && fromProvidus.trim()) {
          senderFullName = fromProvidus.trim();
        }
      }

      return {
        sender_full_name: senderFullName,
        amount_received: round2(Number(row.amount)),
        transaction_date: (row.confirmedAt ?? new Date(0)).toISOString(),
      };
    });

    return {
      data,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit) || 1,
      },
    };
  }

  /**
   * Same response as customer GET transaction by id; only transactions created by this agent.
   */
  async getTransactionById(
    agentUserId: string,
    transactionId: string
  ): Promise<AgentTransactionDetailView> {
    const agent = await this.resolveAgent(agentUserId);

    const row = await prisma.transaction.findFirst({
      where: { id: transactionId, createdByAgentId: agent.id },
      select: { id: true, userId: true },
    });

    if (!row) {
      throw new NotFoundError("Transaction not found or you are not the creating agent");
    }

    return customerTransactionService.getTransactionDetails(row.id, row.userId);
  }

  /**
   * Resolve the customer user id for a transaction created by this agent (e.g. virtual account flows).
   */
  async getCustomerUserIdForAgentTransaction(
    agentUserId: string,
    transactionId: string
  ): Promise<{ customerUserId: string }> {
    const agent = await this.resolveAgent(agentUserId);

    const row = await prisma.transaction.findFirst({
      where: { id: transactionId, createdByAgentId: agent.id },
      select: { userId: true },
    });

    if (!row) {
      throw new NotFoundError("Transaction not found or you are not the creating agent");
    }

    return { customerUserId: row.userId };
  }

  async recordDisbursement(
    agentUserId: string,
    input: AgentRecordDisbursementInput
  ) {
    if (!input.transactionId) {
      throw new ValidationError("transactionId is required");
    }
    if (!input.disbursementMethod) {
      throw new ValidationError("disbursementMethod is required");
    }
    if (!input.totalAmount || input.totalAmount <= 0) {
      throw new ValidationError("totalAmount must be a positive number");
    }
    if (!input.receiptFile) {
      throw new ValidationError("payment receipt file is required");
    }

    const agent = await this.resolveAgent(agentUserId);

    const transaction = await (prisma as any).transaction.findFirst({
      where: { id: input.transactionId, createdByAgentId: agent.id },
      select: {
        id: true,
        status: true,
        currentStep: true,
        currency: true,
      },
    });

    if (!transaction) {
      throw new NotFoundError("Transaction not found or you are not the creating agent");
    }

    if (
      transaction.status === TransactionStatus.COMPLETED ||
      transaction.status === TransactionStatus.CANCELLED
    ) {
      throw new ValidationError("Cannot record disbursement for a completed or cancelled transaction");
    }

    if (transaction.status !== (TransactionStatus.DISBURSEMENT_IN_PROGRESS as any)) {
      throw new ValidationError("Disbursement can only be recorded for DISBURSEMENT_IN_PROGRESS transactions");
    }

    const uploaded = await uploadFile(input.receiptFile, {
      folder: "agent-disbursements",
    });

    const result = await (prisma as any).$transaction(async (tx: any) => {
      const updatedTransaction = await tx.transaction.update({
        where: { id: input.transactionId },
        data: {
          disbursementMethod: input.disbursementMethod,
          status: TransactionStatus.PENDING_RECORD_VALIDATION as any,
          currentStep: TransactionStep.DISBURSEMENT as any,
          updatedAt: new Date(),
          history: {
            create: {
              action: "DISBURSEMENT_RECORDED",
              notes: input.notes,
              newValue: JSON.stringify({
                method: input.disbursementMethod,
                amount: input.totalAmount,
                receiptUrl: uploaded.fileUrl,
              }),
            },
          },
        },
        include: {
          history: false,
        },
      });

      const existingOutbound = await tx.outboundSettlement.findFirst({
        where: { transactionId: input.transactionId },
      });

      let outbound;
      if (existingOutbound) {
        outbound = await tx.outboundSettlement.update({
          where: { id: existingOutbound.id },
          data: {
            amount: input.totalAmount as any,
            currency: transaction.currency,
            paymentMethod: input.disbursementMethod,
            paymentProof: uploaded.fileUrl,
            notes: input.notes,
            status: "COMPLETED",
            metadata: {
              ...(existingOutbound.metadata || {}),
              receiptFile: {
                fileUrl: uploaded.fileUrl,
                fileName: uploaded.fileName,
                fileSize: uploaded.fileSize,
                mimeType: uploaded.mimeType,
              },
            },
          },
        });
      } else {
        outbound = await tx.outboundSettlement.create({
          data: {
            batchId: null,
            transactionId: input.transactionId,
            referenceNumber: generateId(),
            amount: input.totalAmount as any,
            currency: transaction.currency,
            status: "COMPLETED",
            beneficiaryName: "",
            paymentMethod: input.disbursementMethod,
            notes: input.notes,
            paymentProof: uploaded.fileUrl,
            initiatedBy: agent.id,
            metadata: {
              receiptFile: {
                fileUrl: uploaded.fileUrl,
                fileName: uploaded.fileName,
                fileSize: uploaded.fileSize,
                mimeType: uploaded.mimeType,
              },
            },
          },
        });
      }

      return {
        transaction: updatedTransaction,
        outboundSettlement: outbound,
        paymentReceiptUrl: uploaded.fileUrl,
      };
    });

    return result;
  }

  /**
   * Record customer inbound payment (cash or non-VA bank proof) for an agent-created transaction.
   * Rejected when a virtual account exists for the transaction (use VA / Providus deposit flow instead).
   */
  async recordInboundPayment(agentUserId: string, input: AgentRecordInboundPaymentInput) {
    if (!input.transactionId) {
      throw new ValidationError("transactionId is required");
    }
    if (!input.amount || input.amount <= 0) {
      throw new ValidationError("amount must be a positive number");
    }
    if (!input.receiptFile) {
      throw new ValidationError("paymentReceipt file is required");
    }
    if (input.method !== "CASH_PICKUP") {
      throw new ValidationError("method must be CASH_PICKUP (cash collection only; non-VA)");
    }

    const agent = await this.resolveAgent(agentUserId);

    const transaction = await prisma.transaction.findFirst({
      where: { id: input.transactionId, createdByAgentId: agent.id },
      select: { id: true, status: true },
    });

    if (!transaction) {
      throw new NotFoundError("Transaction not found or you are not the creating agent");
    }

    const existingVa = await prisma.virtualAccount.findUnique({
      where: { transactionId: input.transactionId },
      select: { id: true },
    });
    if (existingVa) {
      throw new ValidationError(
        "This transaction uses a virtual account for deposits. Payment is confirmed automatically when funds arrive; this endpoint is only for non-virtual-account (cash or manual) payments."
      );
    }

    const payableStatuses: string[] = [
      TransactionStatus.APPROVED,
      TransactionStatus.AWAITING_DEPOSIT,
      TransactionStatus.DEPOSIT_PENDING,
      TransactionStatus.DEPOSIT_CONFIRMED,
    ];
    if (!payableStatuses.includes(transaction.status as string)) {
      throw new ValidationError(
        `Cannot record payment while transaction status is ${transaction.status}. Expected one of: ${payableStatuses.join(", ")}.`
      );
    }

    const uploaded = await uploadFile(input.receiptFile, {
      folder: "agent-inbound-payments",
    });

    const paymentMethodPrisma = "CASH_DEPOSIT";
    const paymentReference = `AGENT-IN-${generateId()}`;

    const result = await prisma.$transaction(async (tx) => {
      const settlement = await tx.settlement.upsert({
        where: { transactionId: input.transactionId },
        create: {
          transactionId: input.transactionId,
          amount: input.amount as any,
          currency: "NGN",
          status: "CONFIRMED",
          paymentMethod: paymentMethodPrisma as any,
          paymentReference,
          proofOfPayment: uploaded.fileUrl,
          depositedAt: new Date(),
          confirmedAt: new Date(),
          confirmedBy: agentUserId,
          notes: input.notes ?? null,
        },
        update: {
          amount: input.amount as any,
          currency: "NGN",
          status: "CONFIRMED",
          paymentMethod: paymentMethodPrisma as any,
          paymentReference,
          proofOfPayment: uploaded.fileUrl,
          depositedAt: new Date(),
          confirmedAt: new Date(),
          confirmedBy: agentUserId,
          notes: input.notes ?? null,
        },
      });

      const updatedTransaction = await tx.transaction.update({
        where: { id: input.transactionId },
        data: {
          status: TransactionStatus.DISBURSEMENT_IN_PROGRESS as any,
          currentStep: TransactionStep.DISBURSEMENT as any,
          updatedAt: new Date(),
        },
      });

      await tx.transactionStepLog.create({
        data: {
          transactionId: input.transactionId,
          step: TransactionStep.DISBURSEMENT as any,
          status: "COMPLETED",
          data: {
            source: "AGENT_INBOUND_PAYMENT",
            recordedByAgentUserId: agentUserId,
            paymentReference,
            method: input.method,
            amount: input.amount,
            receiptUrl: uploaded.fileUrl,
          },
          completedAt: new Date(),
        },
      });

      await tx.transactionHistory.create({
        data: {
          transactionId: input.transactionId,
          action: "DISBURSEMENT_IN_PROGRESS",
          performedBy: agentUserId,
          notes: input.notes ?? paymentReference,
          newValue: JSON.stringify({
            amount: input.amount,
            method: input.method,
            receiptUrl: uploaded.fileUrl,
            paymentReference,
          }),
        },
      });

      return { settlement, transaction: updatedTransaction };
    });

    logger.info("[recordInboundPayment] Inbound payment recorded by agent", {
      transactionId: input.transactionId,
      agentUserId,
      amount: input.amount,
      method: input.method,
    });

    return {
      transactionId: input.transactionId,
      status: result.transaction.status,
      currentStep: result.transaction.currentStep,
      paymentReference,
      amount: input.amount,
      currency: "NGN",
      method: input.method,
      proofOfPaymentUrl: uploaded.fileUrl,
      settlementId: result.settlement.id,
    };
  }

  /**
   * Upload documents for a transaction created by the agent.
   * Validates transaction belongs to agent (createdByAgentId), then delegates to customer upload.
   */
  async uploadDocuments(
    agentUserId: string,
    transactionId: string,
    documentType: string,
    files: Express.Multer.File[]
  ) {
    const agent = await this.resolveAgent(agentUserId);

    const transaction = await (prisma as any).transaction.findFirst({
      where: { id: transactionId, createdByAgentId: agent.id },
      select: { userId: true },
    });

    if (!transaction) {
      throw new NotFoundError("Transaction not found or you are not the creating agent");
    }

    return customerTransactionService.uploadDocuments({
      transactionId,
      userId: transaction.userId,
      documentType,
      files,
    });
  }

  private static readonly TRANSACTION_GROUPS: Record<string, string[]> = {
    BUY: ["PTA", "BTA", "SCHOOL_FEES", "MEDICAL", "PROFESSIONAL_BODY"],
    SELL: ["RESIDENT_FX", "EXPATRIATE_FX"],
    REMITTANCE: ["IMTO_REMITTANCE", "CASH_REMITTANCE"],
  };

  private buildExportWhere(
    agentId: string,
    filters: AgentTransactionExportFilters
  ): any {
    const where: any = { createdByAgentId: agentId };

    if (filters.q) {
      where.OR = [
        { referenceNumber: { contains: filters.q, mode: "insensitive" } },
        { purpose: { contains: filters.q, mode: "insensitive" } },
        { destinationCountry: { contains: filters.q, mode: "insensitive" } },
        { currency: { contains: filters.q, mode: "insensitive" } },
      ];
    }

    if (filters.status) where.status = filters.status;
    if (filters.currency) where.currency = filters.currency.toUpperCase();

    if (filters.type) {
      where.type = filters.type.toUpperCase();
    } else if (filters.group) {
      const groupTypes =
        AgentTransactionService.TRANSACTION_GROUPS[filters.group.toUpperCase()];
      if (groupTypes) where.type = { in: groupTypes };
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
    }

    return where;
  }

  private resolveTransactionGroup(type: string, mode?: string | null): string {
    if (type === "TOURIST_FX") {
      if (mode === "BUY") return "BUY";
      if (mode === "SELL") return "SELL";
      return "SELL";
    }
    for (const [group, types] of Object.entries(
      AgentTransactionService.TRANSACTION_GROUPS
    )) {
      if (types.includes(type)) return group;
    }
    return "OTHER";
  }

  /**
   * Export transactions created by the agent as CSV (same format as customer export).
   * Up to 10_000 rows; same filters as customer export.
   */
  async exportTransactions(
    agentUserId: string,
    filters: AgentTransactionExportFilters = {}
  ): Promise<string> {
    const agent = await this.resolveAgent(agentUserId);
    const where = this.buildExportWhere(agent.id, filters);

    logger.info("[exportTransactions] Exporting transactions for agent", {
      agentId: agent.id,
      filters,
    });

    const transactions = await (prisma as any).transaction.findMany({
      where,
      select: {
        referenceNumber: true,
        type: true,
        transactionMode: true,
        status: true,
        purpose: true,
        destinationCountry: true,
        currency: true,
        foreignAmount: true,
        nairaEquivalent: true,
        exchangeRate: true,
        disbursementMethod: true,
        createdAt: true,
        completedAt: true,
        rejectedAt: true,
        rejectionReason: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10_000,
    });

    logger.info("[exportTransactions] Transactions fetched for export", {
      agentId: agent.id,
      transactionCount: transactions.length,
    });

    const headers = [
      "Reference Number",
      "Group",
      "Type",
      "Status",
      "Purpose",
      "Destination Country",
      "Currency",
      "Foreign Amount",
      "NGN Equivalent",
      "Exchange Rate",
      "Disbursement Method",
      "Created At",
      "Completed At",
      "Rejected At",
      "Rejection Reason",
    ];

    const escape = (v: unknown) => {
      if (v == null) return "";
      const s = String(v);
      return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const rows = transactions.map((t: any) =>
      [
        t.referenceNumber,
        this.resolveTransactionGroup(t.type, t.transactionMode),
        t.type,
        t.status,
        t.purpose,
        t.destinationCountry,
        t.currency,
        t.foreignAmount ?? "",
        t.nairaEquivalent ?? "",
        t.exchangeRate ?? "",
        t.disbursementMethod ?? "",
        t.createdAt.toISOString(),
        t.completedAt?.toISOString() ?? "",
        t.rejectedAt?.toISOString() ?? "",
        t.rejectionReason ?? "",
      ]
        .map(escape)
        .join(",")
    );

    const csvContent = [headers.join(","), ...rows].join("\n");

    logger.info("[exportTransactions] CSV export completed", {
      agentId: agent.id,
      transactionCount: transactions.length,
    });

    return csvContent;
  }
}

const agentTransactionService = new AgentTransactionService();
export default agentTransactionService;
