import { Response, NextFunction } from "express";
import agentTransactionService from "../services/agent-transaction.service";
import { successResponse, paginatedResponse, ValidationError } from "../../../shared/utils";
import { AuthRequest } from "../../../shared/middleware";
import { AgentCreateTransactionPayload, AgentTransactionExportFilters } from "../services/agent-transaction.service";

class AgentTransactionController {
  async createTransaction(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const authUser = req.user;
      if (!authUser) {
        throw new ValidationError("Authentication required");
      }

      const body = req.body as AgentCreateTransactionPayload & { userId?: string };
      if (!body.userId) {
        throw new ValidationError("userId is required (customer for whom the transaction is created)");
      }

      const payload: AgentCreateTransactionPayload = {
        userId: body.userId,
        type: body.type,
        mode: body.mode,
        currency: body.currency,
        amount: body.amount,
        purpose: body.purpose,
        destinationCountry: body.destinationCountry,
        bvn: body.bvn,
        nin: body.nin,
        formAId: body.formAId,
        taxClearanceNumber: body.taxClearanceNumber,
        admissionType: body.admissionType,
        documents: body.documents,
        beneficiaryDetails: body.beneficiaryDetails,
        pickupLocation: body.pickupLocation,
      };

      const result = await agentTransactionService.createTransaction(authUser.userId, payload);
      res.status(201).json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  async listTransactions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const authUser = req.user;
      if (!authUser) {
        throw new ValidationError("Authentication required");
      }

      const page = Math.max(1, parseInt((req.query.page as string) || "1", 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || "20", 10) || 20));

      const filters = {
        transaction_status: req.query.transaction_status as string | undefined,
        transaction_stage: req.query.transaction_stage as string | undefined,
      };

      const result = await agentTransactionService.listTransactions(
        authUser.userId,
        filters,
        page,
        limit
      );
      res.json(paginatedResponse(result.data, page, limit, result.pagination.total));
    } catch (error) {
      next(error);
    }
  }

  async getTransactionStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const authUser = req.user;
      if (!authUser) {
        throw new ValidationError("Authentication required");
      }

      const result = await agentTransactionService.getTransactionStats(authUser.userId);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  async getTransactionById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const authUser = req.user;
      if (!authUser) {
        throw new ValidationError("Authentication required");
      }

      const { transactionId } = req.params;
      if (!transactionId) {
        throw new ValidationError("transactionId is required");
      }

      const result = await agentTransactionService.getTransactionById(
        authUser.userId,
        transactionId
      );
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  async uploadDocuments(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const authUser = req.user;
      if (!authUser) {
        throw new ValidationError("Authentication required");
      }

      const { transactionId } = req.params;
      const { documentType } = req.body;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        res.status(400).json({ success: false, message: "No files provided" });
        return;
      }
      if (!documentType) {
        res.status(400).json({ success: false, message: "documentType is required" });
        return;
      }

      const result = await agentTransactionService.uploadDocuments(
        authUser.userId,
        transactionId,
        documentType,
        files
      );
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  async exportTransactions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const authUser = req.user;
      if (!authUser) {
        throw new ValidationError("Authentication required");
      }

      const filters: AgentTransactionExportFilters = {
        q: req.query.q as string | undefined,
        status: req.query.status as string | undefined,
        type: req.query.type as string | undefined,
        group: req.query.group as string | undefined,
        currency: req.query.currency as string | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
      };

      const csv = await agentTransactionService.exportTransactions(
        authUser.userId,
        filters
      );

      const filename = `transactions-agent-${Date.now()}.csv`;
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (error) {
      next(error);
    }
  }

  async recordDisbursement(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const authUser = req.user;
      if (!authUser) {
        throw new ValidationError("Authentication required");
      }

      const { transactionId } = req.params;
      const { disbursementMethod, totalAmount, notes } = req.body as {
        disbursementMethod?: string;
        totalAmount?: string | number;
        notes?: string;
      };
      const file = req.file as Express.Multer.File | undefined;

      if (!transactionId) {
        throw new ValidationError("transactionId is required");
      }
      if (!disbursementMethod) {
        throw new ValidationError("disbursementMethod is required");
      }
      if (!totalAmount) {
        throw new ValidationError("totalAmount is required");
      }
      if (!file) {
        throw new ValidationError("paymentReceipt file is required");
      }

      const amountNumber =
        typeof totalAmount === "number" ? totalAmount : Number(totalAmount);
      if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
        throw new ValidationError("totalAmount must be a positive number");
      }

      const result = await (agentTransactionService as any).recordDisbursement(authUser.userId, {
        transactionId,
        disbursementMethod: disbursementMethod as any,
        totalAmount: amountNumber,
        notes,
        receiptFile: file,
      });

      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }
}

const agentTransactionController = new AgentTransactionController();
export default agentTransactionController;
