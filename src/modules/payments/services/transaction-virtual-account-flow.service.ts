import { getDatabase } from '../../../config/database';
import { AppError } from '../../../shared/utils/errors';
import { ErrorCode } from '../../../shared/types/common';
import { createLogger } from '../../../shared/utils/logger';
import virtualAccountService from './virtual-account.service';
import depositVerificationService from './deposit-verification.service';

const prisma = getDatabase();
const logger = createLogger('transaction-virtual-account-flow');

export const DEFAULT_RECREATE_VA_MESSAGE_CUSTOMER =
  'This virtual account has expired. Please create a new one by calling POST /api/customer/transactions/:transactionId/virtual-account';

export const DEFAULT_RECREATE_VA_MESSAGE_AGENT =
  'This virtual account has expired. Please create a new one by calling POST /api/agent/transactions/:transactionId/virtual-account';

export const DEFAULT_RECREATE_VA_MESSAGE_DEPOSIT_CUSTOMER =
  'Virtual account has expired. Please create a new one by calling POST /api/customer/transactions/:transactionId/virtual-account';

export const DEFAULT_RECREATE_VA_MESSAGE_DEPOSIT_AGENT =
  'Virtual account has expired. Please create a new one by calling POST /api/agent/transactions/:transactionId/virtual-account';

export type VirtualAccountPathContext = 'customer' | 'agent';


