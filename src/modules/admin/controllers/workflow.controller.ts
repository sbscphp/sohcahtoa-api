import { Request, Response } from "express";
import { asyncHandler } from "../../../shared/middleware";
import { successResponse } from "../../../shared/utils";
import { workflowService } from "../services/workflow.service";

class WorkflowController {
  stats = asyncHandler(async (_req: Request, res: Response) => {
    const result = await workflowService.stats();
    res.json(successResponse(result));
  });

  actions = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await workflowService.list(req.query as any, page, limit);
    res.json(successResponse(result.data, { pagination: result.meta }));
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
    const q = (req.query.q as string) || "";
    const result = await workflowService.managementList({ status, q }, page, limit);
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
    const q = (req.query.q as string) || "";
    const result = await workflowService.exportTemplates({ status, q }, user?.userId);
    res.json(successResponse(result));
  });
}

export const workflowController = new WorkflowController();
