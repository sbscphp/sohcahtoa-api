import { PrismaClient, SettlementDirection, SettlementStatus } from '@prisma/client';
import { createLogger } from '../../../shared/utils/logger';
import { AppError } from '../../../shared/utils/errors';
import { ErrorCode } from '../../../shared/types/common';
import providusService from './providus.service';
import notificationService from '../../notifications/services/notification.service';
import { NotificationType, NotificationChannel } from '@prisma/client';
import { eventBus, EventTypes } from '../../../events/event-bus';

const prisma = new PrismaClient();
const logger = createLogger('SettlementService');

interface CreateSettlementOptions {
  transactionId?: string;
  amount: number;
  currency: string;
  beneficiaryName: string;
  beneficiaryBank?: string;
  beneficiaryAccount?: string;
  beneficiarySwift?: string;
  beneficiaryIban?: string;
  beneficiaryCountry?: string;
  beneficiaryAddress?: string;
  paymentMethod: string;
  initiatedBy: string;
  notes?: string;
  metadata?: any;
}

interface CreateBatchOptions {
  direction: SettlementDirection;
  settlementIds: string[];
  description?: string;
  createdBy: string;
}

export class SettlementService {
  /**
   * Create an outbound settlement (payout)
   */
  async createOutboundSettlement(options: CreateSettlementOptions) {
    try {
      logger.info('Creating outbound settlement', {
        amount: options.amount,
        beneficiary: options.beneficiaryName,
        method: options.paymentMethod,
      });

      // Generate unique reference number
      const referenceNumber = this.generateReferenceNumber();

      const settlement = await prisma.outboundSettlement.create({
        data: {
          referenceNumber,
          amount: options.amount,
          currency: options.currency,
          status: SettlementStatus.PENDING,
          beneficiaryName: options.beneficiaryName,
          beneficiaryBank: options.beneficiaryBank,
          beneficiaryAccount: options.beneficiaryAccount,
          beneficiarySwift: options.beneficiarySwift,
          beneficiaryIban: options.beneficiaryIban,
          beneficiaryCountry: options.beneficiaryCountry,
          beneficiaryAddress: options.beneficiaryAddress,
          paymentMethod: options.paymentMethod,
          initiatedBy: options.initiatedBy,
          transactionId: options.transactionId,
          notes: options.notes,
          metadata: options.metadata,
        },
      });

      logger.info('Outbound settlement created', {
        id: settlement.id,
        referenceNumber: settlement.referenceNumber,
      });

      return settlement;
    } catch (error) {
      logger.error('Error creating outbound settlement', error);
      throw new AppError(ErrorCode.INTERNAL_ERROR, 'Failed to create settlement', 500);
    }
  }

  /**
   * Create a settlement batch for bulk processing
   */
  async createSettlementBatch(options: CreateBatchOptions) {
    try {
      logger.info('Creating settlement batch', {
        direction: options.direction,
        count: options.settlementIds.length,
      });

      // Fetch settlements to calculate total
      const settlements = await prisma.outboundSettlement.findMany({
        where: {
          id: { in: options.settlementIds },
          status: SettlementStatus.PENDING,
        },
      });

      if (settlements.length !== options.settlementIds.length) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          'Some settlements are not pending or do not exist',
          400
        );
      }

      const totalAmount = settlements.reduce((sum, s) => sum + Number(s.amount), 0);
      const batchNumber = this.generateBatchNumber();

      const batch = await prisma.settlementBatch.create({
        data: {
          batchNumber,
          direction: options.direction,
          totalAmount,
          totalCount: settlements.length,
          currency: settlements[0].currency,
          status: SettlementStatus.PENDING,
          description: options.description,
          createdBy: options.createdBy,
        },
      });

      // Link settlements to batch
      await prisma.outboundSettlement.updateMany({
        where: { id: { in: options.settlementIds } },
        data: { batchId: batch.id },
      });

      logger.info('Settlement batch created', {
        id: batch.id,
        batchNumber: batch.batchNumber,
        totalAmount,
        count: settlements.length,
      });

