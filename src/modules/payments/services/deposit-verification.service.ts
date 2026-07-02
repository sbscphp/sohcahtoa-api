import { PrismaClient, ProvidusTransactionStatus } from '@prisma/client';
import { createLogger } from '../../../shared/utils/logger';
import { AppError } from '../../../shared/utils/errors';
import { ErrorCode } from '../../../shared/types/common';
import providusService from './providus.service';
import notificationService from '../../notifications/services/notification.service';
import { NotificationType, NotificationChannel } from '@prisma/client';
import walletService from '../../wallet/services/wallet.service';

const prisma = new PrismaClient();
const logger = createLogger('DepositVerificationService');

interface WebhookPayload {
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
  /**
   * Handle webhook notification from Providus
   * Called when a deposit is made to a virtual account
   */
  async handleDepositWebhook(payload: WebhookPayload) {
    try {
      logger.info('Processing deposit webhook', { payload });

      const { sessionId, accountNumber, transactionAmount, settledAmount } = payload;

      // Find virtual account
      const virtualAccount = await prisma.virtualAccount.findUnique({
        where: { accountNumber },
      });

      if (!virtualAccount) {
        logger.error('Virtual account not found for webhook', { accountNumber });
        throw new AppError(ErrorCode.NOT_FOUND, 'Virtual account not found', 404);
      }

      // Check if account is blacklisted
      if (virtualAccount.isBlacklisted) {
        logger.warn('Deposit received for blacklisted account', { accountNumber });
        throw new AppError(ErrorCode.FORBIDDEN, 'Account is blacklisted', 403);
      }

      // Check if deposit already exists
      const existingDeposit = await prisma.providusDeposit.findUnique({
        where: { sessionId },
      });

      if (existingDeposit) {
        logger.info('Deposit already processed', { sessionId });
        return existingDeposit;
      }

      // Create deposit record
      const deposit = await prisma.providusDeposit.create({
        data: {
          virtualAccountId: virtualAccount.id,
          transactionId: virtualAccount.transactionId,
          sessionId,
          settlementId: payload.settlementId,
          accountNumber,
          amount: transactionAmount,
          settledAmount,
          feeAmount: payload.feeAmount || 0,
          vatAmount: payload.vatAmount || 0,
          currency: payload.currency || 'NGN',
          sourceAccountNumber: payload.sourceAccountNumber,
          sourceAccountName: payload.sourceAccountName,
          sourceBankName: payload.sourceBankName,
          channelId: payload.channelId,
          tranRemarks: payload.tranRemarks,
          tranDateTime: payload.tranDateTime ? new Date(payload.tranDateTime) : null,
          status: ProvidusTransactionStatus.PENDING,
          webhookReceivedAt: new Date(),
          webhookPayload: payload as any,
        },
      });

      logger.info('Deposit record created', {
        depositId: deposit.id,
        sessionId,
        amount: deposit.amount,
      });

      // Verify the deposit
      await this.verifyDeposit(deposit.id);

      return deposit;
    } catch (error) {
      logger.error('Error handling deposit webhook', error);
      if (error instanceof AppError) throw error;
      throw new AppError(ErrorCode.INTERNAL_ERROR, 'Failed to process deposit webhook', 500);
    }
  }

  /**
   * Verify a deposit with Providus
   */
  async verifyDeposit(depositId: string) {
    try {
      logger.info('Verifying deposit', { depositId });

      const deposit = await prisma.providusDeposit.findUnique({
        where: { id: depositId },
        include: {
          virtualAccount: true,
        },
      });

      if (!deposit) {
        throw new AppError(ErrorCode.NOT_FOUND, 'Deposit not found', 404);
      }

      // Verify with Providus
      const verificationResult = await providusService.verifyTransactionBySessionId(
        deposit.sessionId
      );

      // Update deposit with verification results
      const updatedDeposit = await prisma.providusDeposit.update({
        where: { id: depositId },
        data: {
          status: ProvidusTransactionStatus.VERIFIED,
          settlementId: verificationResult.settlementId || deposit.settlementId,
          sourceAccountNumber:
            verificationResult.sourceAccountNumber || deposit.sourceAccountNumber,
          sourceAccountName: verificationResult.sourceAccountName || deposit.sourceAccountName,
          sourceBankName: verificationResult.sourceBankName || deposit.sourceBankName,
          verifiedAt: new Date(),
          metadata: verificationResult as any,
        },
      });

      logger.info('Deposit verified successfully', {
        depositId,
        sessionId: deposit.sessionId,
        amount: updatedDeposit.amount,
      });

      // If deposit is linked to a transaction, update transaction status
      if (deposit.transactionId) {
        await this.confirmTransactionDeposit(deposit.transactionId, depositId);
      }

      return updatedDeposit;
    } catch (error) {
      logger.error('Error verifying deposit', error);

      // Update deposit status to FAILED
      await prisma.providusDeposit.update({
        where: { id: depositId },
        data: {
          status: ProvidusTransactionStatus.FAILED,
        },
      });

      if (error instanceof AppError) throw error;
      throw new AppError(ErrorCode.INTERNAL_ERROR, 'Failed to verify deposit', 500);
    }
  }

