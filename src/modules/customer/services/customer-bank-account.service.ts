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

// ---------------------------------------------------------------------------
// Simulated Nigerian bank list
// Replace with a live call to NIBSS / Paystack / Flutterwave when ready.
// ---------------------------------------------------------------------------
export const NIGERIAN_BANKS = [
  { code: '044', name: 'Access Bank' },
  { code: '063', name: 'Access Bank (Diamond)' },
  { code: '035A', name: 'ALAT by WEMA' },
  { code: '401', name: 'ASO Savings and Loans' },
  { code: '023', name: 'Citibank Nigeria' },
  { code: '050', name: 'EcoBank Nigeria' },
  { code: '562', name: 'Ekondo Microfinance Bank' },
  { code: '070', name: 'Fidelity Bank' },
  { code: '011', name: 'First Bank of Nigeria' },
  { code: '214', name: 'First City Monument Bank (FCMB)' },
  { code: '058', name: 'Guaranty Trust Bank (GTBank)' },
  { code: '030', name: 'Heritage Bank' },
  { code: '301', name: 'Jaiz Bank' },
  { code: '082', name: 'Keystone Bank' },
  { code: '526', name: 'Kuda Bank' },
  { code: '090405', name: 'Moniepoint MFB' },
  { code: '014', name: 'MainStreet Bank' },
  { code: '076', name: 'Polaris Bank' },
  { code: '101', name: 'Providus Bank' },
  { code: '125', name: 'Rubies MFB' },
  { code: '8000', name: 'Sparkle' },
  { code: '221', name: 'Stanbic IBTC Bank' },
  { code: '068', name: 'Standard Chartered Bank' },
  { code: '232', name: 'Sterling Bank' },
  { code: '100', name: 'Suntrust Bank' },
  { code: '302', name: 'TAJ Bank' },
  { code: '102', name: 'Titan Trust Bank' },
  { code: '032', name: 'Union Bank of Nigeria' },
  { code: '033', name: 'United Bank for Africa (UBA)' },
  { code: '215', name: 'Unity Bank' },
  { code: '035', name: 'Wema Bank' },
  { code: '057', name: 'Zenith Bank' },
  { code: '090115', name: 'TCF MFB' },
  { code: '090303', name: 'Palmpay' },
  { code: '090175', name: 'VFD Microfinance Bank' },
  { code: '090267', name: 'Kuda Microfinance Bank' },
  { code: '090286', name: 'Safe Haven MFB' },
];

export class CustomerBankAccountService {
  /**
   * Return the list of supported Nigerian banks (simulated).
   * Optionally filter by name via the `q` param.
   */
  getBanks(q?: string) {
    const list = q
      ? NIGERIAN_BANKS.filter((b) => b.name.toLowerCase().includes(q.toLowerCase().trim()))
      : NIGERIAN_BANKS;
    return list;
  }

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
    currency?: string;
    swiftCode?: string;
    iban?: string;
    routingNumber?: string;
    bankAddress?: string;
  }) {
    const { bankName, accountNumber, accountName } = data;
    const currency = data.currency ? data.currency.toUpperCase().trim() : null;

    if (!bankName?.trim()) throw new ValidationError('bankName is required');
    if (!accountNumber?.trim()) throw new ValidationError('accountNumber is required');
    if (!accountName?.trim()) throw new ValidationError('accountName is required');

    const isNgnAccount = !currency || currency === 'NGN';
    if (isNgnAccount && !/^\d{10}$/.test(accountNumber)) {
      throw new ValidationError('accountNumber must be exactly 10 digits for NGN accounts');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User not found');

    const fields = {
      bankName,
      accountName,
      currency,
      swiftCode: data.swiftCode ?? null,
      iban: data.iban ?? null,
      routingNumber: data.routingNumber ?? null,
      bankAddress: data.bankAddress ?? null,
      isVerified: true,
      updatedAt: new Date(),
    };

    // Upsert so that re-adding the same account just returns the existing record
    const bankAccount = await (prisma as any).customerBankAccount.upsert({
      where: { userId_accountNumber: { userId, accountNumber } },
      update: fields,
      create: { userId, accountNumber, ...fields },
    });

    logger.info('[addBankAccount] Bank account saved', { userId, bankAccountId: bankAccount.id });
    return bankAccount;
  }

  /**
   * List bank accounts belonging to a customer.
   * Pass currency='NGN' for local accounts, any other currency for domiciliary,
   * or 'FOREIGN' to get all non-NGN accounts. Omit to get all.
   */
  async listBankAccounts(userId: string, currency?: string) {
    const where: any = { userId };
    if (currency) {
      const cur = currency.toUpperCase().trim();
      if (cur === 'FOREIGN') {
        // All non-NGN accounts (domiciliary)
        where.AND = [
          { currency: { not: null } },
          { currency: { not: 'NGN' } },
        ];
      } else {
        where.currency = cur === 'NGN' ? { in: ['NGN', null] } : cur;
      }
    }
    const accounts = await (prisma as any).customerBankAccount.findMany({
      where,
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
