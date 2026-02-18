import { getDatabase } from "../../../config/database";
const prisma = getDatabase();
import { createLogger } from "../../../shared/utils";
import { ServiceName, TransactionStep, TransactionStatus, VerificationStatus } from "../../../shared/types";

const logger = createLogger(ServiceName.ADMIN);

type ReviewPayload = {
  notes?: string;
  riskLevel?: "LOW" | "MEDIUM" | "HIGH";
  amlDecision?: "PASS" | "FAIL" | "ESCALATE";
};

type SettlePayload = {
  disbursementMethod: string;
  settlementReference: string;
};

export class AdminTransactionsService {

  private async logAdminAction(params: {
    adminId: string;
    actionType: any;
    resourceType: string;
    resourceId: string;
    reason?: string;
    metadata?: any;
  }) {
    return prisma.adminAction.create({
      data: {
        adminId: params.adminId,
        actionType: params.actionType,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        reason: params.reason,
        metadata: params.metadata,
      },
    });
  }

  async getTransactionStats() {
    const [underReviewA, underReviewB, rejected, approved, reqInfoGroup] = await Promise.all([
      prisma.transaction.count({ where: { status: TransactionStatus.VERIFICATION_IN_PROGRESS } as any }),
      prisma.transaction.count({ where: { status: TransactionStatus.ADMIN_APPROVAL_PENDING } as any }),
      prisma.transaction.count({ where: { status: TransactionStatus.REJECTED } as any }),
      prisma.transaction.count({ where: { status: TransactionStatus.APPROVED } as any }),
      prisma.transactionDocument.groupBy({
        by: ["transactionId"],
        where: { verificationStatus: VerificationStatus.REQUIRES_MANUAL_REVIEW } as any,
      }),
    ]);
    const requestInformation = Array.isArray(reqInfoGroup) ? reqInfoGroup.length : 0;
    return {
      underReview: underReviewA + underReviewB,
      rejected,
      requestInformation,
      approved,
    };
  }

