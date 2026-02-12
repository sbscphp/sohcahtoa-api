import { PrismaClient } from "@prisma/client";
import { getDatabase } from "../../../config/database";

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
    const q = (filters.q || "").toString().trim();
    const where: any = {};
    if (filters.isActive !== undefined) where.isActive = filters.isActive === "true";
    if (q) {
      where.OR = [
        { fullName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phoneNumber: { contains: q, mode: "insensitive" } },
      ];
    }
    const skip = (page - 1) * limit;
    const [total, items] = await Promise.all([
      prisma.adminUser.count({ where }),
      prisma.adminUser.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          fullName: true,
          email: true,
          phoneNumber: true,
          branch: true,
          isActive: true,
          createdAt: true,
        },
      }),
    ]);
    return { data: items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async get(id: string) {
    return prisma.adminUser.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        branch: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateStatus(id: string, isActive: boolean) {
    return prisma.adminUser.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        branch: true,
        isActive: true,
        updatedAt: true,
      },
    });
  }

  async create(data: { name: string; email: string; phoneNumber: string; attachment?: { fileUrl: string; fileName?: string; fileSize?: number; mimeType?: string } }) {
    if (!data.name || !data.email || !data.phoneNumber) {
      throw new Error("name, email, phoneNumber are required");
    }
    const client: any = prisma as any;
    const created = await client.agent.create({
      data: {
        name: data.name,
        email: data.email,
        phoneNumber: data.phoneNumber,
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
      include: { attachments: true },
    });
    return created;
  }
}

export const agentService = new AgentService();
