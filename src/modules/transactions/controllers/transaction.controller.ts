import { Response, NextFunction } from 'express';
import transactionService from '../services/transaction.service';
import { successResponse, paginatedResponse } from '../../../shared/utils';
import { AuthRequest } from '../../../shared/middleware';
import {
  CreateTransactionRequest,
  UpdateTransactionRequest,
  DocumentUploadRequest,
} from '../../../shared/types';

export class TransactionController {
  async createTransaction(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId!;
      const data: CreateTransactionRequest = { ...req.body, userId };
      const result = await transactionService.createTransaction(data);
      res.status(201).json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  async updateTransaction(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data: UpdateTransactionRequest = { ...req.body, transactionId: id };
      const result = await transactionService.updateTransaction(data);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  async uploadDocument(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data: DocumentUploadRequest = { ...req.body, transactionId: id };
      const result = await transactionService.uploadDocument(data);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  async getTransaction(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user?.userId!;
      const result = await transactionService.getTransaction(id, userId);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  async getUserTransactions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId!;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const result = await transactionService.getUserTransactions(userId, page, limit);
      res.json(paginatedResponse(result.data, page, limit, result.pagination.total));
    } catch (error) {
      next(error);
    }
  }

  async checkLimits(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId!;
      const { type, amount } = req.body;
      const result = await transactionService.checkLimits(userId, type, amount);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  async healthCheck(req: AuthRequest, res: Response) {
    res.json({
      status: 'healthy',
      service: 'transaction-service',
      timestamp: new Date().toISOString(),
    });
  }
}

export default new TransactionController();
