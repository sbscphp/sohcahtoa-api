import { PrismaClient } from "@prisma/client";
import { getDatabase } from "../../../config/database";

const prisma: PrismaClient = getDatabase();

type LogPayload = {
  adminId: string;
  actionType: string;
  actionLabel?: string;
  resourceType: string;
  resourceId: string;
  previousState?: any;
  newState?: any;
  reason?: string;
  metadata?: any;
  status?: "SUCCESS" | "PENDING" | "FAILED";
  ipAddress?: string;
  userAgent?: string;
  departmentId?: string;
};

class AuditTrailService {
  async logAction(payload: LogPayload) {
    const data: any = {
      adminId: payload.adminId,
      actionType: payload.actionType as any,
      actionLabel: payload.actionLabel || null,
      resourceType: payload.resourceType,
      resourceId: payload.resourceId,
      previousState: payload.previousState || null,
      newState: payload.newState || null,
      reason: payload.reason || null,
      metadata: payload.metadata || null,
      performedAt: new Date(),
      ipAddress: payload.ipAddress || null,
      userAgent: payload.userAgent || null,
      status: payload.status || "SUCCESS",
      departmentId: payload.departmentId || null,
    };
    const client: any = prisma as any;
    return client.adminAction.create({ data });
  }

  async list(filters: any = {}, page = 1, limit = 20) {
    const q = (filters.q || "").toString().trim();
    const where: any = {};
    if (q) {
      where.OR = [
        { actionLabel: { contains: q, mode: "insensitive" } },
        { resourceType: { contains: q, mode: "insensitive" } },
        { resourceId: { contains: q, mode: "insensitive" } },
        { status: { contains: q, mode: "insensitive" } },
      ];
    }
    if (filters.module) where.resourceType = filters.module;
    if (filters.status) where.status = filters.status;
    if (filters.dateFrom || filters.dateTo) {
      where.performedAt = {};
      if (filters.dateFrom) where.performedAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.performedAt.lte = new Date(filters.dateTo);
    }
    const skip = (page - 1) * limit;
    const client: any = prisma as any;
    const [total, items] = await Promise.all([
      client.adminAction.count({ where }),
      client.adminAction.findMany({
        where,
        orderBy: { performedAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          performedAt: true,
          actionLabel: true,
          actionType: true,
          resourceType: true,
          resourceId: true,
          status: true,
          admin: { select: { id: true, fullName: true, email: true, departmentId: true } },
        },
      }),
    ]);
    return { data: items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
}

export const auditTrailService = new AuditTrailService();
