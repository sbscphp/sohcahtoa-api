import prisma from '../config/database';
import { publishEvent } from '../config/kafka';
import axios from 'axios';
import {
  generateId,
  NotFoundError,
  ForbiddenError,
  createLogger,
  ServiceName,
} from '@fx-platform/shared-utils';
import { EventType } from '@fx-platform/shared-types';

const logger = createLogger(ServiceName.ADMIN);

export class AdminService {
  async approveTransaction(transactionId: string, adminId: string, reason?: string) {
    // Log admin action
    await prisma.adminAction.create({
      data: {
        adminId,
        actionType: 'TRANSACTION_APPROVE',
        resourceType: 'TRANSACTION',
        resourceId: transactionId,
        reason,
      },
    });

    // Call transaction service to update status
    const transactionServiceUrl = process.env.TRANSACTION_SERVICE_URL || 'http://localhost:3003';

    try {
      await axios.put(`${transactionServiceUrl}/api/transactions/${transactionId}`, {
        step: 'ADMIN_REVIEW',
        data: { approved: true, approvedBy: adminId },
      });

      // Publish event
      await publishEvent({
        eventId: generateId(),
        eventType: EventType.ADMIN_APPROVED,
        source: ServiceName.ADMIN,
        timestamp: new Date().toISOString(),
        data: {
          transactionId,
          approvedBy: adminId,
          reason,
        },
      });

      return { message: 'Transaction approved successfully' };
    } catch (error) {
      logger.error('Failed to approve transaction:', error);
      throw error;
    }
  }

  async rejectTransaction(transactionId: string, adminId: string, reason: string) {
    await prisma.adminAction.create({
      data: {
        adminId,
        actionType: 'TRANSACTION_REJECT',
        resourceType: 'TRANSACTION',
        resourceId: transactionId,
        reason,
      },
    });

    const transactionServiceUrl = process.env.TRANSACTION_SERVICE_URL || 'http://localhost:3003';

    try {
      await axios.put(`${transactionServiceUrl}/api/transactions/${transactionId}`, {
        step: 'ADMIN_REVIEW',
        data: { approved: false, rejectedBy: adminId, rejectionReason: reason },
      });

      await publishEvent({
        eventId: generateId(),
        eventType: EventType.ADMIN_REJECTED,
        source: ServiceName.ADMIN,
        timestamp: new Date().toISOString(),
        data: {
          transactionId,
          rejectedBy: adminId,
          reason,
        },
      });

      return { message: 'Transaction rejected successfully' };
    } catch (error) {
      logger.error('Failed to reject transaction:', error);
      throw error;
    }
  }

  async confirmDeposit(transactionId: string, adminId: string, paymentReference: string, proofOfPayment?: string) {
    await prisma.adminAction.create({
      data: {
        adminId,
        actionType: 'DEPOSIT_CONFIRM',
        resourceType: 'TRANSACTION',
        resourceId: transactionId,
        metadata: { paymentReference, proofOfPayment },
      },
    });

    const paymentServiceUrl = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3004';

    try {
      await axios.post(`${paymentServiceUrl}/api/payments/deposit/confirm`, {
        transactionId,
        paymentReference,
        proofOfPayment,
      });

      return { message: 'Deposit confirmed successfully' };
    } catch (error) {
      logger.error('Failed to confirm deposit:', error);
      throw error;
    }
  }

  async getDashboard() {
    // This would aggregate data from various services
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let dashboard = await prisma.dashboard.findFirst({
      where: {
        date: { gte: today },
      },
    });

    if (!dashboard) {
      // Create new dashboard entry
      dashboard = await prisma.dashboard.create({
        data: {
          date: today,
        },
      });
    }

    // In production, fetch real-time data from services
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

  async getPendingApprovals(adminId: string, page: number = 1, limit: number = 20) {
    // Fetch from transaction service
    const transactionServiceUrl = process.env.TRANSACTION_SERVICE_URL || 'http://localhost:3003';

    try {
      const response = await axios.get(
        `${transactionServiceUrl}/api/transactions/admin/pending?page=${page}&limit=${limit}`
      );

      return response.data;
    } catch (error) {
      logger.error('Failed to fetch pending approvals:', error);
      throw error;
    }
  }

  async assignTask(taskType: string, taskId: string, adminId: string, priority: number = 1) {
    const assignment = await prisma.taskAssignment.create({
      data: {
        adminId,
        taskType,
        taskId,
        priority,
        status: 'PENDING',
      },
    });

    return assignment;
  }

  async completeTask(assignmentId: string, adminId: string, notes?: string) {
    const assignment = await prisma.taskAssignment.findUnique({
      where: { id: assignmentId },
    });

    if (!assignment) {
      throw new NotFoundError('Task assignment not found');
    }

    if (assignment.adminId !== adminId) {
      throw new ForbiddenError('You are not assigned to this task');
    }

    const updated = await prisma.taskAssignment.update({
      where: { id: assignmentId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        notes,
      },
    });

    return updated;
  }

  async getAdminActions(adminId: string, page: number = 1, limit: number = 50) {
    const skip = (page - 1) * limit;

    const [actions, total] = await Promise.all([
      prisma.adminAction.findMany({
        where: { adminId },
        skip,
        take: limit,
        orderBy: { performedAt: 'desc' },
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

  async getAuditLog(filters: any, page: number = 1, limit: number = 50) {
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters.actionType) {
      where.actionType = filters.actionType;
    }

    if (filters.resourceType) {
      where.resourceType = filters.resourceType;
    }

    if (filters.startDate || filters.endDate) {
      where.performedAt = {};
      if (filters.startDate) {
        where.performedAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.performedAt.lte = new Date(filters.endDate);
      }
    }

    const [actions, total] = await Promise.all([
      prisma.adminAction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { performedAt: 'desc' },
        include: {
          admin: {
            select: {
              email: true,
              role: true,
            },
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
