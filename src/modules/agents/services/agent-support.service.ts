import { getDatabase } from "../../../config/database";
import { NotFoundError, ValidationError } from "../../../shared/utils";
import { v2 as cloudinary } from "cloudinary";
import { createLogger } from "../../../shared/utils/logger";
import { UserRole } from "../../../shared/types";

const prisma = getDatabase();
const logger = createLogger("agent-support-service");

interface CreateAgentSupportTicketPayload {
  agentUserId: string;
  customerId: string;
  category: string;
  description: string;
  file?: Express.Multer.File;
}

class AgentSupportService {
  private async resolveAgent(agentUserId: string) {
    const agentUser = await prisma.user.findUnique({
      where: { id: agentUserId },
      select: { id: true, email: true, role: true },
    });

    if (!agentUser || agentUser.role !== UserRole.AGENT) {
      throw new ValidationError("Only agents can create support tickets");
    }

    const agent = await (prisma as any).agent.findUnique({
      where: { email: agentUser.email },
      select: { id: true },
    });

    if (!agent) {
      throw new ValidationError("Agent profile not found");
    }

    return agent as { id: string };
  }

  async createSupportTicket(payload: CreateAgentSupportTicketPayload) {
    const { agentUserId, customerId, category, description, file } = payload;

    logger.info("[createSupportTicket] Creating support ticket for customer (agent)", {
      agentUserId,
      customerId,
      category,
      hasAttachment: !!file,
    });

    const agent = await this.resolveAgent(agentUserId);

    const customer = await prisma.user.findFirst({
      where: { id: customerId, createdByAgentId: agent.id },
      select: { id: true },
    });

    if (!customer) {
      throw new NotFoundError("Customer not found or not owned by this agent");
    }

    const validCategories = [
      "TRANSACTION_ISSUE",
      "ACCOUNT_ACCESS",
      "PAYMENT_ISSUE",
      "DOCUMENT_VERIFICATION",
      "TECHNICAL_ISSUE",
      "COMPLIANCE_INQUIRY",
      "GENERAL_INQUIRY",
      "OTHER",
    ];

    if (!validCategories.includes(category)) {
      throw new ValidationError(
        `Invalid category. Must be one of: ${validCategories.join(", ")}`
      );
    }

    const normalizedDescription = description?.trim?.() ?? description;
    if (!normalizedDescription) {
      throw new ValidationError("Description is required");
    }

    const reference = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    const ticket = await prisma.ticket.create({
      data: {
        reference,
        customerId,
        caseType: category,
        description: normalizedDescription,
        priority: "MEDIUM",
        status: "OPEN",
        createdByAgentId: agent.id,
      },
    });

    let attachmentUrl: string | null = null;

    if (file) {
      try {
        logger.debug("[createSupportTicket] Uploading attachment to Cloudinary", {
          ticketId: ticket.id,
          fileName: file.originalname,
          fileSize: file.size,
        });

        const result = await new Promise<any>((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: `sochatoa/tickets/${ticket.id}`,
              resource_type: "auto",
            },
            (error, streamResult) => {
              if (error) reject(error);
              else resolve(streamResult);
            }
          );

          uploadStream.end(file.buffer);
        });

        await prisma.ticketAttachment.create({
          data: {
            ticketId: ticket.id,
            fileUrl: result.secure_url,
            fileName: file.originalname,
            fileSize: file.size,
            mimeType: file.mimetype,
          },
        });

        attachmentUrl = result.secure_url;
      } catch (error) {
        logger.error("[createSupportTicket] Failed to upload attachment", {
          ticketId: ticket.id,
          error: error instanceof Error ? error.message : String(error),
        });
        // Follow existing customer ticket behavior: do not fail ticket creation if attachment upload fails.
      }
    }

    return {
      ticketId: ticket.id,
      reference: ticket.reference,
      category: ticket.caseType,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      attachmentUrl,
      createdAt: ticket.createdAt,
      message:
        "Support ticket created successfully. Our team will respond to your inquiry shortly.",
    };
  }

  /**
   * List support tickets created by the authenticated agent.
   */
  async listAgentSupportTickets(agentUserId: string, page = 1, limit = 10) {
    const agent = await this.resolveAgent(agentUserId);

    const safePage = Math.max(1, page || 1);
    const safeLimit = Math.max(1, limit || 10);

    const skip = (safePage - 1) * safeLimit;
    const where = { createdByAgentId: agent.id };

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        select: {
          id: true,
          caseType: true,
          createdAt: true,
          status: true,
          description: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: safeLimit,
      }),
      prisma.ticket.count({ where }),
    ]);

    return {
      data: tickets.map((t) => ({
        id: t.id,
        caseType: t.caseType,
        category: t.caseType,
        timestamp: t.createdAt,
        status: t.status,
        description: t.description,
      })),
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit) || 1,
      },
    };
  }

  /**
   * Get detailed ticket info (including message history) for agent-owned tickets.
   */
  async getAgentSupportTicketDetails(agentUserId: string, ticketId: string) {
    const agent = await this.resolveAgent(agentUserId);

    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, createdByAgentId: agent.id },
      select: {
        id: true,
        reference: true,
        caseType: true,
        description: true,
        status: true,
        createdAt: true,
        customer: { select: { email: true } },
        comments: {
          select: {
            message: true,
            createdAt: true,
            admin: { select: { email: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundError("Ticket not found");
    }

    return {
      ticketId: ticket.id,
      reference: ticket.reference,
      category: ticket.caseType,
      description: ticket.description,
      status: ticket.status,
      timestamp: ticket.createdAt,
      customerEmail: ticket.customer.email,
      messages: (ticket.comments || []).map((comment) => ({
        senderMail: comment.admin?.email ?? ticket.customer.email,
        senderTimestamp: comment.createdAt,
        senderMessage: comment.message,
      })),
    };
  }
}

const agentSupportService = new AgentSupportService();
export default agentSupportService;

