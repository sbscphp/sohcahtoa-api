import { Response } from 'express';
import { AuthRequest } from '../../../shared/middleware/auth';
import { AppError } from '../../../shared/utils/errors';
import { ErrorCode } from '../../../shared/types/common';
import { createLogger } from '../../../shared/utils/logger';
import virtualAccountService from '../../payments/services/virtual-account.service';
import depositVerificationService from '../../payments/services/deposit-verification.service';
import { z } from 'zod';

const logger = createLogger('VirtualAccountController');

const CreateVirtualAccountSchema = z.object({
  transactionId: z.string().uuid('Invalid transaction ID'),
  accountName: z.string().min(1, 'Account name is required'),
  type: z.enum(['DYNAMIC', 'RESERVED']).optional(),
  bvn: z.string().optional(),
  expiresInHours: z.number().min(1).max(168).optional(), // Max 1 week
});

const BlacklistAccountSchema = z.object({
  accountNumber: z.string().min(1, 'Account number is required'),
  reason: z.string().min(1, 'Reason is required'),
});

const ManualVerifyDepositSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
});

export class VirtualAccountController {
  /**
   * Create virtual account for approved transaction
   * POST /api/admin/virtual-accounts
   */
  async createVirtualAccount(req: AuthRequest, res: Response) {
    try {
      const validated = CreateVirtualAccountSchema.parse(req.body);

      const virtualAccount = await virtualAccountService.createVirtualAccount({
        transactionId: validated.transactionId,
        accountName: validated.accountName,
        type: validated.type as any,
        bvn: validated.bvn,
        expiresInHours: validated.expiresInHours,
      });

      res.status(201).json({
        success: true,
        message: 'Virtual account created successfully',
        data: virtualAccount,
      });
    } catch (error) {
      logger.error('Error creating virtual account', error);
      throw error;
    }
  }

  /**
   * Get virtual account by transaction ID
   * GET /api/admin/virtual-accounts/transaction/:transactionId
   */
  async getVirtualAccountByTransaction(req: AuthRequest, res: Response) {
    try {
      const { transactionId } = req.params;

      const virtualAccount = await virtualAccountService.getVirtualAccountByTransaction(
        transactionId
      );

      res.status(200).json({
        success: true,
        data: virtualAccount,
      });
    } catch (error) {
      logger.error('Error fetching virtual account', error);
      throw error;
    }
  }

  /**
   * Get virtual account by account number
   * GET /api/admin/virtual-accounts/:accountNumber
   */
  async getVirtualAccountByNumber(req: AuthRequest, res: Response) {
    try {
      const { accountNumber } = req.params;

      const virtualAccount = await virtualAccountService.getVirtualAccountByNumber(accountNumber);

      res.status(200).json({
        success: true,
        data: virtualAccount,
      });
    } catch (error) {
      logger.error('Error fetching virtual account', error);
      throw error;
    }
  }

  /**
   * Blacklist virtual account
   * POST /api/admin/virtual-accounts/:accountNumber/blacklist
   */
  async blacklistAccount(req: AuthRequest, res: Response) {
    try {
      const { accountNumber } = req.params;
      const { reason } = BlacklistAccountSchema.parse(req.body);

      const virtualAccount = await virtualAccountService.blacklistAccount(accountNumber, reason);

      res.status(200).json({
        success: true,
        message: 'Virtual account blacklisted successfully',
        data: virtualAccount,
      });
    } catch (error) {
      logger.error('Error blacklisting virtual account', error);
      throw error;
    }
  }

  /**
   * Unblacklist virtual account
   * POST /api/admin/virtual-accounts/:accountNumber/unblacklist
   */
  async unblacklistAccount(req: AuthRequest, res: Response) {
    try {
      const { accountNumber } = req.params;

      const virtualAccount = await virtualAccountService.unblacklistAccount(accountNumber);

      res.status(200).json({
        success: true,
        message: 'Virtual account unblacklisted successfully',
        data: virtualAccount,
      });
    } catch (error) {
      logger.error('Error unblacklisting virtual account', error);
      throw error;
    }
  }

  /**
   * Manually verify deposit
   * POST /api/admin/deposits/verify
   */
  async manualVerifyDeposit(req: AuthRequest, res: Response) {
    try {
      const { sessionId } = ManualVerifyDepositSchema.parse(req.body);

      const deposit = await depositVerificationService.manualVerifyDeposit(sessionId);

      res.status(200).json({
        success: true,
        message: 'Deposit verified successfully',
        data: deposit,
      });
    } catch (error) {
      logger.error('Error manually verifying deposit', error);
      throw error;
    }
  }

  /**
   * Get transaction deposits
   * GET /api/admin/deposits/transaction/:transactionId
   */
  async getTransactionDeposits(req: AuthRequest, res: Response) {
    try {
      const { transactionId } = req.params;

      const deposits = await depositVerificationService.getTransactionDeposits(transactionId);

      res.status(200).json({
        success: true,
        data: {
          deposits,
          total: deposits.length,
        },
      });
    } catch (error) {
      logger.error('Error fetching transaction deposits', error);
      throw error;
    }
  }

  /**
   * Deactivate expired accounts
   * POST /api/admin/virtual-accounts/deactivate-expired
   */
  async deactivateExpiredAccounts(req: AuthRequest, res: Response) {
    try {
      const count = await virtualAccountService.deactivateExpiredAccounts();

      res.status(200).json({
        success: true,
        message: `Deactivated ${count} expired virtual accounts`,
        data: { count },
      });
    } catch (error) {
      logger.error('Error deactivating expired accounts', error);
      throw error;
    }
  }
}

export default new VirtualAccountController();
