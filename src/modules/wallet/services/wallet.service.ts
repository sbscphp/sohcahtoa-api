import { getDatabase } from '../../../config/database';
import { createLogger } from '../../../shared/utils/logger';
import { NotFoundError, ValidationError } from '../../../shared/utils/errors';

const prisma = getDatabase();
const logger = createLogger('WalletService');

export class WalletService {
  /**
   * Create a wallet for a newly registered customer.
   * Safe to call multiple times — silently returns existing wallet.
   */
  async createWallet(userId: string) {
    const existing = await (prisma as any).customerWallet.findUnique({
      where: { userId },
    });

    if (existing) return existing;

    const wallet = await (prisma as any).customerWallet.create({
      data: { userId },
    });

    logger.info('Wallet created', { userId, walletId: wallet.id });
    return wallet;
  }

  /**
   * Debit the wallet when admin gives final approval on a transaction.
   * Amount is the nairaEquivalent of the transaction.
   */
  async debitWallet(params: {
    userId: string;
    amount: number;
    transactionId: string;
    transactionRef: string;
    sessionId?: string;
    description?: string;
  }) {
    const { userId, amount, transactionId, transactionRef, sessionId, description } = params;

    if (amount <= 0) {
      throw new ValidationError('Debit amount must be greater than zero');
    }

    const wallet = await this.ensureWallet(userId);

    const balanceBefore = Number(wallet.balance);
    const balanceAfter = balanceBefore - amount;

    const [updatedWallet, entry] = await (prisma as any).$transaction([
      (prisma as any).customerWallet.update({
        where: { id: wallet.id },
        data: { balance: balanceAfter },
      }),
      (prisma as any).walletEntry.create({
        data: {
          walletId: wallet.id,
          transactionId,
          transactionRef,
          sessionId: sessionId ?? null,
          type: 'DEBIT',
          amount,
          balanceBefore,
          balanceAfter,
          description: description ?? `Debit for transaction ${transactionRef}`,
          status: 'COMPLETED',
          matchStatus: transactionId ? 'MATCHED' : 'UNMATCHED',
          linkedTransactionId: transactionId ?? null,
        },
      }),
    ]);

    logger.info('Wallet debited', {
      walletId: wallet.id,
      userId,
      transactionId,
      amount,
      balanceBefore,
      balanceAfter,
    });

    return { wallet: updatedWallet, entry };
  }

  /**
   * Credit the wallet when a Providus deposit is received for a transaction.
   * status defaults to 'COMPLETED'; pass 'PENDING' when the deposit is received but
   * not yet fully bank-confirmed — call markCreditConfirmed() once confirmed.
   */
  async creditWallet(params: {
    userId: string;
    amount: number;
    transactionId: string;
    transactionRef: string;
    sessionId?: string;
    description?: string;
    status?: 'PENDING' | 'COMPLETED';
    matchStatus?: 'UNMATCHED' | 'MATCHED';
  }) {
    const { userId, amount, transactionId, transactionRef, sessionId, description, status = 'COMPLETED', matchStatus = 'UNMATCHED' } = params;

    if (amount <= 0) {
      throw new ValidationError('Credit amount must be greater than zero');
    }

    const wallet = await this.ensureWallet(userId);

    const balanceBefore = Number(wallet.balance);
    const balanceAfter = balanceBefore + amount;

    const [updatedWallet, entry] = await (prisma as any).$transaction([
      (prisma as any).customerWallet.update({
        where: { id: wallet.id },
        data: { balance: balanceAfter },
      }),
      (prisma as any).walletEntry.create({
        data: {
          walletId: wallet.id,
          transactionId,
          transactionRef,
          sessionId: sessionId ?? null,
          type: 'CREDIT',
          amount,
          balanceBefore,
          balanceAfter,
          description: description ?? `Credit for transaction ${transactionRef}`,
          status,
          matchStatus: transactionId ? 'MATCHED' : matchStatus,
          linkedTransactionId: transactionId ?? null,
        },
      }),
    ]);

    logger.info('Wallet credited', {
      walletId: wallet.id,
      userId,
      transactionId,
      amount,
      balanceBefore,
      balanceAfter,
    });

    return { wallet: updatedWallet, entry };
  }

  /**
   * Promote a PENDING CREDIT entry to COMPLETED + MATCHED once the bank confirms settlement.
   */
  async markCreditConfirmed(creditEntryId: string): Promise<void> {
    await (prisma as any).walletEntry.update({
      where: { id: creditEntryId },
      data: { status: 'COMPLETED', matchStatus: 'MATCHED' },
    });

    logger.info('Wallet credit confirmed and matched', { creditEntryId });
  }

