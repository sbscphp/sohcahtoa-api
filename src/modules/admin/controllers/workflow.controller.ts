import { Request, Response } from "express";
import { asyncHandler } from "../../../shared/middleware";
import { successResponse, streamCsv } from "../../../shared/utils";
import { workflowService } from "../services/workflow.service";

class WorkflowController {
  stats = asyncHandler(async (_req: Request, res: Response) => {
    const result = await workflowService.stats();
    res.json(successResponse(result));
  });

  actions = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await workflowService.list({ ...req.query, module: "Transaction" } as any, page, limit);
    res.json(successResponse(result.data, { pagination: result.meta }));
  });

  exportActionsCsv = asyncHandler(async (req: Request, res: Response) => {
    const result = await workflowService.list({ ...req.query, module: "Transaction" } as any, 1, 10_000);
    const rows = result.data || [];
    streamCsv(
      res,
      "workflow-actions.csv",
      [
        { header: "ID", select: (r: any) => r.id || "" },
        { header: "Module", select: (r: any) => r.module || "" },
        { header: "Workflow Action", select: (r: any) => r.workflowAction || "" },
        { header: "Action Needed", select: (r: any) => r.actionNeeded || "" },
        { header: "Status", select: (r: any) => r.status || "" },
        { header: "Date Initiated", select: (r: any) => (r.dateInitiated ? new Date(r.dateInitiated).toISOString() : "") },
        { header: "Escalation Minutes", select: (r: any) => r.escalationMinutes ?? "" },
        { header: "Title", select: (r: any) => r.title || "" },
        { header: "Subtype", select: (r: any) => r.subtype || "" },
      ],
      rows as any[]
    );
  });

  createTemplate = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as any).user;
    const result = await workflowService.createTemplate(req.body, user?.userId);
    res.json(successResponse(result));
  });

  saveDraft = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as any).user;
    const result = await workflowService.saveDraft(req.body, user?.userId);
    res.json(successResponse(result));
  });

  listTemplates = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = (req.query.status as string) || undefined;
    const result = await workflowService.listTemplates(status, page, limit);
    res.json(successResponse(result.data, { pagination: result.meta }));
  });

  getTemplate = asyncHandler(async (req: Request, res: Response) => {
    const result = await workflowService.getTemplate(req.params.id);
    res.json(successResponse(result));
  });

  updateTemplate = asyncHandler(async (req: Request, res: Response) => {
    const result = await workflowService.updateTemplate(req.params.id, req.body);
    res.json(successResponse(result));
  });

  publishTemplate = asyncHandler(async (req: Request, res: Response) => {
    const result = await workflowService.publishTemplate(req.params.id);
    res.json(successResponse(result));
  });

  managementStats = asyncHandler(async (_req: Request, res: Response) => {
    const result = await workflowService.managementStats();
    res.json(successResponse(result));
  });

  managementList = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = (req.query.status as string) || "ALL";
    const search = (req.query.search as string) || (req.query.q as string) || "";
    const result = await workflowService.managementList({ status, search }, page, limit);
    res.json(successResponse(result.data, { pagination: result.meta }));
  });

  activateTemplate = asyncHandler(async (req: Request, res: Response) => {
    const result = await workflowService.setTemplateStatus(req.params.id, "ACTIVATE");
    res.json(successResponse(result));
  });

  deactivateTemplate = asyncHandler(async (req: Request, res: Response) => {
    const result = await workflowService.setTemplateStatus(req.params.id, "DEACTIVATE");
    res.json(successResponse(result));
  });

  exportTemplates = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as any).user;
    const status = (req.query.status as string) || "ALL";
    const search = (req.query.search as string) || (req.query.q as string) || "";
    const result = await workflowService.exportTemplates({ status, search }, user?.userId);
    res.json(successResponse(result));
  });
}

export const workflowController = new WorkflowController();
