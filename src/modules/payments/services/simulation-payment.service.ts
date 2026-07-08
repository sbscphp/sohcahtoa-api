import { PrismaClient } from '@prisma/client';
import { createLogger } from '../../../shared/utils/logger';
import { AppError } from '../../../shared/utils/errors';
import { ErrorCode } from '../../../shared/types/common';
import depositVerificationService from './deposit-verification.service';

const prisma = new PrismaClient();
const logger = createLogger('SimulationPaymentService');

// Providus fee rate used in simulation (matches existing simulateVerifyTransaction)
const FEE_RATE = 0.015; // 1.5%

function generateSimSessionId(): string {
  return `SIM_SESSION_${Date.now()}_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
}

function generateSimSettlementId(): string {
  return `SIM_SETTLE_${Date.now()}_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
}

function computeFees(amount: number): { settledAmount: number; feeAmount: number; vatAmount: number } {
  const feeAmount = parseFloat((amount * FEE_RATE).toFixed(2));
  const vatAmount = 0;
  const settledAmount = parseFloat((amount - feeAmount - vatAmount).toFixed(2));
  return { settledAmount, feeAmount, vatAmount };
}

interface SimulatePaymentOptions {
  transactionId: string;
  sourceAccountName?: string;
  sourceBankName?: string;
  sourceAccountNumber?: string;
}

export class SimulationPaymentService {
  /**
   * Resolve the virtual account for a transaction.
   * Throws if simulation mode is off, no virtual account exists, or
   * the account is blacklisted / expired.
   */
  private async resolveVirtualAccount(transactionId: string) {
    const virtualAccount = await prisma.virtualAccount.findUnique({
      where: { transactionId },
    });

    if (!virtualAccount) {
      throw new AppError(
        ErrorCode.NOT_FOUND,
        'No virtual account found for this transaction. Create one first.',
        404
      );
    }

    if (virtualAccount.isBlacklisted) {
      throw new AppError(ErrorCode.FORBIDDEN, 'Virtual account is blacklisted', 403);
    }

    if (virtualAccount.expiresAt && virtualAccount.expiresAt < new Date()) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Virtual account has expired', 400);
    }

