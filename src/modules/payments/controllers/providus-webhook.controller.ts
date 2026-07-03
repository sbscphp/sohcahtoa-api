import { Request, Response } from 'express';
import crypto from 'crypto';
import { createLogger } from '../../../shared/utils/logger';
import depositVerificationService from '../services/deposit-verification.service';

const logger = createLogger('ProvidusWebhookController');

/**
 * Verify the Providus webhook signature.
 * Providus signs every webhook body with HMAC-SHA512 using your Client Secret.
 * The signature is sent in the X-Auth-Signature header.
 *
 * If PROVIDUS_CLIENT_SECRET is not configured, verification is skipped (dev/staging).
 */
function verifyProvidusSignature(rawBody: string, signature: string | undefined): boolean {
  const secret = process.env.PROVIDUS_CLIENT_SECRET;
  if (!secret) {
    logger.warn('PROVIDUS_CLIENT_SECRET not set — skipping webhook signature verification');
    return true;
  }
  if (!signature) {
    return false;
  }
  const expected = crypto
    .createHmac('sha512', secret)
    .update(rawBody)
    .digest('hex')
    .toUpperCase();

  try {
    return crypto.timingSafeEqual(Buffer.from(signature.toUpperCase()), Buffer.from(expected));
  } catch {
    return false;
  }
}

export class ProvidusWebhookController {
  /**
   * Handle deposit notification webhook from Providus Bank.
   * POST /api/webhooks/providus/deposit
   *
   * Providus sends this when a customer deposits to a virtual account.
   * The payload already contains all payment details — we do NOT need to
   * re-call the Providus verification API. We only re-verify for manual
   * reconciliation or when the settled amount is missing from the payload.
   */
  async handleDepositNotification(req: Request, res: Response) {
    // Always respond 200 immediately — Providus retries if we return non-2xx.
    // Processing errors are logged for manual investigation.
    const respondOk = (ok: boolean, message: string, extra?: object) => {
      res.status(200).json({ success: ok, message, ...extra });
    };

    try {
      logger.info('Received Providus deposit webhook', {
        headers: req.headers,
        body: req.body,
      });

      // ── Signature verification ───────────────────────────────────────────
      const rawBody =
        (req as any).rawBody ??                     // populated by express raw-body middleware
        JSON.stringify(req.body);                    // fallback

      const signature =
        (req.headers['x-auth-signature'] as string | undefined) ??
        (req.headers['x-primus-signature'] as string | undefined);

      if (!verifyProvidusSignature(rawBody, signature)) {
        logger.error('Providus webhook signature verification failed', {
          signature,
          accountNumber: req.body?.accountNumber,
        });
        // Return 200 so Providus doesn't retry; we reject it silently.
        return respondOk(false, 'Signature verification failed');
      }

      // ── Field normalisation (Providus sends camelCase and snake_case) ────
      const p = req.body;
      const sessionId      = p.sessionId      ?? p.session_id;
      const accountNumber  = p.accountNumber  ?? p.account_number;

      if (!sessionId || !accountNumber) {
        logger.error('Providus webhook missing required fields', { body: p });
        return respondOk(false, 'Missing required fields: sessionId and accountNumber');
      }

      const payload = {
        sessionId,
        accountNumber,
        tranRemarks:         p.tranRemarks          ?? p.tran_remarks,
        transactionAmount:   parseFloat(p.transactionAmount   ?? p.transaction_amount   ?? 0),
        settledAmount:       parseFloat(p.settledAmount        ?? p.settled_amount        ?? 0),
        feeAmount:           parseFloat(p.feeAmount            ?? p.fee_amount            ?? 0),
        vatAmount:           parseFloat(p.vatAmount            ?? p.vat_amount            ?? 0),
        currency:            p.currency ?? 'NGN',
        settlementId:        p.settlementId         ?? p.settlement_id,
        sourceAccountNumber: p.sourceAccountNumber  ?? p.source_account_number,
        sourceAccountName:   p.sourceAccountName    ?? p.source_account_name,
        sourceBankName:      p.sourceBankName       ?? p.source_bank_name,
        channelId:           p.channelId            ?? p.channel_id,
        tranDateTime:        p.tranDateTime         ?? p.tran_date_time,
        initiationTranRef:   p.initiationTranRef    ?? p.initiation_tran_ref,
      };

      const deposit = await depositVerificationService.handleDepositWebhook(payload);

      logger.info('Deposit webhook processed successfully', {
        depositId: deposit.id,
        sessionId: deposit.sessionId,
        amount: deposit.amount,
      });

      return respondOk(true, 'Deposit notification received and processed', {
        data: {
          depositId: deposit.id,
          sessionId: deposit.sessionId,
          status: deposit.status,
        },
      });
    } catch (error) {
      logger.error('Error processing Providus deposit webhook', error);
      return respondOk(false, 'Deposit notification received but processing failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Handle settlement notification webhook from Providus Bank.
   * POST /api/webhooks/providus/settlement
   */
  async handleSettlementNotification(req: Request, res: Response) {
    logger.info('Received Providus settlement webhook', { body: req.body });
    res.status(200).json({ success: true, message: 'Settlement notification received' });
  }

  /**
   * Webhook health check.
   * GET /api/webhooks/providus/health
   */
  async healthCheck(_req: Request, res: Response) {
    res.status(200).json({
      success: true,
      message: 'Providus webhook endpoint is healthy',
      timestamp: new Date().toISOString(),
    });
  }
}

export default new ProvidusWebhookController();