  async listTransactions(filters: any, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.step) where.currentStep = filters.step;
    if (filters.type) where.type = filters.type;
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
    }
    if (filters.tab === "receive") {
      where.disbursementMethod = "IMTO";
    }
    if (filters.tab === "sell") {
      where.status = { in: [TransactionStatus.DISBURSEMENT_IN_PROGRESS, TransactionStatus.COMPLETED] } as any;
    }
    const q = (filters.q || "").toString().trim();
    if (q) {
      where.OR = [
        { referenceNumber: { contains: q, mode: "insensitive" } },
        { user: { profile: { firstName: { contains: q, mode: "insensitive" } } } },
        { user: { profile: { lastName: { contains: q, mode: "insensitive" } } } },
      ];
    }
    const orderBy: any = {};
    const sortBy = filters.sortBy || "createdAt";
    const sortOrder = (filters.sortOrder || "desc").toLowerCase() === "asc" ? "asc" : "desc";
    orderBy[sortBy] = sortOrder;

    const [items, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: { 
          // @ts-ignore
          user: { include: { profile: true } } 
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ]);

    const data = items.map((t: any) => {
      const name = t.user?.profile
        ? `${t.user.profile.firstName || ""} ${t.user.profile.lastName || ""}`.trim()
        : undefined;
      const value = Number(t.nairaEquivalent || t.foreignAmount || 0);
      return {
        id: t.id,
        customerName: name,
        dateAndId: { date: t.createdAt, reference: t.referenceNumber },
        transactionType: t.type,
        transactionStage: t.currentStep,
        workflowStage: t.status,
        transactionValue: value,
        status: t.status,
      };
    });

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getTransaction(id: string) {
    const trx = await prisma.transaction.findUnique(
      {
        where: { id },
        include: {
          // @ts-ignore
          user: { include: { profile: true, kyc: true } },
          steps: true,
          documents: true,
          history: true,
          receipt: true,
          cashPickup: true,
        },
      } as any
    );
    if (!trx) return null;
    const name = (trx as any).user?.profile
      ? `${(trx as any).user.profile.firstName || ""} ${(trx as any).user.profile.lastName || ""}`.trim()
      : undefined;
    const bvn = (trx as any).user?.kyc?.bvn || null;
    const maskedBvn = bvn ? `${bvn.slice(0, 2)}********* ${bvn.slice(-3)}` : null;
    const docCount = Array.isArray((trx as any).documents) ? (trx as any).documents.length : 0;
    const pickup = (trx as any).cashPickup || null;
    const valueFx = Number(trx.foreignAmount || 0);
    const valueNgn = Number(trx.nairaEquivalent || 0);
    const statusLabel = trx.status;
    const stageLabel = trx.currentStep;
    const requestStatus =
      trx.status === TransactionStatus.VERIFICATION_IN_PROGRESS || trx.status === TransactionStatus.ADMIN_APPROVAL_PENDING
        ? "Under Review"
        : trx.status === TransactionStatus.REJECTED
        ? "Rejected"
        : trx.status === TransactionStatus.APPROVED
        ? "Approved"
        : "Pending";
    return {
      id: trx.id,
      reference: trx.referenceNumber,
      date: trx.createdAt,
      time: trx.createdAt,
      customerName: name,
      customerType: (trx as any).user?.customerType || null,
      transactionType: trx.type,
      fxType: "Buy FX",
      transactionStage: stageLabel,
      workflowStage: statusLabel,
      requestStatus,
      details: {
        transactionValueFx: valueFx,
        transactionValueNgn: valueNgn,
        requesterType: "Customer Direct",
        bvnNumber: maskedBvn,
        numberOfDocuments: docCount,
        pickupLocation: pickup?.pickupLocation || null,
      },
      raw: trx,
    };
  }

  async requestInformation(transactionId: string, adminId: string, payload: { notes?: string; fields?: string[] }) {
    await this.logAdminAction({
      adminId,
      actionType: "COMPLIANCE_REVIEW",
      resourceType: "TRANSACTION",
      resourceId: transactionId,
      metadata: payload,
    });

    await prisma.transaction.update({
      where: { id: transactionId },
      data: { status: TransactionStatus.COMPLIANCE_REVIEW } as any,
    });

    await prisma.transactionDocument.updateMany({
      where: { transactionId },
      data: { verificationStatus: VerificationStatus.REQUIRES_MANUAL_REVIEW } as any,
    });

    return { message: "Request for information recorded" };
  }

  async reviewTransaction(transactionId: string, adminId: string, payload: ReviewPayload) {
    await this.logAdminAction({
      adminId,
      actionType: "TRANSACTION_REVIEW",
      resourceType: "TRANSACTION",
      resourceId: transactionId,
      metadata: payload,
    });

    const updated = await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        currentStep: TransactionStep.ADMIN_REVIEW as any,
        status: TransactionStatus.ADMIN_APPROVAL_PENDING as any,
        updatedAt: new Date(),
      },
    });

    await prisma.transactionStepLog.create({
      data: {
        transactionId,
        step: TransactionStep.ADMIN_REVIEW as any,
        status: "COMPLETED",
        data: { reviewedBy: adminId, ...payload },
        completedAt: new Date(),
      },
    });

    await prisma.transactionHistory.create({
      data: {
        transactionId,
        action: "ADMIN_REVIEW_COMPLETED",
        performedBy: adminId,
        notes: payload?.notes,
        metadata: { riskLevel: payload?.riskLevel, amlDecision: payload?.amlDecision },
      } as any,
    });

    return { message: "Transaction reviewed successfully" };
  }

  async approveTransaction(transactionId: string, adminId: string, reason?: string) {
    await this.logAdminAction({
      adminId,
      actionType: "TRANSACTION_APPROVE",
      resourceType: "TRANSACTION",
      resourceId: transactionId,
      reason,
    });

    await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: TransactionStatus.APPROVED as any,
        currentStep: TransactionStep.ADMIN_REVIEW as any,
        updatedAt: new Date(),
      },
    });

    // Mark all pending documents as verified
    await prisma.transactionDocument.updateMany({
      where: {
        transactionId,
        verificationStatus: VerificationStatus.PENDING as any,
      },
      data: {
        verificationStatus: VerificationStatus.VERIFIED as any,
        verifiedAt: new Date(),
        verifiedBy: adminId,
      } as any,
    });

    await prisma.transactionHistory.create({
      data: {
        transactionId,
        action: "TRANSACTION_APPROVED",
        performedBy: adminId,
        notes: reason,
      },
    });

    return { message: "Transaction approved successfully" };
  }

  async rejectTransaction(transactionId: string, adminId: string, reason: string) {
    await this.logAdminAction({
      adminId,
      actionType: "TRANSACTION_REJECT",
      resourceType: "TRANSACTION",
      resourceId: transactionId,
      reason,
    });

    const updated = await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: TransactionStatus.REJECTED as any,
        currentStep: TransactionStep.ADMIN_REVIEW as any,
        rejectionReason: reason,
        rejectedAt: new Date(),
        updatedAt: new Date(),
      },
    } as any);

    await prisma.transactionHistory.create({
      data: {
        transactionId,
        action: "TRANSACTION_REJECTED",
        performedBy: adminId,
        notes: reason,
      },
    });

    return { message: "Transaction rejected successfully" };
  }

  async settleTransaction(transactionId: string, adminId: string, payload: SettlePayload) {
    await this.logAdminAction({
      adminId,
      actionType: "TRANSACTION_SETTLE",
      resourceType: "TRANSACTION",
      resourceId: transactionId,
      metadata: payload,
    });

    const updated = await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        currentStep: TransactionStep.DISBURSEMENT as any,
        status: TransactionStatus.DISBURSEMENT_IN_PROGRESS as any,
        disbursementMethod: payload.disbursementMethod as any,
        updatedAt: new Date(),
      },
    });

    await prisma.transactionStepLog.create({
      data: {
        transactionId,
        step: TransactionStep.DISBURSEMENT as any,
        status: "COMPLETED",
        data: {
          settlementReference: payload.settlementReference,
          settledBy: adminId,
          settledAt: new Date().toISOString(),
        },
        completedAt: new Date(),
      },
    });

    await prisma.transactionHistory.create({
      data: {
        transactionId,
        action: "TRANSACTION_SETTLED",
        performedBy: adminId,
        notes: payload.settlementReference,
      },
    });

    return { message: "Transaction settled successfully" };
  }
}

export const adminTransactionsService = new AdminTransactionsService();
