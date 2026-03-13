import { Response } from 'express';
import { AuthRequest } from '../../../shared/middleware/auth';
import { AppError } from '../../../shared/utils/errors';
import { ErrorCode } from '../../../shared/types/common';
import { createLogger } from '../../../shared/utils/logger';
import settlementService from '../../payments/services/settlement.service';
import reconciliationService from '../../payments/services/settlement-reconciliation.service';
import { z } from 'zod';

const logger = createLogger('SettlementManagementController');

const CreateSettlementSchema = z.object({
  transactionId: z.string().uuid().optional(),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().min(3).max(3),
  beneficiaryName: z.string().min(1, 'Beneficiary name is required'),
  beneficiaryBank: z.string().optional(),
  beneficiaryAccount: z.string().optional(),
  beneficiarySwift: z.string().optional(),
  beneficiaryIban: z.string().optional(),
  beneficiaryCountry: z.string().optional(),
  beneficiaryAddress: z.string().optional(),
  paymentMethod: z.string().min(1, 'Payment method is required'),
  notes: z.string().optional(),
});

const CreateBatchSchema = z.object({
  direction: z.enum(['INBOUND', 'OUTBOUND']),
  settlementIds: z.array(z.string().uuid()).min(1, 'At least one settlement required'),
  description: z.string().optional(),
});

const ReconcileSettlementSchema = z.object({
  actualAmount: z.number().optional(),
  providusSessionId: z.string().optional(),
  notes: z.string().optional(),
});

const ResolveVarianceSchema = z.object({
  resolution: z.string().min(1, 'Resolution notes are required'),
});

export class SettlementManagementController {
  /**
   * Create a new outbound settlement
   * POST /api/admin/settlement-management
   */
  async createSettlement(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new AppError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
      }

      const validated = CreateSettlementSchema.parse(req.body);

      const settlement = await settlementService.createOutboundSettlement({
        ...validated,
        initiatedBy: userId,
      });

