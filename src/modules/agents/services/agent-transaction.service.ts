import { getDatabase } from "../../../config/database";
import { ValidationError, NotFoundError } from "../../../shared/utils";
import { UserRole } from "../../../shared/types";
import { DisbursementMethod, TransactionStatus, TransactionStep } from "../../../shared/types/transaction";
import { uploadFile } from "../../../shared/utils/file-upload";
import { generateId } from "../../../shared/utils";
import { createLogger } from "../../../shared/utils/logger";
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

    if (transaction.status !== TransactionStatus.APPROVED) {
      throw new ValidationError("Disbursement can only be recorded for APPROVED transactions");
    }

    const uploaded = await uploadFile(input.receiptFile, {
      folder: "agent-disbursements",
    });

    const result = await (prisma as any).$transaction(async (tx: any) => {
      const updatedTransaction = await tx.transaction.update({
        where: { id: input.transactionId },
        data: {
          disbursementMethod: input.disbursementMethod,
          status: TransactionStatus.DISBURSEMENT_IN_PROGRESS as any,
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
