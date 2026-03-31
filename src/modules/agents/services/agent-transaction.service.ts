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
import { resolveDashboardDateRange } from "../../../shared/utils/date-range-presets";
import customerTransactionService from "../../customer/services/customer-transaction.service";
import type { AgentTransactionDetailUploadedDoc } from "./agent-transaction-view.helpers";
import {
  formatProfileAddress,
  mapDocSnippet,
  pickLatestDocumentByType,
} from "./agent-transaction-view.helpers";

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

export type { AgentTransactionDetailUploadedDoc } from "./agent-transaction-view.helpers";

export interface AgentTransactionDetailView {
  timestamp: string;
  identification: {
    full_name: string | null;
    email_address: string;
    phone_number: string;
    address: string | null;
  };
  transaction_details: {
    transaction_id: string;
    amount: number | null;
    equivalent_amount: number | null;
    currency: string;
    date_initiated: string;
  };
  beneficiary_details: {
    beneficiary_full_name: string | null;
    beneficiary_bank: string | null;
    routing_number: string | null;
    bank_address: string | null;
    swift_code: string | null;
    account_number: string | null;
    beneficiary_address: string | null;
  };
  required_documents: {
    bvn: string | null;
    nin: string | null;
    admission_type: string | null;
    form_a_id: string | null;
    evidence_of_admission: AgentTransactionDetailUploadedDoc | null;
    school_invoice: AgentTransactionDetailUploadedDoc | null;
    international_passport_number: string | null;
  };
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
   * Full transaction detail for agent (scoped to createdByAgentId). BVN/NIN are unmasked.
   */
  async getTransactionById(
    agentUserId: string,
    transactionId: string
  ): Promise<AgentTransactionDetailView> {
    const agent = await this.resolveAgent(agentUserId);

    const transaction = await prisma.transaction.findFirst({
      where: { id: transactionId, createdByAgentId: agent.id },
      include: {
        documents: {
          select: {
            id: true,
            documentType: true,
            fileName: true,
            fileUrl: true,
            verificationStatus: true,
            uploadedAt: true,
          },
        },
        steps: {
          where: { step: TransactionStep.PERSONAL_INFO },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!transaction) {
      throw new NotFoundError("Transaction not found or you are not the creating agent");
    }

    const [user, outbound] = await Promise.all([
      prisma.user.findUnique({
        where: { id: transaction.userId },
        select: {
          email: true,
          phoneNumber: true,
          profile: {
            select: {
              firstName: true,
              lastName: true,
              address: true,
              city: true,
              state: true,
              country: true,
              postalCode: true,
            },
          },
          kyc: {
            select: {
              bvn: true,
              nin: true,
              passportNumber: true,
            },
          },
        },
      }),
      prisma.outboundSettlement.findFirst({
        where: { transactionId: transaction.id },
        select: {
          beneficiaryName: true,
          beneficiaryBank: true,
          beneficiaryAccount: true,
          beneficiarySwift: true,
          beneficiaryAddress: true,
        },
      }),
    ]);

    if (!user) {
      throw new NotFoundError("Customer not found for this transaction");
    }

    const personalInfoStep = transaction.steps[0];
    const personalInfoData = (personalInfoStep?.data as Record<string, unknown> | null) || null;
    const stepBeneficiary = personalInfoData?.beneficiaryDetails as
      | {
          name?: string;
          accountNumber?: string;
          accountName?: string;
          bankName?: string;
          iban?: string;
        }
      | undefined;

    const amount =
      transaction.foreignAmount != null ? Number(transaction.foreignAmount) : null;
    const equivalentAmount =
      transaction.nairaEquivalent != null ? Number(transaction.nairaEquivalent) : null;

    const admissionType =
      personalInfoData?.admissionType != null
        ? String(personalInfoData.admissionType)
        : null;

    const evidenceDoc = pickLatestDocumentByType(transaction.documents, "SCHOOL_ADMISSION");
    const invoiceDoc = pickLatestDocumentByType(transaction.documents, "INVOICE");

    const profile = user.profile;
    const fullName = profile
      ? `${profile.firstName || ""} ${profile.lastName || ""}`.trim() || null
      : null;

    return {
      timestamp: transaction.createdAt.toISOString(),
      identification: {
        full_name: fullName,
        email_address: user.email,
        phone_number: user.phoneNumber,
        address: formatProfileAddress(profile),
      },
      transaction_details: {
        transaction_id: transaction.id,
        amount,
        equivalent_amount: equivalentAmount,
        currency: transaction.currency,
        date_initiated: transaction.createdAt.toISOString(),
      },
      beneficiary_details: {
        beneficiary_full_name:
          outbound?.beneficiaryName ||
          stepBeneficiary?.name ||
          stepBeneficiary?.accountName ||
          null,
        beneficiary_bank: outbound?.beneficiaryBank || stepBeneficiary?.bankName || null,
        routing_number: null,
        bank_address: null,
        swift_code: outbound?.beneficiarySwift || null,
        account_number:
          outbound?.beneficiaryAccount ||
          stepBeneficiary?.accountNumber ||
          stepBeneficiary?.iban ||
          null,
        beneficiary_address: outbound?.beneficiaryAddress || null,
      },
      required_documents: {
        bvn: user.kyc?.bvn ?? null,
        nin: user.kyc?.nin ?? null,
        admission_type: admissionType,
        form_a_id: transaction.formAId ?? null,
        evidence_of_admission: mapDocSnippet(evidenceDoc),
        school_invoice: mapDocSnippet(invoiceDoc),
        international_passport_number: user.kyc?.passportNumber ?? null,
      },
    };
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
