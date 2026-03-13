import { PrismaClient } from '@prisma/client';
import { createLogger } from '../../../shared/utils/logger';
import { AppError } from '../../../shared/utils/errors';
import { ErrorCode } from '../../../shared/types/common';
import providusService from './providus.service';

const prisma = new PrismaClient();
const logger = createLogger('SettlementReconciliationService');

interface ReconcileSettlementOptions {
  settlementId: string;
  actualAmount?: number;
  providusSessionId?: string;
  reconciledBy: string;
  notes?: string;
}

export class SettlementReconciliationService {
  /**
   * Create a reconciliation record for a settlement
   */
  async createReconciliation(settlementId: string, type: string = 'MANUAL') {
    try {
      logger.info('Creating reconciliation record', { settlementId, type });

      const settlement = await prisma.outboundSettlement.findUnique({
        where: { id: settlementId },
      });

      if (!settlement) {
        throw new AppError(ErrorCode.NOT_FOUND, 'Settlement not found', 404);
      }

      const reconciliation = await prisma.settlementReconciliation.create({
        data: {
          settlementId,
          reconciliationType: type,
          expectedAmount: settlement.amount,
          status: 'PENDING',
        },
      });

      logger.info('Reconciliation record created', {
        id: reconciliation.id,
        settlementId,
      });

      return reconciliation;
    } catch (error) {
      logger.error('Error creating reconciliation record', error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        ErrorCode.INTERNAL_ERROR,
        'Failed to create reconciliation record',
        500
      );
    }
  }

