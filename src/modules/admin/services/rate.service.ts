import { PrismaClient } from "@prisma/client";
import { getDatabase } from "../../../config/database";
import { buildRateWhereClause, rateSelectFields, isActiveWhere, isScheduledWhere, isExpiredWhere, isDeactivatedWhere } from "../../../shared/utils/rate-filters";

const prisma: PrismaClient = getDatabase();

class RateService {

  async stats() {
    const now = new Date();
    const [active, scheduled, expired, deactivated, all] = await Promise.all([
      prisma.exchangeRate.count({ where: isActiveWhere(now) }),
      prisma.exchangeRate.count({ where: isScheduledWhere(now) }),
      prisma.exchangeRate.count({ where: isExpiredWhere(now) }),
      prisma.exchangeRate.count({ where: isDeactivatedWhere() }),
      prisma.exchangeRate.count({}),
    ]);
    return { all, active, scheduled, expired, deactivated };
  }

  async list(filters: any = {}, page = 1, limit = 20) {
    const where = buildRateWhereClause({
      search: ((filters || {}).search ?? (filters || {}).q) || undefined,
      status: filters.status,
      fromCurrency: filters.fromCurrency,
      toCurrency: filters.toCurrency,
    });

    const skip = (page - 1) * limit;
    const client: any = prisma as any;
    const [total, items] = await Promise.all([
      client.exchangeRate.count({ where }),
      client.exchangeRate.findMany({
        where,
        select: rateSelectFields,
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    const now = new Date();
    const formattedItems = items.map((r: any) => {
      let status = "DEACTIVATED";
      if (r.isActive !== false) {
        if (new Date(r.validFrom) > now) {
          status = "SCHEDULED";
        } else if (new Date(r.validUntil) <= now) {
          status = "EXPIRED";
        } else {
          status = "ACTIVE";
        }
      }

      return {
        ...r,
        status,
        buyRate: Number(r.buyRate || 0),
        sellRate: Number(r.sellRate || 0),
      };
    });

    return { data: formattedItems, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async get(id: string) {
    const client: any = prisma as any;
    return client.exchangeRate.findUnique({ where: { id } });
  }

  async create(data: { fromCurrency: string; toCurrency: string; buyRate: number; sellRate: number; validFrom: Date; validUntil: Date; note?: string }) {
    const rate = data.sellRate;
    const client: any = prisma as any;
    const created = await client.exchangeRate.create({
      data: {
        fromCurrency: data.fromCurrency,
        toCurrency: data.toCurrency,
        buyRate: data.buyRate as any,
        sellRate: data.sellRate as any,
        rate: rate as any,
        note: data.note,
        validFrom: data.validFrom,
        validUntil: data.validUntil,
        isActive: true,
        source: "MANUAL",
      },
    });
    return created;
  }

  async update(id: string, data: Partial<{ buyRate: number; sellRate: number; validFrom: Date; validUntil: Date; isActive: boolean }>) {
    const patch: any = {};
    if (typeof data.buyRate === "number") patch.buyRate = data.buyRate as any;
    if (typeof data.sellRate === "number") {
      patch.sellRate = data.sellRate as any;
      patch.rate = data.sellRate as any;
    }
    if (data.validFrom instanceof Date) patch.validFrom = data.validFrom;
    if (data.validUntil instanceof Date) patch.validUntil = data.validUntil;
    if (typeof data.isActive === "boolean") patch.isActive = data.isActive;
    const client: any = prisma as any;
    return client.exchangeRate.update({ where: { id }, data: patch });
  }

  async deactivate(id: string) {
    const client: any = prisma as any;
    return client.exchangeRate.update({ where: { id }, data: { isActive: false } });
  }

  async export(filters: any = {}) {
    const where = buildRateWhereClause({
      search: ((filters || {}).search ?? (filters || {}).q) || undefined,
      status: filters.status,
      fromCurrency: filters.fromCurrency,
      toCurrency: filters.toCurrency,
    });
    const client: any = prisma as any;
    const items = await client.exchangeRate.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 10_000,
      select: {
        id: true,
        fromCurrency: true,
        toCurrency: true,
        buyRate: true,
        sellRate: true,
        validFrom: true,
        updatedAt: true,
      },
    });
    return (items || []).map((r: any) => ({
      dateTime: r.validFrom,
      currencyPair: `${r.fromCurrency}-${r.toCurrency}`,
      weBuyAt: Number(r.buyRate || 0),
      weSellAt: Number(r.sellRate || 0),
      lastUpdated: r.updatedAt,
    }));
  }
}

export const rateService = new RateService();
