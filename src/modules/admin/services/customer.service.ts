import { getDatabase } from "../../../config/database";
const prisma = getDatabase();
import { NotFoundError, ValidationError, paginate } from "../../../shared/utils";

type CreateCustomerFlagPayload = {
  type: string; // should align with AmlFlagType
  severity: string; // should align with AmlFlagSeverity
  title?: string;
  description: string;
  details?: any;
};

type UpdateFlagStatusPayload = {
  status: "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "DISMISSED";
  resolutionNotes?: string;
};

export class CustomerService {
 
  async listCustomers(page = 1, limit = 20, q?: string) {
    const where: any = { role: "CUSTOMER" };
    if (q && q.trim().length > 0) {
      where.OR = [
        { email: { contains: q, mode: "insensitive" } },
        { phoneNumber: { contains: q, mode: "insensitive" } },
        { profile: { firstName: { contains: q, mode: "insensitive" } } } as any,
        { profile: { lastName: { contains: q, mode: "insensitive" } } } as any,
      ];
    }

    return paginate(
      prisma.user,
      {
        where,
        include: { profile: true, kyc: true },
        orderBy: { createdAt: "desc" },
      },
      { page, limit },
      async (users: any[]) => {
        const userIds = users.map((u: any) => u.id);
        const txAgg =
          userIds.length === 0
            ? []
            : await prisma.transaction.groupBy({
                by: ["userId"],
                where: { userId: { in: userIds } },
                _count: { _all: true },
                _sum: { nairaEquivalent: true, foreignAmount: true },
                _max: { updatedAt: true, completedAt: true },
              });
        const sessionAgg =
          userIds.length === 0
            ? []
            : await prisma.session.groupBy({
                by: ["userId"],
                where: { userId: { in: userIds } },
                _max: { createdAt: true },
              });
        const txByUser: Record<
          string,
          { totalTransactions: number; transactionVolume: number }
        > = {};
        const lastActiveByUser: Record<string, Date | null> = {};
        for (const row of txAgg as any[]) {
          const count = row._count?._all || 0;
          const nairaSum = Number(row._sum?.nairaEquivalent || 0);
          const foreignSum = Number(row._sum?.foreignAmount || 0);
          const volume = nairaSum || foreignSum || 0;
          txByUser[row.userId] = {
            totalTransactions: count,
            transactionVolume: volume,
          };
          const txMax =
            (row._max?.updatedAt as Date | null) ||
            (row._max?.completedAt as Date | null) ||
            null;
          if (txMax) {
            lastActiveByUser[row.userId] = txMax;
          }
        }
        for (const row of sessionAgg as any[]) {
          const sessMax = (row._max?.createdAt as Date | null) || null;
          const prev = lastActiveByUser[row.userId] || null;
          if (!prev || (sessMax && prev < sessMax)) {
            lastActiveByUser[row.userId] = sessMax;
          }
        }
        return users.map((u: any) => {
          const name =
            u.profile && (u.profile.firstName || u.profile.lastName)
              ? `${u.profile.firstName || ""} ${u.profile.lastName || ""}`.trim()
              : undefined;
          const agg = txByUser[u.id] || {
            totalTransactions: 0,
            transactionVolume: 0,
          };
          const lastActive = lastActiveByUser[u.id]
            ? lastActiveByUser[u.id]?.toISOString?.() || lastActiveByUser[u.id]
            : null;
          return {
            id: u.id,
            name,
            phoneNumber: u.phoneNumber,
            email: u.email,
            dateJoined: u.createdAt?.toISOString?.() || u.createdAt,
            totalTransactions: agg.totalTransactions,
            transactionVolume: agg.transactionVolume,
            status: u.isActive ? "ACTIVE" : "DEACTIVATED",
            lastActive,
          };
        });
      }
    );
  }