      res.status(201).json({
        success: true,
        message: 'Settlement created successfully',
        data: settlement,
      });
    } catch (error) {
      logger.error('Error creating settlement', error);
      throw error;
    }
  }

  /**
   * Create a settlement batch
   * POST /api/admin/settlement-management/batches
   */
  async createBatch(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new AppError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
      }

      const validated = CreateBatchSchema.parse(req.body);

      const batch = await settlementService.createSettlementBatch({
        ...validated,
        createdBy: userId,
      });

      res.status(201).json({
        success: true,
        message: 'Settlement batch created successfully',
        data: batch,
      });
    } catch (error) {
      logger.error('Error creating settlement batch', error);
      throw error;
    }
  }

  /**
   * Approve a settlement
   * POST /api/admin/settlement-management/:id/approve
   */
  async approveSettlement(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new AppError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
      }

      const { id } = req.params;

      const settlement = await settlementService.approveSettlement(id, userId);

      res.status(200).json({
        success: true,
        message: 'Settlement approved successfully',
        data: settlement,
      });
    } catch (error) {
      logger.error('Error approving settlement', error);
      throw error;
    }
  }

  /**
   * Approve a settlement batch
   * POST /api/admin/settlement-management/batches/:id/approve
   */
  async approveBatch(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new AppError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
      }

      const { id } = req.params;

      const batch = await settlementService.approveSettlementBatch(id, userId);

      res.status(200).json({
        success: true,
        message: 'Settlement batch approved successfully',
        data: batch,
      });
    } catch (error) {
      logger.error('Error approving settlement batch', error);
      throw error;
    }
  }

  /**
   * Process a settlement
   * POST /api/admin/settlement-management/:id/process
   */
  async processSettlement(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new AppError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
      }

      const { id } = req.params;

      const settlement = await settlementService.processSettlement(id, userId);

      res.status(200).json({
        success: true,
        message: 'Settlement processed successfully',
        data: settlement,
      });
    } catch (error) {
      logger.error('Error processing settlement', error);
      throw error;
    }
  }

  /**
   * Process a settlement batch
   * POST /api/admin/settlement-management/batches/:id/process
   */
  async processBatch(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new AppError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
      }

      const { id } = req.params;

      const result = await settlementService.processSettlementBatch(id, userId);

      res.status(200).json({
        success: true,
        message: 'Settlement batch processed',
        data: result,
      });
    } catch (error) {
      logger.error('Error processing settlement batch', error);
      throw error;
    }
  }

  /**
   * Complete a settlement
   * POST /api/admin/settlement-management/:id/complete
   */
  async completeSettlement(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { proofOfPayment } = req.body;

      const settlement = await settlementService.completeSettlement(id, proofOfPayment);

      res.status(200).json({
        success: true,
        message: 'Settlement completed successfully',
        data: settlement,
      });
    } catch (error) {
      logger.error('Error completing settlement', error);
      throw error;
    }
  }

  /**
   * Get settlement by ID
   * GET /api/admin/settlement-management/:id
   */
  async getSettlement(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const settlement = await settlementService.getSettlement(id);

      res.status(200).json({
        success: true,
        data: settlement,
      });
    } catch (error) {
      logger.error('Error fetching settlement', error);
      throw error;
    }
  }

  /**
   * Get settlement batch by ID
   * GET /api/admin/settlement-management/batches/:id
   */
  async getBatch(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const batch = await settlementService.getSettlementBatch(id);

      res.status(200).json({
        success: true,
        data: batch,
      });
    } catch (error) {
      logger.error('Error fetching settlement batch', error);
      throw error;
    }
  }

  /**
   * List settlements
   * GET /api/admin/settlement-management
   */
  async listSettlements(req: AuthRequest, res: Response) {
    try {
      const { status, batchId, transactionId, limit = 20, offset = 0 } = req.query;

      const result = await settlementService.listSettlements({
        status: status as any,
        batchId: batchId as string,
        transactionId: transactionId as string,
        limit: Number(limit),
        offset: Number(offset),
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Error listing settlements', error);
      throw error;
    }
  }

  /**
   * List settlement batches
   * GET /api/admin/settlement-management/batches
   */
  async listBatches(req: AuthRequest, res: Response) {
    try {
      const { status, direction, limit = 20, offset = 0 } = req.query;

      const result = await settlementService.listSettlementBatches({
        status: status as any,
        direction: direction as any,
        limit: Number(limit),
        offset: Number(offset),
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Error listing settlement batches', error);
      throw error;
    }
  }

  /**
   * Reconcile a settlement
   * POST /api/admin/settlement-management/:id/reconcile
   */
  async reconcileSettlement(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new AppError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
      }

      const { id } = req.params;
      const validated = ReconcileSettlementSchema.parse(req.body);

      const reconciliation = await reconciliationService.reconcileSettlement({
        settlementId: id,
        ...validated,
        reconciledBy: userId,
      });

      res.status(200).json({
        success: true,
        message: 'Settlement reconciled successfully',
        data: reconciliation,
      });
    } catch (error) {
      logger.error('Error reconciling settlement', error);
      throw error;
    }
  }

  /**
   * Reconcile a batch
   * POST /api/admin/settlement-management/batches/:id/reconcile
   */
  async reconcileBatch(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new AppError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
      }

      const { id } = req.params;

      const results = await reconciliationService.reconcileBatch(id, userId);

      res.status(200).json({
        success: true,
        message: 'Batch reconciliation complete',
        data: results,
      });
    } catch (error) {
      logger.error('Error reconciling batch', error);
      throw error;
    }
  }

  /**
   * Resolve a variance
   * POST /api/admin/settlement-management/reconciliations/:id/resolve
   */
  async resolveVariance(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new AppError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
      }

      const { id } = req.params;
      const { resolution } = ResolveVarianceSchema.parse(req.body);

      const reconciliation = await reconciliationService.resolveVariance(id, resolution, userId);

      res.status(200).json({
        success: true,
        message: 'Variance resolved successfully',
        data: reconciliation,
      });
    } catch (error) {
      logger.error('Error resolving variance', error);
      throw error;
    }
  }

  /**
   * Get pending reconciliations
   * GET /api/admin/settlement-management/reconciliations/pending
   */
  async getPendingReconciliations(req: AuthRequest, res: Response) {
    try {
      const { limit = 20, offset = 0 } = req.query;

      const result = await reconciliationService.getPendingReconciliations(
        Number(limit),
        Number(offset)
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Error fetching pending reconciliations', error);
      throw error;
    }
  }

  /**
   * Get reconciliation report
   * GET /api/admin/settlement-management/reconciliations/report
   */
  async getReconciliationReport(req: AuthRequest, res: Response) {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          'startDate and endDate are required',
          400
        );
      }

      const report = await reconciliationService.getReconciliationReport(
        new Date(startDate as string),
        new Date(endDate as string)
      );

      res.status(200).json({
        success: true,
        data: report,
      });
    } catch (error) {
      logger.error('Error generating reconciliation report', error);
      throw error;
    }
  }
}

export default new SettlementManagementController();
