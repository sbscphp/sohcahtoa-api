import { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../../../shared/middleware";
import { successResponse } from "../../../shared/utils";
import { agentService } from "../services/agent.service";
import { uploadFile } from "../../../shared/utils/file-upload";
import { auditTrailService } from "../services/audit-trail.service";
import { AuthRequest } from "../../../shared/middleware/auth";

class AgentController {
  create = asyncHandler(async (req: AuthRequest, res: Response) => {
    let attachment;
    if (req.file) {
      attachment = await uploadFile(req.file, { folder: "agents" });
      if (typeof attachment.fileSize === "number" && attachment.fileSize > 2 * 1024 * 1024) {
        throw new Error("Attachment exceeds 2MB limit");
      }
    }
    const payload = {
      name: req.body.name,
      email: req.body.email,
      phoneNumber: req.body.phoneNumber,
      attachment,
    };
    const created = await agentService.create(payload);
    if (req.user) {
      await auditTrailService.logAction({
        adminId: req.user.userId,
        actionType: "AGENT_CREATE",
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
        actionType: "AGENT_UPDATE_STATUS",
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

}

export const agentController = new AgentController();