export class TransactionVirtualAccountFlowService {
  async assertTransactionBelongsToCustomer(transactionId: string, customerUserId: string) {
    const transaction = await prisma.transaction.findFirst({
      where: { id: transactionId, userId: customerUserId },
    });
    if (!transaction) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Transaction not found', 404);
    }
    return transaction;
  }

  /**
   * Create VA for a transaction owned by customerUserId. Returns whether response should be 200 (existing) or 201 (created).
   */
  async createVirtualAccountForTransaction(customerUserId: string, transactionId: string) {
    const transaction = await this.assertTransactionBelongsToCustomer(transactionId, customerUserId);

    logger.info('Creating virtual account for transaction', {
      customerUserId,
      transactionId,
    });

    const user = await prisma.user.findUnique({
      where: { id: customerUserId },
      include: { profile: true },
    });

    const vaAllowedStatuses = ['APPROVED', 'VERIFICATION_COMPLETED', 'AWAITING_DEPOSIT'];
    if (!vaAllowedStatuses.includes(transaction.status)) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Virtual account can only be created for approved or awaiting deposit transactions',
        400
      );
    }

    // Ensure all documents are verified before creating a virtual account
    const unapprovedDocuments = await prisma.transactionDocument.findMany({
      where: {
        transactionId,
        verificationStatus: { not: 'VERIFIED' },
      },
      select: { id: true, documentType: true, verificationStatus: true },
    });

    if (unapprovedDocuments.length > 0) {
      logger.warn('Cannot create virtual account: not all documents are verified', {
        transactionId,
        customerUserId,
        unapprovedDocuments,
      });
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'All documents must be approved before a virtual account can be created',
        400
      );
    }

    try {
      const existingAccount = await virtualAccountService.getVirtualAccountByTransaction(transactionId);

      const isExpired =
        existingAccount.expiresAt && new Date(existingAccount.expiresAt) < new Date();

      if (isExpired) {
        logger.warn('Existing virtual account has expired, creating new one', {
          customerUserId,
          transactionId,
          accountNumber: existingAccount.accountNumber,
          expiresAt: existingAccount.expiresAt,
        });

        await prisma.virtualAccount.update({
          where: { id: existingAccount.id },
          data: { status: 'INACTIVE' },
        });
      } else {
        logger.info('Valid virtual account already exists', {
          customerUserId,
          transactionId,
          accountNumber: existingAccount.accountNumber,
          status: existingAccount.status,
        });

        return {
          httpStatus: 200 as const,
          data: {
            accountNumber: existingAccount.accountNumber,
            accountName: existingAccount.accountName,
            bankName: existingAccount.bankName,
            status: existingAccount.status,
            expiresAt: existingAccount.expiresAt,
            createdAt: existingAccount.createdAt,
            message: 'Virtual account already exists for this transaction',
          },
          message: undefined as string | undefined,
        };
      }
    } catch (error) {
      if (!(error instanceof AppError && error.statusCode === 404)) {
        throw error;
      }
    }

    const userProfile = user?.profile;
    const userName = userProfile
      ? `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim()
      : 'Customer';
    const accountName = `SOHCAHTOA-(${userName})`;

    const virtualAccount = await virtualAccountService.createVirtualAccount({
      userId: customerUserId,
      transactionId,
      accountName,
      type: 'DYNAMIC',
      expiresInHours: 48,
    });

    logger.info('Virtual account created successfully', {
      customerUserId,
      transactionId,
      accountNumber: virtualAccount.accountNumber,
    });

    return {
      httpStatus: 201 as const,
      data: {
        accountNumber: virtualAccount.accountNumber,
        accountName: virtualAccount.accountName,
        bankName: virtualAccount.bankName,
        status: virtualAccount.status,
        expiresAt: virtualAccount.expiresAt,
        createdAt: virtualAccount.createdAt,
        depositAmount: transaction.nairaEquivalent,
        currency: 'NGN',
        instructions: [
          'Transfer the exact amount specified to the account number provided',
          'Use your registered name as the sender name',
          'The account is valid for single use only',
          virtualAccount.expiresAt
            ? `Complete the transfer before ${new Date(virtualAccount.expiresAt).toLocaleString()}`
            : 'Complete the transfer within 48 hours',
          'Your transaction will be automatically confirmed once the deposit is received',
          'Do not share this account number with anyone',
        ],
        warningNote: 'Please transfer the exact amount. Any discrepancy may delay processing.',
      },
      message: 'Virtual account created successfully',
    };
  }

  async getVirtualAccountForTransaction(
    customerUserId: string,
    transactionId: string,
    pathContext: VirtualAccountPathContext = 'customer'
  ) {
    const transaction = await this.assertTransactionBelongsToCustomer(transactionId, customerUserId);

    let virtualAccount;
    try {
      virtualAccount = await virtualAccountService.getVirtualAccountByTransaction(transactionId);
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 404) {
        // Auto-create VA if transaction is approved or verification completed but no VA exists yet
        if (transaction.status === 'APPROVED' || transaction.status === 'VERIFICATION_COMPLETED') {
          logger.info('No virtual account found for approved transaction, auto-creating', { transactionId, customerUserId });
          await this.createVirtualAccountForTransaction(customerUserId, transactionId);
          virtualAccount = await virtualAccountService.getVirtualAccountByTransaction(transactionId);
        } else {
          throw new AppError(
            ErrorCode.VALIDATION_ERROR,
            'Virtual account not yet created. Please wait for transaction approval.',
            400
          );
        }
      } else {
        throw error;
      }
    }

    const isExpired =
      virtualAccount.expiresAt && new Date(virtualAccount.expiresAt) < new Date();

    const noPaymentMade = ['APPROVED', 'VERIFICATION_COMPLETED', 'AWAITING_DEPOSIT'].includes(transaction.status);

    if (isExpired && noPaymentMade) {
      logger.info('Virtual account expired with no payment — regenerating', { transactionId, customerUserId });
      await this.createVirtualAccountForTransaction(customerUserId, transactionId);
      virtualAccount = await virtualAccountService.getVirtualAccountByTransaction(transactionId);
    }

    return {
      accountNumber: virtualAccount.accountNumber,
      accountName: virtualAccount.accountName,
      bankName: virtualAccount.bankName,
      status: virtualAccount.status,
      expiresAt: virtualAccount.expiresAt,
      createdAt: virtualAccount.createdAt,
      isExpired: false,
      deposits: virtualAccount.deposits?.map((deposit: any) => ({
        id: deposit.id,
        amount: deposit.amount,
        settledAmount: deposit.settledAmount,
        status: deposit.status,
        tranDateTime: deposit.tranDateTime,
        createdAt: deposit.createdAt,
      })),
    };
  }

  async getDepositInstructionsForTransaction(
    customerUserId: string,
    transactionId: string,
    pathContext: VirtualAccountPathContext = 'customer'
  ) {
    const transaction = await this.assertTransactionBelongsToCustomer(transactionId, customerUserId);

    const depositInstructionsAllowedStatuses = ['APPROVED', 'VERIFICATION_COMPLETED', 'AWAITING_DEPOSIT'];
    if (!depositInstructionsAllowedStatuses.includes(transaction.status)) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Deposit instructions not available yet. Please wait for transaction approval.',
        400
      );
    }

    let virtualAccount;
    try {
      virtualAccount = await virtualAccountService.getVirtualAccountByTransaction(transactionId);
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 404) {
        // Auto-create VA if transaction is approved but no VA exists yet
        logger.info('No virtual account found, auto-creating for approved transaction', { transactionId, customerUserId });
        await this.createVirtualAccountForTransaction(customerUserId, transactionId);
        virtualAccount = await virtualAccountService.getVirtualAccountByTransaction(transactionId);
      } else {
        throw error;
      }
    }

    const isExpired =
      virtualAccount.expiresAt && new Date(virtualAccount.expiresAt) < new Date();

    if (isExpired) {
      logger.info('Virtual account expired with no payment — regenerating for deposit instructions', { transactionId, customerUserId });
      await this.createVirtualAccountForTransaction(customerUserId, transactionId);
      virtualAccount = await virtualAccountService.getVirtualAccountByTransaction(transactionId);
    }

    return {
      accountNumber: virtualAccount.accountNumber,
      accountName: virtualAccount.accountName,
      bankName: virtualAccount.bankName,
      amount: transaction.nairaEquivalent,
      currency: 'NGN',
      expiresAt: virtualAccount.expiresAt,
      instructions: [
        'Transfer the exact amount specified to the account number provided',
        'Use your registered name as the sender name',
        'The account is valid for single use only',
        virtualAccount.expiresAt
          ? `Complete the transfer before ${new Date(virtualAccount.expiresAt).toLocaleString()}`
          : 'Complete the transfer within the specified timeframe',
        'Your transaction will be automatically confirmed once the deposit is received',
        'Do not share this account number with anyone',
      ],
      warningNote: 'Please transfer the exact amount. Any discrepancy may delay processing.',
    };
  }

  async getDepositStatusForTransaction(customerUserId: string, transactionId: string) {
    const transaction = await this.assertTransactionBelongsToCustomer(transactionId, customerUserId);

    const deposits = await depositVerificationService.getTransactionDeposits(transactionId);
    const latestDeposit = deposits[0];

    const depositConfirmedStatuses = [
      'DEPOSIT_CONFIRMED',
      'AWAITING_DISBURSEMENT',
      'COMPLIANCE_REVIEW',
      'ADMIN_APPROVAL_PENDING',
      'APPROVED',
      'DISBURSEMENT_IN_PROGRESS',
      'PENDING_RECORD_VALIDATION',
      'COMPLETED',
    ];

    return {
      hasDeposit: deposits.length > 0,
      depositStatus: latestDeposit?.status || null,
      depositAmount: latestDeposit?.amount || null,
      depositDate: latestDeposit?.tranDateTime || null,
      transactionStatus: transaction.status,
      awaitingDeposit: transaction.status === 'AWAITING_DEPOSIT',
      depositConfirmed: depositConfirmedStatuses.includes(transaction.status),
    };
  }
}

export default new TransactionVirtualAccountFlowService();