  /**
   * Confirm deposit for a transaction
   * Updates transaction status and creates settlement record
   */
  private async confirmTransactionDeposit(transactionId: string, depositId: string) {
    try {
      logger.info('Confirming transaction deposit', { transactionId, depositId });

      const deposit = await prisma.providusDeposit.findUnique({
        where: { id: depositId },
      });

      if (!deposit) {
        throw new AppError(ErrorCode.NOT_FOUND, 'Deposit not found', 404);
      }

      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
      });

      if (!transaction) {
        throw new AppError(ErrorCode.NOT_FOUND, 'Transaction not found', 404);
      }

      // Calculate payment balance
      const expectedAmount = transaction.nairaEquivalent;
      const receivedAmount = deposit.settledAmount;

      // Accumulate total paid (handles multiple deposits / split payments)
      const previousAmountPaid = transaction.amountPaid ?? 0;
      const totalAmountPaid = Number(previousAmountPaid) + Number(receivedAmount);
      const balanceDue = expectedAmount
        ? Number(expectedAmount) - totalAmountPaid
        : null;

      const isUnderpaid = balanceDue !== null && balanceDue > 0.01;
      const isOverpaid = balanceDue !== null && balanceDue < -0.01;
      const isExact = !isUnderpaid && !isOverpaid;

      if (!isExact) {
        logger.warn(`Deposit amount ${isUnderpaid ? 'short' : 'excess'}`, {
          transactionId,
          expected: expectedAmount,
          received: receivedAmount,
          totalAmountPaid,
          balanceDue,
        });

        // Notify admin and customer of mismatch
        await notificationService.sendNotification({
          userId: transaction.userId,
          type: NotificationType.IN_APP,
          channel: NotificationChannel.ALL,
          title: isUnderpaid ? 'Deposit Underpayment' : 'Deposit Overpayment',
          body: isUnderpaid
            ? `Deposit for transaction ${transaction.referenceNumber} is short by ₦${balanceDue!.toFixed(2)}. Outstanding balance has been recorded.`
            : `Deposit for transaction ${transaction.referenceNumber} has an excess of ₦${Math.abs(balanceDue!).toFixed(2)}. The surplus has been recorded.`,
          data: {
            transactionId,
            depositId,
            expectedAmount: expectedAmount?.toString(),
            receivedAmount: receivedAmount.toString(),
            totalAmountPaid: totalAmountPaid.toString(),
            balanceDue: balanceDue?.toString(),
          },
        });
      }

      // Always update deposit status to SETTLED and persist balance on transaction
      await prisma.providusDeposit.update({
        where: { id: depositId },
        data: { status: ProvidusTransactionStatus.SETTLED },
      });

