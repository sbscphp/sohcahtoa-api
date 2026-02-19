import { Request, Response, NextFunction } from "express";
import customerTransactionService from "../services/customer-transaction.service";
import { successResponse, paginatedResponse } from "../../../shared/utils";
import { AuthRequest } from "../../../shared/middleware";
import { UserRole } from "../../../shared/types";

class CustomerTransactionController {
  /**
   * Resolve userId: for agents use body/query, otherwise use authenticated user.
   * Returns { userId } or sends error response and returns null.
   */
  private resolveUserId(
    req: AuthRequest,
    res: Response,
    fromBody: boolean
  ): string | null {
    const isAgent = req.user?.role === UserRole.AGENT;
    const userId = isAgent
      ? (fromBody ? req.body.userId : (req.query.userId as string))
      : req.user?.userId;

    if (!userId) {
      const status = isAgent ? 400 : 401;
      const message = isAgent
        ? (fromBody ? "userId is required in request body when acting as an agent" : "userId is required in query when acting as an agent")
        : "Authentication required";
      res.status(status).json({ success: false, message });
      return null;
    }
    return userId;
  }

  /**
   * Create a new transaction
   */
  createTransaction = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = this.resolveUserId(req, res, true);
      if (userId === null) return;

      const { userId: _omit, ...rest } = req.body;
      const payload = { userId, ...rest };

      const result = await customerTransactionService.createTransaction(payload);
      res.status(201).json(successResponse(result));
    } catch (error) {
      next(error);
    }
  };

  /**
   * Upload documents for a transaction
   */
  uploadDocuments = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = this.resolveUserId(req, res, true);
      if (userId === null) return;

      const { transactionId } = req.params;
      const { documentType } = req.body;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        res.status(400).json({
          success: false,
          message: "No files provided",
        });
        return;
      }

      if (!documentType) {
        res.status(400).json({
          success: false,
          message: "documentType is required",
        });
        return;
      }

      const result = await customerTransactionService.uploadDocuments({
        transactionId,
        userId,
        documentType,
        files,
      });

      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get active exchange rates
   */
  getActiveRates = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fromCurrency, toCurrency } = req.query;
      const result = await customerTransactionService.getActiveRates(
        fromCurrency as string | undefined,
        toCurrency as string | undefined
      );
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  };

  /**
   * Calculate transaction amount
   */
  calculateAmount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fromCurrency, toCurrency, amount } = req.body;

      if (!fromCurrency || !toCurrency || !amount) {
        res.status(400).json({
          success: false,
          message: "fromCurrency, toCurrency and amount are required",
        });
        return;
      }

      const result = await customerTransactionService.calculateAmount(
        fromCurrency,
        toCurrency,
        parseFloat(amount)
      );
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get available pickup points
   */
  getPickupPoints = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await customerTransactionService.getPickupPoints();
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/customer/transactions
   * Paginated, filterable, searchable transaction list for the authenticated customer.
   */
  getMyTransactions = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = this.resolveUserId(req, res, false);
      if (userId === null) return;

      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);

      const filters = {
        q: req.query.q as string | undefined,
        status: req.query.status as string | undefined,
        type: req.query.type as string | undefined,
        group: req.query.group as string | undefined,
        currency: req.query.currency as string | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        sortBy: req.query.sortBy as string | undefined,
        sortOrder: (req.query.sortOrder as "asc" | "desc") || "desc",
      };

      const result = await customerTransactionService.getCustomerTransactions(
        userId,
        filters,
        page,
        limit
      );
      res.json(paginatedResponse(result.data, page, limit, result.pagination.total));
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/customer/transactions/export
   * Download all matching transactions as a CSV file.
   */
  exportMyTransactions = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = this.resolveUserId(req, res, false);
      if (userId === null) return;

      const filters = {
        q: req.query.q as string | undefined,
        status: req.query.status as string | undefined,
        type: req.query.type as string | undefined,
        group: req.query.group as string | undefined,
        currency: req.query.currency as string | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
      };

      const csv = await customerTransactionService.exportCustomerTransactions(userId, filters);

      const filename = `transactions-${userId}-${Date.now()}.csv`;
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get a single transaction details
   */
  getTransactionDetails = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = this.resolveUserId(req, res, false);
      if (userId === null) return;

      const { transactionId } = req.params;

      const result = await customerTransactionService.getTransactionDetails(transactionId, userId);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  };
}

export default new CustomerTransactionController();