  async getCustomer(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true, kyc: true },
    });
    if (!user) throw new NotFoundError("Customer not found");
    const txAgg = await prisma.transaction.aggregate({
      where: { userId },
      _count: { _all: true },
      _sum: { nairaEquivalent: true, foreignAmount: true },
    });
    const totalTransactions = txAgg._count?._all || 0;
    const transactionVolume =
      Number(txAgg._sum?.nairaEquivalent || 0) ||
      Number(txAgg._sum?.foreignAmount || 0) ||
      0;
    const [lastTx] = await prisma.transaction.findMany({
      where: { userId },
      orderBy: [{ updatedAt: "desc" }, { completedAt: "desc" }],
      take: 1,
      select: { updatedAt: true, completedAt: true },
    });
    const [lastSess] = await prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 1,
      select: { createdAt: true },
    });
    const lastActiveDate = [
      lastTx?.updatedAt || null,
      lastTx?.completedAt || null,
      lastSess?.createdAt || null,
    ]
      .filter(Boolean)
      .sort((a: any, b: any) => (a > b ? -1 : 1))[0] as Date | undefined;

    const name =
      user.profile && (user.profile.firstName || user.profile.lastName)
        ? `${user.profile.firstName || ""} ${user.profile.lastName || ""}`.trim()
        : undefined;

    return {
      id: user.id,
      name,
      phoneNumber: user.phoneNumber,
      email: user.email,
      dateJoined: user.createdAt?.toISOString?.() || user.createdAt,
      totalTransactions,
      transactionVolume,
      status: user.isActive ? "ACTIVE" : "DEACTIVATED",
      lastActive: lastActiveDate
        ? lastActiveDate?.toISOString?.() || lastActiveDate
        : null,
    };
  }

  async getCustomerCounts() {
    const [totalCustomer, activeCustomer, deactivatedCustomer] = await Promise.all([
      prisma.user.count({ where: { role: "CUSTOMER" } }),
      prisma.user.count({ where: { role: "CUSTOMER", isActive: true } }),
      prisma.user.count({ where: { role: "CUSTOMER", isActive: false } }),
    ]);
    return { totalCustomer, activeCustomer, deactivatedCustomer };
  }

  async listCustomersAll(q?: string) {
    const where: any = { role: "CUSTOMER" };
    const query = (q || "").toString().trim();
    if (query.length > 0) {
      where.OR = [
        { email: { contains: query, mode: "insensitive" } },
        { phoneNumber: { contains: query, mode: "insensitive" } },
        { profile: { firstName: { contains: query, mode: "insensitive" } } } as any,
        { profile: { lastName: { contains: query, mode: "insensitive" } } } as any,
      ];
    }
    const users = await prisma.user.findMany({
      where,
      include: { profile: true, kyc: true },
      orderBy: { createdAt: "desc" },
      take: 10_000,
    });
    const items = users.map((u: any) => {
      const name =
        u.profile && (u.profile.firstName || u.profile.lastName)
          ? `${u.profile.firstName || ""} ${u.profile.lastName || ""}`.trim()
          : undefined;
      return {
        id: u.id,
        name,
        email: u.email,
      };
    });
    items.sort((a: any, b: any) => {
      const an = (a.name || "").toString();
      const bn = (b.name || "").toString();
      return an.localeCompare(bn, undefined, { sensitivity: "base" });
    });
    return items;
  }

  async exportCustomers(filters: { search?: string; status?: string } = {}) {
    const where: any = { role: "CUSTOMER" };
    const q = (filters.search || "").toString().trim();
    if (q.length > 0) {
      where.OR = [
        { email: { contains: q, mode: "insensitive" } },
        { phoneNumber: { contains: q, mode: "insensitive" } },
        { profile: { firstName: { contains: q, mode: "insensitive" } } } as any,
        { profile: { lastName: { contains: q, mode: "insensitive" } } } as any,
      ];
    }
    if (filters.status) {
      const s = String(filters.status).toUpperCase();
      if (s === "ACTIVE") where.isActive = true;
      if (s === "DEACTIVATED") where.isActive = false;
    }
    const users = await prisma.user.findMany({
      where,
      include: { profile: true },
      orderBy: { createdAt: "desc" },
      take: 10_000,
    });
    const userIds = users.map((u: any) => u.id);
    const txAgg =
      userIds.length === 0
        ? []
        : await prisma.transaction.groupBy({
            by: ["userId"],
            where: { userId: { in: userIds } },
            _count: { _all: true },
            _sum: { nairaEquivalent: true, foreignAmount: true },
          });
    const aggByUser: Record<string, { totalTransactions: number; transactionVolume: number }> = {};
    for (const row of txAgg as any[]) {
      const count = row._count?._all || 0;
      const nairaSum = Number(row._sum?.nairaEquivalent || 0);
      const foreignSum = Number(row._sum?.foreignAmount || 0);
      const volume = nairaSum || foreignSum || 0;
      aggByUser[row.userId] = { totalTransactions: count, transactionVolume: volume };
    }
    return (users || []).map((u: any) => {
      const name =
        u.profile && (u.profile.firstName || u.profile.lastName)
          ? `${u.profile.firstName || ""} ${u.profile.lastName || ""}`.trim()
          : undefined;
      const agg = aggByUser[u.id] || { totalTransactions: 0, transactionVolume: 0 };
      return {
        id: u.id,
        name,
        phoneNumber: u.phoneNumber,
        email: u.email,
        dateJoined: u.createdAt?.toISOString?.() || u.createdAt,
        totalTransactions: agg.totalTransactions,
        transactionVolume: agg.transactionVolume,
        status: u.isActive ? "Active" : "Deactivated",
      };
    });
  }

  async deactivateCustomer(userId: string, adminId?: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== "CUSTOMER") {
      throw new NotFoundError("Customer not found");
    }
    if (!user.isActive) {
      return { id: user.id, status: "DEACTIVATED" };
    }
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
      select: { id: true, isActive: true },
    });
    return { id: updated.id, status: updated.isActive ? "ACTIVE" : "DEACTIVATED" };
  }

  async toggleCustomerActive(userId: string, isActive: boolean, adminId?: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== "CUSTOMER") {
      throw new NotFoundError("Customer not found");
    }
    if (user.isActive === isActive) {
      return { id: user.id, status: user.isActive ? "ACTIVE" : "DEACTIVATED" };
    }
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isActive },
      select: { id: true, isActive: true },
    });
    return { id: updated.id, status: updated.isActive ? "ACTIVE" : "DEACTIVATED" };
  }

  // --------------------
  // Flags (stored in admin-service DB)
  // --------------------
  async createFlag(userId: string, adminId: string, payload: CreateCustomerFlagPayload) {
    if (!payload.description || payload.description.trim().length < 2) {
      throw new ValidationError("description is required");
    }

    // Store locally in admin-service DB
    const flag = await prisma.customerFlag.create({
      data: {
        userId,
        type: payload.type as any,
        severity: payload.severity as any,
        title: payload.title,
        description: payload.description,
        details: payload.details,
        createdBy: adminId,
      },
    });

    return flag;
  }

  async listCustomerFlags(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      prisma.customerFlag.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.customerFlag.count({ where: { userId } }),
    ]);

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async listAllFlags(filters: any, page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.type) where.type = filters.type;
    if (filters.severity) where.severity = filters.severity;
    if (filters.userId) where.userId = filters.userId;

    const [data, total] = await Promise.all([
      prisma.customerFlag.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.customerFlag.count({ where }),
    ]);

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async updateFlagStatus(flagId: string, adminId: string, payload: UpdateFlagStatusPayload) {
    const flag = await prisma.customerFlag.findUnique({ where: { id: flagId } });
    if (!flag) throw new NotFoundError("Flag not found");

    const data: any = {
      status: payload.status,
      updatedAt: new Date(),
    };

    if (payload.status === "RESOLVED" || payload.status === "DISMISSED") {
      data.resolvedAt = new Date();
      data.resolvedBy = adminId;
      data.resolutionNotes = payload.resolutionNotes;
    } else {
      // If re-opening, clear resolution fields
      data.resolvedAt = null;
      data.resolvedBy = null;
      data.resolutionNotes = null;
    }

    return prisma.customerFlag.update({
      where: { id: flagId },
      data,
    });
  }
}

export default new CustomerService();
