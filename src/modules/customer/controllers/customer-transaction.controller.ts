import { Request, Response, NextFunction } from "express";
import customerTransactionService from "../services/customer-transaction.service";
import { successResponse, paginatedResponse } from "../../../shared/utils";
import { AuthRequest } from "../../../shared/middleware";

class CustomerTransactionController {
  /**
   * Create a new transaction
   */
  createTransaction = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId!;
      const payload = {
        userId,
        ...req.body,
      };

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
      const userId = req.user?.userId!;
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
      const userId = req.user?.userId!;
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
      const userId = req.user?.userId!;

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
      const userId = req.user?.userId!;
      const { transactionId } = req.params;

      const result = await customerTransactionService.getTransactionDetails(transactionId, userId);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  };
}

export default new CustomerTransactionController();
