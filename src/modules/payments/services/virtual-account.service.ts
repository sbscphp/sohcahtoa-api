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
        const isActive =
          existingAccount.status === VirtualAccountStatus.ACTIVE &&
          (!existingAccount.expiresAt || new Date(existingAccount.expiresAt) > new Date());

        if (isActive) {
          logger.info('Virtual account already exists for transaction', {
            transactionId,
            accountNumber: existingAccount.accountNumber,
          });
          return existingAccount;
        }

        // Existing account is expired/inactive — fall through to provision a new one
        logger.info('Existing virtual account is inactive/expired, recreating', {
          transactionId,
          existingAccountNumber: existingAccount.accountNumber,
          existingStatus: existingAccount.status,
        });
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

      // Ensure transaction is in an eligible status before creating virtual account
      const allowedStatuses = ['APPROVED', 'VERIFICATION_COMPLETED', 'AWAITING_DEPOSIT'];
      if (!allowedStatuses.includes(transaction.status)) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          'Virtual account can only be created for approved or awaiting deposit transactions',
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
      // In simulation mode, cap expiry at 30 minutes for faster testing cycles
      const effectiveExpiryMs = providusService.isSimulationMode()
        ? 30 * 60 * 1000
        : expiresInHours * 60 * 60 * 1000;

      const expiresAt =
        type === VirtualAccountType.DYNAMIC
          ? new Date(Date.now() + effectiveExpiryMs)
          : null;

      // Save virtual account to database
      // Retry logic for duplicate account numbers in simulation mode
      let virtualAccount;
      let retries = 0;
      const maxRetries = 3;

      while (retries < maxRetries) {
        try {
          const accountData = {
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
          };
          virtualAccount = await prisma.virtualAccount.upsert({
            where: { transactionId },
            create: accountData,
            update: {
              accountNumber: accountData.accountNumber,
              accountName: accountData.accountName,
              status: VirtualAccountStatus.ACTIVE,
              initiationTranRef: accountData.initiationTranRef,
              expiresAt: accountData.expiresAt,
              metadata: accountData.metadata,
            },
          });
          break;
        } catch (error: any) {
          if (error.code === 'P2002' && retries < maxRetries - 1) {
            // Duplicate account number, try creating a new one
            logger.warn('Duplicate account number, retrying with new number', {
              accountNumber: providusResponse.account_number,
              retries: retries + 1,
            });
            retries++;

            // Generate a new account in Providus for retry
            if (type === VirtualAccountType.DYNAMIC) {
              providusResponse = await providusService.createDynamicAccount(accountName);
            } else {
              providusResponse = await providusService.createReservedAccount(accountName, bvn);
            }
          } else {
            throw error;
          }
        }
      }

      if (!virtualAccount) {
        throw new AppError(ErrorCode.INTERNAL_ERROR, 'Failed to create virtual account', 500);
      }

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
