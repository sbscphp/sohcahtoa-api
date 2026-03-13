import { PrismaClient, VirtualAccountType, VirtualAccountStatus } from '@prisma/client';
import { createLogger } from '../../../shared/utils/logger';
import { AppError } from '../../../shared/utils/errors';
import { ErrorCode } from '../../../shared/types/common';
import providusService from './providus.service';

const prisma = new PrismaClient();
const logger = createLogger('VirtualAccountService');

interface CreateVirtualAccountOptions {
  userId?: string;
  transactionId: string;
  accountName: string;
  type?: VirtualAccountType;
  bvn?: string;
  expiresInHours?: number; // For dynamic accounts
}

export class VirtualAccountService {
  /**
   * Create a virtual account for a transaction
   * This should be called AFTER admin approves the transaction
   */
  async createVirtualAccount(options: CreateVirtualAccountOptions) {
    const {
      userId,
      transactionId,
      accountName,
      type = VirtualAccountType.DYNAMIC,
      bvn,
      expiresInHours = 48, // Default 48 hours for dynamic accounts
    } = options;

    try {
      logger.info('Creating virtual account', {
        userId,
        transactionId,
        accountName,
        type,
      });

      // Check if virtual account already exists for this transaction
      const existingAccount = await prisma.virtualAccount.findUnique({
        where: { transactionId },
      });

      if (existingAccount) {
        logger.info('Virtual account already exists for transaction', {
          transactionId,
          accountNumber: existingAccount.accountNumber,
        });
        return existingAccount;
      }

      // Verify transaction exists and is approved
      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        include: {
          steps: true,
        },
      });

      if (!transaction) {
        throw new AppError(ErrorCode.NOT_FOUND, 'Transaction not found', 404);
      }

