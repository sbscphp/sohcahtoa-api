import prisma from "../config/database";
import axios from "axios";
import { createLogger, ForbiddenError, NotFoundError } from "@fx-platform/shared-utils";
import { ServiceName, TransactionStep } from "@fx-platform/shared-types";

const logger = createLogger(ServiceName.ADMIN);

type ReviewPayload = {
  notes?: string;
  riskLevel?: "LOW" | "MEDIUM" | "HIGH";
  amlDecision?: "PASS" | "FAIL" | "ESCALATE";
};

type SettlePayload = {
  disbursementMethod: string; // ideally DisbursementMethod enum from shared-types
  settlementReference: string;
};

export class AdminService {
  private transactionServiceUrl = process.env.TRANSACTION_SERVICE_URL || "http://localhost:3003";
  private paymentServiceUrl = process.env.PAYMENT_SERVICE_URL || "http://localhost:3004";

  private async logAdminAction(params: {
    adminId: string;
    actionType: any;  // ActionType enum from Prisma
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

  async getDashboard() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let dashboard = await prisma.dashboard.findFirst({
      where: { date: { gte: today } },
    });

    if (!dashboard) {
      dashboard = await prisma.dashboard.create({
        data: {
          date: today,
          totalVolume: 0,
        }
      });
    }

    return {
      totalTransactions: dashboard.totalTransactions,
      pendingApprovals: dashboard.pendingApprovals,
      completedTransactions: dashboard.completedTransactions,
      rejectedTransactions: dashboard.rejectedTransactions,
      totalVolume: Number(dashboard.totalVolume),
      amlFlags: dashboard.amlFlags,
      pendingReviews: dashboard.pendingReviews,
    };
  }

  /**
   * REVIEW (Requirement)
   * Calls transaction-service updateTransaction with ADMIN_REVIEW step.
   */
  async reviewTransaction(transactionId: string, adminId: string, payload: ReviewPayload) {
    await this.logAdminAction({
      adminId,
      actionType: "TRANSACTION_REVIEW",
      resourceType: "TRANSACTION",
      resourceId: transactionId,
      metadata: payload,
    });

    try {
      await axios.put(`${this.transactionServiceUrl}/api/transactions/${transactionId}`, {
        step: TransactionStep.ADMIN_REVIEW,
        data: { reviewedBy: adminId, ...payload },
      });

      return { message: "Transaction reviewed successfully" };
    } catch (error) {
      logger.error("Failed to review transaction:", error);
      throw error;
    }
  }

  /**
   * APPROVE (Requirement)
   * Calls transaction-service updateTransaction with ADMIN_REVIEW step.
   */
  async approveTransaction(transactionId: string, adminId: string, reason?: string) {
    await this.logAdminAction({
      adminId,
      actionType: "TRANSACTION_APPROVE",
      resourceType: "TRANSACTION",
      resourceId: transactionId,
      reason,
    });

    try {
      await axios.put(`${this.transactionServiceUrl}/api/transactions/${transactionId}`, {
        step: TransactionStep.ADMIN_REVIEW,
        data: { approved: true, approvedBy: adminId, reason },
      });

      return { message: "Transaction approved successfully" };
    } catch (error) {
      logger.error("Failed to approve transaction:", error);
      throw error;
    }
  }

  /**
   * REJECT (Requirement)
   * Calls transaction-service updateTransaction with ADMIN_REVIEW step.
   */
  async rejectTransaction(transactionId: string, adminId: string, reason: string) {
    await this.logAdminAction({
      adminId,
      actionType: "TRANSACTION_REJECT",
      resourceType: "TRANSACTION",
      resourceId: transactionId,
      reason,
    });

    try {
      await axios.put(`${this.transactionServiceUrl}/api/transactions/${transactionId}`, {
        step: TransactionStep.ADMIN_REVIEW,
        data: { approved: false, rejectedBy: adminId, rejectionReason: reason },
      });

      return { message: "Transaction rejected successfully" };
    } catch (error) {
      logger.error("Failed to reject transaction:", error);
      throw error;
    }
  }

  /**
   * SETTLE (Requirement)
   * In your enums, settle maps to DISBURSEMENT.
   * NOTE: your transaction-service currently only handles DISBURSEMENT by setting disbursementMethod.
   * You'll likely want transaction-service to also update status to DISBURSEMENT_IN_PROGRESS/COMPLETED
   * when this step is hit.
   */
  async settleTransaction(transactionId: string, adminId: string, payload: SettlePayload) {
    await this.logAdminAction({
      adminId,
      actionType: "TRANSACTION_SETTLE",
      resourceType: "TRANSACTION",
      resourceId: transactionId,
      metadata: payload,
    });

    try {
      await axios.put(`${this.transactionServiceUrl}/api/transactions/${transactionId}`, {
        step: TransactionStep.DISBURSEMENT,
        data: {
          disbursementMethod: payload.disbursementMethod,
          settlementReference: payload.settlementReference,
          settledBy: adminId,
          settledAt: new Date().toISOString(),
        },
      });

      return { message: "Transaction settled successfully" };
    } catch (error) {
      logger.error("Failed to settle transaction:", error);
      throw error;
    }
  }

  async confirmDeposit(transactionId: string, adminId: string, paymentReference: string, proofOfPayment?: string) {
    await this.logAdminAction({
      adminId,
      actionType: "DEPOSIT_CONFIRM",
      resourceType: "TRANSACTION",
      resourceId: transactionId,
      metadata: { paymentReference, proofOfPayment },
    });

    try {
      await axios.post(`${this.paymentServiceUrl}/api/payments/deposit/confirm`, {
        transactionId,
        paymentReference,
        proofOfPayment,
      });

      // optionally: also tell transaction-service to move to DEPOSIT_CONFIRMATION step if needed
      // await axios.put(`${this.transactionServiceUrl}/api/transactions/${transactionId}`, {
      //   step: TransactionStep.DEPOSIT_CONFIRMATION,
      //   data: { confirmedBy: adminId, paymentReference },
      // });

      return { message: "Deposit confirmed successfully" };
    } catch (error) {
      logger.error("Failed to confirm deposit:", error);
      throw error;
    }
  }

  async getPendingApprovals(adminId: string, page = 1, limit = 20) {
    await this.logAdminAction({
      adminId,
      actionType: "PENDING_APPROVALS_VIEW",
      resourceType: "QUEUE",
      resourceId: "PENDING_APPROVALS",
      metadata: { page, limit },
    });

    try {
      const response = await axios.get(
        `${this.transactionServiceUrl}/api/transactions/admin/pending?page=${page}&limit=${limit}`
      );
      return response.data;
    } catch (error) {
      logger.error("Failed to fetch pending approvals:", error);
      throw error;
    }
  }

  async getAdminActions(adminId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const [actions, total] = await Promise.all([
      prisma.adminAction.findMany({
        where: { adminId },
        skip,
        take: limit,
        orderBy: { performedAt: "desc" },
      }),
      prisma.adminAction.count({ where: { adminId } }),
    ]);

    return {
      data: actions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getAuditLog(filters: any, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters.actionType) where.actionType = filters.actionType;
    if (filters.resourceType) where.resourceType = filters.resourceType;

    if (filters.startDate || filters.endDate) {
      where.performedAt = {};
      if (filters.startDate) where.performedAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.performedAt.lte = new Date(filters.endDate);
    }

    const [actions, total] = await Promise.all([
      prisma.adminAction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { performedAt: "desc" },
        include: {
          admin: {
            select: { email: true, role: true },
          },
        },
      }),
      prisma.adminAction.count({ where }),
    ]);

    return {
      data: actions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export default new AdminService();