  /**
   * Reverse a CREDIT entry when a transaction is refunded after payment was received.
   * Creates a DEBIT refund entry immediately marked COMPLETED + MATCHED, and deducts
   * the amount from the wallet balance.
   *
   * Returns null (silently) if no unrefunded CREDIT entry exists for the transaction.
   */
  async reverseCredit(params: {
    transactionId: string;
    reason?: string;
  }): Promise<{ wallet: any; refundEntry: any } | null> {
    const { transactionId, reason } = params;

    const creditEntry = await (prisma as any).walletEntry.findFirst({
      where: {
        transactionId,
        type: 'CREDIT',
        status: { not: 'REVERSED' },
        refundStatus: { not: 'COMPLETED' },
      },
      include: { wallet: true },
    });

    if (!creditEntry) {
      logger.debug('No unrefunded CREDIT entry found to reverse', { transactionId });
      return null;
    }

    if (creditEntry.disbursementStatus === 'COMPLETED') {
      throw new Error('Refund action is not allowed for transactions that have already been disbursed');
    }

    const wallet = creditEntry.wallet;
    const refundAmount = Number(creditEntry.amount);
    const balanceBefore = Number(wallet.balance);
    const balanceAfter = balanceBefore - refundAmount;

    const [updatedWallet, refundEntry] = await (prisma as any).$transaction([
      (prisma as any).customerWallet.update({
        where: { id: wallet.id },
        data: { balance: balanceAfter },
      }),
      (prisma as any).walletEntry.create({
        data: {
          walletId:       wallet.id,
          transactionId,
          transactionRef: creditEntry.transactionRef,
          sessionId:      `REFUND-${creditEntry.transactionRef}`,
          type:           'DEBIT',
          amount:         refundAmount,
          balanceBefore,
          balanceAfter,
          description:    reason ?? `Refund debit for transaction ${creditEntry.transactionRef}`,
          status:         'COMPLETED',
          matchStatus:    'MATCHED',
          metadata:       { isRefund: true, refundOf: creditEntry.id },
        },
      }),
    ]);

    logger.info('Wallet credit reversed (refund debit created)', {
      walletId: wallet.id,
      transactionId,
      refundAmount,
      balanceBefore,
      balanceAfter,
    });

    return { wallet: updatedWallet, refundEntry };
  }

  /**
   * Reverse an existing DEBIT entry (e.g. if transaction is cancelled after approval).
   * Creates a compensating CREDIT entry and restores the balance.
   */
  async reverseDebit(params: {
    transactionId: string;
    reason?: string;
  }) {
    const { transactionId, reason } = params;

    const debitEntry = await (prisma as any).walletEntry.findFirst({
      where: {
        transactionId,
        type: 'DEBIT',
        status: 'COMPLETED',
      },
      include: { wallet: true },
    });

    if (!debitEntry) {
      logger.warn('No debit entry found to reverse', { transactionId });
      return null;
    }

    const wallet = debitEntry.wallet;
    const balanceBefore = Number(wallet.balance);
    // Reversals always debit the wallet — money leaves the system to the customer's bank
    const balanceAfter = balanceBefore - Number(debitEntry.amount);

    const [updatedWallet, reversalEntry] = await (prisma as any).$transaction([
      (prisma as any).customerWallet.update({
        where: { id: wallet.id },
        data: { balance: balanceAfter },
      }),
      (prisma as any).walletEntry.create({
        data: {
          walletId: wallet.id,
          transactionId,
          transactionRef: debitEntry.transactionRef,
          type: 'DEBIT',
          amount: debitEntry.amount,
          balanceBefore,
          balanceAfter,
          description: reason ?? `Reversal for transaction ${debitEntry.transactionRef}`,
          status: 'COMPLETED',
          matchStatus: 'MATCHED',
          metadata: { reversalOf: debitEntry.id },
        },
      }),
      (prisma as any).walletEntry.update({
        where: { id: debitEntry.id },
        data: { status: 'REVERSED' },
      }),
    ]);

    logger.info('Wallet debit reversed', {
      walletId: wallet.id,
      transactionId,
      amount: debitEntry.amount,
    });

    return { wallet: updatedWallet, reversalEntry };
  }

  /**
   * Get wallet balance for a customer.
   */
  async getWallet(userId: string) {
    const wallet = await (prisma as any).customerWallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      throw new NotFoundError('Wallet not found for this customer');
    }

