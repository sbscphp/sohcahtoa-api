import { getDatabase } from "../../../config/database";
const prisma = getDatabase();
import { createLogger, ForbiddenError, NotFoundError } from "../../../shared/utils";
import { ServiceName, TransactionStep, TransactionStatus } from "../../../shared/types";

const logger = createLogger(ServiceName.ADMIN);
export class AdminService {

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
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalTransactions,
      totalCustomers,
      totalUsers,
      settlementAgg,
      yearTransactions,
      recentTransactions,
      typeWindowTransactions,
      pendingApprovals,
      amlFlags,
      pendingReviews,
      tasks,
    ] = await Promise.all([
      prisma.transaction.count(),
      prisma.user.count({ where: { role: "CUSTOMER" as any } }),
      prisma.adminUser.count(),
      prisma.settlement.aggregate({
        _sum: { amount: true },
        where: { status: "CONFIRMED" as any },
      }),
      prisma.transaction.findMany({
        where: { createdAt: { gte: startOfYear, lte: endOfYear } },
        select: { createdAt: true, status: true },
      }),
      prisma.transaction.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, createdAt: true, status: true, referenceNumber: true },
      }),
      prisma.transaction.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        select: { type: true, nairaEquivalent: true },
      }),
      prisma.transaction.count({ where: { status: TransactionStatus.ADMIN_APPROVAL_PENDING as any } }),
      prisma.amlFlag.count(),
      prisma.transaction.count({ where: { currentStep: TransactionStep.ADMIN_REVIEW as any } }),
      prisma.taskAssignment.findMany({
        orderBy: { assignedAt: "desc" },
        take: 5,
        select: { id: true, taskType: true, status: true, priority: true, assignedAt: true, taskId: true },
      }),
    ]);

    const settlementBalance = Number(settlementAgg._sum.amount || 0);

    const months = Array.from({ length: 12 }, (_, i) => i);
    const series = {
      completed: months.map(() => 0),
      pending: months.map(() => 0),
      rejected: months.map(() => 0),
    };
    for (const tx of yearTransactions) {
      const m = new Date(tx.createdAt).getMonth();
      if (tx.status === TransactionStatus.COMPLETED) {
        series.completed[m] += 1;
      } else if (tx.status === TransactionStatus.REJECTED) {
        series.rejected[m] += 1;
      } else {
        series.pending[m] += 1;
      }
    }

    const typeTotals: Record<string, number> = {};
    let totalAmount = 0;
    for (const tx of typeWindowTransactions) {
      const type = (tx.type as any) || "UNKNOWN";
      const amt = Number(tx.nairaEquivalent || 0);
      typeTotals[type] = (typeTotals[type] || 0) + amt;
      totalAmount += amt;
    }
    const transactionsByType = Object.entries(typeTotals).map(([type, amount]) => ({ type, amount }));

    return {
      counters: {
        settlementBalance,
        totalTransactions,
        totalCustomers,
        totalUsers,
      },
      transactionSummary: {
        year: now.getFullYear(),
        labels: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
        series,
      },
      transactionsByType: {
        windowDays: 7,
        totalAmount,
        items: transactionsByType,
      },
      recentTransactions: recentTransactions.map((t) => ({
        id: t.id,
        referenceNumber: t.referenceNumber,
        createdAt: t.createdAt,
        status: t.status,
      })),
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.taskType,
        status: t.status,
        priority: t.priority,
        assignedAt: t.assignedAt,
        taskId: t.taskId,
      })),
      notifications: [],
      pendingApprovals,
      amlFlags,
      pendingReviews,
    };
  }

  async confirmDeposit(transactionId: string, adminId: string, paymentReference: string, proofOfPayment?: string) {
    await this.logAdminAction({
      adminId,
      actionType: "DEPOSIT_CONFIRM",
      resourceType: "TRANSACTION",
      resourceId: transactionId,
      metadata: { paymentReference, proofOfPayment },
    });

    const settlement = await prisma.settlement.upsert({
      where: { transactionId },
      update: {
        status: "CONFIRMED",
        paymentReference,
        proofOfPayment,
        confirmedAt: new Date(),
        confirmedBy: adminId,
      },
      create: {
        transactionId,
        amount: 0 as any,
        currency: "NGN",
        status: "CONFIRMED",
        paymentMethod: "BANK_TRANSFER",
        paymentReference,
        proofOfPayment,
        confirmedAt: new Date(),
        confirmedBy: adminId,
      },
    });

    await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        currentStep: TransactionStep.DEPOSIT_CONFIRMATION as any,
        status: TransactionStatus.DEPOSIT_CONFIRMED as any,
        updatedAt: new Date(),
      },
    });

    await prisma.transactionStepLog.create({
      data: {
        transactionId,
        step: TransactionStep.DEPOSIT_CONFIRMATION as any,
        status: "COMPLETED",
        data: { confirmedBy: adminId, paymentReference },
        completedAt: new Date(),
      },
    });

    await prisma.transactionHistory.create({
      data: {
        transactionId,
        action: "DEPOSIT_CONFIRMED",
        performedBy: adminId,
        notes: paymentReference,
      },
    });

    return { message: "Deposit confirmed successfully" };
  }

  async getPendingApprovals(adminId: string, page = 1, limit = 20) {
    await this.logAdminAction({
      adminId,
      actionType: "PENDING_APPROVALS_VIEW",
      resourceType: "QUEUE",
      resourceId: "PENDING_APPROVALS",
      metadata: { page, limit },
    });

    const skip = (page - 1) * limit;
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { status: TransactionStatus.ADMIN_APPROVAL_PENDING as any },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.transaction.count({ where: { status: TransactionStatus.ADMIN_APPROVAL_PENDING as any } }),
    ]);

    return {
      data: transactions,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
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
