import { PrismaClient } from "@prisma/client";
import { getDatabase } from "../../../config/database";
import { ValidationError } from "../../../shared/utils/errors";

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

  async get(id: string) {
    const client: any = prisma as any;
    return client.agent.findUnique({
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
      },
    });
  }

  async update(id: string, data: { name?: string; email?: string; phoneNumber?: string; branch?: string }) {
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
}

export const agentService = new AgentService();