      // Ensure transaction is approved before creating virtual account
      if (transaction.status !== 'APPROVED') {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          'Virtual account can only be created for approved transactions',
          400
        );
      }

      // Create virtual account with Providus
      let providusResponse;
      if (type === VirtualAccountType.DYNAMIC) {
        providusResponse = await providusService.createDynamicAccount(accountName);
      } else {
        providusResponse = await providusService.createReservedAccount(accountName, bvn);
      }

      // Calculate expiry date for dynamic accounts
      const expiresAt =
        type === VirtualAccountType.DYNAMIC
          ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000)
          : null;

      // Save virtual account to database
      const virtualAccount = await prisma.virtualAccount.create({
        data: {
          userId,
          transactionId,
          accountNumber: providusResponse.account_number,
          accountName: providusResponse.account_name,
          type,
          status: VirtualAccountStatus.ACTIVE,
          initiationTranRef: 'initiationTranRef' in providusResponse ? providusResponse.initiationTranRef : null,
          bvn,
          expiresAt,
          metadata: providusResponse as any,
        },
      });

      logger.info('Virtual account created successfully', {
        id: virtualAccount.id,
        accountNumber: virtualAccount.accountNumber,
        transactionId,
      });

      // Update transaction status to AWAITING_DEPOSIT
      await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: 'AWAITING_DEPOSIT',
          currentStep: 'DEPOSIT_INFO',
        },
      });

      // Create transaction step log
      await prisma.transactionStepLog.create({
        data: {
          transactionId,
          step: 'DEPOSIT_INFO',
          status: 'COMPLETED',
          data: {
            virtualAccountNumber: virtualAccount.accountNumber,
            virtualAccountName: virtualAccount.accountName,
            expiresAt: virtualAccount.expiresAt,
          },
          completedAt: new Date(),
        },
      });

      return virtualAccount;
    } catch (error) {
      logger.error('Error creating virtual account', error);
      if (error instanceof AppError) throw error;
      throw new AppError(ErrorCode.INTERNAL_ERROR, 'Failed to create virtual account', 500);
    }
  }

  /**
   * Get virtual account by transaction ID
   */
  async getVirtualAccountByTransaction(transactionId: string) {
    try {
      const virtualAccount = await prisma.virtualAccount.findUnique({
        where: { transactionId },
        include: {
          deposits: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!virtualAccount) {
        throw new AppError(ErrorCode.NOT_FOUND, 'Virtual account not found', 404);
      }

      return virtualAccount;
    } catch (error) {
      logger.error('Error fetching virtual account', error);
      if (error instanceof AppError) throw error;
      throw new AppError(ErrorCode.INTERNAL_ERROR, 'Failed to fetch virtual account', 500);
    }
  }

  /**
   * Get virtual account by account number
   */
  async getVirtualAccountByNumber(accountNumber: string) {
    try {
      const virtualAccount = await prisma.virtualAccount.findUnique({
        where: { accountNumber },
        include: {
          deposits: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!virtualAccount) {
        throw new AppError(ErrorCode.NOT_FOUND, 'Virtual account not found', 404);
      }

      return virtualAccount;
    } catch (error) {
      logger.error('Error fetching virtual account', error);
      if (error instanceof AppError) throw error;
      throw new AppError(ErrorCode.INTERNAL_ERROR, 'Failed to fetch virtual account', 500);
    }
  }

  /**
   * Blacklist a virtual account
   */
  async blacklistAccount(accountNumber: string, reason: string) {
    try {
      logger.info('Blacklisting virtual account', { accountNumber, reason });

      // Update in Providus
      await providusService.blacklistAccount(accountNumber, true);

      // Update in database
      const virtualAccount = await prisma.virtualAccount.update({
        where: { accountNumber },
        data: {
          isBlacklisted: true,
          status: VirtualAccountStatus.BLACKLISTED,
          blacklistedAt: new Date(),
          blacklistReason: reason,
        },
      });

      logger.info('Virtual account blacklisted successfully', { accountNumber });

      return virtualAccount;
    } catch (error) {
      logger.error('Error blacklisting virtual account', error);
      if (error instanceof AppError) throw error;
      throw new AppError(ErrorCode.INTERNAL_ERROR, 'Failed to blacklist virtual account', 500);
    }
  }

  /**
   * Unblacklist a virtual account
   */
  async unblacklistAccount(accountNumber: string) {
    try {
      logger.info('Unblacklisting virtual account', { accountNumber });

      // Update in Providus
      await providusService.blacklistAccount(accountNumber, false);

      // Update in database
      const virtualAccount = await prisma.virtualAccount.update({
        where: { accountNumber },
        data: {
          isBlacklisted: false,
          status: VirtualAccountStatus.ACTIVE,
          blacklistedAt: null,
          blacklistReason: null,
        },
      });

      logger.info('Virtual account unblacklisted successfully', { accountNumber });

      return virtualAccount;
    } catch (error) {
      logger.error('Error unblacklisting virtual account', error);
      if (error instanceof AppError) throw error;
      throw new AppError(ErrorCode.INTERNAL_ERROR, 'Failed to unblacklist virtual account', 500);
    }
  }

  /**
   * Deactivate expired virtual accounts
   * Should be run as a cron job
   */
  async deactivateExpiredAccounts() {
    try {
      logger.info('Deactivating expired virtual accounts');

      const result = await prisma.virtualAccount.updateMany({
        where: {
          type: VirtualAccountType.DYNAMIC,
          status: VirtualAccountStatus.ACTIVE,
          expiresAt: {
            lte: new Date(),
          },
        },
        data: {
          status: VirtualAccountStatus.INACTIVE,
        },
      });

      logger.info(`Deactivated ${result.count} expired virtual accounts`);

      return result.count;
    } catch (error) {
      logger.error('Error deactivating expired accounts', error);
      throw new AppError(ErrorCode.INTERNAL_ERROR, 'Failed to deactivate expired accounts', 500);
    }
  }

  /**
   * Update account name (e.g., when reassigning account)
   */
  async updateAccountName(accountNumber: string, newAccountName: string) {
    try {
      logger.info('Updating virtual account name', { accountNumber, newAccountName });

      // Update in Providus
      await providusService.updateAccountName(accountNumber, newAccountName);

      // Update in database
      const virtualAccount = await prisma.virtualAccount.update({
        where: { accountNumber },
        data: {
          accountName: newAccountName,
        },
      });

      logger.info('Virtual account name updated successfully', { accountNumber });

      return virtualAccount;
    } catch (error) {
      logger.error('Error updating virtual account name', error);
      if (error instanceof AppError) throw error;
      throw new AppError(ErrorCode.INTERNAL_ERROR, 'Failed to update virtual account name', 500);
    }
  }
}

export default new VirtualAccountService();
