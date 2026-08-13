import { Request, Response } from "express";
import { asyncHandler } from "../../../shared/middleware";
import { successResponse, ValidationError } from "../../../shared/utils";
import { reportService } from "../services/report.service";
import { auditTrailService } from "../services/audit-trail.service";
import { AuthRequest } from "../../../shared/middleware/auth";
import { ActionType } from "../../../shared/types/action-type";

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
    const module = req.body.module;
    const startDate = new Date(req.body.startDate);
    const endDate = new Date(req.body.endDate);
    const format = ((req.body.format || "CSV") as string).toUpperCase() as "CSV" | "PDF";

    if (!module) throw new ValidationError("module is required");

    const validModules = await reportService.modules();
    const normalizedInput = module.toString().trim().toUpperCase();
    const singularInput = normalizedInput.endsWith("S") && !normalizedInput.endsWith("SS") ? normalizedInput.slice(0, -1) : normalizedInput;
    const isValidModule = validModules.some(
      m => m.key === normalizedInput ||
           m.key === singularInput ||
           m.name.toUpperCase() === normalizedInput ||
           m.name.toUpperCase() === singularInput ||
           (normalizedInput === "DISCREPANCIES" && m.key === "DISCREPANCY") ||
           (normalizedInput === "USER_MANAGEMENT" && m.key === "USER_MANAGEMENT")
    );
    if (!isValidModule) {
      throw new ValidationError(`Invalid report module: ${module}`);
    }

    if (!req.body.startDate || Number.isNaN(startDate.getTime())) {
      throw new ValidationError("startDate must be a valid date");
    }
    if (!req.body.endDate || Number.isNaN(endDate.getTime())) {
      throw new ValidationError("endDate must be a valid date");
    }
    if (format !== "CSV" && format !== "PDF") {
      throw new ValidationError("format must be CSV or PDF");
    }

    const generated = await reportService.buildGeneratedReport({ module, startDate, endDate });
    const ext = format === "PDF" ? "pdf" : "csv";
    const filename = `${generated.filenameBase}.${ext}`;
    const fileSize =
      format === "PDF" ? generated.pdf.length : Buffer.byteLength(generated.csv, "utf8");

    const job = await reportService.generate({
      module,
      startDate,
      endDate,
      format,
      requestedBy: req.user?.userId || "system",
      metadata: { fileName: filename, fileSize, rowCount: generated.rowCount },
    });
    if (req.user) {
      await auditTrailService.logAction({
        adminId: req.user.userId,
        actionType: ActionType.REPORT_GENERATE,
        actionLabel: "Generated report",
        resourceType: "REPORT",
        resourceId: job.id,
        newState: job,
        status: "SUCCESS",
        userAgent: req.headers["user-agent"] as string,
        ipAddress: (req.headers["x-forwarded-for"] as string) || req.ip,
      });
    }

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", `${fileSize}`);
    if (format === "CSV") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.status(200).send(Buffer.from(generated.csv, "utf8"));
      return;
    }

    res.setHeader("Content-Type", "application/pdf");
    res.status(200).send(generated.pdf);
  });
}

export const reportController = new ReportController();
