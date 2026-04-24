import { Request, Response } from "express";
import { asyncHandler } from "../../../shared/middleware";
import { successResponse, streamCsv } from "../../../shared/utils";
import { regulatoryService } from "../services/regulatory.service";

class RegulatoryController {
  complianceDashboard = asyncHandler(async (_req: Request, res: Response) => {
    const result = await regulatoryService.complianceDashboard();
    res.json(successResponse(result));
  });

  complianceReportsList = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = (req.query.status as string) || "ALL";
    const fileType = (req.query.fileType as string) || undefined;
    const channel = (req.query.channel as string) || undefined;
    const search = (req.query.search as string) || "";
    const result = await regulatoryService.complianceReportsList({ status, fileType, channel, search }, page, limit);
    res.json(successResponse(result.data, { pagination: result.meta }));
  });

  complianceReportDetails = asyncHandler(async (req: Request, res: Response) => {
    const result = await regulatoryService.complianceReportDetails(req.params.id);
    res.json(successResponse(result));
  });

  trmsStats = asyncHandler(async (_req: Request, res: Response) => {
    const result = await regulatoryService.trmsStats();
    res.json(successResponse(result));
  });

  trmsList = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = (req.query.status as string) || "ALL";
    const search = (req.query.search as string) || "";
    const result = await regulatoryService.trmsList({ status, search }, page, limit);
    res.json(successResponse(result.data, { pagination: result.meta }));
  });

  trmsDetails = asyncHandler(async (req: Request, res: Response) => {
    const result = await regulatoryService.trmsDetails(req.params.transactionId);
    res.json(successResponse(result));
  });

  trmsSubmit = asyncHandler(async (req: Request, res: Response) => {
    const result = await regulatoryService.trmsSubmit(req.params.transactionId);
    res.json(successResponse(result));
  });

  trmsCheckStatus = asyncHandler(async (req: Request, res: Response) => {
    const result = await regulatoryService.trmsCheckStatus(req.params.formNumber);
    res.json(successResponse(result));
  });

  exportSubmissions = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as any).user;
    const status = (req.query.status as string) || "ALL";
    const search = (req.query.search as string) || "";
    const result = await regulatoryService.exportSubmissions({ status, search }, user?.userId);
    res.json(successResponse(result));
  });

  fnWindowStats = asyncHandler(async (_req: Request, res: Response) => {
    const result = await regulatoryService.fnWindowStats();
    res.json(successResponse(result));
  });

  fnWindowRates = asyncHandler(async (_req: Request, res: Response) => {
    const result = await regulatoryService.fnWindowRates();
    res.json(successResponse(result));
  });

  fnWindowRate = asyncHandler(async (req: Request, res: Response) => {
    const result = await regulatoryService.fnWindowRate(req.params.base, req.params.quote);
    res.json(successResponse(result));
  });

  cbnFnReportsList = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = (req.query.status as string) || "ALL";
    const reportType = (req.query.reportType as string) || undefined;
    const search = (req.query.search as string) || "";
    const result = await regulatoryService.cbnFnReportsList({ status, reportType, search }, page, limit);
    res.json(successResponse(result.data, { pagination: result.meta }));
  });

  cbnFnReportDetails = asyncHandler(async (req: Request, res: Response) => {
    const result = await regulatoryService.cbnFnReportDetails(req.params.id);
    res.json(successResponse(result));
  });

  auditLogsList = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const severity = (req.query.severity as string) || "ALL";
    const category = (req.query.category as string) || "ALL";
    const search = (req.query.search as string) || "";
    const result = await regulatoryService.auditLogsList({ severity, category, search }, page, limit);
    res.json(successResponse(result.data, { pagination: result.meta }));
  });

  auditLogDetails = asyncHandler(async (req: Request, res: Response) => {
    const result = await regulatoryService.auditLogDetails(req.params.id);
    res.json(successResponse(result));
  });

  regulatoryLogsList = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = (req.query.status as string) || "ALL";
    const search = (req.query.search as string) || "";
    const result = await regulatoryService.regulatoryLogsList({ status, search }, page, limit);
    res.json(successResponse(result.data, { pagination: result.meta }));
  });

  regulatoryLogDetails = asyncHandler(async (req: Request, res: Response) => {
    const result = await regulatoryService.regulatoryLogDetails(req.params.id);
    res.json(successResponse(result));
  });

  exportAuditLogs = asyncHandler(async (req: Request, res: Response) => {
    const result = await regulatoryService.auditLogsList(req.query, 1, 10_000);
    const rows = result.data || [];
    streamCsv(
      res,
      "regulatory-audit-logs.csv",
      [
        { header: "Timestamp", select: (r: any) => r.timestamp },
        { header: "User/System", select: (r: any) => r.userOrSystem },
        { header: "Action Performed", select: (r: any) => r.actionPerformed },
        { header: "Result", select: (r: any) => r.actionResult },
        { header: "Channel", select: (r: any) => r.channel },
        { header: "Audit ID", select: (r: any) => r.auditId },
      ],
      rows as any[]
    );
  });

  exportRegulatoryLogs = asyncHandler(async (req: Request, res: Response) => {
    const result = await regulatoryService.regulatoryLogsList(req.query, 1, 10_000);
    const rows = result.data || [];
    streamCsv(
      res,
      "regulatory-logs.csv",
      [
        { header: "Timestamp", select: (r: any) => r.timestamp },
        { header: "User/System", select: (r: any) => r.userOrSystem },
        { header: "Action Performed", select: (r: any) => r.actionPerformed },
        { header: "Result", select: (r: any) => r.actionResult },
        { header: "Channel", select: (r: any) => r.channel },
        { header: "Regulatory ID", select: (r: any) => r.regulatoryId },
      ],
      rows as any[]
    );
  });
}

export const regulatoryController = new RegulatoryController();
