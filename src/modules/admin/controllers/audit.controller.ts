import { Request, Response } from "express";
import { asyncHandler } from "../../../shared/middleware";
import { successResponse } from "../../../shared/utils";
import { auditTrailService } from "../services/audit-trail.service";

class AuditController {
  list = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await auditTrailService.list(req.query, page, limit);
    res.json(successResponse(result.data, { pagination: result.meta }));
  });

}

export const auditController = new AuditController();
