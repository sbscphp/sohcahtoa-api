import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../../shared/middleware';
import { paginatedResponse, successResponse, ValidationError } from '../../../shared/utils';
import customerDashboardService from '../services/customer-dashboard.service';

class CustomerDashboardController {
  /**
   * GET /api/customer/dashboard/recent-transactions
   */
  listRecentTransactions = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      if (!userId) throw new ValidationError('Authentication required');

      const page  = Math.max(1, parseInt((req.query.page  as string) || '1',  10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '20', 10) || 20));
      const typeFilter = (req.query.type as string | undefined)?.trim() || undefined;

      const result = await customerDashboardService.listRecentTransactions(userId, typeFilter, page, limit);
      res.json(paginatedResponse(result.data, page, limit, result.pagination.total));
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/customer/dashboard/transactions-by-type
   */
  getTransactionsByType = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      if (!userId) throw new ValidationError('Authentication required');

      const range = (req.query.range as string | undefined)?.trim();
      if (!range) throw new ValidationError('range is required');

      const data = await customerDashboardService.getTransactionsByType(userId, range);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/customer/dashboard/stats
   */
  getTransactionStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      if (!userId) throw new ValidationError('Authentication required');

      const data = await customerDashboardService.getTransactionStats(userId);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/customer/dashboard/payment-summary
   */
  getPaymentSummary = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      if (!userId) throw new ValidationError('Authentication required');

      const period = (req.query.period as string | undefined)?.trim();
      if (!period) throw new ValidationError('period is required (last_month, last_3_months, last_6_months, last_year)');

      const currency = (req.query.currency as string | undefined)?.trim();

      const data = await customerDashboardService.getPaymentSummary(userId, period, currency);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  };
}

export default new CustomerDashboardController();
