import { getDatabase } from "../../../config/database";
import { NotFoundError, ValidationError } from "../../../shared/utils";
import { v2 as cloudinary } from "cloudinary";
import { createLogger } from "../../../shared/utils/logger";
import { emailService } from "../../../shared/utils/email";

const prisma = getDatabase();
const logger = createLogger('customer-support-service');

interface CreateSupportTicketPayload {
  customerId: string;
  category: string;
  description: string;
  file?: Express.Multer.File;
}

export class CustomerSupportService {
  /**
   * Create a new support ticket
   */
  async createSupportTicket(payload: CreateSupportTicketPayload) {
    const { customerId, category, description, file } = payload;

    logger.info(`[createSupportTicket] Creating support ticket for customer`, {
      customerId,
      category,
      hasFile: !!file,
    });

    // Validate customer exists
    const customer = await prisma.user.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        email: true,
        profile: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!customer) {
      logger.error(`[createSupportTicket] Customer not found: ${customerId}`);
      throw new NotFoundError("Customer not found");
    }

    // Validate category
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
      logger.error(`[createSupportTicket] Invalid category: ${category}`);
      throw new ValidationError(
        `Invalid category. Must be one of: ${validCategories.join(", ")}`
      );
    }

    // Generate unique reference number
    const reference = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    logger.debug(`[createSupportTicket] Generated reference: ${reference}`);

    // Create the ticket
    const ticket = await prisma.ticket.create({
      data: {
        reference,
        customerId,
        caseType: category,
        description,
        priority: "MEDIUM",
        status: "OPEN",
      },
      include: {
        customer: {
          select: {
            email: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    logger.info(`[createSupportTicket] Ticket created successfully`, {
      ticketId: ticket.id,
      reference: ticket.reference,
      customerId,
    });

    // Upload attachment if provided
    let attachmentUrl = null;
    if (file) {
      try {
        logger.debug(`[createSupportTicket] Uploading attachment to Cloudinary`, {
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
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          uploadStream.end(file.buffer);
        });

        logger.info(`[createSupportTicket] Attachment uploaded successfully`, {
          ticketId: ticket.id,
          cloudinaryPublicId: result.public_id,
          fileUrl: result.secure_url,
        });

        // Save attachment record
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

        logger.debug(`[createSupportTicket] Attachment record saved`, {
          ticketId: ticket.id,
        });
      } catch (error) {
        logger.error(`[createSupportTicket] Failed to upload attachment`, {
          ticketId: ticket.id,
          error: error instanceof Error ? error.message : String(error),
        });
        // Don't fail ticket creation if attachment upload fails
        // Just log the error
      }
    }

    logger.info(`[createSupportTicket] Support ticket creation completed`, {
      ticketId: ticket.id,
      reference: ticket.reference,
      customerId,
      hasAttachment: !!attachmentUrl,
    });

    if (customer?.email) {
      emailService.sendSupportTicketCreatedEmail(
        customer.email,
        customer.profile?.firstName || "Customer",
        {
          reference: ticket.reference,
          caseType: ticket.caseType,
          priority: ticket.priority,
          description: ticket.description,
        }
      ).catch((err: any) => {
        logger.error(`[createSupportTicket] Failed to send confirmation email to ${customer.email}:`, err);
      });
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
      message: "Support ticket created successfully. Our team will respond to your inquiry shortly.",
    };
  }

  /**
   * Get customer's support tickets (paginated and filterable)
   */
  async getCustomerTickets(
    customerId: string,
    filters: {
      status?: string;
      category?: string;
      search?: string;
    } = {},
    page = 1,
    limit = 10
  ) {
    logger.info(`[getCustomerTickets] Fetching tickets for customer`, {
      customerId,
      filters,
      page,
      limit,
    });

    const skip = (page - 1) * limit;
    const where: any = { customerId };

    // Apply filters
    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.category) {
      where.caseType = filters.category;
    }

    if (filters.search) {
      where.OR = [
        { reference: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
        { caseType: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        select: {
          id: true,
          reference: true,
          caseType: true,
          description: true,
          status: true,
          priority: true,
          createdAt: true,
          updatedAt: true,
          assignedAgent: {
            select: {
              fullName: true,
              email: true,
            },
          },
          _count: {
            select: {
              comments: true,
              attachments: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.ticket.count({ where }),
    ]);

    logger.info(`[getCustomerTickets] Tickets fetched successfully`, {
      customerId,
      ticketCount: tickets.length,
      total,
      totalPages: Math.ceil(total / limit),
    });

    return {
      data: tickets.map((ticket) => ({
        id: ticket.id,
        reference: ticket.reference,
        category: ticket.caseType,
        description: ticket.description,
        status: ticket.status,
        priority: ticket.priority,
        assignedAgent: ticket.assignedAgent
          ? {
              name: ticket.assignedAgent.fullName,
              email: ticket.assignedAgent.email,
            }
          : null,
        commentsCount: ticket._count.comments,
        attachmentsCount: ticket._count.attachments,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get ticket details by ID
   */
  async getTicketDetails(ticketId: string, customerId: string) {
    logger.info(`[getTicketDetails] Fetching ticket details`, {
      ticketId,
      customerId,
    });

    const ticket = await prisma.ticket.findFirst({
      where: {
        id: ticketId,
        customerId,
      },
      include: {
        customer: {
          select: {
            email: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        assignedAgent: {
          select: {
            fullName: true,
            email: true,
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
          orderBy: {
            createdAt: "asc",
          },
        },
        comments: {
          select: {
            id: true,
            message: true,
            createdAt: true,
            admin: {
              select: {
                fullName: true,
                email: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!ticket) {
      logger.error(`[getTicketDetails] Ticket not found or access denied`, {
        ticketId,
        customerId,
      });
      throw new NotFoundError("Ticket not found");
    }

    logger.info(`[getTicketDetails] Ticket details fetched successfully`, {
      ticketId,
      customerId,
      reference: ticket.reference,
      status: ticket.status,
      commentsCount: ticket.comments.length,
      attachmentsCount: ticket.attachments.length,
    });

    return {
      id: ticket.id,
      reference: ticket.reference,
      category: ticket.caseType,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      customer: {
        name: ticket.customer.profile
          ? `${ticket.customer.profile.firstName} ${ticket.customer.profile.lastName}`
          : null,
        email: ticket.customer.email,
      },
      assignedAgent: ticket.assignedAgent
        ? {
            name: ticket.assignedAgent.fullName,
            email: ticket.assignedAgent.email,
          }
        : null,
      attachments: ticket.attachments,
      comments: ticket.comments.map((comment) => ({
        id: comment.id,
        message: comment.message,
        createdAt: comment.createdAt,
        author: comment.admin
          ? {
              name: comment.admin.fullName,
              email: comment.admin.email,
              role: "ADMIN",
            }
          : {
              name: ticket.customer.profile
                ? `${ticket.customer.profile.firstName} ${ticket.customer.profile.lastName}`
                : "Customer",
              email: ticket.customer.email,
              role: "CUSTOMER",
            },
      })),
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
    };
  }

  /**
   * Get ticket by reference number
   */
  async getTicketByReference(reference: string, customerId: string) {
    logger.info(`[getTicketByReference] Fetching ticket by reference`, {
      reference,
      customerId,
    });

    const ticket = await prisma.ticket.findFirst({
      where: {
        reference,
        customerId,
      },
      select: {
        id: true,
      },
    });

    if (!ticket) {
      logger.error(`[getTicketByReference] Ticket not found`, {
        reference,
        customerId,
      });
      throw new NotFoundError("Ticket not found");
    }

    return this.getTicketDetails(ticket.id, customerId);
  }
}

export default new CustomerSupportService();
