import { getDatabase } from '../../../config/database';
import { createLogger } from '../../../shared/utils/logger';
import { NotFoundError, ValidationError } from '../../../shared/utils';

const prisma = getDatabase();

const logger = createLogger('CustomerBankAccountService');

// ---------------------------------------------------------------------------
// Simulated name-lookup response
// In production this will call NIBSS / a bank's account-enquiry endpoint.
// ---------------------------------------------------------------------------
function simulateAccountName(bankName: string, accountNumber: string): string {
  // Deterministic simulation: last 4 digits seed a suffix so the same account
  // always returns the same name during development / testing.
  const suffix = accountNumber.slice(-4);
  const bank = bankName.replace(/\s+bank.*/i, '').trim();
  return `${bank} Account Holder ${suffix}`;
}

export class CustomerBankAccountService {
  /**
   * Simulate bank-name lookup (account enquiry).
   * Returns a deterministic placeholder name so the UI can show the field
   * before real NIBSS integration is wired.
   */
  async lookupAccountName(bankName: string, accountNumber: string) {
    if (!bankName?.trim()) throw new ValidationError('bankName is required');
    if (!accountNumber?.trim()) throw new ValidationError('accountNumber is required');
    if (!/^\d{10}$/.test(accountNumber)) {
      throw new ValidationError('accountNumber must be exactly 10 digits');
    }

    logger.info('[lookupAccountName] Simulating account name lookup', { bankName, accountNumber });

    // Simulate a brief network delay in dev
    const accountName = simulateAccountName(bankName, accountNumber);

    return { bankName, accountNumber, accountName, simulated: true };
  }

  /**
   * Save a bank account to the customer's profile.
   * Re-uses an existing record if the (userId, accountNumber) pair already exists.
   */
  async addBankAccount(userId: string, data: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  }) {
    const { bankName, accountNumber, accountName } = data;

    if (!bankName?.trim()) throw new ValidationError('bankName is required');
    if (!accountNumber?.trim()) throw new ValidationError('accountNumber is required');
    if (!accountName?.trim()) throw new ValidationError('accountName is required');
    if (!/^\d{10}$/.test(accountNumber)) {
      throw new ValidationError('accountNumber must be exactly 10 digits');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User not found');

    // Upsert so that re-adding the same account just returns the existing record
    const bankAccount = await (prisma as any).customerBankAccount.upsert({
      where: { userId_accountNumber: { userId, accountNumber } },
      update: { bankName, accountName, isVerified: true, updatedAt: new Date() },
      create: {
        userId,
        bankName,
        accountNumber,
        accountName,
        isVerified: true,
      },
    });

    logger.info('[addBankAccount] Bank account saved', { userId, bankAccountId: bankAccount.id });
    return bankAccount;
  }

  /**
   * List all bank accounts belonging to a customer.
   */
  async listBankAccounts(userId: string) {
    const accounts = await (prisma as any).customerBankAccount.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return accounts;
  }

  /**
   * Remove a bank account from the customer's profile.
   * Detaches it from all transactions first (join rows are cascade-deleted by DB).
   */
  async deleteBankAccount(userId: string, bankAccountId: string) {
    const account = await (prisma as any).customerBankAccount.findUnique({
      where: { id: bankAccountId },
    });

    if (!account) throw new NotFoundError('Bank account not found');
    if (account.userId !== userId) throw new ValidationError('Bank account does not belong to this user');

    await (prisma as any).customerBankAccount.delete({ where: { id: bankAccountId } });
    logger.info('[deleteBankAccount] Bank account removed', { userId, bankAccountId });
  }

  /**
   * Set a bank account as the customer's default.
   */
  async setDefault(userId: string, bankAccountId: string) {
    const account = await (prisma as any).customerBankAccount.findUnique({
      where: { id: bankAccountId },
    });
    if (!account) throw new NotFoundError('Bank account not found');
    if (account.userId !== userId) throw new ValidationError('Bank account does not belong to this user');

    // Clear current default then set the new one
    await (prisma as any).customerBankAccount.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });
    await (prisma as any).customerBankAccount.update({
      where: { id: bankAccountId },
      data: { isDefault: true },
    });

    return (prisma as any).customerBankAccount.findUnique({ where: { id: bankAccountId } });
  }

  /**
   * Attach one or more of the customer's bank accounts to a transaction.
   * Skips any that are already attached.
   */
  async attachToTransaction(userId: string, transactionId: string, bankAccountIds: string[]) {
    if (!bankAccountIds?.length) throw new ValidationError('At least one bankAccountId is required');

    const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!transaction) throw new NotFoundError('Transaction not found');
    if (transaction.userId !== userId) throw new ValidationError('Transaction does not belong to this user');

    // Verify all bank accounts belong to this user
    const accounts = await (prisma as any).customerBankAccount.findMany({
      where: { id: { in: bankAccountIds }, userId },
    });

    if (accounts.length !== bankAccountIds.length) {
      throw new ValidationError('One or more bank accounts were not found or do not belong to this user');
    }

    // Upsert join rows (skip duplicates)
    const rows = bankAccountIds.map((customerBankAccountId: string) => ({
      id: require('crypto').randomUUID(),
      transactionId,
      customerBankAccountId,
    }));

    await (prisma as any).transactionBankAccount.createMany({
      data: rows,
      skipDuplicates: true,
    });

    logger.info('[attachToTransaction] Bank accounts attached to transaction', {
      userId, transactionId, bankAccountIds,
    });

    return this.getTransactionBankAccounts(userId, transactionId);
  }

  /**
   * Get all bank accounts attached to a transaction.
   */
  async getTransactionBankAccounts(userId: string, transactionId: string) {
    const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!transaction) throw new NotFoundError('Transaction not found');
    if (transaction.userId !== userId) throw new ValidationError('Transaction does not belong to this user');

    const rows = await (prisma as any).transactionBankAccount.findMany({
      where: { transactionId },
      include: { bankAccount: true },
      orderBy: { createdAt: 'asc' },
    });

    return rows.map((r: any) => r.bankAccount);
  }

  /**
   * Detach a bank account from a specific transaction.
   */
  async detachFromTransaction(userId: string, transactionId: string, bankAccountId: string) {
    const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!transaction) throw new NotFoundError('Transaction not found');
    if (transaction.userId !== userId) throw new ValidationError('Transaction does not belong to this user');

    await (prisma as any).transactionBankAccount.deleteMany({
      where: { transactionId, customerBankAccountId: bankAccountId },
    });

    logger.info('[detachFromTransaction] Bank account detached', { userId, transactionId, bankAccountId });
  }
}

export const customerBankAccountService = new CustomerBankAccountService();
