import { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../../../shared/middleware";
import { successResponse, ValidationError } from "../../../shared/utils";
import { streamCsv } from "../../../shared/utils";
import { agentService } from "../services/agent.service";
import { uploadToCloudinary } from "../../../shared/utils/cloudinary";
import { auditTrailService } from "../services/audit-trail.service";
import { AuthRequest } from "../../../shared/middleware/auth";
import { ActionType } from "../../../shared/types/action-type";

class AgentController {
  create = asyncHandler(async (req: AuthRequest, res: Response) => {
    let attachment;
    if (req.file) {
      if (typeof req.file.size === "number" && req.file.size > 2 * 1024 * 1024) {
        throw new ValidationError("Attachment exceeds 2MB limit");
      }
      try {
        const result = await uploadToCloudinary(req.file.buffer, {
          folder: "agents",
          resourceType: "auto",
          allowedFormats: ["jpg", "jpeg", "png", "pdf"],
          maxFileSize: 2 * 1024 * 1024,
        });
        attachment = {
          fileUrl: result.secureUrl,
          fileName: req.file.originalname,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
        };
      } catch (err: any) {
        throw new ValidationError(`Attachment upload failed: ${err?.message || "Unknown error"}`);
      }
    }
    const payload = {
      name: req.body.name,
      email: req.body.email,
      phoneNumber: req.body.phoneNumber,
      branch: req.body.branch,
      attachment,
    };
    if (!payload.branch) {
      throw new ValidationError("branch is required");
    }
    const created = await agentService.create(payload);
    if (req.user) {
      await auditTrailService.logAction({
        adminId: req.user.userId,
        actionType: ActionType.AGENT_CREATE,
        actionLabel: "Agent created",
        resourceType: "AGENT",
        resourceId: created.id,
        newState: created,
        status: "SUCCESS",
        userAgent: req.headers["user-agent"] as string,
        ipAddress: (req.headers["x-forwarded-for"] as string) || req.ip,
      });
    }
    res.status(201).json(successResponse(created));
  });

  stats = asyncHandler(async (_req: Request, res: Response) => {
    const result = await agentService.stats();
    res.json(successResponse(result));
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await agentService.list(req.query, page, limit);
    res.json(successResponse(result.data, { pagination: result.meta }));
  });

  getTransactions = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const filters = {
      status: req.query.status,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
    };
    const result = await agentService.transactions(req.params.id, filters, page, limit);
    res.json(successResponse(result.data, { pagination: result.meta }));
  });

  exportTransactionsCsv = asyncHandler(async (req: Request, res: Response) => {
    const filters = {
      status: req.query.status,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
    };
    const rows = await agentService.exportTransactions(req.params.id, filters);
    streamCsv(
      res,
      "agent-transactions.csv",
      [
        { header: "Transaction ID", select: (r: any) => r.transactionId },
        { header: "Reference Number", select: (r: any) => r.referenceNumber || "" },
        { header: "Type", select: (r: any) => r.type || "" },
        { header: "Status", select: (r: any) => r.status || "" },
        { header: "Stage", select: (r: any) => r.stage || "" },
        { header: "Value", select: (r: any) => r.value },
        { header: "Currency", select: (r: any) => r.currency || "" },
        { header: "Pickup Code", select: (r: any) => r.pickup?.code || "" },
        { header: "Pickup Location", select: (r: any) => r.pickup?.location || "" },
        { header: "Created At", select: (r: any) => (r.createdAt ? new Date(r.createdAt).toISOString() : "") },
      ],
      rows as any[]
    );
  });

  getTransaction = asyncHandler(async (req: Request, res: Response) => {
    const result = await agentService.transaction(req.params.id, req.params.transactionId);
    res.json(successResponse(result));
  });

  get = asyncHandler(async (req: Request, res: Response) => {
    const agent = await agentService.get(req.params.id);
    res.json(successResponse(agent));
  });

  updateStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
    const before = await agentService.get(req.params.id);
    const updated = await agentService.updateStatus(req.params.id, !!req.body.isActive);
    if (req.user) {
      await auditTrailService.logAction({
        adminId: req.user.userId,
        actionType: ActionType.AGENT_UPDATE_STATUS,
        actionLabel: "Agent status updated",
        resourceType: "AGENT",
        resourceId: updated.id,
        previousState: before,
        newState: updated,
        status: "SUCCESS",
        userAgent: req.headers["user-agent"] as string,
        ipAddress: (req.headers["x-forwarded-for"] as string) || req.ip,
      });
    }
    res.json(successResponse(updated));
  });

  updateApproval = asyncHandler(async (req: AuthRequest, res: Response) => {
    const before = await agentService.get(req.params.id);
    const updated = await agentService.updateApproval(req.params.id, !!req.body.isApproved);
    if (req.user) {
      await auditTrailService.logAction({
        adminId: req.user.userId,
        actionType: ActionType.AGENT_APPROVE,
        actionLabel: "Agent approval updated",
        resourceType: "AGENT",
        resourceId: updated.id,
        previousState: before,
        newState: updated,
        status: "SUCCESS",
        userAgent: req.headers["user-agent"] as string,
        ipAddress: (req.headers["x-forwarded-for"] as string) || req.ip,
      });
    }
    res.json(successResponse(updated));
  });

  update = asyncHandler(async (req: AuthRequest, res: Response) => {
    let attachment;
    if (req.file) {
      if (typeof req.file.size === "number" && req.file.size > 2 * 1024 * 1024) {
        throw new ValidationError("Attachment exceeds 2MB limit");
      }
      try {
        const result = await uploadToCloudinary(req.file.buffer, {
          folder: "agents",
          resourceType: "auto",
          allowedFormats: ["jpg", "jpeg", "png", "pdf"],
          maxFileSize: 2 * 1024 * 1024,
        });
        attachment = {
          fileUrl: result.secureUrl,
          fileName: req.file.originalname,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
        };
      } catch (err: any) {
        throw new ValidationError(`Attachment upload failed: ${err?.message || "Unknown error"}`);
      }
    }
    const before = await agentService.get(req.params.id);
    const updated = await agentService.update(req.params.id, {
      name: req.body.name,
      email: req.body.email,
      phoneNumber: req.body.phoneNumber,
      branch: req.body.branch,
      attachment,
    });
    const enriched = await agentService.get(req.params.id);
    if (req.user) {
      await auditTrailService.logAction({
        adminId: req.user.userId,
        actionType: ActionType.AGENT_UPDATE_STATUS,
        actionLabel: "Agent details updated",
        resourceType: "AGENT",
        resourceId: updated.id,
        previousState: before,
        newState: enriched,
        status: "SUCCESS",
        userAgent: req.headers["user-agent"] as string,
        ipAddress: (req.headers["x-forwarded-for"] as string) || req.ip,
      });
    }
    res.json(successResponse(enriched));
  });

  deactivate = asyncHandler(async (req: AuthRequest, res: Response) => {
    const before = await agentService.get(req.params.id);
    const updated = await agentService.updateStatus(req.params.id, false);
    if (req.user) {
      await auditTrailService.logAction({
        adminId: req.user.userId,
        actionType: ActionType.AGENT_DEACTIVATE,
        actionLabel: "Agent deactivated",
        resourceType: "AGENT",
        resourceId: updated.id,
        previousState: before,
        newState: updated,
        status: "SUCCESS",
        userAgent: req.headers["user-agent"] as string,
        ipAddress: (req.headers["x-forwarded-for"] as string) || req.ip,
      });
    }
    res.json(successResponse(updated));
  });

  exportCsv = asyncHandler(async (req: Request, res: Response) => {
    const rows = await agentService.export(req.query);
    streamCsv(
      res,
      "agents.csv",
      [
        { header: "Agent", select: (r: any) => r.agentName },
        { header: "Agent ID", select: (r: any) => r.agentId },
        { header: "Contact Phone", select: (r: any) => r.contactPhone },
        { header: "Contact Email", select: (r: any) => r.contactEmail },
        { header: "Total Transactions", select: (r: any) => r.totalTransactions },
        { header: "Transaction Volume", select: (r: any) => r.transactionVolume },
        { header: "Status", select: (r: any) => r.status },
      ],
      rows as any[]
    );
  });
}

export const agentController = new AgentController();
