import { getDatabase } from "../../../config/database";
const prisma = getDatabase();
import { createLogger, ForbiddenError, NotFoundError, ValidationError } from "../../../shared/utils";
import { ServiceName, TransactionStep, TransactionStatus } from "../../../shared/types";
import { hashPassword } from "../../../shared/utils/password";
import { auditTrailService } from "../services/audit-trail.service";
import { workflowService } from "./workflow.service";

const logger = createLogger(ServiceName.ADMIN);
export class AdminService {

  async getDashboard(month?: number, year?: number, txnType?: string, range?: string) {
    const now = new Date();
    const monthsShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    if (txnType) {
      const allTypes = [
        "PTA",
        "BTA",
        "SCHOOL_FEES",
        "MEDICAL",
        "PROFESSIONAL_BODY",
        "TOURIST_FX",
        "RESIDENT_FX",
        "EXPATRIATE_FX",
        "IMTO_REMITTANCE",
        "CASH_REMITTANCE",
      ];
      if (!allTypes.includes(txnType.toUpperCase())) {
        throw new ValidationError(`Invalid transaction type: ${txnType}`);
      }
    }

    let start: Date;
    let end: Date = now;
    let windowDays = 365;

    if (range) {
      const normalizedRange = range.toLowerCase().trim();
      start = new Date(now);
      if (normalizedRange === "last_7_days" || normalizedRange === "7d") {
        start.setDate(now.getDate() - 7);
        windowDays = 7;
      } else if (normalizedRange === "last_30_days" || normalizedRange === "30d") {
        start.setDate(now.getDate() - 30);
        windowDays = 30;
      } else if (normalizedRange === "last_90_days" || normalizedRange === "90d") {
        start.setDate(now.getDate() - 90);
        windowDays = 90;
      } else if (normalizedRange === "last_6_months" || normalizedRange === "6m") {
        start.setMonth(now.getMonth() - 6);
        windowDays = 180;
      } else if (normalizedRange === "last_12_months" || normalizedRange === "12m") {
        start.setMonth(now.getMonth() - 12);
        windowDays = 365;
      } else {
        throw new ValidationError(`Invalid range preset: ${range}`);
      }
    } else {
      const filterYear = year !== undefined ? year : now.getFullYear();
      if (month !== undefined) {
        // Calendar month is 1-indexed (Jan = 1, Dec = 12)
        start = new Date(filterYear, month - 1, 1, 0, 0, 0, 0);
        end = new Date(filterYear, month, 0, 23, 59, 59, 999);
        windowDays = new Date(filterYear, month, 0).getDate();
      } else {
        // Full year
        start = new Date(filterYear, 0, 1, 0, 0, 0, 0);
        end = new Date(filterYear, 11, 31, 23, 59, 59, 999);
        windowDays = 365;
      }
    }

    const txWhere: any = { createdAt: { gte: start, lte: end } };
    if (txnType) {
      txWhere.type = txnType.toUpperCase();
    }

    // Find settlements matching transactions of the selected type if filtered
    let settlementWhere: any = { status: "CONFIRMED" as any, confirmedAt: { gte: start, lte: end } };
    if (txnType) {
      const txs = await prisma.transaction.findMany({
        where: { type: txnType.toUpperCase() as any, createdAt: { gte: start, lte: end } },
        select: { id: true },
      });
      settlementWhere.transactionId = { in: txs.map((t) => t.id) };
    }

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
      pendingTasksResult,
    ] = await Promise.all([
      prisma.transaction.count({ where: txWhere }),
      prisma.user.count({ where: { role: "CUSTOMER" as any, createdAt: { gte: start, lte: end } } }),
      prisma.adminUser.count({ where: { createdAt: { gte: start, lte: end } } }),
      prisma.settlement.aggregate({
        _sum: { amount: true },
        where: settlementWhere,
      }),
      prisma.transaction.findMany({
        where: txWhere,
        select: { createdAt: true, status: true },
      }),
      prisma.transaction.findMany({
        where: txWhere,
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          createdAt: true,
          status: true,
          referenceNumber: true,
          type: true,
          user: {
            select: {
              email: true,
              profile: {
                select: {
                  firstName: true,
                  lastName: true,
                }
              }
            }
          }
        },
      }),
      prisma.transaction.findMany({
        where: txWhere,
        select: { type: true, nairaEquivalent: true },
      }),
      prisma.transaction.count({
        where: { status: TransactionStatus.ADMIN_APPROVAL_PENDING as any, ...txWhere }
      }),
      prisma.amlFlag.count({
        where: {
          createdAt: { gte: start, lte: end },
          check: txnType ? { transactionType: txnType.toUpperCase() as any } : undefined,
        }
      }),
      prisma.transaction.count({
        where: { currentStep: TransactionStep.ADMIN_REVIEW as any, ...txWhere }
      }),
      workflowService.list({ status: "PENDING" }, 1, 5),
    ]);

    const settlementBalance = Number(settlementAgg._sum.amount || 0);

    let labels: string[] = [];
    let series: { completed: number[]; pending: number[]; rejected: number[] } = {
      completed: [],
      pending: [],
      rejected: [],
    };

    if (range) {
      const normalizedRange = range.toLowerCase().trim();
      if (normalizedRange === "last_7_days" || normalizedRange === "7d") {
        const daysCount = 7;
        labels = Array(daysCount).fill("");
        series = {
          completed: Array(daysCount).fill(0),
          pending: Array(daysCount).fill(0),
          rejected: Array(daysCount).fill(0),
        };
        const dateList: Date[] = [];
        for (let i = daysCount - 1; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(now.getDate() - i);
          dateList.push(d);
          labels[daysCount - 1 - i] = `${monthsShort[d.getMonth()]} ${d.getDate()}`;
        }
        for (const tx of yearTransactions) {
          const txDate = new Date(tx.createdAt);
          const slot = dateList.findIndex((d) => d.toDateString() === txDate.toDateString());
          if (slot !== -1) {
            if (tx.status === TransactionStatus.COMPLETED) {
              series.completed[slot] += 1;
            } else if (tx.status === TransactionStatus.REJECTED) {
              series.rejected[slot] += 1;
            } else {
              series.pending[slot] += 1;
            }
          }
        }
      } else if (normalizedRange === "last_30_days" || normalizedRange === "30d") {
        const daysCount = 30;
        labels = Array(daysCount).fill("");
        series = {
          completed: Array(daysCount).fill(0),
          pending: Array(daysCount).fill(0),
          rejected: Array(daysCount).fill(0),
        };
        const dateList: Date[] = [];
        for (let i = daysCount - 1; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(now.getDate() - i);
          dateList.push(d);
          labels[daysCount - 1 - i] = `${monthsShort[d.getMonth()]} ${d.getDate()}`;
        }
        for (const tx of yearTransactions) {
          const txDate = new Date(tx.createdAt);
          const slot = dateList.findIndex((d) => d.toDateString() === txDate.toDateString());
          if (slot !== -1) {
            if (tx.status === TransactionStatus.COMPLETED) {
              series.completed[slot] += 1;
            } else if (tx.status === TransactionStatus.REJECTED) {
              series.rejected[slot] += 1;
            } else {
              series.pending[slot] += 1;
            }
          }
        }
      } else if (normalizedRange === "last_90_days" || normalizedRange === "90d") {
        const daysCount = 90;
        labels = Array(daysCount).fill("");
        series = {
          completed: Array(daysCount).fill(0),
          pending: Array(daysCount).fill(0),
          rejected: Array(daysCount).fill(0),
        };
        const dateList: Date[] = [];
        for (let i = daysCount - 1; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(now.getDate() - i);
          dateList.push(d);
          labels[daysCount - 1 - i] = `${monthsShort[d.getMonth()]} ${d.getDate()}`;
        }
        for (const tx of yearTransactions) {
          const txDate = new Date(tx.createdAt);
          const slot = dateList.findIndex((d) => d.toDateString() === txDate.toDateString());
          if (slot !== -1) {
            if (tx.status === TransactionStatus.COMPLETED) {
              series.completed[slot] += 1;
            } else if (tx.status === TransactionStatus.REJECTED) {
              series.rejected[slot] += 1;
            } else {
              series.pending[slot] += 1;
            }
          }
        }
      } else if (
        normalizedRange === "last_6_months" ||
        normalizedRange === "6m" ||
        normalizedRange === "last_12_months" ||
        normalizedRange === "12m"
      ) {
        const monthsCount = normalizedRange.includes("6") ? 6 : 12;
        labels = Array(monthsCount).fill("");
        series = {
          completed: Array(monthsCount).fill(0),
          pending: Array(monthsCount).fill(0),
          rejected: Array(monthsCount).fill(0),
        };
        const monthSlots: { year: number; month: number }[] = [];
        for (let i = monthsCount - 1; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          monthSlots.push({ year: d.getFullYear(), month: d.getMonth() });
          labels[monthsCount - 1 - i] = `${monthsShort[d.getMonth()]} ${d.getFullYear().toString().substring(2)}`;
        }
        for (const tx of yearTransactions) {
          const txDate = new Date(tx.createdAt);
          const slot = monthSlots.findIndex(
            (m) => m.year === txDate.getFullYear() && m.month === txDate.getMonth()
          );
          if (slot !== -1) {
            if (tx.status === TransactionStatus.COMPLETED) {
              series.completed[slot] += 1;
            } else if (tx.status === TransactionStatus.REJECTED) {
              series.rejected[slot] += 1;
            } else {
              series.pending[slot] += 1;
            }
          }
        }
      }
    } else {
      const filterYear = year !== undefined ? year : now.getFullYear();
      if (month !== undefined) {
        const lastDay = new Date(filterYear, month, 0).getDate();
        labels = Array.from({ length: lastDay }, (_, i) => String(i + 1));
        series = {
          completed: Array(lastDay).fill(0),
          pending: Array(lastDay).fill(0),
          rejected: Array(lastDay).fill(0),
        };
        for (const tx of yearTransactions) {
          const d = new Date(tx.createdAt).getDate();
          if (tx.status === TransactionStatus.COMPLETED) {
            series.completed[d - 1] += 1;
          } else if (tx.status === TransactionStatus.REJECTED) {
            series.rejected[d - 1] += 1;
          } else {
            series.pending[d - 1] += 1;
          }
        }
      } else {
        labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        series = {
          completed: Array(12).fill(0),
          pending: Array(12).fill(0),
          rejected: Array(12).fill(0),
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
      }
    }

    const allTypes = [
      "PTA",
      "BTA",
      "SCHOOL_FEES",
      "MEDICAL",
      "PROFESSIONAL_BODY",
      "TOURIST_FX",
      "RESIDENT_FX",
      "EXPATRIATE_FX",
      "IMTO_REMITTANCE",
      "CASH_REMITTANCE",
    ];

    const typeTotals: Record<string, number> = {};
    for (const t of allTypes) {
      typeTotals[t] = 0;
    }

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
        year: range ? null : (year !== undefined ? year : now.getFullYear()),
        month: range ? null : (month || null),
        rangePreset: range || null,
        labels,
        series,
      },
      transactionsByType: {
        windowDays,
        totalAmount,
        items: transactionsByType,
      },
      recentTransactions: recentTransactions.map((t: any) => {
        const customerName = t.user?.profile
          ? `${t.user.profile.firstName} ${t.user.profile.lastName}`.trim()
          : t.user?.email || "Unknown Customer";
        return {
          id: t.id,
          referenceNumber: t.referenceNumber,
          createdAt: t.createdAt,
          status: t.status,
          type: t.type,
          customerName,
        };
      }),
      tasks: (pendingTasksResult?.data || []).map((t: any) => ({
        id: t.id,
        title: `${t.workflowAction}: ${t.title || t.id}`,
        status: t.status,
        priority: "MEDIUM",
        assignedAt: t.dateInitiated,
        taskId: t.id,
        module: t.module,
        workflowAction: t.workflowAction,
        actionNeeded: t.actionNeeded,
        dateInitiated: t.dateInitiated,
        escalationMinutes: t.escalationMinutes,
        entityTitle: t.title,
      })),
      notifications: [],
      pendingApprovals,
      amlFlags,
      pendingReviews,
    };
  }

  async confirmDeposit(transactionId: string, adminId: string, paymentReference: string, proofOfPayment?: string) {

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

  async getAdminActionsAll(adminId: string) {
    const actions = await prisma.adminAction.findMany({
      where: { adminId },
      orderBy: { performedAt: "desc" },
      select: {
        id: true,
        performedAt: true,
        actionLabel: true,
        actionType: true,
        resourceType: true,
        resourceId: true,
        status: true,
      },
    } as any);
    return actions;
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

  async seedAdminDefaults(params?: { email?: string; password?: string; name?: string }) {
    const adminEmail = params?.email || process.env.SEED_ADMIN_EMAIL || "sohcahtoa@yopmail.com";
    const adminPassword = params?.password || process.env.SEED_ADMIN_PASSWORD || "password@1234";
    const fullName = params?.name || process.env.SEED_ADMIN_NAME || "Local Super Admin";
    const branchName = "Head Office";
    const departmentName = "Administration";

    const department =
      (await prisma.department.findFirst({ where: { name: departmentName } })) ||
      (await prisma.department.create({
        data: {
          name: departmentName,
          description: "Default administration department",
          branch: branchName,
          isDefault: true,
          isActive: true,
        },
      }));

    let defaultRole = await prisma.role.findFirst({ where: { isDefault: true } });
    if (!defaultRole) {
      defaultRole = await prisma.role.create({
        data: {
          name: "SUPER_ADMIN",
          description: "Default super admin role",
          permissions: [],
          isDefault: true,
          isActive: true,
          branch: branchName,
          departmentId: department.id,
        },
      });
    }

    const existing = await prisma.adminUser.findUnique({ where: { email: adminEmail } });
    if (!existing) {
      const passwordHash = await hashPassword(adminPassword);
      const admin = await prisma.adminUser.create({
        data: {
          email: adminEmail,
          fullName,
          phoneNumber: "08000000000",
          branch: branchName,
          departmentId: department.id,
          roleId: defaultRole.id,
          password: passwordHash,
          isActive: true,
        },
      });
      return { created: true, admin: { id: admin.id, email: admin.email, fullName: admin.fullName }, role: { id: defaultRole.id, name: defaultRole.name }, department: { id: department.id, name: department.name } };
    } else {
      return { created: false, admin: { id: existing.id, email: existing.email, fullName: existing.fullName }, role: { id: defaultRole.id, name: defaultRole.name }, department: { id: department.id, name: department.name } };
    }
  }
}

export default new AdminService();
