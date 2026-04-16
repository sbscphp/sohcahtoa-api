import { Request, Response } from "express";
import { asyncHandler } from "../../../shared/middleware";
import { ServiceUnavailableError, successResponse, streamCsv, ValidationError } from "../../../shared/utils";
import { CreateTicketPayload, UpdateTicketPayload, ticketsService } from "../services/tickets.service";
import { auditTrailService } from "../services/audit-trail.service";
import { CloudinaryService, uploadToCloudinary } from "../../../shared/utils/cloudinary";
import notificationService from "../../notifications/services/notification.service";
import NotificationTemplates from "../../notifications/templates/notification-templates";
import { NotificationType, NotificationChannel } from "@prisma/client";
import { ActionType } from "../../../shared/types/action-type";

class TicketsController {
  stats = asyncHandler(async (_req: Request, res: Response) => {
    const result = await ticketsService.getStats();
    res.json(successResponse(result));
  });

  caseTypes = asyncHandler(async (_req: Request, res: Response) => {
    const result = ticketsService.getCaseTypes();
    res.json(successResponse(result));
  });

  statuses = asyncHandler(async (_req: Request, res: Response) => {
    const result = ticketsService.getStatusOptions();
    res.json(successResponse(result));
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await ticketsService.list(req.query, page, limit);
    res.json(successResponse(result.data, { pagination: result.meta }));
  });

  get = asyncHandler(async (req: Request, res: Response) => {
    const ticket = await ticketsService.get(req.params.id);
    res.json(successResponse(ticket));
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    let uploadedFile: Awaited<ReturnType<typeof uploadToCloudinary>> | undefined;

    try {
      if (req.file) {
        try {
          uploadedFile = await uploadToCloudinary(req.file.buffer, {
            folder: "tickets",
            resourceType: "auto",
            allowedFormats: ["jpg", "jpeg", "png", "pdf"],
            maxFileSize: 2 * 1024 * 1024,
          });
        } catch (_e: any) {
          throw new ServiceUnavailableError("Attachment upload failed");
        }
      }

      const payload: UpdateTicketPayload = {
        caseType: req.body.caseType,
        priorityLevel: req.body.priorityLevel ?? req.body.priority,
        description: req.body.description,
        attachment: uploadedFile
          ? {
              url: uploadedFile.secureUrl,
              format: req.file?.mimetype || "",
              bytes: uploadedFile.bytes,
              publicId: uploadedFile.publicId,
            }
          : undefined,
      };

      const result = await ticketsService.update(req.params.id, payload, adminId);
      await auditTrailService.logAction({
        adminId,
        actionType: ActionType.TICKET_UPDATE,
        actionLabel: "Update ticket",
        resourceType: "TICKET",
        resourceId: req.params.id,
        previousState: result.previous,
        newState: result.updated,
        metadata: result.changes,
      });
      res.json(successResponse(result.updated));
    } catch (error) {
      if (uploadedFile?.publicId) {
        await CloudinaryService.delete(uploadedFile.publicId, uploadedFile.resourceType as any).catch(() => {});
      }
      throw error;
    }
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    let uploadedFile: Awaited<ReturnType<typeof uploadToCloudinary>> | undefined;

    try {
      if (req.file) {
        try {
          uploadedFile = await uploadToCloudinary(req.file.buffer, {
            folder: "tickets",
            resourceType: "auto",
            allowedFormats: ["jpg", "jpeg", "png", "pdf"],
            maxFileSize: 2 * 1024 * 1024,
          });
        } catch (e: any) {
          throw new ServiceUnavailableError("Attachment upload failed");
        }
      }

      const payload: CreateTicketPayload = {
        customer: req.body.customer,
        caseType: req.body.caseType,
        priorityLevel: req.body.priorityLevel ?? req.body.priority,
        description: req.body.description,
        attachment: uploadedFile
          ? {
              url: uploadedFile.secureUrl,
              format: req.file?.mimetype || "",
              bytes: uploadedFile.bytes,
              publicId: uploadedFile.publicId,
            }
          : undefined,
      };

      const adminId = (req as any).user?.userId as string;
      const created = await ticketsService.create(payload, adminId);

      await auditTrailService.logAction({
        adminId,
        actionType: ActionType.TICKET_CREATE,
        actionLabel: "Create ticket",
        resourceType: "TICKET",
        resourceId: created.id,
        newState: created,
      });

      return res.status(201).json(successResponse(created));
    } catch (error) {
      // Prevent orphaned uploads if DB fails
      if (uploadedFile?.publicId) {
        await CloudinaryService.delete(uploadedFile.publicId, uploadedFile.resourceType as any).catch(() => {
          // Optional: log cleanup failure
        });
      }

      throw error;
    }
  });


  updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    const updated = await ticketsService.updateStatus(req.params.id, req.body.status, undefined, adminId);
    await auditTrailService.logAction({
      adminId,
      actionType: ActionType.TICKET_STATUS_UPDATE,
      actionLabel: "Update ticket status",
      resourceType: "TICKET",
      resourceId: req.params.id,
      metadata: { status: req.body.status },
    });
    res.json(successResponse(updated));
  });

  assign = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    const updated = await ticketsService.assignAgent(req.params.id, adminId);
    await auditTrailService.logAction({
      adminId,
      actionType: ActionType.TICKET_ASSIGN,
      actionLabel: "Assign ticket",
      resourceType: "TICKET",
      resourceId: req.params.id,
      metadata: { assignedAgentId: adminId },
    });
    const fullTicket = await ticketsService.get(updated.id);
    const template = NotificationTemplates.TICKET_ASSIGNED_ADMIN({
      ticketReference: fullTicket.reference || req.params.id,
      ticketId: fullTicket.id,
      customerName: (fullTicket.customer as any)?.fullName,
      priority: fullTicket.priority,
    });
    await notificationService.sendNotification({
      userId: adminId,
      type: NotificationType.IN_APP,
      channel: NotificationChannel.IN_APP,
      priority: template.priority,
      title: template.title,
      body: template.body,
      data: { actionUrl: template.actionUrl },
      ticketId: updated.id,
    });
    res.json(successResponse(fullTicket));
  });

  assignTo = asyncHandler(async (req: Request, res: Response) => {
    const assignedBy = (req as any).user?.userId as string;
    const assigneeId = req.body?.adminId as string;
    if (!assigneeId) {
      throw new ValidationError("adminId is required");
    }
    const updated = await ticketsService.assignAgent(req.params.id, assigneeId);
    await auditTrailService.logAction({
      adminId: assignedBy,
      actionType: ActionType.TICKET_ASSIGN,
      actionLabel: "Assign ticket to admin",
      resourceType: "TICKET",
      resourceId: req.params.id,
      metadata: { assignedAgentId: assigneeId, assignedBy },
    });
    const fullTicket = await ticketsService.get(updated.id);
    const template = NotificationTemplates.TICKET_ASSIGNED_ADMIN({
      ticketReference: fullTicket.reference || req.params.id,
      ticketId: fullTicket.id,
      customerName: (fullTicket.customer as any)?.fullName,
      priority: fullTicket.priority,
    });
    await notificationService.sendNotification({
      userId: assigneeId,
      type: NotificationType.IN_APP,
      channel: NotificationChannel.IN_APP,
      priority: template.priority,
      title: template.title,
      body: template.body,
      data: { actionUrl: template.actionUrl },
      ticketId: updated.id,
    });
    res.json(successResponse(fullTicket));
  });

  comment = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    const comment = await ticketsService.addComment(req.params.id, adminId, req.body.message);
    await auditTrailService.logAction({
      adminId,
      actionType: ActionType.TICKET_COMMENT,
      actionLabel: "Comment on ticket",
      resourceType: "TICKET",
      resourceId: req.params.id,
      metadata: { message: req.body.message },
    });
    res.status(201).json(successResponse(comment));
  });

  comments = asyncHandler(async (req: Request, res: Response) => {
    const items = await ticketsService.listComments(req.params.id);
    res.json(successResponse(items));
  });

  exportCsv = asyncHandler(async (req: Request, res: Response) => {
    const rows = await ticketsService.export({
      search: (req.query.search as string) || (req.query.q as string) || "",
      status: (req.query.status as string) || undefined,
      category: (req.query.category as string) || undefined,
      priority: (req.query.priority as string) || undefined,
    });
    streamCsv(
      res,
      "tickets.csv",
      [
        { header: "Incident ID", select: (r: any) => r.incidentId },
        { header: "Date", select: (r: any) => (r.date ? new Date(r.date).toISOString() : "") },
        { header: "Customer Name", select: (r: any) => r.customerName },
        { header: "Customer Email", select: (r: any) => r.customerEmail },
        { header: "Assigned Agent", select: (r: any) => r.assignedAgentName },
        { header: "Agent Role", select: (r: any) => r.assignedAgentRole },
        { header: "Status", select: (r: any) => r.status },
        { header: "Priority", select: (r: any) => r.priority },
      ],
      rows as any[]
    );
  });
}

export const ticketsController = new TicketsController();