  /**
   * Reconcile a settlement with actual payment data
   */
  async reconcileSettlement(options: ReconcileSettlementOptions) {
    try {
      logger.info('Reconciling settlement', {
        settlementId: options.settlementId,
        actualAmount: options.actualAmount,
      });

      const settlement = await prisma.outboundSettlement.findUnique({
        where: { id: options.settlementId },
      });

      if (!settlement) {
        throw new AppError(ErrorCode.NOT_FOUND, 'Settlement not found', 404);
      }

      let providusData = null;
      let actualAmount = options.actualAmount;

      // If Providus session ID provided, verify with Providus
      if (options.providusSessionId) {
        try {
          const verification = await providusService.verifyTransactionBySessionId(
            options.providusSessionId
          );
          providusData = verification;
          actualAmount = verification.settledAmount;

          logger.info('Settlement verified with Providus', {
            settlementId: options.settlementId,
            sessionId: options.providusSessionId,
            amount: verification.settledAmount,
          });
        } catch (error) {
          logger.error('Error verifying with Providus', error);
          // Continue with manual reconciliation
        }
      }

      const expectedAmount = Number(settlement.amount);
      const variance = actualAmount ? actualAmount - expectedAmount : null;
      const status =
        variance === null
          ? 'PENDING'
          : Math.abs(variance) < 0.01
            ? 'MATCHED'
            : 'VARIANCE';

      // Check if reconciliation already exists
      const existingReconciliation = await prisma.settlementReconciliation.findFirst({
        where: { settlementId: options.settlementId },
      });

      // Create or update reconciliation record
      const reconciliation = existingReconciliation
        ? await prisma.settlementReconciliation.update({
            where: { id: existingReconciliation.id },
            data: {
              actualAmount,
              variance,
              status,
              providusData: providusData as any,
              reconciledBy: options.reconciledBy,
              reconciledAt: new Date(),
              notes: options.notes,
            },
          })
        : await prisma.settlementReconciliation.create({
            data: {
              settlementId: options.settlementId,
              reconciliationType: options.providusSessionId ? 'PROVIDUS_VERIFY' : 'MANUAL',
              expectedAmount,
              actualAmount,
              variance,
              status,
              providusData: providusData as any,
              reconciledBy: options.reconciledBy,
              reconciledAt: new Date(),
              notes: options.notes,
            },
          });

      logger.info('Settlement reconciled', {
        id: reconciliation.id,
        settlementId: options.settlementId,
        status,
        variance,
      });

      // If matched, mark settlement as completed
      if (status === 'MATCHED') {
        await prisma.outboundSettlement.update({
          where: { id: options.settlementId },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
          },
        });
      }

      return reconciliation;
    } catch (error) {
      logger.error('Error reconciling settlement', error);
      if (error instanceof AppError) throw error;
      throw new AppError(ErrorCode.INTERNAL_ERROR, 'Failed to reconcile settlement', 500);
    }
  }

  /**
   * Reconcile an entire batch
   */
  async reconcileBatch(batchId: string, reconciledBy: string) {
    try {
      logger.info('Reconciling settlement batch', { batchId });

      const batch = await prisma.settlementBatch.findUnique({
        where: { id: batchId },
        include: { settlements: true },
      });

      if (!batch) {
        throw new AppError(ErrorCode.NOT_FOUND, 'Settlement batch not found', 404);
      }

      const results = {
        total: batch.settlements.length,
        matched: 0,
        variance: 0,
        pending: 0,
        errors: [] as string[],
      };

      // Reconcile each settlement
      for (const settlement of batch.settlements) {
        try {
          const reconciliation = await this.createReconciliation(settlement.id, 'AUTO');

          if (reconciliation.status === 'MATCHED') {
            results.matched++;
          } else if (reconciliation.status === 'VARIANCE') {
            results.variance++;
          } else {
            results.pending++;
          }
        } catch (error) {
          results.errors.push(
            `Settlement ${settlement.referenceNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
          logger.error('Error reconciling settlement in batch', error);
        }
      }

      logger.info('Batch reconciliation complete', {
        batchId,
        results,
      });

      return results;
    } catch (error) {
      logger.error('Error reconciling batch', error);
      if (error instanceof AppError) throw error;
      throw new AppError(ErrorCode.INTERNAL_ERROR, 'Failed to reconcile batch', 500);
    }
  }

  /**
   * Resolve a variance in reconciliation
   */
  async resolveVariance(reconciliationId: string, resolution: string, resolvedBy: string) {
    try {
      logger.info('Resolving reconciliation variance', { reconciliationId });

      const reconciliation = await prisma.settlementReconciliation.update({
        where: { id: reconciliationId },
        data: {
          status: 'RESOLVED',
          reconciledBy: resolvedBy,
          reconciledAt: new Date(),
          notes: resolution,
        },
      });

      logger.info('Variance resolved', { reconciliationId });

      return reconciliation;
    } catch (error) {
      logger.error('Error resolving variance', error);
      throw new AppError(ErrorCode.INTERNAL_ERROR, 'Failed to resolve variance', 500);
    }
  }

  /**
   * Get reconciliation report for a date range
   */
  async getReconciliationReport(startDate: Date, endDate: Date) {
    try {
      const reconciliations = await prisma.settlementReconciliation.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      });

      const summary = {
        total: reconciliations.length,
        matched: reconciliations.filter((r) => r.status === 'MATCHED').length,
        variance: reconciliations.filter((r) => r.status === 'VARIANCE').length,
        pending: reconciliations.filter((r) => r.status === 'PENDING').length,
        resolved: reconciliations.filter((r) => r.status === 'RESOLVED').length,
        totalVarianceAmount: reconciliations
          .filter((r) => r.variance !== null)
          .reduce((sum, r) => sum + Number(r.variance), 0),
      };

      return {
        summary,
        reconciliations,
      };
    } catch (error) {
      logger.error('Error generating reconciliation report', error);
      throw new AppError(
        ErrorCode.INTERNAL_ERROR,
        'Failed to generate reconciliation report',
        500
      );
    }
  }

  /**
   * Get pending reconciliations
   */
  async getPendingReconciliations(limit: number = 20, offset: number = 0) {
    try {
      const reconciliations = await prisma.settlementReconciliation.findMany({
        where: {
          status: { in: ['PENDING', 'VARIANCE'] },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      });

      const total = await prisma.settlementReconciliation.count({
        where: {
          status: { in: ['PENDING', 'VARIANCE'] },
        },
      });

      return {
        reconciliations,
        total,
        limit,
        offset,
      };
    } catch (error) {
      logger.error('Error fetching pending reconciliations', error);
      throw new AppError(
        ErrorCode.INTERNAL_ERROR,
        'Failed to fetch pending reconciliations',
        500
      );
    }
  }
}

export default new SettlementReconciliationService();
