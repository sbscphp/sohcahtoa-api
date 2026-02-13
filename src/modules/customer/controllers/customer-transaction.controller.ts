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
        return res.status(400).json({
          success: false,
          message: "No files provided",
        });
      }

      if (!documentType) {
        return res.status(400).json({
          success: false,
          message: "documentType is required",
        });
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
      const { currency } = req.query;
      const result = await customerTransactionService.getActiveRates(currency as string);
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
      const { currency, amount } = req.body;

      if (!currency || !amount) {
        return res.status(400).json({
          success: false,
          message: "currency and amount are required",
        });
      }

      const result = await customerTransactionService.calculateAmount(currency, parseFloat(amount));
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
   * Get customer's transactions
   */
  getMyTransactions = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId!;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const result = await customerTransactionService.getCustomerTransactions(userId, page, limit);
      res.json(paginatedResponse(result.data, page, limit, result.pagination.total));
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
