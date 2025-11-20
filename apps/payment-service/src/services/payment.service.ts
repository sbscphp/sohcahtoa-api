import prisma from '../config/database';
import { publishEvent } from '../config/kafka';
import redis from '../config/redis';
import {
  generateId,
  NotFoundError,
  ValidationError,
} from '@fx-platform/shared-utils';
import {
  ExchangeRateRequest,
  ExchangeRateResponse,
  DepositRequest,
  DepositConfirmationRequest,
  PaymentStatus,
  EventType,
  ServiceName,
} from '@fx-platform/shared-types';

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

    await publishEvent({
      eventId: generateId(),
      eventType: EventType.DEPOSIT_INITIATED,
      source: ServiceName.PAYMENT,
      timestamp: new Date().toISOString(),
      data: {
        transactionId: data.transactionId,
        settlementId: settlement.id,
        amount: data.amount,
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

    await publishEvent({
      eventId: generateId(),
      eventType: EventType.DEPOSIT_CONFIRMED,
      source: ServiceName.PAYMENT,
      timestamp: new Date().toISOString(),
      data: {
        transactionId: data.transactionId,
        settlementId: updated.id,
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
}

export default new PaymentService();
