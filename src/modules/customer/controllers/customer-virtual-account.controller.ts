import { Response } from 'express';
import { AuthRequest } from '../../../shared/middleware/auth';
import { AppError } from '../../../shared/utils/errors';
import { ErrorCode } from '../../../shared/types/common';
import { createLogger } from '../../../shared/utils/logger';
import transactionVirtualAccountFlowService from '../../payments/services/transaction-virtual-account-flow.service';

const logger = createLogger('CustomerVirtualAccountController');

export class CustomerVirtualAccountController {
  /**
   * Create virtual account for customer's transaction
   * POST /api/customer/transactions/:transactionId/virtual-account
   */
  async createTransactionVirtualAccount(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { transactionId } = req.params;

      if (!userId) {
        throw new AppError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
      }

      const result = await transactionVirtualAccountFlowService.createVirtualAccountForTransaction(
        userId,
        transactionId
      );

      if (result.httpStatus === 201) {
        return res.status(201).json({
          success: true,
          data: result.data,
          message: result.message,
        });
      }

      return res.status(200).json({
        success: true,
        data: result.data,
      });
    } catch (error) {
      logger.error('Error creating virtual account for customer', error);
      throw error;
    }
  }

  /**
   * Get virtual account for customer's transaction
   * GET /api/customer/transactions/:transactionId/virtual-account
   */
  async getTransactionVirtualAccount(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { transactionId } = req.params;

      if (!userId) {
        throw new AppError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
      }

      const data = await transactionVirtualAccountFlowService.getVirtualAccountForTransaction(
        userId,
        transactionId,
        'customer'
      );

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('Error fetching virtual account', error);
      throw error;
    }
  }

  /**
   * Get deposit instructions for customer
   * GET /api/customer/transactions/:transactionId/deposit-instructions
   */
  async getDepositInstructions(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { transactionId } = req.params;

      if (!userId) {
        throw new AppError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
      }

      const data = await transactionVirtualAccountFlowService.getDepositInstructionsForTransaction(
        userId,
        transactionId,
        'customer'
      );

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('Error fetching deposit instructions', error);
      throw error;
    }
  }

  /**
   * Get deposit status for transaction
   * GET /api/customer/transactions/:transactionId/deposit-status
   */
  async getDepositStatus(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { transactionId } = req.params;

      if (!userId) {
        throw new AppError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
      }

      const data = await transactionVirtualAccountFlowService.getDepositStatusForTransaction(
        userId,
        transactionId
      );

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('Error fetching deposit status', error);
      throw error;
    }
  }
}

export default new CustomerVirtualAccountController();
