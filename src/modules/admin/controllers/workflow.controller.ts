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
}

export const workflowController = new WorkflowController();
