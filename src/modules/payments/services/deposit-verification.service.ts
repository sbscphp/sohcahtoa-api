import { PrismaClient, ProvidusTransactionStatus } from '@prisma/client';
import { createLogger } from '../../../shared/utils/logger';
import { AppError } from '../../../shared/utils/errors';
import { ErrorCode } from '../../../shared/types/common';
import notificationService from '../../notifications/services/notification.service';
import { NotificationType, NotificationChannel } from '@prisma/client';
import walletService from '../../wallet/services/wallet.service';
import { eventBus, EventTypes } from '../../../events/event-bus';

const prisma = new PrismaClient();
const logger = createLogger('DepositVerificationService');

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface WebhookPayload {
  sessionId: string;
  accountNumber: string;
  tranRemarks?: string;
  transactionAmount: number;
  settledAmount: number;
  feeAmount?: number;
  vatAmount?: number;
  currency?: string;
  settlementId?: string;
  sourceAccountNumber?: string;
  sourceAccountName?: string;
  sourceBankName?: string;
  channelId?: string;
  tranDateTime?: string;
  initiationTranRef?: string;
}

export class DepositVerificationService {
  private async initiateDisbursementAfterPayment(transactionId: string) {
    try {
      const { adminTransactionsService } = await import('../../admin/services/admin-transactions.service');
      await adminTransactionsService.initiateDisbursement(
        transactionId,
        'SYSTEM',
        'Disbursement automatically initiated after successful customer payment',
      );
      logger.info('Disbursement automatically initiated after payment', { transactionId });
    } catch (err: any) {
      logger.error('Automatic disbursement initiation failed after payment', {
        transactionId,
        error: err.message,
      });
    }
  }

  /**
   * Natural Providus payment flow:
   *
   *   1. Providus POSTs to /api/webhooks/providus/deposit with full payment details.
   *   2. We store the deposit record immediately (idempotent — skip if sessionId exists).
   *   3. We confirm the deposit against the linked transaction:
   *        - accumulate amountPaid, compute balanceDue
   *        - create a Settlement record
   *        - credit the customer's wallet
   *        - auto-match the CREDIT wallet entry to the earlier DEBIT entry
   *   4. We respond 200 to Providus.
   *
   * We do NOT re-call the Providus verify API here — Providus already provided all
   * data in the webhook. Manual re-verification is available via manualVerifyDeposit().
   */
  async handleDepositWebhook(payload: WebhookPayload) {
    const { sessionId, accountNumber, transactionAmount, settledAmount } = payload;

    logger.info('Processing deposit webhook', { sessionId, accountNumber, transactionAmount, settledAmount });

    // Find virtual account
    const virtualAccount = await prisma.virtualAccount.findUnique({
      where: { accountNumber },
    });

    if (!virtualAccount) {
      logger.error('Virtual account not found for webhook', { accountNumber });
      throw new AppError(ErrorCode.NOT_FOUND, 'Virtual account not found', 404);
    }

    if (virtualAccount.isBlacklisted) {
      logger.warn('Deposit received for blacklisted account', { accountNumber });
      throw new AppError(ErrorCode.FORBIDDEN, 'Account is blacklisted', 403);
    }

    // Idempotency — skip if already processed
    const existing = await prisma.providusDeposit.findUnique({ where: { sessionId } });
    if (existing) {
      logger.info('Deposit already processed', { sessionId, depositId: existing.id });
      return existing;
    }

    // Persist the deposit record (status: VERIFIED — Providus already confirmed it)
    const deposit = await prisma.providusDeposit.create({
      data: {
        virtualAccountId:    virtualAccount.id,
        transactionId:       virtualAccount.transactionId,
        sessionId,
        settlementId:        payload.settlementId,
        accountNumber,
        amount:              transactionAmount,
        settledAmount,
        feeAmount:           payload.feeAmount  ?? 0,
        vatAmount:           payload.vatAmount  ?? 0,
        currency:            payload.currency   ?? 'NGN',
        sourceAccountNumber: payload.sourceAccountNumber,
        sourceAccountName:   payload.sourceAccountName,
        sourceBankName:      payload.sourceBankName,
        channelId:           payload.channelId,
        tranRemarks:         payload.tranRemarks,
        tranDateTime:        payload.tranDateTime ? new Date(payload.tranDateTime) : null,
        // Providus webhook = data already confirmed by the bank; mark VERIFIED immediately
        status:              ProvidusTransactionStatus.VERIFIED,
        verifiedAt:          new Date(),
        webhookReceivedAt:   new Date(),
        webhookPayload:      payload as any,
      },
    });

    logger.info('Deposit record created', { depositId: deposit.id, sessionId, amount: transactionAmount });

    // Confirm deposit and link wallet entries
    if (deposit.transactionId) {
      await this.confirmTransactionDeposit(deposit.transactionId, deposit.id);
    }

    return deposit;
  }

