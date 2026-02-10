import { getDatabase } from '../../../config/database';
import { eventBus } from '../../../events/event-bus';
import redis from '../config/redis';
import {
  generateId,
  NotFoundError,
  ValidationError,
} from '../../../shared/utils';
import {
  ExchangeRateRequest,
  ExchangeRateResponse,
  DepositRequest,
  DepositConfirmationRequest,
  PaymentStatus,
  EventType,
  ServiceName,
  CreateExchangeRateRequest,
} from '../../../shared/types';

const prisma = getDatabase();

export class PaymentService {
  async getExchangeRate(data: ExchangeRateRequest): Promise<ExchangeRateResponse> {
    // Check cache first
    const cacheKey = `rate:${data.fromCurrency}:${data.toCurrency}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      const rate = JSON.parse(cached);
      return {
        ...rate,
        amount: data.amount,
        convertedAmount: data.amount * rate.rate,
      };
    }

    // Get from database
    const rateRecord = await prisma.exchangeRate.findFirst({
      where: {
        fromCurrency: data.fromCurrency,
        toCurrency: data.toCurrency,
        isActive: true,
        validUntil: { gt: new Date() },
      },
      orderBy: { validFrom: 'desc' },
    });

    if (!rateRecord) {
      throw new NotFoundError(`Exchange rate not found for ${data.fromCurrency} to ${data.toCurrency}`);
    }

    const rate = Number(rateRecord.rate);
    const response: ExchangeRateResponse = {
      fromCurrency: data.fromCurrency,
      toCurrency: data.toCurrency,
      rate,
      amount: data.amount,
      convertedAmount: data.amount * rate,
      rateValidUntil: rateRecord.validUntil.toISOString(),
    };

    // Cache for 5 minutes
    await redis.setex(cacheKey, 300, JSON.stringify({ rate, fromCurrency: data.fromCurrency, toCurrency: data.toCurrency }));

    return response;
  }

  async initiateDeposit(data: DepositRequest): Promise<any> {
    const settlement = await prisma.settlement.create({
      data: {
        transactionId: data.transactionId,
        amount: data.amount,
        currency: data.currency,
        paymentMethod: data.paymentMethod,
        status: PaymentStatus.PENDING,
        bankDetails: data.bankDetails
          ? {
              create: {
                bankName: data.bankDetails.bankName,
                accountNumber: data.bankDetails.accountNumber,
                accountName: data.bankDetails.accountName,
                reference: data.bankDetails.reference,
              },
            }
          : undefined,
      },
      include: { bankDetails: true },
    });

    eventBus.publish(EventType.TRANSACTION_CREATED, {
      eventId: generateId(),
      source: ServiceName.PAYMENT,
      timestamp: new Date().toISOString(),
      data: {
        transactionId: data.transactionId,
        userId: '', // Add userId to match required type
        type: 'deposit',
        amount: data.amount,
        currency: data.currency,
      },
    });

    return settlement;
  }

  async confirmDeposit(data: DepositConfirmationRequest, confirmedBy: string): Promise<any> {
    const settlement = await prisma.settlement.findUnique({
      where: { transactionId: data.transactionId },
    });

    if (!settlement) {
      throw new NotFoundError('Settlement not found');
    }

    const updated = await prisma.settlement.update({
      where: { id: settlement.id },
      data: {
        status: PaymentStatus.CONFIRMED,
        paymentReference: data.paymentReference,
        proofOfPayment: data.proofOfPayment,
        confirmedAt: new Date(),
        confirmedBy,
      },
    });

    eventBus.publish(EventType.DEPOSIT_CONFIRMED, {
      eventId: generateId(),
      source: ServiceName.PAYMENT,
      timestamp: new Date().toISOString(),
      data: {
        transactionId: data.transactionId,
        userId: confirmedBy || '', // Add userId to match required type
        amount: Number(updated.amount),
        currency: updated.currency,
        paymentMethod: updated.paymentMethod,
      },
    });

    return updated;
  }

  async getSettlement(transactionId: string): Promise<any> {
    const settlement = await prisma.settlement.findUnique({
      where: { transactionId },
      include: { bankDetails: true },
    });

    if (!settlement) {
      throw new NotFoundError('Settlement not found');
    }

    return settlement;
  }

  async createExchangeRate(data: CreateExchangeRateRequest, createdBy: string): Promise<any> {
    // Validate the request
    if (!data.fromCurrency || !data.toCurrency) {
      throw new ValidationError('From currency and to currency are required');
    }

    if (!data.rate || data.rate <= 0) {
      throw new ValidationError('Rate must be a positive number');
    }

    if (!data.validUntil) {
      throw new ValidationError('Valid until date is required');
    }

    const validUntilDate = new Date(data.validUntil);
    if (validUntilDate <= new Date()) {
      throw new ValidationError('Valid until date must be in the future');
    }

    // Create the exchange rate
    const exchangeRate = await prisma.exchangeRate.create({
      data: {
        fromCurrency: data.fromCurrency.toUpperCase(),
        toCurrency: data.toCurrency.toUpperCase(),
        rate: data.rate,
        validUntil: validUntilDate,
        source: data.source || 'ADMIN',
        isActive: true,
      },
    });

    // Clear cache for this currency pair
    const cacheKey = `rate:${data.fromCurrency}:${data.toCurrency}`;
    await redis.del(cacheKey);

    eventBus.publish(EventType.TRANSACTION_CREATED, {
      eventId: generateId(),
      source: ServiceName.PAYMENT,
      timestamp: new Date().toISOString(),
      data: {
        transactionId: exchangeRate.id,
        userId: createdBy,
        type: 'exchange_rate_created',
        amount: Number(exchangeRate.rate),
        currency: `${data.fromCurrency}/${data.toCurrency}`,
      },
    });

    return exchangeRate;
  }
}

export default new PaymentService();