    return {
      id: wallet.id,
      userId: wallet.userId,
      balance: Number(wallet.balance),
      currency: wallet.currency,
      isActive: wallet.isActive,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    };
  }

  /**
   * Get paginated ledger entries for a wallet.
   */
  async getWalletLedger(
    userId: string,
    filters: {
      page?: number;
      limit?: number;
      type?: 'DEBIT' | 'CREDIT';
      dateFrom?: string;
      dateTo?: string;
    } = {}
  ) {
    const wallet = await (prisma as any).customerWallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      throw new NotFoundError('Wallet not found for this customer');
    }

    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: any = { walletId: wallet.id };
    if (filters.type) where.type = filters.type;
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
    }

    const [entries, total] = await Promise.all([
      (prisma as any).walletEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      (prisma as any).walletEntry.count({ where }),
    ]);

    const txIds = new Set<string>();
    const txRefs = new Set<string>();
    for (const e of entries) {
      if (e.linkedTransactionId) txIds.add(String(e.linkedTransactionId).trim());
      if (e.transactionId) txIds.add(String(e.transactionId).trim());
      if (e.transactionRef) txRefs.add(String(e.transactionRef).trim());
      if (e.sessionId && typeof e.sessionId === 'string' && e.sessionId.startsWith('REFUND-')) {
        txRefs.add(e.sessionId.replace('REFUND-', '').trim());
      }
    }

    const txOrConditions: any[] = [];
    if (txIds.size > 0) {
      txOrConditions.push({ id: { in: Array.from(txIds) } });
      txOrConditions.push({ referenceNumber: { in: Array.from(txIds) } });
    }
    if (txRefs.size > 0) {
      txOrConditions.push({ referenceNumber: { in: Array.from(txRefs) } });
      txOrConditions.push({ id: { in: Array.from(txRefs) } });
    }

    const transactions = txOrConditions.length > 0
      ? await prisma.transaction.findMany({
          where: { OR: txOrConditions },
          select: {
            id: true,
            referenceNumber: true,
            type: true,
            status: true,
            currentStep: true,
            foreignAmount: true,
            nairaEquivalent: true,
            currency: true,
            createdAt: true,
          },
        })
      : [];

    const txMapById = new Map<string, any>();
    const txMapByRef = new Map<string, any>();
    for (const tx of transactions) {
      const txObj = {
        id: tx.id,
        referenceNumber: tx.referenceNumber,
        type: tx.type,
        status: tx.status,
        currentStep: tx.currentStep,
        foreignAmount: Number(tx.foreignAmount || 0),
        nairaEquivalent: Number(tx.nairaEquivalent || 0),
        currency: tx.currency,
        createdAt: tx.createdAt,
      };
      txMapById.set(tx.id, txObj);
      txMapByRef.set(tx.referenceNumber, txObj);
    }

    const findLinkedTx = (e: any) => {
      const lid = e.linkedTransactionId ? String(e.linkedTransactionId).trim() : null;
      const tid = e.transactionId ? String(e.transactionId).trim() : null;
      const tref = e.transactionRef ? String(e.transactionRef).trim() : null;

      if (lid && txMapById.has(lid)) return txMapById.get(lid);
      if (lid && txMapByRef.has(lid)) return txMapByRef.get(lid);
      if (tid && txMapById.has(tid)) return txMapById.get(tid);
      if (tid && txMapByRef.has(tid)) return txMapByRef.get(tid);
      if (tref && txMapByRef.has(tref)) return txMapByRef.get(tref);
      if (tref && txMapById.has(tref)) return txMapById.get(tref);
      if (e.sessionId && typeof e.sessionId === 'string' && e.sessionId.startsWith('REFUND-')) {
        const ref = e.sessionId.replace('REFUND-', '').trim();
        if (txMapByRef.has(ref)) return txMapByRef.get(ref);
        if (txMapById.has(ref)) return txMapById.get(ref);
      }
      return null;
    };

    return {
      wallet: {
        id: wallet.id,
        balance: Number(wallet.balance),
        currency: wallet.currency,
      },
      entries: entries.map((e: any) => {
        const linkedTx = findLinkedTx(e);
        return {
          id: e.id,
          type: e.type,
          amount: Number(e.amount),
          balanceBefore: Number(e.balanceBefore),
          balanceAfter: Number(e.balanceAfter),
          description: e.description,
          status: e.status,
          matchStatus: e.matchStatus || (linkedTx || e.linkedTransactionId ? 'MATCHED' : 'UNMATCHED'),
          isRefund: (e.metadata as any)?.isRefund === true,
          transactionRef: e.transactionRef || linkedTx?.referenceNumber || null,
          transactionId: e.transactionId || linkedTx?.id || null,
          linkedTransactionId: e.linkedTransactionId || linkedTx?.id || null,
          linkedTransaction: linkedTx,
          sessionId: e.sessionId,
          createdAt: e.createdAt,
        };
      }),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Check whether a debit entry already exists for the given transactionId.
   * Used to prevent double-debiting.
   */
  async hasDebitFor(transactionId: string): Promise<boolean> {
    const entry = await (prisma as any).walletEntry.findFirst({
      where: {
        OR: [
          { transactionId },
          { linkedTransactionId: transactionId },
          { transactionRef: transactionId },
        ],
        type: 'DEBIT',
        status: { not: 'REVERSED' },
      },
    });
    return !!entry;
  }

  /**
   * Check whether a credit entry already exists for the given transactionId + sessionId.
   * Used to prevent double-crediting.
   */
  async hasCreditFor(transactionId: string, sessionId?: string): Promise<boolean> {
    const where: any = { transactionId, type: 'CREDIT' };
    if (sessionId) where.sessionId = sessionId;
    const entry = await (prisma as any).walletEntry.findFirst({ where });
    return !!entry;
  }

  /** Retrieve or create wallet, ensuring one always exists for CUSTOMER users. */
  private async ensureWallet(userId: string) {
    let wallet = await (prisma as any).customerWallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      logger.warn('Wallet missing for user, auto-creating', { userId });
      wallet = await (prisma as any).customerWallet.create({
        data: { userId },
      });
    }

    return wallet;
  }
}

export const walletService = new WalletService();
export default walletService;
