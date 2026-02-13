import { Request, Response } from "express";
import { asyncHandler } from "../../../shared/middleware";
import { successResponse } from "../../../shared/utils";
import { reportService } from "../services/report.service";
import { auditTrailService } from "../services/audit-trail.service";
import { AuthRequest } from "../../../shared/middleware/auth";

class ReportController {
  modules = asyncHandler(async (_req: Request, res: Response) => {
    const data = await reportService.modules();
    res.json(successResponse(data));
  });

  stats = asyncHandler(async (_req: Request, res: Response) => {
    const data = await reportService.stats();
    res.json(successResponse(data));
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await reportService.list(req.query, page, limit);
    res.json(successResponse(result.data, { pagination: result.meta }));
  });

  get = asyncHandler(async (req: Request, res: Response) => {
    const job = await reportService.get(req.params.id);
    res.json(successResponse(job));
  });

  generate = asyncHandler(async (req: AuthRequest, res: Response) => {
    const payload = {
      module: req.body.module,
      startDate: new Date(req.body.startDate),
      endDate: new Date(req.body.endDate),
      format: (req.body.format || "CSV") as "CSV" | "PDF",
      requestedBy: req.user?.userId || "system",
    };
    const job = await reportService.generate(payload);
    if (req.user) {
      await auditTrailService.logAction({
        adminId: req.user.userId,
        actionType: "REPORT_GENERATE",
        actionLabel: "Generated report",
        resourceType: "REPORT",
        resourceId: job.id,
        newState: job,
        status: "SUCCESS",
        userAgent: req.headers["user-agent"] as string,
        ipAddress: (req.headers["x-forwarded-for"] as string) || req.ip,
      });
    }
    res.status(201).json(successResponse(job));
  });
}

export const reportController = new ReportController();
