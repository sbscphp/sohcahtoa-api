import { Request, Response } from "express";
import { asyncHandler } from "../../../shared/middleware";
import { successResponse, streamCsv } from "../../../shared/utils";
import { auditTrailService } from "../services/audit-trail.service";

class AuditController {
  list = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await auditTrailService.list(req.query, page, limit);
    res.json(successResponse(result.data, { pagination: result.meta }));
  });

  export = asyncHandler(async (req: Request, res: Response) => {
    const rows = await auditTrailService.export(req.query);
    streamCsv(
      res,
      "audit-trail.csv",
      [
        { header: "Time stamp", select: (r: any) => r.timeStamp },
        { header: "Action By", select: (r: any) => r.actionBy },
        { header: "Module Affected", select: (r: any) => r.moduleAffected },
        { header: "Action Taken", select: (r: any) => r.actionTaken },
        { header: "Affected system", select: (r: any) => r.affectedSystem },
        { header: "Status", select: (r: any) => r.status },
      ],
      rows as any[]
    );
  });
}

export const auditController = new AuditController();
