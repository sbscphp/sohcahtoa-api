import { PrismaClient } from "@prisma/client";
import { getDatabase } from "../../../config/database";
import { ValidationError, NotFoundError } from "../../../shared/utils/errors";

const prisma: PrismaClient = getDatabase();

class AgentService {
  async stats() {
    const client: any = prisma as any;
    const [total, active, deactivated, pendingApproval] = await Promise.all([
      client.agent.count(),
      client.agent.count({ where: { isActive: true, isApproved: true } }),
      client.agent.count({ where: { isActive: false, isApproved: true } }),
      client.agent.count({ where: { isApproved: false } }),
    ]);
    return { total, active, deactivated, pendingApproval };
  }

  async list(filters: any = {}, page = 1, limit = 20) {
    const search = (((filters || {}).search ?? (filters || {}).q) || "").toString().trim();
    const where: any = {};
    if (filters.isActive !== undefined) where.isActive = filters.isActive === "true";
    const fromDateRaw = (filters.fromDate || "").toString().trim();
    const toDateRaw = (filters.toDate || "").toString().trim();
    const createdRange: any = {};
    if (fromDateRaw) {
      const d = new Date(fromDateRaw);
      if (!isNaN(d.getTime())) createdRange.gte = d;
    }
    if (toDateRaw) {
      const d = new Date(toDateRaw);
      if (!isNaN(d.getTime())) createdRange.lte = d;
    }
    if (createdRange.gte || createdRange.lte) {
      where.createdAt = createdRange;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phoneNumber: { contains: search, mode: "insensitive" } },
      ];
    }
    const skip = (page - 1) * limit;
    const sortOrder = ((filters.sort || "").toString().toLowerCase() === "asc" ? "asc" : "desc") as "asc" | "desc";
    const [total, items] = await Promise.all([
      (prisma as any).agent.count({ where }),
      (prisma as any).agent.findMany({
        where,
        orderBy: { createdAt: sortOrder },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
          isActive: true,
          isApproved: true,
          createdAt: true,
        },
      }),
    ]);
    return { data: items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
  
  async export(filters: any = {}) {
    const where: any = {};
    const search = (((filters || {}).search ?? (filters || {}).q) || "").toString().trim();
    if (filters.isActive !== undefined) where.isActive = String(filters.isActive) === "true";
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phoneNumber: { contains: search, mode: "insensitive" } },
      ];
    }
    const sortOrder = ((filters.sort || "").toString().toLowerCase() === "asc" ? "asc" : "desc") as "asc" | "desc";
    const client: any = prisma as any;
    const agents = await client.agent.findMany({
      where,
      orderBy: { createdAt: sortOrder },
      take: 10_000,
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        isActive: true,
      },
    });
    const results = await Promise.all(
      (agents || []).map(async (a: any) => {
        const [count, sumNairaAgg, sumForeignAgg, sumPickupAgg] = await Promise.all([
          client.transaction.count({ where: { createdByAgentId: a.id } }),
          client.transaction.aggregate({
            where: { createdByAgentId: a.id, nairaEquivalent: { not: null } },
            _sum: { nairaEquivalent: true },
          }),
          client.transaction.aggregate({
            where: { createdByAgentId: a.id, nairaEquivalent: null, foreignAmount: { not: null } },
            _sum: { foreignAmount: true },
          }),
          client.cashPickup.aggregate({
            where: { transaction: { createdByAgentId: a.id, nairaEquivalent: null, foreignAmount: null } },
            _sum: { amount: true },
          }),
        ]);
        const volNaira = Number((sumNairaAgg as any)?._sum?.nairaEquivalent || 0);
        const volForeign = Number((sumForeignAgg as any)?._sum?.foreignAmount || 0);
        const volPickup = Number((sumPickupAgg as any)?._sum?.amount || 0);
        const vol = volNaira + volForeign + volPickup;
        return {
          agentName: a.name,
          agentId: a.id,
          contactPhone: a.phoneNumber,
          contactEmail: a.email,
          totalTransactions: count,
          transactionVolume: vol,
          status: a.isActive ? "Active" : "Deactivated",
        };
      })
    );
    return results;
  }

  async get(id: string) {
    const client: any = prisma as any;
    const agent = await client.agent.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        isActive: true,
        isApproved: true,
        createdAt: true,
        updatedAt: true,
        branchId: true,
        branch: {
          select: {
            id: true,
            name: true,
            state: true,
            address: true,
            email: true,
            phoneNumber: true,
            branchManager: true,
          },
        },
        attachments: {
          select: {
            id: true,
            fileUrl: true,
            fileName: true,
            fileSize: true,
            mimeType: true,
            createdAt: true,
          },
        },
      },
    });
    if (!agent) return null;
    const branchId = agent.branchId || null;
    let where: any = {};
    if (branchId) {
      where = { pickupLocationId: branchId };
    } else if (agent.branch?.name) {
      where = { pickupLocation: agent.branch.name };
    } else {
      return { ...agent, totalTransactions: 0, transactionValue: 0 };
    }
    const [totalTransactions, sumAgg] = await Promise.all([
      client.cashPickup.count({ where }),
      client.cashPickup.aggregate({ where, _sum: { amount: true } }),
    ]);
    const transactionValue = Number((sumAgg as any)?._sum?.amount || 0);
    const { branchId: _omit, ...rest } = agent as any;
    return { ...rest, totalTransactions, transactionValue };
  }

  async update(id: string, data: { name?: string; email?: string; phoneNumber?: string; branch?: string; attachment?: { fileUrl: string; fileName?: string; fileSize?: number; mimeType?: string } }) {
    if (!data || (!data.name && !data.email && !data.phoneNumber && !data.branch)) {
      throw new ValidationError("No update fields provided");
    }
    const client: any = prisma as any;
    if (data.email) {
      const existingEmail = await client.agent.findFirst({
        where: { email: data.email, NOT: { id } },
        select: { id: true },
      });
      if (existingEmail) {
        throw new ValidationError("Agent with this email already exists", { field: "email" });
      }
    }
    if (data.phoneNumber) {
      const existingPhone = await client.agent.findFirst({
        where: { phoneNumber: data.phoneNumber, NOT: { id } },
        select: { id: true },
      });
      if (existingPhone) {
        throw new ValidationError("Agent with this phone number already exists", { field: "phoneNumber" });
      }
    }
    let branchIdUpdate: any = {};
    if (data.branch) {
      const foundBranch = await client.branch.findFirst({
        where: { name: { equals: data.branch, mode: "insensitive" } },
        select: { id: true },
      });
      if (!foundBranch) {
        throw new ValidationError("Branch not found", { branch: data.branch });
      }
      branchIdUpdate.branchId = foundBranch.id;
    }
    const updated = await client.agent.update({
      where: { id },
      data: {
        name: data.name,
        email: data.email,
        phoneNumber: data.phoneNumber,
        ...branchIdUpdate,
        ...(data.attachment
          ? {
              attachments: {
                create: {
                  fileUrl: data.attachment.fileUrl,
                  fileName: data.attachment.fileName,
                  fileSize: typeof data.attachment.fileSize === "number" ? Math.floor(data.attachment.fileSize) : null,
                  mimeType: data.attachment.mimeType || null,
                },
              },
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        isActive: true,
        isApproved: true,
        updatedAt: true,
      },
    });
    if (data.attachment) {
      await client.agentAttachment.create({
        data: {
          agentId: id,
          fileUrl: data.attachment.fileUrl,
          fileName: data.attachment.fileName || null,
          fileSize: typeof data.attachment.fileSize === "number" ? Math.floor(data.attachment.fileSize) : null,
          mimeType: data.attachment.mimeType || null,
        },
      });
    }
    return updated;
  }
  
  async updateStatus(id: string, isActive: boolean) {
    const client: any = prisma as any;
    return client.agent.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        isActive: true,
        isApproved: true,
        updatedAt: true,
      },
    });
  }

  async updateApproval(id: string, isApproved: boolean) {
    const client: any = prisma as any;
    return client.agent.update({
      where: { id },
      data: { isApproved },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        isActive: true,
        isApproved: true,
        updatedAt: true,
      },
    });
  }
  async create(data: { name: string; email: string; phoneNumber: string; branch: string; attachment?: { fileUrl: string; fileName?: string; fileSize?: number; mimeType?: string } }) {
    if (!data.name || !data.email || !data.phoneNumber || !data.branch) {
      throw new ValidationError("name, email, phoneNumber, branch are required");
    }
    const client: any = prisma as any;
    const existing = await client.agent.findFirst({
      where: {
        OR: [
          { email: data.email },
          { phoneNumber: data.phoneNumber },
        ],
      },
      select: { id: true, email: true, phoneNumber: true },
    });
    if (existing) {
      if (existing.email === data.email) {
        throw new ValidationError("Agent with this email already exists", { field: "email" });
      }
      if (existing.phoneNumber === data.phoneNumber) {
        throw new ValidationError("Agent with this phone number already exists", { field: "phoneNumber" });
      }
      throw new ValidationError("Duplicate agent record", { email: data.email, phoneNumber: data.phoneNumber });
    }
    const foundBranch = await client.branch.findFirst({
      where: { name: { equals: data.branch, mode: "insensitive" } },
      select: { id: true, name: true },
    });
    if (!foundBranch) {
      throw new ValidationError("Branch not found", { branch: data.branch });
    }
    const created = await client.agent.create({
      data: {
        name: data.name,
        email: data.email,
        phoneNumber: data.phoneNumber,
        branchId: foundBranch.id,
        isApproved: false,
        attachments: data.attachment
          ? {
              create: {
                fileUrl: data.attachment.fileUrl,
                fileName: data.attachment.fileName,
                fileSize: typeof data.attachment.fileSize === "number" ? Math.floor(data.attachment.fileSize) : null,
                mimeType: data.attachment.mimeType || null,
              },
            }
          : undefined,
      },
      include: { attachments: true, branch: true },
    });
    return created;
  }

  async transactions(agentId: string, filters: any = {}, page = 1, limit = 20) {
    const client: any = prisma as any;
    const agent = await client.agent.findUnique({ where: { id: agentId }, select: { id: true } });
    if (!agent) {
      throw new NotFoundError("Agent not found");
    }

    const where: any = { createdByAgentId: agentId };
    if (filters.status) where.status = filters.status;
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
    }

    const skip = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      client.transaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          status: true,
          currency: true,
          type: true,
          currentStep: true,
          referenceNumber: true,
          nairaEquivalent: true,
          foreignAmount: true,
          createdAt: true,
          cashPickup: {
            select: {
              id: true,
              status: true,
              currency: true,
              createdAt: true,
              pickupCode: true,
              pickupLocation: true,
              pickupLocationId: true,
              amount: true,
            },
          },
        },
      }),
      client.transaction.count({ where }),
    ]);
    const data = rows.map((r: any) => {
      const pickup = r.cashPickup || null;
      const value = Number(r.nairaEquivalent || r.foreignAmount || pickup?.amount || 0);
      return {
        transactionId: r.id,
        referenceNumber: r.referenceNumber || null,
        type: r.type || null,
        status: r.status || null,
        stage: r.currentStep || null,
        value,
        currency: r.currency || null,
        pickup: pickup
          ? {
              id: pickup.id,
              location: pickup.pickupLocation,
              locationId: pickup.pickupLocationId,
              code: pickup.pickupCode,
              status: pickup.status,
              createdAt: pickup.createdAt,
            }
          : null,
        createdAt: r.createdAt,
      };
    });
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async transaction(agentId: string, transactionId: string) {
    const client: any = prisma as any;
    const agent = await client.agent.findUnique({ where: { id: agentId }, select: { id: true } });
    if (!agent) throw new NotFoundError("Agent not found");
    const row = await client.transaction.findFirst({
      where: { id: transactionId, createdByAgentId: agentId },
      select: {
        id: true,
        referenceNumber: true,
        type: true,
        status: true,
        currentStep: true,
        currency: true,
        createdAt: true,
        updatedAt: true,
        destinationCountry: true,
        nairaEquivalent: true,
        foreignAmount: true,
        userId: true,
        documents: {
          select: { id: true },
        },
        cashPickup: {
          select: {
            id: true,
            status: true,
            currency: true,
            createdAt: true,
            pickupCode: true,
            pickupLocation: true,
            pickupLocationId: true,
            amount: true,
          },
        },
      },
    });
    if (!row) throw new NotFoundError("Transaction not found for this agent");
    const pickup = (row as any).cashPickup || null;
    const value = Number(row.nairaEquivalent || row.foreignAmount || pickup?.amount || 0);
    const docCount = Array.isArray((row as any).documents) ? (row as any).documents.length : 0;
    return {
      transactionId: row.id,
      referenceNumber: row.referenceNumber || null,
      type: row.type || null,
      status: row.status || null,
      stage: row.currentStep || null,
      currency: row.currency || null,
      amounts: {
        nairaEquivalent: Number(row.nairaEquivalent || 0),
        foreignAmount: Number(row.foreignAmount || 0),
        pickupAmount: Number(pickup?.amount || 0),
        value,
      },
      pickup: pickup
        ? {
            id: pickup.id,
            location: pickup.pickupLocation,
            locationId: pickup.pickupLocationId,
            code: pickup.pickupCode,
            status: pickup.status,
            createdAt: pickup.createdAt,
          }
        : null,
      meta: {
        documents: { count: docCount },
        destinationCountry: row.destinationCountry || null,
      },
      createdAt: row.createdAt,
    };
  }
}

export const agentService = new AgentService();