  /**
   * Confirm a deposit against its transaction:
   *   - updates amountPaid / balanceDue on the transaction
   *   - creates a Settlement record
   *   - credits the customer's wallet (idempotent)
   *   - auto-matches the CREDIT wallet entry to the DEBIT entry
   */
  private async confirmTransactionDeposit(transactionId: string, depositId: string) {
    logger.info('Confirming transaction deposit', { transactionId, depositId });

    const [deposit, transaction] = await Promise.all([
      prisma.providusDeposit.findUnique({ where: { id: depositId } }),
      prisma.transaction.findUnique({ where: { id: transactionId } }),
    ]);

    if (!deposit)      throw new AppError(ErrorCode.NOT_FOUND, 'Deposit not found', 404);
    if (!transaction)  throw new AppError(ErrorCode.NOT_FOUND, 'Transaction not found', 404);

    // ── Payment amount reconciliation ────────────────────────────────────────
    const expectedAmount   = Number(transaction.nairaEquivalent ?? 0);
    const receivedAmount   = Number(deposit.settledAmount);
    const previousPaid     = Number(transaction.amountPaid ?? 0);
    const totalAmountPaid  = previousPaid + receivedAmount;
    const balanceDue       = expectedAmount ? expectedAmount - totalAmountPaid : null;

    const isUnderpaid = balanceDue !== null && balanceDue >  0.01;
    const isOverpaid  = balanceDue !== null && balanceDue < -0.01;
    const shouldUpdateStep = ['AWAITING_DEPOSIT', 'DEPOSIT_PENDING'].includes(transaction.status);

    // ── Auto-reversal on mismatch ─────────────────────────────────────────────
    if (isUnderpaid) {
      logger.warn('Underpayment detected — reversing deposit', {
        transactionId, expectedAmount, receivedAmount, balanceDue,
      });

      const updates: any[] = [
        prisma.providusDeposit.update({
          where: { id: depositId },
          data:  { status: 'REVERSED' as any },
        }),
        prisma.settlement.create({
          data: {
            transactionId,
            amount:           receivedAmount,
            currency:         deposit.currency,
            status:           'REFUNDED',
            paymentMethod:    'BANK_TRANSFER',
            paymentReference: deposit.sessionId,
            depositedAt:      deposit.tranDateTime ?? new Date(),
            confirmedAt:      new Date(),
            confirmedBy:      'SYSTEM',
            notes: `Underpayment reversed via Providus. Session: ${deposit.sessionId}. Expected: ₦${expectedAmount.toFixed(2)}, Received: ₦${receivedAmount.toFixed(2)}.`,
          },
        })
      ];

      if (shouldUpdateStep) {
        updates.push(
          prisma.transaction.update({
            where: { id: transactionId },
            data:  { status: 'AWAITING_DEPOSIT' as any },
          })
        );
      }

      await Promise.all(updates);

      notificationService.sendNotification({
        userId:  transaction.userId,
        type:    NotificationType.PUSH,
        channel: NotificationChannel.ALL,
        title:   'Deposit Reversed — Incorrect Amount',
        body:    `Your deposit of ₦${receivedAmount.toLocaleString()} for transaction ${transaction.referenceNumber} was reversed because it did not match the required amount of ₦${expectedAmount.toLocaleString()}. Please deposit the exact amount.`,
        data: {
          transactionId,
          depositId,
          expectedAmount:  expectedAmount.toString(),
          receivedAmount:  receivedAmount.toString(),
          actionUrl:       `transactions/detail/${transactionId}`,
        },
      }).catch((err: Error) =>
        logger.error('Underpayment reversal notification failed', { transactionId, error: err.message })
      );

      eventBus.publish(EventTypes.TRANSACTION_REVERSED, {
        userId: transaction.userId,
        transaction: { id: transactionId, referenceNumber: transaction.referenceNumber },
        reason: `Deposit of ₦${receivedAmount.toLocaleString()} did not match the required amount of ₦${expectedAmount.toLocaleString()}.`,
      });

      logger.info('Underpayment reversed', { transactionId, depositId, expectedAmount, receivedAmount });
      return;
    }

    if (isOverpaid) {
      const excessAmount = Math.abs(balanceDue!);
      logger.warn('Overpayment detected — crediting exact amount and reversing excess', {
        transactionId, expectedAmount, receivedAmount, excessAmount,
      });

      await Promise.all([
        prisma.providusDeposit.update({
          where: { id: depositId },
          data:  { status: 'REVERSED' as any },
        }),
        prisma.transaction.update({
          where: { id: transactionId },
          data:  { 
            amountPaid: expectedAmount, 
            balanceDue: 0,
            ...(shouldUpdateStep ? {
              status: 'DEPOSIT_CONFIRMED' as any,
              currentStep: 'DEPOSIT_CONFIRMATION' as any
            } : {})
          },
        }),
        // Confirmed settlement for only the expected amount
        prisma.settlement.create({
          data: {
            transactionId,
            amount:           expectedAmount,
            currency:         deposit.currency,
            status:           'CONFIRMED',
            paymentMethod:    'BANK_TRANSFER',
            paymentReference: deposit.sessionId,
            depositedAt:      deposit.tranDateTime ?? new Date(),
            confirmedAt:      new Date(),
            confirmedBy:      'SYSTEM',
            notes: `Overpayment via Providus. Session: ${deposit.sessionId}. Received ₦${receivedAmount.toFixed(2)}, credited ₦${expectedAmount.toFixed(2)}, excess ₦${excessAmount.toFixed(2)} reversed.`,
          },
        }),
      ]);

      await this.initiateDisbursementAfterPayment(transactionId);

      // Credit only the expected amount to the wallet (PENDING until bank confirms)
      const alreadyCredited = await walletService.hasCreditFor(transactionId, deposit.sessionId);
      if (!alreadyCredited) {
        try {
          const { entry: creditEntry } = await walletService.creditWallet({
            userId:         transaction.userId,
            amount:         expectedAmount,
            transactionId,
            transactionRef: transaction.referenceNumber,
            sessionId:      deposit.sessionId,
            description:    `Deposit received via Providus (overpayment adjusted) | session ${deposit.sessionId} | credited ₦${expectedAmount}`,
            status:         'PENDING',
          });

          // Simulate bank settlement confirmation delay before marking COMPLETED + MATCHED
          await sleep(3000);
          await this.matchWalletEntries(transactionId, creditEntry.id);
        } catch (err: any) {
          logger.error('Wallet credit failed on overpayment confirmation', {
            transactionId, depositId, error: err.message,
          });
        }
      }

      notificationService.sendNotification({
        userId:  transaction.userId,
        type:    NotificationType.PUSH,
        channel: NotificationChannel.ALL,
        title:   'Deposit Received — Excess Reversed',
        body:    `Your deposit for transaction ${transaction.referenceNumber} was received. The required amount of ₦${expectedAmount.toLocaleString()} has been applied. The excess of ₦${excessAmount.toLocaleString()} will be reversed to your source account.`,
        data: {
          transactionId,
          depositId,
          expectedAmount:  expectedAmount.toString(),
          receivedAmount:  receivedAmount.toString(),
          excessAmount:    excessAmount.toString(),
          actionUrl:       `transactions/detail/${transactionId}`,
        },
      }).catch((err: Error) =>
        logger.error('Overpayment reversal notification failed', { transactionId, error: err.message })
      );

      eventBus.publish(EventTypes.TRANSACTION_REVERSED, {
        userId: transaction.userId,
        transaction: { id: transactionId, referenceNumber: transaction.referenceNumber },
        reason: `Excess deposit of ₦${excessAmount.toLocaleString()} will be reversed to your source account.`,
      });

      logger.info('Overpayment processed — excess reversed', { transactionId, depositId, expectedAmount, excessAmount });
      return;
    }

    // ── Exact payment — persist confirmed state ───────────────────────────────
    await Promise.all([
      prisma.providusDeposit.update({
        where: { id: depositId },
        data:  { status: ProvidusTransactionStatus.SETTLED },
      }),
      prisma.transaction.update({
        where: { id: transactionId },
        data:  { 
          amountPaid: totalAmountPaid, 
          balanceDue,
          ...(shouldUpdateStep ? {
            status: 'DEPOSIT_CONFIRMED' as any,
            currentStep: 'DEPOSIT_CONFIRMATION' as any
          } : {})
        },
      }),
      prisma.settlement.create({
        data: {
          transactionId,
          amount:           receivedAmount,
          currency:         deposit.currency,
          status:           'CONFIRMED',
          paymentMethod:    'BANK_TRANSFER',
          paymentReference: deposit.sessionId,
          depositedAt:      deposit.tranDateTime ?? new Date(),
          confirmedAt:      new Date(),
          confirmedBy:      'SYSTEM',
          notes:            `Deposit confirmed via Providus. Session: ${deposit.sessionId}`,
        },
      }),
    ]);

    await this.initiateDisbursementAfterPayment(transactionId);

    // ── Wallet credit (PENDING) + bank confirmation (MATCHED) ───────────────
    const alreadyCredited = await walletService.hasCreditFor(transactionId, deposit.sessionId);
    if (!alreadyCredited) {
      try {
        const { entry: creditEntry } = await walletService.creditWallet({
          userId:         transaction.userId,
          amount:         receivedAmount,
          transactionId,
          transactionRef: transaction.referenceNumber,
          sessionId:      deposit.sessionId,
          description:    `Deposit received via Providus | session ${deposit.sessionId} | ₦${receivedAmount}`,
          status:         'PENDING',
        });

        // Simulate bank settlement confirmation delay before marking COMPLETED + MATCHED
        await sleep(3000);
        await this.matchWalletEntries(transactionId, creditEntry.id);
      } catch (err: any) {
        logger.error('Wallet credit failed on deposit confirmation', {
          transactionId, depositId, error: err.message,
        });
      }
    }

    // ── Customer notification ────────────────────────────────────────────────
    notificationService.sendNotification({
      userId:  transaction.userId,
      type:    NotificationType.PUSH,
      channel: NotificationChannel.ALL,
      title:   'Deposit Confirmed',
      body:    `Your deposit of ₦${receivedAmount.toLocaleString()} has been confirmed. Your transaction is being processed.`,
      data: {
        transactionId,
        depositId,
        amount:    receivedAmount.toString(),
        actionUrl: `transactions/detail/${transactionId}`,
      },
    }).catch((err: Error) =>
      logger.error('Deposit confirmation notification failed', { transactionId, error: err.message })
    );

    logger.info('Transaction deposit confirmed', { transactionId, depositId, receivedAmount });
  }

