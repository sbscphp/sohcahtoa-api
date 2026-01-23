import { Request, Response, NextFunction } from 'express';
import paymentService from '../services/payment.service';
import { successResponse } from '@fx-platform/shared-utils';

class PaymentController {
  async getExchangeRate(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await paymentService.getExchangeRate(req.body);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  async initiateDeposit(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await paymentService.initiateDeposit(req.body);
      res.status(201).json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  async confirmDeposit(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      const result = await paymentService.confirmDeposit(req.body, userId);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  async getSettlement(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await paymentService.getSettlement(req.params.transactionId);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  async initializePayment(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await paymentService.initiateDeposit(req.body);
      res.status(201).json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  async paymentCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      const result = await paymentService.confirmDeposit(req.body, userId);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  async getPaymentHistory(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(successResponse({ message: 'Payment history retrieved' }));
    } catch (error) {
      next(error);
    }
  }

  async getPaymentStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await paymentService.getSettlement(req.params.transactionId);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  async health(req: Request, res: Response) {
    res.json({ status: 'healthy', service: 'payment-service' });
  },
};

export default new PaymentController();
