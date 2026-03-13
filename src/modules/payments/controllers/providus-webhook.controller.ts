import { Request, Response } from 'express';
import { createLogger } from '../../../shared/utils/logger';
import { AppError } from '../../../shared/utils/errors';
import { ErrorCode } from '../../../shared/types/common';
import depositVerificationService from '../services/deposit-verification.service';

const logger = createLogger('ProvidusWebhookController');

export class ProvidusWebhookController {
  /**
   * Handle deposit notification webhook from Providus
   * POST /api/webhooks/providus/deposit
   */
  async handleDepositNotification(req: Request, res: Response) {
    try {
      logger.info('Received Providus deposit webhook', {
        body: req.body,
        headers: req.headers,
      });

      const payload = req.body;

      // Validate required fields
      if (!payload.sessionId || !payload.accountNumber) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          'Missing required fields: sessionId and accountNumber',
          400
        );
      }

      // Process the deposit
      const deposit = await depositVerificationService.handleDepositWebhook({
        sessionId: payload.sessionId || payload.session_id,
        accountNumber: payload.accountNumber || payload.account_number,
        tranRemarks: payload.tranRemarks || payload.tran_remarks,
        transactionAmount: parseFloat(payload.transactionAmount || payload.transaction_amount || 0),
        settledAmount: parseFloat(payload.settledAmount || payload.settled_amount || 0),
        feeAmount: parseFloat(payload.feeAmount || payload.fee_amount || 0),
        vatAmount: parseFloat(payload.vatAmount || payload.vat_amount || 0),
        currency: payload.currency || 'NGN',
        settlementId: payload.settlementId || payload.settlement_id,
        sourceAccountNumber: payload.sourceAccountNumber || payload.source_account_number,
        sourceAccountName: payload.sourceAccountName || payload.source_account_name,
        sourceBankName: payload.sourceBankName || payload.source_bank_name,
        channelId: payload.channelId || payload.channel_id,
        tranDateTime: payload.tranDateTime || payload.tran_date_time,
        initiationTranRef: payload.initiationTranRef || payload.initiation_tran_ref,
      });

      logger.info('Deposit webhook processed successfully', {
        depositId: deposit.id,
        sessionId: deposit.sessionId,
        amount: deposit.amount,
      });

      res.status(200).json({
        success: true,
        message: 'Deposit notification received and processed',
        data: {
          depositId: deposit.id,
          sessionId: deposit.sessionId,
          status: deposit.status,
        },
      });
    } catch (error) {
      logger.error('Error processing deposit webhook', error);

      // Return 200 even on error to prevent Providus from retrying
      // Log the error for manual investigation
      res.status(200).json({
        success: false,
        message: 'Deposit notification received but processing failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Handle settlement notification webhook from Providus
   * POST /api/webhooks/providus/settlement
   */
  async handleSettlementNotification(req: Request, res: Response) {
    try {
      logger.info('Received Providus settlement webhook', {
        body: req.body,
        headers: req.headers,
      });

      const payload = req.body;

      // Process similar to deposit webhook
      // This can be used for settlement confirmations

      res.status(200).json({
        success: true,
        message: 'Settlement notification received',
      });
    } catch (error) {
      logger.error('Error processing settlement webhook', error);

      res.status(200).json({
        success: false,
        message: 'Settlement notification received but processing failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Webhook health check
   * GET /api/webhooks/providus/health
   */
  async healthCheck(req: Request, res: Response) {
    res.status(200).json({
      success: true,
      message: 'Providus webhook endpoint is healthy',
      timestamp: new Date().toISOString(),
    });
  }
}

export default new ProvidusWebhookController();