  /**
   * Bank (Providus) has confirmed the deposit settlement — promote the PENDING CREDIT
   * entry to COMPLETED + MATCHED. The corresponding DEBIT is created separately when
   * the agent confirms cash disbursement to the customer.
   */
  private async matchWalletEntries(transactionId: string, creditEntryId: string) {
    try {
      const creditEntry = await (prisma as any).walletEntry.findUnique({
        where: { id: creditEntryId },
        select: { sessionId: true },
      });

      if (!creditEntry?.sessionId) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Wallet credit cannot be matched without a payment session ID', 400);
      }

      const providusService = (await import('./providus.service')).default;
      const verification = await providusService.verifyTransactionBySessionId(creditEntry.sessionId);
      if (!verification.sessionId || verification.tranRemarks === 'Transaction not found!!!') {
        throw new AppError(ErrorCode.EXTERNAL_SERVICE_ERROR, 'Payment session could not be verified', 502);
      }

      await walletService.markCreditConfirmed(creditEntryId);

      logger.info('Wallet credit confirmed by bank', {
        transactionId,
        creditEntryId,
        sessionId: verification.sessionId,
      });
    } catch (err: any) {
      // Non-fatal — matching failure doesn't affect the payment itself
      logger.error('Failed to confirm wallet credit', { transactionId, creditEntryId, error: err.message });
    }
  }

  /**
   * Manually re-verify a deposit by session ID against the Providus API.
   * Used for admin reconciliation when a webhook was missed or failed.
   */
  async manualVerifyDeposit(sessionId: string) {
    logger.info('Manually verifying deposit', { sessionId });

    // Re-use existing deposit if present
    const existing = await prisma.providusDeposit.findUnique({
      where: { sessionId },
      include: { virtualAccount: true },
    });

    if (existing) {
      logger.info('Deposit already exists — confirming transaction if not yet done', { depositId: existing.id });
      if (existing.transactionId) {
        await this.confirmTransactionDeposit(existing.transactionId, existing.id);
      }
      return existing;
    }

    // Not found locally — query Providus directly
    const providusService = (await import('./providus.service')).default;
    const verificationResult = await providusService.verifyTransactionBySessionId(sessionId);

    const virtualAccount = await prisma.virtualAccount.findUnique({
      where: { accountNumber: verificationResult.accountNumber },
    });

    if (!virtualAccount) {
      throw new AppError(
        ErrorCode.NOT_FOUND,
        `Virtual account not found: ${verificationResult.accountNumber}`,
        404
      );
    }

    const deposit = await prisma.providusDeposit.create({
      data: {
        virtualAccountId:    virtualAccount.id,
        transactionId:       virtualAccount.transactionId,
        sessionId:           verificationResult.sessionId,
        settlementId:        verificationResult.settlementId,
        accountNumber:       verificationResult.accountNumber,
        amount:              verificationResult.transactionAmount,
        settledAmount:       verificationResult.settledAmount,
        feeAmount:           verificationResult.feeAmount,
        vatAmount:           verificationResult.vatAmount,
        currency:            verificationResult.currency,
        sourceAccountNumber: verificationResult.sourceAccountNumber,
        sourceAccountName:   verificationResult.sourceAccountName,
        sourceBankName:      verificationResult.sourceBankName,
        channelId:           verificationResult.channelId,
        tranRemarks:         verificationResult.tranRemarks,
        tranDateTime:        new Date(verificationResult.tranDateTime),
        status:              ProvidusTransactionStatus.VERIFIED,
        verifiedAt:          new Date(),
        metadata:            verificationResult as any,
      },
    });

    logger.info('Manual deposit verification successful', { depositId: deposit.id, sessionId });

    if (deposit.transactionId) {
      await this.confirmTransactionDeposit(deposit.transactionId, deposit.id);
    }

    return deposit;
  }

  /**
   * Get all deposits for a transaction.
   */
  async getTransactionDeposits(transactionId: string) {
    return prisma.providusDeposit.findMany({
      where:   { transactionId },
      include: { virtualAccount: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export default new DepositVerificationService();
