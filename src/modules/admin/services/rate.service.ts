import { PrismaClient } from "@prisma/client";
import { getDatabase } from "../../../config/database";

const prisma: PrismaClient = getDatabase();

class RateService {
  private isActiveWhere() {
    const now = new Date();
    return { isActive: true, validFrom: { lte: now }, validUntil: { gt: now } };
  }

  private isScheduledWhere() {
    const now = new Date();
    return { isActive: true, validFrom: { gt: now } };
  }

  async stats() {
    const now = new Date();
    const [all, active, scheduled] = await Promise.all([
      prisma.exchangeRate.count(),
      prisma.exchangeRate.count({ where: { isActive: true, validFrom: { lte: now }, validUntil: { gt: now } } }),
      prisma.exchangeRate.count({ where: { isActive: true, validFrom: { gt: now } } }),
    ]);
    return { all, active, scheduled };
  }

  async list(filters: any = {}, page = 1, limit = 20) {
    const search = (((filters || {}).search ?? (filters || {}).q) || "").toString().trim();
    const status = (filters.status || "all").toString();
    const where: any = {};
    if (search) {
      where.OR = [
        { fromCurrency: { contains: search, mode: "insensitive" } },
        { toCurrency: { contains: search, mode: "insensitive" } },
      ];
    }
    if (status === "active") Object.assign(where, this.isActiveWhere());
    if (status === "schedule") Object.assign(where, this.isScheduledWhere());
    const skip = (page - 1) * limit;
    const client: any = prisma as any;
    const [total, items] = await Promise.all([
      client.exchangeRate.count({ where }),
      client.exchangeRate.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
      }),
    ]);
    return { data: items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async get(id: string) {
    const client: any = prisma as any;
    return client.exchangeRate.findUnique({ where: { id } });
  }

  async create(data: { fromCurrency: string; toCurrency: string; buyRate: number; sellRate: number; validFrom: Date; validUntil: Date }) {
    const rate = data.sellRate;
    const client: any = prisma as any;
    const created = await client.exchangeRate.create({
      data: {
        fromCurrency: data.fromCurrency,
        toCurrency: data.toCurrency,
        buyRate: data.buyRate as any,
        sellRate: data.sellRate as any,
        rate: rate as any,
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
    const result = await this.list(filters, 1, 1000);
    return { url: "/exports/rates.csv", count: result.meta.total };
  }
}

export const rateService = new RateService();