      await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          amountPaid: totalAmountPaid,
          balanceDue: balanceDue,
        },
      });

      // Create settlement record
      await prisma.settlement.create({
        data: {
          transactionId,
          amount: receivedAmount,
          currency: deposit.currency,
          status: 'CONFIRMED',
          paymentMethod: 'BANK_TRANSFER',
          paymentReference: deposit.sessionId,
          depositedAt: deposit.tranDateTime || new Date(),
          confirmedAt: new Date(),
          confirmedBy: 'SYSTEM',
          notes: isUnderpaid
            ? `Partial deposit via Providus. Session ID: ${deposit.sessionId}. Balance due: ₦${balanceDue!.toFixed(2)}`
            : isOverpaid
            ? `Deposit via Providus. Session ID: ${deposit.sessionId}. Surplus: ₦${Math.abs(balanceDue!).toFixed(2)}`
            : `Deposit verified via Providus. Session ID: ${deposit.sessionId}`,
        },
      });


      // Send notification to customer
      await notificationService.sendNotification({
        userId: transaction.userId,
        type: NotificationType.PUSH,
        channel: NotificationChannel.ALL,
        title: 'Deposit Confirmed',
        body: `Your deposit of ₦${receivedAmount} has been confirmed. Your transaction is being processed.`,
        data: {
          transactionId,
          depositId,
          amount: receivedAmount.toString(),
          actionUrl: `transactions/detail/${transactionId}`,
        },
      });

      // Wallet: credit the settled amount when deposit is confirmed. Admin approval
      // (which places the settled amount debit + fees debit) always precedes the customer deposit.
      // This credit should match the settled amount debit, making the net for transaction zero.
      // Fees remain as a separate debit (representing commission/revenue).
      const settledAmountForCredit = Number(receivedAmount); // receivedAmount is settledAmount from Providus
      const alreadyCredited = await walletService.hasCreditFor(transactionId, deposit.sessionId);
      if (!alreadyCredited) {
        await walletService.creditWallet({
          userId: transaction.userId,
          amount: settledAmountForCredit,
          transactionId,
          transactionRef: transaction.referenceNumber,
          sessionId: deposit.sessionId,
          description: `Settlement confirmed via Providus session ${deposit.sessionId} (settled: ₦${settledAmountForCredit})`,
        }).catch((err) =>
          logger.error('Wallet credit failed on deposit confirmation', { transactionId, depositId, error: err.message }),
        );
      }

      logger.info('Transaction deposit confirmed successfully', {
        transactionId,
        depositId,
        amount: receivedAmount,
      });
    } catch (error) {
      logger.error('Error confirming transaction deposit', error);
      throw error;
    }
  }

  /**
   * Manually verify a deposit by session ID
   * Used for manual reconciliation
   */
  async manualVerifyDeposit(sessionId: string) {
    try {
      logger.info('Manually verifying deposit', { sessionId });

      // Check if deposit already exists
      let deposit = await prisma.providusDeposit.findUnique({
        where: { sessionId },
        include: { virtualAccount: true },
      });

      if (deposit) {
        logger.info('Deposit already exists, re-verifying', { depositId: deposit.id });
        return await this.verifyDeposit(deposit.id);
      }

      // Verify with Providus
      const verificationResult = await providusService.verifyTransactionBySessionId(sessionId);

      // Find virtual account
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

      // Create deposit record
      deposit = await prisma.providusDeposit.create({
        data: {
          virtualAccountId: virtualAccount.id,
          transactionId: virtualAccount.transactionId,
          sessionId: verificationResult.sessionId,
          settlementId: verificationResult.settlementId,
          accountNumber: verificationResult.accountNumber,
          amount: verificationResult.transactionAmount,
          settledAmount: verificationResult.settledAmount,
          feeAmount: verificationResult.feeAmount,
          vatAmount: verificationResult.vatAmount,
          currency: verificationResult.currency,
          sourceAccountNumber: verificationResult.sourceAccountNumber,
          sourceAccountName: verificationResult.sourceAccountName,
          sourceBankName: verificationResult.sourceBankName,
          channelId: verificationResult.channelId,
          tranRemarks: verificationResult.tranRemarks,
          tranDateTime: new Date(verificationResult.tranDateTime),
          status: ProvidusTransactionStatus.VERIFIED,
          verifiedAt: new Date(),
          metadata: verificationResult as any,
        },
        include: {
          virtualAccount: true,
        },
      });

      logger.info('Manual deposit verification successful', {
        depositId: deposit?.id,
        sessionId,
      });

      // Confirm transaction deposit if applicable
      if (deposit?.transactionId) {
        await this.confirmTransactionDeposit(deposit.transactionId, deposit.id);
      }

      return deposit;
    } catch (error) {
      logger.error('Error manually verifying deposit', error);
      if (error instanceof AppError) throw error;
      throw new AppError(ErrorCode.INTERNAL_ERROR, 'Failed to manually verify deposit', 500);
    }
  }

  /**
   * Get all deposits for a transaction
   */
  async getTransactionDeposits(transactionId: string) {
    try {
      const deposits = await prisma.providusDeposit.findMany({
        where: { transactionId },
        include: {
          virtualAccount: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return deposits;
    } catch (error) {
      logger.error('Error fetching transaction deposits', error);
      throw new AppError(ErrorCode.INTERNAL_ERROR, 'Failed to fetch transaction deposits', 500);
    }
  }
}

export default new DepositVerificationService();
