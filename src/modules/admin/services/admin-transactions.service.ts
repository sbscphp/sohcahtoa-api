import { getDatabase } from "../../../config/database";
const prisma = getDatabase();
import axios from "axios";
import { createLogger } from "../../../shared/utils";
import { ServiceName, TransactionStep } from "../../../shared/types";

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
  private transactionServiceUrl = process.env.TRANSACTION_SERVICE_URL || "http://localhost:3003";

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

  async reviewTransaction(transactionId: string, adminId: string, payload: ReviewPayload) {
    await this.logAdminAction({
      adminId,
      actionType: "TRANSACTION_REVIEW",
      resourceType: "TRANSACTION",
      resourceId: transactionId,
      metadata: payload,
    });

    await axios.put(`${this.transactionServiceUrl}/api/transactions/${transactionId}`, {
      step: TransactionStep.ADMIN_REVIEW,
      data: { reviewedBy: adminId, ...payload },
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

    await axios.put(`${this.transactionServiceUrl}/api/transactions/${transactionId}`, {
      step: TransactionStep.ADMIN_REVIEW,
      data: { approved: true, approvedBy: adminId, reason },
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

    await axios.put(`${this.transactionServiceUrl}/api/transactions/${transactionId}`, {
      step: TransactionStep.ADMIN_REVIEW,
      data: { approved: false, rejectedBy: adminId, rejectionReason: reason },
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
  }
}

export const adminTransactionsService = new AdminTransactionsService();
