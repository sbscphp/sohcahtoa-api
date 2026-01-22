import prisma from '../config/database';
import { publishEvent } from '../config/kafka';
import {
  generateId,
  generateTransactionReference,
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from '@fx-platform/shared-utils';
import {
  CreateTransactionRequest,
  UpdateTransactionRequest,
  TransactionResponse,
  TransactionStatus,
  TransactionStep,
  DocumentUploadRequest,
  EventType,
  ServiceName,
} from '@fx-platform/shared-types';

export class TransactionService {
  async createTransaction(data: CreateTransactionRequest): Promise<TransactionResponse> {
    // Create transaction
    const transaction = await prisma.transaction.create({
      data: {
        userId: data.userId,
        referenceNumber: generateTransactionReference('TXN'),
        type: data.type,
        purpose: data.purpose,
        destinationCountry: data.destinationCountry,
        currency: data.currency,
        status: TransactionStatus.DRAFT,
        currentStep: TransactionStep.PERSONAL_INFO,
      },
    });

    // Create initial step log
    await prisma.transactionStepLog.create({
      data: {
        transactionId: transaction.id,
        step: TransactionStep.PERSONAL_INFO,
        status: 'STARTED',
      },
    });

    // Create history entry
    await prisma.transactionHistory.create({
      data: {
        transactionId: transaction.id,
        action: 'TRANSACTION_CREATED',
        performedBy: data.userId,
        notes: `Transaction created for ${data.type}`,
      },
    });

    // Initialize transaction limits
    await this.checkAndInitializeLimits(data.userId, data.type);

    // Publish event
    await publishEvent({
      eventId: generateId(),
      eventType: EventType.TRANSACTION_CREATED,
      source: ServiceName.TRANSACTION,
      timestamp: new Date().toISOString(),
      userId: data.userId,
      data: {
        transactionId: transaction.id,
        userId: data.userId,
        type: data.type,
      },
    });

    return this.mapToResponse(transaction);
  }

  async updateTransaction(data: UpdateTransactionRequest): Promise<TransactionResponse> {
    const transaction = await prisma.transaction.findUnique({
      where: { id: data.transactionId },
    });

    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }

    // Update transaction with step data
    const updateData: any = {
      currentStep: data.step,
      updatedAt: new Date(),
    };

    // Handle specific steps
    switch (data.step) {
      case TransactionStep.AMOUNT_CALCULATION:
        updateData.foreignAmount = data.data.foreignAmount;
        updateData.nairaEquivalent = data.data.nairaEquivalent;
        updateData.exchangeRate = data.data.exchangeRate;
        updateData.status = TransactionStatus.AWAITING_DEPOSIT;
        break;

      case TransactionStep.DEPOSIT_CONFIRMATION:
        updateData.status = TransactionStatus.DEPOSIT_CONFIRMED;
        break;

      case TransactionStep.DISBURSEMENT:
        updateData.disbursementMethod = data.data.disbursementMethod;
        break;
    }

    const updated = await prisma.transaction.update({
      where: { id: data.transactionId },
      data: updateData,
    });

    // Log step completion
    await prisma.transactionStepLog.create({
      data: {
        transactionId: data.transactionId,
        step: data.step,
        status: 'COMPLETED',
        data: data.data,
        completedAt: new Date(),
      },
    });

    // Create history entry
    await prisma.transactionHistory.create({
      data: {
        transactionId: data.transactionId,
        action: `STEP_${data.step}_COMPLETED`,
        performedBy: transaction.userId,
      },
    });

    // Publish event
    await publishEvent({
      eventId: generateId(),
      eventType: EventType.TRANSACTION_UPDATED,
      source: ServiceName.TRANSACTION,
      timestamp: new Date().toISOString(),
      userId: transaction.userId,
      data: {
        transactionId: updated.id,
        userId: transaction.userId,
        step: data.step,
        status: updated.status,
      },
    });

    return this.mapToResponse(updated);
  }

  async uploadDocument(data: DocumentUploadRequest): Promise<{ id: string; message: string }> {
    const transaction = await prisma.transaction.findUnique({
      where: { id: data.transactionId },
    });

    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }

    // Create document record
    const document = await prisma.transactionDocument.create({
      data: {
        transactionId: data.transactionId,
        documentType: data.documentType as any,
        fileUrl: data.fileUrl,
        fileName: data.fileName,
        fileSize: data.fileSize,
      },
    });

    // Update transaction status
    await prisma.transaction.update({
      where: { id: data.transactionId },
      data: {
        currentStep: TransactionStep.DOCUMENT_VERIFICATION,
        status: TransactionStatus.AWAITING_VERIFICATION,
      },
    });

    // Publish event for document verification service
    await publishEvent({
      eventId: generateId(),
      eventType: EventType.DOCUMENT_UPLOADED,
      source: ServiceName.TRANSACTION,
      timestamp: new Date().toISOString(),
      userId: transaction.userId,
      data: {
        transactionId: data.transactionId,
        userId: transaction.userId,
        documentId: document.id,
        documentType: data.documentType,
        fileUrl: data.fileUrl || '',
      },
    });

    return {
      id: document.id,
      message: 'Document uploaded successfully',
    };
  }

  async getTransaction(id: string, userId: string): Promise<TransactionResponse> {
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        documents: true,
        steps: true,
        cashPickup: true,
        prepaidCard: true,
        receipt: true,
      },
    });

    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }

    if (transaction.userId !== userId) {
      throw new ForbiddenError('Access denied');
    }

    return this.mapToResponse(transaction);
  }

  async getUserTransactions(userId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.transaction.count({ where: { userId } }),
    ]);

    return {
      data: transactions.map(this.mapToResponse),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async checkLimits(userId: string, type: any, amount: number): Promise<{ allowed: boolean; message?: string }> {
    const now = new Date();
    const quarter = Math.ceil((now.getMonth() + 1) / 3);
    const year = now.getFullYear();

    let limits = await prisma.transactionLimit.findUnique({
      where: {
        userId_type_quarter_year: {
          userId,
          type,
          quarter,
          year,
        },
      },
    });

    if (!limits) {
      limits = await this.checkAndInitializeLimits(userId, type);
    }

    const newQuarterUsage = Number(limits.currentQuarterUsage) + amount;
    const newYearUsage = Number(limits.currentYearUsage) + amount;

    if (newQuarterUsage > Number(limits.quarterlyLimit)) {
      return {
        allowed: false,
        message: `Quarterly limit exceeded for ${type}`,
      };
    }

    if (newYearUsage > Number(limits.yearlyLimit)) {
      return {
        allowed: false,
        message: `Yearly limit exceeded for ${type}`,
      };
    }

    return { allowed: true };
  }

  private async checkAndInitializeLimits(userId: string, type: any) {
    const now = new Date();
    const quarter = Math.ceil((now.getMonth() + 1) / 3);
    const year = now.getFullYear();

    // Default limits (in USD or equivalent)
    const defaultLimits = {
      PTA: { quarterly: 10000, yearly: 40000 },
      BTA: { quarterly: 10000, yearly: 40000 },
      SCHOOL_FEES: { quarterly: 50000, yearly: 200000 },
      MEDICAL: { quarterly: 25000, yearly: 100000 },
      PROFESSIONAL_BODY: { quarterly: 5000, yearly: 20000 },
      TOURIST_FX: { quarterly: 5000, yearly: 20000 },
      RESIDENT_FX: { quarterly: 10000, yearly: 40000 },
      EXPATRIATE_FX: { quarterly: 50000, yearly: 200000 },
      IMTO_REMITTANCE: { quarterly: 25000, yearly: 100000 },
      CASH_REMITTANCE: { quarterly: 5000, yearly: 20000 },
    };

    const limit = (defaultLimits as any)[type] || { quarterly: 10000, yearly: 40000 };

    return prisma.transactionLimit.upsert({
      where: {
        userId_type_quarter_year: {
          userId,
          type,
          quarter,
          year,
        },
      },
      create: {
        userId,
        type,
        quarterlyLimit: limit.quarterly,
        yearlyLimit: limit.yearly,
        quarter,
        year,
      },
      update: {},
    });
  }

  private mapToResponse(transaction: any): TransactionResponse {
    return {
      id: transaction.id,
      userId: transaction.userId,
      type: transaction.type,
      status: transaction.status,
      currentStep: transaction.currentStep,
      purpose: transaction.purpose,
      destinationCountry: transaction.destinationCountry,
      currency: transaction.currency,
      foreignAmount: transaction.foreignAmount ? Number(transaction.foreignAmount) : undefined,
      nairaEquivalent: transaction.nairaEquivalent ? Number(transaction.nairaEquivalent) : undefined,
      exchangeRate: transaction.exchangeRate ? Number(transaction.exchangeRate) : undefined,
      disbursementMethod: transaction.disbursementMethod,
      createdAt: transaction.createdAt.toISOString(),
      updatedAt: transaction.updatedAt.toISOString(),
    };
  }
}

export default new TransactionService();
