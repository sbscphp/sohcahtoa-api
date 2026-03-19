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

  /**
   * Get all available states where pickup terminals are located
   */
  getPickupStates = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const states = await customerTransactionService.getPickupStates();
      return res.json(successResponse({ states }));
    } catch (error) {
      return next(error);
    }
  };

  /**
   * Get cities in a specific state where pickup terminals are located
   */
  getPickupCities = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { state } = req.query;

      if (!state || typeof state !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'State parameter is required',
        });
      }

      const cities = await customerTransactionService.getPickupCities(state);
      return res.json(successResponse({ state, cities }));
    } catch (error) {
      return next(error);
    }
  };

  /**
   * Get available pickup terminals filtered by state, city, date, and time
   */
  getPickupTerminals = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { state, city, pickupDate, pickupTime } = req.query;

      if (!state || typeof state !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'State parameter is required',
        });
      }

      if (!city || typeof city !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'City parameter is required',
        });
      }

      const terminals = await customerTransactionService.getPickupTerminals({
        state,
        city,
        pickupDate: pickupDate as string,
        pickupTime: pickupTime as string,
      });

      return res.json(successResponse({ terminals }));
    } catch (error) {
      return next(error);
    }
  };

  /**
   * Check if a terminal is available at a specific date and time
   */
  checkTerminalAvailability = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { terminalId, pickupDate, pickupTime } = req.query;

      if (!terminalId || typeof terminalId !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Terminal ID is required',
        });
      }

      if (!pickupDate || typeof pickupDate !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Pickup date is required',
        });
      }

      if (!pickupTime || typeof pickupTime !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Pickup time is required (HH:mm format)',
        });
      }

      const available = await customerTransactionService.checkTerminalAvailability(
        terminalId,
        pickupDate,
        pickupTime
      );

      return res.json(
        successResponse({
          terminalId,
          pickupDate,
          pickupTime,
          available,
        })
      );
    } catch (error) {
      return next(error);
    }
  };

  /**
   * Get available time slots for a terminal on a specific date
   */
  getTerminalAvailabilitySlots = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { terminalId, pickupDate } = req.query;

      if (!terminalId || typeof terminalId !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Terminal ID is required',
        });
      }

      if (!pickupDate || typeof pickupDate !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Pickup date is required',
        });
      }

      const slots = await customerTransactionService.getTerminalAvailabilitySlots(
        terminalId,
        pickupDate
      );

      return res.json(
        successResponse({
          terminalId,
          pickupDate,
          slots,
        })
      );
    } catch (error) {
      return next(error);
    }
  };

  /**
   * Get transaction totals by group (BUY, SELL, REMITTANCE)
   * All amounts converted to USD by default, with optional custom rates for unsupported currencies
   */
  getTransactionTotals = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = this.resolveUserId(req, res, false);
      if (userId === null) return;

      // Parse custom rates from request body if provided
      const customRates = req.body?.customRates as { currency: string; rate: number }[] | undefined;

      // Validate custom rates if provided
      if (customRates) {
        if (!Array.isArray(customRates)) {
          return res.status(400).json({
            success: false,
            message: 'customRates must be an array of objects with currency and rate properties',
          });
        }

        for (const customRate of customRates) {
          if (!customRate.currency || typeof customRate.currency !== 'string') {
            return res.status(400).json({
              success: false,
              message: 'Each custom rate must have a currency property (string)',
            });
          }

          if (!customRate.rate || typeof customRate.rate !== 'number' || customRate.rate <= 0) {
            return res.status(400).json({
              success: false,
              message: 'Each custom rate must have a rate property (positive number)',
            });
          }
        }
      }

      const totals = await customerTransactionService.getTotalsByGroup(userId, customRates);

      return res.json(successResponse(totals));
    } catch (error) {
      return next(error);
    }
  };
}

export default new CustomerTransactionController();
