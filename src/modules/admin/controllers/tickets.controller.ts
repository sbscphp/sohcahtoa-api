import { Request, Response } from "express";
import { asyncHandler } from "../../../shared/middleware";
import { successResponse, streamCsv, ValidationError } from "../../../shared/utils";
import { CreateTicketPayload, ticketsService } from "../services/tickets.service";
import { auditTrailService } from "../services/audit-trail.service";
import { CloudinaryService, uploadToCloudinary } from "../../../shared/utils/cloudinary";

class TicketsController {
  stats = asyncHandler(async (_req: Request, res: Response) => {
    const result = await ticketsService.getStats();
    res.json(successResponse(result));
  });

  caseTypes = asyncHandler(async (_req: Request, res: Response) => {
    const result = ticketsService.getCaseTypes();
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

  create = asyncHandler(async (req: Request, res: Response) => {
  let uploadedFile: Awaited<ReturnType<typeof uploadToCloudinary>> | undefined;

  try {
    if (req.file) {
      uploadedFile = await uploadToCloudinary(req.file.buffer, {
        folder: 'tickets',
        resourceType: 'auto',
        allowedFormats: ['jpg', 'jpeg', 'png', 'pdf'],
        maxFileSize: 2 * 1024 * 1024,
      });
    }

    const payload: CreateTicketPayload = {
      customer: req.body.customer,
      caseType: req.body.caseType,
      priorityLevel: req.body.priorityLevel,
      description: req.body.description,
      attachment: uploadedFile
        ? {
            url: uploadedFile.secureUrl,
            format: req.file?.mimetype || '',
            bytes: uploadedFile.bytes,
            publicId: uploadedFile.publicId,
          }
        : undefined,
    };

      const created = await ticketsService.create(payload);
      const adminId = (req as any).user?.userId as string;
      await auditTrailService.logAction({
        adminId,
        actionType: "INCIDENCE_CREATE",
        actionLabel: "Create ticket",
        resourceType: "INCIDENCE",
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
    const updated = await ticketsService.updateStatus(req.params.id, req.body.status, req.body?.notes, adminId);
    await auditTrailService.logAction({
      adminId,
      actionType: "INCIDENCE_UPDATE",
      actionLabel: "Update ticket status",
      resourceType: "INCIDENCE",
      resourceId: req.params.id,
      metadata: { status: req.body.status, notes: req.body?.notes },
    });
    res.json(successResponse(updated));
  });

  assign = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    const updated = await ticketsService.assignAgent(req.params.id, adminId);
    await auditTrailService.logAction({
      adminId,
      actionType: "INCIDENCE_ASSIGN",
      actionLabel: "Assign ticket",
      resourceType: "INCIDENCE",
      resourceId: req.params.id,
      metadata: { assignedAgentId: adminId },
    });
    res.json(successResponse(updated));
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
      actionType: "INCIDENCE_ASSIGN",
      actionLabel: "Assign ticket to admin",
      resourceType: "INCIDENCE",
      resourceId: req.params.id,
      metadata: { assignedAgentId: assigneeId, assignedBy },
    });
    res.json(successResponse(updated));
  });

  comment = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    const comment = await ticketsService.addComment(req.params.id, adminId, req.body.message);
    await auditTrailService.logAction({
      adminId,
      actionType: "INCIDENCE_COMMENT",
      actionLabel: "Comment on ticket",
      resourceType: "INCIDENCE",
      resourceId: req.params.id,
      metadata: { message: req.body.message },
    });
    res.status(201).json(successResponse(comment));
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
        { header: "Customer", select: (r: any) => r.customer },
        { header: "Date", select: (r: any) => r.date },
        { header: "Assigned to", select: (r: any) => r.assignedTo },
        { header: "Status", select: (r: any) => r.status },
        { header: "Priority", select: (r: any) => r.priority },
      ],
      rows as any[]
    );
  });
}

export const ticketsController = new TicketsController();