    return virtualAccount;
  }

  /**
   * Resolve expected naira amount for a transaction.
   */
  private async resolveExpectedAmount(transactionId: string): Promise<number> {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      select: { nairaEquivalent: true, status: true },
    });

    if (!transaction) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Transaction not found', 404);
    }

    if (transaction.status !== 'AWAITING_DEPOSIT') {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        `Transaction is not awaiting deposit (current status: ${transaction.status})`,
        400
      );
    }

    if (!transaction.nairaEquivalent) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Transaction has no naira equivalent set',
        400
      );
    }

    return parseFloat(transaction.nairaEquivalent.toString());
  }

  /**
   * Simulate an exact payment — amount matches the transaction naira equivalent.
   */
  async simulateExactPayment(options: SimulatePaymentOptions) {
    logger.info('Simulating exact payment', { transactionId: options.transactionId });

    const virtualAccount = await this.resolveVirtualAccount(options.transactionId);
    const expectedAmount = await this.resolveExpectedAmount(options.transactionId);
    const feeAmount = parseFloat((expectedAmount * FEE_RATE).toFixed(2));
    const settledAmount = expectedAmount;
    const transactionAmount = parseFloat((expectedAmount + feeAmount).toFixed(2));
    const vatAmount = 0;

    const payload = {
      sessionId: generateSimSessionId(),
      settlementId: generateSimSettlementId(),
      accountNumber: virtualAccount.accountNumber,
      transactionAmount,
      settledAmount,
      feeAmount,
      vatAmount,
      currency: 'NGN',
      sourceAccountNumber: options.sourceAccountNumber || '1234567890',
      sourceAccountName: options.sourceAccountName || 'Simulated Sender',
      sourceBankName: options.sourceBankName || 'Simulated Bank',
      channelId: 'WEB',
      tranRemarks: 'Simulated exact payment',
      tranDateTime: new Date().toISOString(),
    };

    logger.info('SIMULATION: Exact payment webhook payload', payload);
    const deposit = await depositVerificationService.handleDepositWebhook(payload);

    const updatedTx = await prisma.transaction.findUnique({
      where: { id: options.transactionId },
      select: { status: true },
    });

    return {
      type: 'exact',
      expectedAmount,
      transactionAmount: expectedAmount,
      settledAmount,
      feeAmount,
      sessionId: payload.sessionId,
      depositId: deposit.id,
      status: deposit.status,
      transactionStatus: updatedTx?.status || 'UNKNOWN',
    };
  }

  /**
   * Simulate an overpayment — amount exceeds the transaction naira equivalent.
   */
  async simulateOverpayment(options: SimulatePaymentOptions & { overageAmount?: number }) {
    logger.info('Simulating overpayment', { transactionId: options.transactionId });

    const virtualAccount = await this.resolveVirtualAccount(options.transactionId);
    const expectedAmount = await this.resolveExpectedAmount(options.transactionId);

    const overageAmount = options.overageAmount ?? parseFloat((expectedAmount * 0.1).toFixed(2)); // default +10%
    const transactionAmount = parseFloat((expectedAmount + overageAmount).toFixed(2));
    const { settledAmount, feeAmount, vatAmount } = computeFees(transactionAmount);

    const payload = {
      sessionId: generateSimSessionId(),
      settlementId: generateSimSettlementId(),
      accountNumber: virtualAccount.accountNumber,
      transactionAmount,
      settledAmount,
      feeAmount,
      vatAmount,
      currency: 'NGN',
      sourceAccountNumber: options.sourceAccountNumber || '1234567890',
      sourceAccountName: options.sourceAccountName || 'Simulated Sender',
      sourceBankName: options.sourceBankName || 'Simulated Bank',
      channelId: 'WEB',
      tranRemarks: `Simulated overpayment (excess: ₦${overageAmount})`,
      tranDateTime: new Date().toISOString(),
    };

    logger.info('SIMULATION: Overpayment webhook payload', payload);
    const deposit = await depositVerificationService.handleDepositWebhook(payload);

    const updatedTx = await prisma.transaction.findUnique({
      where: { id: options.transactionId },
      select: { status: true },
    });

    return {
      type: 'overpayment',
      expectedAmount,
      overageAmount,
      transactionAmount,
      settledAmount,
      feeAmount,
      sessionId: payload.sessionId,
      depositId: deposit.id,
      status: deposit.status,
      transactionStatus: updatedTx?.status || 'UNKNOWN',
    };
  }

  /**
   * Simulate a split/partial payment — amount is less than the transaction naira equivalent.
   */
  async simulateSplitPayment(options: SimulatePaymentOptions & { splitAmount: number }) {
    logger.info('Simulating split payment', { transactionId: options.transactionId });

    if (options.splitAmount <= 0) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'splitAmount must be greater than 0', 400);
    }

    const virtualAccount = await this.resolveVirtualAccount(options.transactionId);
    const expectedAmount = await this.resolveExpectedAmount(options.transactionId);

    if (options.splitAmount >= expectedAmount) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        `splitAmount (${options.splitAmount}) must be less than expected amount (${expectedAmount}) for a split payment. Use exact or overpayment endpoints instead.`,
        400
      );
    }

    const { settledAmount, feeAmount, vatAmount } = computeFees(options.splitAmount);

    const payload = {
      sessionId: generateSimSessionId(),
      settlementId: generateSimSettlementId(),
      accountNumber: virtualAccount.accountNumber,
      transactionAmount: options.splitAmount,
      settledAmount,
      feeAmount,
      vatAmount,
      currency: 'NGN',
      sourceAccountNumber: options.sourceAccountNumber || '1234567890',
      sourceAccountName: options.sourceAccountName || 'Simulated Sender',
      sourceBankName: options.sourceBankName || 'Simulated Bank',
      channelId: 'WEB',
      tranRemarks: `Simulated split payment (${options.splitAmount} of ${expectedAmount})`,
      tranDateTime: new Date().toISOString(),
    };

    logger.info('SIMULATION: Split payment webhook payload', payload);
    const deposit = await depositVerificationService.handleDepositWebhook(payload);

    const updatedTx = await prisma.transaction.findUnique({
      where: { id: options.transactionId },
      select: { status: true },
    });

    // Underpayment: transaction remains AWAITING_DEPOSIT until balance is settled
    return {
      type: 'split',
      expectedAmount,
      splitAmount: options.splitAmount,
      shortfall: parseFloat((expectedAmount - options.splitAmount).toFixed(2)),
      transactionAmount: options.splitAmount,
      settledAmount,
      feeAmount,
      sessionId: payload.sessionId,
      depositId: deposit.id,
      status: deposit.status,
      transactionStatus: updatedTx?.status || 'UNKNOWN',
    };
  }

  /**
   * Verify the payment status for a transaction — returns all deposit records.
   */
  async verifyPayment(transactionId: string) {
    logger.info('Verifying simulation payment status', { transactionId });

    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      select: {
        id: true,
        referenceNumber: true,
        status: true,
        nairaEquivalent: true,
      },
    });

    if (!transaction) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Transaction not found', 404);
    }

    const deposits = await depositVerificationService.getTransactionDeposits(transactionId);

    const latestDeposit = deposits[0] ?? null;

    return {
      transactionId,
      referenceNumber: transaction.referenceNumber,
      transactionStatus: transaction.status,
      expectedAmount: transaction.nairaEquivalent,
      depositCount: deposits.length,
      latestDeposit: latestDeposit
        ? {
            depositId: latestDeposit.id,
            sessionId: latestDeposit.sessionId,
            status: latestDeposit.status,
            transactionAmount: latestDeposit.amount,
            settledAmount: latestDeposit.settledAmount,
            feeAmount: latestDeposit.feeAmount,
            sourceAccountName: latestDeposit.sourceAccountName,
            sourceBankName: latestDeposit.sourceBankName,
            tranDateTime: latestDeposit.tranDateTime,
            verifiedAt: latestDeposit.verifiedAt,
          }
        : null,
      allDeposits: deposits.map((d) => ({
        depositId: d.id,
        sessionId: d.sessionId,
        status: d.status,
        transactionAmount: d.amount,
        settledAmount: d.settledAmount,
        createdAt: d.createdAt,
      })),
    };
  }
}

export default new SimulationPaymentService();