      return batch;
    } catch (error) {
      logger.error('Error creating settlement batch', error);
      if (error instanceof AppError) throw error;
      throw new AppError(ErrorCode.INTERNAL_ERROR, 'Failed to create settlement batch', 500);
    }
  }

  /**
   * Approve a settlement for processing
   */
  async approveSettlement(settlementId: string, approvedBy: string) {
    try {
      logger.info('Approving settlement', { settlementId, approvedBy });

      const settlement = await prisma.outboundSettlement.findUnique({
        where: { id: settlementId },
      });

      if (!settlement) {
        throw new AppError(ErrorCode.NOT_FOUND, 'Settlement not found', 404);
      }

      if (settlement.status !== SettlementStatus.PENDING) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          `Settlement cannot be approved. Current status: ${settlement.status}`,
          400
        );
      }

      const updated = await prisma.outboundSettlement.update({
        where: { id: settlementId },
        data: {
          status: SettlementStatus.PROCESSING,
          approvedBy,
          approvedAt: new Date(),
        },
      });

      logger.info('Settlement approved', {
        id: updated.id,
        referenceNumber: updated.referenceNumber,
      });

      return updated;
    } catch (error) {
      logger.error('Error approving settlement', error);
      if (error instanceof AppError) throw error;
      throw new AppError(ErrorCode.INTERNAL_ERROR, 'Failed to approve settlement', 500);
    }
  }

  /**
   * Approve a settlement batch
   */
  async approveSettlementBatch(batchId: string, approvedBy: string) {
    try {
      logger.info('Approving settlement batch', { batchId, approvedBy });

      const batch = await prisma.settlementBatch.findUnique({
        where: { id: batchId },
        include: { settlements: true },
      });

      if (!batch) {
        throw new AppError(ErrorCode.NOT_FOUND, 'Settlement batch not found', 404);
      }

      if (batch.status !== SettlementStatus.PENDING) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          `Batch cannot be approved. Current status: ${batch.status}`,
          400
        );
      }

      // Update batch
      const updatedBatch = await prisma.settlementBatch.update({
        where: { id: batchId },
        data: {
          status: SettlementStatus.PROCESSING,
          approvedBy,
          approvedAt: new Date(),
        },
      });

      // Update all settlements in batch
      await prisma.outboundSettlement.updateMany({
        where: { batchId },
        data: {
          status: SettlementStatus.PROCESSING,
          approvedBy,
          approvedAt: new Date(),
        },
      });

      logger.info('Settlement batch approved', {
        id: updatedBatch.id,
        batchNumber: updatedBatch.batchNumber,
        count: batch.settlements.length,
      });

      return updatedBatch;
    } catch (error) {
      logger.error('Error approving settlement batch', error);
      if (error instanceof AppError) throw error;
      throw new AppError(ErrorCode.INTERNAL_ERROR, 'Failed to approve settlement batch', 500);
    }
  }

  /**
   * Process a settlement (submit to bank/payment provider)
   * This is where you would integrate with Providus or other payment providers
   */
  async processSettlement(settlementId: string, processedBy: string) {
    try {
      logger.info('Processing settlement', { settlementId, processedBy });

      const settlement = await prisma.outboundSettlement.findUnique({
        where: { id: settlementId },
      });

      if (!settlement) {
        throw new AppError(ErrorCode.NOT_FOUND, 'Settlement not found', 404);
      }

      if (settlement.status !== SettlementStatus.PROCESSING) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          `Settlement cannot be processed. Current status: ${settlement.status}`,
          400
        );
      }

      // Here you would integrate with Providus or other payment providers
      // For now, we'll simulate the process

      // TODO: Implement actual payment provider integration
      // Example: const result = await providusService.initiateTransfer({ ... });

      const updated = await prisma.outboundSettlement.update({
        where: { id: settlementId },
        data: {
          status: SettlementStatus.SUBMITTED,
          processedBy,
          processedAt: new Date(),
          paymentReference: `PAY-${Date.now()}`, // Would come from payment provider
        },
      });

      logger.info('Settlement processed and submitted', {
        id: updated.id,
        referenceNumber: updated.referenceNumber,
        paymentReference: updated.paymentReference,
      });

      // Publish event and notify customer
      if (settlement.transactionId) {
        const transaction = await prisma.transaction.findUnique({
          where: { id: settlement.transactionId },
        });

        if (transaction) {
          await notificationService.sendNotification({
            userId: transaction.userId,
            type: NotificationType.PUSH,
            channel: NotificationChannel.ALL,
            title: 'Payment Processed',
            body: `Your payment of ${settlement.currency} ${settlement.amount} has been processed.`,
            data: {
              transactionId: transaction.id,
              settlementId: settlement.id,
              amount: settlement.amount.toString(),
            },
          });

          // Publish DISBURSEMENT_INITIATED so the notification handler sends the email
          eventBus.publish(EventTypes.DISBURSEMENT_INITIATED, {
            userId: transaction.userId,
            transaction: {
              id: transaction.id,
              referenceNumber: transaction.referenceNumber,
              amount: settlement.amount,
              currency: settlement.currency,
            },
            settlement: {
              id: settlement.id,
              referenceNumber: settlement.referenceNumber,
            },
          });
        }
      }

      return updated;
    } catch (error) {
      logger.error('Error processing settlement', error);

      // Mark settlement as failed
      await prisma.outboundSettlement.update({
        where: { id: settlementId },
        data: {
          status: SettlementStatus.FAILED,
          failedAt: new Date(),
          failureReason: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      if (error instanceof AppError) throw error;
      throw new AppError(ErrorCode.INTERNAL_ERROR, 'Failed to process settlement', 500);
    }
  }

  /**
   * Process all settlements in a batch
   */
  async processSettlementBatch(batchId: string, processedBy: string) {
    try {
      logger.info('Processing settlement batch', { batchId, processedBy });

      const batch = await prisma.settlementBatch.findUnique({
        where: { id: batchId },
        include: { settlements: true },
      });

      if (!batch) {
        throw new AppError(ErrorCode.NOT_FOUND, 'Settlement batch not found', 404);
      }

      if (batch.status !== SettlementStatus.PROCESSING) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          `Batch cannot be processed. Current status: ${batch.status}`,
          400
        );
      }

      const results = {
        successful: 0,
        failed: 0,
        errors: [] as string[],
      };

      // Process each settlement
      for (const settlement of batch.settlements) {
        try {
          await this.processSettlement(settlement.id, processedBy);
          results.successful++;
        } catch (error) {
          results.failed++;
          results.errors.push(
            `Settlement ${settlement.referenceNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
          logger.error('Error processing settlement in batch', error);
        }
      }

      // Update batch status
      const newStatus =
        results.failed === 0
          ? SettlementStatus.SUBMITTED
          : results.successful === 0
            ? SettlementStatus.FAILED
            : SettlementStatus.PROCESSING;

      const updatedBatch = await prisma.settlementBatch.update({
        where: { id: batchId },
        data: {
          status: newStatus,
          processedBy,
          submittedAt: results.failed === 0 ? new Date() : null,
          metadata: {
            processResults: results,
          },
        },
      });

      logger.info('Settlement batch processed', {
        id: updatedBatch.id,
        batchNumber: updatedBatch.batchNumber,
        successful: results.successful,
        failed: results.failed,
      });

      return { batch: updatedBatch, results };
    } catch (error) {
      logger.error('Error processing settlement batch', error);
      if (error instanceof AppError) throw error;
      throw new AppError(ErrorCode.INTERNAL_ERROR, 'Failed to process settlement batch', 500);
    }
  }

  /**
   * Mark settlement as completed
   */
  async completeSettlement(settlementId: string, proof?: string) {
    try {
      logger.info('Completing settlement', { settlementId });

      const updated = await prisma.outboundSettlement.update({
        where: { id: settlementId },
        data: {
          status: SettlementStatus.COMPLETED,
          completedAt: new Date(),
          paymentProof: proof,
        },
      });

      logger.info('Settlement completed', {
        id: updated.id,
        referenceNumber: updated.referenceNumber,
      });

      // Update transaction status if linked and publish completion event
      if (updated.transactionId) {
        const transaction = await prisma.transaction.update({
          where: { id: updated.transactionId },
          data: { status: 'COMPLETED', completedAt: new Date() },
          select: { id: true, userId: true, referenceNumber: true, foreignAmount: true, currency: true },
        });

        // Triggers push notification + payment receipt email in the notification handler
        eventBus.publish(EventTypes.TRANSACTION_COMPLETED, {
          userId: transaction.userId,
          transaction: {
            id: transaction.id,
            referenceNumber: transaction.referenceNumber,
            foreignAmount: transaction.foreignAmount,
            currency: transaction.currency,
          },
        });

        // Also publish DISBURSEMENT_COMPLETED for auditing/reporting
        eventBus.publish(EventTypes.DISBURSEMENT_COMPLETED, {
          userId: transaction.userId,
          transaction: {
            id: transaction.id,
            referenceNumber: transaction.referenceNumber,
          },
          settlement: {
            id: updated.id,
            referenceNumber: updated.referenceNumber,
            amount: updated.amount,
            currency: updated.currency,
          },
        });
      }

      return updated;
    } catch (error) {
      logger.error('Error completing settlement', error);
      throw new AppError(ErrorCode.INTERNAL_ERROR, 'Failed to complete settlement', 500);
    }
  }

  /**
   * Get settlement by ID
   */
  async getSettlement(settlementId: string) {
    const settlement = await prisma.outboundSettlement.findUnique({
      where: { id: settlementId },
      include: {
        batch: true,
      },
    });

    if (!settlement) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Settlement not found', 404);
    }

    return settlement;
  }

  /**
   * Get settlement batch by ID
   */
  async getSettlementBatch(batchId: string) {
    const batch = await prisma.settlementBatch.findUnique({
      where: { id: batchId },
      include: {
        settlements: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!batch) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Settlement batch not found', 404);
    }

    return batch;
  }

  /**
   * List settlements with filters
   */
  async listSettlements(filters: {
    status?: SettlementStatus;
    batchId?: string;
    transactionId?: string;
    limit?: number;
    offset?: number;
  }) {
    const { status, batchId, transactionId, limit = 20, offset = 0 } = filters;

    const settlements = await prisma.outboundSettlement.findMany({
      where: {
        ...(status && { status }),
        ...(batchId && { batchId }),
        ...(transactionId && { transactionId }),
      },
      include: {
        batch: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await prisma.outboundSettlement.count({
      where: {
        ...(status && { status }),
        ...(batchId && { batchId }),
        ...(transactionId && { transactionId }),
      },
    });

    return { settlements, total, limit, offset };
  }

  /**
   * List settlement batches
   */
  async listSettlementBatches(filters: {
    status?: SettlementStatus;
    direction?: SettlementDirection;
    limit?: number;
    offset?: number;
  }) {
    const { status, direction, limit = 20, offset = 0 } = filters;

    const batches = await prisma.settlementBatch.findMany({
      where: {
        ...(status && { status }),
        ...(direction && { direction }),
      },
      include: {
        settlements: {
          select: {
            id: true,
            referenceNumber: true,
            status: true,
            amount: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await prisma.settlementBatch.count({
      where: {
        ...(status && { status }),
        ...(direction && { direction }),
      },
    });

    return { batches, total, limit, offset };
  }

  /**
   * Generate unique reference number
   */
  private generateReferenceNumber(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');
    return `STL-${timestamp}-${random}`;
  }

  /**
   * Generate unique batch number
   */
  private generateBatchNumber(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0');
    return `BATCH-${dateStr}-${random}`;
  }
}

export default new SettlementService();
