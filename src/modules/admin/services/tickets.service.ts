import { createLogger, generateId, UploadResult, ValidationError } from "../../../shared/utils";
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
  attachment?: TicketAttachmentInput;
};

export type TicketAttachmentInput = {
  url: string;
  publicId: string;
  format: string;
  bytes: number;
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
    const search = (filters.search || "").toString().trim();
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.category) where.caseType = filters.category;
    if (filters.priority) where.priority = filters.priority;
    if (search) {
      where.OR = [
        { caseType: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
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
    this.validateCreatePayload(payload);

    const reference = generateId();
    const prio = (payload.priorityLevel || 'MEDIUM').toString().toUpperCase();
    if (!['LOW', 'MEDIUM', 'HIGH'].includes(prio)) {
      throw new ValidationError('priorityLevel must be LOW, MEDIUM or HIGH');
    }
    const customerId = await this.resolveCustomerId(payload.customer);

    const ticket = await prisma.$transaction(async (tx) => {
      const created = await tx.ticket.create({
        data: {
          reference,
          customerId,
          caseType: payload.caseType,
          description: payload.description.trim(),
          priority: prio as any,
          status: 'OPEN',
          attachments: payload.attachment
            ? {
              create: {
                fileUrl: payload.attachment.url,
                mimeType: payload.attachment.format,
                fileSize: payload.attachment.bytes,
              },
            }
          : undefined,
      },
      include: {
        attachments: true,
      },
    });

    return created;
  });

  logger.info('Ticket created successfully', {
    ticketId: ticket.id,
    reference: ticket.reference,
  });

  return ticket;
}

private validateCreatePayload(payload: CreateTicketPayload): void {
  const requiredFields = ['customer', 'caseType', 'priorityLevel', 'description'] as const;

  for (const field of requiredFields) {
    if (!payload[field]) {
      throw new ValidationError(`${field} is required`);
    }
  }

  if (payload.attachment) {
    this.validateAttachment(payload.attachment);
  }
}

private validateAttachment(attachment: {
  url: string;
  format: string;
  bytes?: number;
}) {
  const allowedMimeTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
  ];

  if (!attachment.url) {
    throw new ValidationError('attachment url is required');
  }

  if (!allowedMimeTypes.includes(attachment.format)) {
    throw new ValidationError(
      'Attachment must be one of: PDF, JPG, JPEG, PNG'
    );
  }

  if (attachment.bytes && attachment.bytes > 200 * 1024) {
    throw new ValidationError('Attachment exceeds 200KB limit');
  }
}

  private async resolveCustomerId(input: string): Promise<string> {
    const client: any = prisma as any;
    const s = (input || '').toString().trim();
    if (!s) throw new ValidationError('customer is required');
    let user: any = null;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)) {
      user = await client.user.findUnique({ where: { id: s } });
    }
    if (!user && s.includes('@')) {
      user = await client.user.findUnique({ where: { email: s } });
    }
    if (!user && /^\+?\d{7,}$/.test(s)) {
      user = await client.user.findUnique({ where: { phoneNumber: s } });
    }
    if (!user) {
      throw new ValidationError('customer must be a valid user id, email, or phone');
    }
    if (user.role !== 'CUSTOMER') {
      throw new ValidationError('customer must be a CUSTOMER user');
    }
    return user.id;
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
