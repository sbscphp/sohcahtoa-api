import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../../shared/middleware';
import walletService from '../services/wallet.service';
import { successResponse, paginatedResponse } from '../../../shared/utils';
import { UserRole } from '../../../shared/types';
import { ForbiddenError, NotFoundError } from '../../../shared/utils/errors';

class WalletController {
  /**
   * GET /api/customer/wallet
   * Customer reads their own wallet balance.
   */
  getMyWallet = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const wallet = await walletService.getWallet(userId);
      res.json(successResponse(wallet));
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/customer/wallet/ledger
   * Customer reads their own ledger with optional filters.
   */
  getMyLedger = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const { page, limit, type, dateFrom, dateTo } = req.query as any;

      const result = await walletService.getWalletLedger(userId, {
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 20,
        type,
        dateFrom,
        dateTo,
      });

      res.json({
        success: true,
        data: result.wallet,
        entries: result.entries,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/admin/wallets/:userId
   * Admin reads any customer's wallet balance.
   */
  getCustomerWallet = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const wallet = await walletService.getWallet(userId);
      res.json(successResponse(wallet));
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/admin/wallets/:userId/ledger
   * Admin reads any customer's ledger with optional filters.
   */
  getCustomerLedger = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const { page, limit, type, dateFrom, dateTo } = req.query as any;

      const result = await walletService.getWalletLedger(userId, {
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 20,
        type,
        dateFrom,
        dateTo,
      });

      res.json({
        success: true,
        data: result.wallet,
        entries: result.entries,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  };
}

export default new WalletController();
