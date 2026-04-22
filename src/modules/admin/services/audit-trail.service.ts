import { PrismaClient } from "@prisma/client";
import { getDatabase } from "../../../config/database";
import { v4 as uuidv4 } from "uuid";

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
      actionType: String(payload.actionType),
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
    try {
      return client.adminAction.create({ data });
    } catch (error: any) {
      const msg = String(error?.message || "");
      if (
        msg.includes("Invalid value for argument `actionType`") ||
        msg.includes('invalid input value for enum "ActionType"') ||
        msg.includes('enum "ActionType"') ||
        msg.includes('Error converting field "actionType"') ||
        msg.includes('expected non-nullable type "String"')
      ) {
        if (data.actionType === "AGENT_APPROVE" || data.actionType === "AGENT_DEACTIVATE") {
          data.actionType = "AGENT_UPDATE_STATUS";
          return client.adminAction.create({ data });
        }
        // Fallback: preserve original as label and default to REPORT_GENERATE
        data.actionLabel = data.actionLabel || String(payload.actionType || "");
        data.actionType = "REPORT_GENERATE";
        try {
          return client.adminAction.create({ data });
        } catch (_err: any) {
          // Final fallback: raw SQL insert to bypass Prisma model/type mismatch
          const id = uuidv4();
          const ps = data.previousState ? JSON.stringify(data.previousState) : null;
          const ns = data.newState ? JSON.stringify(data.newState) : null;
          const md = data.metadata ? JSON.stringify(data.metadata) : null;
          await client.$executeRawUnsafe(
            'INSERT INTO "admin_actions" ("id","adminId","actionType","actionLabel","resourceType","resourceId","previousState","newState","reason","metadata","performedAt","ipAddress","userAgent","status","departmentId") VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10::jsonb,$11,$12,$13,$14,$15)',
            id,
            data.adminId,
            String(data.actionType),
            data.actionLabel,
            data.resourceType,
            data.resourceId,
            ps,
            ns,
            data.reason,
            md,
            data.performedAt,
            data.ipAddress,
            data.userAgent,
            data.status,
            data.departmentId
          );
          return { id, ...data };
        }
      }
      throw error;
    }
  }

  async list(filters: any = {}, page = 1, limit = 20) {
    const search = (filters.search || "").toString().trim();
    const where: any = {};
    if (search) {
      where.OR = [
        { actionLabel: { contains: search, mode: "insensitive" } },
        { resourceType: { contains: search, mode: "insensitive" } },
        { resourceId: { contains: search, mode: "insensitive" } },
        { status: { contains: search, mode: "insensitive" } },
      ];
    }
    if (filters.module) {
      where.resourceType = { equals: filters.module, mode: "insensitive" };
    }
    if (filters.status) where.status = { equals: filters.status, mode: "insensitive" };
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

  async export(filters: any = {}) {
    const search = (filters.search || "").toString().trim();
    const where: any = {};
    if (search) {
      where.OR = [
        { actionLabel: { contains: search, mode: "insensitive" } },
        { resourceType: { contains: search, mode: "insensitive" } },
        { resourceId: { contains: search, mode: "insensitive" } },
        { status: { contains: search, mode: "insensitive" } },
      ];
    }
    if (filters.module) {
      where.resourceType = { equals: filters.module, mode: "insensitive" };
    }
    if (filters.status) where.status = { equals: filters.status, mode: "insensitive" };
    if (filters.dateFrom || filters.dateTo) {
      where.performedAt = {};
      if (filters.dateFrom) where.performedAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.performedAt.lte = new Date(filters.dateTo);
    }
    const client: any = prisma as any;
    const items = await client.adminAction.findMany({
      where,
      orderBy: { performedAt: "desc" },
      take: 10_000,
      select: {
        id: true,
        performedAt: true,
        actionLabel: true,
        actionType: true,
        resourceType: true,
        resourceId: true,
        status: true,
        previousState: true,
        newState: true,
        metadata: true,
        admin: { select: { id: true, fullName: true, email: true, departmentId: true } },
      },
    });
    const deptIds = Array.from(new Set((items || []).map((i: any) => i.admin?.departmentId).filter(Boolean))) as string[];
    const departments = deptIds.length
      ? await client.department.findMany({ where: { id: { in: deptIds } }, select: { id: true, name: true } })
      : [];
    const deptMap = new Map<string, string>();
    for (const d of departments as any[]) deptMap.set(d.id, d.name);
    const toTitle = (s: string | null | undefined) => {
      if (!s) return "";
      const up = String(s).toUpperCase();
      if (up === "SUCCESS") return "Success";
      if (up === "FAILED") return "Failed";
      if (up === "PENDING") return "Pending";
      return s;
    };
    const formatAffected = (i: any) => {
      const type = String(i.resourceType || "").toUpperCase();
      const ns = i.newState || i.previousState || {};
      if (type === "RATE") {
        const from = ns.fromCurrency || i.metadata?.fromCurrency;
        const to = ns.toCurrency || i.metadata?.toCurrency;
        if (from && to) return `${from}-${to} Rates`;
      } else if (type === "TRANSACTION") {
        if (i.metadata?.referenceNumber) return `Transaction ${i.metadata.referenceNumber}`;
        return `Transaction #${i.resourceId}`;
      } else if (type === "INCIDENCE") {
        return `Ticket #${i.resourceId}`;
      } else if (type === "AGENT") {
        const name = ns.name || i.metadata?.name;
        if (name) return `Agent: ${name}`;
        return `Agent #${i.resourceId}`;
      } else if (type === "OUTLET") {
        const name = ns.name || i.metadata?.name;
        if (name) return `Franchise: ${name}`;
        return `Franchise #${i.resourceId}`;
      } else if (type === "BRANCH") {
        const name = ns.name || i.metadata?.branchName || i.metadata?.name;
        if (name) return `Branch: ${name}`;
        return `Branch #${i.resourceId}`;
      } else if (type === "USER_MANAGEMENT") {
        const role = i.metadata?.name;
        const fullName = i.metadata?.fullName;
        const email = i.metadata?.email;
        if (role) return `Role: ${role}`;
        if (fullName) return `Admin: ${fullName}`;
        if (email) return `Admin: ${email}`;
        return `User Management #${i.resourceId}`;
      }
      return i.resourceId || "";
    };
    return (items || []).map((i: any) => {
      const dept = i.admin?.departmentId ? deptMap.get(i.admin.departmentId) : "";
      const actionBy = [i.admin?.fullName || "", dept || ""].filter(Boolean).join("\n");
      return {
        timeStamp: i.performedAt,
        actionBy,
        moduleAffected: i.resourceType || "",
        actionTaken: i.actionLabel || "",
        affectedSystem: formatAffected(i),
        status: toTitle(i.status),
      };
    });
  }
}
  
export const auditTrailService = new AuditTrailService();
