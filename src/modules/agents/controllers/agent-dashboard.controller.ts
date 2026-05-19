import { Response, NextFunction } from "express";
import { AuthRequest } from "../../../shared/middleware";
import { paginatedResponse, successResponse, ValidationError } from "../../../shared/utils";
import agentTransactionService from "../services/agent-transaction.service";

class AgentDashboardController {
  listRecentTransactions = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const authUser = req.user;
      if (!authUser) {
        throw new ValidationError("Authentication required");
      }

      const page = Math.max(1, parseInt((req.query.page as string) || "1", 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || "20", 10) || 20));

      const typeParam = req.query.type as string | undefined;
      const typeFilter = typeParam?.trim() || undefined;

      const result = await agentTransactionService.listDashboardRecentTransactions(
        authUser.userId,
        typeFilter,
        page,
        limit
      );

      res.json(paginatedResponse(result.data, page, limit, result.pagination.total));
    } catch (error) {
      next(error);
    }
  };

  getTransactionsByType = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const authUser = req.user;
      if (!authUser) {
        throw new ValidationError("Authentication required");
      }

      const range = (req.query.range as string | undefined)?.trim();
      if (!range) {
        throw new ValidationError("range is required");
      }

      const data = await agentTransactionService.getDashboardTransactionsByType(authUser.userId, range);
      res.json(successResponse(data));
    } catch (error) {
      next(error);
    }
  };

  getCashStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const authUser = req.user;
      if (!authUser) throw new ValidationError("Authentication required");

      const currency = (req.query.currency as string | undefined)?.trim();
      const data = await agentTransactionService.getCashStats(authUser.userId, currency);
      res.json(successResponse(data));
    } catch (error) {
      next(error);
    }
  };

  getBalanceDashboard = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const authUser = req.user;
      if (!authUser) {
        throw new ValidationError("Authentication required");
      }

      const period = (req.query.period as string | undefined)?.trim();
      if (!period) {
        throw new ValidationError("period is required (last_month, last_3_months, last_6_months, last_year)");
      }

      const currency = (req.query.currency as string | undefined)?.trim();

      const data = await agentTransactionService.getBalanceDashboard(authUser.userId, period, currency);
      res.json(successResponse(data));
    } catch (error) {
      next(error);
    }
  };
}

export default new AgentDashboardController();
