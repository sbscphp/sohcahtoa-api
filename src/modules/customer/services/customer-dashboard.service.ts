import { getDatabase } from '../../../config/database';
import { ValidationError } from '../../../shared/utils';
import { TransactionType } from '../../../shared/types/transaction';
import { createLogger } from '../../../shared/utils/logger';
import {
  resolveDashboardDateRange,
  resolveAgentCashStatsDateRange,
} from '../../../shared/utils/date-range-presets';

const prisma = getDatabase();
const logger = createLogger('customer-dashboard-service');

const round2 = (n: number) => Math.round(n * 100) / 100;

const CURRENCY_NAMES: Record<string, string> = {
  NGN: 'Nigerian Naira',
  USD: 'US Dollar',
  GBP: 'British Pound Sterling',
  EUR: 'Euro',
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CustomerRecentTransactionItem {
  transactionId: string;
  referenceNumber: string;
  type: string;
  status: string;
  timestamp: string;
  amount: number | null;
  currency: string;
}

export interface CustomerTransactionTypeSegment {
  transactionType: string;
  count: number;
  totalAmount: number;
  percentageOfVolume: number;
}

export interface CustomerTransactionsByTypeResult {
  range: string;
  rangeStart: string;
  rangeEnd: string;
  amountBasis: string;
  totalTransactionCount: number;
  totalVolume: number;
  segments: CustomerTransactionTypeSegment[];
}

export interface CustomerTransactionStats {
  total: number;
  pending: number;
  completed: number;
  rejected: number;
}

export interface CustomerPaymentSummaryResult {
  currency: string;
  currencyName: string;
  period: { preset: string; start: string; end: string };
  totalNairaBilled: number;
  totalNairaPaid: number;
  totalOutstanding: number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

class CustomerDashboardService {
  /**
   * Paginated list of the customer's own transactions for the dashboard.
   */
  async listRecentTransactions(
    userId: string,
    typeFilter: string | undefined,
    page: number,
    limit: number,
  ) {
    if (typeFilter && !Object.values(TransactionType).includes(typeFilter as TransactionType)) {
      throw new ValidationError(`Invalid transaction type: ${typeFilter}`);
    }

    const where: any = { userId };
    if (typeFilter) where.type = typeFilter;

    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        select: {
          id: true,
          referenceNumber: true,
          type: true,
          status: true,
          createdAt: true,
          foreignAmount: true,
          currency: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ]);

    const data: CustomerRecentTransactionItem[] = rows.map((t) => ({
      transactionId: t.id,
      referenceNumber: t.referenceNumber,
      type: t.type,
      status: t.status,
      timestamp: t.createdAt.toISOString(),
      amount: t.foreignAmount != null ? Number(t.foreignAmount) : null,
      currency: t.currency,
    }));

    logger.debug('[listRecentTransactions] Fetched', { userId, total, page, limit });

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Pie-chart breakdown of the customer's transactions by type for the given date range.
   * Counts cover all currencies; USD amounts are used for volume (same basis as agent dashboard).
   */
  async getTransactionsByType(
    userId: string,
    rangePreset: string,
  ): Promise<CustomerTransactionsByTypeResult> {
    const { start, end } = resolveDashboardDateRange(rangePreset);

    const baseWhere = { userId, createdAt: { gte: start, lte: end } };

    const [countGroups, sumGroups] = await Promise.all([
      prisma.transaction.groupBy({
        by: ['type'],
        where: baseWhere,
        _count: { _all: true },
      }),
      prisma.transaction.groupBy({
        by: ['type'],
        where: { ...baseWhere, currency: { equals: 'USD', mode: 'insensitive' } },
        _sum: { foreignAmount: true },
      }),
    ]);

    const sumByType = new Map<string, number>();
    for (const row of sumGroups) {
      sumByType.set(row.type, row._sum.foreignAmount != null ? Number(row._sum.foreignAmount) : 0);
    }

    let totalVolume = 0;
    const segmentsRaw: CustomerTransactionTypeSegment[] = [];

    for (const row of countGroups) {
      if (row._count._all === 0) continue;
      const totalAmount = sumByType.get(row.type) ?? 0;
      totalVolume += totalAmount;
      segmentsRaw.push({ transactionType: row.type, count: row._count._all, totalAmount, percentageOfVolume: 0 });
    }

    const segments = segmentsRaw.map((s) => ({
      ...s,
      percentageOfVolume: totalVolume > 0 ? round2((s.totalAmount / totalVolume) * 100) : 0,
    }));

    return {
      range: rangePreset.trim(),
      rangeStart: start.toISOString(),
      rangeEnd: end.toISOString(),
      amountBasis: 'USD_FOREIGN_AMOUNT',
      totalTransactionCount: segments.reduce((acc, s) => acc + s.count, 0),
      totalVolume: round2(totalVolume),
      segments,
    };
  }

  /**
   * Summary counts: total, pending, completed, rejected transactions for this customer.
   */
  async getTransactionStats(userId: string): Promise<CustomerTransactionStats> {
    const base = { userId };

    const [total, pending, completed, rejected] = await Promise.all([
      prisma.transaction.count({ where: base }),
      prisma.transaction.count({
        where: { ...base, status: { notIn: ['COMPLETED', 'REJECTED', 'CANCELLED'] as any } },
      }),
      prisma.transaction.count({ where: { ...base, status: 'COMPLETED' as any } }),
      prisma.transaction.count({ where: { ...base, status: 'REJECTED' as any } }),
    ]);

    logger.debug('[getTransactionStats] Stats computed', { userId, total, pending, completed, rejected });
    return { total, pending, completed, rejected };
  }

  /**
   * Payment summary for the customer: naira billed vs naira paid vs outstanding.
   * Sourced from the `nairaEquivalent` and `amountPaid` columns on transactions.
   */
  async getPaymentSummary(
    userId: string,
    periodPreset: string,
    currencyParam?: string,
  ): Promise<CustomerPaymentSummaryResult> {
    const { start, end } = resolveAgentCashStatsDateRange(periodPreset);
    const currency = (currencyParam || 'NGN').toUpperCase();
    const currencyName = CURRENCY_NAMES[currency] || currency;

    // Only NGN makes sense here since nairaEquivalent is always NGN
    const agg = await prisma.transaction.aggregate({
      where: {
        userId,
        createdAt: { gte: start, lte: end },
        nairaEquivalent: { not: null },
      },
      _sum: { nairaEquivalent: true, amountPaid: true, balanceDue: true },
    });

    const totalNairaBilled = round2(Number(agg._sum.nairaEquivalent ?? 0));
    const totalNairaPaid   = round2(Number(agg._sum.amountPaid ?? 0));
    // balanceDue positive = still owed; sum across transactions
    const totalOutstanding = round2(Number(agg._sum.balanceDue ?? 0));

    logger.debug('[getPaymentSummary] Summary computed', { userId, totalNairaBilled, totalNairaPaid, totalOutstanding });

    return {
      currency,
      currencyName,
      period: { preset: periodPreset.trim(), start: start.toISOString(), end: end.toISOString() },
      totalNairaBilled,
      totalNairaPaid,
      totalOutstanding,
    };
  }
}

export default new CustomerDashboardService();
