import { Response } from 'express';
import { AuthRequest } from '../../../shared/middleware/auth';
import { AppError } from '../../../shared/utils/errors';
import { ErrorCode } from '../../../shared/types/common';
import { createLogger } from '../../../shared/utils/logger';
import virtualAccountService from '../../payments/services/virtual-account.service';
import depositVerificationService from '../../payments/services/deposit-verification.service';
import { PrismaClient } from '@prisma/client';

const logger = createLogger('CustomerVirtualAccountController');
const prisma = new PrismaClient();

export class CustomerVirtualAccountController {
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

      // Verify transaction belongs to user
      const transaction = await prisma.transaction.findFirst({
        where: {
          id: transactionId,
          userId,
        },
      });

      if (!transaction) {
        throw new AppError(ErrorCode.NOT_FOUND, 'Transaction not found', 404);
      }

      // Get virtual account
      const virtualAccount = await virtualAccountService.getVirtualAccountByTransaction(
        transactionId
      );

      // Filter sensitive information for customer view
      const customerView = {
        accountNumber: virtualAccount.accountNumber,
        accountName: virtualAccount.accountName,
        bankName: virtualAccount.bankName,
        status: virtualAccount.status,
        expiresAt: virtualAccount.expiresAt,
        createdAt: virtualAccount.createdAt,
        deposits: virtualAccount.deposits?.map((deposit) => ({
          id: deposit.id,
          amount: deposit.amount,
          settledAmount: deposit.settledAmount,
          status: deposit.status,
          tranDateTime: deposit.tranDateTime,
          createdAt: deposit.createdAt,
        })),
      };

      res.status(200).json({
        success: true,
        data: customerView,
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

      // Verify transaction belongs to user
      const transaction = await prisma.transaction.findFirst({
        where: {
          id: transactionId,
          userId,
        },
      });

      if (!transaction) {
        throw new AppError(ErrorCode.NOT_FOUND, 'Transaction not found', 404);
      }

      // Verify transaction is approved
      if (transaction.status !== 'APPROVED' && transaction.status !== 'AWAITING_DEPOSIT') {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          'Deposit instructions not available yet. Please wait for transaction approval.',
          400
        );
      }

      // Get virtual account
      const virtualAccount = await virtualAccountService.getVirtualAccountByTransaction(
        transactionId
      );

      const instructions = {
        accountNumber: virtualAccount.accountNumber,
        accountName: virtualAccount.accountName,
        bankName: virtualAccount.bankName,
        amount: transaction.nairaEquivalent,
        currency: 'NGN',
        expiresAt: virtualAccount.expiresAt,
        instructions: [
          'Transfer the exact amount specified to the account number provided',
          'Use your registered name as the sender name',
          'The account is valid for single use only',
          virtualAccount.expiresAt
            ? `Complete the transfer before ${new Date(virtualAccount.expiresAt).toLocaleString()}`
            : 'Complete the transfer within the specified timeframe',
          'Your transaction will be automatically confirmed once the deposit is received',
          'Do not share this account number with anyone',
        ],
        warningNote: 'Please transfer the exact amount. Any discrepancy may delay processing.',
      };

      res.status(200).json({
        success: true,
        data: instructions,
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

      // Verify transaction belongs to user
      const transaction = await prisma.transaction.findFirst({
        where: {
          id: transactionId,
          userId,
        },
      });

      if (!transaction) {
        throw new AppError(ErrorCode.NOT_FOUND, 'Transaction not found', 404);
      }

      // Get deposits
      const deposits = await depositVerificationService.getTransactionDeposits(transactionId);

      const latestDeposit = deposits[0];

      const status = {
        hasDeposit: deposits.length > 0,
        depositStatus: latestDeposit?.status || null,
        depositAmount: latestDeposit?.amount || null,
        depositDate: latestDeposit?.tranDateTime || null,
        transactionStatus: transaction.status,
        awaitingDeposit: transaction.status === 'AWAITING_DEPOSIT',
        depositConfirmed: transaction.status === 'DEPOSIT_CONFIRMED',
      };

      res.status(200).json({
        success: true,
        data: status,
      });
    } catch (error) {
      logger.error('Error fetching deposit status', error);
      throw error;
    }
  }
}

export default new CustomerVirtualAccountController();
