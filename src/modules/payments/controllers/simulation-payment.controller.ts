import { Request, Response } from 'express';
import { createLogger } from '../../../shared/utils/logger';
import { AppError } from '../../../shared/utils/errors';
import { ErrorCode } from '../../../shared/types/common';
import simulationPaymentService from '../services/simulation-payment.service';

const logger = createLogger('SimulationPaymentController');

const SIMULATION_MODE = process.env.PROVIDUS_SIMULATION_MODE === 'true';

function assertSimulationMode(res: Response): boolean {
  if (!SIMULATION_MODE) {
    res.status(403).json({
      success: false,
      message: 'Simulation endpoints are only available when PROVIDUS_SIMULATION_MODE=true',
    });
    return false;
  }
  return true;
}

export class SimulationPaymentController {
  /**
   * Simulate an exact payment to a virtual account
   * POST /api/simulate/payments/exact
   */
  async simulateExactPayment(req: Request, res: Response) {
    if (!assertSimulationMode(res)) return;

    try {
      const { transactionId, sourceAccountName, sourceBankName, sourceAccountNumber } = req.body;

      if (!transactionId) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'transactionId is required', 400);
      }

      const result = await simulationPaymentService.simulateExactPayment({
        transactionId,
        sourceAccountName,
        sourceBankName,
        sourceAccountNumber,
      });

      logger.info('Exact payment simulated', { transactionId, depositId: result.depositId });

      res.status(200).json({
        success: true,
        message: 'Exact payment simulated successfully. Transaction should now be DEPOSIT_CONFIRMED.',
        data: result,
      });
    } catch (error) {
      logger.error('Error simulating exact payment', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ success: false, message: error.message });
        return;
      }
      res.status(500).json({ success: false, message: 'Failed to simulate exact payment' });
    }
  }

  /**
   * Simulate an overpayment to a virtual account
   * POST /api/simulate/payments/overpayment
   */
  async simulateOverpayment(req: Request, res: Response) {
    if (!assertSimulationMode(res)) return;

    try {
      const { transactionId, overageAmount, sourceAccountName, sourceBankName, sourceAccountNumber } = req.body;

      if (!transactionId) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'transactionId is required', 400);
      }

      if (overageAmount !== undefined && (typeof overageAmount !== 'number' || overageAmount <= 0)) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'overageAmount must be a positive number', 400);
      }

      const result = await simulationPaymentService.simulateOverpayment({
        transactionId,
        overageAmount,
        sourceAccountName,
        sourceBankName,
        sourceAccountNumber,
      });

      logger.info('Overpayment simulated', { transactionId, depositId: result.depositId });

      res.status(200).json({
        success: true,
        message: 'Overpayment simulated. Amount mismatch detected — transaction set to DEPOSIT_PENDING for admin review.',
        data: result,
      });
    } catch (error) {
      logger.error('Error simulating overpayment', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ success: false, message: error.message });
        return;
      }
      res.status(500).json({ success: false, message: 'Failed to simulate overpayment' });
    }
  }

  /**
   * Simulate a split/partial payment to a virtual account
   * POST /api/simulate/payments/split
   */
  async simulateSplitPayment(req: Request, res: Response) {
    if (!assertSimulationMode(res)) return;

    try {
      const { transactionId, splitAmount, sourceAccountName, sourceBankName, sourceAccountNumber } = req.body;

      if (!transactionId) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'transactionId is required', 400);
      }

      if (splitAmount === undefined || typeof splitAmount !== 'number' || splitAmount <= 0) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'splitAmount is required and must be a positive number', 400);
      }

      const result = await simulationPaymentService.simulateSplitPayment({
        transactionId,
        splitAmount,
        sourceAccountName,
        sourceBankName,
        sourceAccountNumber,
      });

      logger.info('Split payment simulated', { transactionId, depositId: result.depositId });

      res.status(200).json({
        success: true,
        message: 'Split payment simulated. Amount mismatch detected — transaction set to DEPOSIT_PENDING for admin review.',
        data: result,
      });
    } catch (error) {
      logger.error('Error simulating split payment', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ success: false, message: error.message });
        return;
      }
      res.status(500).json({ success: false, message: 'Failed to simulate split payment' });
    }
  }

  /**
   * Verify payment status for a transaction
   * GET /api/simulate/payments/verify/:transactionId
   */
  async verifyPayment(req: Request, res: Response) {
    if (!assertSimulationMode(res)) return;

    try {
      const { transactionId } = req.params;

      const result = await simulationPaymentService.verifyPayment(transactionId);

      const isPaid = result.transactionStatus === 'DEPOSIT_CONFIRMED';

      res.status(200).json({
        success: true,
        message: isPaid
          ? 'Payment confirmed — deposit has been verified and transaction updated.'
          : 'Payment not yet confirmed.',
        data: result,
      });
    } catch (error) {
      logger.error('Error verifying payment', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ success: false, message: error.message });
        return;
      }
      res.status(500).json({ success: false, message: 'Failed to verify payment' });
    }
  }
}

export default new SimulationPaymentController();
