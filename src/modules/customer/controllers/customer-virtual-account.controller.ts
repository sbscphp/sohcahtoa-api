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

      logger.info('Customer creating virtual account', {
        userId,
        transactionId,
      });

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

      // Get user profile for account name generation
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          profile: true,
        },
      });

      // Verify transaction is approved
      if (transaction.status !== 'APPROVED') {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          'Virtual account can only be created for approved transactions',
          400
        );
      }

      // Check if virtual account already exists
      try {
        const existingAccount = await virtualAccountService.getVirtualAccountByTransaction(
          transactionId
        );

        // Check if account is expired
        const isExpired =
          existingAccount.expiresAt && new Date(existingAccount.expiresAt) < new Date();

        if (isExpired) {
          logger.warn('Existing virtual account has expired, creating new one', {
            userId,
            transactionId,
            accountNumber: existingAccount.accountNumber,
            expiresAt: existingAccount.expiresAt,
          });

          // Deactivate the expired account
          await prisma.virtualAccount.update({
            where: { id: existingAccount.id },
            data: {
              status: 'INACTIVE',
            },
          });

          // Continue to create a new account (fall through to creation logic below)
        } else {
          logger.info('Valid virtual account already exists', {
            userId,
            transactionId,
            accountNumber: existingAccount.accountNumber,
            status: existingAccount.status,
          });

          // Return existing active account
          const customerView = {
            accountNumber: existingAccount.accountNumber,
            accountName: existingAccount.accountName,
            bankName: existingAccount.bankName,
            status: existingAccount.status,
            expiresAt: existingAccount.expiresAt,
            createdAt: existingAccount.createdAt,
            message: 'Virtual account already exists for this transaction',
          };

          return res.status(200).json({
            success: true,
            data: customerView,
          });
        }
      } catch (error) {
        // Account doesn't exist, proceed to create
        if (!(error instanceof AppError && error.statusCode === 404)) {
          throw error;
        }
      }

      // Generate account name from user profile
      const userProfile = user?.profile;
      const userName = userProfile
        ? `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim()
        : 'Customer';
      const accountName = `SOHCAHTOA-(${userName})`;

      // Create virtual account
      const virtualAccount = await virtualAccountService.createVirtualAccount({
        userId,
        transactionId,
        accountName,
        type: 'DYNAMIC',
        expiresInHours: 48, // Default 48 hours
      });

      logger.info('Virtual account created successfully by customer', {
        userId,
        transactionId,
        accountNumber: virtualAccount.accountNumber,
      });

      // Return customer view of the account
      const customerView = {
        accountNumber: virtualAccount.accountNumber,
        accountName: virtualAccount.accountName,
        bankName: virtualAccount.bankName,
        status: virtualAccount.status,
        expiresAt: virtualAccount.expiresAt,
        createdAt: virtualAccount.createdAt,
        depositAmount: transaction.nairaEquivalent,
        currency: 'NGN',
        instructions: [
          'Transfer the exact amount specified to the account number provided',
          'Use your registered name as the sender name',
          'The account is valid for single use only',
          virtualAccount.expiresAt
            ? `Complete the transfer before ${new Date(virtualAccount.expiresAt).toLocaleString()}`
            : 'Complete the transfer within 48 hours',
          'Your transaction will be automatically confirmed once the deposit is received',
          'Do not share this account number with anyone',
        ],
        warningNote: 'Please transfer the exact amount. Any discrepancy may delay processing.',
      };

      return res.status(201).json({
        success: true,
        data: customerView,
        message: 'Virtual account created successfully',
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

      // Check if account is expired
      const isExpired =
        virtualAccount.expiresAt && new Date(virtualAccount.expiresAt) < new Date();

      // Filter sensitive information for customer view
      const customerView = {
        accountNumber: virtualAccount.accountNumber,
        accountName: virtualAccount.accountName,
        bankName: virtualAccount.bankName,
        status: virtualAccount.status,
        expiresAt: virtualAccount.expiresAt,
        createdAt: virtualAccount.createdAt,
        isExpired,
        deposits: virtualAccount.deposits?.map((deposit) => ({
          id: deposit.id,
          amount: deposit.amount,
          settledAmount: deposit.settledAmount,
          status: deposit.status,
          tranDateTime: deposit.tranDateTime,
          createdAt: deposit.createdAt,
        })),
        ...(isExpired && {
          message:
            'This virtual account has expired. Please create a new one by calling POST /api/customer/transactions/:transactionId/virtual-account',
        }),
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

      // Check if account is expired
      const isExpired =
        virtualAccount.expiresAt && new Date(virtualAccount.expiresAt) < new Date();

      if (isExpired) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          'Virtual account has expired. Please create a new one by calling POST /api/customer/transactions/:transactionId/virtual-account',
          400
        );
      }

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
