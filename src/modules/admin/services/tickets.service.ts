import { createLogger, generateId, ValidationError } from "../../../shared/utils";
import { ServiceName } from "../../../shared/types";
import { PrismaClient } from "@prisma/client";
import { getDatabase } from "../../../config/database";

const logger = createLogger(ServiceName.ADMIN);
const prisma: PrismaClient = getDatabase();

type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
type TicketPriority = "LOW" | "MEDIUM" | "HIGH";

export type CreateTicketPayload = {
  customer: string;
  caseType: string;
  priorityLevel: TicketPriority;
  description: string;
  attachment?: {
    fileUrl: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string; // should be application/pdf
  };
};

export class TicketsService {
  async getStats() {
    const client: any = prisma as any;
    const [open, inProgress, resolved, closed, unassigned] = await Promise.all([
      client.ticket.count({ where: { status: "OPEN" } }),
      client.ticket.count({ where: { status: "IN_PROGRESS" } }),
      client.ticket.count({ where: { status: "RESOLVED" } }),
      client.ticket.count({ where: { status: "CLOSED" } }),
      client.ticket.count({ where: { assignedAgentId: null } }),
    ]);
    return { open, inProgress, resolved, closed, unassigned };
  }

  async list(filters: any = {}, page = 1, limit = 20) {
    const q = (filters.q || "").toString().trim();
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.category) where.caseType = filters.category;
    if (filters.priority) where.priority = filters.priority;
    if (q) {
      where.OR = [
        { caseType: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ];
    }
    const skip = (page - 1) * limit;
    const client: any = prisma as any;
    const [total, items] = await Promise.all([
      client.ticket.count({ where }),
      client.ticket.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          createdAt: true,
          status: true,
          priority: true,
          caseType: true,
          assignedAgentId: true,
          customerId: true,
        },
      }),
    ]);
    return {
      data: items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async get(id: string) {
    const client: any = prisma as any;
    const t = await client.ticket.findUnique({
      where: { id },
      include: { attachments: true, comments: true },
    });
    return t;
  }

  async create(payload: CreateTicketPayload) {
    if (!payload.customer || !payload.caseType || !payload.priorityLevel || !payload.description) {
      throw new ValidationError("customer, caseType, priorityLevel, description are required");
    }
    if (payload.attachment && payload.attachment.mimeType) {
      const allowed = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
      if (!allowed.includes(payload.attachment.mimeType)) {
        throw new ValidationError("attachment must be one of: PDF, JPG, JPEG, PNG");
      }
    }
    if (payload.attachment && typeof payload.attachment.fileSize === "number" && payload.attachment.fileSize > 200 * 1024) {
      throw new ValidationError("attachment exceeds 200KB limit");
    }
    const reference = generateId();
    const client: any = prisma as any;
    const created = await client.ticket.create({
      data: {
        reference,
        customerId: payload.customer,
        caseType: payload.caseType,
        description: payload.description,
        priority: payload.priorityLevel,
        status: "OPEN",
        attachments: payload.attachment
          ? {
              create: {
                fileUrl: payload.attachment.fileUrl,
                fileName: payload.attachment.fileName,
                fileSize: typeof payload.attachment.fileSize === "number" ? Math.floor(payload.attachment.fileSize) : null,
                mimeType: payload.attachment.mimeType || "application/pdf",
              },
            }
          : undefined,
      },
      include: { attachments: true },
    });
    logger.info(`Ticket created: ${created.id}`);
    return created;
  }

  async updateStatus(id: string, status: TicketStatus, notes?: string, adminId?: string) {
    const client: any = prisma as any;
    const ops: Array<any> = [
      client.ticket.update({
        where: { id },
        data: { status },
      }),
    ];
    if (notes) {
      ops.push(
        client.ticketComment.create({
          data: { ticketId: id, adminId, message: notes },
        })
      );
    }
    const [updated] = await client.$transaction(ops);
    return updated;
  }

  async assignAgent(id: string, adminId: string) {
    const client: any = prisma as any;
    const updated = await client.ticket.update({
      where: { id },
      data: { assignedAgentId: adminId },
    });
    return updated;
  }

  async addComment(id: string, adminId: string, message: string) {
    const client: any = prisma as any;
    const comment = await client.ticketComment.create({
      data: { ticketId: id, adminId, message },
    });
    return comment;
  }
}

export const ticketsService = new TicketsService();
